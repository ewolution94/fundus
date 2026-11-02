import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, lookAlikes, MAX_MARKED } from '../../src/tools/invisible/invisible.ts';
import { shapes } from '../../src/lib/shapes.ts';

/** Each kind's count, by its key. */
const counts = (r) => Object.fromEntries(r.kinds.map((k) => [k.key, k.count]));

// The sample file's text (tests/fixtures/out/hidden.txt), built here: a zero-width space, a soft
// hyphen, a narrow no-break space, a right-to-left mark, a byte-order mark and a Cyrillic а.
const HIDDEN = 'IBAN DE89\u200b 3704 0044 0532 0130 00, Ver\u00adtrag, 10:00\u202fAM, \u200fok, \ufeffP\u0430ypal\n';

test('the sample: five hidden characters and one look-alike, cleaned to plain text', () => {
  const r = scan(HIDDEN);
  assert.equal(r.hidden, 5);
  assert.equal(r.looks, 1);
  assert.equal(r.fine, 0);
  assert.deepEqual(counts(r), { 'U+200B': 1, 'U+00AD': 1, 'U+202F': 1, 'U+200F': 1, 'U+FEFF': 1, 'look:\u0430': 1 });
  assert.deepEqual(
    r.kinds.map((k) => [k.badge, k.code, k.fix]),
    [
      ['ZWSP', 'U+200B', 'remove'],
      ['SHY', 'U+00AD', 'remove'],
      ['NNBSP', 'U+202F', 'space'],
      ['RLM', 'U+200F', 'remove'],
      ['BOM', 'U+FEFF', 'remove'],
      ['\u0430', 'U+0430', 'twin'],
    ],
  );
  assert.equal(r.clean, 'IBAN DE89 3704 0044 0532 0130 00, Vertrag, 10:00 AM, ok, Paypal\n');
  // Marked in place: each finding where it was, the look-alike with its letter.
  assert.deepEqual(r.pieces.filter((p) => p.key).map((p) => [p.key, p.text]), [
    ['U+200B', ''],
    ['U+00AD', ''],
    ['U+202F', ''],
    ['U+200F', ''],
    ['U+FEFF', ''],
    ['look:\u0430', '\u0430'],
  ]);
  assert.equal(r.pieces.map((p) => (p.key && !p.text ? '' : p.text)).join(''), HIDDEN.replace(/[\u200b\u00ad\u202f\u200f\ufeff]/g, ''));
});

test('each kind is found and counted', () => {
  const cases = [
    ['a\u200b\u200bb', 'U+200B', 2, 'ab'],
    ['a\u200cb', 'U+200C', 1, 'ab'],
    ['a\u200db', 'U+200D', 1, 'ab'],
    ['a\u2060b', 'U+2060', 1, 'ab'],
    ['\ufeffab', 'U+FEFF', 1, 'ab'],
    ['Ver\u00adtrag', 'U+00AD', 1, 'Vertrag'],
    ['5\u202f€', 'U+202F', 1, '5 €'],
    ['a\u2003b\u2009c', 'U+2003', 1, 'a b c'],
    ['a\u205fb', 'U+205F', 1, 'a b'],
    ['a\u3000b', 'U+3000', 1, 'a b'],
    ['a b', 'U+2028', 1, 'a\nb'],
    ['a b', 'U+2029', 1, 'a\nb'],
    ['\u200eab\u200f', 'U+200E', 1, 'ab'],
    ['\u202eabc\u202c', 'U+202E', 1, 'abc'],
    ['\u2066abc\u2069', 'U+2066', 1, 'abc'],
    ['\u061cab', 'U+061C', 1, 'ab'],
    ['x\u2062y', 'U+2062', 1, 'xy'],
    ['aㅤb', 'U+3164', 1, 'ab'],
    ['aﾠb', 'U+FFA0', 1, 'ab'],
    ['aᅟb', 'U+115F', 1, 'ab'],
    ['a\u180eb', 'U+180E', 1, 'ab'],
    ['a\u034fb', 'U+034F', 1, 'ab'],
    ['a\ufe00b', 'U+FE00', 1, 'ab'],
    ['a\u{e0100}b', 'U+E0100', 1, 'ab'],
    ['a\u001bb\u0007', 'U+001B', 1, 'ab'],
    ['a\u0085b', 'U+0085', 1, 'a\nb'],
    ['a\u000bb', 'U+000B', 1, 'a\nb'],
    ['a\u007fb', 'U+007F', 1, 'ab'],
  ];
  for (const [text, key, n, clean] of cases) {
    const r = scan(text);
    assert.equal(counts(r)[key], n, `${key} in ${JSON.stringify(text)}`);
    assert.equal(r.clean, clean, `${key} cleaned`);
  }
  assert.equal(scan('a\u001bb\u0007').kinds[1].badge, 'BEL');
  assert.equal(scan('a\u2003b\u2009c').hidden, 2);
  // Tabs and line breaks (Windows' too) are what they look like.
  assert.deepEqual(scan('a\tb\r\nc\n').kinds, []);
});

test('tag characters are found, and what they spell is shown', () => {
  const secret = [...'hi there'].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('');
  const r = scan(`Nice post${secret}!`);
  assert.equal(counts(r).tags, 8);
  assert.equal(r.kinds[0].spells, 'hi there');
  assert.equal(r.clean, 'Nice post!');
  assert.deepEqual(r.pieces.find((p) => p.key), { text: '', key: 'tags', n: 8 }, 'one badge for the run');
});

