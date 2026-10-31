// How Convert photos decides what each photo becomes and what it's called. Plain TypeScript with
// erasable types, so the tests run it as it is.
//
// - The format is the shared Photo format setting: "same" keeps a PNG a PNG and a WebP a WebP, and
//   turns HEIC, AVIF and GIF into JPG (few places take them, and no browser writes them). A browser
//   that can't write WebP (Safari) gets JPG instead.
// - A photo that is already the target type keeps its bytes: re-encoding a JPG as a JPG only loses
//   quality. Its metadata goes if the setting says so, without touching the picture.
// - Names: the new extension already says what was done (IMG_4127.HEIC → IMG_4127.jpg); only a photo
//   that keeps its type gets the suffix, so it never takes the original's name. Two results with the
//   same name (photo.png and photo.webp, both to JPG) are numbered.

import { MIME, outName, type Kind } from '../../lib/files.ts';

export type PhotoFormat = 'same' | 'jpg' | 'png' | 'webp';

/** The MIME type a photo of `kind` is saved as. */
export function targetFor(kind: Kind, setting: PhotoFormat, webpOk: boolean): string {
  let type: string;
  if (setting === 'jpg') type = 'image/jpeg';
  else if (setting === 'png') type = 'image/png';
  else if (setting === 'webp') type = 'image/webp';
  else if (kind === 'png') type = 'image/png';
  else if (kind === 'webp') type = 'image/webp';
  else type = 'image/jpeg';
  return type === 'image/webp' && !webpOk ? 'image/jpeg' : type;
}

/** Whether a photo is already what it's to become, so its bytes can stay. */
export function keepsBytes(kind: Kind, target: string): boolean {
  return (kind === 'jpeg' || kind === 'png' || kind === 'webp') && MIME[kind] === target;
}

const norm = (ext: string) => (ext === 'jpeg' || ext === 'jpe' ? 'jpg' : ext === 'heif' ? 'heic' : ext);

/** The name a converted photo is saved under, after the File names setting. */
export function convertedName(original: string, ext: string, names: 'suffix' | 'same'): string {
  const from = norm(original.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase() ?? '');
  return outName(original, from === norm(ext) ? 'converted' : '', ext, names);
}

/** Numbers repeats (photo.jpg, photo-2.jpg), so nothing saved overwrites another result. */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let n = name;
    for (let k = 2; used.has(n.toLowerCase()); k++) n = name.replace(/(\.[^.]+)?$/, `-${k}$1`);
    used.add(n.toLowerCase());
    return n;
  });
}

/** The change in size as a signed percentage, rounded: −68 for a third of the bytes. */
export function sizeChange(before: number, after: number): number {
  if (!before) return 0;
  return Math.round((after / before - 1) * 100);
}

/** The short word for a kind, as people know it. */
export function kindLabel(kind: Kind): string {
  return kind === 'jpeg' ? 'JPG' : kind === 'webp' ? 'WebP' : kind === 'other' ? '?' : kind.toUpperCase();
}

/** Photo quality steps (the shared Photo quality setting), as Settings offers them. */
export const QUALITIES = [70, 85, 95] as const;
