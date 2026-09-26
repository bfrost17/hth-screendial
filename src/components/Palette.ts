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

  private onSubmit: (query: string) => void;
  private onToggleVoice: () => void;
  private onOpenSettings: () => void;
  private onToggleAudio?: () => void;
  private onClearChat?: () => void;
  private onClose?: () => void;
  private onMinimizeWindow?: () => void;
  private onDragChange?: (isDragging: boolean) => void;

  constructor(callbacks: {
    onSubmit: (query: string) => void;
    onToggleVoice: () => void;
    onOpenSettings: () => void;
    onToggleAudio?: () => void;
    initialAudioOutput?: boolean;
    onCycleScreen?: () => void;
    onClearChat?: () => void;
    onClose?: () => void;
    onMinimizeWindow?: () => void;
    onDragChange?: (isDragging: boolean) => void;
  }) {
    this.onSubmit = callbacks.onSubmit;
    this.onToggleVoice = callbacks.onToggleVoice;
    this.onOpenSettings = callbacks.onOpenSettings;
    this.onToggleAudio = callbacks.onToggleAudio;
    this.onClearChat = callbacks.onClearChat;
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
        <div class="palette-drag-handle" title="Click & drag to reposition Screendial">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2" cy="3" r="1.5"></circle>
            <circle cx="8" cy="3" r="1.5"></circle>
            <circle cx="2" cy="8" r="1.5"></circle>
            <circle cx="8" cy="8" r="1.5"></circle>
            <circle cx="2" cy="13" r="1.5"></circle>
            <circle cx="8" cy="13" r="1.5"></circle>
          </svg>
        </div>

        <div class="palette-icon-brand status-idle" title="Screendial Assistant">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="none"></circle>
            <circle cx="12" cy="12" r="4" fill="white"></circle>
          </svg>
        </div>
        
        <textarea 
          class="palette-input" 
          placeholder="Ask Screendial for anything on your screen" 
          rows="1"
          spellcheck="false"
        ></textarea>

        <div class="palette-badges">
          <button class="voice-btn send-btn" title="Send Query">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>

          <button class="voice-btn clear-btn" title="Clear Conversation History">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>

          <button class="voice-btn" title="Toggle Voice Command">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>

          <button class="voice-btn audio-btn muted" title="Audio Output: Muted (Click to turn on)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          </button>

          <button class="voice-btn settings-btn" title="Settings & Screen Selection">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          <button class="voice-btn hide-btn" title="Hide / Minimize Window">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
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
    this.voiceButton = this.container.querySelector(".voice-btn:not(.clear-btn):not(.settings-btn):not(.send-btn):not(.audio-btn):not(.hide-btn)")!;
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

    this.container.querySelector(".settings-btn")?.addEventListener("click", () => {
      this.onOpenSettings();
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
    if (enabled) {
      this.audioButton.className = "voice-btn audio-btn active";
      this.audioButton.title = "Audio Output: On (Click to mute)";
      this.audioButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
    } else {
      this.audioButton.className = "voice-btn audio-btn muted";
      this.audioButton.title = "Audio Output: Muted (Click to turn on)";
      this.audioButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      `;
    }
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
