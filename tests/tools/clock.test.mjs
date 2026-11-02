// The clock works in the device's time zone: these tests pin it to Berlin's, clock changes and all.
// (node --test runs each file in its own process, so this stays here.)
process.env.TZ = 'Europe/Berlin';

const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { cycleOf, clockFace, faceAt, targetOf, countdown, countdownGroups, changed, handedIn } = await import('../../src/tools/clock/clock.ts');

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const at = (iso) => new Date(iso).getTime();

test('the time zone is Berlin’s', () => {
  assert.equal(new Date('2026-07-01T12:00:00Z').getHours(), 14, 'summer: +2');
  assert.equal(new Date('2026-12-01T12:00:00Z').getHours(), 13, 'winter: +1');
});

test('12 or 24 hours from the hour cycle', () => {
  assert.equal(cycleOf('h23'), 24);
  assert.equal(cycleOf('h24'), 24);
  assert.equal(cycleOf('h12'), 12);
  assert.equal(cycleOf('h11'), 12);
  assert.equal(cycleOf(undefined, true), 12);
  assert.equal(cycleOf(undefined, false), 24);
  assert.equal(cycleOf(undefined), 24);
});

test('24 hours: midnight, noon, leading zeros', () => {
  assert.deepEqual(clockFace(0, 0, 0, 24, false), { groups: ['00', '00'], period: null });
  assert.deepEqual(clockFace(12, 0, 0, 24, false), { groups: ['12', '00'], period: null });
  assert.deepEqual(clockFace(9, 5, 7, 24, true), { groups: ['09', '05', '07'], period: null });
  assert.deepEqual(clockFace(23, 59, 59, 24, true), { groups: ['23', '59', '59'], period: null });
});

test('12 hours: midnight is 12 AM, noon 12 PM, no leading zero', () => {
  assert.deepEqual(clockFace(0, 0, 0, 12, false), { groups: ['12', '00'], period: 'am' });
  assert.deepEqual(clockFace(0, 30, 0, 12, false), { groups: ['12', '30'], period: 'am' });
  assert.deepEqual(clockFace(12, 0, 0, 12, false), { groups: ['12', '00'], period: 'pm' });
  assert.deepEqual(clockFace(9, 5, 7, 12, true), { groups: [' 9', '05', '07'], period: 'am' }, 'the first card stays blank');
  assert.deepEqual(clockFace(13, 0, 0, 12, false), { groups: [' 1', '00'], period: 'pm' });
  assert.deepEqual(clockFace(23, 59, 0, 12, false), { groups: ['11', '59'], period: 'pm' });
  assert.deepEqual(clockFace(11, 59, 59, 12, true), { groups: ['11', '59', '59'], period: 'am' });
});

test('the face at a moment is local time', () => {
  assert.deepEqual(faceAt(at('2026-11-02T07:05:09Z'), 24, true).groups, ['08', '05', '09']);
  assert.deepEqual(faceAt(at('2026-07-02T22:30:00Z'), 12, false), { groups: ['12', '30'], period: 'am' }, 'after midnight in Berlin');
});

test('a local date and time as a moment', () => {
  assert.equal(targetOf('2026-12-24', '18:00'), at('2026-12-24T18:00:00+01:00'));
  assert.equal(targetOf('2026-07-01', '08:30'), at('2026-07-01T08:30:00+02:00'));
  assert.equal(targetOf('2026-12-24', ''), at('2026-12-24T00:00:00+01:00'), 'no time: midnight');
  assert.equal(targetOf('2026-03-29', '02:30'), at('2026-03-29T03:30:00+02:00'), 'in the spring gap: on with the clock');
  assert.ok(Number.isNaN(targetOf('2026-02-30', '12:00')), 'no 30 February');
  assert.ok(Number.isNaN(targetOf('2026-12-24', '25:00')));
  assert.ok(Number.isNaN(targetOf('', '12:00')));
  assert.ok(Number.isNaN(targetOf('24.12.2026', '12:00')), 'the picker gives ISO');
  assert.equal(new Date(targetOf('0099-06-01', '12:00')).getFullYear(), 99, 'a two-digit year stays itself');
});

test('the countdown’s parts', () => {
  const now = at('2026-11-02T12:00:00+01:00');
  assert.deepEqual(countdown(at('2026-12-24T18:00:00+01:00'), now), { days: 52, hours: 6, minutes: 0, seconds: 0, done: false });
  assert.deepEqual(countdown(now + H + 2 * M + 3 * S, now), { days: 0, hours: 1, minutes: 2, seconds: 3, done: false });
  assert.deepEqual(countdown(now + 1, now), { days: 0, hours: 0, minutes: 0, seconds: 1, done: false }, 'a second that has begun still counts');
  assert.deepEqual(countdown(now + 1500, now), { days: 0, hours: 0, minutes: 0, seconds: 2, done: false });
  assert.deepEqual(countdown(now, now), { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }, 'zero is reached');
  assert.deepEqual(countdown(now - 5 * H, now), { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }, 'a past target holds at zero');
  assert.deepEqual(countdown(NaN, now), { days: 0, hours: 0, minutes: 0, seconds: 0, done: false }, 'no target: nothing reached');
  assert.deepEqual(countdown(now + 400 * 24 * H, now).days, 400);
  assert.deepEqual(countdownGroups({ days: 52, hours: 6, minutes: 0, seconds: 9, done: false }), ['52', '06', '00', '09']);
  assert.deepEqual(countdownGroups({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true }), ['0', '00', '00', '00']);
});

