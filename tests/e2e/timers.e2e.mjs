// F-506 Timers: on Playwright's clock, so minutes pass in a moment. A preset counting down from its
// end time, paused and resumed, ringing at zero (the beeps counted, the words said, the tab's
// title); typed lengths; a reload in the middle; the stopwatch with laps; German.

const NOON = new Date('2026-10-31T12:00:00Z');

/** Playwright's clock, a minute before noon until the page is in, then held at noon: from there
 *  time moves only with runFor, so every value is exact. */
const hold = (page) => page.clock.install({ time: new Date(NOON.getTime() - 60_000) });
const noon = (page) => page.clock.pauseAt(NOON);
const card = (page, name) => page.locator(`article.timer[data-timer="${name}"]`);
const left = async (page, name) => (await card(page, name).locator('.left').innerText()).trim();
const sw = (page) => page.locator('section.sw');

/** Counts the beeps: every oscillator the page makes. */
const countBeeps = (page) =>
  page.addInitScript(() => {
    window.__beeps = 0;
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const make = Ctx.prototype.createOscillator;
    Ctx.prototype.createOscillator = function () {
      window.__beeps++;
      return make.call(this);
    };
  });

export default {
  async 'a preset counts down, pauses, and rings at zero'({ page, open, fill, assert, sees, shot }) {
    await hold(page);
    await countBeeps(page);
    await open('/timers');
    await noon(page);
    await sees('No timers yet');
    await fill('Name', 'Tea');
    await page.getByRole('button', { name: 'Start a 3 minute timer' }).click();
    assert.equal(await left(page, 'Tea'), '3:00');
    await page.clock.runFor(60_000);
    assert.equal(await left(page, 'Tea'), '2:00');
    assert.equal(await page.title(), '2:00 Tea · Fundus', 'the nearest timer in the tab');
    await sees('1 running');
    await page.clock.runFor(1_000);
    assert.equal(await left(page, 'Tea'), '1:59');

    // Pause: time stands still; Resume carries on.
    await card(page, 'Tea').getByRole('button', { name: 'Pause' }).click();
    await page.clock.fastForward(5 * 60_000);
    await page.clock.runFor(300);
    assert.equal(await left(page, 'Tea'), '1:59');
    assert.equal(await page.title(), 'Timers · Fundus', 'nothing runs: the page’s own title');
    await card(page, 'Tea').getByRole('button', { name: 'Resume' }).click();

    // A second, longer one: the title keeps the nearest.
    await page.getByRole('button', { name: 'Start a 10 minute timer' }).click();
    await page.clock.runFor(60_000);
    assert.equal(await left(page, 'Tea'), '0:59');
    assert.equal(await left(page, '10 min'), '9:00');
    assert.equal(await page.title(), '0:59 Tea · Fundus');
    await sees('2 running');
    await shot('running-1280', 1280);
    await shot('running-390', 390);

    // Zero.
    await page.clock.runFor(59_300);
    await card(page, 'Tea').and(page.locator('.rang')).waitFor();
    assert.equal(await left(page, 'Tea'), '0:00');
    assert.equal((await card(page, 'Tea').locator('.tag').innerText()).trim().toLowerCase(), 'done');
    assert.equal(await page.locator('[aria-live="assertive"]').textContent(), 'Tea is done.');
    assert.equal(await page.evaluate(() => window.__beeps), 9, 'three times three beeps');
    assert.equal(await page.title(), '8:01 10 min · Fundus', 'the next one takes the title');
    await shot('rang-390', 390);

    // Reset, and remove.
    await card(page, 'Tea').getByRole('button', { name: 'Reset' }).click();
    assert.equal(await left(page, 'Tea'), '3:00');
    assert.equal(await card(page, 'Tea').and(page.locator('.rang')).count(), 0);
    await page.getByRole('button', { name: 'Remove Tea' }).click();
    await page.getByRole('button', { name: 'Remove 10 min' }).click();
    await sees('No timers yet');
    assert.equal(await page.title(), 'Timers · Fundus');
  },

  async 'typed lengths, and nonsense'({ page, open, fill, assert, sees }) {
    await hold(page);
    await open('/timers');
    await noon(page);
    const field = page.getByLabel('Minutes, or m:ss', { exact: true });
    await field.fill('1:75');
    await field.press('Enter');
    await sees('Not a time: try 5, 1:30 or 1:02:03.');
    await field.fill('1:30');
    await field.press('Enter');
    assert.equal(await left(page, '1 min 30 s'), '1:30', 'a timer nobody named is called by its length');
    assert.equal(await page.getByText('Not a time').count(), 0);
    assert.equal(await field.inputValue(), '', 'the field empties for the next one');
    await fill('Name', 'Pasta');
    await field.fill('1:02:03');
    await page.locator('form.typed').getByRole('button', { name: 'Start' }).click();
    assert.equal(await left(page, 'Pasta'), '1:02:03');
    await field.fill('2,5');
    await field.press('Enter');
    assert.equal(await left(page, '2 min 30 s'), '2:30', 'a bare number is minutes');
    await field.fill('45 s');
    await field.press('Enter');
    assert.equal(await left(page, '45 s'), '0:45');
    await field.fill('100:00:00');
    await field.press('Enter');
    await sees('Not a time');
  },

  async 'a running timer survives a reload'({ page, open, assert, sees }) {
    await hold(page);
    await countBeeps(page);
    await open('/timers');
    await noon(page);
    await page.getByRole('button', { name: 'Start a 10 minute timer' }).click();
    await page.getByRole('button', { name: 'Start a 1 minute timer' }).click();
    await card(page, '1 min').getByRole('button', { name: 'Pause' }).click();
    await page.clock.fastForward(2 * 60_000);
    await page.clock.runFor(300);
    assert.equal(await left(page, '10 min'), '8:00');
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('fundus:tool:timers')));
    assert.equal(kept.list.length, 2);
    assert.equal(kept.list[0].name, '10 min');
    assert.equal(kept.list[0].end, NOON.getTime() + 10 * 60_000, 'kept by its end time');
    assert.equal(kept.list[1].end, null);

    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await left(page, '10 min'), '8:00', 'the same time after the reload');
    assert.equal(await left(page, '1 min'), '1:00', 'the paused one still paused');
    await page.clock.runFor(30_000);
    assert.equal(await left(page, '10 min'), '7:30');
    await page.clock.fastForward(7.5 * 60_000 + 300);
    await card(page, '10 min').and(page.locator('.rang')).waitFor();
    await sees('10 min is done.');
  },

  async 'a timer that ended while the page was closed shows it'({ page, open, assert }) {
    await hold(page);
    await page.addInitScript((end) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('fundus:tool:timers', JSON.stringify({ list: [{ id: 'a', name: 'Bread', length: 600000, end, left: 600000, done: false }, { length: 'nonsense' }] }));
      }
    }, NOON.getTime() - 120_000);
    await open('/timers');
    await noon(page);
    await card(page, 'Bread').and(page.locator('.rang')).waitFor();
    assert.equal(await left(page, 'Bread'), '0:00');
    assert.equal(await page.locator('article.timer').count(), 1, 'what can’t be read is dropped');
    assert.equal(await page.title(), 'Done: Bread · Fundus');
    await card(page, 'Bread').getByRole('button', { name: 'Start' }).click();
    assert.equal(await left(page, 'Bread'), '10:00', 'starts over');
  },

  async 'the stopwatch, with laps'({ page, open, assert, shot }) {
    await hold(page);
    await open('/timers');
    await noon(page);
    const shown = async () => (await sw(page).locator('.left').innerText()).trim();
    assert.equal(await shown(), '0:00.00');
    await sw(page).getByRole('button', { name: 'Start' }).click();
    await page.clock.runFor(5_270);
    await sw(page).getByRole('button', { name: 'Lap' }).click();
    await page.clock.runFor(3_000);
    await sw(page).getByRole('button', { name: 'Lap' }).click();
    await page.clock.runFor(1_730);
    await sw(page).getByRole('button', { name: 'Stop' }).click();
    assert.equal(await shown(), '0:10.00');
    const lap = (n) => sw(page).locator(`li[data-lap="${n}"]`);
    assert.equal((await lap(1).locator('.time').innerText()).trim(), '0:05.27');
    assert.equal((await lap(2).locator('.time').innerText()).trim(), '0:03.00');
    assert.equal((await lap(2).locator('.total').innerText()).trim(), '0:08.27');
    assert.equal(await lap(2).locator('.time.best').count(), 1, 'the fastest lap is marked');
    assert.equal(await sw(page).locator('li').first().getAttribute('data-lap'), '2', 'newest first');
    await page.clock.fastForward(60_000);
    await page.clock.runFor(100);
    assert.equal(await shown(), '0:10.00', 'stopped: it stands');

    // It carries on, and keeps across a reload.
    await sw(page).getByRole('button', { name: 'Resume' }).click();
    await page.clock.fastForward(65_000);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.clock.runFor(1_000);
    assert.match(await shown(), /^1:16\.\d\d$/);
    await sw(page).getByRole('button', { name: 'Stop' }).click();
    assert.equal(await shown(), '1:16.00');
    await shot('watch-1280', 1280);
    await shot('watch-390', 390);
    await sw(page).getByRole('button', { name: 'Reset' }).click();
    assert.equal(await shown(), '0:00.00');
    assert.equal(await sw(page).locator('li').count(), 0);
  },

  async 'the screen stays on, or it says why not'({ page, open, sees, assert }) {
    await hold(page);
    await open('/timers');
    await noon(page);
    await page.getByRole('button', { name: 'Start a 5 minute timer' }).click();
    await page.getByText(/The screen stays on|can’t keep the screen on|didn’t let the screen stay on/).waitFor();
    await page.getByRole('button', { name: 'Remove 5 min' }).click();
    await sees('No timers yet');
    assert.equal(await page.getByText(/The screen stays on|can’t keep the screen on|didn’t let the screen stay on/).count(), 0, 'nothing runs: no note');
  },

  async 'German, with a length pasted on the home'({ page, open, assert, shot }) {
    await hold(page);
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '1:30');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Timer/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await noon(page);
    const field = page.getByLabel('Minuten, oder m:ss', { exact: true });
    assert.equal(await field.inputValue(), '1:30');
    await field.press('Enter');
    assert.equal(await left(page, '1 Min. 30 Sek.'), '1:30');
    await page.getByRole('button', { name: 'Einen Timer über 25 Minuten starten' }).click();
    await page.clock.runFor(30_000);
    assert.equal(await page.title(), '1:00 1 Min. 30 Sek. · Fundus');
    await page.locator('section.sw').getByRole('button', { name: 'Start' }).click();
    await page.clock.runFor(2_500);
    await page.locator('section.sw').getByRole('button', { name: 'Runde' }).click();
    await page.getByText('Runde 1').waitFor();
    await shot('de-390', 390);
  },

  async 'fits a phone'({ page, open, fill, fitsPhone }) {
    await hold(page);
    await open('/timers');
    await noon(page);
    await fill('Name', 'A very long name for a timer that nobody would ever type, but someone will');
    await page.getByRole('button', { name: 'Start a 25 minute timer' }).click();
    const field = page.getByLabel('Minutes, or m:ss', { exact: true });
    await field.fill('99:59:59');
    await field.press('Enter');
    await page.locator('section.sw').getByRole('button', { name: 'Start' }).click();
    await page.clock.runFor(4_000);
    for (let i = 0; i < 3; i++) await page.locator('section.sw').getByRole('button', { name: 'Lap' }).click();
    await fitsPhone();
  },
};
