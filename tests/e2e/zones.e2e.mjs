// F-504 Time zones: places found in English, German or by zone; their times at a held clock
// (31 October 2026, the week Berlin and New York are five hours apart); a picked time two days later
// (six hours); the hours everyone works; the live clock ticking; places kept.

const NOON = '2026-10-31T12:00:00Z'; // Berlin 13:00 (CET), New York 08:00 (EDT), Tokyo 21:00
const row = (page, id) => page.locator(`.row[data-place="${id}"]`);

async function add(page, query) {
  const field = page.getByLabel('Add a place', { exact: true });
  await field.fill(query);
  await field.press('Enter');
}

export default {
  async 'the time there now, and the hours everyone works'({ page, open, assert, sees, shot }) {
    await page.clock.setFixedTime(new Date(NOON));
    await open('/time-zones');
    await sees('Add a place to compare');
    assert.equal((await row(page, 'berlin').locator('.t').innerText()).trim(), '1:00 PM', 'home first');
    await add(page, 'new y');
    assert.equal((await row(page, 'new-york').locator('.t').innerText()).trim(), '8:00 AM');
    await sees('United States · UTC−4 · −5 h');
    assert.match(await row(page, 'new-york').locator('.clock small').innerText(), /Sat · morning/);
    await sees('Everyone is at work 2:00 PM–5:00 PM, your time.');
    assert.equal(await page.locator('.both .strip i.hit').count(), 3);
    await add(page, 'Tokio');
    assert.equal((await row(page, 'tokyo').locator('.t').innerText()).trim(), '9:00 PM');
    await sees('Japan · UTC+9 · +8 h');
    await sees('No hour when everyone is at work');
    await shot('now-1280', 1280);
    await shot('now-390', 390);
  },

  async 'a picked time, after New York changes its clocks'({ page, open, choose, assert, sees, shot }) {
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript(() => localStorage.setItem('fundus:tool:zones', JSON.stringify({ mode: 'now', places: ['new-york', 'mumbai'] })));
    await open('/time-zones');
    await choose('Show', 'Pick a time');
    await page.getByLabel('Date', { exact: true }).fill('2026-11-02');
    await page.getByLabel('Time at home', { exact: true }).fill('15:00');
    assert.equal((await row(page, 'new-york').locator('.t').innerText()).trim(), '9:00 AM');
    await sees('United States · UTC−5 · −6 h');
    assert.equal((await row(page, 'mumbai').locator('.t').innerText()).trim(), '7:30 PM');
    await sees('India · UTC+5:30 · +4:30 h');
    await sees('3:00 PM at home');
    await sees('No hour when everyone is at work');
    await page.getByRole('button', { name: 'Remove Mumbai' }).click();
    await sees('Everyone is at work 3:00 PM–5:00 PM, your time.');
    await shot('pick-1280', 1280);
    await shot('pick-390', 390);
    // Pick the first shared hour.
    await page.getByRole('button', { name: 'Pick 3:00 PM' }).click();
    assert.equal(await page.getByLabel('Time at home', { exact: true }).inputValue(), '15:00');
  },

  async 'the clock ticks each minute'({ page, open, assert }) {
    await page.clock.install({ time: new Date('2026-10-31T12:00:30Z') });
    await open('/time-zones');
    const t = () => row(page, 'berlin').locator('.t').innerText();
    assert.equal((await t()).trim(), '1:00 PM');
    await page.clock.runFor(31_000);
    assert.equal((await t()).trim(), '1:01 PM');
    await page.clock.runFor(60_000 * 5);
    assert.equal((await t()).trim(), '1:06 PM');
  },

  async 'any zone by its name, German names, and places kept'({ page, open, assert, sees }) {
    await page.clock.setFixedTime(new Date(NOON));
    await open('/time-zones');
    await page.getByLabel('Add a place', { exact: true }).fill('ushuaia');
    await page.getByRole('button', { name: /Ushuaia/ }).click();
    await sees('America/Argentina/Ushuaia · UTC−3');
    assert.equal((await row(page, 'tz:America/Argentina/Ushuaia').locator('.t').innerText()).trim(), '9:00 AM');
    await add(page, 'Kapstadt');
    assert.equal((await row(page, 'cape-town').locator('.t').innerText()).trim(), '2:00 PM');
    await page.getByLabel('Add a place', { exact: true }).fill('atlantis');
    await sees('No place or zone called “atlantis”.');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.locator('.rows .row').count(), 3, 'home and the two places');
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:tool:zones'))).places, ['tz:America/Argentina/Ushuaia', 'cape-town']);
  },

  async 'home from Settings'({ page, open, assert, sees }) {
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript(() => {
      localStorage.setItem('fundus:shared', JSON.stringify({ homeZone: 'America/New_York' }));
      localStorage.setItem('fundus:tool:zones', JSON.stringify({ mode: 'now', places: ['berlin'] }));
    });
    await open('/time-zones');
    assert.equal((await row(page, 'new-york').locator('.t').innerText()).trim(), '8:00 AM');
    await sees('Germany · UTC+1 · +5 h');
    await sees('America/New_York, the home time zone from Settings');
  },

  async 'German'({ page, open, assert, sees, shot }) {
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript(() => {
      localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' }));
      localStorage.setItem('fundus:tool:zones', JSON.stringify({ mode: 'now', places: ['new-york', 'tokyo'] }));
    });
    await open('/time-zones');
    assert.equal((await row(page, 'berlin').locator('.t').innerText()).trim(), '13:00');
    assert.equal((await row(page, 'new-york').locator('.t').innerText()).trim(), '08:00');
    await sees('Vereinigte Staaten · UTC−4 · −5 h');
    await sees('Keine Stunde, in der alle arbeiten');
    await shot('now-de-390', 390);
  },

  async 'fits a phone'({ page, open, fitsPhone }) {
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript(() => localStorage.setItem('fundus:tool:zones', JSON.stringify({ mode: 'pick', places: ['ho-chi-minh-city', 'st-john-s', 'tz:America/Argentina/Buenos_Aires', 'washington-d-c'] })));
    await open('/time-zones');
    await page.getByLabel('Add a place', { exact: true }).fill('a');
    await fitsPhone();
  },
};
