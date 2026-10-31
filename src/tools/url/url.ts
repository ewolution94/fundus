// Encode URLs: percent-encoding both ways, the way JavaScript does it (encodeURIComponent for one
// part, encodeURI for a whole link), with the place of any mistake; and a URL taken apart, its
// query decoded the way a form sends it. Plain TypeScript with erasable types. Nothing here ever
// opens a URL: `new URL()` only reads the text.

export type UrlError =
  /** A % without two hex digits after it. */
  | { code: 'percent'; index: number; found: string }
  /** Escapes that don't make UTF-8 (%E4 alone, %C3%28). */
  | { code: 'utf8'; index: number; found: string }
  /** Half of an emoji's pair (a lone surrogate): it has no UTF-8. */
  | { code: 'surrogate'; index: number };

export type Coded = { ok: true; text: string } | { ok: false; error: UrlError };

/** `whole`: encodeURI, which keeps / ? # & = so the link still works; else encodeURIComponent. */
export function encodeUrl(text: string, whole: boolean): Coded {
  try {
    return { ok: true, text: whole ? encodeURI(text) : encodeURIComponent(text) };
  } catch {
    return { ok: false, error: { code: 'surrogate', index: loneSurrogate(text) } };
  }
}

/** `plus`: a + is a space, as forms send it (application/x-www-form-urlencoded). */
export function decodeUrl(text: string, whole: boolean, plus: boolean): Coded {
  // One character for one: the indexes of a mistake stay those of the text as typed.
  const t = plus ? text.replace(/\+/g, ' ') : text;
  try {
    return { ok: true, text: whole ? decodeURI(t) : decodeURIComponent(t) };
  } catch {
    return { ok: false, error: badEscape(text) };
  }
}

function loneSurrogate(text: string): number {
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(k + 1);
      if (next >= 0xdc00 && next <= 0xdfff) k++;
      else return k;
    } else if (c >= 0xdc00 && c <= 0xdfff) return k;
  }
  return -1;
}

const HEX2 = /^[0-9a-fA-F]{2}$/;

/** The first escape that decodeURIComponent refuses, and where. */
export function badEscape(text: string): UrlError {
  for (let i = 0; i < text.length; ) {
    if (text[i] !== '%') {
      i++;
      continue;
    }
    if (!HEX2.test(text.slice(i + 1, i + 3))) return { code: 'percent', index: i, found: text.slice(i, i + 3) };
    // A run of escapes: the bytes must be UTF-8, sequence by sequence.
    const bytes: number[] = [];
    const at: number[] = [];
    while (text[i] === '%' && HEX2.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      at.push(i);
      i += 3;
    }
    for (let k = 0; k < bytes.length; ) {
      const b = bytes[k];
      const need = b < 0x80 ? 0 : b >= 0xc2 && b <= 0xdf ? 1 : b >= 0xe0 && b <= 0xef ? 2 : b >= 0xf0 && b <= 0xf4 ? 3 : -1;
      const bad = (len: number): UrlError => ({ code: 'utf8', index: at[k], found: text.slice(at[k], at[Math.min(k + len, at.length) - 1] + 3) });
      if (need === -1) return bad(1);
      // The second byte's narrower ranges: no overlong forms, no surrogates, nothing past U+10FFFF.
      const lo = b === 0xe0 ? 0xa0 : b === 0xf0 ? 0x90 : 0x80;
      const hi = b === 0xed ? 0x9f : b === 0xf4 ? 0x8f : 0xbf;
      for (let j = 1; j <= need; j++) {
        const c = bytes[k + j];
        if (c === undefined || c < (j === 1 ? lo : 0x80) || c > (j === 1 ? hi : 0xbf)) return bad(j + (c === undefined ? 0 : 1));
      }
      k += need + 1;
    }
  }
  return { code: 'percent', index: -1, found: '' };
}

/** One query parameter: decoded as a form sends it, and as written. */
export interface Param {
  key: string;
  value: string;
  rawKey: string;
  rawValue: string;
  /** "?flag" has no '=': its value is empty, and it says so. */
  bare: boolean;
}

export interface Parts {
  href: string;
  /** No scheme was typed: read as https://. */
  assumed: boolean;
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  /** The host in its own letters, when it's punycode (xn--bcher-kva.de → bücher.de). */
  hostUnicode: string | null;
  port: string;
  /** The scheme's port when none is written (443 for https). */
  defaultPort: string | null;
  path: string;
  pathDecoded: string;
  query: string;
  params: Param[];
  hash: string;
  hashDecoded: string;
  origin: string;
}

