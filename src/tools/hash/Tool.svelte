<!--
  F-906 Hashes: a text or a file to MD5, SHA-1, SHA-256, SHA-384 and SHA-512, in hex (either case)
  or Base64; paste the hash from a download page and it says whether it matches, and which. A file
  is read in slices with its progress, up to 1 GB. Nothing typed or dropped is kept; the choices
  are. Logic in hash.ts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Row from './Row.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes } from '../../lib/files.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { ALGOS, ALGO_NAME, hashAll, hashBlob, TooBig, toHex, toBase64, compare, type Digests, type Algo } from './hash.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Hash of',
      text: 'Text',
      file: 'File',
      textPh: 'Type or paste text',
      newline: 'End with a line break',
      newlineNote: 'Like echo without -n: then it matches echo "…" | sha256sum.',
      emptyText: 'Type or paste a text: its hashes follow as you type.',
      emptyFile: 'Drop a file: its hashes follow. Nothing is uploaded.',
      drop: 'Drop a file, or pick one',
      dropHint: 'Any kind, up to 1 GB',
      format: 'Format',
      hex: 'hex',
      upper: 'HEX',
      base64: 'Base64',
      expected: 'Expected hash',
      expectedPh: 'From the download page',
      hashes: 'Hashes',
      reading: 'Reading {pct} % · {done} of {total}',
      finishing: 'Working out the SHA hashes …',
      tooBig: '{name} is {size}: this reads files up to 1 GB.',
      unreadableFile: 'This file can’t be read: {name}.',
      match: 'Matches: {algo}.',
      asBase64: 'Read as Base64.',
      mismatchFile: 'Doesn’t match. It’s as long as a {algo} hash: this isn’t the same file.',
      mismatchText: 'Doesn’t match. It’s as long as a {algo} hash: this isn’t the same text.',
      lengthHex: '{digits} hex digits: none of these hashes is that long.',
      lengthB64: '{bytes} bytes in Base64: none of these hashes is that long.',
      unreadable: 'Not a hash this reads: hex digits or Base64.',
      wait: 'Waiting for a text or a file to compare with.',
      weak: 'MD5 and SHA-1 are fine for checking a download, not for security.',
    },
    de: {
      mode: 'Hash von',
      text: 'Text',
      file: 'Datei',
      textPh: 'Text tippen oder einfügen',
      newline: 'Mit Zeilenumbruch am Ende',
      newlineNote: 'Wie echo ohne -n: Dann stimmt es mit echo "…" | sha256sum überein.',
      emptyText: 'Tipp oder füg einen Text ein: Seine Hashes folgen beim Tippen.',
      emptyFile: 'Leg eine Datei ab: Ihre Hashes folgen. Nichts wird hochgeladen.',
      drop: 'Datei ablegen oder auswählen',
      dropHint: 'Jede Art, bis 1 GB',
      format: 'Format',
      hex: 'hex',
      upper: 'HEX',
      base64: 'Base64',
      expected: 'Erwarteter Hash',
      expectedPh: 'Von der Download-Seite',
      hashes: 'Hashes',
      reading: 'Lese {pct} % · {done} von {total}',
      finishing: 'Rechne die SHA-Hashes aus …',
      tooBig: '{name} hat {size}: Hier gehen Dateien bis 1 GB.',
      unreadableFile: 'Diese Datei lässt sich nicht lesen: {name}.',
      match: 'Stimmt überein: {algo}.',
      asBase64: 'Als Base64 gelesen.',
      mismatchFile: 'Stimmt nicht. Er ist so lang wie ein {algo}-Hash: Das ist nicht dieselbe Datei.',
      mismatchText: 'Stimmt nicht. Er ist so lang wie ein {algo}-Hash: Das ist nicht derselbe Text.',
      lengthHex: '{digits} Hex-Ziffern: Keiner dieser Hashes ist so lang.',
      lengthB64: '{bytes} Bytes in Base64: Keiner dieser Hashes ist so lang.',
      unreadable: 'Kein Hash, der sich lesen lässt: Hex-Ziffern oder Base64.',
      wait: 'Wartet auf einen Text oder eine Datei zum Vergleichen.',
      weak: 'MD5 und SHA-1 taugen zum Prüfen eines Downloads, nicht für Sicherheit.',
    },
  });

  // The mode, the format and the line break are kept; the text, the file and the hashes are not.
  const o = remember('hash', { mode: 'text' as 'text' | 'file', format: 'hex' as 'hex' | 'upper' | 'base64', newline: false });

  let text = $state('');
  let file = $state<File | null>(null);
  let expected = $state('');
  let digests = $state<Digests | null>(null);
  let working = $state(false);
  let progress = $state<{ done: number; total: number } | null>(null);
  let fileError = $state('');
  /** Only the newest request writes its result. */
  let seq = 0;

  const mark = $derived(shared.decimal);
  const encoder = new TextEncoder();
  const textBytes = $derived(encoder.encode(o.newline && text ? `${text}\n` : text));

  $effect(() => {
    const id = ++seq;
    if (o.mode === 'text') {
      const bytes = textBytes;
      working = false;
      progress = null;
      if (!text) {
        digests = null;
        return;
      }
      hashAll(bytes).then((d) => {
        if (id === seq) digests = d;
      });
      return;
    }
    const f = file;
    digests = null;
    fileError = '';
    if (!f) {
      working = false;
      progress = null;
      return;
    }
    working = true;
    progress = { done: 0, total: f.size };
    hashBlob(f, {
      onProgress: (done, total) => {
        if (id === seq) progress = { done, total };
      },
      stale: () => id !== seq,
    })
      .then((d) => {
        if (d && id === seq) digests = d;
      })
      .catch((e) => {
        if (id !== seq) return;
        fileError = e instanceof TooBig ? w('tooBig', { name: f.name, size: formatBytes(f.size, untrack(() => mark)) }) : w('unreadableFile', { name: f.name });
      })
      .finally(() => {
        if (id === seq) working = false;
      });
  });

  function pick(list: File[]) {
    if (list[0]) file = list[0];
  }

  const shown = (b: Uint8Array) => (o.format === 'base64' ? toBase64(b) : toHex(b, o.format === 'upper'));

  const result = $derived(digests && expected.trim() ? compare(expected, digests) : null);
  const answer = $derived<Algo>(result?.state === 'match' || result?.state === 'mismatch' ? result.algo : 'sha256');

  const verdict = $derived.by((): { ok: boolean | null; text: string; extra?: string } | null => {
    if (!expected.trim()) return null;
    if (!digests) return working ? null : { ok: null, text: w('wait') };
    if (!result) return null;
    const algo = 'algo' in result ? ALGO_NAME[result.algo] : '';
    if (result.state === 'match') return { ok: true, text: w('match', { algo }), extra: result.form === 'base64' ? w('asBase64') : '' };
    if (result.state === 'mismatch') return { ok: false, text: w(o.mode === 'file' ? 'mismatchFile' : 'mismatchText', { algo }) };
    if (result.state === 'length') return { ok: false, text: result.form === 'hex' ? w('lengthHex', { digits: result.digits }) : w('lengthB64', { bytes: result.bytes }) };
    return { ok: false, text: w('unreadable') };
  });

  const pct = $derived(progress && progress.total ? Math.floor((progress.done / progress.total) * 100) : 0);
  const size = $derived(o.mode === 'text' ? (text ? formatBytes(textBytes.length, mark) : '') : file ? formatBytes(file.size, mark) : '');

  // A text or a file handed in from the home or another tool.
  const given = untrack(() => ({ file: filesOf(items)[0], text: texts(items)[0] }));
  if (given.file) {
    o.mode = 'file';
    file = given.file;
  } else if (given.text) {
    o.mode = 'text';
    text = given.text;
  }
