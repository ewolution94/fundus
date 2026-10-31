// F-301 Count words: live counts as you type, emoji and compounds, a dropped .txt, Copy, the home.

const val = (page, label) => page.locator('.line', { has: page.locator('.lab', { hasText: new RegExp(`^${label}$`) }) }).locator('.val');

export default {
  async 'counts as you type, emoji and German compounds right'({ open, fill, page, assert }) {
    await open('/count-words');
    await page.getByText('the counts follow as you type').waitFor();
    assert.equal(await val(page, 'Words').innerText(), '0');
    await fill('Text', 'Hello 👋🏽 world. Die Donaudampfschifffahrt hat eine E-Mail-Adresse!');
    // Hello, world, Die, Donaudampfschifffahrt, hat, eine, E-Mail-Adresse; the emoji is one character.
    assert.equal(await val(page, 'Words').innerText(), '7');
    assert.equal(await val(page, 'Sentences').innerText(), '2');
    assert.equal(await val(page, 'Characters').innerText(), '65');
    assert.equal(await val(page, 'Without spaces').innerText(), '58');
    assert.equal(await val(page, 'Lines').innerText(), '1');
    assert.equal(await val(page, 'Reading time').innerText(), '2 s');
  },

  async 'a dropped .txt is counted'({ open, drop, page, assert, sees }) {
    await open('/count-words');
    await drop('notes.txt');
    await sees('notes.txt opened');
    assert.equal(await val(page, 'Words').innerText(), '23');
    assert.equal(await val(page, 'Paragraphs').innerText(), '2');
    assert.equal(await val(page, 'Lines').innerText(), '6');
    assert.equal(await val(page, 'Sentences').innerText(), '4');
    assert.match(await page.getByLabel('Text', { exact: true }).inputValue(), /^Fundus {2}test notes\./);
  },

  async 'a long text: grouped numbers, minutes, Copy gives the plain number'({ open, page, assert, clipboard, engine, shot }) {
    await open('/count-words');
    const long = Array.from({ length: 1200 }, (_, i) => (i % 12 === 11 ? 'word.\n\n' : 'word')).join(' ');
    await page.getByLabel('Text', { exact: true }).fill(long);
    assert.equal(await val(page, 'Words').innerText(), '1,200');
    assert.equal(await val(page, 'Reading time').innerText(), '5 min 13 s');
    assert.equal(await val(page, 'Speaking time').innerText(), '9 min 14 s');
    await page.locator('.line', { has: page.locator('.lab', { hasText: /^Words$/ }) }).getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), '1200');
    await shot('long', 1280);
    await shot('long-phone', 390);
  },

  async 'not a text file: says so, keeps what was there'({ open, fill, drop, sees, page, assert }) {
    await open('/count-words');
    await fill('Text', 'Keep me');
    await drop('photo.jpg');
    await sees('photo.jpg isn’t a text file.');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), 'Keep me');
    assert.equal(await val(page, 'Words').innerText(), '2');
  },

  async 'text pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Zwei Wörter und noch drei');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Count words/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), 'Zwei Wörter und noch drei');
    assert.equal(await val(page, 'Words').innerText(), '5');
  },

  async 'empty and cleared'({ open, fill, page, assert, shot }) {
    await open('/count-words');
    await shot('empty', 1280);
    await shot('empty-phone', 390);
    await fill('Text', 'Something');
    await page.getByRole('button', { name: 'Clear' }).click();
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    assert.equal(await val(page, 'Words').innerText(), '0');
  },

  async 'fits a phone'({ open, drop, fitsPhone }) {
    await open('/count-words');
    await drop('notes.txt');
    await fitsPhone();
  },
};
