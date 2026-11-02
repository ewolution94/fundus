// F-110 Carousel slicer, with the panorama (3840 × 1280 JPG): the tiles' count and size from the
// photo, never scaled up, 1080 when there's more, in order, without metadata; a changed count, the
// ZIP from the Many files count on, the strip moved, and the row that swipes.

import { unzipSync } from 'fflate';
import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

const b64 = (bytes) => Buffer.from(bytes).toString('base64');

/** The mean colour of a saved tile's top rows, read in the page. */
async function topTone(page, bytes) {
  return page.evaluate(async (data) => {
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4) / 3;
  }, b64(bytes));
}

const byName = (files) => [...files].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

export default {
  async '4:5: four tiles of 960 × 1200, the photo’s own pixels, in order, without metadata'({ open, drop, save, assert, page, sees }) {
    await open('/carousel-slicer');
    await drop('panorama.jpg');
    await sees('panorama.jpg');
    assert.equal(await page.locator('output.count').innerText(), '4');
    const files = byName(await save({ count: 4 }));
    assert.deepEqual(files.map((f) => f.name), ['panorama-1.jpg', 'panorama-2.jpg', 'panorama-3.jpg', 'panorama-4.jpg']);
    for (const f of files) {
      assert.equal(sniff(f.bytes), 'jpeg');
      // Four tiles of 4:5 across 3840 are 960 wide: under 1080, so not scaled up.
      assert.deepEqual(dimensions(f.bytes), { width: 960, height: 1200 });
      const meta = readMeta(f.bytes);
      assert.equal(meta.gps, undefined);
      assert.equal(meta.model, undefined);
    }
    await page.getByRole('listitem', { name: 'Tile 4 of 4' }).waitFor();
  },

  async 'one tile fewer: three of 1024 × 1280, still not scaled up'({ open, drop, save, assert, page, sees }) {
    await open('/carousel-slicer');
    await drop('panorama.jpg');
    await sees('panorama.jpg');
    await page.getByRole('button', { name: 'One tile fewer' }).click();
    await sees('Back to 4');
    const files = byName(await save({ count: 3 }));
    assert.deepEqual(files.map((f) => f.name), ['panorama-1.jpg', 'panorama-2.jpg', 'panorama-3.jpg']);
    for (const f of files) assert.deepEqual(dimensions(f.bytes), { width: 1024, height: 1280 });
  },

  async '1:1: three tiles brought down to 1080 × 1080'({ open, drop, choose, save, assert, page, sees }) {
    await open('/carousel-slicer');
    await drop('panorama.jpg');
    await sees('panorama.jpg');
    await choose('Tile shape', '1:1');
    assert.equal(await page.locator('output.count').innerText(), '3');
    await sees('The strip fills the photo');
    const files = byName(await save({ count: 3 }));
    for (const f of files) assert.deepEqual(dimensions(f.bytes), { width: 1080, height: 1080 });
  },

  async 'more tiles change the files; from five on they come as one ZIP'({ open, drop, save, assert, page, sees }) {
    await open('/carousel-slicer');
    await drop('panorama.jpg');
    await sees('panorama.jpg');
    await page.getByRole('button', { name: 'One tile more' }).click();
    assert.equal(await page.locator('output.count').innerText(), '5');
    const out = await save();
    assert.equal(out.name, 'panorama-carousel.zip');
    const zip = unzipSync(out.bytes);
    const names = Object.keys(zip).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    assert.deepEqual(names, ['panorama-1.jpg', 'panorama-2.jpg', 'panorama-3.jpg', 'panorama-4.jpg', 'panorama-5.jpg']);
    // Five of 4:5 across 3840: 768 × 960.
    for (const name of names) assert.deepEqual(dimensions(zip[name]), { width: 768, height: 960 });
  },

  async 'the position moves the strip up and down'({ open, drop, save, assert, page, sees }) {
    await open('/carousel-slicer');
    await drop('panorama.jpg');
    await sees('panorama.jpg');
    // Four tiles of 4:5 leave 80 px to move up or down.
    await sees('Up');
    const slider = page.getByLabel('Position', { exact: true });
    await slider.fill('0');
    const top = await save({ count: 4 });
    await slider.fill('100');
    const bottom = await save({ count: 4 });
    const a = await topTone(page, byName(top)[0].bytes);
    const b = await topTone(page, byName(bottom)[0].bytes);
    assert.ok(Math.abs(a - b) > 1, `the first tile's top rows differ: ${a} vs ${b}`);
  },

  async 'the tile’s shape is kept, the photo’s count is not'({ open, drop, choose, assert, page, sees }) {
    await open('/carousel-slicer');
    await choose('Tile shape', '3:4');
    await drop('panorama.jpg');
    await sees('panorama.jpg');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radiogroup', { name: 'Tile shape' }).getByRole('radio', { checked: true }).innerText(), '3:4');
  },

  async 'the row of tiles scrolls sideways inside itself; fits a phone'({ open, drop, save, fitsPhone, shot, assert, page }) {
    await open('/carousel-slicer');
    await drop('panorama.jpg');
    await save({ count: 4 });
    await page.setViewportSize({ width: 390, height: 844 });
    const row = await page.locator('.swipe').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, snap: getComputedStyle(el).scrollSnapType }));
    assert.ok(row.scroll > row.client, 'more tiles than fit: it scrolls');
    assert.match(row.snap, /x/);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot('phone', 390);
    await shot('desktop', 1280);
    await fitsPhone();
  },
};
