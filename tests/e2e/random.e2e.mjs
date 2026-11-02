// F-404 Coin, dice, pick one: with reduced motion (results at once) the coin and its tally, dice
// adding up, a pick, teams, the last draws; with motion the flip and the tumble still land on the
// result; a list from the home; the options kept, the list not; German; a phone.

const NAMES = ['Anna', 'Ben', 'Carla', 'Deniz', 'Emil'];
const still = (page) => page.emulateMedia({ reducedMotion: 'reduce' });
const tally = async (page) => ({
  heads: Number(await page.locator('[data-heads]').innerText()),
  tails: Number(await page.locator('[data-tails]').innerText()),
});
/** Which face the coin really shows, from its pixels: the head's silhouette covers a point left of
 *  the middle that the "1" on tails leaves blank (upright or upside down). */
async function shownFace(page) {
  const png = await page.locator('.toss').screenshot();
  const [mark, field] = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const mean = (x, y) => {
      const d = ctx.getImageData(Math.round(bitmap.width * x) - 2, Math.round(bitmap.height * y) - 2, 5, 5).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4) / 3;
    };
    // Inside the head's profile, and a spot on the field that neither face marks.
    return [mean(0.35, 0.5), mean(0.7, 0.7)];
  }, [...png]);
  return Math.abs(mark - field) > 60 ? 'heads' : 'tails';
}

const dice = (page) => page.locator('.die').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-value'))));

