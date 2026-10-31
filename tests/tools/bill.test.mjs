import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, split, bill, settle, tipPercent } from '../../src/tools/bill/bill.ts';

const sum = (list) => list.reduce((a, b) => a + b, 0);

test('euros to cents without float drift', () => {
  assert.equal(toCents(36.67), 3667);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(1.005), 101, 'half a cent rounds up');
  assert.equal(toCents(19.99), 1999);
  assert.ok(Number.isNaN(toCents(NaN)));
});

test('shares add up to the total exactly', () => {
  assert.deepEqual(split(11000, 3), [3667, 3667, 3666]);
  assert.deepEqual(split(10000, 4), [2500, 2500, 2500, 2500]);
  assert.deepEqual(split(1, 3), [1, 0, 0]);
  assert.deepEqual(split(500, 1), [500]);
  assert.deepEqual(split(500, 0), []);
  for (let total = 1; total < 5000; total += 37) {
    for (let n = 1; n <= 13; n++) {
      const s = split(total, n);
      assert.equal(sum(s), total, `${total} / ${n}`);
      assert.ok(Math.max(...s) - Math.min(...s) <= 1, 'never more than a cent apart');
    }
  }
});

test('a tip on top', () => {
  const b = bill(10000, 10, 'top', 3);
  assert.deepEqual(b, { base: 10000, tip: 1000, extra: 0, total: 11000, shares: [3667, 3667, 3666] });
  assert.equal(bill(4790, 15, 'top', 2).tip, 719, '7.185 rounds to 7.19');
  assert.equal(bill(4790, 0, 'top', 2).total, 4790);
});

test('a tip already in the total', () => {
  const b = bill(6000, 10, 'in', 2);
  assert.equal(b.base, 5455);
  assert.equal(b.tip, 545);
  assert.equal(b.total, 6000, 'the total stays what was typed');
  assert.deepEqual(b.shares, [3000, 3000]);
  for (let amount = 1; amount < 20000; amount += 13) {
    for (const p of [5, 10, 12.5, 15]) {
      const x = bill(amount, p, 'in', 3);
      assert.equal(x.base + x.tip, amount, `${amount} at ${p}`);
      assert.equal(sum(x.shares), amount);
    }
  }
});

test('rounding each share up to whole euros', () => {
  const b = bill(10000, 10, 'top', 3, true);
  assert.deepEqual(b.shares, [3700, 3700, 3700]);
  assert.equal(b.extra, 100);
  assert.equal(b.total, 11100);
  assert.equal(b.base + b.tip + b.extra, b.total);
  assert.ok(Math.abs(tipPercent(b) - 11) < 1e-9);
  const even = bill(6000, 0, 'top', 3, true);
  assert.deepEqual([even.shares[0], even.extra], [2000, 0], 'already whole: nothing added');
});

test('nonsense in, nothing out', () => {
  assert.equal(bill(0, 10, 'top', 2), null);
  assert.equal(bill(-500, 10, 'top', 2), null);
  assert.equal(bill(1000, 10, 'top', 0), null);
  assert.equal(bill(1000, NaN, 'top', 2), null);
  assert.equal(bill(1000, -5, 'top', 2), null);
  assert.equal(bill(10.5, 10, 'top', 2), null, 'cents are whole');
});

/** Applies transfers and checks every balance is zero, to the cent. */
function check(paid, shares, transfers) {
  const left = paid.map((p, i) => p - shares[i]);
  for (const t of transfers) {
    assert.ok(Number.isInteger(t.amount) && t.amount > 0, JSON.stringify(t));
    assert.notEqual(t.from, t.to);
    left[t.from] += t.amount;
    left[t.to] -= t.amount;
  }
  assert.deepEqual(left, left.map(() => 0), `${JSON.stringify(paid)} → ${JSON.stringify(transfers)}`);
}

test('one paid for everyone: everyone else pays them once', () => {
  const shares = split(9000, 3);
  const t = settle([9000, 0, 0], shares);
  assert.deepEqual(t, [
    { from: 1, to: 0, amount: 3000 },
    { from: 2, to: 0, amount: 3000 },
  ]);
});

test('exact pairs settle with one payment each', () => {
  const t = settle([2000, 0, 3500, 500], [1000, 1000, 1500, 2500]);
  // Balances: +10, −10, +20, −20.
  assert.equal(t.length, 2);
  check([2000, 0, 3500, 500], [1000, 1000, 1500, 2500], t);
});

test('the fewest payments, and never more than people − 1', () => {
  // +30 −10 −20: two payments.
  assert.equal(settle([4000, 0, 0], [1000, 1000, 2000]).length, 2);
  // Already even: none.
  assert.deepEqual(settle([1000, 1000], [1000, 1000]), []);
  // Random groups: always settles, always within n − 1.
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let round = 0; round < 500; round++) {
    const n = 2 + Math.floor(rand() * 9);
    const total = 1 + Math.floor(rand() * 50000);
    const shares = split(total, n);
    // Random payments adding up to the total.
    const cuts = Array.from({ length: n - 1 }, () => Math.floor(rand() * (total + 1))).sort((a, b) => a - b);
    const paid = [...cuts, total].map((c, i) => c - (i ? cuts[i - 1] : 0));
    const t = settle(paid, shares);
    check(paid, shares, t);
    assert.ok(t.length <= n - 1, `${t.length} payments for ${n} people`);
  }
});

test('payments that don’t add up to the shares: no plan', () => {
  assert.equal(settle([5000, 0], [3000, 3000]), null);
  assert.equal(settle([5000], [3000, 2000]), null);
});
