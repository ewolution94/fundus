import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, medianColour, edgeColours, groundPaint, isLight, luminance, hex, rgbOf, chrome, GRADIENTS, MAX_SIDE, SAFE_AREA } from '../../src/tools/frame/frame.ts';

const plain = { pad: 'medium', corners: 'medium', shadow: 'soft', device: 'none', shape: 'as-is' };
const inside = (inner, outer) => inner.x >= outer.x - 1e-9 && inner.y >= outer.y - 1e-9 && inner.x + inner.w <= outer.x + outer.w + 1e-9 && inner.y + inner.h <= outer.y + outer.h + 1e-9;

test('as is: the screenshot at its own size with padding a share of its shorter side', () => {
  const l = layout(1179, 2556, plain);
  // 10 % of 1179, rounded.
  assert.deepEqual([l.width, l.height], [1179 + 2 * 118, 2556 + 2 * 118]);
  assert.equal(l.scale, 1);
  assert.deepEqual(l.shot, { x: 118, y: 118, w: 1179, h: 2556 });
  assert.deepEqual(l.body, l.shot);
  assert.deepEqual(l.shotRadii, [35, 35, 35, 35], '3 % of the width');
  for (const [pad, share] of [['small', 0.06], ['large', 0.16]]) {
    const p = layout(1000, 600, { ...plain, pad });
    assert.equal(p.shot.y, Math.round(600 * share));
  }
});

test('corners from none to large', () => {
  assert.deepEqual(layout(1000, 800, { ...plain, corners: 'none' }).shotRadii, [0, 0, 0, 0]);
  assert.equal(layout(1000, 800, { ...plain, corners: 'small' }).shotRadii[0], 15);
  assert.equal(layout(1000, 800, { ...plain, corners: 'large' }).shotRadii[0], 50);
});

test('a shape holds the screenshot and its padding, centred, in exactly that shape', () => {
  for (const [shape, ratio] of [['16:9', 16 / 9], ['1:1', 1], ['4:5', 0.8]]) {
    for (const [w, h] of [[1179, 2556], [2880, 1800], [600, 600], [3840, 1280]]) {
      const l = layout(w, h, { ...plain, shape });
      assert.ok(Math.abs(l.width / l.height - ratio) < 1 / Math.min(l.width, l.height) + 1e-9, `${shape} ${w}×${h}: ${l.width}×${l.height}`);
      assert.equal(l.shot.w, w);
      assert.equal(l.shot.h, h);
      const pad = Math.round(Math.min(w, h) * 0.1);
      assert.ok(l.shot.x >= pad && l.shot.y >= pad, `${l.shot.x},${l.shot.y}`);
      assert.ok(l.width - l.shot.x - w >= pad && l.height - l.shot.y - h >= pad);
      // Centred, to the pixel.
      assert.ok(Math.abs(l.shot.x - (l.width - l.shot.x - w)) <= 1);
      assert.ok(Math.abs(l.shot.y - (l.height - l.shot.y - h)) <= 1);
      assert.ok(Number.isInteger(l.shot.x) && Number.isInteger(l.shot.y), 'whole pixels, so the screenshot isn’t resampled');
    }
  }
  // The phone screenshot in 16:9 grows sideways.
  const wide = layout(1179, 2556, { ...plain, shape: '16:9' });
  assert.equal(wide.height, 2556 + 236);
  assert.equal(wide.width, Math.round(2792 * 16 / 9));
});

test('the phone puts a bezel round the screen, its corners following the screen’s', () => {
  const l = layout(1179, 2556, { ...plain, device: 'phone' });
  const bezel = Math.round(1179 * 0.03);
  assert.equal(l.bezel, bezel);
  assert.deepEqual([l.width, l.height], [1179 + 2 * bezel + 236, 2556 + 2 * bezel + 236]);
  assert.deepEqual(l.body, { x: 118, y: 118, w: 1179 + 2 * bezel, h: 2556 + 2 * bezel });
  assert.deepEqual(l.shot, { x: 118 + bezel, y: 118 + bezel, w: 1179, h: 2556 });
  assert.equal(l.bodyRadii[0], l.shotRadii[0] + bezel);
  assert.ok(l.width > layout(1179, 2556, plain).width);
});

