// F-907 JWTs: the well-known HS256 example with its secret (as text and as Base64), RS256 and ES256
// tokens signed here in Node and checked with their PEM keys, EdDSA where the engine has it, alg none
// called out, a broken token named, the times in words, a paste on the home, nothing kept, German.

import crypto from 'node:crypto';

/** The example everyone knows, with its secret. */
const EXAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const SECRET = 'your-256-bit-secret';

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

/** A token signed here with node:crypto, the way any JWT library signs. */
function sign(alg, key, payload = { sub: 'fundus', exp: 2_000_000_000 }) {
  const input = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
  const bits = alg.slice(2);
  let sig;
  if (alg.startsWith('HS')) sig = crypto.createHmac(`sha${bits}`, key).update(input).digest();
  else if (alg.startsWith('RS')) sig = crypto.sign(`sha${bits}`, Buffer.from(input), key);
  else if (alg.startsWith('ES')) sig = crypto.sign(`sha${bits}`, Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  else sig = crypto.sign(null, Buffer.from(input), key);
  return `${input}.${sig.toString('base64url')}`;
}

const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ed = crypto.generateKeyPairSync('ed25519');
const pem = (pair) => pair.publicKey.export({ type: 'spki', format: 'pem' });

const regionText = (page, name) => page.getByRole('region', { name, exact: true }).locator('pre').evaluate((el) => el.textContent);
const verdict = (page) => page.locator('.verdict').innerText();
const until = (page, text) => page.locator('.verdict').getByText(text, { exact: false }).waitFor();

export default {
  async 'the example token: header, payload, and its secret checked'({ open, fill, check, assert, page, sees }) {
    await open('/jwt');
    await sees('Paste a token');
    await fill('Token', EXAMPLE);
    assert.equal(await regionText(page, 'Header'), '{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
    assert.equal(await regionText(page, 'Payload'), '{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}');
    await sees('HMAC with SHA-256');
    await sees('32 bytes');
    await sees('Type the secret to check the signature.');
    await fill('Secret', SECRET);
    await until(page, 'Valid: the signature fits this secret.');
    await fill('Secret', 'your-256-bit-secreT');
    await until(page, 'Not valid: the signature doesn’t fit this secret.');
    // The same secret as Base64.
    await check('Base64', true);
    await fill('Secret', Buffer.from(SECRET).toString('base64'));
    await until(page, 'Valid: the signature fits this secret.');
    await fill('Secret', 'not base64!');
    await until(page, 'The secret isn’t Base64');
    await check('Base64', false);
    await fill('Secret', SECRET);
    await until(page, 'Valid:');
  },

  async 'the issued time in the home zone, with how long ago'({ open, fill, assert, page, sees }) {
    await open('/jwt');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ homeZone: 'UTC' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Token', EXAMPLE);
    const times = page.getByRole('region', { name: 'Times', exact: true });
    await times.waitFor();
    // WebKit's dates say "18 Jan 2018 at 01:30:22".
    assert.match(await times.innerText(), /18 Jan 2018(,| at) 01:30:22 UTC/);
    assert.match(await times.innerText(), /Issued \d+ years ago/);
  },

  async 'expired, still valid, not yet valid'({ open, fill, assert, page, sees }) {
    await open('/jwt');
    const now = Math.floor(Date.now() / 1000);
    const day = 86_400;
    await fill('Token', sign('HS256', 'k', { exp: now - 3 * day, iat: now - 4 * day }));
    await sees('Expired 3 days ago');
    await sees('Issued 4 days ago');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Expires');
    await fill('Token', sign('HS256', 'k', { exp: now + 2 * 3600 + 300 }));
    await sees('Valid for another 2 hours');
    await fill('Token', sign('HS256', 'k', { nbf: now + day + 600, exp: now + 2 * day }));
    await sees('Not valid yet: it starts in 1 day');
    assert.equal(await page.locator('.row.answer .lab').innerText(), 'Not before');
    await fill('Token', sign('HS256', 'k', { sub: 'no times' }));
    await sees('No times in it: no exp, nbf or iat.');
  },

  async 'RS256 signed in Node, checked with its PEM key'({ open, fill, assert, page, sees }) {
    await open('/jwt');
    await fill('Token', sign('RS256', rsa.privateKey));
    await sees('RSA with SHA-256');
    await sees('256 bytes');
    await sees('Paste the public key to check the signature.');
    await fill('Public key', pem(rsa));
    await until(page, 'Valid: the signature fits this key.');
    // Another RSA key: not valid. An EC key: the wrong kind.
    await fill('Public key', pem(crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })));
    await until(page, 'Not valid: the signature doesn’t fit this key.');
    await fill('Public key', pem(ec));
    await until(page, 'RS256 needs an RSA key.');
    // A private key is turned away.
    await fill('Public key', rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    await until(page, 'That’s a private key.');
    assert.ok(!(await verdict(page)).includes('Valid'));
  },

  async 'ES256 signed in Node, checked with its PEM key and as a JWK'({ open, fill, page, sees }) {
    await open('/jwt');
    await fill('Token', sign('ES256', ec.privateKey));
    await sees('ECDSA on P-256 with SHA-256');
    await sees('64 bytes');
    await fill('Public key', pem(ec));
    await until(page, 'Valid: the signature fits this key.');
    await fill('Public key', JSON.stringify(ec.publicKey.export({ format: 'jwk' })));
    await until(page, 'Valid: the signature fits this key.');
    await fill('Public key', pem(crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })));
    await until(page, 'This key is on P-384; ES256 needs P-256.');
    await fill('Public key', 'nonsense');
    await until(page, 'This key can’t be read');
  },

  async 'EdDSA where the engine has it, else said so'({ open, fill, assert, page, sees }) {
    await open('/jwt');
    const raw = Buffer.from(ed.publicKey.export({ format: 'jwk' }).x, 'base64url');
    const has = await page.evaluate(async (bytes) => {
      try {
        await crypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'Ed25519' }, false, ['verify']);
        return true;
      } catch {
        return false;
      }
    }, [...raw]);
    await fill('Token', sign('EdDSA', ed.privateKey));
    await sees('EdDSA on Ed25519');
    await fill('Public key', pem(ed));
    if (has) {
      await until(page, 'Valid: the signature fits this key.');
      await fill('Public key', pem(crypto.generateKeyPairSync('ed25519')));
      await until(page, 'Not valid: the signature doesn’t fit this key.');
    } else {
      await sees('This browser can’t check Ed25519 yet.');
      assert.ok(!(await verdict(page)).startsWith('Valid'));
    }
  },

  async 'alg none is called out; a broken token is named'({ open, fill, assert, page, sees }) {
    await open('/jwt');
    await fill('Token', `${b64({ alg: 'none' })}.${b64({ sub: 'anyone' })}.`);
    await sees('alg: none, so this token isn’t signed.');
    assert.equal(await page.getByRole('heading', { name: 'Check the signature' }).count(), 0);
    await fill('Token', 'abc.def');
    await sees('A JWT has three parts joined by dots: this has 2.');
    await fill('Token', `${b64({ alg: 'HS256' })}.ey$J.abc`);
    await sees('The payload isn’t base64url: “$” at character');
    await fill('Token', `${b64('{"alg": HS256}')}.${b64({ a: 1 })}.abc`);
    await sees('The header isn’t JSON once decoded:');
    await fill('Token', 'a.b.c.d.e');
    await sees('An encrypted token (JWE, five parts)');
    // Bearer and quotes around it don't matter.
    await fill('Token', `Bearer "${EXAMPLE}"`);
    await sees('HMAC with SHA-256');
  },

  async 'a JWT pasted on the home opens here with it'({ open, page, assert, sees }) {
    await open('/');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ dev: true })));
    await page.reload();
    await page.evaluate((token) => {
      const data = new DataTransfer();
      data.setData('text/plain', token);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, EXAMPLE);
    await page.getByRole('link', { name: /JWTs/ }).first().click();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Token', { exact: true }).inputValue(), EXAMPLE);
    await sees('John Doe');
  },

  async 'remembers Base64, never the token, the secret or the key'({ open, fill, check, assert, page }) {
    await open('/jwt');
    await fill('Token', EXAMPLE);
    await check('Base64', true);
    await fill('Secret', 'eW91ci0yNTYtYml0LXNlY3JldA');
    await until(page, 'Valid:');
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    assert.equal(await page.getByLabel('Token', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('SflKxwRJ') && !stored.includes('eW91ci0yNTYt'), stored);
    await fill('Token', EXAMPLE);
    assert.equal(await page.getByRole('switch', { name: /^Base64/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByLabel('Secret', { exact: true }).inputValue(), '');
  },

  async 'in German'({ open, fill, page, sees }) {
    await open('/jwt');
    await page.evaluate(() => localStorage.setItem('fundus:prefs', JSON.stringify({ language: 'de' })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await fill('Token', EXAMPLE);
    await sees('HMAC mit SHA-256');
    await fill('Secret', SECRET);
    await until(page, 'Gültig: die Signatur passt zu diesem Secret.');
    const now = Math.floor(Date.now() / 1000);
    await fill('Token', sign('HS256', 'k', { exp: now - 3 * 86_400 }));
    await sees('Abgelaufen vor 3 Tagen');
  },

  async 'looks'({ open, fill, page, shot }) {
    await open('/jwt');
    await shot('empty-390', 390);
    const now = Math.floor(Date.now() / 1000);
    await fill('Token', sign('RS256', rsa.privateKey, { sub: 'anna@example.com', name: 'Anna Müller', roles: ['admin', 'editor'], iat: now - 3600, nbf: now - 3600, exp: now + 7200 }));
    await fill('Public key', pem(rsa));
    await until(page, 'Valid:');
    await page.evaluate(() => scrollTo(0, 0));
    await shot('rs256-390', 390);
    await shot('rs256-1280', 1280);
    await fill('Token', EXAMPLE);
    await fill('Secret', 'wrong');
    await until(page, 'Not valid:');
    await page.evaluate(() => scrollTo(0, 0));
    await shot('example-1280', 1280);
    await fill('Token', `${b64({ alg: 'none' })}.${b64({ sub: 'anyone', exp: now - 86_400 })}.`);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('none-390', 390);
  },

  async 'fits a phone'({ open, fill, fitsPhone }) {
    await open('/jwt');
    const long = sign('RS256', rsa.privateKey, { sub: 'x'.repeat(600), url: `https://example.com/${'a'.repeat(300)}`, exp: 2_000_000_000 });
    await fill('Token', long);
    await fill('Public key', pem(rsa));
    await fitsPhone();
    await fill('Token', `${b64({ alg: 'HS256', kid: 'k'.repeat(200) })}.${b64('not json at all '.repeat(40))}.abc`);
    await fitsPhone();
  },
};
