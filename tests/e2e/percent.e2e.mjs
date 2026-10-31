// F-502 Percent & VAT: typing, the receipt, Copy, the decimal mark, a number from the home.

export default {
  async 'VAT from a gross amount, typed the German way'({ open, fill, assert, page, text }) {
    await open('/percent-and-vat');
    await fill('Amount', '249,90');
    assert.equal(await text('.line:has-text("Net") .val'), '€210.00');
    assert.equal(await text('.line:has-text("VAT 19 %") .val'), '€39.90');
    assert.equal(await text('.line.total .val'), '€249.90');
    // 7 % and net
    await page.getByRole('radio', { name: '7 %' }).click();
    await page.getByRole('radio', { name: 'Net', exact: true }).click();
    await fill('Amount', '100');
    assert.equal(await text('.line.total .val'), '€107.00');
  },

  async 'another rate'({ open, fill, choose, assert, text }) {
    await open('/percent-and-vat');
    await choose('Rate', 'Other');
    await fill('Other rate', '20');
    await fill('Amount', '120');
    assert.equal(await text('.line:has-text("Net") .val'), '€100.00');
  },

  async 'Copy puts the plain number on the clipboard'({ open, fill, assert, page, clipboard, engine }) {
    await open('/percent-and-vat');
    await fill('Amount', '1.190');
    await page.locator('.line:has-text("Net") button').click();
    if (engine === 'chromium') assert.equal(await clipboard(), '1000.00');
  },

  async 'x % of y, and change in %'({ open, fill, choose, assert, text }) {
    await open('/percent-and-vat');
    await choose('Sum', 'x % of y');
    await fill('Percent', '15');
    await fill('Of', '80');
    assert.equal(await text('.line.total .val'), '12');
    await choose('Sum', 'Change in %');
    await fill('From', '80');
    await fill('To', '92');
    assert.equal(await text('.line.total .val'), '+15 %');
  },

  async 'remembers the sum, not the numbers'({ open, fill, choose, assert, page }) {
    await open('/percent-and-vat');
    await choose('Sum', 'Change in %');
    await fill('From', '5');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Change in %' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), '');
  },

  async 'German decimal comma from Settings'({ open, fill, assert, page, text }) {
    await open('/percent-and-vat');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ decimal: 'comma' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Amount', '1190');
    assert.equal(await text('.line.total .val'), '€1.190,00');
  },

  async 'a number pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '249,90');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Percent & VAT/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Amount', { exact: true }).inputValue(), '249,90');
  },

  async 'fits a phone'({ open, fill, fitsPhone }) {
    await open('/percent-and-vat');
    await fill('Amount', '1234567,89');
    await fitsPhone();
  },
};
