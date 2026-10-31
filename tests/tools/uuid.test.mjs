// F-905 UUIDs: v4 and v7 laid out to RFC 9562, v7 always going up, styles, parsing what's pasted,
// and the RFC's own example UUIDs read back (version, variant, the time inside).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { v4, v7Maker, V7_MAX_MS, canonical, format, parse, toBytes, inspect, isoTime, variantOf, clampCount } from '../../src/tools/uuid/uuid.ts';

const SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('v4: version 4, the RFC variant, the rest random', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const s = canonical(v4());
    assert.match(s, SHAPE);
    assert.equal(s[14], '4');
    assert.match(s[19], /[89ab]/);
    seen.add(s);
  }
  assert.equal(seen.size, 2000);
  // Without randomUUID: getRandomValues-like bytes, version and variant set over them.
  const b = v4((n) => new Uint8Array(n).fill(0xff));
  assert.equal(canonical(b), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  const z = v4((n) => new Uint8Array(n));
  assert.equal(canonical(z), '00000000-0000-4000-8000-000000000000');
});

test('v7: 48 bits of Unix ms, version 7, a counter, the variant', () => {
  const ms = 0x017f22e279b0; // the RFC's 2022-02-22T19:22:22Z
  const make = v7Maker(() => ms, (n) => new Uint8Array(n).fill(0xff));
  const b = make();
  const s = canonical(b);
  assert.equal(s.slice(0, 13), '017f22e2-79b0');
  assert.equal(s[14], '7');
  assert.match(s[19], /[89ab]/);
  // The counter starts below 2048 (0x7ff here), so it has room to count.
  assert.equal(s.slice(15, 18), '7ff');
  assert.equal(canonical(make()).slice(15, 18), '800');
  const info = inspect(b);
  assert.equal(info.version, 7);
  assert.equal(info.variant, 'rfc');
  assert.equal(info.time.ms, ms);
  assert.equal(isoTime(info.time), '2022-02-22T19:22:22.000Z');
});

test('v7: always up, in one millisecond, when the counter runs out, when the clock steps back', () => {
  let now = 1761942000000;
  const clock = () => now;
  const make = v7Maker(clock);
  const list = [];
  for (let i = 0; i < 10000; i++) {
    if (i === 5000) now -= 3000; // the clock steps back
    if (i % 997 === 0) now += 1;
    list.push(canonical(make()));
  }
  for (let i = 1; i < list.length; i++) assert.ok(list[i] > list[i - 1], `${i}: ${list[i - 1]} then ${list[i]}`);
  // The clock reached +6 ms, then stood behind; the last 5015 can't fit in one millisecond's
  // counter (at most 4096), and fit in three (at least 2049 each): the time moved on once or twice.
  const times = list.map((s) => inspect(toBytes(s)).time.ms);
  assert.ok(times.at(-1) >= 1761942000007 && times.at(-1) <= 1761942000008, String(times.at(-1)));
  assert.equal(new Set(list).size, list.length);
  // Never before what the clock said at first.
  assert.ok(times[0] >= 1761942000000);
});

test('v7: the counter carries into the time at 0xfff', () => {
  const make = v7Maker(() => 1000, () => new Uint8Array(16).fill(0xff));
  let last;
  for (let i = 0; i <= 0xfff - 0x7ff; i++) last = make();
  assert.equal(inspect(last).time.ms, 1000);
  assert.equal(canonical(last).slice(15, 18), 'fff');
  const next = make();
  assert.equal(inspect(next).time.ms, 1001);
  assert.equal(canonical(next).slice(15, 18), '7ff');
});

test('v7: the clock at the ends of its range', () => {
  assert.equal(canonical(v7Maker(() => -5)()).slice(0, 13), '00000000-0000');
  assert.equal(canonical(v7Maker(() => 2 ** 50)()).slice(0, 13), 'ffffffff-ffff');
  assert.equal(inspect(v7Maker(() => V7_MAX_MS)()).time.ms, V7_MAX_MS);
});

