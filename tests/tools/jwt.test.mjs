import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { decode, verify, times, standing, algOf, readKey, indentJson, relative, duration, dateIn, validZone, clean, hasEd25519, pkcs1ToSpki, spkiKind } from '../../src/tools/jwt/jwt.ts';

// jwt.io's example: HS256 with the secret "your-256-bit-secret".
const EXAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// A self-signed test certificate (RSA 2048, CN "Fundus test") and a token signed with its key,
// which isn't kept anywhere.
const CERT = `-----BEGIN CERTIFICATE-----
MIIC7jCCAdagAwIBAgIUOwgUDQkjcPDx+1JtokJOR3f8qOIwDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAwwLRnVuZHVzIHRlc3QwIBcNMjYxMTAxMTMyNzU5WhgPMjEy
NjEwMDgxMzI3NTlaMBYxFDASBgNVBAMMC0Z1bmR1cyB0ZXN0MIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyti8KEwKKLA3QH3dFe/f5rD6iika8RQJ43F8
5DJekEne5nbCcMje4Z0gjJe/9wC5L4OTTl9EEtngcOl+HAYIYmPPdnT2P+l+AKqA
j4UUY1Rlg19s7E5AfOGefL7zsvsWASy477j+/mmyNISmE0vzQBrHlnlI1DrEIswM
OhFzyDj09RPHiIvU0ZyM8CUH6zOIIccjt2lxeon4wuZyM9cDQs415DOEmBdJ8XSL
5ENZq1Cki0s4JUhc0Gaj3CS6+NaG5TKMvCrcQtIODMdOWZe0rFUetYS42vPASXr2
TDf7P8FZj1+kPt32tebiQp5BGw1442W04WHcfAFtQemdwpjo6QIDAQABozIwMDAd
BgNVHQ4EFgQUP1w/h+LmrN188lgziJvh4vl9yFgwDwYDVR0TAQH/BAUwAwEB/zAN
BgkqhkiG9w0BAQsFAAOCAQEAiyohC/KIDaOwI9mUce6C/HcdTervIJPlhqjI4xpU
PbieyMclU2p6Iu6dR4shA71LDL/D8XIZOkMBWki5NiIrevYz1yx0je92wNrEFEkl
+MhnKhVWa4llDKkTcuvaRR68D0aZLHQxYafvDLHyAgrdP6Ktrek+8OH59aKBtWyi
DZPpKYgzzly75Ew2HuiLcKPs4eq38h6QLNZNQkluxMXyh3V3WRpXH0mRDNfvw8/f
rGMRgBS2N4aloI7Tr2cCPUWdJ/2iLZoJWCqohNFur+lyMFGAliPS+B0hX9br1VV+
e5ZtlU3K2xcKGToVFMi7IO8pOcXzHuWJu4BbMAzwW772fQ==
-----END CERTIFICATE-----`;
const CERT_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImNlcnQtMSJ9.eyJzdWIiOiJjZXJ0aWZpY2F0ZSIsImlhdCI6MTc2MTk0MjAwMH0.opjOSHV8uHC7arn18v9IsP2Oa0yfksJOuehvNW-zn1-0WCQKO5g4N6oD81nkl_d5mZAPJTOxjaOHc1mLJhDKd2GopCc48HEWyWEgvnqPajOiotJSqDUUnrhxZ1rh2MhFCMHsrfwWjZEqerHpOtx2V3Z2V91ye-xFlkMIro63CZ0WWKiGiD4ZWLneCL9nXhGUvKEokapRDBPck4i4gIdQ57SFdqjGNnmPeLzl4sCGhGhbOYwaFCrBR1enw65AdHZtTpAnNO8c7dBr7lpC2adN2QDbwnpgGrCGgo3nXyWAbmGTkt7uxlywZszaiyjKOctMOmAvqngwaPgy3RiG_ib-EA';

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

/** A token signed here with node:crypto, the way any JWT library signs. */
function sign(alg, key, payload = { sub: 'fundus', exp: 2_000_000_000 }, header = {}) {
  const input = `${b64({ alg, typ: 'JWT', ...header })}.${b64(payload)}`;
  const bits = alg.slice(2);
  let sig;
  if (alg.startsWith('HS')) sig = crypto.createHmac(`sha${bits}`, key).update(input).digest();
  else if (alg.startsWith('RS')) sig = crypto.sign(`sha${bits}`, Buffer.from(input), key);
  else if (alg.startsWith('PS')) sig = crypto.sign(`sha${bits}`, Buffer.from(input), { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(bits) / 8 });
  else if (alg.startsWith('ES')) sig = crypto.sign(`sha${bits}`, Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  else sig = crypto.sign(null, Buffer.from(input), key);
  return `${input}.${sig.toString('base64url')}`;
}

const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = {
  ES256: crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }),
  ES384: crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' }),
  ES512: crypto.generateKeyPairSync('ec', { namedCurve: 'P-521' }),
};
const ed = crypto.generateKeyPairSync('ed25519');
const pairOf = (alg) => (alg.startsWith('ES') ? ec[alg] : alg === 'EdDSA' ? ed : rsa);
const pem = (pair) => pair.publicKey.export({ type: 'spki', format: 'pem' });
const jwk = (pair, extra = {}) => ({ ...pair.publicKey.export({ format: 'jwk' }), ...extra });

