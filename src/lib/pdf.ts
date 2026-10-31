/**
 * pdf.js, set up once for every PDF tool: its worker, and its fonts, character maps, colour profiles
 * and image decoders from our own origin (/pdfjs/, vite.config.ts), since the CSP allows nothing
 * else. Loaded only when a tool that reads PDFs opens.
 *
 * pdf-lib (writing PDFs) needs no setup; tools import it themselves.
 */

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

let lib: Promise<typeof import('pdfjs-dist')> | null = null;

export function pdfjs() {
  lib ??= (async () => {
    const [mod, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    return mod;
  })();
  return lib;
}

/** Opens a PDF for reading and drawing. A password-protected one throws (pdf.js's PasswordException). */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const mod = await pdfjs();
  return mod.getDocument({
    // pdf.js takes ownership of the buffer it's given; a copy keeps the caller's bytes usable.
    data: bytes.slice(),
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    iccUrl: '/pdfjs/iccs/',
    wasmUrl: '/pdfjs/wasm/',
    enableXfa: false,
  }).promise;
}

/**
 * Draws a page into a canvas at a scale (1 = 72 dpi), turned by `rotation` degrees on top of the
 * page's own. White under it, since PDF pages are paper.
 */
export async function renderPage(page: PDFPageProxy, scale: number, rotation = 0): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Asks the service worker to keep pdf.js's fonts and decoders (for "Everything offline"). The
 *  worker fetches them from our origin; the page itself never fetches anything. */
export async function preloadPdfAssets(): Promise<void> {
  const reg = await navigator.serviceWorker?.ready;
  reg?.active?.postMessage({ type: 'keep-pdfjs' });
}
