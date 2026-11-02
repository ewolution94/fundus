// What Invisible characters does. Plain TypeScript with erasable types, no DOM, tested in node.
//
// It finds what a text hides: zero-width characters, the byte-order mark, soft hyphens, spaces of
// odd widths, line and paragraph separators, direction marks and overrides, invisible operators,
// fillers, variation selectors, tag characters, control characters, marks piled on one letter, and
// look-alike letters (a Cyrillic or Greek letter in a Latin word: a Cyrillic U+0430 in "Paypal").
// The same characters as the home's `invisible` shape (src/lib/shapes.ts), plus controls and piled
// marks.
//
// Some of them are fine where they are, and are listed as such and kept: a no-break space (German
// uses it on purpose, "5 €"), the emoji selector and the zero-width joiner inside an emoji (a red
// heart, a family), the tags of a subdivision flag (Scotland's), a joiner between letters of a
// script that needs it (Persian, Hindi), a variation selector after a Chinese character.
//
// Clean removes what hides, turns odd spaces into plain ones (no-break spaces only when asked),
// separators into line breaks, and look-alike letters into their Latin twins.

export type Fix = 'remove' | 'space' | 'break' | 'twin' | 'keep';
/** Why a finding is fine where it is. */
export type Fine = 'nbsp' | 'emoji' | 'flag' | 'script' | 'han';
export type Script = 'Latin' | 'Cyrillic' | 'Greek';

export interface Kind {
  key: string;
  /** Unicode's short name (ZWSP, SHY), or the letter for a look-alike. */
  badge: string;
  en: string;
  de: string;
  /** U+200B, or a range. */
  code: string;
  count: number;
  /** Listed but not a problem, and kept: why. */
  fine: Fine | null;
  /** A look-alike letter: its script. */
  look: Script | null;
  fix: Fix;
  /** A look-alike's twin in the word's script. */
  to?: string;
  /** Tag characters: the text they spell. */
  spells?: string;
}

export interface Piece {
  /** Plain text, or the look-alike letter. */
  text: string;
  /** A finding: its kind, and how many in a row. */
  key?: string;
  n?: number;
}

export interface Scan {
  kinds: Kind[];
  /** The text with each finding in place, for showing. */
  pieces: Piece[];
  /** Characters that hide (look-alikes apart). */
  hidden: number;
  looks: number;
  /** Listed as fine. */
  fine: number;
  clean: string;
  /** More places than are marked: the rest of `pieces` is plain. */
  cut: boolean;
}

export interface Options {
  /** No-break spaces become plain spaces too (and count). */
  nbsp: boolean;
}

/** Marked places in the shown text at most; past it the text is shown plain (still counted). */
export const MAX_MARKED = 2000;

type One = [badge: string, en: string, de: string, fix: Fix];

