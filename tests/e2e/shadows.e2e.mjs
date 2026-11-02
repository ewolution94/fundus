// F-913 Shadows: the default (five layers, CSS takes every line), the controls changing the layers,
// the presets, the light's angle and the tint, both grounds with the dark one stronger, a pasted
// box-shadow as "Yours", Copy, what's kept, German, 390 px.

/** The code of one output row, by its label, in the CSS receipt. */
const out = (page, label) =>
  page
    .getByRole('region', { name: 'CSS', exact: true })
    .locator('.out-row')
    .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`) }) })
    .locator('code')
    .innerText();

/** A declaration's value: what follows "property:" up to the ";". */
const valueOf = (decl) => decl.replace(/^[a-z-]+:\s*/, '').replace(/;$/, '');
const layerCount = (decl) => (decl.match(/hsl\(/g) ?? []).length;
const alphas = (decl) => [...decl.matchAll(/\/ ([\d.]+)\)/g)].map((m) => Number(m[1]));

/** Sets a range input by its label, as a drag would. */
const slide = (page, label, value) =>
  page.getByLabel(label, { exact: true }).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

const supports = (page, property, value) => page.evaluate(([p, v]) => CSS.supports(p, v), [property, value]);

export default {
  async 'the default: five layers that CSS takes, on both grounds'({ open, page, assert }) {
    await open('/shadows');
    assert.equal(await page.getByRole('radio', { name: 'Card', exact: true }).getAttribute('aria-checked'), 'true');
    const light = await out(page, 'box-shadow');
    assert.match(light, /^box-shadow:\n {2}0 0\.6px 1\.3px hsl\(\d+ \d+% \d+% \/ 0\.04\),\n/);
    assert.equal(layerCount(light), 5);
    assert.ok(await supports(page, 'box-shadow', valueOf(light)), light);
    const dark = await out(page, 'On the dark ground');
    assert.equal(layerCount(dark), 5);
    assert.ok(await supports(page, 'box-shadow', valueOf(dark)), dark);
    // Stronger on the dark ground: 2.5 times.
    const sum = (xs) => Math.round(xs.reduce((s, x) => s + x, 0) * 1000) / 1000;
    assert.equal(sum(alphas(light)), 0.2);
    assert.equal(sum(alphas(dark)), 0.5);
    const drop = await out(page, 'drop-shadow()');
    assert.equal((drop.match(/drop-shadow\(/g) ?? []).length, 5);
    assert.ok(await supports(page, 'filter', valueOf(drop)), drop);
  },

  async 'both previews: a card on each ground, wearing its own value'({ open, page, assert }) {
    await open('/shadows');
    const grounds = page.locator('.ground');
    assert.equal(await grounds.count(), 2);
    const bg = await grounds.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    assert.deepEqual(bg, ['rgb(242, 240, 235)', 'rgb(42, 42, 42)']);
    const shadows = await page.locator('.ground .sample').evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow));
    assert.equal(shadows.length, 2);
    for (const s of shadows) assert.equal((s.match(/px/g) ?? []).length, 5 * 4, s);
    // Another dark ground: the dark value takes its hue.
    await page.getByLabel('Dark ground', { exact: true }).fill('#1e3a5f');
    assert.match(await out(page, 'On the dark ground'), /hsl\(21\d \d+% \d+% \//);
    assert.equal(await page.locator('.ground').nth(1).evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(30, 58, 95)');
  },

  async 'more or fewer layers, and the presets'({ open, page, assert, choose }) {
    await open('/shadows');
    await slide(page, 'Layers', 8);
    assert.equal(layerCount(await out(page, 'box-shadow')), 8);
    assert.equal(await page.getByRole('radio', { name: 'Custom' }).getAttribute('aria-checked'), 'true');
    await slide(page, 'Layers', 1);
    const one = await out(page, 'box-shadow');
    assert.equal(layerCount(one), 1);
    assert.match(one, /^box-shadow:\n {2}0 16px 32px hsl\(.* \/ 0\.2\);$/);
    await choose('Preset', 'Floating');
    assert.equal(layerCount(await out(page, 'box-shadow')), 6);
    await choose('Preset', 'Sharp');
    assert.equal(layerCount(await out(page, 'box-shadow')), 2);
    await choose('Preset', 'Subtle');
    const subtle = await out(page, 'box-shadow');
    assert.equal(layerCount(subtle), 3);
    assert.ok(await supports(page, 'box-shadow', valueOf(subtle)));
  },

  async 'the light’s angle moves the shadow; the tint can be plain black'({ open, page, assert, sees, check }) {
    await open('/shadows');
    await slide(page, 'Light', 90);
    await sees('from the right');
    // Light from the right: the shadow falls left.
    assert.match(await out(page, 'box-shadow'), /\n {2}-16px 0 32px hsl/);
    await slide(page, 'Light', 315);
    await sees('from the top left');
    assert.match(await out(page, 'box-shadow'), /\n {2}11\.3px 11\.3px 32px hsl/);
    assert.doesNotMatch(await out(page, 'box-shadow'), /hsl\(0 0% 0%/);
    await check('Tinted by the ground', false);
    assert.equal((await out(page, 'box-shadow')).match(/hsl\(0 0% 0% \//g).length, 5);
  },

  async 'a box-shadow pasted on the home opens as Yours, the controls near it'({ open, page, assert, sees, shot }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 6px 12px rgba(0,0,0,.1), inset 0 0 0 1px hsl(0 0% 100% / 0.5);');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Shadows/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await sees('Yours: 3 layers');
    assert.match(await page.getByLabel('Your box-shadow', { exact: true }).inputValue(), /^box-shadow: 0 1px 2px rgba\(0, 0, 0, 0\.2\)/);
    // Two outer layers, the farthest 6 px down, their alphas added up.
    assert.equal(await page.getByLabel('Layers', { exact: true }).inputValue(), '2');
    assert.equal(await page.getByLabel('Distance', { exact: true }).inputValue(), '6');
    assert.equal(await page.getByLabel('Blur', { exact: true }).inputValue(), '12');
    assert.equal(await page.getByLabel('Strength', { exact: true }).inputValue(), '0.3');
    assert.equal(layerCount(await out(page, 'box-shadow')), 2);
    // Yours beside the smoothed one, on both grounds.
    assert.equal(await page.locator('.ground .sample.yours').count(), 2);
    assert.equal(await page.locator('.ground .sample.ours').count(), 2);
    const theirs = await page.locator('.ground .sample.yours').first().evaluate((el) => getComputedStyle(el).boxShadow);
    assert.match(theirs, /inset/);
    assert.equal((theirs.match(/rgba?\(/g) ?? []).length, 3);
    await shot('yours', 1280);
    await shot('yours-390', 390);
    await page.getByRole('button', { name: 'Clear' }).click();
    assert.equal(await page.locator('.ground .sample.yours').count(), 0);
  },

  async 'what it can’t read it says'({ open, fill, sees, page, assert }) {
    await open('/shadows');
    await fill('Your box-shadow', 'a soft one, please');
    await sees('That isn’t a box-shadow this tool can read');
    assert.equal(await page.locator('.ground .sample.yours').count(), 0);
    await fill('Your box-shadow', '0 0.5rem 1rem -0.25rem #0003');
    await sees('Yours: 1 layer');
    assert.equal(await page.getByLabel('Distance', { exact: true }).inputValue(), '8');
  },

  async 'Copy puts the CSS on the clipboard'({ open, page, assert, clipboard, engine }) {
    await open('/shadows');
    const row = page.getByRole('region', { name: 'CSS', exact: true }).locator('.out-row').first();
    await row.getByRole('button', { name: 'Copy' }).click();
    await row.getByRole('button', { name: 'Copied' }).waitFor();
    if (engine === 'chromium') assert.equal(await clipboard(), await out(page, 'box-shadow'));
  },

  async 'keeps the controls and grounds, never a pasted shadow'({ open, fill, page, assert, choose }) {
    await open('/shadows');
    // A pasted shadow sets the controls near it; what's changed after that is kept.
    await fill('Your box-shadow', '0 3px 7px rgba(1, 2, 3, 0.25)');
    await choose('Preset', 'Floating');
    await slide(page, 'Light', 30);
    await page.getByLabel('Light ground', { exact: true }).fill('#fff8e7');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Your box-shadow', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('Light', { exact: true }).inputValue(), '30');
    assert.equal(await page.getByRole('radio', { name: 'Floating' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Light ground', { exact: true }).inputValue(), '#fff8e7');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('rgba(1, 2, 3'));
  },

  async 'in German'({ open, page, sees }) {
    await open('/shadows');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await sees('Heller Grund');
    await sees('Vom Grund getönt');
    await sees('von oben');
  },

  async 'looks'({ open, page, shot }) {
    await open('/shadows');
    await shot('default', 1280);
    await shot('default-390', 390);
    await slide(page, 'Light', 315);
    await page.getByRole('radio', { name: 'Floating' }).click();
    await shot('floating-390', 390);
  },

  async 'fits a phone'({ open, fill, page, fitsPhone }) {
    await open('/shadows');
    await fitsPhone();
    await slide(page, 'Layers', 8);
    await slide(page, 'Distance', 100);
    await slide(page, 'Blur', 200);
    await fill('Your box-shadow', Array.from({ length: 6 }, (_, i) => `0 ${i * 7}px ${i * 13}px color(display-p3 0.1 0.2 0.3 / 0.0${i + 1})`).join(', '));
    await fitsPhone();
  },
};
