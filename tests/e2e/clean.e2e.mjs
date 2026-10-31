// F-302 Clean up text: a dropped .txt through the steps, the line saying what changed, the saved
// .txt's bytes, case, duplicates and sorting, Copy, the remembered steps.

const out = (page) => page.locator('pre.out');

export default {
  async 'the sample notes: spaces, empty lines and quotes, saved as a .txt'({ open, drop, check, save, page, assert, sees, shot }) {
    await open('/clean-up-text');
    await drop('notes.txt');
    await sees('notes.txt opened');
    // Trim lines and double spaces are on from the start.
    await sees('3 double spaces');
    await check('Remove empty lines', true);
    await check('Plain quotes and dashes', true);
    await sees('3 quotes and dashes, 3 double spaces, 2 empty lines');
    const expected = 'Fundus test notes.\nThe quick brown fox jumps over the lazy dog.\nZweite Zeile mit Umlauten: äöü ß.\n"Smart quotes" and an ellipsis...\n';
    assert.equal((await out(page).innerText()).trimEnd(), expected.trimEnd());
    const saved = await save();
    assert.equal(saved.name, 'notes-clean.txt');
    assert.equal(new TextDecoder().decode(saved.bytes), expected);
    await shot('notes', 1280);
    await shot('notes-phone', 390);
  },

  async 'case, duplicates and sorting, in their order'({ open, fill, check, choose, page, assert, sees }) {
    await open('/clean-up-text');
    await fill('Text', 'pear\nApple\nPEAR\nbanana\napple\nItem 10\nItem 2');
    await choose('Case', 'lower');
    await check('Remove duplicate lines', true);
    await choose('Sort', 'A–Z');
    assert.equal(await out(page).innerText(), 'apple\nbanana\nitem 2\nitem 10\npear');
    await sees('2 duplicate lines');
    await choose('Sort', 'Z–A');
    assert.equal(await out(page).innerText(), 'pear\nitem 10\nitem 2\nbanana\napple');
    await choose('Case', 'Title Case');
    assert.equal(await out(page).innerText(), 'Pear\nItem 10\nItem 2\nBanana\nApple');
  },

  async 'join stray line breaks: wrapped lines become paragraphs'({ open, fill, check, page, assert, sees }) {
    await open('/clean-up-text');
    await fill('Text', 'This line was\nwrapped by an\nemail program.\n\nSecond\nparagraph.');
    await check('Join stray line breaks', true);
    assert.equal(await out(page).innerText(), 'This line was wrapped by an email program.\n\nSecond paragraph.');
    await sees('3 line breaks joined');
  },

  async 'Copy, and the empty and no-step lines'({ open, fill, check, page, assert, sees, clipboard, engine }) {
    await open('/clean-up-text');
    await sees('switch on the steps it needs');
    await fill('Text', 'a  b');
    await page.getByRole('button', { name: 'Copy the text' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), 'a b');
    await check('Trim lines', false);
    await check('Collapse double spaces', false);
    await sees('Switch on a step to clean the text.');
    await check('Trim lines', true);
    await sees('Already clean for these steps: nothing changed.');
  },

  async 'remembers the steps, not the text'({ open, fill, check, page, assert }) {
    await open('/clean-up-text');
    await check('Remove empty lines', true);
    await fill('Text', 'secret');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('switch', { name: /Remove empty lines/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Text', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('secret'), 'the text is never stored');
  },

  async 'text pasted on the home opens here with it'({ open, page, assert }) {
    await open('/');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Too   many   spaces');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await page.getByRole('link', { name: /Clean up text/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.locator('pre.out').innerText(), 'Too many spaces');
  },

  async 'fits a phone'({ open, drop, check, fitsPhone }) {
    await open('/clean-up-text');
    await drop('notes.txt');
    await check('Join stray line breaks', true);
    await fitsPhone();
  },
};
