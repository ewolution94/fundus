import { test } from 'node:test';
import assert from 'node:assert/strict';
import { direction, directionOf, readCsv, toJson, stringify, jsonToCsv, keysOf, columnKinds } from '../../src/tools/csvjson/csvjson.ts';

const json = (csv, { header, typed = true } = {}) => {
  const read = readCsv(csv);
  return JSON.parse(stringify(toJson(read, header ?? read.header, typed)));
};

test('the direction from the text, or from a file’s name', () => {
  assert.equal(direction('[{"a":1}]'), 'json');
  assert.equal(direction('  \n{"a":1}'), 'json');
  assert.equal(direction('﻿[1]'), 'json');
  assert.equal(direction('a,b\n1,2'), 'csv');
  assert.equal(direction(''), 'csv');
  assert.equal(directionOf('data.json', '', 'a,b'), 'json');
  assert.equal(directionOf('data.csv', '', '[1]'), 'csv');
  assert.equal(directionOf('export', 'text/csv', '[1]'), 'csv');
  assert.equal(directionOf('notes.txt', 'text/plain', '[1]'), 'json');
});

test('CSV → JSON: objects keyed by the header, typed by column', () => {
  const out = json('id,name,active,score,zip,note\n1,Anna,true,4.5,01067,\n2,"Ben, Jr.",false,-12,20095,"say ""hi"""\n');
  assert.deepEqual(out, [
    { id: 1, name: 'Anna', active: true, score: 4.5, zip: '01067', note: null },
    { id: 2, name: 'Ben, Jr.', active: false, score: -12, zip: '20095', note: 'say "hi"' },
  ]);
});

test('typed values off: every cell its text', () => {
  assert.deepEqual(json('a,b\n1,\n', { typed: false }), [{ a: '1', b: '' }]);
});

test('without a header: arrays', () => {
  assert.deepEqual(json('1,2\n3,4\n'), [
    [1, 2],
    [3, 4],
  ]);
  assert.deepEqual(json('a,b\nc,d\n', { header: false, typed: false }), [
    ['a', 'b'],
    ['c', 'd'],
  ]);
});

test('typed by column: a postcode column stays text throughout, big numbers stay text', () => {
  const read = readCsv('zip,n,big,flag,mixed\n01067,1,12345678901234567890,TRUE,1\n80331,2.50,1,false,x\n');
  assert.deepEqual(columnKinds(read.rows.slice(1), read.columns, read.mark, read.sure), ['text', 'number', 'text', 'bool', 'text']);
  assert.deepEqual(json('zip,n,big,flag,mixed\n01067,1,12345678901234567890,TRUE,1\n80331,2.50,1,false,x\n'), [
    { zip: '01067', n: 1, big: '12345678901234567890', flag: true, mixed: '1' },
    { zip: '80331', n: 2.5, big: '1', flag: false, mixed: 'x' },
  ]);
  assert.deepEqual(json('n\n1e3\n-0.5\n'), [{ n: 1000 }, { n: -0.5 }], 'as JSON writes numbers');
});

test('a German CSV’s decimal comma is read as a number', () => {
  assert.deepEqual(json('Datum;Betrag;PLZ\n01.10.2026;-1.234,56;01067\n02.10.2026;-4,80;80331\n'), [
    { Datum: '01.10.2026', Betrag: -1234.56, PLZ: '01067' },
    { Datum: '02.10.2026', Betrag: -4.8, PLZ: '80331' },
  ]);
});

test('dotted headers nest; a clash stays flat', () => {
  assert.deepEqual(json('id,address.city,address.zip,address.geo.lat\n1,Berlin,10115,52.5\n'), [{ id: 1, address: { city: 'Berlin', zip: 10115, geo: { lat: 52.5 } } }]);
  assert.deepEqual(json('a,a.b,c.\n1,2,3\n'), [{ a: 1, 'a.b': 2, 'c.': 3 }]);
});

test('header names: an empty one is columnN, a repeated one name_2', () => {
  assert.deepEqual(keysOf(['a', '', 'a', 'a', ' ']), ['a', 'column2', 'a_2', 'a_3', 'column5']);
  assert.deepEqual(json('name,,name\nx,y,z\n'), [{ name: 'x', column2: 'y', name_2: 'z' }]);
});

