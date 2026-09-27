use postgres_native_tls::MakeTlsConnector;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use tokio_postgres::{config::SslMode, Client};

/// Requested output dimensionality for Gemini's `gemini-embedding-001` model, matching
/// the `public.interactions.embedding` column's `vector(768)` type.
const EMBEDDING_DIMENSIONS: usize = 768;

#[derive(serde::Deserialize)]
struct EmbedContentResponse {
    embedding: EmbeddingValues,
}

#[derive(serde::Deserialize)]
struct EmbeddingValues {
    values: Vec<f32>,
}

/// Calls Gemini's `gemini-embedding-001` model to embed a query/response pair, requesting
/// a 768-dimension vector via `outputDimensionality` to match the database column.
///
/// Reuses the same API key the frontend uses for chat (`VITE_GOOGLE_GEMINI_KEY`,
/// falling back to `VITE_GEMINI_API_KEY`), which `connect` has already loaded from
/// `.env.local` into the process environment by the time this is called.
async fn generate_interaction_embedding(query: &str, response: &str) -> Result<Vec<f32>, String> {
    let api_key = std::env::var("VITE_GOOGLE_GEMINI_KEY")
        .or_else(|_| std::env::var("VITE_GEMINI_API_KEY"))
        .map_err(|_| {
            "No Gemini API key is configured (VITE_GOOGLE_GEMINI_KEY or VITE_GEMINI_API_KEY)."
                .to_string()
        })?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("The configured Gemini API key is empty.".to_string());
    }

    let text = format!("User: {query}\nAssistant: {response}");
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
    let body = serde_json::json!({
        "content": { "parts": [{ "text": text }] },
        "outputDimensionality": EMBEDDING_DIMENSIONS
    });

    // The key is sent via header rather than as a `?key=...` query parameter so it can
    // never end up embedded in a URL that gets echoed back into logs (e.g. reqwest's
    // `Error` Display impl includes the request URL for connection/transport failures).
    let http_response = reqwest::Client::new()
        .post(url)
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Gemini embedding request failed: {error}"))?;

    if !http_response.status().is_success() {
        let status = http_response.status();
        let error_text = http_response.text().await.unwrap_or_default();
        return Err(format!("Gemini embedding API error ({status}): {error_text}"));
    }

    let parsed: EmbedContentResponse = http_response
        .json()
        .await
        .map_err(|error| format!("Could not parse the Gemini embedding response: {error}"))?;

    if parsed.embedding.values.len() != EMBEDDING_DIMENSIONS {
        return Err(format!(
            "Expected a {EMBEDDING_DIMENSIONS}-dimension embedding, got {}.",
            parsed.embedding.values.len()
        ));
    }

    Ok(parsed.embedding.values)
}

async fn connect(app: &AppHandle) -> Result<Client, String> {
    // `.env.local` is bundled as a resource (see tauri.conf.json) so this resolves both in
    // `tauri dev` and inside a packaged .app/.exe, instead of the dev machine's absolute
    // source path baked in by CARGO_MANIFEST_DIR.
    let env_path = app
        .path()
        .resolve(".env.local", BaseDirectory::Resource)
        .map_err(|error| format!("Could not locate the bundled .env.local resource: {error}"))?;
    dotenvy::from_path(&env_path)
        .map_err(|error| format!("Could not load {}: {error}", env_path.display()))?;

    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL is missing from the repository .env.local file.".to_string())?;
    let insecure_demo_tls = match std::env::var("SCREENDIAL_DEMO_INSECURE_TLS") {
        Ok(value) => value.parse::<bool>().map_err(|_| {
            "SCREENDIAL_DEMO_INSECURE_TLS must be set to true or false.".to_string()
        })?,
        Err(std::env::VarError::NotPresent) => false,
        Err(error) => {
            return Err(format!(
                "Could not read SCREENDIAL_DEMO_INSECURE_TLS: {error}"
            ))
        }
    };
    let mut config = database_url
        .parse::<tokio_postgres::Config>()
        .map_err(|error| format!("DATABASE_URL is invalid: {error}"))?;
    config.ssl_mode(SslMode::Require);

    let mut tls_builder = native_tls::TlsConnector::builder();
    tls_builder.danger_accept_invalid_certs(insecure_demo_tls);
    if insecure_demo_tls {
        eprintln!(
            "[Database] WARNING: TLS certificate verification is disabled for this demo connection."
        );
    }
    let tls = tls_builder
        .build()
        .map_err(|error| format!("Could not configure PostgreSQL TLS: {error}"))?;
    let (client, connection) = config
        .connect(MakeTlsConnector::new(tls))
        .await
        .map_err(|error| format!("TigerData connection failed: {error}"))?;

    tokio::spawn(async move {
        if let Err(error) = connection.await {
            eprintln!("[Database] PostgreSQL connection closed: {error}");
        }
    });

    Ok(client)
}

#[tauri::command]
pub async fn upsert_auth0_user_cmd(app: AppHandle, auth0_id: String) -> Result<i64, String> {
    let auth0_id = auth0_id.trim();
    if auth0_id.is_empty() {
        return Err("An Auth0 user ID is required to save the user.".to_string());
    }

    let client = connect(&app).await?;
    let row = client
        .query_one(
            "INSERT INTO public.users (auth0_id)
             VALUES ($1)
             ON CONFLICT (auth0_id)
             DO UPDATE SET auth0_id = EXCLUDED.auth0_id
             RETURNING id",
            &[&auth0_id],
        )
        .await
        .map_err(|error| format!("Could not save the Auth0 user: {error}"))?;

    Ok(row.get("id"))
}

#[tauri::command]
pub async fn save_gemini_interaction_cmd(
    app: AppHandle,
    user_id: i64,
    query: String,
    response: String,
) -> Result<(), String> {
    let query = query.trim();
    let response = response.trim();
    if user_id <= 0 || query.is_empty() || response.is_empty() {
        return Err("A valid user, query, and Gemini response are required.".to_string());
    }

    let client = connect(&app).await?;

    // Embeddings are best-effort: if generation fails (missing key, rate limit, network
    // error), we still save the interaction and simply leave `embedding` NULL.
    let embedding = match generate_interaction_embedding(query, response).await {
        Ok(values) => Some(pgvector::Vector::from(values)),
        Err(error) => {
            eprintln!("[Database] Could not generate an embedding for this interaction: {error}");
            None
        }
    };

    let inserted = client
        .execute(
            "INSERT INTO public.interactions (user_id, query, response, embedding)
             VALUES ($1, $2, $3, $4)",
            &[&user_id, &query, &response, &embedding],
        )
        .await
        .map_err(|error| format!("Could not save the Gemini interaction: {error}"))?;
    if inserted != 1 {
        return Err(format!(
            "Expected to insert one row into public.interactions, inserted {inserted}."
        ));
    }
    eprintln!("[Database] Inserted one row into public.interactions.");

    Ok(())
}
