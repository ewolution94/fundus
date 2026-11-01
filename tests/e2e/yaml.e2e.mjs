// F-910 YAML ↔ JSON: config.yaml both ways (two documents, a comment), the direction found and
// turned round, a mistake with its line and column, Save under the file's name, Copy, a paste on
// the home, German.

import { writeFile } from 'node:fs/promises';

const CONFIG_JSON = JSON.stringify(
  [
    { name: 'fundus', port: 4330, tools: ['shrink', 'percent'], owner: { name: 'Anna Müller', since: '2026-10-31' } },
    { second: 'document' },
  ],
  null,
  2,
);

const CONFIG_BACK = ['- name: fundus', '  port: 4330', '  tools:', '    - shrink', '    - percent', '  owner:', '    name: Anna Müller', '    since: "2026-10-31"', '- second: document'].join('\n');

const out = (page) => page.locator('.out pre').evaluate((el) => el.textContent);
const checked = (page, name) => page.getByRole('radio', { name, exact: true }).getAttribute('aria-checked');

export default {
  async 'config.yaml to JSON: two documents, a comment, saved as config.json'({ open, drop, save, assert, page, sees }) {
    await open('/yaml-to-json');
    await sees('Paste YAML or JSON');
    await drop('config.yaml');
    await page.getByText('config.yaml ·').waitFor();
    assert.equal(await checked(page, 'YAML → JSON'), 'true');
    assert.equal(await out(page), CONFIG_JSON);
    await sees('Converted · 2 documents');
    await sees('2 documents: they’re one list in the JSON.');
    await sees('1 comment left out: JSON has no comments.');
    const saved = await save();
    assert.equal(saved.name, 'config.json');
    assert.equal(new TextDecoder().decode(saved.bytes), `${CONFIG_JSON}\n`);
  },

  async 'and back: the JSON pasted turns the direction round'({ open, fill, save, assert, page }) {
    await open('/yaml-to-json');
    await fill('YAML', CONFIG_JSON);
    assert.equal(await checked(page, 'JSON → YAML'), 'true');
    assert.equal(await out(page), CONFIG_BACK);
    const saved = await save();
    assert.equal(saved.name, 'data.yaml');
    assert.equal(new TextDecoder().decode(saved.bytes), `${CONFIG_BACK}\n`);
    // Key order kept, number-like keys and all.
    await fill('JSON', '{"b": 1, "2": "two", "a": {"no": "no"}}');
    assert.equal(await out(page), 'b: 1\n"2": two\na:\n  "no": "no"');
  },

  async 'the switch turns it round, and typing doesn’t turn it back'({ open, fill, choose, assert, page }) {
    await open('/yaml-to-json');
    await fill('YAML', '{"a": [1, 2]}');
    assert.equal(await out(page), 'a:\n  - 1\n  - 2');
    await choose('Direction', 'YAML → JSON');
    assert.equal(await out(page), '{\n  "a": [\n    1,\n    2\n  ]\n}');
    await fill('YAML', '{"b": true}');
    assert.equal(await checked(page, 'YAML → JSON'), 'true');
    assert.equal(await out(page), '{\n  "b": true\n}');
  },

  async 'a mistake: what, where, and the line marked'({ open, fill, assert, page, sees }) {
    await open('/yaml-to-json');
    await fill('YAML', 'name: fundus\nowner:\n\tname: Anna');
    await sees('A tab as indentation: YAML wants spaces.');
    await sees('Line 3, column 1');
    assert.equal(await page.locator('.error mark').innerText(), '⇥');
    assert.equal(await page.locator('button.save').count(), 0, 'nothing to save from broken YAML');
    await fill('YAML', 'name: a\nport: 1\nname: b');
    await sees('The key “name” is already in this map.');
    await sees('Line 3, column 1');
    await fill('YAML', 'a: 1\nb: [1, 2\nc: 3');
    await page.locator('.error .where').waitFor();
    await fill('YAML', '{"a": 1');
    await sees('A } is missing at the end.');
    await sees('Line 1, column 8');
  },

  async 'with File names on “same”, a JSON file keeps its name'({ open, drop, save, choose, assert, page, fixture }) {
    await writeFile(fixture('yaml-sample.json'), '{"a": 1}');
    await open('/yaml-to-json');
    await drop('yaml-sample.json');
    await page.getByText('yaml-sample.json ·').waitFor();
    assert.equal(await checked(page, 'JSON → YAML'), 'true');
    await choose('Direction', 'YAML → JSON');
    assert.equal((await save()).name, 'yaml-sample-converted.json');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ names: 'same' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop('yaml-sample.json');
    await page.getByText('yaml-sample.json ·').waitFor();
    await choose('Direction', 'YAML → JSON');
    assert.equal((await save()).name, 'yaml-sample.json');
  },

  async 'Copy takes the result; nothing is kept'({ open, fill, assert, page, clipboard, engine }) {
    await open('/yaml-to-json');
    await fill('YAML', 'secret: fundus-yaml-42');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    if (engine === 'chromium') assert.equal(await clipboard(), '{\n  "secret": "fundus-yaml-42"\n}');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('YAML', { exact: true }).inputValue(), '');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('fundus-yaml-42'));
  },

  async 'YAML pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'name: fundus\nport: 4330\ntools:\n  - shrink');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /YAML ↔ JSON/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('YAML', { exact: true }).inputValue(), 'name: fundus\nport: 4330\ntools:\n  - shrink');
    assert.equal(await out(page), '{\n  "name": "fundus",\n  "port": 4330,\n  "tools": [\n    "shrink"\n  ]\n}');
  },

  async 'in German'({ open, fill, page, sees }) {
    await open('/yaml-to-json');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('YAML', 'a:\n\tb: 1');
    await sees('Ein Tab als Einrückung: YAML will Leerzeichen.');
    await sees('Zeile 2, Spalte 1');
    await fill('YAML', '# eins\na: 1\n# zwei');
    await sees('2 Kommentare weggelassen');
  },

  async 'looks'({ open, drop, fill, page, shot }) {
    await open('/yaml-to-json');
    await shot('empty-390', 390);
    await drop('config.yaml');
    await page.getByText('config.yaml ·').waitFor();
    await shot('config-390', 390);
    await shot('config-1280', 1280);
    await fill('YAML', 'name: fundus\nowner:\n\tname: Anna');
    await shot('error-390', 390);
    await shot('error-1280', 1280);
  },

  async 'fits a phone'({ open, fill, fitsPhone }) {
    await open('/yaml-to-json');
    await fill('YAML', `long: ${'x'.repeat(2000)}\nurl: https://example.com/${'a'.repeat(300)}`);
    await fitsPhone();
    await fill('YAML', `a: "${'y'.repeat(400)}`);
    await fitsPhone();
  },
};