const ONE: Record<number, One> = {
  0x00a0: ['NBSP', 'No-break space', 'Geschütztes Leerzeichen', 'space'],
  0x00ad: ['SHY', 'Soft hyphen', 'Weicher Trennstrich', 'remove'],
  0x034f: ['CGJ', 'Combining grapheme joiner', 'Graphem-Verbinder', 'remove'],
  0x061c: ['ALM', 'Arabic letter mark', 'Arabische Richtungsmarke', 'remove'],
  0x115f: ['HCF', 'Hangul choseong filler', 'Hangul-Füllzeichen (Anlaut)', 'remove'],
  0x1160: ['HJF', 'Hangul jungseong filler', 'Hangul-Füllzeichen (Inlaut)', 'remove'],
  0x17b4: ['KIV', 'Khmer inherent vowel', 'Khmer-Vokalträger', 'remove'],
  0x17b5: ['KIV', 'Khmer inherent vowel', 'Khmer-Vokalträger', 'remove'],
  0x180e: ['MVS', 'Mongolian vowel separator', 'Mongolischer Vokaltrenner', 'remove'],
  0x2000: ['NQSP', 'En quad', 'Halbgeviert-Quadrat', 'space'],
  0x2001: ['MQSP', 'Em quad', 'Geviert-Quadrat', 'space'],
  0x2002: ['ENSP', 'En space', 'Halbgeviert-Leerzeichen', 'space'],
  0x2003: ['EMSP', 'Em space', 'Geviert-Leerzeichen', 'space'],
  0x2004: ['3/MSP', 'Three-per-em space', 'Drittelgeviert-Leerzeichen', 'space'],
  0x2005: ['4/MSP', 'Four-per-em space', 'Viertelgeviert-Leerzeichen', 'space'],
  0x2006: ['6/MSP', 'Six-per-em space', 'Sechstelgeviert-Leerzeichen', 'space'],
  0x2007: ['FSP', 'Figure space', 'Ziffernleerzeichen', 'space'],
  0x2008: ['PSP', 'Punctuation space', 'Satzzeichen-Leerzeichen', 'space'],
  0x2009: ['THSP', 'Thin space', 'Schmales Leerzeichen', 'space'],
  0x200a: ['HSP', 'Hair space', 'Haarfeines Leerzeichen', 'space'],
  0x200b: ['ZWSP', 'Zero-width space', 'Nullbreites Leerzeichen', 'remove'],
  0x200c: ['ZWNJ', 'Zero-width non-joiner', 'Nullbreiter Nichtverbinder', 'remove'],
  0x200d: ['ZWJ', 'Zero-width joiner', 'Nullbreiter Verbinder', 'remove'],
  0x200e: ['LRM', 'Left-to-right mark', 'Links-nach-rechts-Marke', 'remove'],
  0x200f: ['RLM', 'Right-to-left mark', 'Rechts-nach-links-Marke', 'remove'],
  0x2028: ['LSEP', 'Line separator', 'Zeilentrenner', 'break'],
  0x2029: ['PSEP', 'Paragraph separator', 'Absatztrenner', 'break'],
  0x202a: ['LRE', 'Left-to-right embedding', 'Links-nach-rechts-Einbettung', 'remove'],
  0x202b: ['RLE', 'Right-to-left embedding', 'Rechts-nach-links-Einbettung', 'remove'],
  0x202c: ['PDF', 'Pop directional formatting', 'Ende der Richtungsformatierung', 'remove'],
  0x202d: ['LRO', 'Left-to-right override', 'Links-nach-rechts-Überschreibung', 'remove'],
  0x202e: ['RLO', 'Right-to-left override', 'Rechts-nach-links-Überschreibung', 'remove'],
  0x202f: ['NNBSP', 'Narrow no-break space', 'Schmales geschütztes Leerzeichen', 'space'],
  0x205f: ['MMSP', 'Medium mathematical space', 'Mittleres mathematisches Leerzeichen', 'space'],
  0x2060: ['WJ', 'Word joiner', 'Wortverbinder', 'remove'],
  0x2061: ['FA', 'Invisible function application', 'Unsichtbare Funktionsanwendung', 'remove'],
  0x2062: ['IT', 'Invisible times', 'Unsichtbares Mal', 'remove'],
  0x2063: ['IS', 'Invisible separator', 'Unsichtbares Trennzeichen', 'remove'],
  0x2064: ['IP', 'Invisible plus', 'Unsichtbares Plus', 'remove'],
  0x2066: ['LRI', 'Left-to-right isolate', 'Links-nach-rechts-Isolierung', 'remove'],
  0x2067: ['RLI', 'Right-to-left isolate', 'Rechts-nach-links-Isolierung', 'remove'],
  0x2068: ['FSI', 'First strong isolate', 'Isolierung nach dem ersten Zeichen', 'remove'],
  0x2069: ['PDI', 'Pop directional isolate', 'Ende der Isolierung', 'remove'],
  0x206a: ['ISS', 'Old format character', 'Veraltetes Formatzeichen', 'remove'],
  0x206b: ['ASS', 'Old format character', 'Veraltetes Formatzeichen', 'remove'],
  0x206c: ['IAFS', 'Old format character', 'Veraltetes Formatzeichen', 'remove'],
  0x206d: ['AAFS', 'Old format character', 'Veraltetes Formatzeichen', 'remove'],
  0x206e: ['NADS', 'Old format character', 'Veraltetes Formatzeichen', 'remove'],
  0x206f: ['NODS', 'Old format character', 'Veraltetes Formatzeichen', 'remove'],
  0x3000: ['IDSP', 'Ideographic space', 'Ideografisches Leerzeichen', 'space'],
  0x3164: ['HF', 'Hangul filler', 'Hangul-Füllzeichen', 'remove'],
  0xfeff: ['BOM', 'Byte-order mark', 'Byte-Order-Mark', 'remove'],
  0xffa0: ['HWHF', 'Half-width Hangul filler', 'Halbbreites Hangul-Füllzeichen', 'remove'],
};

