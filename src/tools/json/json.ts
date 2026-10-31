// Format JSON: a strict parser (RFC 8259, what JSON.parse accepts) that keeps every number and
// string exactly as written, says where the first mistake is and what it likely is, and writes the
// tree back out indented, minified, or with its keys sorted. Plain TypeScript with erasable types.
//
// Our own parser rather than JSON.parse: Safari's error names no position, and JSON.parse turns
// 12345678901234567890 into 12345678901234567000 and drops a repeated key. Formatting must change
// only the white space.

/** A value as written: strings keep their quotes and escapes, numbers their digits. */
export type Node =
  | { t: 'obj'; entries: Entry[] }
  | { t: 'arr'; items: Node[] }
  | { t: 'lit'; raw: string };

/** A key as written (`raw`, quotes included) and decoded (`key`, for sorting). */
export interface Entry {
  key: string;
  raw: string;
  value: Node;
}

export type ErrorCode =
  | 'end'
  | 'unexpected'
  | 'trailingComma'
  | 'singleQuote'
  | 'keyQuote'
  | 'comment'
  | 'number'
  | 'escape'
  | 'lineBreak'
  | 'tab'
  | 'control'
  | 'unclosedString'
  | 'literal'
  | 'colon'
  | 'commaObject'
  | 'commaArray'
  | 'extra'
  | 'deep';

export interface JsonError {
  code: ErrorCode;
  /** Index into the text (UTF-16), where the mistake is. */
  offset: number;
  /** 1-based. */
  line: number;
  /** 1-based, in characters (an emoji is one). */
  column: number;
  /** What stands there: a character, a word ("undefined", "01"), or '' at the end. */
  found: string;
  /** For `end`: the bracket left open, and its line. */
  open?: { bracket: '{' | '['; line: number };
}

export type Parsed = { ok: true; value: Node } | { ok: false; error: JsonError };

/** Deeper than this is someone's generated test, not data; it also keeps the stack safe. */
export const MAX_DEPTH = 1000;

class Fail extends Error {
  code: ErrorCode;
  offset: number;
  found: string;
  open: number | undefined;
  constructor(code: ErrorCode, offset: number, found: string, open?: number) {
    super(code);
    this.code = code;
    this.offset = offset;
    this.found = found;
    this.open = open;
  }
}

const WS = (c: number) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
const DIGIT = (c: number) => c >= 0x30 && c <= 0x39;
const HEX = /^[0-9a-fA-F]{4}$/;
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD = /[A-Za-z_$][\w$]*/y;
const NUMBERISH = /[-+.\dA-Za-z]+/y;

/** One code point at `i` (a surrogate pair is one). */
const charAt = (s: string, i: number) => (i < s.length ? String.fromCodePoint(s.codePointAt(i)!) : '');

