import type { QrCityDoorTheme, QrCityStyle } from '../types';
import { moderna } from './moderna';

/** `#rrggbb` mixed towards another (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number): string {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const NIGHT_BLUE = '#141a3a';
/** Warm light behind the windows: each tower cycles through these. */
const WARM_WINDOWS = ['#ffb347', '#ffd27a', '#ffa63d', '#ffe08f'];

function nightDoor(d: QrCityDoorTheme): QrCityDoorTheme {
  return {
    ...d,
    background: '#171b33',
    veil: '#0d1022',
    // A lantern by the door: warm light from the front over a cool, dim night
    light: { sky: '#7280c4', ground: '#2c3152', intensity: 0.85, sun: '#ffd9a8', sunIntensity: 0.55 },
    step: mix(d.step, NIGHT_BLUE, 0.55),
    mat: mix(d.mat, NIGHT_BLUE, 0.5),
    lobbyFloor: mix(d.lobbyFloor, NIGHT_BLUE, 0.4),
    pot: mix(d.pot, NIGHT_BLUE, 0.35),
    plants: d.plants.map((c) => mix(c, NIGHT_BLUE, 0.35)),
    floaters: d.floaters.map((c) => mix(c, NIGHT_BLUE, 0.3)),
  };
}

const cache = new WeakMap<QrCityStyle, QrCityStyle>();

/**
 * The night version of a style: a deep blue sky with stars, moonlight, windows lit from inside and
 * dark facades. The roofs and the ground keep their colours (the ground only looks dim from the
 * side, and lights up in the top-down view), so the code scans exactly as it does by day.
 * The same object comes back for the same style, so `update()` can compare styles by identity.
 */
export function nightOf(style: QrCityStyle): QrCityStyle {
  if (style.night) return style;
  const hit = cache.get(style);
  if (hit) return hit;
  const P = style.palette;
  const dim = (c: string, k = 0.35) => mix(c, NIGHT_BLUE, k);
  const night: QrCityStyle = {
    ...style,
    id: `${style.id}-night`,
    night: true,
    palette: {
      ...P,
      sky: '#0b1030',
      hemiSky: '#5668b0',
      hemiGround: '#10142a',
      hemiIntensity: 0.6,
      sun: '#a9bcff',
      sunIntensity: 0.32,
      base: dim(P.base, 0.5),
      towers: P.towers.map((c) => dim(c, 0.5)),
      houses: P.houses.map((c) => dim(c, 0.4)),
    },
    buildings: {
      ...style.buildings,
      windowColor: '#ffe3a1',
      neon: style.buildings.neon ?? WARM_WINDOWS,
    },
    vegetation: { ...style.vegetation, colors: style.vegetation.kind === 'neon' ? style.vegetation.colors : style.vegetation.colors.map((c) => dim(c, 0.4)) },
    flyers: { ...style.flyers, color: style.flyers.kind === 'birds' || style.flyers.kind === 'gulls' ? '#cfd8ff' : style.flyers.color },
    door: nightDoor(style.door ?? (moderna.door as QrCityDoorTheme)),
  };
  cache.set(style, night);
  return night;
}
