import { invoke } from "@tauri-apps/api/core";

/**
 * Log messages directly to the running terminal stdout via Tauri's Rust backend,
 * and mirror to browser console.
 */
export function logToTerminal(tag: string, message: string, data?: any) {
  let formattedData = "";
  if (data !== undefined) {
    if (typeof data === "string") {
      formattedData = ` | ${data}`;
    } else {
      try {
        formattedData = ` | ${JSON.stringify(data, null, 2)}`;
      } catch {
        formattedData = ` | [Non-serializable object]`;
      }
    }
  }

  const logLine = `[Screendial ${tag}] ${message}${formattedData}`;

  // Log to browser webview console
  console.log(logLine);

  // Send to terminal stdout via Tauri command
  invoke("log_terminal_cmd", { message: logLine }).catch(() => {
    // Fallback if not running in Tauri window yet
  });
}
