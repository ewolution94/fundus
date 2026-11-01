// CSV & Excel: a table from a CSV's text (src/lib/csv.ts reads it) or an Excel sheet's cells, each
// column's type (Number, Text, Date), whether the first row is a header, and the table written back
// as Excel cells or a CSV for Excel. Plain TypeScript with erasable types and no DOM: tested in node.
//
// A column is a Number only when every cell is one in the file's decimal mark and Excel wouldn't
// wreck any of them (the postcode 01067, an IBAN, 16 digits, a phone number with +); a Date when
// every cell is dd.mm.yyyy, d.m.yy or yyyy-mm-dd; else Text. An Excel file's own types stand.

import { parseCsv, findSeparator, findDecimal, pad, toNumber, plainNumber, numberText, decimalsOf, type Separator, type Mark, type Issue } from '../../lib/csv.ts';

/** A cell: CSV cells are strings; an Excel sheet's are typed already. */
export type Value = string | number | boolean | Date | null;
export type ColumnType = 'number' | 'text' | 'date';

export interface Table {
  rows: Value[][];
  columns: number;
  /** Rows (0-based) that were short and got empty cells. */
  short: number[];
  /** From an Excel sheet, where the cells carry their own types. */
  typed: boolean;
}

export interface FromCsv extends Table {
  /** What it's read with: the choice, else what was found. */
  sep: Separator;
  mark: Mark;
  /** What was found, for "found" or "your choice". */
  foundSep: Separator;
  foundMark: Mark;
  /** False when no cell said which decimal mark it is (the separator's usual one stands). */
  sure: boolean;
  issue: Issue | null;
}

/** What someone chose instead of what was found; a .tsv's tab is a hint for finding. */
export interface ReadWith {
  hint?: Separator;
  sep?: Separator | null;
  mark?: Mark | null;
}

/** A CSV's text as a table, with what was found about it, read the way someone chose. */
export function fromCsv(text: string, { hint, sep: sepChoice, mark: markChoice }: ReadWith = {}): FromCsv {
  const foundSep = findSeparator(text, hint);
  const sep = sepChoice ?? foundSep;
  const parsed = parseCsv(text, sep);
  const { rows, columns, short } = pad<string>(parsed.rows, '');
  const { mark: foundMark, sure } = findDecimal(rows, sep === ';' ? 'comma' : 'point');
  return { rows, columns, short, typed: false, sep, mark: markChoice ?? foundMark, foundSep, foundMark, sure, issue: parsed.issue };
}

/** An Excel sheet's cells as a table (read-excel-file leaves trailing cells out of short rows). */
export function fromSheet(data: Value[][]): Table {
  const rows = data.map((r) => r.map((v) => (v === undefined ? null : v)));
  const { rows: padded, columns, short } = pad<Value>(rows, null);
  return { rows: padded, columns, short, typed: true };
}

// ── Dates ─────────────────────────────────────────────────────────────────────────────────

const DMY = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A date written as dd.mm.yyyy, d.m.yy or yyyy-mm-dd, at midnight UTC (Excel's dates have no
 *  zone); null for anything else, 31.02. included. Two-digit years follow Excel: 00–29 are 2000s. */
