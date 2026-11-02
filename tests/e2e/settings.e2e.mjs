// The settings sheet's "Used by" numbers: each names its tool on hover, from the keyboard, on a tap
// and on a longer press; a long list waits behind "+n"; the name stays on screen at 390 px; German.

const openSettings = async (t) => {
  await t.open('/');
  await t.page.keyboard.press(',');
  await t.page.locator('p.used').first().waitFor();
};
const tip = (page) => page.locator('.tip');
// The setting a row belongs to, by its words.
const row = (page, words) => page.locator('.set', { hasText: words });
const touch = (el, type) => el.dispatchEvent(type, { pointerType: 'touch', isPrimary: true, bubbles: true });

export default {
  'hover names the tool': async (t) => {
    const { page, assert } = t;
    await openSettings(t);
    const ref = row(page, 'Photo format').locator('.ref', { hasText: 'F-108' });
    assert.equal(await ref.getAttribute('aria-label'), 'F-108, Meme maker');
    await ref.hover();
    await tip(page).waitFor();
    assert.equal((await tip(page).innerText()).trim(), 'Meme maker');
    // Above the number, centred on it.
    const [a, b] = [await ref.boundingBox(), await tip(page).boundingBox()];
    assert.ok(b.y + b.height <= a.y, 'the name sits above the number');
    assert.ok(Math.abs(b.x + b.width / 2 - (a.x + a.width / 2)) < 2, 'centred');
    // A click with the mouse leaves it as hovering showed it.
    await ref.click();
    assert.equal(await tip(page).count(), 1);
    await page.screenshot({ path: `test-results/settings-hover${t.engine === 'webkit' ? '-webkit' : ''}.png` });
    await page.mouse.move(5, 5);
    await tip(page).waitFor({ state: 'detached' });
  },

  'the keyboard shows it, Escape puts it away first': async (t) => {
    const { page, assert } = t;
    await openSettings(t);
    const ref = row(page, 'Photo format').locator('.ref').first();
    // Focus after a key press is keyboard focus (WebKit's Tab skips buttons unless the Mac says so).
    await page.keyboard.press('Shift');
    await ref.focus();
    await tip(page).waitFor();
    assert.equal((await tip(page).innerText()).trim(), 'Convert photos');
    await page.keyboard.press('Escape');
    await tip(page).waitFor({ state: 'detached' });
    assert.ok(await page.locator('p.used').first().isVisible(), 'the sheet stays open');
  },

  'a long press names it, and it goes by itself': async (t) => {
    const { page, assert } = t;
    await openSettings(t);
    const ref = row(page, 'Photo format').locator('.ref', { hasText: 'F-203' });
    await touch(ref, 'pointerdown');
    await page.waitForTimeout(200);
    assert.equal(await tip(page).count(), 0, 'not before the hold');
    await page.waitForTimeout(250);
    assert.equal((await tip(page).innerText()).trim(), 'PDF to photos');
    await touch(ref, 'pointerup');
    await ref.dispatchEvent('click');
    assert.equal(await tip(page).count(), 1, 'the click after the hold keeps it');
    await tip(page).waitFor({ state: 'detached', timeout: 4000 });
  },

  'a tap names it, a press elsewhere puts it away': async (t) => {
    const { page, assert } = t;
    await openSettings(t);
    const ref = row(page, 'Photo format').locator('.ref', { hasText: 'F-102' });
    await touch(ref, 'pointerdown');
    await touch(ref, 'pointerup');
    await ref.dispatchEvent('click');
    assert.equal((await tip(page).innerText()).trim(), 'Shrink a photo');
    await row(page, 'Photo format').locator('b').first().dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true });
    await tip(page).waitFor({ state: 'detached' });
  },

  'a long list waits behind +n': async (t) => {
    const { page, assert } = t;
    await openSettings(t);
    const names = row(page, 'File names');
    assert.equal(await names.locator('.ref').count(), 6);
    const more = names.locator('.more');
    const n = Number((await more.innerText()).replace('+', ''));
    assert.ok(n > 10);
    await more.click();
    assert.equal(await names.locator('.ref').count(), 6 + n);
    assert.equal(await names.locator('.more').count(), 0);
  },

  'the developer tools are listed, all of them': async (t) => {
    const { page, assert } = t;
    await openSettings(t);
    const dev = page.locator('.set').filter({ has: page.getByRole('switch', { name: /developer tools/i }) });
    await dev.locator('.more').click();
    const last = (await dev.locator('.ref').allInnerTexts()).at(-1);
    assert.equal(last, 'F-913');
  },

  'on a phone the name stays on screen': async (t) => {
    const { page, assert } = t;
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(t);
    // The last number on a line near the right edge: its name is pulled back inside.
    const refs = row(page, 'Photo format').locator('.ref');
    const ref = refs.last();
    await ref.scrollIntoViewIfNeeded();
    await touch(ref, 'pointerdown');
    await touch(ref, 'pointerup');
    await ref.dispatchEvent('click');
    const b = await tip(page).boundingBox();
    assert.ok(b.x >= 8 && b.x + b.width <= 390 - 8, `inside: ${b.x}–${b.x + b.width}`);
    await page.screenshot({ path: `test-results/settings-phone${t.engine === 'webkit' ? '-webkit' : ''}.png` });
  },

  'German': async (t) => {
    const { page, assert } = t;
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await openSettings(t);
    const used = page.locator('p.used').first();
    assert.match(await used.innerText(), /^Genutzt von/);
    const ref = used.locator('.ref', { hasText: 'F-108' });
    assert.equal(await ref.getAttribute('aria-label'), 'F-108, Meme machen');
    await ref.hover();
    assert.equal((await tip(page).innerText()).trim(), 'Meme machen');
  },
};
