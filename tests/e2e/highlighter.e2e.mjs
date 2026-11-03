// The highlighter's slanted stroke (.hl, and the plate's figure number): a shape in --mark for each
// theme, its slanted edge antialiased. A slanted gradient's edge never is in Safari: the user saw
// stairs (2026-11-03).

/** The stroke's fill and --mark as the page paints it flat, both as #rrggbb. */
const colours = (page) =>
  page.evaluate(() => {
    const image = getComputedStyle(document.querySelector('.chip.hl')).backgroundImage;
    const fill = decodeURIComponent(image).match(/fill='(#[0-9a-f]{6})'/i)?.[1].toLowerCase();
    const probe = document.body.appendChild(document.createElement('i'));
    probe.style.background = 'var(--mark)';
    const rgb = getComputedStyle(probe).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
    probe.remove();
    return [fill, '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')];
  });

/** How far the active chip's slanted top edge strays from a straight line, in pixels: about half a
 *  pixel when it steps, a tenth or less when it's smooth. */
const stray = async (page) => {
  const box = await page.locator('.chip.hl').boundingBox();
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: 6 } });
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height).getContext('2d');
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, img.width, img.height).data;
    // Blue tells the page (high) from the yellow (low): the top left corner is page, the right end stroke.
    const blue = (x, y) => d[(y * img.width + x) * 4 + 2];
    const [page, mark] = [blue(0, 0), blue(img.width - 1, img.height - 1)];
    const points = [];
    for (let x = 0; x < img.width; x++) {
      let stroke = 0;
      for (let y = 0; y < img.height; y++) stroke += (page - blue(x, y)) / (page - mark);
      const edge = img.height - stroke;
      if (edge > 0.6 && edge < img.height - 0.6) points.push([x, edge]);
    }
    const n = points.length;
    const [mx, my] = [points.reduce((a, p) => a + p[0], 0) / n, points.reduce((a, p) => a + p[1], 0) / n];
    const k = points.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / points.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
    return { n, off: Math.max(...points.map(([x, y]) => Math.abs(y - (my + k * (x - mx))))) };
  }, `data:image/png;base64,${png.toString('base64')}`);
};

export default {
  'a smooth slanted edge': async (t) => {
    const { page, assert } = t;
    await page.emulateMedia({ colorScheme: 'light' });
    await t.open('/');
    const { n, off } = await stray(page);
    assert.ok(n > 30, `the slant is measured along ${n} columns`);
    assert.ok(off < 0.25, `the edge strays ${off.toFixed(2)} px from a straight line (stairs: about 0.5)`);
  },

  "in --mark's yellow, whichever way the theme is set": async (t) => {
    const { page, assert } = t;
    await page.emulateMedia({ colorScheme: 'light' });
    await t.open('/');
    const root = (theme) => page.evaluate((theme) => (theme ? (document.documentElement.dataset.theme = theme) : delete document.documentElement.dataset.theme), theme);
    for (const [scheme, theme, want] of [
      ['light', null, '#ffe14a'],
      ['dark', null, '#e9cb35'],
      ['dark', 'light', '#ffe14a'],
      ['light', 'dark', '#e9cb35'],
    ]) {
      await page.emulateMedia({ colorScheme: scheme });
      await root(theme);
      const [fill, mark] = await colours(page);
      assert.equal(mark, want, `--mark, the system ${scheme}, the setting ${theme ?? 'system'}`);
      assert.equal(fill, mark, `the stroke, the system ${scheme}, the setting ${theme ?? 'system'}`);
    }
  },
};
