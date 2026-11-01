// F-909 CSV ↔ JSON: both ways, pasted and from files (shop.csv with its quoted line break, bank.csv
// in Windows-1252 with decimal commas, a .json), the direction found and switched, typed values,
// the shared separator, mistakes with their place, Copy, what's remembered, a paste on the home.

import { writeFile } from 'node:fs/promises';

const out = (page) => page.locator('.out pre').evaluate((el) => el.textContent);
const decode = (bytes) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
/** The option a Seg has on, by its group's label. */
const picked = (page, group) => page.locator(`[role=radiogroup][aria-label="${group}"] [aria-checked=true]`).innerText();
const SEP = 'Columns split by';
const MARK = 'Decimal mark of the numbers';
const ENC = 'Encoding of the file';

const CSV = 'id,name,address.city,address.zip,active,note\n1,Anna,Berlin,01067,true,\n2,"Ben, Jr.",Hamburg,20095,false,"say ""hi"""\n';
const OBJECTS = [
  { id: 1, name: 'Anna', address: { city: 'Berlin', zip: '01067' }, active: true, note: null },
  { id: 2, name: 'Ben, Jr.', address: { city: 'Hamburg', zip: '20095' }, active: false, note: 'say "hi"' },
];

export default {
  async 'CSV pasted: JSON objects, typed by column, dotted headers nested'({ open, fill, assert, page, sees }) {
    await open('/csv-to-json');
    await sees('Paste a CSV or JSON, or open a file');
    await fill('CSV or JSON', CSV);
    assert.equal(await page.getByRole('radio', { name: 'CSV → JSON' }).getAttribute('aria-checked'), 'true');
    assert.equal(await out(page), JSON.stringify(OBJECTS, null, 2));
    await sees('2 objects');
    await sees('Found in the text · 6 columns');
    assert.equal(await picked(page, SEP), 'Comma ,');
    assert.equal(await page.getByRole('radiogroup', { name: ENC }).count(), 0, 'pasted text has no encoding to choose');
  },

  async 'typed values off, and without a header'({ open, fill, check, assert, page }) {
    await open('/csv-to-json');
    await fill('CSV or JSON', 'a,b\n1,\n');
    await check('Typed values', false);
    assert.deepEqual(JSON.parse(await out(page)), [{ a: '1', b: '' }]);
    await check('First row is a header', false);
    assert.deepEqual(JSON.parse(await out(page)), [
      ['a', 'b'],
      ['1', ''],
    ]);
  },

  async 'JSON pasted: a CSV with the shared separator, nested objects dotted'({ open, fill, choose, assert, page, sees }) {
    await open('/csv-to-json');
    await fill('CSV or JSON', JSON.stringify(OBJECTS));
    assert.equal(await page.getByRole('radio', { name: 'JSON → CSV' }).getAttribute('aria-checked'), 'true');
    await choose('Separator', 'Comma ,');
    assert.equal(await out(page), CSV);
    await sees('2 rows · 6 columns');
    await choose('Separator', 'Semicolon ;');
    await sees('Every tool that writes a CSV now uses semicolons');
    assert.equal(await out(page), 'id;name;address.city;address.zip;active;note\n1;Anna;Berlin;01067;true;\n2;Ben, Jr.;Hamburg;20095;false;"say ""hi"""\n');
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:shared'))).csv, 'semicolon');
  },

  async 'shop.csv in: shop.json out, the quoted line break one value'({ open, drop, save, assert }) {
    await open('/csv-to-json');
    await drop('shop.csv');
    const saved = await save();
    assert.equal(saved.name, 'shop.json');
    assert.deepEqual(JSON.parse(decode(saved.bytes)), [
      { order: 1001, product: 'Notebook, A5', price: 4.99, note: 'first line\nsecond line' },
      { order: 1002, product: 'Pen', price: 1.5, note: null },
    ]);
  },

  async 'bank.csv in (Windows-1252, decimal commas): umlauts right, amounts as numbers'({ open, drop, save, assert, sees, page }) {
    await open('/csv-to-json');
    await drop('bank.csv');
    await sees('bank.csv ·');
    await sees('Found in the file · 7 columns');
    assert.equal(await picked(page, SEP), 'Semicolon ;');
    assert.equal(await picked(page, MARK), 'Comma');
    assert.equal(await picked(page, ENC), 'Windows-1252');
    await sees('Numbers with a decimal comma');
    const rows = JSON.parse(decode((await save()).bytes));
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], {
      Buchungstag: '01.10.2026',
      Empfänger: 'Müller Hausverwaltung GmbH',
      Verwendungszweck: 'Miete; Oktober',
      IBAN: 'DE89370400440532013000',
      PLZ: '01067',
      Betrag: -1234.56,
      Währung: 'EUR',
    });
    assert.equal(rows[1].Empfänger, 'Bäckerei Süß');
    assert.equal(rows[2].Betrag, 3456.78);
  },

  async 'a .json file in: a .csv out, no BOM, numbers as written'({ open, drop, choose, save, assert, fixture }) {
    await writeFile(fixture('csvjson-sample.json'), '﻿[{"sku":"A-1","price":1.50,"big":12345678901234567890,"tags":["x","y"],"dim":{"w":2,"h":3}},{"sku":"B, 2","extra":null}]');
    await open('/csv-to-json');
    await drop('csvjson-sample.json');
    await choose('Separator', 'Comma ,');
    const saved = await save();
    assert.equal(saved.name, 'csvjson-sample.csv');
    assert.notEqual(saved.bytes[0], 0xef, 'no BOM: it’s for code');
    assert.equal(decode(saved.bytes), 'sku,price,big,tags,dim.w,dim.h,extra\nA-1,1.50,12345678901234567890,"[""x"",""y""]",2,3,\n"B, 2",,,,,,\n');
  },

  async 'the direction switched by hand, and back when cleared'({ open, fill, choose, assert, page, sees }) {
    await open('/csv-to-json');
    await fill('CSV or JSON', 'a,b\n1,2\n');
    await choose('Direction', 'JSON → CSV');
    await sees('can’t stand here');
    await sees('Line 1, column 1');
    assert.equal(await page.locator('button.save').count(), 0, 'nothing to save from a mistake');
    await choose('Direction', 'CSV → JSON');
    assert.deepEqual(JSON.parse(await out(page)), [{ a: 1, b: 2 }]);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await fill('CSV or JSON', '[[1,2]]');
    assert.equal(await out(page), '1,2\n');
  },

  async 'mistakes, with where they are'({ open, fill, choose, assert, page, sees }) {
    await open('/csv-to-json');
    await fill('CSV or JSON', '[\n  {"a": 1,}\n]');
    await sees('A comma before “}”: JSON allows none after the last item.');
    await sees('Line 2, column 11');
    assert.equal(await page.locator('.error mark').innerText(), '}');
    await fill('CSV or JSON', 'a,b\n1,"two\n3,4\n');
    await sees('A quote here is never closed');
    await sees('Line 2, column 3');
    assert.equal(await page.locator('.error mark').innerText(), '"');
    await fill('CSV or JSON', '42');
    await choose('Direction', 'JSON → CSV');
    await sees('A single value: JSON → CSV wants an array of objects, or of arrays.');
    await fill('CSV or JSON', '[]');
    await sees('An empty array');
  },

  async 'Copy takes the result'({ open, fill, assert, page, clipboard, engine }) {
    await open('/csv-to-json');
    await fill('CSV or JSON', 'a;b\n1;x\n');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    if (engine === 'chromium') assert.equal(await clipboard(), '[\n  {\n    "a": 1,\n    "b": "x"\n  }\n]');
  },

  async 'a wrong separator, decimal mark or encoding put right by hand'({ open, drop, fill, choose, assert, page, sees }) {
    await open('/csv-to-json');
    await drop('shop.csv');
    await choose(SEP, 'Semicolon ;');
    await sees('Your choice · found: Comma · 1 column');
    assert.deepEqual(Object.keys(JSON.parse(await out(page))[0]), ['order,product,price,note']);
    await choose(SEP, 'Comma ,');
    await sees('Found in the file · 4 columns');
    assert.deepEqual(JSON.parse(await out(page))[1], { order: 1002, product: 'Pen', price: 1.5, note: null });
    // The encoding reads the file again.
    await drop('bank.csv');
    await choose(ENC, 'UTF-8');
    await sees('Your choice · found: Windows-1252');
    assert.match(await page.getByLabel('CSV or JSON', { exact: true }).inputValue(), /M\ufffdller/);
    await choose(ENC, 'Windows-1252');
    assert.match(await page.getByLabel('CSV or JSON', { exact: true }).inputValue(), /Müller/);
    // A decimal comma read as a point: 1,5 stays text.
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await fill('CSV or JSON', 'a;b\n1,5;2\n');
    assert.deepEqual(JSON.parse(await out(page)), [{ a: 1.5, b: 2 }]);
    await choose(MARK, 'Point');
    await sees('Your choice · found: Comma');
    assert.deepEqual(JSON.parse(await out(page)), [{ a: '1,5', b: 2 }]);
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('CSV or JSON', 'a;b\n1,5;2\n');
    assert.equal(await picked(page, MARK), 'Comma', 'not kept');
  },

  async 'remembers typed values, never the text'({ open, fill, check, assert, page }) {
    await open('/csv-to-json');
    await check('Typed values', false);
    await fill('CSV or JSON', 'secret,Müller\n1,2\n');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('switch', { name: /Typed values/ }).getAttribute('aria-checked'), 'false');
    assert.equal(await page.getByLabel('CSV or JSON', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('secret') && !stored.includes('Müller'), 'the text is not stored');
  },

  async 'a JSON array pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true, csv: 'comma' })));
    await page.reload();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '[{"a":1,"b":{"c":"x"}}]');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /CSV ↔ JSON/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await out(page), 'a,b.c\n1,x\n');
  },

  async 'in German'({ open, fill, page, sees }) {
    await open('/csv-to-json');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByLabel('CSV oder JSON', { exact: true }).fill('{"a": 1,}');
    await sees('Ein Komma vor „}“');
    await sees('Zeile 1, Spalte 9');
    await page.getByLabel('CSV oder JSON', { exact: true }).fill('a;b\n1;2');
    await sees('Typisierte Werte');
    await sees('1 Objekt');
  },

  async 'looks'({ open, fill, drop, shot }) {
    await open('/csv-to-json');
    await shot('empty-390', 390);
    await drop('bank.csv');
    await shot('csv-390', 390);
    await shot('csv-1280', 1280);
    await open('/csv-to-json');
    await fill('CSV or JSON', JSON.stringify([...OBJECTS, { id: 3, name: 'x'.repeat(200), address: { city: 'https://example.com/'.repeat(5) } }]));
    await shot('json-390', 390);
    await shot('json-1280', 1280);
    await fill('CSV or JSON', '[\n  {"a": 1,}\n]');
    await shot('error-390', 390);
  },

  async 'fits a phone'({ open, fill, drop, fitsPhone }) {
    await open('/csv-to-json');
    await fitsPhone();
    await drop('bank.csv');
    await fitsPhone();
    await open('/csv-to-json');
    await fill('CSV or JSON', `[{"long":"${'y'.repeat(2000)}","b64":"${'QUJD'.repeat(400)}"}]`);
    await fitsPhone();
    await fill('CSV or JSON', `${'h,'.repeat(60)}h\n${'1,'.repeat(60)}"${'z'.repeat(500)}`);
    await fitsPhone();
  },
};

