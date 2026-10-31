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
  assert.deepEqual(findTools('', TOOLS), []);
});

test('folds accents and German letters', () => {
  assert.equal(fold('Größe'), 'groesse');
  assert.equal(fold('  Café  & Co '), 'cafe co');
});

test('every tool has a unique id, number and address', () => {
  for (const key of ['id', 'no', 'path']) assert.equal(new Set(TOOLS.map((t) => t[key])).size, TOOLS.length, key);
  assert.equal(TOOLS.length, 26);
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