/** The control characters' short names: C0 (0x00–0x1F), DEL, C1 (0x80–0x9F). */
const C0 = 'NUL SOH STX ETX EOT ENQ ACK BEL BS HT LF VT FF CR SO SI DLE DC1 DC2 DC3 DC4 NAK SYN ETB CAN EM SUB ESC FS GS RS US'.split(' ');
const C1 = 'PAD HOP BPH NBH IND NEL SSA ESA HTS HTJ VTS PLD PLU RI SS2 SS3 DCS PU1 PU2 STS CCH MW SPA EPA SOS SGC SCI CSI ST OSC PM APC'.split(' ');

export const hex = (c: number) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0');

// ── Look-alike letters ─────────────────────────────────────────────────────────────────

/** Cyrillic letters that look like Latin ones, written as code points: they can't be told apart. */
const CYRILLIC: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
  '\u0456': 'i', '\u0458': 'j', '\u0455': 's', '\u0501': 'd', '\u04bb': 'h', '\u051b': 'q', '\u051d': 'w',
  '\u04cf': 'l', '\u04af': 'y',
  '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041a': 'K', '\u041c': 'M', '\u041d': 'H', '\u041e': 'O',
  '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0425': 'X', '\u0406': 'I', '\u0408': 'J', '\u0405': 'S',
  '\u04ae': 'Y', '\u051a': 'Q', '\u051c': 'W', '\u04c0': 'I',
};

/** Greek letters that look like Latin ones. */
const GREEK: Record<string, string> = {
  '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0396': 'Z', '\u0397': 'H', '\u0399': 'I', '\u039a': 'K',
  '\u039c': 'M', '\u039d': 'N', '\u039f': 'O', '\u03a1': 'P', '\u03a4': 'T', '\u03a5': 'Y', '\u03a7': 'X',
  '\u03f9': 'C', '\u037f': 'J',
  '\u03bf': 'o', '\u03bd': 'v', '\u03b1': 'a', '\u03b9': 'i', '\u03ba': 'k', '\u03c1': 'p', '\u03c5': 'u',
  '\u03c7': 'x', '\u03f2': 'c', '\u03f3': 'j',
};

const invert = (table: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const [from, to] of Object.entries(table)) out[to] ??= from;
  return out;
};

/** A letter's twin in another script, when there is one. */
const TWINS: Record<Script, Partial<Record<Script, Record<string, string>>>> = {
  Cyrillic: { Latin: CYRILLIC },
  Greek: { Latin: GREEK },
  Latin: { Cyrillic: invert(CYRILLIC), Greek: invert(GREEK) },
};

const IS_LATIN = /\p{Script=Latin}/u;
const IS_CYRILLIC = /\p{Script=Cyrillic}/u;
const IS_GREEK = /\p{Script=Greek}/u;
const scriptOf = (ch: string): Script | null => (IS_LATIN.test(ch) ? 'Latin' : IS_CYRILLIC.test(ch) ? 'Cyrillic' : IS_GREEK.test(ch) ? 'Greek' : null);

