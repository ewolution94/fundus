// F-201 Arrange a PDF, with letter.pdf (3 pages, the last turned 90°), annex.pdf (2 pages) and the
// samples PDF to photos' tests make. Every output is read back with pdf-lib: which page is where
// (each sample page says its name, "Letter 2", in its content), its turn and its size.

import { unzipSync } from 'fflate';
import { PDFDocument, PDFArray, PDFName, decodePDFRawStream } from 'pdf-lib';
import { samples } from './pdfimg.e2e.mjs';

/** Each page of a PDF: the first line of text on it, its /Rotate, its size, and whether it holds a picture. */
export async function facts(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
    const text = streams.map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
    const strings = [...text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1], 'hex').toString('latin1'));
    const xobjects = page.node.Resources()?.lookup(PDFName.of('XObject'));
    return { label: strings[0], rotation: page.getRotation().angle, width: page.getWidth(), height: page.getHeight(), pictures: xobjects?.keys().length ?? 0 };
  });
}

const labels = async (bytes) => (await facts(bytes)).map((f) => f.label);
const cards = (page) => page.locator('.board [role=option]');

/** Waits until the board holds `n` cards and Save is ready. */
async function ready(page, n) {
  await page.waitForFunction((count) => document.querySelectorAll('.board [role=option]').length === count, n);
  await page.locator('button.save:not([disabled])').waitFor();
}

