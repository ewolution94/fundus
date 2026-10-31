// What a pasted text is: a link, a number, a date, a Unix time, JSON, Base64, or just text. The home
// uses it to put the tools that take it first. Plain TypeScript with erasable types, so the tests
// run it as it is.

import { parseNumber } from './numbers.ts';

export type Shape = 'link' | 'number' | 'date' | 'timestamp' | 'json' | 'base64' | 'uuid' | 'text';

const LINK = /^(https?:\/\/|www\.)[^\s]+$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const DE_DATE = /^\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})$/;
const US_DATE = /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/;

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
  if (!out.includes('date') && !Number.isNaN(parseNumber(t.replace(/\s*(%|€|\$|eur|usd)$/i, '')))) out.push('number');
  if (t.length >= 16 && t.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && /\d|[+/]/.test(t)) out.push('base64');
  if (/^(urn:uuid:)?\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$/i.test(t)) out.push('uuid');
  out.push('text');
  return out;
}
