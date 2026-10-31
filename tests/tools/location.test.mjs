import { test } from 'node:test';
import assert from 'node:assert/strict';
import { degrees, camera, parseTaken, present, compare, cleanName, TAKES, inPlace, redrawn } from '../../src/tools/location/location.ts';

test('a place in plain degrees, both hemispheres, the setting’s decimal mark', () => {
  assert.equal(degrees(53.55033333, 9.99205556, 'point'), '53.55033° N, 9.99206° E');
  assert.equal(degrees(-33.8568, 151.2153, 'point'), '33.85680° S, 151.21530° E');
  assert.equal(degrees(40.6892, -74.0445, 'comma'), '40,68920° N, 74,04450° W');
});

test('the camera without its maker twice', () => {
  assert.equal(camera('Apple', 'iPhone 15'), 'Apple iPhone 15');
  assert.equal(camera('Canon', 'Canon EOS R6'), 'Canon EOS R6');
  assert.equal(camera('NIKON CORPORATION', 'NIKON Z 6'), 'NIKON Z 6');
  assert.equal(camera('Google', 'Pixel 9'), 'Google Pixel 9');
  assert.equal(camera(undefined, 'Pixel 9'), 'Pixel 9');
  assert.equal(camera('Sony', ''), 'Sony');
  assert.equal(camera('', ' '), undefined);
});

test('the camera’s time, as written, without a zone', () => {
  assert.equal(parseTaken('2026:10:31 14:05:09')?.toISOString(), '2026-10-31T14:05:09.000Z');
  assert.equal(parseTaken('2026-10-31T14:05')?.toISOString(), '2026-10-31T14:05:00.000Z');
  assert.equal(parseTaken('0000:00:00 00:00:00'), null, 'cameras write zeros for "unknown"');
  assert.equal(parseTaken('yesterday'), null);
  assert.equal(parseTaken(undefined), null);
});

const iphone = { make: 'Apple', model: 'iPhone 15', taken: '2026:10:31 14:05:09', gps: { lat: 53.55, lon: 9.99 }, orientation: 1, width: 3840 };

test('the facts a photo holds; orientation and size don’t count', () => {
  assert.deepEqual(present(iphone), ['place', 'camera', 'taken']);
  assert.deepEqual(present({ orientation: 6, width: 10, height: 10 }), []);
  assert.deepEqual(present({ lens: 'iPhone 15 back camera 6.86mm f/1.78', software: '18.1' }), ['lens', 'software']);
});

test('before and after: what went, what stayed', () => {
  const locationOnly = { make: 'Apple', model: 'iPhone 15', taken: '2026:10:31 14:05:09', orientation: 1 };
  assert.deepEqual(compare(iphone, locationOnly), { gone: ['place'], left: ['camera', 'taken'] });
  assert.deepEqual(compare(iphone, { orientation: 1 }), { gone: ['place', 'camera', 'taken'], left: [] });
  assert.deepEqual(compare({}, {}), { gone: [], left: [] });
  assert.deepEqual(TAKES.location, ['place']);
});

test('names keep the extension; a HEIC becomes .jpg', () => {
  assert.equal(cleanName('IMG_4127.JPG', 'jpeg', 'location', 'suffix'), 'IMG_4127-no-location.jpg');
  assert.equal(cleanName('IMG_4127.jpeg', 'jpeg', 'everything', 'suffix'), 'IMG_4127-clean.jpeg');
  assert.equal(cleanName('IMG_4127.HEIC', 'heic', 'everything', 'suffix'), 'IMG_4127-clean.jpg');
  assert.equal(cleanName('shot.png', 'png', 'location', 'same'), 'shot.png');
  assert.equal(cleanName('noext', 'webp', 'location', 'same'), 'noext.webp');
});

test('which formats change in place and which are drawn', () => {
  for (const k of ['jpeg', 'png', 'webp']) assert.ok(inPlace(k) && !redrawn(k), k);
  for (const k of ['heic', 'avif']) assert.ok(!inPlace(k) && redrawn(k), k);
  assert.ok(!inPlace('gif') && !redrawn('gif'));
});