test('emoji keep their selector, joiner and flag tags: listed as fine, never cleaned', () => {
  const emoji = 'I ❤\ufe0f it 👩\u200d💻 1\ufe0f\u20e3 🏳\ufe0f\u200d🌈 🏴\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f} ☺\ufe0e';
  const r = scan(emoji);
  assert.equal(r.hidden, 0);
  assert.equal(r.looks, 0);
  assert.equal(r.clean, emoji);
  assert.deepEqual(counts(r), { 'U+FE0F:emoji': 3, 'U+200D:emoji': 2, 'tags:flag': 6, 'U+FE0E:emoji': 1 });
  assert.ok(r.kinds.every((k) => k.fine && k.fix === 'keep'));
  assert.ok(r.pieces.every((p) => !p.key), 'nothing marked inside an emoji');
  // A selector after a plain letter, a second one after an emoji, and a joiner between letters do hide.
  const stray = scan('a\ufe0f ❤\ufe0f\ufe0f x\u200dy');
  assert.equal(stray.hidden, 3);
  assert.equal(stray.clean, 'a ❤\ufe0f xy');
});

test('a joiner inside a Persian or Hindi word, and a selector after a Chinese character, are fine', () => {
  const r = scan('می\u200cخواهم क\u094d\u200dष 葛\u{e0100}');
  assert.equal(r.hidden, 0);
  assert.equal(r.fine, 3);
});

test('no-break spaces are listed as fine, unless asked to clean them too', () => {
  const off = scan('5\u00a0€ und 10\u00a0km');
  assert.equal(off.hidden, 0);
  assert.equal(off.fine, 2);
  assert.equal(off.clean, '5\u00a0€ und 10\u00a0km');
  assert.equal(off.kinds[0].fine, 'nbsp');
  const on = scan('5\u00a0€ und 10\u00a0km', { nbsp: true });
  assert.equal(on.hidden, 2);
  assert.equal(on.clean, '5 € und 10 km');
  assert.equal(on.kinds[0].fix, 'space');
});

test('look-alike letters: the odd script in a mixed word, replaced by its twin', () => {
  const r = scan('Pay to P\u0430yP\u0430l or \u0410pple, not \u0391BC');
  assert.equal(r.looks, 4);
  assert.equal(r.clean, 'Pay to PayPal or Apple, not ABC');
  // Two Greek letters and a Latin C make a Greek word: the C is the odd one.
  assert.equal(scan('\u0391\u0392C').clean, '\u0391\u0392\u03f9');
  const a = r.kinds.find((k) => k.key === 'look:\u0430');
  assert.deepEqual([a.count, a.look, a.to, a.en, a.de], [2, 'Cyrillic', 'a', 'Cyrillic \u0430', 'Kyrillisches \u0430']);
  assert.equal(r.kinds.find((k) => k.key === 'look:\u0391').look, 'Greek');
  // A Russian word with one Latin o: the o is the odd one, and gets its Cyrillic twin.
  const ru = scan('\u043co\u043b\u043e\u043a\u043e');
  assert.equal(ru.looks, 1);
  assert.equal(ru.kinds[0].look, 'Latin');
  assert.equal(ru.clean, '\u043c\u043e\u043b\u043e\u043a\u043e');
  // A letter without a twin is listed and kept.
  const zh = scan('Gr\u0436en');
  assert.equal(zh.looks, 1);
  assert.equal(zh.kinds[0].fix, 'keep');
  assert.equal(zh.clean, 'Gr\u0436en');
  // Words in one script, and short ones, are left alone.
  assert.equal(scan('\u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440. \u039a\u03b1\u03bb\u03b7\u03bc\u03ad\u03c1\u03b1. café \u03bcm').looks, 0);
});

test('look-alikes agree with the home’s shape', () => {
  for (const text of ['P\u0430ypal', '\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440', 'café', '\u0410pple pie', '\u0395\u03bb\u03bb\u03ac\u03b4\u03b1 and Greece', 'xy\u03bf']) {
    const shape = shapes(text).includes('invisible');
    assert.equal(lookAlikes(text).size > 0, shape, text);
  }
});

test('marks piled on one letter: two stay, the rest go', () => {
  const zalgo = 'Z\u0334\u0321\u031b\u0353a\u0337l\u0336go\u0301\u0302';
  const r = scan(zalgo);
  assert.equal(counts(r).piled, 2);
  assert.equal(r.hidden, 2);
  assert.equal(r.clean, 'Z\u0334\u0321a\u0337l\u0336go\u0301\u0302');
  assert.deepEqual(r.pieces.find((p) => p.key), { text: '', key: 'piled', n: 2 });
  assert.equal(r.kinds[0].code, 'U+031B–0353');
  // Vietnamese and accented letters as typed stay: no more than two marks.
  assert.equal(scan('Tiếng Việt, e\u0323\u0302, café').hidden, 0);
});

test('nothing hidden in plain text; the marked places stop at the limit, the counts and Clean don’t', () => {
  const plain = scan('Grüße aus Köln, 5 € – “quoted”.');
  assert.deepEqual([plain.hidden, plain.looks, plain.fine, plain.kinds.length], [0, 0, 0, 0]);
  assert.equal(plain.clean, 'Grüße aus Köln, 5 € – “quoted”.');
  const many = scan('a\u200b'.repeat(MAX_MARKED + 10));
  assert.equal(many.hidden, MAX_MARKED + 10);
  assert.equal(many.pieces.filter((p) => p.key).length, MAX_MARKED);
  assert.ok(many.cut);
  assert.equal(many.clean, 'a'.repeat(MAX_MARKED + 10));
});
