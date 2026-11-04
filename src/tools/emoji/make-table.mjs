// Writes table.ts, F-309's emoji, from Emojibase (emojibase-data, MIT; its names and keywords are
// Unicode CLDR's annotations, Unicode License v3), in Emojibase's order: the emoji, its group, the
// Emoji version it came with, the English and German name, GitHub's shortcodes, the keywords of both
// languages and its emoticons (for search), and its five skin tones when it has them. The skin-tone
// swatches and hair parts (group 2) and the regional letters (no group) are left out; of the
// two-person emoji only the five with one tone for both are kept. Run it again after updating
// emojibase-data: node src/tools/emoji/make-table.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const load = (path) => JSON.parse(readFileSync(require.resolve(`emojibase-data/${path}`), 'utf8'));
const en = load('en/data.json');
const de = new Map(load('de/data.json').map((e) => [e.hexcode, e]));
const github = load('en/shortcodes/github.json');
const { version } = load('package.json');

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const rows = en
  .filter((e) => e.group != null && e.group !== 2)
  .sort((a, b) => a.order - b.order)
  .map((e) => {
    const d = de.get(e.hexcode);
    const codes = list(github[e.hexcode]);
    const terms = [...new Set([...list(e.tags), ...list(d?.tags), ...list(e.emoticon)].map((s) => s.toLowerCase()))];
    const tones = e.skins ? [1, 2, 3, 4, 5].map((t) => e.skins.find((s) => s.tone === t)?.emoji ?? '') : [];
    return [e.emoji, e.group, e.version, e.label, d?.label ?? e.label, codes.join(' '), terms.join('|'), tones.every(Boolean) ? tones.join(' ') : ''];
  });

const out = `// F-309's emoji, written by make-table.mjs from emojibase-data ${version} (MIT; names and keywords from
// Unicode CLDR, Unicode License v3). Don't edit by hand: run node src/tools/emoji/make-table.mjs.
// [emoji, group, Emoji version, English name, German name, GitHub shortcodes, keywords and emoticons
// of both languages joined by |, the five skin tones joined by spaces or '']

export type Row = [emoji: string, group: number, version: number, en: string, de: string, shortcodes: string, terms: string, tones: string];

export const ROWS: Row[] = [
${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}
];
`;
writeFileSync(new URL('./table.ts', import.meta.url), out);
console.log(`${rows.length} emoji, ${(out.length / 1024).toFixed(0)} KB`);
