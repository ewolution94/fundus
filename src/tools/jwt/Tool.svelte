<!--
  F-907 JWTs: paste a token, and its header and payload follow as indented JSON, its algorithm, and
  exp, nbf and iat as dates in the home zone with how long ago or how long still. The signature is
  checked with WebCrypto: a secret for HS, a public key (PEM, a certificate, a JWK or a set) for RS,
  PS, ES and EdDSA. alg none is called out. The token, the secret and the key are never kept.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { CircleCheck, CircleX, TriangleAlert } from '@lucide/svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Row from './Row.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { decode, times, standing, algOf, verify, hasEd25519, relative, duration, dateIn, validZone, type DecodeError, type Verdict, type Time } from './jwt.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      token: 'Token',
      tokenPh: 'Paste a JWT: eyJ…',
      clear: 'Clear',
      header: 'Header',
      payload: 'Payload',
      empty: 'Paste a token: its header, payload and times follow, and its signature can be checked.',
      parts: 'A JWT has three parts joined by dots: this has {n}.',
      jwe: 'An encrypted token (JWE, five parts): without its key there’s nothing to read.',
      base64: 'The {part} isn’t base64url: {char} at character {position}.',
      length: 'The {part} is cut short: its base64url has a character too many or too few.',
      utf8: 'The {part} isn’t text once decoded.',
      json: 'The header isn’t JSON once decoded:',
      object: 'The header must be a JSON object.',
      'part.header': 'header',
      'part.payload': 'payload',
      'part.signature': 'signature',
      notJson: 'not JSON: shown as text',
      alg: 'Algorithm',
      typ: 'Type',
      kid: 'Key ID',
      signature: 'Signature',
      'bytes.one': '1 byte',
      'bytes.other': '{n} bytes',
      noAlg: 'The header names no algorithm (alg).',
      'fam.HS': 'HMAC with {hash}',
      'fam.RS': 'RSA with {hash}',
      'fam.PS': 'RSA-PSS with {hash}',
      'fam.ES': 'ECDSA on {curve} with {hash}',
      'fam.Ed': 'EdDSA on Ed25519',
      unknownAlg: 'Not one this tool checks',
      none: 'alg: none, so this token isn’t signed. Anyone can write one like it: never accept it.',
      times: 'Times',
      'claim.exp': 'Expires',
      'claim.nbf': 'Not before',
      'claim.iat': 'Issued',
      expired: 'Expired {rel}',
      validFor: 'Valid for another {dur}',
      issued: 'Issued {rel}',
      issuedFuture: 'Issued {rel}: in the future',
      notYet: 'Not valid yet: it starts {rel}',
      since: 'Valid since then ({rel})',
      notSeconds: '{raw} isn’t a time in seconds.',
      noTimes: 'No times in it: no exp, nbf or iat.',
      check: 'Check the signature',
      secret: 'Secret',
      secretPh: 'The secret it was signed with',
      b64: 'Base64',
      b64Hint: 'The secret is Base64 or base64url',
      key: 'Public key',
      keyPh: '-----BEGIN PUBLIC KEY----- …, a certificate, a JWK or a JWK set',
      askSecret: 'Type the secret to check the signature.',
      askKey: 'Paste the public key to check the signature.',
      checking: 'Checking …',
      valid: 'Valid: the signature fits this {what}.',
      invalid: 'Not valid: the signature doesn’t fit this {what}.',
      whatSecret: 'secret',
      whatKey: 'key',
      sigLength: 'The signature has {got} bytes; {alg} has {want}.',
      kept: 'Nothing is kept: not the token, the secret or the key.',
      'problem.pem': 'This key can’t be read: paste a PEM (BEGIN PUBLIC KEY or CERTIFICATE), a JWK or a JWK set.',
      'problem.private': 'That’s a private key. Checking needs only the public one: paste that instead, and keep the private key to yourself.',
      'problem.jwk': 'This JWK isn’t JSON with a kty.',
      'problem.noKeys': 'The set has no key that fits {alg}.',
      'problem.kidMissing': 'None of the {n} keys has the key ID {kid}.',
      'problem.kidNeeded': 'The set has several keys that fit, and the token names none (kid).',
      'problem.rsaWanted': '{alg} needs an RSA key.',
      'problem.ecWanted': '{alg} needs an EC key on {want}.',
      'problem.curve': 'This key is on {curve}; {alg} needs {want}.',
      'problem.edWanted': '{alg} needs an Ed25519 key.',
      'problem.octWanted': 'That’s a secret (kty oct): {alg} needs a public key.',
      'problem.pssKey': 'Browsers take RSA keys only as plain RSA, not marked as RSA-PSS.',
      'problem.ed448': 'Ed448 isn’t something browsers check.',
      'problem.noEd': 'This browser can’t check Ed25519 yet.',
      'problem.secretBase64': 'The secret isn’t Base64: switch Base64 off to use it as text.',
      'problem.import': 'The key doesn’t work for {alg}: {detail}',
      'problem.alg': '{alg} isn’t one this tool checks: HS, RS, PS, ES and EdDSA are.',
      'problem.empty': '',
    },
    de: {
      token: 'Token',
      tokenPh: 'Ein JWT einfügen: eyJ…',
      clear: 'Leeren',
      header: 'Header',
      payload: 'Payload',
      empty: 'Füg ein Token ein: Header, Payload und Zeiten folgen, und die Signatur lässt sich prüfen.',
      parts: 'Ein JWT hat drei Teile, mit Punkten verbunden: dieses hat {n}.',
      jwe: 'Ein verschlüsseltes Token (JWE, fünf Teile): ohne seinen Schlüssel gibt es nichts zu lesen.',
      base64: 'Der {part} ist kein base64url: {char} an Zeichen {position}.',
      length: 'Der {part} ist abgeschnitten: sein base64url hat ein Zeichen zu viel oder zu wenig.',
      utf8: 'Der {part} ist dekodiert kein Text.',
      json: 'Der Header ist dekodiert kein JSON:',
      object: 'Der Header muss ein JSON-Objekt sein.',
      'part.header': 'Header',
      'part.payload': 'Payload',
      'part.signature': 'Signaturteil',
      notJson: 'kein JSON: als Text gezeigt',
      alg: 'Algorithmus',
      typ: 'Typ',
      kid: 'Schlüssel-ID',
      signature: 'Signatur',
      'bytes.one': '1 Byte',
      'bytes.other': '{n} Bytes',
      noAlg: 'Der Header nennt keinen Algorithmus (alg).',
      'fam.HS': 'HMAC mit {hash}',
      'fam.RS': 'RSA mit {hash}',
      'fam.PS': 'RSA-PSS mit {hash}',
      'fam.ES': 'ECDSA auf {curve} mit {hash}',
      'fam.Ed': 'EdDSA auf Ed25519',
      unknownAlg: 'Keiner, den dieses Werkzeug prüft',
      none: 'alg: none, dieses Token ist also nicht signiert. Jeder kann so eins schreiben: nimm es nie an.',
      times: 'Zeiten',
      'claim.exp': 'Läuft ab',
      'claim.nbf': 'Nicht vor',
      'claim.iat': 'Ausgestellt',
      expired: 'Abgelaufen {rel}',
      validFor: 'Noch {dur} gültig',
      issued: 'Ausgestellt {rel}',
      issuedFuture: 'Ausgestellt {rel}: in der Zukunft',
      notYet: 'Noch nicht gültig: es gilt erst {rel}',
      since: 'Seitdem gültig ({rel})',
      notSeconds: '{raw} ist keine Zeit in Sekunden.',
      noTimes: 'Keine Zeiten darin: kein exp, nbf oder iat.',
      check: 'Signatur prüfen',
      secret: 'Secret',
      secretPh: 'Das Secret, mit dem es signiert wurde',
      b64: 'Base64',
      b64Hint: 'Das Secret ist Base64 oder base64url',
      key: 'Öffentlicher Schlüssel',
      keyPh: '-----BEGIN PUBLIC KEY----- …, ein Zertifikat, ein JWK oder ein JWK-Set',
      askSecret: 'Tipp das Secret, um die Signatur zu prüfen.',
      askKey: 'Füg den öffentlichen Schlüssel ein, um die Signatur zu prüfen.',
      checking: 'Wird geprüft …',
      valid: 'Gültig: die Signatur passt zu diesem {what}.',
      invalid: 'Nicht gültig: die Signatur passt nicht zu diesem {what}.',
      whatSecret: 'Secret',
      whatKey: 'Schlüssel',
      sigLength: 'Die Signatur hat {got} Bytes; {alg} hat {want}.',
      kept: 'Nichts wird gespeichert: nicht das Token, nicht das Secret, nicht der Schlüssel.',
      'problem.pem': 'Dieser Schlüssel lässt sich nicht lesen: füg ein PEM (BEGIN PUBLIC KEY oder CERTIFICATE), ein JWK oder ein JWK-Set ein.',
      'problem.private': 'Das ist ein privater Schlüssel. Zum Prüfen reicht der öffentliche: füg den ein und behalt den privaten für dich.',
      'problem.jwk': 'Dieses JWK ist kein JSON mit einem kty.',
      'problem.noKeys': 'Im Set ist kein Schlüssel, der zu {alg} passt.',
      'problem.kidMissing': 'Keiner der {n} Schlüssel hat die Schlüssel-ID {kid}.',
      'problem.kidNeeded': 'Im Set passen mehrere Schlüssel, und das Token nennt keinen (kid).',
      'problem.rsaWanted': '{alg} braucht einen RSA-Schlüssel.',
      'problem.ecWanted': '{alg} braucht einen EC-Schlüssel auf {want}.',
      'problem.curve': 'Dieser Schlüssel ist auf {curve}; {alg} braucht {want}.',
      'problem.edWanted': '{alg} braucht einen Ed25519-Schlüssel.',
      'problem.octWanted': 'Das ist ein Secret (kty oct): {alg} braucht einen öffentlichen Schlüssel.',
      'problem.pssKey': 'Browser nehmen RSA-Schlüssel nur als reines RSA, nicht als RSA-PSS markiert.',
      'problem.ed448': 'Ed448 prüfen Browser nicht.',
      'problem.noEd': 'Dieser Browser kann Ed25519 noch nicht prüfen.',
      'problem.secretBase64': 'Das Secret ist kein Base64: schalt Base64 aus, um es als Text zu nehmen.',
      'problem.import': 'Der Schlüssel passt nicht zu {alg}: {detail}',
      'problem.alg': '{alg} prüft dieses Werkzeug nicht: HS, RS, PS, ES und EdDSA schon.',
      'problem.empty': '',
    },
  });

  // Whether the secret is Base64 is kept; the token, the secret and the key are not.
  const o = remember('jwt', { base64: false });

  let token = $state('');
  let secret = $state('');
  let keyText = $state('');

  const given = untrack(() => texts(items)[0]);
  if (given) token = given;

  // Now, every 30 seconds: "expires in 2 minutes" stays true.
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  let edOk = $state<boolean | null>(null);
  void hasEd25519().then((v) => (edOk = v));

  const decoded = $derived(decode(token));
  const d = $derived(decoded && 'ok' in decoded ? decoded : null);
  const problem = $derived(decoded && !('ok' in decoded) ? decoded : null);
  const alg = $derived(d ? algOf(d.alg) : null);
  const isNone = $derived(d?.alg?.toLowerCase() === 'none');
  const zone = $derived(validZone(shared.homeZone));
  const list = $derived(d ? times(d.payload, now) : []);
  const inForce = $derived(standing(list));
  /** The row under the highlighter: the time that decides whether it's in force. */
  const decides = $derived(inForce === 'notYet' ? 'nbf' : list.some((t) => t.claim === 'exp' && t.ok) ? 'exp' : 'nbf');

  // The check, a moment after the last keystroke; an older answer never overwrites a newer one.
  let verdict = $state<Verdict | null>(null);
  let checking = $state(false);
  let asked = 0;
  $effect(() => {
    const tok = d;
    const a = alg;
    const input = { secret, base64: o.base64, key: keyText };
    const id = ++asked;
    if (!tok || !a || (a.family === 'HS' ? !input.secret : !input.key.trim())) {
      verdict = null;
      checking = false;
      return;
    }
    checking = true;
    const wait = setTimeout(async () => {
      const v = await verify(tok, input);
      if (id !== asked) return;
      verdict = v;
      checking = false;
    }, 120);
    return () => clearTimeout(wait);
  });

  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);

  function decodeProblem(e: DecodeError): string {
    if (e.code === 'parts') return w('parts', { n: e.n });
    if (e.code === 'jwe') return w('jwe');
    if (e.code === 'base64') return w('base64', { part: w(`part.${e.part}`), char: quote(e.char), position: e.position });
    if (e.code === 'length' || e.code === 'utf8') return w(e.code, { part: w(`part.${e.part}`) });
    return w(e.code);
  }

  function timeLine(t: Extract<Time, { ok: true }>): string {
    const rel = relative(t.ms, now, locale());
    if (t.claim === 'exp') return t.past ? w('expired', { rel }) : w('validFor', { dur: duration(t.ms - now, locale()) });
    if (t.claim === 'nbf') return t.past ? w('since', { rel }) : w('notYet', { rel });
    return t.past ? w('issued', { rel }) : w('issuedFuture', { rel });
  }

  const algWords = $derived(alg ? w(`fam.${alg.family}`, { hash: alg.hash, curve: alg.curve ?? '' }) : w('unknownAlg'));

  function verdictText(v: Verdict): string {
    const what = alg?.family === 'HS' ? w('whatSecret') : w('whatKey');
    if (v.ok) return v.valid ? w('valid', { what }) : w('invalid', { what });
    return w(`problem.${v.problem}`, { alg: d?.alg ?? '', n: v.n ?? 0, kid: quote(v.kid ?? ''), curve: v.curve ?? '', want: v.want ?? '', detail: v.detail ?? '' });
  }

  function clear() {
    token = '';
    secret = '';
    keyText = '';
  }
