// F-105 Blur parts: boxes drawn with the mouse, moved, resized and removed, and moved with keys; each
// blacked out or pixelated, checked pixel by pixel against the photo (PNG out, so nothing is lost
// on the way): black inside, flat blocks of the size shown, everything outside untouched. Then the
// shared settings: the place goes by default and stays when asked, HEIC comes out a JPG.

import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

const settings = async (page, value) => {
  await page.evaluate((v) => localStorage.setItem('fundus:shared', JSON.stringify(v)), value);
  await page.reload();
  await page.waitForSelector('main[data-ready]');
};

/** A drag with the mouse from one point to another, in steps. */
async function dragFromTo(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(from.x + ((to.x - from.x) * k) / 6, from.y + ((to.y - from.y) * k) / 6);
  await page.mouse.up();
}

/** Draws a box on the photo between two points given as shares of its width and height. */
async function drawBox(page, [x1, y1], [x2, y2]) {
  const stage = await page.locator('.stage').boundingBox();
  await dragFromTo(page, { x: stage.x + stage.width * x1, y: stage.y + stage.height * y1 }, { x: stage.x + stage.width * x2, y: stage.y + stage.height * y2 });
}

/** Where a box is on the photo, in the photo's pixels, from its place on screen. */
async function boxOnPhoto(page, box, photoWidth) {
  const stage = await page.locator('.stage').boundingBox();
  const b = await box.boundingBox();
  const s = photoWidth / stage.width;
  return { x: (b.x - stage.x) * s, y: (b.y - stage.y) * s, w: b.width * s, h: b.height * s };
}

const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * The saved photo against the original, in the page: the rectangle of pixels that changed, whether
 * it's all black, and, for blocks of `block` px from its top left, whether each block is one colour
 * and how many colours there are.
 */
async function compare(page, before, after, block = 0) {
  return page.evaluate(
    async ({ a, b, block }) => {
      const load = async (b64) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bin]));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
      };
      const A = await load(a);
      const B = await load(b);
      if (A.w !== B.w || A.h !== B.h) return { size: false };
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < A.h; y++)
        for (let x = 0; x < A.w; x++) {
          const i = (y * A.w + x) * 4;
          if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2]) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
        }
      if (x1 < 0) return { size: true, changed: null };
      const changed = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      let black = true;
      let flat = true;
      const colours = new Set();
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = (y * B.w + x) * 4;
          const rgb = `${B.d[i]},${B.d[i + 1]},${B.d[i + 2]}`;
          colours.add(rgb);
          if (rgb !== '0,0,0') black = false;
          if (block) {
            const ox = x0 + Math.floor((x - x0) / block) * block;
            const oy = y0 + Math.floor((y - y0) / block) * block;
            const j = (oy * B.w + ox) * 4;
            if (B.d[j] !== B.d[i] || B.d[j + 1] !== B.d[i + 1] || B.d[j + 2] !== B.d[i + 2]) flat = false;
          }
        }
      return { size: true, changed, black, flat, colours: colours.size };
    },
    { a: Buffer.from(before).toString('base64'), b: Buffer.from(after).toString('base64'), block },
  );
}

/** The changed rectangle is the box, give or take the whole pixels it's widened to. */
function near(assert, changed, box, what) {
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(changed[k] - box[k]) <= 3, `${what} ${k}: ${changed[k]} vs ${box[k].toFixed(1)}`);
}

/** The block size the page shows, in px. */
async function blockShown(page) {
  const text = await page.getByText(/\(\d+ px\)/).first().innerText();
  return Number(text.match(/\((\d+) px\)/)[1]);
}

