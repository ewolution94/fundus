import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniff, dimensions, formatBytes, outName, stem } from '../src/lib/files.ts';

const bytes = (...xs) => new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));

test('knows a file by its first bytes, not its name', () => {
  assert.equal(sniff(bytes(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
  assert.equal(sniff(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
  assert.equal(sniff(bytes('RIFF', 0, 0, 0, 0, 'WEBP')), 'webp');
  assert.equal(sniff(bytes(0, 0, 0, 0x18, 'ftypheic')), 'heic');
  assert.equal(sniff(bytes(0, 0, 0, 0x18, 'ftypavif')), 'avif');
  assert.equal(sniff(bytes('%PDF-1.7')), 'pdf');
  assert.equal(sniff(bytes('GIF89a')), 'gif');
  assert.equal(sniff(bytes('hello')), 'other');
});

test('reads a PNG’s size from its header', () => {
  const png = new Uint8Array(33);
  png.set(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 'IHDR'));
  new DataView(png.buffer).setUint32(16, 640);
  new DataView(png.buffer).setUint32(20, 480);
  assert.deepEqual(dimensions(png), { width: 640, height: 480 });
});

test('sizes read like an upload form’s (decimal)', () => {
  assert.equal(formatBytes(1_873_830, 'point'), '1.9 MB');
  assert.equal(formatBytes(1_873_830, 'comma'), '1,9 MB');
  assert.equal(formatBytes(512_000, 'point'), '512 KB');
  assert.equal(formatBytes(900, 'point'), '900 bytes');
});

test('names a result after its original', () => {
  assert.equal(outName('IMG_4127.HEIC', 'small', 'jpg', 'suffix'), 'IMG_4127-small.jpg');
  assert.equal(outName('IMG_4127.HEIC', 'small', 'jpg', 'same'), 'IMG_4127.jpg');
  assert.equal(outName('scan.final.pdf', 'signed', 'pdf', 'suffix'), 'scan.final-signed.pdf');
  assert.equal(stem('no-extension'), 'no-extension');
});
