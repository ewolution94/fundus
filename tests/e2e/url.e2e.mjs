// F-903 Encode URLs: a part and a whole link both ways, + as a space, a broken escape named, a URL
// taken apart (odd encodings, punycode, the query decoded, Copy per value), never opened.

const LINK = 'https://J%C3%BCrgen@xn--bcher-kva.de/caf%C3%A9/men%C3%BC?q=caf%C3%A9+au+lait&tag=%F0%9F%91%8B&empty=&flag&q=2#Abschnitt%20%C3%9C';
const out = (page) => page.locator('.out pre').innerText();
const row = (page, label) => page.locator('.parts > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('code');

export default {
  async 'encodes one part, or a whole link'({ open, fill, choose, assert, page, sees }) {
    await open('/encode-urls');
    await choose('Mode', 'Encode');
    await sees('Type or paste text: its encoded form follows.');
    await choose('Scope', 'One part');
    await fill('Text', 'a b&c=d/e?f#g+ä€👋');
    assert.equal(await out(page), encodeURIComponent('a b&c=d/e?f#g+ä€👋'));
    await choose('Scope', 'Whole URL');
    await fill('Text', 'https://x.de/ä b?q=1&r=ü#top');
    assert.equal(await out(page), 'https://x.de/%C3%A4%20b?q=1&r=%C3%BC#top');
  },

  async 'decodes, with + as a space when asked'({ open, fill, choose, check, assert, page }) {
    await open('/encode-urls');
    await choose('Mode', 'Decode');
    await choose('Scope', 'One part');
    await fill('Encoded text', 'caf%C3%A9+au+lait%20%F0%9F%91%8B');
    assert.equal(await out(page), 'café+au+lait 👋');
    await check('+ is a space', true);
    assert.equal(await out(page), 'café au lait 👋');
  },

  async 'a broken escape: which one, and where'({ open, fill, choose, sees, assert, page }) {
    await open('/encode-urls');
    await choose('Mode', 'Decode');
    await fill('Encoded text', 'Gr%C3%BC%C3e');
    await sees('“%C3” at position 9 isn’t UTF-8.');
    await fill('Encoded text', '100% sure');
    await sees('“% s” at position 4 isn’t an escape');
    assert.equal(await page.locator('.out').count(), 0);
  },

  async 'takes a URL apart without opening it'({ open, fill, choose, assert, page, sees, clipboard, engine }) {
    await open('/encode-urls');
    await choose('Mode', 'Take apart');
    await sees('it’s taken apart here, never opened');
    await fill('URL', LINK);
    assert.equal(await row(page, 'Scheme').innerText(), 'https');
    assert.equal(await row(page, 'User').innerText(), 'Jürgen');
    assert.equal(await row(page, 'Host').innerText(), 'xn--bcher-kva.de');
    assert.equal(await row(page, 'As written').innerText(), 'bücher.de');
    assert.equal(await row(page, 'Port').innerText(), '443, the default');
    assert.equal(await row(page, 'Path').innerText(), '/café/menü');
    assert.equal(await row(page, 'Fragment').innerText(), 'Abschnitt Ü');
    const cells = await page.locator('.params tbody tr').evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll('td')].slice(0, 2).map((td) => td.querySelector('code, em')?.textContent)));
    assert.deepEqual(cells, [
      ['q', 'café au lait'],
      ['tag', '👋'],
      ['empty', 'empty'],
      ['flag', 'empty'],
      ['q', '2'],
    ]);
    // Copy per value takes the decoded value.
    await page.locator('.params tbody tr').nth(0).getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'café au lait');
    assert.match(page.url(), /\/encode-urls$/, 'still here');
    assert.equal(await page.locator('main a[href*="bcher"]').count(), 0, 'no link to it');
  },

  async 'no scheme: read as https, and says so; nonsense says so'({ open, fill, choose, page, sees, assert }) {
    await open('/encode-urls');
    await choose('Mode', 'Take apart');
    await fill('URL', 'example.com:8080/a?b=c');
    await sees('No scheme: read as https://');
    assert.equal(await row(page, 'Port').innerText(), '8080');
    await fill('URL', 'http://exa mple.com/');
    await sees('This isn’t a URL the browser can read');
  },

  async 'a link pasted on the home opens taken apart'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate((link) => {
      const data = new DataTransfer();
      data.setData('text/plain', link);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, LINK);
    await page.getByRole('link', { name: /Encode URLs/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Take apart' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('URL', { exact: true }).inputValue(), LINK);
    assert.equal(await row(page, 'As written').innerText(), 'bücher.de');
  },

  async 'remembers the mode and scope, never the text'({ open, fill, choose, assert, page }) {
    await open('/encode-urls');
    await choose('Mode', 'Decode');
    await choose('Scope', 'Whole URL');
    await fill('Encoded text', 'a%20secret');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Decode' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'Whole URL' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Encoded text', { exact: true }).inputValue(), '');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('secret'));
  },

  async 'looks'({ open, fill, choose, shot }) {
    await open('/encode-urls');
    await choose('Mode', 'Take apart');
    await fill('URL', `${LINK.replace('#', `&token=${'x'.repeat(120)}#`)}`);
    await shot('parts-390', 390);
    await shot('parts-1280', 1280);
    await choose('Mode', 'Encode');
    await choose('Scope', 'One part');
    await shot('encode-390', 390);
    await shot('encode-1280', 1280);
  },

  async 'fits a phone'({ open, fill, choose, fitsPhone }) {
    await open('/encode-urls');
    await choose('Mode', 'Take apart');
    await fill('URL', `https://example.com/${'a'.repeat(300)}?${'k'.repeat(200)}=${'%C3%A4'.repeat(100)}#${'f'.repeat(200)}`);
    await fitsPhone();
    await choose('Mode', 'Encode');
    await fitsPhone();
  },
};
