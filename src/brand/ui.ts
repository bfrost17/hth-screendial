export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The Screendial logo, the S° mark (public/brand). Wrapped so hosts can hang state
 * (working / listening) off .brand-mark: see brand.css.
 */
const LOGO_RATIO = 213 / 256;
export function logo(height: number): string {
  const width = Math.round(height * LOGO_RATIO);
  return `<span class="brand-mark" aria-hidden="true"><img class="logo" src="/brand/screendial-logo.png" width="${width}" height="${height}" alt="" draggable="false" /></span>`;
}

/** Tape counter "HH:MM:SS:FF", counting up from zero. Returns a stop function. */
export function startTimecode(el: HTMLElement, offsetSeconds = 0): () => void {
  const start = performance.now() - offsetSeconds * 1000;
  const pad = (n: number) => String(n).padStart(2, "0");
  // one fixed-width cell per digit (see .tc-d): the display face has no tabular figures
  el.innerHTML = Array.from({ length: 4 }, () => `<span class="tc-d"></span><span class="tc-d"></span>`).join(`<span class="tc-sep">:</span>`);
  const cells = Array.from(el.querySelectorAll<HTMLElement>(".tc-d"));
  const tick = () => {
    const ms = performance.now() - start;
    const s = Math.floor(ms / 1000);
    const digits = pad(Math.floor(s / 3600)) + pad(Math.floor(s / 60) % 60) + pad(s % 60) + pad(Math.floor((ms % 1000) / 33.4));
    cells.forEach((cell, i) => {
      if (cell.textContent !== digits[i]) cell.textContent = digits[i];
    });
  };
  tick();
  const id = window.setInterval(tick, prefersReducedMotion() ? 1000 : 1000 / 30);
  return () => window.clearInterval(id);
}

/** The dashboard's line arrow, for buttons: a hairline shaft and an open head. */
export const lineArrow = `<svg class="line-arrow" width="26" height="10" viewBox="0 0 26 10" aria-hidden="true"><path d="M1 5h23M20 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

/** The same arrow, heavier, for pointing at a target on screen. Points right. */
export const pointerArrow = `<svg class="hl-arrow-art" width="36" height="16" viewBox="0 0 36 16" aria-hidden="true"><path d="M1 8h32M26 1.5L33 8l-7 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
