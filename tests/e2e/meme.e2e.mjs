// F-108 Meme maker, with the 4K photo (blue sky at the top, an iPhone's EXIF with a place) and the
// small PNG: the size kept, the place gone, white text where it's typed, the caption's bar on top,
// PNG staying PNG, a HEIC becoming a JPG, German text with umlauts and ß.

import { readMeta } from '../../src/lib/exif.ts';
import { dimensions, sniff } from '../../src/lib/files.ts';

const settings = async (page, value) => {
  await page.evaluate((v) => localStorage.setItem('fundus:shared', JSON.stringify(v)), value);
  await page.reload();
  await page.waitForSelector('main[data-ready]');
};

const b64 = (bytes) => Buffer.from(bytes).toString('base64');

/**
 * Decodes a picture in the page and returns, for a region given as shares of its width and height,
 * the share of pixels that are near white and near black, and the picture's size.
 */
async function tones(page, bytes, [x0, y0, x1, y1]) {
  return page.evaluate(
    async ({ data, r }) => {
      const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin]));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const x = Math.floor(bmp.width * r[0]);
      const y = Math.floor(bmp.height * r[1]);
      const w = Math.max(1, Math.floor(bmp.width * (r[2] - r[0])));
      const h = Math.max(1, Math.floor(bmp.height * (r[3] - r[1])));
      const d = ctx.getImageData(x, y, w, h).data;
      let white = 0;
      let black = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++;
        if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) black++;
      }
      const n = d.length / 4;
      return { width: bmp.width, height: bmp.height, white: white / n, black: black / n };
    },
    { data: b64(bytes), r: [x0, y0, x1, y1] },
  );
}

const TOP_CENTRE = [0.3, 0, 0.7, 0.2];

export default {
  async 'a JPG keeps its size and loses its place; the top text is white with a black outline'({ open, drop, fill, save, assert, page, bytes, sees }) {
    await open('/meme-maker');
    await drop('photo.jpg');
    await sees('photo.jpg');
    await fill('Top text', 'when the tests pass');
    await fill('Bottom text', 'on the first try');
    const out = await save();
    assert.equal(out.name, 'photo-meme.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.deepEqual(dimensions(out.bytes), { width: 3840, height: 2160 });
    const meta = readMeta(out.bytes);
    assert.equal(meta.gps, undefined);
    assert.equal(meta.model, undefined);
    const before = await tones(page, await bytes('photo.jpg'), TOP_CENTRE);
    const after = await tones(page, out.bytes, TOP_CENTRE);
    assert.ok(before.white < 0.01, `the sky has no white: ${before.white}`);
    assert.ok(after.white > 0.08, `white letters at the top: ${after.white}`);
    assert.ok(after.black > 0.02, `their black outline: ${after.black}`);
    // The middle stays the photo.
    const middle = await tones(page, out.bytes, [0.3, 0.4, 0.7, 0.6]);
    assert.ok(middle.white < 0.02, String(middle.white));
    await page.getByText('3840 × 2160').first().waitFor();
    // Drawn in Anton, loaded from our own origin (not a fallback face).
    assert.ok(await page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Anton' && f.status === 'loaded')));
  },

  async 'the place stays when the setting keeps it'({ open, drop, fill, save, assert, page, sees }) {
    await open('/meme-maker');
    await settings(page, { stripLocation: false });
    await drop('photo.jpg');
    await sees('photo.jpg');
    await fill('Top text', 'hello');
    const out = await save();
    const meta = readMeta(out.bytes);
    assert.equal(meta.model, 'iPhone 15');
    assert.ok(meta.gps && Math.abs(meta.gps.lat - 53.5503) < 0.001, JSON.stringify(meta.gps));
  },

  async 'Caption puts a white bar with dark text above the photo'({ open, drop, fill, choose, save, assert, page, sees }) {
    await open('/meme-maker');
    await drop('photo.jpg');
    await sees('photo.jpg');
    await choose('Style', 'Caption');
    await fill('Caption', 'Me explaining why the tests are green but the app is broken');
    const out = await save();
    const size = dimensions(out.bytes);
    assert.equal(size.width, 3840);
    assert.ok(size.height > 2160 + 100, `taller than the photo: ${size.height}`);
    const bar = (size.height - 2160) / size.height;
    const inBar = await tones(page, out.bytes, [0, 0, 1, bar * 0.98]);
    assert.ok(inBar.white > 0.7, `the bar is white: ${inBar.white}`);
    assert.ok(inBar.black > 0.01, `with dark text: ${inBar.black}`);
    // Left-aligned: the text starts in the left part of the bar, and the photo is below it, as it was.
    const left = await tones(page, out.bytes, [0, 0, 0.3, bar * 0.98]);
    assert.ok(left.black > 0.01, String(left.black));
    const photo = await tones(page, out.bytes, [0.3, bar + 0.01, 0.7, bar + 0.1]);
    assert.ok(photo.white < 0.01, 'the sky under the bar');
  },

  async 'a PNG stays a PNG at its size'({ open, drop, fill, save, assert, sees }) {
    await open('/meme-maker');
    await drop('photo.png');
    await sees('photo.png');
    await fill('Top text', 'png');
    const out = await save();
    assert.equal(out.name, 'photo-meme.png');
    assert.equal(sniff(out.bytes), 'png');
    assert.deepEqual(dimensions(out.bytes), { width: 900, height: 506 });
  },

  async 'a HEIC becomes a JPG'({ open, drop, fill, save, assert, sees }) {
    await open('/meme-maker');
    await drop('small.heic');
    await sees('small.heic', 60_000);
    await fill('Bottom text', 'heic');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'small-meme.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
  },

  async 'umlauts and ß are drawn; the text follows the typing'({ open, drop, fill, choose, save, assert, page, sees }) {
    await open('/meme-maker');
    await drop('mid.jpg');
    await sees('mid.jpg');
    await fill('Top text', 'Größe über Äpfel');
    await fill('Bottom text', 'Straße');
    const first = await save();
    assert.equal(sniff(first.bytes), 'jpeg');
    const big = await tones(page, first.bytes, [0, 0, 1, 0.25]);
    await choose('Size', 'Small');
    const small = await save();
    const less = await tones(page, small.bytes, [0, 0, 1, 0.25]);
    assert.ok(less.white < big.white, `Small has less white: ${less.white} < ${big.white}`);
  },

  async 'the style and size are kept, the text is not'({ open, drop, fill, choose, assert, page, sees }) {
    await open('/meme-maker');
    await choose('Style', 'Caption');
    await choose('Size', 'Large');
    await drop('mid.jpg');
    await sees('mid.jpg');
    await fill('Caption', 'secret words');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radiogroup', { name: 'Style' }).getByRole('radio', { checked: true }).innerText(), 'Caption');
    assert.equal(await page.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { checked: true }).innerText(), 'Large');
    assert.equal(await page.getByLabel('Caption', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('secret'), stored);
  },

  async 'fits a phone'({ open, drop, fill, save, fitsPhone, shot }) {
    await open('/meme-maker');
    await drop('photo.jpg');
    await fill('Top text', 'one does not simply');
    await fill('Bottom text', 'walk into Mordor');
    await save();
    await shot('phone', 390);
    await shot('desktop', 1280);
    await fitsPhone();
  },
};
