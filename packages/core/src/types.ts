import type { QrImageOptions, QrPngOptions } from './qr/image';

/** Identifiers of the built-in styles. */
export type QrCityStyleId = 'moderna' | 'costera' | 'ciberpunk' | 'nevada';

/** How the city is introduced: `door` (walk out of a door), `flyover` (the camera sweeps over the city) or `none`. */
export type QrCityIntro = 'door' | 'flyover' | 'none';

/**
 * Stages of the intros, in order for `'door'`:
 * `door` (idle, waiting to be opened) → `entering` (door opens, camera walks in) →
 * `threshold` (white screen; waits here when `pauseAtThreshold` is set) →
 * `flying` (leaves through the door, the camera rises) → `done` (the city). `'none'` starts at `done`;
 * `'flyover'` starts at `flying` (the camera sweeps over the city) and then goes to `done`.
 */
export type QrCityIntroStage = 'door' | 'entering' | 'threshold' | 'flying' | 'done';

/** `city`: isometric view · `qr`: top-down orthographic view where the QR can be scanned. */
export type QrCityView = 'city' | 'qr';

/** `auto` picks `low` on touch devices with small screens. */
export type QrCityQuality = 'auto' | 'high' | 'low' | 'ultra';

/** Time of day: `night` turns any style into its night version. */
export type QrCityTime = 'day' | 'night';

/** QR error-correction level. */
export type QrCityEcc = 'L' | 'M' | 'Q' | 'H';

/**
 * A plaza in the middle of the city with a picture (your logo) on its paving. The QR still scans:
 * the plaza covers part of the code and the high error correction (`'H'`, forced while the plaza is
 * on) rebuilds it.
 */
export interface QrCityPlaza {
  /**
   * Picture painted on the plaza, fitted inside it: a URL or a data URL. Other origins must allow
   * CORS. Transparent parts show the paving. So that a camera reads the plaza without doubt, its
   * colors are reduced to dark and light tones (hues are kept). Without an image: a compass rose in
   * the style's colors.
   */
  image?: string;
  /** Side of the plaza as a fraction of the code's side: 0.1–0.25. Default 0.2. */
  size?: number;
  /**
   * A light picture (a white logo) would vanish on the light paving. `'auto'` (default) turns a picture
   * whose visible part is mostly light into its negative; `true` always does and `false` never.
   */
  invert?: 'auto' | boolean;
}

/** Colors of the door scene and the small door in the city (CSS hex strings). */
export interface QrCityDoorTheme {
  /** Backdrop, fog, floor and lobby walls. */
  background: string;
  /** Color of the flash that covers the transitions. */
  veil: string;
  light: { sky: string; ground: string; intensity: number; sun: string; sunIntensity: number };
  frame: string;
  frameDark: string;
  panel: string;
  panelRaised: string;
  brass: string;
  /** Engraved mini QR: paper and ink. */
  plaque: { frame: string; paper: string; ink: string };
  step: string;
  mat: string;
  pot: string;
  plants: string[];
  /** Floating cubes around the door. */
  floaters: string[];
  /** Light behind the door. */
  glow: string;
  /** Warm light inside the lobby and the wall lamp. */
  warm: string;
  lobbyFloor: string;
}

/**
 * Style definition. Colors are CSS hex strings (`#rrggbb`) so styles are serializable.
 * Invariant for scannability: `palette.roof` must be dark and the ground tones light.
 */
export interface QrCityStyle {
  id: string;
  name: string;
  description: string;
  palette: {
    sky: string;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    sun: string;
    sunIntensity: number;
    /** Sidewalk / quiet zone (light). */
    walk: string;
    /** Ground inside the QR area (light). */
    ground: string;
    road: string;
    dash: string;
    /** Side of the city slab. */
    base: string;
    /** Flat, unlit rooftop color (dark): this is what makes the QR readable. */
    roof: string;
    towers: string[];
    houses: string[];
    /**
     * Sea around the city. Adds a beach, a lighthouse and boats. It begins beyond the beach (4.75 modules
     * from the code), which already gives the code its quiet zone, so it can be any blue you like.
     */
    water?: string;
    /** Fine grid painted on the ground. */
    grid?: string;
  };
  buildings: {
    /** Probability bias towards low houses (0–1). */
    houseBias: number;
    /** Probability bias towards skyscrapers (0–1). */
    skyBias: number;
    heightMul: number;
    windowColor: string;
    /** Glowing windows, cycling through these colors. */
    neon?: string[];
  };
  vegetation: { kind: 'round' | 'palm' | 'pine' | 'neon'; colors: string[] };
  /** `glow`: unlit, luminous cars. */
  traffic: { carColors: string[]; glow?: boolean };
  /** `gulls` are bigger birds; `snow` falls over the city. */
  flyers: { kind: 'birds' | 'gulls' | 'drones' | 'snow'; color: string };
  /** Light border around the QR, in modules (5–6). */
  quietZone: number;
  /**
   * Night rendering: a starry sky, and the ground dimmed while the city is seen from the side (it lights up
   * in the top-down view, so the code scans as ever). `time: 'night'` derives a full night style from any
   * style; set it yourself only on a style you made for the night.
   */
  night?: boolean;
  /** Door scene theme. Falls back to the `moderna` one. */
  door?: QrCityDoorTheme;
}