export default {
  async 'a box drawn and blacked out: black inside, nothing else touched'({ open, drop, choose, save, assert, page, bytes, sees, shot }) {
    await open('/blur-parts');
    await settings(page, { photoFormat: 'png' });
    await drop('photo.png');
    await page.locator('.stage').waitFor();
    await choose('Hide with', 'Black out');
    await drawBox(page, [0.2, 0.25], [0.55, 0.7]);
    await sees('1 box');
    const out = await save();
    assert.equal(out.name, 'photo-blurred.png');
    assert.equal(sniff(out.bytes), 'png');
    assert.deepEqual(dimensions(out.bytes), { width: 900, height: 506 });
    const box = await boxOnPhoto(page, page.locator('.stage .box'), 900);
    const r = await compare(page, await bytes('photo.png'), out.bytes);
    assert.ok(r.changed, 'something changed');
    near(assert, r.changed, box, 'black box');
    assert.equal(r.black, true, 'black all through');
    await shot('black-1280', 1280);
    await shot('black-390', 390);
  },

  async 'pixelated in flat blocks of the size shown; Large is coarser than Small'({ open, drop, choose, save, assert, page, bytes, shot }) {
    await open('/blur-parts');
    await settings(page, { photoFormat: 'png' });
    await drop('photo.png');
    await page.locator('.stage').waitFor();
    await choose('Blocks', 'Large');
    await drawBox(page, [0.1, 0.1], [0.6, 0.8]);
    const large = await blockShown(page);
    assert.equal(large, 28, '900 px wide: a 32nd of it');
    const box = await boxOnPhoto(page, page.locator('.stage .box'), 900);
    const original = await bytes('photo.png');
    const a = await compare(page, original, (await save()).bytes, large);
    near(assert, a.changed, box, 'pixelated box');
    assert.equal(a.flat, true, 'every block one colour');
    const most = Math.ceil(a.changed.w / large) * Math.ceil(a.changed.h / large);
    assert.ok(a.colours <= most, `${a.colours} colours in ${most} blocks`);
    await shot('pixelate-1280', 1280);

    await choose('Blocks', 'Small');
    const small = await blockShown(page);
    assert.equal(small, 10);
    const b = await compare(page, original, (await save()).bytes, small);
    assert.equal(b.flat, true);
    assert.ok(b.colours > a.colours * 4, `Small: ${b.colours} colours, Large: ${a.colours}`);
  },

  async 'a box moved, resized and removed with the mouse'({ open, drop, save, assert, page, sees, bytes }) {
    await open('/blur-parts');
    await settings(page, { photoFormat: 'png' });
    await drop('photo.png');
    await page.locator('.stage').waitFor();
    await drawBox(page, [0.1, 0.1], [0.3, 0.3]);
    const box = page.locator('.stage .box');
    const first = await box.boundingBox();
    // Moved by its middle.
    await dragFromTo(page, centre(first), { x: centre(first).x + 120, y: centre(first).y + 60 });
    const moved = await box.boundingBox();
    assert.ok(Math.abs(moved.x - first.x - 120) < 2 && Math.abs(moved.y - first.y - 60) < 2, JSON.stringify({ first, moved }));
    assert.ok(Math.abs(moved.width - first.width) < 1, 'same size');
    // Bigger by its bottom-right corner; the top left stays.
    const handle = centre(await box.locator('.corner.se').boundingBox());
    assert.ok(Math.abs(handle.x - (moved.x + moved.width)) < 2 && Math.abs(handle.y - (moved.y + moved.height)) < 2, 'the handle sits on the corner');
    await dragFromTo(page, handle, { x: handle.x + 50, y: handle.y + 30 });
    const bigger = await box.boundingBox();
    assert.ok(Math.abs(bigger.width - moved.width - 50) < 2 && Math.abs(bigger.height - moved.height - 30) < 2, JSON.stringify({ moved, bigger }));
    assert.ok(Math.abs(bigger.x - moved.x) < 1);
    const where = await boxOnPhoto(page, box, 900);
    const r = await compare(page, await bytes('photo.png'), (await save()).bytes);
    near(assert, r.changed, where, 'the box where it was left');
    // A tap on the photo draws nothing and lets the box go.
    const stage = await page.locator('.stage').boundingBox();
    await page.mouse.click(stage.x + stage.width * 0.9, stage.y + stage.height * 0.9);
    assert.equal(await page.locator('.stage .box').count(), 1);
    assert.equal(await page.locator(".stage .box.on").count(), 0);
    // Chosen again, then removed with the button.
    await dragFromTo(page, centre(bigger), centre(bigger));
    await page.getByRole('button', { name: 'Remove this box' }).click();
    assert.equal(await page.locator('.stage .box').count(), 0);
    await sees('None yet');
    assert.equal(await page.locator('button.save').isDisabled(), true, 'nothing to save without a box');
  },

  async 'a box added with the button, moved with the keys, removed with Delete'({ open, drop, save, assert, page, bytes, sees }) {
    await open('/blur-parts');
    await settings(page, { photoFormat: 'png' });
    await drop('photo.png');
    await page.locator('.stage').waitFor();
    await page.getByRole('button', { name: 'Add a box' }).click();
    const box = page.getByRole('group', { name: 'Box 1, pixelated' });
    await box.waitFor();
    const r0 = await compare(page, await bytes('photo.png'), (await save()).bytes);
    // A fifth of the photo each way, in the middle: 180 × 101 at 360, 202.
    near(assert, r0.changed, { x: 360, y: 202.4, w: 180, h: 101.2 }, 'the middle box');
    await box.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('ArrowDown');
    const r1 = await compare(page, await bytes('photo.png'), (await save()).bytes);
    // Shift moves a twentieth of the long side (45 px), a plain arrow a hundredth (9 px).
    near(assert, r1.changed, { x: 405, y: 211.4, w: 180, h: 101.2 }, 'moved by keys');
    await box.focus();
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('.stage .box').count(), 0);
    await sees('None yet');
  },

  async 'the place goes by default, and stays when the setting says so'({ open, drop, save, assert, page }) {
    await open('/blur-parts');
    await drop('mid-gps.jpg');
    await page.locator('.stage').waitFor();
    await page.getByRole('button', { name: 'Add a box' }).click();
    const out = await save();
    assert.equal(out.name, 'mid-gps-blurred.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.deepEqual(dimensions(out.bytes), { width: 1600, height: 900 });
    assert.equal(readMeta(out.bytes).gps, undefined);
    assert.equal(readMeta(out.bytes).model, undefined);

    await settings(page, { stripLocation: false });
    await drop('mid-gps.jpg');
    await page.locator('.stage').waitFor();
    await page.getByRole('button', { name: 'Add a box' }).click();
    const kept = await save();
    assert.ok(readMeta(kept.bytes).gps, 'the place kept');
    assert.equal(readMeta(kept.bytes).model, 'Pixel 9');
  },

  async 'a HEIC comes out a JPG'({ open, drop, save, assert, page }) {
    await open('/blur-parts');
    await drop('small.heic');
    await page.locator('.stage').waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Add a box' }).click();
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'small-blurred.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.equal(dimensions(out.bytes).width, 1200);
  },

  async 'remembers how boxes hide and the block size, not the boxes'({ open, drop, choose, page, assert }) {
    await open('/blur-parts');
    await choose('Hide with', 'Black out');
    await choose('Blocks', 'Small');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    const on = (group, option) => page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: option, exact: true }).getAttribute('aria-checked');
    assert.equal(await on('Hide with', 'Black out'), 'true');
    assert.equal(await on('Blocks', 'Small'), 'true');
    await drop('mid.jpg');
    await page.locator('.stage').waitFor();
    assert.equal(await page.locator('.stage .box').count(), 0);
    await page.getByRole('button', { name: 'Add a box' }).click();
    await page.getByRole('group', { name: 'Box 1, blacked out' }).waitFor();
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/blur-parts');
    await drop('notes.txt');
    await sees('isn’t a photo');
  },

  async 'a result handed on from Resize & crop opens with its photo'({ open, drop, page, save, sees, assert }) {
    await open('/resize-and-crop');
    await drop('mid.jpg');
    await page.getByText('1600 × 900').first().waitFor();
    await page.getByLabel('Width', { exact: true }).fill('800');
    await save();
    await page.getByRole('navigation', { name: 'Go on with the result' }).getByRole('link', { name: /Blur parts/ }).click();
    await page.locator('.stage').waitFor();
    await sees('mid-800x450.jpg');
    assert.equal(new URL(page.url()).pathname, '/blur-parts');
  },

  async 'fits a phone'({ open, drop, page, save, fitsPhone, shot }) {
    await open('/blur-parts');
    await shot('empty-390', 390);
    await drop('photo.jpg');
    await page.locator('.stage').waitFor();
    await page.getByRole('button', { name: 'Add a box' }).click();
    await save();
    await shot('photo-390', 390);
    await fitsPhone();
  },
};
