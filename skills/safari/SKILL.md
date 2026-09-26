---
name: Safari & Web Browser Navigation Skill
id: safari
target_bundles:
  - com.apple.Safari
  - com.apple.SafariTechnologyPreview
  - com.google.Chrome
  - company.thebrowser.Browser
target_apps:
  - Safari
  - Google Chrome
  - Arc
  - Brave
  - Edge
description: Web browsing navigation, tab management, URL bar interaction, Web Inspector, and privacy modes.
recommended_tools:
  - highlight_element
  - move_cursor
  - send_keyboard_shortcut
  - speak_guidance
  - show_output_widget
---

# Safari & Web Browser Navigation Skill

## Overview
Navigates web browser controls, address bars, tab shelves, developer tools, and extensions.

## Visual Landmarks & Grounding Coordinates
- **Unified Address & Search Bar**: Top-center toolbar area `[ymin: 30, xmin: 250, ymax: 75, xmax: 750]`.
- **Back / Forward Navigation**: Top-left corner `[ymin: 30, xmin: 70, ymax: 75, xmax: 150]`.
- **Sidebar Toggle (Bookmarks / Reading List)**: Far top-left `[ymin: 30, xmin: 15, ymax: 75, xmax: 65]`.
- **Active Tab Bar**: Beneath the address bar or horizontal tab shelf `[ymin: 75, xmin: 0, ymax: 115, xmax: 1000]`.
- **Downloads / Share / Extensions**: Top-right corner `[ymin: 30, xmin: 800, ymax: 75, xmax: 980]`.

## Primary Keyboard Commands
| Action | macOS Shortcut | Windows Shortcut |
| :--- | :--- | :--- |
| Focus Address Bar | `Cmd + L` | `Ctrl + L` |
| New Tab | `Cmd + T` | `Ctrl + T` |
| Close Current Tab | `Cmd + W` | `Ctrl + W` |
| Reopen Last Closed Tab | `Cmd + Shift + T` | `Ctrl + Shift + T` |
| Reload Page | `Cmd + R` | `Ctrl + R` |
| Hard Reload (Bypass Cache) | `Cmd + Shift + R` | `Ctrl + Shift + R` |
| Web Inspector (DevTools) | `Cmd + Option + I` | `F12` / `Ctrl + Shift + I` |
| Private Browsing Window | `Cmd + Shift + N` | `Ctrl + Shift + N` |
| Zoom In | `Cmd + =` | `Ctrl + =` |
| Zoom Out | `Cmd + -` | `Ctrl + -` |
| Reset Zoom | `Cmd + 0` | `Ctrl + 0` |

## Guided Procedures

### 1. Inspecting a Web Page Element
1. Highlight the target web element on page.
2. Instruct the user or send shortcut `Cmd + Option + I` to reveal Safari Web Inspector.
3. Spoken feedback: "Opening Developer Tools. You can inspect network requests or DOM elements here."

### 2. Searching or Navigating to URL
1. Highlight the URL bar with `highlight_element`.
2. Move cursor to address field with `move_cursor` (click=true).
3. Alternatively send shortcut `Cmd + L` to highlight URL instantly.