export function parse(text: string): Parsed {
  let i = 0;
  // Where each open bracket started, for "the { from line 2 isn't closed".
  const opens: number[] = [];

  const skip = () => {
    while (i < text.length && WS(text.charCodeAt(i))) i++;
  };

  // A word to quote in the message: cut short, so 400 digits don't make a 400-digit message.
  const word = (re: RegExp, at: number) => {
    re.lastIndex = at;
    const found = re.exec(text)?.[0] ?? charAt(text, at);
    return found.length > 24 ? `${found.slice(0, 20)}…` : found;
  };

  /** Something that isn't a value where a value should be. */
  const notValue = (afterComma: boolean): never => {
    if (i >= text.length) throw new Fail('end', i, '', opens.at(-1));
    const c = text[i];
    if (afterComma && (c === '}' || c === ']')) throw new Fail('trailingComma', i, c);
    if (c === "'") throw new Fail('singleQuote', i, c);
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) throw new Fail('comment', i, text.slice(i, i + 2));
    if (c === '+' || c === '.' || DIGIT(text.charCodeAt(i))) throw new Fail('number', i, word(NUMBERISH, i));
    if (/[A-Za-z_$]/.test(c)) throw new Fail('literal', i, word(WORD, i));
    throw new Fail('unexpected', i, charAt(text, i));
  };

  const string = (): string => {
    const start = i;
    i++;
    for (;;) {
      if (i >= text.length) throw new Fail('unclosedString', start, '"', opens.at(-1));
      const c = text.charCodeAt(i);
      if (c === 0x22) {
        i++;
        return text.slice(start, i);
      }
      if (c === 0x5c) {
        const e = text[i + 1];
        if (e === undefined) throw new Fail('unclosedString', start, '"');
        if (e === 'u') {
          if (!HEX.test(text.slice(i + 2, i + 6))) throw new Fail('escape', i, text.slice(i, i + 6));
          i += 6;
        } else if ('"\\/bfnrt'.includes(e)) i += 2;
        else throw new Fail('escape', i, `\\${charAt(text, i + 1)}`);
        continue;
      }
      if (c < 0x20) throw new Fail(c === 0x0a || c === 0x0d ? 'lineBreak' : c === 0x09 ? 'tab' : 'control', i, text[i]);
      i++;
    }
  };

  const value = (depth: number, afterComma = false): Node => {
    if (depth > MAX_DEPTH) throw new Fail('deep', i, text[i]);
    const c = text[i];
    if (c === '{') return object(depth);
    if (c === '[') return array(depth);
    if (c === '"') return { t: 'lit', raw: string() };
    if (c === '-' || DIGIT(text.charCodeAt(i))) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(text);
      const end = m ? i + m[0].length : i;
      // "01", "1.", "-", "1e": the number doesn't end where JSON's grammar does.
      const next = text.charCodeAt(end);
      if (!m || m[0] === '-' || DIGIT(next) || next === 0x2e || next === 0x65 || next === 0x45 || /[A-Za-z_$]/.test(text[end] ?? '')) {
        throw new Fail('number', i, word(NUMBERISH, i));
      }
      i = end;
      return { t: 'lit', raw: m[0] };
    }
    if (c === 't' || c === 'f' || c === 'n') {
      const w = word(WORD, i);
      if (w === 'true' || w === 'false' || w === 'null') {
        i += w.length;
        return { t: 'lit', raw: w };
      }
      throw new Fail('literal', i, w);
    }
    return notValue(afterComma);
  };

  const object = (depth: number): Node => {
    opens.push(i);
    i++;
    const entries: Entry[] = [];
    skip();
    if (text[i] === '}') {
      i++;
      opens.pop();
      return { t: 'obj', entries };
    }
    for (let afterComma = false; ; ) {
      if (i >= text.length) throw new Fail('end', i, '', opens.at(-1));
      const c = text[i];
      if (c !== '"') {
        if (afterComma && c === '}') throw new Fail('trailingComma', i, c);
        if (c === "'") throw new Fail('singleQuote', i, c);
        if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) throw new Fail('comment', i, text.slice(i, i + 2));
        if (/[A-Za-z_$\d]/.test(c)) throw new Fail('keyQuote', i, word(WORD, i));
        throw new Fail('unexpected', i, charAt(text, i));
      }
      const raw = string();
      skip();
      if (text[i] !== ':') {
        if (i >= text.length) throw new Fail('end', i, '', opens.at(-1));
        throw new Fail('colon', i, charAt(text, i));
      }
      i++;
      skip();
      const v = value(depth + 1);
      entries.push({ key: JSON.parse(raw) as string, raw, value: v });
      skip();
      if (text[i] === ',') {
        i++;
        skip();
        afterComma = true;
        continue;
      }
      if (text[i] === '}') {
        i++;
        opens.pop();
        return { t: 'obj', entries };
      }
      if (i >= text.length) throw new Fail('end', i, '', opens.at(-1));
      if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) throw new Fail('comment', i, text.slice(i, i + 2));
      throw new Fail('commaObject', i, charAt(text, i));
    }
  };

  const array = (depth: number): Node => {
    opens.push(i);
    i++;
    const items: Node[] = [];
    skip();
    if (text[i] === ']') {
      i++;
      opens.pop();
      return { t: 'arr', items };
    }
    for (let afterComma = false; ; ) {
      if (afterComma && text[i] === ']') throw new Fail('trailingComma', i, ']');
      items.push(value(depth + 1, afterComma));
      skip();
      if (text[i] === ',') {
        i++;
        skip();
        afterComma = true;
        continue;
      }
      if (text[i] === ']') {
        i++;
        opens.pop();
        return { t: 'arr', items };
      }
      if (i >= text.length) throw new Fail('end', i, '', opens.at(-1));
      if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) throw new Fail('comment', i, text.slice(i, i + 2));
      throw new Fail('commaArray', i, charAt(text, i));
    }
  };

  try {
    skip();
    if (i >= text.length) throw new Fail('end', i, '');
    const v = value(1);
    skip();
    if (i < text.length) {
      if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) throw new Fail('comment', i, text.slice(i, i + 2));
      throw new Fail('extra', i, charAt(text, i));
    }
    return { ok: true, value: v };
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    const where = position(text, e.offset);
    const error: JsonError = { code: e.code, offset: e.offset, line: where.line, column: where.column, found: e.found };
    if (e.open !== undefined) error.open = { bracket: text[e.open] as '{' | '[', line: position(text, e.open).line };
    return { ok: false, error };
  }
}

