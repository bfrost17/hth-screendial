---
name: DaVinci Resolve Workflow Skill
id: davinci-resolve
target_bundles:
  - com.blackmagic-design.DaVinciResolve
  - com.blackmagic-design.DaVinciResolveStudio
target_apps:
  - DaVinci Resolve
  - DaVinci Resolve Studio
  - Resolve
description: Professional video editing guidance, timeline cuts, ripple trimming, color grading, and inspector panel navigation.
recommended_tools:
  - highlight_element
  - move_cursor
  - send_keyboard_shortcut
  - speak_guidance
  - show_output_widget
---

# DaVinci Resolve Workflow Skill

## Overview
Guides video editors through timeline cutting, trimming, audio adjustments, and media pool management in DaVinci Resolve.

## Visual Landmarks & Grounding Coordinates
- **Timeline Area**: Located across the bottom 45% of the window `[ymin: 550, xmin: 0, ymax: 1000, xmax: 1000]`.
- **Blade Tool Button**: In the timeline toolbar directly above the tracks, typically around `[ymin: 510, xmin: 80, ymax: 540, xmax: 110]`.
- **Selection Mode Button**: Right next to the blade tool, around `[ymin: 510, xmin: 50, ymax: 540, xmax: 75]`.
- **Viewer (Output Monitor)**: Center-upper display area `[ymin: 80, xmin: 300, ymax: 500, xmax: 750]`.
- **Inspector Panel**: Far right upper corner `[ymin: 80, xmin: 750, ymax: 500, xmax: 1000]`.
- **Media Pool**: Far left panel `[ymin: 80, xmin: 0, ymax: 500, xmax: 300]`.

## Primary Keyboard Commands
| Action | macOS Shortcut | Windows Shortcut |
| :--- | :--- | :--- |
| Razor Cut (Blade) | `B` | `B` |
| Selection Arrow | `A` | `A` |
| Ripple Delete (Close Gap) | `Shift + Backspace` | `Shift + Delete` |
| Normal Delete (Leave Gap) | `Backspace` | `Delete` |
| Trim Start to Playhead | `Shift + [` | `Ctrl + Shift + [` |
| Trim End to Playhead | `Shift + ]` | `Ctrl + Shift + ]` |
| Play / Pause | `Space` | `Space` |
| Fast Forward | `L` (press repeatedly) | `L` |
| Reverse Play | `J` (press repeatedly) | `J` |
| Stop Playback | `K` | `K` |

## Guided Procedures

### 1. Cutting a Clip (Razor Tool)
1. Point out the Blade Tool icon in the toolbar using `highlight_element`.
2. Move cursor toward the target cut point on the timeline with `move_cursor`.
3. Provide spoken feedback: "Click here or press 'B' to select the Razor tool, then click the playhead to cut."
4. Offer output widget with quick shortcuts: `["Switch to Blade (B)", "Cut at Playhead (Cmd+\\)", "Switch to Selection (A)"]`.

### 2. Ripple Deleting a Bad Take
1. Highlight the unwanted clip segment on the timeline.
2. Instruct the user to press `Shift + Backspace` (macOS) to eliminate the empty gap automatically.
