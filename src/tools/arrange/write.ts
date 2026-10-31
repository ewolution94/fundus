// Writes a board out with pdf-lib: each page copied as it is (its text, vectors and pictures, never
// redrawn), in the board's order, turned by the board on top of its own turn. No DOM: tested in node.

import type { PDFDocument as Doc, PDFPage } from 'pdf-lib';
import { composeRotation, type PageRef } from './arrange.ts';

/** One PDF of `pages`, from the files they came from (`sources[page.src]`, loaded with pdf-lib). */
export async function writePages(sources: Doc[], pages: PageRef[]): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const out = await PDFDocument.create();
  // One copy call per file: the pages share their fonts and pictures inside the new file.
  const wanted = new Map<number, number[]>();
  for (const p of pages) wanted.set(p.src, [...(wanted.get(p.src) ?? []), p.index]);
  const copies = new Map<number, PDFPage[]>();
  for (const [src, indices] of wanted) copies.set(src, await out.copyPages(sources[src], indices));
  for (const p of pages) {
    const page = copies.get(p.src)!.shift()!;
    page.setRotation(degrees(composeRotation(page.getRotation().angle, p.turn)));
    out.addPage(page);
  }
  return out.save();
}
