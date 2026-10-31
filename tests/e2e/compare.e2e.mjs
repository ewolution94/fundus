// F-303 Compare texts: by words and by lines, the marks, ignore case and whitespace, a .txt on each
// side, the unified diff (applied back with jsdiff), side by side and stacked.

import { writeFile } from 'node:fs/promises';
import { applyPatch } from 'diff';

const after = (page) => page.locator('section.pane[data-side="after"]');
const before = (page) => page.locator('section.pane[data-side="before"]');

export default {
  async 'by words: what came is marked, what went is struck through'({ open, fill, page, assert, sees }) {
    await open('/compare-texts');
    await sees('Put a text on each side');
    await fill('Before', 'The quick brown fox jumps over the lazy dog.');
    await sees('Now the other side.');
    await fill('After', 'The slow red fox jumps over the lazy dog!');
    await sees('+2 words added');
    await sees('−2 words removed');
    await sees('in 2 places');
    assert.deepEqual(await after(page).locator('ins').allInnerTexts(), ['slow red', '!']);
    assert.deepEqual(await before(page).locator('del').allInnerTexts(), ['quick brown', '.']);
    assert.equal(await after(page).locator('.diff').innerText(), 'The slow red fox jumps over the lazy dog!');
  },

  async 'by lines, and ignoring case and whitespace'({ open, fill, choose, check, page, assert, sees }) {
    await open('/compare-texts');
    await fill('Before', 'alpha\nbeta\ngamma');
    await fill('After', 'alpha\nBeta\n  gamma\ndelta');
    await choose('Compare', 'By lines');
    await sees('+3 lines added');
    await sees('−2 lines removed');
    await check('Case', true);
    await sees('+2 lines added');
    await check('Whitespace', true);
    await sees('+1 line added');
    assert.deepEqual(await after(page).locator('ins').allInnerTexts(), ['delta']);
    await fill('After', 'ALPHA\nbeta  \ngamma');
    await sees('No differences, with case and whitespace ignored.');
    assert.equal(await page.locator('section.pane').count(), 0);
  },

  async 'a .txt on each side, and Copy gives a unified diff that applies'({ open, drop, fixture, page, assert, sees, clipboard, engine, bytes, shot }) {
    const original = new TextDecoder().decode(await bytes('notes.txt'));
    const edited = original.replace('quick brown fox', 'quick red fox').replace('Zweite Zeile', 'Zweite, neue Zeile').concat('A new last line.\n');
    await writeFile(fixture('compare-notes-v2.txt'), edited);
    await open('/compare-texts');
    await drop('notes.txt', 0);
    await drop('compare-notes-v2.txt', 1);
    await sees('compare-notes-v2.txt opened');
    await sees('+6 words added');
    await sees('−1 word removed');
    if (engine === 'chromium') {
      await page.getByRole('button', { name: 'Copy as a unified diff' }).click();
      const patch = await clipboard();
      assert.match(patch, /^--- notes\.txt\n\+\+\+ compare-notes-v2\.txt\n@@ /);
      assert.equal(applyPatch(original.replace(/\r\n/g, '\n'), patch), edited.replace(/\r\n/g, '\n'));
    }
    await shot('notes', 1280);
    await shot('notes-phone', 390);
  },

  async 'side by side on a computer, one above the other on a phone'({ open, fill, page, assert }) {
    await open('/compare-texts');
    await fill('Before', 'one two three');
    await fill('After', 'one 2 three');
    const a = await before(page).boundingBox();
    const b = await after(page).boundingBox();
    assert.equal(Math.round(a.y), Math.round(b.y), 'side by side');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const c = await before(page).boundingBox();
    const d = await after(page).boundingBox();
    assert.ok(d.y >= c.y + c.height, 'stacked');
  },

  async 'remembers how it compares, not the texts'({ open, fill, choose, page, assert }) {
    await open('/compare-texts');
    await choose('Compare', 'By lines');
    await fill('Before', 'private words');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'By lines' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Before', { exact: true }).inputValue(), '');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('private words'));
  },

  async 'text pasted on the home goes in first'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'The first version of a text');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Compare texts/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Before', { exact: true }).inputValue(), 'The first version of a text');
    assert.equal(await page.getByLabel('After', { exact: true }).inputValue(), '');
  },

  async 'not a text file: says so'({ open, drop, sees }) {
    await open('/compare-texts');
    await drop('letter.pdf', 1);
    await sees('letter.pdf isn’t a text file.');
  },

  async 'fits a phone'({ open, drop, fitsPhone }) {
    await open('/compare-texts');
    await drop('notes.txt', 0);
    await drop('compare-notes-v2.txt', 1);
    await fitsPhone();
  },
};
