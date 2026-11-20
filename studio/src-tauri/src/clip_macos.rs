use std::{
    path::Path,
    ptr::{self, NonNull},
    sync::mpsc,
    thread,
    time::Duration,
};

use block2::RcBlock;
use objc2::{rc::Retained, runtime::AnyObject};
use objc2_av_foundation::{
    AVAssetWriter, AVAssetWriterInput, AVAssetWriterInputPixelBufferAdaptor, AVAssetWriterStatus, AVFileTypeMPEG4,
    AVMediaTypeVideo, AVVideoAverageBitRateKey, AVVideoCodecKey, AVVideoCodecTypeH264, AVVideoCompressionPropertiesKey,
    AVVideoExpectedSourceFrameRateKey, AVVideoHeightKey, AVVideoMaxKeyFrameIntervalKey,
    AVVideoProfileLevelH264HighAutoLevel, AVVideoProfileLevelKey, AVVideoWidthKey,
};
use objc2_core_foundation::{CFRetained, CGPoint, CGRect, CGSize};
use objc2_core_graphics::{
    CGBitmapContextCreate, CGColorSpace, CGContext, CGImage, CGImageAlphaInfo, CGImageByteOrderInfo,
    CGInterpolationQuality, kCGColorSpaceSRGB,
};
use objc2_core_media::CMTime;
use objc2_core_video::{
    CVPixelBuffer, CVPixelBufferCreate, CVPixelBufferGetBaseAddress, CVPixelBufferGetBytesPerRow,
    CVPixelBufferLockBaseAddress, CVPixelBufferLockFlags, CVPixelBufferUnlockBaseAddress, kCVPixelFormatType_32BGRA,
    kCVReturnSuccess,
};
use objc2_foundation::{NSDictionary, NSNumber, NSString, NSURL};
use tauri::WebviewWindow;

use crate::capture::{CaptureRect, platform::snapshot_image, take_snapshot};

pub(super) type Frame = Retained<CGImage>;

pub(super) async fn snapshot(window: &WebviewWindow, rect: CaptureRect) -> Result<Frame, String> {
    take_snapshot(window, rect, snapshot_image).await
}

pub(super) fn width(frame: &Frame) -> usize {
    CGImage::width(Some(frame))
}

pub(super) fn height(frame: &Frame) -> usize {
    CGImage::height(Some(frame))
}

pub(super) struct Encoder {
    writer: Retained<AVAssetWriter>,
    input: Retained<AVAssetWriterInput>,
    adaptor: Retained<AVAssetWriterInputPixelBufferAdaptor>,
    width: usize,
    height: usize,
    fps: i32,
}

fn dictionary(entries: &[(&NSString, &AnyObject)]) -> Retained<NSDictionary<NSString, AnyObject>> {
    let (keys, values): (Vec<_>, Vec<_>) = entries.iter().copied().unzip();
    NSDictionary::from_slices(&keys, &values)
}

