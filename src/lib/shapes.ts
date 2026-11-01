// What a pasted text is: a link, a number, a date, a Unix time, JSON, Base64, a JWT, a colour, rows of
// a CSV, YAML, broken umlauts, or just text. The home uses it to put the tools that take it first. Plain TypeScript with erasable types, so the tests
// run it as it is.

import { parseNumber } from './numbers.ts';

export type Shape =
  | 'link'
  | 'number'
  | 'date'
  | 'timestamp'
  | 'json'
  | 'csv'
  | 'yaml'
  | 'jwt'
  | 'base64'
  | 'uuid'
  | 'colour'
  | 'roman'
  | 'bases'
  | 'mojibake'
  | 'text';

const LINK = /^(https?:\/\/|www\.)[^\s]+$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const DE_DATE = /^\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})$/;
const US_DATE = /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/;
const JWT = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/;
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^()]+\))$/i;
// Upper case only, so a word like "mix" stays a word; at least two letters, in a valid order.
const ROMAN = /^(?=[MDCLXVI]{2,}$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const BASES = /^(0x[0-9a-f_]+|0b[01_]+|0o[0-7_]+)$/i;
// UTF-8 read as Windows-1252: "Ã¼" for ü, "ÃŸ" for ß, "â€ž" for „, "Â " for a no-break space.
const MOJIBAKE = /Ã[ -¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]|â€|Â[ -¿]/;

/** Rows with the same separator, at least three columns (or two with tabs): a pasted CSV or a
 *  spreadsheet's cells. */
function isCsv(t: string): boolean {
  const lines = t.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6);
  if (lines.length < 2) return false;
  return [';', ',', '\t', '|'].some((sep) => {
    const counts = lines.map((l) => l.split(sep).length - 1);
    return counts.every((c) => c === counts[0]) && counts[0] >= (sep === '\t' ? 1 : 2);
  });
}

/** Lines of `key: value`, `key:` and `- item` (comments and indented lines aside): YAML, not prose. */
function isYaml(t: string): boolean {
  const lines = t.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length < 2) return false;
  if (!/^(---|[\w"'.-]+:(\s|$)|- )/.test(lines[0])) return false;
  const yamlish = lines.filter((l) => /^\s*([\w"'.\/-][\w "'.\/-]*:(\s|$)|- |---$)/.test(l) || /^\s{2,}\S/.test(l));
  return yamlish.length / lines.length >= 0.8;
}

/** The shapes a text has, most specific first ("1730400000" is a timestamp and a number). */
export function shapes(input: string): Shape[] {
  const t = input.trim();
  if (!t) return [];
  const out: Shape[] = [];
  if (LINK.test(t)) out.push('link');
  if (/^\d{10}(\d{3})?$/.test(t)) out.push('timestamp');
  if (ISO_DATE.test(t) || DE_DATE.test(t) || US_DATE.test(t)) out.push('date');
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      JSON.parse(t);
      out.push('json');
    } catch {}
  }
  if (!out.includes('json') && isCsv(t)) out.push('csv');
  if (!out.includes('json') && !out.includes('csv') && isYaml(t)) out.push('yaml');
  if (JWT.test(t)) out.push('jwt');
  if (COLOUR.test(t)) out.push('colour');
  if (ROMAN.test(t)) out.push('roman');
  if (BASES.test(t)) out.push('bases');
  if (!out.includes('date') && !Number.isNaN(parseNumber(t.replace(/\s*(%|€|\$|eur|usd)$/i, '')))) out.push('number');
  if (t.length >= 16 && t.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && /\d|[+/]/.test(t)) out.push('base64');
  if (/^(urn:uuid:)?\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$/i.test(t)) out.push('uuid');
  if (MOJIBAKE.test(t)) out.push('mojibake');
  out.push('text');
  return out;
}
