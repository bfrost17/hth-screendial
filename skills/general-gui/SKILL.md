---
name: General GUI Visual Grounding Skill
id: general-gui
target_bundles:
  - "*"
target_apps:
  - "*"
description: Universal visual grounding and interface guidance for any desktop window or native application.
recommended_tools:
  - highlight_element
  - move_cursor
  - send_keyboard_shortcut
  - speak_guidance
  - show_output_widget
---

# General GUI Visual Grounding Skill

## Overview
Default reasoning and grounding skill used when no app-specific skill exists. Accurately identifies interactive buttons, menus, input fields, tabs, toolbars, and icons anywhere on screen.

## Visual Inspection Principles
1. **Analyze Visual Hierarchy**: Identify the window's primary content vs toolbar/menus.
2. **Find Interactive Affordances**: Search for buttons (rounded rectangles, high contrast), inputs (recessed boxes, placeholder text), and toggle switches.
3. **Normalized Coordinate Output**: Return exact `[ymin, xmin, ymax, xmax]` in `[0..1000]`.
4. **Tool Selection**:
   - Use `highlight_element` with clear label and short explanation.
   - Use `move_cursor` if physical navigation is helpful.
   - Use `show_output_widget` when multiple steps or a quick checklist is beneficial.
