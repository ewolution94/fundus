import { test } from 'node:test';
import assert from 'node:assert/strict';
import { count, countWords, countCharacters, countSentences, countParagraphs, countLines, splitDuration } from '../../src/tools/count/count.ts';
import { decodeText, unixLines } from '../../src/lib/textfile.ts';

test('characters are what a reader sees: emoji with skin tones, families and accents count once', () => {
  assert.deepEqual(countCharacters('👍🏽'), { all: 1, noSpaces: 1 });
  assert.deepEqual(countCharacters('👨‍👩‍👧'), { all: 1, noSpaces: 1 });
  assert.deepEqual(countCharacters('é'), { all: 1, noSpaces: 1 }, 'e plus a combining accent is one é');
  assert.deepEqual(countCharacters('🇩🇪'), { all: 1, noSpaces: 1 }, 'a flag is two code points, one character');
  assert.equal('👍🏽'.length, 4, 'what .length would have said');
});

test('characters with and without spaces: spaces, tabs and line breaks', () => {
  assert.deepEqual(countCharacters('a b\tc\nd'), { all: 7, noSpaces: 4 });
  assert.deepEqual(countCharacters('a\r\nb'), { all: 3, noSpaces: 2 }, 'a Windows line break is one character');
  assert.deepEqual(countCharacters(''), { all: 0, noSpaces: 0 });
});

test('words: German compounds are one, emoji and punctuation none', () => {
  assert.equal(countWords('Donaudampfschifffahrtsgesellschaft', 'de'), 1);
  assert.equal(countWords('Hello 👋🏽 world!', 'en'), 2);
  assert.equal(countWords('— … !!', 'en'), 0);
  assert.equal(countWords('Straße, Größe; Übermaß.', 'de'), 3);
  assert.equal(countWords("don't won’t", 'en'), 2, 'apostrophes stay inside the word');
  assert.equal(countWords('3.14 und 1,000', 'de'), 3, 'a number with its mark is one word');
});

test('words: hyphenated compounds count once, a free-standing dash doesn’t join', () => {
  assert.equal(countWords('E-Mail-Adresse', 'de'), 1);
  assert.equal(countWords('well-known state-of-the-art', 'en'), 2);
  assert.equal(countWords('Montag - Freitag', 'de'), 2);
  assert.equal(countWords('Montag – Freitag', 'de'), 2);
});

test('sentences: titles and abbreviations before a capital don’t end one', () => {
  assert.equal(countSentences('Dr. Müller kam. Er ging! Warum? Weil.', 'de'), 4);
  assert.equal(countSentences('Mr. Smith went to Washington. He left.', 'en'), 2);
  assert.equal(countSentences('Wir kaufen z.B. Äpfel. Dann gehen wir.', 'de'), 2);
  assert.equal(countSentences('Yes. No. Maybe.', 'en'), 3, 'short sentences are still sentences');
  assert.equal(countSentences('Äpfel, Birnen usw. Dann ging er.', 'de'), 2, 'usw. may end a sentence');
  assert.equal(countSentences('A heading\nA line without a stop\n', 'en'), 2, 'a line break ends one');
  assert.equal(countSentences('   ', 'en'), 0);
});

test('paragraphs are blocks between blank lines; lines as an editor numbers them', () => {
  const t = 'One\ntwo\n\n\nThree\n  \nFour\n';
  assert.equal(countParagraphs(t), 3);
  assert.equal(countLines(t), 7);
  assert.equal(countLines('a\r\nb'), 2);
  assert.equal(countLines('a\n'), 1, 'a trailing line break opens no new line');
  assert.equal(countLines(''), 0);
  assert.equal(countParagraphs(''), 0);
});

test('the sample notes, counted', () => {
  const notes = 'Fundus  test notes.\n\n\nThe  quick brown fox   jumps over the lazy dog.\r\nZweite Zeile mit Umlauten: äöü ß.\n“Smart quotes” and an ellipsis…\n';
  const c = count(notes, 'en');
  assert.equal(c.words, 23);
  assert.equal(c.sentences, 4);
  assert.equal(c.paragraphs, 2);
  assert.equal(c.lines, 6);
  assert.equal(c.characters, 136);
  assert.equal(c.charactersNoSpaces, 107);
});

test('reading at 230 and speaking at 130 words a minute', () => {
  const text = Array.from({ length: 460 }, () => 'word').join(' ');
  const c = count(text);
  assert.equal(c.words, 460);
  assert.equal(c.reading, 120);
  assert.ok(Math.abs(c.speaking - (460 / 130) * 60) < 1e-9);
  assert.equal(count('').reading, 0);
});

test('durations: seconds under ten minutes, then minutes, then hours; never 0 s for a word', () => {
  assert.deepEqual(splitDuration(0), { h: 0, m: 0, s: 0 });
  assert.deepEqual(splitDuration(0.26), { h: 0, m: 0, s: 1 });
  assert.deepEqual(splitDuration(45.4), { h: 0, m: 0, s: 45 });
  assert.deepEqual(splitDuration(200), { h: 0, m: 3, s: 20 });
  assert.deepEqual(splitDuration(599.4), { h: 0, m: 9, s: 59 });
  assert.deepEqual(splitDuration(845), { h: 0, m: 14, s: 0 });
  assert.deepEqual(splitDuration(3900), { h: 1, m: 5, s: 0 });
  assert.deepEqual(splitDuration(NaN), { h: 0, m: 0, s: 0 });
});

test('a .txt in UTF-8, with its mark, in UTF-16 and from old Windows', () => {
  const enc = new TextEncoder();
  assert.deepEqual(decodeText(enc.encode('Grüße')), { text: 'Grüße' });
  assert.deepEqual(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('Grüße')])), { text: 'Grüße' });
  const le = new Uint8Array([0xff, 0xfe, ...[...'Grüße'].flatMap((ch) => [ch.charCodeAt(0), 0])]);
  assert.deepEqual(decodeText(le), { text: 'Grüße' });
  // windows-1252: ü is 0xFC, ß 0xDF, and the curly quotes 0x93/0x94.
  assert.deepEqual(decodeText(new Uint8Array([0x47, 0x72, 0xfc, 0xdf, 0x65, 0x20, 0x93, 0x61, 0x94])), { text: 'Grüße “a”' });
});

test('photos, PDFs and other binary files are turned away', () => {
  assert.deepEqual(decodeText(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0])), { error: 'binary' });
  assert.deepEqual(decodeText(new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n')), { error: 'binary' });
  assert.deepEqual(decodeText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0])), { error: 'binary' }, 'a ZIP');
  assert.deepEqual(decodeText(new Uint8Array(Array.from({ length: 200 }, (_, i) => (i % 3 ? 0x41 : 0x02)))), { error: 'binary' });
  assert.deepEqual(decodeText(new Uint8Array(5_000_001)), { error: 'big' });
});

test('line breaks from any system become \\n', () => {
  assert.equal(unixLines('a\r\nb\rc\nd'), 'a\nb\nc\nd');
});
