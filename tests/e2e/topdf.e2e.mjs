// F-106 Photos to PDF: pages, their size and turn, margins, the order (arrows and dragging), each
// photo embedded as a JPG at no more than 300 dpi, all read back from the saved PDF with pdf-lib.

import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib';
import { mmToPt } from '../../src/tools/topdf/topdf.ts';

/** Every page: its size, its image (pixels, filter) and where the image is drawn. */
async function read(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const { width, height } = page.getSize();
    const xobjects = page.node.Resources().lookup(PDFName.of('XObject'));
    const [ref] = xobjects.values();
    const image = doc.context.lookup(ref);
    const contents = page.node.Contents();
    const streams = contents.asArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
    const ops = streams.map((s) => new TextDecoder().decode(s.dict.get(PDFName.of('Filter')) ? decodePDFRawStream(s).decode() : s.contents)).join('\n');
    const cms = [...ops.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/g)].map((m) => m.slice(1).map(Number));
    return {
      width,
      height,
      image: { width: image.dict.get(PDFName.of('Width')).asNumber(), height: image.dict.get(PDFName.of('Height')).asNumber(), filter: String(image.dict.get(PDFName.of('Filter'))) },
      // pdf-lib draws an image as translate (x, y), rotate, scale (w, h).
      at: { x: cms[0][4], y: cms[0][5], w: cms[2][0], h: cms[2][3] },
    };
  });
}

const near = (assert, a, b, d = 0.05) => assert.ok(Math.abs(a - b) <= d, `${a} ≉ ${b}`);

export default {
  async 'three photos, three A4 pages turned to suit them, JPGs at most 300 dpi'({ open, drop, choose, save, assert, sees, shot }) {
    await open('/photos-to-pdf');
    await choose('Page', 'A4');
    await sees('Every tool now makes A4 pages');
    await drop(['photo.jpg', 'mid.jpg', 'photo.png']);
    const out = await save();
    assert.equal(out.name, 'photo-scan.pdf');
    const pages = await read(out.bytes);
    assert.equal(pages.length, 3);
    for (const p of pages) {
      assert.deepEqual([p.width, p.height], [841.89, 595.28]);
      assert.equal(p.image.filter, '/DCTDecode');
    }
    // 4K comes down to 300 dpi of the drawn width (about 808 pt); the smaller ones keep their pixels.
    assert.ok(pages[0].image.width <= 3368 && pages[0].image.width >= 3360, String(pages[0].image.width));
    assert.deepEqual([pages[1].image.width, pages[1].image.height], [1600, 900]);
    assert.deepEqual([pages[2].image.width, pages[2].image.height], [900, 506]);
    // The small margin, the photo centred.
    near(assert, pages[0].at.x, mmToPt(6));
    near(assert, pages[0].at.w, 841.89 - 2 * mmToPt(6));
    near(assert, pages[0].at.y, (595.28 - pages[0].at.h) / 2);
    // Nothing of the photos but their pixels: the iPhone's EXIF stays out.
    assert.ok(!Buffer.from(out.bytes).includes('iPhone 15'));
    await sees('3 pages');
    await shot('three-1280', 1280);
    await shot('three-390', 390);
  },

  async 'Letter, portrait, normal margin'({ open, drop, choose, save, assert, sees, page }) {
    await open('/photos-to-pdf');
    await drop('mid.jpg');
    await choose('Page', 'A4');
    await choose('Page', 'Letter');
    await sees('Every tool now makes Letter pages');
    await choose('Turn', 'Portrait');
    await choose('Margin', 'Normal');
    const [p] = await read((await save()).bytes);
    assert.deepEqual([p.width, p.height], [612, 792]);
    near(assert, p.at.x, mmToPt(15));
    near(assert, p.at.w, 612 - 2 * mmToPt(15));
    near(assert, p.at.h, p.at.w * (900 / 1600));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fundus:shared') ?? '{}'));
    assert.equal(stored.pageSize, 'letter');
  },

  async 'fit the photo, no margin: the page is the photo'({ open, drop, choose, save, assert }) {
    await open('/photos-to-pdf');
    await drop('photo.png');
    await choose('Page', 'A4');
    await choose('Page', 'Fit the photo');
    await choose('Margin', 'None');
    const [p] = await read((await save()).bytes);
    near(assert, p.width / p.height, 900 / 506, 0.001);
    near(assert, p.width, 841.89);
    assert.deepEqual([p.at.x, p.at.y], [0, 0]);
  },

  async 'remembers the turn and the margin, not the photos'({ open, drop, choose, page, assert }) {
    await open('/photos-to-pdf');
    await drop('mid.jpg');
    await choose('Turn', 'Landscape');
    await choose('Margin', 'None');
    // Reloaded once the PDF is made: WebKit fails reads still running when a page goes away.
    await page.getByRole('navigation', { name: 'Go on with the result' }).waitFor();
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radiogroup', { name: 'Turn' }).getByRole('radio', { name: 'Landscape' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radiogroup', { name: 'Margin' }).getByRole('radio', { name: 'None' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('.pages li').count(), 0);
  },

  async 'reordered with the arrows'({ open, drop, save, assert, page }) {
    await open('/photos-to-pdf');
    await drop(['mid.jpg', 'photo.png', 'small.heic']);
    await page.getByRole('button', { name: 'Move up: photo.png' }).click();
    await page.getByRole('button', { name: 'Move down: mid.jpg' }).click();
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'photo-scan.pdf', 'named after the new first photo');
    const pages = await read(out.bytes);
    assert.deepEqual(
      pages.map((p) => p.image.width),
      [900, 1200, 1600],
    );
  },

  async 'reordered by dragging'({ open, drop, save, assert, page }) {
    await open('/photos-to-pdf');
    await drop(['mid.jpg', 'photo.png']);
    await page.locator('.pages li').nth(1).dragTo(page.locator('.pages li').nth(0));
    await page.locator('.pages li').first().getByText('photo.png').waitFor();
    const pages = await read((await save()).bytes);
    assert.deepEqual(
      pages.map((p) => p.image.width),
      [900, 1600],
    );
  },

  async 'quality: Small makes a lighter PDF than Best'({ open, drop, choose, save, assert }) {
    await open('/photos-to-pdf');
    await drop('photo.jpg');
    await choose('Quality', 'Best');
    const best = await save();
    await choose('Quality', 'Small');
    const small = await save();
    assert.ok(small.bytes.length < best.bytes.length * 0.8, `${small.bytes.length} vs ${best.bytes.length}`);
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/photos-to-pdf');
    await drop('notes.txt');
    await sees('isn’t a photo');
  },

  async 'fits a phone'({ open, drop, save, fitsPhone, shot, choose }) {
    await open('/photos-to-pdf');
    await shot('empty-390', 390);
    await drop(['mid.jpg', 'photo.png']);
    await choose('Page', 'Fit the photo');
    await save();
    await shot('fit-390', 390);
    await fitsPhone();
  },
};
