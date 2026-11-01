// Real sample files for the end-to-end tests (`npm run fixtures`; macOS only: it uses `sips`, `say`
// and `afconvert`, Homebrew's ffmpeg for the sound, and Playwright's Chromium for the WebP).
// The photo is macOS's own wallpaper, a real 4K HEIC; the JPG gets a camera, a time and a place
// written into its EXIF, so Remove location has something to find. The PDFs come from pdf-lib.
// Written to tests/fixtures/out/ (ignored by git).

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { chromium } from 'playwright';
import writeExcelFile from 'write-excel-file/node';
import { exifBlock, withExif } from './exif-block.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
const SOURCE = '/System/Library/CoreServices/DefaultDesktop.heic';

const sips = (...args) => execFileSync('sips', args, { stdio: 'pipe' });
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });

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

// Round 2. A bank's export as German Excel writes it: Windows-1252, semicolons, decimal commas, a
// postcode with a leading 0, IBANs, and a semicolon inside quotes.
const cp1252 = (text) => Buffer.from([...text].map((c) => (c === '€' ? 0x80 : c.charCodeAt(0))));
await writeFile(
  p('bank.csv'),
  cp1252(
    [
      'Buchungstag;Empfänger;Verwendungszweck;IBAN;PLZ;Betrag;Währung',
      '01.10.2026;Müller Hausverwaltung GmbH;"Miete; Oktober";DE89370400440532013000;01067;-1.234,56;EUR',
      '02.10.2026;Bäckerei Süß;Brötchen;DE02120300000000202051;80331;-4,80;EUR',
      '15.10.2026;Arbeitgeber AG;Gehalt Oktober;DE44500105175407324931;20095;3.456,78;EUR',
    ].join('\r\n') + '\r\n',
  ),
);
// A shop's export in UTF-8 with commas, a comma and a line break inside quotes.
await writeFile(p('shop.csv'), 'order,product,price,note\n1001,"Notebook, A5",4.99,"first line\nsecond line"\n1002,Pen,1.5,\n');
await writeExcelFile([
  [{ value: 'Name' }, { value: 'PLZ' }, { value: 'Betrag' }, { value: 'Datum' }],
  [{ value: 'Anna' }, { value: '01067', type: String }, { value: 12.5, type: Number }, { value: new Date(Date.UTC(2026, 9, 1)), type: Date, format: 'dd.mm.yyyy' }],
  [{ value: 'Ben' }, { value: '80331', type: String }, { value: -4.8, type: Number }, { value: new Date(Date.UTC(2026, 9, 2)), type: Date, format: 'dd.mm.yyyy' }],
]).toFile(p('sheet.xlsx'));
// Vector pictures: one with a viewBox only, one with a size, one a canvas refuses (foreignObject).
await writeFile(p('logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#ffe14a"/><path d="M16 20h32v8H16zM16 34h24v8H16z" fill="#121212"/></svg>\n');
await writeFile(p('wide.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="300" height="100" fill="#121212"/><circle cx="50" cy="50" r="30" fill="#ffe14a"/></svg>\n');
await writeFile(p('foreign.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><foreignObject width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml">Fundus</div></foreignObject></svg>\n');
// A square photo, for icons.
sips('-s', 'format', 'png', '--cropToHeightWidth', '2160', '2160', SOURCE, '--out', p('square.png'));
sips('-Z', '600', p('square.png'));
// Sound: a voice memo (mono M4A, as the iPhone records them), a stereo tone in five formats, and a
// short video with sound.
execFileSync('say', ['-o', p('voice.aiff'), 'This is a voice memo for Fundus. Eins, zwei, drei.']);
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', p('voice.aiff'), p('voice.m4a')]);
await rm(p('voice.aiff'));
ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=6', '-filter_complex', '[0][1]amerge=inputs=2', '-ar', '44100', p('tone.wav'));
ffmpeg('-i', p('tone.wav'), '-c:a', 'libmp3lame', '-b:a', '192k', p('tone.mp3'));
ffmpeg('-i', p('tone.wav'), '-c:a', 'flac', p('tone.flac'));
ffmpeg('-i', p('tone.wav'), '-c:a', 'libopus', '-b:a', '96k', p('tone.ogg'));
ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=4', '-i', p('tone.wav'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('clip.mp4'));
// YAML with two documents and a comment.
await writeFile(p('config.yaml'), '# Fundus sample\nname: fundus\nport: 4330\ntools:\n  - shrink\n  - percent\nowner:\n  name: Anna Müller\n  since: 2026-10-31\n---\nsecond: document\n');
// Umlauts broken the two usual ways: UTF-8 read as Windows-1252 (and saved again), and a Windows-1252
// file that a UTF-8 reader can't read.
const right = 'Grüße aus Köln, schöne „Anführungszeichen“ und 5 €.';
await writeFile(p('broken.txt'), new TextDecoder('windows-1252').decode(Buffer.from(right, 'utf8')) + '\n');
await writeFile(p('win1252.txt'), cp1252('Grüße aus Köln, der Preis: 12 €.\n'));

for (const name of ['photo.heic', 'small.heic', 'photo.jpg', 'mid.jpg', 'mid-gps.jpg', 'photo.png', 'photo.webp', 'letter.pdf', 'annex.pdf', 'notes.txt', 'bank.csv', 'shop.csv', 'sheet.xlsx', 'logo.svg', 'wide.svg', 'foreign.svg', 'square.png', 'voice.m4a', 'tone.wav', 'tone.mp3', 'tone.flac', 'tone.ogg', 'clip.mp4', 'config.yaml', 'broken.txt', 'win1252.txt']) {
  const size = (await readFile(p(name))).length;
  console.log(`${name.padEnd(14)} ${(size / 1e6).toFixed(2)} MB`);
}
