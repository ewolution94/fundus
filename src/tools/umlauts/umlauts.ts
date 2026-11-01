// What Fix umlauts does. Plain TypeScript with erasable types, no DOM, tested in node.
//
// Repair undoes the usual accident: UTF-8 bytes read as Windows-1252 (or Latin-1), so "ü" (C3 BC)
// shows as "Ã¼" and „ (E2 80 9E) as "â€ž". Each character that Windows-1252 can write is turned
// back into its byte; wherever those bytes make a valid UTF-8 sequence (strict: no overlong forms,
// no surrogates), the sequence becomes the one character it stood for. Everything else stays as it
// is, so a text that mixes right and broken umlauts comes out right. A text broken twice is repaired
// twice: the passes repeat while they change something.
//
// Spell out writes umlauts and ß the way a form or a file name without them takes them (ä → ae,
// ß → ss), and drops other accents (é → e).

/** Windows-1252's characters in 0x80–0x9F, by byte. 0x81, 0x8D, 0x8F, 0x90 and 0x9D have none:
 *  a decoder gives the control character of the same number, which maps back to its byte below. */
const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';
const TO_BYTE = new Map<string, number>();
for (let i = 0; i < 32; i++) TO_BYTE.set(CP1252_HIGH[i], 0x80 + i);

/** The Windows-1252 byte for a character, or null when it has none. C1 controls (what a Latin-1
 *  reader makes of 0x80–0x9F) map to their own byte too. */
export function cp1252Byte(ch: string): number | null {
  const code = ch.codePointAt(0)!;
  if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) return code;
  if (code >= 0x80 && code <= 0x9f) return code;
  return TO_BYTE.get(ch) ?? null;
}

/** Text as Windows-1252 bytes (what the old Windows encoding writes); null for a character it can't. */
export function encodeCp1252(text: string): Uint8Array | null {
  const out: number[] = [];
  for (const ch of text) {
    const b = cp1252Byte(ch);
    if (b === null) return null;
    out.push(b);
  }
  return Uint8Array.from(out);
}

/** How long a UTF-8 sequence starting with this byte is, and the range its second byte must be in
 *  (strict UTF-8: no overlong forms, no surrogates, nothing past U+10FFFF). */
function sequence(lead: number): { n: number; lo: number; hi: number } | null {
  if (lead >= 0xc2 && lead <= 0xdf) return { n: 2, lo: 0x80, hi: 0xbf };
  if (lead === 0xe0) return { n: 3, lo: 0xa0, hi: 0xbf };
  if (lead === 0xed) return { n: 3, lo: 0x80, hi: 0x9f };
  if (lead >= 0xe1 && lead <= 0xef) return { n: 3, lo: 0x80, hi: 0xbf };
  if (lead === 0xf0) return { n: 4, lo: 0x90, hi: 0xbf };
  if (lead >= 0xf1 && lead <= 0xf3) return { n: 4, lo: 0x80, hi: 0xbf };
  if (lead === 0xf4) return { n: 4, lo: 0x80, hi: 0x8f };
  return null;
}

/**
 * Characters a repair never makes, because they come out of right German or English text far more
 * often than out of broken text: "Spaß“" is ß (DF) and “ (93), which decode as an NKo letter. Ö, Ü
 * and ß followed by a quote or a dash would turn into Hebrew points, Syriac and NKo, and anything
 * into a control character.
 */
function unlikely(code: number): boolean {
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  if (code >= 0x0580 && code <= 0x05bf) return true;
  if (code >= 0x0700 && code <= 0x074f) return true;
  if (code >= 0x07c0 && code <= 0x07ff) return true;
  return false;
}

/** A piece of the result: as it was, or repaired (to mark it). */
export interface Piece {
  text: string;
  fixed: boolean;
}

const decoder = new TextDecoder('utf-8', { fatal: true });

/** Characters, each with whether it came out of a repair. */
interface Marked {
  chars: string[];
  fixed: Uint8Array;
}

