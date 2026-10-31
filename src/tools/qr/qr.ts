// What Make a QR code writes and reads. Plain TypeScript with erasable types, tested in node (a code
// made here is read back with jsQR in the tests).
//
// Making: the payloads phones understand (a link; guest Wi-Fi as `WIFI:T:WPA;S:…;P:…;H:true;;`, the
// format both iOS's and Android's cameras join from; a contact as a vCard 3.0), encoded by uqr with a
// quiet zone of four modules, drawn as one SVG path and as crisp pixels.
// Reading: what a scanned code says, sorted into a link, a Wi-Fi network, a contact or plain text.
// Nothing is ever opened: the tool shows it and offers Copy.

import { encode } from 'uqr';

export type Ecc = 'L' | 'M' | 'Q' | 'H';
export type Auth = 'WPA' | 'WEP' | 'nopass';

/** The quiet zone the standard asks for, in modules. */
export const QUIET = 4;

// ── Making ──────────────────────────────────────────────────────────────────────────────────

/** A link as typed: "example.com" gets its https://; a scheme someone wrote stays. */
export function link(input: string): string {
  const t = input.trim();
  if (!t) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return `https://${t}`;
}

/** Whether a link looks like one (a scheme and something after it, or a host with a dot). */
export function looksLikeLink(input: string): boolean {
  const t = input.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^(https?|mailto|tel|sms|geo):\S+/i.test(t)) return true;
  return /^[^\s/:]+\.[a-z]{2,}(?:[/:?#]\S*)?$/i.test(t);
}

/** Wi-Fi fields escape \ ; , : and " with a backslash. */
export const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

export interface Wifi {
  ssid: string;
  password: string;
  auth: Auth;
  hidden: boolean;
}

export function wifi({ ssid, password, auth, hidden }: Wifi): string {
  let out = `WIFI:T:${auth};S:${wifiEscape(ssid)};`;
  if (auth !== 'nopass') out += `P:${wifiEscape(password)};`;
  if (hidden) out += 'H:true;';
  return `${out};`;
}

/** vCard text values (RFC 2426) escape \ , ; and line breaks; a colon needs nothing. */
export const vEscape = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/([,;])/g, '\\$1')
    .replace(/\r\n|\r|\n/g, '\\n');

export interface Contact {
  first: string;
  last: string;
  phone: string;
  email: string;
  org: string;
}

/** A vCard 3.0 with what was filled in; lines end in CRLF as the format asks. */
export function vcard({ first, last, phone, email, org }: Contact): string {
  const f = first.trim();
  const l = last.trim();
  const full = [f, l].filter(Boolean).join(' ') || org.trim();
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEscape(l)};${vEscape(f)};;;`, `FN:${vEscape(full)}`];
  if (org.trim()) lines.push(`ORG:${vEscape(org.trim())}`);
  if (phone.trim()) lines.push(`TEL;TYPE=CELL:${vEscape(phone.trim())}`);
  if (email.trim()) lines.push(`EMAIL:${vEscape(email.trim())}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/** A string without lone surrogates (uqr's UTF-8 step would throw on one). */
const wellFormed = (s: string) => s.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '�');

export interface Matrix {
  /** Modules per side, the quiet zone included. */
  size: number;
  /** true is dark. */
  modules: boolean[][];
  version: number;
}

export class TooLong extends Error {}

/** The code's modules with a four-module quiet zone; throws TooLong past what a QR code holds. */
export function matrix(text: string, ecc: Ecc): Matrix {
  try {
    const r = encode(wellFormed(text), { ecc, border: QUIET });
    return { size: r.size, modules: r.data, version: r.version };
  } catch (error) {
    throw new TooLong(String(error));
  }
}

/** The dark modules as one path, a row's run of modules per rectangle. */
export function svgPath(m: Matrix): string {
  const d: string[] = [];
  m.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (!row[x]) {
        x++;
        continue;
      }
      let run = 1;
      while (row[x + run]) run++;
      d.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  return d.join('');
}

/** A standalone SVG file: black on white, the quiet zone white, `px` wide when printed or opened. */
export function svgFile(m: Matrix, px = 1024): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.size} ${m.size}" width="${px}" height="${px}" shape-rendering="crispEdges">`,
    `<rect width="${m.size}" height="${m.size}" fill="#ffffff"/>`,
    `<path d="${svgPath(m)}" fill="#000000"/>`,
    '</svg>',
    '',
  ].join('\n');
}

/** Pixels per module for a PNG about `target` pixels wide: whole pixels, so every edge is sharp. */
export const scaleFor = (size: number, target = 1000) => Math.max(4, Math.ceil(target / size));

/** The code as RGBA pixels, `scale` per module: what the PNG is made from (and what jsQR reads). */
export function pixels(m: Matrix, scale: number): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const width = m.size * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = ((y * scale + dy) * width + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++) {
          const i = row + dx * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width, height: width };
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────