export default {
  async 'the coin: heads or tails, and the tally counts'({ page, open, choose, assert, shot }) {
    await still(page);
    await open('/coin-and-dice');
    await choose('Mode', 'Coin');
    await page.getByText('Tap the coin, or Flip.').waitFor();
    await page.getByRole('button', { name: 'Flip', exact: true }).click();
    const face = page.locator('[data-face]');
    await face.waitFor();
    assert.ok(['Heads', 'Tails'].includes((await face.innerText()).trim()));
    assert.equal(await face.getAttribute('data-face'), (await face.innerText()).trim().toLowerCase());
    let t = await tally(page);
    assert.equal(t.heads + t.tails, 1);
    assert.equal(t[await face.getAttribute('data-face')], 1, 'the face shown is the one counted');
    assert.equal(await shownFace(page), await face.getAttribute('data-face'), 'the coin shows the face drawn');
    // The coin itself flips too.
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Flip the coin' }).click();
      assert.equal(await shownFace(page), await face.getAttribute('data-face'), 'the coin shows the face drawn');
    }
    t = await tally(page);
    assert.equal(t.heads + t.tails, 6);
    const logged = await page.locator('.draws li .res').allInnerTexts();
    assert.equal(logged.filter((x) => x === 'Heads').length, t.heads, 'the last draws agree with the tally');
    assert.equal(logged.filter((x) => x === 'Tails').length, t.tails);
    await shot('coin-1280', 1280);
    await shot('coin-390', 390);
  },

  async 'three dice add up'({ page, open, choose, assert, shot }) {
    await still(page);
    await open('/coin-and-dice');
    await choose('Mode', 'Dice');
    await choose('How many', '3');
    await choose('Sides', 'd6');
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: 'Roll', exact: true }).click();
      const values = await dice(page);
      assert.equal(values.length, 3);
      for (const v of values) assert.ok(v >= 1 && v <= 6, `a d6 showed ${v}`);
      const total = Number(await page.locator('[data-total]').innerText());
      assert.equal(total, values.reduce((a, b) => a + b, 0), 'the total is the dice shown');
      assert.ok(total >= 3 && total <= 18);
      assert.equal(await page.locator('.die circle.pip').count(), values.reduce((a, b) => a + b, 0), 'a d6 shows its pips');
    }
    assert.equal((await page.locator('.draws li').first().locator('.what').innerText()).trim(), '3 × d6');
    await shot('dice-390', 390);
    await choose('How many', '1');
    await choose('Sides', 'd20');
    await page.getByRole('button', { name: 'Roll', exact: true }).click();
    const [v] = await dice(page);
    assert.ok(v >= 1 && v <= 20);
    assert.equal((await page.locator('.die text').textContent()).trim(), String(v), 'the others show the number');
    await choose('How many', '6');
    await choose('Sides', 'd12');
    await page.getByRole('button', { name: 'Roll', exact: true }).click();
    await shot('dice-d12-390', 390);
  },

  async 'a list: pick one, pick several, shuffle'({ page, open, choose, fill, assert, shot, clipboard, engine }) {
    await still(page);
    await open('/coin-and-dice');
    await choose('Mode', 'List');
    await page.getByText('Two names or more').waitFor();
    await fill('One per line', NAMES.join('\n') + '\nAnna\n');
    await page.getByText('5 names · Repeats count once: 1 left out.').waitFor();
    await choose('Draw', 'Pick one');
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Pick one', exact: true }).click();
      const name = (await page.locator('[data-pick]').innerText()).trim();
      assert.ok(NAMES.includes(name), `${name} is on the list`);
    }
    await choose('Draw', 'Pick several');
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Pick 3', exact: true }).click();
    const some = await page.locator('[data-result="some"] li').allInnerTexts();
    assert.equal(some.length, 3);
    assert.equal(new Set(some).size, 3, 'three different names');
    for (const name of some) assert.ok(NAMES.includes(name));
    await choose('Draw', 'Shuffle');
    await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
    const order = await page.locator('[data-result="shuffle"] li').allInnerTexts();
    assert.deepEqual([...order].sort(), [...NAMES].sort(), 'the whole list, once each');
    await page.getByRole('button', { name: 'Copy the list' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), order.map((x, i) => `${i + 1}. ${x}`).join('\n'));
    await shot('list-390', 390);
  },

  async 'teams of two hold every name once'({ page, open, choose, fill, assert, shot, clipboard, engine }) {
    await still(page);
    await open('/coin-and-dice');
    await choose('Mode', 'List');
    await fill('One per line', NAMES.join('\n'));
    await choose('Draw', 'Teams');
    await page.getByRole('button', { name: 'Make 2 teams' }).click();
    const one = await page.locator('[data-team="1"] li').allInnerTexts();
    const two = await page.locator('[data-team="2"] li').allInnerTexts();
    assert.equal(await page.locator('[data-team]').count(), 2);
    assert.deepEqual([...one, ...two].sort(), [...NAMES].sort(), 'everyone, once');
    assert.ok(Math.abs(one.length - two.length) <= 1, `sizes ${one.length} and ${two.length}`);
    await page.getByRole('button', { name: 'Copy the teams' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), `Team 1: ${one.join(', ')}\nTeam 2: ${two.join(', ')}`);
    // More teams than there are pairs: three of five.
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Make 3 teams' }).click();
    const sizes = await page.locator('[data-team]').evaluateAll((els) => els.map((el) => el.querySelectorAll('li').length));
    assert.deepEqual([...sizes].sort(), [1, 2, 2]);
    await shot('teams-1280', 1280);
    await shot('teams-390', 390);
  },

  async 'the last ten draws stay, newest first'({ page, open, choose, assert }) {
    await still(page);
    await open('/coin-and-dice');
    await page.getByText('Nothing drawn yet.').waitFor();
    await choose('Mode', 'Coin');
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: 'Flip', exact: true }).click();
      assert.equal(await page.locator('.draws li').count(), i, 'the list grows');
    }
    await choose('Mode', 'Dice');
    for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Roll', exact: true }).click();
    assert.equal(await page.locator('.draws li').count(), 10, 'ten at most');
    assert.equal(await page.locator('.draws li').first().getAttribute('data-draw'), '12');
    assert.equal(await page.locator('.draws li').last().getAttribute('data-draw'), '3');
    // To another tool and back: still there. A reload: gone.
    await page.locator('a.brand').click();
    await page.getByRole('link', { name: /Coin, dice, pick one/ }).first().waitFor();
    await page.goBack();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.locator('.draws li').count(), 10, 'kept while the page is open');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByText('Nothing drawn yet.').waitFor();
  },

  async 'with motion the flip and the tumble land on the result'({ page, open, choose, assert }) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open('/coin-and-dice');
    await choose('Mode', 'Coin');
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Flip', exact: true }).click();
      await page.getByText('In the air…').waitFor();
      const face = page.locator('[data-face]');
      await face.waitFor({ timeout: 5000 });
      const angle = Number(await page.locator('.coin').getAttribute('data-angle'));
      assert.equal(((angle % 360) + 360) % 360, (await face.getAttribute('data-face')) === 'heads' ? 0 : 180, 'the coin rests on the face drawn');
      assert.equal(await shownFace(page), await face.getAttribute('data-face'), 'and shows it');
      assert.ok(angle >= (i + 1) * 5 * 360, 'whole turns each flip');
      assert.equal(await page.locator('.toss').evaluate((el) => el.getAnimations({ subtree: true }).length), 0, 'and has stopped');
    }
    await choose('Mode', 'Dice');
    await choose('How many', '4');
    await page.getByRole('button', { name: 'Roll', exact: true }).click();
    await page.getByText('Rolling…').waitFor();
    const total = page.locator('[data-total]');
    await total.waitFor({ timeout: 5000 });
    const values = await dice(page);
    assert.equal(Number(await total.innerText()), values.reduce((a, b) => a + b, 0));
    assert.equal((await page.locator('.draws li .res').first().innerText()).trim(), `${values.join(' + ')} = ${values.reduce((a, b) => a + b, 0)}`);
    await choose('Mode', 'List');
    await page.getByLabel('One per line', { exact: true }).fill(NAMES.join('\n'));
    await choose('Draw', 'Pick one');
    await page.getByRole('button', { name: 'Pick one', exact: true }).click();
    await page.locator('.flicking').waitFor();
    const pick = page.locator('[data-pick]');
    await pick.waitFor({ timeout: 5000 });
    assert.equal((await page.locator('.draws li .res').first().innerText()).trim(), (await pick.innerText()).trim(), 'the flicker lands on the pick logged');
  },

  async 'a list pasted on the home opens here with it'({ page, open, assert }) {
    await open('/');
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, NAMES.join('\n'));
    await page.getByRole('link', { name: /Coin, dice, pick one/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'List' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('One per line', { exact: true }).inputValue(), NAMES.join('\n'));
  },

  async 'remembers the options, not the list'({ page, open, choose, fill, assert }) {
    await open('/coin-and-dice');
    await choose('Mode', 'Dice');
    await choose('How many', '4');
    await choose('Sides', 'd20');
    await choose('Mode', 'List');
    await choose('Draw', 'Teams');
    await fill('One per line', NAMES.join('\n'));
    await page.getByRole('button', { name: 'More' }).click();
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'List' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'Teams' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('One per line', { exact: true }).inputValue(), '', 'the list is gone');
    await choose('Mode', 'Dice');
    assert.equal(await page.getByRole('radiogroup', { name: 'How many' }).getByRole('radio', { name: '4' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'd20' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('.die').count(), 4);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:tool:random')));
    assert.equal(stored.teams, 3);
    assert.ok(!JSON.stringify(stored).includes('Anna'), 'no name is stored');
  },

  async 'German: Kopf oder Zahl'({ page, open, choose, assert, shot }) {
    await still(page);
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await open('/coin-and-dice');
    await choose('Modus', 'Münze');
    await page.getByRole('button', { name: 'Werfen', exact: true }).click();
    assert.ok(['Kopf', 'Zahl'].includes((await page.locator('[data-face]').innerText()).trim()));
    await choose('Modus', 'Würfel');
    await choose('Seiten', 'W20');
    await page.getByRole('button', { name: 'Würfeln', exact: true }).click();
    assert.equal((await page.locator('.draws li').first().locator('.what').innerText()).trim(), '1 × W20');
    await shot('dice-de-390', 390);
  },

  async 'fits a phone'({ page, open, choose, fill, fitsPhone }) {
    await still(page);
    await open('/coin-and-dice');
    await choose('Mode', 'List');
    await fill('One per line', [...NAMES, 'Maximiliane-Theresa von Hohenzollern-Sigmaringen', 'Ö'].join('\n'));
    await choose('Draw', 'Teams');
    await page.getByRole('button', { name: 'Make 2 teams' }).click();
    await fitsPhone();
    await choose('Mode', 'Dice');
    await choose('How many', '6');
    await page.getByRole('button', { name: 'Roll', exact: true }).click();
    await fitsPhone();
    await choose('Mode', 'Coin');
    await fitsPhone();
  },
};
