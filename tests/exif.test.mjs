import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMeta, strip, carryExif, crc32 } from '../src/lib/exif.ts';
import { exifBlock, withExif } from './fixtures/exif-block.mjs';

// A JPEG's skeleton: start, JFIF, start of scan, a few bytes of "picture", end.
const JPEG = new Uint8Array([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x12, 0x34, 0x56, 0x78,
  0xff, 0xd9,
]);
const picture = (b) => b.subarray(b.length - 16);

const chunk = (type, data) => {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) out.set(p, (i += p.length) - p.length);
  return out;
};
const png = (...chunks) => concat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', new Uint8Array(13)), ...chunks, chunk('IEND', new Uint8Array()));

test('reads place, camera and time from a JPEG', () => {
  const meta = readMeta(new Uint8Array(withExif(JPEG, exifBlock())));
  assert.equal(meta.make, 'Apple');
  assert.equal(meta.model, 'iPhone 15');
  assert.equal(meta.taken, '2026:10:31 14:05:09');
  assert.ok(Math.abs(meta.gps.lat - 53.55033) < 1e-4);
  assert.ok(Math.abs(meta.gps.lon - 9.99206) < 1e-4);
});

test('a photo without EXIF says nothing', () => {
  assert.deepEqual(readMeta(JPEG), {});
});

test('“location” takes the place and keeps the camera; the picture stays bit for bit', () => {
  const tagged = new Uint8Array(withExif(JPEG, exifBlock()));
  const out = strip(tagged, 'location');
  const meta = readMeta(out);
  assert.equal(meta.gps, undefined);
  assert.equal(meta.model, 'iPhone 15');
  assert.deepEqual(picture(out), picture(JPEG));
});

test('“everything” takes it all', () => {
  const out = strip(new Uint8Array(withExif(JPEG, exifBlock())), 'everything');
  assert.deepEqual(readMeta(out), {});
  assert.deepEqual(out, JPEG);
});

test('a PNG’s eXIf goes the same way, with valid chunks left', () => {
  const tagged = png(chunk('eXIf', exifBlock()), chunk('tEXt', new TextEncoder().encode('Comment\0hi')));
  assert.equal(readMeta(tagged).model, 'iPhone 15');
  const located = strip(tagged, 'location');
  assert.equal(readMeta(located).gps, undefined);
  assert.equal(readMeta(located).model, 'iPhone 15');
  const bare = strip(tagged, 'everything');
  assert.deepEqual(bare, png());
});

test('a re-encoded JPEG gets the original’s EXIF back, upright, with or without the place', () => {
  const original = new Uint8Array(withExif(JPEG, exifBlock()));
  const kept = carryExif(original, JPEG, false);
  assert.equal(readMeta(kept).model, 'iPhone 15');
  assert.ok(readMeta(kept).gps);
  assert.equal(readMeta(carryExif(original, JPEG, true)).gps, undefined);
  assert.deepEqual(carryExif(JPEG, JPEG, false), JPEG, 'nothing to carry');
});

test('HEIC can’t be changed in place', () => {
  const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0]);
  assert.equal(strip(heic, 'everything'), null);
});
