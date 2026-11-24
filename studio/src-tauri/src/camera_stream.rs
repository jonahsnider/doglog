//! Pull-based native HTTP streams. The webview validates multipart framing and advances each response one read at a time.

use reqwest::{Client, Response, header::CONTENT_TYPE, redirect::Policy};
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
};
use tauri::{AppHandle, Manager, State, Url, WebviewWindow, ipc};
use tokio::sync::{Mutex as AsyncMutex, watch};

enum Request {
    Pending(Url),
    Streaming(Response),
    Closed,
}

struct ActiveStream {
    window: String,
    request: Arc<AsyncMutex<Request>>,
    cancel: watch::Sender<()>,
}

#[derive(Default)]
pub struct ActiveCameraStreams(Mutex<HashMap<u64, ActiveStream>>);

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn camera_url(raw: &str) -> Result<Url, &'static str> {
    let invalid = "Camera URLs must use HTTP or HTTPS without credentials.";
    let (_, rest) = raw.trim().split_once("://").ok_or(invalid)?;
    let authority = rest.split(['/', '\\', '?', '#']).next().unwrap_or_default();
    let url = Url::parse(raw).map_err(|_| invalid)?;
    if authority.is_empty()
        || authority.contains('@')
        || !matches!(url.scheme(), "http" | "https")
        || !url.has_host()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(invalid);
    }
    Ok(url)
}

pub fn cancel_for_window(app: &AppHandle, label: &str) {
    app.state::<ActiveCameraStreams>()
        .0
        .lock()
        .unwrap()
        .retain(|_, stream| stream.window != label);
}

/// Register the stream without starting network I/O, so the webview can cancel even before headers arrive.
#[tauri::command]
pub fn start_camera_stream(
    window: WebviewWindow,
    url: String,
    streams: State<ActiveCameraStreams>,
) -> Result<u64, &'static str> {
    let url = camera_url(&url)?;
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    streams.0.lock().unwrap().insert(
        id,
        ActiveStream {
            window: window.label().to_owned(),
            request: Arc::new(AsyncMutex::new(Request::Pending(url))),
            cancel: watch::channel(()).0,
        },
    );
    Ok(id)
}

#[tauri::command]
pub fn close_camera_stream(window: WebviewWindow, id: u64, streams: State<ActiveCameraStreams>) {
    let mut active = streams.0.lock().unwrap();
    if active.get(&id).is_some_and(|stream| stream.window == window.label()) {
        // Dropping the sender also cancels any in-flight read or connection attempt.
        active.remove(&id);
    }
}

/// First read returns the response's Content-Type as bytes. Later reads return body chunks, or empty at EOF.
#[tauri::command]
pub async fn read_camera_stream(
    window: WebviewWindow,
    id: u64,
    streams: State<'_, ActiveCameraStreams>,
) -> Result<ipc::Response, String> {
    let (request, mut cancel) = {
        let active = streams.0.lock().unwrap();
        let stream = active
            .get(&id)
            .filter(|stream| stream.window == window.label())
            .ok_or("Camera stream is closed.")?;
        (Arc::clone(&stream.request), stream.cancel.subscribe())
    };
    let mut request = request.try_lock().map_err(|_| "Camera stream is already being read.")?;
    let bytes = tokio::select! {
        biased;
        _ = cancel.changed() => return Err("Camera stream is closed.".into()),
        result = read(&mut request) => result,
    }?;
    Ok(ipc::Response::new(bytes))
}

async fn read(request: &mut Request) -> Result<Vec<u8>, String> {
    match request {
        Request::Pending(_) => {
            let Request::Pending(url) = std::mem::replace(request, Request::Closed) else {
                unreachable!();
            };
            let client = Client::builder()
                .redirect(Policy::none())
                .referer(false)
                .no_proxy()
                .build()
                .map_err(|error| error.to_string())?;
            let response = client
                .get(url)
                .send()
                .await
                .map_err(|error| error.without_url().to_string())?;
            let status = response.status();
            if !status.is_success() {
                return Err(format!("Camera responded with HTTP {}.", status.as_u16()));
            }
            let content_type = response
                .headers()
                .get(CONTENT_TYPE)
                .map_or_else(Vec::new, |value| value.as_bytes().to_vec());
            *request = Request::Streaming(response);
            Ok(content_type)
        }
        Request::Streaming(response) => loop {
            match response.chunk().await {
                Ok(Some(chunk)) if chunk.is_empty() => continue,
                Ok(Some(chunk)) => return Ok(chunk.to_vec()),
                Ok(None) => {
                    *request = Request::Closed;
                    return Ok(Vec::new());
                }
                Err(error) => {
                    *request = Request::Closed;
                    return Err(error.without_url().to_string());
                }
            }
        },
        Request::Closed => Err("Camera stream is closed.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::{Request, Url, camera_url, read};
    use tokio::{
        io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
        net::TcpListener,
        task::JoinHandle,
    };

    async fn camera_peer(response: &'static [u8]) -> (Url, JoinHandle<String>) {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = camera_url(&format!("http://{}/stream.mjpg", listener.local_addr().unwrap())).unwrap();
        let peer = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let mut socket = BufReader::new(socket);
            let mut headers = String::new();
            while !headers.ends_with("\r\n\r\n") {
                assert_ne!(socket.read_line(&mut headers).await.unwrap(), 0);
            }
            socket.write_all(response).await.unwrap();
            headers
        });
        (url, peer)
    }

    #[test]
    fn accepts_only_credential_free_http_urls() {
        for url in ["http://10.0.0.1:1181/?action=stream", "https://camera.local/"] {
            assert!(camera_url(url).is_ok(), "{url}");
        }
        for url in [
            "file:///etc/passwd",
            "mjpg:http://camera.local/",
            "http://user@camera.local/",
            "http://user:secret@camera.local/",
            "http://@camera.local/",
            "http:///camera.local/",
        ] {
            assert!(camera_url(url).is_err(), "{url}");
        }
    }

    #[tokio::test]
    async fn pulls_content_type_and_body_from_an_http_1_0_camera() {
        let (url, peer) = camera_peer(
            b"HTTP/1.0 200 OK\r\nContent-Type: multipart/x-mixed-replace;boundary=camera\r\n\r\n\xff\xd8\xff\xd9",
        )
        .await;
        let mut request = Request::Pending(url);
        assert_eq!(
            read(&mut request).await.unwrap(),
            b"multipart/x-mixed-replace;boundary=camera"
        );
        let mut body = Vec::new();
        loop {
            let bytes = read(&mut request).await.unwrap();
            if bytes.is_empty() {
                break;
            }
            body.extend(bytes);
        }
        assert_eq!(body, b"\xff\xd8\xff\xd9");
        let headers = peer.await.unwrap().to_ascii_lowercase();
        for forbidden in ["authorization:", "cookie:", "referer:"] {
            assert!(!headers.contains(forbidden), "{headers}");
        }
    }

    #[tokio::test]
    async fn reports_redirect_status_without_following_it() {
        let (url, peer) = camera_peer(b"HTTP/1.0 302 Found\r\nLocation: /must-not-fetch\r\n\r\n").await;
        assert_eq!(
            read(&mut Request::Pending(url)).await.unwrap_err(),
            "Camera responded with HTTP 302."
        );
        peer.await.unwrap();
    }
}
