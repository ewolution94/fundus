import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeBytes,
  decodeAs,
  chosenOf,
  stripBom,
  parseCsv,
  findSeparator,
  toNumber,
  numberText,
  decimalsOf,
  markOf,
  findDecimal,
  plainNumber,
  pad,
  field,
  writeCsv,
  columnLetter,
} from '../src/lib/csv.ts';

// Windows-1252 bytes for a string (what German Excel writes), built here: unit tests never read the
// generated sample files.
const cp1252 = (text) => Uint8Array.from([...text].map((c) => (c === '€' ? 0x80 : c.charCodeAt(0))));
const utf8 = (text) => new TextEncoder().encode(text);

const BANK = [
  'Buchungstag;Empfänger;Verwendungszweck;IBAN;PLZ;Betrag;Währung',
  '01.10.2026;Müller Hausverwaltung GmbH;"Miete; Oktober";DE89370400440532013000;01067;-1.234,56;EUR',
  '02.10.2026;Bäckerei Süß;Brötchen;DE02120300000000202051;80331;-4,80;EUR',
  '15.10.2026;Arbeitgeber AG;Gehalt Oktober;DE44500105175407324931;20095;3.456,78;EUR',
].join('\r\n') + '\r\n';

const SHOP = 'order,product,price,note\n1001,"Notebook, A5",4.99,"first line\nsecond line"\n1002,Pen,1.5,\n';

test('bytes: a UTF-8 BOM, plain UTF-8, UTF-16 with its BOM, else Windows-1252, and it says which', () => {
  assert.deepEqual(decodeBytes(Uint8Array.of(0xef, 0xbb, 0xbf, ...utf8('Müller;1'))), { text: 'Müller;1', encoding: 'utf-8-bom' });
  assert.deepEqual(decodeBytes(utf8('Bäckerei Süß')), { text: 'Bäckerei Süß', encoding: 'utf-8' });
  assert.deepEqual(decodeBytes(cp1252('Müller;5 €')), { text: 'Müller;5 €', encoding: 'windows-1252' });
  const bank = decodeBytes(cp1252(BANK));
  assert.equal(bank.encoding, 'windows-1252');
  assert.equal(bank.text, BANK);
  const le = new Uint8Array([0xff, 0xfe, ...[...'a\tö'].flatMap((c) => [c.charCodeAt(0), 0])]);
  assert.deepEqual(decodeBytes(le), { text: 'a\tö', encoding: 'utf-16' });
  assert.equal(stripBom('﻿a;b'), 'a;b');
  assert.equal(stripBom('a;b'), 'a;b');
});

test('RFC 4180: quotes, doubled quotes, separators and line breaks inside quotes', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,2,3', ',').rows, [['a', 'b', 'c'], ['1', '2', '3']], 'a last line without a break');
  assert.deepEqual(parseCsv('"say ""hi""",x\n', ',').rows, [['say "hi"', 'x']]);
  assert.deepEqual(parseCsv('"a;b";c\r\n', ';').rows, [['a;b', 'c']]);
  assert.deepEqual(parseCsv('"one\ntwo",x\r\n"three\r\nfour",y\r\n', ',').rows, [['one\ntwo', 'x'], ['three\r\nfour', 'y']]);
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n', ',').rows, [['a', 'b'], ['1', '2']], 'CRLF');
  assert.deepEqual(parseCsv('a,b\r1,2\r', ',').rows, [['a', 'b'], ['1', '2']], "an old Mac's CR");
  assert.deepEqual(parseCsv('a,,\n,,\n', ',').rows, [['a', '', ''], ['', '', '']], 'empty fields, a trailing separator');
  assert.deepEqual(parseCsv('a,b\n\n\n1,2\n\n', ',').rows, [['a', 'b'], ['1', '2']], 'empty lines are skipped');
  assert.deepEqual(parseCsv('""\n', ',').rows, [['']], 'a quoted empty field is a row');
  assert.deepEqual(parseCsv('﻿name;city\nAnna;Berlin', ';').rows, [['name', 'city'], ['Anna', 'Berlin']], 'a BOM never ends up in a cell');
  assert.deepEqual(parseCsv('5" screen,x', ',').rows, [['5" screen', 'x']], 'a quote inside an unquoted field is a character');
  assert.deepEqual(parseCsv('', ',').rows, []);
  assert.equal(parseCsv(BANK, ';').issue, null);
  assert.equal(parseCsv(SHOP, ',').issue, null);
  assert.deepEqual(parseCsv(SHOP, ',').rows[1], ['1001', 'Notebook, A5', '4.99', 'first line\nsecond line']);
});

