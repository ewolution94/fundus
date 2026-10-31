import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockPx, pixelate, region, fromCorners, moveBox, resizeBox, middleBox, boxesKey, MIN_BLOCK } from '../../src/tools/blur/blur.ts';

/** A width × height RGBA buffer where every pixel is different (a gradient with noise). */
function picture(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    data[i] = (i / 4) % 256;
    data[i + 1] = seed % 256;
    data[i + 2] = (seed >> 8) % 256;
    data[i + 3] = 255;
  }
  return data;
}

const px = (data, width, x, y) => Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));

test('blocks are coarse on any photo: a share of the long side, never under 8 px', () => {
  assert.equal(blockPx(3840, 2160, 'large'), 120);
  assert.equal(blockPx(3840, 2160, 'medium'), 70);
  assert.equal(blockPx(3840, 2160, 'small'), 43);
  assert.equal(blockPx(2160, 3840, 'large'), 120, 'upright the same');
  assert.equal(blockPx(400, 300, 'small'), MIN_BLOCK);
  assert.ok(blockPx(1600, 900, 'small') < blockPx(1600, 900, 'medium') && blockPx(1600, 900, 'medium') < blockPx(1600, 900, 'large'));
});

test('every block is one colour, the exact average of what was there', () => {
  const W = 50;
  const H = 30;
  const data = picture(W, H);
  const before = data.slice();
  pixelate(data, W, H, 16);
  // Blocks at 0, 16, 32, 48 across (the last 2 wide) and 0, 16 down (the last 14 high).
  for (const [bx, by, bw, bh] of [[0, 0, 16, 16], [16, 16, 16, 14], [48, 0, 2, 16], [48, 16, 2, 14]]) {
    const sum = [0, 0, 0, 0];
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) px(before, W, x, y).forEach((v, k) => (sum[k] += v));
    const mean = sum.map((s) => Math.round(s / (bw * bh)));
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) assert.deepEqual(px(data, W, x, y), mean, `${x},${y}`);
  }
});

test('pixelating is for good: different pictures give the same blocks when their averages match', () => {
  const W = 8;
  const a = new Uint8ClampedArray(W * W * 4).fill(255);
  const b = new Uint8ClampedArray(W * W * 4).fill(255);
  // a: a black stroke on the left; b: the same ink spread out. Same average, so the same result.
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < 2; x++) a.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 3);
    b.fill(0, (y * W + ((y * 3) % W)) * 4, (y * W + ((y * 3) % W)) * 4 + 3);
    b.fill(0, (y * W + ((y * 3 + 4) % W)) * 4, (y * W + ((y * 3 + 4) % W)) * 4 + 3);
  }
  pixelate(a, W, W, 8);
  pixelate(b, W, W, 8);
  assert.deepEqual(a, b);
});

test('a block as big as the region makes it one colour', () => {
  const data = picture(10, 10);
  pixelate(data, 10, 10, 100);
  const first = px(data, 10, 0, 0);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) assert.deepEqual(px(data, 10, x, y), first);
});

test('a box’s region covers it to whole pixels, inside the photo, at any scale', () => {
  assert.deepEqual(region({ x: 10.4, y: 5.6, w: 20.2, h: 10 }, 100, 100), { x: 10, y: 5, w: 21, h: 11 });
  assert.deepEqual(region({ x: 90, y: 90, w: 30, h: 30 }, 100, 100), { x: 90, y: 90, w: 10, h: 10 });
  assert.deepEqual(region({ x: 1000, y: 500, w: 400, h: 200 }, 3840, 2160, 0.25), { x: 250, y: 125, w: 100, h: 50 });
});

test('drawing a box from any corner, clamped to the photo', () => {
  assert.deepEqual(fromCorners(100, 80, 20, 10, 200, 100), { x: 20, y: 10, w: 80, h: 70 });
  assert.deepEqual(fromCorners(-50, 50, 250, 150, 200, 100), { x: 0, y: 50, w: 200, h: 50 });
});

test('moving and resizing boxes stay inside and keep their own fields', () => {
  const b = { id: 3, x: 100, y: 100, w: 50, h: 40, style: 'black' };
  assert.deepEqual(moveBox(b, 1000, -1000, 400, 300), { id: 3, x: 350, y: 0, w: 50, h: 40, style: 'black' });
  assert.deepEqual(resizeBox(b, 'se', 30, 20, 400, 300, 10), { ...b, w: 80, h: 60 });
  assert.deepEqual(resizeBox(b, 'nw', 500, 500, 400, 300, 10), { ...b, x: 140, y: 130, w: 10, h: 10 });
  assert.deepEqual(resizeBox(b, 'ne', 1000, -1000, 400, 300, 10), { ...b, y: 0, w: 300, h: 140 });
});

test('the middle box and the key', () => {
  assert.deepEqual(middleBox(1000, 500), { x: 400, y: 200, w: 200, h: 100 });
  assert.equal(boxesKey([{ id: 1, x: 1.4, y: 2.6, w: 10, h: 20, style: 'pixelate' }, { id: 2, x: 0, y: 0, w: 5, h: 5, style: 'black' }]), 'p1,3,10,20;b0,0,5,5');
});
