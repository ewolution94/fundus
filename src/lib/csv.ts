// Tables as text: reading a CSV the way a bank or a shop wrote it, and writing one. Plain TypeScript
// with erasable types and no DOM, so the tests run it as it is. Both CSV tools use it (CSV & Excel,
// CSV ↔ JSON); no library, because none of them says which separator, encoding and decimal mark it
// found, and that's the point of the tool.
//
// - Bytes to text: a UTF-8 BOM, UTF-16 with its BOM (Excel's "Unicode text"), valid UTF-8, else
//   Windows-1252 (German Excel's CSV). It says which.
// - RFC 4180: quoted fields with doubled quotes, separators and line breaks inside quotes, CRLF or
//   LF (or an old Mac's CR), a last line without a break. Lenient where files are sloppy (a quote
//   inside an unquoted field is a character), and it says where a quote is never closed.
// - The separator (; , tab |) is the one that splits the first lines into the same number of fields.
// - The decimal mark comes from the number-like cells: "-1.234,56" and "4,80" are a comma,
//   "4.99" and "1,234.5" a point; "1.500" says nothing.

export type Separator = ';' | ',' | '\t' | '|';
export type Encoding = 'utf-8' | 'utf-8-bom' | 'utf-16' | 'windows-1252';
export type Mark = 'comma' | 'point';

/** In the order a tie goes: tab first (a pasted spreadsheet), then the German semicolon. */
export const SEPARATORS: Separator[] = ['\t', ';', ',', '|'];

export interface Issue {
  /** `unclosed`: a quote that never closes (the rest is in one cell); `stray`: text after a
   *  closing quote, kept in the cell. */
  code: 'unclosed' | 'stray';
  /** 1-based, in the text's lines. */
  line: number;
  /** 1-based, in characters. */
  column: number;
  /** Index into the text (UTF-16, after a BOM), for showing the spot. */
  offset: number;
}

export interface Parsed {
  rows: string[][];
  /** The first issue, if any. */
  issue: Issue | null;
}

// ── Bytes ─────────────────────────────────────────────────────────────────────────────────

/** Text from a file's bytes, and which encoding it was. A BOM never ends up in the text. */
export function decodeBytes(bytes: Uint8Array): { text: string; encoding: Encoding } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes.subarray(3)), encoding: 'utf-8-bom' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le', { ignoreBOM: true }).decode(bytes.subarray(2)), encoding: 'utf-16' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be', { ignoreBOM: true }).decode(bytes.subarray(2)), encoding: 'utf-16' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

/** The encodings someone can choose when the one found is wrong. */
export type Chosen = 'utf-8' | 'windows-1252' | 'utf-16';

/** Bytes read in the encoding someone chose (a wrong one gives � or Ã¼, which is the point). */
export function decodeAs(bytes: Uint8Array, encoding: Chosen): string {
  if (encoding === 'utf-16') {
    const be = bytes[0] === 0xfe && bytes[1] === 0xff;
    const bom = be || (bytes[0] === 0xff && bytes[1] === 0xfe);
    return new TextDecoder(be ? 'utf-16be' : 'utf-16le', { ignoreBOM: true }).decode(bom ? bytes.subarray(2) : bytes);
  }
  if (encoding === 'utf-8') {
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bom ? bytes.subarray(3) : bytes);
  }
  return new TextDecoder('windows-1252').decode(bytes);
}

/** The choice an encoding found stands for (a UTF-8 BOM is UTF-8). */
export const chosenOf = (encoding: Encoding): Chosen => (encoding === 'utf-8-bom' ? 'utf-8' : encoding);

/** A BOM at the start of a text (pasted, or read without `decodeBytes`) goes. */
export const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

// ── Reading ───────────────────────────────────────────────────────────────────────────────

/**
 * The rows of a CSV. Empty lines are skipped; a row keeps as many fields as it has (padding is the
 * caller's: `pad`). `maxRows` stops early (finding the separator reads only the first lines).
 */