test('styles: case, hyphens, braces', () => {
  const b = toBytes('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
  assert.equal(format(b, { upper: false, hyphens: true, braces: false }), '017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
  assert.equal(format(b, { upper: true, hyphens: true, braces: false }), '017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
  assert.equal(format(b, { upper: false, hyphens: false, braces: false }), '017f22e279b07cc398c4dc0c0c07398f');
  assert.equal(format(b, { upper: true, hyphens: false, braces: true }), '{017F22E279B07CC398C4DC0C0C07398F}');
  assert.equal(format(b, { upper: false, hyphens: true, braces: true }), '{017f22e2-79b0-7cc3-98c4-dc0c0c07398f}');
});

test('parse: what people paste', () => {
  const want = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
  for (const s of [
    want,
    want.toUpperCase(),
    ` ${want}\n`,
    `{${want}}`,
    `{${want.toUpperCase()}}`,
    want.replaceAll('-', ''),
    `urn:uuid:${want}`,
    `URN:UUID:${want.toUpperCase()}`,
    `urn:uuid:{${want}}`,
  ]) {
    const p = parse(s);
    assert.ok(p.ok, s);
    assert.equal(canonical(p.bytes), want, s);
  }
  assert.equal(parse(''), null);
  assert.equal(parse('  \n'), null);
});

test('parse: what isn’t a UUID, and where', () => {
  assert.deepEqual(parse('017f22e2-79b0-7cc3-98c4-dc0c0c07398g'), { ok: false, code: 'char', char: 'g', position: 36 });
  assert.deepEqual(parse('{017f22e2-79b0-7cc3-98c4-dc0c0c07398z}'), { ok: false, code: 'char', char: 'z', position: 37 });
  assert.deepEqual(parse('urn:uuid:x17f22e2-79b0-7cc3-98c4-dc0c0c07398f'), { ok: false, code: 'char', char: 'x', position: 10 });
  // Code points, not UTF-16 units: the emoji counts once.
  assert.deepEqual(parse('017f👋22e2'), { ok: false, code: 'char', char: '👋', position: 5 });
  assert.deepEqual(parse('017f22e2 79b0'), { ok: false, code: 'char', char: ' ', position: 9 });
  assert.deepEqual(parse('017f22e2-79b0-7cc3-98c4-dc0c0c07398'), { ok: false, code: 'length', digits: 31 });
  assert.deepEqual(parse('017f22e2-79b0-7cc3-98c4-dc0c0c07398f0'), { ok: false, code: 'length', digits: 33 });
  assert.deepEqual(parse('017f22e279b0-7cc3-98c4-dc0c0c07398f'), { ok: false, code: 'hyphens' });
  assert.deepEqual(parse('017f22e2-79b0-7cc3-98c4-dc0c-0c07398f'), { ok: false, code: 'hyphens' });
  assert.deepEqual(parse('{017f22e2-79b0-7cc3-98c4-dc0c0c07398f'), { ok: false, code: 'braces' });
  assert.deepEqual(parse('}'), { ok: false, code: 'braces' });
});

test('inspect: RFC 9562’s example UUIDs (appendix A)', () => {
  const at = (s) => inspect(parse(s).bytes);
  // v1 and v6 hold the same moment, 2022-02-22 14:22:22 −05:00, in 100 ns steps.
  const one = at('C232AB00-9414-11EC-B3C8-9F6BDECED846');
  assert.equal(one.version, 1);
  assert.equal(one.variant, 'rfc');
  assert.equal(isoTime(one.time), '2022-02-22T19:22:22.0000000Z');
  assert.equal(one.clockSeq, 0x33c8);
  assert.equal(one.node, '9f:6b:de:ce:d8:46');
  assert.equal(one.randomNode, true);
  const six = at('1EC9414C-232A-6B00-B3C8-9F6BDECED846');
  assert.equal(six.version, 6);
  assert.deepEqual(six.time, one.time);
  assert.equal(six.clockSeq, 0x33c8);
  const seven = at('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
  assert.equal(seven.version, 7);
  assert.equal(isoTime(seven.time), '2022-02-22T19:22:22.000Z');
  assert.equal(seven.clockSeq, null);
  for (const [s, v] of [
    ['5df41881-3aed-3515-88a7-2f4a814cf09e', 3],
    ['919108f7-52d1-4320-9bac-f847db4148a8', 4],
    ['2ed6657d-e927-568b-95e1-2665a8aea6a2', 5],
    ['2489E9AD-2EE2-8E00-8EC9-32D5F69181C0', 8],
  ]) {
    const info = at(s);
    assert.equal(info.version, v, s);
    assert.equal(info.variant, 'rfc');
    assert.equal(info.time, null);
  }
});

test('inspect: a v1 time to the 100 ns, before 1970 too; nil, max and the other variants', () => {
  // 1 tick after the Gregorian start, 1582-10-15T00:00:00.0000001Z.
  const start = inspect(toBytes('00000001-0000-1000-8000-000000000000'));
  assert.equal(isoTime(start.time), '1582-10-15T00:00:00.0000001Z');
  // A time with sub-millisecond steps: 2022-02-22T19:22:22.1234567Z.
  const ticks = 138648505421234567n;
  const low = (ticks & 0xffffffffn).toString(16).padStart(8, '0');
  const mid = ((ticks >> 32n) & 0xffffn).toString(16).padStart(4, '0');
  const high = ((ticks >> 48n) & 0x0fffn).toString(16).padStart(3, '0');
  assert.equal(isoTime(inspect(toBytes(`${low}-${mid}-1${high}-8000-000000000000`)).time), '2022-02-22T19:22:22.1234567Z');
  const nil = inspect(new Uint8Array(16));
  assert.equal(nil.special, 'nil');
  assert.equal(nil.version, null);
  assert.equal(inspect(new Uint8Array(16).fill(0xff)).special, 'max');
  assert.equal(variantOf(toBytes('00000000-0000-0000-7000-000000000000')), 'ncs');
  assert.equal(variantOf(toBytes('00000000-0000-0000-c000-000000000000')), 'microsoft');
  assert.equal(variantOf(toBytes('00000000-0000-0000-e000-000000000000')), 'future');
  // A Microsoft GUID has no RFC version to read.
  assert.equal(inspect(toBytes('00000000-0000-4000-c000-000000000001')).version, null);
});

test('how many: 1–100', () => {
  assert.equal(clampCount(''), null);
  assert.deepEqual(clampCount('5'), { n: 5, clamped: false });
  assert.deepEqual(clampCount(' 100 '), { n: 100, clamped: false });
  assert.deepEqual(clampCount('0'), { n: 1, clamped: true });
  assert.deepEqual(clampCount('250'), { n: 100, clamped: true });
  assert.deepEqual(clampCount('2.5'), { n: 1, clamped: true });
});
