<!--
  F-902 Base64: text to Base64 and back (UTF-8, so umlauts and emoji survive), either alphabet,
  padded or not; a file to Base64 or a data: URL with its real type; and Base64 or a data: URL back
  to a file, its type read from the bytes. Coding in base64.ts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { shapes } from '../../lib/shapes.ts';
  import { formatBytes, outName, sniff, kindOf, dimensions } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { encode, encodeText, decode, asText, isDataUrl, parseDataUrl, dataUrl, sniffBytes, extFor, type DecodeError, type Sniffed } from './base64.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Direction',
      encode: 'Text → Base64',
      decode: 'Base64 → text',
      file: 'File → Base64',
      tofile: 'Base64 → file',
      text: 'Text',
      fileWord: 'File',
      base64: 'Base64',
      dataUrl: 'data: URL',
      result: 'Result',
      alphabet: 'Alphabet',
      standard: 'Standard',
      urlSafe: 'URL-safe',
      urlHint: '- and _ instead of + and /',
      padding: 'Padding',
      pad: 'Pad with =',
      padHint: 'To a multiple of four characters',
      as: 'As',
      dataNote: 'A data: URL is always standard and padded.',
      reads: 'Reads',
      readsNote: 'Both alphabets, padded or not, and data: URLs. Spaces and line breaks don’t count.',
      phText: 'Type or paste text',
      phBase64: 'Paste Base64 or a data: URL',
      emptyEncode: 'Type or paste text: its Base64 follows.',
      emptyDecode: 'Paste Base64 or a data: URL: the text follows.',
      emptyFile: 'Choose a file: its Base64 follows.',
      emptyToFile: 'Paste Base64 or a data: URL: the file follows, ready to save.',
      drop: 'Drop a file here, or choose one',
      dropHint: 'Any kind, up to 50 MB.',
      'chars.one': '1 character',
      'chars.other': '{n} characters',
      fromSize: 'from {size}',
      errChar: '{char} at position {pos} isn’t Base64.',
      errPadding: 'The = at position {pos} is out of place: padding comes only at the end, one or two.',
      errLength: '{n} characters can’t be Base64: one is missing, or one too many.',
      errMixed: 'Two alphabets mixed (+/ and -_), at position {pos}.',
      errPercent: 'The % at position {pos} isn’t followed by two hex digits.',
      errDataUrl: 'A data: URL needs a comma before its data.',
      binary: 'These {size} aren’t text: they’re a {kind}.',
      binaryUnknown: 'These {size} aren’t text.',
      saveAsFile: 'Make it a file',
      tooBig: '{name} is {size}: its Base64 would be too long to handle here. Pick one under 50 MB.',
      shown: 'Showing the first {shown} of {all} characters: Copy and Save take all of it.',
      type: 'Type',
      unknown: 'Unknown bytes',
      declared: 'It says {mime}, but the bytes are a {kind}.',
      readFailed: '{name} couldn’t be read.',
      working: 'Reading {name}…',
      clear: 'Clear',
    },
    de: {
      mode: 'Richtung',
      encode: 'Text → Base64',
      decode: 'Base64 → Text',
      file: 'Datei → Base64',
      tofile: 'Base64 → Datei',
      text: 'Text',
      fileWord: 'Datei',
      base64: 'Base64',
      dataUrl: 'data:-URL',
      result: 'Ergebnis',
      alphabet: 'Alphabet',
      standard: 'Standard',
      urlSafe: 'URL-sicher',
      urlHint: '- und _ statt + und /',
      padding: 'Auffüllen',
      pad: 'Mit = auffüllen',
      padHint: 'Auf ein Vielfaches von vier Zeichen',
      as: 'Als',
      dataNote: 'Eine data:-URL ist immer Standard und aufgefüllt.',
      reads: 'Liest',
      readsNote: 'Beide Alphabete, aufgefüllt oder nicht, und data:-URLs. Leerzeichen und Umbrüche zählen nicht.',
      phText: 'Text tippen oder einfügen',
      phBase64: 'Base64 oder eine data:-URL einfügen',
      emptyEncode: 'Tipp oder füg Text ein: sein Base64 folgt.',
      emptyDecode: 'Füg Base64 oder eine data:-URL ein: der Text folgt.',
      emptyFile: 'Wähl eine Datei: ihr Base64 folgt.',
      emptyToFile: 'Füg Base64 oder eine data:-URL ein: die Datei folgt, bereit zum Speichern.',
      drop: 'Datei hier ablegen oder auswählen',
      dropHint: 'Jede Art, bis 50 MB.',
      'chars.one': '1 Zeichen',
      'chars.other': '{n} Zeichen',
      fromSize: 'aus {size}',
      errChar: '{char} an Stelle {pos} ist kein Base64.',
      errPadding: 'Das = an Stelle {pos} steht falsch: Auffüllen gibt es nur am Ende, ein- oder zweimal.',
      errLength: '{n} Zeichen können kein Base64 sein: eins fehlt oder eins ist zu viel.',
      errMixed: 'Zwei Alphabete gemischt (+/ und -_), an Stelle {pos}.',
      errPercent: 'Nach dem % an Stelle {pos} folgen keine zwei Hex-Ziffern.',
      errDataUrl: 'Eine data:-URL braucht ein Komma vor ihren Daten.',
      binary: 'Diese {size} sind kein Text: es ist ein {kind}.',
      binaryUnknown: 'Diese {size} sind kein Text.',
      saveAsFile: 'Als Datei',
      tooBig: '{name} hat {size}: das Base64 wäre zu lang für hier. Nimm eine unter 50 MB.',
      shown: 'Zu sehen sind die ersten {shown} von {all} Zeichen: Kopieren und Speichern nehmen alles.',
      type: 'Typ',
      unknown: 'Unbekannte Bytes',
      declared: 'Angegeben ist {mime}, die Bytes sind aber ein {kind}.',
      readFailed: '{name} ließ sich nicht lesen.',
      working: '{name} wird gelesen…',
      clear: 'Leeren',
    },
  });

  type Mode = 'encode' | 'decode' | 'file' | 'tofile';
  // The direction and the alphabet are kept; texts and files are not.
  const o = remember('base64', { mode: 'encode' as Mode, url: false, pad: true, as: 'base64' as 'base64' | 'data' });

  /** Bigger files make Base64 too long for a page to hold comfortably. */
  const FILE_LIMIT = 50_000_000;
  /** Past this many characters only the start shows; Copy and Save have all of it. */
  const SHOW_LIMIT = 20_000;

  let plain = $state('');
  let coded = $state('');
  let file = $state<File | null>(null);
  let fileBytes = $state<Uint8Array | null>(null);
  let fileType = $state<Sniffed | null>(null);
  let reading = $state(false);
  let fileError = $state('');

  async function pick(list: File[]) {
    const f = list[0];
    if (!f) return;
    fileError = '';
    fileBytes = null;
    file = f;
    if (f.size > FILE_LIMIT) {
      fileError = w('tooBig', { name: f.name, size: formatBytes(f.size, mark) });
      return;
    }
    reading = true;
    try {
      const kind = await kindOf(f);
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (file !== f) return;
      const sniffed = sniffBytes(bytes, kind);
      // The bytes know photos, PDFs, archives; for plain text the file's own type says more (CSV, JSON).
      fileType = (sniffed.mime === 'text/plain' || sniffed.mime === 'application/octet-stream') && f.type ? { ...sniffed, mime: f.type } : sniffed;
      fileBytes = bytes;
    } catch {
      fileError = w('readFailed', { name: f.name });
    } finally {
      reading = false;
    }
  }

  function forget() {
    file = null;
    fileBytes = null;
    fileType = null;
    fileError = '';
  }

  const mark = $derived(shared.decimal);
  const num = (n: number) => formatNumber(n, mark, { max: 0 });

  type AnyError = DecodeError | { code: 'percent'; index: number } | { code: 'dataUrl' };
  type AnyDecoded = { ok: true; bytes: Uint8Array; mime: string | null } | { ok: false; error: AnyError };

  function decodeAny(text: string): AnyDecoded {
    if (isDataUrl(text)) {
      const p = parseDataUrl(text);
      if (!p) return { ok: false, error: { code: 'dataUrl' } };
      return p.ok ? { ok: true, bytes: p.url.bytes, mime: p.url.mime } : { ok: false, error: p.error };
    }
    const d = decode(text);
    return d.ok ? { ok: true, bytes: d.bytes, mime: null } : { ok: false, error: d.error };
  }

  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);
  const pos = (text: string, index: number) => num([...text.slice(0, index)].length + 1);

  function problem(text: string, e: AnyError): string {
    if (e.code === 'char') return w('errChar', { char: quote(e.char), pos: pos(text, e.index) });
    if (e.code === 'padding') return w('errPadding', { pos: pos(text, e.index) });
    if (e.code === 'length') return w('errLength', { n: num(e.length) });
    if (e.code === 'mixed') return w('errMixed', { pos: pos(text, e.index) });
    if (e.code === 'percent') return w('errPercent', { pos: pos(text, e.index) });
    return w('errDataUrl');
  }

  // Text → Base64
  const encoded = $derived(o.mode === 'encode' && plain ? encodeText(plain, { url: o.url, pad: o.pad }) : '');
  const plainBytes = $derived(o.mode === 'encode' ? new TextEncoder().encode(plain).length : 0);

  // Base64 → text or file
  const decoded = $derived(o.mode === 'decode' || o.mode === 'tofile' ? (coded.trim() ? decodeAny(coded) : null) : null);
  const bytes = $derived(decoded?.ok ? decoded.bytes : null);
  const decodedText = $derived(o.mode === 'decode' && bytes ? asText(bytes) : null);
  const kind = $derived(bytes ? sniffBytes(bytes, sniff(bytes)) : null);
  /** What the decoded file is: the bytes' own type, else what the data: URL declared. */
  const outType = $derived.by(() => {
    if (!kind || !decoded?.ok) return null;
    const declared = decoded.mime;
    if ((kind.mime === 'application/octet-stream' || kind.mime === 'text/plain') && declared) return { label: kind.label || declared, mime: declared, ext: extFor(declared) ?? kind.ext };
    return kind;
  });
  const mismatch = $derived(decoded?.ok && decoded.mime && kind && kind.label && kind.mime !== 'text/plain' && kind.mime !== decoded.mime ? decoded.mime : null);
  const outFile = $derived(o.mode === 'tofile' && bytes && outType ? { blob: new Blob([bytes as BlobPart], { type: outType.mime }), name: `decoded.${outType.ext}` } : null);
  const dims = $derived(bytes && o.mode === 'tofile' ? dimensions(bytes) : null);
  const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'image/bmp'];

  let preview = $state<string | null>(null);
  $effect(() => {
    const f = outFile;
    if (!f || !IMAGES.includes(f.blob.type)) {
      preview = null;
      return;
    }
    const url = URL.createObjectURL(f.blob);
    preview = url;
    return () => URL.revokeObjectURL(url);
  });

  // File → Base64
  const fileOut = $derived(o.mode === 'file' && fileBytes && fileType ? (o.as === 'data' ? dataUrl(fileBytes, fileType.mime) : encode(fileBytes, { url: o.url, pad: o.pad })) : '');

  const result = $derived(o.mode === 'encode' ? encoded : o.mode === 'file' ? fileOut : (decodedText ?? ''));
  const outputs = $derived.by(() => {
    if (o.mode === 'tofile') return outFile ? [outFile] : null;
    if (o.mode === 'file' && fileOut && file) return [{ blob: new Blob([fileOut], { type: 'text/plain' }), name: outName(file.name, o.as === 'data' ? 'dataurl' : 'base64', 'txt', shared.names) }];
    return null;
  });
  const nextItems = $derived(outFile ? [{ file: new File([outFile.blob], outFile.name, { type: outFile.blob.type }) }] : null);
  const encodes = $derived(o.mode === 'encode' || o.mode === 'file');

  // The home's paste or drop: a file goes to File → Base64, Base64 to decoding, other text to encoding.
  const given = untrack(() => ({ text: texts(items)[0], file: filesOf(items)[0] }));
  if (given.file) {
    o.mode = 'file';
    void pick([given.file]);
  } else if (given.text !== undefined) {
    if (isDataUrl(given.text) || shapes(given.text).includes('base64')) {
      coded = given.text;
      const d = decodeAny(given.text);
      o.mode = d.ok && asText(d.bytes) === null ? 'tofile' : 'decode';
    } else {
      plain = given.text;
      o.mode = 'encode';
    }
  }
