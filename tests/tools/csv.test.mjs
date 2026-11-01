import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromCsv, fromSheet, guessHeader, guessTypes, guessType, toDate, formatDate, convert, toXlsx, toCsvRows, excelWrecks, isOldXls, isZip } from '../../src/tools/csv/csv.ts';

const BANK = [
  'Buchungstag;Empfänger;Verwendungszweck;IBAN;PLZ;Betrag;Währung',
  '01.10.2026;Müller Hausverwaltung GmbH;"Miete; Oktober";DE89370400440532013000;01067;-1.234,56;EUR',
  '02.10.2026;Bäckerei Süß;Brötchen;DE02120300000000202051;80331;-4,80;EUR',
  '15.10.2026;Arbeitgeber AG;Gehalt Oktober;DE44500105175407324931;20095;3.456,78;EUR',
].join('\r\n') + '\r\n';
const SHOP = 'order,product,price,note\n1001,"Notebook, A5",4.99,"first line\nsecond line"\n1002,Pen,1.5,\n';
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

test('a bank export: semicolons, a decimal comma, a header, and each column’s type', () => {
  const t = fromCsv(BANK);
  assert.equal(t.sep, ';');
  assert.equal(t.mark, 'comma');
  assert.equal(t.sure, true);
  assert.equal(t.columns, 7);
  assert.equal(t.rows.length, 4);
  assert.deepEqual(t.short, []);
  assert.equal(t.rows[1][2], 'Miete; Oktober');
  assert.equal(guessHeader(t, t.mark), true);
  assert.deepEqual(guessTypes(t, true, t.mark), ['date', 'text', 'text', 'text', 'text', 'number', 'text']);
});

test('a shop export: commas, a point, a line break kept in its cell', () => {
  const t = fromCsv(SHOP);
  assert.equal(t.sep, ',');
  assert.equal(t.mark, 'point');
  assert.equal(t.rows[1][3], 'first line\nsecond line');
  assert.deepEqual(guessTypes(t, true, t.mark), ['number', 'text', 'number', 'text']);
});

test('short rows are padded and listed; a .tsv’s tab is a hint', () => {
  const t = fromCsv('a;b;c\n1;2;3\n4\n5;6\n');
  assert.deepEqual(t.rows, [['a', 'b', 'c'], ['1', '2', '3'], ['4', '', ''], ['5', '6', '']]);
  assert.deepEqual(t.short, [2, 3]);
  assert.equal(fromCsv('one\ntwo\n', { hint: '\t' }).sep, '\t');
});

test('Text whenever Excel would wreck it; Number and Date only when every cell is one', () => {
  assert.equal(guessType(['01067', '80331'], 'comma', false), 'text', 'a postcode with a leading 0');
  assert.equal(guessType(['1234567890123456'], 'point', false), 'text', '16 digits');
  assert.equal(guessType(['DE89370400440532013000'], 'comma', false), 'text', 'an IBAN');
  assert.equal(guessType(['+4930123456'], 'point', false), 'text', 'a phone number');
  assert.equal(guessType(['-1.234,56', '', '3,5'], 'comma', false), 'number', 'empty cells don’t count');
  assert.equal(guessType(['4.99', '1.5'], 'comma', false), 'text', 'points in a comma file');
  assert.equal(guessType(['01.10.2026', '2.10.26', '2026-10-03'], 'comma', false), 'date');
  assert.equal(guessType(['01.10.2026', '12'], 'comma', false), 'text', 'dates and numbers mixed');
  assert.equal(guessType(['31.02.2026'], 'comma', false), 'text', 'no such day');
  assert.equal(guessType(['', ''], 'comma', false), 'text', 'an empty column');
});

test('dates: dd.mm.yyyy, d.m.yy, yyyy-mm-dd, at midnight UTC', () => {
  assert.deepEqual(toDate('01.10.2026'), utc(2026, 10, 1));
  assert.deepEqual(toDate('1.2.26'), utc(2026, 2, 1));
  assert.deepEqual(toDate('1.2.95'), utc(1995, 2, 1), 'Excel’s two-digit years: 30 and up are 1900s');
  assert.deepEqual(toDate('2026-10-01'), utc(2026, 10, 1));
  assert.deepEqual(toDate('29.02.2024'), utc(2024, 2, 29));
  for (const s of ['29.02.2026', '32.01.2026', '01.13.2026', '0.1.2026', '2026-1-1', '10/01/2026', '01.10.', '']) assert.equal(toDate(s), null, s);
  assert.equal(formatDate(utc(2026, 10, 1), 'dmy'), '01.10.2026');
  assert.equal(formatDate(utc(2026, 10, 1), 'iso'), '2026-10-01');
  assert.equal(formatDate(new Date(Date.UTC(2026, 9, 1, 9, 5)), 'iso'), '2026-10-01 09:05');
  assert.equal(formatDate(new Date(Date.UTC(2026, 9, 1, 9, 5, 7)), 'dmy'), '01.10.2026 09:05:07');
});

