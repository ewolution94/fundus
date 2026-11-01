// Each address gets its own head: a tool's page is found by search engines and shared in chats, so
// its title, description and link preview name the tool, not just Fundus. The page itself is the
// same document everywhere; the app reads the address and opens the tool.

import { TOOLS, CHIPS, articleNo, toolByPath } from '../shared/catalog.mjs';

const SITE = {
  en: { title: 'Fundus', desc: 'Everyday tools that run on your device: photos, PDFs, text, numbers, time and audio. Nothing you put in leaves it.' },
  de: { title: 'Fundus', desc: 'Werkzeuge für jeden Tag, die auf deinem Gerät laufen: Fotos, PDFs, Text, Zahlen, Zeit und Audio. Nichts, was du hineingibst, verlässt es.' },
};
const LICENCES = { en: 'Licences', de: 'Lizenzen' };
const LOCAL = { en: 'Runs on your device.', de: 'Läuft auf deinem Gerät.' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** @param {{ origin: string }} options */
export function createPages({ origin }) {
  /** What an address is: its status, title, description and canonical URL. */
  function describe(pathname, lang) {
    const p = pathname.replace(/\/+$/, '') || '/';
    if (p === '/') return { status: 200, title: SITE[lang].title, desc: SITE[lang].desc, url: `${origin}/` };
    if (p === '/licences') return { status: 200, title: `${LICENCES[lang]} · Fundus`, desc: SITE[lang].desc, url: `${origin}/licences` };
    const tool = toolByPath(p);
    if (tool) {
      const chip = CHIPS.find((c) => c.id === tool.chip);
      return {
        status: 200,
        title: `${tool.name[lang]} · Fundus`,
        desc: `${tool.desc[lang]} ${LOCAL[lang]} ${articleNo(tool)}, ${chip.name[lang]}.`,
        url: `${origin}/${tool.path}`,
      };
    }
    return { status: 404, title: SITE[lang].title, desc: SITE[lang].desc, url: `${origin}/` };
  }

  return {
    describe,
    /** The built index.html with this address's head written in. */
    render(template, pathname, lang = 'en') {
      const page = describe(pathname, lang);
      const html = template
        .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(page.desc)}"`)
        .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(page.title)}"`)
        .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(page.desc)}"`)
        .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${esc(page.url)}"`)
        .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${esc(page.url)}"`);
      return { status: page.status, html };
    },
    /** Every page a search engine should know. The developer shelf is listed too: it's public, only
     *  tucked away in the app. */
    sitemap() {
      const urls = ['/', ...TOOLS.map((t) => `/${t.path}`)];
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${origin}${u === '/' ? '/' : u}</loc></url>`).join('\n')}\n</urlset>\n`;
    },
  };
}
