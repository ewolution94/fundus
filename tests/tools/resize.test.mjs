import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centred, reshape, moveRect, resizeRect, snap, capped, heightFor, widthFor, sized, cropOutput, printSize, ratioOf, outType, HANDLES } from '../../src/tools/resize/resize.ts';

const W = 3840;
const H = 2160;
const near = (a, b, d = 1e-6) => assert.ok(Math.abs(a - b) <= d, `${a} ≉ ${b}`);
const inside = (r, w = W, h = H) => assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= w + 1e-6 && r.y + r.h <= h + 1e-6 && r.w > 0 && r.h > 0, JSON.stringify(r));

test('the biggest frame of a shape, in the middle', () => {
  assert.deepEqual(centred(W, H, 1), { x: 840, y: 0, w: 2160, h: 2160 });
  assert.deepEqual(centred(W, H, 16 / 9), { x: 0, y: 0, w: 3840, h: 2160 });
  assert.deepEqual(centred(W, H, null), { x: 0, y: 0, w: W, h: H });
  const tall = centred(W, H, 9 / 16);
  near(tall.h, 2160);
  near(tall.w, 1215);
  near(tall.x, (3840 - 1215) / 2);
  // A wide shape on a tall photo: as wide as the photo.
  assert.deepEqual(centred(1000, 3000, 4 / 3), { x: 0, y: 1125, w: 1000, h: 750 });
});

test('turning 4:3 and 3:2, and only those', () => {
  near(ratioOf('4:3', true), 3 / 4);
  near(ratioOf('3:2', true), 2 / 3);
  near(ratioOf('16:9', true), 16 / 9);
  assert.equal(ratioOf('free', true), null);
  assert.equal(ratioOf('profile', false), 1);
});

test('moving stops at the edges', () => {
  const r = { x: 100, y: 100, w: 1000, h: 1000 };
  assert.deepEqual(moveRect(r, -500, 50, W, H), { x: 0, y: 150, w: 1000, h: 1000 });
  assert.deepEqual(moveRect(r, 99999, 99999, W, H), { x: W - 1000, y: H - 1000, w: 1000, h: 1000 });
});

test('free corners and sides move only their own edges, never past the photo or below the minimum', () => {
  const r = { x: 1000, y: 500, w: 1000, h: 800 };
  assert.deepEqual(resizeRect(r, 'se', 200, 100, W, H, null, 50), { x: 1000, y: 500, w: 1200, h: 900 });
  assert.deepEqual(resizeRect(r, 'nw', -2000, -2000, W, H, null, 50), { x: 0, y: 0, w: 2000, h: 1300 });
  assert.deepEqual(resizeRect(r, 'e', -5000, 0, W, H, null, 50), { x: 1000, y: 500, w: 50, h: 800 });
  assert.deepEqual(resizeRect(r, 'n', 0, 300, W, H, null, 50), { x: 1000, y: 800, w: 1000, h: 500 });
});

test('with a shape, every handle in every direction keeps it, the photo and the minimum', () => {
  for (const ratio of [1, 16 / 9, 9 / 16, 4 / 3, 2 / 3]) {
    const start = reshape({ x: 1200, y: 600, w: 900, h: 700 }, W, H, ratio);
    near(start.w / start.h, ratio);
    for (const handle of HANDLES) {
      for (const [dx, dy] of [[0, 0], [300, 200], [-300, -200], [5000, 5000], [-5000, -5000], [-5000, 5000], [40, -900]]) {
        const r = resizeRect(start, handle, dx, dy, W, H, ratio, 60);
        near(r.w / r.h, ratio, 1e-9);
        inside(r);
        assert.ok(Math.min(r.w, r.h) >= 60 - 1e-9, `${handle} ${dx},${dy}: ${JSON.stringify(r)}`);
      }
    }
  }
});

test('a corner pulls against the opposite corner', () => {
  const r = { x: 1000, y: 500, w: 900, h: 900 };
  const se = resizeRect(r, 'se', 100, 40, W, H, 1, 50);
  assert.deepEqual([se.x, se.y, se.w, se.h], [1000, 500, 1000, 1000], 'the larger pull wins');
  const nw = resizeRect(r, 'nw', 100, 100, W, H, 1, 50);
  assert.deepEqual([nw.x + nw.w, nw.y + nw.h], [1900, 1400]);
  assert.equal(nw.w, 800);
  // Out of room: the bottom edge stops it, the shape holds.
  const big = resizeRect(r, 'se', 4000, 4000, W, H, 1, 50);
  assert.deepEqual(big, { x: 1000, y: 500, w: 1660, h: 1660 });
});

