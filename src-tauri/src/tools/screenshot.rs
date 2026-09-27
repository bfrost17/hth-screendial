use super::get_display_info::{GetDisplayInfoTool, DisplayInfo};
#[cfg(target_os = "macos")]
use super::macos_capture;
use xcap::Monitor;
use image::{imageops::FilterType, DynamicImage, ImageFormat, RgbaImage};
use std::collections::HashMap;
use std::io::Cursor;
use serde::{Serialize, Deserialize};

/// Captures one monitor's current contents.
///
/// On macOS this goes through ScreenCaptureKit (`macos_capture`) instead of xcap's built-in
/// `Monitor::capture_image()`, which uses the deprecated `CGWindowListCreateImage` API. On
/// modern macOS that legacy path can silently return the desktop wallpaper instead of real
/// window content, and re-triggers the Screen Recording permission prompt on every launch
/// regardless of a prior grant.
fn capture_monitor_image(monitor: &Monitor, info: &DisplayInfo) -> Result<RgbaImage, String> {
    #[cfg(target_os = "macos")]
    {
        let display_id = monitor.id().map_err(|e| format!("Failed to read display id: {e}"))?;
        let pixel_width = (info.width as f32 * info.scale_factor).round() as u32;
        let pixel_height = (info.height as f32 * info.scale_factor).round() as u32;
        macos_capture::capture_display(display_id, pixel_width, pixel_height)
    }
    #[cfg(not(target_os = "macos"))]
    {
        monitor.capture_image().map_err(|e| e.to_string())
    }
}

/// Represents the individual captured screen dataset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenCapturePayload {
    /// Screen name or label.
    pub name: String,
    /// Width of the original capture in pixels.
    pub width: u32,
    /// Height of the original capture in pixels.
    pub height: u32,
    /// High-DPI scale factor.
    pub scale_factor: f32,
    /// Origin bounds.
    pub x: i32,
    pub y: i32,
    /// Base64 encoded JPEG image data.
    pub image_base64: String,
    /// Mime type of the image (always "image/jpeg").
    pub mime_type: String,
}

/// Tool for capturing all active displays simultaneously.
pub struct ScreenshotTool;

impl ScreenshotTool {
    /// Instantiates a new ScreenshotTool.
    pub fn new() -> Self {
        Self
    }

    /// Captures all active displays simultaneously and returns a key/value dictionary of screen ID to capture payload.
    pub fn execute(&self) -> Result<HashMap<String, ScreenCapturePayload>, String> {
        let display_info_tool = GetDisplayInfoTool::new();
        let displays = display_info_tool.execute()?;

        let mut monitors = Monitor::all().map_err(|e| format!("Failed to fetch monitors for capture: {}", e))?;
        if monitors.is_empty() {
            return Err("No monitors found".to_string());
        }

        // Sort displays in the same way (primary first)
        monitors.sort_by(|a, b| {
            let a_pri = a.is_primary().unwrap_or(false);
            let b_pri = b.is_primary().unwrap_or(false);
            b_pri.cmp(&a_pri)
        });

        let mut capture_dictionary = HashMap::new();

        for (i, monitor) in monitors.iter().enumerate() {
            // Find corresponding display info
            let info = displays.iter().find(|d| d.id == i).cloned().unwrap_or_else(|| {
                DisplayInfo {
                    id: i,
                    name: monitor.name().unwrap_or_else(|_| format!("Display {}", i + 1)),
                    width: monitor.width().unwrap_or(1920),
                    height: monitor.height().unwrap_or(1080),
                    is_primary: monitor.is_primary().unwrap_or(i == 0),
                    scale_factor: monitor.scale_factor().unwrap_or(1.0),
                    x: monitor.x().unwrap_or(0),
                    y: monitor.y().unwrap_or(0),
                }
            });

            match capture_monitor_image(monitor, &info) {
                Ok(rgba_image) => {
                    let orig_width = rgba_image.width();
                    let orig_height = rgba_image.height();
                    let dynamic_img = DynamicImage::ImageRgba8(rgba_image);

                    // Downsample if wider than 1536px for ultra-low latency multimodal streaming
                    let final_img = if orig_width > 1536 {
                        let new_height = ((1536.0 / orig_width as f32) * orig_height as f32) as u32;
                        dynamic_img.resize(1536, new_height, FilterType::Triangle)
                    } else {
                        dynamic_img
                    };

                    let mut buffer = Vec::new();
                    let mut cursor = Cursor::new(&mut buffer);

                    if final_img.write_to(&mut cursor, ImageFormat::Jpeg).is_ok() {
                        let image_base64 = base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            &buffer,
                        );

                        let payload = ScreenCapturePayload {
                            name: info.name,
                            width: orig_width,
                            height: orig_height,
                            scale_factor: info.scale_factor,
                            x: info.x,
                            y: info.y,
                            image_base64,
                            mime_type: "image/jpeg".to_string(),
                        };

                        capture_dictionary.insert(i.to_string(), payload);
                    }
                }
                Err(e) => {
                    eprintln!("[Screendial] Warning: capture failed for monitor {}: {}", i, e);
                }
            }
        }

        if capture_dictionary.is_empty() {
            return Err("Failed to capture any display".to_string());
        }

        Ok(capture_dictionary)
    }
}
