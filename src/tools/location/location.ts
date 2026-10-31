// What Remove location shows and how it names its results. Plain TypeScript with erasable types, so
// the tests run it as it is. Reading and stripping the bytes is lib/exif.ts's; this is the words.
//
// A photo's facts: the place (decimal degrees, as plain text: no map, nothing looked up), the camera
// and lens, the software that last saved it, and the time it was taken. After removing, the result is
// read back with the same reader and compared fact by fact, so "Nothing left" is what the file says,
// not what was hoped.

import type { Meta } from '../../lib/exif.ts';
import { formatNumber, type DecimalMark } from '../../lib/numbers.ts';
import { outName, type Kind } from '../../lib/files.ts';

export type FactKey = 'place' | 'camera' | 'lens' | 'software' | 'taken';
export const FACTS: FactKey[] = ['place', 'camera', 'lens', 'software', 'taken'];

export type Scope = 'location' | 'everything';

/** "53.55033° N, 9.99206° E": five decimals is about a metre. */
export function degrees(lat: number, lon: number, mark: DecimalMark): string {
  const f = (n: number) => formatNumber(Math.abs(n), mark, { min: 5, max: 5, group: false });
  return `${f(lat)}° ${lat < 0 ? 'S' : 'N'}, ${f(lon)}° ${lon < 0 ? 'W' : 'E'}`;
}

/** "Apple iPhone 15", without saying the maker twice ("Canon Canon EOS R6" → "Canon EOS R6"). */
export function camera(make?: string, model?: string): string | undefined {
  const a = make?.trim() ?? '';
  const b = model?.trim() ?? '';
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const first = a.split(/\s+/)[0].toLowerCase();
  return b.toLowerCase().startsWith(first) ? b : `${a} ${b}`;
}

/** The camera's "2026:10:31 14:05:09" as a date (UTC-based, read with timeZone UTC: it has no zone). */
export function parseTaken(s?: string): Date | null {
  const m = s?.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = m.slice(1).map((x) => Number(x ?? 0));
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, h, mi, sec || 0));
}

/** Which facts a photo's metadata holds. */
export function present(meta: Meta): FactKey[] {
  const out: FactKey[] = [];
  if (meta.gps) out.push('place');
  if (camera(meta.make, meta.model)) out.push('camera');
  if (meta.lens?.trim()) out.push('lens');
  if (meta.software?.trim()) out.push('software');
  if (meta.taken?.trim()) out.push('taken');
  return out;
}

/** What each scope means to take away; the rest is meant to stay. */
export const TAKES: Record<Scope, FactKey[]> = {
  location: ['place'],
  everything: ['place', 'camera', 'lens', 'software', 'taken'],
};

/** The formats changed in place, the picture copied bit for bit. HEIC and AVIF are drawn into a JPG. */
export const inPlace = (kind: Kind) => kind === 'jpeg' || kind === 'png' || kind === 'webp';
export const redrawn = (kind: Kind) => kind === 'heic' || kind === 'avif';

/** The quality a HEIC is saved at as a JPG: high, since the point isn't to make it smaller. */
export const JPG_QUALITY = 92;

/** The result's name: the original's extension kept (a HEIC's becomes .jpg). */
export function cleanName(original: string, kind: Kind, scope: Scope, names: 'suffix' | 'same'): string {
  const own = original.match(/\.([^./\\]+)$/)?.[1];
  const ext = redrawn(kind) || !own ? (kind === 'png' ? 'png' : kind === 'webp' ? 'webp' : 'jpg') : own.toLowerCase();
  return outName(original, scope === 'location' ? 'no-location' : 'clean', ext, names);
}

/** Which facts were in, and of those which are still in the result. */
export function compare(before: Meta, after: Meta): { gone: FactKey[]; left: FactKey[] } {
  const was = present(before);
  const now = present(after);
  return { gone: was.filter((k) => !now.includes(k)), left: now };
}
