/**
 * Toolbar icons for the command palette.
 *
 * Pixel art rebuilt from styling-assets/navbar at each icon's native grid (the sources are
 * smoothed upscales at mixed scales). Every icon is drawn at the same size per art pixel,
 * ART_PX, so the set reads as one family whatever each grid's resolution. The files are
 * block-upscaled 4x masters; the browser downsamples them smoothly, which keeps the art
 * pixels square with only their edges anti-aliased at this non-integer scale. The set's
 * missing members (hide, logout) were drawn to the same grey ramp and top-left light.
 */

/** CSS px per art pixel, shared by the whole set (~16-23px icons in 36px buttons). */
const ART_PX = 0.72;

export type PixelIconName = "trash" | "mic" | "sound-on" | "sound-off" | "hide" | "logout";

/** Native grid size of each icon, in art pixels. */
const GRID: Record<PixelIconName, [number, number]> = {
  trash: [22, 32],
  mic: [18, 26],
  "sound-on": [26, 24],
  "sound-off": [26, 24],
  hide: [22, 8],
  logout: [26, 24],
};

const px = (cells: number) => Math.round(cells * ART_PX * 2) / 2; // to the half pixel

export function pixelIcon(name: PixelIconName): string {
  const [w, h] = GRID[name];
  return `<img class="px-icon px-icon--${name}" src="/icons/${name}.png" width="${px(w)}" height="${px(h)}" alt="" draggable="false" />`;
}
