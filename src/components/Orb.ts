export type OrbState = "idle" | "listening" | "processing" | "guiding";

export class OrbComponent {
  private container: HTMLElement;
  private state: OrbState = "idle";
  private onTriggerPrompt: () => void;
  private onToggleVoice: () => void;

  constructor(callbacks: { onTriggerPrompt: () => void; onToggleVoice: () => void }) {
    this.onTriggerPrompt = callbacks.onTriggerPrompt;
    this.onToggleVoice = callbacks.onToggleVoice;

    this.container = document.createElement("div");
    this.container.className = "screendial-orb interactive";
    this.container.title = "Screendial Assistive Orb (Click: Prompt | Right-Click: Voice)";
    this.render();
    this.attachEvents();
  }

  private render() {
    this.container.innerHTML = `
      <div class="orb-ring"></div>
      <svg class="orb-inner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
  }

  private attachEvents() {
    this.container.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onTriggerPrompt();
    });

    this.container.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onToggleVoice();
    });
  }

  public setState(newState: OrbState) {
    this.state = newState;
    this.container.className = `screendial-orb interactive state-${newState}`;
  }

  public getState(): OrbState {
    return this.state;
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