export type Scanned =
  | { kind: 'link'; url: string }
  | ({ kind: 'wifi' } & Wifi)
  | { kind: 'contact'; fields: { key: 'name' | 'org' | 'phone' | 'email' | 'url' | 'address' | 'title' | 'note'; value: string }[] }
  | { kind: 'text'; text: string };

/** `KEY:value;` pairs with backslash escapes, as in WIFI: and MECARD: codes. */
function pairs(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let key = '';
  let value = '';
  let inKey = true;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) {
      if (inKey) key += body[++i];
      else value += body[++i];
    } else if (inKey && ch === ':') inKey = false;
    else if (!inKey && ch === ';') {
      if (key) out.set(key.toUpperCase(), value);
      key = '';
      value = '';
      inKey = true;
    } else if (inKey) key += ch;
    else value += ch;
  }
  if (key && !inKey) out.set(key.toUpperCase(), value);
  return out;
}

export function parseWifi(text: string): Wifi | null {
  if (!/^WIFI:/i.test(text)) return null;
  const p = pairs(text.slice(5));
  if (!p.has('S')) return null;
  const t = (p.get('T') ?? '').toUpperCase();
  const auth: Auth = t === 'WEP' ? 'WEP' : t === '' || t === 'NOPASS' ? (p.get('P') ? 'WPA' : 'nopass') : 'WPA';
  // A quoted value ("…") is a hex-looking one written as text; the quotes aren't part of it.
  const unquote = (s: string) => (/^".*"$/.test(s) ? s.slice(1, -1) : s);
  return { ssid: unquote(p.get('S') ?? ''), password: unquote(p.get('P') ?? ''), auth, hidden: /^true$/i.test(p.get('H') ?? '') };
}

const vUnescape = (s: string) => s.replace(/\\([\\,;nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** A vCard's or MECARD's fields worth showing, in a fixed order. */
export function parseContact(text: string): Extract<Scanned, { kind: 'contact' }>['fields'] | null {
  const fields: Extract<Scanned, { kind: 'contact' }>['fields'] = [];
  if (/^BEGIN:VCARD/i.test(text)) {
    // Unfold continuation lines, then read NAME;PARAMS:value.
    const lines = text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    let name = '';
    let structured = '';
    for (const line of lines) {
      const m = line.match(/^([A-Za-z-]+)(?:;[^:]*)?:(.*)$/);
      if (!m) continue;
      const key = m[1].toUpperCase();
      const value = m[2];
      if (key === 'FN') name = vUnescape(value);
      else if (key === 'N') structured = value;
      else if (key === 'ORG') fields.push({ key: 'org', value: vUnescape(value.replace(/(?<!\\);/g, ', ')) });
      else if (key === 'TITLE') fields.push({ key: 'title', value: vUnescape(value) });
      else if (key === 'TEL') fields.push({ key: 'phone', value: vUnescape(value) });
      else if (key === 'EMAIL') fields.push({ key: 'email', value: vUnescape(value) });
      else if (key === 'URL') fields.push({ key: 'url', value: vUnescape(value) });
      else if (key === 'ADR') fields.push({ key: 'address', value: vUnescape(value.split(/(?<!\\);/).filter(Boolean).join(', ')) });
      else if (key === 'NOTE') fields.push({ key: 'note', value: vUnescape(value) });
    }
    if (!name && structured) {
      const [last = '', first = ''] = structured.split(/(?<!\\);/).map(vUnescape);
      name = [first, last].filter(Boolean).join(' ');
    }
    if (name) fields.unshift({ key: 'name', value: name });
    return fields;
  }
  if (/^MECARD:/i.test(text)) {
    const p = pairs(text.slice(7));
    const n = p.get('N');
    if (n) fields.push({ key: 'name', value: n.split(',').reverse().join(' ').trim() });
    const map: [string, Extract<Scanned, { kind: 'contact' }>['fields'][number]['key']][] = [
      ['ORG', 'org'],
      ['TEL', 'phone'],
      ['EMAIL', 'email'],
      ['URL', 'url'],
      ['ADR', 'address'],
      ['NOTE', 'note'],
    ];
    for (const [k, key] of map) if (p.get(k)) fields.push({ key, value: p.get(k)! });
    return fields;
  }
  return null;
}

/** What a scanned code holds. */
export function parseScanned(text: string): Scanned {
  const t = text.trim();
  const net = parseWifi(t);
  if (net) return { kind: 'wifi', ...net };
  const contact = parseContact(t);
  if (contact) return { kind: 'contact', fields: contact };
  if (/^https?:\/\/\S+$/i.test(t)) return { kind: 'link', url: t };
  return { kind: 'text', text };
}

/** What jsQR found, as text: its UTF-8 reading, or the bytes as UTF-8 (or Latin-1) when it had none. */
export function scannedText(code: { data: string; binaryData: number[] }): string {
  if (code.data) return code.data;
  const bytes = new Uint8Array(code.binaryData);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
