// Graba el vídeo de demostración (vertical, 1080×1920) de la demo, fotograma a fotograma.
//
// Cómo funciona: se sirve la demo ya construida, se abre en Chromium con un reloj falso de Playwright y
// se avanza el tiempo exactamente 1/fps entre capturas. Así el vídeo sale fluido aunque cada
// fotograma tarde segundos en dibujarse (ultra), y los efectos de sonido se sincronizan con los eventos
// que se anotan por el camino. Al final, ffmpeg une imágenes + sonidos (+ tu música).
//
// Uso (desde la raíz del repo): npm run video -- --help
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEMO = join(ROOT, 'apps/demo');

// ---- Opciones ---------------------------------------------------------------------------------------
const HELP = `Graba el vídeo de la demo (vertical).

  npm run video -- [opciones]

  --quality ultra|high|low   Calidad de la ciudad. Por defecto ultra (necesita GPU; con --software, mucho tiempo).
  --lang es|en               Idioma del vídeo. Por defecto es.
  --fps 24                   Fotogramas por segundo.
  --scale 2                  Densidad de píxeles: 2 → 1080×1920, 1 → 540×960.
  --out video.mp4            Fichero de salida.
  --music pista.mp3          Tu música (se mezcla por debajo de los efectos, con fundido final).
  --music-volume 0.35        Volumen de la música (0–1).
  --no-sfx                   Sin efectos de sonido.
  --software                 WebGL por software (SwiftShader): para máquinas sin GPU. Lento.
  --quick                    Prueba rápida: low, 12 fps, 540×960.
  --keep                     Conserva los fotogramas sueltos (carpeta .video-work/).
  --assemble                 No graba: monta el vídeo con los fotogramas que ya hay en .video-work/ (si falló ffmpeg).
  --ffmpeg ruta              Ruta de ffmpeg si no está en el PATH (o variable FFMPEG_PATH).
  --url http://...           Usa una demo ya en marcha en lugar de construirla y servirla.

Variables: PW_CHROMIUM_PATH (ruta de un Chromium ya instalado).`;

function parseArgs(argv) {
  const o = { quality: 'ultra', lang: 'es', fps: 24, scale: 2, out: 'qr-city-demo.mp4', music: null, musicVolume: 0.35, sfx: true, software: false, keep: false, url: null, assemble: false, ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
    else if (a === '--quality') o.quality = next();
    else if (a === '--lang') o.lang = next();
    else if (a === '--fps') o.fps = Number(next());
    else if (a === '--scale') o.scale = Number(next());
    else if (a === '--out') o.out = next();
    else if (a === '--music') o.music = next();
    else if (a === '--music-volume') o.musicVolume = Number(next());
    else if (a === '--no-sfx') o.sfx = false;
    else if (a === '--software') o.software = true;
    else if (a === '--quick') { o.quality = 'low'; o.fps = 12; o.scale = 1; }
    else if (a === '--keep') o.keep = true;
    else if (a === '--url') o.url = next();
    else if (a === '--assemble') o.assemble = true;
    else if (a === '--ffmpeg') o.ffmpeg = next();
    else { console.error(`Opción desconocida: ${a}\n\n${HELP}`); process.exit(1); }
  }
  if (!['ultra', 'high', 'low'].includes(o.quality)) throw new Error('--quality: ultra, high o low');
  if (!['es', 'en'].includes(o.lang)) throw new Error('--lang: es o en');
  if (!(o.fps > 0) || !(o.scale > 0)) throw new Error('--fps y --scale deben ser positivos');
  return o;
}

const opts = parseArgs(process.argv.slice(2));

