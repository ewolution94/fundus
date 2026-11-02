// F-404 Coin, dice, pick one: the draws on seeded words, and the staging, which must always end on
// the result drawn. The fair integers themselves are tested in tests/random.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededWords } from '../../src/lib/random.ts';
import { flip, faceAt, landing, flipFrames, roll, sum, tumble, entries, pickOne, pickSome, shuffled, teams, flicker, slowing, teamsText, SIDES } from '../../src/tools/random/random.ts';

const NAMES = ['Anna', 'Ben', 'Carla', 'Deniz', 'Emil', 'Fatma', 'Greta'];

test('a coin lands on both faces, about equally on seeded words', () => {
  const words = seededWords(404);
  let heads = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (flip(words) === 'heads') heads++;
  const chi = (heads - N / 2) ** 2 / (N / 2) + (N - heads - N / 2) ** 2 / (N / 2);
  assert.ok(chi < 23.9, `chi-square ${chi}`); // df = 1, the 1-in-a-million bound
});

test('the flip always lands on the face drawn, whole turns on', () => {
  const words = seededWords(1);
  let angle = 0;
  for (let i = 0; i < 500; i++) {
    const face = flip(words);
    const turns = i % 7;
    const to = landing(angle, face, turns);
    assert.equal(faceAt(to), face, `from ${angle} to ${to}`);
    assert.ok(to >= angle + turns * 360, 'at least the turns asked for');
    assert.ok(to < angle + (turns + 1) * 360, 'and less than one more');
    angle = to;
  }
  // From any angle, even one off a face.
  for (const from of [-540, -180, 0, 45, 179.6, 359, 720.2]) {
    for (const face of ['heads', 'tails']) assert.equal(faceAt(landing(from, face, 3)), face);
  }
  assert.equal(faceAt(90), null, 'on its edge');
});

test('the flip’s frames end on the face drawn, full height', () => {
  const words = seededWords(2);
  let angle = 0;
  for (let i = 0; i < 300; i++) {
    const face = flip(words);
    const to = landing(angle, face, 5);
    const frames = flipFrames(angle, to);
    assert.equal(frames.length, 121);
    assert.equal(frames[0].offset, 0);
    assert.deepEqual(frames.at(-1), { offset: 1, scale: 1, face }, 'lands on the result');
    for (const f of frames) assert.ok(f.scale >= 0.03 && f.scale <= 1);
    // It really turns: the face changes many times on the way.
    const changes = frames.filter((f, k) => k && f.face !== frames[k - 1].face).length;
    assert.ok(changes >= 6, `${changes} changes`);
    angle = to;
  }
});

test('dice stay in range, every face comes up', () => {
  const words = seededWords(6);
  for (const sides of SIDES) {
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const r = roll(3, sides, words);
      assert.equal(r.length, 3);
      for (const v of r) {
        assert.ok(Number.isInteger(v) && v >= 1 && v <= sides, `d${sides} gave ${v}`);
        seen.add(v);
      }
    }
    assert.equal(seen.size, sides, `every face of a d${sides}`);
  }
  assert.throws(() => roll(0, 6), RangeError);
  assert.throws(() => roll(7, 6), RangeError);
  assert.throws(() => roll(2, 7), RangeError);
  assert.equal(sum([3, 4, 5]), 12);
});

test('the tumble ends on the result, and every frame moves', () => {
  const words = seededWords(9);
  const decor = (() => {
    const w = seededWords(99);
    return () => w() / 2 ** 32;
  })();
  for (const sides of SIDES) {
    for (let i = 0; i < 50; i++) {
      const result = roll(1 + (i % 6), sides, words);
      const frames = tumble(result, sides, 9, decor);
      assert.equal(frames.length, 9);
      assert.deepEqual(frames.at(-1), result, 'lands on the roll');
      for (let f = 0; f < frames.length - 1; f++) {
        for (const v of frames[f]) assert.ok(v >= 1 && v <= sides);
        if (f > 0) frames[f].forEach((v, k) => assert.notEqual(v, frames[f - 1][k], 'a die shows a new face each frame'));
      }
    }
  }
  // Even with decoration stuck at its ends.
  assert.deepEqual(tumble([4, 2], 6, 5, () => 0).at(-1), [4, 2]);
  assert.deepEqual(tumble([4, 2], 6, 5, () => 0.999999).at(-1), [4, 2]);
});

