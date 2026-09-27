mod database_connection;
pub mod tools;
pub mod window_info;

use tools::get_display_info::{GetDisplayInfoTool, DisplayInfo};
use tools::screenshot::{ScreenshotTool, ScreenCapturePayload};
use window_info::{get_foreground_window, ActiveWindowInfo};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window,
};

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Default)]
pub struct InteractiveState {
    pub rects: Arc<Mutex<Vec<LogicalRect>>>,
    pub force_interactive: Arc<AtomicBool>,
}

use std::io::Write;
use std::process::{Command, Stdio};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

#[tauri::command]
fn log_terminal_cmd(message: String) {
    println!("{}", message);
}

#[tauri::command]
fn http_request_cmd(
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    let mut cmd = Command::new("curl");
    cmd.arg("-s")
        .arg("-w")
        .arg("\n__STATUS__:%{http_code}")
        .arg("-X")
        .arg(&method)
        .arg(&url);

    for (k, v) in headers {
        cmd.arg("-H").arg(format!("{}: {}", k, v));
    }

    if body.is_some() {
        cmd.arg("--data-binary").arg("@-");
        cmd.stdin(Stdio::piped());
    }

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn curl: {}", e))?;

    if let Some(b) = body {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(b.as_bytes());
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for curl: {}", e))?;

    let raw = String::from_utf8_lossy(&output.stdout);
    if let Some(pos) = raw.rfind("\n__STATUS__:") {
        let (body_part, status_part) = raw.split_at(pos);
        let status_str = status_part.trim_start_matches("\n__STATUS__:");
        let status_code: u16 = status_str.trim().parse().unwrap_or(0);
        Ok(HttpResponse {
            status: status_code,
            body: body_part.to_string(),
        })
    } else {
        Ok(HttpResponse {
            status: 200,
            body: raw.to_string(),
        })
    }
}

#[tauri::command]
fn update_interactive_rects_cmd(
    state: tauri::State<InteractiveState>,
    rects: Vec<LogicalRect>,
    force_interactive: bool,
) -> Result<(), String> {
    if let Ok(mut r) = state.rects.lock() {
        *r = rects;
    }
    state.force_interactive.store(force_interactive, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn get_display_info_cmd() -> Result<Vec<DisplayInfo>, String> {
    let tool = GetDisplayInfoTool::new();
    tool.execute()
}

#[tauri::command]
fn capture_all_screens_cmd() -> Result<HashMap<String, ScreenCapturePayload>, String> {
    let tool = ScreenshotTool::new();
    tool.execute()
}

#[tauri::command]
fn get_active_window_cmd() -> Result<ActiveWindowInfo, String> {
    get_foreground_window()
}

#[tauri::command]
fn minimize_window_cmd(window: Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use objc::{msg_send, sel, sel_impl};
        if let Ok(ptr) = window.ns_window() {
            if !ptr.is_null() {
                let ns_win = ptr as *mut objc::runtime::Object;
                let mask: usize = msg_send![ns_win, styleMask];
                // Ensure NSWindowStyleMaskMiniaturizable is present so miniaturize succeeds
                let _: () = msg_send![ns_win, setStyleMask: mask | 4];
                let _: () = msg_send![ns_win, miniaturize: std::ptr::null_mut::<objc::runtime::Object>()];
                return Ok(());
            }
        }
    }
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_visibility_cmd(window: Window) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    let is_min = unsafe {
        use objc::{msg_send, sel, sel_impl};
        if let Ok(ptr) = window.ns_window() {
            if !ptr.is_null() {
                let ns_win = ptr as *mut objc::runtime::Object;
                let min: bool = msg_send![ns_win, isMiniaturized];
                min
            } else {
                false
            }
        } else {
            false
        }
    };
    #[cfg(not(target_os = "macos"))]
    let is_min = window.is_minimized().unwrap_or(false);

    let is_vis = window.is_visible().unwrap_or(true) && !is_min;
    let target = if is_vis { "hide" } else { "show" };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let _ = std::fs::write("/tmp/screendial_toggle", format!("{}:{}", now, target));

    let new_vis = target == "show";
    if new_vis {
        #[cfg(target_os = "macos")]
        unsafe {
            use objc::{msg_send, sel, sel_impl};
            if let Ok(ptr) = window.ns_window() {
                if !ptr.is_null() {
                    let ns_win = ptr as *mut objc::runtime::Object;
                    let min: bool = msg_send![ns_win, isMiniaturized];
                    if min {
                        let _: () = msg_send![ns_win, deminiaturize: std::ptr::null_mut::<objc::runtime::Object>()];
                    }
                }
            }
        }
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "macos")]
        if let Ok(ptr) = window.ns_window() {
            apply_macos_window_overlay_level(ptr);
        }
    } else {
        let _ = window.hide();
    }
    let _ = window.emit("window-visibility-changed", new_vis);
    Ok(new_vis)
}