export default {
  async 'two PDFs merge in order into one, keeping each page as it is'({ open, drop, save, assert, page, shot }) {
    await open('/arrange-a-pdf');
    await drop(['letter.pdf', 'annex.pdf']);
    await ready(page, 5);
    const out = await save();
    assert.equal(out.name, 'letter-arranged.pdf');
    const f = await facts(out.bytes);
    assert.deepEqual(
      f.map((p) => p.label),
      ['Letter 1', 'Letter 2', 'Letter 3', 'Annex 1', 'Annex 2'],
    );
    assert.deepEqual(
      f.map((p) => p.rotation),
      [0, 0, 90, 0, 0],
    );
    for (const p of f) {
      assert.deepEqual([p.width, p.height], [595, 842]);
      assert.equal(p.pictures, 0, 'text stays text: nothing drawn as a picture');
    }
    await page.locator('.board img').nth(4).waitFor();
    await shot('merged-1280', 1280);
    await shot('merged-390', 390);
  },

  async 'a page dragged with the mouse lands where it’s dropped'({ open, drop, save, assert, page, shot }) {
    await open('/arrange-a-pdf');
    await drop(['letter.pdf', 'annex.pdf']);
    await ready(page, 5);
    const a = await cards(page).nth(0).boundingBox();
    const c = await cards(page).nth(2).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 3 });
    await page.mouse.move(c.x + c.width * 0.8, c.y + c.height / 2, { steps: 8 });
    await page.locator('.drop').waitFor();
    await shot('dragging-1280', 1280);
    await page.mouse.up();
    await ready(page, 5);
    assert.equal(await page.locator('.board [aria-selected=true]').count(), 0, 'a drag isn’t a tap');
    const out = await save();
    assert.deepEqual(await labels(out.bytes), ['Letter 2', 'Letter 3', 'Letter 1', 'Annex 1', 'Annex 2']);
  },

  async 'a finger drags a page by its grip'({ open, drop, save, assert, page }) {
    await open('/arrange-a-pdf');
    await drop(['letter.pdf', 'annex.pdf']);
    await ready(page, 5);
    // Pointer events as a touch screen sends them (the test browser has no touch screen of its own).
    const grip = await cards(page).nth(4).locator('.grip').boundingBox();
    const first = await cards(page).nth(0).boundingBox();
    await page.evaluate(
      ([from, to]) => {
        const at = (type, x, y, target) => (target ?? document.elementFromPoint(x, y)).dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
        const grip = document.elementFromPoint(from.x, from.y);
        at('pointerdown', from.x, from.y, grip);
        for (let k = 1; k <= 6; k++) at('pointermove', from.x + ((to.x - from.x) * k) / 6, from.y + ((to.y - from.y) * k) / 6, grip);
        at('pointerup', to.x, to.y, grip);
      },
      [
        { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
        { x: first.x + 8, y: first.y + first.height / 2 },
      ],
    );
    await ready(page, 5);
    const out = await save();
    assert.deepEqual(await labels(out.bytes), ['Annex 2', 'Letter 1', 'Letter 2', 'Letter 3', 'Annex 1']);
  },

  async 'without dragging: select, move, turn, delete and undo by buttons and keys'({ open, drop, save, assert, page }) {
    await open('/arrange-a-pdf');
    await drop(['letter.pdf', 'annex.pdf']);
    await ready(page, 5);
    // Buttons: Letter 3 one earlier, then turned right (its own 90° + 90°).
    await cards(page).nth(2).click();
    await page.getByRole('button', { name: 'Move earlier' }).click();
    await page.getByRole('button', { name: 'Turn right' }).click();
    // A second tap lets it go.
    await cards(page).nth(1).click();
    assert.equal(await page.locator('.board [aria-selected=true]').count(), 0);
    // Keys: Annex 2 (the last) to the front, turned left twice.
    await cards(page).nth(4).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Alt+ArrowLeft');
    await page.keyboard.press('Shift+R');
    await page.keyboard.press('Shift+R');
    // And Annex 1 (now the last) deleted, then brought back with Undo, then deleted for good.
    await page.keyboard.press('End');
    await page.keyboard.press('Delete');
    await ready(page, 4);
    await page.keyboard.press('ControlOrMeta+z');
    await ready(page, 5);
    await page.keyboard.press('End');
    await page.keyboard.press('Delete');
    await ready(page, 4);
    const out = await save();
    const f = await facts(out.bytes);
    assert.deepEqual(
      f.map((p) => [p.label, p.rotation]),
      [
        ['Annex 2', 180],
        ['Letter 1', 0],
        ['Letter 3', 180],
        ['Letter 2', 0],
      ],
    );
  },

  async 'deleted pages come back with the toast’s Undo'({ open, drop, assert, page, sees }) {
    await open('/arrange-a-pdf');
    await drop('letter.pdf');
    await ready(page, 3);
    await cards(page).nth(1).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await ready(page, 2);
    await sees('1 page deleted');
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
    await ready(page, 3);
    assert.equal(await cards(page).nth(1).getAttribute('aria-label'), 'Page 2: letter.pdf, page 2');
  },

  async 'split: the selected pages as their own PDF'({ open, drop, choose, save, assert, page, shot }) {
    await open('/arrange-a-pdf');
    await drop('letter.pdf');
    await ready(page, 3);
    await choose('Save as', 'Selected pages');
    await page.getByText('Select the pages to save on the board.').waitFor();
    await cards(page).nth(1).click();
    await cards(page).nth(2).click({ modifiers: ['Shift'] });
    await page.locator('.board img').nth(2).waitFor();
    await shot('selected-1280', 1280);
    await shot('selected-390', 390);
    const out = await save();
    assert.equal(out.name, 'letter-p2-3.pdf');
    const f = await facts(out.bytes);
    assert.deepEqual(
      f.map((p) => [p.label, p.rotation]),
      [
        ['Letter 2', 0],
        ['Letter 3', 90],
      ],
    );
    // The PDF goes on to the other PDF tools.
    const next = page.getByRole('navigation', { name: 'Go on with the result' });
    await next.getByRole('link', { name: /Sign a PDF/ }).waitFor();
    await next.getByRole('link', { name: /PDF to photos/ }).click();
    await page.waitForSelector('main[data-tool="pdfimg"][data-ready]');
    await page.getByText('letter-p2-3.pdf').waitFor();
  },

  async 'split: every page its own PDF, five in one ZIP'({ open, drop, choose, save, assert, page }) {
    await open('/arrange-a-pdf');
    await drop(['letter.pdf', 'annex.pdf']);
    await choose('Save as', 'Each page');
    await ready(page, 5);
    const out = await save();
    assert.equal(out.name, 'letter-pages.zip');
    const files = unzipSync(out.bytes);
    assert.deepEqual(Object.keys(files).sort(), ['letter-p1.pdf', 'letter-p2.pdf', 'letter-p3.pdf', 'letter-p4.pdf', 'letter-p5.pdf']);
    const third = await facts(files['letter-p3.pdf']);
    assert.deepEqual(third.map((p) => [p.label, p.rotation]), [['Letter 3', 90]]);
    assert.deepEqual((await facts(files['letter-p5.pdf'])).map((p) => p.label), ['Annex 2']);
    // The way it saves is kept.
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Each page' }).getAttribute('aria-checked'), 'true');
  },

  async 'a 40-page PDF: thumbnails come as they’re scrolled to'(t) {
    const { open, drop, save, assert, page } = t;
    await samples(t);
    await page.setViewportSize({ width: 390, height: 844 });
    await open('/arrange-a-pdf');
    await drop('pdf-long.pdf');
    await ready(page, 40);
    await page.locator('.board img').nth(5).waitFor();
    await page.waitForTimeout(1500);
    const before = await page.locator('.board img').count();
    assert.ok(before < 40, `all ${before} drawn before they were needed`);
    await cards(page).nth(39).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.board img').length === 40, null, { timeout: 20_000 });
    const out = await save();
    assert.equal((await labels(out.bytes)).length, 40);
    assert.equal((await labels(out.bytes))[39], 'Long 40');
  },

  async 'files that aren’t PDFs, are locked, or can’t be changed: each says so'(t) {
    const { open, drop, sees, page, assert } = t;
    await samples(t);
    await open('/arrange-a-pdf');
    await drop(['notes.txt', 'pdf-locked.pdf', 'pdf-broken.pdf', 'pdf-nochanges.pdf']);
    await sees('notes.txt isn’t a PDF.');
    await sees('pdf-locked.pdf is locked with a password');
    await sees('pdf-broken.pdf is damaged');
    await sees('pdf-nochanges.pdf is protected against changes');
    assert.equal(await cards(page).count(), 0);
    // A good one still goes in beside them.
    await drop(['annex.pdf', 'pdf-locked.pdf']);
    await ready(page, 2);
    await sees('pdf-locked.pdf is locked with a password');
  },

  async 'taking a file off takes its pages'({ open, drop, assert, page, save }) {
    await open('/arrange-a-pdf');
    await drop(['letter.pdf', 'annex.pdf']);
    await ready(page, 5);
    await page.getByRole('button', { name: 'Remove: letter.pdf' }).click();
    await ready(page, 2);
    const out = await save();
    assert.equal(out.name, 'annex-arranged.pdf');
    assert.deepEqual(await labels(out.bytes), ['Annex 1', 'Annex 2']);
  },

  async 'empty, and fits a phone'({ open, drop, page, shot, fitsPhone }) {
    await open('/arrange-a-pdf');
    await shot('empty-390', 390);
    await drop(['letter.pdf', 'annex.pdf']);
    await ready(page, 5);
    await cards(page).nth(1).click();
    await fitsPhone();
  },
};
