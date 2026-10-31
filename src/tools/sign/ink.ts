// The signature as pictures: drawn strokes painted onto a canvas, a typed name set in a handwriting
// font, any of them tinted in the chosen ink, and each one trimmed to its ink and written as a PNG
// with a clear ground, ready to go onto a page.

import { pieces, inkBounds, type Stroke } from './sign.ts';

export const INKS = {
  black: { css: '#141414', r: 0.08, g: 0.08, b: 0.08 },
  blue: { css: '#1c3a8c', r: 0.11, g: 0.23, b: 0.55 },
} as const;
export type Ink = keyof typeof INKS;

/** Handwriting faces every system has one of: macOS, Windows, then the browser's own. */
export const HAND = '"Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", "URW Chancery L", cursive';

/** Paints strokes (in pad widths) at `scale` pixels per pad width, offset by `dx`, `dy` pixels. */
export function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number, color: string, dx = 0, dy = 0) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    for (const p of pieces(stroke)) {
      if (p.from === p.to) {
        ctx.beginPath();
        ctx.arc(p.from.x * scale + dx, p.from.y * scale + dy, (p.w * scale) / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.lineWidth = p.w * scale;
      ctx.moveTo(p.from.x * scale + dx, p.from.y * scale + dy);
      ctx.quadraticCurveTo(p.ctrl.x * scale + dx, p.ctrl.y * scale + dy, p.to.x * scale + dx, p.to.y * scale + dy);
      ctx.stroke();
    }
  }
}

export interface Picture {
  png: Uint8Array;
  url: string;
  /** Width over height. */
  aspect: number;
}

async function pictureOf(canvas: HTMLCanvasElement): Promise<Picture> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), 'image/png'));
  const png = new Uint8Array(await blob.arrayBuffer());
  const aspect = canvas.width / canvas.height;
  canvas.width = 0;
  canvas.height = 0;
  return { png, url: URL.createObjectURL(blob), aspect };
}

/** Drawn strokes as a picture: 1600 pixels to the pad's width, trimmed to the ink. */
export async function strokesPicture(strokes: Stroke[], color: string): Promise<Picture | null> {
  const b = inkBounds(strokes);
  if (!b) return null;
  const scale = 1600;
  const pad = 8;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((b.right - b.left) * scale) + pad * 2;
  canvas.height = Math.ceil((b.bottom - b.top) * scale) + pad * 2;
  const ctx = canvas.getContext('2d')!;
  paint(ctx, strokes, scale, color, pad - b.left * scale, pad - b.top * scale);
  return pictureOf(canvas);
}

/** Text set on a canvas, trimmed to where its letters reach (a handwriting face's swashes too). */
export async function textPicture(text: string, font: string, color: string, size = 140): Promise<Picture | null> {
  if (!text.trim()) return null;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `${size}px ${font}`;
  const m = probe.measureText(text);
  const left = Math.ceil(m.actualBoundingBoxLeft);
  const right = Math.ceil(m.actualBoundingBoxRight);
  const ascent = Math.ceil(m.actualBoundingBoxAscent);
  const descent = Math.ceil(m.actualBoundingBoxDescent);
  const pad = Math.round(size * 0.08);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, left + right + pad * 2);
  canvas.height = Math.max(1, ascent + descent + pad * 2);
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(text, pad + left, pad + ascent);
  return pictureOf(canvas);
}

/** A picture's ink in another colour (a kept signature in today's ink). */
export async function tinted(png: Uint8Array, color: string): Promise<Picture> {
  const bitmap = await createImageBitmap(new Blob([png as BlobPart], { type: 'image/png' }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return pictureOf(canvas);
}

let measure: CanvasRenderingContext2D | null = null;

/** How wide a line of text is in Helvetica (Arial on screen), per point of font size. */
export function textWidthPerPt(text: string): number {
  if (!measure) {
    measure = document.createElement('canvas').getContext('2d')!;
    measure.font = '100px Helvetica, Arial, sans-serif';
  }
  return measure.measureText(text).width / 100;
}
