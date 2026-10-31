// Base64 (RFC 4648): bytes to text and back, both alphabets, with or without padding; data: URLs;
// and what a run of decoded bytes is. Plain TypeScript with erasable types, tested as it is.
//
// Our own coder rather than btoa/atob: those only take Latin-1 strings, give no position for a bad
// character, and know only the standard alphabet.

const STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Each character's 6 bits; 64 for '=' (padding), -1 for anything else. Both alphabets at once. */
const VALUE = new Int8Array(128).fill(-1);
for (let k = 0; k < 64; k++) {
  VALUE[STANDARD.charCodeAt(k)] = k;
  VALUE[URLSAFE.charCodeAt(k)] = k;
}
VALUE[0x3d] = 64;

export interface EncodeOptions {
  /** The URL- and file-name-safe alphabet (RFC 4648 §5): - and _ instead of + and /. */
  url?: boolean;
  /** Pad with '=' to a multiple of four (on by default, as §4 has it). */
  pad?: boolean;
}

/** Bytes as Base64. Built in slices, so megabytes don't make a megabyte of string joins. */
export function encode(bytes: Uint8Array, { url = false, pad = true }: EncodeOptions = {}): string {
  const abc = url ? URLSAFE : STANDARD;
  const codes = new Uint8Array(64);
  for (let k = 0; k < 64; k++) codes[k] = abc.charCodeAt(k);
  const parts: string[] = [];
  const SLICE = 3 * 8192;
  const chars = new Uint8Array((SLICE / 3) * 4);
  for (let start = 0; start < bytes.length; start += SLICE) {
    const end = Math.min(bytes.length, start + SLICE);
    let n = 0;
    let i = start;
    for (; i + 2 < end; i += 3) {
      const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      chars[n++] = codes[v >> 18];
      chars[n++] = codes[(v >> 12) & 63];
      chars[n++] = codes[(v >> 6) & 63];
      chars[n++] = codes[v & 63];
    }
    const left = end - i;
    if (left === 1) {
      const v = bytes[i] << 16;
      chars[n++] = codes[v >> 18];
      chars[n++] = codes[(v >> 12) & 63];
      if (pad) {
        chars[n++] = 0x3d;
        chars[n++] = 0x3d;
      }
    } else if (left === 2) {
      const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
      chars[n++] = codes[v >> 18];
      chars[n++] = codes[(v >> 12) & 63];
      chars[n++] = codes[(v >> 6) & 63];
      if (pad) chars[n++] = 0x3d;
    }
    parts.push(String.fromCharCode.apply(null, chars.subarray(0, n) as unknown as number[]));
  }
  return parts.join('');
}

export type DecodeError =
  /** A character that's in neither alphabet, at `index` of the text as given. */
  | { code: 'char'; index: number; char: string }
  /** '=' somewhere other than the end, or more than two, or the wrong count. */
  | { code: 'padding'; index: number }
  /** One character too many or too few: a length of 4n + 1 can't come from bytes. */
  | { code: 'length'; length: number }
  /** + or / and also - or _: two alphabets in one text. */
  | { code: 'mixed'; index: number };

export type Decoded =
  | { ok: true; bytes: Uint8Array; alphabet: 'standard' | 'url' | 'either'; padded: boolean }
  | { ok: false; error: DecodeError };

/** Spaces and line breaks, as in a MIME or PEM block, are skipped. */
const SPACE = (c: number) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c;

/**
 * Base64 in either alphabet, padded or not, with white space anywhere, to bytes. A mistake says
 * where it is in the text as given.
 */
