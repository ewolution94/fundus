// F-104 Remove location: what a photo gives away, then "Location only" or "Everything" for a JPG,
// a PNG and a WebP (changed in place: the picture data must come out byte for byte the same) and a
// HEIC (drawn into a JPG), each result read back.
//
// The PNG and WebP with a place in them are made here once, from the samples, with the same EXIF
// the sample JPG carries (tests/fixtures/out/location-gps.png, location-gps.webp).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { readMeta, crc32, jpegSegments } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';
import { exifBlock } from '../fixtures/exif-block.mjs';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/out');

/** photo.png with its eXIf swapped for one that has a camera, a time and a place. */
async function gpsPng() {
  const b = new Uint8Array(await readFile(path.join(out, 'photo.png')));
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tiff = exifBlock({ model: 'iPhone 15' });
  const chunk = new Uint8Array(12 + tiff.length);
  const cv = new DataView(chunk.buffer);
  cv.setUint32(0, tiff.length);
  chunk.set([0x65, 0x58, 0x49, 0x66], 4); // eXIf
  chunk.set(tiff, 8);
  cv.setUint32(8 + tiff.length, crc32(chunk.subarray(4, 8 + tiff.length)));
  const parts = [b.subarray(0, 8)];
  for (let i = 8; i < b.length; ) {
    const length = view.getUint32(i);
    const type = String.fromCharCode(...b.subarray(i + 4, i + 8));
    if (type !== 'eXIf') parts.push(b.subarray(i, i + 12 + length));
    if (type === 'IHDR') parts.push(chunk);
    i += 12 + length;
  }
  return Buffer.concat(parts);
}

/** photo.webp (already VP8X) with an EXIF chunk and its flag. */
async function gpsWebp() {
  const b = Buffer.from(await readFile(path.join(out, 'photo.webp')));
  const tiff = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(exifBlock({ model: 'iPhone 15' }))]);
  const head = Buffer.alloc(8);
  head.write('EXIF', 0, 'latin1');
  head.writeUInt32LE(tiff.length, 4);
  const chunk = Buffer.concat([head, tiff, Buffer.alloc(tiff.length & 1)]);
  const body = Buffer.concat([b.subarray(12), chunk]);
  body[8] |= 0x08; // VP8X flags: EXIF
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write('WEBP', 8, 'latin1');
  return Buffer.concat([riff, body]);
}

await writeFile(path.join(out, 'location-gps.png'), await gpsPng());
await writeFile(path.join(out, 'location-gps.webp'), await gpsWebp());

/** A JPEG's picture data: everything from its start of scan on. */
const scan = (b) => {
  const sos = jpegSegments(b).find((s) => s.marker === 0xda);
  return Buffer.from(b.subarray(sos.start));
};

/** A PNG's IDAT chunks, together. */
const idat = (b) => {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts = [];
  for (let i = 8; i < b.length; ) {
    const length = view.getUint32(i);
    if (String.fromCharCode(...b.subarray(i + 4, i + 8)) === 'IDAT') parts.push(b.subarray(i, i + 12 + length));
    i += 12 + length;
  }
  return Buffer.concat(parts);
};

/** A WebP's picture chunk (VP8 or VP8L). */
const vp8 = (b) => {
  for (let i = 12; i + 8 <= b.length; ) {
    const type = String.fromCharCode(...b.subarray(i, i + 4));
    const length = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
    if (type === 'VP8 ' || type === 'VP8L') return Buffer.from(b.subarray(i, i + 8 + length));
    i += 8 + length + (length & 1);
  }
  return null;
};

