// F-904 Timestamps: seconds, milliseconds and nanoseconds told apart, each result in the home zone
// and UTC, a typed date to Unix time (its own offset, a skipped hour), now live, Copy, German.
// The browser runs in Europe/Berlin (run.mjs), the device's zone and so the home zone by default.

const T = 1761942000; // Fri 2025-10-31 20:20:00 UTC

const val = (page, receipt, label) =>
  page
    .getByRole('region', { name: receipt, exact: true })
    .locator('.row')
    .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.val')
    .innerText();

export default {
  async 'a Unix time in seconds: the date at home and in UTC'({ open, fill, assert, page, sees }) {
    await open('/timestamps');
    await fill('Unix time', String(T));
    await sees('Read as seconds');
    assert.equal(await val(page, 'Europe/Berlin', 'ISO 8601'), '2025-10-31T21:20:00+01:00');
    assert.equal(await val(page, 'Europe/Berlin', 'RFC 2822'), 'Fri, 31 Oct 2025 21:20:00 +0100');
    assert.match(await val(page, 'Europe/Berlin', 'Readable'), /^Friday, October 31, 2025 at 9:20:00\sPM GMT\+1$/);
    assert.equal(await val(page, 'UTC', 'ISO 8601'), '2025-10-31T20:20:00Z');
    assert.equal(await val(page, 'UTC', 'RFC 2822'), 'Fri, 31 Oct 2025 20:20:00 +0000');
    assert.equal(await val(page, 'Timestamp', 'Milliseconds'), `${T}000`);
    // The answer is under the highlighter.
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Readable');
  },

  async 'milliseconds and nanoseconds by their size, or as picked'({ open, fill, choose, assert, page, sees }) {
    await open('/timestamps');
    await fill('Unix time', `${T}123`);
    await sees('Read as milliseconds');
    assert.equal(await val(page, 'UTC', 'ISO 8601'), '2025-10-31T20:20:00.123Z');
    await fill('Unix time', `${T}123456789`);
    await sees('Read as nanoseconds');
    assert.equal(await val(page, 'UTC', 'ISO 8601'), '2025-10-31T20:20:00.123456789Z');
    assert.equal(await val(page, 'Timestamp', 'Nanoseconds'), `${T}123456789`);
    assert.equal(await val(page, 'Timestamp', 'Seconds'), String(T));
    await fill('Unix time', String(T));
    await choose('Unit', 'ms');
    await sees('Read as milliseconds');
    assert.equal(await val(page, 'UTC', 'ISO 8601'), '1970-01-21T09:25:42.000Z');
  },

  async 'how long ago, live'({ open, fill, assert, page }) {
    await open('/timestamps');
    await fill('Unix time', String(Math.floor(Date.now() / 1000) - 3 * 86400));
    assert.equal(await val(page, 'Timestamp', 'Relative'), '3 days ago');
  },

  async 'nothing typed: now, ticking'({ open, assert, page, sees }) {
    await open('/timestamps');
    await sees('Showing now.');
    const first = Number(await val(page, 'Timestamp', 'Seconds'));
    assert.ok(Math.abs(first - Date.now() / 1000) < 3, String(first));
    await page.waitForFunction((s) => {
      const row = [...document.querySelectorAll('section[aria-label="Timestamp"] .row')].find((r) => r.querySelector('.lab')?.textContent === 'Seconds');
      return Number(row?.querySelector('.val')?.textContent) > s;
    }, first, { timeout: 3000 });
    // Use puts now into the field.
    await page.getByRole('button', { name: 'Use' }).click();
    const typed = Number(await page.getByLabel('Unix time', { exact: true }).inputValue());
    assert.ok(Math.abs(typed - Date.now() / 1000) < 3);
  },

  async 'a date to Unix time: at home, in UTC, with its own offset'({ open, fill, choose, assert, page, sees }) {
    await open('/timestamps');
    await choose('Mode', 'Date → Unix time');
    await fill('Date and time', '31.10.2025 21:20');
    assert.equal(await val(page, 'Timestamp', 'Seconds'), String(T));
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Seconds');
    await choose('Typed in', 'UTC');
    assert.equal(await val(page, 'Timestamp', 'Seconds'), String(T + 3600));
    await fill('Date and time', '2025-10-31T20:20:00.250Z');
    await sees('Its own offset counts: +00:00.');
    assert.equal(await val(page, 'Timestamp', 'Milliseconds'), `${T}250`);
  },

  async 'a time the clocks skip, said so'({ open, fill, choose, assert, page, sees }) {
    await open('/timestamps');
    await choose('Mode', 'Date → Unix time');
    await choose('Typed in', 'Berlin');
    await fill('Date and time', '2026-03-29 02:30');
    await sees('The clocks in Berlin skip this time that day: read as 03:30.');
    assert.equal(await val(page, 'Europe/Berlin', 'ISO 8601'), '2026-03-29T03:30:00+02:00');
  },

  async 'what isn’t a time says so'({ open, fill, choose, sees }) {
    await open('/timestamps');
    await fill('Unix time', '17619x');
    await sees('That’s not a Unix time');
    await choose('Mode', 'Date → Unix time');
    await fill('Date and time', '30.02.2026');
    await sees('That date or time doesn’t exist');
    await fill('Date and time', 'next tuesday');
    await sees('Not a date this reads');
  },

  async 'Copy takes the value'({ open, fill, assert, page, clipboard, engine }) {
    await open('/timestamps');
    await fill('Unix time', String(T));
    const row = page.getByRole('region', { name: 'UTC', exact: true }).locator('.row').first();
    await row.getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), '2025-10-31T20:20:00Z');
  },

  async 'the home zone from Settings, and German'({ open, fill, assert, page }) {
    await open('/timestamps');
    await page.evaluate(() => {
      localStorage.setItem('fundus:shared', JSON.stringify({ homeZone: 'Asia/Kolkata' }));
      localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' }));
    });
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Unix-Zeit', String(Math.floor(Date.now() / 1000) - 3 * 86400));
    assert.equal(await val(page, 'Zeitstempel', 'Relativ'), 'vor 3 Tagen');
    await fill('Unix-Zeit', String(T));
    assert.equal(await val(page, 'Asia/Kolkata', 'ISO 8601'), '2025-11-01T01:50:00+05:30');
    assert.match(await val(page, 'Asia/Kolkata', 'Lesbar'), /^Samstag, 1\. November 2025 um 01:50:00/);
  },

  async 'a Unix time pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate((t) => {
      const data = new DataTransfer();
      data.setData('text/plain', t);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, String(T));
    await page.getByRole('link', { name: /Timestamps/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Unix time', { exact: true }).inputValue(), String(T));
    assert.equal(await val(page, 'UTC', 'ISO 8601'), '2025-10-31T20:20:00Z');
  },

  async 'remembers the mode and unit, never the time'({ open, fill, choose, assert, page }) {
    await open('/timestamps');
    await choose('Unit', 'ms');
    await fill('Unix time', '1234567890123');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'ms', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Unix time', { exact: true }).inputValue(), '');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('1234567890123'));
  },

  async 'looks'({ open, fill, choose, shot }) {
    await open('/timestamps');
    await fill('Unix time', `${T}123456789`);
    await shot('stamp-390', 390);
    await shot('stamp-1280', 1280);
    await choose('Mode', 'Date → Unix time');
    await fill('Date and time', '2026-10-25 02:30');
    await shot('date-390', 390);
    await shot('date-1280', 1280);
  },

  async 'fits a phone'({ open, fill, choose, fitsPhone }) {
    await open('/timestamps');
    await fill('Unix time', `-${'8640000000000'}`);
    await fitsPhone();
    await choose('Mode', 'Date → Unix time');
    await fill('Date and time', 'Sat Oct 31 2026 21:20:00 GMT+0100 (Central European Standard Time)');
    await fitsPhone();
  },
};
