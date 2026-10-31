import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, formatNumber, formatMoney, roundCents } from '../src/lib/numbers.ts';

test('reads numbers as people type them, in either language', () => {
  const cases = {
    '249,90': 249.9,
    '249.90': 249.9,
    '1.234,5': 1234.5,
    '1,234.5': 1234.5,
    '1 234': 1234,
    '1.500': 1500,
    '1,500': 1500,
    '0.125': 0.125,
    '12.5': 12.5,
    '-3,2': -3.2,
    '−7': -7,
    '+4': 4,
    '1.234.567,89': 1234567.89,
    '3': 3,
  };
  for (const [typed, value] of Object.entries(cases)) assert.equal(parseNumber(typed), value, typed);
});

test('anything else is NaN', () => {
  for (const typed of ['', ' ', 'abc', '12a', '1,2,x', '--1']) assert.ok(Number.isNaN(parseNumber(typed)), typed);
});

test('shows numbers with the decimal mark the setting names', () => {
  assert.equal(formatNumber(1234.5, 'comma'), '1.234,5');
  assert.equal(formatNumber(1234.5, 'point'), '1,234.5');
  assert.equal(formatNumber(-2, 'point'), '−2');
  assert.equal(formatNumber(1234.5, 'point', { group: false }), '1234.5');
  assert.equal(formatNumber(NaN, 'point'), '–');
  assert.equal(formatMoney(5, 'comma'), '5,00');
});

test('rounds cents like a receipt, without float drift', () => {
  assert.equal(roundCents(1.005), 1.01);
  assert.equal(roundCents(2.675), 2.68);
  assert.equal(roundCents(-1.005), -1.01);
  assert.equal(roundCents(0.1 + 0.2), 0.3);
});
