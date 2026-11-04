import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { GROUPS, entries, fold, withTone, codes, find, search, samples, cap, versionLabel } from '../../src/tools/emoji/emoji.ts';

const list = entries();
const by = (s) => find(list, s);
const first = (q, lang = 'en') => search(list, q, lang)[0]?.emoji;
const all = (q, lang = 'en') => search(list, q, lang).map((e) => e.emoji);

test('every emoji people pick from, in Unicode’s order, without the swatches', () => {
  assert.ok(list.length > 1900, `${list.length}`);
  assert.equal(new Set(list.map((e) => e.emoji)).size, list.length);
  assert.ok(list.every((e) => GROUPS.includes(e.group)));
  assert.equal(list[0].emoji, '😀');
  assert.ok(!list.some((e) => e.emoji === '🏻'), 'no bare skin-tone swatch');
  for (let i = 1; i < list.length; i++) assert.ok(GROUPS.indexOf(list[i].group) >= GROUPS.indexOf(list[i - 1].group), `order at ${list[i].emoji}`);
});

test('names in both languages', () => {
  const thumbs = by('👍');
  assert.equal(thumbs.name.en, 'thumbs up');
  assert.equal(thumbs.name.de, 'Daumen hoch');
  assert.ok(list.every((e) => e.name.en && e.name.de), 'every emoji named twice');
});

test('fold: case, accents and ß', () => {
  assert.equal(fold('Lächelndes GESICHT'), 'lachelndes gesicht');
  assert.equal(fold('Straße'), 'strasse');
  assert.equal(fold('Café'), 'cafe');
});

test('search by a word, in the page’s language first', () => {
  assert.equal(first('thumbs up'), '👍');
  assert.equal(first('daumen hoch', 'de'), '👍');
  assert.equal(first('daumen', 'de'), '👍');
  assert.equal(first('Daumen hoch'), '👍', 'the other language finds it too');
  assert.ok(all('herz', 'de').includes('❤️'));
  assert.ok(all('heart').includes('❤️'));
  assert.equal(first('pizza'), '🍕');
  assert.equal(first('grinning face'), '😀', 'a whole name comes first');
});

test('search ignores accents and case', () => {
  const plain = all('lachelnd', 'de');
  assert.ok(plain.length > 5);
  assert.deepEqual(all('Lächelnd', 'de'), plain);
});

test('every word of the search has to match', () => {
  const both = all('cat face');
  assert.ok(both.includes('🐱'));
  assert.ok(!both.includes('🐈'), 'a cat without a face');
  assert.deepEqual(all('xyzzy qwerty'), []);
});

test('keywords find what names don’t', () => {
  assert.ok(all('party').includes('🎉'));
  assert.ok(all('feier', 'de').includes('🎉'));
});

test('a shortcode', () => {
  assert.equal(first(':+1:'), '👍');
  assert.equal(first(':tada'), '🎉');
  assert.equal(first(':thumbsup:'), '👍');
  assert.ok(all(':heart').length > 3);
});

test('a code point', () => {
  assert.equal(first('U+1F600'), '😀');
  assert.equal(first('1f600'), '😀');
  assert.equal(first('0x1F44D'), '👍');
  assert.equal(first('\\u{1F44D}'), '👍');
});

test('the emoji itself, in any tone and without its selector', () => {
  assert.deepEqual(all('👍'), ['👍']);
  assert.deepEqual(all('👍🏽'), ['👍']);
  assert.deepEqual(all('❤'), ['❤️']);
  assert.deepEqual(all('😀 🍕'), ['😀', '🍕']);
});

test('an empty search finds nothing', () => {
  assert.deepEqual(search(list, '   ', 'en'), []);
});

test('five skin tones where Unicode has them', () => {
  const thumbs = by('👍');
  assert.equal(thumbs.tones.length, 5);
  assert.equal(withTone(thumbs, 0), '👍');
  assert.equal(withTone(thumbs, 1), '👍🏻');
  assert.equal(withTone(thumbs, 5), '👍🏿');
  assert.equal(withTone(by('😀'), 3), '😀', 'no tones: as it is');
  assert.equal(by('👍🏾'), thumbs, 'a toned emoji finds its entry');
  assert.ok(list.filter((e) => e.tones).length > 300);
  assert.ok(list.filter((e) => e.tones).every((e) => e.tones.length === 5));
});

test('codes for HTML, CSS and JavaScript', () => {
  assert.deepEqual(codes('😀'), { unicode: 'U+1F600', html: '&#x1F600;', css: '"\\1F600"', js: '\\u{1F600}' });
  const toned = codes('👍🏽');
  assert.equal(toned.unicode, 'U+1F44D U+1F3FD');
  assert.equal(toned.html, '&#x1F44D;&#x1F3FD;');
  assert.equal(toned.css, '"\\1F44D \\1F3FD"');
  assert.equal(codes('❤️').unicode, 'U+2764 U+FE0F', 'the selector is part of it');
});

test('shortcodes from GitHub', () => {
  assert.deepEqual(by('👍').shortcodes.sort(), ['+1', 'thumbsup']);
  assert.ok(by('🎉').shortcodes.includes('tada'));
});

test('one sample per newer Emoji version, newest first', () => {
  const s = samples(list);
  assert.ok(s.length >= 4);
  for (let i = 1; i < s.length; i++) assert.ok(s[i][0] < s[i - 1][0]);
  assert.ok(s.every(([v]) => v >= 12));
  assert.ok(s.every(([v, e]) => by(e).version === v));
});

test('headings and versions as people read them', () => {
  assert.equal(cap('grinsendes Gesicht'), 'Grinsendes Gesicht');
  assert.equal(versionLabel(0.6), '1.0');
  assert.equal(versionLabel(13.1), '13.1');
  assert.equal(versionLabel(15), '15.0');
});

test('the table comes from the emojibase-data installed (rerun make-table.mjs after an update)', async () => {
  const { version } = createRequire(import.meta.url)('emojibase-data/package.json');
  const table = await readFile(new URL('../../src/tools/emoji/table.ts', import.meta.url), 'utf8');
  assert.match(table, new RegExp(`from emojibase-data ${version.replace(/\./g, '\\.')} `));
});
