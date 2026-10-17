import { checkStyle, styles } from '@qr-city/core';
import type { QrCityStyle, QrCityStyleId } from '@qr-city/core';
import type { QrCityElement } from '@qr-city/element';
import { paper } from './paper-style';
import { getLang, isDefaultText, setText, t } from './i18n';
import type { Key } from './i18n';

/** Every option the element exposes, as the demo lets people play with it. */
export interface LabState {
  data: string;
  intro: 'none' | 'door' | 'flyover';
  pauseAtThreshold: boolean;
  animate: 'auto' | 'true' | 'false';
  view: 'city' | 'qr';
  interactive: boolean;
  zoomable: boolean;
  maxZoom: number;
  wheelZoom: 'ctrl' | 'always' | 'off';
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  quality: 'auto' | 'low' | 'high' | 'ultra';
  fallback: 'qr' | 'none';
  background: 'style' | 'transparent' | 'white' | 'black';
  label: string;
  doorLabel: string;
  plaza: boolean;
  plazaSize: number;
  /** `custom` is a picture uploaded here: it lives in this page only, never in the link. */
  plazaImage: 'logo' | 'none' | 'custom';
}

/** What the library does when an option is left out: the snippets only show what differs from this. */
const LIB: LabState = {
  data: '',
  intro: 'none',
  pauseAtThreshold: false,
  animate: 'auto',
  view: 'city',
  interactive: true,
  zoomable: true,
  maxZoom: 8,
  wheelZoom: 'ctrl',
  errorCorrection: 'M',
  quality: 'auto',
  fallback: 'qr',
  background: 'style',
  label: 'QR code city',
  doorLabel: 'Open the door',
  plaza: false,
  plazaSize: 0.2,
  plazaImage: 'logo',
};

const BACKGROUNDS: Record<LabState['background'], string | undefined> = {
  style: undefined,
  transparent: 'transparent',
  white: '#ffffff',
  black: '#14110f',
};

// ---- Shareable links: the whole lab state lives in the query string -------------------------------------
const ENUMS: Partial<Record<keyof LabState, readonly string[]>> = {
  intro: ['none', 'door', 'flyover'],
  animate: ['auto', 'true', 'false'],
  view: ['city', 'qr'],
  wheelZoom: ['ctrl', 'always', 'off'],
  errorCorrection: ['L', 'M', 'Q', 'H'],
  quality: ['auto', 'low', 'high', 'ultra'],
  fallback: ['qr', 'none'],
  background: ['style', 'transparent', 'white', 'black'],
  plazaImage: ['logo', 'none'],
};
const BOOLEANS = ['pauseAtThreshold', 'interactive', 'zoomable', 'plaza'] as const;
const STRINGS: Partial<Record<keyof LabState, number>> = { data: 300, label: 120, doorLabel: 120 };

/** Reads and validates the options of a link: anything unexpected is ignored. */
function readState(params: URLSearchParams): Partial<LabState> {
  const out: Record<string, unknown> = {};
  for (const [k, list] of Object.entries(ENUMS)) {
    const v = params.get(k);
    if (v && list.includes(v)) out[k] = v;
  }
  for (const k of BOOLEANS) {
    const v = params.get(k);
    if (v === 'true' || v === 'false') out[k] = v === 'true';
  }
  const zoom = Number(params.get('maxZoom'));
  if (params.has('maxZoom') && zoom >= 2 && zoom <= 16) out.maxZoom = Math.round(zoom);
  const plazaSize = Number(params.get('plazaSize'));
  if (params.has('plazaSize') && plazaSize >= 0.1 && plazaSize <= 0.25) out.plazaSize = Math.round(plazaSize * 100) / 100;
  for (const [k, max] of Object.entries(STRINGS)) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, max);
  }
  return out as Partial<LabState>;
}

