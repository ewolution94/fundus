// A contact sheet of the tools' specimen plates (src/tools/<id>/plate.ts), drawn in full, for checking
// them by eye: each at the head's size on a computer (208 px) and on a phone (152 px, its notes
// bigger for its size, as ToolHead sets them), in both languages, light and dark.
//
//   node tests/plates/sheet.mjs [ids…] [--de] [--dark] [--at s]
//
// Writes test-results/plates[-de][-dark].png. With --at, every plate is caught that many seconds
// into its draw instead (a check of the timing).

import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { TOOLS, CHIPS } from '../../shared/catalog.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const lang = args.includes('--de') ? 'de' : 'en';
const dark = args.includes('--dark');
const at = args.includes('--at') ? Number(args[args.indexOf('--at') + 1]) : null;
const ids = args.filter((a) => /^[a-z][a-z0-9]*$/.test(a));

const tools = TOOLS.filter((t) => !ids.length || ids.includes(t.id));
const cells = [];
const missing = [];
for (const tool of tools) {
  const file = path.join(root, 'src/tools', tool.id, 'plate.ts');
  let svg;
  try {
    svg = (await import(pathToFileURL(file).href)).default(lang);
  } catch (e) {
    missing.push(`${tool.id}: ${e.code === 'ERR_MODULE_NOT_FOUND' ? 'no plate.ts' : e.message}`);
    continue;
  }
  const shelf = CHIPS.find((c) => c.id === tool.chip).name[lang];
  // The phone's plate draws its lines and notes bigger for its size, as ToolHead sets them.
  const plate = (w) => `<figure class="specimen${w < 200 ? ' phone' : ''}" style="width:${w}px"><span class="fig${at != null ? ' drawing' : ''}"><svg viewBox="0 0 160 120" aria-hidden="true">${svg}</svg></span><figcaption class="cap"><span class="no">${lang === 'de' ? 'Abb.' : 'Fig.'} ${tool.no}</span><span class="sh">${shelf}</span></figcaption></figure>`;
  cells.push(`<div class="cell" data-id="${tool.id}"><p>F-${tool.no} ${tool.name[lang]}</p><div class="two">${plate(208)}${plate(152)}</div></div>`);
}

// The app's own faces, inlined: a page set from a string can't load files.
const face = async (family, file, weight) =>
  `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${(await readFile(path.join(root, 'node_modules', file))).toString('base64')}) format('woff2'); }`;
const faces = [
  await face('Martian Mono Variable', '@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2', '100 800'),
  await face('Schibsted Grotesk Variable', '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2', '400 900'),
  await face('Anton', '@fontsource/anton/files/anton-latin-400-normal.woff2', 400),
].join('\n');
const css = await readFile(path.join(root, 'src/components/specimen.css'), 'utf8');
const html = `<!doctype html><meta charset="utf-8">
<style>
  ${faces}
  :root { color-scheme: ${dark ? 'dark' : 'light'};
    --bg: light-dark(#f5f5f2, #131313); --card: light-dark(#ffffff, #1b1b1a); --ink: light-dark(#121212, #eeeeea);
    --ink-2: light-dark(#53534f, #a9a9a3); --rule: light-dark(#d4d4ce, #393936); --mark: light-dark(#ffe14a, #e9cb35); --mark-ink: #121212;
    --sans: 'Schibsted Grotesk Variable', sans-serif; --mono: 'Martian Mono Variable', monospace; }
  body { margin: 0; padding: 20px; background: var(--bg); color: var(--ink); font: 13px var(--sans); }
  .grid { display: grid; grid-template-columns: repeat(4, max-content); gap: 22px 28px; }
  .cell p { margin: 0 0 6px; font-weight: 600; }
  .two { display: flex; gap: 12px; align-items: start; }
  .specimen.phone { --ow: 1.6; --cw: 0.75; --af: 9.6px; --kf: 10.2px; }
  .specimen.phone .sh { display: none; }
  ${at != null ? `.specimen .drawing * { animation-play-state: paused !important; animation-delay: calc(var(--d, 0s) - ${at}s) !important; }` : ''}
  ${css}
</style>
<div class="grid">${cells.join('')}</div>`;

await mkdir(path.join(root, 'test-results'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1640, height: 900 }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const loaded = await page.evaluate(() => document.fonts.check('10px "Martian Mono Variable"'));
if (!loaded) errors.push('Martian Mono did not load');
// Notes that run off the plate, at either size.
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('.cell')].flatMap((cell) =>
    [...cell.querySelectorAll('.specimen')].flatMap((plate) =>
      [...plate.querySelectorAll('svg text')].flatMap((text) => {
        const b = text.getBBox();
        const out = b.x < 2 || b.x + b.width > 158 || b.y < 2 || b.y + b.height > 118;
        return out ? [`${cell.dataset.id} at ${Math.round(plate.getBoundingClientRect().width)} px: "${text.textContent}" spans x ${b.x.toFixed(1)}–${(b.x + b.width).toFixed(1)}, y ${b.y.toFixed(1)}–${(b.y + b.height).toFixed(1)} (the plate is 0–160 × 0–120)`] : [];
      }),
    ),
  ),
);
const out = path.join(root, 'test-results', `plates${ids.length ? '-' + ids.join('-') : ''}${lang === 'de' ? '-de' : ''}${dark ? '-dark' : ''}${at != null ? '-at' + at : ''}.png`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${cells.length} plate(s): ${out}`);
if (missing.length) console.log(`not drawn:\n  ${missing.join('\n  ')}`);
if (overflow.length) console.log(`off the plate:\n  ${overflow.join('\n  ')}`);
if (errors.length) console.log(`errors:\n  ${errors.join('\n  ')}`);
