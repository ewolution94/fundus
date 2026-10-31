import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainToUnicode } from 'node:url';
import { encodeUrl, decodeUrl, badEscape, readUrl, punycodeDecode, toUnicode } from '../../src/tools/url/url.ts';

test('a part (encodeURIComponent) or a whole link (encodeURI)', () => {
  const text = 'a b&c=d/e?f#g+ä€👋';
  assert.deepEqual(encodeUrl(text, false), { ok: true, text: 'a%20b%26c%3Dd%2Fe%3Ff%23g%2B%C3%A4%E2%82%AC%F0%9F%91%8B' });
  assert.deepEqual(encodeUrl('https://x.de/ä b?q=1&r=ü#top', true), { ok: true, text: 'https://x.de/%C3%A4%20b?q=1&r=%C3%BC#top' });
  // Both leave these alone.
  assert.equal(encodeUrl("-_.!~*'()", false).text, "-_.!~*'()");
});

test('half an emoji pair can’t be encoded: where it is', () => {
  assert.deepEqual(encodeUrl('ab\ud83dcd', false), { ok: false, error: { code: 'surrogate', index: 2 } });
  assert.deepEqual(encodeUrl('x\udc4b', true), { ok: false, error: { code: 'surrogate', index: 1 } });
});

test('decoding: a part, a whole link, and + as a space', () => {
  assert.deepEqual(decodeUrl('a%20b%26c%2F%C3%A4+x', false, false), { ok: true, text: 'a b&c/ä+x' });
  assert.deepEqual(decodeUrl('a%20b%26c%2F%C3%A4+x', false, true), { ok: true, text: 'a b&c/ä x' });
  // decodeURI keeps the escapes of / ? & = # so the link's shape holds.
  assert.deepEqual(decodeUrl('https://x.de/a%2Fb%20c?q=%26%C3%BC', true, false), { ok: true, text: 'https://x.de/a%2Fb c?q=%26ü' });
});

test('a broken escape: which, and where', () => {
  assert.deepEqual(decodeUrl('100%', false, false).error, { code: 'percent', index: 3, found: '%' });
  assert.deepEqual(decodeUrl('50%zz off', false, false).error, { code: 'percent', index: 2, found: '%zz' });
  assert.deepEqual(decodeUrl('ok%C3%A4%E4', false, false).error, { code: 'utf8', index: 8, found: '%E4' });
  assert.deepEqual(decodeUrl('x%C3%28', false, false).error, { code: 'utf8', index: 1, found: '%C3%28' });
  assert.deepEqual(decodeUrl('%C0%AF', false, false).error, { code: 'utf8', index: 0, found: '%C0' }, 'an overlong /');
  assert.deepEqual(decodeUrl('%ED%A0%80', false, false).error, { code: 'utf8', index: 0, found: '%ED%A0' }, 'an encoded surrogate');
  assert.deepEqual(decodeUrl('%F4%90%80%80', false, false).error, { code: 'utf8', index: 0, found: '%F4%90' }, 'past U+10FFFF');
  assert.deepEqual(decodeUrl('%E2%82', true, false).error, { code: 'utf8', index: 0, found: '%E2%82' });
  // Exactly where decodeURIComponent throws, over many broken texts.
  const pieces = ['%', '%4', '%41', '%C3', '%A4', '%E2%82%AC', '%F0%9F', '%91%8B', 'a', '+', '%zz', '%FF'];
  let seed = 7;
  for (let k = 0; k < 3000; k++) {
    let s = '';
    for (let j = 0; j < 4; j++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      s += pieces[seed % pieces.length];
    }
    let throws = false;
    try {
      decodeURIComponent(s);
    } catch {
      throws = true;
    }
    if (throws) {
      const e = badEscape(s);
      assert.ok(e.index >= 0, `found nothing in ${s}`);
      // Everything before the mistake decodes.
      assert.doesNotThrow(() => decodeURIComponent(s.slice(0, e.index)), s);
    }
  }
});

