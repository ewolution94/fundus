// F-305 CSV & Excel, with a German bank's export (bank.csv: Windows-1252, semicolons, decimal
// commas, the postcode 01067, IBANs, "Miete; Oktober", CRLF), a shop's (shop.csv: UTF-8, commas, a
// quoted line break) and an Excel file (sheet.xlsx). The saved files are read back: the .xlsx with
// read-excel-file, the CSV byte for byte.

import { writeFile } from 'node:fs/promises';
import { readSheet } from 'read-excel-file/node';
import { unzipSync, strFromU8 } from 'fflate';

const xlsx = async (bytes) => readSheet(Buffer.from(bytes));
// The BOM stays in the text, so the tests see it.
const decode = (bytes) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString();
const typeOf = (page, name) => page.getByLabel(`Type of ${name}`, { exact: true }).inputValue();
/** The option a Seg has on, by its group's label. */
const picked = (page, group) => page.locator(`[role=radiogroup][aria-label="${group}"] [aria-checked=true]`).innerText();
/** The note under a Seg: what was found, or that someone chose. */
const noteOf = (page, group) => page.locator('dd', { has: page.locator(`[role=radiogroup][aria-label="${group}"]`) }).locator('.note').innerText();
const SEP = 'Columns split by';
const MARK = 'Decimal mark of the numbers';
const ENC = 'Encoding of the file';

