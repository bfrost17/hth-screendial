//! Screen capture on macOS via ScreenCaptureKit, replacing xcap's `CGWindowListCreateImage`
//! path (see `src/tools/screenshot.rs`). That legacy Quartz API is deprecated on modern
//! macOS: it can silently return a wallpaper-only image instead of real window content, and
//! macOS re-prompts for Screen Recording access repeatedly because it treats the deprecated
//! API as untrusted regardless of a prior grant. `SCScreenshotManager`'s one-shot capture is
//! Apple's current, supported replacement (macOS 14+).
//!
//! The pixel-decoding step (CGImage -> RgbaImage) mirrors xcap's own
//! `src/macos/capture.rs`, since both hand back a `CGImage` in the same BGRA layout.

use std::ptr::NonNull;
use std::sync::mpsc;
use std::time::Duration;

use block2::RcBlock;
use image::RgbaImage;
use objc2::rc::Retained;
use objc2::AnyThread;
use objc2_core_graphics::{CGDataProvider, CGDirectDisplayID, CGImage};
use objc2_foundation::{NSArray, NSError};
use objc2_screen_capture_kit::{
    SCContentFilter, SCDisplay, SCScreenshotManager, SCShareableContent, SCStreamConfiguration,
};

// FourCC for 'BGRA' (kCVPixelFormatType_32BGRA), matching the byte layout the conversion
// below assumes.
const PIXEL_FORMAT_BGRA: u32 = 0x4247_5241;

const CAPTURE_TIMEOUT: Duration = Duration::from_secs(8);

/// Captures a single display's current contents at the given pixel dimensions.
pub fn capture_display(
    display_id: CGDirectDisplayID,
    pixel_width: u32,
    pixel_height: u32,
) -> Result<RgbaImage, String> {
    let display = find_display(display_id)?;

    let filter = unsafe {
        SCContentFilter::initWithDisplay_excludingWindows(
            SCContentFilter::alloc(),
            &display,
            &NSArray::from_slice(&[]),
        )
    };

    let config = unsafe { SCStreamConfiguration::new() };
    unsafe {
        config.setWidth(pixel_width as usize);
        config.setHeight(pixel_height as usize);
        config.setPixelFormat(PIXEL_FORMAT_BGRA);
        config.setShowsCursor(true);
    }

    let cg_image = capture_image(&filter, &config)?;
    cgimage_to_rgba(&cg_image)
}

/// Looks up the `SCDisplay` matching a `CGDirectDisplayID` (the same ID xcap's
/// `Monitor::id()` reports), via ScreenCaptureKit's shareable-content listing.
fn find_display(display_id: CGDirectDisplayID) -> Result<Retained<SCDisplay>, String> {
    let (tx, rx) = mpsc::channel::<Result<Retained<SCShareableContent>, String>>();

    let block = RcBlock::new(move |content: *mut SCShareableContent, error: *mut NSError| {
        let result = unsafe { Retained::retain(content) }
            .ok_or_else(|| describe_error(error, "ScreenCaptureKit returned no shareable content"));
        let _ = tx.send(result);
    });

    unsafe { SCShareableContent::getShareableContentWithCompletionHandler(&block) };

    let content = rx
        .recv_timeout(CAPTURE_TIMEOUT)
        .map_err(|_| "Timed out waiting for ScreenCaptureKit to list displays".to_string())??;

    let displays = unsafe { content.displays() };
    for display in displays.iter() {
        if unsafe { display.displayID() } == display_id {
            return Ok(display);
        }
    }

    Err(format!(
        "ScreenCaptureKit did not report a display with id {display_id}. \
         Grant Screendial access under System Settings > Privacy & Security > Screen Recording, \
         then fully quit and reopen the app."
    ))
}

fn capture_image(
    filter: &SCContentFilter,
    config: &SCStreamConfiguration,
) -> Result<Retained<CGImage>, String> {
    let (tx, rx) = mpsc::channel::<Result<Retained<CGImage>, String>>();

    let block = RcBlock::new(move |image: *mut CGImage, error: *mut NSError| {
        let result = unsafe { Retained::retain(image) }
            .ok_or_else(|| describe_error(error, "ScreenCaptureKit returned no image"));
        let _ = tx.send(result);
    });

    unsafe {
        SCScreenshotManager::captureImageWithFilter_configuration_completionHandler(
            filter,
            config,
            Some(&block),
        );
    }

    rx.recv_timeout(CAPTURE_TIMEOUT)
        .map_err(|_| "Timed out waiting for ScreenCaptureKit to capture the display".to_string())?
}

fn describe_error(error: *mut NSError, fallback: &str) -> String {
    match NonNull::new(error) {
        Some(nn) => {
            let error: &NSError = unsafe { nn.as_ref() };
            error.localizedDescription().to_string()
        }
        None => fallback.to_string(),
    }
}

/// Mirrors xcap's own `CGImage` -> `RgbaImage` decode (`src/macos/capture.rs`), since both
/// paths hand back the same BGRA-packed `CGImage`.
fn cgimage_to_rgba(cg_image: &CGImage) -> Result<RgbaImage, String> {
    let width = CGImage::width(Some(cg_image));
    let height = CGImage::height(Some(cg_image));
    let data_provider = CGImage::data_provider(Some(cg_image));

    let data = CGDataProvider::data(data_provider.as_deref())
        .ok_or_else(|| "Failed to copy captured image data".to_string())?
        .to_vec();

    let bytes_per_row = CGImage::bytes_per_row(Some(cg_image));

    // Some platforms pad each row with extra bytes; keep only the real pixel bytes per row.
    let mut buffer = Vec::with_capacity(width * height * 4);
    for row in data.chunks_exact(bytes_per_row) {
        buffer.extend_from_slice(&row[..width * 4]);
    }

    // BGRA -> RGBA
    for bgra in buffer.chunks_exact_mut(4) {
        bgra.swap(0, 2);
    }

    RgbaImage::from_raw(width as u32, height as u32, buffer)
        .ok_or_else(|| "Failed to assemble captured image buffer".to_string())
}
