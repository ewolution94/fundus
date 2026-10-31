// F-503 Convert units: real conversions on the receipt, a unit typed after the number, the kitchen
// per ingredient, the Units setting from inside the tool, Copy, a number from the home.

const val = (text, label) => text(`.line:has(.lab:text-is("${label}")) .val`);
const metricFirst = (page) =>
  page.addInitScript(() => {
    if (!localStorage.getItem('fundus:shared')) localStorage.setItem('fundus:shared', JSON.stringify({ units: 'metric', decimal: 'point' }));
  });

export default {
  async 'kilometres to everything, miles marked'({ page, open, fill, assert, text, shot }) {
    await metricFirst(page);
    await open('/convert-units');
    await page.getByText('Type a value').waitFor();
    await fill('Value', '5');
    assert.equal(await val(text, 'Miles'), '3.1069 mi');
    assert.equal(await text('.line .val:not(:empty) >> nth=0'), '5,000,000 mm', 'metric first');
    assert.equal(await val(text, 'Metres'), '5,000 m');
    assert.equal(await val(text, 'Yards'), '5,468.1 yd');
    assert.equal(await val(text, 'Nautical miles'), '2.6998 nmi');
    assert.equal(await text('.line.total .lab'), 'Miles', 'the pair carries the highlighter');
    await shot('length-1280', 1280);
    await shot('length-390', 390);
  },

  async 'a unit typed after the number picks the kind'({ page, open, fill, assert, text }) {
    await metricFirst(page);
    await open('/convert-units');
    await fill('Value', '350 °F');
    assert.equal(await page.getByRole('radio', { name: 'Temperature' }).getAttribute('aria-checked'), 'true');
    assert.equal(await val(text, 'Celsius'), '176.67 °C');
    assert.equal(await val(text, 'Kelvin'), '449.82 K');
    await fill('Value', '−40 °C');
    assert.equal(await val(text, 'Fahrenheit'), '−40 °F');
    await fill('Value', '-300');
    await page.getByText('Below absolute zero').waitFor();
    await fill('Value', '6 ft');
    assert.equal(await page.getByRole('radio', { name: 'Length' }).getAttribute('aria-checked'), 'true');
    assert.equal(await val(text, 'Metres'), '1.8288 m');
    await fill('Value', '5 parsecs');
    await page.getByText('Not a value we know').waitFor();
  },

  async 'the unit list'({ page, open, fill, choose, assert, text }) {
    await metricFirst(page);
    await open('/convert-units');
    await choose('Kind', 'Weight');
    await page.getByLabel('Unit', { exact: true }).selectOption('lb');
    await fill('Value', '1');
    assert.equal(await val(text, 'Kilograms'), '0.45359 kg');
    assert.equal(await val(text, 'Grams'), '453.59 g');
    assert.equal(await val(text, 'Ounces'), '16 oz');
    await choose('Kind', 'Volume');
    await page.getByLabel('Unit', { exact: true }).selectOption('gal');
    assert.equal(await val(text, 'Litres'), '3.7854 l');
    assert.equal(await val(text, 'US cups'), '16 cups');
    assert.equal(await val(text, 'UK gallons'), '0.83267 UK gal');
  },

  async 'the kitchen: cups to grams per ingredient'({ page, open, fill, choose, assert, text, shot }) {
    await metricFirst(page);
    await open('/convert-units');
    await choose('Kind', 'Kitchen');
    await fill('Value', '1');
    assert.equal(await val(text, 'Grams'), '125 g', 'a US cup of flour');
    assert.equal(await text('.line.total .lab'), 'Grams');
    assert.equal(await val(text, 'Millilitres'), '237 ml');
    await page.getByLabel('Ingredient', { exact: true }).selectOption('sugar');
    assert.equal(await val(text, 'Grams'), '200 g');
    await fill('Value', '250 g');
    assert.equal(await val(text, 'US cups, 236.6 ml'), '1.25 US cups');
    assert.equal(await val(text, 'Metric cups, 250 ml'), '1.18 cups');
    assert.equal(await val(text, 'Tablespoons, 15 ml'), '19.7 tbsp');
    await page.getByLabel('Ingredient', { exact: true }).selectOption('butter');
    await fill('Value', '1 US cup');
    assert.equal(await val(text, 'Grams'), '227 g');
    await page.getByText('the metric cup 250 ml').waitFor();
    await shot('kitchen-390', 390);
    await shot('kitchen-1280', 1280);
  },

  async 'imperial first, from inside the tool'({ page, open, fill, choose, assert, text }) {
    await metricFirst(page);
    await open('/convert-units');
    await fill('Value', '10');
    await choose('First', 'Imperial');
    await page.getByText('Every tool now puts imperial units first').waitFor();
    assert.equal(await text('.line .lab >> nth=0'), 'Inches');
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('fundus:shared'))).units, 'imperial');
  },

  async 'Copy, with the decimal comma'({ page, open, fill, assert, clipboard, engine, text }) {
    await page.addInitScript(() => localStorage.setItem('fundus:shared', JSON.stringify({ units: 'metric', decimal: 'comma' })));
    await open('/convert-units');
    await fill('Value', '1234,5');
    assert.equal(await val(text, 'Miles'), '767,08 mi');
    assert.equal(await val(text, 'Metres'), '1.234.500 m');
    await page.locator('.line:has(.lab:text-is("Metres")) button').click();
    if (engine === 'chromium') assert.equal(await clipboard(), '1234500');
    await page.locator('.line:has(.lab:text-is("Miles")) button').click();
    if (engine === 'chromium') assert.equal(await clipboard(), '767,08');
  },

  async 'remembers the kind and the unit, not the value'({ page, open, fill, choose, assert }) {
    await metricFirst(page);
    await open('/convert-units');
    await choose('Kind', 'Weight');
    await page.getByLabel('Unit', { exact: true }).selectOption('st');
    await fill('Value', '12');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Weight' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Unit', { exact: true }).inputValue(), 'st');
    assert.equal(await page.getByLabel('Value', { exact: true }).inputValue(), '');
  },

  async 'a number pasted on the home opens here with it'({ page, open, assert, text }) {
    await metricFirst(page);
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '42');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Convert units/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Value', { exact: true }).inputValue(), '42');
    assert.equal(await val(text, 'Miles'), '26.098 mi');
  },

  async 'German'({ page, open, fill, choose, assert, text, shot }) {
    await page.addInitScript(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await open('/convert-units');
    await choose('Art', 'Küche');
    await fill('Wert', '2');
    assert.equal(await val(text, 'Gramm'), '250 g');
    await shot('kitchen-de-390', 390);
  },

  async 'fits a phone'({ page, open, fill, choose, fitsPhone }) {
    await metricFirst(page);
    await open('/convert-units');
    await choose('Kind', 'Volume');
    await fill('Value', '123456789');
    await fitsPhone();
    await choose('Kind', 'Kitchen');
    await page.getByLabel('Ingredient', { exact: true }).selectOption('powdered');
    await fitsPhone();
  },
};