export default {
  async 'a bank export, found by itself: Windows-1252, semicolons, a decimal comma, a header'({ open, drop, assert, page, sees, text }) {
    await open('/csv-and-excel');
    await sees('Drop a file or paste rows');
    await drop('bank.csv');
    await sees('3 rows · 7 columns');
    assert.equal(await picked(page, SEP), 'Semicolon ;');
    assert.equal(await picked(page, MARK), 'Comma');
    assert.equal(await picked(page, ENC), 'Windows-1252');
    await sees('Like 1.234,56');
    assert.equal(await noteOf(page, SEP), 'Found in the file');
    assert.equal(await noteOf(page, MARK), 'Like 1.234,56 · Found in the file');
    assert.equal(await noteOf(page, ENC), 'Found in the file');
    assert.equal(await page.getByRole('switch', { name: /First row is a header/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await typeOf(page, 'Buchungstag'), 'date');
    assert.equal(await typeOf(page, 'PLZ'), 'text');
    assert.equal(await typeOf(page, 'IBAN'), 'text');
    assert.equal(await typeOf(page, 'Betrag'), 'number');
    // Umlauts read right, and the quoted semicolon is one cell.
    await sees('Müller Hausverwaltung GmbH');
    await sees('Bäckerei Süß');
    assert.equal(await page.locator('tbody tr').first().locator('td').nth(2).innerText(), 'Miete; Oktober');
    assert.equal(await page.locator('tbody tr').count(), 3);
    assert.equal(await page.locator('tbody th').first().innerText(), '2', 'rows count as in Excel: the header is row 1');
  },

  async 'saved as Excel: PLZ stays the text 01067, Betrag a number, the date a date, the header bold'({ open, drop, save, assert }) {
    await open('/csv-and-excel');
    await drop('bank.csv');
    const out = await save();
    assert.equal(out.name, 'bank.xlsx');
    const rows = await xlsx(out.bytes);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0], ['Buchungstag', 'Empfänger', 'Verwendungszweck', 'IBAN', 'PLZ', 'Betrag', 'Währung']);
    const [day, name, purpose, iban, plz, amount, currency] = rows[1];
    assert.ok(day instanceof Date, `a date: ${day}`);
    assert.equal(day.toISOString(), utc(2026, 10, 1));
    assert.equal(name, 'Müller Hausverwaltung GmbH');
    assert.equal(purpose, 'Miete; Oktober');
    assert.equal(iban, 'DE89370400440532013000');
    assert.equal(plz, '01067');
    assert.equal(amount, -1234.56);
    assert.equal(currency, 'EUR');
    assert.equal(rows[2][5], -4.8);
    assert.equal(rows[3][5], 3456.78);
    assert.equal(rows[2][1], 'Bäckerei Süß');
    // The header in bold, the amounts with two decimals, the dates as dd.mm.yyyy, the header row frozen.
    const files = unzipSync(out.bytes);
    const styles = strFromU8(files['xl/styles.xml']);
    assert.match(styles, /<b\s*\/>/);
    assert.match(styles, /formatCode="#,##0\.00"/);
    assert.match(styles, /formatCode="dd\.mm\.yyyy"/);
    assert.match(strFromU8(files['xl/worksheets/sheet1.xml']), /<pane [^>]*state="frozen"/);
  },

  async 'saved as a CSV for German Excel: a BOM, semicolons, decimal commas, CRLF'({ open, drop, choose, save, assert, page, sees }) {
    await open('/csv-and-excel');
    await drop('bank.csv');
    await choose('Format', 'CSV .csv');
    await choose('Separator', 'Semicolon ;');
    await sees('Every tool that writes a CSV now uses semicolons');
    await sees('With a decimal comma, for Excel in German');
    await sees('Excel still drops a leading 0');
    const out = await save();
    assert.equal(out.name, 'bank-excel.csv');
    assert.deepEqual([...out.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 with a BOM');
    const body = decode(out.bytes.subarray(3));
    assert.equal(
      body,
      [
        'Buchungstag;Empfänger;Verwendungszweck;IBAN;PLZ;Betrag;Währung',
        '01.10.2026;Müller Hausverwaltung GmbH;"Miete; Oktober";DE89370400440532013000;01067;-1234,56;EUR',
        '02.10.2026;Bäckerei Süß;Brötchen;DE02120300000000202051;80331;-4,80;EUR',
        '15.10.2026;Arbeitgeber AG;Gehalt Oktober;DE44500105175407324931;20095;3456,78;EUR',
      ].join('\r\n') + '\r\n',
    );
    assert.ok(!/[^\r]\n/.test(body), 'every line ends in CRLF');
    // The setting is shared: it's what every tool that writes a CSV now uses.
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:shared'))).csv, 'semicolon');
  },

  async 'with a comma: a decimal point and ISO dates'({ open, drop, choose, save, assert }) {
    await open('/csv-and-excel');
    await drop('bank.csv');
    await choose('Format', 'CSV .csv');
    await choose('Separator', 'Comma ,');
    const lines = decode((await save()).bytes).replace(/^﻿/, '').split('\r\n');
    assert.equal(lines[1], '2026-10-01,Müller Hausverwaltung GmbH,Miete; Oktober,DE89370400440532013000,01067,-1234.56,EUR');
    assert.equal(lines[2], '2026-10-02,Bäckerei Süß,Brötchen,DE02120300000000202051,80331,-4.80,EUR');
  },

  async 'a shop export in UTF-8: a quoted comma and a quoted line break stay one cell'({ open, drop, choose, save, assert, sees, page }) {
    await open('/csv-and-excel');
    await drop('shop.csv');
    await sees('2 rows · 4 columns');
    assert.equal(await picked(page, ENC), 'UTF-8');
    assert.equal(await picked(page, MARK), 'Point');
    await sees('Like 1,234.56');
    assert.equal(await page.locator('tbody tr').count(), 2);
    const out = await save();
    assert.equal(out.name, 'shop.xlsx');
    const rows = await xlsx(out.bytes);
    assert.deepEqual(rows[0], ['order', 'product', 'price', 'note']);
    assert.deepEqual(rows[1], [1001, 'Notebook, A5', 4.99, 'first line\nsecond line']);
    assert.deepEqual(rows[2].slice(0, 3), [1002, 'Pen', 1.5]);
    await choose('Format', 'CSV .csv');
    await choose('Separator', 'Semicolon ;');
    const csv = decode((await save()).bytes);
    assert.equal(csv, '﻿order;product;price;note\r\n1001;Notebook, A5;4,99;"first line\nsecond line"\r\n1002;Pen;1,5;\r\n');
  },

  async 'an Excel file goes out as a CSV: 01067 kept, numbers and dates for the separator'({ open, drop, choose, save, assert, sees, page }) {
    await open('/csv-and-excel');
    await drop('sheet.xlsx');
    await sees('Excel workbook');
    await sees('2 rows · 4 columns');
    assert.equal(await page.getByRole('radio', { name: 'CSV .csv' }).getAttribute('aria-checked'), 'true', 'an .xlsx in: a CSV out');
    assert.equal(await typeOf(page, 'PLZ'), 'text');
    assert.equal(await typeOf(page, 'Betrag'), 'number');
    assert.equal(await typeOf(page, 'Datum'), 'date');
    await choose('Separator', 'Comma ,');
    let out = await save();
    assert.equal(out.name, 'sheet.csv');
    assert.equal(decode(out.bytes), '﻿Name,PLZ,Betrag,Datum\r\nAnna,01067,12.5,2026-10-01\r\nBen,80331,-4.8,2026-10-02\r\n');
    await choose('Separator', 'Semicolon ;');
    out = await save();
    assert.equal(decode(out.bytes), '﻿Name;PLZ;Betrag;Datum\r\nAnna;01067;12,5;01.10.2026\r\nBen;80331;-4,8;02.10.2026\r\n');
    // And back to Excel, the same cells.
    await choose('Format', 'Excel .xlsx');
    out = await save();
    assert.equal(out.name, 'sheet-excel.xlsx');
    const rows = await xlsx(out.bytes);
    assert.deepEqual(rows[1].slice(0, 3), ['Anna', '01067', 12.5]);
    assert.equal(rows[1][3].toISOString(), utc(2026, 10, 1));
  },

  async 'a column’s type changed in its head'({ open, drop, save, assert, page }) {
    await open('/csv-and-excel');
    await drop('bank.csv');
    await page.getByLabel('Type of Betrag', { exact: true }).selectOption('text');
    await page.getByLabel('Type of PLZ', { exact: true }).selectOption('number');
    await page.getByLabel('Type of Buchungstag', { exact: true }).selectOption('text');
    const rows = await xlsx((await save()).bytes);
    assert.equal(rows[1][5], '-1.234,56', 'Betrag as written');
    assert.equal(rows[1][4], 1067, 'PLZ as a number, since someone asked');
    assert.equal(rows[1][0], '01.10.2026');
  },

  async 'without a header: letters head the columns, row 1 is data'({ open, drop, check, save, assert, page }) {
    await open('/csv-and-excel');
    await drop('shop.csv');
    await check('First row is a header', false);
    assert.equal(await page.locator('thead .name').first().innerText(), 'A');
    assert.equal(await page.locator('tbody tr').count(), 3);
    assert.equal(await page.locator('tbody th').first().innerText(), '1');
    const rows = await xlsx((await save()).bytes);
    assert.deepEqual(rows[0], ['order', 'product', 'price', 'note']);
    const files = unzipSync((await save()).bytes);
    assert.doesNotMatch(strFromU8(files['xl/worksheets/sheet1.xml']), /state="frozen"/, 'no header row to freeze');
  },

  async 'pasted rows from a spreadsheet: tabs and decimal commas'({ open, fill, save, assert, sees, page }) {
    await open('/csv-and-excel');
    await fill('Paste rows', 'Name\tBetrag\tPLZ\nAnna\t12,50\t01067\nBen\t-3,10\t80331');
    await sees('Found in the rows');
    assert.equal(await picked(page, SEP), 'Tab');
    assert.equal(await picked(page, MARK), 'Comma');
    assert.equal(await page.getByRole('radiogroup', { name: ENC }).count(), 0, 'pasted rows have no encoding to choose');
    assert.equal(await page.locator('input[type=file]').count(), 0, 'the drop well steps aside');
    const out = await save();
    assert.equal(out.name, 'table.xlsx');
    const rows = await xlsx(out.bytes);
    assert.deepEqual(rows, [
      ['Name', 'Betrag', 'PLZ'],
      ['Anna', 12.5, '01067'],
      ['Ben', -3.1, '80331'],
    ]);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await sees('Drop a file or paste rows');
  },

  async 'short rows are filled and said; an unclosed quote is said'({ open, fill, save, assert, sees }) {
    await open('/csv-and-excel');
    await fill('Paste rows', 'a;b;c\n1;2;3\n4\n5;6\n');
    await sees('2 rows were short (3, 4): filled with empty cells.');
    const rows = await xlsx((await save()).bytes);
    assert.deepEqual(rows[2], [4, null, null]);
    await fill('Paste rows', 'a,b\n1,"two\n3,4\n');
    await sees('A quote on line 2, column 3 is never closed');
  },

  async 'more than 50 rows: the first 50 shown, all saved'({ open, fill, choose, save, assert, page, sees }) {
    await open('/csv-and-excel');
    const rows = Array.from({ length: 120 }, (_, i) => `${i + 1},Item ${i + 1},${(i * 1.25).toFixed(2)}`);
    await fill('Paste rows', `id,name,price\n${rows.join('\n')}`);
    await sees('The first 50 of 120 rows. Save takes all of them.');
    assert.equal(await page.locator('tbody tr').count(), 50);
    await choose('Format', 'CSV .csv');
    await choose('Separator', 'Comma ,');
    const lines = decode((await save()).bytes).split('\r\n');
    assert.equal(lines.length, 122, 'the header, 120 rows and the last line break');
    assert.equal(lines[120], '120,Item 120,148.75');
  },

  async 'an old .xls is named, not read; a photo isn’t a table'({ open, drop, sees, assert, page, fixture }) {
    await writeFile(fixture('csv-old.xls'), Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(504).fill(0)]));
    await open('/csv-and-excel');
    await drop('csv-old.xls');
    await sees('Old .xls files: save it as .xlsx in Excel first.');
    assert.equal(await page.locator('table').count(), 0);
    await drop('photo.png');
    await sees('photo.png isn’t a table this tool can read.');
  },

  async 'a wrong separator put right by hand, and back to the one found'({ open, drop, choose, save, assert, page, sees }) {
    await open('/csv-and-excel');
    await drop('shop.csv');
    await sees('2 rows · 4 columns');
    await choose(SEP, 'Semicolon ;');
    await sees('3 rows · 1 column');
    assert.equal(await noteOf(page, SEP), 'Your choice · found: Comma');
    let rows = await xlsx((await save()).bytes);
    assert.deepEqual(rows[0], ['order,product,price,note']);
    await choose(SEP, 'Comma ,');
    await sees('2 rows · 4 columns');
    assert.equal(await noteOf(page, SEP), 'Found in the file');
    rows = await xlsx((await save()).bytes);
    assert.deepEqual(rows[1], [1001, 'Notebook, A5', 4.99, 'first line\nsecond line']);
  },

  async 'a wrong decimal mark put right: 1.500 is one and a half, not fifteen hundred'({ open, fill, choose, save, assert, page, sees }) {
    await open('/csv-and-excel');
    await fill('Paste rows', 'name;price\nA;1.500\nB;2.000');
    assert.equal(await picked(page, MARK), 'Comma', 'semicolons and no decimals: a German file, a guess');
    await sees('A guess: no decimals in it');
    let rows = await xlsx((await save()).bytes);
    assert.deepEqual(rows.slice(1), [
      ['A', 1500],
      ['B', 2000],
    ]);
    await choose(MARK, 'Point');
    await sees('Your choice · found: Comma');
    await sees('Like 1,234.56');
    rows = await xlsx((await save()).bytes);
    assert.deepEqual(rows.slice(1), [
      ['A', 1.5],
      ['B', 2],
    ]);
  },

  async 'a wrong encoding put right, and none of it kept'({ open, drop, choose, assert, page, sees, fixture }) {
    await writeFile(fixture('csv-utf8-umlauts.csv'), 'Name;Ort\nMüller;Köln\n');
    await open('/csv-and-excel');
    await drop('bank.csv');
    await sees('Müller Hausverwaltung GmbH');
    await choose(ENC, 'UTF-8');
    await sees('M\ufffdller Hausverwaltung GmbH');
    await sees('Your choice · found: Windows-1252');
    await choose(ENC, 'Windows-1252');
    await sees('Müller Hausverwaltung GmbH');
    // A UTF-8 file read as Windows-1252 shows what that does.
    await page.getByRole('button', { name: /bank\.csv$/ }).click();
    await drop('csv-utf8-umlauts.csv');
    assert.equal(await picked(page, ENC), 'UTF-8');
    await choose(ENC, 'Windows-1252');
    await sees('MÃ¼ller');
    await choose(SEP, 'Comma ,');
    await choose(MARK, 'Point');
    // Another file starts on what's found in it again, and so does the page after a reload.
    await page.getByRole('button', { name: /csv-utf8-umlauts\.csv$/ }).click();
    await drop('bank.csv');
    assert.equal(await picked(page, ENC), 'Windows-1252');
    assert.equal(await picked(page, SEP), 'Semicolon ;');
    assert.equal(await picked(page, MARK), 'Comma');
    await choose(SEP, 'Pipe |');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop('shop.csv');
    assert.equal(await picked(page, SEP), 'Comma ,');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!/pipe|\|/i.test(stored), `the choice is not stored: ${stored}`);
  },

  async 'remembers the format, never the table'({ open, drop, choose, assert, page }) {
    await open('/csv-and-excel');
    await drop('bank.csv');
    await choose('Format', 'CSV .csv');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByLabel('Paste rows', { exact: true }).fill('a;b\n1;2');
    assert.equal(await page.getByRole('radio', { name: 'CSV .csv' }).getAttribute('aria-checked'), 'true');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('Müller') && !stored.includes('Buchungstag'), 'the table is not stored');
  },

  async 'rows pasted on the home open here with them'({ open, page, assert, sees }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Name;Betrag;Datum\nAnna;12,50;01.10.2026\nBen;-3,10;02.10.2026');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /CSV & Excel/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await sees('2 rows · 3 columns');
    assert.equal(await typeOf(page, 'Datum'), 'date');
    assert.equal(await typeOf(page, 'Betrag'), 'number');
  },

  async 'in German'({ open, drop, page, sees, assert }) {
    await open('/csv-and-excel');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop('bank.csv');
    await sees('Erkannt');
    await sees('In der Datei erkannt');
    assert.equal(await picked(page, 'Spalten getrennt durch'), 'Semikolon ;');
    assert.equal(await picked(page, 'Dezimalzeichen der Zahlen'), 'Komma');
    await sees('3 Zeilen · 7 Spalten');
    await sees('Erste Zeile ist die Kopfzeile');
    assert.equal(await page.getByLabel('Typ von Betrag', { exact: true }).inputValue(), 'number');
    await page.getByRole('radio', { name: 'CSV .csv' }).click();
    await sees('für jedes Werkzeug, das CSV schreibt');
  },

  async 'looks'({ open, drop, fill, choose, shot }) {
    await open('/csv-and-excel');
    await shot('empty-390', 390);
    await shot('empty-1280', 1280);
    await drop('bank.csv');
    await shot('bank-390', 390);
    await shot('bank-1280', 1280);
    await choose('Format', 'CSV .csv');
    await shot('bank-csv-1280', 1280);
    await open('/csv-and-excel');
    await drop('sheet.xlsx');
    await shot('xlsx-390', 390);
    await open('/csv-and-excel');
    await fill('Paste rows', 'Name\tBetrag\tPLZ\nAnna\t12,50\t01067\nBen\t-3,10\t80331');
    await shot('pasted-390', 390);
  },

  async 'fits a phone'({ open, drop, choose, fill, fitsPhone }) {
    await open('/csv-and-excel');
    await fitsPhone();
    await drop('bank.csv');
    await fitsPhone();
    await choose('Format', 'CSV .csv');
    await fitsPhone();
    await open('/csv-and-excel');
    await fill('Paste rows', `${'very-long-header-name;'.repeat(12)}\n${'x'.repeat(400)};${'1,5;'.repeat(11)}`);
    await fitsPhone();
  },
};
