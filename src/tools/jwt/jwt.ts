// JWTs: a token taken apart (base64url, then JSON, numbers kept as written), its times read, and its
// signature checked with WebCrypto: HMAC with a secret; RSA, RSA-PSS, ECDSA and Ed25519 with a
// public key as PEM (SPKI, PKCS#1, or a certificate), a JWK or a JWK set. Plain TypeScript with
// erasable types; WebCrypto is the same in node, so the tests run it as it is.

export type Part = 'header' | 'payload' | 'signature';

export type DecodeError =
  | { code: 'parts'; n: number }
  | { code: 'jwe' }
  | { code: 'base64'; part: Part; char: string; position: number }
  | { code: 'length'; part: Part }
  | { code: 'utf8'; part: Part }
  | { code: 'json'; part: 'header'; text: string }
  | { code: 'object'; part: 'header' };

export interface Decoded {
  ok: true;
  /** "header.payload": what the signature is over. */
  signingInput: string;
  header: Record<string, unknown>;
  headerText: string;
  /** The claims, or null when the payload isn't a JSON object. */
  payload: Record<string, unknown> | null;
  /** Indented JSON, or the payload's text as it is when it isn't JSON. */
  payloadText: string;
  payloadJson: boolean;
  signature: Uint8Array;
  alg: string | null;
}

const QUOTES = /^["'“”‘’`]+|["'“”‘’`]+$/g;

/** A pasted token without "Bearer ", the quotes it had in JSON, and the spaces and line breaks a
 *  mail client adds. */
export const clean = (input: string) =>
  input.trim().replace(QUOTES, '').trim().replace(/^bearer\s+/i, '').replace(QUOTES, '').replace(/\s+/g, '');

/** base64url (the standard alphabet and = padding too) to bytes; `offset` places a bad character. */
export function fromBase64Url(s: string, part: Part, offset = 0): Uint8Array | DecodeError {
  const body = s.replace(/=+$/, '');
  for (let i = 0; i < body.length; i++) {
    if (!/[A-Za-z0-9_\-+/]/.test(body[i])) return { code: 'base64', part, char: String.fromCodePoint(body.codePointAt(i)!), position: offset + i + 1 };
  }
  if (body.length % 4 === 1) return { code: 'length', part };
  const std = body.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const toBase64Url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const isError = (x: unknown): x is DecodeError => typeof x === 'object' && x !== null && 'code' in x;

function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Valid JSON indented by two, the way it's written: a number keeps its digits (JSON.parse would
 * round 12345678901234567890), a string its escapes.
 */
export function indentJson(text: string): string {
  let out = '';
  let depth = 0;
  const pad = () => '\n' + '  '.repeat(depth);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === ' ' || c === '\n' || c === '\r' || c === '\t') {
      continue;
    } else if (c === '{' || c === '[') {
      let j = i + 1;
      while (/[ \n\r\t]/.test(text[j] ?? '')) j++;
      if (text[j] === (c === '{' ? '}' : ']')) {
        out += c + text[j];
        i = j;
      } else {
        depth++;
        out += c + pad();
      }
    } else if (c === '}' || c === ']') {
      depth--;
      out += pad() + c;
    } else if (c === ',') out += ',' + pad();
    else if (c === ':') out += ': ';
    else out += c;
  }
  return out;
}

export function decode(input: string): Decoded | DecodeError | null {
  const token = clean(input);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length === 5) return { code: 'jwe' };
  if (parts.length !== 3) return { code: 'parts', n: parts.length };
  const [h, p, s] = parts;
  const hb = fromBase64Url(h, 'header');
  if (isError(hb)) return hb;
  const pb = fromBase64Url(p, 'payload', h.length + 1);
  if (isError(pb)) return pb;
  const sb = fromBase64Url(s, 'signature', h.length + p.length + 2);
  if (isError(sb)) return sb;

  const headerRaw = utf8(hb);
  if (headerRaw === null) return { code: 'utf8', part: 'header' };
  let header: unknown;
  try {
    header = JSON.parse(headerRaw);
  } catch {
    return { code: 'json', part: 'header', text: headerRaw };
  }
  if (typeof header !== 'object' || header === null || Array.isArray(header)) return { code: 'object', part: 'header' };

  const payloadRaw = utf8(pb);
  if (payloadRaw === null) return { code: 'utf8', part: 'payload' };
  let payload: Record<string, unknown> | null = null;
  let payloadJson = false;
  try {
    const value = JSON.parse(payloadRaw);
    payloadJson = true;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) payload = value;
  } catch {}

  const h0 = header as Record<string, unknown>;
  return {
    ok: true,
    signingInput: `${h}.${p}`,
    header: h0,
    headerText: indentJson(headerRaw),
    payload,
    payloadText: payloadJson ? indentJson(payloadRaw) : payloadRaw,
    payloadJson,
    signature: sb,
    alg: typeof h0.alg === 'string' ? h0.alg : null,
  };
}

