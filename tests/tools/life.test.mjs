// F-508 Life in numbers, in Berlin's time (a zone with clock changes): counts across the changes
// and leap years, 29 February, the round numbers in order, the planets, the weeks lived, the poster
// and the PNG's 300 dpi.

process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDays } from '../../src/tools/dates/dates.ts';
import { crc32 } from '../../src/lib/exif.ts';
import { instant, localDate, parseTime, counts, nextBirthday, roundBirthday, milestones, around, passed, daysUntil, LADDER, planetAges, PLANETS, YEAR, DAY, lifeWeeks, posterSvg, ROWS, COLS, withDpi, dpiOf, pngChunks } from '../../src/tools/life/life.ts';

const at = (date, time = '') => instant(date, time);

test('a birth moment in the device’s zone', () => {
  assert.equal(new Date(at('1990-05-15', '14:30')).toISOString(), '1990-05-15T12:30:00.000Z', 'summer time');
  assert.equal(new Date(at('1990-01-15')).toISOString(), '1990-01-14T23:00:00.000Z', 'the day’s start without a time');
  assert.equal(new Date(at('2026-03-29', '02:30')).getHours(), 3, 'a time the clocks skip moves on');
  assert.equal(localDate(at('2026-10-25', '02:30')), '2026-10-25');
  assert.deepEqual(parseTime('7:05'), [7, 5, 0]);
  assert.equal(parseTime('24:00'), null);
  assert.ok(Number.isNaN(at('2026-02-30')));
});

test('the counts on 2 November 2026', () => {
  const c = counts('1990-05-15', '', at('2026-11-02', '10:00'));
  assert.equal(c.years, 36);
  assert.equal(c.months, 5);
  assert.equal(c.days, 18);
  assert.equal(c.totalDays, 13320);
  assert.equal(c.totalDays, toDays('2026-11-02') - toDays('1990-05-15'));
  assert.equal(c.weeks, 1902);
  assert.equal(c.weekDays, 6);
  assert.equal(c.totalMonths, 437);
  assert.equal(c.seconds, Math.floor((at('2026-11-02', '10:00') - at('1990-05-15')) / 1000));
  assert.equal(c.minutes, Math.floor(c.seconds / 60));
  assert.equal(c.hours, Math.floor(c.seconds / 3600));
  assert.equal(c.heartbeats, Math.floor((c.seconds / 60) * 70), 'about 70 a minute');
  assert.equal(counts('2026-11-03', '', at('2026-11-02', '10:00')), null, 'not born yet');
  assert.equal(counts('2026-11-02', '18:00', at('2026-11-02', '10:00')), null, 'later today');
  assert.equal(counts('2026-11-02', '08:00', at('2026-11-02', '10:00')).hours, 2, 'born this morning');
});

test('days are calendar days across the clock changes; hours are real ones', () => {
  const spring = counts('2026-03-28', '', at('2026-03-30'));
  assert.equal(spring.totalDays, 2);
  assert.equal(spring.hours, 47, 'the night of 29 March has 23 hours');
  const autumn = counts('2026-10-24', '', at('2026-10-26'));
  assert.equal(autumn.totalDays, 2);
  assert.equal(autumn.hours, 49, 'the night of 25 October has 25');
  // A whole year round a change, at the same wall-clock time: 365 days, 8,760 hours.
  const year = counts('2025-03-01', '12:00', at('2026-03-01', '12:00'));
  assert.equal(year.totalDays, 365);
  assert.equal(year.hours, 8760);
});

test('leap years count their extra day', () => {
  assert.equal(counts('2000-01-01', '', at('2001-01-01', '12:00')).totalDays, 366);
  assert.equal(counts('2100-01-01', '', at('2101-01-01', '12:00')).totalDays, 365, '2100 is no leap year');
  assert.equal(counts('1999-03-01', '', at('2000-03-01')).years, 1);
});