test('a quote never closed, and text after a closing quote: said with line, column and offset', () => {
  const open = parseCsv('a,b\n1,"two\n3,4\n', ',');
  assert.deepEqual(open.issue, { code: 'unclosed', line: 2, column: 3, offset: 6 });
  assert.deepEqual(open.rows, [['a', 'b'], ['1', 'two\n3,4\n']], 'the rest is in one cell');
  const stray = parseCsv('x,y\n"ab"cd,e\n', ',');
  assert.deepEqual(stray.issue, { code: 'stray', line: 2, column: 5, offset: 8 });
  assert.deepEqual(stray.rows[1], ['abcd', 'e'], 'kept in the cell');
  // After a line break inside quotes, lines still count.
  assert.deepEqual(parseCsv('"a\nb"x,1', ',').issue, { code: 'stray', line: 2, column: 3, offset: 5 });
});

test('maxRows stops early', () => {
  assert.equal(parseCsv('1\n2\n3\n4\n', ',', 2).rows.length, 2);
});

test('the separator: the one that splits every line alike', () => {
  assert.equal(findSeparator(BANK), ';', 'decimal commas don’t fool it');
  assert.equal(findSeparator(SHOP), ',', 'quoted commas and a quoted line break');
  assert.equal(findSeparator('name\tcity\nAnna\tBerlin, Mitte\n'), '\t');
  assert.equal(findSeparator('a|b|c\n1|2|3\n'), '|');
  assert.equal(findSeparator('a;b,c,d\n1;2,3,4\n'), ',', 'more fields win when both are even');
  assert.equal(findSeparator('a,b\n1,2;3\n4,5\n'), ',', 'the most consistent wins');
  assert.equal(findSeparator('just one column\nanother\n'), ',', 'one column: a comma');
  assert.equal(findSeparator('just one column\n', '\t'), '\t', 'or the hint');
  assert.equal(findSeparator('a;b\tc\n1;2\t3\n', '\t'), '\t', 'the hint wins a tie');
  assert.equal(findSeparator('﻿a;b\n1;2'), ';');
  // A big file: only its start is read.
  const big = 'id;name;amount\n' + Array.from({ length: 5000 }, (_, i) => `${i};Name ${i};${i},50`).join('\n');
  assert.equal(findSeparator(big), ';');
});

test('numbers in a decimal mark, and what Excel would wreck stays text', () => {
  assert.equal(toNumber('-1.234,56', 'comma'), -1234.56);
  assert.equal(toNumber('-4,80', 'comma'), -4.8);
  assert.equal(toNumber('3.456,78', 'comma'), 3456.78);
  assert.equal(toNumber('1.500', 'comma'), 1500);
  assert.equal(toNumber('1.500', 'point'), 1.5);
  assert.equal(toNumber('1,234.5', 'point'), 1234.5);
  assert.equal(toNumber('4.99', 'point'), 4.99);
  assert.equal(toNumber('4.99', 'comma'), null, 'a point in a comma file isn’t a number');
  assert.equal(toNumber(' 42 ', 'point'), 42);
  assert.equal(toNumber('−5', 'point'), -5, 'the minus sign');
  assert.equal(toNumber('0,5', 'comma'), 0.5);
  assert.equal(toNumber('0', 'comma'), 0);
  assert.equal(toNumber('01067', 'comma'), null, 'a postcode');
  assert.equal(toNumber('1234567890123456', 'point'), null, 'more than 15 digits');
  assert.equal(toNumber('123456789012345', 'point'), 123456789012345);
  assert.equal(toNumber('+4930123456', 'point'), null, 'a phone number');
  assert.equal(toNumber('+12,50', 'comma'), 12.5, 'an amount with a plus');
  for (const s of ['', '1,2,3', '12a', '01.10.2026', '2026-10-01', 'DE89370400440532013000', '1e5', '1 234', '--1', '.5']) {
    assert.equal(toNumber(s, 'comma'), null, s);
    assert.equal(toNumber(s, 'point'), null, s);
  }
  // Someone chose Number: then it reads what Excel would read.
  assert.equal(toNumber('01067', 'comma', { strict: false }), 1067);
  assert.equal(toNumber('+49', 'point', { strict: false }), 49);
});

test('number text for another mark, digit for digit', () => {
  assert.equal(numberText('-1.234,56', 'comma', 'point'), '-1234.56');
  assert.equal(numberText('-4,80', 'comma', 'comma'), '-4,80');
  assert.equal(numberText('1,234.50', 'point', 'comma'), '1234,50');
  assert.equal(numberText('+12,50', 'comma', 'comma'), '12,50');
  assert.equal(numberText('1001', 'comma', 'point'), '1001');
  assert.equal(numberText('abc', 'comma', 'point'), null);
  assert.equal(decimalsOf('-4,80', 'comma'), 2);
  assert.equal(decimalsOf('1.234', 'comma'), 0);
  assert.equal(decimalsOf('x', 'comma'), null);
});

