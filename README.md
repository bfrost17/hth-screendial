# Screendial 🎙️✨

**Screendial** is an intelligent, real-time native desktop copilot designed to guide users through on-screen workflows step-by-step. Built with **Tauri v2** (Rust + TypeScript/HTML/Vanilla CSS), it features an ultra-low-latency **transparent glass overlay**, an intelligent **Skills System**, an executable **Tools Engine**, and a **Gemini + ElevenLabs** voice/vision pipeline, gated behind **Auth0** sign-in.

---

## ✨ Features

- **Transparent Glass Overlay:** Frameless fullscreen canvas with a static ash-grey glass command bar and overlay panels (blur + translucency, no animated background), anchored speech bubbles, and highlight reticles.
- **Intelligent Click-Through:** Transparent areas pass mouse clicks directly to underlying applications, while interactive cards, widgets, and the command bar capture clicks seamlessly.
- **Context-Aware Skills (Not Static Docs):** Dynamically detects the active foreground app (e.g. DaVinci Resolve, Safari, VS Code, Finder) and activates specialized workflow instructions and landmarks.
- **Executable Tools Engine:**
  - `highlight`: Animated bounding box with corner reticles and anchored callout bubble.
  - `overlay`: Normal text display tool for regular guidance text.
  - `code_overlay`: Formatted text display tool for code snippet outputs.
  - `to_do_overlay`: Interactive checklist display tool.
  - `voice`: Spoken guidance, synthesized ahead of time so playback starts in lockstep with whatever visual tools accompany it (see **Voice Pipeline** below).