</script>

<div class="b64">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'encode', label: w('encode') },
      { value: 'decode', label: w('decode') },
      { value: 'file', label: w('file') },
      { value: 'tofile', label: w('tofile') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols even">
    <div class="stack">
      {#if o.mode === 'encode'}
        <h2 class="h">{w('text')}<em>{plain ? formatBytes(plainBytes, mark) : ''}</em></h2>
        <textarea class="field code" aria-label={w('text')} placeholder={w('phText')} spellcheck="false" bind:value={plain}></textarea>
      {:else if o.mode === 'file'}
        <h2 class="h">{w('fileWord')}</h2>
        {#if file}
          <FileRow name={file.name} meta={`${formatBytes(file.size, mark)}${fileType ? ` · ${fileType.label || fileType.mime}` : ''}`} onremove={forget} />
          <DropWell compact accept="*/*" title={w('drop')} onfiles={pick} />
        {:else}
          <DropWell accept="*/*" title={w('drop')} hint={w('dropHint')} onfiles={pick} />
        {/if}
        {#if reading}<p class="note" aria-live="polite">{w('working', { name: file?.name ?? '' })}</p>{/if}
        {#if fileError}<p class="note bad" role="alert">{fileError}</p>{/if}
      {:else}
        <h2 class="h">{w('base64')}<em>{coded.trim() ? w('chars', { n: num(coded.replace(/\s/g, '').length) }) : ''}</em></h2>
        <textarea class="field code" aria-label={w('base64')} placeholder={w('phBase64')} spellcheck="false" autocapitalize="off" autocomplete="off" bind:value={coded}></textarea>
      {/if}
    </div>

    <div class="stack">
      <dl class="spec">
        {#if o.mode === 'file'}
          <div>
            <dt>{w('as')}</dt>
            <dd>
              <Seg
                label={w('as')}
                value={o.as}
                options={[
                  { value: 'base64', label: w('base64') },
                  { value: 'data', label: w('dataUrl') },
                ]}
                onchange={(v) => (o.as = v)}
              />
            </dd>
          </div>
        {/if}
        {#if encodes && !(o.mode === 'file' && o.as === 'data')}
          <div>
            <dt>{w('alphabet')}</dt>
            <dd>
              <Seg
                label={w('alphabet')}
                value={o.url ? 'url' : 'standard'}
                options={[
                  { value: 'standard', label: w('standard') },
                  { value: 'url', label: w('urlSafe'), title: w('urlHint') },
                ]}
                onchange={(v) => (o.url = v === 'url')}
              />
              {#if o.url}<span class="note">{w('urlHint')}</span>{/if}
            </dd>
          </div>
          <div>
            <dt>{w('padding')}</dt>
            <dd><Check checked={o.pad} label={w('pad')} hint={w('padHint')} onchange={(v) => (o.pad = v)} /></dd>
          </div>
        {:else if encodes}
          <div>
            <dt>{w('alphabet')}</dt>
            <dd><span class="note">{w('dataNote')}</span></dd>
          </div>
        {:else}
          <div>
            <dt>{w('reads')}</dt>
            <dd><span class="note">{w('readsNote')}</span></dd>
          </div>
        {/if}
        {#if o.mode === 'tofile' && outType && bytes}
          <div>
            <dt>{w('type')}</dt>
            <dd>
              <div class="big"><b>{outType.label || w('unknown')}</b><span class="size">{formatBytes(bytes.length, mark)}</span></div>
              <code class="mime">{outType.mime}</code>
              {#if mismatch}<span class="note">{w('declared', { mime: mismatch, kind: kind?.label ?? '' })}</span>{/if}
            </dd>
          </div>
        {/if}
      </dl>

      {#if decoded && !decoded.ok}
        <p class="error" role="alert">{problem(coded, decoded.error)}</p>
      {:else if o.mode === 'tofile'}
        {#if outFile && bytes}
          {#if preview}
            <figure class="plate">
              <div class="frame"><img src={preview} alt={outFile.name} /></div>
              <figcaption>
                {#if dims}<code>{dims.width} × {dims.height}</code>{/if}
                <span>{formatBytes(bytes.length, mark)}</span>
                <span>{outFile.name}</span>
              </figcaption>
            </figure>
          {:else}
            <FileRow name={outFile.name} meta={`${formatBytes(bytes.length, mark)} · ${outType?.mime ?? ''}`} />
          {/if}
          <SaveButton {outputs} tool={tool.id} />
          <NextTools items={nextItems} from={tool.id} />
        {:else}
          <p class="note">{w('emptyToFile')}</p>
        {/if}
      {:else if o.mode === 'decode' && bytes && decodedText === null}
        <div class="binary" role="status">
          <p>{kind?.label ? w('binary', { size: formatBytes(bytes.length, mark), kind: kind.label }) : w('binaryUnknown', { size: formatBytes(bytes.length, mark) })}</p>
          <button type="button" class="btn ink" onclick={() => (o.mode = 'tofile')}>{w('saveAsFile')}</button>
        </div>
      {:else if result}
        <div class="bar">
          <h2 class="h grow">
            {o.mode === 'decode' ? w('text') : o.mode === 'file' && o.as === 'data' ? w('dataUrl') : w('base64')}
            <em>
              {#if o.mode === 'decode'}{formatBytes(bytes?.length ?? 0, mark)}{:else}{w('chars', { n: num(result.length) })} · {w('fromSize', { size: formatBytes(o.mode === 'file' ? (fileBytes?.length ?? 0) : plainBytes, mark) })}{/if}
            </em>
          </h2>
          <CopyButton variant="button" text={result} />
        </div>
        <div class="work out" role="region" aria-label={w('result')}>
          <pre class="mono-out">{result.length > SHOW_LIMIT ? result.slice(0, SHOW_LIMIT) + '…' : result}</pre>
        </div>
        {#if result.length > SHOW_LIMIT}<p class="note">{w('shown', { shown: num(SHOW_LIMIT), all: num(result.length) })}</p>{/if}
        {#if outputs}<SaveButton {outputs} tool={tool.id} />{/if}
      {:else if o.mode === 'encode'}
        <p class="note">{w('emptyEncode')}</p>
      {:else if o.mode === 'decode'}
        <p class="note">{bytes ? '' : w('emptyDecode')}</p>
      {:else if !file}
        <p class="note">{w('emptyFile')}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .b64 {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .code {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.55;
    min-height: 200px;
    overflow-wrap: anywhere;
  }

  @media (hover: none) {
    .code {
      font-size: 16px;
    }
  }

  @media (min-width: 760px) {
    .code {
      min-height: 320px;
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

  .size {
    color: var(--ink-2);
  }

  .mime {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-2);
  }

  .binary {
    display: grid;
    gap: 10px;
    justify-items: start;
    padding: 12px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    font-weight: 600;
  }

  .error {
    overflow-wrap: anywhere;
  }
</style>
