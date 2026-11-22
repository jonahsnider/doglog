//! Saving a video: the frontend steps the playhead and adds a snapshot of the frame for each video frame, which is
//! encoded to an H.264 MP4 on a background thread while the next one renders.

#[cfg(target_os = "macos")]
#[path = "video_macos.rs"]
mod platform;
#[cfg(windows)]
#[path = "video_windows.rs"]
mod platform;

use std::{
    collections::HashMap,
    fs, io,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender},
    },
    thread::{self, JoinHandle},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, State, WebviewWindow, async_runtime::spawn_blocking};

use crate::capture::CaptureRect;

/// The most pixels encoded at full size, a common limit for hardware H.264 encoders. Larger frames are scaled down.
const MAX_PIXELS: f64 = 4096.0 * 2304.0;
const MAX_SIDE: f64 = 4096.0;
/// Bits per pixel per frame, enough that text and thin graph lines stay sharp
const BITS_PER_PIXEL: f64 = 0.1;

/// Each window's video, by window label
#[derive(Default)]
pub struct VideoExports(Mutex<HashMap<String, VideoExport>>);

struct VideoExport {
    path: PathBuf,
    frames: SyncSender<platform::Frame>,
    cancelled: Arc<AtomicBool>,
    encoder: JoinHandle<Result<(), String>>,
}

/// The encoded size for a frame: scaled down past the encoder's limits, with the even dimensions H.264 needs.
fn output_size(width: usize, height: usize) -> (usize, usize) {
    let (width, height) = (width as f64, height as f64);
    let scale = (MAX_PIXELS / (width * height))
        .sqrt()
        .min(MAX_SIDE / width.max(height))
        .min(1.0);
    let even = |side: f64| (((side * scale) as usize) & !1).max(2);
    (even(width), even(height))
}

/// Start saving a video to `path`, replacing the file, or to a new file in the temporary folder for agents. Any video
/// that wasn't finished is canceled. Returns where it's saved.
#[tauri::command]
pub async fn start_video(
    window: WebviewWindow,
    state: State<'_, VideoExports>,
    path: Option<PathBuf>,
    fps: u32,
) -> Result<PathBuf, String> {
    if path.as_ref().is_some_and(|path| !path.is_absolute()) {
        return Err("The path must be absolute".into());
    }
    if fps == 0 {
        return Err("The frame rate must be positive".into());
    }
    let path = path.unwrap_or_else(|| {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        std::env::temp_dir().join(format!("doglog-video-{now}.mp4"))
    });
    stop(&state, window.label(), true).await?;
    // The save dialog already asked to replace it, agents replace files like images they save, and the encoder won't
    // write over a file
    match fs::remove_file(&path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => {
            return Err(format!("Couldn't replace {}: {error}", path.display()));
        }
        _ => {}
    }

    // A couple of frames can wait while the encoder catches up, so snapshots and encoding overlap
    let (frames, receive) = mpsc::sync_channel(2);
    let cancelled = Arc::new(AtomicBool::new(false));
    let encoder = {
        let (path, cancelled) = (path.clone(), cancelled.clone());
        thread::Builder::new()
            .name("video-encoder".into())
            .spawn(move || encode(&path, fps, &receive, &cancelled))
            .map_err(|error| error.to_string())?
    };
    state.0.lock().unwrap().insert(
        window.label().to_owned(),
        VideoExport {
            path: path.clone(),
            frames,
            cancelled,
            encoder,
        },
    );
    Ok(path)
}

/// Snapshot `rect` as the video's next frame. Returns once it's captured, before it's encoded.
#[tauri::command]
pub async fn add_video_frame(
    window: WebviewWindow,
    state: State<'_, VideoExports>,
    rect: CaptureRect,
) -> Result<(), String> {
    let frame = platform::snapshot(&window, rect).await?;
    let frames = state
        .0
        .lock()
        .unwrap()
        .get(window.label())
        .map(|export| export.frames.clone())
        .ok_or("No video is being saved")?;
    let sent = spawn_blocking(move || frames.send(frame))
        .await
        .map_err(|error| error.to_string())?;
    if sent.is_err() {
        // The encoder stopped after an error
        stop(&state, window.label(), false).await?;
        return Err("The encoder stopped".into());
    }
    Ok(())
}

/// Finish writing the video once its frames are encoded.
#[tauri::command]
pub async fn finish_video(window: WebviewWindow, state: State<'_, VideoExports>) -> Result<(), String> {
    stop(&state, window.label(), false).await
}

/// Stop saving the video and delete what was written.
#[tauri::command]
pub async fn cancel_video(window: WebviewWindow, state: State<'_, VideoExports>) -> Result<(), String> {
    stop(&state, window.label(), true).await
}

/// Stop saving the video of the window with `label` as it closes, deleting what was written
pub fn cancel_window_video(app: &AppHandle, label: &str) {
    let (app, label) = (app.clone(), label.to_owned());
    tauri::async_runtime::spawn(async move {
        let _ = stop(&app.state::<VideoExports>(), &label, true).await;
    });
}

async fn stop(state: &VideoExports, label: &str, cancel: bool) -> Result<(), String> {
    let Some(VideoExport {
        path,
        frames,
        cancelled,
        encoder,
    }) = state.0.lock().unwrap().remove(label)
    else {
        return Ok(());
    };
    cancelled.store(cancel, Ordering::Relaxed);
    // Ends the encoder's loop once it has encoded the frames already sent
    drop(frames);
    let result = spawn_blocking(move || encoder.join())
        .await
        .map_err(|error| error.to_string())
        .and_then(|joined| joined.map_err(|_| "The encoder crashed".to_string()))
        .flatten();
    if cancel || result.is_err() {
        let _ = fs::remove_file(path);
    }
    if cancel { Ok(()) } else { result }
}

fn encode(path: &Path, fps: u32, frames: &Receiver<platform::Frame>, cancelled: &AtomicBool) -> Result<(), String> {
    let mut encoder = None;
    let mut count = 0;
    for frame in frames {
        let encoder = match &mut encoder {
            Some(encoder) => encoder,
            None => {
                let (width, height) = output_size(platform::width(&frame), platform::height(&frame));
                let bitrate = (BITS_PER_PIXEL * (width * height) as f64 * f64::from(fps)) as u32;
                encoder.insert(platform::Encoder::new(path, width, height, fps, bitrate)?)
            }
        };
        encoder.append(&frame, count)?;
        count += 1;
    }
    match encoder {
        _ if cancelled.load(Ordering::Relaxed) => Ok(()),
        Some(encoder) => encoder.finish(count),
        None => Err("The video has no frames".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::output_size;

    #[test]
    fn output_size_keeps_small_frames_and_rounds_down_to_even() {
        assert_eq!(output_size(1921, 1081), (1920, 1080));
        assert_eq!(output_size(2880, 1600), (2880, 1600));
    }

    #[test]
    fn output_size_scales_large_frames_to_the_encoder_limits() {
        // A 5K display's full window is past the pixel limit, keeping its 16:9 shape
        assert_eq!(output_size(5120, 2880), (4096, 2304));
        // A tall frame is limited by its longest side
        assert_eq!(output_size(1000, 8000), (512, 4096));
    }
}
