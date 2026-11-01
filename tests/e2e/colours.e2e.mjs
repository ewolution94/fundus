// F-403 Colours: a typed colour in every code, a pick from a photo (tap and arrow keys), the
// contrast against white, black or a typed colour, a colour from the home, nothing kept.

const line = (page, label) => page.locator(`.code-row:has(.lab:text-is("${label}")) .val`);

export default {
  async 'a typed colour in every code'({ open, fill, assert, page, sees, shot }) {
    await open('/colours');
    await fill('Colour', 'oklch(0.909262 0.164713 97.6115)');
    assert.equal(await line(page, 'HEX').innerText(), '#ffe14a');
    assert.equal(await line(page, 'RGB').innerText(), 'rgb(255, 225, 74)');
    assert.equal(await line(page, 'HSL').innerText(), 'hsl(50.1, 100%, 64.5%)');
    assert.equal(await line(page, 'OKLCH').innerText(), 'oklch(90.9% 0.165 97.6)');
    await fill('Colour', 'rebeccapurple');
    assert.equal(await line(page, 'HEX').innerText(), '#663399');
    await sees('Named rebeccapurple in CSS');
    await fill('Colour', 'hsl(120deg 100% 25% / 50%)');
    assert.equal(await line(page, 'HEX').innerText(), '#00800080');
    assert.equal(await line(page, 'RGB').innerText(), 'rgba(0, 128, 0, 0.5)');
    await fill('Colour', '#F00');
    assert.equal(await line(page, 'OKLCH').innerText(), 'oklch(62.8% 0.258 29.2)');
    await shot('typed', 1280);
    await shot('typed-phone', 390);
  },

  async 'a colour outside sRGB is brought in and says so'({ open, fill, assert, page, sees }) {
    await open('/colours');
    await fill('Colour', 'oklch(0.7 0.4 150)');
    await sees('Outside what most screens show');
    assert.match(await line(page, 'HEX').innerText(), /^#[0-9a-f]{6}$/);
    assert.match(await line(page, 'OKLCH').innerText(), /^oklch\(70(\.\d)?% 0\.1\d\d 15\d(\.\d)?\)$/);
  },

  async 'what it can’t read it says, and keeps the last colour'({ open, fill, assert, page, sees }) {
    await open('/colours');
    await fill('Colour', '#123456');
    await fill('Colour', 'not a colour');
    await sees('isn’t a colour this tool can read');
    assert.equal(await line(page, 'HEX').innerText(), '#123456');
  },

  async 'Copy puts the code on the clipboard'({ open, fill, page, assert, clipboard, engine }) {
    await open('/colours');
    await fill('Colour', 'gold');
    await page.locator('.code-row:has(.lab:text-is("RGB")) button').click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'rgb(255, 215, 0)');
  },

  async 'contrast: white or black by itself, a typed one, and the levels'({ open, fill, assert, page, sees, text }) {
    await open('/colours');
    await fill('Colour', '#777');
    // #777 stands out more against black (4.69) than white (4.48): black comes first.
    await sees('Black stands out more');
    assert.equal(await text('.ratio'), '4.69:1');
    await fill('Against', 'white');
    assert.equal(await text('.ratio'), '4.48:1');
    await sees('Passes AA for large text');
    const cells = await page.locator('.grades td span').allInnerTexts();
    assert.deepEqual(cells, ['Fail', 'Pass', 'Fail', 'Fail']);
    await fill('Colour', 'black');
    assert.equal(await text('.ratio'), '21.00:1');
    assert.deepEqual(await page.locator('.grades td span').allInnerTexts(), ['Pass', 'Pass', 'Pass', 'Pass']);
    await sees('Passes AAA');
    // The sample shows one on the other, in their own colours.
    const sample = await page.locator('.sample').first().evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
    assert.deepEqual(sample, ['rgb(0, 0, 0)', 'rgb(255, 255, 255)']);
    await page.getByRole('button', { name: 'Swap' }).click();
    assert.equal(await line(page, 'HEX').innerText(), '#ffffff');
    assert.equal(await page.getByLabel('Against', { exact: true }).inputValue(), '#000000');
  },

  async 'a pick from a photo: a click, then the arrow keys'({ open, drop, assert, page, sees, shot }) {
    await open('/colours');
    await drop('photo.png');
    const canvas = page.locator('.pick canvas');
    await canvas.waitFor();
    await page.waitForFunction(() => document.querySelector('.pick canvas')?.width > 0);
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width * 0.3, y: box.height * 0.6 } });
    await page.locator('.marker').waitFor();
    const picked = await line(page, 'HEX').innerText();
    // The colour is the average of a small square under the marker: check it against the canvas.
    const expected = await page.evaluate(({ fx, fy }) => {
      const c = document.querySelector('.pick canvas');
      const x = Math.round(c.width * fx);
      const y = Math.round(c.height * fy);
      const r = Math.max(1, Math.round(Math.min(c.width, c.height) / 250));
      const d = c.getContext('2d').getImageData(x - r, y - r, 2 * r + 1, 2 * r + 1).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
      return sum.map((s) => Math.round(s / (d.length / 4)));
    }, { fx: 0.3, fy: 0.6 });
    const got = [1, 3, 5].map((i) => parseInt(picked.slice(i, i + 2), 16));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(got[k] - expected[k]) <= 3, `${picked} against rgb(${expected})`);
    assert.equal(await page.getByLabel('Colour', { exact: true }).inputValue(), picked);
    // The arrow keys move the marker (and pick again).
    const before = await page.locator('.marker').evaluate((el) => el.style.left);
    await page.locator('.pick').focus();
    await page.keyboard.press('Shift+ArrowRight');
    const after = await page.locator('.marker').evaluate((el) => el.style.left);
    assert.ok(parseFloat(after) > parseFloat(before) + 5, `${before} → ${after}`);
    await sees('900 × 506');
    await shot('photo', 1280);
    await shot('photo-phone', 390);
  },

  async 'a HEIC opens too'({ open, drop, page }) {
    await open('/colours');
    await drop('photo.heic');
    await page.waitForFunction(() => document.querySelector('.pick canvas')?.width > 0, null, { timeout: 60_000 });
  },

  async 'not a photo: says so'({ open, drop, sees }) {
    await open('/colours');
    await drop('notes.txt');
    await sees('isn’t a photo this browser can open');
  },

  async 'a colour pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'rgb(18, 52, 86)');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Colours/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await line(page, 'HEX').innerText(), '#123456');
  },

  async 'a photo dropped on the home opens here, ready to pick from'({ open, drop, page, sees }) {
    await open('/');
    await drop('photo.png');
    await page.getByRole('link', { name: /Colours/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    await page.waitForFunction(() => document.querySelector('.pick canvas')?.width > 0);
    await sees('photo.png');
  },

  async 'nothing is kept'({ open, fill, page, assert }) {
    await open('/colours');
    await fill('Colour', '#abcdef');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.notEqual(await page.getByLabel('Colour', { exact: true }).inputValue(), '#abcdef');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('abcdef'), 'the colour is never stored');
  },

  async 'in German'({ open, page, sees }) {
    await open('/colours');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await sees('Kontrast');
    await sees('Aus einem Foto');
  },

  async 'fits a phone'({ open, drop, fill, page, fitsPhone }) {
    await open('/colours');
    await fill('Colour', 'rgba(255, 225, 74, 0.333)');
    await drop('photo.jpg');
    await page.waitForFunction(() => document.querySelector('.pick canvas')?.width > 0);
    await fitsPhone();
  },
};
