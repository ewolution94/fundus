import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean, NONE, plainQuotes, trimLines, collapseSpaces, joinLines, removeEmpty, setCase, removeDuplicates, sortLines } from '../../src/tools/clean/clean.ts';

const on = (steps) => ({ ...NONE, ...steps });

test('curly quotes, dashes and the ellipsis as a keyboard types them', () => {
  assert.deepEqual(plainQuotes('„Hallo“, sagte sie – und ging… “Yes” — it’s ‘fine’'), {
    text: '"Hallo", sagte sie - und ging... "Yes" -- it\'s \'fine\'',
    n: 10,
  });
  assert.deepEqual(plainQuotes('plain "already" - fine'), { text: 'plain "already" - fine', n: 0 });
});

test('trim lines: spaces, tabs and no-break spaces at both ends, counted per line', () => {
  assert.deepEqual(trimLines('  a  \n\tb\nc\n  d　\n'), { text: 'a\nb\nc\nd\n', n: 3 });
});

test('double spaces between words become one; indentation and line ends are not this step’s', () => {
  assert.deepEqual(collapseSpaces('The  quick brown fox   jumps\t\tover'), { text: 'The quick brown fox jumps over', n: 3 });
  assert.deepEqual(collapseSpaces('    indented  word  '), { text: '    indented word  ', n: 1 });
  assert.deepEqual(collapseSpaces('a\n\nb'), { text: 'a\n\nb', n: 0 }, 'line breaks are not spaces to collapse');
});

test('join stray line breaks: wrapped lines into paragraphs, blank lines and list items stay', () => {
  const wrapped = 'This sentence was\nwrapped by an email\nprogram.\n\nA second\nparagraph.\n- one item\n- another\n1. first\n2) second\n';
  assert.deepEqual(joinLines(wrapped), {
    text: 'This sentence was wrapped by an email program.\n\nA second paragraph.\n- one item\n- another\n1. first\n2) second\n',
    n: 3,
  });
  assert.deepEqual(joinLines('Silben-\ntrennung und  \n  mehr'), { text: 'Silben-trennung und mehr', n: 2 }, 'a hyphen at the end keeps the word together');
});

test('remove empty lines, also lines of only spaces; the final break stays', () => {
  assert.deepEqual(removeEmpty('a\n\n  \nb\n\n'), { text: 'a\nb\n', n: 3 });
  assert.deepEqual(removeEmpty('\n\n'), { text: '', n: 2 });
});

test('case: UPPER, lower, Title Case and Sentence case, locale-aware', () => {
  const t = 'the e-mail from o’neil arrived. it’s 3rd in line!\n\nnew paragraph here';
  assert.equal(setCase(t, 'upper').text, 'THE E-MAIL FROM O’NEIL ARRIVED. IT’S 3RD IN LINE!\n\nNEW PARAGRAPH HERE');
  assert.equal(setCase('SHOUTING Words', 'lower').text, 'shouting words');
  assert.equal(setCase(t, 'title').text, 'The E-Mail From O’neil Arrived. It’s 3rd In Line!\n\nNew Paragraph Here');
  assert.equal(setCase('THE FIRST. THE SECOND? «the third»! next\nline', 'sentence').text, 'The first. The second? «the third»! Next\nline');
  assert.equal(setCase('straße', 'upper', 'de').text, 'STRASSE');
  assert.equal(setCase('istanbul', 'upper', 'tr').text, 'İSTANBUL', 'the locale decides');
  assert.equal(setCase('Hello World', 'upper').n, 2, 'counted in words');
  assert.equal(setCase('Hello World', 'title').n, 0);
});

test('duplicate lines: the first stays, blank lines are never duplicates', () => {
  assert.deepEqual(removeDuplicates('b\na\nb\n\nc\na\n\nb\n'), { text: 'b\na\n\nc\n\n', n: 3 });
});

test('sort lines A–Z and Z–A the way the language sorts, numbers inside in order', () => {
  const t = 'Zebra\nÄpfel\napfel\nItem 10\nItem 2\nBirne\n';
  assert.equal(sortLines(t, 'az', 'de').text, 'apfel\nÄpfel\nBirne\nItem 2\nItem 10\nZebra\n');
  assert.equal(sortLines(t, 'za', 'de').text, 'Zebra\nItem 10\nItem 2\nBirne\nÄpfel\napfel\n');
});

test('sort by number: the first number on a line, with either decimal mark; lines without one last', () => {
  const t = 'Milk 1,29 €\nnothing here\nBread 2.10\n-3 below\nRent 1.500\nTea 0,99';
  assert.equal(sortLines(t, 'num', 'de').text, '-3 below\nTea 0,99\nMilk 1,29 €\nBread 2.10\nRent 1.500\nnothing here');
});

test('sorting puts blank lines last and counts the lines that moved', () => {
  assert.deepEqual(sortLines('b\n\na\nc', 'az'), { text: 'a\nb\nc\n', n: 4 });
  assert.equal(sortLines('a\nb\nc', 'az').n, 0, 'in order already');
});

test('the steps run in a fixed order: joining before removing empty lines keeps paragraphs', () => {
  const t = 'One line\nwrapped.\n\nSecond  paragraph\nwrapped too.\n';
  const r = clean(t, on({ join: true, empty: true, spaces: true }));
  assert.equal(r.text, 'One line wrapped.\nSecond paragraph wrapped too.\n');
  assert.deepEqual([r.changes.joined, r.changes.empty, r.changes.spaces], [2, 1, 1]);
});

test('the fixed order: case before duplicates, duplicates before sorting, quotes before sorting', () => {
  const r = clean('banana\nApple\nBANANA\n“cherry”\napple\n', on({ case: 'lower', dupes: true, sort: 'az', quotes: true }));
  assert.equal(r.text, '"cherry"\napple\nbanana\n');
  assert.equal(r.changes.dupes, 2);
  assert.equal(r.changes.quotes, 2);
});

test('trim before joining: no stray spaces at the joints', () => {
  const r = clean('  first line  \n  second line  ', on({ trim: true, join: true }));
  assert.equal(r.text, 'first line second line');
  assert.equal(r.changes.trimmed, 2);
});

test('the sample notes: Windows line breaks out, every step counted', () => {
  const notes = 'Fundus  test notes.\n\n\nThe  quick brown fox   jumps over the lazy dog.\r\nZweite Zeile mit Umlauten: äöü ß.\n“Smart quotes” and an ellipsis…\n';
  const r = clean(notes, on({ trim: true, spaces: true, empty: true, quotes: true }));
  assert.equal(r.text, 'Fundus test notes.\nThe quick brown fox jumps over the lazy dog.\nZweite Zeile mit Umlauten: äöü ß.\n"Smart quotes" and an ellipsis...\n');
  assert.deepEqual(r.changes, { quotes: 3, trimmed: 0, spaces: 3, joined: 0, empty: 2, cased: 0, dupes: 0, sorted: 0 });
});

test('nothing on, or nothing in: the text as it came (line breaks aside)', () => {
  assert.equal(clean('a\r\nb', NONE).text, 'a\nb');
  const r = clean('', on({ trim: true, empty: true, sort: 'az' }));
  assert.equal(r.text, '');
  assert.equal(Object.values(r.changes).reduce((a, b) => a + b), 0);
});
