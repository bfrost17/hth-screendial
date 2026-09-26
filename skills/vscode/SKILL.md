---
name: Visual Studio Code Developer Skill
id: vscode
target_bundles:
  - com.microsoft.VSCode
  - com.microsoft.VSCodeInsiders
  - com.todesktop.230313mzl4w4u92
target_apps:
  - Code
  - Visual Studio Code
  - Cursor
description: Code editing assistance, command palette, integrated terminal, file tree navigation, and multi-cursor manipulation.
recommended_tools:
  - highlight_element
  - move_cursor
  - send_keyboard_shortcut
  - speak_guidance
  - show_output_widget
---

# Visual Studio Code Developer Skill

## Overview
Assists developers with coding workflows, split editors, terminal management, debugging, and file search.

## Visual Landmarks & Grounding Coordinates
- **Command Palette Trigger Area**: Top title bar or center `[ymin: 10, xmin: 300, ymax: 50, xmax: 700]`.
- **Activity Bar (Icons for Explorer, Search, Source Control)**: Far left strip `[ymin: 40, xmin: 0, ymax: 950, xmax: 48]`.
- **Primary Side Bar (Explorer)**: Left pane `[ymin: 40, xmin: 48, ymax: 950, xmax: 280]`.
- **Editor Area**: Central workspace `[ymin: 40, xmin: 280, ymax: 750, xmax: 960]`.
- **Integrated Terminal / Output Panel**: Bottom panel `[ymin: 700, xmin: 48, ymax: 980, xmax: 1000]`.
- **Status Bar**: Bottom slim strip `[ymin: 975, xmin: 0, ymax: 1000, xmax: 1000]`.

## Primary Keyboard Commands
| Action | macOS Shortcut | Windows / Linux Shortcut |
| :--- | :--- | :--- |
| Command Palette | `Cmd + Shift + P` | `Ctrl + Shift + P` |
| Quick File Open | `Cmd + P` | `Ctrl + P` |
| Toggle Integrated Terminal | `Ctrl + \`` | `Ctrl + \`` |
| Toggle Primary Side Bar | `Cmd + B` | `Ctrl + B` |
| Find in Project (Global Search)| `Cmd + Shift + F` | `Ctrl + Shift + F` |
| Split Editor | `Cmd + \` | `Ctrl + \` |
| Multi-Cursor Add Above/Below| `Option + Cmd + Up/Down` | `Ctrl + Alt + Up/Down` |
| Format Document | `Option + Shift + F` | `Shift + Alt + F` |
