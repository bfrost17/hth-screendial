use xcap::Monitor;
use serde::{Serialize, Deserialize};

/// Represents information about an active display monitor.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayInfo {
    /// The unique assigned screen/monitor ID (0-indexed).
    pub id: usize,
    /// The display name as reported by the system.
    pub name: String,
    /// Width of the monitor in pixels.
    pub width: u32,
    /// Height of the monitor in pixels.
    pub height: u32,
    /// Is this the system's primary monitor?
    pub is_primary: bool,
    /// High-DPI scale factor (Retina/logical scaling).
    pub scale_factor: f32,
    /// Logical X coordinate of the display's top-left origin.
    pub x: i32,
    /// Logical Y coordinate of the display's top-left origin.
    pub y: i32,
}

/// Tool for querying active physical monitors.
pub struct GetDisplayInfoTool;

impl GetDisplayInfoTool {
    /// Instantiates a new GetDisplayInfoTool.
    pub fn new() -> Self {
        Self
    }

    /// Fetches all active monitors and assigns them an integer ID.
    /// The primary monitor is always sorted to index 0.
    pub fn execute(&self) -> Result<Vec<DisplayInfo>, String> {
        let mut monitors = Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;
        
        // Ensure primary display is always index 0
        monitors.sort_by(|a, b| {
            let a_pri = a.is_primary().unwrap_or(false);
            let b_pri = b.is_primary().unwrap_or(false);
            b_pri.cmp(&a_pri)
        });

        let mut result = Vec::new();
        for (i, m) in monitors.iter().enumerate() {
            result.push(DisplayInfo {
                id: i,
                name: m.name().unwrap_or_else(|_| format!("Display {}", i + 1)),
                width: m.width().unwrap_or(1920),
                height: m.height().unwrap_or(1080),
                is_primary: m.is_primary().unwrap_or(i == 0),
                scale_factor: m.scale_factor().unwrap_or(1.0),
                x: m.x().unwrap_or(0),
                y: m.y().unwrap_or(0),
            });
        }

        Ok(result)
    }
}
