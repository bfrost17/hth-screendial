# Technical Architecture & Specification: Project Screendial (Tauri 2.0 Edition)

**Document Version:** 2.0.0  
**Target Runtime:** Tauri v2 (Rust Core + TypeScript / HTML5 / Vanilla CSS)  
**AI Vision & Multimodal Engine:** Google Gemini Multimodal API (`gemini-3.5-flash` / `gemini-3.6-flash`)  
**Design System:** Ultra-Low Latency Transparent Liquid Glass  

---

> [!CAUTION]
> ### STRICT AGENT RULE: NEVER COMMIT OR PUSH WITHOUT EXPLICIT USER INSTRUCTION
> The AI agent must **NEVER** automatically stage, commit, or push code changes to Git or GitHub (`git commit`, `git push`, etc.) by itself.
> Git commits and pushes may **ONLY** be executed if and when the user gives an explicit, direct command in a prompt asking to commit and push.

---

## 1. System Overview & Mission

**Screendial** is a high-performance native desktop overlay agent designed to guide users through on-screen desktop workflows in real time. It observes user interactions, accepts voice and text commands, inspects active window screenshots along with contextual application-specific **Skills**, and executes structured **Tools**:

1. **Transparent Liquid Glass Overlay:** A fullscreen, click-through capable canvas rendering coordinate-accurate glowing bounding boxes, anchored speech bubbles, and interactive output widgets.
2. **Context-Aware Skills Engine:** Specialized application workflows (e.g. DaVinci Resolve, Safari, VS Code, macOS System) loaded dynamically based on the foreground application.
3. **Executable Tools Engine:** Hardware and interface actions including speech synthesis and rich UI cards (highlights, code blocks, checklists).
4. **Floating Assistive Controls:** An ambient breathing Assistive Orb and a global floating Command Palette (`Cmd+Shift+Space`).

---

## 2. High-Level System Architecture

```
+-----------------------------------------------------------------------------------------+
|                               SCREENDIAL TAURI HOST RUNTIME                             |
|                                                                                         |
|  +---------------------------+   +---------------------------+   +-------------------+  |
|  | Input Ingestion & Tray    |   | Native Context Engine     |   | Visual Overlay    |  |
|  | - Global Hotkeys (Shortcut|   | - Screenshot Tool         |   | - Window Manager  |  |
|  |   Cmd+Shift+Space, Cmd+V) |-->| - Active Window Inspector |--->| - Click-Through   |  |
|  | - System Tray Menu        |   | - Get Display Info Tool   |   |   Window Toggle   |  |
|  | - Web Audio Recorder      |   |   (Monitor Geometry/DPI)  |   |                   |  |
|  +---------------------------+   +-------------+-------------+   +---------+---------+  |
+------------------------------------------------|---------------------------|------------+
                                                 | (Fast Tauri IPC)          |
                                                 v                           v
+-----------------------------------------------------------------------------------------+
|                              TYPESCRIPT / LIQUID GLASS WEBVIEW                          |
|                                                                                         |
|  +---------------------------+   +---------------------------+   +-------------------+  |
|  | Skills Resolver           |   | Gemini Reasoning Engine   |   | Tools Dispatcher  |  |
|  | - DaVinci Resolve Skill   |   | - Multimodal API Client   |   | - highlight       |  |
|  | - Safari / Browser Skill  |-->| - Function Calling Schema |--->| - overlay         |  |
|  | - VS Code Dev Skill       |   | - Visual Grounding Coords |   | - code_overlay    |  |
|  | - macOS System Skill      |   |   [0..1000] Normalized    |   | - to_do_overlay   |  |
|  | - General GUI Fallback    |   | - Latency < 600ms         |   | - voice           |  |
|  +---------------------------+   +---------------------------+   +-------------------+  |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  | Visual Surface: Fullscreen Transparent Canvas (glass.css)                         |  |
|  | - Pulsating Corner Reticles & Neon Glowing Highlights (rgba(255, 51, 75, 0.45))   |  |
|  | - Anchored Glass Callout Speech Bubbles with Directional Pointers                 |  |
|  | - Interactive Step Checklists, Action Chips, and Iridescent Status Indicators     |  |
|  | - Floating Assistive Orb & Quick Search Command Palette (Cmd+Shift+Space)         |  |
|  +-----------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Core Modules & Component Architecture

### 3.1 Native Rust Host (`src-tauri/`)

* **Display Capture Tools (`src-tauri/src/tools/screenshot.rs`):**
  * Uses `xcap` for multi-monitor frame grabbing (<15ms per frame) and captures all screens simultaneously.
  * Auto-downsamples images preserving aspect ratio (max 1536px) and encodes to JPEG in-memory.
  * `get_display_info.rs` manages monitor indices and geometry scaling.

* **Window & Click-Through Manager (`src-tauri/src/lib.rs`):**
  * Interacts with macOS CoreGraphics and WebKit to toggle window click-through:
    * `set_ignore_cursor_events(true)`: Overlay ignores mouse input; clicks pass transparently to desktop applications.
    * `set_ignore_cursor_events(false)`: Overlay captures mouse input when hovering interactive glass cards, buttons, or palettes.

* **System Tray (`src-tauri/src/lib.rs`):**
  * Native macOS menu bar item providing instant triggers for "Ask Screendial...", voice toggle, clear overlay, and exit.

---

### 3.2 Skills System (`skills/`)

Unlike static, passive documentation, Screendial employs an intelligent **Skills System**. Skills are self-contained workflow bundles that define application context, key landmarks, keyboard shortcuts, and guided procedures:

* **Directory Structure:**
  ```
  skills/
  ├── davinci-resolve/
  │   └── SKILL.md
  ├── safari/
  │   └── SKILL.md
  ├── vscode/
  │   └── SKILL.md
  ├── macos-system/
  │   └── SKILL.md
  └── general-gui/
      └── SKILL.md
  ```

* **Skill Structure:**
  * **Frontmatter:** Identifies target process names and bundle IDs (`com.blackmagic-design.DaVinciResolve`, `com.apple.Safari`, etc.).
  * **Visual Landmarks:** Normalized coordinate anchors for key panels (e.g. timeline, inspector, toolbar, address bar).
  * **Command Dictionaries:** Mapping of user actions to keyboard chords across macOS and Windows.
  * **Guided Workflows:** Step-by-step procedures injected into the Gemini system prompt to ensure precise tool invocation.

* **Dynamic Skill Resolver (`src/skills/index.ts`):**
  * Inspects the active foreground application from Rust IPC and binds the most specific skill, falling back to `general-gui` for arbitrary applications.

---

### 3.3 Executable Tools Engine (`src/tools/`)

The model interacts with the user interface through structured, object-oriented tool calls defined in `src/tools/`:

1. **`highlight`**:
   * **Parameters:** `screen_id: string`, `label: string`, `box_2d: [ymin, xmin, ymax, xmax]` (0..1000), `explanation: string`
   * **Execution:** Renders an animated liquid glass bounding box with glowing corner reticles and an anchored speech bubble.

2. **`overlay`**:
   * **Parameters:** `screen_id: string`, `text: string`
   * **Execution:** Displays standard instructional guidance on the screen overlay.

3. **`code_overlay`**:
   * **Parameters:** `screen_id: string`, `title: string`, `code: string`, `language?: string`
   * **Execution:** Shows formatted terminal commands or code blocks with copy tools.

4. **`to_do_overlay`**:
   * **Parameters:** `screen_id: string`, `title: string`, `items: string[]`
   * **Execution:** Displays an interactive checklist allowing users to check off multi-step tasks.

5. **`voice`**:
   * **Parameters:** `text: string`
   * **Execution:** Synthetic speech output for real-time vocal guidance.

---

## 4. End-to-End Execution Sequence

```
[User Action] (Hotkey Cmd+Shift+Space OR Voice Cmd+Shift+V OR Orb Click)
    |
    v
