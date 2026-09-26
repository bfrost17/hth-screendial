import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import "./styles/glass.css";
import { PaletteComponent } from "./components/Palette";
import { OverlayComponent } from "./components/Overlay";
import { SettingsModalComponent } from "./components/SettingsModal";
import { AudioManager } from "./services/audio";
import { GeminiAgentService } from "./services/gemini";
import { resolveSkill } from "./skills";
import {
  ClientTool,
  ToolCall,
  HighlightTool,
  OverlayTool,
  CodeOverlayTool,
  ToDoOverlayTool,
  VoiceTool,
  ScreenCapturePayload
} from "./tools";

/**
 * Bounds of an interactive region for click-through toggling.
 */
export interface LogicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Main application orchestrator for Screendial.
 * Manages native window capture, triggers the AI model, and dispatches interactive visual tools.
 */
class ScreendialApp {
  private appRoot: HTMLElement;
  private audio: AudioManager;
  private gemini: GeminiAgentService;
  private palette: PaletteComponent;
  private overlay: OverlayComponent;
  private settingsModal: SettingsModalComponent;

  private currentActiveApp: string = "Desktop";
  private isModalOpen: boolean = false;
  private isPaletteOpen: boolean = false;
  private detectedDisplays: any[] = [];
  private desktopLayout: any = null;

  private clientTools: ClientTool[] = [
    new HighlightTool(),
    new OverlayTool(),
    new CodeOverlayTool(),
    new ToDoOverlayTool(),
    new VoiceTool()
  ];

  constructor() {
    this.appRoot = document.getElementById("app")!;
    this.audio = new AudioManager(false); // Audio output muted initially
    this.gemini = new GeminiAgentService();

    // Always clear history on app launch
    this.gemini.clearHistory();

    // 1. Initialize Components
    this.overlay = new OverlayComponent({
      onDismissAndReset: () => {
        this.handleDismissAndReset();
      },
    });

    this.palette = new PaletteComponent({
      onSubmit: (query) => this.handleTextQuery(query),
      onToggleVoice: () => this.toggleVoice(),
      onOpenSettings: () => this.openSettings(),
      onCycleScreen: () => {
        this.showStatus("Auto-capturing all monitors simultaneously.", false, "screen_info", 2000);
      },
      onClearChat: () => this.handleClearChat(),
      onToggleAudio: () => this.toggleAudioOutput(),
      initialAudioOutput: this.audio.isAudioOutputEnabled(),
      onClose: () => {
        this.isPaletteOpen = false;
        this.updateInteractiveRegions();
      },
      onMinimizeWindow: () => this.minimizeWindow(),
      onDragChange: (isDragging) => {
        this.updateInteractiveRegions(isDragging);
      },
    });

    this.settingsModal = new SettingsModalComponent({
      onSave: (key, model) => {
        this.gemini.setApiKey(key);
        this.gemini.setModelName(model);
        this.isModalOpen = false;
        this.updateInteractiveRegions();
      },
    });

    // 2. Mount to DOM
    this.appRoot.appendChild(this.overlay.getElement());
    this.appRoot.appendChild(this.palette.getElement());
    this.appRoot.appendChild(this.settingsModal.getElement());

    // 3. Setup Listeners, Layout & Monitors
    this.fetchDesktopLayout();
    this.setupTrayEvents();
    this.setupInteractiveRegionsSync();
    this.refreshActiveApp();

    // Reveal Command Palette on launch
    setTimeout(() => {
      this.showPalette();
    }, 350);

    // Check API Key on launch
    if (!this.gemini.hasApiKey()) {
      setTimeout(() => this.openSettings(), 1200);
    } else {
      setTimeout(() => {
        this.audio.speak("Screendial is ready.");
      }, 700);
    }
  }

  public async showStatus(
    text: string,
    showSpinner: boolean = true,
    id: string = "default",
    durationMs?: number
  ) {
    this.palette.showStatus(text, showSpinner, id, durationMs);
    this.updateInteractiveRegions();
  }

