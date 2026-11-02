// What Fancy text does. Plain TypeScript with erasable types, no DOM, tested in node.
//
// Sixteen styles from Unicode's own letters: the mathematical alphabets (bold, italic, script,
// Fraktur, double-struck, sans, monospace), circled, negative squared and full-width letters, small
// capitals, a table for upside down, and a combining long stroke for struck through. The
// mathematical alphabets have holes where a letter already existed in the Letterlike Symbols block
// (script B is ℬ, U+212C, not U+1D49D, which is reserved); those come from that block, or they'd
// show as boxes.
//
// Accented letters are decomposed (ü → u + U+0308), the base letter is styled and the mark kept:
// there's no bold ü, but a bold u with a diaeresis draws well. Nothing is composed again. ß and
// anything without a style (other scripts, emoji, punctuation) stay as they are.
//
// Plain again goes the other way: compatibility decomposition (NFKC) for each fancy letter, reverse
// tables for small capitals and the negative squared and circled letters (which have none), and the
// combining strokes and underlines dropped.

export type StyleId =
  | 'bold'
  | 'italic'
  | 'boldItalic'
  | 'script'
  | 'boldScript'
  | 'fraktur'
  | 'double'
  | 'sansBold'
  | 'sansItalic'
  | 'mono'
  | 'circled'
  | 'squared'
  | 'wide'
  | 'smallCaps'
  | 'upsideDown'
  | 'struck';

/** The sixteen, in the order they're shown. */
export const STYLES: readonly StyleId[] = [
  'bold',
  'italic',
  'boldItalic',
  'script',
  'boldScript',
  'fraktur',
  'double',
  'sansBold',
  'sansItalic',
  'mono',
  'circled',
  'squared',
  'wide',
  'smallCaps',
  'upsideDown',
  'struck',
];

const cp = (n: number) => String.fromCodePoint(n);
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

/** A mathematical alphabet: capitals from `upper`, small letters from `lower`, digits from `digits`
 *  (or plain), with the letters Unicode keeps elsewhere in `holes`. */
function alphabet(upper: number, lower: number, digits: number | null, holes: Record<string, number> = {}): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < 26; i++) {
    m.set(UPPER[i], cp(holes[UPPER[i]] ?? upper + i));
    m.set(LOWER[i], cp(holes[LOWER[i]] ?? lower + i));
  }
  if (digits !== null) for (let i = 0; i < 10; i++) m.set(String(i), cp(digits + i));
  return m;
}

/** The letters missing from the mathematical alphabets, by style: where Unicode keeps them. */
export const HOLES: Record<string, Record<string, number>> = {
  italic: { h: 0x210e },
  script: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
  fraktur: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  double: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
};

// Circled: Ⓐ–Ⓩ, ⓐ–ⓩ, ①–⑨ and ⓪.
function circled(): Map<string, string> {
  const m = alphabet(0x24b6, 0x24d0, null);
  for (let i = 1; i <= 9; i++) m.set(String(i), cp(0x2460 + i - 1));
  m.set('0', cp(0x24ea));
  return m;
}

// Negative squared letters 🅰–🆉: capitals only, so small letters take them too.
function squared(): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < 26; i++) {
    m.set(UPPER[i], cp(0x1f170 + i));
    m.set(LOWER[i], cp(0x1f170 + i));
  }
  return m;
}

// Full width: the printable ASCII range 0x21–0x7E at U+FF01–FF5E, the space as the ideographic one.
function wide(): Map<string, string> {
  const m = new Map<string, string>();
  for (let c = 0x21; c <= 0x7e; c++) m.set(String.fromCharCode(c), cp(0xff01 + c - 0x21));
  m.set(' ', cp(0x3000));
  return m;
}

/** Small capitals for the small letters (x has none, and is one already); capitals stay capitals,
 *  as small caps are set in print ("Hᴇʟʟᴏ"). */
export const SMALL_CAPS = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';

function smallCaps(): Map<string, string> {
  const m = new Map<string, string>();
  const caps = [...SMALL_CAPS];
  for (let i = 0; i < 26; i++) m.set(LOWER[i], caps[i]);
  return m;
}

const MAPS: Partial<Record<StyleId, Map<string, string>>> = {
  bold: alphabet(0x1d400, 0x1d41a, 0x1d7ce),
  italic: alphabet(0x1d434, 0x1d44e, null, HOLES.italic),
  boldItalic: alphabet(0x1d468, 0x1d482, null),
  script: alphabet(0x1d49c, 0x1d4b6, null, HOLES.script),
  boldScript: alphabet(0x1d4d0, 0x1d4ea, null),
  fraktur: alphabet(0x1d504, 0x1d51e, null, HOLES.fraktur),
  double: alphabet(0x1d538, 0x1d552, 0x1d7d8, HOLES.double),
  sansBold: alphabet(0x1d5d4, 0x1d5ee, 0x1d7ec),
  sansItalic: alphabet(0x1d608, 0x1d622, null),
  mono: alphabet(0x1d670, 0x1d68a, 0x1d7f6),
  circled: circled(),
  squared: squared(),
  wide: wide(),
  smallCaps: smallCaps(),
};

// ── Upside down ────────────────────────────────────────────────────────────────────────