// ── Times ───────────────────────────────────────────────────────────────────────────────────

export type Claim = 'exp' | 'iat' | 'nbf';
export const CLAIMS: Claim[] = ['exp', 'nbf', 'iat'];

export type Time =
  | { claim: Claim; ok: true; ms: number; past: boolean }
  | { claim: Claim; ok: false; raw: string };

/** Dates run ±8.64e15 ms around 1970. */
const MAX_MS = 8.64e15;

/** The time claims there are, in seconds since 1970 as JWT has them (a fraction allowed). */
export function times(payload: Record<string, unknown> | null, now: number): Time[] {
  if (!payload) return [];
  const out: Time[] = [];
  for (const claim of CLAIMS) {
    if (!(claim in payload)) continue;
    const v = payload[claim];
    const ms = typeof v === 'number' ? v * 1000 : NaN;
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_MS) out.push({ claim, ok: false, raw: JSON.stringify(v) ?? String(v) });
    else out.push({ claim, ok: true, ms, past: ms <= now });
  }
  return out;
}

/** Whether the token is in force now, by exp and nbf: none when it has neither. */
export function standing(list: Time[]): 'expired' | 'notYet' | 'valid' | 'none' {
  const exp = list.find((t) => t.claim === 'exp');
  const nbf = list.find((t) => t.claim === 'nbf');
  if (exp?.ok && exp.past) return 'expired';
  if (nbf?.ok && !nbf.past) return 'notYet';
  return exp?.ok || nbf?.ok ? 'valid' : 'none';
}

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

/** The unit a stretch of time reads best in, and how many. */
function unitOf(abs: number): [number, 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'] {
  if (abs < 45 * S) return [abs / S, 'second'];
  if (abs < 45 * M) return [abs / M, 'minute'];
  if (abs < 22 * H) return [abs / H, 'hour'];
  if (abs < 26 * D) return [abs / D, 'day'];
  if (abs < 320 * D) return [abs / (30.436875 * D), 'month'];
  return [abs / (365.2425 * D), 'year'];
}

/** "3 days ago", "in 2 hours" (in German "vor 3 Tagen", "in 2 Stunden"). */
export function relative(ms: number, now: number, locale: string): string {
  const diff = ms - now;
  const [n, unit] = unitOf(Math.abs(diff));
  const rounded = Math.max(1, Math.round(n));
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(diff < 0 ? -rounded : rounded, unit);
}

/** "2 hours", "3 days". */
export function duration(abs: number, locale: string): string {
  const [n, unit] = unitOf(abs);
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(Math.max(1, Math.round(n)));
}

/** The zone if Intl knows it, else UTC. */
export function validZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

/** "Oct 31, 2025, 21:20:00 GMT+1", in a zone. */
export function dateIn(ms: number, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(ms);
}

// ── Algorithms and keys ────────────────────────────────────────────────────────────────────

export type Family = 'HS' | 'RS' | 'PS' | 'ES' | 'Ed';
export type Hash = 'SHA-256' | 'SHA-384' | 'SHA-512';
export type Curve = 'P-256' | 'P-384' | 'P-521';

export interface Alg {
  family: Family;
  hash: Hash;
  curve?: Curve;
}

const HASH: Record<string, Hash> = { '256': 'SHA-256', '384': 'SHA-384', '512': 'SHA-512' };
const CURVE: Record<string, Curve> = { '256': 'P-256', '384': 'P-384', '512': 'P-521' };

/** What an `alg` asks for; null for one WebCrypto can't check (none, ES256K, Ed448, made up). */
export function algOf(alg: string | null): Alg | null {
  if (!alg) return null;
  if (alg === 'EdDSA' || alg === 'Ed25519') return { family: 'Ed', hash: 'SHA-512' };
  const m = /^(HS|RS|PS|ES)(256|384|512)$/.exec(alg);
  if (!m) return null;
  const family = m[1] as Family;
  return family === 'ES' ? { family, hash: HASH[m[2]], curve: CURVE[m[2]] } : { family, hash: HASH[m[2]] };
}