test('the decimal mark from the cells that say anything', () => {
  assert.equal(markOf('-1.234,56'), 'comma');
  assert.equal(markOf('-4,80'), 'comma');
  assert.equal(markOf('4.99'), 'point');
  assert.equal(markOf('1,234.5'), 'point');
  assert.equal(markOf('1.234.567'), 'comma', 'groups of a point: the decimal mark is the comma');
  assert.equal(markOf('1,234,567'), 'point');
  for (const s of ['1.500', '1,500', '01067', '01.10.2026', '12', 'Miete', '2026-10-01', '1.2.3', '']) assert.equal(markOf(s), null, s);
  const bank = parseCsv(BANK, ';').rows;
  assert.deepEqual(findDecimal(bank, 'point'), { mark: 'comma', sure: true });
  assert.deepEqual(findDecimal(parseCsv(SHOP, ',').rows, 'comma'), { mark: 'point', sure: true });
  assert.deepEqual(findDecimal([['a', '1.500'], ['b', '2']], 'comma'), { mark: 'comma', sure: false }, 'nothing said: the fallback');
  assert.deepEqual(findDecimal([['4,5', '1,25', '0.5']], 'point'), { mark: 'comma', sure: true }, 'the majority');
});

test('plain numbers: the mark, no grouping, no exponent', () => {
  assert.equal(plainNumber(-1234.56, 'comma'), '-1234,56');
  assert.equal(plainNumber(-1234.56, 'point'), '-1234.56');
  assert.equal(plainNumber(1e21, 'point'), '1000000000000000000000');
  assert.equal(plainNumber(1e-7, 'comma'), '0,0000001');
  assert.equal(plainNumber(42, 'comma'), '42');
});

test('short rows are padded, and listed', () => {
  assert.deepEqual(pad([['a', 'b', 'c'], ['1'], ['1', '2', '3'], []], ''), {
    rows: [['a', 'b', 'c'], ['1', '', ''], ['1', '2', '3'], ['', '', '']],
    columns: 3,
    short: [1, 3],
  });
});

test('writing: quoted only when needed; what’s written reads back the same', () => {
  assert.equal(field('plain', ';'), 'plain');
  assert.equal(field('a;b', ';'), '"a;b"');
  assert.equal(field('a,b', ';'), 'a,b', 'a comma is nothing special with semicolons');
  assert.equal(field('say "hi"', ','), '"say ""hi"""');
  assert.equal(field('two\nlines', ','), '"two\nlines"');
  assert.equal(field(' spaced ', ','), ' spaced ');
  assert.equal(writeCsv([['a', 'b'], ['1', '2']], ';'), 'a;b\r\n1;2\r\n');
  assert.equal(writeCsv([['a', 'b']], ',', '\n'), 'a,b\n');
  const tricky = [
    ['Miete; Oktober', 'Notebook, A5', 'say "hi"', 'first\nsecond', 'tab\there', 'pipe|it', ''],
    ['', '"', '""', 'Müller', '€', 'a\r\nb', ' x '],
  ];
  for (const sep of [';', ',', '\t', '|']) {
    assert.deepEqual(parseCsv(writeCsv(tricky, sep), sep).rows, tricky, JSON.stringify(sep));
    assert.equal(findSeparator(writeCsv(tricky, sep)), sep, JSON.stringify(sep));
  }
});

test('column letters as Excel names them', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
});

test('bytes read again in the encoding someone chose', () => {
  const utf8 = new TextEncoder().encode('Müller;€');
  const ansi = Uint8Array.from([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x3b, 0x80]);
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8]);
  assert.equal(decodeAs(utf8, 'utf-8'), 'Müller;€');
  assert.equal(decodeAs(utf8, 'windows-1252'), 'MÃ¼ller;â‚¬');
  assert.equal(decodeAs(ansi, 'windows-1252'), 'Müller;€');
  assert.equal(decodeAs(ansi, 'utf-8'), 'M\ufffdller;\ufffd');
  assert.equal(decodeAs(bom, 'utf-8'), 'Müller;€');
  assert.equal(decodeAs(Uint8Array.from([0xff, 0xfe, 0x41, 0x00, 0xfc, 0x00]), 'utf-16'), 'Aü');
  assert.equal(decodeAs(Uint8Array.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0xfc]), 'utf-16'), 'Aü');
  assert.deepEqual(['utf-8', 'utf-8-bom', 'utf-16', 'windows-1252'].map(chosenOf), ['utf-8', 'utf-8', 'utf-16', 'windows-1252']);
});
