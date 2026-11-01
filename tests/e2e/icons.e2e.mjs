// F-107 Make icons: a square PNG and an SVG into the ZIP (the ICO with its three PNGs, the Apple
// icon on a solid ground, 192, 512, the maskable one, the SVG as it came, the manifest), a photo
// that isn't square with Fit and Fill, the ground colours, the tags to copy, and an SVG with HTML
// inside refused.

import { unzipSync } from 'fflate';
import { dimensions, sniff } from '../../src/lib/files.ts';

const NAMES = ['apple-touch-icon.png', 'favicon.ico', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'manifest.webmanifest'];
const SIZES = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };

/** Pixels of a PNG, read in the page: [r, g, b, a] at each [x, y]. */
const pixels = (page, bytes, points) =>
  page.evaluate(
    async ({ b64, points }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin]));
      const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
    },
    { b64: Buffer.from(bytes).toString('base64'), points },
  );

/** The ICO's header and its entries, with the PNG each points at. */
function readIco(bytes, assert) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(v.getUint16(0, true), 0, 'reserved');
  assert.equal(v.getUint16(2, true), 1, 'an icon');
  const count = v.getUint16(4, true);
  const entries = [];
  for (let k = 0; k < count; k++) {
    const at = 6 + 16 * k;
    const length = v.getUint32(at + 8, true);
    const offset = v.getUint32(at + 12, true);
    entries.push({ width: bytes[at], height: bytes[at + 1], bits: v.getUint16(at + 6, true), png: bytes.subarray(offset, offset + length) });
  }
  return entries;
}

/** Everything the ZIP must hold, checked: names, sizes, the ICO, the Apple icon opaque. */
async function checkZip(page, assert, out, { svg = false } = {}) {
  assert.equal(sniff(out.bytes), 'other');
  const files = unzipSync(out.bytes);
  const expected = svg ? [...NAMES, 'favicon.svg'].sort() : NAMES;
  assert.deepEqual(Object.keys(files).sort(), expected);
  for (const [name, size] of Object.entries(SIZES)) {
    assert.equal(sniff(files[name]), 'png', name);
    assert.deepEqual(dimensions(files[name]), { width: size, height: size }, name);
  }
  const entries = readIco(files['favicon.ico'], assert);
  assert.deepEqual(
    entries.map((e) => [e.width, e.height, e.bits]),
    [
      [16, 16, 32],
      [32, 32, 32],
      [48, 48, 32],
    ],
  );
  for (const e of entries) {
    assert.equal(sniff(e.png), 'png');
    assert.deepEqual(dimensions(e.png), { width: e.width, height: e.height });
  }
  // iOS paints transparency black: the Apple icon has none, corners included.
  const corners = await pixels(page, files['apple-touch-icon.png'], [
    [0, 0],
    [179, 0],
    [0, 179],
    [179, 179],
  ]);
  for (const c of corners) assert.equal(c[3], 255, `Apple icon corner ${c}`);
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.webmanifest']));
  assert.deepEqual(
    manifest.icons.map((i) => i.src),
    ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'],
  );
  return files;
}

