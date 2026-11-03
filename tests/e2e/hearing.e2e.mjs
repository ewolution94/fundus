// F-602 Hearing test on Playwright's clock (the readout follows the page's clock; the sound plays on
// the audio clock, which a headless browser runs without a device, so nothing is heard): the
// readout climbs, Gone records where it was, three runs give the median, a run that reaches the top,
// Space, the tone generator's Play and Stop, presets, the slider, the gain's ceiling, a phone.

import { topFor } from '../../src/tools/hearing/hearing.ts';

const NOW = new Date('2026-11-02T09:00:00Z');
const readout = async (page) => Number(await page.locator('[data-live]').getAttribute('data-live'));
const runs = (page, ear) => page.locator(`[data-result="${ear}"] [data-run]`).evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-run'))));

/** Every gain the page sets, and every oscillator it makes. */
const watchAudio = (page) =>
  page.addInitScript(() => {
    window.__gains = [];
    window.__oscillators = 0;
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const makeOsc = Ctx.prototype.createOscillator;
    Ctx.prototype.createOscillator = function () {
      window.__oscillators++;
      return makeOsc.call(this);
    };
    const makeGain = Ctx.prototype.createGain;
    Ctx.prototype.createGain = function () {
      const node = makeGain.call(this);
      for (const name of ['setValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime', 'exponentialRampToValueAtTime']) {
        const real = node.gain[name].bind(node.gain);
        node.gain[name] = (value, ...rest) => {
          window.__gains.push(value);
          return real(value, ...rest);
        };
      }
      return node;
    };
  });

/** Playwright's clock, a minute before NOW until the page is in, then held: from there time moves
 *  only with runFor, so the readout is where the test left it. */
const startClock = (page) => page.clock.install({ time: new Date(NOW.getTime() - 60_000) });
const hold = (page) => page.clock.pauseAt(NOW);

/** One run: Start, let the tone climb for `ms`, then Gone. */
async function run(page, ms) {
  await page.locator('button.main').click();
  await page.getByRole('button', { name: 'Gone' }).waitFor();
  await page.clock.runFor(ms);
  await page.getByRole('button', { name: 'Gone' }).click();
}

