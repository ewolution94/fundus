// F-509 Flip clock: on Playwright's clock in Berlin's time zone, so every face is exact. The time in
// 12 and 24 hours (the device's choice by default), seconds and the date, the countdown's days, its
// zero, what's kept and what isn't, the flip and reduced motion, full screen and Esc, the minute's
// nudge, a date from the home, German, a phone.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const results = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-results');
const dark = process.argv.includes('--dark');

const NOW = new Date('2026-11-02T08:05:09+01:00');
const hold = (page, at = NOW) => page.clock.install({ time: new Date(at.getTime() - 60_000) });
const still = (page, at = NOW) => page.clock.pauseAt(at);

/** The face as data (groups joined by ':') and as drawn (each card's upper half). */
const face = (page) => page.locator('.dial .face').getAttribute('data-face');
const drawn = (page) => page.locator('.dial .flap').evaluateAll((cards) => cards.map((c) => c.querySelector('.up b').textContent).join(''));
const captions = (page) => page.locator('.dial .cap').evaluateAll((caps) => caps.map((c) => c.textContent.trim()).filter(Boolean));
const staged = (page) => page.locator('.dial.staged');

/** As on the iPhone: no Fullscreen API, the stage alone covers the window (and the viewport can change). */
const noFullscreen = (page) =>
  page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
  });

async function view(page, name, width = 390, height = width < 600 ? 844 : 900) {
  const size = page.viewportSize();
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(results, `clock-${name}${dark ? '-dark' : ''}.png`) });
  await page.setViewportSize(size);
}

async function setUp(t, at = NOW) {
  await hold(t.page, at);
  await t.open('/flip-clock');
  await still(t.page, at);
}

