#[cfg(target_os = "macos")]
#[path = "capture_macos.rs"]
mod platform;
#[cfg(windows)]
#[path = "capture_windows.rs"]
mod platform;

use std::{
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use image::RgbaImage;
use serde::Deserialize;
use tauri::{WebviewWindow, image::Image};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::{sync::oneshot, time::timeout};

/// Bounds as fractions of the rendered viewport, independent of the display's pixel density.
#[derive(Clone, Copy, Deserialize)]
pub struct CaptureRect {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn set_capture_cover(window: WebviewWindow, show: bool) -> Result<(), String> {
    let (send, receive) = oneshot::channel();
    window
        .with_webview(move |webview| platform::set_cover(webview, show, send))
        .map_err(|error| error.to_string())?;
    timeout(Duration::from_secs(5), receive)
        .await
        .map_err(|_| "The window didn't update its capture cover in time")?
        .map_err(|_| "The window closed before it updated its capture cover")?
}

#[tauri::command]
pub async fn copy_capture(window: WebviewWindow, rect: CaptureRect) -> Result<(), String> {
    let image = snapshot(&window, rect).await?;
    window
        .clipboard()
        .write_image(&Image::new(image.as_raw(), image.width(), image.height()))
        .map_err(|error| error.to_string())
}

/// Save a PNG to `path`, or a new file in the temporary folder, for agents. Returns where it was saved.
#[tauri::command]
pub async fn save_capture(window: WebviewWindow, rect: CaptureRect, path: Option<PathBuf>) -> Result<PathBuf, String> {
    if path.as_ref().is_some_and(|path| !path.is_absolute()) {
        return Err("The path must be absolute".into());
    }
    let image = snapshot(&window, rect).await?;
    let path = path.unwrap_or_else(|| {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        std::env::temp_dir().join(format!("doglog-capture-{now}.png"))
    });
    image
        .save_with_format(&path, image::ImageFormat::Png)
        .map_err(|error| format!("Couldn't save {}: {error}", path.display()))?;
    Ok(path)
}

async fn snapshot(window: &WebviewWindow, rect: CaptureRect) -> Result<RgbaImage, String> {
    if !(0.0 <= rect.left
        && rect.left < rect.right
        && rect.right <= 1.0
        && 0.0 <= rect.top
        && rect.top < rect.bottom
        && rect.bottom <= 1.0)
    {
        return Err("The capture area is outside the window".into());
    }

    let (send, receive) = oneshot::channel();
    window
        .with_webview(move |webview| platform::snapshot(webview, rect, send))
        .map_err(|error| error.to_string())?;
    let png = timeout(Duration::from_secs(5), receive)
        .await
        .map_err(|_| "The window didn't finish capturing in time")?
        .map_err(|_| "The window closed before it finished capturing")??;
    let image = image::load_from_memory_with_format(&png, image::ImageFormat::Png)
        .map_err(|error| error.to_string())?
        .into_rgba8();

    #[cfg(windows)]
    let image = {
        // WebView2 snapshots the whole viewport. Round inwards so the crop doesn't include an adjacent pane.
        let (width, height) = (f64::from(image.width()), f64::from(image.height()));
        let left = (rect.left * width).ceil() as u32;
        let top = (rect.top * height).ceil() as u32;
        let right = (rect.right * width).floor() as u32;
        let bottom = (rect.bottom * height).floor() as u32;
        if left >= right || top >= bottom {
            return Err("The capture area is too small".into());
        }
        image::imageops::crop_imm(&image, left, top, right - left, bottom - top).to_image()
    };

    Ok(image)
}
