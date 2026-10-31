// Reading PDFs for the three PDF tools (Arrange, Sign, PDF to photos): open one and say plainly why
// not, and draw small pictures of its pages one at a time, as they come into view, so a 40-page PDF
// never holds the page up.

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { SvelteMap } from 'svelte/reactivity';
import { openPdf } from './pdf.ts';
import { sniff } from './files.ts';

/** Why a file didn't open: not a PDF at all, locked with a password, or damaged. */
export type Problem = 'notPdf' | 'locked' | 'broken';

export class PdfProblem extends Error {
  kind: Problem;
  constructor(kind: Problem) {
    super(kind);
    this.kind = kind;
  }
}

export interface Opened {
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
}

export async function readPdf(file: Blob): Promise<Opened> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniff(bytes.subarray(0, 1024)) !== 'pdf') throw new PdfProblem('notPdf');
  try {
    return { bytes, doc: await openPdf(bytes) };
  } catch (error) {
    throw new PdfProblem((error as Error)?.name === 'PasswordException' ? 'locked' : 'broken');
  }
}

export const problemOf = (error: unknown): Problem => (error instanceof PdfProblem ? error.kind : 'broken');

/** Lets pdf.js forget a document (its worker keeps a copy otherwise). */
export function closePdf(doc: PDFDocumentProxy | null | undefined) {
  void doc?.loadingTask.destroy().catch(() => undefined);
}

/** A page as pdf.js shows it: its size in points with its own turn applied, the turn, and the
 *  visible area (the crop box) in PDF coordinates. */
export interface PageInfo {
  width: number;
  height: number;
  rotation: number;
  view: [number, number, number, number];
}

export function infoOf(page: PDFPageProxy): PageInfo {
  const vp = page.getViewport({ scale: 1 });
  const [x0, y0, x1, y1] = page.view;
  return { width: vp.width, height: vp.height, rotation: page.rotate, view: [x0, y0, x1, y1] };
}

/** Every page's size and turn, asking pdf.js page by page (it's quick: no drawing). */
export async function pageInfos(doc: PDFDocumentProxy): Promise<PageInfo[]> {
  const out: PageInfo[] = [];
  for (let n = 1; n <= doc.numPages; n++) out.push(infoOf(await doc.getPage(n)));
  return out;
}

/**
 * Draws a page into a canvas of exactly `width` × `height` pixels (pdf.js's own sizes are
 * fractional): white under it, its own turn applied.
 */
export async function drawPage(page: PDFPageProxy, width: number, height: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  await page.render({ canvas, canvasContext: ctx, viewport, transform: [width / viewport.width, 0, 0, height / viewport.height, 0, 0] }).promise;
  return canvas;
}

export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality));
}

/** Lets go of a canvas's pixels now rather than when the collector comes (iOS counts them). */
export function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** A pause that lets the page paint and answer taps between two pieces of heavy work. */
export const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Small pictures of pages, drawn one at a time in the order they're asked for and kept as object
 * URLs. `url(key)` is reactive: a thumbnail shows up by itself once it's drawn.
 */
export class Thumbs {
  #urls = new SvelteMap<string, string>();
  #failed = new SvelteMap<string, true>();
  #queue: { key: string; doc: PDFDocumentProxy; index: number }[] = [];
  #queued = new Set<string>();
  #running = false;
  #gone = false;
  /** The longest side, in pixels. */
  #size: number;

  constructor(size = 280) {
    this.#size = size;
  }

  url(key: string): string | undefined {
    return this.#urls.get(key);
  }

  failed(key: string): boolean {
    return this.#failed.has(key);
  }

  /** Asks for page `index` (from 0) of `doc`, under `key`. */
  want(key: string, doc: PDFDocumentProxy, index: number) {
    if (this.#gone || this.#urls.has(key) || this.#failed.has(key) || this.#queued.has(key)) return;
    this.#queued.add(key);
    this.#queue.push({ key, doc, index });
    void this.#pump();
  }

  async #pump() {
    if (this.#running) return;
    this.#running = true;
    while (this.#queue.length && !this.#gone) {
      const job = this.#queue.shift()!;
      try {
        const page = await job.doc.getPage(job.index + 1);
        const info = infoOf(page);
        const scale = this.#size / Math.max(info.width, info.height);
        const canvas = await drawPage(page, Math.max(1, Math.round(info.width * scale)), Math.max(1, Math.round(info.height * scale)));
        const blob = await canvasBlob(canvas, 'image/jpeg', 0.82);
        release(canvas);
        page.cleanup();
        if (this.#gone || !this.#queued.has(job.key)) continue;
        this.#urls.set(job.key, URL.createObjectURL(blob));
      } catch {
        if (!this.#gone) this.#failed.set(job.key, true);
      } finally {
        this.#queued.delete(job.key);
      }
      await breathe();
    }
    this.#running = false;
  }

  /** Forgets the thumbnails whose key starts with `prefix` (a file taken off). */
  drop(prefix: string) {
    this.#queue = this.#queue.filter((j) => !j.key.startsWith(prefix));
    for (const key of [...this.#queued]) if (key.startsWith(prefix)) this.#queued.delete(key);
    for (const [key, url] of [...this.#urls]) {
      if (!key.startsWith(prefix)) continue;
      URL.revokeObjectURL(url);
      this.#urls.delete(key);
    }
    for (const key of [...this.#failed.keys()]) if (key.startsWith(prefix)) this.#failed.delete(key);
  }

  destroy() {
    this.#gone = true;
    this.#queue = [];
    for (const url of this.#urls.values()) URL.revokeObjectURL(url);
  }
}

/** A Svelte action: calls `seen` once, when the element comes within a screen of the view. */
export function nearView(node: Element, seen: () => void) {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      seen();
    },
    { rootMargin: '100% 0px' },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
