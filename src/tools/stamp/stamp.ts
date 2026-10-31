// Timestamps: Unix time to dates and back. Seconds, milliseconds, microseconds or nanoseconds, told
// apart by their size (or picked), kept exact with BigInt; a date in any IANA zone through Intl, a
// clock change (a skipped or a doubled hour) said out loud. Plain TypeScript with erasable types.

export type Unit = 's' | 'ms' | 'us' | 'ns';

/** Nanoseconds in one unit. */
const NS: Record<Unit, bigint> = { s: 1_000_000_000n, ms: 1_000_000n, us: 1_000n, ns: 1n };
/** Fraction digits a unit carries. */
const UNIT_DIGITS: Record<Unit, number> = { s: 0, ms: 3, us: 6, ns: 9 };

/** Dates run ±100 000 000 days around 1970 (the year −271821 to 275760). */
export const MAX_MS = 8.64e15;

/**
 * The unit a number this size most likely is. Seconds reach the year 5138 below 10^11; twelve to
 * fourteen digits are milliseconds (1973 on), then microseconds, then nanoseconds.
 */
export function detectUnit(abs: bigint): Unit {
  if (abs < 100_000_000_000n) return 's';
  if (abs < 100_000_000_000_000n) return 'ms';
  if (abs < 100_000_000_000_000_000n) return 'us';
  return 'ns';
}

/** A moment, exact to the nanosecond. */
export interface Instant {
  /** Milliseconds since 1970-01-01 UTC, floored. */
  ms: number;
  /** Nanoseconds past `ms`, 0 to 999 999. */
  sub: number;
  /** Fraction digits worth showing: 0 for whole seconds, 3 for milliseconds … 9. */
  digits: number;
}

export type Stamp = { ok: true; instant: Instant; unit: Unit } | { ok: false; code: 'nan' | 'range' };

/** "1761942000", "1761942000123", "-1", "1761942000.5"; separators (spaces, _ and ') are skipped. */
export function parseStamp(input: string, unit: Unit | 'auto'): Stamp | null {
  const t = input.trim().replace(/[\s_'’]/g, '');
  if (!t) return null;
  const m = /^([+\-−]?)(\d+)(?:[.,](\d+))?$/.exec(t);
  if (!m) return { ok: false, code: 'nan' };
  const whole = BigInt(m[2]);
  const u = unit === 'auto' ? detectUnit(whole) : unit;
  const frac = m[3] ?? '';
  // What's left of a nanosecond after the unit's own digits: 9 for seconds, 0 for nanoseconds.
  const room = 9 - UNIT_DIGITS[u];
  const fracNs = room && frac ? BigInt((frac + '0'.repeat(room)).slice(0, room)) : 0n;
  let total = whole * NS[u] + fracNs;
  if (m[1] === '-' || m[1] === '−') total = -total;
  let ms = total / 1_000_000n;
  let sub = total - ms * 1_000_000n;
  if (sub < 0n) {
    ms -= 1n;
    sub += 1_000_000n;
  }
  if (ms > BigInt(MAX_MS) || ms < -BigInt(MAX_MS)) return { ok: false, code: 'range' };
  return { ok: true, instant: { ms: Number(ms), sub: Number(sub), digits: UNIT_DIGITS[u] + Math.min(frac.length, room) }, unit: u };
}

/** The instant in a unit, exact: seconds and milliseconds floored, as Unix time is. */
export function inUnit(i: Instant, unit: Unit): string {
  const ns = BigInt(i.ms) * 1_000_000n + BigInt(i.sub);
  const per = NS[unit];
  let q = ns / per;
  if (ns < 0n && q * per !== ns) q -= 1n;
  return q.toString();
}

/** A wall clock reading: what a clock in some zone shows. Month 1–12. */
export interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
}

/** Milliseconds for a UTC wall time, years 0–99 included (Date.UTC turns 99 into 1999). */
export function utc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, ms);
  return d.getTime();
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** Whether the browser knows a zone; a stored name it doesn't know falls back to UTC. */
export function validZone(zone: string): string {
  try {
    formatter(zone);
    return zone;
  } catch {
    return 'UTC';
  }
}

const isUtc = (zone: string) => zone === 'UTC' || zone === 'Etc/UTC';
const mod = (a: number, b: number) => ((a % b) + b) % b;

