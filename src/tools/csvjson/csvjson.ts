// CSV ↔ JSON, for developers. Plain TypeScript with erasable types and no DOM: tested in node.
//
// CSV → JSON: an array of objects keyed by the header (arrays without one). With typed values,
// numbers become numbers, true/false booleans and an empty cell null; dotted headers nest
// (address.city → { address: { city } }). Key order is the columns' order, so the JSON is written
// here rather than by JSON.stringify, which puts keys like "2024" first.
//
// JSON → CSV: an array of objects (or of arrays) to rows; nested objects flattened to dotted keys,
// arrays as JSON text, the columns the keys in the order they first appear. Numbers stay exactly as
// written (Format JSON's parser keeps them), so 12345678901234567890 survives.

import { parseCsv, findSeparator, findDecimal, pad, toNumber, writeCsv, stripBom, type Separator, type Mark, type Issue } from '../../lib/csv.ts';
import { parse as parseJson, format as formatJson, type Node, type JsonError } from '../json/json.ts';

export type Direction = 'csv' | 'json';

/** Which way a text goes: JSON starts with { or [. */
export function direction(text: string): Direction {
  const t = stripBom(text).trimStart();
  return t.startsWith('{') || t.startsWith('[') ? 'json' : 'csv';
}

/** Which way a file goes, by its name or type, else by its text. */
export function directionOf(name: string, type: string, text: string): Direction {
  if (/\.json$/i.test(name) || /json/.test(type)) return 'json';
  if (/\.(csv|tsv)$/i.test(name) || /csv|tab-separated/.test(type)) return 'csv';
  return direction(text);
}

// ── CSV → JSON ────────────────────────────────────────────────────────────────────────────

/** A JSON value with its keys in order. */
export type J = null | boolean | number | string | J[] | { entries: [string, J][] };

const isObject = (v: J | undefined): v is { entries: [string, J][] } => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface CsvRead {
  rows: string[][];
  columns: number;
  /** What it's read with: the choice, else what was found. */
  sep: Separator;
  mark: Mark;
  /** What was found, for "found" or "your choice". */
  foundSep: Separator;
  foundMark: Mark;
  /** Whether the decimal mark is known: a cell said it, or someone chose it. */
  sure: boolean;
  /** Whether a cell said it. */
  found: boolean;
  /** The first row looks like names. */
  header: boolean;
  /** An unclosed quote is an error; text after a closing quote only a note. */
  issue: Issue | null;
}

const JSON_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

/** A number cell as JSON reads it: digits it can hold exactly (15), else null (it stays text). */
function jsonNumber(cell: string): number | null {
  if (!JSON_NUMBER.test(cell)) return null;
  const mantissa = cell.replace(/^-/, '').replace(/[eE].*$/, '').replace('.', '').replace(/^0+/, '');
  if (mantissa.length > 15) return null;
  return Number(cell);
}

/** A CSV's text, read: its rows (padded), and what was found about it. */
/** A CSV's text, read: its rows (padded), and what was found about it, read the way someone chose
 *  (`sep`, `mark`; a .tsv's tab is a `hint` for finding). */
export function readCsv(text: string, { hint, sep: sepChoice, mark: markChoice }: { hint?: Separator; sep?: Separator | null; mark?: Mark | null } = {}): CsvRead {
  const foundSep = findSeparator(text, hint);
  const sep = sepChoice ?? foundSep;
  const parsed = parseCsv(text, sep);
  const { rows, columns } = pad(parsed.rows, '');
  const { mark: foundMark, sure: found } = findDecimal(rows, 'point');
  const mark = markChoice ?? foundMark;
  const first = rows[0] ?? [];
  const header = rows.length > 1 && first.some((c) => c.trim()) && first.every((c) => jsonNumber(c.trim()) === null && toNumber(c, mark) === null && !/^(true|false)$/i.test(c.trim()));
  return { rows, columns, sep, mark, foundSep, foundMark, sure: found || !!markChoice, found, header, issue: parsed.issue };
}

/** A cell's number: in the file's decimal mark when it showed a comma ("4,80"), else as JSON
 *  writes one; null when it isn't one, or has a leading 0 (01067 stays text). */
export function numberOf(cell: string, mark: Mark, sure: boolean): number | null {
  const t = cell.trim();
  return sure && mark === 'comma' ? toNumber(t, 'comma') : jsonNumber(t);
}

const BOOL = /^(true|false)$/i;

/**
 * What each column's cells become with typed values: numbers when every filled cell is one,
 * true/false when every one is, else text. By column, so a postcode column with 01067 in it stays
 * text throughout instead of half numbers. Empty cells are null in any column.
 */
export function columnKinds(rows: string[][], columns: number, mark: Mark, sure: boolean): ('number' | 'bool' | 'text')[] {
  return Array.from({ length: columns }, (_, c) => {
    let number = true;
    let bool = true;
    let filled = 0;
    for (const row of rows) {
      const cell = row[c] ?? '';
      if (cell === '') continue;
      filled++;
      if (number && numberOf(cell, mark, sure) === null) number = false;
      if (bool && !BOOL.test(cell.trim())) bool = false;
      if (!number && !bool) return 'text';
    }
    if (!filled) return 'text';
    return number ? 'number' : 'bool';
  });
}

/** A cell as its column's kind makes it. */
export function typedValue(cell: string, kind: 'number' | 'bool' | 'text', mark: Mark, sure: boolean): J {
  if (cell === '') return null;
  if (kind === 'number') return numberOf(cell, mark, sure) ?? cell;
  if (kind === 'bool') return /^true$/i.test(cell.trim());
  return cell;
}

