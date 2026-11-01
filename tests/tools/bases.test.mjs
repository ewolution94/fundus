import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, plain, shown, group, bitLength, bytes, hexBytes, twos, MAX_DIGITS, THIN } from '../../src/tools/bases/bases.ts';

/** Thousands as shown: kept together by a narrow no-break space. */
const n = (s) => s.replace(/ /g, THIN);

const value = (input, base = 10) => {
  const p = parse(input, base);
  assert.ok(p?.ok, `${input}: ${JSON.stringify(p, (_, v) => (typeof v === 'bigint' ? String(v) : v))}`);
  return p.value;
};

test('255 in every base', () => {
  assert.equal(value('255'), 255n);
  assert.equal(plain(255n, 16), 'FF');
  assert.equal(plain(255n, 2), '11111111');
  assert.equal(plain(255n, 8), '377');
  assert.equal(plain(255n, 36), '73');
  assert.equal(shown(255n, 2), '1111 1111');
  assert.equal(shown(255n, 16), 'FF');
  assert.equal(shown(256n, 16), '01 00', 'hex in whole bytes');
  assert.equal(shown(5n, 2), '0101', 'binary in whole nibbles');
  assert.equal(shown(1234567n, 10), n('1 234 567'));
  assert.equal(shown(-255n, 16), '−FF');
  assert.equal(plain(-255n, 16), '-FF', 'Copy takes a plain minus');
});

test('0x, 0b and 0o win over the base picked; the base reads the rest', () => {
  for (const base of [2, 10, 16, 36]) {
    assert.equal(value('0xFF', base), 255n);
    assert.equal(value('0b1111_1111', base), 255n);
    assert.equal(value('0o377', base), 255n);
  }
  const p = parse('0xff', 10);
  assert.equal(p.prefix, '0x');
  assert.equal(p.base, 16);
  assert.equal(value('-0x80'), -128n);
  assert.equal(value('− 42'), -42n, 'a real minus, a space after it');
  assert.equal(value('+7'), 7n);
  assert.equal(value('ff', 16), 255n);
  assert.equal(value('FF', 16), 255n);
  assert.equal(value('zz', 36), 1295n);
  assert.equal(value('101', 2), 5n);
  assert.equal(value('66', 7), 48n);
  assert.equal(parse('42', 10).prefix, null);
});

test('spaces, _ and apostrophes group digits', () => {
  assert.equal(value('1 000 000'), 1_000_000n);
  assert.equal(value('1_000_000'), 1_000_000n);
  assert.equal(value("1'000"), 1000n);
  assert.equal(value('0b 1111 0000'), 240n);
  assert.equal(value('  0x DE AD BE EF  '), 0xdeadbeefn);
  assert.equal(value('1\u202f000\u00a0000'), 1_000_000n, 'narrow and no-break spaces too');
});

test('mistakes are named, with their place', () => {
  assert.equal(parse('', 10), null);
  assert.equal(parse('   ', 10), null);
  assert.deepEqual(parse('ff', 10), { ok: false, code: 'digit', char: 'f', position: 1, base: 10 });
  assert.deepEqual(parse('0b102', 10), { ok: false, code: 'digit', char: '2', position: 5, base: 2 });
  assert.deepEqual(parse('12.5', 10), { ok: false, code: 'fraction', char: '.' });
  assert.deepEqual(parse('1,5', 10), { ok: false, code: 'fraction', char: ',' });
  assert.deepEqual(parse('0x', 10), { ok: false, code: 'noDigits', prefix: '0x' });
  assert.deepEqual(parse('-', 10), { ok: false, code: 'noDigits', prefix: '' });
  assert.deepEqual(parse('12', 37), { ok: false, code: 'base' });
  assert.deepEqual(parse('12', 1), { ok: false, code: 'base' });
  assert.deepEqual(parse('1'.repeat(MAX_DIGITS + 1), 10), { ok: false, code: 'tooLong' });
  assert.equal(parse('😀', 10).char, '😀', 'a whole emoji, not half of one');
});