export interface QrCityOptions {
  /** Text or URL encoded in the QR. 1–300 characters. */
  data: string;
  /** Built-in style id or a custom style object. Default `'moderna'`. */
  style?: QrCityStyleId | QrCityStyle;
  /** Default `'none'`. Fixed at creation. */
  intro?: QrCityIntro;
  /** With `intro: 'door'`: stop at the white screen after the door until `continueIntro()`. Default `false`. */
  pauseAtThreshold?: boolean;
  /** Initial view. Default `'city'`. */
  view?: QrCityView;
  /** `'night'`: the same city after dark (stars, moonlight, windows lit). The QR scans the same. Default `'day'`. */
  time?: QrCityTime;
  /** Default `'M'`. Always `'H'` while `plaza` is on. */
  errorCorrection?: QrCityEcc;
  /** A plaza with your picture in the middle of the city. Default off. */
  plaza?: boolean | QrCityPlaza;
  /** Default `'auto'`. Antialiasing is decided at creation and cannot change later. */
  quality?: QrCityQuality;
  /** Clicking / pressing Enter or Space on the canvas toggles the view. Default `true`. */
  interactive?: boolean;
  /** `'auto'` honors `prefers-reduced-motion`. Default `'auto'`. */
  animate?: boolean | 'auto';
  /** Upper bound of the device pixel ratio. Default 2 (1 in `low` quality). */
  maxPixelRatio?: number;
  /** Pinch, drag to pan, and zoom buttons/keys on the city. Default `true`. */
  zoomable?: boolean;
  /** Maximum zoom factor (1 = the whole city in view). Default 8. */
  maxZoom?: number;
  /** `'ctrl'`: Ctrl/⌘ + wheel (and trackpad pinch) zoom, plain wheel scrolls the page. Default `'ctrl'`. */
  wheelZoom?: 'ctrl' | 'always' | 'off';
  /** CSS color, or `'transparent'`. Default: the style's sky color. */
  background?: string;
  /**
   * What to do when WebGL is not available. `'qr'` (default) shows a plain, scannable QR code with
   * the style's colors, so the person still gets a usable code; `'none'` throws instead.
   */
  fallback?: 'qr' | 'none';
  /** Accessible name of the canvas. Default `'QR code city'`. */
  label?: string;
  /** Accessible name of the canvas while the door is waiting to be opened. Default `'Open the door'`. */
  doorLabel?: string;
  /** The city is on screen: it finished building (or the door or flyover intro finished). */
  onReveal?: () => void;
  /** The door intro moved to another stage. */
  onIntroStage?: (stage: QrCityIntroStage) => void;
  onViewChange?: (view: QrCityView) => void;
  onZoomChange?: (zoom: number) => void;
  /**
   * WebGL is not available (or its context was lost for good) and the plain QR is being shown.
   * Without this callback a warning is logged to the console.
   */
  onFallback?: (reason: Error) => void;
  /** Runtime failures after creation (e.g. WebGL context lost). */
  onError?: (error: Error) => void;
}

export interface QrCityController {
  /** The WebGL canvas, or `null` while the plain-QR fallback is shown. */
  readonly canvas: HTMLCanvasElement | null;
  /** `true` while a plain QR is shown instead of the 3D city (no WebGL). Everything else keeps working as no-ops. */
  readonly fallback: boolean;
  readonly view: QrCityView;
  /** Current zoom target (1 = the whole city in view). */
  readonly zoom: number;
  /** Current intro stage (`'done'` when there is no intro or it already finished). */
  readonly stage: QrCityIntroStage;
  /** Starts the door animation (same as clicking the door). */
  openDoor(): void;
  /** From the `threshold` stage, leaves the door and flies to the city. */
  continueIntro(): void;
  /** Jumps to the final city, whatever the stage. */
  skipIntro(): void;
  /** Goes to the top-down view where the QR is readable. Same as `setView('qr')`. */
  reveal(): void;
  setView(view: QrCityView, opts?: { immediate?: boolean }): void;
  /** Zooms towards the center of the screen, or towards `at` (0–1 canvas coordinates). Clamped to `1…maxZoom`. */
  setZoom(zoom: number, opts?: { immediate?: boolean; at?: { x: number; y: number } }): void;
  zoomBy(factor: number, opts?: { at?: { x: number; y: number } }): void;
  /** Back to the whole city in view. */
  resetZoom(opts?: { immediate?: boolean }): void;
  toggleView(): void;
  setStyle(style: QrCityStyleId | QrCityStyle): void;
  /** Rebuilds the city only if `data`, `style`, `errorCorrection`, `quality` or `plaza` change. */
  update(next: Partial<QrCityOptions>): void;
  /** Renders a frame and encodes it. `scale` multiplies the current canvas resolution. In fallback mode it returns the plain QR. */
  toPNG(opts?: { scale?: number }): Promise<Blob>;
  /** The current code as a plain, print-ready SVG (black on white by default). Works in every mode. */
  toQrSvg(opts?: Omit<QrImageOptions, 'errorCorrection'>): string;
  /** The current code as a plain PNG. Works in every mode. */
  toQrPng(opts?: Omit<QrPngOptions, 'errorCorrection'>): Promise<Blob>;
  play(): void;
  pause(): void;
  resize(): void;
  /** Releases GPU resources, listeners, the render loop and the canvas. Idempotent. */
  dispose(): void;
}
