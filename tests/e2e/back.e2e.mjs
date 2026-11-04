// The way back from a tool (the user's pick D, 2026-11-04): "All tools" starts the crumbs on every page
// but the home (with Esc on a computer); on a phone, once it has scrolled under the header, a button at
// the bottom left takes over. Back to where the home was left when it's the page behind, to the home's
// top when the tool came from a link; Esc and the browser's back do the same. The shelf in the crumbs
// opens the home on its chip. German.

const back = (page) => page.locator('.crumbs a.back');
const thumb = (page) => page.locator('a.thumb');
/** What it says, as written (the crumbs set it in capitals), the hidden Esc left out. */
const words = (page) => back(page).evaluate((a) => [...a.children].filter((c) => c.checkVisibility()).map((c) => c.textContent.trim()).filter(Boolean).join(' '));
const shown = (page) => thumb(page).evaluate((a) => getComputedStyle(a).visibility === 'visible');
const until = (page, visible, what) =>
  page.waitForFunction((v) => getComputedStyle(document.querySelector('a.thumb')).visibility === (v ? 'visible' : 'hidden'), visible, { timeout: 3000 }).catch(() => {
    throw new Error(`the button should be ${visible ? 'shown' : 'hidden'} ${what}`);
  });

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
/** Makes the page long enough to scroll the crumbs away, and scrolls them under the header. */
const scrollDown = async (page) => {
  await page.evaluate(() => {
    document.querySelector('main').style.paddingBottom = '1600px';
    scrollTo({ top: 700, behavior: 'instant' });
  });
};

export default {
  'a phone: "All tools" starts the crumbs, and the thumb button takes over further down': async (t) => {
    const { page, assert } = t;
    const y = await fromTheWall(t);
    const length = await page.evaluate(() => history.length);
    assert.equal(await page.locator('header.top a.back').count(), 0, 'none in the header');
    const crumb = await back(page).boundingBox();
    assert.ok(crumb.x <= 17 && crumb.height >= 32, `at the gutter, 32 px tall: ${JSON.stringify(crumb)}`);
    assert.equal(await words(page), 'All tools', 'no Esc on a phone');
    assert.equal(await shown(page), false, 'no button while the crumb is in sight');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'nothing sideways');
    await page.screenshot({ path: 'test-results/back-phone.png' });

    await scrollDown(page);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('a.thumb')).visibility === 'visible');
    await page.waitForTimeout(250);
    const box = await thumb(page).boundingBox();
    assert.deepEqual([box.x, 844 - box.y - box.height, box.width, box.height], [16, 16, 54, 54], 'a 54 px square at the bottom left');
    assert.equal(await thumb(page).getAttribute('aria-label'), 'All tools');
    await page.screenshot({ path: 'test-results/back-thumb.png' });

    // Back up, it steps aside again.
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('a.thumb')).visibility === 'hidden');
    await scrollDown(page);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('a.thumb')).visibility === 'visible');
    await thumb(page).click();
    await atHome(page, y);
    assert.equal(await page.evaluate(() => history.length), length, 'a step back, not a new page');
    assert.equal(await thumb(page).count(), 0, 'none on the home');
  },

  'the thumb button steps aside while a text field has the keyboard': async (t) => {
    const { page, assert } = t;
    await page.setViewportSize({ width: 390, height: 844 });
    await t.open('/count-words');
    await scrollDown(page);
    await until(page, true, 'far down');
    // Without scrolling to it: that would bring the crumb back into sight (in WebKit a moment later).
    await page.evaluate(() => document.querySelector('textarea').focus({ preventScroll: true }));
    await page.waitForTimeout(300);
    assert.equal(await shown(page), false, 'hidden while typing, far down');
    await page.locator('textarea').first().blur();
    await until(page, true, 'once the field lets go');
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

  'the shelf opens the home on its chip': async (t) => {
    const { page, assert } = t;
    await t.open('/count-words');
    await page.locator('.crumbs a.shelf').click();
    await page.locator('a.row').first().waitFor();
    assert.ok(page.url().endsWith('/'));
    const pressed = await page.locator('.chip[aria-pressed="true"]').innerText();
    assert.match(pressed, /Text/);
  },

  'a computer: Esc beside the words, no thumb button': async (t) => {
    const { page, assert } = t;
    await t.open('/count-words');
    assert.equal(await words(page), 'All tools Esc');
    assert.equal(await thumb(page).isVisible(), false);
    await scrollDown(page);
    await page.waitForTimeout(300);
    assert.equal(await thumb(page).isVisible(), false, 'not even far down');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: 'test-results/back-desk.png', clip: { x: 0, y: 0, width: 1280, height: 260 } });
    // A modified click opens the home in a new tab, as a link does.
    const [tab] = await Promise.all([page.context().waitForEvent('page'), back(page).click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] })]);
    assert.ok(page.url().endsWith('/count-words'), 'this one stays');
    await tab.close();
  },

  'the licences have it too': async (t) => {
    const { page } = t;
    await page.goto(t.base + '/licences');
    await back(page).click();
    await page.locator('a.row').first().waitFor();
  },

  'German': async (t) => {
    const { page, assert } = t;
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await t.open('/count-words');
    assert.equal(await thumb(page).getAttribute('aria-label'), 'Alle Werkzeuge');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await words(page), 'Alle Werkzeuge');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'nothing sideways');
  },
};
