// F-902 Base64: UTF-8 text both ways, the URL-safe alphabet and padding, mistakes, a file to a
// data: URL, Base64 back to a file (bytes compared), a paste on the home.

import { sniff } from '../../src/lib/files.ts';

const TEXT = 'Grüße aus Köln 👋 ?>';
const B64 = Buffer.from(TEXT).toString('base64');
const out = (page) => page.locator('.out pre').innerText();

export default {
  async 'text to Base64 in UTF-8, URL-safe, without padding'({ open, fill, choose, check, assert, page, sees }) {
    await open('/base64');
    await choose('Direction', 'Text → Base64');
    await sees('Type or paste text: its Base64 follows.');
    await fill('Text', TEXT);
    assert.equal(await out(page), B64);
    assert.match(B64, /[+/]/, 'the sample needs + or / to tell the alphabets apart');
    await sees(`${B64.length} characters · from ${Buffer.byteLength(TEXT)} bytes`);
    await choose('Alphabet', 'URL-safe');
    assert.equal(await out(page), Buffer.from(TEXT).toString('base64url') + '==');
    await check('Pad with =', false);
    assert.equal(await out(page), Buffer.from(TEXT).toString('base64url'));
  },

  async 'Base64 to text, wrapped in lines, either alphabet'({ open, fill, choose, assert, page }) {
    await open('/base64');
    await choose('Direction', 'Base64 → text');
    const long = `${TEXT} `.repeat(6);
    await fill('Base64', Buffer.from(long).toString('base64').replace(/.{76}/g, '$&\n'));
    assert.equal(await out(page), long);
    await fill('Base64', Buffer.from(TEXT).toString('base64url'));
    assert.equal(await out(page), TEXT);
  },

  async 'broken Base64 says what and where'({ open, fill, choose, sees, assert, page }) {
    await open('/base64');
    await choose('Direction', 'Base64 → text');
    await fill('Base64', 'Zm9v*mFy');
    await sees('“*” at position 5 isn’t Base64.');
    await fill('Base64', 'Zm9vY');
    await sees('5 characters can’t be Base64');
    await fill('Base64', 'Zg=x');
    await sees('The = at position 3 is out of place');
    assert.equal(await page.locator('.out').count(), 0);
  },

  async 'a file to a data: URL with its real type, saved and copied'({ open, drop, choose, save, assert, bytes, page, clipboard, engine }) {
    await open('/base64');
    await choose('Direction', 'File → Base64');
    await drop('photo.webp');
    await choose('As', 'data: URL');
    const expected = `data:image/webp;base64,${Buffer.from(await bytes('photo.webp')).toString('base64')}`;
    const saved = await save();
    assert.equal(saved.name, 'photo-dataurl.txt');
    assert.equal(new TextDecoder().decode(saved.bytes), expected);
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), expected);
    // Plain Base64, URL-safe: the saved text follows the options.
    await choose('As', 'Base64');
    await choose('Alphabet', 'URL-safe');
    const plain = await save();
    assert.equal(plain.name, 'photo-base64.txt');
    const webp = await bytes('photo.webp');
    assert.equal(new TextDecoder().decode(plain.bytes), Buffer.from(webp).toString('base64url') + '='.repeat((3 - (webp.length % 3)) % 3));
  },

  async 'Base64 back to a file: same bytes, type from the bytes'({ open, choose, save, assert, bytes, page, sees }) {
    await open('/base64');
    await choose('Direction', 'Base64 → file');
    await sees('the file follows, ready to save');
    const original = await bytes('photo.webp');
    await page.getByLabel('Base64', { exact: true }).fill(Buffer.from(original).toString('base64'));
    await page.locator('.plate img').waitFor();
    await sees('image/webp');
    const saved = await save();
    assert.equal(saved.name, 'decoded.webp');
    assert.equal(sniff(saved.bytes), 'webp');
    assert.ok(Buffer.from(saved.bytes).equals(Buffer.from(original)), 'the saved file is the original, byte for byte');
  },

  async 'a data: URL whose type is wrong: the bytes win'({ open, choose, save, assert, bytes, page, sees }) {
    await open('/base64');
    await choose('Direction', 'Base64 → file');
    const png = await bytes('photo.png');
    await page.getByLabel('Base64', { exact: true }).fill(`data:image/jpeg;base64,${Buffer.from(png).toString('base64')}`);
    await sees('It says image/jpeg, but the bytes are a PNG.');
    const saved = await save();
    assert.equal(saved.name, 'decoded.png');
    assert.equal(saved.bytes.length, png.length);
  },

  async 'decoded bytes that aren’t text: offered as a file'({ open, choose, fill, page, sees, save, assert }) {
    await open('/base64');
    await choose('Direction', 'Base64 → text');
    const pdf = Buffer.from('%PDF-1.7\n\xff\xfe binary\n', 'latin1');
    await fill('Base64', pdf.toString('base64'));
    await sees('aren’t text: they’re a PDF');
    await page.getByRole('button', { name: 'Make it a file' }).click();
    const saved = await save();
    assert.equal(saved.name, 'decoded.pdf');
    assert.ok(Buffer.from(saved.bytes).equals(pdf));
  },

  async 'Base64 pasted on the home opens decoded'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate((b64) => {
      const data = new DataTransfer();
      data.setData('text/plain', b64);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, B64);
    await page.getByRole('link', { name: /Base64/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Base64 → text' }).getAttribute('aria-checked'), 'true');
    assert.equal(await out(page), TEXT);
  },

  async 'remembers the direction and alphabet, never the text'({ open, fill, choose, assert, page }) {
    await open('/base64');
    await choose('Direction', 'Text → Base64');
    await choose('Alphabet', 'URL-safe');
    await fill('Text', 'a secret');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'URL-safe' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('secret'));
  },

  async 'looks'({ open, fill, choose, drop, page, shot, bytes }) {
    await open('/base64');
    await choose('Direction', 'Text → Base64');
    await fill('Text', `${TEXT} `.repeat(12));
    await shot('encode-390', 390);
    await shot('encode-1280', 1280);
    await choose('Direction', 'Base64 → file');
    await page.getByLabel('Base64', { exact: true }).fill(`data:image/jpeg;base64,${Buffer.from(await bytes('photo.webp')).toString('base64')}`);
    await page.locator('.plate img').waitFor();
    await shot('tofile-390', 390);
    await shot('tofile-1280', 1280);
    await choose('Direction', 'File → Base64');
    await drop('mid.jpg');
    await page.locator('.out pre').waitFor();
    await shot('file-390', 390);
    await choose('Direction', 'Base64 → text');
    await fill('Base64', 'Zm9v*mFy');
    await shot('error-390', 390);
  },

  async 'fits a phone'({ open, choose, drop, fill, page, fitsPhone }) {
    await open('/base64');
    await choose('Direction', 'File → Base64');
    await drop('photo.jpg');
    await page.locator('.out pre').waitFor();
    await fitsPhone();
    await choose('Direction', 'Base64 → text');
    await fill('Base64', `${'QUJD'.repeat(300)}*`);
    await fitsPhone();
  },
};