#[tauri::command]
fn ensure_visible_cmd(window: Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use objc::{msg_send, sel, sel_impl};
        if let Ok(ptr) = window.ns_window() {
            if !ptr.is_null() {
                let ns_win = ptr as *mut objc::runtime::Object;
                let min: bool = msg_send![ns_win, isMiniaturized];
                if min {
                    let _: () = msg_send![ns_win, deminiaturize: std::ptr::null_mut::<objc::runtime::Object>()];
                }
            }
        }
    }
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    #[cfg(target_os = "macos")]
    if let Ok(ptr) = window.ns_window() {
        apply_macos_window_overlay_level(ptr);
    }
    Ok(())
}

#[tauri::command]
fn set_click_through_cmd(window: Window, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| format!("Failed to set ignore cursor events: {}", e))
}

#[derive(serde::Serialize, Clone)]
pub struct MonitorLayout {
    pub id: usize,
    pub is_primary: bool,
    pub name: String,
    pub logical_x: f64,
    pub logical_y: f64,
    pub logical_width: f64,
    pub logical_height: f64,
}

#[derive(serde::Serialize, Clone)]
pub struct DesktopLayout {
    pub virtual_x: f64,
    pub virtual_y: f64,
    pub virtual_width: f64,
    pub virtual_height: f64,
    pub monitors: Vec<MonitorLayout>,
}