test('a side pulls against the other side, the height growing about the middle', () => {
  const r = { x: 1000, y: 800, w: 400, h: 400 };
  const e = resizeRect(r, 'e', 200, 0, W, H, 1, 50);
  assert.deepEqual(e, { x: 1000, y: 700, w: 600, h: 600 });
  // The middle is 1000 from the top and 1160 from the bottom: at most 2000 tall.
  const far = resizeRect(r, 'e', 9000, 0, W, H, 1, 50);
  assert.deepEqual(far, { x: 1000, y: 0, w: 2000, h: 2000 });
});

test('a new shape keeps about the frame’s place and size, inside the photo', () => {
  const r = reshape({ x: 3000, y: 1500, w: 800, h: 600 }, W, H, 1);
  near(r.w, r.h);
  near(r.w * r.h, 800 * 600, 1);
  inside(r);
  const huge = reshape({ x: 0, y: 0, w: W, h: H }, W, H, 9 / 16);
  inside(huge);
  near(huge.h, H);
});

test('snapped to whole pixels with the shape exact', () => {
  assert.deepEqual(snap({ x: 840.4, y: 0.2, w: 2160.3, h: 2159.9 }, W, H, 1), { x: 840, y: 0, w: 2160, h: 2160 });
  const r = snap(centred(W, H, 9 / 16), W, H, 9 / 16);
  assert.deepEqual([r.w, r.h], [1215, 2160]);
  const s = snap({ x: 3000.7, y: 10, w: 839.6, h: 472.3 }, W, H, 16 / 9);
  assert.deepEqual([s.w, s.h], [840, 473]);
  assert.ok(s.x + s.w <= W);
});

test('sizes: the other side follows the shape; several photos fit one box', () => {
  assert.equal(heightFor(1920, W, H), 1080);
  assert.equal(widthFor(1080, W, H), 1920);
  assert.deepEqual(sized(1600, 900, 800, 800, true), { width: 800, height: 450 });
  assert.deepEqual(sized(900, 1600, 800, 800, true), { width: 450, height: 800 });
  assert.deepEqual(sized(1600, 900, 800, 800, false), { width: 800, height: 800 });
  assert.deepEqual(sized(900, 506, 800, 800, true), { width: 800, height: 450 });
});

test('the profile picture is 800 px square, never enlarged', () => {
  assert.deepEqual(cropOutput({ x: 0, y: 0, w: 2160, h: 2160 }, 'profile'), { width: 800, height: 800 });
  assert.deepEqual(cropOutput({ x: 0, y: 0, w: 600, h: 600 }, 'profile'), { width: 600, height: 600 });
  assert.deepEqual(cropOutput({ x: 0, y: 0, w: 2160, h: 2160 }, '1:1'), { width: 2160, height: 2160 });
});

test('at most what a phone can draw', () => {
  assert.deepEqual(capped(3840, 2160), { width: 3840, height: 2160, capped: false });
  const c = capped(8064, 6048);
  assert.ok(c.capped && c.width * c.height <= 16_777_216, JSON.stringify(c));
  near(c.width / c.height, 8064 / 6048, 0.001);
  assert.ok(capped(30000, 100).width <= 16384);
});

test('print size at 300 dpi', () => {
  assert.deepEqual(printSize(1920, 1080, 'metric'), { w: 16.3, h: 9.1, unit: 'cm' });
  assert.deepEqual(printSize(1920, 1080, 'imperial'), { w: 6.4, h: 3.6, unit: 'in' });
  assert.deepEqual(printSize(800, 800, 'metric'), { w: 6.8, h: 6.8, unit: 'cm' });
});

test('format: the same as the photo by default, WebP only where it can be written', () => {
  assert.equal(outType('png', 'same', true), 'image/png');
  assert.equal(outType('heic', 'same', true), 'image/jpeg');
  assert.equal(outType('jpeg', 'webp', false), 'image/jpeg');
  assert.equal(outType('webp', 'same', false), 'image/jpeg');
  assert.equal(outType('jpeg', 'png', true), 'image/png');
});