export default {
  async 'the tone climbs, Gone records it, three runs give the median'({ page, open, choose, assert, sees, shot }) {
    await watchAudio(page);
    await startClock(page);
    await open('/hearing-test');
    await hold(page);
    await sees('This isn’t a medical test');
    await choose('Ear', 'Left');
    assert.equal(await readout(page), 2000);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Gone' }).waitFor();
    await page.clock.runFor(100);
    const early = await readout(page);
    await page.clock.runFor(4000);
    const later = await readout(page);
    assert.ok(later > early, `climbs: ${early} → ${later}`);
    assert.ok(later > 3800 && later <= 4100, `an octave in four seconds: ${later}`);
    await shot('running-390', 390);
    await page.getByRole('button', { name: 'Gone' }).click();
    const [first] = await runs(page, 'left');
    assert.ok(first >= 2000 && first <= 22000, `${first} between 2,000 and the top`);
    assert.ok(Math.abs(first - later) < 50, 'where the readout was');
    await sees('Run 1 of 3');
    // Two more.
    await page.getByRole('button', { name: 'Start run 2 of 3' }).waitFor();
    await run(page, 8000);
    await page.clock.runFor(500);
    await run(page, 6000);
    const all = await runs(page, 'left');
    assert.equal(all.length, 3);
    const mid = [...all].sort((a, b) => a - b)[1];
    const shown = Number(await page.locator('[data-result="left"] [data-median]').getAttribute('data-median'));
    assert.equal(shown, mid, 'the median is the result');
    const text = (await page.locator('[data-result="left"] .line-big').innerText()).replace(/\s+/g, ' ').trim();
    assert.equal(text, `Left: ${(Math.round(mid / 100) * 100).toLocaleString('en-US')} Hz`);
    await sees('This device plays up to');
    await page.locator('svg.scale rect.you').waitFor();
    assert.ok(Math.max(...(await page.evaluate(() => window.__gains))) <= 0.3, 'never above the ceiling');
    await page.getByRole('button', { name: 'Test again' }).waitFor();
    await shot('result-1280', 1280);
    await shot('result-390', 390);
  },

  async 'a run that reaches the top, and Space'({ page, open, choose, assert }) {
    await startClock(page);
    await open('/hearing-test');
    await hold(page);
    await choose('Ear', 'Right');
    // Unheard all the way: the top this device plays.
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Gone' }).waitFor();
    await page.clock.runFor(20_000);
    await page.getByRole('button', { name: 'Start run 2 of 3' }).waitFor();
    const top = Number(await page.locator('[data-result="right"] [data-run]').getAttribute('data-run'));
    // A Bluetooth headset in call mode plays at 16 kHz, so its top is 7,600 Hz, not 22,000.
    const rate = await page.evaluate(() => new AudioContext().sampleRate);
    assert.equal(top, topFor(rate), `the device's top at ${rate} Hz`);
    // Space says Gone, and doesn't start the next run as well.
    await page.getByRole('button', { name: 'Start run 2 of 3' }).focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Gone' }).waitFor();
    await page.clock.runFor(3000);
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Start run 3 of 3' }).waitFor();
    await page.clock.runFor(1000);
    assert.equal(await page.getByRole('button', { name: 'Gone' }).count(), 0, 'no run started by the same key');
    const two = await runs(page, 'right');
    assert.equal(two.length, 2);
    assert.ok(two[1] > 2000 && two[1] < 4000, `${two[1]}`);
    await page.getByRole('button', { name: 'Start run 3 of 3' }).click();
    await page.clock.runFor(20_000);
    const text = (await page.locator('[data-result="right"] .line-big').innerText()).replace(/\s+/g, ' ').trim();
    assert.equal(text, 'Right: the top this device plays', 'two of three reached the top');
  },

  async 'the sound stops when the page is hidden'({ page, open, assert }) {
    await startClock(page);
    await open('/hearing-test');
    await hold(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Gone' }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
    assert.equal(await page.locator('[data-run]').count(), 0, 'not counted');
  },

  async 'tones: play and stop, presets, the slider, the ceiling'({ page, open, choose, fill, assert, shot }) {
    await watchAudio(page);
    await open('/hearing-test');
    await choose('Mode', 'Tones');
    const play = page.locator('button.main');
    assert.equal(await play.getAttribute('aria-pressed'), 'false');
    assert.equal((await play.innerText()).trim(), 'Play');
    await play.click();
    assert.equal(await play.getAttribute('aria-pressed'), 'true');
    assert.equal((await play.innerText()).trim(), 'Stop');
    assert.equal(await page.evaluate(() => window.__oscillators), 1);
    // A preset glides the tone playing.
    await page.getByRole('button', { name: 'Mosquito 17.4 kHz' }).click();
    assert.equal(await page.getByLabel('Frequency', { exact: true }).inputValue(), '17400');
    assert.equal(await page.locator('[data-tone]').getAttribute('data-tone'), '17400');
    assert.equal(await page.evaluate(() => window.__oscillators), 1, 'the same tone, glided');
    // The slider is logarithmic: its middle is about 632 Hz.
    await page.getByLabel('Frequency slider').fill('500');
    assert.equal(await page.getByLabel('Frequency', { exact: true }).inputValue(), '632');
    await fill('Frequency', '1000');
    assert.equal(await page.getByLabel('Frequency slider').inputValue(), String(Math.round((Math.log(50) / Math.log(1000)) * 1000)));
    await fill('Frequency', '30000');
    await page.getByText('From 20 to 20,000 Hz.').waitFor();
    await choose('Wave', 'Square');
    // Full volume: still under the ceiling.
    await page.getByLabel('Volume').fill('100');
    await page.waitForTimeout(50);
    assert.ok(Math.max(...(await page.evaluate(() => window.__gains))) <= 0.3, 'never above the ceiling');
    await shot('tones-390', 390);
    await play.click();
    assert.equal(await play.getAttribute('aria-pressed'), 'false');
    assert.equal((await play.innerText()).trim(), 'Play');
    // The volume starts low again next time; the wave is kept.
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Volume').inputValue(), '25');
    assert.equal(await page.getByRole('radio', { name: 'Square' }).getAttribute('aria-checked'), 'true');
  },

  async 'German'({ page, open, choose, assert, sees, shot }) {
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await open('/hearing-test');
    await sees('Das ist kein medizinischer Test');
    await choose('Modus', 'Töne');
    await page.getByRole('button', { name: 'Mosquito 17,4 kHz' }).click();
    assert.equal(await page.locator('[data-tone]').innerText(), '17.400');
    await shot('tones-de-390', 390);
  },

  async 'fits a phone'({ page, open, choose, fitsPhone }) {
    await startClock(page);
    await open('/hearing-test');
    await hold(page);
    await run(page, 9000);
    await fitsPhone();
    await page.locator('button.main').click();
    await page.getByRole('button', { name: 'Gone' }).waitFor();
    await fitsPhone();
    await page.getByRole('button', { name: 'Gone' }).click();
    await choose('Mode', 'Tones');
    await fitsPhone();
  },
};
