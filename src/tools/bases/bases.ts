// Number bases: a whole number read in any base from 2 to 36 (or by its 0x, 0b, 0o prefix) and
// written in every other, with its bits, its bytes and its two's complement at 8, 16, 32 and 64
// bits. BigInt throughout, so a number has no size limit but its digits. Plain TypeScript with
// erasable types, tested as it is.

/** How a number was read: by its prefix, or in the base picked. */
export type Read = { prefix: '0x' | '0b' | '0o' | null; base: number };

export type ParseError =
  | { code: 'digit'; char: string; position: number; base: number }
  | { code: 'noDigits'; prefix: string }
  | { code: 'fraction'; char: string }
  | { code: 'tooLong' }
  | { code: 'base' };

export type Parsed = ({ ok: true; value: bigint } & Read) | ({ ok: false } & ParseError);

/** Past this many digits it's a paste gone wrong, not a number. */
export const MAX_DIGITS = 10_000;

const PREFIX: Record<string, { prefix: '0x' | '0b' | '0o'; base: number }> = {
  x: { prefix: '0x', base: 16 },
  b: { prefix: '0b', base: 2 },
  o: { prefix: '0o', base: 8 },
};

/** Spaces of any kind, _ and ' group digits ("1_000", "1 000", "1'000"). */
const SEPARATOR = /[\s_'’]/;

/** A digit's value (0–35), or −1. */
function digitValue(c: string): number {
  const n = c.charCodeAt(0);
  if (n >= 0x30 && n <= 0x39) return n - 0x30;
  if (n >= 0x61 && n <= 0x7a) return n - 0x61 + 10;
  if (n >= 0x41 && n <= 0x5a) return n - 0x41 + 10;
  return -1;
}

export const validBase = (b: number) => Number.isInteger(b) && b >= 2 && b <= 36;

/**
 * A number as typed: a sign, then 0x…, 0b… or 0o… (whatever the base picked), or digits in `base`.
 * Null for nothing typed. `position` in an error is 1-based, in characters of the trimmed text.
 */
export function parse(input: string, base: number): Parsed | null {
  const chars = [...input.trim()];
  if (!chars.length) return null;
  if (!validBase(base)) return { ok: false, code: 'base' };
  let k = 0;
  let negative = false;
  if (chars[0] === '-' || chars[0] === '−' || chars[0] === '+') {
    negative = chars[0] !== '+';
    k = 1;
    while (k < chars.length && /\s/.test(chars[k])) k++;
  }
  let read: Read = { prefix: null, base };
  if (chars[k] === '0' && chars[k + 1] && PREFIX[chars[k + 1].toLowerCase()]) {
    read = PREFIX[chars[k + 1].toLowerCase()];
    k += 2;
  }
  let digits = '';
  for (; k < chars.length; k++) {
    const c = chars[k];
    if (SEPARATOR.test(c)) continue;
    if (c === '.' || c === ',') return { ok: false, code: 'fraction', char: c };
    const d = digitValue(c);
    if (d < 0 || d >= read.base) return { ok: false, code: 'digit', char: c, position: k + 1, base: read.base };
    digits += c;
    if (digits.length > MAX_DIGITS) return { ok: false, code: 'tooLong' };
  }
  if (!digits) return { ok: false, code: 'noDigits', prefix: read.prefix ?? '' };
  const value = toBigInt(digits, read.base);
  return { ok: true, value: negative ? -value : value, ...read };
}

function toBigInt(digits: string, base: number): bigint {
  if (base === 10) return BigInt(digits);
  if (base === 16) return BigInt(`0x${digits}`);
  if (base === 2) return BigInt(`0b${digits}`);
  if (base === 8) return BigInt(`0o${digits}`);
  // Nine digits at a time stay below 2^53 in base 36, so most of the sum is plain numbers.
  const B = BigInt(base);
  let value = 0n;
  for (let i = 0; i < digits.length; i += 9) {
    const chunk = digits.slice(i, i + 9);
    value = value * B ** BigInt(chunk.length) + BigInt(parseInt(chunk, base));
  }
  return value;
}

/** Digits in groups of `size` from the right, with a space (or `sep`); `pad` fills the first group with 0s. */
export function group(digits: string, size: number, pad = false, sep = ' '): string {
  const full = pad && digits.length % size ? '0'.repeat(size - (digits.length % size)) + digits : digits;
  const parts: string[] = [];
  for (let end = full.length; end > 0; end -= size) parts.unshift(full.slice(Math.max(0, end - size), end));
  return parts.join(sep);
}

/** Thousands are kept together by a narrow no-break space (it still reads back as a separator);
 *  binary nibbles and hex bytes by a plain one, so a long run wraps between groups. */
export const THIN = '\u202f';

const abs = (v: bigint) => (v < 0n ? -v : v);

/** The number in `base`, upper case, without grouping: what Copy copies ("-FF" for −255). */
export const plain = (v: bigint, base: number) => (v < 0n ? '-' : '') + abs(v).toString(base).toUpperCase();

/** The number as shown: grouped the way each base reads best, with a real minus. */
export function shown(v: bigint, base: number): string {
  const digits = abs(v).toString(base).toUpperCase();
  const body = base === 2 ? group(digits, 4, true) : base === 16 ? group(digits, 2, true) : base === 10 ? group(digits, 3, false, THIN) : digits;
  return (v < 0n ? '−' : '') + body;
}

/** Bits the number needs: unsigned for 0 and up (0 needs none), as two's complement below 0. */
export function bitLength(v: bigint): number {
  if (v === 0n) return 0;
  if (v > 0n) return v.toString(2).length;
  return (-v - 1n === 0n ? 0 : (-v - 1n).toString(2).length) + 1;
}

/**
 * The bytes, most significant first: the number itself from 0 up, its two's complement in as few
 * whole bytes as hold it below 0 (−1 is FF, −129 is FF 7F).
 */
export function bytes(v: bigint): number[] {
  let pattern = v;
  if (v < 0n) {
    const n = Math.ceil(bitLength(v) / 8);
    pattern = (1n << BigInt(n * 8)) + v;
  }
  const hex = pattern.toString(16);
  const even = hex.length % 2 ? `0${hex}` : hex;
  const out: number[] = [];
  for (let i = 0; i < even.length; i += 2) out.push(parseInt(even.slice(i, i + 2), 16));
  return out;
}

export const hexBytes = (list: number[]) => list.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

export const WIDTHS = [8, 16, 32, 64] as const;

export type Twos =
  | { width: number; fits: true; hex: string; binary: string; signed: bigint; unsigned: bigint }
  | { width: number; fits: false; min: bigint; max: bigint; negative: boolean };

/**
 * The number at a width: below 0 its two's complement (it fits from −2^(w−1)); from 0 up its bits
 * as they are (it fits below 2^w), with what they mean signed. `hex` and `binary` are grouped.
 */
export function twos(v: bigint, width: number): Twos {
  const w = BigInt(width);
  const span = 1n << w;
  const half = 1n << (w - 1n);
  if (v < 0n ? v < -half : v >= span) {
    return v < 0n ? { width, fits: false, min: -half, max: half - 1n, negative: true } : { width, fits: false, min: 0n, max: span - 1n, negative: false };
  }
  const pattern = v < 0n ? span + v : v;
  return {
    width,
    fits: true,
    hex: group(pattern.toString(16).toUpperCase().padStart(width / 4, '0'), 2),
    binary: group(pattern.toString(2).padStart(width, '0'), 4),
    signed: pattern >= half ? pattern - span : pattern,
    unsigned: pattern,
  };
}

/** The signed number shown grouped by thousands, with a real minus (for the notes). */
export const decimal = (v: bigint) => shown(v, 10);
