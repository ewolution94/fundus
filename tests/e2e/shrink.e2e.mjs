// F-102 Shrink a photo, with the 4K wallpaper as a JPG (1.9 MB, a camera and a place in its EXIF)
// and as the HEIC itself.

import { unzipSync } from 'fflate';
import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

export default {
  async 'a 1.9 MB JPG comes out under 500 KB, without its place'({ open, drop, choose, save, assert, sees }) {
    await open('/shrink-a-photo');
    await drop('photo.jpg');
    await choose('Target', '500 KB');
    const out = await save();
    assert.equal(out.name, 'photo-small.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.ok(out.bytes.length <= 500_000, `${out.bytes.length} bytes`);
    assert.ok(out.bytes.length > 250_000, `too eager: ${out.bytes.length} bytes`);
    const meta = readMeta(out.bytes);
    assert.equal(meta.gps, undefined);
    assert.equal(meta.model, undefined);
    await sees('quality');
  },

  async 'kept location stays in, camera too'({ open, drop, choose, check, save, assert }) {
    await open('/shrink-a-photo');
    await check('Remove place, camera and time', false);
    await drop('photo.jpg');
    await choose('Target', '1 MB');
    const out = await save();
    assert.ok(out.bytes.length <= 1_000_000);
    const meta = readMeta(out.bytes);
    assert.equal(meta.model, 'iPhone 15');
    assert.ok(Math.abs(meta.gps.lat - 53.5503) < 0.001, JSON.stringify(meta.gps));
  },

  async 'a HEIC turns into a JPG under the target'({ open, drop, save, assert, page }) {
    await open('/shrink-a-photo');
    await drop('photo.heic');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'photo-small.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.ok(out.bytes.length <= 2_000_000);
    assert.deepEqual(dimensions(out.bytes), { width: 3840, height: 2160 }, 'a HEIC this size fits 2 MB without losing pixels');
    await page.getByText('3840 × 2160').first().waitFor();
  },

  async 'a photo already under the target keeps its pixels, loses its place'({ open, drop, save, assert, bytes }) {
    await open('/shrink-a-photo');
    await drop('mid-gps.jpg');
    const out = await save();
    const original = await bytes('mid-gps.jpg');
    assert.ok(out.bytes.length < original.length && out.bytes.length > original.length - 2000, `${original.length} → ${out.bytes.length}`);
    assert.equal(readMeta(out.bytes).gps, undefined);
    assert.equal(readMeta(original).model, 'Pixel 9');
  },

  async 'two photos, and with the ZIP from two on, one ZIP'({ open, drop, save, assert, page }) {
    await open('/shrink-a-photo');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ zipFrom: 2 })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop(['mid.jpg', 'photo.png']);
    const out = await save();
    assert.equal(out.name, 'photos-small.zip');
    const names = Object.keys(unzipSync(out.bytes)).sort();
    assert.deepEqual(names, ['mid-small.jpg', 'photo-small.png']);
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/shrink-a-photo');
    await drop('notes.txt');
    await sees('isn’t a photo');
  },

  async 'fits a phone'({ open, drop, fitsPhone, save }) {
    await open('/shrink-a-photo');
    await drop('photo.jpg');
    await save();
    await fitsPhone();
  },
};
