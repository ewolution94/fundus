import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLiteral, tidyFlags, readable, compile, groupNames, substitute, run, stretches, hasSets } from '../../src/tools/regex/regex.ts';

const found = (pattern, flags, text) => {
  const r = run(pattern, flags, text, null);
  assert.ok(r.ok, JSON.stringify(r));
  return r;
};

test('a pasted /abc/gi splits into pattern and flags', () => {
  assert.deepEqual(splitLiteral('/abc/gi'), { pattern: 'abc', flags: 'gi' });
  assert.deepEqual(splitLiteral('  /\\d+\\/x/  '), { pattern: '\\d+\\/x', flags: '' });
  assert.deepEqual(splitLiteral('/a/b/m'), { pattern: 'a/b', flags: 'm' });
  assert.equal(splitLiteral('abc'), null);
  assert.equal(splitLiteral('//'), null);
  assert.equal(splitLiteral('/abc/gx'), null, 'x is no flag');
  assert.equal(splitLiteral('/abc/gg'), null, 'a flag twice');
  assert.equal(tidyFlags('ygdi'), 'dgiy', 'the order the engine writes them');
  assert.equal(tidyFlags('gxg'), 'g');
});

test('matches with their places; only the first without g', () => {
  const r = found('\\d+', 'g', 'a1 b22 c333');
  assert.equal(r.count, 3);
  assert.deepEqual(r.matches.map((m) => [m.index, m.end]), [[1, 2], [4, 6], [8, 11]]);
  const one = found('\\d+', '', 'a1 b22 c333');
  assert.equal(one.count, 1);
  assert.deepEqual([one.matches[0].index, one.matches[0].end], [1, 2]);
  assert.equal(found('x', 'g', 'abc').count, 0);
  assert.equal(found('A', 'gi', 'aAa').count, 3);
});

test('groups: numbered, named by name, and the ones that took no part', () => {
  const r = found('(?<year>\\d{4})-(\\d{2})(-(?<day>\\d{2}))?', 'g', '2026-10 and 2025-03-14');
  assert.deepEqual(r.names, ['year', null, null, 'day']);
  assert.deepEqual(r.matches[0].groups.map((g) => g.value), ['2026', '10', null, null]);
  assert.deepEqual(r.matches[1].groups.map((g) => g.value), ['2025', '03', '-14', '14']);
});

test('with d, each group’s place', () => {
  const r = found('(?<y>\\d+)-(\\d+)', 'd', 'on 2026-10');
  assert.deepEqual(r.matches[0].groups, [{ value: '2026', start: 3, end: 7 }, { value: '10', start: 8, end: 10 }]);
});

test('group names read from the pattern: escapes, classes, lookarounds', () => {
  assert.deepEqual(groupNames('\\((a)[(](?:b)(?=c)(?!d)(?<=e)(?<!f)(?<g>h)'), [null, 'g']);
  assert.deepEqual(groupNames('[\\]](x)'), [null]);
  assert.deepEqual(groupNames('[[a]--[b]](x)', true), [null], 'classes nest with v');
  assert.deepEqual(groupNames('[[](x)'), [null], 'without v a [ in a class is a [');
});

test('empty matches move on, by whole characters with u', () => {
  for (const [pattern, flags, text] of [['x*', 'g', 'abc'], ['', 'g', 'ab'], ['', 'gu', '😀a'], ['', 'g', '😀a'], ['\\b', 'g', 'hi there'], ['^', 'gm', 'a\nb\nc']]) {
    const r = found(pattern, flags, text);
    const native = [...text.matchAll(new RegExp(pattern, flags))].map((m) => m.index);
    assert.deepEqual(r.matches.map((m) => m.index), native, `${pattern} /${flags} on ${JSON.stringify(text)}`);
  }
});

test('sticky: only where the last one ended', () => {
  assert.equal(found('a', 'gy', 'aab').count, 2);
  assert.equal(found('b', 'gy', 'aab').count, 0);
  assert.equal(found('a', 'y', 'ba').count, 0);
});

