// Efectos de sonido del vídeo, sintetizados en código (sin ficheros de audio ni derechos de autor).
// Lee los eventos que escribe record.mjs (nombre + fotograma) y escribe un WAV estéreo.
// Uso: node scripts/video/sfx.mjs events.json sfx.wav
import { readFileSync, writeFileSync } from 'node:fs';

const SR = 44100;

/** Pseudoaleatorio con semilla: el mismo vídeo suena siempre igual. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(7);
const noise = (n) => Float64Array.from({ length: Math.floor(n * SR) }, () => rand() * 2 - 1);
const samples = (n) => Math.floor(n * SR);

function lowpass(x, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  const y = new Float64Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s = (1 - a) * x[i] + a * s;
    y[i] = s;
  }
  return y;
}

function envelope(n, attack, decay) {
  const out = new Float64Array(samples(n));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = Math.min(t / attack, 1) * Math.exp(-t / decay);
  }
  return out;
}

function click(pitch = 1800, length = 0.05) {
  const n = samples(length);
  const nz = lowpass(noise(length), 6000);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * pitch * t) * 0.5 + nz[i] * 0.6) * Math.exp(-t * 90);
  }
  return out;
}

function tick(pitch) {
  const n = samples(0.03);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * pitch * t) * 0.5 + (rand() * 2 - 1) * 0.35) * Math.exp(-t * 160);
  }
  return out;
}

/** Aire que pasa: ruido filtrado cuya frecuencia sube (o baja) y que crece y se apaga. */
function whoosh(length, f0, f1, peak = 0.5) {
  const x = noise(length);
  const y = new Float64Array(x.length);
  let s = 0;
  let max = 1e-9;
  for (let i = 0; i < x.length; i++) {
    const fc = f0 * Math.pow(f1 / f0, i / x.length);
    const a = Math.exp((-2 * Math.PI * fc) / SR);
    s = (1 - a) * x[i] + a * s;
    y[i] = s;
    max = Math.max(max, Math.abs(s));
  }
  for (let i = 0; i < y.length; i++) y[i] = (y[i] / max) * Math.sin((Math.PI * i) / y.length) ** 2 * peak;
  return y;
}

function thunk() {
  const n = samples(0.5);
  const nz = lowpass(noise(0.5), 400);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (60 + 50 * Math.exp(-t * 14))) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t * 8) + nz[i] * 0.5 * Math.exp(-t * 20);
  }
  return out;
}

function note(freq, length = 0.9, attack = 0.01, decay = 0.35, harmonics = [1, 0.35, 0.15]) {
  const env = envelope(length, attack, decay);
  const out = new Float64Array(env.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    harmonics.forEach((h, k) => { v += h * Math.sin(2 * Math.PI * freq * (k + 1) * t); });
    out[i] = v * env[i];
  }
  return out;
}

const [eventsPath, outPath] = process.argv.slice(2);
if (!eventsPath || !outPath) {
  console.error('Uso: node scripts/video/sfx.mjs events.json sfx.wav');
  process.exit(1);
}
const { fps, frames, events } = JSON.parse(readFileSync(eventsPath, 'utf8'));
const at = (name, offset = 0) => events.filter(([n]) => n === name).map(([, f]) => (f + offset) / fps);
const duration = frames / fps;
const left = new Float64Array(samples(duration) + SR);
const right = new Float64Array(left.length);

function put(sig, start, gain = 1, pan = 0) {
  const i0 = Math.floor(start * SR);
  const l = Math.min(1, Math.sqrt((1 - pan) / 2) * Math.SQRT2);
  const r = Math.min(1, Math.sqrt((1 + pan) / 2) * Math.SQRT2);
  for (let i = 0; i < sig.length && i0 + i < left.length; i++) {
    if (i0 + i < 0) continue;
    left[i0 + i] += sig[i] * gain * l;
    right[i0 + i] += sig[i] * gain * r;
  }
}

// Cada toque en pantalla
for (const s of at('tap')) put(click(1500), s - 1 / fps, 0.45);
// Título: el paneo
for (const s of at('title')) {
  put(whoosh(0.9, 300, 2600, 0.45), s + 14 / fps, 0.5);
  put(note(392, 1.2, 0.05, 0.5), s + 0.15, 0.12);
}
// La puerta se abre
for (const s of at('door-tap')) {
  put(thunk(), s, 0.55);
  put(whoosh(0.9, 200, 1800, 0.5), s, 0.45);
}
// Teclear el enlace: un tic por fotograma entre type-start y type-end
const [typeStart] = at('type-start');
const [typeEnd] = at('type-end');
if (typeStart !== undefined && typeEnd !== undefined) {
  for (let s = typeStart; s < typeEnd; s += 1 / fps) put(tick(1900 + rand() * 800), s, 0.22, rand() * 0.4 - 0.2);
}
// Empieza el vuelo
for (const s of at('build')) put(whoosh(1.0, 250, 3000, 0.5), s, 0.4);
// La ciudad aparece
for (const s of at('city')) {
  put(note(523.25, 1.1, 0.01, 0.45), s, 0.25);
  put(note(783.99, 1.3, 0.01, 0.55), s + 3 / fps, 0.22);
}
// Vista cenital
for (const s of at('qr')) put(whoosh(0.6, 2500, 500, 0.4), s, 0.35);
// Se lee: dos notas
for (const s of at('scan')) {
  put(note(659.25, 0.9, 0.005, 0.3), s, 0.25);
  put(note(987.77, 1.2, 0.005, 0.45), s + 4 / fps, 0.25);
}
// Cambio de estilo: la ciudad se levanta de nuevo
for (const s of at('swap')) {
  put(whoosh(0.9, 300, 2400, 0.45), s, 0.4);
  put(note(587.33, 0.9, 0.01, 0.4), s + 0.25, 0.14);
}
// Zoom a un detalle y vuelta
for (const s of at('zoom-in')) put(whoosh(0.6, 400, 2800, 0.4), s, 0.35);
for (const s of at('zoom-out')) put(whoosh(0.6, 2800, 400, 0.4), s, 0.3);
// Noche: acorde grave
for (const s of at('night')) {
  put(whoosh(1.4, 150, 900, 0.4), s, 0.4);
  for (const f of [196, 293.66]) put(note(f, 2.2, 0.3, 1.0, [1, 0.3, 0.1]), s, 0.15);
}
// Final
for (const s of at('end')) {
  for (const [f, g] of [[261.63, 0.16], [329.63, 0.14], [392.0, 0.14], [523.25, 0.12]]) put(note(f, 2.4, 0.25, 1.2, [1, 0.25, 0.1]), s, g);
}

// Limitador suave, normalizado, con un fundido corto al principio y otro al final
const total = samples(duration);
let peak = 1e-9;
for (let i = 0; i < total; i++) {
  left[i] = Math.tanh(left[i] * 0.9);
  right[i] = Math.tanh(right[i] * 0.9);
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const fadeIn = samples(0.05);
const fadeOut = samples(0.6);
const pcm = Buffer.alloc(total * 4);
for (let i = 0; i < total; i++) {
  let g = 0.8 / peak;
  if (i < fadeIn) g *= i / fadeIn;
  if (i > total - fadeOut) g *= (total - i) / fadeOut;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * g)) * 32767), i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * g)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
writeFileSync(outPath, Buffer.concat([header, pcm]));
console.log(`Audio de efectos: ${duration.toFixed(1)} s → ${outPath}`);
