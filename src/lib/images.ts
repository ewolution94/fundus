/**
 * Photos in and out, on the device: decode anything the browser can (and HEIC where it can't), draw
 * it upright, encode it at a format and quality, and keep or drop its metadata as the shared
 * setting says.
 *
 * Safari (every iPhone) decodes HEIC itself. Elsewhere libheif, compiled to WebAssembly, loads the
 * first time a HEIC needs it (about 2 MB, LGPL-3.0, its own file: /licences).
 */

import { kindOf, MIME, EXT, type Kind } from './files.ts';
import { carryExif } from './exif.ts';
import type { PhotoFormat } from './settings.svelte.ts';

export interface Decoded {
  /** Upright pixels (EXIF orientation applied). */
  bitmap: ImageBitmap;
  width: number;
  height: number;
  kind: Kind;
}

const PHOTO_KINDS: Kind[] = ['jpeg', 'png', 'webp', 'heic', 'avif', 'gif'];

export async function isPhoto(file: Blob): Promise<boolean> {
  return PHOTO_KINDS.includes(await kindOf(file));
}

export class DecodeError extends Error {}

/** Pixels from a photo file, upright. */
export async function decode(file: Blob): Promise<Decoded> {
  const kind = await kindOf(file);
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height, kind };
  } catch (error) {
    if (kind !== 'heic') throw new DecodeError(String(error));
  }
  const bitmap = await decodeHeic(file);
  return { bitmap, width: bitmap.width, height: bitmap.height, kind };
}

let heif: Promise<any> | null = null;

async function decodeHeic(file: Blob): Promise<ImageBitmap> {
  heif ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then((m) => m.default());
  const libheif = await heif;
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
  if (!images?.length) throw new DecodeError('No picture in this HEIC');
  // The primary image is the first; the others are thumbnails or depth maps.
  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  const data = new ImageData(width, height);
  await new Promise<void>((resolve, reject) => image.display(data, (out: unknown) => (out ? resolve() : reject(new DecodeError('HEIC decoding failed')))));
  for (const i of images) i.free?.();
  // libheif applies the HEIC's own rotation (irot/imir), so the pixels are already upright.
  return createImageBitmap(data);
}

/** The MIME type a photo tool saves, after the Photo format setting. HEIC, AVIF and GIF become JPG
 *  when the setting says "same" (few places take them, and the browser can't write them). */
export function targetType(kind: Kind, setting: PhotoFormat): string {
  if (setting === 'jpg') return 'image/jpeg';
  if (setting === 'png') return 'image/png';
  if (setting === 'webp') return 'image/webp';
  if (kind === 'png') return 'image/png';
  if (kind === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export const extOf = (type: string) => EXT[type] ?? 'bin';

const encodable = new Map<string, Promise<boolean>>();

/** Whether this browser can write a type (Safari can't write WebP: it hands back a PNG). */
export function canEncode(type: string): Promise<boolean> {
  if (!encodable.has(type)) {
    encodable.set(
      type,
      (async () => {
        const canvas = makeCanvas(2, 2);
        // An OffscreenCanvas without a context refuses to encode at all.
        canvas.getContext('2d');
        const blob = await toBlob(canvas, type, 0.8);
        return blob.type === type;
      })(),
    );
  }
  return encodable.get(type)!;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

export function toBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality));
}

/**
 * A canvas with the picture drawn at a size (and, optionally, a crop of it). JPG has no
 * transparency, so it gets a white ground under any.
 */
export function draw(bitmap: ImageBitmap, width: number, height: number, type: string, crop?: { x: number; y: number; w: number; h: number }): AnyCanvas {
  const canvas = makeCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const c = crop ?? { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  ctx.drawImage(bitmap, c.x, c.y, c.w, c.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface Encoded {
  blob: Blob;
  /** What the browser actually wrote (it falls back to PNG for a type it can't). */
  type: string;
  width: number;
  height: number;
}

/**
 * Encodes a canvas and settles the metadata: with "Remove location when saving" on (the default)
 * the result carries nothing, as a canvas writes it. Off, a JPG gets the original's EXIF back.
 */
export async function encode(canvas: AnyCanvas, type: string, quality: number, original: Blob | null, stripLocation: boolean): Promise<Encoded> {
  let blob = await toBlob(canvas, type, quality / 100);
  if (!stripLocation && original && blob.type === 'image/jpeg') {
    const carried = carryExif(new Uint8Array(await original.arrayBuffer()), new Uint8Array(await blob.arrayBuffer()), false);
    blob = new Blob([carried as BlobPart], { type: 'image/jpeg' });
  }
  return { blob, type: blob.type || type, width: canvas.width, height: canvas.height };
}

/** Fits a size into a box, never enlarging. */
export function fit(width: number, height: number, maxW: number, maxH: number) {
  const scale = Math.min(1, maxW / width, maxH / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** An object URL for showing a blob, revoked when the component that asked goes. */
export function preview(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export { MIME };
