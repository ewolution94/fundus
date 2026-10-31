import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shrinkTo, MIN_QUALITY, MAX_QUALITY } from '../../src/tools/shrink/shrink.ts';

// An encoder's bytes grow with the area and, steeply, with quality: a model of a JPEG.
const model = (full) => {
  const calls = [];
  const encode = async (scale, quality) => {
    calls.push([scale, quality]);
    return Math.round(full * scale * scale * (0.25 + 0.75 * quality ** 3));
  };
  return { encode, calls };
};

test('at full size when the best quality fits', async () => {
  const { encode, calls } = model(1_000_000);
  const r = await shrinkTo(encode, 2_000_000);
  assert.deepEqual([r.scale, r.quality], [1, MAX_QUALITY]);
  assert.equal(calls.length, 1);
});

test('quality goes first, pixels stay', async () => {
  const { encode } = model(3_000_000);
  const r = await shrinkTo(encode, 2_000_000);
  assert.equal(r.scale, 1);
  assert.ok(r.quality > MIN_QUALITY && r.quality < MAX_QUALITY);
  assert.ok(r.bytes <= 2_000_000 && r.bytes > 1_900_000, String(r.bytes));
});

test('then pixels, landing close under the target', async () => {
  const { encode } = model(12_000_000);
  const r = await shrinkTo(encode, 500_000);
  assert.ok(r.scale < 1);
  assert.ok(r.bytes <= 500_000, String(r.bytes));
  assert.ok(r.bytes > 400_000, `too eager: ${r.bytes}`);
});

test('an impossible target stops at the smallest, over it, without looping', async () => {
  const { encode, calls } = model(1_000_000_000);
  const r = await shrinkTo(encode, 1_000);
  assert.ok(r.bytes > 1_000);
  assert.ok(r.scale <= 0.06);
  assert.ok(calls.length < 100, `${calls.length} encodes`);
});
