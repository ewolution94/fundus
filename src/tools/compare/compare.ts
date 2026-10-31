// What Compare texts finds. Plain TypeScript with erasable types, tested in node.
//
// Both ways go through jsdiff's diffArrays (Myers' algorithm) on our own tokens, so each side keeps
// its own text even where case or whitespace is ignored:
// - by words: Intl.Segmenter's words, punctuation and runs of whitespace (German compounds and emoji
//   stay whole). A run of spaces between two changes joins them, so "quick brown" → "slow red" reads
//   as one change, not two.
// - by lines: each line with its line break, so a missing break at the end is a change too.
// The unified diff is always by lines, with three lines of context, the way `diff -u` writes it.

import { diffArrays } from 'diff';
import { unixLines } from '../../lib/textfile.ts';

export type Mode = 'words' | 'lines';
export type Kind = 'same' | 'added' | 'removed';

export interface Options {
  mode: Mode;
  ignoreCase: boolean;
  ignoreSpace: boolean;
  locale?: string;
}

export interface Part {
  text: string;
  kind: Kind;
}

export interface Comparison {
  /** The first text: what stayed, and what went (removed). */
  before: Part[];
  /** The second text: what stayed, and what came (added). */
  after: Part[];
  /** Words or lines that came and went. */
  added: number;
  removed: number;
  /** Places where something changed. */
  changes: number;
  same: boolean;
}

interface Token {
  text: string;
  word: boolean;
  space: boolean;
}

const segmenters = new Map<string, Intl.Segmenter>();

/** Words, punctuation and whitespace runs, in order; joined they are the text again. */
export function tokens(text: string, locale = 'en'): Token[] {
  let s = segmenters.get(locale);
  if (!s) segmenters.set(locale, (s = new Intl.Segmenter(locale, { granularity: 'word' })));
  const out: Token[] = [];
  for (const seg of s.segment(text)) {
    const space = /^\s+$/u.test(seg.segment);
    const last = out[out.length - 1];
    if (space && last?.space) last.text += seg.segment;
    else out.push({ text: seg.segment, word: !!seg.isWordLike, space });
  }
  return out;
}

/** The lines, each with its line break (the last one may have none). */
export function lines(text: string): string[] {
  if (!text) return [];
  return text.split(/(?<=\n)/);
}

const norm = (s: string, o: Options) => {
  let t = s;
  if (o.ignoreSpace) t = t.replace(/\s+/g, ' ').trim();
  if (o.ignoreCase) t = t.toLocaleLowerCase(o.locale);
  return t;
};

/** One change list over two token lists, with each side's own slices. */
interface Run {
  kind: Kind;
  a: string[];
  b: string[];
}

function runs<T>(a: T[], b: T[], equal: (x: T, y: T) => boolean, text: (x: T) => string, timeout: number): Run[] | null {
  const changes = diffArrays(a, b, { comparator: equal, timeout });
  if (!changes) return null;
  const out: Run[] = [];
  let i = 0;
  let j = 0;
  for (const c of changes) {
    const n = c.count;
    if (c.added) {
      out.push({ kind: 'added', a: [], b: b.slice(j, j + n).map(text) });
      j += n;
    } else if (c.removed) {
      out.push({ kind: 'removed', a: a.slice(i, i + n).map(text), b: [] });
      i += n;
    } else {
      out.push({ kind: 'same', a: a.slice(i, i + n).map(text), b: b.slice(j, j + n).map(text) });
      i += n;
      j += n;
    }
  }
  return out;
}