test('replace: the same as String.prototype.replace, every $ form', () => {
  const text = 'Born 2026-10-31, back 2025-03-14.';
  const pattern = '(?<y>\\d{4})-(\\d{2})-(\\d{2})';
  const templates = ['$3.$2.$<y>', '[$&]', '$$', "<$'>", '<$`>', '$10', '$01', '$0', '$00', '$4', '$<nope>', '$<y', '$', 'x$', '$1$2$3', '$<y>$<y>', '$9'];
  for (const flags of ['g', '', 'gd']) {
    for (const t of templates) {
      const r = run(pattern, flags, text, t);
      assert.equal(r.replaced.text, text.replace(new RegExp(pattern, flags), t), `${t} /${flags}`);
    }
  }
  // Without named groups, "$<" stays as it is.
  for (const t of ['$<a>', '$1$<x>']) assert.equal(run('(b)', 'g', 'abc', t).replaced.text, 'abc'.replace(/(b)/g, t));
  // Empty matches, with u past a surrogate pair.
  assert.equal(run('', 'gu', '😀a', '-').replaced.text, '😀a'.replace(/(?:)/gu, '-'));
  assert.equal(run('x*', 'g', 'abc', '_').replaced.text, 'abc'.replace(/x*/g, '_'));
});

test('the replaced stretches are known, to mark them', () => {
  const r = run('\\d+', 'g', 'a1 b22', '<$&>');
  assert.equal(r.replaced.text, 'a<1> b<22>');
  assert.deepEqual(r.replaced.marks, [[1, 4], [6, 10]]);
  const empty = run('\\d', 'g', 'a1b2', '');
  assert.equal(empty.replaced.text, 'ab');
  assert.deepEqual(empty.replaced.marks, [[1, 1], [2, 2]]);
});

test('a broken pattern gives the engine’s message, readable', () => {
  const r = run('(a', '', 'a', null);
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.error, /^Invalid regular expression/);
  assert.match(r.error, /^[A-Z]/);
  assert.equal(compile('[z-a]', '').ok, false);
  assert.equal(compile('a', 'uv').ok, false);
  assert.equal(readable('Invalid regular expression: /(a/: Unterminated group'), 'Unterminated group');
  assert.equal(readable('Invalid regular expression: missing )'), 'Missing )');
  assert.equal(readable("Invalid flags supplied to RegExp constructor 'uv'"), "Invalid flags supplied to RegExp constructor 'uv'");
});

test('only the first thousand in detail; every one counted', () => {
  const r = found('a', 'g', 'a'.repeat(2500));
  assert.equal(r.count, 2500);
  assert.equal(r.matches.length, 1000);
  const rep = run('a', 'g', 'a'.repeat(2500), 'b');
  assert.equal(rep.replaced.text, 'b'.repeat(2500));
  assert.equal(rep.replaced.marks.length, 1000);
});

test('an empty answer that came slowly is flagged: Safari gives up and says "no match"', () => {
  assert.equal(run('b', 'g', 'abc', null).gaveUp, false);
  assert.equal(run('x', 'g', 'abc', null).gaveUp, false);
  // With no time allowed, every empty answer counts as slow: the last one after a match too.
  assert.equal(run('x', 'g', 'abc', null, 1000, 0).gaveUp, true);
  assert.equal(run('b', 'g', 'abc', null, 1000, 0).gaveUp, true);
  assert.equal(run('b', '', 'abc', null, 1000, 0).gaveUp, false, 'without g it stops at the first match');
});

test('the text cut into plain and matched stretches', () => {
  assert.deepEqual(stretches('a1 b22', [{ index: 1, end: 2 }, { index: 4, end: 6 }]), [
    { text: 'a', n: -1 },
    { text: '1', n: 0 },
    { text: ' b', n: -1 },
    { text: '22', n: 1 },
  ]);
  assert.deepEqual(stretches('ab', [{ index: 0, end: 0 }]), [{ text: '', n: 0 }, { text: 'ab', n: -1 }]);
  assert.deepEqual(stretches('ab', []), [{ text: 'ab', n: -1 }]);
});

test('v: sets in classes, where the engine has them', { skip: !hasSets() }, () => {
  const r = found('[\\p{L}--[a-z]]', 'gv', 'aBcÄ');
  assert.deepEqual(r.matches.map((m) => m.index), [1, 3]);
});
