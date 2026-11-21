use std::{cell::Cell, ptr, time::Duration};

use block2::RcBlock;
use dispatch2::{DispatchQueue, DispatchTime, MainThreadBound};
use objc2::{
    MainThreadMarker,
    rc::{Retained, Weak},
};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSBitmapImageFileType, NSBitmapImageRep, NSImage, NSImageScaling, NSImageView,
    NSWindowOrderingMode,
};
use objc2_core_graphics::CGImage;
use objc2_foundation::{NSDictionary, NSError, NSPoint, NSRect, NSSize};
use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};
use tauri::webview::PlatformWebview;
use tokio::sync::oneshot::Sender;

use super::CaptureRect;

const CAPTURE_COVER_TAG: isize = 0x444f474c;

pub(super) fn set_cover(webview: PlatformWebview, show: bool, reply: Sender<Result<(), String>>) {
    // Tauri provides its live WKWebView on the AppKit thread in with_webview.
    let view = unsafe { Retained::retain(webview.inner().cast::<WKWebView>()) }.unwrap();
    if !show {
        // AppKit owns the view hierarchy and can only change it on this thread.
        if let Some(cover) = unsafe { view.superview() }.and_then(|parent| parent.viewWithTag(CAPTURE_COVER_TAG)) {
            view.setAlphaValue(1.0);
            cover.removeFromSuperview();
        }
        let _ = reply.send(Ok(()));
        return;
    }

    let snapshot_view = view.clone();
    let reply = Cell::new(Some(reply));
    let complete = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
        let Some(reply) = reply.take() else { return };
        // The WebKit callback also runs on the thread that owns the view hierarchy.
        let Some(parent) = (unsafe { view.superview() }) else {
            let _ = reply.send(Err("The window closed before it could be covered".into()));
            return;
        };
        // WebKit owns both pointers until the callback returns.
        let Some(image) = (unsafe { image.as_ref() }) else {
            let message = unsafe { error.as_ref() }.map_or_else(
                || "The window didn't return an image".into(),
                |error| error.localizedDescription().to_string(),
            );
            let _ = reply.send(Err(message));
            return;
        };

        let mtm = MainThreadMarker::from(&*view);
        let cover = NSImageView::initWithFrame(mtm.alloc(), view.frame());
        cover.setTag(CAPTURE_COVER_TAG);
        cover.setRefusesFirstResponder(true);
        cover.setImage(Some(image));
        cover.setImageScaling(NSImageScaling::ScaleAxesIndependently);
        cover.setAutoresizingMask(
            NSAutoresizingMaskOptions::ViewWidthSizable | NSAutoresizingMaskOptions::ViewHeightSizable,
        );
        // A sibling isn't included in WebKit's snapshot. Alpha zero keeps the dashboard painting behind the visible frame.
        parent.addSubview_positioned_relativeTo(&cover, NSWindowOrderingMode::Above, Some(&view));
        view.setAlphaValue(0.0);
        if reply.send(Ok(())).is_err() {
            view.setAlphaValue(1.0);
            cover.removeFromSuperview();
            return;
        }

        // A reload or suspended webview may never finish the frontend cleanup.
        let cover = MainThreadBound::new(Weak::from_retained(&cover), mtm);
        let view = MainThreadBound::new(Weak::from_retained(&view), mtm);
        let deadline = DispatchTime::try_from(Duration::from_secs(6)).unwrap();
        let _ = DispatchQueue::main().after(deadline, move || {
            let mtm = MainThreadMarker::new().unwrap();
            if let Some(cover) = cover.get(mtm).load().filter(|cover| cover.window().is_some()) {
                if let Some(view) = view.get(mtm).load() {
                    view.setAlphaValue(1.0);
                }
                cover.removeFromSuperview();
            }
        });
    });
    unsafe { snapshot_view.takeSnapshotWithConfiguration_completionHandler(None, &complete) };
}

pub(crate) fn snapshot(webview: PlatformWebview, rect: CaptureRect, reply: Sender<Result<Vec<u8>, String>>) {
    take_snapshot(webview, rect, reply, |image| {
        image
            .TIFFRepresentation()
            .and_then(|data| NSBitmapImageRep::imageRepWithData(&data))
            .and_then(|bitmap| unsafe {
                bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
            })
            .map(|data| data.to_vec())
    });
}

/// Like `snapshot`, but returns the image itself for a video's encoder rather than a PNG.
pub(crate) fn snapshot_image(
    webview: PlatformWebview,
    rect: CaptureRect,
    reply: Sender<Result<Retained<CGImage>, String>>,
) {
    take_snapshot(webview, rect, reply, |image| unsafe {
        image.CGImageForProposedRect_context_hints(ptr::null_mut(), None, None)
    });
}

fn take_snapshot<T: 'static>(
    webview: PlatformWebview,
    rect: CaptureRect,
    reply: Sender<Result<T, String>>,
    convert: impl Fn(&NSImage) -> Option<T> + 'static,
) {
    // Tauri provides its live WKWebView on the main thread in with_webview.
    let view = unsafe { &*webview.inner().cast::<WKWebView>() };
    let size = view.bounds().size;
    let config = unsafe { WKSnapshotConfiguration::new(MainThreadMarker::from(view)) };
    unsafe {
        config.setRect(NSRect::new(
            NSPoint::new(rect.left * size.width, rect.top * size.height),
            NSSize::new(
                (rect.right - rect.left) * size.width,
                (rect.bottom - rect.top) * size.height,
            ),
        ));
    }

    let reply = Cell::new(Some(reply));
    let complete = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
        if let Some(reply) = reply.take() {
            // WebKit owns both pointers for the duration of the callback.
            let result = unsafe { image.as_ref() }.and_then(&convert).ok_or_else(|| {
                unsafe { error.as_ref() }.map_or_else(
                    || "The window didn't return an image".into(),
                    |error| error.localizedDescription().to_string(),
                )
            });
            let _ = reply.send(result);
        }
    });
    unsafe { view.takeSnapshotWithConfiguration_completionHandler(Some(&config), &complete) };
}
