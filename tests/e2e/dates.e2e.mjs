// F-501 Dates & weeks: each sum with real dates on screen, today from the home zone (the clock held
// at a fixed time), the Week setting from inside the tool, a date pasted on the home.

const at = (page, iso) => page.clock.setFixedTime(new Date(iso));
const val = (text, label) => text(`.line:has(.lab:text-is("${label}")) .val`);

export default {
  async 'days between, with the end day and working days'({ page, open, fill, assert, text, shot }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/dates-and-weeks');
    assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), '2026-10-31', 'From starts at today');
    await page.getByText('Pick the end date.').waitFor();
    await fill('To', '2026-12-24');
    assert.equal(await val(text, 'Days'), '54');
    assert.equal(await val(text, 'With the end day'), '55');
    assert.equal(await val(text, 'Working days, Mon–Fri'), '39');
    assert.equal(await val(text, 'Weeks and days'), '7 weeks, 5 days');
    await shot('between-1280', 1280);
    await shot('between-390', 390);
    // Backwards
    await fill('To', '2026-10-01');
    assert.equal(await val(text, 'Days'), '−30');
    await page.getByText('counted backwards').waitFor();
  },

  async 'plus a month clamps at the month’s end'({ page, open, fill, choose, assert, text, shot }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/dates-and-weeks');
    await choose('Find', 'Plus, minus');
    await fill('From', '2026-01-31');
    await page.getByText('Type how many.').waitFor();
    await fill('Amount', '1');
    await choose('Unit', 'Months');
    assert.equal(await val(text, 'Date'), 'Sat, Feb 28, 2026');
    await fill('From', '2028-01-31');
    assert.equal(await val(text, 'Date'), 'Tue, Feb 29, 2028', 'a leap year');
    await choose('Unit', 'Working days');
    await fill('From', '2026-11-06');
    assert.equal(await val(text, 'Date'), 'Mon, Nov 9, 2026', 'Friday + 1 working day');
    await choose('Direction', '− Minus');
    await fill('Amount', '10');
    await choose('Unit', 'Days');
    assert.equal(await val(text, 'Date'), 'Tue, Oct 27, 2026');
    assert.equal(await val(text, 'Days from the start'), '−10');
    await shot('add-390', 390);
    await fill('Amount', '1,5');
    await page.getByText('Whole numbers only').waitFor();
  },

  async 'the weekday and the day of the year'({ page, open, fill, choose, assert, text }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/dates-and-weeks');
    await choose('Find', 'Weekday');
    await fill('Date', '1989-11-09');
    assert.equal(await val(text, 'Weekday'), 'Thursday');
    assert.equal(await val(text, 'Day of the year'), '313 of 365');
    assert.equal(await val(text, 'Calendar week'), 'Week 45 of 1989');
    assert.equal(await val(text, 'From today'), '13,505 days ago');
  },

  async 'calendar week 53, then US weeks from inside the tool'({ page, open, fill, choose, assert, text, shot }) {
    await at(page, '2026-10-31T10:00:00Z');
    await page.addInitScript(() => {
      if (!localStorage.getItem('fundus:shared')) localStorage.setItem('fundus:shared', JSON.stringify({ week: 'iso' }));
    });
    await open('/dates-and-weeks');
    await choose('Find', 'Calendar week');
    await fill('Date', '2027-01-01');
    assert.equal(await val(text, 'Calendar week'), 'Week 53 of 2026');
    assert.equal(await val(text, 'First day'), 'Mon, Dec 28, 2026');
    assert.equal(await val(text, 'Last day'), 'Sun, Jan 3, 2027');
    assert.equal(await val(text, 'Weeks in 2026'), '53');
    await shot('week-1280', 1280);
    await choose('Weeks', 'Sunday, US');
    await page.getByText('Every tool now counts US weeks from Sunday').waitFor();
    assert.equal(await val(text, 'Calendar week'), 'Week 1 of 2027');
    assert.equal(await val(text, 'First day'), 'Sun, Dec 27, 2026');
    assert.equal(await val(text, 'Last day'), 'Sat, Jan 2, 2027');
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:shared'))).week, 'us', 'the shared setting changed');
    await fill('Date', '2022-12-31');
    assert.equal(await val(text, 'Calendar week'), 'Week 53 of 2022');
  },

  async 'age, and a 29 February birthday'({ page, open, fill, choose, assert, text, shot }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/dates-and-weeks');
    await choose('Find', 'Age');
    await page.getByText('Pick the birthday.').waitFor();
    await fill('Birthday', '2000-02-29');
    assert.equal(await val(text, 'Years'), '26');
    assert.equal(await val(text, 'Months'), '8');
    assert.equal(await val(text, 'Days'), '2');
    assert.equal(await val(text, 'Days alive'), '9,741');
    assert.equal(await page.locator('section[aria-label="Age"] h3 span').last().textContent(), '26 years, 8 months, 2 days');
    assert.equal(await val(text, 'Date'), 'Sun, Feb 28, 2027');
    assert.equal(await val(text, 'Until then'), '120 days');
    await page.getByText('in other years the birthday is 28 February').waitFor();
    await shot('age-390', 390);
    await shot('age-1280', 1280);
    await fill('Birthday', '2026-11-01');
    await page.getByText('not born yet').waitFor();
  },

  async 'today is the home zone’s'({ page, open, assert }) {
    // 23:30 UTC: already 1 November in Berlin, still 31 October in New York.
    await at(page, '2026-10-31T23:30:00Z');
    await open('/dates-and-weeks');
    assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), '2026-11-01');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ homeZone: 'America/New_York' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), '2026-10-31');
  },

  async 'remembers the sum, not the dates'({ page, open, fill, choose, assert }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/dates-and-weeks');
    await choose('Find', 'Age');
    await fill('Birthday', '1990-05-15');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Age' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Birthday', { exact: true }).inputValue(), '');
  },

  async 'a date pasted on the home opens here with it'({ page, open, assert }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '24.12.2026');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Dates & weeks/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), '2026-12-24');
  },

  async 'German'({ page, open, fill, assert, text, shot }) {
    await at(page, '2026-10-31T10:00:00Z');
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await open('/dates-and-weeks');
    await fill('Bis', '2027-03-01');
    assert.equal(await val(text, 'Tage'), '121');
    assert.equal(await val(text, 'Wochen und Tage'), '17 Wochen, 2 Tage');
    await shot('between-de-390', 390);
  },

  async 'fits a phone'({ page, open, fill, choose, fitsPhone }) {
    await at(page, '2026-10-31T10:00:00Z');
    await open('/dates-and-weeks');
    await choose('Find', 'Age');
    await fill('Birthday', '1990-05-15');
    await fitsPhone();
    await choose('Find', 'Plus, minus');
    await fill('Amount', '1234');
    await choose('Unit', 'Working days');
    await fitsPhone();
  },
};
