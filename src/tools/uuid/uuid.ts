// F-905 UUIDs, the logic: v4 (random) and v7 (Unix time in milliseconds, then a counter and random
// bits, RFC 9562 §5.7), written in a chosen style, and a pasted UUID read back: valid or not, its
// version and variant, and the time inside a v1, v6 or v7. No DOM; plain TypeScript with erasable
// types, so node runs it as it is.

export type Bytes = Uint8Array;
export type Random = (n: number) => Bytes;

export interface Style {
  upper: boolean;
  hyphens: boolean;
  braces: boolean;
}

const cryptoRandom: Random = (n) => crypto.getRandomValues(new Uint8Array(n));

/** A v4 UUID: 122 random bits. `crypto.randomUUID` where there is one. */
export function v4(random: Random = cryptoRandom): Bytes {
  if (random === cryptoRandom && typeof crypto.randomUUID === 'function') return toBytes(crypto.randomUUID());
  const b = random(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return b;
}

/** The largest Unix time in milliseconds a v7 holds (48 bits): the year 10889. */
export const V7_MAX_MS = 2 ** 48 - 1;

/**
 * A maker of v7 UUIDs that only ever go up, even within one millisecond or when the clock steps
 * back: the 12 bits after the version are a counter (RFC 9562 §6.2, method 1), started at a random
 * value below 2048 each new millisecond so there's room to count; when it runs out, the time moves
 * on a millisecond.
 */
export function v7Maker(clock: () => number = Date.now, random: Random = cryptoRandom): () => Bytes {
  let last = -1;
  let counter = 0;
  const seed = () => {
    const r = random(2);
    return ((r[0] << 8) | r[1]) & 0x7ff;
  };
  return () => {
    const ms = Math.min(Math.max(0, Math.floor(clock())), V7_MAX_MS);
    if (ms > last) {
      last = ms;
      counter = seed();
    } else if (++counter > 0xfff) {
      last = Math.min(last + 1, V7_MAX_MS);
      counter = seed();
    }
    const b = random(16);
    let t = last;
    for (let i = 5; i >= 0; i--) {
      b[i] = t % 256;
      t = Math.floor(t / 256);
    }
    b[6] = 0x70 | (counter >> 8);
    b[7] = counter & 0xff;
    b[8] = (b[8] & 0x3f) | 0x80;
    return b;
  };
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** Lower-case hex with hyphens, the canonical form. */
export function canonical(b: Bytes): string {
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
    s += HEX[b[i]];
  }
  return s;
}

/** A UUID in a style: case, hyphens, braces. */
export function format(b: Bytes, style: Style): string {
  let s = canonical(b);
  if (!style.hyphens) s = s.replaceAll('-', '');
  if (style.upper) s = s.toUpperCase();
  return style.braces ? `{${s}}` : s;
}

export type ParseError =
  | { ok: false; code: 'char'; char: string; position: number }
  | { ok: false; code: 'length'; digits: number }
  | { ok: false; code: 'hyphens' }
  | { ok: false; code: 'braces' };

export type Parsed = { ok: true; bytes: Bytes } | ParseError;

/**
 * A UUID as typed: any case, with or without hyphens, in braces, or as `urn:uuid:…`. `null` when
 * there's nothing. A wrong character is named with its position (1-based, in code points).
 */
export function parse(input: string): Parsed | null {
  const text = input.trim();
  if (!text) return null;
  let start = 0;
  let body = text;
  const urn = /^urn:uuid:/i.exec(body);
  if (urn) {
    start = urn[0].length;
    body = body.slice(start);
  }
  const open = body.startsWith('{');
  const close = body.endsWith('}');
  if (open || close) {
    if (!(open && close) || body.length < 2) return { ok: false, code: 'braces' };
    body = body.slice(1, -1);
    start += 1;
  }
  let digits = 0;
  let i = 0;
  for (const ch of body) {
    if (/[0-9a-f]/i.test(ch)) digits++;
    else if (ch !== '-') return { ok: false, code: 'char', char: ch, position: [...text.slice(0, start)].length + [...body.slice(0, i)].length + 1 };
    i += ch.length;
  }
  if (digits !== 32) return { ok: false, code: 'length', digits };
  if (body.includes('-') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body)) return { ok: false, code: 'hyphens' };
  return { ok: true, bytes: toBytes(body) };
}

