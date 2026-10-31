import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, StandardFonts, degrees } from 'pdf-lib';
import { quarter, turned, composeRotation, moveStep, moveTo, dropIndex, columns, plan, runLabel } from '../../src/tools/arrange/arrange.ts';
import { writePages } from '../../src/tools/arrange/write.ts';

const board = (...ids) => ids.map((id, i) => ({ id, src: 0, index: i, turn: 0 }));
const order = (pages) => pages.map((p) => p.id).join('');

test('quarter turns: any angle into 0, 90, 180 or 270', () => {
  assert.equal(quarter(0), 0);
  assert.equal(quarter(360), 0);
  assert.equal(quarter(-90), 270);
  assert.equal(quarter(450), 90);
  assert.equal(quarter(-450), 270);
  assert.equal(quarter(89), 90, 'a broken /Rotate snaps to the nearest quarter');
  assert.equal(turned(270, 1), 0);
  assert.equal(turned(0, -1), 270);
});

test('a page’s own turn and the board’s add up', () => {
  assert.equal(composeRotation(90, 90), 180);
  assert.equal(composeRotation(90, 270), 0);
  assert.equal(composeRotation(-90, 90), 0, 'pdf-lib hands back a negative /Rotate as written');
  assert.equal(composeRotation(270, 180), 90);
  assert.equal(composeRotation(720, 0), 0);
});

test('one step earlier or later: runs move together, the edges hold', () => {
  const p = board('a', 'b', 'c', 'd', 'e');
  assert.equal(order(moveStep(p, new Set(['c']), -1)), 'acbde');
  assert.equal(order(moveStep(p, new Set(['c']), 1)), 'abdce');
  assert.equal(order(moveStep(p, new Set(['b', 'c']), -1)), 'bcade');
  assert.equal(order(moveStep(p, new Set(['b', 'c']), 1)), 'adbce');
  assert.equal(order(moveStep(p, new Set(['a', 'c']), -1)), 'acbde', 'a stays first; c still moves');
  assert.equal(order(moveStep(p, new Set(['a', 'b']), -1)), 'abcde');
  assert.equal(order(moveStep(p, new Set(['e']), 1)), 'abcde');
  assert.equal(order(moveStep(p, new Set(['b', 'd']), 1)), 'acbed');
  assert.equal(order(moveStep(p, new Set(), 1)), 'abcde');
});

test('moving to a place: before it, counted on the board as it is', () => {
  const p = board('a', 'b', 'c', 'd', 'e');
  assert.equal(order(moveTo(p, new Set(['a']), 3)), 'bcade', 'a dropped before d');
  assert.equal(order(moveTo(p, new Set(['e']), 0)), 'eabcd');
  assert.equal(order(moveTo(p, new Set(['b']), 5)), 'acdeb', 'to the end');
  assert.equal(order(moveTo(p, new Set(['c']), 2)), 'abcde', 'before itself: nothing changes');
  assert.equal(order(moveTo(p, new Set(['c']), 3)), 'abcde', 'right after itself: nothing changes');
  assert.equal(order(moveTo(p, new Set(['a', 'c']), 5)), 'bdeac', 'several keep their order');
  assert.equal(order(moveTo(p, new Set(['b', 'e']), 0)), 'beacd');
  assert.equal(order(moveTo(p, new Set(['a', 'd']), 3)), 'bcade');
  // Nothing lost, nothing doubled.
  for (let before = 0; before <= 5; before++) {
    const moved = moveTo(p, new Set(['b', 'd']), before);
    assert.equal([...order(moved)].sort().join(''), 'abcde');
  }
});

// Three cards a row, 100 × 100 with gaps of 20: rows at 0, 120, 240.
const grid = (n, perRow = 3) =>
  Array.from({ length: n }, (_, i) => {
    const left = (i % perRow) * 120;
    const top = Math.floor(i / perRow) * 120;
    return { left, top, right: left + 100, bottom: top + 100 };
  });

