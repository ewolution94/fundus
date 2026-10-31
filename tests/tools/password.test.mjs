import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fairInt, cryptoInt, strong, strongBits, poolBits, pools, memorable, memorableBits, strength, wordsOf, LOOKALIKES, SETS } from '../../src/tools/password/password.ts';
import en from '../../src/tools/password/words-en.ts';
import de from '../../src/tools/password/words-de.ts';

/** mulberry32: a seeded source of 32-bit words, so the statistics below never flake. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
const seeded = (seed) => {
  const next = mulberry32(seed);
  return (n) => fairInt(n, next);
};

const ALL = { upper: true, lower: true, digits: true, symbols: true };

test('the rejection boundary: the uneven top of the words is drawn again', () => {
  // 2^32 = 4294967296; for n = 3 the largest multiple is 4294967295, so only the very last word goes.
  const words = [4294967295, 7];
  let i = 0;
  assert.equal(fairInt(3, () => words[i++]), 1);
  assert.equal(i, 2, 'the first word was rejected');
  i = 0;
  const top = [4294967294, 0];
  assert.equal(fairInt(3, () => top[i++]), 4294967294 % 3, 'the word below the limit is kept');
  assert.throws(() => fairInt(0, () => 0), RangeError);
});

test('every index owns exactly as many words as every other (checked over all 8-bit words)', () => {
  for (const n of [3, 7, 10, 26, 62, 100, 255]) {
    const owned = new Array(n).fill(0);
    let rejected = 0;
    for (let word = 0; word < 256; word++) {
      const seq = [word, 0];
      let k = 0;
      const got = fairInt(n, () => seq[k++], 256);
      if (k === 1) owned[got]++;
      else rejected++;
    }
    assert.ok(owned.every((c) => c === owned[0]), `n = ${n}: ${owned.join(',')}`);
    assert.equal(rejected, 256 % n, `n = ${n}`);
  }
});

test('chi-square on a seeded source: every index as often as it should be', () => {
  for (const n of [3, 10, 62, 7776]) {
    const draws = n * 200;
    const counts = new Array(n).fill(0);
    const rnd = seeded(n);
    for (let i = 0; i < draws; i++) counts[rnd(n)]++;
    const expected = draws / n;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    const df = n - 1;
    // Wilson–Hilferty, a one-in-a-million bound.
    const bound = df * (1 - 2 / (9 * df) + 4.753 * Math.sqrt(2 / (9 * df))) ** 3;
    assert.ok(chi < bound, `n = ${n}: χ² ${chi.toFixed(1)} ≥ ${bound.toFixed(1)}`);
  }
});

test('the real source never touches Math.random', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random was called');
  };
  try {
    for (let i = 0; i < 50; i++) cryptoInt(7776);
    strong({ length: 20, sets: ALL, avoidLookalikes: true });
    memorable({ words: 6, separator: '-', capitalise: true, digit: true }, wordsOf(en));
  } finally {
    Math.random = original;
  }
});

test('strong: the length asked for, every chosen set at least once, no look-alikes when asked', () => {
  for (let i = 0; i < 500; i++) {
    const p = strong({ length: 8, sets: ALL, avoidLookalikes: true });
    assert.equal(p.length, 8);
    assert.ok(/[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p), p);
    assert.ok(![...p].some((ch) => LOOKALIKES.includes(ch)), p);
    assert.ok([...p].every((ch) => Object.values(SETS).join('').includes(ch)), p);
  }
  assert.match(strong({ length: 64, sets: { upper: false, lower: false, digits: true, symbols: false }, avoidLookalikes: false }), /^\d{64}$/);
  assert.equal(strong({ length: 200, sets: ALL, avoidLookalikes: false }).length, 64, 'never past 64');
  assert.throws(() => strong({ length: 10, sets: { upper: false, lower: false, digits: false, symbols: false }, avoidLookalikes: false }));
});

test('the pools: look-alikes I l 1 O 0 left out', () => {
  assert.deepEqual(pools({ length: 8, sets: ALL, avoidLookalikes: false }).map((p) => p.length), [26, 26, 10, 17]);
  assert.deepEqual(pools({ length: 8, sets: ALL, avoidLookalikes: true }).map((p) => p.length), [24, 25, 8, 17]);
});

test('entropy by inclusion–exclusion matches counting every password by hand', () => {
  // Pools {a,b}, {c,d}, {1}: every string of 4 over the five characters that has one of each pool.
  const chars = ['a', 'b', 'c', 'd', '1'];
  let valid = 0;
  for (let i = 0; i < 5 ** 4; i++) {
    const s = [0, 1, 2, 3].map((k) => chars[Math.floor(i / 5 ** k) % 5]).join('');
    if (/[ab]/.test(s) && /[cd]/.test(s) && /1/.test(s)) valid++;
  }
  assert.ok(Math.abs(poolBits([2, 2, 1], 4) - Math.log2(valid)) < 1e-9, `${poolBits([2, 2, 1], 4)} vs log2(${valid})`);
  assert.ok(Math.abs(poolBits([2, 1], 3) - Math.log2(18)) < 1e-9);
  assert.equal(poolBits([10], 12), 12 * Math.log2(10), 'one pool: length × log2 of its size');
});

test('strong entropy: a little under length × log2(alphabet), from the every-set rule', () => {
  const bits = strongBits({ length: 20, sets: ALL, avoidLookalikes: false });
  const naive = 20 * Math.log2(79);
  assert.ok(bits < naive && bits > naive - 1, `${bits} vs ${naive}`);
  assert.ok(strongBits({ length: 20, sets: ALL, avoidLookalikes: true }) < bits);
});

test('the word lists: 7,776 words each, all different, plain letters', () => {
  for (const [name, text] of [['English', en], ['German', de]]) {
    const list = wordsOf(text);
    assert.equal(list.length, 7776, name);
    assert.equal(new Set(list).size, 7776, `${name}: duplicates`);
    assert.ok(list.every((w) => /^[a-z]+(-[a-z]+)?$/.test(w)), `${name}: an odd word`);
  }
  const english = wordsOf(en);
  assert.deepEqual([english[0], english[7775]], ['abacus', 'zoom'], 'EFF’s list, first and last');
  assert.ok(!/[äöüß]/.test(de), 'the German list has no umlauts to type');
});

test('memorable: the words from the list, the separator, capitals and a digit', () => {
  const list = wordsOf(en);
  const rnd = seeded(42);
  for (let i = 0; i < 200; i++) {
    const p = memorable({ words: 5, separator: '.', capitalise: true, digit: true }, list, rnd);
    const parts = p.split('.');
    assert.equal(parts.length, 5, p);
    assert.equal(parts.filter((w) => /\d$/.test(w)).length, 1, `one digit: ${p}`);
    for (const w of parts) {
      assert.match(w, /^[A-Z]/);
      assert.ok(list.includes(w.replace(/\d$/, '').toLowerCase()), w);
    }
  }
  assert.match(memorable({ words: 3, separator: ' ', capitalise: false, digit: false }, list, rnd), /^[a-z-]+ [a-z-]+ [a-z-]+$/);
});

test('memorable entropy: 12.9 bits a word, the digit adds log2(10 × words)', () => {
  const six = memorableBits({ words: 6, separator: '-', capitalise: false, digit: false }, 7776);
  assert.ok(Math.abs(six - 6 * Math.log2(7776)) < 1e-9);
  assert.ok(Math.abs(six - 77.55) < 0.01);
  const withDigit = memorableBits({ words: 6, separator: '-', capitalise: true, digit: true }, 7776);
  assert.ok(Math.abs(withDigit - six - Math.log2(60)) < 1e-9);
});

test('strength in plain words', () => {
  assert.equal(strength(40), 'weak');
  assert.equal(strength(51.7), 'fair');
  assert.equal(strength(64.6), 'strong');
  assert.equal(strength(77.5), 'strong');
  assert.equal(strength(125), 'very');
});