- **Multi-Monitor Simultaneous Capture:** Captures every active display at once per query. On macOS this goes through **ScreenCaptureKit** (`src-tauri/src/tools/macos_capture.rs`), not the deprecated `CGWindowListCreateImage` path (see **Packaging** below for the permission it needs).
- **Voice Pipeline:** Push-to-talk recording, transcribed via **ElevenLabs Speech-to-Text** (falling back to sending raw audio to Gemini if unavailable), with spoken responses synthesized via **ElevenLabs Text-to-Speech** (falling back to the browser's built-in speech synthesis).
- **Sign-In Required (Auth0):** The app is gated behind an Auth0-backed sign-in/sign-up modal on launch. A working default tenant is baked in for local development (see **Prerequisites** below); override it with your own `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` if needed.
- **Cloud Interaction History (optional):** Signed-in text queries and Gemini's text responses can be persisted to a Postgres/TigerData database (see **Installation & Local Run** below). Screenshots, audio, and secrets are never stored.
- **Command Palette:** Floating translucent search bar with active-application detection, voice input, mute toggle, clear-conversation, sign-out, and minimize controls, opened from the system tray (see **Controls** below).
- **System Tray Integration:** Persistent menu bar icon and dropdown menu for opening the palette, toggling voice, showing/hiding all Screendial windows, clearing overlay highlights, and quitting.

---

## 🕹️ Controls

There are currently no bound global keyboard shortcuts — everything starts from the **system tray icon**.

| Trigger | Action |
| :--- | :--- |
| **Left-click the tray icon** | Open the command palette |
| **Tray menu → "Ask Screendial..."** | Open the command palette |
| **Tray menu → "Toggle Voice"** | Start/stop voice command recording |
| **Tray menu → "Hide/Show Windows"** | Toggle all Screendial windows visible/invisible |
| **Tray menu → "Clear Overlay Highlights"** | Dismiss active highlights/callouts and reset the input |
| **Tray menu → "Quit Screendial"** | Quit the app |
| `Enter` (in the palette input) | Send the query |
| `Shift+Enter` (in the palette input) | Insert a newline |
| `Escape` (in the palette input) | Clear the input, or blur it if already empty |

The command bar's icon row, left to right: **mic** (voice command) · **speaker** (mute/unmute audio output, muted by default) · **trash** (clear conversation history & overlay) · **logout** (sign out) · **minimize** (hide the window) · **Send**.

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
   node --version  # Node 20.19+/22.12+ (required by Vite 8)
   npm --version
   ```

3. **Google Gemini API Key (required):**
   Get an API key from [Google AI Studio](https://aistudio.google.com/).

4. **ElevenLabs API Key (optional, recommended):**
   Powers voice transcription and natural-sounding spoken responses. Without it, voice input falls back to sending raw audio straight to Gemini, and spoken responses fall back to the browser's built-in speech synthesis.

5. **Auth0 (optional):** Sign-in is required to use the app, but a working shared development tenant is baked into `src/services/auth0.ts` as a default, so you can sign up and sign in without configuring your own tenant. Set `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` only if you want to point at your own Auth0 application.

6. **macOS 14 (Sonoma) or later**, if running on macOS — screenshot capture requires ScreenCaptureKit.

---

### Installation & Local Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   Create a `.env.local` file (or `.env`) at the repository root:
   ```env
   VITE_GOOGLE_GEMINI_KEY=your_gemini_api_key_here

   VITE_ELEVENLABS_API_KEY=your_elevenlabs_key_here
   VITE_ELEVENLABS_VOICE_ID=your_voice_id_here
   VITE_ELEVENLABS_STT_MODEL=scribe_v1            # optional, this is the default
   VITE_ELEVENLABS_TTS_MODEL=eleven_multilingual_v2 # optional, this is the default

   # Optional: only needed to override the built-in shared dev tenant
   VITE_AUTH0_DOMAIN=your_tenant.us.auth0.com
   VITE_AUTH0_CLIENT_ID=your_auth0_client_id
   ```
   `VITE_`-prefixed values are inlined into the compiled frontend JS at build time (by Vite), so they end up readable inside any built `.app`/installer you distribute. Use real keys only for local/private demos; see **Packaging** below for the tradeoffs of shipping a build with real keys embedded.

3. **Configure interaction storage (optional):**
   Add `DATABASE_URL=postgresql://...` to the same `.env.local` file. Create the `public.users` and `public.interactions` tables using the TigerData schema before launching the app. Screendial stores the Auth0 subject in `users.auth0_id` and successful text-only Gemini queries and text responses in `interactions`; the `embedding` column remains NULL for now. Passwords, tokens, API keys, screenshots, and audio are not stored. This is persistence only — saved interactions are not used as a cache. If this isn't configured, the app still works; only cloud history is skipped.

   If certificate verification prevents a private demo database connection, you may temporarily add `SCREENDIAL_DEMO_INSECURE_TLS=true` to `.env.local`. This disables TLS certificate verification and makes the connection vulnerable to interception; keep the database private, use this only on a trusted network, and remove the setting after the demo. Certificate verification remains enabled by default.

4. **Launch in Development Mode:**
   ```bash
   npm run tauri dev
   ```

5. **Sign in.** On first launch you'll see the Auth0 sign-in/sign-up modal — create an account or sign in before the command palette becomes available.

---

## 🛠️ Project Structure

```
screendial/
├── src-tauri/                        # Native Rust Core Host
│   ├── src/
│   │   ├── tools/
│   │   │   ├── get_display_info.rs   # Query and assign monitor IDs
│   │   │   ├── screenshot.rs         # Capture all monitors simultaneously
│   │   │   └── macos_capture.rs      # ScreenCaptureKit backend (macOS screenshot path)
│   │   ├── database_connection.rs    # Postgres/TigerData interaction persistence
│   │   ├── window_info.rs            # Active window & process detection
│   │   ├── lib.rs                    # IPC commands, tray menu, & window lifecycle
│   │   └── main.rs                   # Native entrypoint
│   ├── tests/
│   │   └── manual_sck_probe.rs       # Manual, ignored-by-default ScreenCaptureKit probe
│   ├── Info.plist                    # Merged into the bundle's Info.plist (mic usage string)
│   ├── Cargo.toml                    # Rust dependencies
│   └── tauri.conf.json               # Window transparency, capabilities, bundled resources
├── skills/                           # Intelligent Skills System
│   ├── davinci-resolve/SKILL.md      # Video editing & timeline workflows
│   ├── safari/SKILL.md               # Web browsing & devtools workflows
│   ├── vscode/SKILL.md               # Code editing & command palette
│   ├── macos-system/SKILL.md         # Desktop, Spotlight & Finder
│   └── general-gui/SKILL.md          # Fallback visual grounding
├── src/                              # TypeScript & Glass UI Frontend
│   ├── components/
│   │   ├── Palette.ts                # Command bar (mic/speaker/trash/logout/minimize/Send)
│   │   ├── Overlay.ts                # Fullscreen highlight & widget canvas
│   │   └── AuthModal.ts              # Auth0 sign-in/sign-up modal
│   ├── services/
│   │   ├── audio.ts                  # Sound effects, mic recording, & TTS (ElevenLabs + fallback)
│   │   ├── elevenlabs.ts             # ElevenLabs speech-to-text & text-to-speech client
│   │   ├── gemini.ts                 # Gemini multimodal agent & tool caller
│   │   ├── auth0.ts                  # Auth0 sign-in/sign-up/session handling
│   │   ├── nativeHttp.ts             # HTTP via the Rust backend (bypasses browser CORS)
│   │   └── terminalLog.ts            # Mirrors frontend logs to the native terminal
│   ├── skills/
│   │   └── index.ts                  # Dynamic skill resolver
│   ├── brand/
│   │   ├── icons.ts                  # Plain line icons for the command bar's toolbar buttons
│   │   └── ui.ts                     # Logo, timecode, and arrow markup shared across the UI
│   ├── styles/
│   │   ├── glass.css                 # Base glass design tokens & shared components
│   │   ├── brand.css                 # Logo + toolbar icon styling
│   │   ├── palette-vhs.css           # Command bar styling (static ash-grey glass)
│   │   └── overlay-vhs.css           # Overlay panel & viewfinder styling
│   ├── tools/                        # Independent Executable Tools
│   │   ├── model_call/               # Calls Gemini API with context and history
│   │   ├── highlight/                # Renders target boxes on elements
│   │   ├── overlay/                  # Renders standard text overlays
│   │   ├── code_overlay/             # Renders copyable code snippets
│   │   ├── to_do_overlay/            # Renders interactive checklists
│   │   ├── voice/                    # Speaks guidance text
│   │   ├── index.ts                  # Tool exports
│   │   └── types.ts                  # Executable tool schemas & definitions
│   └── main.ts                       # Core application orchestrator
├── public/
│   └── sounds/                       # Sound assets (processing, listening, done)
├── .github/workflows/
│   └── build-desktop.yml             # Manual CI build for macOS + Windows (see below)
├── package.json
├── Agent.md                          # Technical Architecture Specification
└── README.md
```

---

## 📦 Packaging Standalone App (.app / .exe)

To compile a production bundle for the current platform:

```bash
npm run tauri build
```

* **macOS output:** `src-tauri/target/release/bundle/macos/Screendial.app` and a `.dmg` alongside it.
* **Windows output:** `src-tauri/target/release/bundle/msi/*.msi` and `.../nsis/*.exe`.

⚠️ **Building for Windows requires a Windows machine (or CI) — you cannot cross-compile it from macOS.** This repo doesn't have the Windows toolchain (mingw/cargo-xwin) or NSIS/WiX, and Tauri's Windows bundlers expect to run on Windows.

### GitHub Actions build (macOS + Windows)

`.github/workflows/build-desktop.yml` builds both platforms on real GitHub-hosted runners. Trigger it manually from the **Actions** tab (`workflow_dispatch`). Before running it, add these as repository secrets (Settings → Secrets and variables → Actions), matching your local `.env.local`:

`VITE_GOOGLE_GEMINI_KEY`, `VITE_ELEVENLABS_API_KEY`, `VITE_ELEVENLABS_VOICE_ID`, `VITE_ELEVENLABS_STT_MODEL`, `VITE_ELEVENLABS_TTS_MODEL`, `DATABASE_URL`, `SCREENDIAL_DEMO_INSECURE_TLS`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`.

Finished builds are attached as downloadable artifacts on the workflow run (Actions tab → the run → **Artifacts**), not as a public release.

### ⚠️ Packaged builds embed real secrets — demo-only

`VITE_`-prefixed values are compiled directly into the shipped frontend JS (readable by anyone with the built app). `DATABASE_URL` is bundled as a resource file (`tauri.conf.json` → `bundle.resources`, read at runtime via `database_connection.rs`) so the packaged app can find `.env.local` without depending on the dev machine's file layout — but that also means the raw database credentials ship inside the app. This is an accepted tradeoff for internal/hackathon-demo builds; don't distribute a build like this publicly without moving API calls and DB access behind a backend proxy first.

### First Run Permissions (macOS)

Grant these in **System Settings → Privacy & Security**, then **fully quit and reopen the app** (a mid-session grant doesn't apply to an already-running process):

- **Screen Recording:** Required for screenshot capture (`macos_capture.rs`, via ScreenCaptureKit). If the app isn't listed under Screen Recording yet, use the **+** button to add it manually from `Screendial.app`.
- **Microphone:** Required for voice command input (declared via the bundled `src-tauri/Info.plist`).

Because packaged builds are currently only ad-hoc signed (no Apple Developer ID), macOS treats each rebuild as a new app identity — expect to re-grant these permissions after every `tauri build`, not just the first install.

### macOS Gatekeeper "Damaged" App Warning Fix

Since independent releases are un-notarized by Apple, macOS Gatekeeper may block launch saying the app is *"damaged"* or *can't be opened*. Paste this command in your **Terminal** to clear the quarantine flag:

```bash
xattr -cr /Applications/Screendial.app
```
