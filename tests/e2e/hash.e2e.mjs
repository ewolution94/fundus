// F-906 Hashes: a text's five hashes against node's, a line break like echo, a photo and a 48 MB
// file read in slices (with the progress) against node's crypto, a pasted hash compared in the
// forms people paste, hex/HEX/Base64, Copy, a text pasted on the home, kept choices, German.
import { createHash } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';

const ALGOS = { MD5: 'md5', 'SHA-1': 'sha1', 'SHA-256': 'sha256', 'SHA-384': 'sha384', 'SHA-512': 'sha512' };
const node = (algo, data, enc = 'hex') => createHash(algo).update(data).digest(enc);
const val = (page, label) =>
  page
    .getByRole('region', { name: /^(Hashes)$/ })
    .locator('.row')
    .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.val')
    .innerText();
const all = async (page) => Object.fromEntries(await Promise.all(Object.keys(ALGOS).map(async (k) => [k, await val(page, k)])));

/** A 48 MB file of a fixed pattern, made once. */
function bigFile(fixture) {
  const file = fixture('hash-big.bin');
  const size = 48 * 1024 * 1024 + 123;
  if (!existsSync(file) || statSync(file).size !== size) {
    const b = Buffer.alloc(size);
    let x = 2463534242;
    for (let i = 0; i < size; i += 4) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      b.writeUInt32LE(x >>> 0, i < size - 3 ? i : size - 4);
    }
    writeFileSync(file, b);
  }
  return file;
}