/** Header names made usable as keys: an empty one is column3, a repeated one name_2. */
export function keysOf(header: string[]): string[] {
  const used = new Set<string>();
  return header.map((name, c) => {
    let key = name.trim() ? name : `column${c + 1}`;
    for (let k = 2; used.has(key); k++) key = `${name.trim() ? name : `column${c + 1}`}_${k}`;
    used.add(key);
    return key;
  });
}

/** For each key, its path when it nests: dotted, every part filled, and no shorter key a column
 *  of its own (with "a" and "a.b" both there, "a.b" stays flat). */
function paths(keys: string[]): (string[] | null)[] {
  const all = new Set(keys);
  return keys.map((key) => {
    const parts = key.split('.');
    if (parts.length < 2 || parts.some((p) => !p)) return null;
    for (let k = 1; k < parts.length; k++) if (all.has(parts.slice(0, k).join('.'))) return null;
    return parts;
  });
}

function put(obj: { entries: [string, J][] }, key: string, value: J) {
  const at = obj.entries.find((e) => e[0] === key);
  if (at) at[1] = value;
  else obj.entries.push([key, value]);
}

/** One row as an object, nesting dotted keys. */
function rowObject(keys: string[], plan: (string[] | null)[], values: J[]): J {
  const root = { entries: [] as [string, J][] };
  keys.forEach((key, c) => {
    const path = plan[c];
    if (!path) return put(root, key, values[c]);
    let node = root;
    for (const part of path.slice(0, -1)) {
      let child = node.entries.find((e) => e[0] === part)?.[1];
      if (!isObject(child)) {
        child = { entries: [] };
        put(node, part, child);
      }
      node = child;
    }
    put(node, path[path.length - 1], values[c]);
  });
  return root;
}

/** The CSV as JSON values: objects with a header, arrays without. */
export function toJson(read: CsvRead, header: boolean, typed: boolean): J[] {
  const body = header ? read.rows.slice(1) : read.rows;
  const kinds = typed ? columnKinds(body, read.columns, read.mark, read.sure) : [];
  const value = (cell: string, c: number): J => (typed ? typedValue(cell, kinds[c], read.mark, read.sure) : cell);
  if (!header) return body.map((row) => row.map(value));
  const keys = keysOf(read.rows[0] ?? []);
  const plan = paths(keys);
  return body.map((row) => rowObject(keys, plan, row.map(value)));
}

/** JSON text, indented by two spaces the way JSON.stringify does, keys in their order. */
export function stringify(value: J, indent = '  '): string {
  const out: string[] = [];
  const write = (v: J, pad: string) => {
    if (v === null || typeof v !== 'object') {
      out.push(JSON.stringify(v));
      return;
    }
    const inner = pad + indent;
    if (Array.isArray(v)) {
      if (!v.length) return void out.push('[]');
      out.push('[');
      v.forEach((item, k) => {
        out.push(k ? `,\n${inner}` : `\n${inner}`);
        write(item, inner);
      });
      out.push(`\n${pad}]`);
      return;
    }
    if (!v.entries.length) return void out.push('{}');
    out.push('{');
    v.entries.forEach(([key, item], k) => {
      out.push(k ? `,\n${inner}` : `\n${inner}`, JSON.stringify(key), ': ');
      write(item, inner);
    });
    out.push(`\n${pad}}`);
  };
  write(value, '');
  return out.join('');
}

// ── JSON → CSV ────────────────────────────────────────────────────────────────────────────

export type JsonToCsv =
  | { ok: true; csv: string; rows: number; columns: number; shape: 'objects' | 'arrays' }
  | { ok: false; error: JsonError }
  | { ok: false; code: 'scalar' | 'empty' };

/** A literal as a cell: a string decoded, null empty, numbers and true/false as written. */
function literal(raw: string): string {
  if (raw[0] === '"') return JSON.parse(raw) as string;
  return raw === 'null' ? '' : raw;
}

/** A value inside a row: an object or array as its JSON text (minified, as written). */
const cellOf = (node: Node) => (node.t === 'lit' ? literal(node.raw) : formatJson(node, '', false));

/** An object's leaves under dotted keys; arrays and empty objects as JSON text. */
function flatten(node: Node, prefix: string, out: Map<string, string>) {
  if (node.t === 'obj') {
    if (!node.entries.length) {
      if (prefix) out.set(prefix, '{}');
      return;
    }
    for (const e of node.entries) flatten(e.value, prefix ? `${prefix}.${e.key}` : e.key, out);
    return;
  }
  out.set(prefix || 'value', cellOf(node));
}

/** JSON's text as a CSV with `sep`, lines ending in \n and no BOM (for code, not Excel). */
export function jsonToCsv(text: string, sep: Separator): JsonToCsv {
  const parsed = parseJson(stripBom(text));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const top = parsed.value;
  if (top.t === 'lit') return { ok: false, code: 'scalar' };
  const items = top.t === 'arr' ? top.items : [top];
  if (!items.length) return { ok: false, code: 'empty' };

  if (items.every((n) => n.t === 'arr')) {
    const { rows, columns } = pad(
      items.map((n) => (n as Extract<Node, { t: 'arr' }>).items.map(cellOf)),
      '',
    );
    return { ok: true, csv: writeCsv(rows, sep, '\n'), rows: rows.length, columns, shape: 'arrays' };
  }

  const maps = items.map((n) => {
    const m = new Map<string, string>();
    if (n.t === 'obj') flatten(n, '', m);
    else m.set('value', cellOf(n));
    return m;
  });
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const m of maps) {
    for (const k of m.keys()) {
      if (seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
    }
  }
  const rows = [keys, ...maps.map((m) => keys.map((k) => m.get(k) ?? ''))];
  return { ok: true, csv: writeCsv(rows, sep, '\n'), rows: maps.length, columns: keys.length, shape: 'objects' };
}
