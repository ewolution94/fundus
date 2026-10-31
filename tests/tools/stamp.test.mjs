import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectUnit, parseStamp, inUnit, offsetAt, wallAt, zonedToUtc, iso, rfc2822, readable, relative, parseDate, typedToInstant, utc, validZone, zoneCity, offsetText } from '../../src/tools/stamp/stamp.ts';

const T = 1761942000; // 2025-10-31T20:20:00Z
const at = (input, unit = 'auto') => {
  const s = parseStamp(input, unit);
  assert.ok(s?.ok, `${input}: ${JSON.stringify(s)}`);
  return s;
};

test('seconds, milliseconds, microseconds and nanoseconds told apart by size', () => {
  assert.equal(detectUnit(0n), 's');
  assert.equal(detectUnit(BigInt(T)), 's');
  assert.equal(detectUnit(99_999_999_999n), 's', 'eleven digits: still seconds (year 5138)');
  assert.equal(detectUnit(100_000_000_000n), 'ms', 'twelve digits: milliseconds from 1973');
  assert.equal(detectUnit(BigInt(T) * 1000n), 'ms');
  assert.equal(detectUnit(BigInt(T) * 1_000_000n), 'us');
  assert.equal(detectUnit(BigInt(T) * 1_000_000_000n), 'ns');
  for (const [input, unit] of [[`${T}`, 's'], [`${T}123`, 'ms'], [`${T}123456`, 'us'], [`${T}123456789`, 'ns']]) {
    const s = at(input);
    assert.equal(s.unit, unit, input);
    assert.equal(s.instant.ms, T * 1000 + (unit === 's' ? 0 : 123));
  }
});

test('exact to the nanosecond, past what a float holds', () => {
  const s = at(`${T}123456789`);
  assert.deepEqual(s.instant, { ms: T * 1000 + 123, sub: 456789, digits: 9 });
  assert.equal(iso(s.instant, 'UTC'), '2025-10-31T20:20:00.123456789Z');
  assert.equal(inUnit(s.instant, 'ns'), `${T}123456789`);
  assert.equal(inUnit(s.instant, 'us'), `${T}123456`);
  assert.equal(inUnit(s.instant, 's'), `${T}`);
});

test('a unit picked by hand wins; fractions, signs and separators', () => {
  assert.equal(at(`${T}`, 'ms').instant.ms, T);
  assert.deepEqual(at('1761942000.5').instant, { ms: T * 1000 + 500, sub: 0, digits: 1 });
  assert.deepEqual(at('1761942000,25').instant, { ms: T * 1000 + 250, sub: 0, digits: 2 });
  assert.equal(at('1 761 942 000').instant.ms, T * 1000);
  assert.equal(at('1_761_942_000').instant.ms, T * 1000);
  // Before 1970, floored like Unix time: −1.5 s is 1969-12-31T23:59:58.5.
  assert.deepEqual(at('-1.5').instant, { ms: -1500, sub: 0, digits: 1 });
  assert.equal(iso(at('-1.5').instant, 'UTC'), '1969-12-31T23:59:58.5Z');
  assert.equal(inUnit(at('-1.5').instant, 's'), '-2');
  assert.equal(at('−86400').instant.ms, -86_400_000);
  assert.deepEqual(parseStamp('12abc', 'auto'), { ok: false, code: 'nan' });
  assert.deepEqual(parseStamp('1e9', 'auto'), { ok: false, code: 'nan' });
  assert.deepEqual(parseStamp('8640000000000001', 'ms'), { ok: false, code: 'range' });
  assert.ok(parseStamp('8640000000000000', 'ms').ok);
  assert.equal(parseStamp('   ', 'auto'), null);
});

test('offsets: summer and winter, half and quarter hours, half-hour summer time', () => {
  const summer = utc(2026, 7, 1, 12);
  const winter = utc(2026, 1, 15, 12);
  assert.equal(offsetAt(summer, 'Europe/Berlin'), 2 * 3_600_000);
  assert.equal(offsetAt(winter, 'Europe/Berlin'), 1 * 3_600_000);
  assert.equal(offsetAt(winter, 'Asia/Kolkata'), 5.5 * 3_600_000);
  assert.equal(offsetAt(winter, 'Asia/Kathmandu'), 5.75 * 3_600_000);
  assert.equal(offsetAt(winter, 'America/St_Johns'), -3.5 * 3_600_000);
  assert.equal(offsetAt(summer, 'Australia/Lord_Howe'), 10.5 * 3_600_000);
  assert.equal(offsetAt(winter, 'Australia/Lord_Howe'), 11 * 3_600_000);
  assert.equal(offsetAt(winter, 'America/New_York'), -5 * 3_600_000);
  assert.equal(offsetAt(winter, 'UTC'), 0);
  // Before 1970, and on the second the clocks change (Berlin, 2026-03-29 01:00 UTC).
  assert.equal(offsetAt(utc(1969, 7, 20, 20, 17), 'America/New_York'), -4 * 3_600_000);
  assert.equal(offsetAt(utc(2026, 3, 29, 0, 59, 59), 'Europe/Berlin'), 3_600_000);
  assert.equal(offsetAt(utc(2026, 3, 29, 1), 'Europe/Berlin'), 7_200_000);
});