export default {
  async 'a text: all five, as node has them'({ open, fill, assert, page, sees }) {
    await open('/hashes');
    await sees('Type or paste a text');
    const text = 'Grüße aus Köln 👋\nzweite Zeile';
    await fill('Text', text);
    await sees('MD5');
    const got = await all(page);
    for (const [label, algo] of Object.entries(ALGOS)) assert.equal(got[label], node(algo, text), label);
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'SHA-256');
  },

  async 'a line break at the end, like echo'({ open, fill, check, assert, page }) {
    await open('/hashes');
    await fill('Text', 'abc');
    await page.waitForFunction(() => document.querySelector('.digests .val'));
    assert.equal(await val(page, 'SHA-256'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    await check('End with a line break', true);
    await page.waitForFunction(() => !document.querySelector('.digests')?.textContent?.includes('ba7816bf'));
    assert.equal(await val(page, 'SHA-256'), node('sha256', 'abc\n'));
    assert.equal(await val(page, 'MD5'), '0bee89b07a248e27c83fc3d5951213c1');
  },

  async 'hex, HEX and Base64'({ open, fill, choose, assert, page }) {
    await open('/hashes');
    await fill('Text', 'abc');
    await page.waitForFunction(() => document.querySelector('.digests .val'));
    await choose('Format', 'HEX');
    assert.equal(await val(page, 'MD5'), '900150983CD24FB0D6963F7D28E17F72');
    await choose('Format', 'Base64');
    assert.equal(await val(page, 'SHA-256'), node('sha256', 'abc', 'base64'));
    assert.equal(await val(page, 'SHA-512'), node('sha512', 'abc', 'base64'));
  },

  async 'a photo, as node’s crypto has it'({ open, choose, drop, bytes, assert, page, sees }) {
    await open('/hashes');
    await choose('Hash of', 'File');
    await sees('Drop a file: its hashes follow.');
    await drop('photo.jpg');
    await page.locator('.digests .val').first().waitFor();
    const data = await bytes('photo.jpg');
    const got = await all(page);
    for (const [label, algo] of Object.entries(ALGOS)) assert.equal(got[label], node(algo, data), label);
  },

  async 'a 48 MB file in slices, with its progress'({ open, choose, fixture, assert, page }) {
    const file = bigFile(fixture);
    await open('/hashes');
    await choose('Hash of', 'File');
    // Watch the progress line for "Reading".
    await page.evaluate(() => {
      window.__reading = false;
      new MutationObserver(() => {
        if (document.querySelector('.progress')?.textContent?.includes('Reading')) window.__reading = true;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await page.locator('input[type=file]').first().setInputFiles(file);
    await page.locator('.digests .val').first().waitFor({ timeout: 60_000 });
    assert.equal(await page.evaluate(() => window.__reading), true, 'showed its progress');
    const { readFileSync } = await import('node:fs');
    const data = readFileSync(file);
    const got = await all(page);
    for (const [label, algo] of Object.entries(ALGOS)) assert.equal(got[label], node(algo, data), label);
  },

  async 'the expected hash: a match, which one, in the forms people paste'({ open, fill, assert, page, sees }) {
    await open('/hashes');
    await fill('Text', 'abc');
    await page.waitForFunction(() => document.querySelector('.digests .val'));
    const sha256 = node('sha256', 'abc');
    await fill('Expected hash', `${sha256.toUpperCase()}  abc.txt`);
    await sees('Matches: SHA-256.');
    await fill('Expected hash', node('md5', 'abc').match(/../g).join(':'));
    await sees('Matches: MD5.');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'MD5');
    await fill('Expected hash', `sha384-${node('sha384', 'abc', 'base64')}`);
    await sees('Matches: SHA-384. Read as Base64.');
    await fill('Expected hash', `${sha256.slice(0, -1)}0`);
    await sees('Doesn’t match. It’s as long as a SHA-256 hash: this isn’t the same text.');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'SHA-256');
    await fill('Expected hash', 'abcdef0123');
    await sees('10 hex digits: none of these hashes is that long.');
    await fill('Expected hash', 'not a hash!');
    await sees('Not a hash this reads');
  },

  async 'Copy takes the hash as shown'({ open, fill, choose, assert, page, clipboard, engine }) {
    await open('/hashes');
    await fill('Text', 'abc');
    await page.waitForFunction(() => document.querySelector('.digests .val'));
    await choose('Format', 'HEX');
    const row = page.locator('.digests .row').filter({ has: page.locator('.lab', { hasText: /^SHA-1$/ }) });
    await row.getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'A9993E364706816ABA3E25717850C26C9CD0D89D');
  },

  async 'a text pasted on the home opens here with its hashes'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'The quick brown fox jumps over the lazy dog');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Hashes/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await page.locator('.digests .val').first().waitFor();
    assert.equal(await val(page, 'MD5'), '9e107d9d372bb6826bd81d3542a419d6');
    assert.equal(await val(page, 'SHA-1'), '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12');
  },

  async 'remembers the choices, never the text or the hash'({ open, fill, choose, check, assert, page }) {
    await open('/hashes');
    await fill('Text', 'a secret text');
    await choose('Format', 'Base64');
    await check('End with a line break', true);
    await fill('Expected hash', 'deadbeef');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Base64' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: 'End with a line break' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('secret') && !stored.includes('deadbeef'));
  },

  async 'in German'({ open, page, assert, fill }) {
    await open('/hashes');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Text', 'abc');
    await fill('Erwarteter Hash', node('sha1', 'abc'));
    await page.getByText('Stimmt überein: SHA-1.').waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Datei' }).count(), 1);
  },

  async 'looks'({ open, fill, choose, drop, shot, page }) {
    await open('/hashes');
    await shot('empty-390', 390);
    await fill('Text', 'The quick brown fox jumps over the lazy dog');
    await fill('Expected hash', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
    await page.getByText('Matches: SHA-256.').waitFor();
    await shot('text-390', 390);
    await shot('text-1280', 1280);
    await choose('Hash of', 'File');
    await drop('photo.jpg');
    await page.locator('.digests .val').first().waitFor();
    await choose('Format', 'Base64');
    await fill('Expected hash', '0'.repeat(40));
    await shot('file-390', 390);
    await shot('file-1280', 1280);
  },

  async 'fits a phone'({ open, fill, choose, fitsPhone, page }) {
    await open('/hashes');
    await fill('Text', 'x'.repeat(2000));
    await page.locator('.digests .val').first().waitFor();
    await choose('Format', 'HEX');
    await fill('Expected hash', 'f'.repeat(300));
    await fitsPhone();
    await choose('Hash of', 'File');
    await fitsPhone();
  },
};
