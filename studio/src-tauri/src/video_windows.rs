use std::path::Path;

use image::{
    RgbaImage,
    imageops::{self, FilterType},
};
use tauri::WebviewWindow;
use windows::{
    Win32::{
        Media::MediaFoundation::{
            IMFAttributes, IMFByteStream, IMFMediaType, IMFSinkWriter, MF_MT_AVG_BITRATE, MF_MT_DEFAULT_STRIDE,
            MF_MT_FRAME_RATE, MF_MT_FRAME_SIZE, MF_MT_INTERLACE_MODE, MF_MT_MAJOR_TYPE, MF_MT_MPEG2_PROFILE,
            MF_MT_PIXEL_ASPECT_RATIO, MF_MT_SUBTYPE, MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, MF_VERSION,
            MFCreateAttributes, MFCreateMediaType, MFCreateMemoryBuffer, MFCreateSample, MFCreateSinkWriterFromURL,
            MFMediaType_Video, MFSTARTUP_FULL, MFShutdown, MFStartup, MFVideoFormat_H264, MFVideoFormat_RGB32,
            MFVideoInterlace_Progressive, eAVEncH264VProfile_High,
        },
        System::Com::{COINIT_MULTITHREADED, CoInitializeEx, CoUninitialize},
    },
    core::HSTRING,
};

use crate::capture::CaptureRect;

pub(super) type Frame = RgbaImage;

/// Media Foundation times are in 100 ns units
const TICKS_PER_SECOND: i64 = 10_000_000;

pub(super) async fn snapshot(window: &WebviewWindow, rect: CaptureRect) -> Result<Frame, String> {
    crate::capture::snapshot(window, rect).await
}

pub(super) fn width(frame: &Frame) -> usize {
    frame.width() as usize
}

pub(super) fn height(frame: &Frame) -> usize {
    frame.height() as usize
}

/// COM and Media Foundation for the encoder's thread, shut down after the writer is released
struct Session;

impl Session {
    fn start() -> Result<Self, String> {
        // SAFETY: Called on the encoder's own thread, which is uninitialized when the session drops.
        unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }
            .ok()
            .map_err(|error| format!("Couldn't start COM: {error}"))?;
        if let Err(error) = unsafe { MFStartup(MF_VERSION, MFSTARTUP_FULL) } {
            unsafe { CoUninitialize() };
            return Err(format!("Couldn't start Media Foundation: {error}"));
        }
        Ok(Self)
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        // SAFETY: Balances the successful calls in `start` on the same thread.
        unsafe {
            let _ = MFShutdown();
            CoUninitialize();
        }
    }
}

pub(super) struct Encoder {
    // Released before the session ends, since fields drop in order
    writer: IMFSinkWriter,
    stream: u32,
    width: u32,
    height: u32,
    fps: i64,
    _session: Session,
}

/// Two 32-bit values packed like `MFSetAttributeSize` and `MFSetAttributeRatio` do
fn pack(high: u32, low: u32) -> u64 {
    (u64::from(high) << 32) | u64::from(low)
}

fn video_type(subtype: &windows::core::GUID, width: u32, height: u32, fps: u32) -> windows::core::Result<IMFMediaType> {
    // SAFETY: The keys and values are valid for a video media type.
    unsafe {
        let media_type = MFCreateMediaType()?;
        media_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        media_type.SetGUID(&MF_MT_SUBTYPE, subtype)?;
        media_type.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
        media_type.SetUINT64(&MF_MT_FRAME_SIZE, pack(width, height))?;
        media_type.SetUINT64(&MF_MT_FRAME_RATE, pack(fps, 1))?;
        media_type.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, pack(1, 1))?;
        Ok(media_type)
    }
}

impl Encoder {
    pub(super) fn new(path: &Path, width: usize, height: usize, fps: u32, bitrate: u32) -> Result<Self, String> {
        let session = Session::start()?;
        let width = u32::try_from(width).map_err(|error| error.to_string())?;
        let height = u32::try_from(height).map_err(|error| error.to_string())?;
        let error = |error: windows::core::Error| format!("Couldn't start the video encoder: {error}");
        // SAFETY: Media Foundation is started on this thread, and every argument is a valid object or value.
        let (writer, stream) = unsafe {
            let mut attributes: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut attributes, 1).map_err(error)?;
            let attributes = attributes.ok_or("Couldn't create the encoder's attributes")?;
            attributes
                .SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1)
                .map_err(error)?;
            let writer =
                MFCreateSinkWriterFromURL(&HSTRING::from(path.as_os_str()), None::<&IMFByteStream>, &attributes)
                    .map_err(error)?;

            let output = video_type(&MFVideoFormat_H264, width, height, fps).map_err(error)?;
            output.SetUINT32(&MF_MT_AVG_BITRATE, bitrate).map_err(error)?;
            output
                .SetUINT32(&MF_MT_MPEG2_PROFILE, eAVEncH264VProfile_High.0 as u32)
                .map_err(error)?;
            let stream = writer.AddStream(&output).map_err(error)?;

            let input = video_type(&MFVideoFormat_RGB32, width, height, fps).map_err(error)?;
            // A positive stride means the rows are top to bottom, like the snapshot's
            input.SetUINT32(&MF_MT_DEFAULT_STRIDE, width * 4).map_err(error)?;
            writer
                .SetInputMediaType(stream, &input, None::<&IMFAttributes>)
                .map_err(error)?;
            writer.BeginWriting().map_err(error)?;
            (writer, stream)
        };
        Ok(Self {
            writer,
            stream,
            width,
            height,
            fps: i64::from(fps),
            _session: session,
        })
    }

    pub(super) fn append(&mut self, frame: &Frame, index: i64) -> Result<(), String> {
        let resized;
        let frame = if frame.dimensions() == (self.width, self.height) {
            frame
        } else {
            resized = imageops::resize(frame, self.width, self.height, FilterType::Triangle);
            &resized
        };
        let length = self.width * self.height * 4;
        let error = |error: windows::core::Error| format!("Couldn't encode a video frame: {error}");
        // SAFETY: The buffer is locked while it's written, and holds `length` bytes.
        unsafe {
            let buffer = MFCreateMemoryBuffer(length).map_err(error)?;
            let mut data = std::ptr::null_mut();
            buffer.Lock(&mut data, None, None).map_err(error)?;
            let pixels = std::slice::from_raw_parts_mut(data, length as usize);
            // RGB32 is stored as blue, green, red, then an unused byte
            for (to, from) in pixels
                .as_chunks_mut::<4>()
                .0
                .iter_mut()
                .zip(frame.as_raw().as_chunks::<4>().0)
            {
                *to = [from[2], from[1], from[0], 255];
            }
            buffer.Unlock().map_err(error)?;
            buffer.SetCurrentLength(length).map_err(error)?;

            let sample = MFCreateSample().map_err(error)?;
            sample.AddBuffer(&buffer).map_err(error)?;
            // Computed from the index so the times don't drift from rounding
            let time = |index: i64| index * TICKS_PER_SECOND / self.fps;
            sample.SetSampleTime(time(index)).map_err(error)?;
            sample.SetSampleDuration(time(index + 1) - time(index)).map_err(error)?;
            self.writer.WriteSample(self.stream, &sample).map_err(error)
        }
    }

    pub(super) fn finish(self, _count: i64) -> Result<(), String> {
        // SAFETY: Every sample was written on this thread.
        unsafe { self.writer.Finalize() }.map_err(|error| format!("Couldn't finish the video: {error}"))
    }
}
