// F-306 Fancy text: a typed text in all sixteen styles, Copy on a row, umlauts kept on their
// letters, a fancy text from the home made plain again (and restyled from it), nothing stored, and a
// long text that wraps on a phone.

const row = (page, id) => page.locator(`[data-style=${id}] .shown`);

export default {
  async 'type a text: sixteen styles, each with Copy'({ open, fill, page, assert, sees, clipboard, engine, shot }) {
    await open('/fancy-text');
    // Before typing, every row shows a sample in its style, without Copy.
    assert.equal(await page.locator('li.style').count(), 16);
    assert.equal(await page.locator('li.style button').count(), 0);
    assert.equal(await row(page, 'bold').innerText(), '𝐘𝐨𝐮𝐫 𝐭𝐞𝐱𝐭');
    await fill('Text', 'Hello World 2026');
    const want = {
      bold: '𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝 𝟐𝟎𝟐𝟔',
      italic: '𝐻𝑒𝑙𝑙𝑜 𝑊𝑜𝑟𝑙𝑑 2026',
      script: 'ℋℯ𝓁𝓁ℴ 𝒲ℴ𝓇𝓁𝒹 2026',
      fraktur: 'ℌ𝔢𝔩𝔩𝔬 𝔚𝔬𝔯𝔩𝔡 2026',
      double: 'ℍ𝕖𝕝𝕝𝕠 𝕎𝕠𝕣𝕝𝕕 𝟚𝟘𝟚𝟞',
      circled: 'Ⓗⓔⓛⓛⓞ Ⓦⓞⓡⓛⓓ ②⓪②⑥',
      squared: '🅷🅴🅻🅻🅾 🆆🅾🆁🅻🅳 2026',
      smallCaps: 'Hᴇʟʟᴏ Wᴏʀʟᴅ 2026',
      upsideDown: '9ᄅ0ᄅ plɹoM ollǝH',
    };
    for (const [id, text] of Object.entries(want)) assert.equal(await row(page, id).innerText(), text, id);
    assert.equal(await page.locator('li.style').getByRole('button', { name: 'Copy' }).count(), 16);
    // Not fancy, so no plain row.
    assert.equal(await page.locator('[data-style=plain]').count(), 0);
    await page.locator('[data-style=fraktur]').getByRole('button', { name: 'Copy' }).click();
    await sees('Copied');
    if (engine === 'chromium') assert.equal(await clipboard(), 'ℌ𝔢𝔩𝔩𝔬 𝔚𝔬𝔯𝔩𝔡 2026');
    await page.locator('[data-style=struck]').getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'H\u0336e\u0336l\u0336l\u0336o\u0336 \u0336W\u0336o\u0336r\u0336l\u0336d\u0336 \u03362\u03360\u03362\u03366\u0336');
    await shot('styles', 1280);
    await shot('styles-phone', 390);
  },

  async 'umlauts keep their dots, ß stays'({ open, fill, page, assert }) {
    await open('/fancy-text');
    await fill('Text', 'Grüße');
    const bold = await page.locator('[data-style=bold] .shown').textContent();
    assert.equal(bold, '𝐆𝐫𝐮\u0308ß𝐞');
    assert.equal(await page.locator('[data-style=upsideDown] .shown').textContent(), 'ǝßn\u0324ɹ⅁');
  },

  async 'a fancy text from the home: plain again, highlighted, and every style made from it'({ open, page, assert, shot }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '𝓗𝓮𝓵𝓵𝓸 𝓦𝓸𝓻𝓵𝓭');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Fancy text/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '𝓗𝓮𝓵𝓵𝓸 𝓦𝓸𝓻𝓵𝓭');
    // The plain row comes first, under the highlighter.
    assert.equal(await page.locator('li.style').first().getAttribute('data-style'), 'plain');
    assert.equal(await row(page, 'plain').innerText(), 'Hello World');
    const mark = await page.locator('[data-style=plain] .answer').evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(mark, 'rgba(0, 0, 0, 0)');
    assert.equal(await row(page, 'bold').innerText(), '𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝');
    assert.equal(await row(page, 'boldScript').innerText(), '𝓗𝓮𝓵𝓵𝓸 𝓦𝓸𝓻𝓵𝓭');
    await shot('plain', 1280);
  },

  async 'squared and small caps made plain again'({ open, fill, page, assert }) {
    await open('/fancy-text');
    await fill('Text', 'Hᴇʟʟᴏ Wᴏʀʟᴅ');
    assert.equal(await row(page, 'plain').innerText(), 'Hello World');
    await fill('Text', '🅷🅴🅻🅻🅾');
    assert.equal(await row(page, 'plain').innerText(), 'HELLO');
    await fill('Text', 'Hello');
    assert.equal(await page.locator('[data-style=plain]').count(), 0);
  },

  async 'the text is never stored'({ open, fill, page, assert }) {
    await open('/fancy-text');
    await fill('Text', 'geheimnisvoll');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
    assert.ok(!stored.includes('geheimnisvoll'), 'the text is never stored');
  },

  async 'in German'({ open, page, sees }) {
    await open('/fancy-text');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await sees('In 16 Stilen');
    await sees('Kopfüber');
    await page.getByLabel('Text', { exact: true }).fill('𝐇𝐚𝐥𝐥𝐨');
    await sees('Wieder normal');
  },

  async 'fits a phone, with a long text that wraps'({ open, fill, fitsPhone, shot }) {
    await open('/fancy-text');
    await fill('Text', 'Donaudampfschifffahrtsgesellschaftskapitänsmütze '.repeat(3) + 'https://example.com/a/very/long/path/without/any/spaces/in/it');
    await shot('long-phone', 390);
    await fitsPhone();
    await fill('Text', '𝓗𝓮𝓵𝓵𝓸');
    await fitsPhone();
  },
};
