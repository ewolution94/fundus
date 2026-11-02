// F-308 Teleprompter: on Playwright's clock (animation frames included), so the text moves exactly as
// far as the time run. Start, the speed from the measured text, Space, the speed keys and their
// readout, jumps, a drag while paused, Mirror and Flip, the countdown and the end, Esc; the options
// kept and the text not; a text from the home; German; a phone.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const results = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-results');
const dark = process.argv.includes('--dark');

const T0 = new Date('2026-11-02T10:00:00Z');
/** The clock runs until the page is in, then holds: from there time moves only with runFor. */
const hold = (page) => page.clock.install({ time: T0 });
const still = (page) => page.clock.pauseAt(new Date(T0.getTime() + 60_000));

/** 12 lines of 15 words: 180 words, 1:17 at 140 a minute. */
const TEXT = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}: good evening and welcome to the show, tonight we talk about the weather.`).join('\n');
const SECONDS = (180 / 140) * 60;

const stage = (page) => page.getByRole('dialog', { name: 'Teleprompter' });
/** Where the text stands: its translateY, in px. */
const ty = (page) => page.locator('.roll').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
const transformOf = (page, sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).transform);

/** What's on screen, not the whole page: the stage covers the window. */
async function view(page, name, width = 390) {
  const size = page.viewportSize();
  if (width !== size.width) await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(results, `prompter-${name}${dark ? '-dark' : ''}.png`) });
  if (width !== size.width) await page.setViewportSize(size);
}

/** As on the iPhone: no Fullscreen API, the stage alone covers the window. (A browser window in full
 *  screen can't be resized, and these tests change the viewport.) */
const noFullscreen = (page) =>
  page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
  });

async function setUp(t, text = TEXT) {
  await noFullscreen(t.page);
  await hold(t.page);
  await t.open('/teleprompter');
  await still(t.page);
  await t.fill('Text', text);
}

export default {
  async 'the text moves at the speed, Space pauses, ↑ is faster, Esc closes'(t) {
    const { page, assert, sees, check } = t;
    await setUp(t);
    await sees('180 words');
    assert.equal((await page.locator('.length b').innerText()).trim(), '1:15', 'about 1:15 (1:17, to five seconds)');
    await check('3-2-1 countdown', false);
    await page.getByRole('button', { name: 'Start' }).click();
    await stage(page).waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden', 'the page behind doesn’t scroll');

    const height = await page.locator('.roll').evaluate((el) => el.offsetHeight);
    const y0 = await ty(page);
    await page.clock.runFor(10_000);
    const y1 = await ty(page);
    const expected = (height * 10) / SECONDS;
    assert.ok(Math.abs(y0 - y1 - expected) < 2, `moved ${y0 - y1} px in 10 s, expected ${expected}`);
    assert.equal((await page.locator('.bar .left').innerText()).trim(), '1:08 left');

    // Space: it stands.
    await page.keyboard.press('Space');
    const y2 = await ty(page);
    await page.clock.runFor(3_000);
    assert.equal(await ty(page), y2, 'paused: the text stays');
    await sees('Paused');
    assert.ok(await page.getByRole('button', { name: 'Resume' }).isVisible());

    // ↑: 150 a minute, and it shows; the setting follows.
    await page.keyboard.press('ArrowUp');
    assert.equal((await page.locator('.readout').innerText()).trim(), '150 wpm');
    await page.keyboard.press('+');
    assert.equal((await page.locator('.readout').innerText()).trim(), '160 wpm');
    await page.keyboard.press('ArrowDown');
    assert.equal((await page.locator('.readout').innerText()).trim(), '150 wpm');
    await page.clock.runFor(1_500);
    assert.equal((await page.locator('.readout').innerText()).trim(), 'Paused', 'the readout goes after a moment');

    // Going on at 150: faster than before.
    await page.keyboard.press('Space');
    const y3 = await ty(page);
    await page.clock.runFor(10_000);
    const fast = (height / 180) * (150 / 60) * 10;
    assert.ok(Math.abs(y3 - (await ty(page)) - fast) < 2, 'at 150 a minute');

    await view(page, 'stage-running', 1280);
    await page.keyboard.press('Escape');
    await stage(page).waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible', 'the page scrolls again');
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Start', 'focus back on Start');
    assert.equal(await page.locator('.speed .rate').innerText(), '150 wpm', 'the speed set on the stage is the setting');
  },

  async 'full screen where the browser has it; leaving it either way closes the stage, not the tool'({ page, open, fill, check, assert, engine }) {
    await open('/teleprompter');
    await fill('Text', TEXT);
    await check('3-2-1 countdown', false);
    const inFull = () =>
      page
        .waitForFunction(() => document.fullscreenElement?.classList.contains('stage'), null, { timeout: 3000 })
        .then(() => true)
        .catch(() => false);
    await page.getByRole('button', { name: 'Start' }).click();
    await stage(page).waitFor();
    if (!(await page.evaluate(() => document.fullscreenEnabled)) || !(await inFull())) {
      console.log(`      (${engine}: no full screen here; the stage covers the window)`);
    } else {
      // The browser's own way out: the stage goes with it, nothing left behind.
      await page.evaluate(() => document.exitFullscreen());
      await stage(page).waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible');
      await page.getByRole('button', { name: 'Start' }).click();
      await inFull();
    }
    // Esc: the stage closes, and the tool stays (the page's own Esc would go home).
    await page.keyboard.press('Escape');
    await stage(page).waitFor({ state: 'detached' });
    assert.equal(await page.locator('main[data-tool="prompter"]').count(), 1, 'still on the tool');
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Start', null, { timeout: 2000 });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), TEXT, 'the text is still there');
    await page.keyboard.press('Escape');
    await page.waitForSelector('main[data-tool="prompter"]', { state: 'detached' });
  },

  async 'page turner keys, a drag while paused, a tap'(t) {
    const { page, assert, check } = t;
    await setUp(t);
    await check('3-2-1 countdown', false);
    await page.getByRole('button', { name: 'Start' }).click();
    await stage(page).waitFor();
    await page.keyboard.press('Space');
    const line = await page.locator('.roll').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const start = await ty(page);

    await page.keyboard.press('PageDown');
    const screen = start - (await ty(page));
    assert.ok(screen > 2 * line && Math.abs(screen / line - Math.round(screen / line)) < 0.01, `a screen in whole lines: ${screen / line}`);
    await page.keyboard.press('ArrowLeft');
    assert.ok(Math.abs(start - (await ty(page)) - (screen - line)) < 0.5, 'a line back');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageUp');
    assert.ok(Math.abs((await ty(page)) - start) < 0.5, 'back where it was');
    await page.keyboard.press('ArrowLeft');
    assert.ok(Math.abs((await ty(page)) - start) < 0.5, 'not before the first line');

    // A drag moves the text with the finger while paused.
    const box = await page.locator('.view').boundingBox();
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + 600);
    await page.mouse.down();
    await page.mouse.move(x, box.y + 500, { steps: 5 });
    await page.mouse.move(x, box.y + 400, { steps: 5 });
    await page.mouse.up();
    assert.ok(Math.abs(start - (await ty(page)) - 200) < 1, 'dragged up 200 px');
    assert.equal(await page.locator('.readout').innerText(), 'Paused', 'a drag doesn’t start it');

    // A tap goes on.
    await page.mouse.click(x, box.y + 300);
    assert.ok(await page.getByRole('button', { name: 'Pause' }).isVisible());
    const y = await ty(page);
    await page.clock.runFor(1_000);
    assert.ok((await ty(page)) < y, 'running again');
    // The bar fades while it runs, and a mouse move brings it back.
    await page.clock.runFor(3_000);
    assert.equal(await page.locator('.bar.hide').count(), 1, 'the bar fades');
    await page.mouse.move(x + 40, box.y + 200);
    assert.equal(await page.locator('.bar.hide').count(), 0, 'and comes back');
    await page.getByRole('button', { name: 'Close' }).click();
    await stage(page).waitFor({ state: 'detached' });
  },

  async 'Mirror and Flip turn the reading area'(t) {
    const { page, assert, check } = t;
    await setUp(t);
    await check('3-2-1 countdown', false);
    await check('Mirror', true);
    await page.getByRole('button', { name: 'Start' }).click();
    assert.equal(await transformOf(page, '.view'), 'matrix(-1, 0, 0, 1, 0, 0)', 'left and right swapped');
    await page.keyboard.press('Escape');
    await check('Mirror', false);
    await check('Flip', true);
    await page.getByRole('button', { name: 'Start' }).click();
    assert.equal(await transformOf(page, '.view'), 'matrix(1, 0, 0, -1, 0, 0)', 'upside down');
    assert.equal(await transformOf(page, '.bar'), 'none', 'the controls stay the right way up');
    // Upside down, a drag still moves the text the way the finger goes on the glass.
    await page.keyboard.press('Space');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    const start = await ty(page);
    const top = () => page.locator('.roll').evaluate((el) => el.getBoundingClientRect().top);
    const before = await top();
    const box = await page.locator('.view').boundingBox();
    await page.mouse.move(box.x + 300, box.y + 500);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 400, { steps: 4 });
    await page.mouse.move(box.x + 300, box.y + 300, { steps: 4 });
    await page.mouse.up();
    assert.ok(Math.abs((await ty(page)) - start - 200) < 1, 'flipped: the frame moves the other way…');
    assert.ok(Math.abs((await top()) - before + 200) < 1, '…so on screen the text went up 200 px with the finger');
    await view(page, 'stage-flipped', 1280);
    await page.keyboard.press('Escape');
  },

  async 'the countdown, the end, and Again'(t) {
    const { page, assert, sees } = t;
    await setUp(t, 'Ten short words to read out loud, and then stop.');
    await sees('10 words');
    await page.getByRole('button', { name: 'Start' }).click();
    await stage(page).waitFor();
    assert.equal((await page.locator('.counter').innerText()).trim(), '3');
    const y0 = await ty(page);
    await page.clock.runFor(1_000);
    assert.equal((await page.locator('.counter').innerText()).trim(), '2');
    assert.equal(await ty(page), y0, 'still during the countdown');
    await page.clock.runFor(2_000);
    assert.equal(await page.locator('.counter').count(), 0);
    await page.clock.runFor(1_000);
    assert.ok((await ty(page)) < y0, 'and then it moves');
    // Ten words at 140 a minute: about 4.3 s.
    await page.clock.runFor(4_000);
    await sees('The end.');
    assert.equal((await page.locator('.bar .left').innerText()).trim(), '0:00 left');
    const end = await ty(page);
    await page.clock.runFor(2_000);
    assert.equal(await ty(page), end, 'it stops at the end');
    await view(page, 'stage-end', 390);
    await page.locator('.fin').getByRole('button', { name: 'Again' }).click();
    assert.equal((await page.locator('.counter').innerText()).trim(), '3', 'again from the countdown');
    assert.equal(await ty(page), y0, 'from the first word');
    await page.getByRole('button', { name: 'Close' }).click();
    await stage(page).waitFor({ state: 'detached' });
  },

  async 'keeps the options, never the text'({ page, open, fill, choose, check, assert }) {
    await noFullscreen(page);
    await open('/teleprompter');
    await fill('Text', TEXT);
    await page.getByRole('button', { name: 'Faster' }).click();
    await page.getByRole('button', { name: 'Faster' }).click();
    await choose('Text size', 'XL');
    await choose('Margin', 'Wide');
    await check('Mirror', true);
    await check('3-2-1 countdown', false);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '', 'the text is gone');
    assert.equal(await page.locator('.speed .rate').innerText(), '160 wpm');
    assert.equal(await page.getByRole('radio', { name: 'XL' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'Wide' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /^Mirror/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /^3-2-1/ }).getAttribute('aria-checked'), 'false');
    const kept = await page.evaluate(() => localStorage.getItem('fundus:tool:prompter'));
    assert.ok(!kept.includes('evening'), 'nothing of the text in storage');
    assert.equal(await page.getByRole('button', { name: 'Start' }).isDisabled(), true, 'nothing to read: no start');
  },

  async 'a long text pasted on the home, in German'({ page, open, assert, sees, shot }) {
    await noFullscreen(page);
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    const speech = Array.from({ length: 9 }, () => 'Liebe Gäste, schön, dass ihr heute Abend hier seid – wir feiern zusammen.').join(' ');
    await open('/');
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, speech);
    await page.getByRole('link', { name: /Teleprompter/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), speech);
    await sees('108 Wörter', 5000);
    await sees('etwa');
    await sees('140 W./Min.');
    await shot('de-390', 390);
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('dialog', { name: 'Teleprompter' }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Schließen' }).isVisible());
    await page.keyboard.press('Escape');
  },

  async 'fits a phone'(t) {
    const { page, fitsPhone, check, shot, assert } = t;
    await setUp(t, `${TEXT}\nAnd a word much too long for a phone: Donaudampfschifffahrtsgesellschaftskapitänsmütze.`);
    await check('3-2-1 countdown', false);
    await shot('setup-390', 390);
    await shot('setup-1280', 1280);
    await fitsPhone();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Start' }).click();
    await stage(page).waitFor();
    await page.clock.runFor(4_000);
    await page.keyboard.press('Space');
    await view(page, 'stage-390', 390);
    const box = await stage(page).boundingBox();
    assert.deepEqual([box.x, box.y, box.width, box.height], [0, 0, 390, 844], 'the stage covers the window');
    await fitsPhone();
  },
};
