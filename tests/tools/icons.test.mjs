import { test } from 'node:test';
import assert from 'node:assert/strict';
import { place, ico, contents, linkTags, manifestIcons, manifest, hex, groundFrom, SAFE, ICONS, FAVICON_SIZES } from '../../src/tools/icons/icons.ts';

const near = (actual, expected) => {
  for (const k of Object.keys(expected)) assert.ok(Math.abs(actual[k] - expected[k]) < 1e-9, `${k}: ${actual[k]} ≠ ${expected[k]}`);
};

test('a square picture fills a square icon, Fit or Fill alike', () => {
  for (const shape of ['fit', 'fill']) {
    const { box, draw } = place(600, 600, 512, shape);
    near(box, { x: 0, y: 0, w: 512, h: 512 });
    near(draw, { x: 0, y: 0, w: 512, h: 512 });
  }
});

test('Fit: a wide picture whole, centred, bands above and below', () => {
  const { box, draw } = place(900, 300, 192, 'fit');
  near(box, { x: 0, y: 64, w: 192, h: 64 });
  near(draw, box);
  // A tall one: bands left and right.
  near(place(100, 400, 48, 'fit').draw, { x: 18, y: 0, w: 12, h: 48 });
});

test('Fill: a wide picture covers the square, its middle shows', () => {
  const { box, draw } = place(900, 300, 192, 'fill');
  near(box, { x: 0, y: 0, w: 192, h: 192 });
  near(draw, { x: -192, y: 0, w: 576, h: 192 });
});

test('maskable: the picture inside the safe circle, its corners on it', () => {
  const size = 512;
  const { box, draw } = place(64, 64, size, 'fit', true);
  const side = (size * SAFE) / Math.SQRT2;
  near(box, { x: (size - side) / 2, y: (size - side) / 2, w: side, h: side });
  near(draw, box);
  // The box's corners lie on the circle of 80 %.
  const corner = Math.hypot(box.x - size / 2, box.y - size / 2);
  assert.ok(Math.abs(corner - (size * SAFE) / 2) < 1e-9);
  // A wide picture: its diagonal is the circle's diameter.
  const wide = place(300, 100, size, 'fit', true).box;
  assert.ok(Math.abs(Math.hypot(wide.w, wide.h) - size * SAFE) < 1e-9);
  assert.ok(Math.abs(wide.w / wide.h - 3) < 1e-9);
  // Fill: a square of its middle in the circle, drawn wider than the box (the box clips it).
  const fill = place(300, 100, size, 'fill', true);
  near(fill.box, { w: side, h: side });
  assert.ok(fill.draw.w > fill.box.w && Math.abs(fill.draw.h - side) < 1e-9);
});

/** The start of a PNG: its signature, IHDR, and a size. */
const fakePng = (size, extra = 0) => {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, size);
  v.setUint32(20, size);
  b.fill(size, 33);
  return b;
};

test('the ICO: its header, one entry per PNG, the PNGs as they were', () => {
  const pngs = FAVICON_SIZES.map((size, k) => ({ size, png: fakePng(size, 10 * k) }));
  const out = ico(pngs);
  const v = new DataView(out.buffer, out.byteOffset, out.byteLength);
  assert.equal(v.getUint16(0, true), 0, 'reserved');
  assert.equal(v.getUint16(2, true), 1, 'type: icon');
  assert.equal(v.getUint16(4, true), 3, 'count');
  let offset = 6 + 16 * 3;
  pngs.forEach(({ size, png }, k) => {
    const at = 6 + 16 * k;
    assert.equal(out[at], size, 'width');
    assert.equal(out[at + 1], size, 'height');
    assert.equal(out[at + 2], 0, 'no palette');
    assert.equal(out[at + 3], 0, 'reserved');
    assert.equal(v.getUint16(at + 4, true), 1, 'planes');
    assert.equal(v.getUint16(at + 6, true), 32, 'bits');
    assert.equal(v.getUint32(at + 8, true), png.length, 'length');
    assert.equal(v.getUint32(at + 12, true), offset, 'offset');
    assert.deepEqual(out.subarray(offset, offset + png.length), png);
    offset += png.length;
  });
  assert.equal(out.length, offset);
});

test('the ICO writes 256 px as 0', () => {
  const out = ico([{ size: 256, png: fakePng(256) }]);
  assert.equal(out[6], 0);
  assert.equal(out[7], 0);
});

test('what the ZIP holds: six files, seven with an SVG', () => {
  assert.deepEqual(
    contents(false).map((f) => f.name),
    ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'manifest.webmanifest'],
  );
  assert.deepEqual(contents(true)[1], { name: 'favicon.svg', sizes: [] });
  assert.equal(contents(true).length, 7);
  assert.deepEqual(contents(false)[0].sizes, [16, 32, 48]);
});

test('the Apple and the maskable icon stand on the ground; the others keep transparency', () => {
  assert.deepEqual(
    ICONS.filter((i) => i.ground).map((i) => i.name),
    ['apple-touch-icon.png', 'icon-maskable-512.png'],
  );
  assert.deepEqual(
    ICONS.filter((i) => i.safe).map((i) => i.name),
    ['icon-maskable-512.png'],
  );
});

test('the link tags, with and without an SVG', () => {
  const svg = linkTags(true);
  assert.match(svg, /<link rel="icon" href="\/favicon.ico" sizes="32x32">/);
  assert.match(svg, /<link rel="icon" href="\/favicon.svg" type="image\/svg\+xml">/);
  assert.match(svg, /<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/);
  assert.match(svg, /<link rel="manifest" href="\/manifest.webmanifest">/);
  assert.equal(svg.split('\n').length, 4);
  const png = linkTags(false);
  assert.doesNotMatch(png, /svg|sizes/);
  assert.equal(png.split('\n').length, 3);
});

test('the manifest’s icons: the 192, the 512 and the maskable one, as JSON', () => {
  const icons = JSON.parse(`{${manifestIcons()}}`).icons;
  assert.deepEqual(icons, [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);
  // Laid out to read: two spaces in, one field a line.
  assert.match(manifestIcons(), /^"icons": \[\n  \{\n    "src": "\/icon-192.png",\n/);
  const whole = JSON.parse(manifest('logo'));
  assert.equal(whole.name, 'logo');
  assert.deepEqual(whole.icons, icons);
});

test('the ground from the picture: an opaque corner, else none', () => {
  assert.equal(hex(255, 225, 74), '#ffe14a');
  assert.equal(hex(0, 0, 0), '#000000');
  assert.equal(groundFrom([18, 18, 18, 255]), '#121212');
  assert.equal(groundFrom(new Uint8ClampedArray([255, 255, 255, 254])), null);
  assert.equal(groundFrom([0, 0, 0, 0]), null);
});
