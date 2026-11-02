// F-109 Screenshot frame, with the phone screenshot (a 1179 × 2556 PNG: a dark bar at the top,
// light below): the padding's sums to the pixel, the screenshot's own pixels untouched inside,
// 16:9, a see-through corner, JPG, the phone frame, the browser bar, the ground from its edges.

import { dimensions, sniff } from '../../src/lib/files.ts';

const b64 = (bytes) => Buffer.from(bytes).toString('base64');

/** Pixels of a saved picture, read in the page: each [x, y] as [r, g, b, a]. */
async function pixels(page, bytes, points) {
  return page.evaluate(
    async ({ data, points }) => {
      const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin]), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
    },
    { data: b64(bytes), points },
  );
}

const near = (a, b, d = 6) => a.every((v, i) => Math.abs(v - b[i]) <= d);

export default {
  async 'as is: the screenshot with 10 % of its width round it, its pixels as they were'({ open, drop, save, assert, page, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    const out = await save();
    assert.equal(out.name, 'screenshot-framed.png');
    assert.equal(sniff(out.bytes), 'png');
    // Medium padding: 10 % of the shorter side (1179), rounded: 118.
    assert.deepEqual(dimensions(out.bytes), { width: 1179 + 236, height: 2556 + 236 });
    // Inside: the dark bar and the yellow rows, as in the screenshot (away from its rounded corners).
    const [dark, yellow, light] = await pixels(page, out.bytes, [
      [118 + 600, 118 + 150],
      [118 + 600, 118 + 500],
      [118 + 600, 118 + 2500],
    ]);
    assert.ok(near(dark, [18, 18, 18, 255], 1), String(dark));
    assert.ok(near(yellow, [255, 225, 74, 255], 1), String(yellow));
    assert.ok(near(light, [245, 245, 242, 255], 1), String(light));
    // Outside: the Paper ground, opaque.
    const [corner] = await pixels(page, out.bytes, [[2, 2]]);
    assert.equal(corner[3], 255);
    assert.ok(near(corner, [247, 244, 236, 255], 4), String(corner));
  },

  async '16:9 makes a 16:9 picture, the screenshot in its middle'({ open, drop, choose, save, assert, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    await choose('Size', '16:9');
    const out = await save();
    const { width, height } = dimensions(out.bytes);
    assert.ok(Math.abs(width / height - 16 / 9) < 0.002, `${width} × ${height}`);
    assert.equal(height, 2556 + 236);
  },

  async 'no ground leaves the corners see-through, and JPG can’t be chosen'({ open, drop, choose, save, assert, page, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    await choose('Shadow', 'Strong');
    await choose('Ground', 'None');
    await sees('See-through');
    assert.ok(await page.getByRole('radiogroup', { name: 'Format' }).getByRole('radio', { name: 'JPG' }).isDisabled());
    const out = await save();
    assert.equal(sniff(out.bytes), 'png');
    const { width, height } = dimensions(out.bytes);
    const [tl, br, inside] = await pixels(page, out.bytes, [
      [0, 0],
      [width - 1, height - 1],
      [width / 2, height / 2],
    ]);
    assert.equal(tl[3], 0, `top left: ${tl}`);
    assert.equal(br[3], 0, `bottom right: ${br}`);
    assert.equal(inside[3], 255);
  },

  async 'JPG on a ground gives a JPEG'({ open, drop, choose, save, assert, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    await choose('Ground', 'Sea');
    await choose('Format', 'JPG');
    const out = await save();
    assert.equal(out.name, 'screenshot-framed.jpg');
    assert.equal(sniff(out.bytes), 'jpeg');
    assert.deepEqual(dimensions(out.bytes), { width: 1415, height: 2792 });
  },

  async 'the phone frame makes it bigger by its bezel, dark round the screen'({ open, drop, choose, save, assert, page, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    await choose('Frame', 'Phone');
    const out = await save();
    const bezel = Math.round(1179 * 0.03);
    assert.deepEqual(dimensions(out.bytes), { width: 1415 + 2 * bezel, height: 2792 + 2 * bezel });
    // Halfway down, the left bezel is the phone's dark body, the screen beside it as it was.
    const [body, screen] = await pixels(page, out.bytes, [
      [118 + bezel / 2, 1300],
      [118 + bezel + 20, 1300 + 0],
    ]);
    assert.ok(body[0] < 40 && body[1] < 40 && body[2] < 40, String(body));
    assert.ok(screen[0] > 200, String(screen));
  },

  async 'the browser frame puts a bar above it; a dark ground darkens the bar'({ open, drop, choose, save, assert, page, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    await choose('Frame', 'Browser');
    const light = await save();
    const bar = Math.round(1179 * 0.045);
    assert.deepEqual(dimensions(light.bytes), { width: 1415, height: 2792 + bar });
    // The bar's middle, left of its address field, is a light grey on Paper.
    const [lightBar] = await pixels(page, light.bytes, [[118 + 160, 118 + bar / 2]]);
    assert.ok(lightBar[0] > 200, String(lightBar));
    await choose('Ground', 'Ink');
    const dark = await save();
    const [darkBar] = await pixels(page, dark.bytes, [[118 + 160, 118 + bar / 2]]);
    assert.ok(darkBar[0] < 80, String(darkBar));
  },

  async 'from the picture: its own top and bottom colours'({ open, drop, choose, save, assert, page, sees }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await sees('screenshot.png');
    await choose('Ground', 'From the picture');
    await choose('Shadow', 'None');
    const out = await save();
    const { width, height } = dimensions(out.bytes);
    const [top, bottom] = await pixels(page, out.bytes, [
      [width / 2, 1],
      [width / 2, height - 2],
    ]);
    assert.ok(near(top, [18, 18, 18, 255], 8), `top ${top}`);
    assert.ok(near(bottom, [245, 245, 242, 255], 8), `bottom ${bottom}`);
  },

  async 'the choices are kept'({ open, choose, assert, page }) {
    await open('/screenshot-frame');
    await choose('Ground', 'Mint');
    await choose('Frame', 'Phone');
    await choose('Size', '4:5');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    const picked = (group) => page.getByRole('radiogroup', { name: group }).getByRole('radio', { checked: true });
    assert.equal(await picked('Ground').getAttribute('aria-label'), 'Mint');
    assert.equal(await picked('Frame').innerText(), 'Phone');
    assert.equal(await picked('Size').innerText(), '4:5');
  },

  async 'fits a phone'({ open, drop, choose, save, fitsPhone, shot }) {
    await open('/screenshot-frame');
    await drop('screenshot.png');
    await choose('Ground', 'Dusk');
    await choose('Frame', 'Phone');
    await choose('Size', '4:5');
    await save();
    await shot('phone', 390);
    await choose('Frame', 'Browser');
    await choose('Size', '16:9');
    await save();
    await shot('desktop', 1280);
    await fitsPhone();
  },
};