export default {
  async 'shows what the JPG gives away: the place in degrees, the camera, the time'({ open, drop, sees, page, assert, shot }) {
    await open('/remove-location');
    await drop('photo.jpg');
    await sees('53.55033° N, 9.99206° E');
    await sees('Apple iPhone 15');
    await sees(/Oct 31, 2026(,| at) 2:05 PM/);
    // Plain text: no link to a map anywhere.
    assert.equal(await page.locator('main a[href*="map"]').count(), 0);
    await sees('No place left');
    await shot('jpg-1280', 1280);
    await shot('jpg-390', 390);
  },

  async 'Location only: the place goes, camera and time stay, the picture bit for bit'({ open, drop, choose, save, assert, bytes, sees }) {
    await open('/remove-location');
    await drop('photo.jpg');
    await choose('Remove', 'Location only');
    const file = await save();
    assert.equal(file.name, 'photo-no-location.jpg');
    const meta = readMeta(file.bytes);
    assert.equal(meta.gps, undefined);
    assert.equal(meta.model, 'iPhone 15');
    assert.equal(meta.taken, '2026:10:31 14:05:09');
    assert.ok(scan(file.bytes).equals(scan(await bytes('photo.jpg'))), 'the picture data changed');
    await sees('Still in it: camera, time.');
  },

  async 'Everything: nothing left, and it says so'({ open, drop, choose, save, assert, bytes, sees, shot }) {
    await open('/remove-location');
    await drop('photo.jpg');
    await choose('Remove', 'Everything');
    const file = await save();
    assert.equal(file.name, 'photo-clean.jpg');
    const meta = readMeta(file.bytes);
    assert.deepEqual([meta.gps, meta.model, meta.make, meta.taken], [undefined, undefined, undefined, undefined]);
    assert.ok(scan(file.bytes).equals(scan(await bytes('photo.jpg'))));
    await sees('Nothing left');
    await shot('everything-1280', 1280);
  },

  async 'remembers the choice'({ open, choose, page, assert }) {
    await open('/remove-location');
    await choose('Remove', 'Everything');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Everything' }).getAttribute('aria-checked'), 'true');
  },

  async 'a PNG and a WebP are changed in place'({ open, drop, choose, save, assert, bytes, sees }) {
    await open('/remove-location');
    await choose('Remove', 'Everything');
    await drop(['location-gps.png', 'location-gps.webp']);
    await sees('53.55033° N', 5000);
    const [png, webp] = await save({ count: 2 }).then((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    assert.equal(png.name, 'location-gps-clean.png');
    assert.equal(sniff(png.bytes), 'png');
    assert.deepEqual(readMeta(png.bytes), {});
    assert.ok(idat(png.bytes).equals(idat(await bytes('location-gps.png'))));
    assert.equal(webp.name, 'location-gps-clean.webp');
    assert.equal(sniff(webp.bytes), 'webp');
    assert.deepEqual(readMeta(webp.bytes), {});
    assert.ok(vp8(webp.bytes).equals(vp8(await bytes('location-gps.webp'))));
    assert.deepEqual(dimensions(webp.bytes), { width: 900, height: 506 });
    await sees('In all 2 photos.');
  },

  async 'a HEIC is drawn into a JPG, and it says so'({ open, drop, save, assert, sees }) {
    await open('/remove-location');
    await drop('small.heic');
    await sees('Nothing it gives away');
    await sees('saved as a JPG');
    const file = await save({ timeout: 60_000 });
    assert.equal(file.name, 'small-no-location.jpg');
    assert.equal(sniff(file.bytes), 'jpeg');
    assert.equal(readMeta(file.bytes).gps, undefined);
    assert.equal(dimensions(file.bytes).width, 1200);
    await sees('There was nothing to begin with');
  },

  async 'several at once, as a ZIP from the Many files count'({ open, drop, save, assert, page }) {
    await open('/remove-location');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ zipFrom: 3, names: 'same' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop(['photo.jpg', 'mid-gps.jpg', 'location-gps.png']);
    const file = await save();
    assert.equal(file.name, 'photos-clean.zip');
    const files = unzipSync(file.bytes);
    assert.deepEqual(Object.keys(files).sort(), ['location-gps.png', 'mid-gps.jpg', 'photo.jpg']);
    for (const b of Object.values(files)) assert.equal(readMeta(b).gps, undefined);
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/remove-location');
    await drop('notes.txt');
    await sees('isn’t a photo');
  },

  async 'fits a phone'({ open, drop, save, fitsPhone, shot }) {
    await open('/remove-location');
    await shot('empty-390', 390);
    await drop(['photo.jpg', 'mid.jpg']);
    await save({ count: 2 });
    await shot('two-390', 390);
    await fitsPhone();
  },
};
