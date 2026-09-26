---
name: macOS System & Window Management Skill
id: macos-system
target_bundles:
  - com.apple.finder
  - com.apple.dock
  - com.apple.systempreferences
target_apps:
  - Finder
  - Dock
  - System Settings
  - System Information
description: macOS system-wide desktop operations, window tiling, Finder operations, Spotlight search, and accessibility settings.
recommended_tools:
  - highlight_element
  - move_cursor
  - send_keyboard_shortcut
  - speak_guidance
  - show_output_widget
---

# macOS System & Window Management Skill

## Overview
Assists with macOS desktop navigation, Spotlight searches, window management, and Finder workflows.

## Visual Landmarks & Grounding Coordinates
- **Menu Bar**: Top 25px strip `[ymin: 0, xmin: 0, ymax: 30, xmax: 1000]`.
  - Apple Logo Menu: `[ymin: 0, xmin: 0, ymax: 30, xmax: 40]`.
  - Control Center & Clock: `[ymin: 0, xmin: 880, ymax: 30, xmax: 1000]`.
- **Dock**: Typically bottom screen edge `[ymin: 920, xmin: 100, ymax: 1000, xmax: 900]`.
- **Notification Center**: Slide in from top-right.

## Primary System Shortcuts
| Action | Shortcut |
| :--- | :--- |
| Spotlight Search | `Cmd + Space` |
| Application Switcher | `Cmd + Tab` |
| Force Quit Dialog | `Option + Cmd + Esc` |
| Screen Capture Area | `Cmd + Shift + 4` |
| Screen Capture Full Screen | `Cmd + Shift + 3` |
| Screen Recording Toolbar | `Cmd + Shift + 5` |
| Hide Current Application | `Cmd + H` |
| Hide All Other Applications | `Option + Cmd + H` |
| Minimize Active Window | `Cmd + M` |
| Mission Control | `Ctrl + Up Arrow` |
| Application Windows (Exposé) | `Ctrl + Down Arrow` |
| Finder: New Finder Window | `Cmd + N` |
| Finder: Go to Folder | `Cmd + Shift + G` |