const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const hexList = (max: number) => (v: unknown) => Array.isArray(v) && v.length > 0 && v.length <= max && v.every(isHex);
const inRange = (lo: number, hi: number) => (v: unknown) => typeof v === 'number' && v >= lo && v <= hi;
const oneOf = (list: string[]) => (v: unknown) => typeof v === 'string' && list.includes(v);
/** The style fields the lab edits, each with the check a value from a link must pass. */
const TWEAKS: Record<string, Record<string, (v: unknown) => boolean>> = {
  palette: { sky: isHex, walk: isHex, ground: isHex, road: isHex, roof: isHex, towers: hexList(8) },
  buildings: { windowColor: isHex, heightMul: inRange(0.3, 1.5), houseBias: inRange(0, 1), skyBias: inRange(0, 1) },
  vegetation: { kind: oneOf(['round', 'palm', 'pine', 'neon']), colors: hexList(6) },
  traffic: { carColors: hexList(8) },
  flyers: { kind: oneOf(['birds', 'gulls', 'drones', 'snow']), color: isHex },
};

const toBase64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** What differs from the preset, in the editable fields only, as a compact string. */
function encodeTweaks(preset: QrCityStyle, work: QrCityStyle): string {
  const diff: Record<string, Record<string, unknown>> = {};
  const a = preset as unknown as Record<string, Record<string, unknown>>;
  const b = work as unknown as Record<string, Record<string, unknown>>;
  for (const [g, keys] of Object.entries(TWEAKS)) {
    for (const k of Object.keys(keys)) {
      if (JSON.stringify(a[g][k]) !== JSON.stringify(b[g][k])) (diff[g] ??= {})[k] = b[g][k];
    }
  }
  return Object.keys(diff).length ? toBase64Url(JSON.stringify(diff)) : '';
}

/** Applies the tweaks of a link onto a style, ignoring anything that does not validate. */
function applyTweaks(work: QrCityStyle, encoded: string | null) {
  if (!encoded) return;
  try {
    const diff = JSON.parse(fromBase64Url(encoded)) as Record<string, Record<string, unknown>>;
    const target = work as unknown as Record<string, Record<string, unknown>>;
    for (const [g, keys] of Object.entries(TWEAKS)) {
      for (const [k, ok] of Object.entries(keys)) {
        const v = diff[g]?.[k];
        if (v !== undefined && ok(v)) target[g][k] = v;
      }
    }
  } catch {
    // A mangled link: keep the preset as it is.
  }
}

export const presets: QrCityStyle[] = [paper, ...Object.values(styles)];
const baseOf = (s: QrCityStyle) => (s.id in styles ? s.id : 'moderna') as keyof typeof styles;

type Framework = 'element' | 'react' | 'vue' | 'angular' | 'core';
const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: 'element', label: 'Web Component' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'angular', label: 'Angular' },
  { id: 'core', label: 'JavaScript' },
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...kids: (Node | string)[]) => {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) node.className = cls;
  Object.assign(node, rest);
  node.append(...kids);
  return node;
};

/** A JS literal with single quotes and short arrays on one line. */
function lit(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent + 1);
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return `[${v.map((x) => lit(x)).join(', ')}]`;
  if (v && typeof v === 'object') {
    const rows = Object.entries(v).map(([k, x]) => `${pad}${k}: ${lit(x, indent + 1)},`);
    return `{\n${rows.join('\n')}\n${'  '.repeat(indent)}}`;
  }
  return String(v);
}

export interface Lab {
  state: LabState;
  /** Updates options (state, controls and element) from outside, e.g. the entrance form. */
  set(partial: Partial<LabState>): void;
  selectPreset(id: string): void;
  /** Applies the state (possibly from a link) and the style to the element: call before it is defined. */
  start(): void;
  /** The link that reproduces the current configuration. */
  shareUrl(): string;
  /** Rebuilds what is written in the current language (controls, warning, code, link). */
  refreshLanguage(): void;
  /** Starts the flyover (after the demo has asked what to build). */
  startFlyover(): void;
  /** Gives up on a pending flyover and goes back to the intro the element really has. */
  cancelAsk(): void;
  readonly preset: QrCityStyle;
}

interface Hooks {
  /** The element started over (the intro changed): the stage UI must reset. */
  onRestart(): void;
  /** The style or the preset changed. */
  onStyle(): void;
  /** The scan-ability warning (a message key with its values), or null when the colours are fine. */
  onWarn(warning: { key: Key; vars: Record<string, string> } | null): void;
  /** The flyover starts the moment the element is created, so the demo asks for the link first. */
  onAsk(): void;
}