test('ISO 8601 and RFC 2822 in the home zone and in UTC', () => {
  const i = { ms: T * 1000, sub: 0, digits: 0 };
  assert.equal(iso(i, 'UTC'), '2025-10-31T20:20:00Z');
  assert.equal(iso(i, 'Europe/Berlin'), '2025-10-31T21:20:00+01:00');
  assert.equal(iso(i, 'Asia/Kolkata'), '2025-11-01T01:50:00+05:30');
  assert.equal(iso(i, 'America/St_Johns'), '2025-10-31T17:50:00-02:30', 'still on summer time until 2 November');
  assert.equal(iso({ ms: T * 1000 + 7, sub: 0, digits: 3 }, 'UTC'), new Date(T * 1000 + 7).toISOString());
  assert.equal(rfc2822(i, 'UTC'), 'Fri, 31 Oct 2025 20:20:00 +0000');
  assert.equal(rfc2822(i, 'Europe/Berlin'), 'Fri, 31 Oct 2025 21:20:00 +0100');
  assert.equal(rfc2822({ ms: utc(2026, 7, 4, 9, 5, 3), sub: 0, digits: 0 }, 'America/New_York'), 'Sat, 04 Jul 2026 05:05:03 -0400');
  // The far ends of what a Date holds, written as toISOString writes them.
  for (const ms of [8.64e15, -8.64e15, utc(1, 1, 1), utc(0, 6, 15), -62198755200000]) assert.equal(iso({ ms, sub: 0, digits: 3 }, 'UTC'), new Date(ms).toISOString(), String(ms));
  assert.equal(iso({ ms: utc(-44, 3, 15, 12), sub: 0, digits: 0 }, 'UTC'), '-000044-03-15T12:00:00Z');
  assert.deepEqual(wallAt(utc(-44, 3, 15, 12), 'Europe/Rome').year, -44, 'BC years count through Intl too');
  assert.equal(offsetText(-(3 * 3_600_000 + 30 * 60_000)), '-03:30');
  assert.equal(offsetText(3_208_000), '+00:53:28', 'local mean time had seconds');
});

test('a readable form and a relative one, in English and German', () => {
  const i = { ms: T * 1000, sub: 0, digits: 0 };
  assert.match(readable(i, 'Europe/Berlin', 'en'), /^Friday, October 31, 2025 at 9:20:00\s?PM GMT\+1$/);
  assert.match(readable(i, 'Europe/Berlin', 'de'), /^Freitag, 31\. Oktober 2025 um 21:20:00 MEZ$/);
  assert.match(readable(i, 'UTC', 'en'), /UTC$/);
  const now = T * 1000;
  const day = 86_400_000;
  assert.equal(relative(now, now, 'en'), 'now');
  assert.equal(relative(now - 400, now, 'en'), 'now');
  assert.equal(relative(now - 3 * day, now, 'en'), '3 days ago');
  assert.equal(relative(now - 3 * day, now, 'de'), 'vor 3 Tagen');
  assert.equal(relative(now - day, now, 'en'), 'yesterday');
  assert.equal(relative(now + day, now, 'de'), 'morgen');
  assert.equal(relative(now + 2 * 3_600_000, now, 'en'), 'in 2 hours');
  assert.equal(relative(now - 10 * 60_000, now, 'de'), 'vor 10 Minuten');
  assert.equal(relative(now - 90 * day, now, 'en'), '3 months ago');
  assert.equal(relative(now + 3 * 365 * day, now, 'en'), 'in 3 years');
});