export type KeyProblem =
  | 'empty'
  | 'pem'
  | 'private'
  | 'jwk'
  | 'noKeys'
  | 'kidMissing'
  | 'kidNeeded'
  | 'rsaWanted'
  | 'ecWanted'
  | 'edWanted'
  | 'octWanted'
  | 'curve'
  | 'pssKey'
  | 'ed448'
  | 'noEd'
  | 'secretBase64'
  | 'import'
  | 'alg';

export type Verdict =
  | { ok: true; valid: boolean; sigLength?: { got: number; want: number } }
  | { ok: false; problem: KeyProblem; detail?: string; n?: number; kid?: string; curve?: string; want?: string };

// A tiny DER reader: enough to find a key's algorithm and a certificate's key.

interface Tlv {
  tag: number;
  /** Where the TLV starts (its tag). */
  at: number;
  /** Where its content starts and ends. */
  start: number;
  end: number;
}

function tlv(b: Uint8Array, at: number): Tlv {
  if (at + 2 > b.length) throw new Error('DER');
  const tag = b[at];
  let len = b[at + 1];
  let p = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new Error('DER');
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + b[p++];
  }
  if (p + len > b.length) throw new Error('DER');
  return { tag, at, start: p, end: p + len };
}

function children(b: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let at = t.start; at < t.end; ) {
    const c = tlv(b, at);
    out.push(c);
    at = c.end;
  }
  return out;
}

function oid(b: Uint8Array, t: Tlv): string {
  const out: number[] = [];
  let v = 0;
  for (let i = t.start; i < t.end; i++) {
    v = v * 128 + (b[i] & 0x7f);
    if (!(b[i] & 0x80)) {
      if (!out.length) out.push(v < 80 ? Math.floor(v / 40) : 2, v < 80 ? v % 40 : v - 80);
      else out.push(v);
      v = 0;
    }
  }
  return out.join('.');
}

const OID = {
  rsa: '1.2.840.113549.1.1.1',
  pss: '1.2.840.113549.1.1.10',
  ec: '1.2.840.10045.2.1',
  ed25519: '1.3.101.112',
  ed448: '1.3.101.113',
};
const CURVE_OID: Record<string, Curve> = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' };

export type KeyKind = { kind: 'rsa' | 'pss' | 'ed25519' | 'ed448' | 'other' } | { kind: 'ec'; curve: Curve | null };

/** What kind of key an SPKI holds. */
export function spkiKind(der: Uint8Array): KeyKind {
  const top = tlv(der, 0);
  const [algId] = children(der, top);
  const [id, params] = children(der, algId);
  const o = oid(der, id);
  if (o === OID.rsa) return { kind: 'rsa' };
  if (o === OID.pss) return { kind: 'pss' };
  if (o === OID.ed25519) return { kind: 'ed25519' };
  if (o === OID.ed448) return { kind: 'ed448' };
  if (o === OID.ec) return { kind: 'ec', curve: params?.tag === 0x06 ? (CURVE_OID[oid(der, params)] ?? null) : null };
  return { kind: 'other' };
}

/** A certificate's public key (its SubjectPublicKeyInfo). */
export function certKey(der: Uint8Array): Uint8Array {
  const [tbs] = children(der, tlv(der, 0));
  const fields = children(der, tbs);
  const first = fields[0]?.tag === 0xa0 ? 1 : 0;
  const spki = fields[first + 5];
  if (!spki || spki.tag !== 0x30) throw new Error('DER');
  return der.slice(spki.at, spki.end);
}

const derLength = (n: number) => (n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : n < 0x10000 ? [0x82, n >> 8, n & 0xff] : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff]);

/** An "RSA PUBLIC KEY" (PKCS#1) wrapped as the SPKI WebCrypto takes. */
export function pkcs1ToSpki(pkcs1: Uint8Array): Uint8Array {
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const bits = [0x03, ...derLength(pkcs1.length + 1), 0x00, ...pkcs1];
  return new Uint8Array([0x30, ...derLength(algId.length + bits.length), ...algId, ...bits]);
}

export type KeyInput = { type: 'spki'; der: Uint8Array } | { type: 'jwk'; jwk: JsonWebKey } | { type: 'jwks'; keys: JsonWebKey[] };

