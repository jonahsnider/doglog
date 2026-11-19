//! Adds opened logs to the OS's recent documents, which macOS lists in the Dock icon's menu and Windows in the taskbar
//! icon's jump list. Choosing one opens it like any other log the OS opens. Linux has no equivalent.

use std::path::PathBuf;
use tauri::AppHandle;

/// Add a log to the OS's recent documents
#[tauri::command]
pub fn note_recent_log(app: AppHandle, path: PathBuf) {
    // AppKit and COM both need the main thread
    let _ = app.run_on_main_thread(move || {
        #[cfg(target_os = "macos")]
        {
            use objc2::MainThreadMarker;
            use objc2_app_kit::NSDocumentController;
            use objc2_foundation::{NSString, NSURL};

            let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
            NSDocumentController::sharedDocumentController(MainThreadMarker::new().unwrap())
                .noteNewRecentDocumentURL(&url);
        }

        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            use windows::Win32::UI::Shell::{SHARD_PATHW, SHAddToRecentDocs};

            let path: Vec<u16> = path.as_os_str().encode_wide().chain([0]).collect();
            // SAFETY: `path` is a null-terminated wide string that outlives the call
            unsafe { SHAddToRecentDocs(SHARD_PATHW.0 as u32, Some(path.as_ptr().cast())) };
        }

        #[cfg(target_os = "linux")]
        let _ = path;
    });
}

/// Remove Studio's logs from the OS's recent documents
#[tauri::command]
pub fn clear_recent_logs(app: AppHandle) {
    let _ = app.run_on_main_thread(|| {
        #[cfg(target_os = "macos")]
        {
            use objc2::MainThreadMarker;
            use objc2_app_kit::NSDocumentController;

            // SAFETY: The sender is only used to validate menu items, it can be nil
            unsafe {
                NSDocumentController::sharedDocumentController(MainThreadMarker::new().unwrap())
                    .clearRecentDocuments(None)
            };
        }

        #[cfg(windows)]
        {
            use windows::Win32::System::Com::{
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
            };
            use windows::Win32::UI::Shell::{ApplicationDestinations, IApplicationDestinations};

            // Clears only Studio's jump list, `SHAddToRecentDocs` with no path would clear every app's recent documents
            // SAFETY: Initializing COM again on a thread that already has it only increments its count
            unsafe {
                let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
                if let Ok(destinations) = CoCreateInstance::<_, IApplicationDestinations>(
                    &ApplicationDestinations,
                    None,
                    CLSCTX_INPROC_SERVER,
                ) {
                    let _ = destinations.RemoveAllDestinations();
                }
            }
        }
    });
}
