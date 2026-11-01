import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repair, spellOut, decodeFile, encodeCp1252, cp1252Byte } from '../../src/tools/umlauts/umlauts.ts';

/** What a program does to text when it reads UTF-8 as Windows-1252 (and saves it again). */
const breakIt = (text) => new TextDecoder('windows-1252').decode(new TextEncoder().encode(text));
const marked = (r) => r.pieces.filter((p) => p.fixed).map((p) => p.text);

test('Windows-1252 bytes, the five holes as the control characters a decoder makes of them', () => {
  assert.equal(cp1252Byte('€'), 0x80);
  assert.equal(cp1252Byte('„'), 0x84);
  assert.equal(cp1252Byte('Ÿ'), 0x9f);
  assert.equal(cp1252Byte('ü'), 0xfc);
  assert.equal(cp1252Byte('\u0081'), 0x81);
  assert.equal(cp1252Byte('A'), 0x41);
  assert.equal(cp1252Byte('ẞ'), null);
  assert.equal(cp1252Byte('ж'), null);
  assert.deepEqual([...encodeCp1252('Grüße 12 €')], [0x47, 0x72, 0xfc, 0xdf, 0x65, 0x20, 0x31, 0x32, 0x20, 0x80]);
  assert.equal(encodeCp1252('Привет'), null);
  // Every byte goes through the decoder and back.
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual([...encodeCp1252(new TextDecoder('windows-1252').decode(all))], [...all]);
});

test('the usual broken letters, quotes and signs', () => {
  assert.equal(repair('GrÃ¼ÃŸe aus KÃ¶ln').text, 'Grüße aus Köln');
  assert.equal(repair('Ã„rger, Ã–l, Ãœbung, Ã¤Ã¶Ã¼').text, 'Ärger, Öl, Übung, äöü');
  assert.equal(repair('â€žZitatâ€œ und â€šhalbâ€˜').text, '„Zitat“ und ‚halb‘');
  assert.equal(repair('5 â‚¬ â€“ 10 â€” 20 â€¦').text, '5 € – 10 — 20 …');
  assert.equal(repair('itâ€™s').text, 'it’s');
  assert.equal(repair('cafÃ© crÃ¨me Ã  la franÃ§aise').text, 'café crème à la française');
  // A no-break space (C2 A0): its second half a no-break space, or a plain space on the way.
  assert.equal(repair('5Â kg').text, '5 kg');
  assert.equal(repair('5Â kg').text, '5 kg');
  // Letters from other alphabets and an emoji.
  assert.equal(repair('ÐŸÑ€Ð¸Ð²ÐµÑ‚').text, 'Привет');
  assert.equal(repair('ðŸ˜€').text, '😀');
  assert.equal(repair('PoznaÅ„, Å‚Ã³dÅº').text, 'Poznań, łódź');
});

test('the sample file: eight places, each marked', () => {
  const r = repair('GrÃ¼ÃŸe aus KÃ¶ln, schÃ¶ne â€žAnfÃ¼hrungszeichenâ€œ und 5 â‚¬.');
  assert.equal(r.text, 'Grüße aus Köln, schöne „Anführungszeichen“ und 5 €.');
  assert.equal(r.fixed, 8);
  assert.equal(r.passes, 1);
  assert.deepEqual(marked(r), ['üß', 'ö', 'ö', '„', 'ü', '“', '€']);
  assert.equal(r.pieces.map((p) => p.text).join(''), r.text);
});

test('text broken twice, three times', () => {
  const right = 'Grüße „Köln“ 5 € – schön';
  const twice = breakIt(breakIt(right));
  assert.equal(twice, 'GrÃƒÂ¼ÃƒÅ¸e Ã¢â‚¬Å¾KÃƒÂ¶lnÃ¢â‚¬Å“ 5 Ã¢â€šÂ¬ Ã¢â‚¬â€œ schÃƒÂ¶n');
  const r = repair(twice);
  assert.equal(r.text, right);
  assert.equal(r.passes, 2);
  assert.equal(r.fixed, 8);
  assert.equal(repair(breakIt(breakIt(breakIt(right)))).text, right);
});