/** A pasted key: PEM (a public key, PKCS#1 or a certificate), a JWK, a JWK set, or bare Base64 DER. */
export function readKey(text: string): KeyInput | { problem: KeyProblem } {
  const t = text.trim();
  if (!t) return { problem: 'empty' };
  if (t.startsWith('{')) {
    let value: unknown;
    try {
      value = JSON.parse(t);
    } catch {
      return { problem: 'jwk' };
    }
    if (typeof value !== 'object' || value === null) return { problem: 'jwk' };
    if (Array.isArray((value as { keys?: unknown }).keys)) {
      const keys = (value as { keys: JsonWebKey[] }).keys.filter((k) => typeof k === 'object' && k !== null);
      return keys.length ? { type: 'jwks', keys } : { problem: 'noKeys' };
    }
    if (typeof (value as JsonWebKey).kty !== 'string') return { problem: 'jwk' };
    return { type: 'jwk', jwk: value as JsonWebKey };
  }
  const pem = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(t);
  const label = pem ? pem[1] : null;
  if (label && /PRIVATE KEY/.test(label)) return { problem: 'private' };
  const body = (pem ? pem[2] : t).replace(/^[A-Za-z-]+:.*$/gm, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(body)) return { problem: 'pem' };
  let der: Uint8Array;
  try {
    der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    if (label === 'CERTIFICATE') der = certKey(der);
    else if (label === 'RSA PUBLIC KEY') der = pkcs1ToSpki(der);
    else if (label && label !== 'PUBLIC KEY') return { problem: 'pem' };
    spkiKind(der);
  } catch {
    return { problem: 'pem' };
  }
  return { type: 'spki', der };
}

const isPrivate = (k: JsonWebKey) => 'd' in k;

/** A JWK's public members only: the rest (use, key_ops, alg) could make WebCrypto refuse it. */
function publicJwk(k: JsonWebKey): JsonWebKey {
  if (k.kty === 'RSA') return { kty: 'RSA', n: k.n, e: k.e };
  if (k.kty === 'EC') return { kty: 'EC', crv: k.crv, x: k.x, y: k.y };
  if (k.kty === 'OKP') return { kty: 'OKP', crv: k.crv, x: k.x };
  return { kty: k.kty };
}

const KTY: Record<Family, string> = { HS: 'oct', RS: 'RSA', PS: 'RSA', ES: 'EC', Ed: 'OKP' };

/** The key of a set the token means: by its kid, or the only one that fits. */
export function pickKey(keys: JsonWebKey[], kid: string | null, family: Family): JsonWebKey | { problem: KeyProblem; n: number; kid?: string } {
  if (kid !== null) {
    const found = keys.find((k) => (k as { kid?: string }).kid === kid);
    return found ?? { problem: 'kidMissing', n: keys.length, kid };
  }
  const fitting = keys.filter((k) => k.kty === KTY[family]);
  if (fitting.length === 1) return fitting[0];
  return { problem: fitting.length ? 'kidNeeded' : 'noKeys', n: keys.length };
}

const TEST_ED25519 = new Uint8Array([
  0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7, 0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64, 0x07, 0x3a, 0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25, 0xaf, 0x02,
  0x1a, 0x68, 0xf7, 0x07, 0x51, 0x1a,
]);

/** Whether this browser's WebCrypto checks Ed25519 (Chrome 137, Safari 17, Firefox 129). */
export async function hasEd25519(): Promise<boolean> {
  try {
    await crypto.subtle.importKey('raw', TEST_ED25519, { name: 'Ed25519' }, false, ['verify']);
    return true;
  } catch {
    return false;
  }
}

const SIG_BYTES: Record<Curve, number> = { 'P-256': 64, 'P-384': 96, 'P-521': 132 };

function importParams(a: Alg): RsaHashedImportParams | EcKeyImportParams | Algorithm {
  if (a.family === 'RS') return { name: 'RSASSA-PKCS1-v1_5', hash: a.hash };
  if (a.family === 'PS') return { name: 'RSA-PSS', hash: a.hash };
  if (a.family === 'ES') return { name: 'ECDSA', namedCurve: a.curve! };
  return { name: 'Ed25519' };
}

function verifyParams(a: Alg): Algorithm | RsaPssParams | EcdsaParams {
  if (a.family === 'RS') return { name: 'RSASSA-PKCS1-v1_5' };
  // JWT's PS algorithms salt with as many bytes as the hash has.
  if (a.family === 'PS') return { name: 'RSA-PSS', saltLength: Number(a.hash.slice(4)) / 8 };
  if (a.family === 'ES') return { name: 'ECDSA', hash: a.hash };
  return { name: 'Ed25519' };
}

