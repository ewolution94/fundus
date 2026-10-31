// F-905 UUIDs: v4 and v7 made in the page (version, variant, v7 in order and at the right time),
// how many, case, hyphens and braces over the same UUIDs, Copy per row and all, a pasted UUID
// checked (RFC 9562's examples, the time inside, what's wrong where), kept choices, German.

const SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const list = (page) => page.locator('ol.ids code').allInnerTexts();
const val = (page, label) =>
  page
    .getByRole('region', { name: /UUID/ })
    .locator('.row')
    .filter({ has: page.locator('.lab', { hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`) }) })
    .locator('.val')
    .innerText();

export default {
  async 'v4: five by default, random, version 4'({ open, assert, page }) {
    await open('/uuids');
    const ids = await list(page);
    assert.equal(ids.length, 5);
    for (const id of ids) {
      assert.match(id, SHAPE);
      assert.equal(id[14], '4');
      assert.match(id[19], /[89ab]/);
    }
    assert.equal(new Set(ids).size, 5);
    // New ones are new.
    await page.getByRole('button', { name: 'New ones' }).click();
    const again = await list(page);
    assert.equal(again.length, 5);
    assert.ok(again.every((id) => !ids.includes(id)));
  },

  async 'v7: a hundred, in order, made just now'({ open, choose, fill, assert, page }) {
    await open('/uuids');
    const before = Date.now();
    await choose('Version', 'v7, by time');
    await fill('How many', '100');
    const ids = await list(page);
    const after = Date.now();
    assert.equal(ids.length, 100);
    assert.deepEqual([...ids].sort(), ids, 'sorted as made');
    assert.equal(new Set(ids).size, 100);
    for (const id of ids) {
      assert.match(id, SHAPE);
      assert.equal(id[14], '7');
      assert.match(id[19], /[89ab]/);
      const ms = parseInt(id.replaceAll('-', '').slice(0, 12), 16);
      assert.ok(ms >= before - 5 && ms <= after + 5, `${id}: ${ms} not in ${before}…${after}`);
    }
    // More than 100 is 100, and says so.
    await fill('How many', '250');
    await page.getByText('From 1 to 100: making 100.').waitFor();
    assert.equal((await list(page)).length, 100);
    await fill('How many', '3');
    assert.deepEqual(await list(page), ids.slice(0, 3), 'fewer keeps the first');
  },

  async 'case, hyphens and braces restyle the same UUIDs'({ open, choose, check, assert, page }) {
    await open('/uuids');
    const ids = await list(page);
    await choose('Case', 'UPPER');
    assert.deepEqual(await list(page), ids.map((s) => s.toUpperCase()));
    await check('Hyphens', false);
    await check('Braces', true);
    assert.deepEqual(await list(page), ids.map((s) => `{${s.toUpperCase().replaceAll('-', '')}}`));
    await choose('Case', 'lower');
    await check('Hyphens', true);
    assert.deepEqual(await list(page), ids.map((s) => `{${s}}`));
  },

  async 'Copy per row and Copy all'({ open, assert, page, clipboard, engine }) {
    await open('/uuids');
    const ids = await list(page);
    await page.locator('ol.ids li').nth(2).getByRole('button', { name: 'Copy' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), ids[2]);
    await page.getByRole('button', { name: 'Copy all' }).click();
    if (engine === 'chromium') assert.equal(await clipboard(), ids.join('\n'));
  },

  async 'checks a v7 and a v1 from RFC 9562: version, variant, the time inside'({ open, fill, assert, page, sees }) {
    await open('/uuids');
    await sees('Paste one to see whether it’s valid');
    await fill('A UUID to check', '{017F22E2-79B0-7CC3-98C4-DC0C0C07398F}');
    assert.equal(await val(page, 'Canonical'), '017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
    assert.equal(await val(page, 'Version'), '7, Unix time, sortable');
    assert.equal(await val(page, 'Variant'), 'RFC 9562, the usual one');
    assert.equal(await val(page, 'Time (UTC)'), '2022-02-22T19:22:22.000Z');
    // The browser runs in Berlin, the home zone by default.
    assert.match(await val(page, 'At home'), /^Tuesday, February 22, 2022 at 8:22:22\sPM GMT\+1$/);
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Time (UTC)');
    await fill('A UUID to check', 'urn:uuid:c232ab00-9414-11ec-b3c8-9f6bdeced846');
    assert.equal(await val(page, 'Version'), '1, time and MAC address');
    assert.equal(await val(page, 'Time (UTC)'), '2022-02-22T19:22:22.0000000Z');
    assert.equal(await val(page, 'Clock sequence'), String(0x33c8));
    assert.equal(await val(page, 'Node'), '9f:6b:de:ce:d8:46, random (not a network card)');
    await fill('A UUID to check', '919108f7-52d1-4320-9bac-f847db4148a8');
    assert.equal(await val(page, 'Version'), '4, random');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Version');
    assert.equal(await page.getByText('Time (UTC)').count(), 0);
    await fill('A UUID to check', '00000000-0000-0000-0000-000000000000');
    await sees('The nil UUID: all zeros, no version.');
  },

  async 'a made v7 checks out as made now'({ open, choose, fill, assert, page }) {
    await open('/uuids');
    await choose('Version', 'v7, by time');
    const [first] = await list(page);
    await fill('A UUID to check', first);
    const at = Date.parse(await val(page, 'Time (UTC)'));
    assert.ok(Math.abs(at - Date.now()) < 10_000);
  },

  async 'what isn’t a UUID says what and where'({ open, fill, sees }) {
    await open('/uuids');
    await fill('A UUID to check', '017f22e2-79b0-7cc3-98c4-dc0c0c07398g');
    await sees('“g” at position 36 isn’t a hex digit.');
    await fill('A UUID to check', '017f22e2-79b0-7cc3-98c4');
    await sees('20 hex digits: a UUID has 32.');
    await fill('A UUID to check', '017f22e279b0-7cc3-98c4-dc0c0c07398f');
    await sees('The hyphens go after 8, 12, 16 and 20 digits');
    await fill('A UUID to check', '{017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
    await sees('A brace is missing');
    await fill('A UUID to check', '017f22e2-79b0-7cc3-c8c4-dc0c0c07398f');
    await sees('not the usual variant');
  },

  async 'remembers the choices, never the UUIDs'({ open, choose, check, fill, assert, page }) {
    await open('/uuids');
    await choose('Version', 'v7, by time');
    await fill('How many', '12');
    await choose('Case', 'UPPER');
    await check('Braces', true);
    await fill('A UUID to check', '919108f7-52d1-4320-9bac-f847db4148a8');
    const ids = await list(page);
    await page.waitForTimeout(50);
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: 'v7, by time' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('How many', { exact: true }).inputValue(), '12');
    const now = await list(page);
    assert.equal(now.length, 12);
    assert.ok(now.every((id) => /^\{[0-9A-F-]{36}\}$/.test(id)));
    assert.ok(now.every((id) => !ids.includes(id)), 'new ones after a reload');
    assert.equal(await page.getByLabel('A UUID to check', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!ids.some((id) => stored.includes(id.slice(1, 9))) && !stored.includes('919108f7'));
  },

  async 'in German'({ open, assert, page, fill }) {
    await open('/uuids');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await page.getByRole('radio', { name: 'v7, nach Zeit' }).click();
    await fill('Eine UUID zum Prüfen', '017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
    assert.equal(await val(page, 'Version'), '7, Unix-Zeit, sortierbar');
    assert.match(await val(page, 'Zu Hause'), /^Dienstag, 22\. Februar 2022 um 20:22:22 MEZ$/);
    assert.equal(await page.getByRole('button', { name: 'Alle kopieren' }).count(), 1);
  },

  async 'looks'({ open, choose, fill, check, shot }) {
    await open('/uuids');
    await choose('Version', 'v7, by time');
    await fill('How many', '12');
    await fill('A UUID to check', 'C232AB00-9414-11EC-B3C8-9F6BDECED846');
    await shot('v7-390', 390);
    await shot('v7-1280', 1280);
    await choose('Case', 'UPPER');
    await check('Braces', true);
    await fill('A UUID to check', '017f22e2-79b0-7cc3-98c4-dc0c0c07398');
    await shot('braces-390', 390);
    await shot('braces-1280', 1280);
  },

  async 'fits a phone'({ open, choose, check, fill, fitsPhone }) {
    await open('/uuids');
    await choose('Case', 'UPPER');
    await check('Braces', true);
    await fill('How many', '100');
    await fill('A UUID to check', 'urn:uuid:c232ab00-9414-11ec-b3c8-9f6bdeced846');
    await fitsPhone();
    await fill('A UUID to check', `x${'0'.repeat(300)}`);
    await fitsPhone();
  },
};
