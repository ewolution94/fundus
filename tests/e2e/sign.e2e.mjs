// F-202 Sign a PDF, with letter.pdf (3 pages, the last turned 90°) and the samples PDF to photos'
// tests make. The signed file is read back in node: where each picture and line of text landed in
// PDF coordinates, mapped onto the page as shown the way pdf.js draws it, against the box on screen.

import { PDFDocument, PDFArray, PDFName, decodePDFRawStream } from 'pdf-lib';
import { samples } from './pdfimg.e2e.mjs';

/** pdf.js's viewport at scale 1 (display_utils.js), on its own here: a PDF point to (u, v) on the page as shown. */
function viewport([x0, y0, x1, y1], rotation) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const [a, b, c, d] = { 0: [1, 0, 0, -1], 90: [0, 1, 1, 0], 180: [-1, 0, 0, 1], 270: [0, -1, -1, 0] }[((rotation % 360) + 360) % 360];
  const side = a === 0;
  const ox = side ? Math.abs(cy - y0) : Math.abs(cx - x0);
  const oy = side ? Math.abs(cx - x0) : Math.abs(cy - y0);
  const width = side ? y1 - y0 : x1 - x0;
  const height = side ? x1 - x0 : y1 - y0;
  const e = ox - a * cx - c * cy;
  const f = oy - b * cx - d * cy;
  return ([x, y]) => ({ u: (a * x + c * y + e) / width, v: (b * x + d * y + f) / height });
}

/** Per page: each picture's corners and each text line's start and direction, on the page as shown. */
async function placements(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const box = page.getCropBox();
    const shown = viewport([box.x, box.y, box.x + box.width, box.y + box.height], page.getRotation().angle);
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
    const text = streams.map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
    const pictures = [];
    const lines = [];
    for (const block of text.split(/\bQ\b/)) {
      const num = '(-?[\\d.]+(?:e-?\\d+)?)';
      if (/\bDo\b/.test(block)) {
        const ms = [...block.matchAll(new RegExp(`${Array(6).fill(num).join('\\s+')}\\s+cm`, 'g'))].map((m) => m.slice(1, 7).map(Number));
        const apply = (x, y) => ms.reduceRight(([px, py], [a, b, c, d, e, f]) => [a * px + c * py + e, b * px + d * py + f], [x, y]);
        pictures.push({ bottomLeft: shown(apply(0, 0)), bottomRight: shown(apply(1, 0)), topLeft: shown(apply(0, 1)) });
      }
      const tm = new RegExp(`${Array(6).fill(num).join('\\s+')}\\s+Tm\\s*<([0-9A-Fa-f]+)>\\s*Tj`).exec(block);
      if (tm) {
        const [a, b, , , e, f] = tm.slice(1, 7).map(Number);
        lines.push({ text: Buffer.from(tm[7], 'hex').toString('latin1'), start: shown([e, f]), along: shown([e + 10 * a, f + 10 * b]) });
      }
    }
    const xobjects = page.node.Resources()?.lookup(PDFName.of('XObject'));
    return { pictures, lines, xobjects: xobjects?.keys().length ?? 0 };
  });
}

/** Signs on the pad with the mouse: a few loops. */
async function scribble(page) {
  const pad = await page.locator('.pad canvas').boundingBox();
  const at = (u, v) => [pad.x + u * pad.width, pad.y + v * pad.height];
  await page.mouse.move(...at(0.12, 0.62));
  await page.mouse.down();
  for (const [u, v] of [
    [0.2, 0.25],
    [0.27, 0.7],
    [0.36, 0.3],
    [0.45, 0.7],
    [0.55, 0.35],
    [0.66, 0.65],
    [0.85, 0.45],
  ])
    await page.mouse.move(...at(u, v), { steps: 5 });
  await page.mouse.up();
}

/** A placed mark's box as the page shows it, in fractions of the page. */
const boxOf = (locator) => locator.evaluate((el) => ({ x: parseFloat(el.style.left) / 100, y: parseFloat(el.style.top) / 100, w: parseFloat(el.style.width) / 100, h: parseFloat(el.style.height) / 100 }));

const near = (assert, a, b, what, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${what}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);

