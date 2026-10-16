/** Deterministic pseudo-random in [0, 1) from two numbers (same city for the same data). */
export const rand = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7 + 0.5) * 43758.5453;
  return s - Math.floor(s);
};

export const pick = <T>(arr: readonly T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length] as T;
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const ease = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const smooth = (a: number, b: number, x: number): number => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Point on a square ring of half-side R at arc length s: [x, z, heading]. */
export function ringPoint(R: number, s: number): [number, number, number] {
  const L = 2 * R;
  s = ((s % (4 * L)) + 4 * L) % (4 * L);
  if (s < L) return [-R + s, -R, 0];
  if (s < 2 * L) return [R, -R + (s - L), Math.PI / 2];
  if (s < 3 * L) return [R - (s - 2 * L), R, Math.PI];
  return [-R, R - (s - 3 * L), -Math.PI / 2];
}
