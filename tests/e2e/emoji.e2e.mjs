// F-309 Emoji picker: the groups, search in both languages (a word, a :shortcode:, a code point),
// a tap that copies at once, the skin tone kept, the recent ones after a reload, the line, the codes,
// the group index, the keyboard, German, and a phone.

const FIND = 'Find an emoji';
const cells = (page) => page.locator('.sections button.cell');
const firstCell = (page) => cells(page).first().textContent();
const prefs = (page, value) => page.evaluate((v) => localStorage.setItem('fundus:prefs', JSON.stringify(v)), value);

export default {
  async 'every group, and a tap copies at once'({ open, page, assert, sees, clipboard, engine, shot }) {
    await open('/emoji-picker');
    const groups = await page.locator('.sections section h2 span').allInnerTexts();
    assert.deepEqual(groups.map((g) => g.toLowerCase()), ['smileys & emotion', 'people & body', 'animals & nature', 'food & drink', 'travel & places', 'activities', 'objects', 'symbols', 'flags']);
    assert.equal(await firstCell(page), '😀');
    assert.ok((await cells(page).count()) > 1800);
    await sees('Tap an emoji');
    await cells(page).first().click();
    await sees('Grinning face');
    await sees('Grinsendes Gesicht');
    if (engine === 'chromium') assert.equal(await clipboard(), '😀');
    assert.ok(await page.locator('.stamp.on').isVisible(), 'says it’s copied');
    // The chosen one under the highlighter.
    assert.equal(await page.locator('.cell.on').first().textContent(), '😀');
    await shot('picked', 1280);
  },

  async 'search by a word in either language, a shortcode, a code point'({ open, fill, page, assert, sees, clipboard, engine }) {
    await open('/emoji-picker');
    await fill(FIND, 'thumbs up');
    await sees('Found');
    assert.equal(await firstCell(page), '👍');
    await fill(FIND, 'Daumen hoch');
    assert.equal(await firstCell(page), '👍');
    await fill(FIND, 'pizza');
    assert.equal(await firstCell(page), '🍕');
    // Enter copies the first one found.
    await page.getByLabel(FIND).press('Enter');
    await sees('Pizza');
    if (engine === 'chromium') assert.equal(await clipboard(), '🍕');
    await fill(FIND, ':tada');
    assert.equal(await firstCell(page), '🎉');
    await fill(FIND, 'U+1F600');
    assert.equal(await firstCell(page), '😀');
    await fill(FIND, '❤');
    assert.equal(await firstCell(page), '❤️');
    await fill(FIND, 'xyzzy');
    await sees('No emoji for “xyzzy”.');
    assert.equal(await cells(page).count(), 0);
    // Clearing brings every group back; the group index stays all along.
    await page.getByRole('button', { name: 'Clear the search' }).click();
    assert.equal(await page.getByLabel(FIND).inputValue(), '');
    assert.ok((await cells(page).count()) > 1800);
    await page.getByLabel(FIND).fill('cat');
    await page.getByLabel(FIND).press('Escape');
    assert.equal(await page.getByLabel(FIND).inputValue(), '', 'Escape clears the search');
    assert.ok(page.url().endsWith('/emoji-picker'), 'and stays on the tool');
  },

  async 'a skin tone, kept for next time'({ open, fill, page, assert, clipboard, engine }) {
    await open('/emoji-picker');
    await page.getByRole('button', { name: 'Skin tone' }).click();
    await page.getByRole('radiogroup', { name: 'Skin tone' }).getByRole('radio').nth(3).click();
    assert.equal(await page.getByRole('radiogroup', { name: 'Skin tone' }).count(), 0, 'the choice closes');
    await fill(FIND, 'thumbs up');
    assert.equal(await firstCell(page), '👍🏽');
    await cells(page).first().click();
    if (engine === 'chromium') assert.equal(await clipboard(), '👍🏽');
    await fill(FIND, 'pizza');
    assert.equal(await firstCell(page), '🍕', 'no tone where Unicode has none');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal((await page.getByRole('button', { name: 'Skin tone' }).textContent()).trim(), '✋🏽');
    await fill(FIND, 'waving hand');
    assert.equal(await firstCell(page), '👋🏽');
  },

  async 'the last ones picked come first after a reload'({ open, fill, page, assert }) {
    await open('/emoji-picker');
    for (const q of ['pizza', 'party popper', 'red heart']) {
      await fill(FIND, q);
      await cells(page).first().click();
    }
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal((await page.locator('.sections section h2 span').first().innerText()).toLowerCase(), 'recent');
    assert.deepEqual(await page.locator('[data-section=recent] .cell').allTextContents(), ['❤️', '🎉', '🍕']);
    // The search itself isn't kept.
    assert.equal(await page.getByLabel(FIND).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('red heart'), 'the search is never stored');
  },

  async 'the line collects every tap: Copy all, Clear'({ open, page, assert, clipboard, engine }) {
    await open('/emoji-picker');
    const picks = cells(page);
    await picks.nth(0).click();
    await picks.nth(2).click();
    await picks.nth(5).click();
    const line = page.locator('output.line');
    assert.equal(await line.textContent(), '😀😄😅');
    await page.getByRole('button', { name: 'Copy all' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), '😀😄😅');
    await page.getByRole('button', { name: 'Clear the line' }).click();
    assert.equal(await line.count(), 0);
    await picks.nth(1).click();
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await line.count(), 0, 'the line is never kept');
  },

  async 'the chosen one’s codes, each with Copy'({ open, fill, page, assert, clipboard, engine, sees }) {
    await open('/emoji-picker');
    await fill(FIND, 'thumbs up');
    await cells(page).first().click();
    const codes = page.locator('dl.codes');
    const value = (dt) => codes.locator('div').filter({ has: page.locator('dt', { hasText: dt }) }).locator('code');
    assert.equal(await value('Code points').textContent(), 'U+1F44D');
    assert.equal(await value('Shortcode').textContent(), ':+1: :thumbsup:');
    assert.equal(await value('HTML').textContent(), '&#x1F44D;');
    assert.equal(await value('CSS').textContent(), 'content: "\\1F44D"');
    assert.equal(await value('JavaScript').textContent(), "'\\u{1F44D}'");
    await sees('Emoji 1.0');
    await codes.locator('div').filter({ has: page.locator('dt', { hasText: 'HTML' }) }).getByRole('button').click();
    if (engine === 'chromium') assert.equal(await clipboard(), '&#x1F44D;');
    // An emoji made of several code points, in its tone.
    await page.getByRole('button', { name: 'Skin tone' }).click();
    await page.getByRole('radiogroup', { name: 'Skin tone' }).getByRole('radio').nth(5).click();
    await cells(page).first().click();
    assert.equal(await value('Code points').textContent(), 'U+1F44D U+1F3FF');
    assert.equal(await value('JavaScript').textContent(), "'\\u{1F44D}\\u{1F3FF}'");
  },

  async 'the group index jumps and marks where you are'({ open, page, assert }) {
    await open('/emoji-picker');
    const food = page.getByRole('navigation', { name: 'Groups' }).getByRole('button', { name: 'Food & drink' });
    await food.click();
    await page.waitForFunction(() => {
      const bar = document.querySelector('.bar').getBoundingClientRect().bottom;
      const top = document.querySelector('[data-section=g4]').getBoundingClientRect().top;
      return Math.abs(top - bar) < 12;
    }, null, { timeout: 5000 });
    assert.equal(await food.getAttribute('aria-current'), 'true');
    // The bar stays under the header while the page scrolls.
    const header = await page.locator('header.top').boundingBox();
    const bar = await page.locator('.bar').boundingBox();
    assert.ok(Math.abs(bar.y - (header.y + header.height)) < 2, `bar at ${bar.y}, header ends at ${header.y + header.height}`);
    // Scrolling on marks the group in view.
    await page.evaluate(() => document.querySelector('[data-section=g9]').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('nav.index [aria-current=true]')?.getAttribute('aria-label') === 'Flags', null, { timeout: 5000 });
    // A group picked while searching clears the search.
    await page.getByLabel(FIND).fill('pizza');
    await page.getByRole('navigation', { name: 'Groups' }).getByRole('button', { name: 'Animals & nature' }).click();
    assert.equal(await page.getByLabel(FIND).inputValue(), '');
    assert.ok((await cells(page).count()) > 1800);
  },

  async 'the keyboard: down into the grid, arrows, Enter copies'({ open, page, assert, clipboard, engine }) {
    await open('/emoji-picker');
    const focused = () => page.evaluate(() => document.activeElement?.textContent);
    await page.getByLabel(FIND).focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await focused(), '😀');
    await page.keyboard.press('ArrowRight');
    assert.equal(await focused(), '😃');
    const columns = await page.evaluate(() => getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length);
    await page.keyboard.press('ArrowDown');
    const below = await page.evaluate(() => [...document.querySelectorAll('.sections button.cell')].indexOf(document.activeElement));
    assert.equal(below, 1 + columns);
    await page.keyboard.press('Enter');
    const want = await cells(page).nth(1 + columns).textContent();
    if (engine === 'chromium') assert.equal(await clipboard(), want);
    // One stop for Tab: only the active cell takes it.
    assert.equal(await page.locator('.sections button.cell[tabindex="0"]').count(), 1);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'emoji-find', 'up from the first row goes back to the search');
  },

  async 'in German'({ open, page, assert, sees }) {
    await open('/emoji-picker');
    await prefs(page, { language: 'de' });
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await sees('Smileys & Gefühle');
    await page.getByLabel('Emoji finden').fill('daumen');
    assert.equal(await firstCell(page), '👍');
    await page.getByLabel('Emoji finden').fill('lächelnd');
    const accents = await cells(page).count();
    await page.getByLabel('Emoji finden').fill('lachelnd');
    assert.equal(await cells(page).count(), accents, 'with or without the umlaut');
    await page.getByLabel('Emoji finden').fill('rotes herz');
    await cells(page).first().click();
    await sees('Rotes Herz');
    await sees('Red heart');
    await sees('Kopiert');
  },

  async 'a phone: the codes fold away, the line waits at the thumb'({ open, fill, page, assert, fitsPhone, shot }) {
    await page.setViewportSize({ width: 390, height: 844 });
    await open('/emoji-picker');
    const columns = await page.evaluate(() => getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length);
    assert.equal(columns, 8);
    await page.evaluate(() => scrollTo(0, 1600));
    await page.waitForTimeout(150);
    await cells(page).nth(60).click();
    await cells(page).nth(61).click();
    const tray = await page.locator('.tray').boundingBox();
    const thumb = await page.locator('a.thumb').boundingBox();
    assert.ok(tray.y + tray.height > 844 - 80, 'at the bottom of the screen');
    assert.ok(tray.x >= thumb.x + thumb.width, 'right of the way back');
    // The keyboard up: the tray steps aside.
    await page.getByLabel(FIND).focus();
    assert.equal(await page.locator('.tray').evaluate((el) => getComputedStyle(el).visibility), 'hidden');
    await page.getByLabel(FIND).blur();
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.locator('dl.codes').count(), 0);
    await page.getByRole('button', { name: 'Codes', exact: true }).click();
    assert.ok(await page.locator('dl.codes').isVisible());
    await shot('phone', 390);
    await fitsPhone();
    await fill(FIND, 'family man woman girl boy');
    await fitsPhone();
  },
};