// ---- Textos del vídeo (por idioma) -------------------------------------------------------------------
const TEXT = {
  es: {
    tag: 'Una librería para la web',
    sub: 'Tu enlace, hecho ciudad',
    door: 'Esta ciudad es un <em>código QR</em>',
    paste: 'Pega tu enlace',
    pick: 'Elige un <em>estilo</em>',
    flight: [
      [0.2, 'Entras por la <em>puerta</em>…'],
      [2.8, '…de un <em>edificio</em>…'],
      [5.0, '…que es parte de una <em>ciudad</em>…'],
      [8.0, '…y esa ciudad <em>es el QR</em>'],
    ],
    top: 'Desde arriba, <em>se escanea</em>',
    ok: '✓ Comprobado: se lee',
    styles: { ciberpunk: 'Ciberpunk', costera: 'Costera', nevada: 'Nevada', moderna: 'Moderna' },
    night: 'Y también, <em>de noche</em>',
    details: {
      ciberpunk: 'Drones, neón y <em>tráfico</em>',
      costera: 'Faro y <em>barcos</em>',
      nevada: 'Nieve y gente <em>paseando</em>',
      moderna: 'Aves, coches y <em>vecinos</em>',
    },
    endTag: 'npm i @qr-city/element',
  },
  en: {
    tag: 'A library for the web',
    sub: 'Your link, made a city',
    door: 'This city is a <em>QR code</em>',
    paste: 'Paste your link',
    pick: 'Pick a <em>style</em>',
    flight: [
      [0.2, 'You walk through the <em>door</em>…'],
      [2.8, '…of a <em>building</em>…'],
      [5.0, '…that is part of a <em>city</em>…'],
      [8.0, '…and that city <em>is the QR</em>'],
    ],
    top: 'From above, <em>it scans</em>',
    ok: '✓ Checked: it reads',
    styles: { ciberpunk: 'Cyberpunk', costera: 'Coastal', nevada: 'Snowy', moderna: 'Modern' },
    night: 'And <em>at night</em>, too',
    details: {
      ciberpunk: 'Drones, neon and <em>traffic</em>',
      costera: 'A lighthouse and <em>boats</em>',
      nevada: 'Snow and people <em>out for a walk</em>',
      moderna: 'Birds, cars and <em>neighbours</em>',
    },
    endTag: 'npm i @qr-city/element',
  },
}[opts.lang];

/**
 * Detalles a los que se acerca la cámara en cada estilo. `at` es la posición en pantalla (0–1, arriba a la
 * izquierda es 0,0) hacia la que se hace zoom y `zoom` cuánto. Lo que hay allí se mueve (coches, personas,
 * aves, drones, barcos), así que si en tu primera grabación el zoom no pilla lo que quieres, cambia aquí
 * las posiciones y vuelve a grabar.
 */
const TOUR = [
  { style: 'costera', at: { x: 0.2, y: 0.74 }, zoom: 3.2 },
  { style: 'nevada', at: { x: 0.5, y: 0.6 }, zoom: 4 },
  { style: 'moderna', at: { x: 0.5, y: 0.5 }, zoom: 4 },
];
/** Primer detalle, en el estilo en que se pide la ciudad (ciberpunk). */
const FIRST_DETAIL = { style: 'ciberpunk', at: { x: 0.5, y: 0.45 }, zoom: 3.5 };
const FIRST_STYLE = 'ciberpunk';
const LINK = 'https://qr-city.danioliva.dev';

// ---- Servidor de la demo -----------------------------------------------------------------------------
const PORT = 4400;
let server = null;
let baseUrl = opts.url;

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`La demo no responde en ${url}`);
}

