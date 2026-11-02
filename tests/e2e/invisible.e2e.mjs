// F-307 Invisible characters: the sample file with five hidden characters and a look-alike letter
// (counted, listed, marked in place, cleaned to the exact text, copied), a pasted text with a
// Cyrillic letter, no-break spaces and the kept switch, emoji left alone, text from the home.

const CLEAN = 'IBAN DE89 3704 0044 0532 0130 00, Vertrag, 10:00 AM, ok, Paypal\n';

export default {
  async 'hidden.txt: what hides, counted, marked and cleaned'({ open, drop, page, assert, sees, clipboard, engine, shot }) {
    await open('/invisible-characters');
    await drop('hidden.txt');
    await sees('hidden.txt opened');
    await sees('5 hidden characters, 1 look-alike letter');
    const rows = await page.locator('.kinds li').allInnerTexts();
    const flat = rows.map((r) => r.replace(/\s+/g, ' ').trim());
    assert.equal(flat.length, 6);
    const expect = [
      ['ZWSP', 'Zero-width space', 'U+200B', 'Removed'],
      ['SHY', 'Soft hyphen', 'U+00AD', 'Removed'],
      ['NNBSP', 'Narrow no-break space', 'U+202F', '→ space'],
      ['RLM', 'Right-to-left mark', 'U+200F', 'Removed'],
      ['BOM', 'Byte-order mark', 'U+FEFF', 'Removed'],
      ['Cyrillic \u0430', 'U+0430', '→ a'],
    ];
    expect.forEach((parts, i) => {
      assert.ok(flat[i].startsWith('1 '), flat[i]);
      for (const part of parts) assert.ok(flat[i].toUpperCase().includes(part.toUpperCase()), `${flat[i]} has ${part}`);
    });
    // Marked in place, in the order they come.
    const badges = await page.locator('pre.shown .badge').allInnerTexts();
    assert.deepEqual(badges.map((b) => b.toUpperCase()), ['ZWSP', 'SHY', 'NNBSP', 'RLM', 'BOM', 'CYRILLIC']);
    assert.equal(await page.locator('pre.shown .look .letter').innerText(), '\u0430');
    // The clean text, to the character.
    assert.equal(await page.locator('pre.out').textContent(), CLEAN);
    await page.getByRole('button', { name: 'Copy the text' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), CLEAN);
    await shot('hidden', 1280);
    await shot('hidden-phone', 390);
  },

  async 'a pasted text with a Cyrillic letter: found, named, replaced'({ open, fill, page, assert, sees }) {
    await open('/invisible-characters');
    await fill('Text', 'Login: \u0430dmin@example.com, P\u0430ssword reset');
    await sees('2 look-alike letters');
    assert.equal(await page.locator('.sum').innerText(), '2 look-alike letters');
    assert.deepEqual(await page.locator('pre.shown .look .letter').allInnerTexts(), ['\u0430', '\u0430']);
    assert.equal(await page.locator('pre.out').textContent(), 'Login: admin@example.com, Password reset');
    // A plain text has nothing to say.
    await fill('Text', 'Login: admin@example.com');
    await sees('Nothing hidden');
    await sees('Nothing to clean');
    assert.equal(await page.locator('.kinds').count(), 0);
  },

  async 'no-break spaces: fine, unless switched on; the switch is kept, the text is not'({ open, fill, check, page, assert, sees }) {
    await open('/invisible-characters');
    await fill('Text', 'Preis: 5\u00a0€');
    await sees('Nothing hidden');
    await sees('1 more is fine where it is.');
    assert.ok((await page.locator('.kinds li').innerText()).includes('Fine: on purpose'));
    await check('No-break spaces too', true);
    await sees('1 hidden character');
    assert.equal(await page.locator('pre.out').textContent(), 'Preis: 5 €');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('switch', { name: /No-break spaces too/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('Preis'), 'the text is never stored');
  },

  async 'emoji keep their joiners and selectors'({ open, fill, page, assert, sees }) {
    await open('/invisible-characters');
    const emoji = 'I \u2764\ufe0f it \u{1f469}\u200d\u{1f4bb}';
    await fill('Text', emoji);
    await sees('Nothing hidden');
    await sees('2 more are fine where they are.');
    await sees('Nothing to clean');
    assert.equal(await page.locator('pre.shown .badge').count(), 0);
    // A zero-width space after the emoji still shows.
    await fill('Text', emoji + '\u200b');
    await sees('1 hidden character');
    assert.equal(await page.locator('pre.out').textContent(), emoji);
  },

  async 'a text pasted on the home opens here with it'({ open, page, sees }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'DE89\u200b3704\u200b0044');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Invisible characters/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await sees('2 hidden characters');
  },

  async 'in German'({ open, drop, page, sees }) {
    await open('/invisible-characters');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop('hidden.txt');
    await sees('5 versteckte Zeichen, 1 Doppelgänger-Buchstabe');
    await sees('Schmales geschütztes Leerzeichen');
    await sees('Kyrillisches');
  },

  async 'fits a phone'({ open, drop, fill, fitsPhone, shot }) {
    await open('/invisible-characters');
    await drop('hidden.txt');
    await fitsPhone();
    // A long line without spaces, full of findings, wraps.
    await fill('Text', 'https://example.com/' + 'a\u200bb\u00adc\u202e'.repeat(40) + '\u{e0068}\u{e0069}'.repeat(20));
    await shot('long-phone', 390);
    await fitsPhone();
  },
};
