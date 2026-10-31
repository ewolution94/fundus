// F-906 Hashes: MD5 against RFC 1321's own vectors and node's crypto over every length and split,
// the SHA family against the FIPS 180 "abc" vectors, a blob read in slices, hex and Base64, and a
// pasted hash compared in all the forms people paste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Md5, md5, hashAll, hashBlob, TooBig, FILE_LIMIT, toHex, toBase64, compare } from '../../src/tools/hash/hash.ts';

const enc = (s) => new TextEncoder().encode(s);
const node = (algo, b) => createHash(algo).update(b).digest('hex');

test('MD5: the RFC 1321 test suite (appendix A.5)', () => {
  const suite = {
    '': 'd41d8cd98f00b204e9800998ecf8427e',
    a: '0cc175b9c0f1b6a831c399e269772661',
    abc: '900150983cd24fb0d6963f7d28e17f72',
    'message digest': 'f96b697d7cb7938d525a2f31aaf161d0',
    abcdefghijklmnopqrstuvwxyz: 'c3fcd3d76192e4007dfb496cca67e13b',
    ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789: 'd174ab98d277d9f5a5611c2c9f419d9f',
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890': '57edf4a22be3c955ac49da2e2107b67a',
  };
  for (const [input, want] of Object.entries(suite)) assert.equal(toHex(md5(enc(input))), want, input);
});

test('MD5: every length around the 64-byte blocks, and fed in random pieces, as node has it', () => {
  for (let n = 0; n <= 300; n++) {
    const b = randomBytes(n);
    assert.equal(toHex(md5(b)), node('md5', b), `length ${n}`);
  }
  for (let round = 0; round < 200; round++) {
    const b = randomBytes(Math.floor(Math.random() * 5000));
    const m = new Md5();
    let at = 0;
    while (at < b.length) {
      const step = Math.floor(Math.random() * 150);
      m.update(b.subarray(at, at + step));
      at += step;
    }
    assert.equal(toHex(m.digest()), node('md5', b));
  }
  const big = randomBytes(3 * 1024 * 1024 + 17);
  assert.equal(toHex(md5(big)), node('md5', big));
});

