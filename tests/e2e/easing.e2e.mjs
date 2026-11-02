// F-912 Easing curves: a pasted cubic-bezier() or transition line opens in it, a handle dragged with
// the mouse and moved with the arrow keys, the presets, a spring as a linear() CSS takes, the
// preview (and reduced motion), Copy, mistakes named, what's kept, German, 390 px.

/** The code of one output row, by its label, in the CSS receipt. */
const out = (page, label) =>
  page
    .getByRole('region', { name: 'CSS', exact: true })
    .locator('.out-row')
    .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label}$`) }) })
    .locator('code')
    .innerText();

const handle = (page, n) => page.getByRole('button', { name: new RegExp(`^Handle ${n}:`) });

/** Pastes a text on the home (developer tools on) and opens Easing curves from its suggestions. */
async function pasteOnHome({ open, page }, text) {
  await open('/');
  await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
  await page.reload();
  await page.evaluate((t) => {
    const data = new DataTransfer();
    data.setData('text/plain', t);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  }, text);
  await page.getByRole('link', { name: /Easing curves/ }).first().click();
  await page.waitForSelector('main[data-ready]');
}

const supports = (page, value) => page.evaluate((v) => CSS.supports('transition-timing-function', v), value);

export default {
  async 'a cubic-bezier pasted on the home opens here with its numbers'(t) {
    const { page, assert } = t;
    await pasteOnHome(t, 'cubic-bezier(0.68, -0.6, 0.32, 1.6)');
    assert.equal(await page.getByLabel('Function', { exact: true }).inputValue(), 'cubic-bezier(0.68, -0.6, 0.32, 1.6)');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.68, -0.6, 0.32, 1.6)');
    assert.match(await page.locator('.pair').innerText(), /P1 \(0\.68, -0\.6\) · P2 \(0\.32, 1\.6\)/);
    await handle(page, 1).waitFor();
    assert.match(await handle(page, 1).getAttribute('aria-label'), /x 0\.68, y -0\.6/);
    // It's one of the presets: the list says so.
    assert.equal(await page.locator('#easing-preset').inputValue(), 'in-out-back');
  },

  async 'a transition line brings its property and duration'(t) {
    const { page, assert } = t;
    await pasteOnHome(t, 'transition: opacity 300ms cubic-bezier(0.2, 0, 0, 1);');
    assert.equal(await page.getByLabel('Duration', { exact: true }).inputValue(), '300');
    assert.equal(await out(page, 'Transition'), 'transition: opacity 300ms cubic-bezier(0.2, 0, 0, 1);');
    assert.equal(await out(page, 'Web Animations'), "el.animate(keyframes, { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' });");
  },

  async 'a handle dragged with the mouse changes the curve and the CSS'({ open, page, assert }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('ease-in-out');
    assert.equal(await out(page, 'Timing function'), 'ease-in-out');
    const box = await handle(page, 1).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 5, y - i * 10);
    await page.mouse.up();
    const fn = await out(page, 'Timing function');
    const m = fn.match(/^cubic-bezier\(([-\d.]+), ([-\d.]+), 0\.58, 1\)$/);
    assert.ok(m, fn);
    assert.ok(Number(m[1]) > 0.5 && Number(m[2]) > 0.2, fn);
    assert.equal(await page.getByLabel('Function', { exact: true }).inputValue(), fn);
    assert.ok(await supports(page, fn));
    // Not a preset any more.
    assert.equal(await page.locator('#easing-preset').inputValue(), '');
    // A drag can't take x outside the time.
    const b2 = await handle(page, 2).boundingBox();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.mouse.down();
    await page.mouse.move(b2.x + 600, b2.y + b2.height / 2, { steps: 5 });
    await page.mouse.up();
    assert.match(await out(page, 'Timing function'), /, 1, 1\)$/);
  },

  async 'a focused handle moves 0.01 an arrow, 0.1 with Shift'({ open, page, assert }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('out-back');
    await handle(page, 2).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.34, 1.56, 0.65, 1)');
    await page.keyboard.press('ArrowUp');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.34, 1.56, 0.65, 1.01)');
    await page.keyboard.press('Shift+ArrowLeft');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.34, 1.56, 0.55, 1.01)');
    await handle(page, 1).focus();
    await page.keyboard.press('Shift+ArrowDown');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.34, 1.46, 0.55, 1.01)');
    // Still focused after the graph re-drew.
    assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), /^Handle 1: x 0\.34, y 1\.46/);
  },

  async 'every preset is CSS the browser takes'({ open, page, assert }) {
    await open('/easing-curves');
    const ids = await page.locator('#easing-preset option:not([disabled])').evaluateAll((els) => els.map((e) => e.value));
    assert.equal(ids.length, 29);
    for (const id of ids) {
      await page.locator('#easing-preset').selectOption(id);
      const fn = await out(page, 'Timing function');
      assert.ok(await supports(page, fn), `${id}: ${fn}`);
      assert.ok(await page.evaluate((v) => CSS.supports('transition', v.replace(/^transition: |;$/g, '')), await out(page, 'Transition')));
    }
    await page.locator('#easing-preset').selectOption('ease');
    assert.equal(await out(page, 'Timing function'), 'ease');
  },

  async 'a spring comes out as a linear() CSS takes'({ open, choose, page, assert, shot }) {
    await open('/easing-curves');
    await choose('Kind', 'Spring');
    const fn = await out(page, 'Timing function');
    assert.match(fn, /^linear\(0, [\d.]+ [\d.]+%, .*, 1\)$/);
    assert.ok(await supports(page, fn), fn);
    assert.ok(await page.evaluate((v) => CSS.supports('transition', v.replace(/^transition: |;$/g, '')), await out(page, 'Transition')));
    // More bounce: more points, and still valid.
    await page.locator('#easing-bounce').evaluate((el) => {
      el.value = '0.8';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const bouncy = await out(page, 'Timing function');
    assert.notEqual(bouncy, fn);
    assert.ok(bouncy.split(',').length > fn.split(',').length);
    assert.ok(await supports(page, bouncy));
    await page.getByText(/\d+ points, each within 0\.002 of the spring/).waitFor();
    // The preview runs it.
    await page.waitForFunction(() => document.querySelector('.track .block')?.getAnimations().length > 0);
    await shot('spring', 1280);
    await shot('spring-390', 390);
  },

  async 'a typed linear() opens as itself'({ open, fill, page, assert }) {
    await open('/easing-curves');
    await fill('Function', 'linear(0, 0.8 30%, 1)');
    assert.equal(await page.getByRole('radio', { name: 'linear()' }).getAttribute('aria-checked'), 'true');
    assert.equal(await out(page, 'Timing function'), 'linear(0, 0.8 30%, 1)');
    await page.getByText('3 points').first().waitFor();
    // Back to Bézier: the curve it had.
    await page.getByRole('radio', { name: 'Bézier' }).click();
    assert.match(await out(page, 'Timing function'), /^cubic-bezier|^ease/);
  },

  async 'the preview runs with the curve; with reduced motion only on Replay'({ open, page, assert }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('in-out-expo');
    await page.waitForFunction(() => document.querySelector('.track .block')?.getAnimations().length > 0);
    const timing = await page.locator('.track .block').evaluate((el) => el.getAnimations()[0].effect.getTiming());
    assert.equal(timing.duration, 600);
    assert.match(timing.easing, /cubic-bezier\(0\.87, 0, 0\.13, 1\)/);
    assert.equal(await page.locator('.track .ghost').evaluate((el) => el.getAnimations()[0].effect.getTiming().easing), 'linear');
    await page.getByLabel('Duration', { exact: true }).fill('1200');
    await page.waitForFunction(() => document.querySelector('.track .block')?.getAnimations()[0]?.effect.getTiming().duration === 1200);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByText('Reduced motion is on').waitFor();
    await page.locator('#easing-preset').selectOption('out-quad');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.track .block').evaluate((el) => el.getAnimations().length), 0);
    await page.getByRole('button', { name: 'Replay' }).click();
    assert.equal(await page.locator('.track .block').evaluate((el) => el.getAnimations().length), 1);
  },

  async 'Copy puts the line on the clipboard'({ open, page, assert, clipboard, engine }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('out-back');
    const row = page.getByRole('region', { name: 'CSS', exact: true }).locator('.out-row').filter({ hasText: 'Transition' });
    await row.getByRole('button', { name: 'Copy' }).click();
    await row.getByRole('button', { name: 'Copied' }).waitFor();
    if (engine === 'chromium') assert.equal(await clipboard(), 'transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);');
  },

  async 'mistakes are named, and the curve stays'({ open, fill, page, assert, sees }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('ease-out');
    await fill('Function', 'cubic-bezier(1.4, 0, 0.5, 1)');
    await sees('The two x values have to be between 0 and 1');
    assert.equal(await out(page, 'Timing function'), 'ease-out');
    await fill('Function', 'steps(4, end)');
    await sees('steps() jumps instead of easing');
    await fill('Function', 'wobbly');
    await sees('That isn’t a timing function this tool can read');
    await fill('Function', '.2, 0, 0, 1');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.2, 0, 0, 1)');
    await page.getByLabel('Duration', { exact: true }).fill('0');
    await sees('A duration from 1 to 60,000 ms.');
  },

  async 'keeps the options, never a typed curve'({ open, fill, choose, page, assert }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('in-out-sine');
    await page.getByLabel('Duration', { exact: true }).fill('900');
    await fill('Function', 'cubic-bezier(0.123, 0.456, 0.789, 0.987)');
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await out(page, 'Timing function'), 'cubic-bezier(0.37, 0, 0.63, 1)');
    assert.equal(await page.getByLabel('Duration', { exact: true }).inputValue(), '900');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('0.456'));
    await choose('Kind', 'Spring');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Spring' }).getAttribute('aria-checked'), 'true');
  },

  async 'in German'({ open, page, sees }) {
    await open('/easing-curves');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await sees('Vorschau');
    await page.getByRole('radio', { name: 'Feder' }).click();
    await sees('Nachfedern');
    await sees('Punkte, jeder höchstens 0,002 neben der Feder');
  },

  async 'looks'({ open, page, shot }) {
    await open('/easing-curves');
    await page.locator('#easing-preset').selectOption('in-out-back');
    await page.waitForTimeout(1000);
    await shot('bezier', 1280);
    await shot('bezier-390', 390);
  },

  async 'fits a phone'({ open, choose, page, fitsPhone }) {
    await open('/easing-curves');
    await fitsPhone();
    await choose('Kind', 'Spring');
    await page.locator('#easing-bounce').evaluate((el) => {
      el.value = '0.9';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await fitsPhone();
  },
};