async function startServer() {
  if (baseUrl) return;
  if (!existsSync(join(DEMO, 'dist/index.html'))) {
    console.log('Construyendo la demo (npm run build)…');
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: DEMO,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  await waitFor(baseUrl);
}

// ---- Captura -----------------------------------------------------------------------------------------
const WORK = join(ROOT, '.video-work');
const FRAMES = join(WORK, 'frames');
if (!opts.assemble) {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
}

const STEP = 1000 / opts.fps;
const logo = readFileSync(join(ROOT, 'assets/logo/logo-mark.svg'), 'utf8');
const events = [];
let k = 0;

const OVERLAY_CSS = `
 main{padding:0;display:block;max-width:none}
 .head,.panel,.lab,.foot,.hint,.skip,.bar,.qr-warn,#install{display:none!important}
 .top{display:block}
 .stage{position:fixed;inset:0;border:0;border-radius:0}
 qr-city{position:absolute;inset:0;width:100%;height:100%;max-height:none}
 .gate .card{max-width:430px;margin-top:150px}
 .gate{align-content:start}
 #rv-cap{position:fixed;left:0;right:0;top:132px;z-index:50;display:grid;justify-items:center;pointer-events:none}
 #rv-cap p{margin:0;max-width:470px;text-align:center;font:400 34px/1.1 var(--title);color:var(--ink);letter-spacing:-.01em;background:rgba(247,244,236,.94);padding:12px 20px 13px;border-radius:12px;box-shadow:0 2px 0 rgba(28,27,24,.08)}
 #rv-cap em{font-style:normal;color:var(--accent)}
 #rv-badge{position:fixed;left:50%;bottom:210px;transform:translateX(-50%);z-index:55;font:600 15px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;background:var(--ink);color:var(--bg);padding:13px 18px;border-radius:999px;opacity:0;white-space:nowrap}
 #rv-tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid var(--accent);background:rgba(194,68,31,.2);opacity:0;z-index:60;pointer-events:none}
 #rv-fade{position:fixed;inset:0;z-index:70;background:var(--bg);opacity:0;pointer-events:none}
 .rv-card{position:fixed;inset:0;z-index:65;background:var(--bg) url('/papel.webp');background-size:1200px;overflow:hidden;pointer-events:none}
 .rv-card .track{position:absolute;top:0;left:0;height:100%;width:1620px;will-change:transform}
 .rv-card .pane{position:absolute;top:0;height:100%;width:540px;display:grid;place-content:center;justify-items:center;gap:20px;text-align:center}
 #rv-title .pane.a{left:0} #rv-title .pane.b{left:540px}
 #rv-title svg{width:330px;height:330px;filter:drop-shadow(0 18px 18px rgba(28,27,24,.18))}
 #rv-title h1{margin:0;font:400 92px/.95 var(--title);letter-spacing:-.02em;color:var(--ink)} #rv-title h1 em{font-style:normal;color:var(--accent)}
 #rv-title p{margin:0;max-width:380px;font:400 30px/1.15 var(--title);color:var(--muted)}
 #rv-title .tag{font:600 13px/1 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
 #rv-end{display:grid;place-content:center;justify-items:center;gap:18px;text-align:center;opacity:0}
 #rv-end svg{width:260px;height:260px;filter:drop-shadow(0 18px 18px rgba(28,27,24,.18))}
 #rv-end h2{margin:0;font:400 62px/1 var(--title);letter-spacing:-.02em} #rv-end h2 em{font-style:normal;color:var(--accent)}
 #rv-end .url{font:600 17px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--accent);padding-bottom:6px}
 #rv-end code{font:400 17px var(--code);color:var(--ink);background:var(--panel);border:1px solid var(--line);padding:9px 13px;border-radius:4px}
`;

/** Rótulos, toque, fundidos, tarjetas de título y final: se animan por fotogramas, no por tiempo. */
function installOverlay({ logo, text }) {
  document.body.insertAdjacentHTML('beforeend', `
   <div id="rv-cap"><p></p></div><div id="rv-badge"></div><div id="rv-tap"></div>
   <div class="rv-card" id="rv-title"><div class="track" id="rv-track">
     <div class="pane a"><svg id="rv-logo-a" viewBox="0 0 120 120"></svg></div>
     <div class="pane b"><span class="tag">${text.tag}</span><h1>Ciudad<br><em>QR</em></h1><p>${text.sub}</p></div>
   </div></div>
   <div class="rv-card" id="rv-end" style="opacity:0"><svg id="rv-logo-b" viewBox="0 0 120 120"></svg><h2>Ciudad <em>QR</em></h2><span class="url">qr-city.danioliva.dev</span><code>${text.endTag}</code></div>
   <div id="rv-fade"></div>`);
  const inner = logo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  document.getElementById('rv-logo-a').innerHTML = inner;
  document.getElementById('rv-logo-b').innerHTML = inner;
  const $ = (id) => document.getElementById(id);
  const cap = $('rv-cap'), capP = cap.querySelector('p'), tap = $('rv-tap'), fade = $('rv-fade'), badge = $('rv-badge'), title = $('rv-title'), track = $('rv-track'), end = $('rv-end');
  const A = { cap: -1, tap: -1, fade: null, badge: -1, title: -1, titleOut: -1, end: -1 };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  window.__caption = (t, low) => { if (!t) { capP.style.opacity = '0'; A.cap = -1; return; } cap.style.top = low ? '620px' : '132px'; capP.innerHTML = t; A.cap = 0; };
  window.__badgeOff = () => { A.badge = -1; badge.style.opacity = '0'; };
  window.__tap = (x, y) => { tap.style.left = x + 'px'; tap.style.top = y + 'px'; A.tap = 0; };
  window.__fade = (to, n) => { A.fade = { from: parseFloat(fade.style.opacity || 0), to, n, i: 0 }; };
  window.__badge = (t) => { badge.textContent = t; A.badge = 0; };
  window.__title = () => { A.title = 0; };
  window.__titleOut = () => { A.titleOut = 0; };
  window.__end = () => { A.end = 0; end.style.opacity = '0'; };
  window.__tick = () => {
    if (A.cap >= 0 && A.cap <= 7) { const u = ease(A.cap / 7); capP.style.opacity = String(u); capP.style.transform = `translateY(${(1 - u) * 18}px) scale(${0.97 + 0.03 * u})`; A.cap++; }
    if (A.tap >= 0) { const u = A.tap / 12; tap.style.opacity = String(u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8)); tap.style.transform = `scale(${0.6 + u * 0.9})`; A.tap++; if (A.tap > 12) A.tap = -1; }
    if (A.fade) { const f = A.fade; f.i++; fade.style.opacity = String(f.from + (f.to - f.from) * ease(Math.min(1, f.i / f.n))); if (f.i >= f.n) A.fade = null; }
    if (A.badge >= 0 && A.badge <= 8) { const u = ease(A.badge / 8); badge.style.opacity = String(u); badge.style.transform = `translateX(-50%) translateY(${(1 - u) * 14}px)`; A.badge++; }
    if (A.title >= 0) {
      const T = A.title; const u = ease(Math.min(1, Math.max(0, (T - 14) / 30)));
      track.style.transform = `translateX(${-540 * u}px)`;
      $('rv-logo-a').style.transform = `translateX(${-90 * u}px) scale(${1 + 0.12 * Math.min(1, T / 44)})`;
      A.title++;
    }
    if (A.titleOut >= 0) { title.style.opacity = String(1 - ease(Math.min(1, A.titleOut / 8))); A.titleOut++; if (A.titleOut > 8) title.style.display = 'none'; }
    if (A.end >= 0) { const u = ease(Math.min(1, A.end / 8)); end.style.opacity = String(u); $('rv-logo-b').style.transform = `scale(${0.92 + 0.08 * Math.min(1, A.end / 30)})`; A.end++; }
  };
  capP.style.opacity = '0';
  // El final de la subida de los edificios, para esperar a que cada ciudad esté completa
  window.__revealed = false;
  document.getElementById('city').addEventListener('qr-city-reveal', () => { window.__revealed = true; });
}

