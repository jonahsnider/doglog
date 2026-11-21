use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{Engine, prelude::BASE64_STANDARD};
use tauri::ipc::{InvokeBody, Request};

/// Save a live session's recording, sent as the request body, to the path in the `path` header (base64 UTF-8), or to a
/// new file in the temporary folder. The frontend can only write to folders the user picked, agents pick any path.
/// Returns where it was saved.
#[tauri::command]
pub fn save_live_export(request: Request<'_>) -> Result<PathBuf, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected the recording's bytes".into());
    };
    let path = match request.headers().get("path") {
        Some(encoded) => {
            let decoded = BASE64_STANDARD
                .decode(encoded.as_bytes())
                .map_err(|error| error.to_string())?;
            PathBuf::from(String::from_utf8(decoded).map_err(|error| error.to_string())?)
        }
        None => {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            std::env::temp_dir().join(format!("doglog-live-{now}.wpilog"))
        }
    };
    if !path.is_absolute() {
        return Err("The path must be absolute".into());
    }
    std::fs::write(&path, bytes).map_err(|error| format!("Couldn't save {}: {error}", path.display()))?;
    Ok(path)
}