#[tauri::command]
fn get_desktop_layout_cmd(window: tauri::Window) -> Result<DesktopLayout, String> {
    let mut tauri_monitors = window.available_monitors().unwrap_or_default();
    let primary_name = window.primary_monitor().unwrap_or(None).map(|p| p.name().cloned().unwrap_or_default()).unwrap_or_default();

    tauri_monitors.sort_by(|a, b| {
        let a_pri = a.name().cloned().unwrap_or_default() == primary_name;
        let b_pri = b.name().cloned().unwrap_or_default() == primary_name;
        b_pri.cmp(&a_pri)
    });

    let mut min_x = 0.0f64;
    let mut min_y = 0.0f64;
    let mut max_x = 0.0f64;
    let mut max_y = 0.0f64;
    let mut first = true;
    
    let mut monitors = Vec::new();

    for (i, m) in tauri_monitors.iter().enumerate() {
        let sf = m.scale_factor();
        let pos = m.position().to_logical::<f64>(sf);
        let size = m.size().to_logical::<f64>(sf);
        
        if first {
            min_x = pos.x; min_y = pos.y; max_x = pos.x + size.width; max_y = pos.y + size.height;
            first = false;
        } else {
            min_x = min_x.min(pos.x); min_y = min_y.min(pos.y);
            max_x = max_x.max(pos.x + size.width); max_y = max_y.max(pos.y + size.height);
        }

        monitors.push(MonitorLayout {
            id: i,
            is_primary: m.name().cloned().unwrap_or_default() == primary_name,
            name: m.name().cloned().unwrap_or_default(),
            logical_x: pos.x,
            logical_y: pos.y,
            logical_width: size.width,
            logical_height: size.height,
        });
    }

    Ok(DesktopLayout {
        virtual_x: min_x,
        virtual_y: min_y,
        virtual_width: max_x - min_x,
        virtual_height: max_y - min_y,
        monitors,
    })
}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
fn apply_macos_window_overlay_level(ns_ptr: *mut std::ffi::c_void) {
    unsafe {
        use objc::{msg_send, sel, sel_impl};
        if !ns_ptr.is_null() {
            let ns_win = ns_ptr as *mut objc::runtime::Object;
            // Level 25 = kCGStatusWindowLevel (system overlay tier, stays above all standard application windows at all times)
            let level: i64 = 25;
            let _: () = msg_send![ns_win, setLevel: level];

            // CanJoinAllSpaces (1) | Stationary (16) | FullScreenAuxiliary (256)
            let behavior: u64 = 1 | 16 | 256;
            let _: () = msg_send![ns_win, setCollectionBehavior: behavior];

            // Never hide when user interacts with or activates other applications
            let _: () = msg_send![ns_win, setHidesOnDeactivate: false];
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            let interactive_state = InteractiveState::default();
            app.manage(interactive_state.clone());

            let tauri_monitors = app.available_monitors().unwrap_or_default();
            let mut min_x = 0.0f64;
            let mut min_y = 0.0f64;
            let mut max_x = 0.0f64;
            let mut max_y = 0.0f64;
            let mut first = true;

            for m in &tauri_monitors {
                let sf = m.scale_factor();
                let pos = m.position().to_logical::<f64>(sf);
                let size = m.size().to_logical::<f64>(sf);
                if first {
                    min_x = pos.x; min_y = pos.y; max_x = pos.x + size.width; max_y = pos.y + size.height;
                    first = false;
                } else {
                    min_x = min_x.min(pos.x); min_y = min_y.min(pos.y);
                    max_x = max_x.max(pos.x + size.width); max_y = max_y.max(pos.y + size.height);
                }
            }
            let virtual_width = max_x - min_x;
            let virtual_height = max_y - min_y;

            let main_res = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("Screendial")
            .position(min_x, min_y)
            .inner_size(virtual_width, virtual_height)
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .shadow(false)
            .resizable(false)
            .build();

            match main_res {
                Ok(main_win) => {
                    let _ = main_win.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(min_x, min_y)));
                    let _ = main_win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(virtual_width, virtual_height)));
                    let _ = main_win.set_ignore_cursor_events(true);
                    let _ = main_win.set_always_on_top(true);
                    #[cfg(target_os = "macos")]
                    if let Ok(ptr) = main_win.ns_window() {
                        apply_macos_window_overlay_level(ptr);
                    }
                    let _ = main_win.show();
                    let _ = main_win.set_focus();
                    println!(
                        "[Screendial] Main Screen Overlay Window initialized at logical position ({}, {}) spanning size {}x{}",
                        min_x, min_y, virtual_width, virtual_height
                    );

                    // Background thread: toggle click-through based on cursor position over interactive UI regions
                    let win_tracker = main_win.clone();
                    let state_rects = interactive_state.rects.clone();
                    let state_force = interactive_state.force_interactive.clone();
                    std::thread::spawn(move || {
                        let mut last_ignore = true;
                        let _ = win_tracker.set_ignore_cursor_events(true);

                        loop {
                            std::thread::sleep(std::time::Duration::from_millis(16));

                            let is_visible = win_tracker.is_visible().unwrap_or(false);
                            if !is_visible {
                                continue;
                            }

                            let force = state_force.load(Ordering::Relaxed);
                            if force {
                                if last_ignore {
                                    let _ = win_tracker.set_ignore_cursor_events(false);
                                    last_ignore = false;
                                }
                                continue;
                            }

                            let cursor_res = win_tracker.cursor_position();
                            let win_pos_res = win_tracker.outer_position();
                            let sf_res = win_tracker.scale_factor();

                            if let (Ok(cursor_pos), Ok(win_pos), Ok(sf)) = (cursor_res, win_pos_res, sf_res) {
                                let rel_x = (cursor_pos.x - win_pos.x as f64) / sf;
                                let rel_y = (cursor_pos.y - win_pos.y as f64) / sf;

                                let is_inside = {
                                    if let Ok(rects) = state_rects.lock() {
                                        rects.iter().any(|r| {
                                            rel_x >= r.x && rel_x <= (r.x + r.width) &&
                                            rel_y >= r.y && rel_y <= (r.y + r.height)
                                        })
                                    } else {
                                        false
                                    }
                                };

                                let should_ignore = !is_inside;
                                if should_ignore != last_ignore {
                                    let _ = win_tracker.set_ignore_cursor_events(should_ignore);
                                    last_ignore = should_ignore;
                                }
                            }
                        }
                    });

                    let win_watcher = main_win.clone();
                    std::thread::spawn(move || {
                        let mut last_content = std::fs::read_to_string("/tmp/screendial_toggle").unwrap_or_default();
                        loop {
                            std::thread::sleep(std::time::Duration::from_millis(60));
                            if let Ok(content) = std::fs::read_to_string("/tmp/screendial_toggle") {
                                if !content.is_empty() && content != last_content {
                                    last_content = content.clone();
                                    let parts: Vec<&str> = content.trim().split(':').collect();
                                    let target = parts.get(1).copied().unwrap_or("toggle");
                                    match target {
                                        "show" => {
                                            let _ = win_watcher.show();
                                            let _ = win_watcher.set_focus();
                                            #[cfg(target_os = "macos")]
                                            if let Ok(ptr) = win_watcher.ns_window() {
                                                apply_macos_window_overlay_level(ptr);
                                            }
                                            let _ = win_watcher.emit("window-visibility-changed", true);
                                        }
                                        "hide" => {
                                            let _ = win_watcher.hide();
                                            let _ = win_watcher.emit("window-visibility-changed", false);
                                        }
                                        _ => {
                                            let is_vis = win_watcher.is_visible().unwrap_or(true);
                                            let new_vis = !is_vis;
                                            if new_vis {
                                                let _ = win_watcher.show();
                                                let _ = win_watcher.set_focus();
                                                #[cfg(target_os = "macos")]
                                                if let Ok(ptr) = win_watcher.ns_window() {
                                                    apply_macos_window_overlay_level(ptr);
                                                }
                                            } else {
                                                let _ = win_watcher.hide();
                                            }
                                            let _ = win_watcher.emit("window-visibility-changed", new_vis);
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[Screendial] Failed to create main overlay window: {}", e);
                }
            }

            // Set up System Tray Menu
            let toggle_item = MenuItem::with_id(
                app,
                "toggle",
                "Ask Screendial...",
                true,
                None::<&str>,
            )?;
            let voice_item = MenuItem::with_id(
                app,
                "voice",
                "Toggle Voice",
                true,
                None::<&str>,
            )?;
            let vis_item = MenuItem::with_id(
                app,
                "toggle_vis",
                "Hide/Show Windows",
                true,
                None::<&str>,
            )?;
            let clear_item = MenuItem::with_id(
                app,
                "clear",
                "Clear Overlay Highlights",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Screendial", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &toggle_item,
                    &voice_item,
                    &vis_item,
                    &clear_item,
                    &quit_item,
                ],
            )?;

            let tray_tooltip = "Screendial (Active)";
            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip(tray_tooltip)
                .on_menu_event(|app, event| {
                    let id_str = event.id.as_ref();

                    match id_str {
                        "toggle_vis" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let is_vis = window.is_visible().unwrap_or(true);
                                let target = if is_vis { "hide" } else { "show" };
                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis();
                                let _ = std::fs::write("/tmp/screendial_toggle", format!("{}:{}", now, target));

                                let new_vis = target == "show";
                                if new_vis {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                } else {
                                    let _ = window.hide();
                                }
                                let _ = window.emit("window-visibility-changed", new_vis);
                            }
                        }
                        "toggle" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("trigger-prompt", ());
                            }
                        }
                        "voice" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("trigger-voice", ());
                            }
                        }
                        "clear" => {
                            let _ = app.emit("clear-overlay", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("trigger-prompt", ());
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            log_terminal_cmd,
            http_request_cmd,
            minimize_window_cmd,
            toggle_visibility_cmd,
            ensure_visible_cmd,
            get_desktop_layout_cmd,
            get_display_info_cmd,
            capture_all_screens_cmd,
            get_active_window_cmd,
            set_click_through_cmd,
            update_interactive_rects_cmd,
            database_connection::upsert_auth0_user_cmd,
            database_connection::save_gemini_interaction_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
