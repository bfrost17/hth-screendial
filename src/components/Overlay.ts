import { marked } from "marked";
import { HighlightElementArgs, ShowOutputWidgetArgs } from "../tools/types";
import { pointerArrow, startTimecode } from "../brand/ui";

const COPY_ICON_SVG = `<svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON_SVG = `<svg class="check-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const CLOSE_ICON_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7"></path></svg>`;
const DRAG_GRIP_SVG = `<svg class="drag-grip" width="8" height="14" viewBox="0 0 8 14" fill="currentColor"><circle cx="2" cy="2" r="1.2"></circle><circle cx="6" cy="2" r="1.2"></circle><circle cx="2" cy="7" r="1.2"></circle><circle cx="6" cy="7" r="1.2"></circle><circle cx="2" cy="12" r="1.2"></circle><circle cx="6" cy="12" r="1.2"></circle></svg>`;

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content, { gfm: true, breaks: true, async: false }) as string;
  } catch (err) {
    console.warn("[Screendial] Markdown parse error:", err);
    return escapeHtml(content);
  }
}

function setupCopyButton(btn: HTMLElement, textProvider: () => string) {
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      const text = textProvider();
      await navigator.clipboard.writeText(text);
      btn.classList.add("copied");
      btn.innerHTML = `${CHECK_ICON_SVG}<span class="copy-label">Copied</span>`;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = `${COPY_ICON_SVG}<span class="copy-label">Copy</span>`;
      }, 1500);
    } catch (err) {
      console.error("[Screendial] Clipboard copy failed:", err);
    }
  });
}

export class OverlayComponent {
  private container: HTMLElement;
  private scanContainer: HTMLElement;
  private highlightsContainer: HTMLElement;
  private widgetsContainer: HTMLElement;
  private stopScanClocks: Array<() => void> = [];
  private onDismissAndReset?: () => void;
  private desktopLayout: any = null;

  constructor(callbacks?: { onDismissAndReset?: () => void }) {
    this.onDismissAndReset = callbacks?.onDismissAndReset;

    this.container = document.createElement("div");
    this.container.id = "screendial-overlay-layer";
    this.container.style.cssText = "position: absolute; inset: 0; pointer-events: none;";

    // Viewfinder shown while the model reads the screens; outside clear()'s reach
    this.scanContainer = document.createElement("div");
    this.scanContainer.className = "scan-layer";

    this.highlightsContainer = document.createElement("div");
    this.highlightsContainer.style.cssText = "position: absolute; inset: 0; pointer-events: none;";

    this.widgetsContainer = document.createElement("div");
    this.widgetsContainer.className = "output-widget-container interactive";

    this.container.appendChild(this.scanContainer);
    this.container.appendChild(this.highlightsContainer);
    this.container.appendChild(this.widgetsContainer);
  }

  public setOnDismissAndReset(cb: () => void) {
    this.onDismissAndReset = cb;
  }

  public hasActiveOverlays(): boolean {
    return (
      this.highlightsContainer.children.length > 0 ||
      this.widgetsContainer.children.length > 0
    );
  }

  public showStatus(
    _text: string,
    _showSpinner: boolean = true,
    _id: string = "default",
    _durationMs?: number
  ) {
    // Status log removed as requested
  }

  public hideStatus(_id?: string) {
    // Status log removed as requested
  }

  public clear() {
    this.highlightsContainer.innerHTML = "";
    this.widgetsContainer.innerHTML = "";
  }

  public setLayout(layout: any) {
    this.desktopLayout = layout;
  }

  /**
   * Camcorder viewfinder over every monitor while the model reads the screens: corner
   * brackets, a REC light, the screen's name, what the agent is doing and a tape counter.
   * Call after the capture: this window is in the screenshots.
   */
  public showScanning(stateText: string = "Reading screen") {
    this.hideScanning();

    const layout = this.desktopLayout;
    const monitors: any[] = layout?.monitors?.length
      ? layout.monitors
      : [{ id: 0, logical_x: 0, logical_y: 0, logical_width: window.innerWidth, logical_height: window.innerHeight }];

    monitors.forEach((mon, i) => {
      const vf = document.createElement("div");
      vf.className = "vf vf--scan";
      vf.style.left = `${mon.logical_x - (layout?.virtual_x ?? 0)}px`;
      vf.style.top = `${mon.logical_y - (layout?.virtual_y ?? 0)}px`;
      vf.style.width = `${mon.logical_width}px`;
      vf.style.height = `${mon.logical_height}px`;
      vf.innerHTML = `
        <span class="vf-frame"></span>
        <span class="vf-label vf-tl"><span class="vf-rec-dot"></span>REC</span>
        <span class="vf-label vf-tr">SCREEN ${i + 1}</span>
        <span class="vf-label vf-bl"><span class="vf-state"></span></span>
        <span class="vf-label vf-br"><span class="vf-tc"></span></span>
      `;
      (vf.querySelector(".vf-state") as HTMLElement).textContent = stateText;
      this.stopScanClocks.push(startTimecode(vf.querySelector(".vf-tc") as HTMLElement));
      this.scanContainer.appendChild(vf);
    });
  }

  public hideScanning() {
    this.stopScanClocks.forEach((stop) => stop());
    this.stopScanClocks = [];
    this.scanContainer.innerHTML = "";
  }

  /**
   * Renders a standalone output callout bubble (e.g. for general answers/guidance).
   */
  public renderCallout(args: { label?: string; text: string; screen_id?: string | number }, layout?: any) {
    const bubble = document.createElement("div");
    bubble.className = "callout-bubble interactive";

    let bubbleWidth = 420;
    let bubbleLeft = Math.max(20, Math.round((window.innerWidth - bubbleWidth) / 2));
    let bubbleTop = 155;

    const usedLayout = layout || this.desktopLayout;
    if (usedLayout) {
      const screenId = args.screen_id !== undefined ? args.screen_id.toString() : "0";
      const mon = usedLayout.monitors.find((m: any) => m.id.toString() === screenId) || usedLayout.monitors[0];
      if (mon) {
        bubbleLeft = (mon.logical_x - usedLayout.virtual_x) + (mon.logical_width / 2) - (bubbleWidth / 2);
        bubbleTop = (mon.logical_y - usedLayout.virtual_y) + 155;
      }
    }

    bubble.style.left = `${bubbleLeft}px`;
    bubble.style.top = `${bubbleTop}px`;
    bubble.style.width = `${bubbleWidth}px`;

    const label = args.label || "Screendial Guidance";

    bubble.innerHTML = `
      <div class="callout-header">
        <div class="callout-drag-handle" title="Drag to reposition">
          ${DRAG_GRIP_SVG}
          <span class="callout-dot" aria-hidden="true"></span>
          <span class="callout-label">${escapeHtml(label)}</span>
        </div>
        <div class="callout-header-actions">
          <button class="callout-action-btn callout-copy-btn" title="Copy text to clipboard">
            ${COPY_ICON_SVG}
            <span class="copy-label">Copy</span>
          </button>
          <button class="callout-close" title="Close and Reset to Input">${CLOSE_ICON_SVG}</button>
        </div>
      </div>
      <div class="callout-text">${renderMarkdown(args.text)}</div>
    `;

    bubble.querySelector(".callout-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.clear();
      if (this.onDismissAndReset) {
        this.onDismissAndReset();
      }
    });

    const copyBtn = bubble.querySelector(".callout-copy-btn") as HTMLElement;
    if (copyBtn) {
      setupCopyButton(copyBtn, () => args.text);
    }

    makeDraggable(bubble);
    this.highlightsContainer.appendChild(bubble);
  }

  public renderHighlight(target: HighlightElementArgs, layout?: any) {
    const usedLayout = layout || this.desktopLayout;
    if (!usedLayout) return;

    const screenId = target.screen_id !== undefined ? target.screen_id.toString() : "0";
    const mon = usedLayout.monitors.find((m: any) => m.id.toString() === screenId) || usedLayout.monitors[0];
    if (!mon) return;

    const [ymin, xmin, ymax, xmax] = target.box_2d;

    const rawWidth = ((xmax - xmin) / 1000.0) * mon.logical_width;
    const rawHeight = ((ymax - ymin) / 1000.0) * mon.logical_height;
    const width = Math.max(24, Math.round(rawWidth));
    const height = Math.max(24, Math.round(rawHeight));

    const monLocalX = Math.round((xmin / 1000.0) * mon.logical_width);
    const monLocalY = Math.round((ymin / 1000.0) * mon.logical_height);

    const x = (mon.logical_x - usedLayout.virtual_x) + monLocalX;
    const y = (mon.logical_y - usedLayout.virtual_y) + monLocalY;

    // 1. Draw Bounding Box (Clean glowing outline)
    const box = document.createElement("div");
    box.className = "highlight-box";
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.setProperty("--hl-h", `${height}px`); // how far the scan line travels
    // four brackets that fly in and lock onto the target (overlay-vhs.css)
    box.innerHTML = `<i class="hl-corner hl-tl"></i><i class="hl-corner hl-tr"></i><i class="hl-corner hl-bl"></i><i class="hl-corner hl-br"></i>`;

    // 2. Draw Anchored Callout Bubble (Draggable)
    const bubble = document.createElement("div");
    bubble.className = "callout-bubble interactive";

    // Place bubble above or below box based on available screen space
    let bubbleX = Math.max((mon.logical_x - usedLayout.virtual_x) + 20, Math.min(x, (mon.logical_x - usedLayout.virtual_x) + mon.logical_width - 420));
    let bubbleY = y + height + 16;
    if (bubbleY + 180 > (mon.logical_y - usedLayout.virtual_y) + mon.logical_height) {
      bubbleY = Math.max((mon.logical_y - usedLayout.virtual_y) + 20, y - 180);
    }
    
    bubbleX = Math.max((mon.logical_x - usedLayout.virtual_x) + 10, Math.min((mon.logical_x - usedLayout.virtual_x) + mon.logical_width - 420, bubbleX));
    bubbleY = Math.max((mon.logical_y - usedLayout.virtual_y) + 10, Math.min((mon.logical_y - usedLayout.virtual_y) + mon.logical_height - 160, bubbleY));

    bubble.style.left = `${bubbleX}px`;
    bubble.style.top = `${bubbleY}px`;

    bubble.innerHTML = `
      <div class="callout-header">
        <div class="callout-drag-handle" title="Drag to reposition">
          ${DRAG_GRIP_SVG}
          <span class="callout-dot" aria-hidden="true"></span>
          <span class="callout-label">${escapeHtml(target.label)}</span>
        </div>
        <div class="callout-header-actions">
          <button class="callout-action-btn callout-copy-btn" title="Copy text to clipboard">
            ${COPY_ICON_SVG}
            <span class="copy-label">Copy</span>
          </button>
          <button class="callout-close" title="Close and Reset to Input">${CLOSE_ICON_SVG}</button>
        </div>
      </div>
      <div class="callout-text">${renderMarkdown(target.explanation)}</div>
    `;

    bubble.querySelector(".callout-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.clear();
      if (this.onDismissAndReset) {
        this.onDismissAndReset();
      }
    });

    const copyBtn = bubble.querySelector(".callout-copy-btn") as HTMLElement;
    if (copyBtn) {
      setupCopyButton(copyBtn, () => target.explanation);
    }

    makeDraggable(bubble);

    // Arrow beside the target, on whichever side has room, nudging toward it
    const monLeft = mon.logical_x - usedLayout.virtual_x;
    const monRight = monLeft + mon.logical_width;
    const side = x - 60 >= monLeft || x + width + 60 > monRight ? "left" : "right";
    const arrow = document.createElement("div");
    arrow.className = `hl-arrow hl-arrow--${side}`;
    arrow.innerHTML = pointerArrow;
    arrow.style.left = `${side === "left" ? x - 14 - 36 : x + width + 14}px`;
    arrow.style.top = `${Math.round(y + height / 2 - 8)}px`;

    this.highlightsContainer.appendChild(box);
    this.highlightsContainer.appendChild(arrow);
    this.highlightsContainer.appendChild(bubble);

    // The placement above assumes 420px; the bubble can run wider. Keep it on its monitor.
    const monRightEdge = monLeft + mon.logical_width - 10;
    const bubbleRight = bubbleX + bubble.offsetWidth;
    if (bubbleRight > monRightEdge) {
      bubble.style.left = `${Math.max(monLeft + 10, monRightEdge - bubble.offsetWidth)}px`;
    }
  }

  public renderWidget(widget: ShowOutputWidgetArgs, onActionClick?: (shortcut?: string[]) => void, layout?: any) {
    const card = document.createElement("div");
    card.className = "glass-panel widget-card";

    let contentHtml = `
      <div class="widget-title">
        <div class="widget-drag-area" title="Drag to reposition">
          ${DRAG_GRIP_SVG}
          <span class="widget-title-text">${escapeHtml(widget.title)}</span>
        </div>
        <div class="callout-header-actions">
          <button class="callout-action-btn widget-copy-btn" title="Copy content to clipboard">
            ${COPY_ICON_SVG}
            <span class="copy-label">Copy</span>
          </button>
          <button class="callout-close widget-close" title="Close and Reset to Input">${CLOSE_ICON_SVG}</button>
        </div>
      </div>
    `;

    if (widget.items && widget.items.length > 0) {
      contentHtml += `<div class="checklist-items">`;
      for (const item of widget.items) {
        contentHtml += `
          <label class="checklist-item">
            <input type="checkbox" />
            <span>${renderMarkdown(item)}</span>
          </label>
        `;
      }
      contentHtml += `</div>`;
    }

    if (widget.code) {
      contentHtml += `
        <pre class="widget-code"><code>${escapeHtml(widget.code)}</code></pre>
      `;
    }

    if (widget.action_buttons && widget.action_buttons.length > 0) {
      contentHtml += `<div class="widget-actions">`;
      for (const btn of widget.action_buttons) {
        const shortcutTag = btn.shortcut ? `<kbd>${btn.shortcut.join("+")}</kbd>` : "";
        contentHtml += `
          <button class="action-chip-btn" data-shortcut="${(btn.shortcut || []).join(",")}">
            <span>${escapeHtml(btn.label)}</span>
            ${shortcutTag}
          </button>
        `;
      }
      contentHtml += `</div>`;
    }

    card.innerHTML = contentHtml;

    // Attach click listener to widget close button
    card.querySelector(".widget-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.clear();
      if (this.onDismissAndReset) {
        this.onDismissAndReset();
      }
    });

    // Attach click listener to widget copy button
    const widgetCopyBtn = card.querySelector(".widget-copy-btn") as HTMLElement;
    if (widgetCopyBtn) {
      setupCopyButton(widgetCopyBtn, () => {
        const parts: string[] = [widget.title];
        if (widget.items && widget.items.length > 0) {
          parts.push(widget.items.map((it: string) => `- ${it}`).join("\n"));
        }
        if (widget.code) {
          parts.push(`\`\`\`\n${widget.code}\n\`\`\``);
        }
        return parts.join("\n\n");
      });
    }

    // Attach click listeners to action buttons
    card.querySelectorAll(".action-chip-btn").forEach((btnElement) => {
      btnElement.addEventListener("click", () => {
        const shortcutAttr = btnElement.getAttribute("data-shortcut");
        const shortcuts = shortcutAttr ? shortcutAttr.split(",").filter(Boolean) : undefined;
        if (onActionClick) onActionClick(shortcuts);
      });
    });

    // Position widget on correct monitor
    const usedLayout = layout || this.desktopLayout;
    if (usedLayout) {
      const screenId = widget.screen_id !== undefined ? widget.screen_id.toString() : "0";
      const mon = usedLayout.monitors.find((m: any) => m.id.toString() === screenId) || usedLayout.monitors[0];
      if (mon) {
        this.widgetsContainer.style.position = "absolute";
        this.widgetsContainer.style.left = `${(mon.logical_x - usedLayout.virtual_x) + 40}px`;
        this.widgetsContainer.style.top = `${(mon.logical_y - usedLayout.virtual_y) + mon.logical_height - 400}px`;
      }
    }

    this.widgetsContainer.appendChild(card);
    makeDraggable(this.widgetsContainer);
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}

function makeDraggable(element: HTMLElement) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  element.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;

    // Don't start drag if clicking interactive controls or selectable text areas
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("code") ||
      target.closest("pre") ||
      target.closest(".callout-text") ||
      target.closest(".callout-action-btn") ||
      target.closest(".checklist-items") ||
      target.closest(".action-chip-btn")
    ) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = element.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    element.style.position = "fixed";
    element.style.bottom = "auto";
    element.style.right = "auto";
    element.style.left = `${initialLeft}px`;
    element.style.top = `${initialTop}px`;
    element.classList.add("dragging");

    e.preventDefault();
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    const rect = element.getBoundingClientRect();
    newLeft = Math.max(10, Math.min(window.innerWidth - rect.width - 10, newLeft));
    newTop = Math.max(10, Math.min(window.innerHeight - rect.height - 10, newTop));

    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      element.classList.remove("dragging");
    }
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}
