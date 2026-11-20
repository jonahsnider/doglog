use std::{cell::Cell, rc::Rc};
use tauri::webview::PlatformWebview;
use tokio::sync::oneshot::Sender;
use webview2_com::{
    CapturePreviewCompletedHandler, Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
};
use windows::Win32::{
    System::Com::{IStream, STREAM_SEEK_END, STREAM_SEEK_SET},
    UI::Shell::SHCreateMemStream,
};

pub(super) fn snapshot(webview: PlatformWebview, _rect: super::CaptureRect, reply: Sender<Result<Vec<u8>, String>>) {
    // SAFETY: with_webview runs this on the thread that owns the WebView2 controller.
    let core = match unsafe { webview.controller().CoreWebView2() } {
        Ok(core) => core,
        Err(error) => {
            let _ = reply.send(Err(format!("Couldn't access the WebView2 controller: {error}")));
            return;
        }
    };

    // SAFETY: None creates an empty stream without passing a data pointer.
    let Some(stream) = (unsafe { SHCreateMemStream(None) }) else {
        let _ = reply.send(Err("Couldn't allocate a WebView2 capture stream".into()));
        return;
    };

    // The callback and the synchronous failure path share the reply on the WebView2 thread.
    let reply = Rc::new(Cell::new(Some(reply)));
    let callback_reply = Rc::clone(&reply);
    let callback_stream = stream.clone();
    let callback = CapturePreviewCompletedHandler::create(Box::new(move |status| {
        if let Some(reply) = callback_reply.take() {
            let result = status
                .map_err(|error| format!("WebView2 capture failed: {error}"))
                .and_then(|()| read_preview(&callback_stream));
            let _ = reply.send(result);
        }
        Ok(())
    }));

    // SAFETY: Both arguments are valid COM objects on the owning thread. The callback retains the stream.
    let started = unsafe { core.CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, &stream, &callback) };
    if let Err(error) = started
        && let Some(reply) = reply.take()
    {
        let _ = reply.send(Err(format!("Couldn't start WebView2 capture: {error}")));
    }
}

fn read_preview(stream: &IStream) -> Result<Vec<u8>, String> {
    let mut size = 0;
    // SAFETY: The callback runs on the owning thread after capture completes, and size is writable.
    unsafe {
        stream
            .Seek(0, STREAM_SEEK_END, Some(&mut size))
            .map_err(|error| format!("Couldn't measure the WebView2 capture: {error}"))?;
        stream
            .Seek(0, STREAM_SEEK_SET, None)
            .map_err(|error| format!("Couldn't rewind the WebView2 capture: {error}"))?;
    }

    let size = u32::try_from(size).map_err(|_| "WebView2 capture is too large to read".to_string())?;
    if size == 0 {
        return Err("WebView2 returned an empty capture".into());
    }
    let mut png = Vec::<u8>::new();
    png.try_reserve_exact(size as usize)
        .map_err(|error| format!("Couldn't allocate the WebView2 capture buffer: {error}"))?;
    png.resize(size as usize, 0);
    let mut bytes_read = 0;
    // SAFETY: png has size writable bytes, and bytes_read is a writable u32.
    unsafe { stream.Read(png.as_mut_ptr().cast(), size, Some(&mut bytes_read)) }
        .ok()
        .map_err(|error| format!("Couldn't read the WebView2 capture: {error}"))?;
    if bytes_read != size {
        return Err(format!(
            "WebView2 capture was truncated: read {bytes_read} of {size} bytes"
        ));
    }
    Ok(png)
}
