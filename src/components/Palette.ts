import { lineArrow, logo } from "../brand/ui";
import { pixelIcon } from "../brand/pixel-icons";
import { BarPicture, mountBarPicture } from "../brand/bar-picture";

/** Pixel toolbar icons (brand/pixel-icons.ts). */
const PALETTE_ICONS = {
  clear: pixelIcon("trash"),
  audioOff: pixelIcon("sound-off"),
  audioOn: pixelIcon("sound-on"),
  logout: pixelIcon("logout"),
  hide: pixelIcon("hide"),
  mic: pixelIcon("mic"),
};

export class PaletteComponent {
  private container: HTMLElement;
  private paletteBox!: HTMLElement;
  private statusContainer!: HTMLElement;
  private activeStatuses: Map<string, HTMLElement> = new Map();
  private inputElement!: HTMLTextAreaElement;
  private sendButton!: HTMLElement;
  private voiceButton!: HTMLElement;
  private clearButton!: HTMLElement;
  private audioButton!: HTMLElement;
  private brandIcon!: HTMLElement;
  private isVisible: boolean = false;
  private hasBeenMoved: boolean = false;
  // the tape + waves behind the bar; runs only while the palette is open
  private picture!: BarPicture;
  private pictureOff = 0;

  private onSubmit: (query: string) => void;
  private onToggleVoice: () => void;
  private onToggleAudio?: () => void;
  private onClearChat?: () => void;
  private onLogout?: () => void;
  private onClose?: () => void;
  private onMinimizeWindow?: () => void;
  private onDragChange?: (isDragging: boolean) => void;

  constructor(callbacks: {
    onSubmit: (query: string) => void;
    onToggleVoice: () => void;
    onToggleAudio?: () => void;
    initialAudioOutput?: boolean;
    onCycleScreen?: () => void;
    onClearChat?: () => void;
    onLogout?: () => void;
    onClose?: () => void;
    onMinimizeWindow?: () => void;
    onDragChange?: (isDragging: boolean) => void;
  }) {
    this.onSubmit = callbacks.onSubmit;
    this.onToggleVoice = callbacks.onToggleVoice;
    this.onToggleAudio = callbacks.onToggleAudio;
    this.onClearChat = callbacks.onClearChat;
    this.onLogout = callbacks.onLogout;
    this.onClose = callbacks.onClose;
    this.onMinimizeWindow = callbacks.onMinimizeWindow;
    this.onDragChange = callbacks.onDragChange;

    this.container = document.createElement("div");
    this.container.className = "palette-container";
    this.render();
    this.setAudioOutputEnabled(callbacks.initialAudioOutput ?? false);
    this.setupDragging();
    this.attachEvents();
  }

  private render() {
    this.container.innerHTML = `
      <div class="status-pill-container"></div>

      <div class="palette-box">
        <span class="bar-picture" aria-hidden="true"><span class="bar-scrim"></span></span>
        <div class="palette-drag-handle" title="Drag to move">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2"></circle><circle cx="6" cy="2" r="1.2"></circle>
            <circle cx="2" cy="7" r="1.2"></circle><circle cx="6" cy="7" r="1.2"></circle>
            <circle cx="2" cy="12" r="1.2"></circle><circle cx="6" cy="12" r="1.2"></circle>
          </svg>
        </div>

        <div class="palette-icon-brand status-idle" title="Screendial">${logo(28)}</div>

        <textarea
          class="palette-input"
          placeholder="Ask Screendial for anything on your screen"
          rows="1"
          spellcheck="false"
        ></textarea>

        <div class="palette-badges">
          <button class="voice-btn clear-btn" title="Clear conversation">${PALETTE_ICONS.clear}</button>
          <button class="voice-btn audio-btn muted" title="Audio output: muted">${PALETTE_ICONS.audioOff}</button>
          <button class="voice-btn logout-btn" title="Sign out">${PALETTE_ICONS.logout}</button>
          <button class="voice-btn hide-btn" title="Hide">${PALETTE_ICONS.hide}</button>
          <button class="voice-btn mic-btn" title="Voice command">${PALETTE_ICONS.mic}</button>
          <button class="send-btn" title="Send">Send
            ${lineArrow}
          </button>
        </div>
      </div>
    `;

    this.paletteBox = this.container.querySelector(".palette-box")!;
    this.statusContainer = this.container.querySelector(".status-pill-container")!;
    this.brandIcon = this.container.querySelector(".palette-icon-brand")!;
    this.inputElement = this.container.querySelector(".palette-input")!;
    this.sendButton = this.container.querySelector(".send-btn")!;
    this.clearButton = this.container.querySelector(".clear-btn")!;
    this.audioButton = this.container.querySelector(".audio-btn")!;
    this.voiceButton = this.container.querySelector(".mic-btn")!;
    this.picture = mountBarPicture(this.container.querySelector(".bar-picture")!, { active: false });
  }

