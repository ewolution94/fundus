import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrap, fit, classic, caption, capped, shout, strokeOf, LINE_SHARE, DEFAULT_METRICS } from '../../src/tools/meme/meme.ts';

// A model of a condensed face: every character half the size wide, a space a quarter.
const measure = (text, px) => [...text].reduce((sum, c) => sum + (c === ' ' ? 0.25 : 0.5), 0) * px;

test('words wrap greedily, a typed break always breaks', () => {
  assert.deepEqual(wrap('one two three four', 10, 40, measure), ['one two', 'three', 'four']);
  assert.deepEqual(wrap('  spaced   out  ', 10, 1000, measure), ['spaced out']);
  assert.deepEqual(wrap('first\nsecond line', 10, 1000, measure), ['first', 'second line']);
  assert.deepEqual(wrap('', 10, 100, measure), []);
  // A word wider than the line stands alone.
  assert.deepEqual(wrap('a supercalifragilistic b', 10, 30, measure), ['a', 'supercalifragilistic', 'b']);
});

test('fit starts at the largest size when the text fits there', () => {
  const r = fit('HI', { start: 100, floor: 5, maxLines: 3, maxWidth: 1000, measure });
  assert.equal(r.px, 100);
  assert.deepEqual(r.lines, ['HI']);
});

test('fit shrinks until every line fits the width, in three lines at most', () => {
  const text = 'ONE DOES NOT SIMPLY WALK INTO MORDOR WITHOUT A PLAN';
  const r = fit(text, { start: 200, floor: 5, maxLines: 3, maxWidth: 1000, measure });
  assert.ok(r.px < 200);
  assert.ok(r.lines.length <= 3, String(r.lines.length));
  for (const l of r.lines) assert.ok(measure(l, r.px) <= 1000, l);
  // As big as it can be: one step up no longer fits.
  const up = r.px / 0.96;
  const wider = wrap(text, up, 1000, measure);
  assert.ok(wider.length > 3 || wider.some((l) => measure(l, up) > 1000));
});

test('a single long word shrinks until it fits the line', () => {
  const r = fit('DONAUDAMPFSCHIFFFAHRTSGESELLSCHAFT', { start: 300, floor: 5, maxLines: 3, maxWidth: 800, measure });
  assert.equal(r.lines.length, 1);
  assert.ok(measure(r.lines[0], r.px) <= 800);
});

test('fit keeps to a height limit, and stops at its floor without looping', () => {
  const height = (px, n) => px * n;
  const r = fit('A B C', { start: 100, floor: 5, maxLines: 3, maxWidth: 30, height, maxHeight: 60, measure });
  assert.ok(height(r.px, r.lines.length) <= 60);
  const long = 'WORD '.repeat(400);
  const f = fit(long, { start: 100, floor: 8, maxLines: 3, maxWidth: 100, measure });
  assert.equal(f.px, 8);
  assert.ok(f.lines.length > 3, 'at the floor the text keeps every word, on more lines');
});

test('memes shout: upper case, ß becomes SS', () => {
  assert.equal(shout('  größe straße  '), 'GRÖSSE STRASSE');
});

test('classic: top and bottom text centred, inside the photo, lines within 92 %', () => {
  const W = 3840;
  const H = 2160;
  const l = classic(W, H, 'when the tests pass', 'on the first try', 'medium', measure);
  assert.equal(l.width, W);
  assert.equal(l.height, H);
  assert.equal(l.photoY, 0);
  assert.equal(l.x, W / 2);
  for (const b of [l.top, l.bottom]) {
    assert.ok(b.lines.length >= 1 && b.lines.length <= 3);
    for (const line of b.lines) {
      assert.equal(line, line.toUpperCase());
      assert.ok(measure(line, b.px) <= W * LINE_SHARE);
    }
  }
  // Top text starts near the top, bottom text ends near the bottom, both inside.
  const capTop = l.top.baselines[0] - l.top.px * DEFAULT_METRICS.cap - strokeOf(l.top.px) / 2;
  assert.ok(capTop > 0 && capTop < H * 0.06, String(capTop));
  const last = l.bottom.baselines.at(-1) + strokeOf(l.bottom.px) / 2;
  assert.ok(last < H && last > H * 0.94, String(last));
  // Lines go down the page.
  for (const b of [l.top, l.bottom]) for (let i = 1; i < b.baselines.length; i++) assert.ok(b.baselines[i] > b.baselines[i - 1]);
});

test('classic: an empty text has no block', () => {
  const l = classic(800, 600, '   ', 'bottom only', 'medium', measure);
  assert.equal(l.top, null);
  assert.ok(l.bottom);
});

test('classic: Small is smaller and Large bigger than Medium for a short text', () => {
  const at = (size) => classic(1600, 900, 'hi', '', size, measure).top.px;
  assert.ok(at('small') < at('medium'));
  assert.ok(at('large') > at('medium'));
});

test('classic: Small is smaller than Medium for a long text too', () => {
  const text = 'this is a much longer text that will have to wrap over several lines to fit';
  const at = (size) => classic(1600, 900, text, '', size, measure).top.px;
  assert.ok(at('small') < at('medium'), `${at('small')} ${at('medium')}`);
});

test('caption: a bar above the photo, as tall as its lines need, text left-aligned', () => {
  const W = 1600;
  const H = 900;
  const one = caption(W, H, 'short', 'medium', measure);
  const many = caption(W, H, 'a caption long enough to need more than one line in the bar above the photo, surely', 'medium', measure);
  assert.ok(one.photoY > 0);
  assert.equal(one.height, H + one.photoY);
  assert.ok(many.top.lines.length > 1 && many.top.lines.length <= 4);
  assert.ok(many.photoY > one.photoY, 'the bar grows with the lines');
  assert.ok(one.x > 0 && one.x < W * 0.1);
  for (const line of many.top.lines) assert.ok(measure(line, many.top.px) <= W - 2 * many.x);
  // Every baseline inside the bar.
  for (const y of many.top.baselines) assert.ok(y > 0 && y < many.photoY);
  // As typed, not upper case.
  assert.equal(one.top.lines[0], 'short');
});

test('caption: no text, no bar', () => {
  const l = caption(1000, 800, '  ', 'medium', measure);
  assert.equal(l.photoY, 0);
  assert.equal(l.height, 800);
  assert.equal(l.top, null);
});

test('the saved size keeps the photo’s pixels up to 4096 on the longer side', () => {
  assert.deepEqual(capped(3840, 2160), { scale: 1, width: 3840, height: 2160 });
  const big = capped(6000, 4000);
  assert.equal(big.width, 4096);
  assert.equal(big.height, Math.round(4000 * (4096 / 6000)));
  assert.equal(capped(3000, 5000).height, 4096);
});