</script>

<div class="hash">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'text', label: w('text') },
      { value: 'file', label: w('file') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols even">
    <div class="stack">
      {#if o.mode === 'text'}
        <h2 class="h">{w('text')}<em>{size}</em></h2>
        <textarea class="field" aria-label={w('text')} placeholder={w('textPh')} spellcheck="false" bind:value={text}></textarea>
        <Check label={w('newline')} checked={o.newline} onchange={(v) => (o.newline = v)} />
        <p class="note">{w('newlineNote')}</p>
      {:else}
        <h2 class="h">{w('file')}<em>{size}</em></h2>
        {#if file}
          <FileRow name={file.name} meta={formatBytes(file.size, mark)} onremove={() => (file = null)} />
          <DropWell compact accept="*/*" title={w('drop')} onfiles={pick} />
        {:else}
          <DropWell accept="*/*" title={w('drop')} hint={w('dropHint')} onfiles={pick} />
        {/if}
        <p class="note progress" aria-live="polite">
          {#if working && progress && progress.done < progress.total}
            {w('reading', { pct, done: formatBytes(progress.done, mark), total: formatBytes(progress.total, mark) })}
          {:else if working}
            {w('finishing')}
          {/if}
        </p>
        {#if working && progress}<div class="bar" aria-hidden="true"><span style:width="{pct}%"></span></div>{/if}
        {#if fileError}<p class="error" role="alert">{fileError}</p>{/if}
      {/if}
    </div>

    <div class="stack">
      <dl class="spec">
        <div>
          <dt>{w('format')}</dt>
          <dd>
            <Seg
              label={w('format')}
              value={o.format}
              options={[
                { value: 'hex', label: w('hex') },
                { value: 'upper', label: w('upper') },
                { value: 'base64', label: w('base64') },
              ]}
              onchange={(f) => (o.format = f)}
            />
          </dd>
        </div>
        <div>
          <dt>{w('expected')}</dt>
          <dd>
            <input class="field expected" type="text" aria-label={w('expected')} placeholder={w('expectedPh')} autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={expected} />
          </dd>
        </div>
      </dl>
      {#if verdict}
        <p class="verdict" class:yes={verdict.ok === true} class:no={verdict.ok === false} role="status">
          {verdict.text}{#if verdict.extra}{' '}<span>{verdict.extra}</span>{/if}
        </p>
      {/if}
      <p class="note">{w('weak')}</p>
    </div>

    <div class="wide digests">
      {#if digests}
        <Receipt title={w('hashes')} aside={size}>
          {#each ALGOS as algo (algo)}
            <Row label={ALGO_NAME[algo]} value={shown(digests[algo])} hl={algo === answer} />
          {/each}
        </Receipt>
      {:else if !working && !fileError}
        <p class="note">{o.mode === 'text' ? w('emptyText') : w('emptyFile')}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .hash {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .digests {
    container-type: inline-size;
    min-width: 0;
  }

  .expected {
    font-family: var(--mono);
  }

  /* The hint in words, the hash itself in mono. */
  .expected::placeholder {
    font-family: var(--sans);
  }

  .progress:empty {
    display: none;
  }

  .bar {
    height: 6px;
    border: 1.5px solid var(--ink);
    background: var(--card);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--ink);
  }

  .verdict {
    padding: 10px 12px;
    border: 1.5px solid var(--rule);
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .verdict.yes {
    border-color: var(--ok);
    color: var(--ok);
  }

  .verdict.no {
    border-color: var(--bad);
    color: var(--bad);
  }

  .verdict span {
    font-weight: 400;
  }
</style>