  public async hideStatus(id?: string) {
    this.palette.hideStatus(id);
    this.updateInteractiveRegions();
  }

  private async fetchDesktopLayout() {
    try {
      this.desktopLayout = await invoke<any>("get_desktop_layout_cmd");
      this.overlay.setLayout(this.desktopLayout);
      console.log("[Screendial] Desktop layout:", this.desktopLayout);
    } catch (err) {
      console.warn("[Screendial] Failed to fetch desktop layout:", err);
    }
  }

  public async minimizeWindow() {
    try {
      await invoke("minimize_window_cmd");
    } catch (err) {
      console.warn("[Screendial] Minimize window error:", err);
    }
  }

  private async setupTrayEvents() {
    try {
      await listen("trigger-prompt", () => {
        this.togglePalette();
      });

      await listen("trigger-voice", () => {
        this.toggleVoice();
      });

      await listen<boolean>("window-visibility-changed", async (event) => {
        const isVisible = event.payload;
        if (!isVisible) {
          this.palette.hide();
          this.isPaletteOpen = false;
          this.hideStatus();
        } else {
          if (!this.isPaletteOpen) {
            await this.showPalette();
          }
        }
      });

      await listen("clear-overlay", () => {
        this.overlay.clear();
        this.palette.resetInput();
        this.updateInteractiveRegions();
      });
    } catch (err) {
      console.warn("[Screendial] Tray event listener setup notice:", err);
    }
  }

  private setupInteractiveRegionsSync() {
    // Continuously sync interactive element boundaries with the Rust cursor hit-tester
    setInterval(() => {
      this.updateInteractiveRegions();
    }, 200);

    window.addEventListener("resize", () => {
      this.updateInteractiveRegions();
    });
  }