[Input Ingestion & Context Capture]
    |---> 1. Fast Screen Capture via Rust xcap (<15ms)
    |---> 2. Active Window Detection (e.g. "DaVinci Resolve")
    |---> 3. Match Skill ("davinci-resolve")
    |---> 4. Play "processing" sound effect & show glass status pill
    v
[Gemini Multimodal Reasoning]
    |---> Screenshot + Active App Context + Skill Instructions + User Query
    |---> Returns Structured Tool Calls (e.g. highlight_element + speak_guidance + show_output_widget)
    v
[Synchronized Tool Dispatcher]
    |---> Audio: Initialize synthetic speech voice stream
    |---> Synchronization Gate: The instant voice begins speaking:
    |       1. Play "results_back" sound effect
    |       2. Dismiss status pill
    |       3. Render liquid glass bounding box around target element
    |       4. Display anchored callout bubble
    |       5. Render interactive step checklist widget
    |       6. Smooth-glide cursor to target button
    v
[User Completion]
    |---> User checks off items or clicks action chips
    |---> Overlay resets click-through automatically
```

---

## 5. UI Architecture: Transparent Liquid Glass Design System

* **Optical Glassmorphism:**
  * Uses `backdrop-filter: blur(28px) saturate(190%)` with dark glass surfaces (`rgba(13, 17, 28, 0.65)`).
  * Specular top highlight: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)`.
  * Multi-layer depth shadows: `0 16px 40px -10px rgba(0, 0, 0, 0.6)`.
* **Dynamic Neon Accents:**
  * Primary Accent: Laser Crimson (`#FF334B`) with luminous radial glow.
  * Listening Accent: Cyan Pulse (`#00F0FF`).
  * Processing Accent: Violet Iridescence (`#A855F7`).
  * Success Accent: Emerald (`#10B981`).
* **Intelligent Click-Through:**
  * Transparent screen space passes mouse events through to desktop apps.
  * Mouse hovering over interactive glass components automatically disables click-through for seamless interaction.

---

## 6. Permissions & Production Requirements

1. **macOS Screen Recording:** Required for `xcap` display capture. Granted in System Settings → Privacy & Security → Screen Recording.
2. **macOS Accessibility:** Required for `enigo` cursor movement and keystroke simulation. Granted in System Settings → Privacy & Security → Accessibility.
3. **Microphone:** Required for voice queries. Granted on first microphone request.
4. **Environment Variables:** `GEMINI_API_KEY` stored securely in app settings or configured via `.env`.

---

## 7. Operational & Development Guidelines

> [!CAUTION]
> ### Strict Git Commit & Push Rule (Enforced)
> 1. **No Autonomous Commits:** The agent must **NEVER** automatically execute `git commit` by itself.
> 2. **No Autonomous Pushes:** The agent must **NEVER** run `git push` to remote repositories (GitHub, GitLab, origin, etc.) by itself.
> 3. **Explicit User Instruction Required:** Commits and pushes may **ONLY** be executed when the user provides an explicit, direct command in their prompt specifically requesting to commit and/or push.
> 4. **User Verification First:** Code modifications, tests, and builds must be left in the local working tree for user review and approval before any commit or push action is requested by the user.


