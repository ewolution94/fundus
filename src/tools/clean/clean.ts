// What Clean up text does, step by step. Plain TypeScript with erasable types, tested in node.
//
// The steps run in one fixed order, whichever are switched on, so the result never depends on the
// order they were ticked in:
//   1. plain quotes and dashes   (before anything compares or sorts characters)
//   2. trim lines                (spaces at a line's start and end)
//   3. collapse double spaces    (runs between words; indentation is trim's)
//   4. join stray line breaks    (wrapped lines into paragraphs; blank lines stay)
//   5. remove empty lines        (after joining, or every paragraph would run into one)
//   6. case
//   7. remove duplicate lines    (after case, so "Apple" and "APPLE" are one when lowered)
//   8. sort lines
// Line breaks come out as \n whatever came in. A line break at the very end stays as it was.

import { unixLines } from '../../lib/textfile.ts';
import { parseNumber } from '../../lib/numbers.ts';

export type CaseMode = 'keep' | 'upper' | 'lower' | 'title' | 'sentence';
export type SortMode = 'off' | 'az' | 'za' | 'num';

export interface Steps {
  quotes: boolean;
  trim: boolean;
  spaces: boolean;
  join: boolean;
  empty: boolean;
  case: CaseMode;
  dupes: boolean;
  sort: SortMode;
}

export interface Changes {
  quotes: number;
  trimmed: number;
  spaces: number;
  joined: number;
  empty: number;
  /** Words whose case changed. */
  cased: number;
  dupes: number;
  /** Lines that moved. */
  sorted: number;
}

export const NONE: Steps = { quotes: false, trim: false, spaces: false, join: false, empty: false, case: 'keep', dupes: false, sort: 'off' };

interface Step {
  text: string;
  n: number;
}

/** The text without its final line break, and whether it had one: line steps work on the body. */
function body(text: string): { lines: string[]; end: string } {
  const end = text.endsWith('\n') ? '\n' : '';
  return { lines: (end ? text.slice(0, -1) : text).split('\n'), end };
}

const blank = (line: string) => !/\S/.test(line);

// 1. “Curly” quotes, ‘apostrophes’, dashes and the ellipsis as a keyboard types them.
const PLAIN: Record<string, string> = {
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '–': '-', '‒': '-', '―': '-', '−': '-', '‐': '-', '‑': '-',
  '—': '--',
  '…': '...',
};
const CURLY = new RegExp(`[${Object.keys(PLAIN).join('')}]`, 'g');

export function plainQuotes(text: string): Step {
  let n = 0;
  const out = text.replace(CURLY, (ch) => {
    n++;
    return PLAIN[ch];
  });
  return { text: out, n };
}

// 2. Spaces and tabs at the start and end of each line (no-break and ideographic spaces too).
const EDGE = /^[ \t  -   　]+|[ \t  -   　]+$/g;

export function trimLines(text: string): Step {
  const { lines, end } = body(text);
  let n = 0;
  const out = lines.map((line) => {
    const t = line.replace(EDGE, '');
    if (t !== line) n++;
    return t;
  });
  return { text: out.join('\n') + end, n };
}

// 3. Two or more spaces (or tabs) between two words become one.
const RUN = /(?<=\S)[ \t  -   　]{2,}(?=\S)/g;

export function collapseSpaces(text: string): Step {
  let n = 0;
  const out = text.replace(RUN, () => {
    n++;
    return ' ';
  });
  return { text: out, n };
}

// 4. Lines broken inside a paragraph (a PDF's or an email's wrapping) join into one; a blank line
// still separates paragraphs, and a list item keeps its own line.
const ITEM = /^\s*(?:[-*•·▪◦–—]|\d{1,3}[.)]|[a-z][.)])\s/i;

export function joinLines(text: string): Step {
  const { lines, end } = body(text);
  const out: string[] = [];
  let n = 0;
  for (const line of lines) {
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && !blank(prev) && !blank(line) && !ITEM.test(line)) {
      const left = prev.replace(/\s+$/, '');
      const right = line.replace(/^\s+/, '');
      // A word broken with a hyphen at the line's end ("Wort-\ntrennung") keeps it, without a space.
      const glue = /\p{L}-$/u.test(left) ? '' : ' ';
      out[out.length - 1] = left + glue + right;
      n++;
    } else out.push(line);
  }
  return { text: out.join('\n') + end, n };
}

// 5. Lines with nothing (or only spaces) on them.
export function removeEmpty(text: string): Step {
  const { lines, end } = body(text);
  const out = lines.filter((line) => !blank(line));
  // A text of nothing but blank lines ends up empty, without its final break.
  return { text: out.join('\n') + (out.length ? end : ''), n: lines.length - out.length };
}