  public updateInteractiveRegions(forceInteractive?: boolean) {
    const isForce =
      (forceInteractive ?? false) ||
      this.isModalOpen ||
      this.palette.isCurrentlyDragging();

    const elements = document.querySelectorAll<HTMLElement>(
      ".palette-box.visible, .status-pill.visible, .modal-box, .callout-bubble, .output-card, .output-widget-container, .interactive"
    );

    const rects: LogicalRect[] = [];
    elements.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rects.push({
          x: Math.max(0, r.left - 6),
          y: Math.max(0, r.top - 6),
          width: r.width + 12,
          height: r.height + 12,
        });
      }
    });

    invoke("update_interactive_rects_cmd", {
      rects,
      forceInteractive: isForce,
    }).catch(() => {});
  }

  public async handleDismissAndReset() {
    this.overlay.clear();
    this.palette.resetInput();
    await this.showPalette();
    this.updateInteractiveRegions();
  }

  public async handleClearChat() {
    this.gemini.clearHistory();
    this.overlay.clear();
    this.palette.resetInput();
    this.audio.playSound("results_back");
    this.showStatus("Conversation history cleared.", false, "clear_chat", 1800);
    this.updateInteractiveRegions();
  }

  private async refreshActiveApp(): Promise<string> {
    try {
      const appInfo = await invoke<{
        app_name: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>("get_active_window_cmd");

      if (appInfo && appInfo.app_name && appInfo.app_name !== "Screendial") {
        this.currentActiveApp = appInfo.app_name;
      }
    } catch (err) {
      console.warn("Could not get active window info:", err);
    }
    return this.currentActiveApp;
  }

  public async showPalette() {
    try {
      await invoke("ensure_visible_cmd");
    } catch {
      // ignore
    }
    const activeApp = await this.refreshActiveApp();
    this.palette.show(activeApp);
    this.isPaletteOpen = true;
    this.updateInteractiveRegions();
  }

  public async togglePalette() {
    if (this.isPaletteOpen) {
      this.palette.hide();
      this.isPaletteOpen = false;
      this.updateInteractiveRegions();
    } else {
      await this.showPalette();
    }
  }

  public async toggleVoice() {
    if (!this.audio.recordingActive) {
      this.palette.setState("listening");
      this.palette.setVoiceActive(true);
      this.showStatus("Listening for voice command... (Speak now)", false, "voice");
      this.updateInteractiveRegions();

      const started = await this.audio.startRecording();
      if (!started) {
        this.palette.setState("idle");
        this.palette.setVoiceActive(false);
        this.hideStatus("voice");
      }
    } else {
      this.palette.setVoiceActive(false);
      this.hideStatus("voice");
      this.showStatus("Processing audio...", true, "processing");
      const audioBase64 = await this.audio.stopRecording();
      if (audioBase64) {
        await this.processQuery(undefined, audioBase64);
      } else {
        this.palette.setState("idle");
        this.hideStatus("processing");
      }
    }
  }

  public toggleAudioOutput() {
    const isEnabled = this.audio.toggleAudio();
    this.palette.setAudioOutputEnabled(isEnabled);
    if (isEnabled) {
      this.showStatus("Audio output enabled.", false, "audio_toggle", 1800);
      this.audio.speak("Audio enabled.");
    } else {
      this.showStatus("Audio output muted.", false, "audio_toggle", 1800);
    }
  }

  private async handleTextQuery(query: string) {
    this.isPaletteOpen = false;
    this.palette.resetInput();
    this.palette.hide();
    await this.processQuery(query, undefined);
  }

  private async processQuery(query?: string, audioBase64?: string) {
    this.palette.setState("processing");
    this.showStatus("Analyzing screens & active app...", true, "processing");
    this.audio.playSound("processing");

    try {
      const activeApp = await this.refreshActiveApp();
      const activeSkill = resolveSkill(activeApp);

      // 1. Capture ALL screens simultaneously
      const screens = await invoke<Record<string, ScreenCapturePayload>>("capture_all_screens_cmd");
      console.log(`[Screendial] Captured ${Object.keys(screens).length} screen(s) for processing`);

      // 2. Submit captures to Gemini Agent
      const toolCalls = await this.gemini.analyzeDesktop(
        screens,
        query,
        audioBase64,
        activeApp,
        activeSkill
      );

      // 3. Dispatch returned Tool Calls directly on this instance's overlay
      await this.dispatchTools(toolCalls);
    } catch (err: any) {
      console.error("[Screendial] Processing error:", err);
      this.showStatus(`Error: ${err.message || err}`, false, "error", 4000);
      this.audio.speak("An error occurred while processing your request.");
    } finally {
      this.hideStatus("processing");
      this.palette.setState("idle");
      this.updateInteractiveRegions();
    }
  }

  private async dispatchTools(actions: ToolCall[]) {
    if (!actions || actions.length === 0) {
      this.hideStatus("processing");
      this.audio.playSound("agent_done");
      return;
    }

    this.hideStatus("processing");
    this.audio.playSound("results_back");

    // Clear previous highlights to redraw freshly
    this.overlay.clear();

    // Polymorphically execute independent client tools
    for (const action of actions) {
      const toolInstance = this.clientTools.find((t) => t.name === action.tool);
      if (toolInstance) {
        try {
          await toolInstance.execute(action.args, this.overlay, this.audio, this.desktopLayout);
        } catch (err) {
          console.error(`[Screendial] Failed to execute tool "${action.tool}":`, err);
        }
      } else {
        console.warn(`[Screendial] Unrecognized tool returned from model: ${action.tool}`);
      }
    }

    this.updateInteractiveRegions();
  }

  public async openSettings() {
    this.isModalOpen = true;
    try {
      const displays = await invoke<any[]>("get_display_info_cmd");
      this.detectedDisplays = displays.map((d) => ({
        index: d.id,
        name: d.name,
        width: d.width,
        height: d.height,
        is_primary: d.is_primary,
      }));
    } catch (err) {
      console.warn("[Screendial] Failed to query display info:", err);
      this.detectedDisplays = [];
    }

    this.settingsModal.show(
      this.gemini.getApiKey(),
      this.gemini.getModelName(),
      this.detectedDisplays
    );
    this.updateInteractiveRegions(true);
  }
}

// ============================================================================
// BOOTSTRAP: RUN AUTOMATED OVERLAY APPLICATION
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  new ScreendialApp();
});