const SCRIPT_DE: Record<Script, string> = { Latin: 'Lateinisches', Cyrillic: 'Kyrillisches', Greek: 'Griechisches' };

/** A word as the home's MIXED shape reads one: three or more letters and marks. */
const WORD = /[\p{L}\p{M}]{3,}/gu;
const ANY_OTHER = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;

interface Look {
  script: Script;
  to: string | null;
}

/**
 * The look-alike letters, by their place in the text: in a word with Latin letters and Cyrillic or
 * Greek ones, the letters of the scripts that have fewer in it (a tie goes to Latin). "Pаypal"
 * marks the Cyrillic а; "мoлоко", a Russian word with a Latin o, marks the o.
 */
export function lookAlikes(text: string): Map<number, Look> {
  const out = new Map<number, Look>();
  if (!ANY_OTHER.test(text)) return out;
  for (const m of text.matchAll(WORD)) {
    const word = m[0];
    const counts: Record<Script, number> = { Latin: 0, Cyrillic: 0, Greek: 0 };
    const letters: { at: number; ch: string; script: Script }[] = [];
    let at = m.index!;
    for (const ch of word) {
      const script = scriptOf(ch);
      if (script) {
        counts[script]++;
        letters.push({ at, ch, script });
      }
      at += ch.length;
    }
    if (!counts.Latin || !(counts.Cyrillic || counts.Greek)) continue;
    const main: Script = counts.Latin >= Math.max(counts.Cyrillic, counts.Greek) ? 'Latin' : counts.Cyrillic >= counts.Greek ? 'Cyrillic' : 'Greek';
    for (const l of letters) if (l.script !== main) out.set(l.at, { script: l.script, to: TWINS[l.script][main]?.[l.ch] ?? null });
  }
  return out;
}

// ── Context ────────────────────────────────────────────────────────────────────────────

const EXT_PICT = /\p{Extended_Pictographic}/u;
const isPict = (c: number | undefined) => c !== undefined && c > 0xa8 && EXT_PICT.test(String.fromCodePoint(c));
const HAN = /\p{Script=Han}/u;
const isHan = (c: number | undefined) => c !== undefined && c >= 0x2e80 && HAN.test(String.fromCodePoint(c));
const LETTER = /[\p{L}\p{M}]/u;
const NOT_JOINING = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u;
/** A letter of a script whose words need joiners (Arabic, Persian, the Indic scripts). */
const joins = (c: number | undefined) => {
  if (c === undefined) return false;
  const ch = String.fromCodePoint(c);
  return LETTER.test(ch) && !NOT_JOINING.test(ch);
};
const MARK = /[\p{Mn}\p{Me}]/u;
const isMark = (c: number) => c >= 0x300 && MARK.test(String.fromCodePoint(c));

const isVs = (c: number) => (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0xe0100 && c <= 0xe01ef);
const isTag = (c: number) => c >= 0xe0000 && c <= 0xe007f;
/** What may follow an emoji and still be part of it: the selector, skin tones, tags, the keycap. */
const inEmoji = (c: number) => c === 0xfe0f || (c >= 0x1f3fb && c <= 0x1f3ff) || isTag(c) || c === 0x20e3;

/** The length of a subdivision flag's tags after 🏴 (U+1F3F4) at `i`: letters and digits, then
 *  the cancel tag. 0 when they aren't one. */
function flagTags(text: string, i: number): number {
  let j = i + 2;
  let n = 0;
  while (j < text.length) {
    const c = text.codePointAt(j)!;
    if ((c >= 0xe0061 && c <= 0xe007a) || (c >= 0xe0030 && c <= 0xe0039)) {
      n++;
      j += 2;
    } else if (c === 0xe007f) return n >= 2 ? j + 2 - (i + 2) : 0;
    else return 0;
  }
  return 0;
}

// ── The scan ───────────────────────────────────────────────────────────────────────────

interface Hit {
  key: string;
  fine: Fine | null;
  fix: Fix;
  /** Whether the shown text marks it (fine ones inside an emoji or a word just stay). */
  shown: boolean;
}

