// F-103 Resize & crop: a size typed (the shape kept or not), several photos into one box, the crop
// shapes and the profile picture, the frame dragged and resized with the mouse and moved with keys,
// the print size, and the shared format; every result checked in its bytes.

import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

const settings = async (page, value) => {
  await page.evaluate((v) => localStorage.setItem('fundus:shared', JSON.stringify(v)), value);
  await page.reload();
  await page.waitForSelector('main[data-ready]');
};

/** The centre of an element on screen. */
const centre = async (locator) => {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

async function dragBy(page, locator, dx, dy) {
  const from = await centre(locator);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= 5; k++) await page.mouse.move(from.x + (dx * k) / 5, from.y + (dy * k) / 5);
  await page.mouse.up();
}

export default {
  async 'a width typed, the height follows, out comes 1920 × 1080'({ open, drop, fill, save, assert, page, sees, shot }) {
    await open('/resize-and-crop');
    await settings(page, { units: 'metric' });
    await drop('photo.jpg');
    await page.getByText('3840 × 2160').first().waitFor();
    assert.equal(await page.getByLabel('Width', { exact: true }).inputValue(), '3840');
    await fill('Width', '1920');
    assert.equal(await page.getByLabel('Height', { exact: true }).inputValue(), '1080');
    const out = await save();
    assert.equal(out.name, 'photo-1920x1080.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.deepEqual(dimensions(out.bytes), { width: 1920, height: 1080 });
    assert.equal(readMeta(out.bytes).gps, undefined, 'the place goes by default');
    await sees('On paper at 300 dpi: 16.3 × 9.1 cm');
    await shot('size-1280', 1280);
    await shot('size-390', 390);
  },

  async 'the shape let go: exactly the size typed'({ open, drop, fill, check, save, assert, page }) {
    await open('/resize-and-crop');
    await drop('mid.jpg');
    await page.getByText('1600 × 900').first().waitFor();
    await check('Keep the shape', false);
    await fill('Width', '1000');
    await fill('Height', '1000');
    const out = await save();
    assert.deepEqual(dimensions(out.bytes), { width: 1000, height: 1000 });
  },

  async 'a size that can’t be: says so, saves nothing'({ open, drop, fill, sees, page, assert }) {
    await open('/resize-and-crop');
    await drop('mid.jpg');
    await page.getByText('1600 × 900').first().waitFor();
    await fill('Width', '0');
    await sees('Type a width and a height in pixels');
    assert.equal(await page.locator('button.save').isDisabled(), true);
  },

  async 'several photos fit one box, each keeping its shape'({ open, drop, fill, save, assert, sees }) {
    await open('/resize-and-crop');
    await drop(['mid.jpg', 'photo.png']);
    await sees('2 photos');
    await fill('Width', '800');
    await fill('Height', '800');
    const out = await save({ count: 2 });
    for (const o of out) assert.deepEqual(dimensions(o.bytes), { width: 800, height: 450 }, o.name);
    assert.deepEqual(out.map((o) => o.name).sort(), ['mid-800x450.jpg', 'photo-800x450.png']);
  },

  async 'crop to a square, 9:16 and the profile picture'({ open, drop, choose, save, assert, sees, shot }) {
    await open('/resize-and-crop');
    await drop('photo.jpg');
    await choose('Do', 'Crop');
    await choose('Shape', '1:1');
    const square = await save();
    assert.deepEqual(dimensions(square.bytes), { width: 2160, height: 2160 });
    assert.equal(square.name, 'photo-2160x2160.jpg');
    await choose('Shape', '9:16');
    assert.deepEqual(dimensions((await save()).bytes), { width: 1215, height: 2160 });
    await choose('Shape', 'Profile picture');
    await sees('Square, 800 px');
    const profile = await save();
    assert.deepEqual(dimensions(profile.bytes), { width: 800, height: 800 });
    await shot('crop-1280', 1280);
    await shot('crop-390', 390);
  },

  async '4:3 turned upright'({ open, drop, choose, save, assert, page }) {
    await open('/resize-and-crop');
    await drop('photo.jpg');
    await choose('Do', 'Crop');
    await choose('Shape', '4:3');
    assert.deepEqual(dimensions((await save()).bytes), { width: 2880, height: 2160 });
    await page.getByRole('button', { name: 'Turn' }).click();
    assert.deepEqual(dimensions((await save()).bytes), { width: 1620, height: 2160 });
  },

  async 'the frame dragged by a corner and moved, its shape held'({ open, drop, choose, save, assert, page }) {
    await open('/resize-and-crop');
    await drop('photo.jpg');
    await choose('Do', 'Crop');
    await choose('Shape', '1:1');
    const crop = page.locator('.crop');
    await crop.waitFor();
    const before = await crop.boundingBox();
    // Pull the bottom-right corner up and in: the square gets smaller, still square.
    await dragBy(page, page.locator('.crop .handle.se'), -before.width / 3, -before.height / 3);
    const after = await crop.boundingBox();
    assert.ok(after.width < before.width * 0.8, `${before.width} → ${after.width}`);
    const smaller = await save();
    const d = dimensions(smaller.bytes);
    assert.equal(d.width, d.height);
    assert.ok(d.width < 1800 && d.width > 1200, JSON.stringify(d));
    // Move it left as far as it goes: same size, at the photo's edge.
    await dragBy(page, crop, -2000, 0);
    const moved = await crop.boundingBox();
    const stage = await page.locator('.stage').boundingBox();
    assert.ok(Math.abs(moved.x - stage.x) < 1.5, `${moved.x} vs ${stage.x}`);
    assert.deepEqual(dimensions((await save()).bytes), d);
  },

  async 'free crop by a side; arrow keys move the frame'({ open, drop, choose, save, assert, page }) {
    await open('/resize-and-crop');
    await drop('mid.jpg');
    await choose('Do', 'Crop');
    await choose('Shape', 'Free');
    const crop = page.locator('.crop');
    const box = await crop.boundingBox();
    await dragBy(page, page.locator('.crop .handle.e'), -box.width / 2, 0);
    const half = dimensions((await save()).bytes);
    assert.ok(Math.abs(half.width - 800) < 20 && half.height === 900, JSON.stringify(half));
    await crop.focus();
    const x0 = (await crop.boundingBox()).x;
    await page.keyboard.press('Shift+ArrowRight');
    const x1 = (await crop.boundingBox()).x;
    assert.ok(x1 > x0 + 20, `${x0} → ${x1}`);
    assert.deepEqual(dimensions((await save()).bytes), half, 'moving keeps the size');
  },

  async 'inches for imperial units; the shared format makes it a PNG'({ open, drop, fill, save, assert, page, sees }) {
    await open('/resize-and-crop');
    await settings(page, { units: 'imperial', photoFormat: 'png' });
    await drop('mid.jpg');
    await page.getByText('1600 × 900').first().waitFor();
    await fill('Width', '1920');
    await sees('On paper at 300 dpi: 6.4 × 3.6 in');
    await sees('PNG ·');
    const out = await save();
    assert.equal(out.name, 'mid-1920x1080.png');
    assert.equal(sniff(out.bytes), 'png');
    assert.deepEqual(dimensions(out.bytes), { width: 1920, height: 1080 });
    await sees('Bigger than the photo');
  },

  async 'location kept when the setting says so'({ open, drop, fill, save, assert, page }) {
    await open('/resize-and-crop');
    await settings(page, { stripLocation: false });
    await drop('mid-gps.jpg');
    await page.getByText('1600 × 900').first().waitFor();
    await fill('Width', '800');
    const out = await save();
    assert.equal(readMeta(out.bytes).model, 'Pixel 9');
    assert.ok(readMeta(out.bytes).gps);
  },

  async 'a HEIC, cropped, comes out a JPG'({ open, drop, choose, save, assert }) {
    await open('/resize-and-crop');
    await drop('small.heic');
    await choose('Do', 'Crop');
    await choose('Shape', '16:9');
    const out = await save({ timeout: 60_000 });
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.equal(out.name.endsWith('.jpg'), true);
    const d = dimensions(out.bytes);
    assert.equal(d.width, 1200);
  },

  async 'remembers the way and the shape, not the size'({ open, drop, choose, page, assert }) {
    await open('/resize-and-crop');
    await choose('Do', 'Crop');
    await choose('Shape', '16:9');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radiogroup', { name: 'Shape' }).getByRole('radio', { name: '16:9' }).getAttribute('aria-checked'), 'true');
    await choose('Do', 'Size');
    await drop('mid.jpg');
    await page.getByText('1600 × 900').first().waitFor();
    assert.equal(await page.getByLabel('Width', { exact: true }).inputValue(), '1600');
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/resize-and-crop');
    await drop('notes.txt');
    await sees('isn’t a photo');
  },

  async 'fits a phone'({ open, drop, choose, save, fitsPhone, shot }) {
    await open('/resize-and-crop');
    await shot('empty-390', 390);
    await drop(['mid.jpg', 'photo.png']);
    await choose('Do', 'Crop');
    await save({ count: 2 });
    await shot('crop-many-390', 390);
    await fitsPhone();
  },
};