// 6. Case. Title Case capitalises every word (after a hyphen too, not after an apostrophe), Sentence
// case the first letter of the text, of each sentence and of each paragraph.
const WORD_START = /(^|[^\p{L}\p{M}\p{N}'’])(\p{L})/gu;
const SENTENCE_START = /(^\s*|[.!?…]["'”’»)\]]*\s+|\n\s*\n\s*)(\p{L})/gu;

export function setCase(text: string, mode: CaseMode, locale = 'en'): Step {
  if (mode === 'keep') return { text, n: 0 };
  const lower = text.toLocaleLowerCase(locale);
  let out: string;
  if (mode === 'upper') out = text.toLocaleUpperCase(locale);
  else if (mode === 'lower') out = lower;
  else if (mode === 'title') out = lower.replace(WORD_START, (_, before: string, letter: string) => before + letter.toLocaleUpperCase(locale));
  else out = lower.replace(SENTENCE_START, (_, before: string, letter: string) => before + letter.toLocaleUpperCase(locale));
  // Case never moves spaces, so the words line up one to one.
  const a = text.split(/\s+/);
  const b = out.split(/\s+/);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return { text: out, n };
}

// 7. The second and later copies of a line go; blank lines (paragraph breaks) are never duplicates.
export function removeDuplicates(text: string): Step {
  const { lines, end } = body(text);
  const seen = new Set<string>();
  const out = lines.filter((line) => {
    if (blank(line)) return true;
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
  return { text: out.join('\n') + end, n: lines.length - out.length };
}

// 8. Sorting: A–Z and Z–A the way the language sorts (ä with a, "Item 2" before "Item 10");
// by number reads the first number on each line ("12,50 €", "-3", "1.500"), lines without one last.
// Blank lines go to the end.
const FIRST_NUMBER = /[-−]?\d[\d.,]*/;

export function sortLines(text: string, mode: SortMode, locale = 'en'): Step {
  if (mode === 'off') return { text, n: 0 };
  const { lines, end } = body(text);
  const collator = new Intl.Collator(locale, { numeric: true });
  const filled = lines.filter((l) => !blank(l));
  const blanks = lines.filter(blank);
  const numberOf = (line: string) => {
    const m = line.match(FIRST_NUMBER);
    return m ? parseNumber(m[0].replace(/[.,]$/, '')) : NaN;
  };
  let sorted: string[];
  if (mode === 'num') {
    sorted = filled
      .map((line) => ({ line, n: numberOf(line) }))
      .sort((a, b) => {
        const an = Number.isNaN(a.n);
        const bn = Number.isNaN(b.n);
        if (an !== bn) return an ? 1 : -1;
        if (!an && a.n !== b.n) return a.n - b.n;
        return collator.compare(a.line, b.line);
      })
      .map((x) => x.line);
  } else {
    sorted = [...filled].sort((a, b) => (mode === 'za' ? collator.compare(b, a) : collator.compare(a, b)));
  }
  const out = [...sorted, ...blanks];
  let n = 0;
  for (let i = 0; i < lines.length; i++) if (out[i] !== lines[i]) n++;
  return { text: out.join('\n') + end, n };
}

/** Every step that's on, in the fixed order, and what each changed. */
export function clean(input: string, steps: Steps, locale = 'en'): { text: string; changes: Changes } {
  let text = unixLines(input);
  const changes: Changes = { quotes: 0, trimmed: 0, spaces: 0, joined: 0, empty: 0, cased: 0, dupes: 0, sorted: 0 };
  const run = (on: boolean, key: keyof Changes, step: (t: string) => Step) => {
    if (!on || !text) return;
    const r = step(text);
    text = r.text;
    changes[key] = r.n;
  };
  run(steps.quotes, 'quotes', plainQuotes);
  run(steps.trim, 'trimmed', trimLines);
  run(steps.spaces, 'spaces', collapseSpaces);
  run(steps.join, 'joined', joinLines);
  run(steps.empty, 'empty', removeEmpty);
  run(steps.case !== 'keep', 'cased', (t) => setCase(t, steps.case, locale));
  run(steps.dupes, 'dupes', removeDuplicates);
  run(steps.sort !== 'off', 'sorted', (t) => sortLines(t, steps.sort, locale));
  return { text, changes };
}

/** Whether any step is on. */
export const anyStep = (s: Steps) => s.quotes || s.trim || s.spaces || s.join || s.empty || s.case !== 'keep' || s.dupes || s.sort !== 'off';
