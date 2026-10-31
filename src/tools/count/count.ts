// What Count words counts. Plain TypeScript with erasable types, tested in node.
//
// Characters are graphemes (what a reader sees as one: 👍🏽, a family emoji, an é typed as e plus
// its accent), words come from Intl.Segmenter's word granularity (German compounds are one word,
// emoji and punctuation none), with hyphenated compounds kept whole ("E-Mail-Adresse" is one word,
// as word processors count it). Sentences come from its sentence granularity.

import { unixLines } from '../../lib/textfile.ts';

/** Words a minute: reading silently, and speaking aloud. */
export const READ_WPM = 230;
export const SPEAK_WPM = 130;

export interface Counts {
  words: number;
  characters: number;
  /** Characters that aren't spaces, tabs or line breaks. */
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  /** Seconds. */
  reading: number;
  speaking: number;
}

const segmenters = new Map<string, Intl.Segmenter>();
function segmenter(locale: string, granularity: 'grapheme' | 'word' | 'sentence'): Intl.Segmenter {
  const key = `${locale}|${granularity}`;
  let s = segmenters.get(key);
  if (!s) segmenters.set(key, (s = new Intl.Segmenter(locale, { granularity })));
  return s;
}

/** A hyphen between two word parts with no space: one word ("well-known", "E-Mail"). */
const JOINER = /^[-‐‑]$/;

export function countWords(text: string, locale = 'en'): number {
  let words = 0;
  let afterWord = false;
  let joined = false;
  for (const s of segmenter(locale, 'word').segment(text)) {
    if (s.isWordLike) {
      if (!joined) words++;
      afterWord = true;
      joined = false;
    } else {
      joined = afterWord && JOINER.test(s.segment);
      afterWord = false;
    }
  }
  return words;
}

export function countCharacters(text: string, locale = 'en'): { all: number; noSpaces: number } {
  let all = 0;
  let noSpaces = 0;
  for (const s of segmenter(locale, 'grapheme').segment(text)) {
    all++;
    if (!/^\s+$/u.test(s.segment)) noSpaces++;
  }
  return { all, noSpaces };
}

/**
 * Titles and abbreviations the sentence granularity takes for a full stop before a capital ("Dr.
 * Müller", "Mr. Smith", German nouns after "z.B." or "inkl."). Only ones that rarely end a sentence:
 * "etc." and "usw." do.
 */
const ABBREVIATION = /(?:^|[\s(])(?:Dr|Prof|Mr|Mrs|Ms|Mx|St|Mt|Hr|Hrn|Fr|Dipl|Ing|vs|ca|bzw|vgl|ggf|evtl|inkl|zzgl|i\.e|e\.g|z\.B|u\.a|d\.h|s\.o|s\.u)\.\s*$/;

export function countSentences(text: string, locale = 'en'): number {
  let n = 0;
  let open = false;
  for (const s of segmenter(locale, 'sentence').segment(text)) {
    if (!/[\p{L}\p{N}]/u.test(s.segment)) continue;
    // An abbreviation at the end isn't the end: the next piece belongs to the same sentence.
    if (!open) n++;
    open = ABBREVIATION.test(s.segment) && !/\n\s*$/.test(s.segment);
  }
  return n;
}

/** Blocks of text between blank lines. */
export function countParagraphs(text: string): number {
  return unixLines(text)
    .split(/\n[ \t ]*\n/)
    .filter((p) => p.trim()).length;
}

/** Lines as an editor numbers them; a line break at the very end opens no new one. */
export function countLines(text: string): number {
  const t = unixLines(text);
  if (!t) return 0;
  return t.replace(/\n$/, '').split('\n').length;
}

export function count(text: string, locale = 'en'): Counts {
  const words = countWords(text, locale);
  const chars = countCharacters(text, locale);
  return {
    words,
    characters: chars.all,
    charactersNoSpaces: chars.noSpaces,
    sentences: countSentences(text, locale),
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    reading: (words / READ_WPM) * 60,
    speaking: (words / SPEAK_WPM) * 60,
  };
}

export interface Duration {
  h: number;
  m: number;
  s: number;
}

/**
 * A time to show: to the second under ten minutes (never 0 s for a text with words), whole minutes
 * from ten minutes on, hours from an hour on.
 */
export function splitDuration(seconds: number): Duration {
  if (!(seconds > 0)) return { h: 0, m: 0, s: 0 };
  const total = Math.max(1, Math.round(seconds));
  if (total < 600) return { h: 0, m: Math.floor(total / 60), s: total % 60 };
  const minutes = Math.round(total / 60);
  return { h: Math.floor(minutes / 60), m: minutes % 60, s: 0 };
}