test('a list: one per line, bullets and blanks gone, repeats once', () => {
  assert.deepEqual(entries('Anna\n\n  Ben  \r\n- Carla\n• Deniz\nAnna'), { names: ['Anna', 'Ben', 'Carla', 'Deniz'], repeats: 1 });
  assert.deepEqual(entries('Anna, Ben; Carla'), { names: ['Anna', 'Ben', 'Carla'], repeats: 0 }, 'one line with commas');
  assert.deepEqual(entries('Müller, Anna\nBen'), { names: ['Müller, Anna', 'Ben'], repeats: 0 }, 'commas inside lines stay');
  assert.deepEqual(entries(''), { names: [], repeats: 0 });
});

test('pick one is one of the names, each about equally often', () => {
  const words = seededWords(11);
  const counts = Object.fromEntries(NAMES.map((n) => [n, 0]));
  const N = 35000;
  for (let i = 0; i < N; i++) counts[pickOne(NAMES, words)]++;
  const chi = Object.values(counts).reduce((s, c) => s + (c - N / 7) ** 2 / (N / 7), 0);
  assert.ok(chi < 37.4, `chi-square ${chi}`); // df = 6
  assert.throws(() => pickOne([]), RangeError);
});

test('pick several gives k different names', () => {
  const words = seededWords(12);
  for (let k = 1; k <= NAMES.length; k++) {
    const out = pickSome(NAMES, k, words);
    assert.equal(out.length, k);
    assert.equal(new Set(out).size, k, 'all different');
    for (const name of out) assert.ok(NAMES.includes(name));
  }
  assert.equal(pickSome(NAMES, 20, words).length, NAMES.length, 'never more than the list');
});

test('shuffle keeps every name once', () => {
  const out = shuffled(NAMES, seededWords(13));
  assert.deepEqual([...out].sort(), [...NAMES].sort());
});

test('teams are complete and balanced', () => {
  const words = seededWords(14);
  for (let n = 2; n <= 12; n++) {
    const names = Array.from({ length: n }, (_, i) => `P${i}`);
    for (let k = 2; k <= n + 2; k++) {
      const split = teams(names, k, words);
      assert.equal(split.length, Math.min(k, n), 'never more teams than names');
      const sizes = split.map((t) => t.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `sizes ${sizes}`);
      assert.deepEqual(split.flat().sort(), [...names].sort(), 'everyone once');
    }
  }
  assert.equal(teamsText([['Anna', 'Ben'], ['Carla']], (n) => `Team ${n}`), 'Team 1: Anna, Ben\nTeam 2: Carla');
});

test('the flicker ends on the pick, never the same name twice in a row', () => {
  const words = seededWords(15);
  for (const size of [2, 3, 7]) {
    const names = NAMES.slice(0, size);
    for (let i = 0; i < 100; i++) {
      const result = pickOne(names, words);
      const frames = flicker(names, result, 12);
      assert.equal(frames.length, 12);
      assert.equal(frames.at(-1), result);
      for (let f = 1; f < frames.length; f++) assert.notEqual(frames[f], frames[f - 1]);
      for (const name of frames) assert.ok(names.includes(name));
    }
  }
  assert.equal(flicker(['Anna', 'Ben'], 'Ben', 6, () => 0).at(-1), 'Ben');
  assert.equal(flicker(['Anna', 'Ben', 'Carla'], 'Carla', 6, () => 0.9999).at(-1), 'Carla');
  assert.deepEqual(flicker(['Anna'], 'Anna', 6), ['Anna']);
});

test('the frames slow down and end on time', () => {
  const t = slowing(10, 900);
  assert.equal(t.length, 10);
  assert.equal(t[0], 0);
  assert.equal(t.at(-1), 900);
  for (let i = 2; i < t.length; i++) assert.ok(t[i] - t[i - 1] > t[i - 1] - t[i - 2] - 1e-9, 'each gap longer');
});

test('the draws never reach Math.random', () => {
  const real = Math.random;
  Math.random = () => {
    throw new Error('Math.random decided a result');
  };
  try {
    // The defaults: the browser's crypto words.
    flip();
    roll(6, 20);
    pickOne(NAMES);
    pickSome(NAMES, 3);
    shuffled(NAMES);
    teams(NAMES, 3);
  } finally {
    Math.random = real;
  }
});
