import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, HOLES, style, allStyles, plain, isFancy } from '../../src/tools/fancy/fancy.ts';
import { shapes } from '../../src/lib/shapes.ts';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MATH = ['bold', 'italic', 'boldItalic', 'script', 'boldScript', 'fraktur', 'double', 'sansBold', 'sansItalic', 'mono'];
const hex = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(' ');

test('sixteen styles, in order', () => {
  assert.equal(STYLES.length, 16);
  assert.equal(new Set(STYLES).size, 16);
  assert.deepEqual(allStyles('a').map((r) => r.id), [...STYLES]);
});

test('every style on "Hello World 2026"', () => {
  const want = {
    bold: '𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝 𝟐𝟎𝟐𝟔',
    italic: '𝐻𝑒𝑙𝑙𝑜 𝑊𝑜𝑟𝑙𝑑 2026',
    boldItalic: '𝑯𝒆𝒍𝒍𝒐 𝑾𝒐𝒓𝒍𝒅 2026',
    script: 'ℋℯ𝓁𝓁ℴ 𝒲ℴ𝓇𝓁𝒹 2026',
    boldScript: '𝓗𝓮𝓵𝓵𝓸 𝓦𝓸𝓻𝓵𝓭 2026',
    fraktur: 'ℌ𝔢𝔩𝔩𝔬 𝔚𝔬𝔯𝔩𝔡 2026',
    double: 'ℍ𝕖𝕝𝕝𝕠 𝕎𝕠𝕣𝕝𝕕 𝟚𝟘𝟚𝟞',
    sansBold: '𝗛𝗲𝗹𝗹𝗼 𝗪𝗼𝗿𝗹𝗱 𝟮𝟬𝟮𝟲',
    sansItalic: '𝘏𝘦𝘭𝘭𝘰 𝘞𝘰𝘳𝘭𝘥 2026',
    mono: '𝙷𝚎𝚕𝚕𝚘 𝚆𝚘𝚛𝚕𝚍 𝟸𝟶𝟸𝟼',
    circled: 'Ⓗⓔⓛⓛⓞ Ⓦⓞⓡⓛⓓ ②⓪②⑥',
    squared: '🅷🅴🅻🅻🅾 🆆🅾🆁🅻🅳 2026',
    wide: 'Ｈｅｌｌｏ\u3000Ｗｏｒｌｄ\u3000２０２６',
    smallCaps: 'Hᴇʟʟᴏ Wᴏʀʟᴅ 2026',
    upsideDown: '9ᄅ0ᄅ plɹoM ollǝH',
    struck: 'H\u0336e\u0336l\u0336l\u0336o\u0336 \u0336W\u0336o\u0336r\u0336l\u0336d\u0336 \u03362\u03360\u03362\u03366\u0336',
  };
  for (const id of STYLES) assert.equal(style('Hello World 2026', id), want[id], id);
});

test('every style on "Grüße": the base letter styled, the diaeresis kept after it, ß as it is', () => {
  const want = {
    bold: '𝐆𝐫𝐮\u0308ß𝐞',
    italic: '𝐺𝑟𝑢\u0308ß𝑒',
    boldItalic: '𝑮𝒓𝒖\u0308ß𝒆',
    script: '𝒢𝓇𝓊\u0308ßℯ',
    boldScript: '𝓖𝓻𝓾\u0308ß𝓮',
    fraktur: '𝔊𝔯𝔲\u0308ß𝔢',
    double: '𝔾𝕣𝕦\u0308ß𝕖',
    sansBold: '𝗚𝗿𝘂\u0308ß𝗲',
    sansItalic: '𝘎𝘳𝘶\u0308ß𝘦',
    mono: '𝙶𝚛𝚞\u0308ß𝚎',
    circled: 'Ⓖⓡⓤ\u0308ßⓔ',
    squared: '🅶🆁🆄\u0308ß🅴',
    wide: 'Ｇｒｕ\u0308ßｅ',
    smallCaps: 'Gʀᴜ\u0308ßᴇ',
    // Turned, the dots go under the u.
    upsideDown: 'ǝßn\u0324ɹ⅁',
    struck: 'G\u0336r\u0336u\u0308\u0336ß\u0336e\u0336',
  };
  for (const id of STYLES) assert.equal(style('Grüße', id), want[id], `${id}: ${hex(style('Grüße', id))}`);
  // Not composed again: no precomposed letter is left anywhere.
  for (const id of STYLES) assert.ok(!style('Grüße', id).includes('ü'), id);
});

test('every mathematical letter is the right one: assigned, and its compatibility form is the letter', () => {
  for (const id of MATH) {
    for (const ch of LETTERS) {
      const s = style(ch, id);
      assert.notEqual(s, ch, `${id} ${ch} styled`);
      assert.ok(!/\p{Cn}/u.test(s), `${id} ${ch} is an assigned character, not a hole (${hex(s)})`);
      assert.equal(s.normalize('NFKC'), ch, `${id} ${ch} → ${s}`);
    }
  }
});