test('2^64 and beyond stay exact', () => {
  const big = 2n ** 64n;
  assert.equal(value('18446744073709551616'), big);
  assert.equal(value('0x1_0000_0000_0000_0000'), big);
  assert.equal(shown(big, 16), '01 00 00 00 00 00 00 00 00');
  assert.equal(shown(big, 10), n('18 446 744 073 709 551 616'));
  assert.equal(value(shown(big, 10)), big, 'what’s shown reads back');
  assert.equal(bitLength(big), 65);
  assert.equal(bitLength(big - 1n), 64);
  const huge = 3n ** 500n;
  for (const base of [2, 3, 7, 8, 10, 16, 23, 36]) assert.equal(value(plain(huge, base), base), huge, `base ${base}`);
  assert.equal(value(plain(-huge, 36), 36), -huge);
});

test('two’s complement: −1 at 8 bits is 0xFF, and every width', () => {
  assert.deepEqual(twos(-1n, 8), { width: 8, fits: true, hex: 'FF', binary: '1111 1111', signed: -1n, unsigned: 255n });
  assert.equal(twos(-1n, 64).hex, 'FF FF FF FF FF FF FF FF');
  assert.equal(twos(-1n, 64).unsigned, 2n ** 64n - 1n);
  assert.equal(twos(-5n, 8).binary, '1111 1011');
  assert.equal(twos(-128n, 8).hex, '80');
  assert.deepEqual(twos(-129n, 8), { width: 8, fits: false, min: -128n, max: 127n, negative: true });
  assert.equal(twos(-129n, 16).hex, 'FF 7F');
  assert.equal(twos(-(2n ** 31n), 32).hex, '80 00 00 00');
  assert.equal(twos(-(2n ** 63n) - 1n, 64).fits, false);
});

test('a value given in hex or binary, read as signed at each width', () => {
  assert.equal(twos(value('0x80'), 8).signed, -128n);
  assert.equal(twos(value('0x7F'), 8).signed, 127n);
  assert.equal(twos(value('0xFFFF'), 16).signed, -1n);
  assert.equal(twos(value('0xFFFF'), 32).signed, 65535n, 'at a wider width it stays positive');
  assert.deepEqual(twos(256n, 8), { width: 8, fits: false, min: 0n, max: 255n, negative: false });
  assert.equal(twos(2n ** 64n - 1n, 64).signed, -1n);
  assert.equal(twos(2n ** 64n, 64).fits, false);
  assert.equal(twos(0n, 16).hex, '00 00');
});

test('bits and bytes, both ways round', () => {
  assert.equal(bitLength(0n), 0);
  assert.equal(bitLength(255n), 8);
  assert.equal(bitLength(256n), 9);
  assert.equal(bitLength(-1n), 1);
  assert.equal(bitLength(-128n), 8);
  assert.equal(bitLength(-129n), 9);
  assert.deepEqual(bytes(0n), [0]);
  assert.deepEqual(bytes(256n), [1, 0]);
  assert.deepEqual(bytes(0xdeadbeefn), [0xde, 0xad, 0xbe, 0xef]);
  assert.deepEqual(bytes(-1n), [0xff]);
  assert.deepEqual(bytes(-128n), [0x80]);
  assert.deepEqual(bytes(-129n), [0xff, 0x7f]);
  assert.equal(hexBytes(bytes(0xdeadbeefn)), 'DE AD BE EF');
  assert.equal(hexBytes(bytes(0xdeadbeefn).reverse()), 'EF BE AD DE');
});

test('groups from the right', () => {
  assert.equal(group('101', 4, true), '0101');
  assert.equal(group('11111', 4, true), '0001 1111');
  assert.equal(group('1234567', 3), '1 234 567');
  assert.equal(group('123', 3), '123');
  assert.equal(group('ABC', 2, true), '0A BC');
});