export default {
  async 'a square PNG: the ICO, the Apple icon, 192, 512, maskable and the manifest'({ open, drop, save, assert, page, sees, shot }) {
    await open('/make-icons');
    await shot('empty-390', 390);
    await drop('square.png');
    await sees('600 × 600 · PNG');
    // Square already: no Fit or Fill.
    assert.equal(await page.getByRole('radiogroup', { name: 'Shape' }).count(), 0);
    const out = await save();
    assert.equal(out.name, 'square-icons.zip');
    await checkZip(page, assert, out);
    await sees('6 files in one ZIP');
    await shot('png-1280', 1280);
    await shot('png-390', 390);
  },

  async 'an SVG: drawn sharp at each size, favicon.svg as it came, the tags name it'({ open, drop, save, assert, page, bytes, sees, shot, text }) {
    await open('/make-icons');
    await drop('logo.svg');
    await sees('64 × 64 · SVG');
    const out = await save();
    assert.equal(out.name, 'logo-icons.zip');
    const files = await checkZip(page, assert, out, { svg: true });
    assert.deepEqual(files['favicon.svg'], await bytes('logo.svg'));
    // The logo's rounded corner is see-through at 512 (the SVG drawn at 512, not 64 blown up)…
    const [corner, edge, inside] = await pixels(page, files['icon-512.png'], [
      [0, 0],
      [256, 0],
      [256, 4],
    ]);
    assert.equal(corner[3], 0, 'transparent corner');
    assert.equal(edge[3], 255, 'the top edge is the logo');
    assert.ok(inside[0] > 245 && inside[2] < 90, `yellow inside: ${inside}`);
    // …the Apple icon has white there (the corner pixel is see-through, so the ground is white)…
    const [apple] = await pixels(page, files['apple-touch-icon.png'], [[0, 0]]);
    assert.deepEqual(apple, [255, 255, 255, 255]);
    await sees('Its corner is see-through, so white.');
    // …and the maskable one keeps it inside the safe circle: white well beyond the logo's corner.
    const [maskCorner, maskMiddle] = await pixels(page, files['icon-maskable-512.png'], [
      [100, 100],
      [256, 256],
    ]);
    assert.deepEqual(maskCorner, [255, 255, 255, 255]);
    assert.ok(maskMiddle[3] === 255);
    assert.match(await text('pre.code'), /<link rel="icon" href="\/favicon.svg" type="image\/svg\+xml">/);
    await shot('svg-1280', 1280);
    await shot('svg-390', 390);
  },

  async 'ground colours: black, and an own colour, under the Apple and maskable icons only'({ open, drop, choose, save, assert, page }) {
    await open('/make-icons');
    await drop('logo.svg');
    await choose('Ground', 'Black');
    let files = unzipSync((await save()).bytes);
    assert.deepEqual((await pixels(page, files['apple-touch-icon.png'], [[0, 0]]))[0], [0, 0, 0, 255]);
    assert.equal((await pixels(page, files['icon-192.png'], [[0, 0]]))[0][3], 0, 'the 192 keeps transparency');
    await choose('Ground', 'Own');
    await page.getByLabel('Own colour', { exact: true }).fill('#1d6b3a');
    files = unzipSync((await save()).bytes);
    assert.deepEqual((await pixels(page, files['icon-maskable-512.png'], [[2, 2]]))[0], [0x1d, 0x6b, 0x3a, 255]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fundus:tool:icons') ?? '{}'));
    assert.deepEqual(stored, { ground: 'own', own: '#1d6b3a', shape: 'fit' });
  },

  async 'a photo that isn’t square: Fit shows all of it, Fill crops the middle'({ open, drop, choose, save, assert, page, sees, shot }) {
    await open('/make-icons');
    await drop('photo.png');
    await sees('900 × 506: not square');
    // Fit: bands above and below, transparent in the 512, the ground in the Apple icon.
    let files = await checkZip(page, assert, await save());
    const [fitTop, fitMiddle] = await pixels(page, files['icon-512.png'], [
      [256, 10],
      [256, 256],
    ]);
    assert.equal(fitTop[3], 0, 'band above the photo');
    assert.equal(fitMiddle[3], 255);
    await shot('fit-1280', 1280);
    await choose('Shape', 'Fill');
    files = await checkZip(page, assert, await save());
    const [fillTop, fillCorner] = await pixels(page, files['icon-512.png'], [
      [256, 10],
      [0, 0],
    ]);
    assert.equal(fillTop[3], 255, 'the photo reaches the top');
    assert.equal(fillCorner[3], 255);
    // The maskable icon: the photo inside the safe circle, the ground around it.
    const [maskCorner, maskMiddle] = await pixels(page, files['icon-maskable-512.png'], [
      [60, 60],
      [256, 256],
    ]);
    assert.equal(maskCorner[3], 255);
    assert.equal(maskMiddle[3], 255);
    await shot('fill-390', 390);
  },

  async 'a HEIC photo works too'({ open, drop, save, assert, page }) {
    await open('/make-icons');
    await drop('small.heic');
    await checkZip(page, assert, await save({ timeout: 60_000 }));
  },

  async 'copy the tags and the manifest’s icons'({ open, drop, page, assert, clipboard, engine, sees }) {
    await open('/make-icons');
    await drop('square.png');
    await sees('6 files in one ZIP');
    await page.getByRole('button', { name: 'Copy the tags' }).click();
    if (engine === 'chromium') {
      await sees('Copied');
      const tags = await clipboard();
      assert.match(tags, /<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/);
      assert.doesNotMatch(tags, /favicon.svg/);
    }
    await page.getByRole('button', { name: 'Copy the icons' }).click();
    if (engine === 'chromium') {
      await page.waitForFunction(() => navigator.clipboard.readText().then((t) => t.startsWith('"icons"')));
      const icons = JSON.parse(`{${await clipboard()}}`).icons;
      assert.equal(icons.length, 3);
      assert.equal(icons[2].purpose, 'maskable');
    }
  },

  async 'an SVG with HTML inside: says why; a text file isn’t a picture'({ open, drop, sees, page, assert }) {
    await open('/make-icons');
    await drop('foreign.svg');
    await sees('foreign.svg: this SVG holds HTML inside, which browsers won’t turn into pixels.');
    assert.equal(await page.locator('button.save').count(), 0);
    await drop('notes.txt');
    await sees('notes.txt isn’t a picture this browser can open.');
  },

  async 'fits a phone'({ open, drop, choose, save, fitsPhone }) {
    await open('/make-icons');
    await fitsPhone();
    await drop('photo.png');
    await choose('Ground', 'Own');
    await save();
    await fitsPhone();
  },
};
