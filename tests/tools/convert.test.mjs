import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetFor, keepsBytes, convertedName, uniqueNames, sizeChange, kindLabel, svgWant, MAX_WIDTH } from '../../src/tools/convert/convert.ts';

test('"same" keeps PNG and WebP, turns HEIC, AVIF, GIF and JPG into JPG', () => {
  assert.equal(targetFor('png', 'same', true), 'image/png');
  assert.equal(targetFor('webp', 'same', true), 'image/webp');
  for (const kind of ['heic', 'avif', 'gif', 'jpeg']) assert.equal(targetFor(kind, 'same', true), 'image/jpeg', kind);
});

test('a chosen format wins over the photo’s own', () => {
  assert.equal(targetFor('heic', 'png', true), 'image/png');
  assert.equal(targetFor('png', 'jpg', true), 'image/jpeg');
  assert.equal(targetFor('jpeg', 'webp', true), 'image/webp');
});

test('without WebP (Safari) WebP becomes JPG, even for a WebP kept the "same"', () => {
  assert.equal(targetFor('jpeg', 'webp', false), 'image/jpeg');
  assert.equal(targetFor('webp', 'same', false), 'image/jpeg');
  assert.equal(targetFor('png', 'same', false), 'image/png');
});

test('bytes stay only when the photo already is the target', () => {
  assert.equal(keepsBytes('jpeg', 'image/jpeg'), true);
  assert.equal(keepsBytes('png', 'image/png'), true);
  assert.equal(keepsBytes('webp', 'image/webp'), true);
  assert.equal(keepsBytes('png', 'image/jpeg'), false);
  assert.equal(keepsBytes('heic', 'image/jpeg'), false);
  // A GIF "as JPG" is drawn, never passed through.
  assert.equal(keepsBytes('gif', 'image/gif'), false);
});

test('the new extension says what was done; a kept type gets the suffix', () => {
  assert.equal(convertedName('IMG_4127.HEIC', 'jpg', 'suffix'), 'IMG_4127.jpg');
  assert.equal(convertedName('scan.png', 'webp', 'suffix'), 'scan.webp');
  assert.equal(convertedName('photo.jpeg', 'jpg', 'suffix'), 'photo-converted.jpg', 'jpeg and jpg are one type');
  assert.equal(convertedName('photo.JPG', 'jpg', 'same'), 'photo.jpg');
  assert.equal(convertedName('Holiday 2026.heif', 'jpg', 'suffix'), 'Holiday 2026.jpg');
  assert.equal(convertedName('noext', 'png', 'suffix'), 'noext.png');
});

test('repeated names are numbered, ignoring case', () => {
  assert.deepEqual(uniqueNames(['photo.jpg', 'photo.jpg', 'other.jpg', 'PHOTO.jpg']), ['photo.jpg', 'photo-2.jpg', 'other.jpg', 'PHOTO-3.jpg']);
  assert.deepEqual(uniqueNames(['a.png', 'a-2.png', 'a.png']), ['a.png', 'a-2.png', 'a-3.png']);
});

test('size change in percent, signed', () => {
  assert.equal(sizeChange(1000, 320), -68);
  assert.equal(sizeChange(1000, 1500), 50);
  assert.equal(sizeChange(1000, 1000), 0);
  assert.equal(sizeChange(0, 10), 0);
});

test('kinds as people say them', () => {
  assert.equal(kindLabel('jpeg'), 'JPG');
  assert.equal(kindLabel('webp'), 'WebP');
  assert.equal(kindLabel('heic'), 'HEIC');
});

test('an SVG becomes a PNG under "same", else what was chosen; never kept as it is', () => {
  assert.equal(targetFor('svg', 'same', true), 'image/png');
  assert.equal(targetFor('svg', 'jpg', true), 'image/jpeg');
  assert.equal(targetFor('svg', 'webp', true), 'image/webp');
  assert.equal(targetFor('svg', 'webp', false), 'image/jpeg');
  assert.equal(keepsBytes('svg', 'image/png'), false);
  assert.equal(kindLabel('svg'), 'SVG');
  assert.equal(convertedName('logo.svg', 'png', 'suffix'), 'logo.png');
});

test('the Size row: a scale, or a whole width within the limit', () => {
  assert.deepEqual(svgWant('1', NaN), { scale: 1 });
  assert.deepEqual(svgWant('4', 12), { scale: 4 });
  assert.deepEqual(svgWant('width', 1000), { width: 1000 });
  assert.deepEqual(svgWant('width', MAX_WIDTH), { width: MAX_WIDTH });
  for (const bad of [NaN, 0, -5, 12.5, MAX_WIDTH + 1]) assert.equal(svgWant('width', bad), null, String(bad));
});
