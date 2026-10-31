// Real sample files for the end-to-end tests (`npm run fixtures`; macOS only: it uses `sips`, and
// Playwright's Chromium for the WebP).
// The photo is macOS's own wallpaper, a real 4K HEIC; the JPG gets a camera, a time and a place
// written into its EXIF, so Remove location has something to find. The PDFs come from pdf-lib.
// Written to tests/fixtures/out/ (ignored by git).

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { chromium } from 'playwright';
import { exifBlock, withExif } from './exif-block.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
const SOURCE = '/System/Library/CoreServices/DefaultDesktop.heic';

const sips = (...args) => execFileSync('sips', args, { stdio: 'pipe' });

async function pdf(pages, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, borderColor: rgb(0, 0, 0), borderWidth: 2 });
    page.drawText(`${label} ${i}`, { x: 60, y: 740, size: 48, font });
    page.drawText(`page ${i} of ${pages}`, { x: 60, y: 690, size: 18, font, color: rgb(0.4, 0.4, 0.4) });
  }
  // The last page lies on its side, as scans often do.
  if (pages > 2) doc.getPage(pages - 1).setRotation(degrees(90));
  return doc.save();
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const p = (name) => path.join(out, name);

// HEIC: the wallpaper itself (3840 × 2160), and a small one for quick runs.
await copyFile(SOURCE, p('photo.heic'));
sips('-s', 'format', 'heic', '-Z', '1200', SOURCE, '--out', p('small.heic'));
// JPG at full size and high quality (several MB), then with the EXIF written in.
sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '95', SOURCE, '--out', p('plain.jpg'));
await writeFile(p('photo.jpg'), withExif(await readFile(p('plain.jpg')), exifBlock()));
await rm(p('plain.jpg'));
sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', '1600', SOURCE, '--out', p('mid.jpg'));
await writeFile(p('mid-gps.jpg'), withExif(await readFile(p('mid.jpg')), exifBlock({ model: 'Pixel 9' })));
sips('-s', 'format', 'png', '-Z', '900', SOURCE, '--out', p('photo.png'));
// sips reads WebP but can't write it: Chromium's canvas does.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = (await readFile(p('photo.png'))).toString('base64');
  const webp = await page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  }, png);
  await writeFile(p('photo.webp'), Buffer.from(webp, 'base64'));
  await browser.close();
}
await writeFile(p('letter.pdf'), await pdf(3, 'Letter'));
await writeFile(p('annex.pdf'), await pdf(2, 'Annex'));
await writeFile(
  p('notes.txt'),
  'Fundus  test notes.\n\n\nThe  quick brown fox   jumps over the lazy dog.\r\nZweite Zeile mit Umlauten: äöü ß.\n“Smart quotes” and an ellipsis…\n',
);

for (const name of ['photo.heic', 'small.heic', 'photo.jpg', 'mid.jpg', 'mid-gps.jpg', 'photo.png', 'photo.webp', 'letter.pdf', 'annex.pdf', 'notes.txt']) {
  const size = (await readFile(p(name))).length;
  console.log(`${name.padEnd(14)} ${(size / 1e6).toFixed(2)} MB`);
}