test('the browser puts a bar above the screenshot, with three dots and an address field inside it', () => {
  const l = layout(2880, 1800, { ...plain, device: 'browser' });
  const bar = l.bar;
  assert.ok(bar);
  assert.equal(bar.rect.h, Math.round(2880 * 0.045));
  assert.equal(l.shot.y, bar.rect.y + bar.rect.h);
  assert.equal(l.height, 1800 + bar.rect.h + 2 * 180);
  assert.deepEqual(l.shotRadii.slice(0, 2), [0, 0], 'square where it meets the bar');
  assert.equal(bar.dots.length, 3);
  for (const d of bar.dots) assert.ok(inside({ x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r }, bar.rect));
  assert.ok(inside(bar.pill, bar.rect));
  assert.ok(bar.pill.x > bar.dots[2].x + bar.dots[2].r, 'the field starts after the dots');
  assert.ok(bar.pill.w > 0);
  // A narrow phone screenshot still gets a field that fits.
  const narrow = layout(390, 844, { ...plain, device: 'browser' }).bar;
  assert.ok(inside(narrow.pill, narrow.rect) && narrow.pill.w > 0);
  // Big corners never round the bar more than it's tall.
  const round = layout(400, 800, { ...plain, device: 'browser', corners: 'large' });
  assert.ok(round.bar.radii[0] <= round.bar.rect.h);
});

test('shadows stay inside the padding', () => {
  assert.equal(layout(1000, 800, { ...plain, shadow: 'none' }).shadow, null);
  for (const shadow of ['soft', 'strong']) {
    const l = layout(1000, 800, { ...plain, shadow });
    assert.ok(l.shadow.blur + l.shadow.offsetY < l.shot.y, shadow);
  }
  assert.ok(layout(1000, 800, { ...plain, shadow: 'strong' }).shadow.alpha > layout(1000, 800, { ...plain, shadow: 'soft' }).shadow.alpha);
});

test('never longer than 8000 px; a smaller area when the browser asks for it', () => {
  const huge = layout(7800, 4000, { ...plain, pad: 'large' });
  assert.ok(Math.max(huge.width, huge.height) <= MAX_SIDE);
  assert.ok(huge.scale < 1);
  assert.ok(inside(huge.shot, { x: 0, y: 0, w: huge.width, h: huge.height }));
  const safe = layout(5120, 2880, { ...plain, shape: '16:9' }, { maxArea: SAFE_AREA });
  assert.ok(safe.width * safe.height <= SAFE_AREA);
  assert.ok(Math.abs(safe.width / safe.height - 16 / 9) < 0.002);
  assert.equal(layout(5120, 2880, { ...plain, shape: '16:9' }).scale, 1, 'without the limit, its own pixels');
});

test('median colours of the top and bottom rows, see-through pixels left out', () => {
  // 4 × 3: a dark top row (with one stray pixel), a middle row, a light bottom row with a hole.
  const px = (r, g, b, a = 255) => [r, g, b, a];
  const data = [
    ...px(18, 18, 18), ...px(18, 18, 18), ...px(255, 0, 0), ...px(18, 18, 18),
    ...px(0, 0, 255), ...px(0, 0, 255), ...px(0, 0, 255), ...px(0, 0, 255),
    ...px(245, 245, 242), ...px(245, 245, 242), ...px(245, 245, 242), ...px(0, 0, 0, 0),
  ];
  const e = edgeColours(data, 4, 3, 1);
  assert.deepEqual(e.top, [18, 18, 18]);
  assert.deepEqual(e.bottom, [245, 245, 242]);
  assert.equal(medianColour([0, 0, 0, 0, 9, 9, 9, 10]), null);
  assert.deepEqual(medianColour([10, 20, 30, 255, 20, 30, 40, 255]), [15, 25, 35]);
});

test('grounds: the gradients, the picture’s own edges, a colour, none', () => {
  assert.equal(GRADIENTS.length, 6);
  assert.deepEqual(groundPaint('sea', null, '#000000'), { from: GRADIENTS[4].from, to: GRADIENTS[4].to, vertical: false });
  assert.deepEqual(groundPaint('picture', { top: [18, 18, 18], bottom: [245, 245, 242] }, ''), { from: '#121212', to: '#f5f5f2', vertical: true });
  assert.deepEqual(groundPaint('picture', { top: null, bottom: [1, 2, 3] }, ''), { from: '#010203', to: '#010203', vertical: true });
  assert.deepEqual(groundPaint('picture', { top: null, bottom: null }, ''), groundPaint('paper', null, ''));
  assert.deepEqual(groundPaint('colour', null, '#FFE14A'), { from: '#ffe14a', to: '#ffe14a', vertical: false });
  assert.equal(groundPaint('colour', null, 'nonsense').from, '#ffffff');
  assert.equal(groundPaint('none', null, '#ffffff'), null);
});

test('light and dark grounds, for the browser bar', () => {
  assert.equal(hex([18, 18, 18]), '#121212');
  assert.deepEqual(rgbOf('#ffe14a'), [255, 225, 74]);
  assert.ok(luminance('#ffffff') > 0.99 && luminance('#000000') === 0);
  const light = (id) => isLight(groundPaint(id, null, '#000000'));
  assert.ok(light('paper') && light('highlighter') && light('mint'));
  assert.ok(!light('ink'));
  assert.ok(!isLight(groundPaint('colour', null, '#1d2a44')));
  assert.ok(isLight(null), 'none: light');
  assert.notDeepEqual(chrome(true), chrome(false));
});