test('across Berlin’s clock changes, days are calendar days', () => {
  // Spring: 29 March 2026 has 23 hours. Noon to noon over it is 47 hours, and two days.
  const springFrom = at('2026-03-28T12:00:00+01:00');
  const springTo = at('2026-03-30T12:00:00+02:00');
  assert.equal(springTo - springFrom, 47 * H);
  assert.deepEqual(countdown(springTo, springFrom), { days: 2, hours: 0, minutes: 0, seconds: 0, done: false });
  // An hour later the day is the short one: one day and 23 hours.
  assert.deepEqual(countdown(springTo, springFrom + H), { days: 1, hours: 23, minutes: 0, seconds: 0, done: false });
  // Autumn: 25 October 2026 has 25 hours.
  const fallFrom = at('2026-10-24T12:00:00+02:00');
  const fallTo = at('2026-10-26T12:00:00+01:00');
  assert.equal(fallTo - fallFrom, 49 * H);
  assert.deepEqual(countdown(fallTo, fallFrom), { days: 2, hours: 0, minutes: 0, seconds: 0, done: false });
  assert.deepEqual(countdown(fallTo, fallFrom + 30 * S), { days: 1, hours: 23, minutes: 59, seconds: 30, done: false });
  // Over the night of the change itself: midnight to 6 in the morning is 7 real hours.
  assert.deepEqual(countdown(at('2026-10-25T06:00:00+01:00'), at('2026-10-25T00:00:00+02:00')), { days: 0, hours: 7, minutes: 0, seconds: 0, done: false });
  assert.deepEqual(countdown(at('2026-03-29T06:00:00+02:00'), at('2026-03-29T00:00:00+01:00')), { days: 0, hours: 5, minutes: 0, seconds: 0, done: false });
  // Weeks across a change: still whole days at the same time of day.
  assert.deepEqual(countdown(targetOf('2026-04-10', '00:00'), at('2026-03-20T00:00:00+01:00')), { days: 21, hours: 0, minutes: 0, seconds: 0, done: false });
});

test('which cards change from one second to the next', () => {
  const face = (iso) => faceAt(at(iso), 24, true).groups;
  assert.deepEqual(changed(face('2026-11-02T12:34:56+01:00'), face('2026-11-02T12:34:57+01:00')), [
    [false, false],
    [false, false],
    [false, true],
  ]);
  assert.deepEqual(changed(face('2026-11-02T12:34:59+01:00'), face('2026-11-02T12:35:00+01:00')), [
    [false, false],
    [false, true],
    [true, true],
  ]);
  assert.deepEqual(changed(face('2026-11-02T23:59:59+01:00'), face('2026-11-03T00:00:00+01:00')), [
    [true, true],
    [true, true],
    [true, true],
  ]);
  const left = (now) => countdownGroups(countdown(at('2026-11-12T00:00:00+01:00'), at(now)));
  assert.deepEqual(changed(left('2026-11-02T00:00:00+01:00'), left('2026-11-02T00:00:01+01:00')), [[true], [true, true], [true, true], [true, true]], '10 days 00:00:00 to 9 days 23:59:59: a card fewer, all new');
  assert.deepEqual(changed(['12', '00'], ['12', '00']), [
    [false, false],
    [false, false],
  ]);
});

test('a date handed in from the home', () => {
  assert.deepEqual(handedIn('2026-12-24'), { date: '2026-12-24', time: '' });
  assert.deepEqual(handedIn(' 24.12.2026 '), { date: '2026-12-24', time: '' });
  assert.deepEqual(handedIn('1.5.27'), { date: '2027-05-01', time: '' });
  assert.deepEqual(handedIn('12/24/2026'), { date: '2026-12-24', time: '' });
  assert.deepEqual(handedIn('24/12/2026'), { date: '2026-12-24', time: '' }, 'a day over 12 first');
  assert.deepEqual(handedIn('2026-12-24T18:30'), { date: '2026-12-24', time: '18:30' });
  assert.deepEqual(handedIn('2026-12-24T17:30:00Z'), { date: '2026-12-24', time: '18:30' }, 'a moment in UTC, in Berlin');
  assert.deepEqual(handedIn('2026-06-30T23:30:00-0400'), { date: '2026-07-01', time: '05:30' });
  assert.equal(handedIn('31.02.2026'), null);
  assert.equal(handedIn('tomorrow'), null);
  assert.equal(handedIn('12.2026'), null);
});
