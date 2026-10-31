// F-203 PDF to photos, with letter.pdf (3 pages, the last turned 90°) and PDFs made here: a 40-page
// one, one locked with a password, one locked against changes only, and a damaged one. The samples
// are written into tests/fixtures/out/pdf-*.pdf and shared with Arrange's and Sign's tests.

import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { dimensions, sniff } from '../../src/lib/files.ts';

// ── Samples ─────────────────────────────────────────────────────────────────────────────────────

/** A PDF of `n` A4 pages, each with its number big on it. */
export async function longPdf(n) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, borderColor: rgb(0, 0, 0), borderWidth: 2 });
    page.drawText(`Long ${i}`, { x: 60, y: 740, size: 48, font });
  }
  return doc.save();
}

const PAD = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');
const md5 = (...parts) => createHash('md5').update(Buffer.concat(parts)).digest();
function rc4(key, data) {
  const s = [...Array(256).keys()];
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}
const padded = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32);

/**
 * A one-page PDF with the standard security handler (RC4, 40 bits, revision 2), written by hand:
 * pdf-lib can't encrypt. With a user password nothing opens it without one; with only an owner
 * password it opens, but says it mustn't be changed.
 */
export function lockedPdf({ user = '', owner = 'owner' } = {}) {
  const id = md5(Buffer.from('fundus-locked-sample'));
  const P = -3904; // print only: no changes, no copying
  const o = rc4(md5(padded(owner || user)).subarray(0, 5), padded(user));
  const p = Buffer.alloc(4);
  p.writeInt32LE(P);
  const key = md5(padded(user), o, p, id).subarray(0, 5);
  const u = rc4(key, PAD);
  const objKey = (num) => md5(key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0])).subarray(0, 10);
  const content = rc4(objKey(4), Buffer.from('BT /F1 48 Tf 60 740 Td (Locked 1) Tj ET', 'latin1'));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream', 'latin1')]),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Filter /Standard /V 1 /R 2 /O <${o.toString('hex')}> /U <${u.toString('hex')}> /P ${P} >>`,
  ];
  const chunks = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [];
  let at = chunks[0].length;
  objects.forEach((body, i) => {
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'), Buffer.from('\nendobj\n', 'latin1')]);
    offsets.push(at);
    at += chunk.length;
    chunks.push(chunk);
  });
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ', ...offsets.map((off) => `${String(off).padStart(10, '0')} 00000 n `)].join('\n');
  chunks.push(Buffer.from(`${xref}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>] >>\nstartxref\n${at}\n%%EOF\n`, 'latin1'));
  return new Uint8Array(Buffer.concat(chunks));
}