/// AVFoundation's string constants are only missing on OS versions Studio doesn't support.
fn constant<T: ?Sized>(value: Option<&'static T>) -> &'static T {
    value.expect("AVFoundation constant")
}

impl Encoder {
    pub(super) fn new(path: &Path, width: usize, height: usize, fps: u32, bitrate: u32) -> Result<Self, String> {
        let path = path.to_str().ok_or("The path isn't valid Unicode")?;
        let url = NSURL::fileURLWithPath(&NSString::from_str(path));
        let fps = i32::try_from(fps).map_err(|error| error.to_string())?;
        // SAFETY: The constants are static strings from AVFoundation, and the settings have the types it expects.
        unsafe {
            let writer = AVAssetWriter::assetWriterWithURL_fileType_error(&url, constant(AVFileTypeMPEG4))
                .map_err(|error| error.localizedDescription().to_string())?;
            let (codec, profile) = (
                constant(AVVideoCodecTypeH264),
                constant(AVVideoProfileLevelH264HighAutoLevel),
            );
            let compression = dictionary(&[
                (constant(AVVideoAverageBitRateKey), &NSNumber::new_u32(bitrate)),
                (constant(AVVideoExpectedSourceFrameRateKey), &NSNumber::new_i32(fps)),
                (constant(AVVideoMaxKeyFrameIntervalKey), &NSNumber::new_i32(fps * 2)),
                (constant(AVVideoProfileLevelKey), profile),
            ]);
            let settings = dictionary(&[
                (constant(AVVideoCodecKey), codec),
                (constant(AVVideoWidthKey), &NSNumber::new_usize(width)),
                (constant(AVVideoHeightKey), &NSNumber::new_usize(height)),
                (constant(AVVideoCompressionPropertiesKey), &compression),
            ]);
            let input = AVAssetWriterInput::assetWriterInputWithMediaType_outputSettings(
                constant(AVMediaTypeVideo),
                Some(&settings),
            );
            input.setExpectsMediaDataInRealTime(false);
            if !writer.canAddInput(&input) {
                return Err("The video encoder doesn't support this frame size".into());
            }
            writer.addInput(&input);
            let adaptor =
                AVAssetWriterInputPixelBufferAdaptor::assetWriterInputPixelBufferAdaptorWithAssetWriterInput_sourcePixelBufferAttributes(
                    &input, None,
                );
            let encoder = Self {
                writer,
                input,
                adaptor,
                width,
                height,
                fps,
            };
            if !encoder.writer.startWriting() {
                return Err(encoder.error());
            }
            encoder.writer.startSessionAtSourceTime(CMTime::new(0, fps));
            Ok(encoder)
        }
    }

    fn error(&self) -> String {
        unsafe { self.writer.error() }.map_or_else(
            || "The video couldn't be written".into(),
            |error| error.localizedDescription().to_string(),
        )
    }

    pub(super) fn append(&mut self, frame: &Frame, index: i64) -> Result<(), String> {
        let buffer = self.draw(frame)?;
        // Frames aren't real time, so the input asks to wait while it catches up instead of dropping them
        while !unsafe { self.input.isReadyForMoreMediaData() } {
            if unsafe { self.writer.status() } != AVAssetWriterStatus::Writing {
                return Err(self.error());
            }
            thread::sleep(Duration::from_millis(2));
        }
        if unsafe {
            self.adaptor
                .appendPixelBuffer_withPresentationTime(&buffer, CMTime::new(index, self.fps))
        } {
            Ok(())
        } else {
            Err(self.error())
        }
    }

    /// Draw `frame` into a new pixel buffer at the video's size, in sRGB.
    fn draw(&self, frame: &Frame) -> Result<CFRetained<CVPixelBuffer>, String> {
        let mut buffer = ptr::null_mut();
        // SAFETY: `buffer` is a valid out pointer, and it's only read when creation succeeds.
        let created = unsafe {
            CVPixelBufferCreate(
                None,
                self.width,
                self.height,
                kCVPixelFormatType_32BGRA,
                None,
                NonNull::from(&mut buffer),
            )
        };
        let buffer = NonNull::new(buffer)
            .filter(|_| created == kCVReturnSuccess)
            .ok_or_else(|| format!("Couldn't allocate a video frame ({created})"))?;
        // SAFETY: CVPixelBufferCreate returned a +1 reference.
        let buffer = unsafe { CFRetained::from_raw(buffer) };

        // SAFETY: The base address is only used while the buffer is locked, and the bitmap context matches its layout.
        unsafe {
            let locked = CVPixelBufferLockBaseAddress(&buffer, CVPixelBufferLockFlags::empty());
            if locked != kCVReturnSuccess {
                return Err(format!("Couldn't write a video frame ({locked})"));
            }
            let color_space = CGColorSpace::with_name(Some(kCGColorSpaceSRGB));
            let context = CGBitmapContextCreate(
                CVPixelBufferGetBaseAddress(&buffer),
                self.width,
                self.height,
                8,
                CVPixelBufferGetBytesPerRow(&buffer),
                color_space.as_deref(),
                CGImageAlphaInfo::PremultipliedFirst.0 | CGImageByteOrderInfo::Order32Little.0,
            );
            if let Some(context) = &context {
                CGContext::set_interpolation_quality(Some(context), CGInterpolationQuality::High);
                let bounds = CGRect::new(CGPoint::ZERO, CGSize::new(self.width as f64, self.height as f64));
                // New buffers hold whatever was in their memory before, which would show through translucent pixels
                CGContext::clear_rect(Some(context), bounds);
                CGContext::draw_image(Some(context), bounds, Some(frame));
            }
            CVPixelBufferUnlockBaseAddress(&buffer, CVPixelBufferLockFlags::empty());
            context.ok_or("Couldn't draw a video frame")?;
        }
        Ok(buffer)
    }

    pub(super) fn finish(self, count: i64) -> Result<(), String> {
        let (send, receive) = mpsc::channel();
        let done = RcBlock::new(move || {
            let _ = send.send(());
        });
        // SAFETY: The block only sends on a channel, which is safe from AVFoundation's thread.
        unsafe {
            self.input.markAsFinished();
            self.writer.endSessionAtSourceTime(CMTime::new(count, self.fps));
            self.writer.finishWritingWithCompletionHandler(&done);
        }
        receive.recv().map_err(|error| error.to_string())?;
        if unsafe { self.writer.status() } == AVAssetWriterStatus::Completed {
            Ok(())
        } else {
            Err(self.error())
        }
    }
}

impl Drop for Encoder {
    fn drop(&mut self) {
        // Stops a clip that wasn't finished, so its file can be deleted
        if unsafe { self.writer.status() } == AVAssetWriterStatus::Writing {
            unsafe { self.writer.cancelWriting() };
        }
    }
}
