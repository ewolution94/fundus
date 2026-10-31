// F-906 Hashes, the logic: MD5 written here (RFC 1321, fed in pieces), SHA-1, SHA-256, SHA-384 and
// SHA-512 from Web Crypto, a file read in slices with its progress, the results in hex or Base64,
// and a pasted hash compared with them in whatever form it comes (hex any case, with colons,
// Base64, an SRI string, a line of sha256sum). No DOM; plain TypeScript with erasable types.

export type Algo = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';
export type Digests = Record<Algo, Uint8Array>;

export const ALGOS: Algo[] = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
export const ALGO_NAME: Record<Algo, string> = { md5: 'MD5', sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
/** Each digest's length in bytes. */
export const ALGO_BYTES: Record<Algo, number> = { md5: 16, sha1: 20, sha256: 32, sha384: 48, sha512: 64 };

// MD5 (RFC 1321): the sines table, the shifts per round, four 32-bit words of state.
const K = new Int32Array(64);
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0;
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

/** MD5, fed in pieces of any size. */
export class Md5 {
  h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
  buf = new Uint8Array(64);
  used = 0;
  total = 0;
  x = new Int32Array(16);

  block(b: Uint8Array, at: number) {
    const x = this.x;
    for (let j = 0; j < 16; j++) {
      const o = at + j * 4;
      x[j] = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    }
    const h = this.h;
    let a = h[0];
    let bb = h[1];
    let c = h[2];
    let d = h[3];
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (bb & c) | (~bb & d);
        g = i;
      } else if (i < 32) {
        f = (d & bb) | (~d & c);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = bb ^ c ^ d;
        g = (3 * i + 5) & 15;
      } else {
        f = c ^ (bb | ~d);
        g = (7 * i) & 15;
      }
      const s = S[((i >> 4) << 2) | (i & 3)];
      const t = (a + f + K[i] + x[g]) | 0;
      a = d;
      d = c;
      c = bb;
      bb = (bb + ((t << s) | (t >>> (32 - s)))) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + bb) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
  }

  update(data: Uint8Array): this {
    let i = 0;
    this.total += data.length;
    if (this.used) {
      const take = Math.min(64 - this.used, data.length);
      this.buf.set(data.subarray(0, take), this.used);
      this.used += take;
      i = take;
      if (this.used < 64) return this;
      this.block(this.buf, 0);
      this.used = 0;
    }
    for (; i + 64 <= data.length; i += 64) this.block(data, i);
    if (i < data.length) {
      this.buf.set(data.subarray(i), 0);
      this.used = data.length - i;
    }
    return this;
  }

  digest(): Uint8Array {
    // 0x80, zeros to 56 of 64, then the length in bits, little-endian, 64 bits.
    const total = this.total;
    const pad = new Uint8Array((this.used < 56 ? 56 : 120) - this.used + 8);
    pad[0] = 0x80;
    const lo = (total % 0x20000000) * 8;
    const hi = Math.floor(total / 0x20000000);
    const n = pad.length;
    for (let k = 0; k < 4; k++) {
      pad[n - 8 + k] = (lo >>> (8 * k)) & 0xff;
      pad[n - 4 + k] = (hi >>> (8 * k)) & 0xff;
    }
    this.update(pad);
    const out = new Uint8Array(16);
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) out[k * 4 + j] = (this.h[k] >>> (8 * j)) & 0xff;
    return out;
  }
}

export const md5 = (data: Uint8Array) => new Md5().update(data).digest();

const SUBTLE: Record<Exclude<Algo, 'md5'>, string> = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };

/** The SHA family from Web Crypto, all at once. */
export async function shas(data: Uint8Array): Promise<Omit<Digests, 'md5'>> {
  const keys = Object.keys(SUBTLE) as Exclude<Algo, 'md5'>[];
  const out = await Promise.all(keys.map((k) => crypto.subtle.digest(SUBTLE[k], data as Uint8Array<ArrayBuffer>)));
  return Object.fromEntries(keys.map((k, i) => [k, new Uint8Array(out[i])])) as Omit<Digests, 'md5'>;
}

/** All five of some bytes. */
export async function hashAll(data: Uint8Array): Promise<Digests> {
  return { md5: md5(data), ...(await shas(data)) };
}

/** The biggest file this reads: Web Crypto wants it all in memory at once. */
export const FILE_LIMIT = 1024 * 1024 * 1024;

export class TooBig extends Error {
  size: number;
  constructor(size: number) {
    super('too big');
    this.size = size;
  }
}