/** Starts like a PDF, and then isn't one. */
export const brokenPdf = () => new Uint8Array(Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog /Pages 9 0 R\nthis is where the rest went missing', 'latin1'));

/** Writes the samples (once per run) into tests/fixtures/out. */
let written = null;
export function samples({ fixture }) {
  written ??= (async () => {
    await writeFile(fixture('pdf-long.pdf'), await longPdf(40));
    await writeFile(fixture('pdf-locked.pdf'), lockedPdf({ user: 'secret', owner: 'owner' }));
    await writeFile(fixture('pdf-nochanges.pdf'), lockedPdf({ user: '', owner: 'owner' }));
    await writeFile(fixture('pdf-broken.pdf'), brokenPdf());
  })();
  return written;
}

// ── The tests ───────────────────────────────────────────────────────────────────────────────────

export default {
  async 'every page of letter.pdf as a JPG at 150 dpi, the turned one sideways'({ open, drop, save, assert, page, shot }) {
    await open('/pdf-to-photos');
    await drop('letter.pdf');
    await page.getByRole('radio', { name: '150 dpi' }).waitFor();
    assert.equal(await page.getByRole('radio', { name: '150 dpi' }).getAttribute('aria-checked'), 'true', '150 dpi to start with');
    await page.getByText('1240 × 1754 px').waitFor();
    // The files come in order; the test's downloads can finish in any.
    const out = (await save({ count: 3 })).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      out.map((o) => o.name),
      ['letter-p1.jpg', 'letter-p2.jpg', 'letter-p3.jpg'],
    );
    for (const o of out) assert.equal(sniff(o.bytes), 'jpeg');
    assert.deepEqual(
      out.map((o) => dimensions(o.bytes)),
      [
        { width: 1240, height: 1754 },
        { width: 1240, height: 1754 },
        { width: 1754, height: 1240 },
      ],
    );
    await page.locator('.pages img').nth(2).waitFor();
    await shot('letter-1280', 1280);
    await shot('letter-390', 390);
  },

  async 'one page picked, PNG at 300 dpi, then on to Shrink'({ open, drop, choose, save, assert, page, shot }) {
    await open('/pdf-to-photos');
    await drop('letter.pdf');
    await choose('Format', 'PNG');
    await choose('Resolution', '300 dpi');
    await choose('Pages', 'Choose');
    await page.getByRole('button', { name: 'Page 2', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Page 2', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByLabel('Pages to save').inputValue(), '2');
    const out = await save();
    assert.equal(out.name, 'letter-p2.png');
    assert.equal(sniff(out.bytes), 'png');
    assert.deepEqual(dimensions(out.bytes), { width: 2479, height: 3508 });
    await shot('picked-1280', 1280);
    await shot('picked-390', 390);
    // The photo goes on to the photo tools.
    const next = page.getByRole('navigation', { name: 'Go on with the result' });
    await next.getByRole('link', { name: /Shrink a photo/ }).click();
    await page.waitForSelector('main[data-tool="shrink"][data-ready]');
    await page.getByText('letter-p2.png').first().waitFor();
  },

  async 'pages typed as ranges; the choice says what doesn’t exist'({ open, drop, choose, fill, save, assert, sees }) {
    await open('/pdf-to-photos');
    await drop('letter.pdf');
    await choose('Pages', 'Choose');
    await fill('Pages to save', '1, 3');
    const out = (await save({ count: 2 })).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      out.map((o) => o.name),
      ['letter-p1.jpg', 'letter-p3.jpg'],
    );
    await fill('Pages to save', '2-9');
    await sees('Only pages 1 to 3 are there.');
  },

  async '72 dpi is the page’s size in points, and the choice is kept'({ open, drop, choose, save, assert, page }) {
    await open('/pdf-to-photos');
    await choose('Resolution', '72 dpi');
    await drop('annex.pdf');
    const out = (await save({ count: 2 })).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(dimensions(out[0].bytes), { width: 595, height: 842 });
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByRole('radio', { name: '72 dpi' }).getAttribute('aria-checked'), 'true');
  },

  async 'with the ZIP from two on, one ZIP of pages'({ open, drop, save, assert, page }) {
    await open('/pdf-to-photos');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ zipFrom: 2 })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop('letter.pdf');
    const out = await save();
    assert.equal(out.name, 'letter-pages.zip');
    const files = unzipSync(out.bytes);
    assert.deepEqual(Object.keys(files).sort(), ['letter-p1.jpg', 'letter-p2.jpg', 'letter-p3.jpg']);
    assert.equal(sniff(files['letter-p3.jpg']), 'jpeg');
  },

  async 'a 40-page PDF: says how far it is, stays answerable, ends in a ZIP'(t) {
    const { open, drop, save, assert, page, engine, shot } = t;
    await samples(t);
    await open('/pdf-to-photos');
    if (engine === 'chromium') {
      await page.evaluate(() => {
        window.__longest = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__longest = Math.max(window.__longest, e.duration);
        }).observe({ type: 'longtask', buffered: false });
      });
    }
    await drop('pdf-long.pdf');
    await page.getByText(/Drawing page \d+ of 40/).waitFor();
    await shot('long-390', 390);
    const out = await save({ timeout: 90_000 });
    assert.equal(out.name, 'pdf-long-pages.zip');
    const files = unzipSync(out.bytes);
    assert.equal(Object.keys(files).length, 40);
    assert.ok(files['pdf-long-p40.jpg']);
    assert.deepEqual(dimensions(files['pdf-long-p40.jpg']), { width: 1240, height: 1754 });
    if (engine === 'chromium') {
      const longest = await page.evaluate(() => window.__longest);
      assert.ok(longest < 800, `the page froze for ${Math.round(longest)} ms`);
    }
  },

  async 'not a PDF, a locked one, a damaged one: each says so'(t) {
    const { open, drop, sees, page } = t;
    await samples(t);
    await open('/pdf-to-photos');
    await drop('notes.txt');
    await sees('notes.txt isn’t a PDF.');
    await drop('pdf-locked.pdf');
    await sees('pdf-locked.pdf is locked with a password');
    await drop('pdf-broken.pdf');
    await sees('pdf-broken.pdf is damaged');
    // A PDF locked only against changes opens: drawing it changes nothing.
    await drop('pdf-nochanges.pdf');
    await page.getByText('1 page ·').waitFor();
  },

  async 'dark, at both widths'({ open, drop, page, shot }) {
    await open('/pdf-to-photos');
    await shot('empty-390', 390);
    await drop('letter.pdf');
    await page.locator('button.save:not([disabled])').waitFor();
    await page.locator('.pages img').nth(2).waitFor();
    await shot('ready-1280', 1280);
  },

  async 'fits a phone'({ open, drop, choose, fitsPhone, page }) {
    await open('/pdf-to-photos');
    await drop('letter.pdf');
    await choose('Pages', 'Choose');
    await page.getByRole('button', { name: 'Page 3', exact: true }).click();
    await page.locator('button.save:not([disabled])').waitFor();
    await fitsPhone();
  },
};
