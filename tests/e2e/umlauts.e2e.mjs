// F-304 Fix umlauts: the two sample files (UTF-8 with broken letters, and a Windows-1252 file),
// saved as UTF-8 and checked byte for byte; text broken twice; Spell out with file names; Copy; the
// kept mode; text from the home.

const out = (page) => page.locator('pre.out');

export default {
  async 'broken.txt: every broken letter repaired, marked, saved as UTF-8'({ open, drop, save, page, assert, sees, shot }) {
    await open('/fix-umlauts');
    await drop('broken.txt');
    await sees('broken.txt opened');
    await sees('8 places fixed');
    const right = 'Grüße aus Köln, schöne „Anführungszeichen“ und 5 €.';
    assert.equal((await out(page).innerText()).trimEnd(), right);
    assert.deepEqual(await page.locator('pre.out mark').allInnerTexts(), ['üß', 'ö', 'ö', '„', 'ü', '“', '€']);
    // It was read as UTF-8 (its bytes are valid UTF-8, the letters in it are what's broken).
    assert.equal(await page.locator('.enc').innerText(), 'UTF-8');
    const saved = await save();
    assert.equal(saved.name, 'broken-fixed.txt');
    assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(saved.bytes), right + '\n');
    await shot('broken', 1280);
    await shot('broken-phone', 390);
  },

  async 'win1252.txt: read as Windows-1252, saved as UTF-8'({ open, drop, save, page, assert, sees }) {
    await open('/fix-umlauts');
    await drop('win1252.txt');
    await sees('win1252.txt opened');
    assert.equal(await page.locator('.enc').innerText(), 'Windows-1252');
    await sees('saved in the old Windows encoding');
    await sees('Nothing broken inside');
    assert.equal((await out(page).innerText()).trimEnd(), 'Grüße aus Köln, der Preis: 12 €.');
    const saved = await save();
    assert.equal(saved.name, 'win1252-fixed.txt');
    // "Grüße" in UTF-8: ü is C3 BC, ß is C3 9F.
    assert.deepEqual([...saved.bytes.slice(0, 7)], [0x47, 0x72, 0xc3, 0xbc, 0xc3, 0x9f, 0x65]);
    assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(saved.bytes), 'Grüße aus Köln, der Preis: 12 €.\n');
  },

  async 'the bank export in Windows-1252 reads right'({ open, drop, page, assert, sees }) {
    await open('/fix-umlauts');
    await drop('bank.csv');
    await sees('bank.csv opened');
    assert.equal(await page.locator('.enc').innerText(), 'Windows-1252');
    const text = await out(page).innerText();
    assert.ok(text.startsWith('Buchungstag;Empfänger;'), text.slice(0, 40));
    assert.ok(text.includes('Bäckerei Süß;Brötchen'));
  },

  async 'pasted text broken twice, and right letters mixed in'({ open, fill, page, assert, sees }) {
    await open('/fix-umlauts');
    await fill('Text', 'GrÃƒÂ¼ÃƒÅ¸e aus Köln, Ã¢â‚¬Å¾schÃƒÂ¶nÃ¢â‚¬Å“ und Spaß“');
    assert.equal(await out(page).innerText(), 'Grüße aus Köln, „schön“ und Spaß“');
    await sees('Broken 2 times over');
    await sees('5 places fixed');
  },

  async 'Spell out, and safe for file names'({ open, fill, choose, check, save, page, assert, sees, shot }) {
    await open('/fix-umlauts');
    await choose('Mode', 'Spell out');
    await fill('Text', 'Grüße aus KÖLN: Café Straße?');
    assert.equal(await out(page).innerText(), 'Gruesse aus KOELN: Cafe Strasse?');
    await sees('5 letters spelled out');
    await check('Safe for file names', true);
    assert.equal(await out(page).innerText(), 'Gruesse-aus-KOELN-Cafe-Strasse');
    const saved = await save();
    assert.equal(saved.name, 'text-plain.txt');
    assert.equal(new TextDecoder().decode(saved.bytes), 'Gruesse-aus-KOELN-Cafe-Strasse');
    await shot('spell', 1280);
  },

  async 'Copy, and nothing broken'({ open, fill, page, assert, sees, clipboard, engine }) {
    await open('/fix-umlauts');
    await fill('Text', 'KÃ¤se');
    await page.getByRole('button', { name: 'Copy the text' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'Käse');
    await fill('Text', 'Käse und Brötchen');
    await sees('Nothing broken found.');
  },

  async 'remembers the mode, not the text'({ open, fill, choose, page, assert }) {
    await open('/fix-umlauts');
    await choose('Mode', 'Spell out');
    await fill('Text', 'geheimnisvoll');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Spell out' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('geheimnisvoll'), 'the text is never stored');
  },

  async 'broken text pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'SchÃ¶ne GrÃ¼ÃŸe');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Fix umlauts/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.locator('pre.out').innerText(), 'Schöne Grüße');
  },

  async 'a Windows-1252 file dropped on the home opens here, read right'({ open, drop, page, assert, sees }) {
    await open('/');
    await drop('win1252.txt');
    await page.getByRole('link', { name: /Fix umlauts/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await sees('win1252.txt opened');
    assert.equal(await page.locator('.enc').innerText(), 'Windows-1252');
    assert.equal((await page.locator('pre.out').innerText()).trimEnd(), 'Grüße aus Köln, der Preis: 12 €.');
  },

  async 'not a text file: says so'({ open, drop, sees }) {
    await open('/fix-umlauts');
    await drop('photo.png');
    await sees('isn’t a text file');
  },

  async 'in German'({ open, page, sees }) {
    await open('/fix-umlauts');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByLabel('Text', { exact: true }).fill('GrÃ¼ÃŸe');
    await sees('2 Stellen repariert');
  },

  async 'fits a phone'({ open, drop, choose, check, fitsPhone }) {
    await open('/fix-umlauts');
    await drop('broken.txt');
    await fitsPhone();
    await choose('Mode', 'Spell out');
    await check('Safe for file names', true);
    await fitsPhone();
  },
};
