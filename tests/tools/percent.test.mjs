import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vat, percentOf, change } from '../../src/tools/percent/percent.ts';

test('VAT from gross and from net', () => {
  assert.deepEqual(vat(119, 19, 'gross'), { net: 100, vat: 19, gross: 119 });
  assert.deepEqual(vat(100, 19, 'net'), { net: 100, vat: 19, gross: 119 });
  assert.deepEqual(vat(10, 7, 'gross'), { net: 9.35, vat: 0.65, gross: 10 });
  assert.deepEqual(vat(249.9, 19, 'gross'), { net: 210, vat: 39.9, gross: 249.9 });
});

test('net and VAT always add up to the gross typed, to the cent', () => {
  for (let cents = 1; cents <= 200_000; cents += 7) {
    const gross = cents / 100;
    for (const rate of [19, 7, 20, 8.1]) {
      const v = vat(gross, rate, 'gross');
      assert.equal(Math.round((v.net + v.vat) * 100), cents, `${gross} at ${rate}`);
    }
  }
});

test('nonsense in, nothing out', () => {
  assert.ok(Number.isNaN(vat(NaN, 19, 'gross').net));
  assert.ok(Number.isNaN(vat(10, NaN, 'net').gross));
});

test('x % of y', () => {
  assert.deepEqual(percentOf(15, 80), { part: 12, plus: 92, minus: 68 });
});

test('change in percent', () => {
  const c = change(80, 92);
  assert.equal(c.percent, 15);
  assert.equal(c.difference, 12);
  assert.ok(Math.abs(c.ratio - 115) < 1e-9);
  assert.equal(change(-50, -25).percent, 50, 'from a negative, a rise is still a rise');
  const zero = change(0, 5);
  assert.ok(Number.isNaN(zero.percent) && Number.isNaN(zero.ratio));
  assert.equal(zero.difference, 5);
});