/** 32 hex digits (hyphens skipped) as 16 bytes. */
export function toBytes(hex: string): Bytes {
  const h = hex.replaceAll('-', '');
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return b;
}

export type Variant = 'ncs' | 'rfc' | 'microsoft' | 'future';

export interface Time {
  /** Unix time in milliseconds. */
  ms: number;
  /** Below the millisecond, in 100 ns steps (0–9999); v1 and v6 count in those. */
  ticks: number;
  /** How many fraction digits it's precise to: 3 (v7) or 7 (v1, v6). */
  digits: 3 | 7;
}

export interface Info {
  /** The nil UUID (all zeros) or the max UUID (all ones), which have no version. */
  special: 'nil' | 'max' | null;
  variant: Variant;
  /** 1–15, read only for the RFC variant; null otherwise. */
  version: number | null;
  time: Time | null;
  /** v1 and v6: the clock sequence (14 bits). */
  clockSeq: number | null;
  /** v1 and v6: the node, usually a MAC address, as aa:bb:cc:dd:ee:ff. */
  node: string | null;
  /** The node's multicast bit is set: a random node, not a network card's. */
  randomNode: boolean;
}

/** 100 ns steps from 1582-10-15 (the Gregorian calendar's start) to 1970-01-01. */
export const GREGORIAN_OFFSET = 122192928000000000n;

function fromGregorian(ticks: bigint): Time {
  const since = ticks - GREGORIAN_OFFSET;
  // Floor, also before 1970.
  let ms = since / 10000n;
  let rest = since % 10000n;
  if (rest < 0n) {
    rest += 10000n;
    ms -= 1n;
  }
  return { ms: Number(ms), ticks: Number(rest), digits: 7 };
}

const big = (b: Bytes, from: number, to: number) => {
  let n = 0n;
  for (let i = from; i < to; i++) n = (n << 8n) | BigInt(b[i]);
  return n;
};

export function variantOf(b: Bytes): Variant {
  const v = b[8];
  if ((v & 0x80) === 0) return 'ncs';
  if ((v & 0xc0) === 0x80) return 'rfc';
  if ((v & 0xe0) === 0xc0) return 'microsoft';
  return 'future';
}

/** What a UUID says about itself. */
export function inspect(b: Bytes): Info {
  const all = (x: number) => b.every((y) => y === x);
  const special = all(0) ? 'nil' : all(0xff) ? 'max' : null;
  const variant = variantOf(b);
  const version = special || variant !== 'rfc' ? null : b[6] >> 4;
  let time: Time | null = null;
  let clockSeq: number | null = null;
  let node: string | null = null;
  if (version === 1) {
    // time_low (32), time_mid (16), version + time_high (12).
    const ticks = ((big(b, 6, 8) & 0x0fffn) << 48n) | (big(b, 4, 6) << 32n) | big(b, 0, 4);
    time = fromGregorian(ticks);
  } else if (version === 6) {
    // time_high (32), time_mid (16), version + time_low (12): the same count, sortable.
    const ticks = (big(b, 0, 4) << 28n) | (big(b, 4, 6) << 12n) | (big(b, 6, 8) & 0x0fffn);
    time = fromGregorian(ticks);
  } else if (version === 7) {
    time = { ms: Number(big(b, 0, 6)), ticks: 0, digits: 3 };
  }
  if (version === 1 || version === 6) {
    clockSeq = ((b[8] & 0x3f) << 8) | b[9];
    node = [...b.slice(10)].map((x) => HEX[x]).join(':');
  }
  return { special, variant, version, time, clockSeq, node, randomNode: node !== null && (b[10] & 1) === 1 };
}

/** The time inside, as ISO 8601 in UTC, to its precision (`…T19:22:22.0000000Z` for a v1). */
export function isoTime(t: Time): string {
  const d = new Date(t.ms);
  if (Number.isNaN(d.getTime())) return '';
  const s = d.toISOString();
  if (t.digits === 3) return s;
  return `${s.slice(0, -1)}${String(t.ticks).padStart(4, '0')}Z`;
}

/** How many of each in a list, for the "How many" field: 1–100, or null for nothing typed. */
export function clampCount(text: string): { n: number; clamped: boolean } | null {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return { n: 1, clamped: true };
  const n = Number(t);
  if (n < 1) return { n: 1, clamped: true };
  if (n > 100) return { n: 100, clamped: true };
  return { n, clamped: false };
}
