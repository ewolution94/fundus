import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, pixelsFor, move, pdfName, pageSize, mmToPt, PAPER } from '../../src/tools/topdf/topdf.ts';

const near = (a, b, d = 0.01) => assert.ok(Math.abs(a - b) <= d, `${a} ≉ ${b}`);
const inside = (l) => {
  const [W, H] = l.page;
  assert.ok(l.box.x >= -1e-9 && l.box.y >= -1e-9 && l.box.x + l.box.w <= W + 1e-9 && l.box.y + l.box.h <= H + 1e-9, JSON.stringify(l));
};

test('auto turns an A4 page to suit a wide photo, and fits it inside the margins, centred', () => {
  const l = layout(3840, 2160, 'a4', 'a4', 'auto', 'small');
  assert.deepEqual(l.page, [841.89, 595.28]);
  const m = mmToPt(6);
  // The wide photo fills the width between the margins; centred vertically.
  near(l.box.w, 841.89 - 2 * m);
  near(l.box.h, (841.89 - 2 * m) * (2160 / 3840));
  near(l.box.x, m);
  near(l.box.y, (595.28 - l.box.h) / 2);
  near(l.box.w / l.box.h, 3840 / 2160, 1e-9);
  inside(l);
});

test('a tall photo on a portrait page fills the height', () => {
  const l = layout(1000, 3000, 'letter', 'a4', 'auto', 'none');
  assert.deepEqual(l.page, PAPER.letter);
  near(l.box.h, 792);
  near(l.box.w, 264);
  near(l.box.x, (612 - 264) / 2);
  inside(l);
});

test('a chosen orientation wins over the photo', () => {
  assert.deepEqual(layout(3840, 2160, 'a4', 'a4', 'portrait', 'none').page, [595.28, 841.89]);
  assert.deepEqual(layout(900, 1600, 'letter', 'letter', 'landscape', 'none').page, [792, 612]);
  // A wide photo on a portrait page: as wide as the page, small in height.
  const l = layout(3840, 2160, 'a4', 'a4', 'portrait', 'normal');
  near(l.box.w, 595.28 - 2 * mmToPt(15));
  inside(l);
});

test('small photos are fitted up too (a scan fills its page)', () => {
  const l = layout(300, 400, 'a4', 'a4', 'auto', 'none');
  // A4 is narrower than 3:4, so the width decides.
  near(l.box.w, 595.28);
  near(l.box.h, 595.28 / 0.75);
  inside(l);
});

test('"Fit the photo": the page takes the photo’s shape, the margin around it', () => {
  const m = mmToPt(15);
  const l = layout(3840, 2160, 'fit', 'a4', 'portrait', 'normal');
  near(l.page[0], 841.89);
  near(l.page[0] - 2 * m, l.box.w);
  near(l.box.w / l.box.h, 3840 / 2160, 1e-9);
  near(l.page[1], l.box.h + 2 * m);
  assert.deepEqual([l.box.x, l.box.y], [m, m]);
  const letter = layout(1000, 2000, 'fit', 'letter', 'auto', 'none');
  near(letter.page[1], 792);
  near(letter.page[0], 396);
});

test('pixels: at most 300 dpi of the drawn size, never enlarged, shape kept', () => {
  // 808 pt wide is 3366 px at 300 dpi: the 4K photo comes down to that.
  const big = pixelsFor({ x: 0, y: 0, w: 808, h: 454.5 }, 3840, 2160);
  assert.equal(big.width, 3367);
  near(big.width / big.height, 3840 / 2160, 0.002);
  // A small photo keeps its pixels.
  assert.deepEqual(pixelsFor({ x: 0, y: 0, w: 808, h: 454.5 }, 900, 506), { width: 900, height: 506 });
  // An A4 page width at 300 dpi is 2480 px.
  assert.equal(pixelsFor({ x: 0, y: 0, w: 595.28, h: 841.89 }, 6000, 8485).width, 2480);
});

test('moving pages', () => {
  assert.deepEqual(move(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(move(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(move(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c']);
  assert.deepEqual(move(['a', 'b', 'c'], 0, 9), ['b', 'c', 'a']);
  const list = ['a', 'b'];
  move(list, 0, 1);
  assert.deepEqual(list, ['a', 'b'], 'the list given stays as it was');
});

test('the name follows the first photo', () => {
  assert.equal(pdfName('IMG_4127.HEIC', 'suffix'), 'IMG_4127-scan.pdf');
  assert.equal(pdfName('Rechnung März.jpg', 'same'), 'Rechnung März.pdf');
});

test('page sizes in mm or inches', () => {
  const f = (n, max) => String(Number(n.toFixed(max)));
  assert.equal(pageSize(PAPER.a4, 'metric', f), '210 × 297 mm');
  assert.equal(pageSize([792, 612], 'imperial', f), '11 × 8.5 in');
});