/** Each character turned half a circle, as near as Unicode has it. Read the other way round. */
const TURNED: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ',
  n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ᗺ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ', K: 'ʞ', L: '⅂', M: 'W',
  N: 'N', O: 'O', P: 'Ԁ', Q: 'Ό', R: 'ᴚ', S: 'S', T: '⊥', U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6',
  '.': '˙', ',': "'", "'": ',', '"': '„', '„': '"', '?': '¿', '¿': '?', '!': '¡', '¡': '!',
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
  _: '‾', '‾': '_', '&': '⅋', '‿': '⁀', '⁀': '‿',
};
const FLIP = new Map(Object.entries(TURNED));
// The turned letters turn back: upside down twice is the text again.
for (const [from, to] of Object.entries(TURNED)) if (!FLIP.has(to)) FLIP.set(to, from);

/** Marks above go below and the other way round (ü turned has its dots underneath). */
const MARK_PAIRS: [number, number][] = [
  [0x0300, 0x0316], // grave
  [0x0301, 0x0317], // acute
  [0x0302, 0x032d], // circumflex
  [0x0303, 0x0330], // tilde
  [0x0304, 0x0331], // macron
  [0x0306, 0x032e], // breve
  [0x0307, 0x0323], // dot
  [0x0308, 0x0324], // diaeresis
  [0x030a, 0x0325], // ring
  [0x030c, 0x032c], // caron
];
const MARK_FLIP = new Map<string, string>();
for (const [above, below] of MARK_PAIRS) {
  MARK_FLIP.set(cp(above), cp(below));
  MARK_FLIP.set(cp(below), cp(above));
}

const graphemes = (text: string): string[] => Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text), (s) => s.segment);

function upsideDown(text: string): string {
  return graphemes(text)
    .reverse()
    .map((cluster) => {
      const [base, ...rest] = Array.from(cluster);
      return (FLIP.get(base) ?? base) + rest.map((m) => MARK_FLIP.get(m) ?? m).join('');
    })
    .join('');
}

// ── Struck through ─────────────────────────────────────────────────────────────────────

const STROKE = '\u0336';

/** A long stroke after every character (spaces too, so the line runs through), not after a break. */
function struck(text: string): string {
  return graphemes(text)
    .map((c) => (c === '\n' || c === '\t' ? c : c + STROKE))
    .join('');
}

// ── Styling ────────────────────────────────────────────────────────────────────────────

/** Latin letters with accents, split into the letter and its marks (ü → u + U+0308); ß, æ, ø and
 *  letters of other scripts stay whole. */
function decompose(text: string): string {
  return text.replace(/[\u00C0-\u024F\u1E00-\u1EFF]/g, (ch) => {
    const d = ch.normalize('NFD');
    return d !== ch && /^[A-Za-z]/.test(d) ? d : ch;
  });
}

/** The text in one style. */
export function style(text: string, id: StyleId): string {
  const t = decompose(text.replace(/\r\n?/g, '\n'));
  if (id === 'upsideDown') return upsideDown(t);
  if (id === 'struck') return struck(t);
  const map = MAPS[id]!;
  let out = '';
  for (const ch of t) out += map.get(ch) ?? ch;
  return out;
}

/** The text in all sixteen. */
export const allStyles = (text: string): { id: StyleId; text: string }[] => STYLES.map((id) => ({ id, text: style(text, id) }));

// ── Plain again ────────────────────────────────────────────────────────────────────────

/** Letters with no compatibility decomposition: small capitals, negative circled and squared. */
const BACK = new Map<string, string>();
[...SMALL_CAPS].forEach((ch, i) => ch !== 'x' && BACK.set(ch, LOWER[i]));
for (let i = 0; i < 26; i++) {
  BACK.set(cp(0x1f150 + i), UPPER[i]);
  BACK.set(cp(0x1f170 + i), UPPER[i]);
}

/** Fancy letters NFKC takes back: the mathematical alphabets, the letter-like symbols that fill their
 *  holes, enclosed letters and digits, squared letters, full width and the ideographic space. */
const COMPAT = /[\u{1D400}-\u{1D7FF}\u2102\u210a-\u2113\u2115\u2119-\u211d\u2124\u2128\u212c\u212d\u212f-\u2131\u2133\u2134\u2460-\u24ff\u{1F130}-\u{1F189}\uff01-\uff5e\u3000]/u;

/** Combining strokes and underlines: struck through, underlined. */
const OVERLAY = /[\u0332-\u0338]/;

/** The text in plain letters again. Upside down can't be told from real letters, so it stays. */
export function plain(text: string): string {
  let out = '';
  for (const ch of text) {
    const back = BACK.get(ch);
    if (back) out += back;
    else if (OVERLAY.test(ch)) continue;
    else if (COMPAT.test(ch)) out += ch.normalize('NFKC');
    else out += ch;
  }
  return out.normalize('NFC');
}

// The home's `fancy` shape (src/lib/shapes.ts): letters from the mathematical alphabets, the
// letter-like symbols that fill their gaps, circled and squared letters, and full-width ones.
const FANCY = /[\u{1D400}-\u{1D7FF}\u{2102}\u{210A}-\u{2113}\u{2115}\u{2119}-\u{211D}\u{2124}\u{2128}\u{212C}\u{212D}\u{212F}-\u{2131}\u{2133}\u{2134}\u{24B6}-\u{24E9}\u{1F130}-\u{1F189}\u{FF21}-\u{FF3A}\u{FF41}-\u{FF5A}]/gu;
// What the shape doesn't count but this tool makes too: small capitals and struck-through letters.
const MORE = /[ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡʏᴢ\u0336]/gu;

/** Whether a text holds fancy letters to make plain: two or more (as the home's shape counts them,
 *  plus small capitals and strokes), and plain letters would read differently. */
export function isFancy(text: string): boolean {
  const n = (text.match(FANCY)?.length ?? 0) + (text.match(MORE)?.length ?? 0);
  return n >= 2 && plain(text) !== text.normalize('NFC');
}
