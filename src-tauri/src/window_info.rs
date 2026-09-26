use active_win_pos_rs::get_active_window;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveWindowInfo {
    pub app_name: String,
    pub title: String,
    pub process_id: u64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn get_foreground_window() -> Result<ActiveWindowInfo, String> {
    match get_active_window() {
        Ok(window) => Ok(ActiveWindowInfo {
            app_name: window.app_name,
            title: window.title,
            process_id: window.process_id,
            x: window.position.x,
            y: window.position.y,
            width: window.position.width,
            height: window.position.height,
        }),
        Err(()) => Ok(ActiveWindowInfo {
            app_name: "Unknown Application".to_string(),
            title: "".to_string(),
            process_id: 0,
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
        }),
    }
}