const ok = (token) => {
  const d = decode(token);
  assert.ok(d?.ok, JSON.stringify(d));
  return d;
};

test('the example token: header, payload, algorithm', () => {
  const d = ok(EXAMPLE);
  assert.deepEqual(d.header, { alg: 'HS256', typ: 'JWT' });
  assert.equal(d.headerText, '{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  assert.equal(d.payloadText, '{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}');
  assert.equal(d.alg, 'HS256');
  assert.equal(d.signature.length, 32);
  assert.deepEqual(algOf('HS256'), { family: 'HS', hash: 'SHA-256' });
});

test('HS256 with its secret, as text or Base64; a wrong one fails', async () => {
  const d = ok(EXAMPLE);
  assert.deepEqual(await verify(d, { secret: 'your-256-bit-secret' }), { ok: true, valid: true });
  assert.deepEqual(await verify(d, { secret: 'your-256-bit-secreT' }), { ok: true, valid: false });
  assert.deepEqual(await verify(d, { secret: Buffer.from('your-256-bit-secret').toString('base64'), base64: true }), { ok: true, valid: true });
  assert.deepEqual(await verify(d, { secret: Buffer.from('your-256-bit-secret').toString('base64url'), base64: true }), { ok: true, valid: true });
  assert.deepEqual(await verify(d, { secret: JSON.stringify({ kty: 'oct', k: b64('your-256-bit-secret') }) }), { ok: true, valid: true }, 'a JWK of kty oct');
  assert.deepEqual(await verify(d, { secret: '' }), { ok: false, problem: 'empty' });
  assert.deepEqual(await verify(d, { secret: 'not*base64', base64: true }), { ok: false, problem: 'secretBase64' });
});

test('HS384 and HS512', async () => {
  for (const alg of ['HS384', 'HS512']) {
    const d = ok(sign(alg, 'a secret'));
    assert.deepEqual(await verify(d, { secret: 'a secret' }), { ok: true, valid: true }, alg);
    assert.deepEqual(await verify(d, { secret: 'another' }), { ok: true, valid: false }, alg);
  }
});

test('RS, PS, ES and EdDSA: with a PEM, a JWK and a JWK set; a changed payload fails', async () => {
  const edOk = await hasEd25519();
  for (const alg of ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA']) {
    if (alg === 'EdDSA' && !edOk) continue;
    const pair = pairOf(alg);
    const d = ok(sign(alg, pair.privateKey, { sub: alg }, { kid: 'two' }));
    assert.deepEqual(await verify(d, { key: pem(pair) }), { ok: true, valid: true }, `${alg} PEM`);
    assert.deepEqual(await verify(d, { key: JSON.stringify(jwk(pair, { use: 'sig', key_ops: ['verify'] })) }), { ok: true, valid: true }, `${alg} JWK`);
    const set = { keys: [jwk(crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }), { kid: 'one' }), jwk(pair, { kid: 'two' })] };
    assert.deepEqual(await verify(d, { key: JSON.stringify(set) }), { ok: true, valid: true }, `${alg} JWKS by kid`);
    const forged = { ...d, signingInput: `${d.signingInput.split('.')[0]}.${b64({ sub: 'someone else' })}` };
    assert.deepEqual(await verify(forged, { key: pem(pair) }), { ok: true, valid: false }, `${alg} forged`);
  }
});

test('Ed25519 is there in node, as the alg EdDSA or Ed25519', async () => {
  assert.equal(await hasEd25519(), true);
  const d = ok(sign('Ed25519', ed.privateKey));
  assert.deepEqual(await verify(d, { key: pem(ed) }), { ok: true, valid: true });
  assert.deepEqual(await verify(ok(sign('EdDSA', ed.privateKey)), { key: pem(crypto.generateKeyPairSync('ed25519')) }), { ok: true, valid: false });
});

