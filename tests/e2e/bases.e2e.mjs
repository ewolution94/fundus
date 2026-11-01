// F-911 Number bases: known values (255, 0xFF, −1, 2^64), a base picked and one more out, the two's
// complement, mistakes named, Copy, what's remembered, a paste on the home, German.

/** A row's value (its first line; the second is its note) in a receipt. */
const val = async (page, receipt, label) =>
  (
    await page
      .getByRole('region', { name: receipt, exact: true })
      .locator('.row')
      .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label}$`) }) })
      .locator('.val')
      .innerText()
  )
    .split('\n')[0]
    .trim();

const sub = (page, receipt, label) =>
  page
    .getByRole('region', { name: receipt, exact: true })
    .locator('.row')
    .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.val small')
    .innerText();

/** Thousands as shown: kept together by a narrow no-break space. */
const n = (s) => s.replace(/(\d) (\d)/g, '$1\u202f$2').replace(/(\d) (\d)/g, '$1\u202f$2');

export default {
  async '255 in every base, the hex under the highlighter'({ open, fill, assert, page, sees }) {
    await open('/number-bases');
    await sees('Type a number');
    await fill('Number', '255');
    await sees('Read as base 10');
    assert.equal(await val(page, 'Bases', 'Binary'), '1111 1111');
    assert.equal(await val(page, 'Bases', 'Octal'), '377');
    assert.equal(await val(page, 'Bases', 'Decimal'), '255');
    assert.equal(await val(page, 'Bases', 'Hex'), 'FF');
    assert.equal(await val(page, 'Bases', 'Base 36'), '73');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Hex');
    assert.equal(await val(page, 'Bits and bytes', 'Bits'), '8');
    assert.equal(await val(page, 'Bits and bytes', 'Big-endian'), 'FF');
  },

  async '0xFF, 0b and 0o read by their prefix; the decimal is the answer'({ open, fill, choose, assert, page, sees }) {
    await open('/number-bases');
    await fill('Number', '0xFF');
    await sees('Read as hex (0x)');
    assert.equal(await val(page, 'Bases', 'Decimal'), '255');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Decimal');
    await choose('Base', '2');
    await fill('Number', '0o17');
    await sees('Read as octal (0o)');
    assert.equal(await val(page, 'Bases', 'Decimal'), '15');
    await fill('Number', '0b1111_0000 1010');
    assert.equal(await val(page, 'Bases', 'Hex'), '0F 0A');
    // A value in hex, read as signed at each width.
    await fill('Number', '0xFFFF');
    assert.match(await sub(page, 'Two’s complement', '16 bits'), new RegExp(n('signed −1 · unsigned 65 535$')));
    assert.match(await sub(page, 'Two’s complement', '32 bits'), new RegExp(n('signed 65 535 · unsigned 65 535$')));
    assert.match(await val(page, 'Two’s complement', '8 bits'), /^Doesn’t fit: 8 bits hold up to 255\.$/);
  },

  async '−1 at 8 bits is 0xFF, at 64 eight of them'({ open, fill, assert, page }) {
    await open('/number-bases');
    await fill('Number', '-1');
    assert.equal(await val(page, 'Two’s complement', '8 bits'), 'FF');
    assert.match(await sub(page, 'Two’s complement', '8 bits'), /^1111 1111 · signed −1 · unsigned 255$/);
    assert.equal(await val(page, 'Two’s complement', '64 bits'), 'FF FF FF FF FF FF FF FF');
    assert.equal(await val(page, 'Bases', 'Hex'), '−01');
    assert.equal(await val(page, 'Bits and bytes', 'Big-endian'), 'FF');
    await fill('Number', '-129');
    assert.equal(await val(page, 'Two’s complement', '8 bits'), 'Doesn’t fit: 8 bits hold −128 to 127.');
    assert.equal(await val(page, 'Two’s complement', '16 bits'), 'FF 7F');
    assert.equal(await val(page, 'Bits and bytes', 'Little-endian'), '7F FF');
  },

  async '2^64 stays exact'({ open, fill, assert, page }) {
    await open('/number-bases');
    await fill('Number', '18446744073709551616');
    assert.equal(await val(page, 'Bases', 'Hex'), '01 00 00 00 00 00 00 00 00');
    assert.equal(await val(page, 'Bases', 'Decimal'), n('18 446 744 073 709 551 616'));
    assert.equal(await val(page, 'Bits and bytes', 'Bits'), '65');
    assert.equal(await val(page, 'Two’s complement', '64 bits'), n('Doesn’t fit: 64 bits hold up to 18 446 744 073 709 551 615.'));
    await fill('Number', '18446744073709551615');
    assert.equal(await val(page, 'Two’s complement', '64 bits'), 'FF FF FF FF FF FF FF FF');
  },

  async 'a base picked, and one more out'({ open, fill, choose, assert, page, sees }) {
    await open('/number-bases');
    await choose('Base', '16');
    await fill('Number', 'ff');
    assert.equal(await val(page, 'Bases', 'Decimal'), '255');
    await choose('Base', 'Other');
    await fill('Base, 2 to 36', '36');
    await fill('Number', 'ZZ');
    await sees('Read as base 36');
    assert.equal(await val(page, 'Bases', 'Decimal'), n('1 295'));
    await fill('One more base, 2 to 36', '7');
    assert.equal(await val(page, 'Bases', 'Base 7'), '3530');
    await fill('One more base, 2 to 36', '99');
    assert.equal(await val(page, 'Bases', 'Base 99'), 'A base from 2 to 36.');
  },

  async 'mistakes are named'({ open, fill, assert, page, sees }) {
    await open('/number-bases');
    await fill('Number', 'ff');
    await sees('“f” at position 1 isn’t a digit in base 10. For hex, start with 0x or pick 16.');
    assert.equal(await page.getByRole('region', { name: 'Bases' }).count(), 0);
    await fill('Number', '12.5');
    await sees('Whole numbers only, no decimal point.');
    await fill('Number', '0x');
    await sees('Digits are missing after 0x.');
    await fill('Number', '0b1021');
    await sees('“2” at position 5 isn’t a digit in base 2.');
  },

  async 'Copy takes the plain digits'({ open, fill, assert, page, clipboard, engine }) {
    await open('/number-bases');
    await fill('Number', '-3054');
    const row = page.getByRole('region', { name: 'Bases', exact: true }).locator('.row').filter({ hasText: 'Binary' });
    await row.getByRole('button', { name: 'Copy' }).click();
    await row.getByRole('button', { name: 'Copied' }).waitFor();
    if (engine === 'chromium') assert.equal(await clipboard(), '-101111101110');
    const twos = page.getByRole('region', { name: 'Two’s complement', exact: true }).locator('.row').filter({ hasText: '16 bits' });
    await twos.getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'F412');
  },

  async 'remembers the bases, never the number'({ open, fill, choose, assert, page }) {
    await open('/number-bases');
    await choose('Base', '16');
    await fill('One more base, 2 to 36', '5');
    await fill('Number', 'c0ffee');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: '16', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('One more base, 2 to 36', { exact: true }).inputValue(), '5');
    assert.equal(await page.getByLabel('Number', { exact: true }).inputValue(), '');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).toLowerCase().includes('c0ffee'));
  },

  async 'a number pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '0xFF');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Number bases/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Number', { exact: true }).inputValue(), '0xFF');
    assert.equal(await val(page, 'Bases', 'Decimal'), '255');
  },

  async 'in German'({ open, fill, assert, page, sees }) {
    await open('/number-bases');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Zahl', '-1');
    assert.equal(await val(page, 'Zweierkomplement', '8 Bit'), 'FF');
    assert.match(await sub(page, 'Zweierkomplement', '8 Bit'), /mit Vorzeichen −1 · ohne 255$/);
    await fill('Zahl', 'g');
    await sees('„g“ an Stelle 1 ist keine Ziffer zur Basis 10.');
  },

  async 'looks'({ open, fill, shot }) {
    await open('/number-bases');
    await shot('empty-390', 390);
    await fill('Number', '-3054');
    await shot('negative-390', 390);
    await shot('negative-1280', 1280);
    await fill('Number', '0xDEAD_BEEF_CAFE_F00D_1234');
    await shot('big-390', 390);
    await shot('big-1280', 1280);
  },

  async 'fits a phone'({ open, fill, fitsPhone }) {
    await open('/number-bases');
    await fill('Number', '9'.repeat(300));
    await fitsPhone();
    await fill('Number', '-0x8000000000000000');
    await fitsPhone();
  },
};