/**
 * All five of a file or blob, read in slices (MD5 fed as they come), with how far it got. `null`
 * when `stale()` says another one was asked for meanwhile.
 */
export async function hashBlob(blob: Blob, options: { chunk?: number; onProgress?: (done: number, total: number) => void; stale?: () => boolean } = {}): Promise<Digests | null> {
  const { chunk = 8 * 1024 * 1024, onProgress, stale } = options;
  if (blob.size > FILE_LIMIT) throw new TooBig(blob.size);
  const all = new Uint8Array(blob.size);
  const m = new Md5();
  for (let at = 0; at < blob.size; at += chunk) {
    const part = new Uint8Array(await blob.slice(at, at + chunk).arrayBuffer());
    if (stale?.()) return null;
    all.set(part, at);
    m.update(part);
    onProgress?.(Math.min(at + chunk, blob.size), blob.size);
  }
  const rest = await shas(all);
  if (stale?.()) return null;
  return { md5: m.digest(), ...rest };
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function toHex(b: Uint8Array, upper = false): string {
  let s = '';
  for (const x of b) s += HEX[x];
  return upper ? s.toUpperCase() : s;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}

function fromBase64(text: string): Uint8Array | null {
  const t = text.replace(/=+$/, '').replaceAll('-', '+').replaceAll('_', '/');
  if (!/^[A-Za-z0-9+/]*$/.test(t) || t.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((t.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let o = 0;
  for (const ch of t) {
    value = (value << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

function fromHex(text: string): Uint8Array | null {
  if (!/^[0-9a-f]*$/i.test(text) || text.length % 2) return null;
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

export type Comparison =
  | { state: 'match'; algo: Algo; form: 'hex' | 'base64' }
  | { state: 'mismatch'; algo: Algo; form: 'hex' | 'base64' }
  /** No hash here has its length: `digits` hex digits, or `bytes` once read as Base64. */
  | { state: 'length'; digits: number; form: 'hex' | 'base64'; bytes: number }
  | { state: 'unreadable' };

const PREFIX = /^(md5|sha-?1|sha-?256|sha-?384|sha-?512)\s*[-:=]\s*/i;
const BSD = /^(?:md5|sha-?\d+)\s*\(.*\)\s*=\s*(\S+)$/i;

/** Which algorithm a name like "SHA256" or "sha-1" means. */
const algoOf = (name: string) => name.toLowerCase().replace('-', '') as Algo;

/**
 * What someone pasted as the expected hash, compared with the digests. Takes hex in any case, with
 * colons or spaces between pairs; Base64 or Base64url; `sha256-…` (Subresource Integrity) or
 * `SHA256:…`; a line of `sha256sum` (the hash, then the name) or BSD's `SHA256 (name) = hash`.
 * `null` when there's nothing.
 */
export function compare(expected: string, digests: Digests): Comparison | null {
  let t = expected.trim();
  if (!t) return null;
  const bsd = BSD.exec(t);
  let only: Algo | null = bsd ? algoOf(t.slice(0, t.indexOf('(')).trim()) : null;
  if (bsd) t = bsd[1];
  const pre = PREFIX.exec(t);
  if (pre) {
    only = algoOf(pre[1]);
    t = t.slice(pre[0].length);
  }
  // "hash  name" from sha256sum: the first word. Hex split in pairs by colons or spaces: joined.
  const pairs = /^[0-9a-f]{2}([:\s-][0-9a-f]{2})+$/i.test(t) ? t.replace(/[:\s-]/g, '') : null;
  if (pairs) t = pairs;
  else {
    const words = t.split(/\s+/);
    // A hash is one word of at least 22 characters (MD5 in Base64); what follows it is a name.
    if (words.length > 1 && words[0].length < 22) return { state: 'unreadable' };
    t = words[0];
  }
  const pool = ALGOS.filter((a) => !only || a === only);
  const reads: { form: 'hex' | 'base64'; bytes: Uint8Array }[] = [];
  const hex = fromHex(t);
  if (hex) reads.push({ form: 'hex', bytes: hex });
  const b64 = fromBase64(t);
  if (b64) reads.push({ form: 'base64', bytes: b64 });
  if (!reads.length) return { state: 'unreadable' };
  for (const r of reads) for (const a of pool) if (same(r.bytes, digests[a])) return { state: 'match', algo: a, form: r.form };
  for (const r of reads) {
    const a = pool.find((x) => ALGO_BYTES[x] === r.bytes.length);
    if (a) return { state: 'mismatch', algo: a, form: r.form };
  }
  const first = reads[0];
  return { state: 'length', digits: t.length, form: first.form, bytes: first.bytes.length };
}
