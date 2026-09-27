# Screendial 🎙️✨

**Screendial** is an intelligent, real-time native desktop copilot designed to guide users through on-screen workflows step-by-step. Built with **Tauri v2** (Rust + TypeScript/HTML/Vanilla CSS), it features an ultra-low-latency **Transparent Liquid Glass** overlay, an intelligent **Skills System**, and an executable **Tools Engine**.

---

## ✨ Features

- **Transparent Liquid Glass Overlay:** Seamless, frameless fullscreen canvas with glassmorphic depth, optical backdrop blur, glowing neon highlights, and anchored speech bubbles.
- **Intelligent Click-Through:** Transparent areas pass mouse clicks directly to underlying applications, while interactive cards, widgets, and palettes capture clicks seamlessly.
- **Context-Aware Skills (Not Static Docs):** Dynamically detects the active foreground app (e.g. DaVinci Resolve, Safari, VS Code, Finder) and activates specialized workflow instructions and landmarks.
- **Executable Tools Engine:**
  - `highlight`: Animated bounding box with corner reticles and anchored callout bubble.
  - `overlay`: Normal text display tool for regular guidance text.
  - `code_overlay`: Formatted text display tool for code snippet outputs.
  - `to_do_overlay`: Interactive checklist display tool.
  - `voice`: Voice feedback frame-perfectly synchronized with visual highlights.
- **Floating Assistive Orb:** Ambient floating control resting at the edge of the screen with ripple pulses and state indicators (Idle, Listening, Processing, Guiding).
- **Command Palette (`Cmd+Shift+Space`):** Floating translucent search bar with active application detection, voice input, and quick suggestions.
- **Global Visibility Toggle (`Cmd+Shift+H`):** Instantly toggle all Screendial windows between visible and invisible.
- **System Tray Integration:** Persistent menu bar controls for instant activation, visibility toggles, voice, and clearing overlays.

### ⌨️ Global Shortcuts & Controls

| Shortcut / Control | Action |
| :--- | :--- |
| `Cmd+Shift+Space` | Toggle Command Palette |
| `Cmd+Shift+H` | Toggle All Screendial Windows Visible / Invisible |
| `Cmd+Shift+V` | Toggle Voice Recording |
| `Cmd+K` | Clear Chat History & Overlay Highlights |
| **Speaker Icon (Input Bar)** | Toggle Audio Output (Speech & Sounds) on / off (Muted by default) |

---

## 🚀 Getting Started

### Prerequisites

1. **Rust:** Ensure the Rust toolchain is installed:
   ```bash
   rustc --version
   cargo --version
   ```
   *(If not installed, install via: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)*

2. **Node.js & npm:**
   ```bash
   node --version  # Node 18+
   npm --version
   ```

