<!--
  F-903 Encode URLs: percent-encode a part or a whole link, decode one (a + as a space if asked), or
  take a URL apart: scheme, user, host (in its own letters too), port, path, every query parameter
  decoded with its own Copy, the fragment. The URL is only read, never opened (url.ts).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { shapes } from '../../lib/shapes.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { encodeUrl, decodeUrl, readUrl, type UrlError } from './url.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      encode: 'Encode',
      decode: 'Decode',
      parts: 'Take apart',
      scope: 'Scope',
      component: 'One part',
      whole: 'Whole URL',
      componentNote: 'encodeURIComponent: / ? # & = + are encoded too. For one value or one path segment.',
      wholeNote: 'encodeURI: / ? # & = stay, so the link still works.',
      componentNoteDe: 'decodeURIComponent: every escape is decoded.',
      wholeNoteDe: 'decodeURI: the escapes of / ? # & = stay, so the link keeps its shape.',
      plus: 'Plus',
      plusLabel: '+ is a space',
      plusHint: 'As forms send it',
      text: 'Text',
      encoded: 'Encoded text',
      url: 'URL',
      phText: 'Type or paste text',
      phEncoded: 'Paste text with %20 and friends',
      phUrl: 'Paste a link',
      result: 'Result',
      'chars.one': '1 character',
      'chars.other': '{n} characters',
      emptyEncode: 'Type or paste text: its encoded form follows.',
      emptyDecode: 'Paste encoded text: it follows decoded.',
      emptyParts: 'Paste a link: it’s taken apart here, never opened.',
      percent: '{found} at position {pos} isn’t an escape: a % takes two hex digits.',
      utf8: '{found} at position {pos} isn’t UTF-8.',
      surrogate: 'Position {pos} holds half a character (a lone surrogate): it has no UTF-8.',
      invalid: 'This isn’t a URL the browser can read: a space in the host, a stray character, or a port over 65535?',
      assumed: 'No scheme: read as https://',
      scheme: 'Scheme',
      user: 'User',
      password: 'Password',
      host: 'Host',
      hostUnicode: 'As written',
      port: 'Port',
      defaultPort: '{port}, the default',
      path: 'Path',
      query: 'Query',
      hash: 'Fragment',
      origin: 'Origin',
      params: 'Query parameters',
      key: 'Key',
      value: 'Value',
      empty: 'empty',
      none: 'No query parameters.',
      asWritten: 'as written: {raw}',
      copy: 'Copy',
    },
    de: {
      mode: 'Modus',
      encode: 'Kodieren',
      decode: 'Dekodieren',
      parts: 'Zerlegen',
      scope: 'Umfang',
      component: 'Ein Teil',
      whole: 'Ganze URL',
      componentNote: 'encodeURIComponent: auch / ? # & = + werden kodiert. Für einen Wert oder einen Pfadabschnitt.',
      wholeNote: 'encodeURI: / ? # & = bleiben, damit der Link funktioniert.',
      componentNoteDe: 'decodeURIComponent: jedes Escape wird dekodiert.',
      wholeNoteDe: 'decodeURI: die Escapes von / ? # & = bleiben, damit der Link seine Form behält.',
      plus: 'Plus',
      plusLabel: '+ ist ein Leerzeichen',
      plusHint: 'Wie Formulare es schicken',
      text: 'Text',
      encoded: 'Kodierter Text',
      url: 'URL',
      phText: 'Text tippen oder einfügen',
      phEncoded: 'Text mit %20 und Co. einfügen',
      phUrl: 'Einen Link einfügen',
      result: 'Ergebnis',
      'chars.one': '1 Zeichen',
      'chars.other': '{n} Zeichen',
      emptyEncode: 'Tipp oder füg Text ein: die kodierte Form folgt.',
      emptyDecode: 'Füg kodierten Text ein: er folgt dekodiert.',
      emptyParts: 'Füg einen Link ein: er wird hier zerlegt, nie geöffnet.',
      percent: '{found} an Stelle {pos} ist kein Escape: ein % braucht zwei Hex-Ziffern.',
      utf8: '{found} an Stelle {pos} ist kein UTF-8.',
      surrogate: 'An Stelle {pos} steht ein halbes Zeichen (ein einzelnes Surrogat): es hat kein UTF-8.',
      invalid: 'Das ist keine URL, die der Browser lesen kann: ein Leerzeichen im Host, ein verirrtes Zeichen oder ein Port über 65535?',
      assumed: 'Ohne Schema: gelesen als https://',
      scheme: 'Schema',
      user: 'Nutzer',
      password: 'Passwort',
      host: 'Host',
      hostUnicode: 'Geschrieben',
      port: 'Port',
      defaultPort: '{port}, der Standard',
      path: 'Pfad',
      query: 'Query',
      hash: 'Fragment',
      origin: 'Origin',
      params: 'Query-Parameter',
      key: 'Schlüssel',
      value: 'Wert',
      empty: 'leer',
      none: 'Keine Query-Parameter.',
      asWritten: 'geschrieben: {raw}',
      copy: 'Kopieren',
    },
  });

  type Mode = 'encode' | 'decode' | 'parts';
  // The mode and how it reads are kept; the text is not.
  const o = remember('url', { mode: 'encode' as Mode, whole: false, plus: false });

  let input = $state('');

  // What was pasted on the home: a link is taken apart, other text goes into the open mode.
  const given = untrack(() => texts(items)[0]);
  if (given !== undefined) {
    input = given.trim();
    if (shapes(given).includes('link')) o.mode = 'parts';
  }

  const coded = $derived(!input ? null : o.mode === 'encode' ? encodeUrl(input, o.whole) : o.mode === 'decode' ? decodeUrl(input, o.whole, o.plus) : null);
  const read = $derived(o.mode === 'parts' && input.trim() ? readUrl(input) : null);
  const parts = $derived(read?.ok ? read.parts : null);

  const fieldLabel = $derived(o.mode === 'encode' ? w('text') : o.mode === 'decode' ? w('encoded') : w('url'));
  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);
  const pos = (index: number) => [...input.slice(0, index)].length + 1;

  function problem(e: UrlError): string {
    if (e.code === 'surrogate') return w('surrogate', { pos: pos(e.index) });
    return w(e.code, { found: quote(e.found), pos: pos(e.index) });
  }

  /** The rows of the parts list: only what the URL has. */
  const rows = $derived.by(() => {
    if (!parts) return [];
    const list: { label: string; value: string; note?: string; copy?: string }[] = [{ label: w('scheme'), value: parts.protocol.replace(/:$/, '') }];
    if (parts.username) list.push({ label: w('user'), value: parts.username });
    if (parts.password) list.push({ label: w('password'), value: parts.password });
    if (parts.hostname) list.push({ label: w('host'), value: parts.hostname });
    if (parts.hostUnicode) list.push({ label: w('hostUnicode'), value: parts.hostUnicode });
    if (parts.port) list.push({ label: w('port'), value: parts.port });
    else if (parts.defaultPort) list.push({ label: w('port'), value: w('defaultPort', { port: parts.defaultPort }), copy: parts.defaultPort });
    if (parts.path) list.push({ label: w('path'), value: parts.pathDecoded, note: parts.pathDecoded !== parts.path ? w('asWritten', { raw: parts.path }) : undefined });
    if (parts.query) list.push({ label: w('query'), value: parts.query });
    if (parts.hash) list.push({ label: w('hash'), value: parts.hashDecoded, note: parts.hashDecoded !== parts.hash.slice(1) ? w('asWritten', { raw: parts.hash }) : undefined });
    if (parts.origin) list.push({ label: w('origin'), value: parts.origin });
    return list;
  });
