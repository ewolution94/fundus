// The way back from a tool: the arrow at the left of the header on every page but the home (with its
// words and Esc on a computer), back to where the home was left when it's the page behind, to the
// home's top when the tool came from a link; Esc and the browser's back do the same; German.

const back = (page) => page.locator('header.top a.back');

/** Opens the home on the wall, scrolled well down to a tool, then that tool; where the home was left. */
const fromTheWall = async (t) => {
  const { page, assert } = t;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'en', view: 'wall' })));
  await t.open('/');
  return open(page, assert);
};
const open = async (page, assert) => {
  const clean = page.locator('[data-drawer="clean"]');
  await clean.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  assert.ok(y > 600, `well down the wall: ${y}`);
  await clean.click();
  await page.waitForSelector('main[data-ready]');
  return y;
};
const atHome = async (page, y) => {
  await page.locator('[data-drawer]').first().waitFor();
  await page.waitForFunction((y) => Math.abs(scrollY - y) <= 1, y, { timeout: 2000 }).catch(async () => {
    throw new Error(`back on the home at ${await page.evaluate(() => scrollY)}, not ${y}`);
  });
};

export default {
  'a phone: the arrow at the left of the header, back to where the wall was left': async (t) => {
    const { page, assert } = t;
    const y = await fromTheWall(t);
    const length = await page.evaluate(() => history.length);
    const [arrow, brand] = [await back(page).boundingBox(), await page.locator('.brand').boundingBox()];
    assert.ok(arrow.x <= 17 && arrow.width >= 38 && arrow.height >= 38, `a 38 px target at the gutter: ${JSON.stringify(arrow)}`);
    assert.ok(brand.x > arrow.x + arrow.width, 'before the name');
    assert.equal(await back(page).getAttribute('aria-label'), 'All tools');
    assert.equal(await back(page).locator('span').isVisible(), false, 'the arrow alone');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'the header fits');
    await page.screenshot({ path: 'test-results/back-phone.png' });
    // Still there far down a tool: the header is sticky.
    await page.evaluate(() => scrollTo({ top: 400, behavior: 'instant' }));
    assert.ok(await back(page).isVisible());
    await back(page).click();
    await atHome(page, y);
    assert.equal(await page.evaluate(() => history.length), length, 'a step back, not a new page');
    assert.equal(await back(page).count(), 0, 'none on the home');
  },

  "Esc and the browser's back come back to the same place": async (t) => {
    const { page, assert } = t;
    let y = await fromTheWall(t);
    await page.keyboard.press('Escape');
    await atHome(page, y);
    y = await open(page, assert);
    await page.goBack();
    await atHome(page, y);
  },

  'a tool opened from a link goes to the home, from its top': async (t) => {
    const { page, assert } = t;
    await t.open('/count-words');
    await back(page).click();
    await page.locator('a.row').first().waitFor();
    assert.ok(page.url().endsWith('/'));
    assert.equal(await page.evaluate(() => scrollY), 0);
  },

  'a computer: the words and Esc beside the arrow': async (t) => {
    const { page, assert } = t;
    await t.open('/count-words');
    assert.equal((await back(page).innerText()).replace(/\s+/g, ' ').trim(), 'All tools Esc');
    await page.screenshot({ path: 'test-results/back-desk.png', clip: { x: 0, y: 0, width: 1280, height: 240 } });
    // A modified click opens the home in a new tab, as a link does.
    const [tab] = await Promise.all([page.context().waitForEvent('page'), back(page).click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] })]);
    assert.ok(page.url().endsWith('/count-words'), 'this one stays');
    await tab.close();
  },

  'German': async (t) => {
    const { page, assert } = t;
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await t.open('/count-words');
    assert.equal(await back(page).getAttribute('aria-label'), 'Alle Werkzeuge');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'the header fits');
  },
};
