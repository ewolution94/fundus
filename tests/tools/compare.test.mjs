import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch, parsePatch } from 'diff';
import { compare, unified, tokens, lines } from '../../src/tools/compare/compare.ts';

const words = { mode: 'words', ignoreCase: false, ignoreSpace: false, locale: 'en' };
const byLines = { mode: 'lines', ignoreCase: false, ignoreSpace: false, locale: 'en' };
const join = (parts) => parts.map((p) => p.text).join('');

test('tokens and lines put the text back together exactly', () => {
  const t = 'Grüße,  E-Mail 👋🏽\n\nzwei\tWörter.';
  assert.equal(tokens(t, 'de').map((x) => x.text).join(''), t);
  assert.equal(lines('a\nb\n\nc').join(''), 'a\nb\n\nc');
  assert.deepEqual(lines('a\nb\n'), ['a\n', 'b\n']);
  assert.deepEqual(lines(''), []);
});

test('by words: a replaced phrase is one change, each side keeps its own text', () => {
  const r = compare('The quick brown fox jumps.', 'The slow red fox jumps.', words);
  assert.deepEqual(r.before, [
    { kind: 'same', text: 'The ' },
    { kind: 'removed', text: 'quick brown' },
    { kind: 'same', text: ' fox jumps.' },
  ]);
  assert.deepEqual(r.after, [
    { kind: 'same', text: 'The ' },
    { kind: 'added', text: 'slow red' },
    { kind: 'same', text: ' fox jumps.' },
  ]);
  assert.deepEqual([r.added, r.removed, r.changes, r.same], [2, 2, 1, false]);
});

test('by words: a space between two insertions isn’t taken out of the first text', () => {
  const r = compare('Zweite Zeile', 'Zweite, neue Zeile', { ...words, locale: 'de' });
  assert.deepEqual(r.before, [{ kind: 'same', text: 'Zweite Zeile' }]);
  assert.equal(join(r.after), 'Zweite, neue Zeile');
  assert.deepEqual([r.added, r.removed], [1, 0]);
});

test('by words: counts are words, not punctuation; German compounds and emoji stay whole', () => {
  const r = compare('Wir fahren mit dem Donaudampfschiff 🚢.', 'Wir fahren heute mit der Donaudampfschifffahrt 🚢!', { ...words, locale: 'de' });
  assert.equal(r.added, 3, 'heute, der, Donaudampfschifffahrt');
  assert.equal(r.removed, 2, 'dem, Donaudampfschiff');
  assert.equal(r.changes, 3);
  assert.equal(join(r.before), 'Wir fahren mit dem Donaudampfschiff 🚢.');
  assert.equal(join(r.after), 'Wir fahren heute mit der Donaudampfschifffahrt 🚢!');
});

test('ignore case: the same, and each side still shows its own spelling', () => {
  const r = compare('Hello World', 'hello WORLD', { ...words, ignoreCase: true });
  assert.equal(r.same, true);
  assert.equal(join(r.before), 'Hello World');
  assert.equal(join(r.after), 'hello WORLD');
  assert.equal(compare('Hello World', 'hello WORLD', words).changes, 1);
});

test('ignore whitespace: double spaces, tabs and line breaks between words are no change', () => {
  const a = 'one  two\tthree\nfour';
  const b = 'one two three four';
  assert.equal(compare(a, b, { ...words, ignoreSpace: true }).same, true);
  const strict = compare(a, b, words);
  assert.equal(strict.same, false);
  assert.deepEqual([strict.added, strict.removed], [0, 0], 'no words came or went, only spaces');
  assert.equal(compare('a,b', 'a, b', { ...words, ignoreSpace: true }).same, true, 'a space that only came');
});

test('by lines: lines added and removed, a changed line is one of each', () => {
  const r = compare('alpha\nbeta\ngamma\n', 'alpha\nBETA\ngamma\ndelta\n', byLines);
  assert.deepEqual([r.added, r.removed, r.changes], [2, 1, 2]);
  assert.deepEqual(r.before.map((p) => p.kind), ['same', 'removed', 'same']);
  assert.deepEqual(r.after.map((p) => p.kind), ['same', 'added', 'same', 'added']);
  assert.equal(compare('alpha\nbeta\n', 'alpha\nBETA\n', { ...byLines, ignoreCase: true }).same, true);
});

test('by lines: indentation and blank lines count unless whitespace is ignored', () => {
  const a = 'if (x) {\n  go();\n}\n';
  const b = 'if (x) {\n\n    go();\n}\n';
  assert.equal(compare(a, b, byLines).changes, 1);
  assert.equal(compare(a, b, { ...byLines, ignoreSpace: true }).same, true);
});

test('a missing line break at the end is a change; Windows line breaks are not', () => {
  assert.equal(compare('a\nb', 'a\nb\n', byLines).same, false);
  assert.equal(compare('a\r\nb\r\n', 'a\nb\n', byLines).same, true);
});

test('one side empty: everything came, or everything went', () => {
  const r = compare('', 'one two three', words);
  assert.deepEqual([r.added, r.removed, r.changes], [3, 0, 1]);
  assert.equal(compare('', '', words).same, true);
});

test('the unified diff applies: patching the first text gives the second', () => {
  const cases = [
    ['a\nb\nc\n', 'a\nB\nc\n'],
    ['', 'new\nfile\n'],
    ['old\nfile\n', ''],
    ['no newline', 'no newline\n'],
    ['x\ny', 'x\nz'],
    [Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n') + '\n', Array.from({ length: 40 }, (_, i) => (i === 3 || i === 30 ? `changed ${i}` : `line ${i}`)).join('\n') + '\nextra\n'],
  ];
  for (const [a, b] of cases) {
    const patch = unified(a, b, { ignoreCase: false, ignoreSpace: false });
    assert.equal(applyPatch(a, patch), b, `${JSON.stringify(a)} → ${JSON.stringify(b)}\n${patch}`);
  }
});

test('the unified diff, written as diff -u writes it: headers, hunks, three lines of context', () => {
  const a = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n';
  const b = '1\n2\n3\n4\nfive\n6\n7\n8\n9\n10\n11\n12\n13\n';
  const patch = unified(a, b, { ignoreCase: false, ignoreSpace: false, names: ['Before', 'After'] });
  assert.equal(patch, ['--- Before', '+++ After', '@@ -2,7 +2,7 @@', ' 2', ' 3', ' 4', '-5', '+five', ' 6', ' 7', ' 8', '@@ -10,3 +10,4 @@', ' 10', ' 11', ' 12', '+13', ''].join('\n'));
  assert.equal(parsePatch(patch)[0].hunks.length, 2);
  assert.equal(unified('same\n', 'same\n', { ignoreCase: false, ignoreSpace: false }), '', 'nothing changed, no diff');
});

test('the unified diff follows ignore case', () => {
  assert.equal(unified('Hello\n', 'hello\n', { ignoreCase: true, ignoreSpace: false }), '');
  assert.match(unified('Hello\n', 'hello\n', { ignoreCase: false, ignoreSpace: false }), /-Hello\n\+hello/);
});
