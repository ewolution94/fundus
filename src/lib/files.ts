// What a file is, from its first bytes, and the names and sizes we show for it. Plain TypeScript with
// erasable types, so the tests run it as it is.

import type { DecimalMark } from './numbers.ts';
import { formatNumber } from './numbers.ts';

export type Kind = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'gif' | 'pdf' | 'other';

/** The file's kind from its magic bytes (a name or MIME type can lie, and iOS often sends none). */
export function sniff(head: Uint8Array): Kind {
  const b = head;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(0, 4) === '%PDF' || ascii(0, 1024).includes('%PDF-')) return 'pdf';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (ascii(4, 8) === 'ftyp') {
    const brands = ascii(8, 12) + ascii(16, Math.min(b.length, 48));
    if (/avif|avis/.test(brands)) return 'avif';
    if (/heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(brands)) return 'heic';
  }
  return 'other';
}

/** The kind of a File, reading only its first bytes. */
export async function kindOf(file: Blob): Promise<Kind> {
  return sniff(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
}

export const MIME: Record<Exclude<Kind, 'other'>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  avif: 'image/avif',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

export const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'image/svg+xml': 'svg',
  'text/plain': 'txt',
  'application/json': 'json',
};

/** Width and height from a JPEG's, PNG's or WebP's header, without decoding it; null otherwise. */
export function dimensions(b: Uint8Array): { width: number; height: number } | null {
  const kind = sniff(b);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (kind === 'png' && b.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (kind === 'jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      const length = view.getUint16(i + 2);
      // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      }
      i += 2 + length;
    }
    return null;
  }
  if (kind === 'webp' && b.length >= 30) {
    const chunk = String.fromCharCode(...b.subarray(12, 16));
    if (chunk === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/** "3.8 MB", "412 KB", "18 bytes", with the setting's decimal mark. Decimal units, like the
 *  Finder and the upload forms people compare against. */
export function formatBytes(n: number, mark: DecimalMark): string {
  if (n < 1000) return `${n} ${n === 1 ? 'byte' : 'bytes'}`;
  if (n < 1e6) return `${formatNumber(Math.round(n / 1000), mark)} KB`;
  if (n < 1e9) return `${formatNumber(n / 1e6, mark, { max: n < 1e7 ? 1 : 0 })} MB`;
  return `${formatNumber(n / 1e9, mark, { max: 1 })} GB`;
}

/** A file name without its extension. */
export const stem = (name: string) => name.replace(/\.[^./\\]+$/, '') || 'file';

/**
 * The name a result is saved under. With `suffix` (the File names setting's default) it says what
 * was done: IMG_4127.HEIC shrunk to a JPG is IMG_4127-small.jpg. With `same` it keeps the name and
 * only the extension changes.
 */
export function outName(original: string, suffix: string, ext: string, style: 'suffix' | 'same'): string {
  const base = stem(original.split(/[\\/]/).pop() ?? original);
  return style === 'suffix' && suffix ? `${base}-${suffix}.${ext}` : `${base}.${ext}`;
}