test('a certificate and a PKCS#1 key work as the public key', async () => {
  assert.deepEqual(await verify(ok(CERT_TOKEN), { key: CERT }), { ok: true, valid: true });
  const d = ok(sign('RS256', rsa.privateKey));
  assert.deepEqual(await verify(d, { key: rsa.publicKey.export({ type: 'pkcs1', format: 'pem' }) }), { ok: true, valid: true });
  const pkcs1 = rsa.publicKey.export({ type: 'pkcs1', format: 'der' });
  assert.deepEqual(Buffer.from(pkcs1ToSpki(new Uint8Array(pkcs1))), rsa.publicKey.export({ type: 'spki', format: 'der' }));
  // Bare Base64 of the SPKI, without the PEM lines.
  const bare = rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  assert.deepEqual(await verify(d, { key: bare }), { ok: true, valid: true });
});

test('keys that don’t fit are named', async () => {
  const rs = ok(sign('RS256', rsa.privateKey));
  const es = ok(sign('ES256', ec.ES256.privateKey, { a: 1 }, { kid: 'k' }));
  assert.deepEqual(await verify(rs, { key: pem(ec.ES256) }), { ok: false, problem: 'rsaWanted' });
  assert.deepEqual(await verify(es, { key: pem(rsa) }), { ok: false, problem: 'ecWanted', want: 'P-256' });
  assert.deepEqual(await verify(es, { key: pem(ec.ES384) }), { ok: false, problem: 'curve', curve: 'P-384', want: 'P-256' });
  assert.deepEqual(await verify(es, { key: JSON.stringify(jwk(ec.ES384)) }), { ok: false, problem: 'curve', curve: 'P-384', want: 'P-256' });
  assert.deepEqual(await verify(rs, { key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }), { ok: false, problem: 'private' });
  assert.deepEqual(await verify(rs, { key: JSON.stringify(rsa.privateKey.export({ format: 'jwk' })) }), { ok: false, problem: 'private' });
  assert.deepEqual(await verify(rs, { key: 'hello' }), { ok: false, problem: 'pem' });
  assert.deepEqual(await verify(rs, { key: '{"a": 1}' }), { ok: false, problem: 'jwk' });
  assert.deepEqual(await verify(rs, { key: '{"kty": "oct", "k": "abc"}' }), { ok: false, problem: 'octWanted' });
  assert.deepEqual(await verify(es, { key: JSON.stringify({ keys: [jwk(ec.ES256, { kid: 'other' })] }) }), { ok: false, problem: 'kidMissing', n: 1, kid: 'k' });
  const noKid = ok(sign('ES256', ec.ES256.privateKey));
  assert.deepEqual(await verify(noKid, { key: JSON.stringify({ keys: [jwk(ec.ES256), jwk(ec.ES256)] }) }), { ok: false, problem: 'kidNeeded', n: 2, kid: undefined });
  assert.deepEqual(await verify(noKid, { key: JSON.stringify({ keys: [jwk(rsa), jwk(ec.ES256)] }) }), { ok: true, valid: true }, 'the only one that fits');
  // A DER signature (not JWT's r‖s) has the wrong length.
  const der = crypto.sign('sha256', Buffer.from(noKid.signingInput), ec.ES256.privateKey);
  assert.deepEqual(await verify({ ...noKid, signature: new Uint8Array(der) }, { key: pem(ec.ES256) }), { ok: true, valid: false, sigLength: { got: der.length, want: 64 } });
});

test('alg none and algorithms WebCrypto can’t check', async () => {
  const none = ok(`${b64({ alg: 'none' })}.${b64({ sub: 'x' })}.`);
  assert.equal(none.alg, 'none');
  assert.equal(none.signature.length, 0);
  assert.equal(algOf('none'), null);
  assert.deepEqual(await verify(none, { secret: 'x' }), { ok: false, problem: 'alg' });
  assert.equal(algOf('ES256K'), null);
  assert.deepEqual(await verify(ok(`${b64({ alg: 'Ed448' })}.${b64({})}.AA`), { key: 'x' }), { ok: false, problem: 'ed448' });
});

test('malformed tokens say what’s wrong', () => {
  assert.equal(decode(''), null);
  assert.deepEqual(decode('abc.def'), { code: 'parts', n: 2 });
  assert.deepEqual(decode('a.b.c.d.e'), { code: 'jwe' });
  assert.deepEqual(decode(`${b64({ alg: 'HS256' })}.ab*c.x`), { code: 'base64', part: 'payload', char: '*', position: b64({ alg: 'HS256' }).length + 4 });
  assert.deepEqual(decode(`${b64({ alg: 'HS256' })}.${b64({})}.abcde`), { code: 'length', part: 'signature' });
  assert.deepEqual(decode(`${b64('not json')}.${b64({})}.`), { code: 'json', part: 'header', text: 'not json' });
  assert.deepEqual(decode(`${b64('[1]')}.${b64({})}.`), { code: 'object', part: 'header' });
  assert.deepEqual(decode(`${Buffer.from([0xff, 0xfe]).toString('base64url')}.${b64({})}.`), { code: 'utf8', part: 'header' });
  const text = ok(`${b64({ alg: 'HS256' })}.${b64('just text')}.`);
  assert.equal(text.payloadJson, false);
  assert.equal(text.payload, null);
  assert.equal(text.payloadText, 'just text');
});