/** One pass: each run of Windows-1252 bytes that is valid UTF-8 becomes the character it stands for. */
function pass({ chars, fixed }: Marked): Marked & { changed: boolean } {
  const out: string[] = [];
  const marks: number[] = [];
  let changed = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    // Every sequence starts with Â–ô (C2–F4); anything else stays as it is.
    if (ch >= 'Â' && ch <= 'ô') {
      const lead = cp1252Byte(ch)!;
      const seq = sequence(lead);
      if (seq && i + seq.n <= chars.length) {
        const bytes = [lead];
        for (let k = 1; k < seq.n; k++) {
          const b = cp1252Byte(chars[i + k]);
          const [lo, hi] = k === 1 ? [seq.lo, seq.hi] : [0x80, 0xbf];
          if (b === null || b < lo || b > hi) break;
          bytes.push(b);
        }
        if (bytes.length === seq.n) {
          let decoded = '';
          try {
            decoded = decoder.decode(Uint8Array.from(bytes));
          } catch {}
          if (decoded && !unlikely(decoded.codePointAt(0)!)) {
            out.push(decoded);
            marks.push(1);
            i += seq.n - 1;
            changed = true;
            continue;
          }
        }
      }
      // "Â" before a plain space: a no-break space (C2 A0) whose second half became a space on the way.
      if (ch === 'Â' && chars[i + 1] === ' ') {
        out.push('\u00a0');
        marks.push(1);
        i++;
        changed = true;
        continue;
      }
      // "Ã" alone before a space: French "à" (C3 A0) the same way; no word is a lone Ã. Its second
      // half is the first of two spaces, or was folded into the one there is.
      if (ch === 'Ã' && chars[i + 1] === ' ' && (i === 0 || /\s/.test(chars[i - 1]))) {
        out.push('à');
        marks.push(1);
        if (/\s/.test(chars[i + 2] ?? '')) i++;
        changed = true;
        continue;
      }
    }
    out.push(ch);
    marks.push(fixed[i]);
  }
  return { chars: out, fixed: Uint8Array.from(marks), changed };
}

/** Runs of characters, marked or not, for showing. */
function piecesOf({ chars, fixed }: Marked): Piece[] {
  const out: Piece[] = [];
  let start = 0;
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || fixed[i] !== fixed[start]) {
      out.push({ text: chars.slice(start, i).join(''), fixed: fixed[start] === 1 });
      start = i;
    }
  }
  return out;
}

export interface Repaired {
  text: string;
  pieces: Piece[];
  /** Characters that came out repaired. */
  fixed: number;
  /** How many passes changed something (2 for text broken twice). */
  passes: number;
}

/** Repairs UTF-8 read as Windows-1252, as often as it was broken (up to five times). */
export function repair(input: string): Repaired {
  let state: Marked = { chars: Array.from(input), fixed: new Uint8Array(0) };
  state.fixed = new Uint8Array(state.chars.length);
  let passes = 0;
  if (/[Â-ô]/.test(input)) {
    for (let i = 0; i < 5; i++) {
      const r = pass(state);
      if (!r.changed) break;
      state = r;
      passes++;
    }
  }
  if (!passes) return { text: input, pieces: input ? [{ text: input, fixed: false }] : [], fixed: 0, passes: 0 };
  let fixed = 0;
  for (const f of state.fixed) fixed += f;
  return { text: state.chars.join(''), pieces: piecesOf(state), fixed, passes };
}

// ── Reading a file ─────────────────────────────────────────────────────────────────────

export type Encoding = 'utf-8' | 'utf-16' | 'windows-1252';

/** A text file's words, and the encoding they were read in: UTF-8 when the bytes are valid UTF-8,
 *  UTF-16 with its mark, else Windows-1252 (the old Windows encoding, which reads any byte). */
export function decodeFile(bytes: Uint8Array): { text: string; encoding: Encoding } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16' };
  try {
    // The mark at the start (EF BB BF) is dropped by the decoder.
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

// ── Spell out ──────────────────────────────────────────────────────────────────────────

/** Letters that have no accent to drop but a usual spelling in plain letters. */
const PLAIN: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ẞ: 'SS',
  æ: 'ae', Æ: 'Ae', œ: 'oe', Œ: 'Oe', ø: 'o', Ø: 'O', å: 'a', Å: 'A',
  ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ð: 'd', Ð: 'D', þ: 'th', Þ: 'Th', ı: 'i', ħ: 'h', Ħ: 'H',
};

