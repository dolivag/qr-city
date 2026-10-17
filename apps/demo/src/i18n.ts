/** Demo language (Spanish / English) and colour theme, both remembered in this browser. */
import { catalogs, LANGS } from './catalog';
import type { Key, Lang } from './catalog';

export type { Key, Lang } from './catalog';
export { LANGS } from './catalog';
export type Theme = 'auto' | 'light' | 'dark';

const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en';
const isTheme = (v: unknown): v is Theme => v === 'auto' || v === 'light' || v === 'dark';

function stored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: the choice just is not remembered */ }
}

/** The language a page path is published in: `/en/` is the English page, anything else Spanish. */
const pathLang = (): Lang => (/^\/en(\/|$)/.test(location.pathname) ? 'en' : 'es');

function detectLang(): Lang {
  const fromLink = new URLSearchParams(location.search).get('lang');
  if (isLang(fromLink)) return fromLink;
  if (pathLang() === 'en') return 'en';
  const saved = stored('qr-city-lang');
  if (isLang(saved)) return saved;
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

let lang: Lang = detectLang();
let theme: Theme = isTheme(stored('qr-city-theme')) ? (stored('qr-city-theme') as Theme) : 'auto';
const listeners = new Set<() => void>();

export const getLang = () => lang;
export const getTheme = () => theme;
/** Calls `fn` whenever the language or the theme changes. */
export const onChange = (fn: () => void) => { listeners.add(fn); };

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return catalogs[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
/** The text a key had in the other languages too: lets the demo tell whether a field still holds its default. */
export const isDefaultText = (key: Key, value: string) => LANGS.some((l) => catalogs[l][key] === value);

/** Sets the text of an element and remembers its key, so it follows the language from then on. */
export function setText(node: HTMLElement, key: Key, vars?: Record<string, string | number>) {
  node.dataset.i18n = key;
  if (vars) node.dataset.i18nVars = JSON.stringify(vars);
  else delete node.dataset.i18nVars;
  render(node);
}

function render(node: HTMLElement) {
  const key = node.dataset.i18n as Key | undefined;
  if (!key) return;
  const vars = node.dataset.i18nVars ? (JSON.parse(node.dataset.i18nVars) as Record<string, string | number>) : {};
  const text = t(key, vars);
  if (node.dataset.i18nHtml !== undefined) node.innerHTML = text;
  else node.textContent = text;
}

/** Translates the static markup: `data-i18n`, `data-i18n-html` and `data-i18n-attr="attr:key;attr:key"`. */
function translateDocument() {
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) render(node);
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of (node.dataset.i18nAttr ?? '').split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) node.setAttribute(attr, t(key as Key));
    }
  }
}

/** Each language has its own page (`/` and `/en/`): moves to it, so a reload or a copied address keeps the language. */
function syncPath() {
  if (pathLang() === lang) return;
  const query = new URLSearchParams(location.search);
  query.delete('lang');
  const search = query.toString();
  history.replaceState(history.state, '', `${lang === 'en' ? '/en/' : '/'}${search ? `?${search}` : ''}${location.hash}`);
}

function paintTheme() {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1A1916' : '#EFEBE2');
}

function paint() {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', lang === 'en' ? 'en_GB' : 'es_ES');
  translateDocument();
  paintTheme();
}

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  store('qr-city-lang', next);
  syncPath();
  paint();
  for (const fn of listeners) fn();
}

export function setTheme(next: Theme) {
  theme = next;
  store('qr-city-theme', next);
  paintTheme();
  for (const fn of listeners) fn();
}

/** Paints the language and theme in the page: call once, before the rest of the demo runs. */
export function initI18n() {
  syncPath();
  paint();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (theme === 'auto') paintTheme(); });
}