/** Finds what the text hides, marks it in place, and cleans it. */
export function scan(text: string, options: Options = { nbsp: false }): Scan {
  const kinds = new Map<string, Kind>();
  const pieces: Piece[] = [];
  const looks = lookAlikes(text);
  let buf = '';
  let clean = '';
  let marked = 0;
  let cut = false;
  let hidden = 0;
  let lookCount = 0;
  let fineCount = 0;
  /** The last code point that wasn't part of an emoji's tail, for joiners and selectors. */
  let base: number | undefined;
  let prev: number | undefined;
  /** Combining marks on the current letter so far. */
  let marks = 0;
  /** UTF-16 end of a subdivision flag's tags, which are part of the flag. */
  let flagEnd = -1;
  const tagText: string[] = [];
  /** The lowest and highest piled mark, for the list. */
  let pileLo = Infinity;
  let pileHi = 0;

  const kind = (key: string, make: () => Omit<Kind, 'key' | 'count'>): Kind => {
    let k = kinds.get(key);
    if (!k) kinds.set(key, (k = { key, count: 0, ...make() }));
    return k;
  };

  /** A character from the table, as a problem or as fine where it is. */
  const listed = (c: number, fine: Fine | null, shown: boolean): Hit => {
    const [badge, en, de, fix0] = ONE[c];
    const fix: Fix = fine ? 'keep' : fix0;
    const key = hex(c) + (fine ? `:${fine}` : '');
    kind(key, () => ({ badge, en, de, code: hex(c), fine, look: null, fix }));
    return { key, fine, fix, shown };
  };

  const show = (key: string, ch: string, look: boolean) => {
    if (marked >= MAX_MARKED) {
      cut = true;
      buf += ch;
      return;
    }
    const last = pieces[pieces.length - 1];
    if (!buf && !look && last?.key === key && !kinds.get(key)!.look) {
      last.n!++;
      return;
    }
    if (buf) pieces.push({ text: buf });
    buf = '';
    pieces.push({ text: look ? ch : '', key, n: 1 });
    marked++;
  };

  for (let i = 0; i < text.length; ) {
    const c = text.codePointAt(i)!;
    const ch = String.fromCodePoint(c);
    const len = ch.length;
    const next = i + len < text.length ? text.codePointAt(i + len) : undefined;
    let hit: Hit | null = null;

    if (c === 0x09 || c === 0x0a || c === 0x0d) {
      // Tabs and line breaks are what they look like.
    } else if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) {
      const badge = c < 0x20 ? C0[c] : c === 0x7f ? 'DEL' : C1[c - 0x80];
      // Vertical tab, form feed and next line were line breaks once, and become one again.
      const fix: Fix = c === 0x0b || c === 0x0c || c === 0x85 ? 'break' : 'remove';
      hit = { key: hex(c), fine: null, fix, shown: true };
      kind(hit.key, () => ({ badge, en: `Control character ${badge}`, de: `Steuerzeichen ${badge}`, code: hex(c), fine: null, look: null, fix }));
    } else if (c === 0x00a0 && !options.nbsp) {
      hit = listed(c, 'nbsp', true);
    } else if (c === 0x200d && isPict(base) && isPict(next)) {
      hit = listed(c, 'emoji', false);
    } else if ((c === 0x200d || c === 0x200c) && joins(prev) && joins(next)) {
      hit = listed(c, 'script', false);
    } else if (ONE[c]) {
      hit = listed(c, null, true);
    } else if (isVs(c)) {
      const vs = c <= 0xfe0f ? c - 0xfe00 + 1 : c - 0xe0100 + 17;
      const keycap = prev !== undefined && /[0-9#*]/.test(String.fromCodePoint(prev)) && next === 0x20e3;
      // One emoji selector right after an emoji (❤\ufe0f, 1\ufe0f\u20e3), or one selector after a Chinese character.
      const fine: Fine | null = (c === 0xfe0e || c === 0xfe0f) && prev === base && (isPict(prev) || keycap) ? 'emoji' : !isVs(prev ?? 0) && isHan(prev) ? 'han' : null;
      const fix: Fix = fine ? 'keep' : 'remove';
      hit = { key: hex(c) + (fine ? `:${fine}` : ''), fine, fix, shown: !fine };
      const style = vs === 15 ? [' (text style)', ' (Textdarstellung)'] : vs === 16 ? [' (emoji style)', ' (Emoji-Darstellung)'] : ['', ''];
      kind(hit.key, () => ({ badge: `VS${vs}`, en: `Variation selector ${vs}${style[0]}`, de: `Variantenselektor ${vs}${style[1]}`, code: hex(c), fine, look: null, fix }));
    } else if (isTag(c)) {
      const fine: Fine | null = i < flagEnd ? 'flag' : null;
      const fix: Fix = fine ? 'keep' : 'remove';
      hit = { key: fine ? 'tags:flag' : 'tags', fine, fix, shown: !fine };
      if (!fine && c >= 0xe0020 && c <= 0xe007e) tagText.push(String.fromCharCode(c - 0xe0000));
      kind(hit.key, () => ({ badge: 'TAG', en: 'Tag characters', de: 'Tag-Zeichen', code: 'U+E0000–E007F', fine, look: null, fix }));
    } else if (looks.has(i)) {
      const l = looks.get(i)!;
      const fix: Fix = l.to ? 'twin' : 'keep';
      hit = { key: `look:${ch}`, fine: null, fix, shown: true };
      kind(hit.key, () => ({ badge: ch, en: `${l.script} ${ch}`, de: `${SCRIPT_DE[l.script]} ${ch}`, code: hex(c), fine: null, look: l.script, fix, to: l.to ?? undefined }));
    }

    // Marks piled on one letter: the third and later go (variation selectors and the grapheme
    // joiner are their own kinds above).
    if (!hit) {
      if (isMark(c)) {
        marks++;
        if (marks > 2) {
          hit = { key: 'piled', fine: null, fix: 'remove', shown: true };
          kind('piled', () => ({ badge: '+', en: 'Marks piled on a letter', de: 'Auf einen Buchstaben gestapelte Zeichen', code: '', fine: null, look: null, fix: 'remove' }));
          pileLo = Math.min(pileLo, c);
          pileHi = Math.max(pileHi, c);
        }
      } else marks = 0;
    }

    if (!hit) {
      buf += ch;
      clean += ch;
    } else {
      const k = kinds.get(hit.key)!;
      k.count++;
      if (hit.fine) fineCount++;
      else if (k.look) lookCount++;
      else hidden++;
      if (hit.shown) show(hit.key, ch, !!k.look);
      else buf += ch;
      if (hit.fine || hit.fix === 'keep') clean += ch;
      else if (hit.fix === 'space') clean += ' ';
      else if (hit.fix === 'break') clean += '\n';
      else if (hit.fix === 'twin') clean += k.to!;
    }

    if (c === 0x1f3f4) {
      const n = flagTags(text, i);
      if (n) flagEnd = i + 2 + n;
    }

    if (!inEmoji(c)) base = c;
    prev = c;
    i += len;
  }
  if (buf) pieces.push({ text: buf });

  const tags = kinds.get('tags');
  if (tags && tagText.length) tags.spells = tagText.join('');
  const piled = kinds.get('piled');
  if (piled) piled.code = pileLo === pileHi ? hex(pileLo) : `${hex(pileLo)}–${hex(pileHi).slice(2)}`;

  // What hides first (in the order it appears), then look-alikes, then what's fine.
  const rank = (k: Kind) => (k.fine ? 2 : k.look ? 1 : 0);
  const list = [...kinds.values()].sort((a, b) => rank(a) - rank(b));
  return { kinds: list, pieces, hidden, looks: lookCount, fine: fineCount, clean, cut };
}