/** Neighbouring parts of one kind as one. */
function merge(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const p of parts) {
    if (!p.text) continue;
    const last = out[out.length - 1];
    if (last && last.kind === p.kind) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** null when the texts are too far apart to compare within `timeout` milliseconds. */
export function compare(first: string, second: string, o: Options, timeout = 4000): Comparison | null {
  const a = unixLines(first);
  const b = unixLines(second);
  let list: Run[] | null;
  let count: (texts: string[]) => number;
  if (o.mode === 'words') {
    const ta = tokens(a, o.locale);
    const tb = tokens(b, o.locale);
    const equal = (x: Token, y: Token) => (x.space && y.space ? o.ignoreSpace || x.text === y.text : norm(x.text, { ...o, ignoreSpace: false }) === norm(y.text, { ...o, ignoreSpace: false }));
    list = runs(ta, tb, equal, (t) => t.text, timeout);
    if (!list) return null;
    // Whitespace alone between two replacements belongs to them: "quick brown" → "slow red" is one
    // change, not two. Only between replacements (something went and came on both sides): a space
    // between two insertions stays where it was.
    const group = (from: number, step: 1 | -1) => {
      const kinds = new Set<Kind>();
      for (let k = from; k >= 0 && k < list!.length && list![k].kind !== 'same'; k += step) kinds.add(list![k].kind);
      return kinds.has('added') && kinds.has('removed');
    };
    for (let k = 1; k < list.length - 1; k++) {
      const r = list[k];
      if (r.kind === 'same' && r.a.every((t) => /^\s+$/.test(t)) && group(k - 1, -1) && group(k + 1, 1)) {
        list.splice(k, 1, { kind: 'removed', a: r.a, b: [] }, { kind: 'added', a: [], b: r.b });
        k++;
      }
    }
    const segment = (s: string) => tokens(s, o.locale).filter((t) => t.word).length;
    count = (texts) => segment(texts.join(''));
  } else {
    const la = lines(a);
    const lb = lines(b);
    list = runs(la, lb, (x, y) => norm(x, o) === norm(y, o), (t) => t, timeout);
    if (!list) return null;
    count = (texts) => texts.length;
  }

  const before: Part[] = [];
  const after: Part[] = [];
  let added = 0;
  let removed = 0;
  let changes = 0;
  let inChange = false;
  for (const r of list) {
    // Ignoring whitespace: spaces or blank lines that came or went alone are no change either.
    const onlySpace = o.ignoreSpace && r.kind !== 'same' && [...r.a, ...r.b].every((t) => !/\S/.test(t));
    if (r.kind === 'same' || onlySpace) {
      if (r.a.length) before.push({ kind: 'same', text: r.a.join('') });
      if (r.b.length) after.push({ kind: 'same', text: r.b.join('') });
      if (r.kind === 'same') inChange = false;
      continue;
    }
    if (!inChange) changes++;
    inChange = true;
    if (r.kind === 'removed') {
      before.push({ kind: 'removed', text: r.a.join('') });
      removed += count(r.a);
    } else {
      after.push({ kind: 'added', text: r.b.join('') });
      added += count(r.b);
    }
  }
  return { before: merge(before), after: merge(after), added, removed, changes, same: changes === 0 };
}

/**
 * A unified diff (`diff -u`), by lines with `context` lines around each change. With case or
 * whitespace ignored, lines that differ only in those count as the same and show as context, in the
 * first text's version.
 */
export function unified(first: string, second: string, o: Pick<Options, 'ignoreCase' | 'ignoreSpace' | 'locale'> & { names?: [string, string]; context?: number }): string {
  const a = lines(unixLines(first));
  const b = lines(unixLines(second));
  const ctx = o.context ?? 3;
  const [nameA, nameB] = o.names ?? ['before', 'after'];
  const list = runs(a, b, (x, y) => norm(x, { mode: 'lines', ...o }) === norm(y, { mode: 'lines', ...o }), (t) => t, 30_000) ?? [];

  // Every line with its sign and its number on each side.
  interface Op {
    sign: ' ' | '-' | '+';
    text: string;
  }
  const ops: Op[] = [];
  for (const r of list) {
    if (r.kind === 'same') for (const t of r.a) ops.push({ sign: ' ', text: t });
    else if (r.kind === 'removed') for (const t of r.a) ops.push({ sign: '-', text: t });
    else for (const t of r.b) ops.push({ sign: '+', text: t });
  }
  const changed = ops.map((op, i) => (op.sign === ' ' ? -1 : i)).filter((i) => i >= 0);
  if (!changed.length) return '';

  // Hunks: each change with its context, merged where the context would overlap.
  const hunks: [number, number][] = [];
  for (const i of changed) {
    const start = Math.max(0, i - ctx);
    const end = Math.min(ops.length, i + ctx + 1);
    const last = hunks[hunks.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else hunks.push([start, end]);
  }

  // Line numbers where each op starts, on both sides.
  const oldAt: number[] = [];
  const newAt: number[] = [];
  let ol = 1;
  let nl = 1;
  for (const op of ops) {
    oldAt.push(ol);
    newAt.push(nl);
    if (op.sign !== '+') ol++;
    if (op.sign !== '-') nl++;
  }

  const out = [`--- ${nameA}`, `+++ ${nameB}`];
  for (const [start, end] of hunks) {
    const slice = ops.slice(start, end);
    const oldLen = slice.filter((op) => op.sign !== '+').length;
    const newLen = slice.filter((op) => op.sign !== '-').length;
    // An empty side names the line before it (0 for the very start), as diff does.
    const oldStart = oldLen ? oldAt[start] : oldAt[start] - 1;
    const newStart = newLen ? newAt[start] : newAt[start] - 1;
    out.push(`@@ -${oldStart},${oldLen} +${newStart},${newLen} @@`);
    for (const op of slice) {
      const bare = op.text.endsWith('\n') ? op.text.slice(0, -1) : op.text;
      out.push(op.sign + bare);
      if (!op.text.endsWith('\n')) out.push('\\ No newline at end of file');
    }
  }
  return out.join('\n') + '\n';
}