async function main() {
  await startServer();
  const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
  const gpuArgs = opts.software
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'];
  const browser = await chromium.launch({ executablePath, args: gpuArgs });
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: opts.scale,
    locale: opts.lang === 'en' ? 'en-GB' : 'es-ES',
    colorScheme: 'light',
  });
  const p = await ctx.newPage();
  await p.clock.install();

  const ev = (name) => { events.push([name, k]); console.log(`  ${name} @${k}`); };
  async function frame(n = 1, speed = 1) {
    for (let i = 0; i < n; i++) {
      await p.evaluate(() => window.__tick && window.__tick());
      await p.clock.runFor(STEP * speed);
      await p.screenshot({ path: join(FRAMES, `${String(k++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    }
  }
  /** Avanza fotogramas hasta que `fn` (en la página) sea cierta o se agote `cap`. */
  async function until(fn, cap, every = 3, speed = 1) {
    for (let i = 0; i < cap; i += every) {
      if (await p.evaluate(fn)) return true;
      await frame(every, speed);
    }
    return false;
  }
  const call = (f, ...a) => p.evaluate(([f, a]) => window[f](...a), [f, a]);
  const caption = (t, low) => call('__caption', t, !!low);
  const center = async (sel) => { const r = await p.locator(sel).first().boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  async function tapAt(x, y, wait = 3) {
    await call('__tap', x, y);
    await frame(wait);
    events.push(['tap', k]);
    await p.mouse.click(x, y);
  }
  const cut = async (fn) => { await call('__fade', 1, 4); await frame(4); await fn(); await call('__fade', 0, 5); await frame(1); };
  /** Cambia el estilo (o la hora) de la ciudad ya hecha y espera a que se levante entera. */
  async function swap(props) {
    await p.evaluate((pr) => { window.__revealed = false; Object.assign(document.getElementById('city'), pr); }, props);
    ev('swap');
    if (!(await until(() => window.__revealed, 24 * 14, 3))) throw new Error('La ciudad no terminó de levantarse');
    await frame(14);
  }
  /** Zoom hacia un punto de la pantalla, pausa y vuelta. */
  async function detail(text, { at, zoom }) {
    await caption(text);
    ev('zoom-in');
    await p.evaluate(([z, at]) => document.getElementById('city').setZoom(z, { at }), [zoom, at]);
    await frame(Math.round(opts.fps * 3.4));
    ev('zoom-out');
    await p.evaluate(() => document.getElementById('city').resetZoom());
    await frame(Math.round(opts.fps * 0.9));
  }

  console.log(`Grabando en ${opts.quality}, ${opts.fps} fps, ${540 * opts.scale}×${960 * opts.scale}…`);
  await p.goto(`${baseUrl}/?lang=${opts.lang}&quality=${opts.quality}`);
  await p.addStyleTag({ content: OVERLAY_CSS });
  await p.evaluate(installOverlay, { logo, text: TEXT });
  // El reloj falso sigue corriendo solo hasta que se detiene: sin esto, lo que tarda cada captura contaría como tiempo de vídeo.
  await p.clock.pauseAt(Date.now() + 5000);

  // 1 · Logo y título, con paneo
  await call('__title');
  ev('title');
  await frame(66);
  await call('__titleOut');
  await frame(8);

  // 2 · La puerta, en primer plano, y se abre
  await caption(TEXT.door, true);
  ev('door');
  await frame(26);
  const st = await p.locator('.stage').boundingBox();
  await tapAt(st.x + st.width / 2, st.y + st.height * 0.55);
  ev('door-tap');
  await caption(null);
  if (!(await until(() => !document.getElementById('gate').hidden, 400, 3, 0.8))) throw new Error('No apareció el formulario');

  // 3 · El enlace y el estilo
  await caption(TEXT.paste, true);
  ev('form');
  await frame(6);
  const [ix, iy] = await center('#data');
  await tapAt(ix, iy, 2);
  await p.fill('#data', '');
  // Una tecla cada 3 fotogramas (8 por segundo a 24 fps): se lee lo que se escribe
  const KEY_FRAMES = Math.max(2, Math.round(opts.fps / 8));
  for (const ch of LINK) {
    events.push(['key', k]);
    await p.keyboard.type(ch);
    await frame(KEY_FRAMES);
  }
  await frame(6);
  await caption(TEXT.pick, true);
  const [cx, cy] = await center(`label.opt:has(input[value="${FIRST_STYLE}"])`);
  await tapAt(cx, cy, 2);
  ev('style1');
  await frame(Math.round(opts.fps * 2.4)); // tiempo para ver qué se ha elegido antes de construir
  const [bx, by] = await center('button.primary');
  await tapAt(bx, by, 2);
  ev('build');
  await caption(null);

  // 4 · El vuelo entero (un poco más lento para que se note)
  {
    const SP = 0.8;
    const dt = (STEP * SP) / 1000;
    let t = 0;
    let ci = 0;
    let done = false;
    for (let i = 0; i < 700 && !done; i++) {
      while (ci < TEXT.flight.length && t >= TEXT.flight[ci][0]) { await caption(TEXT.flight[ci][1]); ci++; }
      await frame(1, SP);
      t += dt;
      if (i % 4 === 0) done = await p.evaluate(() => document.getElementById('city').stage === 'done');
    }
    ev('city');
    await until(() => window.__revealed, 24 * 6, 3);
    await frame(20);
  }

  // 5 · Desde arriba, se escanea
  await caption(TEXT.top);
  await p.evaluate(() => document.getElementById('city').setView('qr'));
  ev('qr');
  await frame(30);
  await p.evaluate(() => document.getElementById('check').click());
  await until(() => /ok|fail/.test(document.getElementById('scan').className), 400, 4);
  const ok = await p.evaluate(() => document.getElementById('scan').className.includes('ok'));
  if (ok) { ev('scan'); await call('__badge', TEXT.ok); } else console.warn('  (la comprobación del escaneo no dio «ok»: no se muestra la insignia)');
  await frame(36);
  await call('__badgeOff');

  // 6 · De vuelta a la ciudad: detalles del estilo en que se creó, y luego los demás estilos
  await p.evaluate(() => document.getElementById('city').setView('city'));
  await caption(TEXT.styles[FIRST_STYLE]);
  await frame(Math.round(opts.fps * 1.6));
  await detail(TEXT.details[FIRST_DETAIL.style], FIRST_DETAIL);
  for (const step of TOUR) {
    await caption(TEXT.styles[step.style]);
    await swap({ cityStyle: step.style });
    await detail(TEXT.details[step.style], step);
  }

  // 7 · La noche
  await caption(TEXT.night);
  await swap({ time: 'night' });
  ev('night');
  await frame(Math.round(opts.fps * 2.6));

  // 8 · Final
  await cut(async () => { await call('__end'); });
  await caption(null);
  ev('end');
  await frame(Math.round(opts.fps * 2.4));

  writeFileSync(join(WORK, 'events.json'), JSON.stringify({ fps: opts.fps, frames: k, events }));
  await browser.close();
  console.log(`${k} fotogramas (${(k / opts.fps).toFixed(1)} s).`);
}

function ffmpeg(args) {
  try {
    execFileSync(opts.ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new Error(
        `No encuentro ffmpeg (${opts.ffmpeg}).\n` +
          '  · Si acabas de instalarlo, cierra esta terminal y abre otra: la actual no ve el PATH nuevo.\n' +
          '  · Comprueba que `ffmpeg -version` funciona (en PowerShell: `Get-Command ffmpeg`, o `where.exe ffmpeg`).\n' +
          '  · O indica la ruta: npm run video -- --assemble --ffmpeg "C:\\ruta\\a\\ffmpeg.exe"\n' +
          `Los fotogramas siguen en ${WORK}: con --assemble se monta el vídeo sin volver a grabar.`,
      );
    }
    throw e;
  }
}

function assemble() {
  const out = resolve(process.cwd(), opts.out);
  const info = JSON.parse(readFileSync(join(WORK, 'events.json'), 'utf8'));
  opts.fps = info.fps;
  const duration = info.frames / info.fps;
  const input = ['-framerate', String(opts.fps), '-i', join(FRAMES, '%05d.jpg')];
  const video = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart'];
  const sfx = join(WORK, 'sfx.wav');
  if (opts.sfx) execFileSync(process.execPath, [join(ROOT, 'scripts/video/sfx.mjs'), join(WORK, 'events.json'), sfx], { stdio: 'inherit' });

  if (opts.sfx && opts.music) {
    const fade = Math.max(0, duration - 2.5);
    ffmpeg([
      ...input, '-i', sfx, '-i', resolve(process.cwd(), opts.music),
      '-filter_complex', `[2:a]atrim=0:${duration},asetpts=N/SR/TB,volume=${opts.musicVolume},afade=t=in:d=1.5,afade=t=out:st=${fade}:d=2.5[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]`,
      '-map', '0:v', '-map', '[a]', ...video, '-c:a', 'aac', '-b:a', '192k', '-shortest', out,
    ]);
  } else if (opts.sfx) {
    ffmpeg([...input, '-i', sfx, ...video, '-c:a', 'aac', '-b:a', '192k', '-shortest', out]);
  } else if (opts.music) {
    const fade = Math.max(0, duration - 2.5);
    ffmpeg([
      ...input, '-i', resolve(process.cwd(), opts.music),
      '-filter_complex', `[1:a]atrim=0:${duration},asetpts=N/SR/TB,volume=${opts.musicVolume},afade=t=in:d=1.5,afade=t=out:st=${fade}:d=2.5[a]`,
      '-map', '0:v', '-map', '[a]', ...video, '-c:a', 'aac', '-b:a', '192k', '-shortest', out,
    ]);
  } else {
    ffmpeg([...input, ...video, out]);
  }
  console.log(`Listo: ${out}`);
}

try {
  if (opts.assemble) {
    if (!existsSync(join(WORK, 'events.json'))) throw new Error(`No hay nada que montar: falta ${join(WORK, 'events.json')}. Graba primero (npm run video).`);
  } else {
    await main();
  }
  assemble();
  if (!opts.keep) rmSync(WORK, { recursive: true, force: true });
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  server?.kill();
}
