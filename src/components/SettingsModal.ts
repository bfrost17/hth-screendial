export interface MonitorOption {
  index: number;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
}

export class SettingsModalComponent {
  private backdrop: HTMLElement;
  private inputKey: HTMLInputElement;
  private inputModel: HTMLInputElement;
  private monitorsListContainer: HTMLElement;
  private onSave: (key: string, model: string) => void;

  constructor(callbacks: { onSave: (key: string, model: string) => void }) {
    this.onSave = callbacks.onSave;

    this.backdrop = document.createElement("div");
    this.backdrop.className = "modal-backdrop";
    this.backdrop.innerHTML = `
      <div class="glass-panel modal-box">
        <h3 style="font-size: 18px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px;">
          <span>Screendial Settings</span>
        </h3>

        <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
          Configure your <strong>Google Gemini API Key</strong> and view detected displays.
        </p>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">
            DETECTED DISPLAYS (All screens captured & monitored simultaneously)
          </label>
          <div class="monitors-list-display" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-main);">
            <div style="padding: 8px 12px; background: rgba(255,255,255,0.06); border-radius: 8px;">Screen 0 (Primary)</div>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">
            GEMINI API KEY
          </label>
          <input 
            type="password" 
            class="modal-input input-api-key" 
            placeholder="AIzaSy..." 
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">
            AI MODEL
          </label>
          <input 
            type="text" 
            class="modal-input input-model-name" 
            placeholder="gemini-3.5-flash" 
            value="gemini-3.5-flash"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
          <button class="modal-btn modal-btn-secondary close-btn">Cancel</button>
          <button class="modal-btn modal-btn-primary save-btn">Save Settings</button>
        </div>
      </div>
    `;

    this.inputKey = this.backdrop.querySelector(".input-api-key")!;
    this.inputModel = this.backdrop.querySelector(".input-model-name")!;
    this.monitorsListContainer = this.backdrop.querySelector(".monitors-list-display")!;
    this.attachEvents();
  }

  private attachEvents() {
    this.backdrop.querySelector(".close-btn")?.addEventListener("click", () => {
      this.hide();
    });

    this.backdrop.querySelector(".save-btn")?.addEventListener("click", () => {
      const key = this.inputKey.value.trim();
      const model = this.inputModel.value.trim() || "gemini-3.5-flash";
      if (key) {
        this.onSave(key, model);
        this.hide();
      }
    });

    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) {
        this.hide();
      }
    });
  }

  public show(
    currentKey: string = "",
    currentModel: string = "gemini-3.5-flash",
    monitors: MonitorOption[] = []
  ) {
    this.inputKey.value = currentKey;
    this.inputModel.value = currentModel || "gemini-3.5-flash";

    // Populate monitors list
    if (monitors.length > 0) {
      this.monitorsListContainer.innerHTML = monitors
        .map((m) => {
          const badge = m.is_primary
            ? `<span style="background: rgba(0, 240, 255, 0.2); color: var(--cyan); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">Primary</span>`
            : `<span style="background: rgba(255, 255, 255, 0.1); color: var(--text-muted); padding: 2px 6px; border-radius: 4px; font-size: 10px;">Secondary</span>`;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="color: white;">Screen ID ${m.index}:</strong>
                <span>${m.name} (${m.width}x${m.height})</span>
              </div>
              ${badge}
            </div>
          `;
        })
        .join("");
    } else {
      this.monitorsListContainer.innerHTML = `
        <div style="padding: 8px 12px; background: rgba(255,255,255,0.06); border-radius: 8px; color: var(--text-muted);">
          1 Display detected (Screen ID 0)
        </div>
      `;
    }

    this.backdrop.classList.add("visible");
    setTimeout(() => this.inputKey.focus(), 50);
  }

  public hide() {
    this.backdrop.classList.remove("visible");
  }

  public getElement(): HTMLElement {
    return this.backdrop;
  }
}