export function createLab(city: QrCityElement, root: HTMLElement, hooks: Hooks): Lab {
  /** What the demo starts with (the two names follow the language). */
  const demoDefaults = (): LabState => ({
    ...LIB,
    data: 'https://github.com/dolivag/qr-city',
    intro: 'door',
    pauseAtThreshold: true,
    label: t('city.label'),
    doorLabel: t('city.doorLabel'),
  });
  const state = demoDefaults();
  const params = new URLSearchParams(location.search);
  Object.assign(state, readState(params));
  /** A picture uploaded for the plaza (a data URL): kept in this page only. */
  let customImage: string | null = null;
  const PLAZA_LOGO = '/logo.svg';
  const plazaOption = () => {
    if (!state.plaza) return false;
    const image = state.plazaImage === 'logo' ? PLAZA_LOGO : state.plazaImage === 'custom' ? customImage ?? undefined : undefined;
    return { image, size: state.plazaSize };
  };
  /** The intro the element really has (the lab may show another while it waits for the link). */
  let committed = state.intro;
  let preset = presets.find((p) => p.id === params.get('style')) ?? presets[0];
  let work: QrCityStyle = structuredClone(preset);
  applyTweaks(work, params.get('tweaks'));

  /** The link that reproduces what is on screen. */
  function shareUrl(): string {
    const q = new URLSearchParams();
    const defaults = demoDefaults();
    for (const k of Object.keys(state) as (keyof LabState)[]) {
      if (state[k] !== defaults[k] && !(k === 'plazaImage' && state[k] === 'custom')) q.set(k, String(state[k]));
    }
    q.set('lang', getLang());
    if (preset.id !== presets[0].id) q.set('style', preset.id);
    const tweaks = encodeTweaks(preset, work);
    if (tweaks) q.set('tweaks', tweaks);
    const query = q.toString();
    return `${location.origin}${location.pathname}${query ? `?${query}` : ''}`;
  }
  const syncUrl = () => debounce('url', () => history.replaceState(null, '', shareUrl()), 300);
  const syncers: (() => void)[] = [];
  const timers = new Map<string, number>();
  const debounce = (key: string, fn: () => void, ms = 220) => {
    clearTimeout(timers.get(key));
    timers.set(key, window.setTimeout(fn, ms));
  };

  // ---- Element ↔ state ------------------------------------------------
  function apply<K extends keyof LabState>(key: K) {
    switch (key) {
      case 'data': city.data = state.data; break;
      case 'intro': {
        if (state.intro === 'flyover') { hooks.onAsk(); break; }
        // The intro is fixed when a city is created: the element starts over.
        committed = state.intro;
        city.pauseAtThreshold = state.intro === 'door' ? state.pauseAtThreshold : false;
        city.intro = state.intro;
        hooks.onRestart();
        break;
      }
      case 'pauseAtThreshold':
        city.pauseAtThreshold = state.intro === 'door' ? state.pauseAtThreshold : false;
        break;
      case 'animate': city.animated = state.animate === 'auto' ? 'auto' : state.animate === 'true'; break;
      case 'view': city.view = state.view; break;
      case 'interactive': city.interactive = state.interactive; break;
      case 'zoomable': city.zoomable = state.zoomable; break;
      case 'maxZoom': city.maxZoom = state.maxZoom; break;
      case 'wheelZoom': city.wheelZoom = state.wheelZoom; break;
      case 'errorCorrection': city.errorCorrection = state.errorCorrection; break;
      case 'quality': city.quality = state.quality; break;
      case 'fallback': city.fallback = state.fallback; break;
      case 'background': city.background = BACKGROUNDS[state.background]; break;
      case 'label': city.label = state.label; break;
      case 'doorLabel': city.doorLabel = state.doorLabel; break;
      case 'plaza': case 'plazaSize': case 'plazaImage': city.plaza = plazaOption(); break;
    }
    renderCode();
    syncUrl();
  }

  function set(partial: Partial<LabState>) {
    for (const k of Object.keys(partial) as (keyof LabState)[]) {
      if (partial[k] === undefined || state[k] === partial[k]) continue;
      (state as unknown as Record<string, unknown>)[k] = partial[k];
      apply(k);
    }
    for (const s of syncers) s();
  }

  // ---- Style ------------------------------------------------------------
  const modified = () => JSON.stringify(work) !== JSON.stringify(preset);
  const builtIn = () => preset.id in styles;
  const effectiveStyle = (): QrCityStyle | QrCityStyleId => (modified() || !builtIn() ? structuredClone(work) : (preset.id as QrCityStyleId));

  function applyStyle() {
    city.cityStyle = effectiveStyle();
    hooks.onStyle();
    renderCode();
    updateWarn();
    syncUrl();
  }

  function updateWarn() {
    const check = checkStyle(work);
    if (check.ok) {
      warn.textContent = '';
      delete warn.dataset.i18n;
      hooks.onWarn(null);
      return;
    }
    const vars = { ratio: new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(check.contrast) };
    setText(warn, 'warn.contrast', vars);
    hooks.onWarn({ key: 'warn.contrast', vars });
  }

  function selectPreset(id: string) {
    const next = presets.find((p) => p.id === id);
    if (!next) return;
    preset = next;
    work = structuredClone(next);
    for (const s of syncers) s();
    applyStyle();
  }

  // ---- Controls -----------------------------------------------------------
  const warn = el('p', { class: 'warn', role: 'status' });
  const field = (label: string, control: HTMLElement, id: string) => {
    const wrap = el('div', { class: 'field' });
    const l = el('label', { htmlFor: id, textContent: label });
    wrap.append(l, control);
    return wrap;
  };
  let uid = 0;
  const nextId = () => `lab-${uid++}`;

  function select<K extends keyof LabState>(key: K, label: string, options: [string, string][]) {
    const id = nextId();
    const s = el('select', { id });
    for (const [value, text] of options) s.append(el('option', { value, textContent: text }));
    s.addEventListener('change', () => set({ [key]: s.value } as Partial<LabState>));
    syncers.push(() => { s.value = String(state[key]); });
    return field(label, s, id);
  }
  function check<K extends keyof LabState>(key: K, label: string) {
    const id = nextId();
    const c = el('input', { id, type: 'checkbox' });
    c.addEventListener('change', () => set({ [key]: c.checked } as Partial<LabState>));
    syncers.push(() => { c.checked = Boolean(state[key]); });
    const wrap = el('div', { class: 'field check' });
    wrap.append(c, el('label', { htmlFor: id, textContent: label }));
    return wrap;
  }
  function text<K extends keyof LabState>(key: K, label: string, maxLength: number) {
    const id = nextId();
    const t = el('input', { id, type: 'text', maxLength, spellcheck: false });
    t.addEventListener('input', () => debounce(key, () => set({ [key]: t.value } as Partial<LabState>), 300));
    syncers.push(() => { if (document.activeElement !== t) t.value = String(state[key]); });
    return field(label, t, id);
  }
  function range<K extends keyof LabState>(key: K, label: string, min: number, max: number, step: number) {
    const id = nextId();
    const out = el('output');
    out.htmlFor.add(id);
    const r = el('input', { id, type: 'range', min: String(min), max: String(max), step: String(step) });
    r.addEventListener('input', () => { out.textContent = r.value; debounce(key, () => set({ [key]: Number(r.value) } as Partial<LabState>), 150); });
    syncers.push(() => { r.value = String(state[key]); out.textContent = r.value; });
    const wrap = field(label, r, id);
    wrap.querySelector('label')?.append(' ', out);
    return wrap;
  }
  function color(label: string, get: () => string, put: (v: string) => void) {
    const id = nextId();
    const c = el('input', { id, type: 'color' });
    c.addEventListener('input', () => { put(c.value); debounce('style', applyStyle); });
    syncers.push(() => { c.value = get(); });
    return field(label, c, id);
  }
  function styleSelect(label: string, get: () => string, put: (v: string) => void, options: [string, string][]) {
    const id = nextId();
    const s = el('select', { id });
    for (const [value, t] of options) s.append(el('option', { value, textContent: t }));
    s.addEventListener('change', () => { put(s.value); applyStyle(); });
    syncers.push(() => { s.value = get(); });
    return field(label, s, id);
  }
  function styleRange(label: string, get: () => number, put: (v: number) => void, min: number, max: number, step: number) {
    const id = nextId();
    const out = el('output');
    out.htmlFor.add(id);
    const r = el('input', { id, type: 'range', min: String(min), max: String(max), step: String(step) });
    r.addEventListener('input', () => { out.textContent = r.value; put(Number(r.value)); debounce('style', applyStyle); });
    syncers.push(() => { r.value = String(get()); out.textContent = r.value; });
    const wrap = field(label, r, id);
    wrap.querySelector('label')?.append(' ', out);
    return wrap;
  }

  const group = (title: string, open: boolean, ...controls: HTMLElement[]) => {
    const d = el('details', { class: 'group', open });
    d.append(el('summary', { textContent: title }), el('div', { class: 'fields' }, ...controls));
    return d;
  };

  /** The controls are written in the current language, so a language change builds them again. */
  function buildControls() {
    const wasOpen = [...root.querySelectorAll('details')].map((d) => d.open);
    syncers.length = 0;
    root.replaceChildren();

    const presetsBox = el('div', { class: 'opts' });
    presets.forEach((s) => {
      const label = el('label', { class: 'opt' });
      const input = el('input', { type: 'radio', name: 'lab-preset', value: s.id });
      input.addEventListener('change', () => selectPreset(s.id));
      syncers.push(() => { input.checked = s.id === preset.id; });
      const dots = el('span', { class: 'dots' });
      for (const c of [...s.palette.towers.slice(0, 3), s.palette.roof]) { const d = el('i'); d.style.background = c; dots.append(d); }
      label.append(input, dots, el('b', { textContent: t(`style.${s.id}.name` as Key) }));
      presetsBox.append(label);
    });
    const upload = (() => {
      const id = nextId();
      const f = el('input', { id, type: 'file', accept: 'image/*' });
      f.addEventListener('change', () => {
        const file = f.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          customImage = String(reader.result);
          if (state.plazaImage === 'custom' && state.plaza) apply('plazaImage');
          else set({ plaza: true, plazaImage: 'custom' });
        };
        reader.readAsDataURL(file);
      });
      return field(t('f.plazaUpload'), f, id);
    })();
    const reset = el('button', { type: 'button', textContent: t('b.reset') });
    reset.addEventListener('click', () => selectPreset(preset.id));

    const towerColors = [0, 1, 2, 3, 4, 5].map((i) =>
      color(t('f.tower', { n: i + 1 }), () => work.palette.towers[i] ?? work.palette.towers[0], (v) => { if (i < work.palette.towers.length) work.palette.towers[i] = v; }));
    const w = () => work;

    root.append(
      group(t('g.entry'), true,
        select('intro', t('f.intro'), [['door', t('o.door')], ['flyover', t('o.flyover')], ['none', t('o.none')]]),
        check('pauseAtThreshold', t('f.pause')),
        select('animate', t('f.animate'), [['auto', t('o.animAuto')], ['true', t('o.always')], ['false', t('o.never')]]),
      ),
      group(t('g.view'), false,
        select('view', t('f.view'), [['city', t('o.city')], ['qr', t('o.qr')]]),
        check('interactive', t('f.interactive')),
        check('zoomable', t('f.zoomable')),
        range('maxZoom', t('f.maxZoom'), 2, 16, 1),
        select('wheelZoom', t('f.wheel'), [['ctrl', t('o.ctrl')], ['always', t('o.always')], ['off', t('o.off')]]),
      ),
      group(t('g.qr'), false,
        text('data', t('f.data'), 300),
        select('errorCorrection', t('f.ec'), [['L', 'L · 7 %'], ['M', 'M · 15 %'], ['Q', 'Q · 25 %'], ['H', 'H · 30 %']]),
      ),
      group(t('g.quality'), false,
        select('quality', t('f.quality'), [['auto', t('o.auto')], ['low', t('o.low')], ['high', t('o.high')], ['ultra', t('o.ultra')]]),
        select('fallback', t('f.fallback'), [['qr', t('o.flatQr')], ['none', t('o.error')]]),
        select('background', t('f.background'), [['style', t('o.bgStyle')], ['transparent', t('o.transparent')], ['white', t('o.white')], ['black', t('o.black')]]),
      ),
      group(t('g.a11y'), false,
        text('label', t('f.label'), 120),
        text('doorLabel', t('f.doorLabel'), 120),
      ),
      group(t('g.plaza'), false,
        check('plaza', t('f.plaza')),
        range('plazaSize', t('f.plazaSize'), 0.1, 0.25, 0.01),
        select('plazaImage', t('f.plazaImage'), [['logo', t('o.plazaLogo')], ['none', t('o.plazaRose')], ['custom', t('o.plazaCustom')]]),
        upload,
        el('p', { class: 'tip', textContent: t('f.plazaTip') }),
      ),
      group(t('g.style'), true,
        presetsBox,
        warn,
      ),
      group(t('g.edit'), false,
        color(t('f.sky'), () => w().palette.sky, (v) => { w().palette.sky = v; }),
        color(t('f.ground'), () => w().palette.walk, (v) => { w().palette.walk = v; w().palette.ground = v; }),
        color(t('f.roads'), () => w().palette.road, (v) => { w().palette.road = v; }),
        color(t('f.roofs'), () => w().palette.roof, (v) => { w().palette.roof = v; }),
        color(t('f.windows'), () => w().buildings.windowColor, (v) => { w().buildings.windowColor = v; }),
        ...towerColors,
        styleRange(t('f.height'), () => w().buildings.heightMul, (v) => { w().buildings.heightMul = v; }, 0.3, 1.5, 0.05),
        styleRange(t('f.houses'), () => w().buildings.houseBias, (v) => { w().buildings.houseBias = v; }, 0, 1, 0.05),
        styleRange(t('f.skyscrapers'), () => w().buildings.skyBias, (v) => { w().buildings.skyBias = v; }, 0, 1, 0.05),
        styleSelect(t('f.vegetation'), () => w().vegetation.kind, (v) => { w().vegetation.kind = v as QrCityStyle['vegetation']['kind']; },
          [['round', t('o.trees')], ['palm', t('o.palms')], ['pine', t('o.pines')], ['neon', t('o.neon')]]),
        color(t('f.vegColor'), () => w().vegetation.colors[0] ?? '#a8d5b0', (v) => { w().vegetation.colors = [v, ...w().vegetation.colors.slice(1)]; }),
        color(t('f.carColor'), () => w().traffic.carColors[0] ?? '#f4a5a0', (v) => { w().traffic.carColors = [v, ...w().traffic.carColors.slice(1)]; }),
        styleSelect(t('f.fauna'), () => w().flyers.kind, (v) => { w().flyers.kind = v as QrCityStyle['flyers']['kind']; },
          [['birds', t('o.birds')], ['gulls', t('o.gulls')], ['drones', t('o.drones')], ['snow', t('o.snow')]]),
        color(t('f.faunaColor'), () => w().flyers.color, (v) => { w().flyers.color = v; }),
        reset,
      ),
    );
    root.querySelectorAll('details').forEach((d, i) => { if (wasOpen[i] !== undefined) d.open = wasOpen[i]; });
    for (const s of syncers) s();
  }
  buildControls();

  // ---- Code ------------------------------------------------------------------
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const pre = el('pre');
  const code = el('code');
  pre.append(code);
  const copy = el('button', { type: 'button', class: 'copy' });
  setText(copy, 'c.copy');
  let framework: Framework = 'element';
  const tabButtons = new Map<Framework, HTMLButtonElement>();
  for (const f of FRAMEWORKS) {
    const b = el('button', { type: 'button', textContent: f.label, role: 'tab' });
    b.setAttribute('aria-selected', String(f.id === framework));
    b.addEventListener('click', () => {
      framework = f.id;
      for (const [id, btn] of tabButtons) btn.setAttribute('aria-selected', String(id === framework));
      renderCode();
    });
    tabButtons.set(f.id, b);
    tabs.append(b);
  }
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      setText(copy, 'c.copied');
    } catch {
      setText(copy, 'c.failed');
    }
    setTimeout(() => { setText(copy, 'c.copy'); }, 1500);
  });
  const codeBox = document.getElementById('code-box');
  codeBox?.append(tabs, pre, copy);

  /** The style as the snippets need it: an id, or a custom object with only what changed from its base. */
  function styleSnippet(): { ref: string | null; decl: string } {
    if (!modified() && builtIn()) return { ref: preset.id, decl: '' };
    const base = styles[baseOf(preset)] as unknown as Record<string, Record<string, unknown>>;
    const mine = work as unknown as Record<string, Record<string, unknown>>;
    const parts: string[] = [];
    for (const g of ['palette', 'buildings', 'vegetation', 'traffic', 'flyers']) {
      const changed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(mine[g])) if (JSON.stringify(v) !== JSON.stringify(base[g][k])) changed[k] = v;
      if (Object.keys(changed).length) parts.push(`  ${g}: { ...styles.${baseOf(preset)}.${g}, ${Object.entries(changed).map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} },`);
    }
    const decl = `const ${t('c.myStyle')} = {\n  ...styles.${baseOf(preset)},\n${parts.join('\n')}\n};`;
    return { ref: null, decl };
  }

  function renderCode() {
    if (!codeBox) return;
    type P = { key: keyof LabState | 'style'; value: string | number | boolean };
    const props: P[] = [{ key: 'data', value: state.data }];
    const st = styleSnippet();
    const mine = t('c.myStyle');
    props.push({ key: 'style', value: st.ref ?? mine });
    for (const k of ['intro', 'pauseAtThreshold', 'view', 'errorCorrection', 'quality', 'interactive', 'animate', 'background', 'zoomable', 'maxZoom', 'wheelZoom', 'fallback', 'label', 'doorLabel'] as const) {
      if (k === 'errorCorrection' && state.plaza) continue; // the plaza forces 'H'
      if (k === 'pauseAtThreshold' && state.intro !== 'door') continue;
      if (state[k] !== LIB[k]) {
        const value = k === 'animate' ? state.animate === 'true' : k === 'background' ? BACKGROUNDS[state.background] ?? '' : state[k];
        props.push({ key: k, value });
      }
    }
    const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    // The plaza as each framework writes it: an object, or three attributes on the element.
    const plazaImage = state.plazaImage === 'logo' ? PLAZA_LOGO : state.plazaImage === 'custom' ? t('c.yourLogo') : null;
    const plazaObj = state.plaza ? `{ ${plazaImage ? `image: '${plazaImage}', ` : ''}size: ${state.plazaSize} }` : null;
    const plazaAttrs = state.plaza ? ['plaza', ...(plazaImage ? [`plaza-image="${plazaImage}"`] : []), `plaza-size="${state.plazaSize}"`] : [];
    const ultra = state.quality === 'ultra' ? `import '@qr-city/core/ultra'; // ${t('c.ultra')}\n` : '';
    const custom = st.ref === null;
    const out: string[] = [];

    if (framework === 'element') {
      const attrs = props.map(({ key, value }) => {
        const name = key === 'style' ? 'style-name' : kebab(key);
        if (key === 'style' && custom) return null;
        if (value === true) return name;
        return `${name}="${value}"`;
      }).filter(Boolean);
      attrs.push(...plazaAttrs);
      out.push('npm i @qr-city/element three', '', '<script type="module">', `  ${ultra}import '@qr-city/element/define';`);
      if (custom) out.push('  import { styles } from \'@qr-city/core\';', ...st.decl.split('\n').map((l) => `  ${l}`), `  document.querySelector('qr-city').cityStyle = ${mine};`);
      out.push('</script>', '', `<qr-city ${attrs.join('\n         ')}></qr-city>`);
    } else if (framework === 'react') {
      const jsx = props.map(({ key, value }) => {
        const name = key === 'style' ? 'cityStyle' : key;
        if (key === 'style') return custom ? `${name}={${mine}}` : `${name}="${value}"`;
        if (value === true) return name;
        return typeof value === 'string' ? `${name}="${value}"` : `${name}={${value}}`;
      });
      if (plazaObj) jsx.push(`plaza={${plazaObj}}`);
      out.push('npm i @qr-city/react three', '', `${ultra}import { QrCity } from '@qr-city/react';`);
      if (custom) out.push("import { styles } from '@qr-city/core';", '', st.decl);
      out.push('', `export function ${t('c.component')}() {`, '  return (', '    <QrCity', ...jsx.map((l) => `      ${l}`), '    />', '  );', '}');
    } else if (framework === 'vue') {
      const attrs = props.map(({ key, value }) => {
        const name = key === 'style' ? 'city-style' : kebab(key);
        if (key === 'style') return custom ? `:${name}="${mine}"` : `${name}="${value}"`;
        if (value === true) return name;
        return typeof value === 'string' ? `${name}="${value}"` : `:${name}="${value}"`;
      });
      if (plazaObj) attrs.push(`:plaza="${plazaObj}"`);
      out.push('npm i @qr-city/vue three', '', '<script setup lang="ts">', `${ultra}import { QrCity } from '@qr-city/vue';`);
      if (custom) out.push("import { styles } from '@qr-city/core';", '', st.decl);
      out.push('</script>', '', '<template>', '  <QrCity', ...attrs.map((l) => `    ${l}`), '  />', '</template>');
    } else if (framework === 'angular') {
      const attrs = props.map(({ key, value }) => {
        const name = key === 'style' ? 'cityStyle' : key;
        if (key === 'style') return custom ? `[${name}]="${mine}"` : `${name}="${value}"`;
        return typeof value === 'string' ? `${name}="${value}"` : `[${name}]="${value}"`;
      });
      if (plazaObj) attrs.push(`[plaza]="${plazaObj}"`);
      out.push('npm i @qr-city/angular three', '', `${ultra}import { Component } from '@angular/core';`, "import { QrCityComponent } from '@qr-city/angular';");
      if (custom) out.push("import { styles } from '@qr-city/core';", '', st.decl);
      out.push('', '@Component({', `  selector: '${t('c.selector')}',`, '  imports: [QrCityComponent],', '  template: `', '    <qr-city-view', ...attrs.map((l) => `      ${l}`), '    />', '  `,', '})', `export class ${t('c.component')}Component {${custom ? `\n  ${mine} = ${mine};\n` : ''}}`);
    } else {
      const rows = props.map(({ key, value }) => {
        const name = key === 'style' ? 'style' : key;
        if (key === 'style') return `  style: ${custom ? mine : `'${value}'`},`;
        return `  ${name}: ${typeof value === 'string' ? `'${value}'` : value},`;
      });
      if (plazaObj) rows.push(`  plaza: ${plazaObj},`);
      out.push('npm i @qr-city/core three', '', `${ultra}import { createQrCity${custom ? ', styles' : ''} } from '@qr-city/core';`);
      if (custom) out.push('', st.decl);
      out.push('', 'const city = createQrCity(document.querySelector(\'#host\'), {', ...rows, '});');
    }
    code.textContent = out.join('\n');
  }

  for (const s of syncers) s();
  renderCode();

  /** Pushes the whole state (which may come from a link) to the element, before it is defined. */
  function pushAll() {
    city.data = state.data;
    city.pauseAtThreshold = state.intro === 'door' ? state.pauseAtThreshold : false;
    city.intro = state.intro;
    city.animated = state.animate === 'auto' ? 'auto' : state.animate === 'true';
    city.view = state.view;
    city.interactive = state.interactive;
    city.zoomable = state.zoomable;
    city.maxZoom = state.maxZoom;
    city.wheelZoom = state.wheelZoom;
    city.errorCorrection = state.errorCorrection;
    city.quality = state.quality;
    city.fallback = state.fallback;
    city.background = BACKGROUNDS[state.background];
    city.label = state.label;
    city.doorLabel = state.doorLabel;
    city.plaza = plazaOption();
  }

  return {
    state,
    set,
    selectPreset,
    start() {
      pushAll();
      applyStyle();
    },
    shareUrl,
    refreshLanguage() {
      // The two accessible names follow the language while they still hold a default text.
      const next: Partial<LabState> = {};
      if (isDefaultText('city.label', state.label)) next.label = t('city.label');
      if (isDefaultText('city.doorLabel', state.doorLabel)) next.doorLabel = t('city.doorLabel');
      set(next);
      buildControls();
      updateWarn();
      renderCode();
      syncUrl();
    },
    startFlyover() {
      committed = 'flyover';
      city.pauseAtThreshold = false;
      city.intro = 'flyover';
      hooks.onRestart();
    },
    cancelAsk() {
      if (state.intro === committed) return;
      state.intro = committed;
      for (const s of syncers) s();
      renderCode();
    },
    get preset() { return preset; },
  };
}
