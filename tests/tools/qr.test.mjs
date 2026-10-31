import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { link, looksLikeLink, wifi, wifiEscape, vcard, vEscape, matrix, svgPath, svgFile, pixels, scaleFor, parseScanned, parseWifi, parseContact, scannedText, QUIET, TooLong } from '../../src/tools/qr/qr.ts';

/** Makes a code and reads it back, the way the Scan side does. */
function roundTrip(text, ecc = 'M', scale = 4) {
  const m = matrix(text, ecc);
  const { data, width, height } = pixels(m, scale);
  const code = jsQR(data, width, height);
  assert.ok(code, `jsQR found no code for ${JSON.stringify(text)}`);
  return scannedText(code);
}

test('links: https:// added when someone types just the address, a scheme kept', () => {
  assert.equal(link('  example.com/path '), 'https://example.com/path');
  assert.equal(link('http://example.com'), 'http://example.com');
  assert.equal(link('mailto:a@b.de'), 'mailto:a@b.de');
  assert.equal(link(''), '');
  assert.ok(looksLikeLink('ewolution.cloud'));
  assert.ok(looksLikeLink('https://x.y/z?a=1'));
  assert.ok(!looksLikeLink('just words'));
  assert.ok(!looksLikeLink('nodot'));
});

test('Wi-Fi: \\ ; , : and " escaped with a backslash', () => {
  assert.equal(wifiEscape('a\\b;c,d:e"f'), 'a\\\\b\\;c\\,d\\:e\\"f');
  assert.equal(wifi({ ssid: 'Café;Guest', password: 'p:a,s"s\\', auth: 'WPA', hidden: false }), 'WIFI:T:WPA;S:Café\\;Guest;P:p\\:a\\,s\\"s\\\\;;');
  assert.equal(wifi({ ssid: 'Open', password: 'ignored', auth: 'nopass', hidden: true }), 'WIFI:T:nopass;S:Open;H:true;;');
  assert.equal(wifi({ ssid: 'Old', password: '12345', auth: 'WEP', hidden: false }), 'WIFI:T:WEP;S:Old;P:12345;;');
});

test('Wi-Fi read back: escapes undone, every field as it was made', () => {
  const nets = [
    { ssid: 'Café;Guest', password: 'p:a,s"s\\;', auth: 'WPA', hidden: false },
    { ssid: 'Hidden:One', password: '', auth: 'nopass', hidden: true },
    { ssid: 'Old', password: 'ab,cd', auth: 'WEP', hidden: false },
  ];
  for (const net of nets) assert.deepEqual(parseWifi(wifi(net)), net);
  assert.deepEqual(parseWifi('WIFI:S:"0123456789";T:WPA;P:"secret";;'), { ssid: '0123456789', password: 'secret', auth: 'WPA', hidden: false }, 'fields in any order, quoted values');
  assert.equal(parseWifi('WIFI:T:WPA;;'), null, 'no network name, no network');
});

test('vCard 3.0: \\ , ; and line breaks escaped, a colon left alone, CRLF lines', () => {
  assert.equal(vEscape('a\\b,c;d:e\nf'), 'a\\\\b\\,c\\;d:e\\nf');
  const card = vcard({ first: 'Erika', last: 'Muster;mann', phone: '+49 30 123456', email: 'erika@example.com', org: 'Fundus, GmbH' });
  assert.equal(
    card,
    ['BEGIN:VCARD', 'VERSION:3.0', 'N:Muster\\;mann;Erika;;;', 'FN:Erika Muster\\;mann', 'ORG:Fundus\\, GmbH', 'TEL;TYPE=CELL:+49 30 123456', 'EMAIL:erika@example.com', 'END:VCARD'].join('\r\n'),
  );
  assert.ok(!vcard({ first: 'A', last: '', phone: '', email: '', org: '' }).includes('TEL'), 'empty fields stay out');
  assert.match(vcard({ first: '', last: '', phone: '1', email: '', org: 'Only Org' }), /\r\nFN:Only Org\r\n/, 'a card needs a name: the organisation stands in');
});

test('a contact read back, with escapes undone', () => {
  const card = vcard({ first: 'Erika', last: 'Muster;mann', phone: '+49 30 123456', email: 'erika@example.com', org: 'Fundus, GmbH' });
  assert.deepEqual(parseContact(card), [
    { key: 'name', value: 'Erika Muster;mann' },
    { key: 'org', value: 'Fundus, GmbH' },
    { key: 'phone', value: '+49 30 123456' },
    { key: 'email', value: 'erika@example.com' },
  ]);
  assert.deepEqual(parseContact('MECARD:N:Doe,John;TEL:123;EMAIL:j@d.com;;'), [
    { key: 'name', value: 'John Doe' },
    { key: 'phone', value: '123' },
    { key: 'email', value: 'j@d.com' },
  ]);
});

