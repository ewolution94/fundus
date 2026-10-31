// F-901 Format JSON: typing, the four indents, sorted keys, a mistake named with its place, a file
// in and saved, Copy, what's remembered, a paste on the home.

import { writeFile } from 'node:fs/promises';

const DATA = { name: 'Fundus', tools: [901, 902.5, { deep: [true, false, null], z: 1, a: 'ä€👋' }], empty: {}, none: [] };
const MIN = JSON.stringify(DATA);
const out = (t) => t.text('.out pre');
const settle = (page) => page.waitForTimeout(50);

export default {
  async 'formats as it’s typed: 2 spaces, 4, a tab, minified'({ open, fill, choose, assert, page, text, sees }) {
    await open('/format-json');
    await sees('Paste JSON or open a file');
    await fill('JSON', MIN);
    assert.equal(await out({ text }), JSON.stringify(DATA, null, 2));
    await sees('Valid JSON · an object, 4 keys');
    await choose('Indent', '4 spaces');
    assert.equal(await out({ text }), JSON.stringify(DATA, null, 4));
    await choose('Indent', 'Tab');
    assert.equal(await page.locator('.out pre').evaluate((el) => el.textContent), JSON.stringify(DATA, null, '\t'));
    await choose('Indent', 'Minify');
    await fill('JSON', JSON.stringify(DATA, null, 2));
    assert.equal(await out({ text }), MIN);
    // Sizes, before → after, in UTF-8.
    const before = Buffer.byteLength(JSON.stringify(DATA, null, 2));
    const after = Buffer.byteLength(MIN);
    assert.equal(await text('.big b'), `${after} bytes`);
    assert.equal(await text('.big s'), `${before} bytes`);
    assert.equal(await text('.big em'), `−${Math.round((1 - after / before) * 100)} %`);
  },

  async 'sorts keys at every level, and keeps big numbers as written'({ open, fill, choose, check, assert, text }) {
    await open('/format-json');
    await choose('Indent', 'Minify');
    await check('Sort keys', true);
    await fill('JSON', '{"b": {"z": 1, "a": [{"y": 2, "x": 12345678901234567890}]}, "a": 1.50}');
    assert.equal(await text('.out pre'), '{"a":1.50,"b":{"a":[{"x":12345678901234567890,"y":2}],"z":1}}');
  },

  async 'a mistake: what, where, and the line marked'({ open, fill, assert, page, sees, text }) {
    await open('/format-json');
    await fill('JSON', '{\n  "a": 1,\n  "b": [1, 2],\n}');
    await sees('A comma before “}”: JSON allows none after the last item.');
    await sees('Line 4, column 1');
    assert.equal(await page.locator('.error mark').innerText(), '}');
    assert.equal(await page.locator('button.save').count(), 0, 'nothing to save from broken JSON');
    await fill('JSON', '{"name": \'Fundus\'}');
    await sees('Single quotes');
    await sees('Line 1, column 10');
    await fill('JSON', '[1, 2');
    await sees('the [ from line 1 is never closed');
    // On one long line, only the stretch around it shows.
    await fill('JSON', `[${'1,'.repeat(500)}x]`);
    const shown = await text('.error pre');
    assert.ok(shown.length < 120, shown);
    assert.match(shown, /^1…1,1,.*x\]$/s);
  },

  async 'a .json file in, saved under its name'({ open, drop, save, assert, page, fixture }) {
    await writeFile(fixture('json-sample.json'), `﻿${MIN}`);
    await open('/format-json');
    await drop('json-sample.json');
    await page.getByText('json-sample.json ·').waitFor();
    const saved = await save();
    assert.equal(saved.name, 'json-sample-formatted.json');
    assert.equal(new TextDecoder().decode(saved.bytes), `${JSON.stringify(DATA, null, 2)}\n`);
  },

  async 'with File names on “same”, the name stays'({ open, drop, save, choose, assert, page, fixture }) {
    await writeFile(fixture('json-sample.json'), MIN);
    await open('/format-json');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ names: 'same' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await choose('Indent', 'Minify');
    await drop('json-sample.json');
    const saved = await save();
    assert.equal(saved.name, 'json-sample.json');
    assert.equal(new TextDecoder().decode(saved.bytes), MIN);
  },

  async 'Copy takes the formatted text'({ open, fill, assert, page, clipboard, engine }) {
    await open('/format-json');
    await fill('JSON', MIN);
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    if (engine === 'chromium') assert.equal(await clipboard(), JSON.stringify(DATA, null, 2));
  },

  async 'remembers the indent and the sorting, never the JSON'({ open, fill, choose, check, assert, page }) {
    await open('/format-json');
    await choose('Indent', '4 spaces');
    await check('Sort keys', true);
    await fill('JSON', MIN);
    await settle(page);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: '4 spaces' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /Sort keys/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('JSON', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('Fundus'), 'the JSON is not stored');
  },

  async 'JSON pasted on the home opens here with it'({ open, page, assert, text }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate((json) => {
      const data = new DataTransfer();
      data.setData('text/plain', json);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, MIN);
    await page.getByRole('link', { name: /Format JSON/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('JSON', { exact: true }).inputValue(), MIN);
    assert.equal(await text('.out pre'), JSON.stringify(DATA, null, 2));
  },

  async 'in German'({ open, fill, page, sees }) {
    await open('/format-json');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('JSON', '{"a": undefined}');
    await sees('„undefined“ ist kein JSON');
    await sees('Zeile 1, Spalte 7');
  },

  async 'looks'({ open, fill, page, shot }) {
    await open('/format-json');
    await shot('empty-390', 390);
    await fill('JSON', JSON.stringify({ ...DATA, long: 'x'.repeat(300), url: `https://example.com/${'a'.repeat(120)}` }));
    await shot('valid-390', 390);
    await shot('valid-1280', 1280);
    await fill('JSON', '{\n  "a": 1,\n  "b": [1, 2],\n}');
    await shot('error-390', 390);
    await shot('error-1280', 1280);
    await page.getByRole('radio', { name: 'Tab' }).waitFor();
  },

  async 'fits a phone'({ open, fill, fitsPhone }) {
    await open('/format-json');
    await fill('JSON', JSON.stringify({ long: 'y'.repeat(2000), b64: 'QUJD'.repeat(400) }));
    await fitsPhone();
    await fill('JSON', `{"a": ${'9'.repeat(400)}x}`);
    await fitsPhone();
  },
};
