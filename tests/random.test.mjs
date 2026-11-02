// The fair draws behind Coin, dice, pick one (src/lib/random.ts): rejection at the exact boundary,
// every result owning the same number of words, and a chi-square on a seeded source (deterministic, so
// it never flakes). The real crypto source's statistics belong in a local sim, not in CI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fairInt, shuffle, pick, seededWords } from '../src/lib/random.ts';

const fixed = (...words) => {
  let i = 0;
  return () => words[i++];
};

test('rejects the words above the largest multiple of n', () => {
  // 2^32 = 4294967296; for n = 3 the limit is 4294967295, so the last word is drawn again.
  assert.equal(fairInt(3, fixed(4294967295, 7)), 1);
  assert.equal(fairInt(3, fixed(4294967294)), 4294967294 % 3);
  assert.equal(fairInt(6, fixed(0)), 0);
  assert.equal(fairInt(1, fixed(123456)), 0);
  // For n = 2^31 nothing is rejected.
  assert.equal(fairInt(2 ** 31, fixed(2 ** 32 - 1)), 2 ** 31 - 1);
});

test('refuses a count that is not a whole number from 1', () => {
  for (const n of [0, -1, 1.5, NaN, 2 ** 32 + 1]) assert.throws(() => fairInt(n, fixed(0)), RangeError);
});

test('every result owns the same number of words', () => {
  for (const n of [2, 3, 6, 7, 20, 30]) {
    const limit = Math.floor(2 ** 32 / n) * n;
    assert.equal(limit % n, 0);
    assert.ok(2 ** 32 - limit < n);
  }
});

test('a seeded six-sided die passes a chi-square test', () => {
  const words = seededWords(20261102);
  const counts = new Array(6).fill(0);
  const N = 60000;
  for (let i = 0; i < N; i++) counts[fairInt(6, words)]++;
  const chi = counts.reduce((sum, c) => sum + (c - N / 6) ** 2 / (N / 6), 0);
  // df = 5; the 1-in-a-million bound (Wilson–Hilferty) is about 35.9.
  assert.ok(chi < 35.9, `chi-square ${chi}`);
});

test('shuffle keeps every item once and leaves the list alone', () => {
  const list = ['Anna', 'Ben', 'Carla', 'Deniz', 'Emil'];
  const out = shuffle(list, seededWords(1));
  assert.deepEqual([...out].sort(), [...list].sort());
  assert.deepEqual(list, ['Anna', 'Ben', 'Carla', 'Deniz', 'Emil']);
  assert.deepEqual(shuffle(list, seededWords(1)), out);
});

test('shuffle puts each item first equally often', () => {
  const words = seededWords(7);
  const firsts = { a: 0, b: 0, c: 0, d: 0 };
  const N = 40000;
  for (let i = 0; i < N; i++) firsts[shuffle(['a', 'b', 'c', 'd'], words)[0]]++;
  const chi = Object.values(firsts).reduce((sum, c) => sum + (c - N / 4) ** 2 / (N / 4), 0);
  assert.ok(chi < 32.5, `chi-square ${chi}`); // df = 3
});

test('pick takes k different items, never more than there are', () => {
  const list = ['a', 'b', 'c'];
  assert.equal(new Set(pick(list, 2, seededWords(3))).size, 2);
  assert.equal(pick(list, 5, seededWords(3)).length, 3);
  assert.deepEqual(pick(list, 0, seededWords(3)), []);
});

test('the default source is crypto, never Math.random', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random used');
  };
  try {
    for (let i = 0; i < 100; i++) assert.ok(fairInt(6) < 6);
    assert.equal(shuffle([1, 2, 3]).length, 3);
  } finally {
    Math.random = original;
  }
});