export default {
  async 'the time in 12 hours (the device’s), 24 hours, with seconds and the date'(t) {
    const { page, assert, choose, check, sees } = t;
    await setUp(t);
    // en-US: 12 hours unless chosen otherwise.
    assert.equal(await page.getByRole('radio', { name: '12 h' }).getAttribute('aria-checked'), 'true');
    assert.equal(await face(page), ' 8:05');
    assert.equal(await drawn(page), ' 805');
    assert.deepEqual(await captions(page), ['AM']);
    await sees('Monday, November 2, 2026');

    await choose('Hours', '24 h');
    assert.equal(await face(page), '08:05');
    assert.deepEqual(await captions(page), []);
    await check('Seconds', true);
    assert.equal(await face(page), '08:05:09');
    await page.clock.runFor(1_000);
    assert.equal(await face(page), '08:05:10', 'on the next whole second');
    await page.clock.runFor(50_000);
    assert.equal(await face(page), '08:06:00');
    await page.waitForTimeout(700);
    assert.equal(await drawn(page), '080600', 'the cards show it once they’ve flipped');

    await check('Date', false);
    assert.equal(await page.getByText('November 2, 2026').count(), 0);

    // Midnight and noon in 12 hours.
    await choose('Hours', '12 h');
    await page.clock.setSystemTime(new Date('2026-11-02T00:30:00+01:00'));
    await page.clock.runFor(1_000);
    assert.match(await face(page), /^12:30:0\d$/);
    assert.deepEqual(await captions(page), ['AM']);
    await page.clock.setSystemTime(new Date('2026-11-02T12:00:00+01:00'));
    await page.clock.runFor(1_000);
    assert.match(await face(page), /^12:00:0\d$/);
    assert.deepEqual(await captions(page), ['PM']);
    await page.clock.setSystemTime(new Date('2026-11-02T13:07:00+01:00'));
    await page.clock.runFor(1_000);
    assert.match(await face(page), /^ 1:07:0\d$/);
  },

  async 'a countdown to a date: days, hours, minutes, seconds, and zero'(t) {
    const { page, assert, choose, fill, sees, shot } = t;
    await setUp(t);
    await choose('Mode', 'Countdown');
    await sees('Pick a date and time to count down to.');
    assert.equal(await face(page), ' :  :  :  ', 'blank cards until there’s a date');
    await fill('Date', '2026-12-24');
    await fill('Time', '18:00');
    assert.equal(await face(page), '52:09:54:51', '52 days, 9:54:51 to Christmas Eve at six');
    assert.deepEqual(await captions(page), ['Days', 'Hours', 'Minutes', 'Seconds']);
    await sees('Until Thu, December 24, 2026');
    await page.clock.runFor(1_000);
    assert.equal(await face(page), '52:09:54:50');
    await fill('Label', 'Holidays');
    assert.equal((await page.locator('.dial .title').innerText()).trim(), 'Holidays');
    await shot('countdown-1280', 1280);
    await shot('countdown-390', 390);

    // The date and time are kept; the label isn't.
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Countdown' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '2026-12-24');
    assert.equal(await page.getByLabel('Time', { exact: true }).inputValue(), '18:00');
    assert.equal(await page.getByLabel('Label', { exact: true }).inputValue(), '');
    assert.equal(await page.locator('.dial .title').count(), 0);
    const kept = await page.evaluate(() => localStorage.getItem('fundus:tool:clock'));
    assert.ok(!kept.includes('Holidays'), 'the label isn’t stored');

    // A minute away: it reaches zero, says so, and holds there.
    await fill('Date', '2026-11-02');
    await fill('Time', '08:07');
    const left = await face(page);
    assert.match(left, /^0:00:0[01]:\d\d$/);
    await page.clock.runFor(120_000);
    assert.equal(await face(page), '0:00:00:00');
    await sees('It’s time.');
    await page.clock.runFor(5_000);
    assert.equal(await face(page), '0:00:00:00', 'held at zero');
    // A date already past: zero straight away.
    await fill('Date', '2025-01-01');
    assert.equal(await face(page), '0:00:00:00');
    await sees('It’s time.');
  },

  async 'the cards flip, and change without it under reduced motion'(t) {
    const { page, assert, check } = t;
    await setUp(t);
    await check('Seconds', true);
    await page.clock.runFor(1_000);
    assert.ok((await page.locator('.dial .fold').count()) >= 1, 'the seconds card folds');
    assert.equal(await page.locator('.dial .fold').count(), await page.locator('.dial .unfold').count());
    await page.locator('.dial .fold').first().waitFor({ state: 'detached', timeout: 3000 });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const before = await drawn(page);
    await page.clock.runFor(1_000);
    assert.equal(await page.locator('.dial .fold, .dial .unfold').count(), 0, 'no flip');
    assert.notEqual(await drawn(page), before, 'the digit changed at once');
  },

  async 'full screen opens the stage; Esc and Close leave it, the tool stays'(t) {
    const { page, assert, engine } = t;
    await setUp(t);
    await page.getByRole('button', { name: 'Full screen' }).click();
    await staged(page).waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden', 'the page behind doesn’t scroll');
    const box = await staged(page).boundingBox();
    const size = page.viewportSize();
    assert.deepEqual([box.x, box.y, Math.round(box.width), Math.round(box.height)], [0, 0, size.width, size.height], 'it covers the window');
    const full = await page
      .waitForFunction(() => document.fullscreenElement?.classList.contains('dial'), null, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!full) console.log(`      (${engine}: no full screen here; the stage covers the window)`);
    assert.ok(await page.getByRole('button', { name: 'Close' }).isVisible());
    await page.keyboard.press('Escape');
    await page.locator('.dial:not(.staged)').waitFor();
    assert.equal(await page.locator('main[data-tool="clock"]').count(), 1, 'Esc leaves the stage, not the tool');
    // (While the browser is still leaving full screen, its own style holds the page.)
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible');
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '', 'the lock is let go');
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Full screen', 'focus back on the button');

    // Full screen ended by the browser itself: the stage closes too.
    await page.getByRole('button', { name: 'Full screen' }).click();
    await staged(page).waitFor();
    if (full) {
      await page.waitForFunction(() => document.fullscreenElement);
      await page.evaluate(() => document.exitFullscreen());
      await page.locator('.dial:not(.staged)').waitFor();
      await page.getByRole('button', { name: 'Full screen' }).click();
    }
    await page.getByRole('button', { name: 'Close' }).click();
    await page.locator('.dial:not(.staged)').waitFor();
    assert.equal(await page.locator('.dial .shut').count(), 0);
  },

  async 'on the stage the clock moves a little every minute, and the close button rests'(t) {
    const { page, assert } = t;
    await noFullscreen(page);
    await setUp(t);
    const shift = () => page.locator('.dial .board').evaluate((el) => el.style.translate);
    assert.equal(await shift(), '', 'on the page it stays put');
    await page.getByRole('button', { name: 'Full screen' }).click();
    await staged(page).waitFor();
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      const s = await shift();
      const m = /^(-?\d+)px(?: (-?\d+)px)?$/.exec(s);
      assert.ok(m && Math.abs(Number(m[1])) <= 8 && Math.abs(Number(m[2] ?? 0)) <= 8, `a few pixels: ${s}`);
      seen.add(s);
      await page.clock.runFor(60_000);
    }
    assert.ok(seen.size > 1, 'it moved');
    // The close button fades after a while, and a mouse move brings it back.
    assert.equal(await page.locator('.shut.gone').count(), 1);
    await page.mouse.move(200, 200);
    await page.mouse.move(260, 240);
    assert.equal(await page.locator('.shut.gone').count(), 0);
    await page.keyboard.press('Escape');
    await page.locator('.dial:not(.staged)').waitFor();
    assert.equal(await shift(), '');
  },

  async 'a date pasted on the home opens the countdown to it'({ page, open, assert }) {
    await hold(page);
    await open('/');
    await still(page);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '24.12.2026');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Flip clock/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Countdown' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '2026-12-24');
    assert.equal(await page.getByLabel('Time', { exact: true }).inputValue(), '00:00');
    assert.equal(await face(page), '51:15:54:51', 'to midnight before Christmas Eve');
  },

  async 'German'({ page, open, assert, choose, sees, shot }) {
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await hold(page);
    await open('/flip-clock');
    await still(page);
    await sees('Montag, 2. November 2026');
    await choose('Modus', 'Countdown');
    await page.getByLabel('Datum', { exact: true }).fill('2026-12-24');
    assert.deepEqual(await captions(page), ['Tage', 'Stunden', 'Minuten', 'Sekunden']);
    await sees('Bis Do., 24. Dezember 2026');
    await shot('de-390', 390);
    assert.ok(await page.getByRole('button', { name: 'Vollbild' }).isVisible());
  },

  async 'fits a phone'(t) {
    const { page, fitsPhone, check, choose, fill, shot, assert } = t;
    await noFullscreen(page);
    await setUp(t);
    await check('Seconds', true);
    await shot('clock-390', 390);
    await shot('clock-1280', 1280);
    await fitsPhone();
    await page.getByRole('button', { name: 'Full screen' }).click();
    await view(page, 'stage-390', 390);
    await view(page, 'stage-1280', 1280);
    await view(page, 'stage-844', 844, 390);
    await page.setViewportSize({ width: 390, height: 844 });
    // Upright on a phone the groups stack, and fill the width.
    const cards = await page.locator('.dial .group').evaluateAll((gs) => gs.map((g) => g.getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.width)]));
    assert.equal(new Set(cards.map((c) => c[1])).size, 3, 'three rows');
    // As big as the space allows: the board fills the stage's width or its height.
    const used = await page.locator(".dial.staged").evaluate((dial) => {
      const cs = getComputedStyle(dial);
      const w = dial.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = dial.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const board = dial.querySelector('.board').getBoundingClientRect();
      return Math.max(board.width / w, board.height / h);
    });
    assert.ok(used > 0.9 && used <= 1.01, `fills the stage: ${used}`);
    await fitsPhone();
    await page.keyboard.press('Escape');
    await choose('Mode', 'Countdown');
    await fill('Date', '2027-12-24');
    await fill('Label', 'A label much longer than a phone is wide, for the holidays at the sea');
    await shot('countdown-long-390', 390);
    await fitsPhone();
    await page.getByRole('button', { name: 'Full screen' }).click();
    await view(page, 'stage-countdown-390', 390);
    const title = await page.locator('.dial .title').boundingBox();
    const shut = await page.locator('.dial .shut').boundingBox();
    assert.ok(title.y >= shut.y + shut.height, 'the label stays clear of the close button');
    await view(page, 'stage-countdown-1280', 1280);
    await fitsPhone();
  },
};
