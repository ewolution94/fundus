// What a photo says about itself (place, camera, time), read and removed byte by byte, without
// decoding the picture. Plain TypeScript with erasable types, so the tests run it as it is.
//
// - Reading: the EXIF block (a TIFF structure) out of a JPEG (APP1), PNG (eXIf), WebP (EXIF) or HEIC
//   (the `Exif` item in its `meta` box), then the tags people care about.
// - Removing: JPEG, PNG and WebP lose their metadata without re-encoding, so the picture stays
//   bit-for-bit. "Location only" empties the GPS directory and keeps the rest; "everything" drops
//   EXIF, XMP and IPTC, keeping only the orientation, so the photo still stands the right way up.
// - Carrying: photo tools re-encode on a canvas, which keeps nothing; with "Remove location when
//   saving" off, the original's EXIF goes into the new JPEG (orientation reset: the pixels are
//   already upright).

import { sniff } from './files.ts';

export interface Meta {
  make?: string;
  model?: string;
  lens?: string;
  software?: string;
  /** "2026:10:30 14:02:11", as the camera wrote it. */
  taken?: string;
  orientation?: number;
  gps?: { lat: number; lon: number; alt?: number };
  width?: number;
  height?: number;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

// ── Finding the TIFF block ───────────────────────────────────────────────────────────────

/** The EXIF block's TIFF bytes ("II*\0" or "MM\0*" first), wherever the format keeps it; null if none. */
export function findTiff(b: Uint8Array): Uint8Array | null {
  const kind = sniff(b);
  if (kind === 'jpeg') {
    for (const seg of jpegSegments(b)) {
      if (seg.marker === 0xe1 && ascii(b, seg.start + 4, seg.start + 10) === 'Exif\0\0') return b.subarray(seg.start + 10, seg.end);
      if (seg.marker === 0xda) break;
    }
    return null;
  }
  if (kind === 'png') {
    for (const c of pngChunks(b)) if (c.type === 'eXIf') return b.subarray(c.data, c.data + c.length);
    return null;
  }
  if (kind === 'webp') {
    for (const c of riffChunks(b)) {
      if (c.type === 'EXIF') {
        const data = b.subarray(c.data, c.data + c.length);
        return ascii(data, 0, 6) === 'Exif\0\0' ? data.subarray(6) : data;
      }
    }
    return null;
  }
  if (kind === 'heic' || kind === 'avif') return heifExif(b);
  return null;
}

interface Segment {
  marker: number;
  start: number;
  end: number;
}

/** A JPEG's segments up to and including SOS (the picture data after it is left alone). */
export function jpegSegments(b: Uint8Array): Segment[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Segment[] = [];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = view.getUint16(i + 2);
    out.push({ marker, start: i, end: i + 2 + length });
    if (marker === 0xda) break;
    i += 2 + length;
  }
  return out;
}

interface Chunk {
  type: string;
  start: number;
  data: number;
  length: number;
  end: number;
}

