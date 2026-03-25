use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager};
use url::Url;

/// Holds the most recent deep link URL received before the frontend was ready.
/// The frontend calls `get_pending_deep_link` on mount to retrieve it.
#[derive(Default)]
struct DeepLinkState {
    pending_url: Mutex<Option<String>>,
}

/// Tauri command: returns (and clears) any deep link URL that arrived
/// before the frontend was mounted (cold-start scenario).
#[tauri::command]
fn get_pending_deep_link(state: tauri::State<'_, DeepLinkState>) -> Option<String> {
    state.pending_url.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(DeepLinkState::default())
        .invoke_handler(tauri::generate_handler![get_pending_deep_link])
        .setup(|app| {
            // Listen for deep-link URLs (works for both warm and cold start).
            // The deep-link plugin emits "deep-link://new-url" with a JSON
            // payload containing the list of URLs received.
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                // The payload is a JSON array of URL strings, e.g. ["claudetauri://plaid-callback?state=..."]
                if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                    for raw_url in urls {
                        // Validate it is a well-formed URL
                        if let Ok(parsed) = Url::parse(&raw_url) {
                            // Store in state so the frontend can retrieve it on mount (cold start)
                            if let Some(state) = handle.try_state::<DeepLinkState>() {
                                *state.pending_url.lock().unwrap() = Some(parsed.to_string());
                            }
                            // Emit to the frontend if it is already listening (warm start)
                            let _ = handle.emit("plaid-callback", parsed.to_string());
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
