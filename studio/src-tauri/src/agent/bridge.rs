//! Finding Studio windows and running agent commands in them, for `doglog mcp` and the `doglog` agent commands

use super::{API, Request, Response, RpcError, socket, to_line};
use serde::Deserialize;
use serde_json::{Value, json};
use std::cmp::Ordering;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::task::JoinSet;

/// How long to wait for a window that was opened to run a command
const OPEN_TIMEOUT: Duration = Duration::from_secs(60);

struct Window {
    address: PathBuf,
    /// What `window_list` shows for the window
    info: Value,
    keys: InfoKeys,
}

/// The parts of a window's `info` used to pick one, which have to stay the same across API versions
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InfoKeys {
    id: String,
    api_version: u64,
    focused: bool,
    last_focused_at: Option<u64>,
}

/// Send one request on a new connection
async fn request(address: &Path, method: &str, params: Value) -> io::Result<Result<Value, RpcError>> {
    let (reader, mut writer) = tokio::io::split(socket::connect(address).await?);
    writer
        .write_all(to_line(&Request::new(method, params)).as_bytes())
        .await?;
    let mut line = String::new();
    BufReader::new(reader).read_line(&mut line).await?;
    if line.is_empty() {
        return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "the window closed"));
    }
    let response: Response = serde_json::from_str(&line)?;
    Ok(response.into_result())
}

/// Every open window, the most recently focused first
async fn windows() -> Result<Vec<Window>, String> {
    let addresses = socket::list().map_err(|error| format!("Couldn't find Studio windows: {error}"))?;
    let mut requests = JoinSet::new();
    for address in addresses {
        requests.spawn(async move {
            // Windows that can't be reached, ex. ones that are closing, are skipped
            let info = request(&address, "info", Value::Null).await.ok()?.ok()?;
            let keys = serde_json::from_value(info.clone()).ok()?;
            Some(Window { address, info, keys })
        });
    }
    let mut windows: Vec<Window> = requests.join_all().await.into_iter().flatten().collect();
    windows.sort_by_key(|window| std::cmp::Reverse((window.keys.focused, window.keys.last_focused_at)));
    Ok(windows)
}

pub async fn window_list() -> Result<Value, String> {
    Ok(windows().await?.into_iter().map(|window| window.info).collect())
}

/// Run a command in the window with the ID `window`, or the most recently focused one, opening Studio when no window is
/// open. Fails with the command's error message.
pub async fn call(name: &str, args: Value, window: Option<&str>) -> Result<Value, String> {
    let window = target(window).await?;
    let id = &window.keys.id;
    match window.keys.api_version.cmp(&API.api_version) {
        Ordering::Greater => {
            return Err(format!(
                "Studio was updated since this doglog command started, restart the doglog MCP server to control window {id}"
            ));
        }
        Ordering::Less => {
            return Err(format!(
                "Window {id} runs an older version of Studio, restart Studio to update it"
            ));
        }
        Ordering::Equal => {}
    }
    match request(&window.address, "call", json!({ "name": name, "args": args })).await {
        Ok(result) => result.map_err(|error| error.message),
        Err(error) => Err(format!("Couldn't reach window {id}: {error}")),
    }
}

async fn target(id: Option<&str>) -> Result<Window, String> {
    if let Some(id) = id {
        return windows()
            .await?
            .into_iter()
            .find(|window| window.keys.id == id)
            .ok_or_else(|| format!("There's no window with the ID {id}, use window_list to find open windows"));
    }

    // Commands sent at once open only one window
    static OPENING: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _opening = OPENING.lock().await;
    if let Some(window) = windows().await?.into_iter().next() {
        return Ok(window);
    }
    crate::new_window::open_window().map_err(|error| format!("Couldn't open Studio: {error}"))?;
    let started = Instant::now();
    while started.elapsed() < OPEN_TIMEOUT {
        tokio::time::sleep(Duration::from_millis(100)).await;
        if let Some(window) = windows().await?.into_iter().next() {
            return Ok(window);
        }
    }
    Err(format!("Studio didn't open within {} seconds", OPEN_TIMEOUT.as_secs()))
}