function pngChunks(b: Uint8Array): Chunk[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Chunk[] = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const length = view.getUint32(i);
    const type = ascii(b, i + 4, i + 8);
    out.push({ type, start: i, data: i + 8, length, end: i + 12 + length });
    i += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

function riffChunks(b: Uint8Array): Chunk[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Chunk[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const length = view.getUint32(i + 4, true);
    out.push({ type: ascii(b, i, i + 4), start: i, data: i + 8, length, end: i + 8 + length + (length & 1) });
    i += 8 + length + (length & 1);
  }
  return out;
}

/** HEIC/AVIF: the `Exif` item's bytes through `meta` → `iinf` and `iloc`. */
function heifExif(b: Uint8Array): Uint8Array | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const boxes = (from: number, to: number) => {
    const out: { type: string; start: number; body: number; end: number }[] = [];
    let i = from;
    while (i + 8 <= to) {
      let size = view.getUint32(i);
      const type = ascii(b, i + 4, i + 8);
      let body = i + 8;
      if (size === 1) {
        size = Number(view.getBigUint64(i + 8));
        body = i + 16;
      } else if (size === 0) size = to - i;
      if (size < 8 || i + size > to) break;
      out.push({ type, start: i, body, end: i + size });
      i += size;
    }
    return out;
  };
  const meta = boxes(0, b.length).find((x) => x.type === 'meta');
  if (!meta) return null;
  const inMeta = boxes(meta.body + 4, meta.end);
  const iinf = inMeta.find((x) => x.type === 'iinf');
  const iloc = inMeta.find((x) => x.type === 'iloc');
  if (!iinf || !iloc) return null;

  // iinf: version, entry count, then `infe` boxes (version 2+: item id, protection, type).
  const iinfVersion = b[iinf.body];
  const infeStart = iinf.body + 4 + (iinfVersion === 0 ? 2 : 4);
  let exifId = -1;
  for (const infe of boxes(infeStart, iinf.end)) {
    const v = b[infe.body];
    if (infe.type !== 'infe' || v < 2) continue;
    const id = v === 2 ? view.getUint16(infe.body + 4) : view.getUint32(infe.body + 4);
    const typeAt = infe.body + 4 + (v === 2 ? 2 : 4) + 2;
    if (ascii(b, typeAt, typeAt + 4) === 'Exif') exifId = id;
  }
  if (exifId < 0) return null;

  // iloc: find the extents of that item.
  const v = b[iloc.body];
  let p = iloc.body + 4;
  const sizes = view.getUint16(p);
  p += 2;
  const offsetSize = sizes >> 12;
  const lengthSize = (sizes >> 8) & 15;
  const baseSize = (sizes >> 4) & 15;
  const indexSize = v === 1 || v === 2 ? sizes & 15 : 0;
  const read = (n: number) => {
    const value = n === 0 ? 0 : n === 4 ? view.getUint32(p) : n === 8 ? Number(view.getBigUint64(p)) : n === 2 ? view.getUint16(p) : 0;
    p += n;
    return value;
  };
  const count = v < 2 ? read(2) : read(4);
  for (let k = 0; k < count; k++) {
    const id = v < 2 ? read(2) : read(4);
    if (v === 1 || v === 2) read(2); // construction method
    read(2); // data reference index
    const base = read(baseSize);
    const extents = read(2);
    let start = -1;
    let total = 0;
    for (let e = 0; e < extents; e++) {
      if (indexSize) read(indexSize);
      const offset = read(offsetSize);
      const length = read(lengthSize);
      if (e === 0) start = base + offset;
      total += length;
    }
    if (id === exifId && start >= 0 && start + total <= b.length) {
      const item = b.subarray(start, start + total);
      // The item starts with the offset from its fifth byte to the TIFF header.
      const skip = new DataView(item.buffer, item.byteOffset, item.byteLength).getUint32(0);
      const tiff = item.subarray(4 + skip);
      return ascii(tiff, 0, 2) === 'II' || ascii(tiff, 0, 2) === 'MM' ? tiff : null;
    }
  }
  return null;
}

// ── Reading the TIFF ──────────────────────────────────────────────────────────────────────

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** Where the value is: inside the entry when it fits in 4 bytes, else at the offset it names. */
  at: number;
  entry: number;
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

class Tiff {
  b: Uint8Array;
  v: DataView;
  le: boolean;
  constructor(b: Uint8Array) {
    this.b = b;
    this.v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    this.le = ascii(b, 0, 2) === 'II';
  }
  u16 = (o: number) => this.v.getUint16(o, this.le);
  u32 = (o: number) => this.v.getUint32(o, this.le);
  ifd0 = () => this.u32(4);
  entries(offset: number): Entry[] {
    if (!offset || offset + 2 > this.b.length) return [];
    const n = this.u16(offset);
    const out: Entry[] = [];
    for (let k = 0; k < n; k++) {
      const e = offset + 2 + k * 12;
      if (e + 12 > this.b.length) break;
      const type = this.u16(e + 2);
      const count = this.u32(e + 4);
      const size = (TYPE_SIZE[type] ?? 1) * count;
      out.push({ tag: this.u16(e), type, count, at: size <= 4 ? e + 8 : this.u32(e + 8), entry: e });
    }
    return out;
  }
  next(offset: number) {
    const n = this.u16(offset);
    const at = offset + 2 + n * 12;
    return at + 4 <= this.b.length ? this.u32(at) : 0;
  }
  string(e: Entry) {
    if (e.at + e.count > this.b.length) return '';
    return ascii(this.b, e.at, e.at + e.count).replace(/\0+$/, '').trim();
  }
  number(e: Entry): number {
    if (e.type === 3) return this.u16(e.at);
    if (e.type === 4) return this.u32(e.at);
    if (e.type === 5) return this.rational(e.at);
    return this.b[e.at];
  }
  rational = (at: number) => {
    const d = this.u32(at + 4);
    return d ? this.u32(at) / d : 0;
  };
  /** Degrees, minutes, seconds → decimal degrees. */
  dms(e: Entry) {
    return this.rational(e.at) + this.rational(e.at + 8) / 60 + this.rational(e.at + 16) / 3600;
  }
}