test('a header: names only, with rows under them', () => {
  const t = (rows) => ({ rows, columns: rows[0]?.length ?? 0, short: [], typed: false });
  assert.equal(guessHeader(t([['name', 'city'], ['Anna', 'Berlin']]), 'point'), true);
  assert.equal(guessHeader(t([['1', '2'], ['3', '4']]), 'point'), false, 'numbers in the first row');
  assert.equal(guessHeader(t([['2026', 'name'], ['3', 'x']]), 'point'), false, 'a year as a name: no');
  assert.equal(guessHeader(t([['01.10.2026', 'Miete'], ['02.10.2026', 'Brot']]), 'comma'), false, 'a date');
  assert.equal(guessHeader(t([['name', 'city']]), 'point'), false, 'one row only');
  assert.equal(guessHeader(t([['', ''], ['a', 'b']]), 'point'), false, 'an empty first row');
});

test('the CSV for German Excel: semicolons, decimal commas kept digit for digit, dd.mm.yyyy', () => {
  const t = fromCsv(BANK);
  const types = guessTypes(t, true, t.mark);
  const rows = toCsvRows(t, true, types, t.mark, ';');
  assert.deepEqual(rows[0], t.rows[0], 'the header as it was');
  assert.deepEqual(rows[1], ['01.10.2026', 'Müller Hausverwaltung GmbH', 'Miete; Oktober', 'DE89370400440532013000', '01067', '-1234,56', 'EUR']);
  assert.equal(rows[2][5], '-4,80');
  // For English Excel: commas, a decimal point, ISO dates.
  const en = toCsvRows(t, true, types, t.mark, ',');
  assert.deepEqual(en[1].slice(0, 1).concat(en[1].slice(4, 6)), ['2026-10-01', '01067', '-1234.56']);
  assert.equal(en[3][5], '3456.78');
  // Betrag as Text: exactly as it was.
  assert.equal(toCsvRows(t, true, types.with(5, 'text'), t.mark, ',')[1][5], '-1.234,56');
});

test('Excel cells: numbers, dates, text marked as text, the header bold, money with two decimals', () => {
  const t = fromCsv(BANK);
  const types = guessTypes(t, true, t.mark);
  const x = toXlsx(t, true, types, t.mark);
  assert.deepEqual(x.data[0][0], { value: 'Buchungstag', type: String, fontWeight: 'bold' });
  assert.deepEqual(x.data[1][0], { value: utc(2026, 10, 1), type: Date, format: 'dd.mm.yyyy' });
  assert.deepEqual(x.data[1][2], { value: 'Miete; Oktober', type: String, format: '@' });
  assert.deepEqual(x.data[1][4], { value: '01067', type: String, format: '@' });
  assert.deepEqual(x.data[1][5], { value: -1234.56, type: Number, format: '#,##0.00' });
  assert.deepEqual(x.data[3][5], { value: 3456.78, type: Number, format: '#,##0.00' });
  assert.equal(x.stickyRowsCount, 1);
  assert.equal(x.columns.length, 7);
  assert.ok(x.columns[1].width >= 'Müller Hausverwaltung GmbH'.length, 'wide enough for its text');
  // A point file: ISO dates; mixed decimals: General.
  const shop = fromCsv('when,price\n2026-10-01,4.99\n2026-10-02,1.5\n');
  const s = toXlsx(shop, true, guessTypes(shop, true, shop.mark), shop.mark);
  assert.deepEqual(s.data[1], [{ value: utc(2026, 10, 1), type: Date, format: 'yyyy-mm-dd' }, { value: 4.99, type: Number }]);
  // A line break in a cell wraps; empty cells are empty.
  const note = fromCsv(SHOP);
  const n = toXlsx(note, true, guessTypes(note, true, note.mark), note.mark);
  assert.deepEqual(n.data[1][3], { value: 'first line\nsecond line', type: String, format: '@', wrap: true });
  assert.equal(n.data[2][3], null);
  // Without a header, nothing is bold and nothing sticks.
  const plain = toXlsx(note, false, ['text', 'text', 'text', 'text'], note.mark);
  assert.deepEqual(plain.data[0][0], { value: 'order', type: String, format: '@' });
  assert.equal(plain.stickyRowsCount, undefined);
});

