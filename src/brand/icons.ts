/**
 * Plain line icons for the command palette's toolbar buttons. Replaces the retro pixel-art
 * set (pixel-icons.ts) with normal, single-weight strokes that scale cleanly at any size.
 */

export type IconName = "trash" | "mic" | "volume" | "volume-off" | "logout" | "minimize";

const PATHS: Record<IconName, string> = {
  trash: `<path d="M4 6h16" /><path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" /><path d="M6.5 6.5 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.5" /><path d="M10.2 10.5v6" /><path d="M13.8 10.5v6" />`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /><path d="M8.5 21h7" />`,
  volume: `<path d="M4 9.5v5h3.6L13 18.5v-13L7.6 9.5H4Z" /><path d="M16.2 9a5 5 0 0 1 0 6" /><path d="M18.6 6.6a8.5 8.5 0 0 1 0 10.8" />`,
  "volume-off": `<path d="M4 9.5v5h3.6L13 18.5v-13L7.6 9.5H4Z" /><path d="M16.5 10 20 13.5" /><path d="M20 10 16.5 13.5" />`,
  logout: `<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M15 16l4-4-4-4" /><path d="M19 12H9" />`,
  minimize: `<path d="M5 12h14" />`,
};

export function icon(name: IconName): string {
  return `<svg class="icon-svg icon-svg--${name}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