/** The tags people care about, from a TIFF block. */
export function readTiff(tiffBytes: Uint8Array): Meta {
  const t = new Tiff(tiffBytes);
  const meta: Meta = {};
  const ifd0 = t.entries(t.ifd0());
  let exifAt = 0;
  let gpsAt = 0;
  for (const e of ifd0) {
    if (e.tag === 0x010f) meta.make = t.string(e);
    else if (e.tag === 0x0110) meta.model = t.string(e);
    else if (e.tag === 0x0131) meta.software = t.string(e);
    else if (e.tag === 0x0132) meta.taken ??= t.string(e);
    else if (e.tag === 0x0112) meta.orientation = t.number(e);
    else if (e.tag === 0x8769) exifAt = t.u32(e.entry + 8);
    else if (e.tag === 0x8825) gpsAt = t.u32(e.entry + 8);
  }
  for (const e of t.entries(exifAt)) {
    if (e.tag === 0x9003) meta.taken = t.string(e);
    else if (e.tag === 0xa434) meta.lens = t.string(e);
    else if (e.tag === 0xa002) meta.width = t.number(e);
    else if (e.tag === 0xa003) meta.height = t.number(e);
  }
  const gps: Record<number, Entry> = {};
  for (const e of t.entries(gpsAt)) gps[e.tag] = e;
  if (gps[2] && gps[4]) {
    const latRef = gps[1] ? t.string(gps[1]) : 'N';
    const lonRef = gps[3] ? t.string(gps[3]) : 'E';
    const lat = t.dms(gps[2]) * (latRef === 'S' ? -1 : 1);
    const lon = t.dms(gps[4]) * (lonRef === 'W' ? -1 : 1);
    if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
      meta.gps = { lat, lon };
      if (gps[6]) meta.gps.alt = t.rational(gps[6].at) * (gps[5] && tiffBytes[gps[5].at] === 1 ? -1 : 1);
    }
  }
  return meta;
}

/** Everything a photo's bytes say about it; `{}` when nothing. */
export function readMeta(b: Uint8Array): Meta {
  const tiff = findTiff(b);
  if (!tiff) return {};
  try {
    return readTiff(tiff);
  } catch {
    return {};
  }
}

// ── Changing the TIFF ─────────────────────────────────────────────────────────────────────

/** A copy of the TIFF with the GPS directory emptied (its values zeroed, its count 0). */
export function withoutGps(tiffBytes: Uint8Array): Uint8Array {
  const out = tiffBytes.slice();
  const t = new Tiff(out);
  const gpsTag = t.entries(t.ifd0()).find((e) => e.tag === 0x8825);
  if (!gpsTag) return out;
  const gpsAt = t.u32(gpsTag.entry + 8);
  if (!gpsAt || gpsAt + 2 > out.length) return out;
  for (const e of t.entries(gpsAt)) {
    const size = (TYPE_SIZE[e.type] ?? 1) * e.count;
    if (size > 4 && e.at + size <= out.length) out.fill(0, e.at, e.at + size);
  }
  const n = t.u16(gpsAt);
  out.fill(0, gpsAt, Math.min(out.length, gpsAt + 2 + n * 12 + 4));
  return out;
}

/** A copy of the TIFF with the orientation set (1: upright). */
function withOrientation(tiffBytes: Uint8Array, value: number): Uint8Array {
  const out = tiffBytes.slice();
  const t = new Tiff(out);
  const e = t.entries(t.ifd0()).find((x) => x.tag === 0x0112);
  if (e) t.v.setUint16(e.at, value, t.le);
  return out;
}

/** The smallest TIFF that says only "orientation": what "everything" keeps. */
export function orientationTiff(value: number): Uint8Array {
  const b = new Uint8Array(26);
  const v = new DataView(b.buffer);
  b.set([0x4d, 0x4d, 0x00, 0x2a]); // big-endian, 42
  v.setUint32(4, 8); // IFD0 right after the header
  v.setUint16(8, 1); // one entry
  v.setUint16(10, 0x0112);
  v.setUint16(12, 3); // SHORT
  v.setUint32(14, 1);
  v.setUint16(18, value);
  v.setUint32(22, 0); // no next IFD
  return b;
}

function app1(tiff: Uint8Array): Uint8Array {
  const length = 2 + 6 + tiff.length;
  const seg = new Uint8Array(2 + length);
  seg.set([0xff, 0xe1, length >> 8, length & 0xff]);
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
  seg.set(tiff, 10);
  return seg;
}

const XMP = 'http://ns.adobe.com/xap/1.0/';

// ── Removing, by format ───────────────────────────────────────────────────────────────────

export type Scope = 'location' | 'everything';

/**
 * The same JPEG without its location (`location`: the GPS directory emptied, XMP dropped since it can
 * repeat the place) or without any metadata but its orientation (`everything`). The picture data is
 * copied as it is.
 */