test('Bearer, spaces and line breaks are dropped', () => {
  assert.equal(clean(`  Bearer ${EXAMPLE.slice(0, 40)}\n${EXAMPLE.slice(40)}  `), EXAMPLE);
  assert.equal(clean(`"${EXAMPLE}"`), EXAMPLE, 'the quotes it had in JSON');
  assert.equal(clean(`Bearer “${EXAMPLE}”`), EXAMPLE);
  assert.equal(clean(`'Bearer ${EXAMPLE}'`), EXAMPLE);
  assert.ok(decode(`bearer ${EXAMPLE}`).ok);
});

test('JSON indented as written: big numbers, escapes, empty ones', () => {
  assert.equal(indentJson('{"n":12345678901234567890,"s":"a\\"b,c:{","e":{},"l":[ ],"x":[1,{"y":true}]}'), [
    '{',
    '  "n": 12345678901234567890,',
    '  "s": "a\\"b,c:{",',
    '  "e": {},',
    '  "l": [],',
    '  "x": [',
    '    1,',
    '    {',
    '      "y": true',
    '    }',
    '  ]',
    '}',
  ].join('\n'));
  assert.equal(ok(`${b64({ alg: 'HS256' })}.${b64('{"id":12345678901234567890}')}.`).payloadText, '{\n  "id": 12345678901234567890\n}');
});

test('times: expired, still valid, not yet, issued; standing', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  const s = now / 1000;
  const list = times({ exp: s - 3 * 86400, iat: s - 4 * 86400, nbf: s - 4 * 86400 }, now);
  assert.deepEqual(list.map((t) => [t.claim, t.past]), [['exp', true], ['nbf', true], ['iat', true]]);
  assert.equal(standing(list), 'expired');
  assert.equal(standing(times({ exp: s + 7200 }, now)), 'valid');
  assert.equal(standing(times({ exp: s + 7200, nbf: s + 3600 }, now)), 'notYet');
  assert.equal(standing(times({ iat: s }, now)), 'none');
  assert.equal(standing(times({ sub: 'x' }, now)), 'none');
  assert.deepEqual(times({ exp: '1700000000' }, now), [{ claim: 'exp', ok: false, raw: '"1700000000"' }]);
  assert.deepEqual(times({ exp: 1e20 }, now), [{ claim: 'exp', ok: false, raw: '100000000000000000000' }]);
  assert.equal(times({ exp: 1761942000.5 }, now)[0].ms, 1761942000500, 'a fraction of a second');
  assert.deepEqual(times(null, now), []);
});

test('how long ago, how long still, in English and German', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  assert.equal(relative(now - 3 * 86400_000, now, 'en'), '3 days ago');
  assert.equal(relative(now + 2 * 3600_000, now, 'en'), 'in 2 hours');
  assert.equal(relative(now - 3 * 86400_000, now, 'de'), 'vor 3 Tagen');
  assert.equal(relative(now - 1000, now, 'en'), '1 second ago', 'never "0 seconds"');
  assert.equal(duration(2 * 3600_000, 'en'), '2 hours');
  assert.equal(duration(2 * 3600_000, 'de'), '2 Stunden');
  assert.equal(duration(400 * 86400_000, 'en'), '1 year');
});

test('dates in the home zone', () => {
  assert.match(dateIn(1761942000_000, 'Europe/Berlin', 'en'), /^31 Oct 2025, 21:20:00 (CET|GMT\+1)$/);
  assert.match(dateIn(1761942000_000, 'UTC', 'de'), /^31\.10\.2025, 20:20:00 UTC$|^31\. Okt\. 2025, 20:20:00 UTC$/);
  assert.equal(validZone('Europe/Berlin'), 'Europe/Berlin');
  assert.equal(validZone('Mars/Olympus'), 'UTC');
});

test('a key read: what kind it is', () => {
  const k = readKey(pem(ec.ES384));
  assert.equal(k.type, 'spki');
  assert.deepEqual(spkiKind(k.der), { kind: 'ec', curve: 'P-384' });
  assert.deepEqual(spkiKind(readKey(pem(ed)).der), { kind: 'ed25519' });
  assert.deepEqual(spkiKind(readKey(CERT).der), { kind: 'rsa' });
  assert.deepEqual(readKey(''), { problem: 'empty' });
  assert.deepEqual(readKey('{"keys": []}'), { problem: 'noKeys' });
  assert.deepEqual(readKey('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----'), { problem: 'pem' });
});
