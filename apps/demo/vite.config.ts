import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { catalogs } from './src/catalog';
import type { Key, Lang } from './src/catalog';

const SITE = 'https://qr-city.danioliva.dev';
const en = catalogs.en;
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The English page, written from the Spanish one at build time: search engines and link previews
 * read the static HTML, so `/en/` must already carry the English texts before any script runs.
 */
export function englishPage(html: string): string {
  let out = html
    .replace('<html lang="es">', '<html lang="en">')
    .replace(`<link rel="canonical" href="${SITE}/" />`, `<link rel="canonical" href="${SITE}/en/" />`)
    .replace('<meta property="og:locale" content="es_ES" />', '<meta property="og:locale" content="en_GB" />')
    .replace(`<meta property="og:url" content="${SITE}/" />`, `<meta property="og:url" content="${SITE}/en/" />`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(en['doc.title'])}</title>`)
    .replace('<link rel="manifest" href="/manifest.webmanifest" />', '<link rel="manifest" href="/en/manifest.webmanifest" />');
  // Text of the elements marked with data-i18n (as HTML when they also carry data-i18n-html).
  out = out.replace(/<(\w+)([^>]*\sdata-i18n="([\w.]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_, tag: string, attrs: string, key: string) => {
    const text = en[key as Key];
    if (text === undefined) throw new Error(`Missing English text: ${key}`);
    return `<${tag}${attrs}>${attrs.includes('data-i18n-html') ? text : escape(text)}</${tag}>`;
  });
  // Attributes listed in data-i18n-attr="attr:key;attr:key".
  out = out.replace(/<[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tag: string, list: string) => {
    for (const pair of list.split(';')) {
      const [attr, key] = pair.split(':');
      const text = en[key as Key];
      if (text === undefined) throw new Error(`Missing English text: ${key}`);
      tag = tag.replace(new RegExp(`\\s${attr}="[^"]*"`), ` ${attr}="${escape(text)}"`);
    }
    return tag;
  });
  return out;
}

/** The web app manifest of each page: installing from `/en/` gives the English app. */
function manifest(lang: Lang): string {
  const text = catalogs[lang];
  const start = lang === 'en' ? '/en/' : '/';
  return JSON.stringify({
    id: start,
    name: text['doc.title'],
    short_name: text['doc.title'],
    description: text['og.description'],
    lang,
    start_url: start,
    scope: '/',
    display: 'standalone',
    background_color: '#EFEBE2',
    theme_color: '#EFEBE2',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2);
}

/** Files under `public/`, as the site serves them. */
function publicFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path) : [relative(PUBLIC, path).split('\\').join('/')];
  });
}
const PUBLIC = join(import.meta.dirname, 'public');

/**
 * The service worker, written with the list of files of this build: it keeps them all, so the demo
 * works offline once it has been opened. Pages go to the network first (always the latest version);
 * the rest comes from the cache (file names carry a content hash, so they never go stale).
 */
function serviceWorker(files: string[], version: string): string {
  return `// Generated at build time (vite.config.ts).
const CACHE = 'qr-city-${version}';
const PRECACHE = ${JSON.stringify(files.map((f) => '/' + f.replace(/(^|\/)index\.html$/, '$1')))};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('qr-city-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // The page for that language, fresh when there is network and from the cache when there is not
    const page = /^[/]en([/]|$)/.test(url.pathname) ? '/en/' : '/';
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(page, response.clone()));
          return response;
        })
        .catch(() => caches.match(page).then((hit) => hit || Response.error())),
    );
    return;
  }
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })),
  );
});
`;
}

/** Files worth keeping offline: everything but old font formats, unused font subsets and the share image. */
const offline = (file: string) => !/\.woff$/.test(file) && !/vietnamese/.test(file) && file !== 'og.jpg' && file !== 'sw.js';

function pwaPlugin(): Plugin {
  return {
    name: 'demo-pwa',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/(en\/)?manifest\.webmanifest$/);
        if (!m) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest(m[1] ? 'en' : 'es'));
      });
    },
    generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest('es') });
      this.emitFile({ type: 'asset', fileName: 'en/manifest.webmanifest', source: manifest('en') });
      const files = [...Object.keys(bundle), ...publicFiles(PUBLIC)].filter(offline).sort();
      // The cache version follows the content, so a file changed under the same name is fetched again
      const hash = createHash('sha256');
      for (const out of Object.values(bundle)) hash.update(out.type === 'chunk' ? out.code : out.source);
      for (const f of publicFiles(PUBLIC)) hash.update(readFileSync(join(PUBLIC, f)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(files, hash.digest('hex').slice(0, 12)) });
    },
  };
}

function englishPagePlugin(): Plugin {
  return {
    name: 'demo-english-page',
    enforce: 'post',
    // In development, /en/ is served by the same page (the language is read from the path).
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/en(\/|\?|$)/.test(req.url)) req.url = req.url.replace(/^\/en\/?/, '/');
        next();
      });
    },
    generateBundle(_options, bundle) {
      const page = bundle['index.html'];
      if (page?.type !== 'asset') return;
      this.emitFile({ type: 'asset', fileName: 'en/index.html', source: englishPage(String(page.source)) });
    },
  };
}

export default defineConfig({ build: { target: 'es2022' }, plugins: [englishPagePlugin(), pwaPlugin()] });
