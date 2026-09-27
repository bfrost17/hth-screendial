import { invoke } from "@tauri-apps/api/core";

export interface HttpResponse {
  status: number;
  body: string;
}

/**
 * Perform an HTTP request via Tauri's native Rust backend (bypasses browser CORS restrictions).
 * Falls back to browser fetch if running in a non-Tauri environment.
 */
export async function nativeHttpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<HttpResponse> {
  const method = (options.method || "GET").toUpperCase();
  const headersList: [string, string][] = Object.entries(options.headers || {});
  const body = options.body;

  try {
    const res = await invoke<HttpResponse>("http_request_cmd", {
      url,
      method,
      headers: headersList,
      body: body ?? null,
    });
    return res;
  } catch (err) {
    // If invoke fails (e.g. browser context without Tauri), fall back to standard fetch
    const response = await fetch(url, {
      method,
      headers: options.headers,
      body,
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text,
    };
  }
}
