/** A measuring window closes after this many frames… */
const WINDOW_FRAMES = 60;
/** …or after this long, whichever comes first (a very slow device would take minutes otherwise). */
const WINDOW_MS = 2000;
/** Time ignored after starting or after a step down (shaders compile, textures upload). */
const WARMUP_MS = 1500;
/** Median frame time (ms) above which a window counts as slow: under ~30 fps. */
const SLOW_MS = 34;
/** Longer gaps are a hidden tab or the page being in the background, not the device's pace. */
const AWAY_MS = 2000;

export interface Governor {
  /** One frame interval in ms. `true` when the device has been too slow for two windows in a row: step down. */
  sample(ms: number): boolean;
  /** Starts measuring again from scratch (after a step down, a rebuild or a resize). */
  reset(): void;
}

/**
 * Watches the frame rate and says when to lower the quality. Conservative on purpose: it needs two
 * slow windows in a row, and it never steps back up (no flicker, no heating the phone up again).
 */
export function createGovernor(): Governor {
  let warm = 0;
  let frames: number[] = [];
  let spent = 0;
  let strikes = 0;
  const reset = () => {
    warm = 0;
    frames = [];
    spent = 0;
    strikes = 0;
  };
  return {
    sample(ms) {
      if (!(ms > 0) || ms > AWAY_MS) return false;
      if (warm < WARMUP_MS) { warm += ms; return false; }
      frames.push(ms);
      spent += ms;
      if (frames.length < WINDOW_FRAMES && (spent < WINDOW_MS || frames.length < 3)) return false;
      const median = [...frames].sort((a, b) => a - b)[frames.length >> 1];
      frames = [];
      spent = 0;
      strikes = median > SLOW_MS ? strikes + 1 : 0;
      if (strikes < 2) return false;
      reset();
      return true;
    },
    reset,
  };
}
