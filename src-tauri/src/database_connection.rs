use postgres_native_tls::MakeTlsConnector;
use tokio_postgres::{config::SslMode, Client};

async fn connect() -> Result<Client, String> {
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(".env.local");
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
pub async fn upsert_auth0_user_cmd(auth0_id: String) -> Result<i64, String> {
    let auth0_id = auth0_id.trim();
    if auth0_id.is_empty() {
        return Err("An Auth0 user ID is required to save the user.".to_string());
    }

    let client = connect().await?;
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
    user_id: i64,
    query: String,
    response: String,
) -> Result<(), String> {
    let query = query.trim();
    let response = response.trim();
    if user_id <= 0 || query.is_empty() || response.is_empty() {
        return Err("A valid user, query, and Gemini response are required.".to_string());
    }

    let client = connect().await?;
    let inserted = client
        .execute(
            "INSERT INTO public.interactions (user_id, query, response)
             VALUES ($1, $2, $3)",
            &[&user_id, &query, &response],
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