test('what a scanned code holds: a link, Wi-Fi, a contact, or text', () => {
  assert.deepEqual(parseScanned('https://ewolution.cloud/x?y=1'), { kind: 'link', url: 'https://ewolution.cloud/x?y=1' });
  assert.equal(parseScanned('WIFI:T:WPA;S:Home;P:pw;;').kind, 'wifi');
  assert.equal(parseScanned('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:A\r\nEND:VCARD').kind, 'contact');
  assert.deepEqual(parseScanned('javascript:alert(1)'), { kind: 'text', text: 'javascript:alert(1)' }, 'only http(s) is a link');
  assert.deepEqual(parseScanned('Hello there'), { kind: 'text', text: 'Hello there' });
});

test('made and read back: links, Wi-Fi, contacts, umlauts and emoji, every error correction level', () => {
  const card = vcard({ first: 'Jürgen', last: 'Groß', phone: '+49 1', email: 'j@g.de', org: 'Bäckerei; Süß' });
  const net = wifi({ ssid: 'Gäste;WLAN', password: 'pa:ss,wö"rd', auth: 'WPA', hidden: true });
  for (const text of ['https://ewolution.cloud', net, card, 'Grüße 👋🏽 aus Köln', '12345678901234567890', 'HELLO WORLD']) {
    for (const ecc of ['L', 'M', 'Q', 'H']) assert.equal(roundTrip(text, ecc), text, `${ecc}: ${text}`);
  }
  assert.deepEqual(parseScanned(roundTrip(net)), { kind: 'wifi', ssid: 'Gäste;WLAN', password: 'pa:ss,wö"rd', auth: 'WPA', hidden: true });
});

test('the quiet zone: four light modules on every side', () => {
  const m = matrix('https://example.com', 'M');
  assert.equal(m.size, m.modules.length);
  assert.equal(m.size, 17 + 4 * m.version + 2 * QUIET);
  for (let i = 0; i < m.size; i++) {
    for (let q = 0; q < QUIET; q++) {
      assert.ok(!m.modules[q][i] && !m.modules[m.size - 1 - q][i] && !m.modules[i][q] && !m.modules[i][m.size - 1 - q], `module at ${q},${i} in the quiet zone`);
    }
  }
  assert.ok(m.modules[QUIET][QUIET], 'the finder pattern starts right after it');
});

test('more error correction, a bigger code; too much text, a clear error', () => {
  assert.ok(matrix('https://example.com/a/longer/path', 'H').size > matrix('https://example.com/a/longer/path', 'L').size);
  assert.throws(() => matrix('x'.repeat(3000), 'H'), TooLong);
  assert.doesNotThrow(() => matrix('a\ud800b', 'L'), 'a lone surrogate doesn’t break it');
});

test('the SVG: one path whose rectangles cover exactly the dark modules', () => {
  const m = matrix('Fundus', 'Q');
  const d = svgPath(m);
  const covered = new Set();
  for (const [, x, y, run] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) for (let k = 0; k < Number(run); k++) covered.add(`${Number(x) + k},${y}`);
  const dark = new Set();
  m.modules.forEach((row, y) => row.forEach((on, x) => on && dark.add(`${x},${y}`)));
  assert.deepEqual([...covered].sort(), [...dark].sort());
  const file = svgFile(m);
  assert.match(file, /^<\?xml[^>]+>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
  assert.match(file, /shape-rendering="crispEdges"/);
  assert.match(file, /<rect width="\d+" height="\d+" fill="#ffffff"\/>/, 'a white ground, so it scans on any paper or screen');
});

test('the PNG’s pixels: whole pixels per module, about 1000 wide', () => {
  const m = matrix('https://example.com', 'M');
  const scale = scaleFor(m.size);
  assert.equal(Number.isInteger(scale), true);
  const { data, width } = pixels(m, scale);
  assert.ok(width >= 1000 && width < 1000 + m.size, String(width));
  const at = (x, y) => data[(y * width + x) * 4];
  assert.equal(at(0, 0), 255, 'the quiet zone is white');
  assert.equal(at(QUIET * scale, QUIET * scale), 0, 'the finder’s corner is black');
  assert.equal(at(QUIET * scale - 1, QUIET * scale), 255, 'and sharp: the pixel before it is white');
  assert.equal(scaleFor(300), 4, 'never under four pixels a module');
});

test('bytes that aren’t UTF-8 are read as Latin-1 rather than lost', () => {
  assert.equal(scannedText({ data: '', binaryData: [0x47, 0x72, 0xfc, 0xdf, 0x65] }), 'Grüße');
  assert.equal(scannedText({ data: 'plain', binaryData: [] }), 'plain');
});