export function decode(text: string): Decoded {
  // The 6-bit values, and where each came from.
  const values = new Uint8Array(text.length);
  let n = 0;
  let padAt = -1;
  let pads = 0;
  let standardAt = -1;
  let urlAt = -1;
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    if (SPACE(c)) continue;
    const v = c < 128 ? VALUE[c] : -1;
    if (v === -1) return { ok: false, error: { code: 'char', index: k, char: String.fromCodePoint(text.codePointAt(k)!) } };
    if (v === 64) {
      if (padAt === -1) padAt = k;
      pads++;
      continue;
    }
    if (padAt !== -1) return { ok: false, error: { code: 'padding', index: padAt } };
    if (c === 0x2b || c === 0x2f) standardAt = standardAt === -1 ? k : standardAt;
    if (c === 0x2d || c === 0x5f) urlAt = urlAt === -1 ? k : urlAt;
    values[n++] = v;
  }
  if (standardAt !== -1 && urlAt !== -1) return { ok: false, error: { code: 'mixed', index: Math.max(standardAt, urlAt) } };
  if (n % 4 === 1) return { ok: false, error: { code: 'length', length: n + pads } };
  if (pads && (pads > 2 || (n + pads) % 4 !== 0)) return { ok: false, error: { code: 'padding', index: padAt } };

  const bytes = new Uint8Array(Math.floor((n * 3) / 4));
  let j = 0;
  let i = 0;
  for (; i + 3 < n; i += 4) {
    const v = (values[i] << 18) | (values[i + 1] << 12) | (values[i + 2] << 6) | values[i + 3];
    bytes[j++] = v >> 16;
    bytes[j++] = (v >> 8) & 255;
    bytes[j++] = v & 255;
  }
  if (n - i === 2) bytes[j++] = ((values[i] << 18) | (values[i + 1] << 12)) >> 16;
  else if (n - i === 3) {
    const v = (values[i] << 18) | (values[i + 1] << 12) | (values[i + 2] << 6);
    bytes[j++] = v >> 16;
    bytes[j++] = (v >> 8) & 255;
  }
  return { ok: true, bytes, alphabet: standardAt !== -1 ? 'standard' : urlAt !== -1 ? 'url' : 'either', padded: pads > 0 };
}

/** UTF-8 text as Base64. */
export const encodeText = (text: string, options?: EncodeOptions) => encode(new TextEncoder().encode(text), options);

/** Bytes as UTF-8 text, or null when they aren't (a photo, a ZIP). A leading BOM goes. */
export function asText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export interface DataUrl {
  /** As declared, lower case, without parameters; null when the URL names none. */
  mime: string | null;
  bytes: Uint8Array;
}

export type DataUrlParsed = { ok: true; url: DataUrl } | { ok: false; error: DecodeError | { code: 'percent'; index: number } };

/** Whether a text is a data: URL (it then needs `parseDataUrl`, not `decode`). */
export const isDataUrl = (text: string) => /^\s*data:/i.test(text);

/** `data:[type][;params][;base64],payload`: Base64 or percent-encoded (RFC 2397). */
export function parseDataUrl(text: string): DataUrlParsed | null {
  const t = text.trim();
  const m = /^data:([^,]*),/i.exec(t);
  if (!m) return null;
  const params = m[1].split(';').map((p) => p.trim());
  const base64 = params.length > 1 && params[params.length - 1].toLowerCase() === 'base64';
  const mime = params[0] ? params[0].toLowerCase() : null;
  const payload = t.slice(m[0].length);
  const offset = text.indexOf(t) + m[0].length;
  if (base64) {
    const d = decode(payload);
    if (!d.ok) return { ok: false, error: shift(d.error, offset) };
    return { ok: true, url: { mime, bytes: d.bytes } };
  }
  const bytes: number[] = [];
  for (let k = 0; k < payload.length; k++) {
    const c = payload.charCodeAt(k);
    if (c === 0x25) {
      const hex = payload.slice(k + 1, k + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { ok: false, error: { code: 'percent', index: offset + k } };
      bytes.push(parseInt(hex, 16));
      k += 2;
    } else if (c < 0x80) bytes.push(c);
    else {
      // Unescaped non-ASCII (browsers allow it): its UTF-8 bytes.
      const cp = payload.codePointAt(k)!;
      for (const byte of new TextEncoder().encode(String.fromCodePoint(cp))) bytes.push(byte);
      if (cp > 0xffff) k++;
    }
  }
  return { ok: true, url: { mime, bytes: new Uint8Array(bytes) } };
}

function shift(e: DecodeError, by: number): DecodeError {
  return 'index' in e ? { ...e, index: e.index + by } : e;
}

/** A data: URL of bytes, Base64 (always padded: some readers insist). */
export const dataUrl = (bytes: Uint8Array, mime: string) => `data:${mime};base64,${encode(bytes)}`;

/** What a run of bytes is, from its first bytes: a name to show, the MIME type and an extension. */
export interface Sniffed {
  label: string;
  mime: string;
  ext: string;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));

/**
 * The photo and PDF kinds come from lib/files.ts's `sniff` (passed in, so this file stays free of
 * the app); the rest are the usual suspects of a pasted data blob.
 */