test('every hole is filled from the Letterlike Symbols block', () => {
  const holes = {
    italic: 'h→ℎ',
    script: 'B→ℬ E→ℰ F→ℱ H→ℋ I→ℐ L→ℒ M→ℳ R→ℛ e→ℯ g→ℊ o→ℴ',
    fraktur: 'C→ℭ H→ℌ I→ℑ R→ℜ Z→ℨ',
    double: 'C→ℂ H→ℍ N→ℕ P→ℙ Q→ℚ R→ℝ Z→ℤ',
  };
  const starts = { italic: [0x1d434, 0x1d44e], script: [0x1d49c, 0x1d4b6], fraktur: [0x1d504, 0x1d51e], double: [0x1d538, 0x1d552] };
  for (const [id, list] of Object.entries(holes)) {
    const pairs = list.split(' ').map((p) => p.split('→'));
    assert.equal(Object.keys(HOLES[id]).length, pairs.length, id);
    for (const [from, to] of pairs) {
      assert.equal(style(from, id), to, `${id} ${from}`);
      // Where the letter would be in the alphabet, Unicode left a hole.
      const upper = from === from.toUpperCase();
      const at = starts[id][upper ? 0 : 1] + (from.toLowerCase().charCodeAt(0) - 97);
      assert.ok(/\p{Cn}/u.test(String.fromCodePoint(at)), `${id} ${from}: U+${at.toString(16)} is reserved`);
    }
  }
});

test('digits where a style has them, plain elsewhere', () => {
  const d = '0123456789';
  assert.equal(style(d, 'bold'), '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗');
  assert.equal(style(d, 'double'), '𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡');
  assert.equal(style(d, 'sansBold'), '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵');
  assert.equal(style(d, 'mono'), '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿');
  assert.equal(style(d, 'circled'), '⓪①②③④⑤⑥⑦⑧⑨');
  assert.equal(style(d, 'wide'), '０１２３４５６７８９');
  for (const id of ['italic', 'boldItalic', 'script', 'boldScript', 'fraktur', 'sansItalic', 'squared', 'smallCaps']) assert.equal(style(d, id), d, id);
});

test('full width: printable ASCII and the space; small caps keep capitals and leave x', () => {
  assert.equal(style('Hi! (a+b)', 'wide'), 'Ｈｉ！\u3000（ａ＋ｂ）');
  assert.equal(style('~', 'wide'), '～');
  assert.equal(style('Fix the Box', 'smallCaps'), 'Fɪx ᴛʜᴇ Bᴏx');
  assert.equal(style('abcdefghijklmnopqrstuvwxyz', 'smallCaps'), 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ');
});

test('ß, other scripts, emoji and punctuation stay as they are', () => {
  for (const id of STYLES.filter((s) => s !== 'upsideDown' && s !== 'struck' && s !== 'wide')) {
    assert.equal(style('ß Привет 你好 👍 -', id), 'ß Привет 你好 👍 -', id);
  }
});

test('upside down: turned and reversed, twice is the text again, lines in reverse order', () => {
  assert.equal(style('Hello World 2026', 'upsideDown'), '9ᄅ0ᄅ plɹoM ollǝH');
  assert.equal(style('Why? (yes!)', 'upsideDown'), '(¡sǝʎ) ¿ʎɥM');
  assert.equal(style(style('Hello World 2026', 'upsideDown'), 'upsideDown'), 'Hello World 2026');
  assert.equal(style('ab\ncd', 'upsideDown'), 'pɔ\nqɐ');
  assert.equal(style('a\r\nb', 'upsideDown'), 'q\nɐ', 'Windows line breaks turn as one');
  // An emoji with a skin tone stays one emoji.
  assert.equal(style('hi 👍🏽', 'upsideDown'), '👍🏽 ᴉɥ');
});

test('struck through: a stroke after every character, spaces too, never after a line break', () => {
  assert.equal(style('a b\nc', 'struck'), 'a\u0336 \u0336b\u0336\nc\u0336');
});

test('plain again gives back the original for every style but upside down; squared in capitals', () => {
  for (const original of ['Hello World 2026', 'Grüße', 'Café au lait, 3 €']) {
    for (const id of STYLES) {
      if (id === 'upsideDown') continue;
      // Squared has capitals only (its ß stays ß).
      const want = id === 'squared' ? original.normalize('NFD').replace(/[a-z]/g, (c) => c.toUpperCase()).normalize('NFC') : original;
      assert.equal(plain(style(original, id)), want, `${id}: ${style(original, id)}`);
    }
  }
  assert.equal(plain('🅶🆁🆄\u0308ß🅴'), 'GRÜßE');
});

test('plain again leaves the rest alone', () => {
  // A superscript, a no-break space and a ligature aren't fancy letters: only the fancy ones change.
  assert.equal(plain('𝐁𝐨𝐥𝐝 m² 5\u00a0€ ﬁne'), 'Bold m² 5\u00a0€ ﬁne');
  assert.equal(plain('U\u0332n\u0332d\u0332e\u0332r\u0332 \u0332l\u0332i\u0332n\u0332e\u0332'), 'Under line');
  assert.equal(plain('🅐🅑'), 'AB', 'negative circled letters');
  assert.equal(plain('🄰🄱'), 'AB', 'squared letters');
});

test('fancy text is told apart from plain text, and agrees with the home’s shape', () => {
  const samples = ['𝐇𝐞𝐥𝐥𝐨', 'ℋℯ𝓁𝓁ℴ', 'Ⓗⓔⓛⓛⓞ', 'Ｈｅｌｌｏ', '🅷🅴🅻🅻🅾', 'Hello', 'Grüße', 'm² und ½', 'x 𝐁 y', 'ℝ and ℕ'];
  for (const s of samples) if (shapes(s).includes('fancy')) assert.ok(isFancy(s), `the home calls ${s} fancy`);
  assert.ok(isFancy('Hᴇʟʟᴏ'), 'small caps');
  assert.ok(isFancy('H\u0336e\u0336y\u0336'), 'struck through');
  assert.ok(!isFancy('Hello'));
  assert.ok(!isFancy('Grüße aus Köln'));
  assert.ok(!isFancy('x 𝐁 y'), 'one fancy letter is not a fancy text');
});