/** Whether a key of this kind can check this algorithm, and why not. */
function fits(kind: KeyKind, a: Alg): Verdict | null {
  if (a.family === 'RS' || a.family === 'PS') {
    if (kind.kind === 'pss') return { ok: false, problem: 'pssKey' };
    return kind.kind === 'rsa' ? null : { ok: false, problem: 'rsaWanted' };
  }
  if (a.family === 'ES') {
    if (kind.kind !== 'ec') return { ok: false, problem: 'ecWanted', want: a.curve };
    return kind.curve === a.curve ? null : { ok: false, problem: 'curve', curve: kind.curve ?? '?', want: a.curve };
  }
  if (kind.kind === 'ed448') return { ok: false, problem: 'ed448' };
  return kind.kind === 'ed25519' ? null : { ok: false, problem: 'edWanted' };
}

function jwkKind(k: JsonWebKey): KeyKind {
  if (k.kty === 'RSA') return { kind: 'rsa' };
  if (k.kty === 'EC') return { kind: 'ec', curve: (['P-256', 'P-384', 'P-521'] as Curve[]).find((c) => c === k.crv) ?? null };
  if (k.kty === 'OKP') return { kind: k.crv === 'Ed25519' ? 'ed25519' : k.crv === 'Ed448' ? 'ed448' : 'other' };
  return { kind: 'other' };
}

/** A secret as typed (UTF-8), as Base64 (either alphabet), or as a JWK of kty "oct". */
export function secretBytes(secret: string, base64: boolean): Uint8Array | null {
  const t = secret.trim();
  if (t.startsWith('{')) {
    try {
      const k = JSON.parse(t) as JsonWebKey;
      if (k.kty === 'oct' && typeof k.k === 'string') {
        const b = fromBase64Url(k.k, 'signature');
        return isError(b) ? null : b;
      }
    } catch {}
  }
  if (!base64) return new TextEncoder().encode(secret);
  const b = fromBase64Url(t.replace(/\s+/g, ''), 'signature');
  return isError(b) ? null : b;
}

/**
 * The signature checked: `secret` for HS (text, or Base64 with `base64`), `key` for the rest.
 * Only WebCrypto does the work; nothing is kept.
 */
export async function verify(token: Pick<Decoded, 'signingInput' | 'signature' | 'header' | 'alg'>, input: { secret?: string; base64?: boolean; key?: string }): Promise<Verdict> {
  const a = algOf(token.alg);
  if (!a) return { ok: false, problem: token.alg === 'Ed448' ? 'ed448' : 'alg' };
  const data = new TextEncoder().encode(token.signingInput);
  const sig = token.signature;
  try {
    if (a.family === 'HS') {
      if (!input.secret) return { ok: false, problem: 'empty' };
      const bytes = secretBytes(input.secret, !!input.base64);
      if (!bytes) return { ok: false, problem: 'secretBase64' };
      if (!bytes.length) return { ok: false, problem: 'empty' };
      const key = await crypto.subtle.importKey('raw', bytes as BufferSource, { name: 'HMAC', hash: a.hash }, false, ['verify']);
      return { ok: true, valid: await crypto.subtle.verify('HMAC', key, sig as BufferSource, data) };
    }
    if (a.family === 'Ed' && !(await hasEd25519())) return { ok: false, problem: 'noEd' };
    const read = readKey(input.key ?? '');
    if ('problem' in read) return { ok: false, problem: read.problem };
    let key: CryptoKey;
    if (read.type === 'spki') {
      const wrong = fits(spkiKind(read.der), a);
      if (wrong) return wrong;
      key = await crypto.subtle.importKey('spki', read.der as BufferSource, importParams(a), false, ['verify']);
    } else {
      let jwk: JsonWebKey;
      if (read.type === 'jwks') {
        const kid = typeof token.header.kid === 'string' ? token.header.kid : null;
        const picked = pickKey(read.keys, kid, a.family);
        if ('problem' in picked) return { ok: false, problem: picked.problem, n: picked.n, kid: picked.kid };
        jwk = picked;
      } else jwk = read.jwk;
      if (isPrivate(jwk)) return { ok: false, problem: 'private' };
      if (jwk.kty === 'oct') return { ok: false, problem: 'octWanted' };
      const wrong = fits(jwkKind(jwk), a);
      if (wrong) return wrong;
      key = await crypto.subtle.importKey('jwk', publicJwk(jwk), importParams(a), false, ['verify']);
    }
    if (a.family === 'ES' && sig.length !== SIG_BYTES[a.curve!]) return { ok: true, valid: false, sigLength: { got: sig.length, want: SIG_BYTES[a.curve!] } };
    return { ok: true, valid: await crypto.subtle.verify(verifyParams(a), key, sig as BufferSource, data) };
  } catch (e) {
    return { ok: false, problem: 'import', detail: e instanceof Error ? e.message : String(e) };
  }
}
