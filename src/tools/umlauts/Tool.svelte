<!--
  F-304 Fix umlauts. Repair: UTF-8 read as Windows-1252 ("GrÃ¼ÃŸe" → "Grüße", "â€ž" → „), text
  broken twice, and a file saved in the old Windows encoding (read as such when its bytes aren't
  UTF-8). Spell out: ä → ae, ß → ss, é → e, and file names if wanted. The places that changed are
  marked in the result; Copy, and Save as a UTF-8 .txt. The mode is kept; the text never is.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { outName, formatBytes } from '../../lib/files.ts';
  import { MAX_TEXT_BYTES } from '../../lib/textfile.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { repair, spellOut, decodeFile, type Encoding } from './umlauts.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      repair: 'Repair',
      spell: 'Spell out',
      text: 'Text',
      open: 'Open a file',
      clear: 'Clear',
      placeholder: 'Paste text with broken letters like “GrÃ¼ÃŸe”, or drop a .txt or .csv here',
      placeholderSpell: 'Type or paste a text with umlauts, or drop a .txt here',
      opened: '{name} opened',
      binary: '{name} isn’t a text file.',
      big: '{name} is too big: up to {max} of text.',
      read: 'Read as',
      utf8: 'UTF-8',
      'utf-16': 'UTF-16',
      win: 'Windows-1252',
      winWhy: 'Its bytes aren’t UTF-8: it was saved in the old Windows encoding. Saved again, it’s UTF-8.',
      found: 'Found',
      'fixed.one': '{n} place fixed',
      'fixed.other': '{n} places fixed',
      twice: 'Broken {n} times over: repaired {n} times.',
      none: 'Nothing broken found.',
      noneFile: 'Nothing broken inside. Saved again, it reads right everywhere.',
      changed: 'Changed',
      'spelt.one': '{n} letter spelled out',
      'spelt.other': '{n} letters spelled out',
      noneSpelt: 'No umlauts or accents in it.',
      names: 'Names',
      safe: 'Safe for file names',
      safeHint: 'Spaces become hyphens; what file systems refuse (: / ? * and more) is dropped',
      repairHow: 'Repair turns letters that went through the wrong encoding back into the right ones. Right letters stay as they are.',
      spellHow: 'ä → ae, ö → oe, ü → ue, ß → ss, Ä → Ae, é → e: for forms and file names that refuse them.',
      result: 'Result',
      marked: 'marked',
      empty: 'Paste or type a text, or open a file.',
      copy: 'Copy the text',
    },
    de: {
      mode: 'Modus',
      repair: 'Reparieren',
      spell: 'Ausschreiben',
      text: 'Text',
      open: 'Datei öffnen',
      clear: 'Leeren',
      placeholder: 'Text mit kaputten Zeichen wie „GrÃ¼ÃŸe“ einfügen, oder eine .txt oder .csv hier ablegen',
      placeholderSpell: 'Text mit Umlauten tippen oder einfügen, oder eine .txt hier ablegen',
      opened: '{name} geöffnet',
      binary: '{name} ist keine Textdatei.',
      big: '{name} ist zu groß: bis {max} Text.',
      read: 'Gelesen als',
      utf8: 'UTF-8',
      'utf-16': 'UTF-16',
      win: 'Windows-1252',
      winWhy: 'Ihre Bytes sind kein UTF-8: sie wurde in der alten Windows-Kodierung gespeichert. Neu gespeichert ist sie UTF-8.',
      found: 'Gefunden',
      'fixed.one': '{n} Stelle repariert',
      'fixed.other': '{n} Stellen repariert',
      twice: '{n}-mal kaputt: {n}-mal repariert.',
      none: 'Nichts Kaputtes gefunden.',
      noneFile: 'Darin ist nichts kaputt. Neu gespeichert liest sie sich überall richtig.',
      changed: 'Geändert',
      'spelt.one': '{n} Buchstabe ausgeschrieben',
      'spelt.other': '{n} Buchstaben ausgeschrieben',
      noneSpelt: 'Keine Umlaute oder Akzente darin.',
      names: 'Namen',
      safe: 'Sicher für Dateinamen',
      safeHint: 'Leerzeichen werden Bindestriche; was Dateisysteme ablehnen (: / ? * und mehr), fällt weg',
      repairHow: 'Reparieren macht Zeichen, die durch die falsche Kodierung gingen, wieder richtig. Richtige bleiben, wie sie sind.',
      spellHow: 'ä → ae, ö → oe, ü → ue, ß → ss, Ä → Ae, é → e: für Formulare und Dateinamen, die sie ablehnen.',
      result: 'Ergebnis',
      marked: 'markiert',
      empty: 'Text einfügen oder tippen, oder eine Datei öffnen.',
      copy: 'Text kopieren',
    },
  });

  // The mode and the switch are kept between visits; the text never is.
  const o = remember('umlauts', { mode: 'repair' as 'repair' | 'spell', safe: false });

  let text = $state('');
  /** The file the text came from, and how it was read. */
  let from = $state<{ name: string; encoding: Encoding } | null>(null);
  let problem = $state('');
  let over = $state(false);
  let input: HTMLInputElement;

  async function openFile(file: File | undefined) {
    if (!file) return;
    problem = '';
    if (file.size > MAX_TEXT_BYTES) {
      problem = w('big', { name: file.name, max: formatBytes(MAX_TEXT_BYTES, shared.decimal) });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
    if (!utf16 && bytes.subarray(0, 8192).includes(0)) {
      problem = w('binary', { name: file.name });
      return;
    }
    const read = decodeFile(bytes);
    text = read.text;
    from = { name: file.name, encoding: read.encoding };
  }

  // What came from the home: a pasted text, or a dropped file.
  const given = untrack(() => texts(items));
  if (given.length) text = given.join('\n\n');
  else void openFile(untrack(() => files(items))[0]);

  // A whole book waits for a pause in typing; everyday texts follow every key.
  let settled = $state('');
  $effect(() => {
    const t = text;
    if (t.length < 100_000) {
      settled = t;
      return;
    }
    const timer = setTimeout(() => (settled = t), 250);
    return () => clearTimeout(timer);
  });

  const repaired = $derived(o.mode === 'repair' ? repair(settled) : null);
  const spelt = $derived(o.mode === 'spell' ? spellOut(settled, o.safe) : null);
  const result = $derived(repaired ?? spelt!);
  const count = $derived(repaired ? repaired.fixed : spelt!.changed);

  const outputs = $derived(
    result.text && settled === text
      ? [{ blob: new Blob([result.text], { type: 'text/plain;charset=utf-8' }), name: outName(from?.name ?? 'text.txt', o.mode === 'repair' ? 'fixed' : 'plain', 'txt', shared.names) }]
      : null,
  );
  const nextItems = $derived(result.text.trim() ? [{ text: result.text }] : null);
</script>

<div class="umlauts">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'repair', label: w('repair') },
      { value: 'spell', label: w('spell') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols">
    <div class="stack">
      <div class="h">
        <label for="umlauts-text">{w('text')}</label>
        <em>
          <button type="button" class="link" onclick={() => input.click()}>{w('open')}</button>
          {#if text}
            <button
              type="button"
              class="link"
              onclick={() => {
                text = '';
                from = null;
                problem = '';
              }}>{w('clear')}</button
            >
          {/if}
        </em>
      </div>
      <textarea
        id="umlauts-text"
        class="field"
        class:over
        rows="10"
        spellcheck="false"
        placeholder={o.mode === 'repair' ? w('placeholder') : w('placeholderSpell')}
        value={text}
        oninput={(e) => {
          text = e.currentTarget.value;
          problem = '';
          if (!text) from = null;
        }}
        ondragover={(e) => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            over = true;
          }
        }}
        ondragleave={() => (over = false)}
        ondrop={(e) => {
          over = false;
          const file = e.dataTransfer?.files?.[0];
          if (!file) return;
          e.preventDefault();
          void openFile(file);
        }}
      ></textarea>
      <input
        bind:this={input}
        class="sr"
        type="file"
        accept=".txt,.text,.csv,.tsv,.md,.log,text/plain,text/csv"
        tabindex="-1"
        aria-hidden="true"
        onchange={() => {
          const file = input.files?.[0];
          input.value = '';
          void openFile(file);
        }}
      />
      {#if problem}
        <p class="note bad" role="alert">{problem}</p>
      {:else if from && text}
        <p class="note opened" aria-live="polite">{w('opened', { name: from.name })}</p>
      {/if}
    </div>

    <div class="stack">
      <dl class="spec">
        {#if from && text}
          <div>
            <dt>{w('read')}</dt>
            <dd>
              <b class="enc">{from.encoding === 'windows-1252' ? w('win') : from.encoding === 'utf-16' ? w('utf-16') : w('utf8')}</b>
              {#if from.encoding === 'windows-1252'}<span class="note">{w('winWhy')}</span>{/if}
            </dd>
          </div>
        {/if}
        {#if o.mode === 'repair'}
          <div>
            <dt>{w('found')}</dt>
            <dd aria-live="polite">
              {#if !settled.trim()}
                <span class="note">{w('empty')}</span>
              {:else if count}
                <div class="big"><b>{w('fixed', { n: count })}</b></div>
                {#if repaired && repaired.passes > 1}<span class="note">{w('twice', { n: repaired.passes })}</span>{/if}
              {:else}
                <span class="nothing">{from ? w('noneFile') : w('none')}</span>
              {/if}
            </dd>
          </div>
        {:else}
          <div>
            <dt>{w('changed')}</dt>
            <dd aria-live="polite">
              {#if !settled.trim()}
                <span class="note">{w('empty')}</span>
              {:else if count}
                <div class="big"><b>{w('spelt', { n: count })}</b></div>
              {:else}
                <span class="nothing">{w('noneSpelt')}</span>
              {/if}
            </dd>
          </div>
          <div>
            <dt>{w('names')}</dt>
            <dd><Check checked={o.safe} label={w('safe')} hint={w('safeHint')} onchange={(v) => (o.safe = v)} /></dd>
          </div>
        {/if}
      </dl>
      <p class="note">{o.mode === 'repair' ? w('repairHow') : w('spellHow')}</p>
    </div>

    {#if result.text}
      <section class="wide stack" aria-label={w('result')}>
        <h2 class="h">{w('result')} {#if count}<em><mark class="fix">ü</mark> {w('marked')}</em>{/if}</h2>
        <pre class="work mono-out out">{#each result.pieces as p, i (i)}{#if p.fixed}<mark class="fix">{p.text}</mark>{:else}{p.text}{/if}{/each}</pre>
        <div class="acts">
          <CopyButton text={result.text} variant="button" label={w('copy')} />
        </div>
        <SaveButton {outputs} tool={tool.id} />
        <NextTools items={nextItems} from={tool.id} prefer={['clean', 'count', 'compare']} />
      </section>
    {/if}
  </div>
</div>

<style>
  .umlauts {
    display: grid;
    gap: 18px;
  }

  .h label {
    min-width: 0;
  }

  .h em {
    display: flex;
    gap: 14px;
  }

  /* 40 px to tap, without making the heading taller. */
  .h .link {
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0;
    padding: 11px 0;
    margin: -11px 0;
  }

  textarea {
    font-family: var(--sans);
  }

  textarea.over {
    background: var(--mark);
    color: var(--mark-ink);
  }

  .opened {
    overflow-wrap: anywhere;
  }

  .enc {
    font-family: var(--mono);
    font-size: 15px;
  }

  .big b {
    font-size: 24px;
  }

  .nothing {
    font-size: 15px;
    font-weight: 600;
  }

  .out {
    margin: 0;
    padding: 12px 14px;
    max-height: min(60dvh, 520px);
    overflow: auto;
  }

  .fix {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 1px;
  }

  .h .fix {
    padding: 0 4px;
    font-weight: 700;
  }

  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (min-width: 760px) {
    .wide :global(.save) {
      justify-self: start;
      width: auto;
      min-width: 320px;
    }
  }
</style>
