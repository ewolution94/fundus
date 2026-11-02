// F-508 Life in numbers, the clock held at 2 November 2026, 10:00 in Berlin: the counts, the round
// numbers and birthdays, a time of birth, the poster saved as SVG and as PNG (A4 at 300 dpi),
// "Remember on this device" off and on across a reload, a date from the home, German, a phone.

import { dimensions, sniff } from '../../src/lib/files.ts';
import { dpiOf } from '../../src/tools/life/life.ts';

const NOW = '2026-11-02T09:00:00Z';
const hold = (page) => page.clock.setFixedTime(new Date(NOW));
const val = (text, label) => text(`.line:has(.lab:text-is("${label}")) .val`);

export default {
  async 'the days, weeks and birthdays are right'({ page, open, fill, assert, text, sees, shot }) {
    await hold(page);
    await open('/life-in-numbers');
    await sees('Pick your birth date.');
    await fill('Born', '1990-05-15');
    assert.equal(await val(text, 'Days'), '13,320');
    assert.equal(await val(text, 'Weeks'), '1,902');
    assert.equal(await val(text, 'Months'), '437');
    assert.equal(await val(text, 'Hours'), '319,691');
    assert.equal(await val(text, 'Seconds'), '1,150,887,600');
    assert.equal(await val(text, 'Heartbeats'), '≈ 1,342,702,200');
    assert.equal((await page.locator('[data-age]').innerText()).replace(/\s+/g, ' ').trim(), '36 years 5 months 18 days');
    const next = page.getByRole('region', { name: 'Next birthday' });
    assert.equal(await next.locator('.line:has(.lab:text-is("Date")) .val').innerText(), 'Sat, May 15, 2027');
    assert.equal(await next.locator('.line:has(.lab:text-is("Until then")) .val').innerText(), 'in 194 days');
    await sees('turns 37');
    const round = page.getByRole('region', { name: 'Next round birthday' });
    assert.equal(await round.locator('.line:has(.lab:text-is("Date")) .val').innerText(), 'Wed, May 15, 2030');
    await sees('turns 40');
    // The round numbers: the last passed, then the next five in order.
    assert.match(await page.locator('[data-mile="last"] .what').innerText(), /^LAST\s*13,000 days$/);
    assert.equal(await page.locator('[data-mile="last"] .when').innerText(), '320 days ago');
    assert.equal(await page.locator('[data-mile="0"] .what').innerText(), '20 million minutes');
    assert.equal(await page.locator('[data-mile="1"] .what').innerText(), '2,000 weeks · 14,000 days');
    assert.equal(await page.locator('[data-mile="1"] .date').innerText(), 'Tue, Sep 12, 2028');
    assert.equal(await page.locator('.miles li').count(), 6);
    // The planets
    assert.equal(await val(text, 'Mercury'), '151.42 years');
    assert.equal(await val(text, 'Neptune'), '0.22 years');
    await shot('numbers-1280', 1280);
    await shot('numbers-390', 390);
  },

  async 'the seconds tick, and a time of birth counts'({ page, open, fill, assert, text }) {
    await page.clock.install({ time: new Date(NOW) });
    await open('/life-in-numbers');
    await fill('Born', '1990-05-15');
    await page.getByText('add the time of birth for more').waitFor();
    const before = Number((await val(text, 'Seconds')).replace(/,/g, ''));
    await page.clock.runFor(5_000);
    const after = Number((await val(text, 'Seconds')).replace(/,/g, ''));
    assert.equal(after - before, 5, 'five seconds on');
    await fill('Time', '14:30');
    assert.equal(await page.getByText('add the time of birth for more').count(), 0);
    // 14½ hours fewer than from midnight (319,691 then).
    assert.equal(Number((await val(text, 'Hours')).replace(/,/g, '')), 319676);
    assert.match(await page.locator('.miles li:has-text("million minutes") .date').innerText(), /, \d\d:\d\d (AM|PM)$/, 'the minutes’ milestone has its time');
    assert.match(await page.locator('.miles li:has-text("weeks") .date').innerText(), /\d{4}$/, 'a day’s has none');
  },

  async 'born on 29 February'({ page, open, fill, assert, sees }) {
    await hold(page);
    await open('/life-in-numbers');
    await fill('Born', '2004-02-29');
    await sees('in other years the birthday is 28 February');
    const next = page.getByRole('region', { name: 'Next birthday' });
    assert.equal(await next.locator('.line:has(.lab:text-is("Date")) .val').innerText(), 'Sun, Feb 28, 2027');
  },

  async 'the poster saves as SVG and as PNG, A4 at 300 dpi'({ page, open, fill, choose, assert, save, shot }) {
    await hold(page);
    await open('/life-in-numbers');
    await fill('Born', '1990-05-15');
    await page.getByRole('img', { name: /Your life in weeks: 1,896 of 4,680 boxes filled/ }).waitFor();
    await choose('Format', 'SVG');
    const svg = await save();
    assert.equal(svg.name, 'life-in-weeks-1990-05-15.svg');
    const xml = new TextDecoder().decode(svg.bytes);
    assert.match(xml, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="210mm" height="297mm"/);
    assert.match(xml, />Your life in weeks</);
    assert.match(xml, />Born May 15, 1990</);
    assert.match(xml, /1,896 weeks lived as of November 2, 2026/);
    assert.equal(([...xml.matchAll(/<path d="([^"]*)"/g)][0][1].match(/M/g) ?? []).length, 1896, 'the weeks lived, filled');
    await choose('Format', 'PNG');
    const png = await save({ timeout: 60_000 });
    assert.equal(png.name, 'life-in-weeks-1990-05-15.png');
    assert.equal(sniff(png.bytes), 'png');
    assert.deepEqual(dimensions(png.bytes), { width: 2480, height: 3508 });
    assert.equal(dpiOf(png.bytes), 300);
    // Ink on white: the corner is paper, a filled box is ink.
    const pixels = await page.evaluate(async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const c = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const at = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
      return { corner: at(5, 5) };
    }, [...png.bytes]);
    assert.deepEqual(pixels.corner, [255, 255, 255, 255]);
    await shot('poster-390', 390);
  },

  async 'remembers the date only when asked'({ page, open, fill, check, assert }) {
    await hold(page);
    await open('/life-in-numbers');
    await fill('Born', '1990-05-15');
    await fill('Time', '14:30');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Born', { exact: true }).inputValue(), '', 'off by default: not kept');
    assert.ok(!(await page.evaluate(() => localStorage.getItem('fundus:tool:life') ?? '')).includes('1990'));
    await fill('Born', '1990-05-15');
    await fill('Time', '14:30');
    await check('Remember on this device', true);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Born', { exact: true }).inputValue(), '1990-05-15', 'kept');
    assert.equal(await page.getByLabel('Time', { exact: true }).inputValue(), '14:30');
    assert.equal(await page.getByRole('switch', { name: /Remember on this device/ }).getAttribute('aria-checked'), 'true');
    // Off again: gone from the device at once.
    await check('Remember on this device', false);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:tool:life')));
    assert.equal(stored.birth, '');
    assert.equal(stored.time, '');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Born', { exact: true }).inputValue(), '');
  },

  async 'a date pasted on the home opens here with it'({ page, open, assert, text }) {
    await hold(page);
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '15.05.1990');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Life in numbers/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Born', { exact: true }).inputValue(), '1990-05-15');
    assert.equal(await val(text, 'Days'), '13,320');
  },

  async 'German, with the decimal comma'({ page, open, fill, assert, text, shot }) {
    await hold(page);
    await page.addInitScript(() => {
      localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' }));
      localStorage.setItem('fundus:shared', JSON.stringify({ decimal: 'comma' }));
    });
    await open('/life-in-numbers');
    await fill('Geboren', '1990-05-15');
    assert.equal(await val(text, 'Tage'), '13.320');
    assert.equal(await page.locator('[data-mile="1"] .what').innerText(), '2.000 Wochen · 14.000 Tage');
    assert.equal(await page.locator('[data-mile="0"] .what').innerText(), '20 Millionen Minuten');
    assert.equal(await val(text, 'Merkur'), '151,42 Jahre');
    await shot('numbers-de-390', 390);
  },

  async 'fits a phone'({ page, open, fill, fitsPhone }) {
    await hold(page);
    await open('/life-in-numbers');
    await fill('Born', '1990-05-15');
    await fill('Time', '14:30');
    await fitsPhone();
  },
};
