import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encode, decode, encodeText, asText, parseDataUrl, isDataUrl, dataUrl, sniffBytes, encodedLength, extFor } from '../../src/tools/base64/base64.ts';
import { sniff } from '../../src/lib/files.ts';

const bytes = (s) => new TextEncoder().encode(s);
const ok = (text) => {
  const d = decode(text);
  assert.ok(d.ok, `should decode: ${text} (${JSON.stringify(d.error)})`);
  return d;
};

test('RFC 4648 §10 test vectors, both ways', () => {
  const vectors = [
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ];
  for (const [plain, b64] of vectors) {
    assert.equal(encode(bytes(plain)), b64, plain);
    assert.equal(new TextDecoder().decode(ok(b64).bytes), plain, b64);
    // Without padding (§3.2), and decoding that too.
    assert.equal(encode(bytes(plain), { pad: false }), b64.replace(/=+$/, ''));
    assert.equal(new TextDecoder().decode(ok(b64.replace(/=+$/, '')).bytes), plain);
  }
});

test('the URL-safe alphabet (§5): - and _ for + and /', () => {
  const b = new Uint8Array([0xfb, 0xff, 0xbf, 0x3e]);
  assert.equal(encode(b), '+/+/Pg==');
  assert.equal(encode(b, { url: true }), '-_-_Pg==');
  assert.equal(encode(b, { url: true, pad: false }), '-_-_Pg');
  const d = ok('-_-_Pg');
  assert.deepEqual([...d.bytes], [...b]);
  assert.equal(d.alphabet, 'url');
  assert.equal(ok('+/+/Pg==').alphabet, 'standard');
  assert.equal(ok('Zm9v').alphabet, 'either');
});

test('matches node’s Base64 on random bytes of every length up to 300, and back', () => {
  for (let n = 0; n <= 300; n++) {
    const b = randomBytes(n);
    const std = b.toString('base64');
    assert.equal(encode(b), std, `${n} bytes`);
    assert.equal(encode(b, { url: true, pad: false }), b.toString('base64url'), `${n} bytes, url`);
    assert.deepEqual(Buffer.from(ok(std).bytes), b, `${n} bytes back`);
  }
});

test('a megabyte, across the encoder’s slices', () => {
  const b = randomBytes(1_000_003);
  const std = b.toString('base64');
  assert.equal(encode(b), std);
  assert.ok(Buffer.from(ok(std).bytes).equals(b));
  assert.equal(encodedLength(b.length), std.length);
  assert.equal(encodedLength(b.length, false), b.toString('base64url').length);
});

test('UTF-8 text: umlauts, ß, emoji', () => {
  for (const text of ['Grüße aus Köln', 'ß', '👋🏽 hi', '€', '日本語', '']) {
    const b64 = encodeText(text);
    assert.equal(b64, Buffer.from(text, 'utf8').toString('base64'), text);
    assert.equal(asText(ok(b64).bytes), text);
  }
});

test('line breaks and spaces in the text are skipped (MIME, PEM)', () => {
  const b = randomBytes(200);
  const wrapped = b.toString('base64').replace(/.{76}/g, '$&\r\n');
  assert.ok(Buffer.from(ok(`  ${wrapped}\n`).bytes).equals(b));
});

test('mistakes say what and where, in the text as given', () => {
  assert.deepEqual(decode('Zm9v*mFy').error, { code: 'char', index: 4, char: '*' });
  assert.deepEqual(decode('Zm9v\nYm ä').error, { code: 'char', index: 8, char: 'ä' });
  assert.deepEqual(decode('Zm9v👋').error, { code: 'char', index: 4, char: '👋' });
  assert.deepEqual(decode('Zm9vY').error, { code: 'length', length: 5 });
  assert.deepEqual(decode('Zg=x').error, { code: 'padding', index: 2 });
  assert.deepEqual(decode('Zg===').error, { code: 'padding', index: 2 });
  assert.deepEqual(decode('Zm8==').error, { code: 'padding', index: 3 });
  assert.deepEqual(decode('Zg=').error, { code: 'padding', index: 2 });
  assert.deepEqual(decode('ab+c-d__').error, { code: 'mixed', index: 4 });
});

test('bytes that aren’t UTF-8 are not text', () => {
  assert.equal(asText(new Uint8Array([0xff, 0xfe, 0x00])), null);
  assert.equal(asText(new Uint8Array([0xc3])), null);
  assert.equal(asText(bytes('﻿hi')), 'hi');
});

test('data: URLs, Base64 and percent-encoded', () => {
  assert.ok(isDataUrl('  DATA:text/plain,hi'));
  assert.ok(!isDataUrl('ZGF0YTo='));
  const a = parseDataUrl('data:image/PNG;base64,iVBORw0KGgo=');
  assert.equal(a.url.mime, 'image/png');
  assert.deepEqual([...a.url.bytes], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const b = parseDataUrl('data:text/plain;charset=utf-8,Gr%C3%BC%C3%9Fe%20%F0%9F%91%8B');
  assert.equal(b.url.mime, 'text/plain');
  assert.equal(asText(b.url.bytes), 'Grüße 👋');
  const c = parseDataUrl('data:,Grüße 👋!');
  assert.equal(c.url.mime, null);
  assert.equal(asText(c.url.bytes), 'Grüße 👋!');
  assert.equal(parseDataUrl('data:;base64,Zm9v').url.mime, null);
  // A mistake's place counts from the start of the URL.
  assert.deepEqual(parseDataUrl('data:image/png;base64,iVB*').error, { code: 'char', index: 25, char: '*' });
  assert.deepEqual(parseDataUrl('data:text/plain,50%zz').error, { code: 'percent', index: 18 });
  assert.equal(parseDataUrl('not a data url'), null);
  assert.equal(dataUrl(bytes('hi'), 'text/plain'), 'data:text/plain;base64,aGk=');
});

test('what the bytes are: photos and PDFs from lib/files, the rest here', () => {
  const kind = (b) => sniffBytes(b, sniff(b));
  // Only the start counts, so a PNG's signature and header and a PDF's first line are enough (CI has
  // no sample files: they're made locally, by `npm run fixtures`).
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  assert.deepEqual(kind(png), { label: 'PNG', mime: 'image/png', ext: 'png' });
  assert.equal(kind(bytes('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n')).ext, 'pdf');
  assert.equal(kind(new Uint8Array([0x50, 0x4b, 3, 4, 20, 0])).ext, 'zip');
  assert.equal(kind(new Uint8Array([0x1f, 0x8b, 8, 0])).ext, 'gz');
  assert.equal(kind(bytes('ID3\x04\0\0\0')).ext, 'mp3');
  assert.equal(kind(bytes('RIFF\0\0\0\0WAVEfmt ')).ext, 'wav');
  assert.equal(kind(bytes('\0\0\0\x18ftypisom')).ext, 'mp4');
  assert.equal(kind(bytes('\0asm\x01\0\0\0')).ext, 'wasm');
  assert.equal(kind(bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')).ext, 'svg');
  assert.equal(kind(bytes('{"a": [1, 2]}')).ext, 'json');
  assert.equal(kind(bytes('Grüße, plain text\n')).ext, 'txt');
  // Text whose first 4 KB end in the middle of a character is still text.
  assert.equal(kind(bytes(`${'a'.repeat(4095)}ü and more`)).ext, 'txt');
  assert.deepEqual(kind(new Uint8Array([0, 1, 2, 3, 0xff, 0xfe])), { label: '', mime: 'application/octet-stream', ext: 'bin' });
  assert.equal(extFor('image/jpeg'), 'jpg');
  assert.equal(extFor('application/x-unknown'), null);
});