export function parseCsv(input: string, sep: Separator, maxRows = Infinity): Parsed {
  const text = stripBom(input);
  const n = text.length;
  const rows: string[][] = [];
  let issue: Issue | null = null;
  let row: string[] = [];
  let field = '';
  let i = 0;
  let line = 1;
  let lineStart = 0;
  // Whether anything of the current row was read (an empty line has nothing).
  let started = false;
  let atFieldStart = true;
  const sepCode = sep.charCodeAt(0);

  const endRow = () => {
    row.push(field);
    field = '';
    if (started) rows.push(row);
    row = [];
    started = false;
    atFieldStart = true;
  };

  while (i < n) {
    const c = text.charCodeAt(i);
    if (atFieldStart && c === 0x22) {
      // A quoted field: up to the closing quote, "" for a quote, line breaks and all.
      started = true;
      const openLine = line;
      const openColumn = i - lineStart + 1;
      const openOffset = i;
      i++;
      let closed = false;
      let from = i;
      while (i < n) {
        const d = text.charCodeAt(i);
        if (d === 0x22) {
          field += text.slice(from, i);
          if (text.charCodeAt(i + 1) === 0x22) {
            field += '"';
            i += 2;
            from = i;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        if (d === 0x0a || (d === 0x0d && text.charCodeAt(i + 1) !== 0x0a)) {
          line++;
          lineStart = i + 1;
        }
        i++;
      }
      if (!closed) {
        field += text.slice(from, i);
        issue ??= { code: 'unclosed', line: openLine, column: openColumn, offset: openOffset };
      }
      atFieldStart = false;
      // Anything between the closing quote and the separator stays, and is said.
      const after = text.charCodeAt(i);
      if (closed && i < n && after !== sepCode && after !== 0x0a && after !== 0x0d) {
        issue ??= { code: 'stray', line, column: i - lineStart + 1, offset: i };
      }
      continue;
    }
    if (c === sepCode) {
      started = true;
      row.push(field);
      field = '';
      atFieldStart = true;
      i++;
      continue;
    }
    if (c === 0x0a || c === 0x0d) {
      endRow();
      i += c === 0x0d && text.charCodeAt(i + 1) === 0x0a ? 2 : 1;
      line++;
      lineStart = i;
      if (rows.length >= maxRows) return { rows, issue };
      continue;
    }
    // An unquoted stretch: up to the next separator, quote-at-start or line break.
    started = true;
    atFieldStart = false;
    let j = i + 1;
    while (j < n) {
      const d = text.charCodeAt(j);
      if (d === sepCode || d === 0x0a || d === 0x0d) break;
      j++;
    }
    field += text.slice(i, j);
    i = j;
  }
  if (started || field) {
    started = true;
    endRow();
  }
  return { rows, issue };
}

/** How many leading lines the separator is found from. */
const SAMPLE_ROWS = 30;
const SAMPLE_CHARS = 64 * 1024;

/**
 * The separator that splits the first lines into the same number of fields (two or more), the most
 * consistent first, then the one with more fields. `hint` (a .tsv's tab) wins a tie. A text with a
 * single column gets the hint, or a comma.
 */
export function findSeparator(input: string, hint?: Separator): Separator {
  const text = stripBom(input);
  const cut = text.length > SAMPLE_CHARS;
  const sample = cut ? text.slice(0, SAMPLE_CHARS) : text;
  const order = hint ? [hint, ...SEPARATORS.filter((s) => s !== hint)] : SEPARATORS;
  let best: { sep: Separator; share: number; fields: number; rank: number } | null = null;
  order.forEach((sep, rank) => {
    let { rows } = parseCsv(sample, sep, SAMPLE_ROWS + 1);
    // The last row of a cut sample may be cut too.
    if (cut || rows.length > SAMPLE_ROWS) rows = rows.slice(0, Math.max(1, Math.min(rows.length - 1, SAMPLE_ROWS)));
    if (!rows.length) return;
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    let fields = 0;
    let times = 0;
    for (const [k, v] of counts) if (v > times || (v === times && k > fields)) [fields, times] = [k, v];
    if (fields < 2) return;
    const share = times / rows.length;
    if (!best || share > best.share + 1e-9 || (Math.abs(share - best.share) < 1e-9 && (fields > best.fields || (fields === best.fields && rank < best.rank)))) {
      best = { sep, share, fields, rank };
    }
  });
  return (best as { sep: Separator } | null)?.sep ?? hint ?? ',';
}

// ── Numbers ───────────────────────────────────────────────────────────────────────────────

const COMMA_NUMBER = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/;
const POINT_NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

/**
 * A cell's number in a decimal mark ("-1.234,56" with a comma is −1234.56), or null. Strict by
 * default, for a column's type: what Excel would wreck stays text. A leading 0 (the postcode 01067),
 * more than 15 digits (Excel keeps 15), and a leading + (a phone number) unless it carries the
 * decimal mark (+12,50 is an amount). `{ strict: false }` reads them all (someone chose Number).
 */
export function toNumber(cell: string, mark: Mark, { strict = true }: { strict?: boolean } = {}): number | null {
  let t = cell.trim();
  if (!t) return null;
  let negative = false;
  if (t[0] === '-' || t[0] === '−') {
    negative = true;
    t = t.slice(1);
  } else if (t[0] === '+') {
    if (strict && !t.includes(mark === 'comma' ? ',' : '.')) return null;
    t = t.slice(1);
  }
  const m = (mark === 'comma' ? COMMA_NUMBER : POINT_NUMBER).exec(t);
  if (!m) return null;
  const whole = m[1].replace(/[.,]/g, '');
  const fraction = m[2] ?? '';
  if (strict) {
    if (whole.length > 1 && whole[0] === '0') return null;
    if (whole.length + fraction.length > 15) return null;
  }
  const value = Number(fraction ? `${whole}.${fraction}` : whole);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * A number cell rewritten for another decimal mark, digit for digit (no float in between): "-1.234,56"
 * with a comma becomes "-1234.56" for a point, "-4,80" stays "-4,80" for a comma. Null when the cell
 * isn't a number in `mark`.
 */
export function numberText(cell: string, mark: Mark, to: Mark): string | null {
  let t = cell.trim();
  let sign = '';
  if (t[0] === '-' || t[0] === '−') {
    sign = '-';
    t = t.slice(1);
  } else if (t[0] === '+') t = t.slice(1);
  const m = (mark === 'comma' ? COMMA_NUMBER : POINT_NUMBER).exec(t);
  if (!m) return null;
  const whole = m[1].replace(/[.,]/g, '');
  return m[2] === undefined ? `${sign}${whole}` : `${sign}${whole}${to === 'comma' ? ',' : '.'}${m[2]}`;
}

/** How many digits a number cell has after its decimal mark (0 for none), or null if it isn't one. */
export function decimalsOf(cell: string, mark: Mark): number | null {
  const m = (mark === 'comma' ? COMMA_NUMBER : POINT_NUMBER).exec(cell.trim().replace(/^[-−+]/, ''));
  return m ? (m[2]?.length ?? 0) : null;
}

/** What a number-like cell says about the decimal mark: 'comma', 'point', or null (nothing). */
export function markOf(cell: string): Mark | null {
  const t = cell.trim().replace(/^[-−+]/, '');
  if (!/^\d[\d.,]*\d$|^\d$/.test(t)) return null;
  const comma = t.lastIndexOf(',');
  const point = t.lastIndexOf('.');
  if (comma > -1 && point > -1) {
    // Both: the last one is the decimal mark, if the rest groups thousands properly.
    if (comma > point) return COMMA_NUMBER.test(t) ? 'comma' : null;
    return POINT_NUMBER.test(t) ? 'point' : null;
  }
  const one = comma > -1 ? ',' : point > -1 ? '.' : '';
  if (!one) return null;
  const parts = t.split(one);
  if (parts.length === 2) {
    // "4,80" and "4.99": a decimal. Three digits after ("1.500") could be either.
    if (parts[1].length === 3) return null;
    return one === ',' ? 'comma' : 'point';
  }
  // Several of one mark: thousands groups ("1.234.567"), so the decimal mark is the other one.
  if (/^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => p.length === 3)) return one === ',' ? 'point' : 'comma';
  return null;
}

/**
 * The decimal mark of a table's cells, by majority of the cells that say anything; `sure` is false
 * when none did, and the fallback (a semicolon file's comma, say) stands.
 */
export function findDecimal(rows: string[][], fallback: Mark): { mark: Mark; sure: boolean } {
  let comma = 0;
  let point = 0;
  for (const row of rows.slice(0, 2000)) {
    for (const cell of row) {
      const m = markOf(cell);
      if (m === 'comma') comma++;
      else if (m === 'point') point++;
    }
  }
  if (comma === point) return { mark: fallback, sure: false };
  return { mark: comma > point ? 'comma' : 'point', sure: true };
}

/** A number with nothing but its decimal mark: "-1234,56" (no grouping, no exponent). */
export function plainNumber(value: number, mark: Mark): string {
  let s = String(value);
  if (/e/i.test(s)) {
    // Past 1e21 even toFixed writes an exponent; such a double is a whole number.
    s = Math.abs(value) >= 1e21 ? BigInt(value).toString() : value.toFixed(Math.abs(value) < 1 ? 20 : 0).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return mark === 'comma' ? s.replace('.', ',') : s;
}

// ── Shape ─────────────────────────────────────────────────────────────────────────────────

/** Every row as long as the longest; `short` lists the rows (0-based) that were filled up. */
export function pad<T>(rows: T[][], fill: T): { rows: T[][]; columns: number; short: number[] } {
  const columns = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const short: number[] = [];
  const out = rows.map((r, i) => {
    if (r.length === columns) return r;
    short.push(i);
    return [...r, ...Array.from({ length: columns - r.length }, () => fill)];
  });
  return { rows: out, columns, short };
}

// ── Writing ───────────────────────────────────────────────────────────────────────────────

/** One field, quoted only when it must be: it holds the separator, a quote or a line break. */
export function field(value: string, sep: Separator): string {
  if (value.includes(sep) || value.includes('"') || value.includes('\n') || value.includes('\r')) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** A CSV from rows: each line ends with `eol`, the last one too. */
export function writeCsv(rows: string[][], sep: Separator, eol: '\r\n' | '\n' = '\r\n'): string {
  let out = '';
  for (const row of rows) out += row.map((v) => field(v, sep)).join(sep) + eol;
  return out;
}

/** Excel's column names: A … Z, AA … */
export function columnLetter(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