test('born on 29 February: in other years the birthday is 28 February', () => {
  assert.deepEqual(nextBirthday('2004-02-29', '2026-01-10'), { date: '2026-02-28', turns: 22, inDays: 49 });
  assert.deepEqual(nextBirthday('2004-02-29', '2028-01-01'), { date: '2028-02-29', turns: 24, inDays: 59 }, 'a leap year has the real day');
  assert.deepEqual(nextBirthday('2004-02-29', '2026-02-28'), { date: '2026-02-28', turns: 22, inDays: 0 }, 'today');
  assert.deepEqual(roundBirthday('2004-02-29', '2026-01-10'), { date: '2034-02-28', turns: 30, inDays: 2971 });
  const c = counts('2004-02-29', '', at('2026-02-28', '12:00'));
  assert.equal(c.years, 22, 'a year older on 28 February');
  assert.equal(c.months, 0);
  assert.equal(c.days, 0);
});

test('the next birthday and the next round one', () => {
  assert.deepEqual(nextBirthday('1990-05-15', '2026-11-02'), { date: '2027-05-15', turns: 37, inDays: 194 });
  assert.deepEqual(roundBirthday('1990-05-15', '2026-11-02'), { date: '2030-05-15', turns: 40, inDays: daysUntil('2030-05-15', '2026-11-02') });
  assert.deepEqual(roundBirthday('1986-11-02', '2026-11-02'), { date: '2026-11-02', turns: 40, inDays: 0 }, 'a round birthday today');
  assert.deepEqual(nextBirthday('2026-11-02', '2026-11-02'), { date: '2027-11-02', turns: 1, inDays: 365 }, 'born today: the first is next year');
  assert.equal(roundBirthday('2026-11-02', '2026-11-02').turns, 10);
  assert.equal(roundBirthday('1990-05-15', '2030-05-15').turns, 40);
  assert.equal(roundBirthday('1990-05-15', '2030-05-16').turns, 50);
});

test('the round numbers, in order and right', () => {
  const list = milestones('1990-05-15', '14:30');
  for (let i = 1; i < list.length; i++) assert.ok(list[i].at >= list[i - 1].at, 'in order');
  const find = (unit, n) => list.find((m) => m.counts.some((c) => c.unit === unit && c.n === n));
  assert.equal(find('days', 10_000).date, '2017-09-30');
  assert.equal(toDays(find('days', 10_000).date) - toDays('1990-05-15'), 10_000);
  assert.equal(find('weeks', 2_000).date, '2028-09-12');
  assert.deepEqual(find('weeks', 2_000).counts, [{ unit: 'weeks', n: 2000 }, { unit: 'days', n: 14000 }], '2,000 weeks are 14,000 days: one line');
  assert.equal(find('months', 500).date, '2032-01-15');
  const billion = find('seconds', 1_000_000_000);
  assert.equal(billion.at - at('1990-05-15', '14:30'), 1e12);
  assert.equal(billion.date, '2022-01-21');
  // 11,574 days, 1 h 46 min 40 s on from 14:30 summer time: 15:16:40 in winter time.
  assert.deepEqual([new Date(billion.at).getHours(), new Date(billion.at).getMinutes()], [15, 16], 'real seconds, the wall clock in winter time');
  assert.equal(find('hours', 100_000).at - at('1990-05-15', '14:30'), 100_000 * 3600_000);
  assert.equal(find('minutes', 10_000_000).timed, true);
  // Every rung is there once.
  const total = Object.values(LADDER).reduce((n, l) => n + l.length, 0);
  assert.equal(list.reduce((n, m) => n + m.counts.length, 0), total);
});

test('the last one passed and the next five', () => {
  const list = milestones('1990-05-15');
  const now = at('2026-11-02', '10:00');
  const { last, next } = around(list, now);
  assert.equal(last.date, '2025-12-17');
  assert.deepEqual(last.counts, [{ unit: 'days', n: 13000 }]);
  assert.equal(next.length, 5);
  assert.deepEqual(next.map((m) => m.date), ['2028-05-23', '2028-09-12', '2031-06-09', '2032-01-15', '2034-03-05']);
  for (const m of next) assert.equal(passed(m, now), false);
  // A round day is the next one all through its day.
  const day = list.find((m) => m.counts[0].unit === 'days' && m.counts[0].n === 13000);
  assert.equal(passed(day, at('2025-12-17', '23:59')), false);
  assert.equal(passed(day, at('2025-12-18')), true);
  assert.equal(around(list, at('1990-05-16')).last, null, 'nothing passed yet');
});

