// The home's other view, the wall of drawers, and each tool's specimen plate in its head: the switch
// for a visit and the setting for the view Fundus opens on, every tool's drawer and plate, a drawer's play (hover, the flip clock's other
// side, reduced motion, a phone's scroll), the plate drawn on when a tool opens, where it sits on a
// computer and on a phone (beside the name, smaller, since 2026-11-04), German.

const wall = async (t, { dev = false, lang = 'en' } = {}) => {
  await t.page.addInitScript(
    ([dev, lang]) => {
      localStorage.setItem('fundus:prefs', JSON.stringify({ language: lang, view: 'wall' }));
      if (dev) localStorage.setItem('fundus:shared', JSON.stringify({ dev: true }));
    },
    [dev, lang],
  );
  await t.open('/');
  await t.page.locator('[data-drawer]').first().waitFor();
};
const drawer = (page, id) => page.locator(`[data-drawer="${id}"]`);
const settled = (page, id) => page.waitForFunction((id) => !document.querySelector(`[data-drawer="${id}"]`).classList.contains('play'), id, { timeout: 4000 });

export default {
  'the switch changes the view for this visit; Settings picks the one Fundus opens on': async (t) => {
    const { page, assert } = t;
    const drawers = page.locator('[data-drawer]');
    const rows = page.locator('a.row');
    await t.open('/');
    const n = await rows.count();
    await page.getByRole('button', { name: 'Wall' }).click();
    await drawers.first().waitFor();
    assert.equal(await drawers.count(), n, 'a drawer for every row');
    assert.equal(await rows.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Wall' }).getAttribute('aria-pressed'), 'true');
    // Into a tool and back: still the wall.
    await drawer(page, 'count').click();
    await page.waitForSelector('main[data-ready]');
    await page.goBack();
    await drawers.first().waitFor();
    // Opened again: the list, the view it opens on until Settings says otherwise.
    await page.reload();
    await rows.first().waitFor();
    assert.equal(await drawers.count(), 0);

    // Settings: open on the wall. The home behind the sheet changes at once.
    await page.keyboard.press(',');
    const setting = page.getByRole('radiogroup', { name: 'Opening view' });
    assert.equal(await setting.getByRole('radio', { name: 'List' }).getAttribute('aria-checked'), 'true');
    await setting.getByRole('radio', { name: 'Wall' }).click();
    await page.screenshot({ path: 'test-results/wall-setting.png' });
    await page.keyboard.press('Escape');
    await drawers.first().waitFor();
    // The switch still changes it for the visit; opened again, it's the wall.
    await page.getByRole('button', { name: 'List' }).click();
    await rows.first().waitFor();
    await page.reload();
    await drawers.first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Wall' }).getAttribute('aria-pressed'), 'true');
  },

  'every tool has its drawer, and the shelves close with empty ones': async (t) => {
    const { page, assert } = t;
    await wall(t, { dev: true });
    assert.equal(await page.locator('[data-drawer]').count(), 49);
    assert.equal(await page.locator('[data-drawer]:not(:has(svg.i))').count(), 0, 'each has its icon');
    // The cabinet beside the register: six a row at 1280 px, four at 1100, three on a phone.
    for (const [width, cols] of [[1280, 6], [1100, 4], [390, 3]]) {
      await page.setViewportSize({ width, height: 900 });
      const shelves = await page.locator('.drawers .dw').evaluateAll((els) =>
        els.map((dw) => [Number(getComputedStyle(dw).getPropertyValue('--cols')), [...dw.children].filter((el) => getComputedStyle(el).display !== 'none').length]),
      );
      assert.ok(shelves.every(([c, n]) => c === cols && n % cols === 0), `at ${width} px every shelf fills its rows of ${cols}: ${shelves.join(' ')}`);
    }
    await page.screenshot({ path: 'test-results/wall-phone.png' });
  },

  'a drawer plays once when pointed at, then opens its tool': async (t) => {
    const { page, assert } = t;
    await wall(t);
    const count = drawer(page, 'count');
    await count.hover();
    assert.match(await count.getAttribute('class'), /\bplay\b/);
    // The label holder is marked while pointed at.
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-drawer="count"] .lab')).backgroundColor === 'rgb(255, 225, 74)', null, { timeout: 1000 });
    await page.screenshot({ path: 'test-results/wall-hover.png' });
    await settled(page, 'count');
    await count.click();
    await page.waitForSelector('main[data-ready]');
    assert.ok(page.url().endsWith('/count-words'));
  },

  'the flip clock rests on its other side after a play': async (t) => {
    const { page, assert } = t;
    await wall(t);
    const clock = drawer(page, 'clock');
    await clock.hover();
    await settled(page, 'clock');
    assert.match(await clock.getAttribute('class'), /\balt\b/);
    await page.mouse.move(5, 5);
    await clock.hover();
    await settled(page, 'clock');
    assert.doesNotMatch(await clock.getAttribute('class'), /\balt\b/, 'and back on the next');
  },

  'reduced motion: the icons rest': async (t) => {
    const { page, assert } = t;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await wall(t);
    await drawer(page, 'shrink').hover();
    assert.doesNotMatch(await drawer(page, 'shrink').getAttribute('class'), /\bplay\b/);
  },

  'on a phone each drawer plays as it comes fully into view': async (t) => {
    const { page, assert } = t;
    await page.setViewportSize({ width: 390, height: 844 });
    await wall(t);
    await drawer(page, 'convert').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-drawer="convert"]').classList.contains('play'), null, { timeout: 2000 });
    const playing = await page.locator('[data-drawer].play').count();
    assert.ok(playing >= 1);
    // Further down, not yet.
    assert.doesNotMatch(await drawer(page, 'shadows').count() ? await drawer(page, 'shadows').getAttribute('class') : '', /\bplay\b/);
  },

  'every tool page shows its plate, drawn on as it opens, its notes on the plate': async (t) => {
    const { page, assert } = t;
    const { TOOLS } = await import('../../shared/catalog.mjs');
    // Notes that run past the plate's 160 × 120, at this size.
    const off = () =>
      page.locator('.specimen svg text').evaluateAll((texts) =>
        texts.flatMap((text) => {
          const b = text.getBBox();
          return b.x < 2 || b.x + b.width > 158 || b.y < 2 || b.y + b.height > 118 ? [text.textContent] : [];
        }),
      );
    for (const [width, lang] of [[1280, 'en'], [390, 'de']]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((lang) => localStorage.setItem('fundus:prefs', JSON.stringify({ language: lang })), lang);
      for (const tool of TOOLS) {
        await t.open(`/${tool.path}`);
        const plate = page.locator('.specimen');
        await plate.locator('svg path').first().waitFor({ state: 'attached' });
        await page.evaluate(() => document.fonts.ready);
        assert.equal((await plate.locator('.no').innerText()).trim().toUpperCase(), `${lang === 'de' ? 'ABB.' : 'FIG.'} ${tool.no}`, tool.id);
        assert.equal(await plate.getAttribute('aria-hidden'), 'true');
        assert.deepEqual(await off(), [], `${tool.id} at ${width} px (${lang}): notes off the plate`);
      }
    }
    // The last one opened is drawing; and a moment later it's done.
    assert.equal(await page.locator('.specimen .fig.drawing').count(), 1);
    await page.waitForSelector('.specimen .fig:not(.drawing)', { timeout: 3000 });
  },

  'the plate stands right of the name, on a computer and smaller on a phone': async (t) => {
    const { page, assert } = t;
    await t.open('/shrink-a-photo');
    await page.locator('.specimen svg path').first().waitFor({ state: 'attached' });
    let [h1, plate] = [await page.locator('h1').boundingBox(), await page.locator('.specimen').boundingBox()];
    assert.equal(Math.round(plate.width), 208);
    assert.ok(plate.x > h1.x + 300 && plate.y <= h1.y, 'right of the name, level with the crumbs');
    await page.mouse.move(plate.x + 40, plate.y + 40);
    await page.waitForSelector('.specimen .fig.drawing');
    await page.screenshot({ path: 'test-results/plate-desk.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    [h1, plate] = [await page.locator('h1').boundingBox(), await page.locator('.specimen').boundingBox()];
    const sub = await page.locator('.sub p').boundingBox();
    assert.equal(Math.round(plate.width), 104);
    assert.ok(plate.x >= h1.x + h1.width + 15 && Math.abs(plate.y - h1.y) <= 4, 'right of the name, level with it');
    assert.ok(Math.round(plate.x + plate.width) <= 390 - 16, 'inside the page');
    assert.ok(sub.x === h1.x && sub.x + sub.width <= plate.x, 'what the tool does under the name, left of the plate');
    await page.waitForSelector('.specimen .fig:not(.drawing)', { timeout: 3000 });
    await page.screenshot({ path: 'test-results/plate-phone.png' });
  },

  'reduced motion: the plate is there at once': async (t) => {
    const { page, assert } = t;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await t.open('/count-words');
    await page.locator('.specimen svg path').first().waitFor({ state: 'attached' });
    assert.equal(await page.locator('.specimen .fig.drawing').count(), 0);
  },

  'German': async (t) => {
    const { page, assert } = t;
    await wall(t, { lang: 'de' });
    assert.equal(await page.getByRole('button', { name: 'Wand' }).getAttribute('aria-pressed'), 'true');
    assert.equal((await drawer(page, 'count').locator('.nm').innerText()).trim(), 'Wörter zählen');
    await drawer(page, 'count').click();
    await page.waitForSelector('main[data-ready]');
    await page.locator('.specimen svg text').first().waitFor({ state: 'attached' });
    assert.match(await page.locator('.specimen .no').innerText(), /^Abb\. 301$/i);
    assert.match(await page.locator('.specimen svg').innerHTML(), /8 WÖRTER/);
  },
};