test('the JSON keeps the columns’ order (JSON.stringify would put "2024" first) and is indented like it', () => {
  const text = stringify(toJson(readCsv('name,2024,2023\nAnna,1,2\n'), true, true));
  assert.equal(text, '[\n  {\n    "name": "Anna",\n    "2024": 1,\n    "2023": 2\n  }\n]');
  const plain = [{ a: [1, 'x', null, true, {}], b: { c: [] } }];
  const asJ = [{ entries: [['a', [1, 'x', null, true, { entries: [] }]], ['b', { entries: [['c', []]] }]] }];
  assert.equal(stringify(asJ), JSON.stringify(plain, null, 2));
  assert.equal(stringify([]), '[]');
  assert.equal(stringify('a"\n'), JSON.stringify('a"\n'));
});

test('JSON → CSV: the union of keys in first-seen order, nested objects dotted, arrays as JSON', () => {
  const r = jsonToCsv('[{"id":1,"address":{"city":"Berlin","geo":{"lat":52.5}},"tags":["a","b"]},{"id":2,"note":"x, \\"y\\"","empty":{},"none":null}]', ',');
  assert.ok(r.ok);
  assert.equal(r.shape, 'objects');
  assert.equal(r.rows, 2);
  assert.equal(r.columns, 7);
  assert.equal(r.csv, 'id,address.city,address.geo.lat,tags,note,empty,none\n1,Berlin,52.5,"[""a"",""b""]",,,\n2,,,,"x, ""y""",{},\n');
});

test('JSON → CSV: numbers exactly as written, the separator from the setting', () => {
  const r = jsonToCsv('[{"big":12345678901234567890,"price":1.50,"neg":-0.0,"t":true}]', ';');
  assert.equal(r.csv, 'big;price;neg;t\n12345678901234567890;1.50;-0.0;true\n');
});

test('JSON → CSV: arrays of arrays, a single object, scalars in a list', () => {
  assert.deepEqual(jsonToCsv('[[1,"a,b"],[2],[3,{"x":1}]]', ','), { ok: true, csv: '1,"a,b"\n2,\n3,"{""x"":1}"\n', rows: 3, columns: 2, shape: 'arrays' });
  assert.equal(jsonToCsv('{"a":1,"b":"x"}', ',').csv, 'a,b\n1,x\n');
  assert.equal(jsonToCsv('[{"a":1},2,"s"]', ',').csv, 'a,value\n1,\n,2\n,s\n');
  assert.equal(jsonToCsv('﻿[{"a":1}]', ',').csv, 'a\n1\n', 'a BOM is fine');
  assert.equal(jsonToCsv('[{"a":1,"a":2}]', ',').csv, 'a\n2\n', 'a repeated key: the last wins, as JSON.parse does');
});

test('JSON → CSV: what it can’t do, said', () => {
  assert.deepEqual(jsonToCsv('42', ','), { ok: false, code: 'scalar' });
  assert.deepEqual(jsonToCsv('[]', ','), { ok: false, code: 'empty' });
  const bad = jsonToCsv('[\n  {"a": 1,}\n]', ',');
  assert.equal(bad.ok, false);
  assert.deepEqual({ code: bad.error.code, line: bad.error.line, column: bad.error.column }, { code: 'trailingComma', line: 2, column: 11 });
});

test('CSV → JSON → CSV comes back the same', () => {
  const csv = 'id,name,address.city,address.zip,active,note\n1,Anna,Berlin,01067,true,\n2,"Ben, Jr.",Hamburg,20095,false,"say ""hi"""\n3,Cleo,,,,"two\nlines"\n';
  const there = stringify(toJson(readCsv(csv), true, true));
  assert.equal(jsonToCsv(there, ',').csv, csv);
  const untyped = stringify(toJson(readCsv(csv), true, false));
  assert.equal(jsonToCsv(untyped, ',').csv, csv);
});

test('an unclosed quote is reported with its place', () => {
  const read = readCsv('a,b\n1,"two\n');
  assert.deepEqual(read.issue, { code: 'unclosed', line: 2, column: 3, offset: 6 });
});

test('a separator or decimal mark chosen by hand wins over the one found, which is still said', () => {
  const wrong = readCsv('name,city\nAnna,Berlin\n', { sep: ';' });
  assert.deepEqual([wrong.sep, wrong.foundSep, wrong.columns], [';', ',', 1]);
  const comma = readCsv('a;b\n1,5;2\n');
  assert.deepEqual([comma.mark, comma.foundMark, comma.found], ['comma', 'comma', true]);
  assert.deepEqual(JSON.parse(stringify(toJson(comma, true, true))), [{ a: 1.5, b: 2 }]);
  const point = readCsv('a;b\n1,5;2\n', { mark: 'point' });
  assert.deepEqual([point.mark, point.foundMark, point.sure], ['point', 'comma', true]);
  assert.deepEqual(JSON.parse(stringify(toJson(point, true, true))), [{ a: '1,5', b: 2 }]);
});