test('the age on other planets', () => {
  const ages = Object.fromEntries(planetAges(YEAR).map((p) => [p.id, p.age]));
  assert.ok(Math.abs(ages.mercury - 4.15201) < 1e-4);
  assert.ok(Math.abs(ages.mars - 0.531685) < 1e-5);
  assert.ok(Math.abs(ages.neptune - 1 / 164.79132) < 1e-12);
  assert.equal(PLANETS.length, 7);
  const thirty = Object.fromEntries(planetAges(30 * YEAR).map((p) => [p.id, p.age]));
  assert.ok(Math.abs(thirty.saturn - 30 / 29.447498) < 1e-9, 'a Saturn year is about 29½ of ours');
});

test('weeks lived', () => {
  assert.deepEqual(lifeWeeks('1990-05-15', '2026-11-02'), { row: 36, col: 24, lived: 36 * 52 + 24 });
  assert.deepEqual(lifeWeeks('1990-05-15', '2026-05-15'), { row: 36, col: 0, lived: 36 * 52 }, 'a birthday starts a row');
  assert.deepEqual(lifeWeeks('1990-05-15', '2027-05-14'), { row: 36, col: 51, lived: 36 * 52 + 51 }, 'the year’s last day stays in its 52nd week');
  assert.deepEqual(lifeWeeks('2026-11-02', '2026-11-02'), { row: 0, col: 0, lived: 0 });
  assert.deepEqual(lifeWeeks('1930-01-01', '2026-11-02'), { row: ROWS, col: 0, lived: ROWS * COLS }, 'past 90 every box is filled');
  assert.equal(lifeWeeks('2026-11-03', '2026-11-02'), null);
});

test('the poster: every week a box, the lived ones filled, this one marked', () => {
  const weeks = lifeWeeks('1990-05-15', '2026-11-02');
  const svg = posterSvg(weeks, { title: 'Your life in weeks', born: 'Born 15 May 1990 <&>', legend: 'Each box is a week.', age: 'Age', week: 'Week' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="210mm" height="297mm" viewBox="0 0 210 297">/);
  const paths = [...svg.matchAll(/<path d="([^"]*)"/g)].map((m) => (m[1].match(/M/g) ?? []).length);
  assert.deepEqual(paths, [weeks.lived, ROWS * COLS - weeks.lived - 1, 1], 'filled, empty, this week');
  assert.match(svg, /fill="#ffe14a"/);
  assert.match(svg, /Born 15 May 1990 &lt;&amp;&gt;/, 'words are escaped');
  assert.ok(!/var\(|currentColor/.test(svg), 'fixed ink on white, whatever the theme');
  for (const decade of [0, 10, 80]) assert.match(svg, new RegExp(`>${decade}</text>`));
  const full = posterSvg(lifeWeeks('1930-01-01', '2026-11-02'), { title: '', born: '', legend: '', age: '', week: '' });
  assert.equal(([...full.matchAll(/<path d="([^"]*)"/g)][0][1].match(/M/g) ?? []).length, ROWS * COLS);
});

/** A tiny PNG: its signature, a 1 × 1 header, an empty data chunk and the end. */
function png(extra = []) {
  const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), ...extra.map(([t, d]) => chunk(t, d)), chunk('IDAT', new Uint8Array(4)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

test('the PNG says 300 dpi, right after its header', () => {
  const out = withDpi(png(), 300);
  assert.deepEqual(pngChunks(out).map((c) => c.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
  assert.equal(dpiOf(out), 300);
  assert.equal(dpiOf(png()), null);
  for (const c of pngChunks(out)) {
    const crc = new DataView(out.buffer, out.byteOffset + c.start + c.size - 4, 4).getUint32(0);
    assert.equal(crc, crc32(out.subarray(c.start + 4, c.start + c.size - 4)), `${c.type}'s checksum`);
  }
  // An old pHYs goes.
  const again = withDpi(png([['pHYs', new Uint8Array([0, 0, 11, 19, 0, 0, 11, 19, 1])]]), 300);
  assert.deepEqual(pngChunks(again).map((c) => c.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
  assert.equal(dpiOf(again), 300);
  assert.equal(DAY, 86_400_000);
});