test('where a drop lands on a wrapping board', () => {
  const r = grid(7);
  assert.equal(dropIndex(r, 10, 50), 0, 'left half of the first card');
  assert.equal(dropIndex(r, 60, 50), 1, 'right half of the first card');
  assert.equal(dropIndex(r, 290, 50), 3, 'past the end of the first row: after its last card');
  assert.equal(dropIndex(r, 130, 170), 4, 'the second row');
  assert.equal(dropIndex(r, 30, 110), 0, 'in the gap under the first row: the nearest row');
  assert.equal(dropIndex(r, 400, 900), 7, 'far below the last, short row: at the end');
  assert.equal(dropIndex(r, 10, -500), 0, 'above everything');
  assert.equal(dropIndex([], 0, 0), 0);
  assert.equal(columns(r), 3);
  assert.equal(columns(grid(2)), 2);
});

test('runs for names', () => {
  assert.equal(runLabel([2]), '2');
  assert.equal(runLabel([2, 3, 4]), '2-4');
  assert.equal(runLabel([1, 3]), null);
  assert.equal(runLabel([]), null);
});

test('what Save makes, and its names', () => {
  const p = board('a', 'b', 'c', 'd');
  const sel = (...ids) => new Set(ids);
  assert.deepEqual(plan(p, 'one', sel(), 'letter.pdf', 'suffix').map((o) => [o.name, order(o.pages)]), [['letter-arranged.pdf', 'abcd']]);
  assert.deepEqual(plan(p, 'one', sel(), 'letter.pdf', 'same')[0].name, 'letter.pdf');
  assert.deepEqual(plan(p, 'selected', sel('b'), 'letter.pdf', 'suffix').map((o) => [o.name, order(o.pages)]), [['letter-p2.pdf', 'b']]);
  assert.deepEqual(plan(p, 'selected', sel('d', 'b', 'c'), 'letter.pdf', 'suffix').map((o) => [o.name, order(o.pages)]), [['letter-p2-4.pdf', 'bcd']]);
  assert.deepEqual(plan(p, 'selected', sel('a', 'c'), 'letter.pdf', 'suffix')[0].name, 'letter-selected.pdf');
  assert.deepEqual(plan(p, 'selected', sel(), 'letter.pdf', 'suffix'), [], 'nothing selected: nothing to save');
  assert.deepEqual(
    plan(p, 'each', sel(), 'letter.pdf', 'same').map((o) => o.name),
    ['letter-p1.pdf', 'letter-p2.pdf', 'letter-p3.pdf', 'letter-p4.pdf'],
    'every page keeps its number, even when names stay the same',
  );
  assert.deepEqual(plan([], 'one', sel(), 'letter.pdf', 'suffix'), []);
});

/** A PDF whose pages say who they are (their size: 500 + n wide), the last one turned. */
async function sample(n, firstWidth, turnLast) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i++) {
    const page = doc.addPage([firstWidth + i, 800]);
    page.drawText(`page ${i + 1}`, { x: 50, y: 700, size: 30, font });
  }
  if (turnLast) doc.getPage(n - 1).setRotation(degrees(turnLast));
  return PDFDocument.load(await doc.save());
}

test('the writer: order across files, turns on top of each page’s own, content copied', async () => {
  const letter = await sample(3, 500, 90);
  const annex = await sample(2, 600, -90);
  const pages = [
    { id: 'x', src: 1, index: 1, turn: 90 }, // annex 2, own -90, +90 → 0
    { id: 'y', src: 0, index: 2, turn: 90 }, // letter 3, own 90, +90 → 180
    { id: 'z', src: 0, index: 0, turn: 0 },
    { id: 'w', src: 1, index: 0, turn: 270 },
  ];
  const out = await PDFDocument.load(await writePages([letter, annex], pages));
  assert.equal(out.getPageCount(), 4);
  assert.deepEqual(
    out.getPages().map((p) => [p.getWidth(), p.getRotation().angle]),
    [
      [601, 0],
      [502, 180],
      [500, 0],
      [600, 270], // annex 1 has no turn of its own
    ],
  );
  // The text is still text: the page keeps its font, and has no picture.
  const resources = out.getPage(2).node.Resources();
  assert.ok(resources.get(PDFName.of('Font')), 'a font');
  assert.equal(resources.lookup(PDFName.of('XObject'))?.keys().length ?? 0, 0, 'no picture');
});

test('the writer takes only the pages on the board', async () => {
  const letter = await sample(3, 500, 0);
  const out = await PDFDocument.load(await writePages([letter], [{ id: 'a', src: 0, index: 1, turn: 0 }]));
  assert.equal(out.getPageCount(), 1);
  assert.equal(out.getPage(0).getWidth(), 501);
});
