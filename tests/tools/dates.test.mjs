import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, between, add, addMonths, addWorkdays, isoWeek, usWeek, weeksIn, weekday, dayOfYear, age, todayIn, toDays, fromDays } from '../../src/tools/dates/dates.ts';

test('dates as people type them', () => {
  assert.equal(parseDate('2026-10-31'), '2026-10-31');
  assert.equal(parseDate('31.10.2026'), '2026-10-31');
  assert.equal(parseDate(' 1.3.2026 '), '2026-03-01');
  assert.equal(parseDate('10/31/2026'), '2026-10-31');
  assert.equal(parseDate('31/10/2026'), '2026-10-31', 'a first number over 12 is the day');
  assert.equal(parseDate('2026/10/31'), '2026-10-31');
  assert.equal(parseDate('2026-10-31T14:30:00Z'), '2026-10-31');
  assert.equal(parseDate('12.03.85', 2026), '1985-03-12');
  assert.equal(parseDate('12.03.30', 2026), '2030-03-12');
  assert.equal(parseDate('29.02.2024'), '2024-02-29');
  assert.equal(parseDate('29.02.2026'), null, 'no 29 February in 2026');
  assert.equal(parseDate('31.04.2026'), null, 'April has 30 days');
  assert.equal(parseDate('29.02.1900'), null, '1900 was no leap year');
  assert.equal(parseDate('29.02.2000'), '2000-02-29', '2000 was');
  assert.equal(parseDate('tomorrow'), null);
  assert.equal(parseDate(''), null);
});

test('days round-trip, before 1970 and in the years 1–99 too', () => {
  for (const iso of ['1970-01-01', '1969-12-31', '2000-02-29', '0050-06-15', '0001-01-01', '9999-12-31']) assert.equal(fromDays(toDays(iso)), iso);
  assert.equal(toDays('1970-01-02'), 1);
});

test('days between, with and without the end day', () => {
  const b = between('2026-10-31', '2026-12-24');
  assert.equal(b.days, 54);
  assert.equal(b.inclusive, 55);
  assert.equal(b.weeks, 7);
  assert.equal(b.rest, 5);
  assert.equal(b.backwards, false);
  assert.equal(between('2026-01-01', '2027-01-01').days, 365);
  assert.equal(between('2028-01-01', '2029-01-01').days, 366, '2028 is a leap year');
  assert.equal(between('2026-03-28', '2026-03-30').days, 2, 'the clocks change in between: still two days');
  const back = between('2026-12-24', '2026-10-31');
  assert.equal(back.days, -54);
  assert.equal(back.backwards, true);
  assert.equal(back.inclusive, 55);
  const same = between('2026-10-31', '2026-10-31');
  assert.deepEqual([same.days, same.inclusive], [0, 1]);
  assert.equal(between('2026-13-01', '2026-10-31'), null);
});

test('working days, Monday to Friday, both days counted', () => {
  assert.equal(between('2026-11-02', '2026-11-06').workdays, 5, 'Monday to Friday');
  assert.equal(between('2026-11-02', '2026-11-08').workdays, 5, 'the weekend adds none');
  assert.equal(between('2026-10-31', '2026-11-01').workdays, 0, 'a weekend alone');
  assert.equal(between('2026-11-06', '2026-11-09').workdays, 2, 'Friday to Monday');
  assert.equal(between('2026-01-01', '2026-12-31').workdays, 261);
  assert.equal(between('2026-11-09', '2026-11-06').workdays, 2, 'the other way round too');
  // Brute force against a day-by-day count.
  for (let start = 0; start < 14; start++) {
    for (let len = 0; len < 40; len++) {
      const a = fromDays(toDays('2026-06-01') + start);
      const b = fromDays(toDays(a) + len);
      let n = 0;
      for (let d = toDays(a); d <= toDays(b); d++) if (weekday(fromDays(d)) <= 5) n++;
      assert.equal(between(a, b).workdays, n, `${a} → ${b}`);
    }
  }
});