const isUpper = (ch: string | undefined) => !!ch && /\p{Lu}/u.test(ch);
const isLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch);

export interface SpeltOut {
  text: string;
  pieces: Piece[];
  /** Letters spelled out or without their accent now. */
  changed: number;
}

/** Characters file systems (Windows' above all) refuse, or that make trouble in a name. */
const UNSAFE = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;

/**
 * ä → ae, ß → ss, Ä → Ae (AE inside a word in capitals: "ÄRGER" → "AERGER"), ẞ → SS, é → e.
 * `safe` makes a file name of each line: spaces become hyphens, and what file systems don't take
 * goes, along with anything still outside plain ASCII.
 */
export function spellOut(input: string, safe = false): SpeltOut {
  const chars = [...input.normalize('NFC')];
  const out: Piece[] = [];
  const push = (text: string, fixed: boolean) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.fixed === fixed) last.text += text;
    else out.push({ text, fixed });
  };
  let changed = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    let to: string;
    if (PLAIN[ch]) {
      to = PLAIN[ch];
      // A capital in a word written in capitals: both letters capital.
      if (to.length > 1 && isUpper(ch)) {
        const next = chars[i + 1];
        const prev = chars[i - 1];
        if (isUpper(next) || (!isLetter(next) && isUpper(prev))) to = to.toUpperCase();
      }
      // ß in a word in capitals ("STRAßE") is SS too.
      if (ch === 'ß' && isUpper(chars[i - 1]) && (isUpper(chars[i + 1]) || !isLetter(chars[i + 1]))) to = 'SS';
    } else {
      // Other accents: the letter without its marks (é → e, ñ → n, ç → c).
      to = ch.normalize('NFD').replace(/\p{M}/gu, '');
      if (!to) to = ch;
    }
    if (safe) {
      if (/[ \t\u00a0\u2000-\u200a\u202f]/.test(to)) to = '-';
      else if (to !== '\n' && to !== '\r') to = to.replace(UNSAFE, '').replace(/[^\x20-\x7e]/g, '');
    }
    const marked = to !== ch && to !== '-' && to !== '';
    if (marked) changed++;
    push(to, marked);
  }
  let pieces = out;
  if (safe) pieces = tidyNames(out);
  return { text: pieces.map((p) => p.text).join(''), pieces, changed };
}

/** Per line: no runs of hyphens, nothing but letters and digits at either end. */
function tidyNames(pieces: Piece[]): Piece[] {
  // Work on the joined text with a mask of marked characters, then cut back into pieces.
  const chars: { ch: string; fixed: boolean }[] = [];
  for (const p of pieces) for (const ch of p.text) chars.push({ ch, fixed: p.fixed });
  const lines: (typeof chars)[] = [[]];
  for (const c of chars) {
    if (c.ch === '\n') lines.push([]);
    else if (c.ch !== '\r') lines[lines.length - 1].push(c);
  }
  const tidy = lines.map((line) => {
    const kept: typeof chars = [];
    for (const c of line) {
      if (c.ch === '-' && kept[kept.length - 1]?.ch === '-') continue;
      kept.push(c);
    }
    while (kept.length && /[-. ]/.test(kept[0].ch)) kept.shift();
    while (kept.length && /[-. ]/.test(kept[kept.length - 1].ch)) kept.pop();
    return kept;
  });
  const out: Piece[] = [];
  tidy.forEach((line, i) => {
    const all = i ? [{ ch: '\n', fixed: false }, ...line] : line;
    for (const c of all) {
      const last = out[out.length - 1];
      if (last && last.fixed === c.fixed) last.text += c.ch;
      else out.push({ text: c.ch, fixed: c.fixed });
    }
  });
  return out;
}