export function sniffBytes(b: Uint8Array, photoKind: string): Sniffed {
  const known: Record<string, Sniffed> = {
    jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
    png: { label: 'PNG', mime: 'image/png', ext: 'png' },
    webp: { label: 'WebP', mime: 'image/webp', ext: 'webp' },
    heic: { label: 'HEIC', mime: 'image/heic', ext: 'heic' },
    avif: { label: 'AVIF', mime: 'image/avif', ext: 'avif' },
    gif: { label: 'GIF', mime: 'image/gif', ext: 'gif' },
    pdf: { label: 'PDF', mime: 'application/pdf', ext: 'pdf' },
  };
  if (known[photoKind]) return known[photoKind];
  const head = ascii(b, 0, 16);
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6)) return { label: 'ZIP', mime: 'application/zip', ext: 'zip' };
  if (b[0] === 0x1f && b[1] === 0x8b) return { label: 'gzip', mime: 'application/gzip', ext: 'gz' };
  if (head.startsWith('7z\xbc\xaf\x27\x1c')) return { label: '7z', mime: 'application/x-7z-compressed', ext: '7z' };
  if (head.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && b.length > 3 && (b[1] & 0x06) !== 0)) return { label: 'MP3', mime: 'audio/mpeg', ext: 'mp3' };
  if (head.startsWith('RIFF') && ascii(b, 8, 12) === 'WAVE') return { label: 'WAV', mime: 'audio/wav', ext: 'wav' };
  if (head.startsWith('OggS')) return { label: 'Ogg', mime: 'audio/ogg', ext: 'ogg' };
  if (head.startsWith('fLaC')) return { label: 'FLAC', mime: 'audio/flac', ext: 'flac' };
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (brand === 'qt  ') return { label: 'QuickTime', mime: 'video/quicktime', ext: 'mov' };
    if (/^M4A/.test(brand)) return { label: 'M4A', mime: 'audio/mp4', ext: 'm4a' };
    return { label: 'MP4', mime: 'video/mp4', ext: 'mp4' };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { label: 'WebM', mime: 'video/webm', ext: 'webm' };
  if (head.startsWith('BM') && b.length > 14) return { label: 'BMP', mime: 'image/bmp', ext: 'bmp' };
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { label: 'ICO', mime: 'image/x-icon', ext: 'ico' };
  if (head.startsWith('II*\0') || head.startsWith('MM\0*')) return { label: 'TIFF', mime: 'image/tiff', ext: 'tiff' };
  if (head.startsWith('wOFF')) return { label: 'WOFF', mime: 'font/woff', ext: 'woff' };
  if (head.startsWith('wOF2')) return { label: 'WOFF2', mime: 'font/woff2', ext: 'woff2' };
  if (head.startsWith('\0asm')) return { label: 'WebAssembly', mime: 'application/wasm', ext: 'wasm' };
  const whole = b.length <= 4096;
  const text = asText(whole ? b : trimToChar(b.subarray(0, 4096)));
  if (text !== null && !/[\0-\x08\x0e-\x1f]/.test(text)) {
    const t = text.trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(t)) return { label: 'SVG', mime: 'image/svg+xml', ext: 'svg' };
    if (/^<(!doctype html|html)[\s>]/i.test(t)) return { label: 'HTML', mime: 'text/html', ext: 'html' };
    if (/^<\?xml/.test(t)) return { label: 'XML', mime: 'application/xml', ext: 'xml' };
    if (/^[{[]/.test(t) && whole) {
      try {
        JSON.parse(text);
        return { label: 'JSON', mime: 'application/json', ext: 'json' };
      } catch {}
    }
    return { label: 'text', mime: 'text/plain', ext: 'txt' };
  }
  return { label: '', mime: 'application/octet-stream', ext: 'bin' };
}

/** The first 4 KB cut back to a whole UTF-8 character, so a cut in mid-character isn't "binary". */
function trimToChar(b: Uint8Array): Uint8Array {
  let end = b.length;
  for (let k = 1; k <= 3 && end - k >= 0; k++) {
    const c = b[end - k];
    if ((c & 0xc0) === 0x80) continue;
    if (c >= 0xc0) {
      const need = c >= 0xf0 ? 4 : c >= 0xe0 ? 3 : 2;
      if (k < need) end -= k;
    }
    break;
  }
  return b.subarray(0, end);
}

/** The extension for a declared MIME type, when we know one. */
export function extFor(mime: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/tiff': 'tiff',
    'application/pdf': 'pdf',
    'application/json': 'json',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'application/xml': 'xml',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/csv': 'csv',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
  };
  return map[mime] ?? null;
}

/** Base64's length for `n` bytes. */
export const encodedLength = (n: number, pad = true) => (pad ? Math.ceil(n / 3) * 4 : Math.ceil((n * 4) / 3));