</script>

<div class="url">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'encode', label: w('encode') },
      { value: 'decode', label: w('decode') },
      { value: 'parts', label: w('parts') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols even">
    <div class="stack">
      <h2 class="h">{fieldLabel}</h2>
      <textarea
        class="field code"
        aria-label={fieldLabel}
        placeholder={o.mode === 'encode' ? w('phText') : o.mode === 'decode' ? w('phEncoded') : w('phUrl')}
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        bind:value={input}
      ></textarea>
      {#if o.mode !== 'parts'}
        <dl class="spec">
          <div>
            <dt>{w('scope')}</dt>
            <dd>
              <Seg
                label={w('scope')}
                value={o.whole ? 'whole' : 'component'}
                options={[
                  { value: 'component', label: w('component') },
                  { value: 'whole', label: w('whole') },
                ]}
                onchange={(v) => (o.whole = v === 'whole')}
              />
              <span class="note">{o.mode === 'encode' ? (o.whole ? w('wholeNote') : w('componentNote')) : o.whole ? w('wholeNoteDe') : w('componentNoteDe')}</span>
            </dd>
          </div>
          {#if o.mode === 'decode'}
            <div>
              <dt>{w('plus')}</dt>
              <dd><Check checked={o.plus} label={w('plusLabel')} hint={w('plusHint')} onchange={(v) => (o.plus = v)} /></dd>
            </div>
          {/if}
        </dl>
      {/if}
    </div>

    <div class="stack">
      {#if o.mode !== 'parts'}
        {#if !coded}
          <p class="note">{o.mode === 'encode' ? w('emptyEncode') : w('emptyDecode')}</p>
        {:else if !coded.ok}
          <p class="error" role="alert">{problem(coded.error)}</p>
        {:else}
          <div class="bar">
            <h2 class="h grow">{w('result')}<em>{w('chars', { n: [...coded.text].length })}</em></h2>
            <CopyButton variant="button" text={coded.text} />
          </div>
          <div class="work out" role="region" aria-label={w('result')}>
            <pre class="mono-out">{coded.text}</pre>
          </div>
        {/if}
      {:else if !read}
        <p class="note">{w('emptyParts')}</p>
      {:else if !read.ok}
        <p class="error" role="alert">{w('invalid')}</p>
      {:else if parts}
        <dl class="spec parts">
          {#each rows as r (r.label)}
            <div>
              <dt>{r.label}</dt>
              <dd>
                <span class="val">
                  <code>{r.value}</code>
                  <CopyButton text={r.copy ?? r.value} />
                </span>
                {#if r.note}<small class="raw">{r.note}</small>{/if}
              </dd>
            </div>
          {/each}
        </dl>
        {#if parts.assumed}<p class="note">{w('assumed')}</p>{/if}
      {/if}
    </div>

    {#if parts}
      <div class="stack wide">
        <h2 class="h">{w('params')}<em>{parts.params.length || ''}</em></h2>
        {#if parts.params.length}
          <table class="params">
            <thead>
              <tr><th scope="col">{w('key')}</th><th scope="col">{w('value')}</th><th scope="col"><span class="sr">{w('copy')}</span></th></tr>
            </thead>
            <tbody>
              {#each parts.params as p, i (i)}
                <tr>
                  <td>
                    <code>{p.key}</code>
                    {#if p.rawKey !== p.key}<small class="raw">{p.rawKey}</small>{/if}
                  </td>
                  <td>
                    {#if p.value}<code>{p.value}</code>{:else}<em class="empty">{w('empty')}</em>{/if}
                    {#if p.rawValue !== p.value}<small class="raw">{p.rawValue}</small>{/if}
                  </td>
                  <td class="c"><CopyButton text={p.value} /></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="note">{w('none')}</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .url {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .code {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.55;
    min-height: 140px;
    overflow-wrap: anywhere;
  }

  @media (hover: none) {
    .code {
      font-size: 16px;
    }
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .grow {
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
  }

  .out {
    max-height: 360px;
    overflow: auto;
    padding: 10px 12px;
  }

  .out pre {
    margin: 0;
  }

  .error {
    overflow-wrap: anywhere;
  }

  .val {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  /* Links and escapes have few break points: fill each line instead of breaking at the first / or ?. */
  code,
  .out pre,
  .raw {
    word-break: break-all;
  }

  code {
    font-family: var(--mono);
    font-size: 13px;
    min-width: 0;
  }

  .raw {
    display: block;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  .params {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .params th {
    padding: 8px 8px 8px 0;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    text-align: left;
    color: var(--ink-2);
    border-bottom: 1px solid var(--rule);
  }

  .params th:first-child {
    width: 34%;
  }

  .params th:last-child {
    width: 64px;
  }

  .params td {
    padding: 10px 8px 10px 0;
    vertical-align: top;
    border-bottom: 1px solid var(--rule);
  }

  .params td.c {
    padding-right: 0;
    text-align: right;
  }

  .empty {
    font-size: 13px;
    color: var(--ink-2);
  }
</style>