/** What a clock in `zone` shows at `ms`. */
export function wallAt(ms: number, zone: string): Wall {
  if (isUtc(zone)) {
    const d = new Date(ms);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), ms: d.getUTCMilliseconds() };
  }
  const parts: Record<string, string> = {};
  for (const p of formatter(zone).formatToParts(new Date(ms))) parts[p.type] = p.value;
  const y = Number(parts.year);
  return {
    year: parts.era === 'BC' || parts.era === 'B' ? 1 - y : y,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    ms: mod(ms, 1000),
  };
}

/** The zone's offset from UTC at `ms`, in milliseconds (Berlin in winter: 3 600 000). */
export function offsetAt(ms: number, zone: string): number {
  if (isUtc(zone)) return 0;
  const w = wallAt(ms, zone);
  return utc(w.year, w.month, w.day, w.hour, w.minute, w.second) - (ms - mod(ms, 1000));
}

/**
 * A wall time in a zone to an instant. A time the clocks skip (a gap) is read with the offset from
 * before the change, so it lands as far past it as it was meant to; a time that happens twice
 * takes the first. Both say so (`fold`).
 */
export function zonedToUtc(w: Wall, zone: string): { ms: number; fold: 'gap' | 'twice' | null } {
  const guess = utc(w.year, w.month, w.day, w.hour, w.minute, w.second, w.ms);
  if (isUtc(zone)) return { ms: guess, fold: null };
  const before = offsetAt(guess - 86_400_000, zone);
  const after = offsetAt(guess + 86_400_000, zone);
  const candidates = [...new Set([before, offsetAt(guess, zone), after])].map((o) => guess - o);
  const valid = [...new Set(candidates.filter((t) => offsetAt(t, zone) === guess - t))].sort((a, b) => a - b);
  if (valid.length > 1) return { ms: valid[0], fold: 'twice' };
  if (valid.length) return { ms: valid[0], fold: null };
  return { ms: guess - before, fold: 'gap' };
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** ±hh:mm (with :ss when a zone's old local mean time has seconds); `sep` '' for RFC 2822. */
export function offsetText(offset: number, sep = ':'): string {
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  return `${sign}${p2(h)}${sep}${p2(m)}${s && sep ? `${sep}${p2(s)}` : ''}`;
}

/** Years as ISO writes them: four digits, or a sign and six beyond 0–9999 (as toISOString does). */
const isoYear = (y: number) => (y >= 0 && y <= 9999 ? String(y).padStart(4, '0') : `${y < 0 ? '-' : '+'}${String(Math.abs(y)).padStart(6, '0')}`);

function fraction(i: Instant): string {
  if (!i.digits) return '';
  const digits = String(mod(i.ms, 1000)).padStart(3, '0') + String(i.sub).padStart(6, '0');
  return `.${digits.slice(0, i.digits)}`;
}

/** 2026-10-31T21:20:00+01:00 in a zone, 2026-10-31T20:20:00Z in UTC; fraction digits as the instant has. */
export function iso(i: Instant, zone: string): string {
  const w = wallAt(i.ms, zone);
  const date = `${isoYear(w.year)}-${p2(w.month)}-${p2(w.day)}T${p2(w.hour)}:${p2(w.minute)}:${p2(w.second)}${fraction(i)}`;
  return date + (isUtc(zone) ? 'Z' : offsetText(offsetAt(i.ms, zone)));
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Sat, 31 Oct 2026 21:20:00 +0100: e-mail's date, in English whatever the language. */
export function rfc2822(i: Instant, zone: string): string {
  const w = wallAt(i.ms, zone);
  const day = DAYS[new Date(utc(w.year, w.month, w.day)).getUTCDay()];
  return `${day}, ${p2(w.day)} ${MONTHS[w.month - 1]} ${w.year} ${p2(w.hour)}:${p2(w.minute)}:${p2(w.second)} ${offsetText(offsetAt(i.ms, zone), '')}`;
}

/** "Saturday, 31 October 2026 at 21:20:00 CET", in the page's language. */
export function readable(i: Instant, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'long', timeZone: zone }).format(new Date(i.ms));
}

/** "3 days ago", "in 2 hours", "now", in the page's language. */
export function relative(ms: number, now: number, locale: string): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const S = 1000;
  const M = 60 * S;
  const H = 60 * M;
  const D = 24 * H;
  // `|| 0` turns −0 into 0: "now", not "0 seconds ago".
  const at = (n: number, unit: Intl.RelativeTimeFormatUnit) => rtf.format(Math.round(n) || 0, unit);
  if (abs < 45 * S) return at(diff / S, 'second');
  if (abs < 45 * M) return at(diff / M, 'minute');
  if (abs < 22 * H) return at(diff / H, 'hour');
  if (abs < 26 * D) return at(diff / D, 'day');
  if (abs < 320 * D) return at(diff / (30.436875 * D), 'month');
  return at(diff / (365.2425 * D), 'year');
}

