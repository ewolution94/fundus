import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTools, fold } from '../src/lib/search.ts';
import { shapes } from '../src/lib/shapes.ts';
import { TOOLS } from '../shared/catalog.mjs';

const top = (q) => findTools(q, TOOLS)[0]?.tool.id;

test('finds a tool by number, name, synonym in either language, or what it does', () => {
  assert.equal(top('502'), 'percent');
  assert.equal(top('F-102'), 'shrink');
  assert.equal(top('mwst'), 'percent');
  assert.equal(top('verkl'), 'shrink');
  assert.equal(top('Shrink'), 'shrink');
  assert.equal(top('qr'), 'qr');
  assert.equal(top('passwort'), 'password');
  assert.equal(top('heic'), 'convert');
  assert.equal(top('unterschrift'), 'sign');
  assert.equal(top('favicon'), 'icons');
  assert.equal(top('umlaute'), 'umlauts');
  assert.equal(top('excel'), 'csv');
  assert.equal(top('farbe'), 'colours');
  assert.equal(top('in worten'), 'words');
  assert.equal(top('römische zahlen'), 'words');
  assert.equal(top('mp3'), 'audio');
  assert.equal(top('sprachmemo'), 'audio');
  assert.equal(top('jwt'), 'jwt');
  assert.equal(top('regex'), 'regex');
  assert.equal(top('yaml'), 'yaml');
  assert.equal(top('hexadezimal'), 'bases');
  assert.equal(top('601'), 'audio');
  assert.deepEqual(findTools('', TOOLS), []);
});

test('folds accents and German letters', () => {
  assert.equal(fold('Größe'), 'groesse');
  assert.equal(fold('  Café  & Co '), 'cafe co');
});

test('every tool has a unique id, number and address', () => {
  for (const key of ['id', 'no', 'path']) assert.equal(new Set(TOOLS.map((t) => t[key])).size, TOOLS.length, key);
  assert.equal(TOOLS.length, 37);
});

test('knows what a pasted text is', () => {
  assert.deepEqual(shapes('https://ewolution.cloud/x'), ['link', 'text']);
  assert.ok(shapes('249,90').includes('number'));
  assert.ok(shapes('19 %').includes('number'));
  assert.deepEqual(shapes('1793477382'), ['timestamp', 'number', 'text']);
  assert.ok(shapes('2026-10-31').includes('date'));
  assert.ok(shapes('31.10.2026').includes('date'));
  assert.ok(!shapes('31.10.2026').includes('number'));
  assert.ok(shapes('{"a": [1, 2]}').includes('json'));
  assert.ok(shapes('SGVsbG8gRnVuZHVzIQ==').includes('base64'));
  assert.deepEqual(shapes('0192f3a4-5b6c-7d8e-9f01-23456789abcd'), ['uuid', 'text']);
  assert.ok(shapes('{0192F3A4-5B6C-7D8E-9F01-23456789ABCD}').includes('uuid'));
  assert.deepEqual(shapes('just words here'), ['text']);
});

test('knows the shapes round 2 added', () => {
  assert.deepEqual(shapes('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln'), ['jwt', 'text']);
  for (const c of ['#ffe14a', '#FFF', 'rgb(255 225 74)', 'hsl(51 100% 65%)', 'oklch(0.9 0.15 95)']) assert.ok(shapes(c).includes('colour'), c);
  assert.ok(shapes('MCMXCIV').includes('roman'));
  assert.ok(!shapes('mix').includes('roman'));
  assert.ok(!shapes('X').includes('roman'));
  assert.ok(!shapes('CIVIL').includes('roman'));
  assert.ok(shapes('0xff').includes('bases'));
  assert.ok(shapes('0b1010_0101').includes('bases'));
  assert.ok(shapes('GrÃ¼ÃŸe aus KÃ¶ln').includes('mojibake'));
  assert.ok(shapes('â€žZitatâ€œ').includes('mojibake'));
  assert.ok(!shapes('SÃO PAULO').includes('mojibake'));
  assert.ok(!shapes('Grüße aus Köln').includes('mojibake'));
  assert.ok(shapes('name;plz;ort\nAnna;01067;Dresden\nBen;80331;München').includes('csv'));
  assert.ok(shapes('Datum\tBetrag\n01.10.\t-12,50').includes('csv'));
  assert.ok(!shapes('a,b\nc,d').includes('csv'));
  assert.ok(!shapes('[{"a":1},{"a":2}]').includes('csv'));
  assert.ok(shapes('name: fundus\nport: 4330\ntools:\n  - shrink\n  - percent').includes('yaml'));
  assert.ok(!shapes('Dear Anna,\nthanks for the note.').includes('yaml'));
});
