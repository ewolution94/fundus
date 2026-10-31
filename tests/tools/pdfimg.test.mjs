import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelSize, parsePages, formatPages, pageName, MAX_PIXELS } from '../../src/tools/pdfimg/pdfimg.ts';

test('dpi to pixels: points × dpi / 72', () => {
  // An A4 page (595 × 842 pt): the sizes people know.
  assert.deepEqual(pixelSize(595, 842, 72), { width: 595, height: 842, scale: 1, clamped: false });
  const at150 = pixelSize(595, 842, 150);
  assert.deepEqual([at150.width, at150.height], [1240, 1754]);
  assert.equal(at150.scale, 150 / 72);
  const at300 = pixelSize(595, 842, 300);
  assert.deepEqual([at300.width, at300.height], [2479, 3508]);
  // US Letter, 612 × 792 pt, is 8.5 × 11 in: exactly 2550 × 3300 at 300 dpi.
  const letter = pixelSize(612, 792, 300);
  assert.deepEqual([letter.width, letter.height], [2550, 3300]);
});

test('a page turned on its side swaps the sides it is given', () => {
  const side = pixelSize(842, 595, 150);
  assert.deepEqual([side.width, side.height], [1754, 1240]);
});

test('a poster is drawn smaller to stay under the canvas limit, keeping its shape', () => {
  // A0, 2384 × 3370 pt, at 300 dpi would be 9933 × 14042: 139 million pixels.
  const a0 = pixelSize(2384, 3370, 300);
  assert.equal(a0.clamped, true);
  assert.ok(a0.width * a0.height <= MAX_PIXELS, `${a0.width} × ${a0.height}`);
  assert.ok(a0.width * a0.height > MAX_PIXELS * 0.99, 'not much smaller than it has to be');
  assert.ok(Math.abs(a0.width / a0.height - 2384 / 3370) < 0.001);
  assert.ok(a0.scale < 300 / 72);
  // Exactly at the limit is fine.
  assert.equal(pixelSize(4096, 4096, 72).clamped, false);
});

test('page numbers as people type them', () => {
  assert.deepEqual(parsePages('1-3, 5', 10), { pages: [1, 2, 3, 5], bad: false });
  assert.deepEqual(parsePages('2–4', 10).pages, [2, 3, 4]);
  assert.deepEqual(parsePages('1 - 3', 10).pages, [1, 2, 3]);
  assert.deepEqual(parsePages('7-', 9).pages, [7, 8, 9]);
  assert.deepEqual(parsePages('-2', 9).pages, [1, 2]);
  assert.deepEqual(parsePages('3-1', 9).pages, [1, 2, 3]);
  assert.deepEqual(parsePages('5 2 2;1', 9).pages, [1, 2, 5]);
  assert.deepEqual(parsePages('', 9), { pages: [], bad: false });
});

test('pages that don’t exist, or words, are bad', () => {
  assert.deepEqual(parsePages('4', 3), { pages: [], bad: true });
  assert.deepEqual(parsePages('2-5', 3), { pages: [2, 3], bad: true });
  assert.equal(parsePages('0', 3).bad, true);
  assert.equal(parsePages('two', 3).bad, true);
  assert.equal(parsePages('-', 3).bad, true);
});

test('pages written back as ranges, and read again the same', () => {
  assert.equal(formatPages([1, 2, 3, 5]), '1–3, 5');
  assert.equal(formatPages([5, 1, 2]), '1, 2, 5');
  assert.equal(formatPages([]), '');
  assert.equal(formatPages([1, 2, 3, 4, 7, 8, 9, 12]), '1–4, 7–9, 12');
  for (const pages of [[1], [1, 2, 3, 5], [2, 4, 6], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]) {
    assert.deepEqual(parsePages(formatPages(pages), 10).pages, pages);
  }
});

test('names: letter-p1.jpg, and the number stays when there are several', () => {
  assert.equal(pageName('letter.pdf', 1, 'jpg', 'suffix', true), 'letter-p1.jpg');
  assert.equal(pageName('letter.pdf', 2, 'png', 'suffix', false), 'letter-p2.png');
  assert.equal(pageName('letter.pdf', 2, 'png', 'same', false), 'letter.png');
  assert.equal(pageName('letter.pdf', 3, 'jpg', 'same', true), 'letter-p3.jpg');
  assert.equal(pageName('Scans/Vertrag 2026.final.PDF', 12, 'jpg', 'suffix', true), 'Vertrag 2026.final-p12.jpg');
});