/** Line and column (1-based, in characters) of an index. */
export function position(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let start = 0;
  for (let k = text.indexOf('\n'); k !== -1 && k < offset; k = text.indexOf('\n', k + 1)) {
    line++;
    start = k + 1;
  }
  return { line, column: [...text.slice(start, offset)].length + 1 };
}

/**
 * The line a mistake is on, cut to about `around` characters each side when it's long (minified
 * JSON is one line): `before`, the character `at` (to mark), `after`.
 */
export function excerpt(text: string, offset: number, around = 40): { before: string; at: string; after: string; cutStart: boolean; cutEnd: boolean } {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  let lineEnd = text.indexOf('\n', offset);
  if (lineEnd === -1) lineEnd = text.length;
  const end = text[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd;
  const at = offset < end ? charAt(text, offset) : '';
  let from = Math.max(lineStart, offset - around);
  let to = Math.min(end, offset + at.length + around);
  // Never cut a surrogate pair in half.
  if (from > lineStart && /[\udc00-\udfff]/.test(text[from])) from--;
  if (to < end && /[\ud800-\udbff]/.test(text[to - 1])) to++;
  return {
    before: text.slice(from, offset).replace(/\t/g, '  '),
    at,
    after: text.slice(offset + at.length, to).replace(/\t/g, '  '),
    cutStart: from > lineStart,
    cutEnd: to < end,
  };
}

/** The indents on offer; '' minifies. */
export const INDENTS = { '2': '  ', '4': '    ', tab: '\t', min: '' } as const;
export type Indent = keyof typeof INDENTS;

/** The tree as text: with `indent` ('' minifies), keys sorted at every level when `sort`. */
export function format(node: Node, indent: string, sort: boolean): string {
  const out: string[] = [];
  const nl = indent ? '\n' : '';
  const colon = indent ? ': ' : ':';
  const pads = [''];
  const pad = (level: number) => (pads[level] ??= indent.repeat(level));
  const write = (n: Node, level: number) => {
    if (n.t === 'lit') {
      out.push(n.raw);
      return;
    }
    const open = n.t === 'obj' ? '{' : '[';
    const close = n.t === 'obj' ? '}' : ']';
    const list = n.t === 'obj' ? (sort ? sortEntries(n.entries) : n.entries) : n.items;
    if (!list.length) {
      out.push(open + close);
      return;
    }
    out.push(open);
    list.forEach((item, k) => {
      out.push(k ? `,${nl}${pad(level + 1)}` : `${nl}${pad(level + 1)}`);
      if (n.t === 'obj') {
        const e = item as Entry;
        out.push(e.raw, colon);
        write(e.value, level + 1);
      } else write(item as Node, level + 1);
    });
    out.push(nl + pad(level) + close);
  };
  write(node, 0);
  return out.join('');
}

/** By the decoded key, in code unit order (like JavaScript's sort and jq -S); stable for repeats. */
function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Bytes as UTF-8, without encoding it. */
export function utf8Length(s: string): number {
  let n = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s.charCodeAt(k);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && k + 1 < s.length && (s.charCodeAt(k + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      k++;
    } else n += 3;
  }
  return n;
}

/** What the top of the tree is, for the line under the result. */
export function summary(node: Node): { kind: 'object' | 'array' | 'value'; count: number } {
  if (node.t === 'obj') return { kind: 'object', count: node.entries.length };
  if (node.t === 'arr') return { kind: 'array', count: node.items.length };
  return { kind: 'value', count: 0 };
}

/** A file's text: UTF-8, its byte order mark dropped (JSON.parse refuses one). */
export const fromFile = (text: string) => text.replace(/^﻿/, '');
