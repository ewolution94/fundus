// F-402 Make a password: strong with its sets and length, look-alikes, memorable in English and
// German (the shared setting), entropy shown, Copy, and nothing of it stored.

import { strongBits, memorableBits, wordsOf } from '../../src/tools/password/password.ts';
import en from '../../src/tools/password/words-en.ts';
import de from '../../src/tools/password/words-de.ts';

const pw = (page) => page.locator('output.pw');
const bitsShown = async (page) => Number((await page.locator('.big b').innerText()).replace(/\D/g, ''));
const ALL = { upper: true, lower: true, digits: true, symbols: true };
/** The runner's check() matches names loosely, and "A–Z" also finds "a–z": these need it exact. */
async function flip(page, label, on) {
  const box = page.getByRole('switch', { name: label, exact: true });
  if ((await box.getAttribute('aria-checked')) !== String(on)) await box.click();
}

export default {
  async 'strong: twenty characters of every kind, its entropy, a new one on demand'({ open, page, assert, shot }) {
    await open('/password');
    const first = await pw(page).innerText();
    assert.equal(first.length, 20);
    assert.ok(/[A-Z]/.test(first) && /[a-z]/.test(first) && /\d/.test(first) && /[^A-Za-z0-9]/.test(first), first);
    assert.equal(await bitsShown(page), Math.floor(strongBits({ length: 20, sets: ALL, avoidLookalikes: false })));
    assert.equal(await page.locator('.big em').innerText(), 'Very strong');
    await page.getByRole('button', { name: 'New password' }).click();
    assert.notEqual(await pw(page).innerText(), first);
    await shot('strong', 1280);
    await shot('strong-phone', 390);
  },

  async 'length, sets and look-alikes'({ open, page, check, assert, sees }) {
    await open('/password');
    await page.getByLabel('Length', { exact: true }).fill('32');
    assert.equal((await pw(page).innerText()).length, 32);
    await page.getByRole('button', { name: 'Shorter' }).click();
    assert.equal((await pw(page).innerText()).length, 31);
    await check('Symbols', false);
    await check('0–9', false);
    await check('Avoid look-alikes', true);
    for (let i = 0; i < 25; i++) {
      const p = await pw(page).innerText();
      assert.match(p, /^[A-Za-z]{31}$/);
      assert.ok(!/[IlO]/.test(p), p);
      await page.getByRole('button', { name: 'New password' }).click();
    }
    assert.equal(await bitsShown(page), Math.floor(strongBits({ length: 31, sets: { upper: true, lower: true, digits: false, symbols: false }, avoidLookalikes: true })));
    await flip(page, 'A–Z', false);
    await flip(page, 'a–z', false);
    await sees('Keep at least one kind of character.');
    assert.equal(await page.getByRole('switch', { name: 'a–z', exact: true }).getAttribute('aria-checked'), 'true');
    await page.getByLabel('Length', { exact: true }).fill('8');
    assert.match(await pw(page).innerText(), /^[a-z]{8}$/);
    assert.equal(await page.locator('.big em').innerText(), 'Weak');
  },

  async 'memorable in English: words from EFF’s list, capitals and a digit'({ open, page, choose, check, assert, shot }) {
    await open('/password');
    await choose('Kind', 'Memorable');
    await choose('Words', '4');
    await choose('Between', '.');
    await check('Capitalise', true);
    await check('Add a digit', true);
    const list = new Set(wordsOf(en));
    for (let i = 0; i < 10; i++) {
      const parts = (await pw(page).innerText()).split('.');
      assert.equal(parts.length, 4);
      assert.equal(parts.filter((p) => /\d$/.test(p)).length, 1);
      for (const p of parts) assert.ok(list.has(p.replace(/\d$/, '').toLowerCase()), p);
      await page.getByRole('button', { name: 'New password' }).click();
    }
    assert.equal(await bitsShown(page), Math.floor(memorableBits({ words: 4, separator: '.', capitalise: true, digit: true }, 7776)));
    await shot('memorable', 1280);
    await shot('memorable-phone', 390);
  },

  async 'German words, through the shared setting'({ open, page, choose, assert, sees }) {
    await open('/password');
    await choose('Kind', 'Memorable');
    await choose('Language', 'German');
    await sees('Memorable passwords now use German words');
    const list = new Set(wordsOf(de));
    await page.waitForFunction(() => /^[a-z-]+(-[a-z-]+){5}$/.test(document.querySelector('output.pw')?.textContent ?? ''));
    // A German list word in every place (the separator is a hyphen; German words have none).
    const parts = (await pw(page).innerText()).split('-');
    assert.equal(parts.length, 6);
    for (const p of parts) assert.ok(list.has(p), p);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:shared')));
    assert.equal(stored.passwordWords, 'de');
  },

  async 'Copy, and nothing of the password is stored'({ open, page, assert, clipboard, engine }) {
    await open('/password');
    const p = await pw(page).innerText();
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), p);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    assert.ok(!stored.includes(p), 'the password is in storage');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.notEqual(await pw(page).innerText(), p, 'a reload draws a new one');
  },

  async 'remembers the options'({ open, page, choose, check, assert }) {
    await open('/password');
    await choose('Kind', 'Memorable');
    await choose('Words', '7');
    await check('Capitalise', true);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Memorable' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: '7' }).getAttribute('aria-checked'), 'true');
    await page.waitForFunction(() => /^[A-Z]/.test(document.querySelector('output.pw')?.textContent ?? ''));
    assert.equal((await pw(page).innerText()).split('-').length, 7);
  },

  async 'fits a phone'({ open, page, fitsPhone }) {
    await open('/password');
    await page.getByLabel('Length', { exact: true }).fill('64');
    await fitsPhone();
  },
};
