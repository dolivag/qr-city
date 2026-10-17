import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { catalogs } from './src/catalog';
import type { Key } from './src/catalog';

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
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(en['doc.title'])}</title>`);
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

export default defineConfig({ build: { target: 'es2022' }, plugins: [englishPagePlugin()] });
