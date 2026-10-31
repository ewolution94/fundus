import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, clock, watchClock, timer, start, pause, reset, remaining, due, ring, nearest, nextEnd, watch, go, stop, lap, elapsed, laps, fastest, readTimers, readWatch, MAX } from '../../src/tools/timers/timers.ts';

const S = 1000;
const M = 60 * S;
const H = 60 * M;

test('lengths as people type them', () => {
  assert.equal(parseDuration('5'), 5 * M, 'a bare number is minutes');
  assert.equal(parseDuration('1,5'), 90 * S);
  assert.equal(parseDuration('0.5'), 30 * S);
  assert.equal(parseDuration('1:30'), 90 * S, 'm:ss');
  assert.equal(parseDuration('25:00'), 25 * M);
  assert.equal(parseDuration('1:02:03'), H + 2 * M + 3 * S, 'h:mm:ss');
  assert.equal(parseDuration('90s'), 90 * S);
  assert.equal(parseDuration('2 min'), 2 * M);
  assert.equal(parseDuration('1h 30m'), 90 * M);
  assert.equal(parseDuration('1 Std 30 Min'), 90 * M);
  assert.equal(parseDuration('45 Sekunden'), 45 * S);
  assert.equal(parseDuration('1,5 h'), 90 * M);
  assert.ok(Number.isNaN(parseDuration('1:75')), 'no 75th second');
  assert.ok(Number.isNaN(parseDuration('0')), 'nothing to count');
  assert.ok(Number.isNaN(parseDuration('')));
  assert.ok(Number.isNaN(parseDuration('tea')));
  assert.ok(Number.isNaN(parseDuration('5 minutes and')));
  assert.ok(Number.isNaN(parseDuration('100:00:00')), 'over 99:59:59');
  assert.equal(parseDuration('99:59:59'), MAX);
});

test('a countdown shows its seconds rounded up', () => {
  assert.equal(clock(5 * M), '5:00');
  assert.equal(clock(5 * M - 1), '5:00', 'just started');
  assert.equal(clock(4 * M + 59 * S), '4:59');
  assert.equal(clock(1), '0:01', 'the last moment is still a second');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(-500), '0:00');
  assert.equal(clock(H + 2 * M + 3 * S), '1:02:03');
  assert.equal(clock(10 * H), '10:00:00');
});

test('the stopwatch shows hundredths, rounded down', () => {
  assert.equal(watchClock(0), '0:00.00');
  assert.equal(watchClock(5270), '0:05.27');
  assert.equal(watchClock(5279), '0:05.27');
  assert.equal(watchClock(61_000), '1:01.00');
  assert.equal(watchClock(H + 2 * M + 3400), '1:02:03.40');
});

test('start, pause, resume, ring, reset: all from timestamps', () => {
  const t0 = 1_000_000;
  let t = timer('Tea', 5 * M);
  assert.equal(remaining(t, t0), 5 * M);
  t = start(t, t0);
  assert.equal(t.end, t0 + 5 * M);
  assert.equal(remaining(t, t0 + 61 * S), 3 * M + 59 * S);
  t = pause(t, t0 + 60 * S);
  assert.equal(t.end, null);
  assert.equal(t.left, 4 * M);
  assert.equal(remaining(t, t0 + 10 * H), 4 * M, 'paused: time stands still');
  t = start(t, t0 + 2 * H);
  assert.equal(t.end, t0 + 2 * H + 4 * M, 'resumes with what was left');
  assert.equal(due(t, t0 + 2 * H + 4 * M - 1), false);
  assert.equal(due(t, t0 + 2 * H + 4 * M), true);
  t = ring(t);
  assert.deepEqual([t.done, t.end, remaining(t, 0)], [true, null, 0]);
  const again = start(t, t0 + 3 * H);
  assert.equal(again.end, t0 + 3 * H + 5 * M, 'starting a rung timer starts it over');
  assert.equal(again.done, false);
  t = reset(t);
  assert.deepEqual([t.done, t.end, t.left], [false, null, 5 * M]);
  assert.equal(start(start(timer('x', M), 5), 99).end, 5 + M, 'starting a running one changes nothing');
});

test('a reload in the middle: the end time is all it needs', () => {
  const t = start(timer('Pasta', 10 * M), 0);
  const kept = JSON.parse(JSON.stringify([t]));
  const back = readTimers(kept)[0];
  assert.equal(remaining(back, 2 * M), 8 * M);
  assert.equal(due(back, 10 * M + 5 * S), true, 'it ended while the page was closed');
});

test('the nearest running timer, and when to wake up', () => {
  const list = [start(timer('a', 10 * M), 0), timer('b', M), start(timer('c', 3 * M), 0), pause(start(timer('d', 2 * M), 0), 30 * S)];
  assert.equal(nearest(list, 60 * S).name, 'c');
  assert.equal(nextEnd(list), 3 * M);
  assert.equal(nearest([timer('idle', M)], 0), null);
  assert.equal(nextEnd([]), null);
});

test('the stopwatch: runs, stops, laps', () => {
  let w = watch();
  assert.equal(elapsed(w, 123), 0);
  w = go(w, 1000);
  assert.equal(elapsed(w, 6270), 5270);
  w = lap(w, 6270);
  w = lap(w, 9270);
  w = stop(w, 10_000);
  assert.equal(elapsed(w, 99_999), 9000, 'stopped: it stands');
  w = go(w, 20_000);
  assert.equal(elapsed(w, 21_000), 10_000, 'and carries on from there');
  w = lap(w, 21_000);
  const list = laps(w);
  assert.deepEqual(list, [
    { n: 3, time: 1730, total: 10_000 },
    { n: 2, time: 3000, total: 8270 },
    { n: 1, time: 5270, total: 5270 },
  ]);
  assert.equal(fastest(list), 3);
  assert.equal(fastest(list.slice(2)), null, 'one lap has no fastest');
});

test('what was kept is checked before it’s used', () => {
  assert.deepEqual(readTimers(null), []);
  assert.deepEqual(readTimers('nope'), []);
  const list = readTimers([{ id: 'a', name: 'Tea', length: 60000, end: 5, left: 60000, done: false }, { length: -1 }, { length: 'x' }, null, { name: 'no length' }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].end, 5);
  assert.deepEqual(readWatch({ start: 'x', before: -5, laps: [1, 'b', 3] }), { start: null, before: 0, laps: [1, 3] });
  assert.deepEqual(readWatch(undefined), { start: null, before: 0, laps: [] });
});