  public showStatus(
    text: string,
    showSpinner: boolean = true,
    id: string = "default",
    durationMs?: number
  ) {
    let pill = this.activeStatuses.get(id);
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "status-pill";
      pill.setAttribute("data-status-id", id);
      pill.innerHTML = `
        <div class="spinner-iridescent" style="display: ${showSpinner ? "block" : "none"};"></div>
        <span class="status-pill-text"></span>
      `;
      this.statusContainer.appendChild(pill);
      this.activeStatuses.set(id, pill);
      requestAnimationFrame(() => {
        pill?.classList.add("visible");
      });
    }

    const textEl = pill.querySelector(".status-pill-text") as HTMLElement;
    const spinner = pill.querySelector(".spinner-iridescent") as HTMLElement;
    if (textEl) textEl.textContent = text;
    if (spinner) spinner.style.display = showSpinner ? "block" : "none";

    if (durationMs && durationMs > 0) {
      setTimeout(() => {
        this.hideStatus(id);
      }, durationMs);
    }
  }

  public hideStatus(id?: string) {
    if (id) {
      const pill = this.activeStatuses.get(id);
      if (pill) {
        pill.classList.remove("visible");
        this.activeStatuses.delete(id);
        setTimeout(() => {
          pill.remove();
        }, 250);
      }
    } else {
      for (const [, pill] of this.activeStatuses) {
        pill.classList.remove("visible");
        setTimeout(() => {
          pill.remove();
        }, 250);
      }
      this.activeStatuses.clear();
    }
  }

  public hasActiveStatuses(): boolean {
    return this.activeStatuses.size > 0;
  }

  private isDragging: boolean = false;
  private justDragged: boolean = false;

  private setupDragging() {
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const dragHandle = this.container.querySelector(".palette-drag-handle") as HTMLElement;

    const startDrag = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.hasBeenMoved = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      this.container.style.transform = "none";
      this.container.style.left = `${initialLeft}px`;
      this.container.style.top = `${initialTop}px`;
      this.container.classList.add("dragging");

      e.preventDefault();
      e.stopPropagation();
      this.onDragChange?.(true);
    };

    dragHandle?.addEventListener("mousedown", startDrag);
    this.brandIcon?.addEventListener("mousedown", startDrag);

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const rect = this.container.getBoundingClientRect();
      const margin = 20;
      const minTop = 45; // Leave room for status pill above
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(minTop, window.innerHeight - rect.height - margin);

      newLeft = Math.max(margin, Math.min(maxLeft, newLeft));
      newTop = Math.max(minTop, Math.min(maxTop, newTop));

      this.container.style.left = `${newLeft}px`;
      this.container.style.top = `${newTop}px`;
    });

    const endDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.justDragged = true;
        this.container.classList.remove("dragging");
        this.onDragChange?.(false);
        setTimeout(() => {
          this.justDragged = false;
        }, 300);
      }
    };

    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);
  }

  private handleSend() {
    const query = this.inputElement.value.trim();
    if (query) {
      this.inputElement.value = "";
      this.inputElement.style.height = "auto";
      this.hide();
      this.onSubmit(query);
    }
  }

  private attachEvents() {
    const adjustHeight = () => {
      this.inputElement.style.height = "auto";
      const scrollH = this.inputElement.scrollHeight;
      const newHeight = Math.min(Math.max(24, scrollH), 180);
      this.inputElement.style.height = `${newHeight}px`;
    };

    this.inputElement.addEventListener("input", adjustHeight);

    this.inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (this.inputElement.value.length > 0) {
          this.inputElement.value = "";
          this.inputElement.style.height = "auto";
        } else {
          this.inputElement.blur();
        }
      }
    });

    this.sendButton.addEventListener("click", () => {
      this.handleSend();
    });

    this.clearButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.triggerClearChat();
    });

    this.voiceButton.addEventListener("click", () => {
      this.onToggleVoice();
    });

    this.audioButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onToggleAudio) {
        this.onToggleAudio();
      }
    });

    this.container.querySelector(".logout-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onLogout) {
        this.onLogout();
      }
    });

    this.container.querySelector(".hide-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onMinimizeWindow) {
        this.onMinimizeWindow();
      }
    });
  }

  private triggerClearChat() {
    this.inputElement.value = "";
    this.inputElement.style.height = "auto";
    if (this.onClearChat) {
      this.onClearChat();
    }
  }

  public resetInput(resetPosition: boolean = false) {
    this.inputElement.value = "";
    this.inputElement.style.height = "auto";
    if (resetPosition) {
      this.hasBeenMoved = false;
      this.container.style.left = "50%";
      this.container.style.top = "96px";
      this.container.style.transform = "translateX(-50%)";
    }
    this.inputElement.focus();
  }

  public setState(state: "idle" | "listening" | "processing") {
    if (this.brandIcon) {
      this.brandIcon.className = `palette-icon-brand status-${state}`;
    }
  }

  public setAudioOutputEnabled(enabled: boolean) {
    if (!this.audioButton) return;
    this.audioButton.className = `voice-btn audio-btn ${enabled ? "active" : "muted"}`;
    this.audioButton.title = enabled ? "Audio output: on" : "Audio output: muted";
    this.audioButton.innerHTML = enabled ? PALETTE_ICONS.audioOn : PALETTE_ICONS.audioOff;
  }

  public show(_activeApp: string = "Desktop", _screenName?: string) {
    this.isVisible = true;
    this.inputElement.value = "";
    this.inputElement.style.height = "auto";
    if (!this.hasBeenMoved) {
      this.container.style.left = "50%";
      this.container.style.top = "96px";
      this.container.style.transform = "translateX(-50%)";
    }
    window.clearTimeout(this.pictureOff);
    this.picture.setActive(true);
    this.paletteBox.classList.add("visible");
    setTimeout(() => {
      this.inputElement.focus();
    }, 50);
  }

  public isCurrentlyDragging(): boolean {
    return this.isDragging;
  }

  public wasJustDragged(): boolean {
    return this.justDragged;
  }

  public hide() {
    if (this.isVisible) {
      this.isVisible = false;
      this.paletteBox.classList.remove("visible");
      // stop the picture once the fade-out (0.4s) has finished, not mid-fade
      window.clearTimeout(this.pictureOff);
      this.pictureOff = window.setTimeout(() => this.picture.setActive(false), 450);
      this.inputElement.blur();
      if (this.onClose) {
        this.onClose();
      }
    }
  }

  public toggle(activeApp?: string) {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(activeApp);
    }
  }

  public updateScreenBadge(_name?: string) {
    // No-op
  }

  public setVoiceActive(active: boolean) {
    if (active) {
      this.voiceButton.classList.add("active");
      this.setState("listening");
    } else {
      this.voiceButton.classList.remove("active");
      this.setState("idle");
    }
  }

  public updateSuggestions(_suggestions: string[]) {
    // No-op
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
