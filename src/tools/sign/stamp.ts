// Writes the placed signature, date and name into the PDF with pdf-lib, at the spots chosen on the
// pages as shown. Everything else in the file stays as it was. No DOM: tested in node.

import type { RGB } from 'pdf-lib';
import { placeImage, placeText, type Box, type View } from './sign.ts';

export interface Mark {
  /** From 0. */
  page: number;
  box: Box;
  /** A picture (the signature), as PNG bytes. */
  png?: Uint8Array;
  /** Or a line of text (the date, the name), set in Helvetica. */
  text?: string;
  /** The text as a picture, for letters Helvetica hasn't got (Ł, Ğ, 王): drawn in its box instead. */
  textPng?: Uint8Array;
}

/** What the page looked like when the marks were placed: its visible area and its turn, from pdf.js. */
export interface Shown {
  view: View;
  rotation: number;
}

export async function stamp(bytes: Uint8Array, marks: Mark[], shown: Shown[], ink: { r: number; g: number; b: number }): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color: RGB = rgb(ink.r, ink.g, ink.b);
  // The same picture placed twice is in the file once.
  const images = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedPng>>>();
  const image = async (png: Uint8Array) => {
    if (!images.has(png)) images.set(png, await doc.embedPng(png));
    return images.get(png)!;
  };
  for (const mark of marks) {
    const page = doc.getPage(mark.page);
    const { view, rotation } = shown[mark.page];
    if (mark.text !== undefined) {
      const at = placeText(mark.box, view, rotation);
      try {
        page.drawText(mark.text, { x: at.x, y: at.y, size: at.size, font, color, rotate: degrees(at.rotate) });
        continue;
      } catch (error) {
        // Helvetica writes Western European letters only; others go in as a picture.
        if (!mark.textPng) throw error;
      }
    }
    const png = mark.png ?? mark.textPng;
    if (!png) continue;
    const at = placeImage(mark.box, view, rotation);
    page.drawImage(await image(png), { x: at.x, y: at.y, width: at.width, height: at.height, rotate: degrees(at.rotate) });
  }
  return doc.save();
}