test('dates as typed: ISO, German, US, RFC 2822, Date.toString()', () => {
  const w = (y, mo, d, h = 0, mi = 0, s = 0, ms = 0) => ({ year: y, month: mo, day: d, hour: h, minute: mi, second: s, ms });
  const cases = [
    ['2026-10-31', w(2026, 10, 31), null],
    ['2026-10-31 21:20', w(2026, 10, 31, 21, 20), null],
    ['2026-10-31T21:20:05.123Z', w(2026, 10, 31, 21, 20, 5, 123), 0],
    ['2026-10-31T21:20:05+01:00', w(2026, 10, 31, 21, 20, 5), 3_600_000],
    ['2026-10-31T21:20-0330', w(2026, 10, 31, 21, 20), -12_600_000],
    ['31.10.2026', w(2026, 10, 31), null],
    ['31.10.2026, 21:20 Uhr', w(2026, 10, 31, 21, 20), null],
    ['1.2.2026 7:05:09', w(2026, 2, 1, 7, 5, 9), null],
    ['10/31/2026 9:20 PM', w(2026, 10, 31, 21, 20), null],
    ['10/31/2026 12:05 am', w(2026, 10, 31, 0, 5), null],
    ['Sat, 31 Oct 2026 21:20:00 +0100', w(2026, 10, 31, 21, 20), 3_600_000],
    ['Sat, 31 Oct 2026 20:20:00 GMT', w(2026, 10, 31, 20, 20), 0],
    ['Sat Oct 31 2026 21:20:00 GMT+0100 (Central European Standard Time)', w(2026, 10, 31, 21, 20), 3_600_000],
  ];
  for (const [text, wall, offset] of cases) {
    const t = parseDate(text);
    assert.ok(t?.ok, text);
    assert.deepEqual([t.wall, t.offset], [wall, offset], text);
  }
  for (const bad of ['2026-02-29', '2026-13-01', '31.04.2026', '2026-10-31 25:00', '2026-10-31 21:60', '10/31/2026 13:00 pm']) assert.deepEqual(parseDate(bad), { ok: false, code: 'invalid' }, bad);
  assert.ok(parseDate('2028-02-29').ok, 'a leap day');
  for (const bad of ['tomorrow', '2026/10/31', '31-10-2026', '1761942000']) assert.deepEqual(parseDate(bad), { ok: false, code: 'format' }, bad);
  assert.equal(parseDate('  '), null);
});

test('a typed date to Unix time: its own offset, or the zone’s', () => {
  const ms = (text, zone) => typedToInstant(parseDate(text), zone).instant.ms;
  assert.equal(ms('2025-10-31 21:20', 'Europe/Berlin'), T * 1000);
  assert.equal(ms('2025-10-31 20:20', 'UTC'), T * 1000);
  assert.equal(ms('2025-10-31T20:20:00Z', 'Asia/Tokyo'), T * 1000, 'its own Z wins');
  assert.equal(ms('31.10.2025 21:20', 'Europe/Berlin'), T * 1000);
  assert.equal(ms('2025-07-01 12:00', 'Europe/Berlin'), utc(2025, 7, 1, 10));
  assert.equal(ms('0099-01-01T00:00:00Z', 'UTC'), utc(99, 1, 1), 'year 99 is not 1999');
});

test('clock changes: a skipped time moves on, a doubled one takes the first', () => {
  // Berlin, 29 March 2026: 02:00 → 03:00. 02:30 doesn't exist.
  const gap = zonedToUtc({ year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0, ms: 0 }, 'Europe/Berlin');
  assert.deepEqual(gap, { ms: utc(2026, 3, 29, 1, 30), fold: 'gap' });
  assert.equal(iso({ ms: gap.ms, sub: 0, digits: 0 }, 'Europe/Berlin'), '2026-03-29T03:30:00+02:00');
  // 25 October 2026: 03:00 → 02:00. 02:30 happens twice.
  const twice = zonedToUtc({ year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0, ms: 0 }, 'Europe/Berlin');
  assert.deepEqual(twice, { ms: utc(2026, 10, 25, 0, 30), fold: 'twice' });
  assert.equal(zonedToUtc({ year: 2026, month: 10, day: 25, hour: 4, minute: 0, second: 0, ms: 0 }, 'Europe/Berlin').fold, null);
  // New York's spring forward, and Lord Howe's half-hour one.
  assert.equal(zonedToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 15, second: 0, ms: 0 }, 'America/New_York').fold, 'gap');
  assert.equal(zonedToUtc({ year: 2026, month: 10, day: 4, hour: 2, minute: 15, second: 0, ms: 0 }, 'Australia/Lord_Howe').fold, 'gap');
});

test('a zone the browser doesn’t know falls back to UTC; short names for buttons', () => {
  assert.equal(validZone('Europe/Berlin'), 'Europe/Berlin');
  assert.equal(validZone('Mars/Olympus_Mons'), 'UTC');
  assert.equal(zoneCity('America/Argentina/Buenos_Aires'), 'Buenos Aires');
  assert.equal(zoneCity('Etc/UTC'), 'UTC');
});
