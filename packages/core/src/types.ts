/** Identifiers of the built-in styles. Phase 1 ships `moderna` only. */
export type QrCityStyleId = 'moderna';

/** How the city is introduced. Only `'none'` is implemented for now. */
export type QrCityIntro = 'door' | 'flyover' | 'none';

/** `city`: isometric view · `qr`: top-down orthographic view where the QR can be scanned. */
export type QrCityView = 'city' | 'qr';

/** `auto` picks `low` on touch devices with small screens. */
export type QrCityQuality = 'auto' | 'high' | 'low';

/** QR error-correction level. */
export type QrCityEcc = 'L' | 'M' | 'Q' | 'H';

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
  };
  buildings: {
    /** Probability bias towards low houses (0–1). */
    houseBias: number;
    /** Probability bias towards skyscrapers (0–1). */
    skyBias: number;
    heightMul: number;
    windowColor: string;
  };
  vegetation: { kind: 'round'; colors: string[] };
  traffic: { carColors: string[]; glow?: boolean };
  flyers: { kind: 'birds'; color: string };
  /** Light border around the QR, in modules (5–6). */
  quietZone: number;
}

export interface QrCityOptions {
  /** Text or URL encoded in the QR. 1–300 characters. */
  data: string;
  /** Built-in style id or a custom style object. Default `'moderna'`. */
  style?: QrCityStyleId | QrCityStyle;
  /** Default `'none'`. */
  intro?: QrCityIntro;
  /** Initial view. Default `'city'`. */
  view?: QrCityView;
  /** Default `'M'`. */
  errorCorrection?: QrCityEcc;
  /** Default `'auto'`. Antialiasing is decided at creation and cannot change later. */
  quality?: QrCityQuality;
  /** Clicking / pressing Enter or Space on the canvas toggles the view. Default `true`. */
  interactive?: boolean;
  /** `'auto'` honors `prefers-reduced-motion`. Default `'auto'`. */
  animate?: boolean | 'auto';
  /** Upper bound of the device pixel ratio. Default 2 (1 in `low` quality). */
  maxPixelRatio?: number;
  /** CSS color, or `'transparent'`. Default: the style's sky color. */
  background?: string;
  /** Accessible name of the canvas. Default `'QR code city'`. */
  label?: string;
  /** The city finished building and is on screen. */
  onReveal?: () => void;
  onViewChange?: (view: QrCityView) => void;
  /** Runtime failures after creation (e.g. WebGL context lost). */
  onError?: (error: Error) => void;
}

export interface QrCityController {
  readonly canvas: HTMLCanvasElement;
  readonly view: QrCityView;
  /** Goes to the top-down view where the QR is readable. Same as `setView('qr')`. */
  reveal(): void;
  setView(view: QrCityView, opts?: { immediate?: boolean }): void;
  toggleView(): void;
  setStyle(style: QrCityStyleId | QrCityStyle): void;
  /** Rebuilds the city only if `data`, `style`, `errorCorrection` or `quality` change. */
  update(next: Partial<QrCityOptions>): void;
  /** Renders a frame and encodes it. `scale` multiplies the current canvas resolution. */
  toPNG(opts?: { scale?: number }): Promise<Blob>;
  play(): void;
  pause(): void;
  resize(): void;
  /** Releases GPU resources, listeners, the render loop and the canvas. Idempotent. */
  dispose(): void;
}
