// F-309's logic: the emoji from table.ts as entries, search in both languages (a name, a keyword, a
// :shortcode:, a code point, the emoji itself), the five skin tones, and an emoji's codes for HTML,
// CSS and JavaScript. No DOM: what the device can draw is support.ts's.

import { ROWS, type Row } from './table.ts';

/** Unicode's groups in its order; 2 (skin-tone swatches, hair parts) isn't one people pick from. */
export const GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9] as const;

export type Lang = 'en' | 'de';

export interface Emoji {
  emoji: string;
  group: number;
  version: number;
  name: Record<Lang, string>;
  shortcodes: string[];
  /** The five skin tones, light to dark, or none. */
  tones: string[] | null;
  /** Its place in Unicode's order. */
  order: number;
  /** For search, folded: the names, each word of them, the keywords. */
  names: Record<Lang, string>;
  nameWords: Record<Lang, string[]>;
  terms: string[];
}

/** Lower case, without accents (lächeln finds lacheln and back), ß as ss. */
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss');

const VS16 = /️/g;
/** The emoji without its presentation selector, to compare emoji however they were typed. */
const bare = (s: string) => s.replace(VS16, '');

export function entries(rows: Row[] = ROWS): Emoji[] {
  return rows.map(([emoji, group, version, en, de, shortcodes, terms, tones], order) => ({
    emoji,
    group,
    version,
    name: { en, de },
    shortcodes: shortcodes ? shortcodes.split(' ') : [],
    tones: tones ? tones.split(' ') : null,
    order,
    names: { en: fold(en), de: fold(de) },
    nameWords: { en: fold(en).split(/[\s:,.()“”-]+/).filter(Boolean), de: fold(de).split(/[\s:,.()“”-]+/).filter(Boolean) },
    terms: terms ? terms.split('|').map(fold) : [],
  }));
}

/** The emoji in a skin tone (1 light … 5 dark); 0, or an emoji without tones, as it is. */
export const withTone = (e: Emoji, tone: number) => (tone >= 1 && tone <= 5 && e.tones ? e.tones[tone - 1] : e.emoji);

export const codePoints = (s: string) => [...s].map((c) => c.codePointAt(0)!);
const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

/** An emoji written out: its code points, and as HTML, CSS (`content`) and JavaScript would. */
export function codes(s: string) {
  const cps = codePoints(s);
  return {
    unicode: cps.map((n) => `U+${hex(n)}`).join(' '),
    html: cps.map((n) => `&#x${hex(n)};`).join(''),
    css: `"${cps.map((n) => `\\${hex(n)}`).join(' ')}"`,
    js: cps.map((n) => `\\u{${hex(n)}}`).join(''),
  };
}

/** The entry an emoji belongs to, in any skin tone, with or without its presentation selector. */
export function find(list: Emoji[], s: string): Emoji | undefined {
  const b = bare(s);
  return list.find((e) => bare(e.emoji) === b || e.tones?.some((t) => bare(t) === b));
}

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const CODE_POINT = /^(?:u\+|0x|\\u\{?)?([0-9a-f]{4,6})\}?$/;

/**
 * What a search finds, best first: a name that is the search, then names with the search's words as
 * whole words, then names with words that start with them (the page's language before the other),
 * then keywords and shortcodes, then names and keywords that only hold them. Every word of the search
 * has to be found; among equals the shorter name comes first ("rotes Herz" before "Herz mit Pfeil").
 * Emoji in the search find themselves; "U+1F600" or "1f600" finds its emoji; ":tada" a shortcode.
 */
export function search(list: Emoji[], query: string, lang: Lang): Emoji[] {
  const q = fold(query.trim());
  if (!q) return [];
  if (PICTOGRAPHIC.test(query)) {
    const seen = new Set<Emoji>();
    for (const part of query.match(/\P{White_Space}+/gu) ?? []) {
      for (const e of list) if (part.includes(bare(e.emoji)) || e.tones?.some((t) => part.includes(bare(t)))) seen.add(e);
    }
    return [...seen];
  }
  const cp = q.match(CODE_POINT);
  if (cp) {
    const n = parseInt(cp[1], 16);
    const hits = list.filter((e) => codePoints(e.emoji)[0] === n);
    if (hits.length) return hits;
  }
  if (q.startsWith(':')) {
    const code = q.replace(/:/g, '');
    return list.filter((e) => e.shortcodes.some((s) => s.startsWith(code))).sort((a, b) => Number(!a.shortcodes.includes(code)) - Number(!b.shortcodes.includes(code)) || a.order - b.order);
  }
  const other: Lang = lang === 'de' ? 'en' : 'de';
  const words = q.split(/\s+/);
  const scored: [number, Emoji][] = [];
  for (const e of list) {
    let score = 0;
    if (e.names[lang] === q) score = -20;
    else if (e.names[other] === q) score = -19;
    else {
      for (const word of words) {
        const s = rank(e, word, lang, other);
        if (s == null) {
          score = NaN;
          break;
        }
        score += s;
      }
    }
    if (!Number.isNaN(score)) scored.push([score, e]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].names[lang].length - b[1].names[lang].length || a[1].order - b[1].order).map(([, e]) => e);
}

function rank(e: Emoji, word: string, lang: Lang, other: Lang): number | null {
  if (e.nameWords[lang].includes(word)) return 0;
  if (e.nameWords[lang].some((n) => n.startsWith(word))) return 1;
  if (e.nameWords[other].includes(word)) return 2;
  if (e.nameWords[other].some((n) => n.startsWith(word))) return 3;
  if (e.terms.includes(word)) return 4;
  if (e.terms.some((t) => t.startsWith(word)) || e.shortcodes.some((s) => s.startsWith(word))) return 5;
  if (e.names[lang].includes(word) || e.names[other].includes(word)) return 6;
  if (word.length >= 3 && e.terms.some((t) => t.includes(word))) return 7;
  return null;
}

/**
 * One emoji of each newer Emoji version, newest first, for asking the device which it can draw: one
 * made of a single code point where the version has one (an unknown one shows as a box), else its
 * first (an unknown sequence falls apart into its parts).
 */
export function samples(list: Emoji[], from = 12): [number, string][] {
  const by = new Map<number, Emoji[]>();
  for (const e of list) if (e.version >= from) by.set(e.version, [...(by.get(e.version) ?? []), e]);
  return [...by.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([v, es]) => [v, (es.find((e) => codePoints(bare(e.emoji)).length === 1) ?? es[0]).emoji]);
}

/** A name as a heading: its first letter a capital ("grinsendes Gesicht" → "Grinsendes Gesicht"). */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The Emoji version as people read it: the first emoji (0.6, 0.7) came with 1.0. */
export const versionLabel = (v: number) => (v < 1 ? '1.0' : Number.isInteger(v) ? `${v}.0` : String(v));