test('a link in its parts, odd encodings and all', () => {
  const r = readUrl('https://J%C3%BCrgen:p%40ss@xn--bcher-kva.de/caf%C3%A9/a%2Fb?q=caf%C3%A9+au+lait&tag=%F0%9F%91%8B&empty=&flag&q=2&&x=%zz#Abschnitt%20%C3%9C');
  assert.ok(r.ok);
  const p = r.parts;
  assert.equal(p.protocol, 'https:');
  assert.equal(p.username, 'Jürgen');
  assert.equal(p.password, 'p@ss');
  assert.equal(p.hostname, 'xn--bcher-kva.de');
  assert.equal(p.hostUnicode, 'bücher.de');
  assert.equal(p.port, '');
  assert.equal(p.defaultPort, '443');
  assert.equal(p.path, '/caf%C3%A9/a%2Fb');
  assert.equal(p.pathDecoded, '/café/a%2Fb');
  assert.equal(p.hash, '#Abschnitt%20%C3%9C');
  assert.equal(p.hashDecoded, 'Abschnitt Ü');
  assert.equal(p.origin, 'https://xn--bcher-kva.de');
  assert.deepEqual(
    p.params.map((x) => [x.key, x.value, x.rawValue, x.bare]),
    [
      ['q', 'café au lait', 'caf%C3%A9+au+lait', false],
      ['tag', '👋', '%F0%9F%91%8B', false],
      ['empty', '', '', false],
      ['flag', '', '', true],
      ['q', '2', '2', false],
      ['x', '%zz', '%zz', false],
    ],
  );
});

test('a host typed in its own letters comes back as punycode, with both shown', () => {
  const p = readUrl('http://Bücher.de:8080/').parts;
  assert.equal(p.hostname, 'xn--bcher-kva.de');
  assert.equal(p.hostUnicode, 'bücher.de');
  assert.equal(p.port, '8080');
  assert.equal(p.defaultPort, null);
});

test('no scheme: read as https, and says so; other schemes as they are', () => {
  const a = readUrl('  example.com/a?b=c  ');
  assert.ok(a.ok && a.parts.assumed);
  assert.equal(a.parts.href, 'https://example.com/a?b=c');
  const b = readUrl('localhost:3000/x');
  assert.equal(b.parts.hostname, 'localhost');
  assert.equal(b.parts.port, '3000');
  const m = readUrl('mailto:anna@example.com?subject=Gr%C3%BC%C3%9Fe&body=Hallo+du');
  assert.ok(!m.parts.assumed);
  assert.equal(m.parts.protocol, 'mailto:');
  assert.equal(m.parts.path, 'anna@example.com');
  assert.deepEqual(m.parts.params.map((x) => [x.key, x.value]), [['subject', 'Grüße'], ['body', 'Hallo du']]);
  assert.equal(m.parts.origin, '');
  assert.equal(readUrl('http://[::1]:8080/').parts.hostname, '[::1]');
});

test('what isn’t a URL says so', () => {
  assert.deepEqual(readUrl('   '), { ok: false, code: 'empty' });
  assert.deepEqual(readUrl('http://exa mple.com'), { ok: false, code: 'invalid' });
  assert.deepEqual(readUrl('https://'), { ok: false, code: 'invalid' });
  assert.deepEqual(readUrl('http://x:99999/'), { ok: false, code: 'invalid' });
});

test('punycode, against node’s own', () => {
  assert.equal(punycodeDecode('bcher-kva'), 'bücher');
  assert.equal(punycodeDecode('mnchen-3ya'), 'münchen');
  for (const host of ['xn--wgv71a119e.jp', 'xn--fiqs8s.xn--fiqz9s', 'xn--n3h.example', 'xn--ls8h.la', 'www.xn--strae-oqa.de', 'plain.example.com', 'xn--80akhbyknj4f.xn--p1ai']) {
    assert.equal(toUnicode(host), domainToUnicode(host), host);
  }
  assert.equal(punycodeDecode('ü-bad'), null);
  assert.equal(punycodeDecode('99999999999'), null);
});
