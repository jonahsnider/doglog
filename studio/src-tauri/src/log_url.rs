//! Streaming HTTP(S) log downloads for the desktop app, without browser CORS limits.

use liblzma::write::XzDecoder;
use reqwest::redirect::Policy;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{
    AppHandle, Manager, State, WebviewWindow,
    ipc::{Channel, InvokeResponseBody},
};
use tokio::sync::watch;

const FRAME_CHUNK: u8 = 0;
const FRAME_END: u8 = 1;
const FRAME_ERROR: u8 = 2;
const WPILOG_MAGIC: &[u8; 6] = b"WPILOG";

struct ActiveDownload {
    window_label: String,
    cancel: watch::Sender<bool>,
}

/// Active remote log downloads, keyed by download ID so the frontend or a closing window can cancel them
#[derive(Default)]
pub struct ActiveUrlDownloads(Mutex<HashMap<u64, ActiveDownload>>);

static NEXT_DOWNLOAD_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedLogUrl {
    pub id: u64,
    pub final_url: String,
    pub content_disposition: Option<String>,
    pub content_length: Option<u64>,
}

#[derive(Serialize)]
pub struct LogUrlStartError {
    pub kind: &'static str,
    pub message: String,
}

impl LogUrlStartError {
    fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

/// Whether `value` is a syntactically valid `http://` or `https://` URL with a host
pub fn is_http_url(value: &str) -> bool {
    tauri::Url::parse(value).is_ok_and(|url| matches!(url.scheme(), "http" | "https") && url.has_host())
}

/// Cancel every active URL download belonging to `label`, ex. when its window closes
pub fn cancel_for_window(app: &AppHandle, label: &str) {
    let state = app.state::<ActiveUrlDownloads>();
    let mut active = state.0.lock().unwrap();
    active.retain(|_, download| {
        if download.window_label == label {
            let _ = download.cancel.send(true);
            false
        } else {
            true
        }
    });
}

#[tauri::command]
pub fn cancel_log_url(id: u64, downloads: State<ActiveUrlDownloads>) {
    if let Some(download) = downloads.0.lock().unwrap().remove(&id) {
        let _ = download.cancel.send(true);
    }
}

fn is_html_content_type(content_type: Option<&str>) -> bool {
    let Some(header) = content_type else {
        return false;
    };
    let mime = header.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    mime == "text/html" || mime == "application/xhtml+xml"
}

fn build_frame(tag: u8, downloaded: u64, payload: &[u8]) -> InvokeResponseBody {
    let mut frame = Vec::with_capacity(9 + payload.len());
    frame.push(tag);
    frame.extend_from_slice(&downloaded.to_le_bytes());
    frame.extend_from_slice(payload);
    InvokeResponseBody::Raw(frame)
}

/// Validate an HTTP(S) log URL (status, Content-Type, and first 6 magic bytes) and start streaming decompressed
/// WPILOG chunks over `on_event`. Rejects before touching the window's active log if validation fails.
#[tauri::command]
pub async fn start_log_url(
    app: AppHandle,
    window: WebviewWindow,
    url: String,
    on_event: Channel<InvokeResponseBody>,
) -> Result<StartedLogUrl, LogUrlStartError> {
    if !is_http_url(&url) {
        return Err(LogUrlStartError::new(
            "invalid",
            "Only http:// and https:// URLs are supported.",
        ));
    }

    // Follow up to 10 redirects while rejecting any redirect to a non-HTTP(S) scheme such as `file://`
    let policy = Policy::custom(|attempt| {
        if attempt.previous().len() >= 10 {
            attempt.error("Too many redirects.")
        } else if !matches!(attempt.url().scheme(), "http" | "https") {
            attempt.error("Redirected to an unsupported URL scheme.")
        } else {
            attempt.follow()
        }
    });

    let client = reqwest::Client::builder()
        .redirect(policy)
        .user_agent(format!("DogLogStudio/{}", app.package_info().version))
        .build()
        .map_err(|error| LogUrlStartError::new("network", error.to_string()))?;

    let mut response = client
        .get(&url)
        .send()
        .await
        .map_err(|error| LogUrlStartError::new("network", error.to_string()))?;

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(LogUrlStartError::new(
            "auth",
            "This link requires signing in or permission to access.",
        ));
    }
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err(LogUrlStartError::new("http", "File not found (404)."));
    }
    if !status.is_success() {
        let reason = status.canonical_reason().unwrap_or("");
        let message = if reason.is_empty() {
            format!("Server returned HTTP {}.", status.as_u16())
        } else {
            format!("Server returned HTTP {} {reason}.", status.as_u16())
        };
        return Err(LogUrlStartError::new("http", message));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    if is_html_content_type(content_type) {
        return Err(LogUrlStartError::new(
            "html",
            "This URL returned a web page instead of a WPILOG file. It may require signing in or a direct download link.",
        ));
    }

    let final_url = response.url().to_string();
    let content_disposition = response
        .headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let content_length = response.content_length();

    // Buffer the first chunk(s) until we have at least 6 bytes to verify the WPILOG or XZ magic header
    let mut initial = Vec::new();
    let mut reached_eof = false;
    while initial.len() < 6 {
        match response.chunk().await {
            Ok(Some(chunk)) => initial.extend_from_slice(&chunk),
            Ok(None) => {
                reached_eof = true;
                break;
            }
            Err(error) => return Err(LogUrlStartError::new("network", format!("Download failed: {error}"))),
        }
    }

    if initial.is_empty() {
        return Err(LogUrlStartError::new("invalid-log", "It's empty."));
    }
    let is_xz = initial.starts_with(&crate::XZ_MAGIC);
    if !is_xz && !initial.starts_with(WPILOG_MAGIC) {
        return Err(LogUrlStartError::new("invalid-log", "It isn't a WPILOG file."));
    }

    let id = NEXT_DOWNLOAD_ID.fetch_add(1, Ordering::Relaxed);
    let (cancel_tx, cancel_rx) = watch::channel(false);
    app.state::<ActiveUrlDownloads>().0.lock().unwrap().insert(
        id,
        ActiveDownload {
            window_label: window.label().to_owned(),
            cancel: cancel_tx,
        },
    );

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        stream_response(
            response,
            initial,
            reached_eof,
            is_xz,
            content_length,
            on_event,
            cancel_rx,
        )
        .await;
        app_handle.state::<ActiveUrlDownloads>().0.lock().unwrap().remove(&id);
    });

    Ok(StartedLogUrl {
        id,
        final_url,
        content_disposition,
        content_length,
    })
}

