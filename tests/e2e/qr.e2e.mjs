// F-401 Make a QR code: Make → save the PNG → Scan that very file, for a link, guest Wi-Fi and a
// contact; the SVG saved and copied; bad input; the camera button (a camera can't run headless).

import { writeFile } from 'node:fs/promises';
import { dimensions, sniff } from '../../src/lib/files.ts';

/** The saved PNG goes to the samples, then into the Scan side's picker. */
async function scanBack(t, png, name) {
  await writeFile(t.fixture(name), png.bytes);
  await t.choose('Mode', 'Scan');
  await t.drop(name);
  await t.sees(`Read from ${name}`);
}

const read = (page, label) => page.locator('dl.read > div', { has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('.val');

export default {
  async 'a link: made, saved as a crisp PNG, scanned back from that file'(t) {
    const { open, fill, save, assert, page, shot } = t;
    await open('/qr-code');
    await fill('Link', 'ewolution.cloud/fundus?x=1');
    await page.locator('.code svg').waitFor();
    const png = await save();
    assert.equal(png.name, 'qr-ewolution-cloud.png');
    assert.equal(sniff(png.bytes), 'png');
    const size = dimensions(png.bytes);
    assert.equal(size.width, size.height);
    assert.ok(size.width >= 1000 && size.width < 1200, JSON.stringify(size));
    await shot('link', 1280);
    await shot('link-phone', 390);
    await scanBack(t, png, 'qr-out-link.png');
    assert.equal(await read(page, 'Link').innerText(), 'https://ewolution.cloud/fundus?x=1');
    await t.sees('Not opened');
    assert.equal(await page.locator('dl.read a').count(), 0, 'a scanned link is never a link to follow');
    await shot('scanned-link', 1280);
  },

  async 'guest Wi-Fi with the awkward characters: made and read back'(t) {
    const { open, fill, choose, check, save, assert, page } = t;
    await open('/qr-code');
    await choose('Holds', 'Wi-Fi');
    await t.sees('guests point their camera');
    await fill('Network', 'Café;Gäste');
    await fill('Password', 'pa:ss,w"rd\\1');
    await check('Hidden network', true);
    await choose('Error correction', 'H 30 %');
    const png = await save();
    assert.equal(png.name, 'qr-wifi-cafe-gaste.png');
    await scanBack(t, png, 'qr-out-wifi.png');
    assert.equal(await read(page, 'Network').innerText(), 'Café;Gäste');
    assert.equal(await read(page, 'Password').innerText(), 'pa:ss,w"rd\\1');
    assert.equal(await read(page, 'Security').innerText(), 'WPA');
    assert.equal(await read(page, 'Hidden network').innerText(), 'Yes');
  },

  async 'a contact card: made and read back as its fields'(t) {
    const { open, fill, choose, save, assert, page } = t;
    await open('/qr-code');
    await choose('Holds', 'Contact');
    await fill('First name', 'Erika');
    await fill('Last name', 'Mustermann');
    await fill('Phone', '+49 30 1234567');
    await fill('Email', 'erika@example.com');
    await fill('Organisation', 'Fundus; Werkstatt, Berlin');
    const png = await save();
    await scanBack(t, png, 'qr-out-contact.png');
    assert.equal(await read(page, 'Name').innerText(), 'Erika Mustermann');
    assert.equal(await read(page, 'Phone').innerText(), '+49 30 1234567');
    assert.equal(await read(page, 'Email').innerText(), 'erika@example.com');
    assert.equal(await read(page, 'Organisation').innerText(), 'Fundus; Werkstatt, Berlin');
  },

  async 'the SVG: saved as a file and copied'({ open, fill, page, assert, clipboard, engine }) {
    await open('/qr-code');
    await fill('Link', 'https://example.com');
    await page.locator('.code svg').waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save SVG' }).click();
    const d = await download;
    assert.equal(d.suggestedFilename(), 'qr-example-com.svg');
    const { readFile } = await import('node:fs/promises');
    const svg = await readFile(await d.path(), 'utf8');
    assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
    assert.match(svg, /<path d="M\d+ \d+h\d+v1h-\d+z/);
    if (engine === 'chromium') {
      await page.getByRole('button', { name: 'Copy SVG' }).click();
      assert.equal(await clipboard(), svg);
    }
  },

  async 'bad input: not a link, a short WPA password, too much text'({ open, fill, choose, page, sees, assert }) {
    await open('/qr-code');
    await sees('Type a link: its code appears here.');
    await fill('Link', 'just some words');
    await sees('doesn’t look like a link');
    assert.equal(await page.locator('.code svg').count(), 0);
    await choose('Holds', 'Wi-Fi');
    await fill('Network', 'Home');
    await fill('Password', 'short');
    await sees('A WPA password has 8 to 63 characters');
    await choose('Holds', 'Text');
    await choose('Error correction', 'H 30 %');
    await fill('Text', 'x'.repeat(2000));
    await sees('Too much for one QR code');
    await page.locator('button.save').waitFor({ state: 'detached' });
  },

  async 'scanning a photo without a code, and a file that isn’t a picture'({ open, choose, drop, sees }) {
    await open('/qr-code');
    await choose('Mode', 'Scan');
    await drop('mid.jpg');
    await sees('No QR code found in mid.jpg');
    await drop('notes.txt');
    await sees('notes.txt isn’t a picture this browser can open.');
  },

  async 'the camera button is there; remembers the mode, not what was typed'({ open, choose, fill, page, assert, shot }) {
    await open('/qr-code');
    await fill('Link', 'secret.example');
    await choose('Mode', 'Scan');
    await page.getByRole('button', { name: 'Use the camera' }).waitFor();
    await shot('scan', 1280);
    await shot('scan-phone', 390);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'Scan' }).getAttribute('aria-checked'), 'true');
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('secret'));
  },

  async 'a link pasted on the home opens here, ready'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'https://ewolution.cloud');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Make a QR code/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Link', { exact: true }).inputValue(), 'https://ewolution.cloud');
    await page.locator('.code svg').waitFor();
  },

  async 'fits a phone'({ open, choose, fill, fitsPhone }) {
    await open('/qr-code');
    await choose('Holds', 'Contact');
    await fill('First name', 'Erika');
    await fill('Email', 'erika.mustermann.with.a.long.address@example-company.com');
    await fitsPhone();
  },
};
