// F-101 Convert photos: the HEIC to JPG, PNG and WebP to each other, the shared format and quality,
// many at once into a ZIP, a photo already in the right format kept as it is, and SVGs drawn at a
// scale or a width (sharp, transparent where they are), with HTML inside refused.

import { unzipSync } from 'fflate';
import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

/** One pixel of a saved picture, read in the page: [r, g, b, a]. */
const pixel = (page, bytes, x, y) =>
  page.evaluate(
    async ({ b64, x, y }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin]));
      const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return [...ctx.getImageData(x, y, 1, 1).data];
    },
    { b64: Buffer.from(bytes).toString('base64'), x, y },
  );

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

  async 'an SVG with only a viewBox: a PNG at 1×, 4× and 1000 px wide, see-through where it is'({ open, drop, choose, fill, save, assert, page, sees, shot }) {
    await open('/convert-photos');
    await drop('logo.svg');
    await sees('logo.svg: 64 × 64 → 64 × 64 px');
    let out = await save();
    assert.equal(out.name, 'logo.png');
    assert.equal(sniff(out.bytes), 'png');
    assert.deepEqual(dimensions(out.bytes), { width: 64, height: 64 });
    // The rounded corner stays see-through; the middle is the logo's yellow.
    assert.equal((await pixel(page, out.bytes, 0, 0))[3], 0);
    const [r, g, b, a] = await pixel(page, out.bytes, 32, 3);
    assert.ok(r > 245 && g > 215 && g < 235 && b < 90 && a === 255, `${r},${g},${b},${a}`);

    await choose('Size', '4×');
    out = await save();
    assert.deepEqual(dimensions(out.bytes), { width: 256, height: 256 });

    await choose('Size', 'Width');
    await fill('Width in pixels', '0');
    await sees('Type a width from 1 to 16,384 px.');
    assert.equal(await page.locator('button.save').isDisabled(), true);
    await fill('Width in pixels', '1000');
    out = await save();
    assert.deepEqual(dimensions(out.bytes), { width: 1000, height: 1000 });
    // Still sharp at that size: the edge of the yellow is one pixel of blend at most.
    const edge = await page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin]));
      const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const row = ctx.getImageData(0, 500, 6, 1).data;
      return [row[3], row[7], row[11], row[15], row[19], row[23]];
    }, Buffer.from(out.bytes).toString('base64'));
    assert.ok(edge.filter((alpha) => alpha > 0 && alpha < 255).length <= 1, String(edge));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fundus:tool:convert') ?? '{}'));
    assert.deepEqual(stored, { svgScale: 'width', svgWidth: '1000' });
    await shot('svg-1280', 1280);
    await shot('svg-390', 390);
  },

  async 'an SVG with a width and height, at 2×'({ open, drop, choose, save, assert }) {
    await open('/convert-photos');
    await drop('wide.svg');
    await choose('Size', '2×');
    const out = await save();
    assert.equal(out.name, 'wide.png');
    assert.deepEqual(dimensions(out.bytes), { width: 600, height: 200 });
  },

  async 'an SVG to JPG has white under it, no transparency'({ open, drop, choose, save, assert, page }) {
    await open('/convert-photos');
    await drop('logo.svg');
    await choose('Format', 'JPG');
    // At 4× the see-through corner is big enough that the JPG's blocks don't blur yellow into it.
    await choose('Size', '4×');
    const out = await save();
    assert.equal(out.name, 'logo.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.deepEqual(dimensions(out.bytes), { width: 256, height: 256 });
    const [r, g, b, a] = await pixel(page, out.bytes, 0, 0);
    assert.ok(r > 245 && g > 245 && b > 245 && a === 255, `${r},${g},${b},${a}`);
  },

  async 'an SVG and photos together: a new SVG size, the photos stay as they were'({ open, drop, choose, save, assert, page }) {
    await open('/convert-photos');
    await drop(['wide.svg', 'mid.jpg']);
    let out = await save({ count: 2 });
    const photo = out.find((o) => o.name === 'mid-converted.jpg');
    assert.ok(photo);
    await choose('Size', '4×');
    out = await save({ count: 2 });
    assert.deepEqual(dimensions(out.find((o) => o.name === 'wide.png').bytes), { width: 1200, height: 400 });
    assert.equal(out.find((o) => o.name === 'mid-converted.jpg').bytes.length, photo.bytes.length);
    assert.equal(await page.getByRole('radiogroup', { name: 'Size' }).count(), 1);
  },

  async 'an SVG with HTML inside: says why, and makes nothing'({ open, drop, sees, page, assert }) {
    await open('/convert-photos');
    await drop('foreign.svg');
    await sees('foreign.svg: this SVG holds HTML inside, which browsers won’t turn into pixels.');
    assert.equal(await page.locator('button.save').count(), 0);
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

  async 'fits a phone with an SVG and a width in'({ open, drop, choose, save, fitsPhone }) {
    await open('/convert-photos');
    await drop(['logo.svg', 'mid.jpg']);
    await choose('Size', 'Width');
    await save({ count: 2 });
    await fitsPhone();
  },
};
