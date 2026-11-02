<!--
  F-306 Fancy text: a text, and below it the same text in sixteen styles at once (fancy.ts), each
  with its name and Copy. A text that comes in fancy gets a first row in plain letters again, under
  the highlighter: that's the answer, and the styles start from it. Nothing is kept: no options, and
  never the text.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { readText } from '../../lib/textfile.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { allStyles, plain, isFancy } from './fancy.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      text: 'Text',
      placeholder: 'Type or paste a name, a line, a word',
      clear: 'Clear',
      sample: 'Your text',
      styles: 'In 16 styles',
      plain: 'Plain again',
      plainHint: 'the text in normal letters',
      copy: 'Copy',
      note: 'Screen readers read these letters badly or not at all: keep a name that matters plain.',
      bold: 'Bold',
      italic: 'Italic',
      boldItalic: 'Bold italic',
      script: 'Script',
      boldScript: 'Bold script',
      fraktur: 'Fraktur',
      double: 'Double-struck',
      sansBold: 'Sans bold',
      sansItalic: 'Sans italic',
      mono: 'Monospace',
      circled: 'Circled',
      squared: 'Squared',
      squaredHint: 'capitals only',
      wide: 'Full width',
      smallCaps: 'Small caps',
      upsideDown: 'Upside down',
      struck: 'Struck through',
    },
    de: {
      text: 'Text',
      placeholder: 'Einen Namen, eine Zeile, ein Wort tippen oder einfügen',
      clear: 'Leeren',
      sample: 'Dein Text',
      styles: 'In 16 Stilen',
      plain: 'Wieder normal',
      plainHint: 'der Text in normalen Buchstaben',
      copy: 'Kopieren',
      note: 'Screenreader lesen diese Buchstaben schlecht oder gar nicht: einen Namen, auf den es ankommt, lieber normal schreiben.',
      bold: 'Fett',
      italic: 'Kursiv',
      boldItalic: 'Fett kursiv',
      script: 'Schreibschrift',
      boldScript: 'Fette Schreibschrift',
      fraktur: 'Fraktur',
      double: 'Doppelstrich',
      sansBold: 'Serifenlos fett',
      sansItalic: 'Serifenlos kursiv',
      mono: 'Schreibmaschine',
      circled: 'Eingekreist',
      squared: 'Im Quadrat',
      squaredHint: 'nur Großbuchstaben',
      wide: 'Volle Breite',
      smallCaps: 'Kapitälchen',
      upsideDown: 'Kopfüber',
      struck: 'Durchgestrichen',
    },
  });

  let text = $state('');

  // What came from the home or another tool: a text, or a .txt.
  const given = untrack(() => texts(items));
  if (given.length) text = given.join('\n\n');
  else {
    const file = untrack(() => files(items))[0];
    if (file) void readText(file).then((r) => 'text' in r && (text = r.text));
  }

  const fancy = $derived(isFancy(text));
  const plainText = $derived(fancy ? plain(text) : '');
  // A fancy text is restyled from its plain letters, so every row shows its own style.
  const source = $derived(fancy ? plainText : text);
  const typed = $derived(source.trim() !== '');
  const rows = $derived(allStyles(typed ? source : w('sample')));
</script>

<div class="cols">
  <div class="stack compose">
    <div class="h">
      <label for="fancy-text">{w('text')}</label>
      {#if text}<em><button type="button" class="link clear" onclick={() => (text = '')}>{w('clear')}</button></em>{/if}
    </div>
    <textarea id="fancy-text" class="field" rows="3" spellcheck="false" placeholder={w('placeholder')} value={text} oninput={(e) => (text = e.currentTarget.value)}></textarea>
    <p class="note">{w('note')}</p>
  </div>

  <section class="stack" aria-label={w('styles')}>
    <h2 class="h">{w('styles')}</h2>
    <ol class="styles">
      {#if fancy}
        <li class="style" data-style="plain">
          <span class="label">{w('plain')}<span class="hint">{` · ${w('plainHint')}`}</span></span>
          <p class="shown"><span class="answer">{plainText}</span></p>
          <CopyButton text={plainText} variant="button" label={w('copy')} />
        </li>
      {/if}
      {#each rows as row (row.id)}
        <li class="style" class:sample={!typed} data-style={row.id}>
          <span class="label">{w(row.id)}{#if row.id === 'squared'}<span class="hint">{` · ${w('squaredHint')}`}</span>{/if}</span>
          <p class="shown">{row.text}</p>
          {#if typed}<CopyButton text={row.text} variant="button" label={w('copy')} />{/if}
        </li>
      {/each}
    </ol>
  </section>
</div>

<style>
  .h label {
    min-width: 0;
  }

  /* 40 px to tap, without making the heading taller. */
  .h .clear {
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0;
    padding: 11px 0;
    margin: -11px 0;
  }

  textarea {
    font-family: var(--sans);
  }

  textarea.field {
    min-height: 96px;
  }

  .styles {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .style {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 14px;
    align-items: center;
    padding: 10px 0 12px;
    border-bottom: 1px solid var(--rule);
    min-width: 0;
  }

  .style > .label {
    grid-column: 1;
    overflow-wrap: anywhere;
  }

  .hint {
    text-transform: none;
  }

  .shown {
    grid-column: 1;
    min-width: 0;
    font-size: 22px;
    line-height: 1.35;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .sample .shown {
    color: var(--ink-2);
  }

  .style > :global(.btn) {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  /* The answer: the text in plain letters, under the highlighter. */
  .answer {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 6px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  @media (max-width: 759px) {
    .shown {
      font-size: 20px;
    }
  }

  /* On a computer the text stays in view while the styles scroll past. */
  @media (min-width: 760px) {
    .compose {
      position: sticky;
      top: 92px;
    }
  }
</style>
