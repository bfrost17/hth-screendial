//! Manual, throwaway probe for the ScreenCaptureKit capture path: not part of the app,
//! just a way to visually confirm `macos_capture::capture_display` returns a real screen
//! image instead of a wallpaper-only fallback. Run with:
//!   cargo test --test manual_sck_probe -- --ignored --nocapture
#![cfg(target_os = "macos")]

use xcap::Monitor;

#[test]
#[ignore]
fn probe_primary_display_capture() {
    let mut monitors = Monitor::all().expect("list monitors");
    monitors.sort_by(|a, b| {
        b.is_primary().unwrap_or(false).cmp(&a.is_primary().unwrap_or(false))
    });
    let monitor = monitors.first().expect("at least one monitor");

    let display_id = monitor.id().expect("monitor id");
    let scale = monitor.scale_factor().unwrap_or(1.0);
    let width = (monitor.width().unwrap_or(1920) as f32 * scale).round() as u32;
    let height = (monitor.height().unwrap_or(1080) as f32 * scale).round() as u32;

    eprintln!("Capturing display {display_id} at {width}x{height}...");
    let image = screendial_lib::tools::macos_capture::capture_display(display_id, width, height)
        .expect("capture_display should succeed");

    let out_path = std::env::var("SCK_PROBE_OUT")
        .unwrap_or_else(|_| "/tmp/sck_probe.png".to_string());
    image.save(&out_path).expect("save probe image");
    eprintln!("Saved probe capture to {out_path}");
}