3. **Google Gemini API Key:**
   Get an API key from [Google AI Studio](https://aistudio.google.com/).

---

### Installation & Local Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   Copy `.env` (or configure in `.env`) with your API keys:
   ```env
   VITE_GOOGLE_GEMINI_KEY=your_gemini_api_key_here
   VITE_ELEVENLABS_API_KEY=your_elevenlabs_key_here
   VITE_ELEVENLABS_VOICE_ID=your_voice_id_here
   ```
   `VITE_` values are embedded in the frontend build. Use these keys only for local/private demos; do not distribute a build containing real API keys.

3. **Configure TigerData interaction storage:**
   Add `DATABASE_URL=postgresql://...` to the ignored repository-root `.env.local` file. Create the `public.users` and `public.interactions` tables using the TigerData schema before launching the app. Screendial stores the Auth0 subject in `users.auth0_id` and successful text-only Gemini queries and text responses in `interactions`; the `embedding` column remains NULL for now. Passwords, tokens, API keys, screenshots, and audio are not stored. This is persistence only—saved interactions are not used as a cache.

   If certificate verification prevents a private demo database connection, you may temporarily add `SCREENDIAL_DEMO_INSECURE_TLS=true` to `.env.local`. This disables TLS certificate verification and makes the connection vulnerable to interception; keep the database private, use this only on a trusted network, and remove the setting after the demo. Certificate verification remains enabled by default.

4. **Launch in Development Mode:**
   ```bash
   npm run tauri dev
   ```

---

## ⌨️ Shortcuts & Controls

| Trigger | Action |
| :--- | :--- |
| `Cmd + Shift + Space` *(or Ctrl+Shift+Space)* | Toggle Floating Command Palette |
| `Cmd + Shift + V` *(or Ctrl+Shift+V)* | Toggle Voice Command Recording |
| **System Tray Icon** | Access quick actions, voice toggle, or quit |
| `Escape` | Dismiss Command Palette or active overlay |

---

## 🛠️ Project Structure

```
screendial/
├── src-tauri/                       # Native Rust Core Host
│   ├── src/
│   │   ├── tools/                   # Native Tauri Tools
│   │   │   ├── get_display_info.rs  # Query and assign monitor IDs
│   │   │   └── screenshot.rs        # Capture all monitors simultaneously
│   │   ├── window_info.rs           # Active window & process detection
│   │   ├── lib.rs                   # IPC commands, tray menu, & shortcuts
│   │   └── main.rs                  # Native entrypoint
│   ├── Cargo.toml                   # Rust dependencies
│   └── tauri.conf.json              # Window transparency & capabilities
├── skills/                          # Intelligent Skills System
│   ├── davinci-resolve/SKILL.md     # Video editing & timeline workflows
│   ├── safari/SKILL.md              # Web browsing & devtools workflows
│   ├── vscode/SKILL.md              # Code editing & command palette
│   ├── macos-system/SKILL.md        # Desktop, Spotlight & Finder
│   └── general-gui/SKILL.md         # Fallback visual grounding
├── src/                             # TypeScript & Liquid Glass Frontend
│   ├── components/
│   │   ├── Palette.ts               # Command Palette (Nav Bar)
│   │   └── Overlay.ts               # Fullscreen highlight & widget canvas
│   ├── services/
│   │   ├── audio.ts                 # Sound effects, mic recording, & TTS
│   │   └── gemini.ts                # Gemini multimodal agent & tool caller
│   ├── skills/
│   │   └── index.ts                 # Dynamic skill resolver
│   ├── styles/
│   │   └── glass.css                # Liquid Glass design system
│   ├── tools/                       # Independent Executable Tools
│   │   ├── model_call/              # Calls Gemini API with context and history
│   │   ├── highlight/               # Renders target boxes on elements
│   │   ├── overlay/                 # Renders standard text overlays
│   │   ├── code_overlay/            # Renders copyable code snippets
│   │   ├── to_do_overlay/           # Renders interactive checklists
│   │   ├── voice/                   # Synthesizes speech output
│   │   ├── index.ts                 # Tool exports
│   │   └── types.ts                 # Executable tool schemas & definitions
│   └── main.ts                      # Core application orchestrator
├── public/
│   └── sounds/                      # Sound assets (processing, listening, done)
├── package.json
├── Agent.md                         # Technical Architecture Specification
└── README.md
```

---

## 📦 Packaging Standalone App (.app / .exe)

To compile a production bundle:

```bash
npm run tauri build
```

* **macOS Output:** `src-tauri/target/release/bundle/macos/Screendial.app`
* **Windows Output:** `src-tauri/target/release/bundle/msi/Screendial.msi`

### First Run Permissions (macOS)
Grant the following permissions in **System Settings → Privacy & Security**:
- **Screen Recording:** Allows Screendial to capture screen pixels for visual grounding.
- **Accessibility:** Allows Screendial to guide the mouse cursor and simulate keystrokes.
- **Microphone:** Allows voice command input.

### macOS Gatekeeper "Damaged" App Warning Fix
Since independent releases are un-notarized by Apple, macOS Gatekeeper may block launch saying the app is *"damaged"* or *can't be opened*. Paste this command in your **Terminal** to clear the quarantine flag:

```bash
xattr -cr /Applications/Screendial.app
```