test('months clamp at the month’s end', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29', 'a leap year');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
  assert.equal(addMonths('2026-10-31', 3), '2027-01-31');
  assert.equal(addMonths('2026-01-15', -13), '2024-12-15');
  assert.equal(add('2028-02-29', 1, 'years'), '2029-02-28');
  assert.equal(add('2028-02-29', 4, 'years'), '2032-02-29');
  assert.equal(add('2026-10-31', 10, 'days'), '2026-11-10');
  assert.equal(add('2026-10-31', -2, 'weeks'), '2026-10-17');
  assert.equal(add('2026-12-31', 1, 'days'), '2027-01-01');
  assert.equal(add('2026-10-31', 1.5, 'days'), null, 'whole steps only');
  assert.equal(add('9999-12-31', 1, 'days'), null, 'past the year 9999');
});

test('working days on: weekends skipped, the start not counted', () => {
  assert.equal(addWorkdays('2026-11-06', 1), '2026-11-09', 'Friday + 1 is Monday');
  assert.equal(addWorkdays('2026-10-31', 1), '2026-11-02', 'Saturday + 1 is Monday');
  assert.equal(addWorkdays('2026-11-02', 5), '2026-11-09');
  assert.equal(addWorkdays('2026-11-02', 6), '2026-11-10');
  assert.equal(addWorkdays('2026-11-09', -1), '2026-11-06', 'Monday − 1 is Friday');
  assert.equal(addWorkdays('2026-11-02', 0), '2026-11-02');
  // Against stepping one day at a time.
  for (let start = 0; start < 7; start++) {
    for (const n of [1, 2, 4, 5, 6, 7, 11, 23, -1, -5, -6, -17]) {
      const a = fromDays(toDays('2026-06-01') + start);
      let d = toDays(a);
      let left = Math.abs(n);
      while (left) {
        d += Math.sign(n);
        if (weekday(fromDays(d)) <= 5) left--;
      }
      assert.equal(addWorkdays(a, n), fromDays(d), `${a} ${n}`);
    }
  }
});

test('weekdays and the day of the year', () => {
  assert.equal(weekday('2026-10-31'), 6, 'a Saturday');
  assert.equal(weekday('1970-01-01'), 4, 'a Thursday');
  assert.equal(weekday('1969-12-28'), 7, 'a Sunday, before 1970');
  assert.equal(weekday('2000-02-29'), 2);
  assert.equal(dayOfYear('2026-10-31'), 304);
  assert.equal(dayOfYear('2028-12-31'), 366);
});

test('ISO weeks: 53 and week 1 at the edges of the year', () => {
  assert.deepEqual(isoWeek('2026-10-31'), { year: 2026, week: 44, first: '2026-10-26', last: '2026-11-01' });
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53, first: '2026-12-28', last: '2027-01-03' }, '2026 starts on a Thursday: 53 weeks');
  assert.equal(isoWeek('2027-01-03').week, 53);
  assert.deepEqual(isoWeek('2027-01-04'), { year: 2027, week: 1, first: '2027-01-04', last: '2027-01-10' });
  assert.deepEqual(isoWeek('2024-12-30'), { year: 2025, week: 1, first: '2024-12-30', last: '2025-01-05' }, 'late December in next year’s week 1');
  assert.deepEqual([isoWeek('2021-01-03').year, isoWeek('2021-01-03').week], [2020, 53]);
  assert.deepEqual([isoWeek('2021-01-04').year, isoWeek('2021-01-04').week], [2021, 1]);
  assert.deepEqual([isoWeek('2026-01-01').year, isoWeek('2026-01-01').week], [2026, 1]);
  assert.deepEqual([isoWeek('2023-01-01').year, isoWeek('2023-01-01').week], [2022, 52], 'a Sunday 1 January is the old year’s');
  assert.equal(weeksIn(2026, 'iso'), 53);
  assert.equal(weeksIn(2020, 'iso'), 53, 'a leap year starting on Wednesday');
  assert.equal(weeksIn(2027, 'iso'), 52);
  assert.equal(weeksIn(2015, 'iso'), 53);
});

