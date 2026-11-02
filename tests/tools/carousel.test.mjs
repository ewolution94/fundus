import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTiles, strip, tiles, tileSize, backgroundFor, tileName, RATIOS, TILE_WIDTH } from '../../src/tools/carousel/carousel.ts';

test('the default count: as many tiles as the width holds at full height, 2 to 10', () => {
  assert.equal(defaultTiles(3840, 1280, RATIOS['4:5']), 4, '3.75 rounds to 4');
  assert.equal(defaultTiles(3840, 1280, RATIOS['1:1']), 3);
  assert.equal(defaultTiles(3840, 1280, RATIOS['3:4']), 4);
  assert.equal(defaultTiles(1000, 1000, 1), 2, 'never fewer than 2');
  assert.equal(defaultTiles(30000, 1000, 1), 10, 'never more than 10');
});

test('a photo wider than the strip: its sides go, the strip slides sideways, centred first', () => {
  // 3 tiles of 4:5 at 1280 high: 3072 wide, in a 3840 photo.
  const s = strip(3840, 1280, 3, RATIOS['4:5']);
  assert.deepEqual(s, { x: 384, y: 0, w: 3072, h: 1280, axis: 'x', slack: 768 });
  assert.equal(strip(3840, 1280, 3, 0.8, 0).x, 0);
  assert.equal(strip(3840, 1280, 3, 0.8, 1).x, 768);
});

test('a photo taller than the strip: full width, the strip slides up and down', () => {
  // 4 tiles of 4:5 across 3840: 960 each, 1200 high, in a 1280 photo.
  const s = strip(3840, 1280, 4, RATIOS['4:5']);
  assert.deepEqual(s, { x: 0, y: 40, w: 3840, h: 1200, axis: 'y', slack: 80 });
  assert.equal(strip(3840, 1280, 4, 0.8, 0).y, 0);
  assert.equal(strip(3840, 1280, 4, 0.8, 1).y, 80);
});

test('a strip the photo’s exact shape fills it and doesn’t slide', () => {
  assert.deepEqual(strip(3840, 1280, 3, 1), { x: 0, y: 0, w: 3840, h: 1280, axis: null, slack: 0 });
  assert.equal(strip(3840, 1280, 3, 1, 0.9).x, 0);
});

test('a position out of range stays inside the photo', () => {
  assert.equal(strip(3840, 1280, 3, 0.8, -2).x, 0);
  assert.equal(strip(3840, 1280, 3, 0.8, 7).x, 768);
  assert.equal(strip(3840, 1280, 3, 0.8, NaN).x, 384);
});

test('tiles split the strip evenly, left to right, inside the photo', () => {
  for (const [w, h] of [[3840, 1280], [4032, 3024], [1000, 3000], [12000, 1500]]) {
    for (const ratio of Object.values(RATIOS)) {
      for (let n = 2; n <= 10; n++) {
        for (const p of [0, 0.37, 1]) {
          const s = strip(w, h, n, ratio, p);
          const list = tiles(s, n);
          assert.equal(list.length, n);
          assert.ok(Math.abs(list[0].x - s.x) < 1e-6);
          assert.ok(Math.abs(list[n - 1].x + list[n - 1].w - (s.x + s.w)) < 1e-6);
          for (const t of list) {
            assert.ok(t.x >= -1e-6 && t.y >= -1e-6 && t.x + t.w <= w + 1e-6 && t.y + t.h <= h + 1e-6, `${w}×${h} n${n} ${ratio}`);
            assert.ok(Math.abs(t.w / t.h - ratio) < 1e-6, 'each in the tile’s shape');
          }
        }
      }
    }
  }
});

test('tiles are 1080 wide, never scaled up past the photo’s own pixels', () => {
  // 1:1, 3 tiles of 1280: brought down to 1080.
  assert.deepEqual(tileSize(strip(3840, 1280, 3, 1), 3, 1), { width: 1080, height: 1080, scaled: true });
  // 4:5, 4 tiles of 960 × 1200: kept.
  assert.deepEqual(tileSize(strip(3840, 1280, 4, 0.8), 4, 0.8), { width: 960, height: 1200, scaled: false });
  // 4:5, 3 tiles of 1024 × 1280: kept.
  assert.deepEqual(tileSize(strip(3840, 1280, 3, 0.8), 3, 0.8), { width: 1024, height: 1280, scaled: false });
  // The apps' sizes.
  assert.deepEqual(tileSize({ x: 0, y: 0, w: 8000, h: 2000 }, 4, 0.8), { width: TILE_WIDTH, height: 1350, scaled: true });
  assert.equal(tileSize({ x: 0, y: 0, w: 8000, h: 2000 }, 4, 0.75).height, 1440);
});

test('the preview’s backgrounds show each tile’s part', () => {
  const s = strip(3840, 1280, 4, 0.8);
  const [first, second, , last] = tiles(s, 4);
  // 960 of 3840: the photo is four tiles wide; the strip 40 px down of 80.
  assert.deepEqual(backgroundFor(3840, 1280, first), { size: '400% auto', position: '0% 50%' });
  assert.equal(backgroundFor(3840, 1280, second).position, '33.3333% 50%');
  assert.equal(backgroundFor(3840, 1280, last).position, '100% 50%');
  // A tile as tall as the photo has nowhere to go up or down.
  const full = tiles(strip(3840, 1280, 3, 1), 3);
  assert.equal(backgroundFor(3840, 1280, full[1]).position, '50% 0%');
});

test('names in order', () => {
  assert.deepEqual([0, 1, 9].map((i) => tileName('panorama', i)), ['panorama-1.jpg', 'panorama-2.jpg', 'panorama-10.jpg']);
});