async fn stream_response(
    mut response: reqwest::Response,
    initial: Vec<u8>,
    mut reached_eof: bool,
    is_xz: bool,
    content_length: Option<u64>,
    on_event: Channel<InvokeResponseBody>,
    mut cancel_rx: watch::Receiver<bool>,
) {
    let mut downloaded = initial.len() as u64;
    let mut xz_decoder = is_xz.then(|| XzDecoder::new(Vec::new()));
    let mut xz_damaged = false;
    let mut xz_error: Option<String> = None;
    let mut emitted_bytes: u64 = 0;

    let emit_raw = |downloaded: u64, bytes: &[u8], emitted: &mut u64| -> bool {
        *emitted += bytes.len() as u64;
        on_event.send(build_frame(FRAME_CHUNK, downloaded, bytes)).is_ok()
    };

    // Process the already-read initial bytes first
    if let Some(decoder) = xz_decoder.as_mut() {
        if let Err(error) = decoder.write_all(&initial) {
            xz_damaged = true;
            xz_error = Some(error.to_string());
        }
        let out = std::mem::take(decoder.get_mut());
        if !emit_raw(downloaded, &out, &mut emitted_bytes) {
            return;
        }
    } else if !emit_raw(downloaded, &initial, &mut emitted_bytes) {
        return;
    }

    while !reached_eof {
        let next_chunk = tokio::select! {
            biased;
            changed = cancel_rx.changed() => {
                if changed.is_err() || *cancel_rx.borrow() {
                    return;
                }
                continue;
            }
            chunk = response.chunk() => chunk,
        };

        match next_chunk {
            Ok(Some(chunk)) => {
                if chunk.is_empty() {
                    continue;
                }
                downloaded += chunk.len() as u64;
                if let Some(decoder) = xz_decoder.as_mut() {
                    if !xz_damaged && let Err(error) = decoder.write_all(&chunk) {
                        xz_damaged = true;
                        xz_error = Some(error.to_string());
                    }
                    let out = std::mem::take(decoder.get_mut());
                    if !emit_raw(downloaded, &out, &mut emitted_bytes) {
                        return;
                    }
                } else if !emit_raw(downloaded, &chunk, &mut emitted_bytes) {
                    return;
                }
            }
            Ok(None) => {
                reached_eof = true;
            }
            Err(error) => {
                let message = format!("Download failed: {error}");
                let _ = on_event.send(build_frame(FRAME_ERROR, downloaded, message.as_bytes()));
                return;
            }
        }
    }

    if let Some(expected) = content_length
        && downloaded < expected
    {
        let message = "Download ended early (connection interrupted).";
        let _ = on_event.send(build_frame(FRAME_ERROR, downloaded, message.as_bytes()));
        return;
    }

    if let Some(mut decoder) = xz_decoder {
        if !xz_damaged {
            match decoder.try_finish() {
                Ok(()) => {
                    let out = std::mem::take(decoder.get_mut());
                    if !out.is_empty() && !emit_raw(downloaded, &out, &mut emitted_bytes) {
                        return;
                    }
                }
                Err(error) => {
                    let out = std::mem::take(decoder.get_mut());
                    if !out.is_empty() && !emit_raw(downloaded, &out, &mut emitted_bytes) {
                        return;
                    }
                    xz_error = Some(error.to_string());
                }
            }
        }
        if emitted_bytes == 0
            && let Some(error) = xz_error
        {
            let message = format!("Couldn't decompress it: {error}");
            let _ = on_event.send(build_frame(FRAME_ERROR, downloaded, message.as_bytes()));
            return;
        }
    }

    let _ = on_event.send(build_frame(FRAME_END, downloaded, &[]));
}