export function toDate(cell: string): Date | null {
  const t = cell.trim();
  let y: number;
  let m: number;
  let d: number;
  let match = DMY.exec(t);
  if (match) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (match[3].length === 2) y += y < 30 ? 2000 : 1900;
  } else if ((match = ISO.exec(t))) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else return null;
  if (m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

const two = (n: number) => String(n).padStart(2, '0');

/** "01.10.2026" (dmy) or "2026-10-01" (iso); a time of day, when there is one, after it. */
export function formatDate(date: Date, style: 'dmy' | 'iso'): string {
  const y = date.getUTCFullYear();
  const m = two(date.getUTCMonth() + 1);
  const d = two(date.getUTCDate());
  const day = style === 'dmy' ? `${d}.${m}.${y}` : `${y}-${m}-${d}`;
  const ms = date.getTime() % 86_400_000;
  if (!ms) return day;
  const time = `${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
  return date.getUTCSeconds() ? `${day} ${time}:${two(date.getUTCSeconds())}` : `${day} ${time}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────────────────

type Kind = 'empty' | 'number' | 'date' | 'text';

/** What a cell is. An Excel file's strings stay text: its author chose that. */
function kindOf(v: Value, mark: Mark, typed: boolean): Kind {
  if (v === null || v === '') return 'empty';
  if (typeof v === 'number') return 'number';
  if (v instanceof Date) return 'date';
  if (typeof v === 'boolean') return 'text';
  if (!v.trim()) return 'empty';
  if (typed) return 'text';
  if (toDate(v)) return 'date';
  if (toNumber(v, mark) !== null) return 'number';
  return 'text';
}

/** A column's type from its cells (the header left out). */
export function guessType(cells: Value[], mark: Mark, typed: boolean): ColumnType {
  let seen: Kind | null = null;
  for (const v of cells) {
    const k = kindOf(v, mark, typed);
    if (k === 'empty') continue;
    if (k === 'text') return 'text';
    if (seen && seen !== k) return 'text';
    seen = k;
  }
  return seen === 'number' ? 'number' : seen === 'date' ? 'date' : 'text';
}

/** Every column's type. */
export function guessTypes(table: Table, header: boolean, mark: Mark): ColumnType[] {
  const body = header ? table.rows.slice(1) : table.rows;
  return Array.from({ length: table.columns }, (_, c) => guessType(body.map((r) => r[c]), mark, table.typed));
}

/** A first row of names: words only (no number or date in it), and more rows under it. */
export function guessHeader(table: Table, mark: Mark): boolean {
  if (table.rows.length < 2) return false;
  const first = table.rows[0];
  let names = 0;
  for (const v of first) {
    if (v === null || (typeof v === 'string' && !v.trim())) continue;
    if (typeof v !== 'string') return false;
    if (toDate(v) || toNumber(v, mark, { strict: false }) !== null) return false;
    names++;
  }
  return names > 0;
}

// ── Out ───────────────────────────────────────────────────────────────────────────────────

/** A cell as the chosen type makes it: a number, a Date, or the text as it was. A cell that isn't
 *  one (a Number column's "n/a") stays text. */
export function convert(v: Value, type: ColumnType, mark: Mark, dateStyle: 'dmy' | 'iso'): Value {
  if (v === null || v === '') return null;
  if (type === 'number') {
    if (typeof v === 'string') return toNumber(v, mark, { strict: false }) ?? v;
    return v;
  }
  if (type === 'date') {
    if (typeof v === 'string') return toDate(v) ?? v;
    return v;
  }
  if (typeof v === 'string') return v;
  return text(v, mark, dateStyle);
}

/** Any cell as text: a number with the decimal mark and no grouping, a date in the style. */
export function text(v: Value, mark: Mark, dateStyle: 'dmy' | 'iso'): string {
  if (v === null) return '';
  if (typeof v === 'number') return plainNumber(v, mark);
  if (v instanceof Date) return formatDate(v, dateStyle);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

/** A cell for write-excel-file. */
export type XlsxCell = {
  value: string | number | boolean | Date;
  type: StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
  format?: string;
  fontWeight?: 'bold';
  wrap?: boolean;
} | null;

export interface XlsxSheet {
  data: XlsxCell[][];
  columns: { width: number }[];
  /** The header row stays in view in Excel. */
  stickyRowsCount?: number;
}

/**
 * The table as Excel cells: numbers as numbers, dates as dates (dd.mm.yyyy where the decimal mark is
 * a comma, else yyyy-mm-dd), text as text (marked as text, so Excel leaves 01067 alone when someone
 * edits it), the header in bold.
 */
export function toXlsx(table: Table, header: boolean, types: ColumnType[], mark: Mark): XlsxSheet {
  const dateStyle = mark === 'comma' ? 'dmy' : 'iso';
  const dateFormat = mark === 'comma' ? 'dd.mm.yyyy' : 'yyyy-mm-dd';
  const widths = Array.from({ length: table.columns }, () => 6);
  const formats = numberFormats(table, header, types, mark);
  const data = table.rows.map((row, r) =>
    row.map((v, c): XlsxCell => {
      const isHead = header && r === 0;
      const out = isHead ? (v === null ? null : text(v, mark, dateStyle)) : convert(v, types[c], mark, dateStyle);
      if (out === null || out === '') return null;
      if (r < 500) widths[c] = Math.max(widths[c], Math.min(50, text(out, mark, dateStyle).split('\n')[0].length + 2));
      if (isHead) return { value: out as string, type: String, fontWeight: 'bold' };
      if (typeof out === 'number') return formats[c] ? { value: out, type: Number, format: formats[c] } : { value: out, type: Number };
      if (out instanceof Date) return { value: out, type: Date, format: dateFormat };
      if (typeof out === 'boolean') return { value: out, type: Boolean };
      const multiline = out.includes('\n');
      return { value: out, type: String, format: '@', ...(multiline ? { wrap: true } : {}) };
    }),
  );
  return { data, columns: widths.map((width) => ({ width })), ...(header ? { stickyRowsCount: 1 } : {}) };
}

/**
 * A CSV's Number column whose cells all have the same 1–4 decimals (money: -4,80) keeps them shown
 * in Excel ("#,##0.00", which Excel writes in its own language's marks); others stay General.
 */
function numberFormats(table: Table, header: boolean, types: ColumnType[], mark: Mark): (string | null)[] {
  if (table.typed) return types.map(() => null);
  const body = header ? table.rows.slice(1) : table.rows;
  return types.map((type, c) => {
    if (type !== 'number') return null;
    let digits: number | null = null;
    for (const row of body) {
      const v = row[c];
      if (typeof v !== 'string' || !v.trim()) continue;
      const d = decimalsOf(v, mark);
      if (d === null) continue;
      if (digits !== null && d !== digits) return null;
      digits = d;
    }
    return digits && digits <= 4 ? `#,##0.${'0'.repeat(digits)}` : null;
  });
}

/**
 * The table as CSV rows for Excel. A semicolon goes with a decimal comma (German Excel), a comma
 * with a point; dates as dd.mm.yyyy or yyyy-mm-dd to match. Text stays exactly as it was.
 */
export function toCsvRows(table: Table, header: boolean, types: ColumnType[], mark: Mark, sep: Separator): string[][] {
  const outMark: Mark = sep === ';' ? 'comma' : 'point';
  const style = sep === ';' ? 'dmy' : 'iso';
  return table.rows.map((row, r) =>
    row.map((v, c) => {
      if (header && r === 0) return text(v, mark, style);
      // A CSV's number keeps its digits ("-4,80"), only its marks change.
      if (types[c] === 'number' && typeof v === 'string') {
        const rewritten = numberText(v, mark, outMark);
        if (rewritten !== null) return rewritten;
      }
      return text(convert(v, types[c], mark, style), outMark, style);
    }),
  );
}

/** Text cells a CSV can't keep from Excel: it reads 01067 as 1067 and 16 digits as 15. */
export function excelWrecks(table: Table, header: boolean, types: ColumnType[]): boolean {
  const body = header ? table.rows.slice(1) : table.rows;
  return body.some((row) =>
    row.some((v, c) => {
      if (types[c] !== 'text' || typeof v !== 'string') return false;
      const t = v.trim();
      if (!/^\+?\d+$/.test(t)) return false;
      return t[0] === '+' || (t.length > 1 && t[0] === '0') || t.length > 15;
    }),
  );
}

/** "Old .xls" (the OLE2 compound file Excel wrote before 2007). */
export const isOldXls = (head: Uint8Array) => head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
/** A ZIP's first bytes: an .xlsx is one. */
export const isZip = (head: Uint8Array) => head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
