/**
 * BarPicture — the WebGL tape plus Vanta's waves behind the command palette.
 *
 * The host needs a `.bar-scrim` child (the waves slot in under it) and should clip to its
 * shape. The picture only runs while the bar is active: the overlay hides its palette with
 * `visibility`, which IntersectionObserver still counts as on-screen, so without this it
 * would keep two WebGL layers rendering over the desktop the whole time the palette is
 * closed. Deactivating hands the tape's compiled context back to the pool (reopening costs
 * no recompile) and parks the waves' renderer.
 */
import { acquireTape, TapeCanvas, TapeVariant } from "./vhs";
import { mountWaves, WavesHandle, WavesOptions } from "./waves";

const FX_KEY = "screendial_dashboard_fx"; // "Reduce VHS effects" level (0..1)

/** The stored effects level (0..1); full strength when unset. */
export function storedFx(): number {
  try {
    return Number(localStorage.getItem(FX_KEY)) || 1;
  } catch {
    return 1;
  }
}

export interface BarPicture {
  setActive(active: boolean): void;
  destroy(): void;
}

// Calmer tape than the hero (the bar carries text), but livelier waves: in a 60px strip
// the hero's slow, large swell barely registers. So they run ~2.6x faster, the camera
// pulls back to fit more, smaller facets into the strip, and the mesh takes the palette's
// brighter electric blue, at full strength. The pointer pans the waves (no dolly: the
// framing holds) and pulls the tape's glow along the bar, both eased quickly enough to
// read as a response rather than drift.
const TAPE_INTENSITY = 0.35;
const TAPE_POINTER = { pointerFollow: 0.35, pointerEase: 0.12 };
const WAVES_STRENGTH = 0.85;
const WAVES: WavesOptions = {
  minHeight: 1,
  speed: 2.6,
  zoom: 0.42,
  color: 0x2f6bff, // --electric
  pointer: { pan: 150, tilt: 16, ease: 0.08 },
};

export interface BarPictureOptions {
  variant?: TapeVariant;
  fx?: () => number;
  active?: boolean;
  /** Tape signal strength before the effects level (default 0.35). */
  intensity?: number;
  /** Overrides for the waves layer (merged over the bar's). */
  waves?: Partial<WavesOptions>;
  /** Waves opacity, 0..1 (default 1). */
  wavesStrength?: number;
}

export function mountBarPicture(host: HTMLElement, options: BarPictureOptions = {}): BarPicture {
  const variant = options.variant ?? "broadcast";
  const fx = options.fx ?? storedFx;
  const wavesOptions: WavesOptions = { ...WAVES, ...options.waves };
  const baseIntensity = options.intensity ?? TAPE_INTENSITY;

  let tape: TapeCanvas | null = null;
  let waves: WavesHandle | null = null;
  let active = false;

  const intensity = () => baseIntensity * fx();

  const setActive = (next: boolean) => {
    if (next === active) return;
    active = next;
    if (active) {
      tape = acquireTape(host, { variant, intensity: intensity(), pixelRatio: 1, fps: 30, ...TAPE_POINTER });
      // the waves' three.js chunk only loads the first time a bar opens
      waves ??= mountWaves(host, variant, options.wavesStrength ?? WAVES_STRENGTH, () => fx() >= 1, wavesOptions);
      waves.setPaused(false);
    } else {
      tape?.release();
      tape = null;
      waves?.setPaused(true);
    }
  };

  // A storage write to the effects level re-announces itself as screendial:fx, which the
  // waves also listen for.
  const onFx = () => tape?.setIntensity(intensity());
  const onStorage = (e: StorageEvent) => {
    if (e.key === FX_KEY) window.dispatchEvent(new Event("screendial:fx"));
  };
  window.addEventListener("screendial:fx", onFx);
  window.addEventListener("storage", onStorage);

  setActive(options.active ?? true);

  return {
    setActive,
    destroy() {
      window.removeEventListener("screendial:fx", onFx);
      window.removeEventListener("storage", onStorage);
      tape?.release();
      tape = null;
      waves?.();
      waves = null;
    },
  };
}
