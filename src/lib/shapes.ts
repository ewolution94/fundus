// What a pasted text is: a link, a number, a date, a Unix time, JSON, Base64, a JWT, a colour, rows of
// a CSV, YAML, broken umlauts, fancy letters, hidden characters, a list, a CSS easing or shadow, or
// just text. The home uses it to put the tools that take it first. Plain TypeScript with erasable types, so the tests
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
  | 'fancy'
  | 'invisible'
  | 'list'
  | 'easing'
  | 'shadow'
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

// Letters from Unicode's mathematical alphabets (𝐁𝐨𝐥𝐝, 𝓈𝒸𝓇𝒾𝓅𝓉, 𝔉𝔯𝔞𝔨𝔱𝔲𝔯, 𝕕𝕠𝕦𝕓𝕝𝕖 …), the letter-like
// symbols that fill their gaps (ℋ ℯ ℭ ℝ), circled and squared letters, and full-width ones.
const FANCY = /[\u{1D400}-\u{1D7FF}\u{2102}\u{210A}-\u{2113}\u{2115}\u{2119}-\u{211D}\u{2124}\u{2128}\u{212C}\u{212D}\u{212F}-\u{2131}\u{2133}\u{2134}\u{24B6}-\u{24E9}\u{1F130}-\u{1F189}\u{FF21}-\u{FF3A}\u{FF41}-\u{FF5A}]/gu;
// Characters that don't show, or show as something they aren't: zero-width ones, the byte-order
// mark, soft hyphens, odd-width and narrow no-break spaces, direction marks and overrides, invisible
// operators, Hangul fillers, variation selectors and tag characters. A plain no-break space alone
// doesn't count: German text is full of them ("5 €").
const HIDDEN = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2066-\u206F\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/u;
// A word with Latin letters and Cyrillic or Greek ones in it: "Pаypal" with a Cyrillic а.
const MIXED = /(?=[\p{L}\p{M}]*\p{Script=Latin})(?=[\p{L}\p{M}]*[\p{Script=Cyrillic}\p{Script=Greek}])[\p{L}\p{M}]{3,}/u;
// A CSS timing function: cubic-bezier(…), linear(…) or steps(…), with or without its property.
const EASING = /^((transition|animation)(-timing-function)?\s*:\s*([\w.-]+,?\s+)*)?(cubic-bezier\(\s*-?[\d.]+\s*(,\s*-?[\d.]+\s*){3}\)|linear\([^()]+\))[^;]*;?$/i;
// A box-shadow value: layers of two to four lengths and a colour (either way round), `inset` allowed.
const LENGTH = String.raw`-?(\d*\.)?\d+(px|rem|em)?`;
const COLOR = String.raw`(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|[a-z]+)`;
const LAYER = String.raw`(inset\s+)?((${LENGTH}\s+){1,3}${LENGTH}\s+${COLOR}|${COLOR}\s+(${LENGTH}\s+){1,3}${LENGTH})(\s+inset)?`;
const SHADOW = new RegExp(String.raw`^(box-shadow\s*:\s*)?${LAYER}(\s*,\s*${LAYER})*\s*;?$`, 'i');

// Emoji sequences legitimately hold joiners, variation selectors and tags: ❤️, 👩‍💻, 1️⃣, a regional flag.
const EMOJI = /\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}|\p{Extended_Pictographic}[\uFE0E\uFE0F]?(\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?)*|[0-9#*]\uFE0F?\u20E3/gu;
// Control characters other than tab and line breaks, and three or more marks piled on one letter.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]|\p{M}{3,}/u;

/** Whether a text hides characters (Invisible characters finds and names them). */
function hides(t: string): boolean {
  const rest = t.replace(EMOJI, '');
  return HIDDEN.test(rest) || CONTROL.test(rest) || MIXED.test(t);
}

/** Two to 200 short lines (names, options), not a table and not prose: a list to pick from. */
function isList(t: string): boolean {
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 200) return false;
  return lines.every((l) => l.length <= 60 && l.split(/\s+/).length <= 6 && !/[.!?:]$/.test(l));
}

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
  if ((t.match(FANCY) ?? []).length >= 2) out.push('fancy');
  if (hides(t)) out.push('invisible');
  if (EASING.test(t)) out.push('easing');
  else if (SHADOW.test(t) && !out.includes('colour')) out.push('shadow');
  if (!out.some((k) => k === 'json' || k === 'csv' || k === 'yaml') && isList(t)) out.push('list');
  out.push('text');
  return out;
}
