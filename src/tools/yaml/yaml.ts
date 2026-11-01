// YAML ↔ JSON with the `yaml` library (ISC). Both ways go through its parser, which keeps the order
// of the keys and, with intAsBigInt, every whole number exactly; JSON is written here (big numbers
// as their digits) and YAML by the library, in block style with two spaces, quoting what YAML 1.1
// readers (Docker Compose, older Kubernetes tools) would otherwise read as a boolean or a date.
// Plain TypeScript with erasable types, tested as it is.

import { parseAllDocuments, Lexer, visit, type Document } from 'yaml';

export type Direction = 'toJson' | 'toYaml';

/** JSON starts with a brace or a bracket; anything else is read as YAML. */
export const detect = (text: string): Direction => (/^\s*[[{]/.test(fromFile(text)) ? 'toYaml' : 'toJson');

/** A direction from a file's name, when it has a telling one. */
export function directionOf(name: string): Direction | null {
  if (/\.json$/i.test(name)) return 'toYaml';
  if (/\.ya?ml$/i.test(name)) return 'toJson';
  return null;
}

/** The library's error codes, plus our own: an alias to nothing, aliases that explode. */
export type ErrorCode = string;

export interface YamlError {
  code: ErrorCode;
  /** Index into the text (UTF-16); −1 when it has no place (too many aliases). */
  offset: number;
  /** 1-based; 0 without a place. */
  line: number;
  /** 1-based, in characters. */
  column: number;
  /** What stands there: a character, a token, a key, an alias. */
  found: string;
  /** The library's own words, first line, without its "at line …". */
  detail: string;
}

export type Converted =
  | {
      ok: true;
      out: string;
      /** How many documents the text held (several become a list in JSON). */
      documents: number;
      /** Comments in the YAML: they don't survive the trip to JSON. */
      comments: number;
      /** .inf and .nan, which JSON has no way to write: written as null. */
      nonFinite: number;
    }
  | { ok: false; error: YamlError };

/** A file's text without its byte order mark. */
export const fromFile = (text: string) => text.replace(/^﻿/, '');

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

const charAt = (s: string, i: number) => (i >= 0 && i < s.length ? String.fromCodePoint(s.codePointAt(i)!) : '');

function errorAt(text: string, code: string, offset: number, message: string): YamlError {
  const detail = message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '');
  let found = charAt(text, offset);
  const token = /token in YAML stream: "(.+)"$/.exec(detail);
  if (code === 'UNEXPECTED_TOKEN' && token) found = token[1];
  else if (code === 'DUPLICATE_KEY') found = /^[^:\n]*/.exec(text.slice(offset))![0].trim();
  else if (code === 'BAD_DQ_ESCAPE') found = /\\\S?/.exec(text.slice(offset))?.[0] ?? found;
  else if (code === 'MISSING_CHAR') found = /closing (["'])quote/.exec(detail)?.[1] ?? /must end with an? (\S)/.exec(detail)?.[1] ?? '';
  else if (code === 'BAD_INDENT') found = /end with an? (\S)/.exec(detail)?.[1] ?? '';
  const where = offset < 0 ? { line: 0, column: 0 } : position(text, offset);
  return { code, offset, line: where.line, column: where.column, found, detail };
}

/** The YAML's comments, counted by the lexer (a # inside a string or a block isn't one). */
export function countComments(text: string): number {
  let n = 0;
  for (const token of new Lexer().lex(text)) if (token[0] === '#') n++;
  return n;
}

type Docs = Document.Parsed[] & { errors?: { code: string; pos: [number, number]; message: string }[] };

function parse(text: string, compat: boolean): { docs: Document.Parsed[] } | { error: YamlError } {
  const docs = parseAllDocuments(text, { intAsBigInt: true, merge: true, ...(compat ? { compat: 'yaml-1.1' } : {}) }) as Docs;
  // In the order the library found them: the first is the cause, later ones often follow from it
  // (a tab as indentation also makes a key look repeated).
  const errors = [...(docs.errors ?? []), ...docs.flatMap((d) => d.errors)];
  if (errors.length) return { error: errorAt(text, errors[0].code, errors[0].pos[0], errors[0].message) };
  return { docs: [...docs] };
}

export function convert(input: string, direction: Direction): Converted {
  const text = fromFile(input);
  const read = parse(text, direction === 'toYaml');
  if ('error' in read) return { ok: false, error: read.error };
  const { docs } = read;
  return direction === 'toJson' ? toJson(text, docs) : toYaml(docs);
}

function toJson(text: string, docs: Document.Parsed[]): Converted {
  const values: unknown[] = [];
  for (const doc of docs) {
    try {
      values.push(doc.toJS({ mapAsMap: true, maxAliasCount: 100 }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/alias count/i.test(message)) return { ok: false, error: { code: 'ALIASES', offset: -1, line: 0, column: 0, found: '', detail: message } };
      // An alias whose anchor isn't set before it: the library says which, not where.
      let at = -1;
      let name = '';
      visit(doc, {
        Alias(_, node) {
          if (!node.resolve(doc)) {
            at = node.range?.[0] ?? -1;
            name = `*${node.source}`;
            return visit.BREAK;
          }
        },
      });
      const error = errorAt(text, at >= 0 ? 'BAD_ALIAS' : 'OTHER', at, message);
      if (name) error.found = name;
      return { ok: false, error };
    }
  }
  const counter = { nonFinite: 0 };
  const value = docs.length === 1 ? values[0] : docs.length ? values : null;
  return { ok: true, out: writeJson(value, counter), documents: docs.length, comments: countComments(text), nonFinite: counter.nonFinite };
}

function toYaml(docs: Document.Parsed[]): Converted {
  const parts = docs.map((doc, i) => {
    // Block style, an empty {} or [] aside, and each string in the plainest style that reads back
    // the same (the library quotes "no", "on", "2026-10-31" for YAML 1.1 readers).
    visit(doc, {
      Collection(_, node) {
        node.flow = node.items.length === 0;
      },
      Scalar(_, node) {
        if (typeof node.value === 'string') node.type = undefined;
      },
    });
    const s = doc.toString({ indent: 2, lineWidth: 0 });
    return i > 0 && !s.startsWith('---') ? `---\n${s}` : s;
  });
  return { ok: true, out: parts.join('').replace(/\n+$/, ''), documents: docs.length, comments: 0, nonFinite: 0 };
}

const base64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** A map key as JSON has it: a string. */
function keyOf(key: unknown, counter: { nonFinite: number }): string {
  if (key === null || key === undefined) return '';
  if (typeof key === 'string') return key;
  if (typeof key === 'number' || typeof key === 'bigint' || typeof key === 'boolean') return String(key);
  if (key instanceof Date) return key.toISOString();
  return writeJson(key, counter, '');
}

/**
 * JSON from what the library read: maps keep their order (JavaScript objects would put "2" before
 * "b"), whole numbers their every digit, binary its Base64; .inf and .nan become null.
 */
export function writeJson(value: unknown, counter = { nonFinite: 0 }, indent = '  '): string {
  const nl = indent ? '\n' : '';
  const colon = indent ? ': ' : ':';
  const write = (v: unknown, pad: string): string => {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number') {
      if (Number.isFinite(v)) return JSON.stringify(v);
      counter.nonFinite++;
      return 'null';
    }
    if (typeof v === 'string') return JSON.stringify(v);
    if (v instanceof Date) return JSON.stringify(v.toISOString());
    if (v instanceof Uint8Array) return JSON.stringify(base64(v));
    const inner = pad + indent;
    if (Array.isArray(v) || v instanceof Set) {
      const items = [...v];
      if (!items.length) return '[]';
      return `[${nl}${items.map((x) => inner + write(x, inner)).join(`,${nl}`)}${nl}${pad}]`;
    }
    const entries = new Map<string, unknown>();
    for (const [k, x] of v instanceof Map ? v : Object.entries(v as object)) entries.set(keyOf(k, counter), x);
    if (!entries.size) return '{}';
    return `{${nl}${[...entries].map(([k, x]) => `${inner}${JSON.stringify(k)}${colon}${write(x, inner)}`).join(`,${nl}`)}${nl}${pad}}`;
  };
  return write(value, '');
}

/**
 * The line a mistake is on, cut to about `around` characters each side: `before`, the character
 * `at` (to mark), `after`.
 */
export function excerpt(text: string, offset: number, around = 40): { before: string; at: string; after: string; cutStart: boolean; cutEnd: boolean } {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  let lineEnd = text.indexOf('\n', offset);
  if (lineEnd === -1) lineEnd = text.length;
  const end = text[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd;
  const at = offset < end ? charAt(text, offset) : '';
  let from = Math.max(lineStart, offset - around);
  let to = Math.min(end, offset + at.length + around);
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
