// F-505 Split a bill: shares to the cent, a tip on top or in the total, rounding up, items, who
// paid what and who pays whom, the summary on the clipboard, German money, a number from the home.

const val = (text, label) => text(`.line:has(.lab:text-is("${label}")) .val`);
const point = (page) =>
  page.addInitScript(() => {
    if (!localStorage.getItem('fundus:shared')) localStorage.setItem('fundus:shared', JSON.stringify({ decimal: 'point' }));
  });
const share = (page, i) => page.locator('.folk li').nth(i).locator('.owe b').innerText();

export default {
  async 'three people, a 10 % tip, shares that add up'({ page, open, fill, assert, text, sees, shot }) {
    await point(page);
    await open('/split-a-bill');
    await sees('Type the total');
    await fill('Total', '100');
    await page.getByRole('button', { name: 'One more' }).click();
    assert.equal(await val(text, 'Bill'), '€100.00');
    assert.equal(await val(text, 'Tip 10 %'), '€10.00');
    assert.equal(await val(text, 'Total'), '€110.00');
    assert.equal(await val(text, 'Each pays'), '€36.66–€36.67');
    assert.deepEqual([await share(page, 0), await share(page, 1), await share(page, 2)], ['€36.67', '€36.67', '€36.66']);
    await sees('add up to the total exactly');
    await shot('split-1280', 1280);
    await shot('split-390', 390);
    // Round up
    await page.getByRole('switch', { name: /Round each share up/ }).click();
    assert.equal(await val(text, 'Each pays'), '€37.00');
    assert.equal(await val(text, 'Rounded up'), '+€1.00');
    assert.equal(await val(text, 'Total'), '€111.00');
    await sees('the tip is 11 %');
  },

  async 'the tip already in the total'({ page, open, fill, choose, assert, text }) {
    await point(page);
    await open('/split-a-bill');
    await fill('Total', '60');
    await choose('Tip is', 'In the total');
    assert.equal(await val(text, 'Bill before tip'), '€54.55');
    assert.equal(await val(text, 'Tip 10 %'), '€5.45');
    assert.equal(await val(text, 'Total'), '€60.00');
    assert.equal(await val(text, 'Each pays'), '€30.00');
    await choose('Tip', 'Other');
    await fill('Other tip', '12,5');
    assert.equal(await val(text, 'Bill before tip'), '€53.33');
    assert.equal(await val(text, 'Tip 12.5 %'), '€6.67');
  },

  async 'a few items'({ page, open, fill, choose, assert, text, sees }) {
    await point(page);
    await open('/split-a-bill');
    await choose('Amount', 'Items');
    await choose('Tip', '0 %');
    await fill('Item 1', '12,50');
    await fill('Item 2', '8,90');
    await page.getByRole('button', { name: 'Add an item' }).click();
    await fill('Item 3', '3.60');
    await sees('Total: €25.00');
    assert.equal(await val(text, 'Bill'), '€25.00');
    assert.equal(await val(text, 'Each pays'), '€12.50');
    await page.getByRole('button', { name: 'Remove item 3' }).click();
    assert.equal(await val(text, 'Bill'), '€21.40');
  },

  async 'who paid what, and who pays whom'({ page, open, fill, choose, check, assert, text, clipboard, engine, shot }) {
    await point(page);
    await open('/split-a-bill');
    await fill('Total', '90');
    await choose('Tip', '0 %');
    await fill('People', '3');
    await fill('Name of person 1', 'Anna');
    await fill('Name of person 2', 'Ben');
    await fill('Name of person 3', 'Cem');
    await check('Note who paid what', true);
    await fill('Paid by Anna', '60');
    await page.getByText('Paid in all: €60.00 of €90.00. €30.00 still open.').waitFor();
    await fill('Paid by Ben', '30');
    assert.equal(await val(text, 'Cem → Anna'), '€30.00');
    assert.equal(await page.locator('section[aria-label="Settle up"] .line').count(), 1, 'Ben paid his share: one payment');
    await fill('Paid by Anna', '90');
    await fill('Paid by Ben', '');
    assert.equal(await val(text, 'Ben → Anna'), '€30.00');
    assert.equal(await val(text, 'Cem → Anna'), '€30.00');
    await shot('settle-390', 390);
    await shot('settle-1280', 1280);
    await page.getByRole('button', { name: 'Copy the summary' }).click();
    if (engine === 'chromium') {
      assert.equal(await clipboard(), ['Bill: €90.00', 'Total: €90.00', '3 people, €30.00 each', 'Anna: €30.00 · Ben: €30.00 · Cem: €30.00', '', 'Settle up:', 'Ben → Anna: €30.00', 'Cem → Anna: €30.00'].join('\n'));
    }
  },

  async 'what each paid is the bill when no total is typed'({ page, open, fill, check, assert, text }) {
    await point(page);
    await open('/split-a-bill');
    await check('Note who paid what', true);
    await fill('People', '4');
    await fill('Paid by Person 1', '45,20');
    await fill('Paid by Person 2', '12,80');
    assert.equal(await val(text, 'Total'), '€58.00');
    assert.equal(await val(text, 'Each pays'), '€14.50');
    assert.equal(await val(text, 'Person 3 → Person 1'), '€14.50');
    assert.equal(await val(text, 'Person 4 → Person 1'), '€14.50');
    assert.equal(await val(text, 'Person 2 → Person 1'), '€1.70');
    await page.locator('.line:has(.lab:text-is("Person 2 → Person 1")) button').click();
  },

  async 'nonsense says so'({ page, open, fill, sees }) {
    await point(page);
    await open('/split-a-bill');
    await fill('Total', 'twelve');
    await sees('Not an amount');
    await fill('Total', '12');
    await fill('People', '0');
    await sees('a whole number from 1 to 100');
  },

  async 'remembers the tip and the switches, not the amounts'({ page, open, fill, choose, check, assert }) {
    await point(page);
    await open('/split-a-bill');
    await choose('Tip', '15 %');
    await check('Round each share up to a whole euro', true);
    await fill('Total', '42');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: '15 %' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /Round each share up/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Total', { exact: true }).inputValue(), '');
  },

  async 'German money, from a number pasted on the home'({ page, open, assert, text, shot }) {
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '1234,5');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Rechnung teilen/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Summe', { exact: true }).inputValue(), '1234,5');
    assert.equal(await val(text, 'Trinkgeld 10 %'), '123,45 €');
    assert.equal(await val(text, 'Gesamt'), '1.357,95 €');
    assert.equal(await val(text, 'Pro Person'), '678,97 €–678,98 €');
    await shot('de-390', 390);
  },

  async 'fits a phone'({ page, open, fill, check, fitsPhone }) {
    await point(page);
    await open('/split-a-bill');
    await fill('Total', '1234567,89');
    await fill('People', '8');
    await check('Note who paid what', true);
    await fill('Name of person 1', 'Maximiliane-Charlotte von Hohenzollern');
    await fill('Paid by Maximiliane-Charlotte von Hohenzollern', '1234567,89');
    await fitsPhone();
  },
};