/** The kept signature in IndexedDB, as its byte count (0: none). */
const keptBytes = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('fundus-sign', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kept');
        req.onsuccess = () => {
          const get = req.result.transaction('kept').objectStore('kept').get('signature');
          get.onsuccess = () => {
            req.result.close();
            resolve(get.result ? get.result.byteLength : 0);
          };
        };
      }),
  );

export default {
  async 'drawn, placed and dragged on page 1: the picture lands there in the PDF'({ open, drop, choose, save, assert, page, shot }) {
    await open('/sign-a-pdf');
    await drop('letter.pdf');
    await choose('Ink', 'Blue');
    await scribble(page);
    const place = page.getByRole('button', { name: 'Signature', exact: true });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await place.click();
    const mark = page.locator('[data-mark]').first();
    await mark.waitFor();
    // Drag it to the top left quarter of the page.
    const sheet = await page.locator('.page').boundingBox();
    const m = await mark.boundingBox();
    await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
    await page.mouse.down();
    await page.mouse.move(sheet.x + sheet.width * 0.3, sheet.y + sheet.height * 0.25, { steps: 8 });
    await page.mouse.up();
    const box = await boxOf(mark);
    near(assert, box.x + box.w / 2, 0.3, 'centre across', 0.02);
    near(assert, box.y + box.h / 2, 0.25, 'centre down', 0.02);
    await page.locator('.page img.sheet-img').waitFor();
    await shot('placed-1280', 1280);
    await shot('placed-390', 390);
    const out = await save();
    assert.equal(out.name, 'letter-signed.pdf');
    const pages = await placements(out.bytes);
    assert.equal(pages.length, 3);
    assert.deepEqual(
      pages.map((p) => p.pictures.length),
      [1, 0, 0],
    );
    const [pic] = pages[0].pictures;
    near(assert, pic.bottomLeft.u, box.x, 'left');
    near(assert, pic.bottomLeft.v, box.y + box.h, 'bottom');
    near(assert, pic.bottomRight.u, box.x + box.w, 'right');
    near(assert, pic.topLeft.v, box.y, 'top');
  },

  async 'on the turned page, typed, with the date and the name: upright as shown'({ open, drop, choose, fill, save, assert, page, shot, bytes }) {
    await open('/sign-a-pdf');
    await drop('letter.pdf');
    await page.getByRole('combobox', { name: 'Page' }).selectOption({ label: 'Page 3 of 3' });
    await choose('Signature', 'Type');
    await fill('Your name', 'Erika Mustermann');
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    await page.getByRole('button', { name: 'Date', exact: true }).click();
    await page.getByRole('button', { name: 'Name', exact: true }).click();
    const marks = page.locator('[data-mark]');
    await marks.nth(2).waitFor();
    const sigBox = await boxOf(marks.nth(0));
    const dateBox = await boxOf(marks.nth(1));
    await page.locator('.page img.sheet-img').waitFor();
    await shot('turned-1280', 1280);
    await shot('turned-390', 390);
    const out = await save();
    const pages = await placements(out.bytes);
    assert.deepEqual(
      pages.map((p) => p.pictures.length),
      [0, 0, 1],
    );
    // The letter's own lines first, as they were; ours after them.
    const own = (await placements(await bytes('letter.pdf')))[2].lines;
    assert.deepEqual(pages[2].lines.slice(0, own.length), own);
    const lines = pages[2].lines.slice(own.length);
    const [pic] = pages[2].pictures;
    near(assert, pic.bottomLeft.u, sigBox.x, 'left on the turned page');
    near(assert, pic.bottomLeft.v, sigBox.y + sigBox.h, 'bottom on the turned page');
    near(assert, pic.bottomRight.v, pic.bottomLeft.v, 'level: its bottom edge runs across', 0.001);
    assert.ok(pic.bottomRight.u > pic.bottomLeft.u, 'and left to right');
    assert.ok(pic.topLeft.v < pic.bottomLeft.v, 'its top is up');
    const today = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date());
    assert.deepEqual(
      lines.map((l) => l.text),
      [today, 'Erika Mustermann'],
    );
    for (const l of lines) {
      assert.ok(l.along.u > l.start.u, `${l.text} runs left to right`);
      near(assert, l.along.v, l.start.v, `${l.text} stays level`, 0.001);
    }
    near(assert, lines[0].start.u, dateBox.x, 'the date starts where its box does');
    assert.ok(lines[0].start.v > dateBox.y && lines[0].start.v < dateBox.y + dateBox.h, 'its baseline is inside its box');
  },

  async 'several signatures on several pages, one picture in the file'({ open, drop, save, assert, page }) {
    await open('/sign-a-pdf');
    await drop('letter.pdf');
    await scribble(page);
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    await page.getByRole('button', { name: 'Page 1: 1' }).waitFor();
    await page.getByRole('button', { name: 'Page 2: 2' }).waitFor();
    const out = await save();
    const pages = await placements(out.bytes);
    assert.deepEqual(
      pages.map((p) => p.pictures.length),
      [1, 2, 0],
    );
    const doc = await PDFDocument.load(out.bytes);
    // A PNG with a clear ground is two images, the colours and their mask: count the ones with a mask.
    const images = doc.context.enumerateIndirectObjects().filter(([, o]) => o.dict?.get(PDFName.of('Subtype'))?.toString() === '/Image' && o.dict.has(PDFName.of('SMask')));
    assert.equal(images.length, 1, 'the same picture, embedded once');
  },

  async 'a finger signs on the pad and drags the signature'({ open, drop, assert, page }) {
    await open('/sign-a-pdf');
    await drop('letter.pdf');
    // Pointer events as a touch screen sends them (the test browser has no touch screen of its own),
    // to whatever is under the first point, a frame apart.
    const touch = (points) =>
      page.evaluate(async (points) => {
        const target = document.elementFromPoint(...points[0]);
        const send = (type, [x, y]) => target.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
        send('pointerdown', points[0]);
        for (const p of points.slice(1)) {
          send('pointermove', p);
          await new Promise((done) => requestAnimationFrame(done));
        }
        send('pointerup', points.at(-1));
      }, points);
    const pad = await page.locator('.pad canvas').boundingBox();
    await touch(
      [
        [0.15, 0.6],
        [0.3, 0.3],
        [0.45, 0.65],
        [0.6, 0.3],
        [0.8, 0.5],
      ].map(([u, v]) => [pad.x + u * pad.width, pad.y + v * pad.height]),
    );
    await page.getByRole('button', { name: 'Undo the last stroke' }).and(page.locator(':not([disabled])')).waitFor();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    const mark = page.locator('[data-mark]').first();
    const before = await boxOf(mark);
    // Down near its top left corner, then the finger goes to a spot up and left on the page: the mark follows.
    const m = await mark.boundingBox();
    const sheet = await page.locator('.page').boundingBox();
    const to = [sheet.x + sheet.width * 0.2, sheet.y + sheet.height * 0.3];
    await touch([
      [m.x + 6, m.y + 6],
      [m.x + 8, m.y + 8],
      [(m.x + 6 + to[0]) / 2, (m.y + 6 + to[1]) / 2],
      to,
    ]);
    const after = await boxOf(mark);
    near(assert, after.x, before.x + (to[0] - m.x - 6) / sheet.width, 'across', 0.005);
    near(assert, after.y, before.y + (to[1] - m.y - 6) / sheet.height, 'down', 0.005);
  },

  async 'moved by keys, resized by its corner, removed'({ open, drop, save, assert, page }) {
    await open('/sign-a-pdf');
    await drop('letter.pdf');
    await scribble(page);
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    const mark = page.locator('[data-mark]').first();
    const before = await boxOf(mark);
    await mark.focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowUp');
    const moved = await boxOf(mark);
    near(assert, moved.x, before.x - 0.05, 'five percent left', 0.001);
    near(assert, moved.y, before.y - 0.05, 'five percent up', 0.001);
    const corner = await page.locator('.corner').boundingBox();
    const sheet = await page.locator('.page').boundingBox();
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x + corner.width / 2 + sheet.width * 0.1, corner.y + corner.height / 2, { steps: 5 });
    await page.mouse.up();
    const grown = await boxOf(mark);
    near(assert, grown.w, moved.w + 0.1, 'ten percent wider', 0.005);
    near(assert, grown.h / grown.w, moved.h / moved.w, 'same shape', 0.001);
    const out = await save();
    const [pic] = (await placements(out.bytes))[0].pictures;
    near(assert, pic.bottomRight.u - pic.bottomLeft.u, grown.w, 'the PDF has the new width');
    // Delete takes it off; with nothing placed there's nothing to save.
    await mark.focus();
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('[data-mark]').count(), 0);
    await page.getByText('Place your signature on a page.').waitFor();
    assert.equal(await page.locator('button.save').isDisabled(), true);
  },

  async 'keeping the signature: off until asked, then only its picture, gone on Forget'({ open, drop, assert, page, fill, choose }) {
    await open('/sign-a-pdf');
    const keepSwitch = page.getByRole('switch', { name: /Keep my signature/ });
    assert.equal(await keepSwitch.getAttribute('aria-checked'), 'false', 'off to start with');
    await scribble(page);
    await choose('Signature', 'Type');
    await fill('Your name', 'Erika Mustermann');
    await choose('Signature', 'Draw');
    await page.waitForTimeout(300);
    assert.equal(await keptBytes(page), 0, 'nothing kept without asking');
    // Keeping it doesn't set the signature making itself again and again: counted by the object
    // URLs made, which stop once it's kept.
    await page.evaluate(() => {
      const made = URL.createObjectURL.bind(URL);
      window.urlsMade = 0;
      URL.createObjectURL = (blob) => (window.urlsMade++, made(blob));
    });
    await keepSwitch.click();
    assert.equal(await keepSwitch.getAttribute('aria-checked'), 'true');
    await page.getByText('Kept on this device.').waitFor();
    await page.waitForTimeout(400);
    const settled = await page.evaluate(() => window.urlsMade);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.urlsMade), settled, 'nothing more made once kept');
    assert.ok((await keptBytes(page)) > 500, 'its picture is kept');
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert.ok(!stored.includes('Erika'), 'the name isn’t stored');
    assert.ok(!/"x":|strokes/.test(stored), 'nor the strokes');
    // Back another day: the kept one is there and goes onto a page.
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByText('Your kept signature').waitFor();
    assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), '');
    await drop('annex.pdf');
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    await page.locator('button.save:not([disabled])').waitFor();
    // Forget.
    await page.getByRole('button', { name: 'Forget it' }).click();
    await page.getByText('Forgotten.').waitFor();
    assert.equal(await keptBytes(page), 0);
    assert.equal(await keepSwitch.getAttribute('aria-checked'), 'false');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.waitForTimeout(300);
    assert.equal(await page.getByText('Your kept signature').count(), 0);
  },

  async 'remembers draw or type and the ink, not the name'({ open, choose, fill, assert, page }) {
    await open('/sign-a-pdf');
    await choose('Signature', 'Type');
    await choose('Ink', 'Blue');
    await fill('Your name', 'Erika Mustermann');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Type' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Your name').inputValue(), '');
  },

  async 'files that aren’t PDFs, are locked, damaged, or can’t be changed: each says so'(t) {
    const { open, drop, sees } = t;
    await samples(t);
    await open('/sign-a-pdf');
    await drop('notes.txt');
    await sees('notes.txt isn’t a PDF.');
    await drop('pdf-locked.pdf');
    await sees('pdf-locked.pdf is locked with a password');
    await drop('pdf-broken.pdf');
    await sees('pdf-broken.pdf is damaged');
    await drop('pdf-nochanges.pdf');
    await sees('pdf-nochanges.pdf is protected against changes');
  },

  async 'empty, then on to the other PDF tools, and fits a phone'({ open, drop, page, shot, fitsPhone }) {
    await open('/sign-a-pdf');
    await shot('empty-390', 390);
    await shot('empty-1280', 1280);
    await drop('letter.pdf');
    await scribble(page);
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Signature')?.disabled);
    await page.getByRole('button', { name: 'Signature', exact: true }).click();
    await page.locator('button.save:not([disabled])').waitFor();
    const next = page.getByRole('navigation', { name: 'Go on with the result' });
    await next.getByRole('link', { name: /Arrange a PDF/ }).waitFor();
    await fitsPhone();
  },
};