/** A date and time as typed: the wall time, and its own offset when it has one. */
export type Typed = { ok: true; wall: Wall; offset: number | null; digits: number } | { ok: false; code: 'format' | 'invalid' };

const MONTH_NAMES = MONTHS.map((m) => m.toLowerCase());

function offsetOf(text: string | undefined): number | null {
  if (!text) return null;
  if (/^(z|utc|gmt|ut)$/i.test(text)) return 0;
  const m = /^([+-])(\d{2}):?(\d{2})?$/.exec(text);
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3_600_000 + Number(m[3] ?? 0) * 60_000);
}

const daysIn = (year: number, month: number) => new Date(utc(year, month + 1, 0)).getUTCDate();

/**
 * Dates as people paste them: ISO 8601 (2026-10-31, with a time, T or a space, seconds, a
 * fraction, Z or an offset), German (31.10.2026 21:20), US (10/31/2026 9:20 PM), RFC 2822
 * (Sat, 31 Oct 2026 21:20:00 +0100) and JavaScript's Date.toString().
 */
export function parseDate(input: string): Typed | null {
  const t = input.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  let y: number, mo: number, d: number;
  let h = 0, mi = 0, s = 0;
  let frac = '';
  let offset: number | null = null;
  let ampm = '';
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)? ?(Z|UTC|GMT|[+-]\d{2}(?::?\d{2})?)?)?$/i.exec(t))) {
    [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? 0, m[5] ?? 0, m[6] ?? 0].map(Number);
    frac = m[7] ?? '';
    offset = offsetOf(m[8]);
  } else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4}),? ?(?:(\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?Uhr)?)?$/i.exec(t))) {
    [d, mo, y, h, mi, s] = [m[1], m[2], m[3], m[4] ?? 0, m[5] ?? 0, m[6] ?? 0].map(Number);
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),? ?(?:(\d{1,2}):(\d{2})(?::(\d{2}))? ?(am|pm)?)?$/i.exec(t))) {
    [mo, d, y, h, mi, s] = [m[1], m[2], m[3], m[4] ?? 0, m[5] ?? 0, m[6] ?? 0].map(Number);
    ampm = (m[7] ?? '').toLowerCase();
  } else if ((m = /^(?:[a-z]{3},? )?(\d{1,2}) ([a-z]{3}) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? ?([+-]\d{4}|GMT|UTC|UT|Z)?$/i.exec(t))) {
    mo = MONTH_NAMES.indexOf(m[2].toLowerCase()) + 1;
    [d, y, h, mi, s] = [m[1], m[3], m[4], m[5], m[6] ?? 0].map(Number);
    offset = offsetOf(m[7]);
  } else if ((m = /^[a-z]{3} ([a-z]{3}) (\d{1,2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT([+-]\d{4})(?: \(.*\))?$/i.exec(t))) {
    mo = MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1;
    [d, y, h, mi, s] = [m[2], m[3], m[4], m[5], m[6]].map(Number);
    offset = offsetOf(m[7]);
  } else return { ok: false, code: 'format' };

  if (ampm) {
    if (h < 1 || h > 12) return { ok: false, code: 'invalid' };
    h = (h % 12) + (ampm === 'pm' ? 12 : 0);
  }
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo) || h > 23 || mi > 59 || s > 59) return { ok: false, code: 'invalid' };
  const ns = (frac + '000000000').slice(0, 9);
  return {
    ok: true,
    wall: { year: y, month: mo, day: d, hour: h, minute: mi, second: s, ms: Number(ns.slice(0, 3)) },
    offset,
    digits: frac.length,
  };
}

/** A typed date to an instant: its own offset when it has one, else read in `zone`. */
export function typedToInstant(typed: Extract<Typed, { ok: true }>, zone: string): { instant: Instant; fold: 'gap' | 'twice' | null } {
  const w = typed.wall;
  const r = typed.offset !== null ? { ms: utc(w.year, w.month, w.day, w.hour, w.minute, w.second, w.ms) - typed.offset, fold: null } : zonedToUtc(w, zone);
  return { instant: { ms: r.ms, sub: 0, digits: Math.min(3, typed.digits) }, fold: r.fold };
}

/** The last part of a zone's name, for a button: Europe/Berlin → Berlin. */
export const zoneCity = (zone: string) => (isUtc(zone) ? 'UTC' : (zone.split('/').pop() ?? zone).replace(/_/g, ' '));
