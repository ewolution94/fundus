// F-507 Amount in words: German and English words for amounts, the cheque form, no currency,
// negative and out of range, Copy, Roman numerals both ways, a number and a numeral from the home,
// the kept choices.

// The words as shown, without the soft hyphens that let a long German word break.
const said = (page) => ({ innerText: async () => (await page.locator('.said .answer').innerText()).replace(/\u00ad/g, '') });

export default {
  async 'an amount in German words'({ open, fill, choose, assert, page, shot }) {
    await open('/amount-in-words');
    await choose('Words in', 'Deutsch');
    await fill('Amount', '1.250,50');
    assert.equal(await said(page).innerText(), 'eintausendzweihundertfünfzig Euro und fünfzig Cent');
    await fill('Amount', '1');
    assert.equal(await said(page).innerText(), 'ein Euro');
    await fill('Amount', '2000001');
    assert.equal(await said(page).innerText(), 'zwei Millionen eins Euro');
    await fill('Amount', '1000000');
    assert.equal(await said(page).innerText(), 'eine Million Euro');
    await choose('Currency', 'Dollar');
    await fill('Amount', '21');
    assert.equal(await said(page).innerText(), 'einundzwanzig Dollar');
    await choose('Currency', 'None');
    await fill('Amount', '1');
    assert.equal(await said(page).innerText(), 'eins');
    await fill('Amount', '101');
    assert.equal(await said(page).innerText(), 'einhunderteins');
    await choose('Currency', 'Euro');
    await fill('Amount', '1.250,50');
    await shot('german', 1280);
    await shot('german-phone', 390);
  },

  async 'an amount in English words'({ open, fill, choose, assert, page }) {
    await open('/amount-in-words');
    await choose('Words in', 'English');
    await fill('Amount', '1,250.50');
    assert.equal(await said(page).innerText(), 'one thousand two hundred and fifty euros and fifty cents');
    await fill('Amount', '0,01');
    assert.equal(await said(page).innerText(), 'one cent');
    await choose('Currency', 'Dollar');
    await fill('Amount', '1001');
    assert.equal(await said(page).innerText(), 'one thousand and one dollars');
    await choose('Currency', 'None');
    await fill('Amount', '2000001');
    assert.equal(await said(page).innerText(), 'two million and one');
  },

  async 'the cheque form'({ open, fill, choose, check, assert, page }) {
    await open('/amount-in-words');
    await check('Cents as a fraction', true);
    await choose('Words in', 'English');
    await fill('Amount', '1250.5');
    assert.equal(await said(page).innerText(), 'one thousand two hundred and fifty euros and 50/100');
    await choose('Words in', 'Deutsch');
    assert.equal(await said(page).innerText(), 'eintausendzweihundertfünfzig Euro 50/100');
    await fill('Amount', '7');
    assert.equal(await said(page).innerText(), 'sieben Euro 00/100');
  },

  async 'negative, rounded and out of range'({ open, fill, choose, assert, page, sees }) {
    await open('/amount-in-words');
    await choose('Words in', 'English');
    await fill('Amount', '-12,50');
    assert.equal(await said(page).innerText(), 'minus twelve euros and fifty cents');
    await fill('Amount', '0.125');
    assert.equal(await said(page).innerText(), 'thirteen cents');
    await sees('Rounded to the cent.');
    await fill('Amount', '1000000000000');
    await sees('this one is out of range');
    await fill('Amount', 'abc');
    await sees('That isn’t a number');
  },

  async 'Copy puts the words on the clipboard'({ open, fill, choose, page, assert, clipboard, engine }) {
    await open('/amount-in-words');
    await choose('Words in', 'Deutsch');
    await fill('Amount', '21');
    await page.getByRole('button', { name: 'Copy the words' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'einundzwanzig Euro');
  },

  async 'Roman numerals both ways'({ open, fill, assert, page, sees, text }) {
    await open('/amount-in-words');
    await fill('Number to Roman', '1994');
    assert.equal(await text('.roman'), 'MCMXCIV');
    await fill('Number to Roman', '3999');
    assert.equal(await text('.roman'), 'MMMCMXCIX');
    await fill('Number to Roman', '4000');
    await sees('Roman numerals go from 1 to 3,999.');
    await fill('Roman numeral', 'mmxxvi');
    assert.equal(await page.locator('.roman').last().innerText(), '2026');
    await fill('Roman numeral', 'IIII');
    assert.equal(await page.locator('.roman').last().innerText(), '4');
    await sees('Usually written IV.');
    await fill('Roman numeral', 'MXQ');
    await sees('only I, V, X, L, C, D and M');
  },

  async 'a Roman numeral pasted on the home opens in its section'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'MCMLXXXIV');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Amount in words/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Roman numeral', { exact: true }).inputValue(), 'MCMLXXXIV');
    assert.equal(await page.locator('.roman').last().innerText(), '1984');
    assert.equal(await page.getByLabel('Amount', { exact: true }).inputValue(), '');
  },

  async 'a number pasted on the home goes into the amount'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '1.250,00 €');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Amount in words/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Amount', { exact: true }).inputValue(), '1.250,00');
    assert.equal(await said(page).innerText(), 'one thousand two hundred and fifty euros');
  },

  async 'the words follow the app’s language until one is picked, and the choices are kept'({ open, fill, choose, check, page, assert }) {
    await open('/amount-in-words');
    await fill('Amount', '3');
    assert.equal(await said(page).innerText(), 'three euros');
    await choose('Currency', 'Dollar');
    await check('Cents as a fraction', true);
    await choose('Words in', 'Deutsch');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Dollar' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'Deutsch' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: /Cents as a fraction/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Amount', { exact: true }).inputValue(), '');
  },

  async 'in German, German words by default'({ open, page, assert, sees }) {
    await open('/amount-in-words');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByLabel('Betrag', { exact: true }).fill('1250,5');
    assert.equal(await said(page).innerText(), 'eintausendzweihundertfünfzig Euro und fünfzig Cent');
    await sees('Römische Zahlen');
  },

  async 'fits a phone'({ open, fill, choose, check, fitsPhone }) {
    await open('/amount-in-words');
    await choose('Words in', 'Deutsch');
    await fill('Amount', '999.999.999.999,99');
    await fill('Number to Roman', '3888');
    await fill('Roman numeral', 'MMMDCCCLXXXVIII');
    await fitsPhone();
    await check('Cents as a fraction', true);
    await choose('Words in', 'English');
    await fitsPhone();
  },
};