test('US weeks: from Sunday, week 1 holds 1 January', () => {
  assert.deepEqual(usWeek('2026-10-31'), { year: 2026, week: 44, first: '2026-10-25', last: '2026-10-31' });
  assert.deepEqual(usWeek('2026-11-01'), { year: 2026, week: 45, first: '2026-11-01', last: '2026-11-07' }, 'Sunday starts the next one');
  assert.deepEqual(usWeek('2026-01-01'), { year: 2026, week: 1, first: '2025-12-28', last: '2026-01-03' });
  assert.deepEqual(usWeek('2025-12-29'), { year: 2026, week: 1, first: '2025-12-28', last: '2026-01-03' }, 'December days in the new year’s week 1');
  assert.deepEqual(usWeek('2026-12-30'), { year: 2027, week: 1, first: '2026-12-27', last: '2027-01-02' });
  assert.deepEqual(usWeek('2022-12-31'), { year: 2022, week: 53, first: '2022-12-25', last: '2022-12-31' });
  assert.deepEqual(usWeek('2022-01-01'), { year: 2022, week: 1, first: '2021-12-26', last: '2022-01-01' });
  assert.equal(usWeek('2022-01-02').week, 2);
  assert.equal(weeksIn(2022, 'us'), 53);
  assert.equal(weeksIn(2026, 'us'), 52);
  // Every day of a few years: week numbers run 1, 1…, 2, … without gaps, seven days each.
  for (const system of ['iso', 'us']) {
    const fn = system === 'iso' ? isoWeek : usWeek;
    let prev = fn('2019-12-01');
    let run = -1; // the first week is seen only in part
    for (let d = toDays('2019-12-01'); d <= toDays('2028-01-31'); d++) {
      const w = fn(fromDays(d));
      if (w.week === prev.week && w.year === prev.year) run = run === -1 ? -1 : run + 1;
      else {
        if (run !== -1) assert.equal(run, 7, `${system} ${prev.year}-W${prev.week}`);
        assert.ok(w.week === prev.week + 1 || (w.week === 1 && prev.week === weeksIn(prev.year, system)), `${system} ${fromDays(d)}`);
        run = 1;
      }
      prev = w;
    }
  }
});

test('age in years, months and days', () => {
  assert.deepEqual(age('1990-05-15', '2026-10-31'), { years: 36, months: 5, days: 16, total: 13318, next: '2027-05-15', nextIn: 196, turns: 37, leapling: false });
  const today = age('1990-10-31', '2026-10-31');
  assert.deepEqual([today.years, today.months, today.days, today.nextIn, today.turns], [36, 0, 0, 0, 36], 'the birthday is today');
  const eve = age('1990-11-01', '2026-10-31');
  assert.deepEqual([eve.years, eve.months, eve.days, eve.nextIn, eve.turns], [35, 11, 30, 1, 36]);
  assert.equal(age('2026-11-01', '2026-10-31'), null, 'not born yet');
  const baby = age('2026-10-31', '2026-10-31');
  assert.deepEqual([baby.years, baby.months, baby.days], [0, 0, 0]);
  const monthEnd = age('2026-01-31', '2026-02-28');
  assert.deepEqual([monthEnd.months, monthEnd.days], [1, 0], 'a month after 31 January is 28 February');
});

test('29 February birthdays fall on 28 February in other years', () => {
  const on28 = age('2000-02-29', '2027-02-28');
  assert.deepEqual([on28.years, on28.months, on28.days, on28.nextIn, on28.turns, on28.leapling], [27, 0, 0, 0, 27, true]);
  const before = age('2000-02-29', '2027-02-27');
  assert.deepEqual([before.years, before.nextIn, before.next], [26, 1, '2027-02-28']);
  const leapYear = age('2000-02-29', '2028-02-28');
  assert.deepEqual([leapYear.years, leapYear.months, leapYear.days, leapYear.next, leapYear.nextIn], [27, 11, 30, '2028-02-29', 1], 'in a leap year it’s the 29th');
  assert.deepEqual([age('2000-02-29', '2027-03-01').years, age('2000-02-29', '2027-03-01').days], [27, 1]);
});

test('today in the home zone', () => {
  const t = Date.parse('2026-10-31T23:30:00Z');
  assert.equal(todayIn('Europe/Berlin', t), '2026-11-01', 'already midnight in Berlin');
  assert.equal(todayIn('America/New_York', t), '2026-10-31');
  assert.equal(todayIn('Pacific/Auckland', Date.parse('2026-10-31T11:00:00Z')), '2026-11-01');
  assert.equal(todayIn('Not/AZone', t).length, 10, 'a broken zone falls back to the device’s');
});