test('right and broken letters mixed: only the broken ones change', () => {
  assert.equal(repair('Grüße aus KÃ¶ln').text, 'Grüße aus Köln');
  assert.equal(repair('Müller, MÃ¼ller, Müller').text, 'Müller, Müller, Müller');
  const mixed = repair('Spaß ist „gut“ und GrÃ¼ÃŸe');
  assert.equal(mixed.text, 'Spaß ist „gut“ und Grüße');
  assert.equal(mixed.fixed, 2);
});

test('right text stays right: ß, Ö, Ü, Ä next to quotes and dashes', () => {
  // (Not "Â©" or "Ä“": those are exactly what a broken © and ē look like, and are repaired.)
  for (const right of ['Spaß“', '„Maß“', 'groß…', 'Fuß–Weg', 'ÖL»', 'ÜBER“', 'SÃO PAULO', 'Ã', 'plain ASCII', 'Grüße', 'été', '']) {
    const r = repair(right);
    assert.equal(r.text, right, right);
    assert.equal(r.fixed, 0, right);
  }
});

test('French à alone before a space', () => {
  assert.equal(repair('Ã©tÃ© Ã  Paris').text, 'été à Paris');
  assert.equal(repair('Ã  Paris').text, 'à Paris');
});

test('a file: UTF-8 when its bytes are, Windows-1252 when they aren’t, UTF-16 with its mark', () => {
  const win = Uint8Array.from([0x47, 0x72, 0xfc, 0xdf, 0x65, 0x20, 0x80]);
  assert.deepEqual(decodeFile(win), { text: 'Grüße €', encoding: 'windows-1252' });
  const utf8 = new TextEncoder().encode('Grüße €');
  assert.deepEqual(decodeFile(utf8), { text: 'Grüße €', encoding: 'utf-8' });
  assert.deepEqual(decodeFile(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8])), { text: 'Grüße €', encoding: 'utf-8' });
  assert.deepEqual(decodeFile(Uint8Array.from([0xff, 0xfe, 0x47, 0, 0xfc, 0])), { text: 'Gü', encoding: 'utf-16' });
  // The broken sample is valid UTF-8: read as such, then repaired.
  const broken = new TextEncoder().encode(breakIt('Grüße'));
  assert.equal(decodeFile(broken).encoding, 'utf-8');
  assert.equal(repair(decodeFile(broken).text).text, 'Grüße');
});

test('spell out: umlauts and ß, capitals in a word in capitals, accents dropped', () => {
  assert.equal(spellOut('Grüße aus Köln').text, 'Gruesse aus Koeln');
  assert.equal(spellOut('Ärger, Öl, Übel').text, 'Aerger, Oel, Uebel');
  assert.equal(spellOut('ÄRGER, ÖL, ÜBEL, MÜ').text, 'AERGER, OEL, UEBEL, MUE');
  assert.equal(spellOut('Ä Ö Ü').text, 'Ae Oe Ue');
  assert.equal(spellOut('STRAßE Straße GROẞ ẞ').text, 'STRASSE Strasse GROSS SS');
  assert.equal(spellOut('Café Ñandú Ørsted Œuvre Łódź Çava naïve').text, 'Cafe Nandu Orsted Oeuvre Lodz Cava naive');
  // Decomposed letters (a mark after the letter) come out the same.
  assert.equal(spellOut('Grüße').text, 'Gruesse');
  const r = spellOut('Müller & Söhne');
  assert.equal(r.changed, 2);
  assert.deepEqual(r.pieces.filter((p) => p.fixed).map((p) => p.text), ['ue', 'oe']);
  assert.equal(spellOut('plain').changed, 0);
});

test('spell out, safe for file names', () => {
  assert.equal(spellOut('Mein Lebenslauf: Jürgen Müller (2026)?.pdf', true).text, 'Mein-Lebenslauf-Juergen-Mueller-(2026).pdf');
  assert.equal(spellOut('  a / b \\ c * d " e < f > g | h  ', true).text, 'a-b-c-d-e-f-g-h');
  assert.equal(spellOut('„Zitat“ – 5 €', true).text, 'Zitat-5');
  assert.equal(spellOut('erste Zeile\nzweite Zeile', true).text, 'erste-Zeile\nzweite-Zeile');
  assert.equal(spellOut('...versteckt.', true).text, 'versteckt');
});