test('SHA-1, SHA-256, SHA-384, SHA-512: FIPS 180’s "abc", and node’s on random bytes', async () => {
  const d = await hashAll(enc('abc'));
  assert.equal(toHex(d.sha1), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(toHex(d.sha256), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(toHex(d.sha384), 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7');
  assert.equal(toHex(d.sha512), 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
  assert.equal(toHex(d.md5), '900150983cd24fb0d6963f7d28e17f72');
  const empty = await hashAll(new Uint8Array(0));
  assert.equal(toHex(empty.sha256), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const b = randomBytes(100_001);
  const r = await hashAll(b);
  for (const a of ['md5', 'sha1', 'sha256', 'sha384', 'sha512']) assert.equal(toHex(r[a]), node(a, b), a);
});

test('a blob read in slices: the same digests, the progress, a newer request wins', async () => {
  const b = randomBytes(100_000);
  const seen = [];
  const d = await hashBlob(new Blob([b]), { chunk: 7000, onProgress: (done, total) => seen.push([done, total]) });
  for (const a of ['md5', 'sha1', 'sha256', 'sha384', 'sha512']) assert.equal(toHex(d[a]), node(a, b), a);
  assert.equal(seen.length, Math.ceil(100_000 / 7000));
  assert.deepEqual(seen.at(-1), [100_000, 100_000]);
  assert.ok(seen.every(([x], i) => i === 0 || x > seen[i - 1][0]));
  // Empty.
  assert.equal(toHex((await hashBlob(new Blob([]))).md5), 'd41d8cd98f00b204e9800998ecf8427e');
  // Stale: another file was picked meanwhile.
  let calls = 0;
  assert.equal(await hashBlob(new Blob([b]), { chunk: 7000, stale: () => ++calls > 3 }), null);
  // Over the limit: said before reading.
  await assert.rejects(hashBlob({ size: FILE_LIMIT + 1 }), (e) => e instanceof TooBig && e.size === FILE_LIMIT + 1);
});

test('hex either case, Base64 like node’s', async () => {
  const d = await hashAll(enc('abc'));
  assert.equal(toHex(d.md5, true), '900150983CD24FB0D6963F7D28E17F72');
  for (const n of [0, 1, 2, 3, 16, 20, 32, 48, 64]) {
    const b = randomBytes(n);
    assert.equal(toBase64(b), b.toString('base64'));
  }
  assert.equal(toBase64(d.sha256), 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
});

test('compare: every form a hash is pasted in', async () => {
  const d = await hashAll(enc('abc'));
  const sha256 = toHex(d.sha256);
  const match = (algo, form = 'hex') => ({ state: 'match', algo, form });
  assert.equal(compare('', d), null);
  assert.equal(compare('  \n', d), null);
  assert.deepEqual(compare(sha256, d), match('sha256'));
  assert.deepEqual(compare(` ${sha256.toUpperCase()}\n`, d), match('sha256'));
  assert.deepEqual(compare(toHex(d.md5), d), match('md5'));
  assert.deepEqual(compare(toHex(d.sha1), d), match('sha1'));
  assert.deepEqual(compare(toHex(d.sha384), d), match('sha384'));
  assert.deepEqual(compare(toHex(d.sha512), d), match('sha512'));
  // Pairs split by colons or spaces (certificate viewers, some download pages).
  assert.deepEqual(compare(sha256.match(/../g).join(':').toUpperCase(), d), match('sha256'));
  assert.deepEqual(compare(sha256.match(/../g).join(' '), d), match('sha256'));
  // sha256sum's line, text or binary mode; BSD's.
  assert.deepEqual(compare(`${sha256}  abc.txt`, d), match('sha256'));
  assert.deepEqual(compare(`${sha256} *abc.bin`, d), match('sha256'));
  assert.deepEqual(compare(`SHA256 (abc.txt) = ${sha256}`, d), match('sha256'));
  assert.deepEqual(compare(`MD5 (my file.txt) = ${toHex(d.md5)}`, d), match('md5'));
  // Base64, Base64url, Subresource Integrity, a named prefix.
  assert.deepEqual(compare(toBase64(d.sha256), d), match('sha256', 'base64'));
  assert.deepEqual(compare(toBase64(d.sha256).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''), d), match('sha256', 'base64'));
  assert.deepEqual(compare(`sha384-${toBase64(d.sha384)}`, d), match('sha384', 'base64'));
  assert.deepEqual(compare(`sha512-${toBase64(d.sha512)}`, d), match('sha512', 'base64'));
  assert.deepEqual(compare(`SHA256:${sha256}`, d), match('sha256'));
  assert.deepEqual(compare(`sha-1: ${toHex(d.sha1)}`, d), match('sha1'));
});

test('compare: a mismatch says which hash it would be; other lengths and nonsense say so', async () => {
  const d = await hashAll(enc('abc'));
  const off = toHex(d.sha256).slice(0, -1) + '0';
  assert.deepEqual(compare(off, d), { state: 'mismatch', algo: 'sha256', form: 'hex' });
  assert.deepEqual(compare('0'.repeat(32), d), { state: 'mismatch', algo: 'md5', form: 'hex' });
  assert.deepEqual(compare(`sha256-${toBase64(new Uint8Array(32))}`, d), { state: 'mismatch', algo: 'sha256', form: 'base64' });
  // Named MD5 but it's the SHA-256: no match, and no MD5 has that length.
  assert.equal(compare(`md5-${toHex(d.sha256)}`, d).state, 'length');
  assert.deepEqual(compare('abcdef0123', d), { state: 'length', digits: 10, form: 'hex', bytes: 5 });
  assert.deepEqual(compare('not a hash!', d), { state: 'unreadable' });
  assert.deepEqual(compare('zzzz%%', d), { state: 'unreadable' });
});