</script>

<div class="jwt">
  <div class="cols">
    <div class="stack">
      <div class="h">
        <label for="jwt-token">{w('token')}</label>
        {#if token}<em><button type="button" class="link" onclick={clear}>{w('clear')}</button></em>{/if}
      </div>
      <textarea id="jwt-token" class="field code" placeholder={w('tokenPh')} spellcheck="false" autocapitalize="off" autocomplete="off" bind:value={token}></textarea>

      {#if problem}
        <div class="error" role="alert">
          <p>{decodeProblem(problem)}</p>
          {#if problem.code === 'json'}<pre class="mono-out raw">{problem.text}</pre>{/if}
        </div>
      {:else if d}
        <div class="h">
          <span>{w('header')}</span>
          <em><CopyButton text={d.headerText} /></em>
        </div>
        <div class="work out" role="region" aria-label={w('header')}><pre class="mono-out">{d.headerText}</pre></div>
        <div class="h">
          <span>{w('payload')}</span>
          <em>{#if !d.payloadJson}<span class="nj">{w('notJson')}</span>{/if}<CopyButton text={d.payloadText} /></em>
        </div>
        <div class="work out" role="region" aria-label={w('payload')}><pre class="mono-out">{d.payloadText}</pre></div>
      {/if}
    </div>

    <div class="stack side">
      {#if !d}
        {#if !problem}<p class="note">{w('empty')}</p>{/if}
      {:else}
        <dl class="spec">
          <div>
            <dt>{w('alg')}</dt>
            <dd>
              <b class="alg">{d.alg ?? '–'}</b>
              <span class="note">{d.alg ? (isNone ? '' : algWords) : w('noAlg')}</span>
            </dd>
          </div>
          {#if typeof d.header.typ === 'string'}
            <div><dt>{w('typ')}</dt><dd><code>{d.header.typ}</code></dd></div>
          {/if}
          {#if typeof d.header.kid === 'string'}
            <div><dt>{w('kid')}</dt><dd><code class="kid">{d.header.kid}</code></dd></div>
          {/if}
          <div>
            <dt>{w('signature')}</dt>
            <dd><span>{w('bytes', { n: d.signature.length })}</span></dd>
          </div>
        </dl>

        {#if isNone}
          <p class="warn" role="alert"><TriangleAlert aria-hidden="true" /><span>{w('none')}</span></p>
        {/if}

        {#if list.length}
          <Receipt title={w('times')} aside={zone}>
            {#each list as t (t.claim)}
              {#if t.ok}
                <Row label={w(`claim.${t.claim}`)} value={dateIn(t.ms, zone, locale())} copy={new Date(t.ms).toISOString()} sub={timeLine(t)} hl={t.claim === decides && inForce !== 'none'} />
              {:else}
                <Row label={w(`claim.${t.claim}`)} value={w('notSeconds', { raw: t.raw })} copy={null} quiet />
              {/if}
            {/each}
          </Receipt>
        {:else}
          <p class="note">{w('noTimes')}</p>
        {/if}

        {#if !isNone}
          <h2 class="h">{w('check')}</h2>
          {#if alg?.family === 'HS'}
            <input class="field mono" type="text" aria-label={w('secret')} placeholder={w('secretPh')} spellcheck="false" autocapitalize="off" autocomplete="off" bind:value={secret} />
            <Check checked={o.base64} label={w('b64')} hint={w('b64Hint')} onchange={(v) => (o.base64 = v)} />
          {:else if alg}
            <textarea class="field mono key" aria-label={w('key')} placeholder={w('keyPh')} spellcheck="false" autocapitalize="off" autocomplete="off" bind:value={keyText}></textarea>
            {#if alg.family === 'Ed' && edOk === false}<p class="note bad">{w('problem.noEd')}</p>{/if}
          {/if}

          <div class="verdict" aria-live="polite">
            {#if !alg}
              <p class="note bad">{w('problem.alg', { alg: d.alg ?? '–' })}</p>
            {:else if checking && !verdict}
              <p class="note">{w('checking')}</p>
            {:else if verdict?.ok}
              <p class="result" class:good={verdict.valid} class:bad={!verdict.valid}>
                {#if verdict.valid}<CircleCheck aria-hidden="true" />{:else}<CircleX aria-hidden="true" />{/if}
                <span>{verdictText(verdict)}</span>
              </p>
              {#if verdict.sigLength}<p class="note">{w('sigLength', { got: verdict.sigLength.got, want: verdict.sigLength.want, alg: d.alg ?? '' })}</p>{/if}
            {:else if verdict && !verdict.ok && verdict.problem !== 'empty'}
              <p class="error" role="alert">{verdictText(verdict)}</p>
            {:else}
              <p class="note">{alg.family === 'HS' ? w('askSecret') : w('askKey')}</p>
            {/if}
          </div>
        {/if}
        <p class="note">{w('kept')}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .jwt {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .side {
    container-type: inline-size;
  }

  .h label,
  .h span {
    min-width: 0;
  }

  .h em {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* 40 px to tap, without making the heading taller. */
  .h .link {
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0;
    padding: 11px 0;
    margin: -11px 0;
  }

  .nj {
    font-size: 12px;
  }

  .code,
  .mono {
    font-family: var(--mono);
    font-size: 13px;
  }

  .code {
    min-height: 150px;
    line-height: 1.55;
    word-break: break-all;
  }

  .key {
    min-height: 150px;
  }

  @media (hover: none) {
    .code,
    .mono {
      font-size: 16px;
    }
  }

  .out {
    max-height: 420px;
    overflow: auto;
    padding: 10px 12px;
  }

  .out pre,
  .raw {
    margin: 0;
  }

  .raw {
    font-weight: 400;
    color: var(--ink);
  }

  .error {
    display: grid;
    gap: 6px;
    overflow-wrap: anywhere;
  }

  .alg {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .spec code {
    font-family: var(--mono);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .warn,
  .result {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .warn {
    padding: 10px 12px;
    border: 1.5px solid var(--bad);
    color: var(--bad);
  }

  .warn :global(svg),
  .result :global(svg) {
    width: 18px;
    height: 18px;
    flex: none;
    margin-top: 1px;
  }

  .result {
    font-size: 15px;
  }

  .result.good {
    color: var(--ok);
  }

  .result.bad {
    color: var(--bad);
  }

  .verdict {
    display: grid;
    gap: 4px;
    min-height: 24px;
  }
</style>