test('a type chosen by hand wins: Number reads 01067 as 1067; a cell that isn’t one stays text', () => {
  assert.equal(convert('01067', 'number', 'comma', 'dmy'), 1067);
  assert.equal(convert('n/a', 'number', 'comma', 'dmy'), 'n/a');
  assert.deepEqual(convert('1.10.26', 'date', 'comma', 'dmy'), utc(2026, 10, 1));
  assert.equal(convert('soon', 'date', 'comma', 'dmy'), 'soon');
  assert.equal(convert('', 'number', 'comma', 'dmy'), null);
  assert.equal(convert(-4.8, 'text', 'comma', 'dmy'), '-4,8', 'an Excel number as text');
  assert.equal(convert(utc(2026, 10, 1), 'text', 'point', 'iso'), '2026-10-01');
  assert.equal(convert(true, 'text', 'point', 'iso'), 'TRUE');
});

test('an Excel sheet: its own types stand, short rows padded', () => {
  const t = fromSheet([
    ['Name', 'PLZ', 'Betrag', 'Datum'],
    ['Anna', '01067', 12.5, utc(2026, 10, 1)],
    ['Ben', '80331', -4.8],
  ]);
  assert.equal(t.typed, true);
  assert.deepEqual(t.short, [2]);
  assert.equal(t.rows[2][3], null);
  assert.equal(guessHeader(t, 'comma'), true);
  assert.deepEqual(guessTypes(t, true, 'comma'), ['text', 'text', 'number', 'date'], 'its text "80331" stays text');
  assert.deepEqual(toCsvRows(t, true, guessTypes(t, true, 'comma'), 'comma', ';'), [
    ['Name', 'PLZ', 'Betrag', 'Datum'],
    ['Anna', '01067', '12,5', '01.10.2026'],
    ['Ben', '80331', '-4,8', ''],
  ]);
  const x = toXlsx(t, true, guessTypes(t, true, 'comma'), 'comma');
  assert.deepEqual(x.data[1][2], { value: 12.5, type: Number }, 'an Excel file’s numbers keep their own look');
});

test('a CSV can’t keep 01067 from Excel: said when it matters', () => {
  const t = fromCsv(BANK);
  const types = guessTypes(t, true, t.mark);
  assert.equal(excelWrecks(t, true, types), true);
  const plain = fromCsv('a;b\nx;1\n');
  assert.equal(excelWrecks(plain, true, guessTypes(plain, true, plain.mark)), false);
  const phone = fromCsv('name,phone\nAnna,+4930123456\n');
  assert.equal(excelWrecks(phone, true, guessTypes(phone, true, phone.mark)), true);
});

test('old .xls and .xlsx by their first bytes', () => {
  assert.equal(isOldXls(Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1)), true);
  assert.equal(isOldXls(Uint8Array.of(0x50, 0x4b, 0x03, 0x04)), false);
  assert.equal(isZip(Uint8Array.of(0x50, 0x4b, 0x03, 0x04)), true);
  assert.equal(isZip(new TextEncoder().encode('a;b')), false);
});

test('a separator or decimal mark chosen by hand wins over the one found, which is still said', () => {
  const shop = 'name,price\n"Notebook, A5",1.500\nPen,2.000\n';
  const found = fromCsv(shop);
  assert.deepEqual([found.sep, found.foundSep, found.mark, found.foundMark, found.columns], [',', ',', 'point', 'point', 2]);
  const wrong = fromCsv(shop, { sep: ';' });
  assert.deepEqual([wrong.sep, wrong.foundSep, wrong.columns, wrong.rows.length], [';', ',', 1, 3]);
  const comma = fromCsv('name;price\nA;1.500\nB;2.000\n');
  assert.deepEqual([comma.mark, comma.foundMark, comma.sure], ['comma', 'comma', false]);
  const point = fromCsv('name;price\nA;1.500\nB;2.000\n', { mark: 'point' });
  assert.deepEqual([point.mark, point.foundMark], ['point', 'comma']);
  const prices = (t) => t.rows.slice(1).map((r) => convert(r[1], guessTypes(t, true, t.mark)[1], t.mark, 'dmy'));
  assert.deepEqual(prices(point), [1.5, 2]);
  assert.deepEqual(prices(comma), [1500, 2000]);
});
