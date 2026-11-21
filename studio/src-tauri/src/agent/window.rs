//! Serving agent commands from this window, relaying them to the webview, see `src/agent/desktop.ts`

use super::{Request, Response, RpcError, socket, to_line, window_command};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State, WebviewWindow, Window};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;

/// A request for the webview to answer with `agent_respond`
#[derive(Serialize, Clone)]
#[serde(tag = "method", rename_all = "camelCase")]
pub enum WebviewRequest {
    /// This window's details that only the webview knows
    Info {
        id: u64,
    },
    Call {
        id: u64,
        name: String,
        args: Value,
    },
}

pub struct AgentWindow {
    id: String,
    /// Accepting connections on this window's socket, until the window closes
    accept: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    webview: Mutex<Option<Channel<WebviewRequest>>>,
    next_request: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value, RpcError>>>>,
    focus: Mutex<Focus>,
}

/// Each window's agent control, by window label
#[derive(Default)]
pub struct AgentWindows(Mutex<HashMap<String, Arc<AgentWindow>>>);

impl AgentWindows {
    fn get(&self, label: &str) -> Arc<AgentWindow> {
        self.0
            .lock()
            .unwrap()
            .entry(label.to_owned())
            .or_insert_with(|| {
                Arc::new(AgentWindow {
                    id: socket::window_id(),
                    accept: Mutex::default(),
                    webview: Mutex::default(),
                    next_request: AtomicU64::new(0),
                    pending: Mutex::default(),
                    focus: Mutex::default(),
                })
            })
            .clone()
    }
}

#[derive(Default, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct Focus {
    focused: bool,
    /// When the window last gained or lost focus, in milliseconds since the Unix epoch
    last_focused_at: Option<u64>,
}

pub fn set_focused(window: &Window, focused: bool) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    *window.state::<AgentWindows>().get(window.label()).focus.lock().unwrap() = Focus {
        focused,
        last_focused_at: Some(now as u64),
    };
}

/// Stop serving agents from the window with `label` and remove its socket as it closes
pub fn close(app: &AppHandle, label: &str) {
    let Some(window) = app.state::<AgentWindows>().0.lock().unwrap().remove(label) else {
        return;
    };
    if let Some(accept) = window.accept.lock().unwrap().take() {
        accept.abort();
        socket::remove(&window.id);
    }
}

/// Remove every window's socket as Studio quits
pub fn close_all(app: &AppHandle) {
    let labels: Vec<String> = app.state::<AgentWindows>().0.lock().unwrap().keys().cloned().collect();
    for label in labels {
        close(app, &label);
    }
}

/// Start serving agents once the webview can answer them, and again after it reloads
#[tauri::command]
pub async fn agent_listen(
    window: WebviewWindow,
    windows: State<'_, AgentWindows>,
    channel: Channel<WebviewRequest>,
) -> Result<(), String> {
    let agent_window = windows.get(window.label());
    *agent_window.webview.lock().unwrap() = Some(channel);
    // Requests sent before the webview reloaded won't be answered
    agent_window.pending.lock().unwrap().clear();
    let mut accept = agent_window.accept.lock().unwrap();
    if accept.is_none() {
        let listener = socket::Listener::bind(&agent_window.id).map_err(|error| error.to_string())?;
        *accept = Some(tauri::async_runtime::spawn(self::accept(
            agent_window.clone(),
            listener,
        )));
    }
    Ok(())
}

/// The webview's answer to a request, `error` when it failed
#[tauri::command]
pub fn agent_respond(
    window: WebviewWindow,
    windows: State<AgentWindows>,
    id: u64,
    result: Option<Value>,
    error: Option<RpcError>,
) {
    if let Some(sender) = windows.get(window.label()).pending.lock().unwrap().remove(&id) {
        let _ = sender.send(match error {
            Some(error) => Err(error),
            None => Ok(result.unwrap_or(Value::Null)),
        });
    }
}

async fn accept(window: Arc<AgentWindow>, mut listener: socket::Listener) {
    loop {
        match listener.accept().await {
            Ok(connection) => {
                tauri::async_runtime::spawn(serve(window.clone(), connection));
            }
            Err(error) => log::error!("Couldn't accept an agent connection: {error}"),
        }
    }
}

/// Answer each request on a connection in turn
async fn serve(window: Arc<AgentWindow>, connection: socket::Connection) {
    let (reader, mut writer) = tokio::io::split(connection);
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<Request>(&line) {
            Ok(request) => Response::new(request.id, respond(&window, &request.method, request.params).await),
            Err(error) => Response::new(
                Value::Null,
                Err(RpcError {
                    code: -32700,
                    message: error.to_string(),
                }),
            ),
        };
        if writer.write_all(to_line(&response).as_bytes()).await.is_err() {
            break;
        }
    }
}

#[derive(Deserialize)]
struct CallParams {
    name: String,
    args: Value,
}

async fn respond(window: &AgentWindow, method: &str, params: Value) -> Result<Value, RpcError> {
    match method {
        "info" => {
            let mut info = ask_webview(window, |id| WebviewRequest::Info { id }).await?;
            let focus = *window.focus.lock().unwrap();
            if let (Value::Object(info), Value::Object(focus)) = (&mut info, serde_json::to_value(focus).unwrap()) {
                info.insert("id".to_owned(), window.id.clone().into());
                info.extend(focus);
            }
            Ok(info)
        }
        "call" => {
            let CallParams { name, args } = serde_json::from_value(params).map_err(|error| RpcError {
                code: -32602,
                message: error.to_string(),
            })?;
            if window_command(&name).is_none() {
                return Err(RpcError {
                    code: -32601,
                    message: format!("There's no {name} command"),
                });
            }
            ask_webview(window, |id| WebviewRequest::Call { id, name, args }).await
        }
        _ => Err(RpcError {
            code: -32601,
            message: format!("Unknown method {method}"),
        }),
    }
}

async fn ask_webview(window: &AgentWindow, request: impl FnOnce(u64) -> WebviewRequest) -> Result<Value, RpcError> {
    let id = window.next_request.fetch_add(1, Ordering::Relaxed);
    let (sender, receiver) = oneshot::channel();
    window.pending.lock().unwrap().insert(id, sender);
    let sent = match &*window.webview.lock().unwrap() {
        Some(channel) => channel.send(request(id)).map_err(RpcError::failed),
        None => Err(RpcError::failed("The window isn't ready")),
    };
    if let Err(error) = sent {
        window.pending.lock().unwrap().remove(&id);
        return Err(error);
    }
    receiver
        .await
        .unwrap_or_else(|_| Err(RpcError::failed("The window reloaded before the command finished")))
}
