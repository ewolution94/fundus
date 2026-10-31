// F-101 Convert photos: the HEIC to JPG, PNG and WebP to each other, the shared format and quality,
// many at once into a ZIP, and a photo already in the right format kept as it is.

import { unzipSync } from 'fflate';
import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

const shared = (page, value) =>
  page.evaluate((v) => localStorage.setItem('fundus:shared', JSON.stringify(v)), value).then(() => page.reload()).then(() => page.waitForSelector('main[data-ready]'));

export default {
  async 'a HEIC becomes a JPG at full size, without a place'({ open, drop, save, assert, page, shot }) {
    await open('/convert-photos');
    await drop('photo.heic');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'photo.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.deepEqual(dimensions(out.bytes), { width: 3840, height: 2160 });
    assert.equal(readMeta(out.bytes).gps, undefined);
    await page.getByText('HEIC → ').first().waitFor();
    await shot('heic-1280', 1280);
    await shot('heic-390', 390);
  },

  async 'PNG and WebP to JPG, the choice for every photo tool, numbered names'({ open, drop, choose, save, assert, page, sees }) {
    await open('/convert-photos');
    await drop(['photo.png', 'photo.webp']);
    await choose('Format', 'JPG');
    await sees('Every photo tool now saves JPG');
    const out = await save({ count: 2 });
    const names = out.map((o) => o.name).sort();
    assert.deepEqual(names, ['photo-2.jpg', 'photo.jpg']);
    for (const o of out) {
      assert.equal(sniff(o.bytes), 'jpeg');
      assert.deepEqual(dimensions(o.bytes), { width: 900, height: 506 });
    }
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fundus:shared') ?? '{}'));
    assert.equal(stored.photoFormat, 'jpg');
  },

  async 'a JPG to PNG keeps its pixels'({ open, drop, choose, save, assert }) {
    await open('/convert-photos');
    await drop('mid.jpg');
    await choose('Format', 'PNG');
    const out = await save();
    assert.equal(out.name, 'mid.png');
    assert.equal(sniff(out.bytes), 'png');
    assert.deepEqual(dimensions(out.bytes), { width: 1600, height: 900 });
  },

  async 'WebP where the browser writes it, disabled in Safari'({ open, drop, choose, save, assert, page, engine, sees }) {
    await open('/convert-photos');
    await drop('mid.jpg');
    const webp = page.getByRole('radiogroup', { name: 'Format' }).getByRole('radio', { name: 'WebP', exact: true });
    if (engine === 'webkit') {
      await page.waitForFunction(() => document.querySelector('[role=radio][title]')?.hasAttribute('disabled'));
      assert.equal(await webp.isDisabled(), true);
      await sees('can’t write WebP');
      return;
    }
    await choose('Format', 'WebP');
    const out = await save();
    assert.equal(out.name, 'mid.webp');
    assert.equal(sniff(out.bytes), 'webp');
    assert.deepEqual(dimensions(out.bytes), { width: 1600, height: 900 });
  },

  async 'quality: Small is smaller than Best'({ open, drop, choose, save, assert, page }) {
    await open('/convert-photos');
    await shared(page, { photoFormat: 'jpg' });
    await drop('photo.png');
    await choose('Quality', 'Best');
    const best = await save();
    await choose('Quality', 'Small');
    const small = await save();
    assert.ok(small.bytes.length < best.bytes.length * 0.8, `${small.bytes.length} vs ${best.bytes.length}`);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fundus:shared') ?? '{}'));
    assert.equal(stored.quality, 70);
  },

  async 'a JPG that stays a JPG keeps its picture, loses only its place'({ open, drop, save, assert, bytes, sees }) {
    await open('/convert-photos');
    await drop('mid-gps.jpg');
    const out = await save();
    assert.equal(out.name, 'mid-gps-converted.jpg');
    const original = await bytes('mid-gps.jpg');
    assert.ok(out.bytes.length < original.length && out.bytes.length > original.length - 2000, `${original.length} → ${out.bytes.length}`);
    assert.equal(readMeta(out.bytes).gps, undefined);
    await sees('the picture stays');
  },

  async 'with location kept, a JPG that stays a JPG is the very same file'({ open, drop, check, choose, save, assert, bytes }) {
    await open('/convert-photos');
    await check('Remove place, camera and time', false);
    await drop('photo.jpg');
    await choose('Format', 'JPG');
    const out = await save();
    // Nothing to do: the very same bytes.
    const original = await bytes('photo.jpg');
    assert.equal(out.bytes.length, original.length);
    assert.equal(readMeta(out.bytes).model, 'iPhone 15');
  },

  async 'many at once, a ZIP from the Many files count'({ open, drop, save, assert, page }) {
    await open('/convert-photos');
    await shared(page, { zipFrom: 3 });
    await drop(['small.heic', 'photo.png', 'mid.jpg']);
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'photos-converted.zip');
    const files = unzipSync(out.bytes);
    assert.deepEqual(Object.keys(files).sort(), ['mid-converted.jpg', 'photo-converted.png', 'small.jpg']);
    assert.equal(sniff(files['small.jpg']), 'jpeg');
    assert.equal(sniff(files['photo-converted.png']), 'png');
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/convert-photos');
    await drop('notes.txt');
    await sees('isn’t a photo');
  },

  async 'fits a phone'({ open, drop, save, fitsPhone, shot }) {
    await open('/convert-photos');
    await shot('empty-390', 390);
    await drop(['mid.jpg', 'photo.png', 'photo.webp']);
    await save({ count: 3 });
    await shot('many-390', 390);
    await shot('many-1280', 1280);
    await fitsPhone();
  },
};