export function stripJpeg(b: Uint8Array, scope: Scope): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let orientation = 1;
  const tiff = findTiff(b);
  if (tiff) orientation = readTiff(tiff).orientation ?? 1;
  const segs = jpegSegments(b);
  for (const seg of segs) {
    const isExif = seg.marker === 0xe1 && ascii(b, seg.start + 4, seg.start + 10) === 'Exif\0\0';
    const isXmp = seg.marker === 0xe1 && ascii(b, seg.start + 4, seg.start + 4 + XMP.length) === XMP;
    if (isExif) {
      if (scope === 'location') parts.push(app1(withoutGps(b.subarray(seg.start + 10, seg.end))));
      else if (orientation !== 1) parts.push(app1(orientationTiff(orientation)));
      continue;
    }
    if (isXmp || seg.marker === 0xe1) continue; // XMP, extended XMP and any other APP1
    if (seg.marker === 0xed) continue; // APP13: Photoshop's IPTC (captions, places)
    if (seg.marker === 0xfe && scope === 'everything') continue; // comments
    if (seg.marker === 0xda) {
      // Start of scan: from here on it's the picture, copied as it is.
      parts.push(b.subarray(seg.start));
      break;
    }
    parts.push(b.subarray(seg.start, seg.end));
  }
  return concat(parts);
}

/** The same PNG without eXIf, text chunks (tEXt, zTXt, iTXt hold XMP and captions) or a time stamp. */
export function stripPng(b: Uint8Array, scope: Scope): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  for (const c of pngChunks(b)) {
    if (c.type === 'eXIf') {
      if (scope === 'location') parts.push(pngChunk('eXIf', withoutGps(b.subarray(c.data, c.data + c.length))));
      continue;
    }
    if (c.type === 'iTXt' || c.type === 'tEXt' || c.type === 'zTXt') {
      // XMP (iTXt "XML:com.adobe.xmp") can repeat the place; with "location" only that goes.
      const key = ascii(b, c.data, Math.min(c.data + 40, c.data + c.length)).split('\0')[0];
      if (scope === 'everything' || key === 'XML:com.adobe.xmp') continue;
    }
    if (c.type === 'tIME' && scope === 'everything') continue;
    parts.push(b.subarray(c.start, c.end));
  }
  return concat(parts);
}

/** The same WebP without its EXIF and XMP chunks (and the VP8X flags that announce them). */
export function stripWebp(b: Uint8Array, scope: Scope): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const c of riffChunks(b)) {
    if (c.type === 'EXIF') {
      if (scope === 'location') {
        const data = b.subarray(c.data, c.data + c.length);
        const prefixed = ascii(data, 0, 6) === 'Exif\0\0';
        const tiff = withoutGps(prefixed ? data.subarray(6) : data);
        parts.push(riffChunk('EXIF', prefixed ? concat([data.subarray(0, 6), tiff]) : tiff));
      }
      continue;
    }
    if (c.type === 'XMP ') continue;
    if (c.type === 'VP8X') {
      const chunk = b.slice(c.start, c.end);
      // Flags: bit 3 EXIF, bit 2 XMP.
      const keepExif = scope === 'location' && riffChunks(b).some((x) => x.type === 'EXIF');
      chunk[8] = (chunk[8] & ~0b1100) | (keepExif ? 0b1000 : 0);
      parts.push(chunk);
      continue;
    }
    parts.push(b.subarray(c.start, c.end));
  }
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out;
}

/** Any of the three; null for a format that can't be changed in place (HEIC: re-encode it). */
export function strip(b: Uint8Array, scope: Scope): Uint8Array | null {
  const kind = sniff(b);
  if (kind === 'jpeg') return stripJpeg(b, scope);
  if (kind === 'png') return stripPng(b, scope);
  if (kind === 'webp') return stripWebp(b, scope);
  return null;
}

/**
 * A freshly encoded JPEG with the original's EXIF put back (for "Remove location when saving" off):
 * orientation reset to upright, the GPS directory emptied when `dropGps`. A block too big for one
 * APP1 segment (rare: cameras keep it under 64 KB) isn't carried.
 */
export function carryExif(original: Uint8Array, jpeg: Uint8Array, dropGps: boolean): Uint8Array {
  let tiff = findTiff(original);
  if (!tiff || sniff(jpeg) !== 'jpeg') return jpeg;
  tiff = withOrientation(tiff, 1);
  if (dropGps) tiff = withoutGps(tiff);
  if (tiff.length + 8 > 0xffff) return jpeg;
  // After SOI and an APP0 (JFIF), if there is one.
  const segs = jpegSegments(jpeg);
  const after = segs[0]?.marker === 0xe0 ? segs[0].end : 2;
  return concat([jpeg.subarray(0, after), app1(tiff), jpeg.subarray(after)]);
}

// ── Bytes ─────────────────────────────────────────────────────────────────────────────────

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function riffChunk(type: string, data: Uint8Array): Uint8Array {
  const pad = data.length & 1;
  const out = new Uint8Array(8 + data.length + pad);
  for (let i = 0; i < 4; i++) out[i] = type.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}
