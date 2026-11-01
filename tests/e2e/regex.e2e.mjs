// F-908 Regex: matches marked and listed with their groups, the flags, a pasted /abc/gi, a replace
// with its preview, a runaway pattern stopped after a second, a broken one named, the cheat sheet,
// what's remembered, German. Safari's engine gives up on its own after about 400 ms and answers "no
// match" even where there is one: that's said instead of a false "No match".

const marks = (page, region) => page.getByRole('region', { name: region, exact: true }).locator('mark').allInnerTexts();
/** How each engine ends a runaway pattern: our clock in V8, its own backtracking limit in JSC. */
const stopped = (engine) => (engine === 'webkit' ? 'This browser stopped early' : 'It took longer than a second, so it’s stopped');

const regionText = (page, region) => page.getByRole('region', { name: region, exact: true }).locator('pre').evaluate((el) => el.textContent);

export default {
  async 'matches marked, and listed with their place and groups'({ open, fill, assert, page, sees }) {
    await open('/regex');
    await sees('Type a pattern and a text');
    await fill('Pattern', '(?<year>\\d{4})-(\\d{2})');
    await fill('Text', 'Due 2026-10, paid 2025-03.');
    await sees('2 matches');
    assert.deepEqual(await marks(page, 'Matches marked'), ['2026-10', '2025-03']);
    assert.equal(await regionText(page, 'Matches marked'), 'Due 2026-10, paid 2025-03.');
    const first = page.locator('.found li').first();
    assert.match(await first.innerText(), /at 4–11/);
    assert.equal(await first.locator('.grp dt').first().innerText(), 'year');
    assert.equal(await first.locator('.grp dd code').first().innerText(), '2026');
    assert.equal(await first.locator('.grp dt').nth(1).innerText(), '2');
    assert.equal(await page.locator('.found li').count(), 2);
  },

  async 'flags: without g the first only; i and m'({ open, fill, check, assert, page, sees }) {
    await open('/regex');
    await fill('Pattern', '^fund');
    await fill('Text', 'fundus\nFundus\nfund');
    await sees('1 match');
    await check('m · multiline', true);
    await sees('2 matches');
    await check('i · ignoreCase', true);
    await sees('3 matches');
    await check('g · global', false);
    await sees('Only the first: switch on g for all of them.');
    assert.deepEqual(await marks(page, 'Matches marked'), ['fund']);
    // With d, each group's place.
    await check('g · global', true);
    await check('d · hasIndices', true);
    await fill('Pattern', 'f(un)d');
    assert.match(await page.locator('.found li').first().locator('.grp dd').innerText(), /un\s*1–3/);
  },

  async 'a pasted /abc/gi splits into pattern and flags'({ open, fill, assert, page, sees }) {
    await open('/regex');
    await fill('Text', 'Fundus, FUND, fun');
    await page.locator('#regex-pattern').focus();
    await page.locator('#regex-pattern').evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/plain', '/fund(us)?/gi');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await page.locator('#regex-pattern').inputValue(), 'fund(us)?');
    assert.equal(await page.getByRole('switch', { name: /^i · ignoreCase/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /^m · multiline/ }).getAttribute('aria-checked'), 'false');
    await sees('2 matches');
    assert.deepEqual(await marks(page, 'Matches marked'), ['Fundus', 'FUND']);
  },

  async 'replace, with the preview marked'({ open, fill, check, assert, page }) {
    await open('/regex');
    await fill('Pattern', '(?<year>\\d{4})-(\\d{2})');
    await fill('Text', 'Due 2026-10, paid 2025-03.');
    await check('Replace', true);
    await fill('Replace with', '$2/$<year>');
    await page.getByRole('region', { name: 'Replaced' }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Replaced"] pre')?.textContent === 'Due 10/2026, paid 03/2025.');
    assert.deepEqual(await marks(page, 'Replaced'), ['10/2026', '03/2025']);
    await fill('Replace with', '[$&]');
    await page.waitForFunction(() => document.querySelector('[aria-label="Replaced"] pre')?.textContent === 'Due [2026-10], paid [2025-03].');
    // Empty deletes each match.
    await fill('Replace with', '');
    await page.waitForFunction(() => document.querySelector('[aria-label="Replaced"] pre')?.textContent === 'Due , paid .');
  },

  async 'a runaway pattern is stopped after a second; the page stays free'({ open, fill, assert, page, sees, engine }) {
    await open('/regex');
    await fill('Text', `${'a'.repeat(40)}!`);
    const started = Date.now();
    await fill('Pattern', '(a+)+$');
    // The page answers while the worker is stuck.
    const tick = await page.evaluate(() => new Promise((resolve) => {
      const t = performance.now();
      setTimeout(() => resolve(performance.now() - t), 10);
    }));
    assert.ok(tick < 200, `the page waited ${tick} ms`);
    await sees(stopped(engine), 10_000);
    if (engine !== 'webkit') assert.ok(Date.now() - started >= 1000);
    assert.equal(await page.getByText('No match').count(), 0);
    // A fixed pattern runs again, in a fresh worker.
    await fill('Pattern', 'a+');
    await sees('1 match');
    assert.deepEqual(await marks(page, 'Matches marked'), ['a'.repeat(40)]);
    // A match the runaway hides at the end: never a false "No match".
    await fill('Text', `${'a'.repeat(30)}!ab`);
    await fill('Pattern', '(a+)+b');
    await sees(stopped(engine), 10_000);
    assert.equal(await page.getByText('No match').count(), 0);
  },

  async 'a broken pattern shows the engine’s message, readable'({ open, fill, assert, page, sees }) {
    await open('/regex');
    await fill('Text', 'abc');
    await fill('Pattern', '(a');
    await sees('The pattern doesn’t work:');
    const message = await page.locator('.status .error').innerText();
    assert.doesNotMatch(message, /Invalid regular expression/);
    await fill('Pattern', '[z-a]');
    await sees('The pattern doesn’t work:');
  },

  async 'the cheat sheet puts its token in at the cursor'({ open, fill, assert, page }) {
    await open('/regex');
    const field = page.locator('#regex-pattern');
    await fill('Pattern', 'ab');
    await field.evaluate((el) => el.setSelectionRange(1, 1));
    await page.getByRole('button', { name: /^Insert \\d:/ }).click();
    assert.equal(await field.inputValue(), 'a\\db');
    // A selection is wrapped.
    await field.evaluate((el) => el.setSelectionRange(3, 4));
    await page.getByRole('button', { name: /^Insert \(…\):/ }).click();
    assert.equal(await field.inputValue(), 'a\\d(b)');
    // A named group with its name chosen, ready to type over.
    await field.evaluate((el) => el.setSelectionRange(0, 0));
    await page.getByRole('button', { name: /^Insert \(\?<name>…\):/ }).click();
    await page.keyboard.type('x');
    assert.equal(await field.inputValue(), '(?<x>)a\\d(b)');
  },

  async 'remembers the flags, never the pattern or the text'({ open, fill, check, assert, page }) {
    await open('/regex');
    await check('i · ignoreCase', true);
    await check('s · dotAll', true);
    await fill('Pattern', 'secret-pattern');
    await fill('Text', 'secret-text');
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('switch', { name: /^i · ignoreCase/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /^s · dotAll/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('#regex-pattern').inputValue(), '');
    assert.equal(await page.locator('#regex-text').inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('secret-pattern') && !stored.includes('secret-text'));
  },

  async 'in German'({ open, fill, page, sees }) {
    await open('/regex');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Muster', '\\d');
    await fill('Text', 'a1b2');
    await sees('2 Treffer');
    await fill('Muster', '(');
    await sees('Das Muster geht nicht:');
  },

  async 'looks'({ open, fill, check, page, shot, engine }) {
    await open('/regex');
    await shot('empty-390', 390);
    await fill('Pattern', '(?<year>\\d{4})-(?<month>\\d{2})(-(\\d{2}))?');
    await fill('Text', 'Invoice 2026-10-31, due 2026-11.\nPaid on 2025-03-14 by transfer; the next one comes 2027-01.');
    await check('Replace', true);
    await fill('Replace with', '$<month>/$<year>');
    await page.getByRole('region', { name: 'Replaced' }).waitFor();
    // Typing scrolled the page; the header sticks wherever it is.
    await page.evaluate(() => scrollTo(0, 0));
    await shot('matches-390', 390);
    await shot('matches-1280', 1280);
    await fill('Pattern', '(a+)+$');
    await fill('Text', `${'a'.repeat(40)}!`);
    await page.getByText(stopped(engine)).waitFor({ timeout: 10_000 });
    await page.evaluate(() => scrollTo(0, 0));
    await shot('slow-390', 390);
  },

  async 'fits a phone'({ open, fill, check, fitsPhone, page }) {
    await open('/regex');
    await fill('Pattern', `(?<${'n'.repeat(60)}>x+)`);
    await fill('Text', `${'x'.repeat(3000)} ${'y'.repeat(500)}`);
    await check('Replace', true);
    await fill('Replace with', '$&$&');
    await page.getByRole('region', { name: 'Replaced' }).waitFor();
    await fitsPhone();
  },
};