export type Read = { ok: true; parts: Parts } | { ok: false; code: 'empty' | 'invalid' };

const DEFAULT_PORTS: Record<string, string> = { 'http:': '80', 'https:': '443', 'ws:': '80', 'wss:': '443', 'ftp:': '21' };
/** Schemes written without //, which `new URL` reads as they are. */
const OPAQUE = /^(mailto|tel|sms|data|urn|javascript|about|blob|file|news|magnet|geo|bitcoin|spotify|slack|facetime|maps):/i;

const safe = (fn: (s: string) => string, s: string) => {
  try {
    return fn(s);
  } catch {
    return s;
  }
};

/** A URL in its parts. "example.com/a?b=c" is read as https://example.com/a?b=c, and says so. */
export function readUrl(input: string): Read {
  const text = input.trim();
  if (!text) return { ok: false, code: 'empty' };
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(text) || OPAQUE.test(text);
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return { ok: false, code: 'invalid' };
  }
  // Chromium lets a space or a % into a host (as %20) where the URL standard, and Safari, refuse it.
  if (url.hostname && !url.hostname.startsWith('[') && /[\s%<>^|"`{}\\]/.test(url.hostname)) return { ok: false, code: 'invalid' };
  // The same split URLSearchParams makes (on &, empty pieces skipped), kept as written.
  const raw = url.search.slice(1).split('&').filter(Boolean);
  const params = [...url.searchParams].map(([key, value], k): Param => {
    const piece = raw[k] ?? '';
    const eq = piece.indexOf('=');
    return { key, value, rawKey: eq === -1 ? piece : piece.slice(0, eq), rawValue: eq === -1 ? '' : piece.slice(eq + 1), bare: eq === -1 };
  });
  const hostname = url.hostname;
  const unicode = hostname.split('.').some((l) => l.toLowerCase().startsWith('xn--')) ? toUnicode(hostname) : null;
  return {
    ok: true,
    parts: {
      href: url.href,
      assumed: !hasScheme,
      protocol: url.protocol,
      username: safe(decodeURIComponent, url.username),
      password: safe(decodeURIComponent, url.password),
      hostname,
      hostUnicode: unicode && unicode !== hostname ? unicode : null,
      port: url.port,
      defaultPort: url.port ? null : (DEFAULT_PORTS[url.protocol] ?? null),
      path: url.pathname,
      pathDecoded: safe(decodeURI, url.pathname),
      query: url.search,
      params,
      hash: url.hash,
      hashDecoded: safe(decodeURIComponent, url.hash.slice(1)),
      origin: url.origin === 'null' ? '' : url.origin,
    },
  };
}

// Punycode (RFC 3492), decoding only: enough to show a host in its own letters.
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : delta >> 1;
  d += Math.floor(d / points);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

const digit = (c: number) => (c >= 0x30 && c <= 0x39 ? c - 22 : c >= 0x41 && c <= 0x5a ? c - 0x41 : c >= 0x61 && c <= 0x7a ? c - 0x61 : BASE);

/** One label without its xn-- (bcher-kva → bücher); null when it isn't valid punycode. */
export function punycodeDecode(input: string): string | null {
  const output: number[] = [];
  const basic = Math.max(0, input.lastIndexOf('-'));
  for (let j = 0; j < basic; j++) {
    if (input.charCodeAt(j) >= 0x80) return null;
    output.push(input.charCodeAt(j));
  }
  let i = 0;
  let n = 128;
  let bias = 72;
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length; ) {
    const old = i;
    let weight = 1;
    for (let k = BASE; ; k += BASE) {
      if (index >= input.length) return null;
      const d = digit(input.charCodeAt(index++));
      if (d >= BASE) return null;
      i += d * weight;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (d < t) break;
      weight *= BASE - t;
      if (weight > 0x7fffffff) return null;
    }
    const count = output.length + 1;
    bias = adapt(i - old, count, old === 0);
    n += Math.floor(i / count);
    i %= count;
    if (n > 0x10ffff) return null;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/** A host with its xn-- labels decoded. */
export function toUnicode(host: string): string {
  return host
    .split('.')
    .map((label) => (label.toLowerCase().startsWith('xn--') ? (punycodeDecode(label.slice(4)) ?? label) : label))
    .join('.');
}
