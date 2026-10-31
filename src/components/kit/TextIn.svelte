<!--
  A text to work on: a ruled heading with its label, "Open a .txt" and Clear, and the text area. A
  .txt dropped on the area, or picked, fills it (textfile.ts reads it); anything else gets a clear
  line. Shared by the text tools (Count words, Clean up text, Compare texts).
-->
<script lang="ts">
  import { words } from '../../lib/i18n.svelte.ts';
  import { readText } from '../../lib/textfile.ts';

  interface Props {
    id: string;
    label: string;
    value: string;
    oninput: (value: string, from?: string) => void;
    placeholder?: string;
    /** Taller on a computer, where the column has room. */
    rows?: number;
  }

  let { id, label, value, oninput, placeholder, rows = 10 }: Props = $props();

  const w = words({
    en: {
      open: 'Open a .txt',
      clear: 'Clear',
      placeholder: 'Type or paste a text, or drop a .txt here',
      binary: '{name} isn’t a text file.',
      big: '{name} is too big: up to 5 MB of text.',
      opened: '{name} opened',
    },
    de: {
      open: '.txt öffnen',
      clear: 'Leeren',
      placeholder: 'Text tippen oder einfügen, oder eine .txt hier ablegen',
      binary: '{name} ist keine Textdatei.',
      big: '{name} ist zu groß: bis 5 MB Text.',
      opened: '{name} geöffnet',
    },
  });

  let input: HTMLInputElement;
  let over = $state(false);
  let problem = $state('');
  let opened = $state('');

  async function open(file: File | undefined) {
    if (!file) return;
    problem = '';
    const read = await readText(file);
    if ('error' in read) {
      problem = w(read.error, { name: file.name });
      return;
    }
    opened = file.name;
    oninput(read.text, file.name);
  }

  function dropped(e: DragEvent) {
    over = false;
    const file = e.dataTransfer?.files?.[0];
    // Text dragged from another app goes in the way the browser puts it; a file is ours to read.
    if (!file) return;
    e.preventDefault();
    void open(file);
  }
</script>

<div class="text-in">
  <div class="h">
    <label for={id}>{label}</label>
    <em>
      <button type="button" class="link" onclick={() => input.click()}>{w('open')}</button>
      {#if value}<button type="button" class="link" onclick={() => { opened = ''; problem = ''; oninput(''); }}>{w('clear')}</button>{/if}
    </em>
  </div>
  <textarea
    {id}
    class="field"
    class:over
    {rows}
    spellcheck="false"
    placeholder={placeholder ?? w('placeholder')}
    {value}
    oninput={(e) => {
      problem = '';
      oninput(e.currentTarget.value);
    }}
    ondragover={(e) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        over = true;
      }
    }}
    ondragleave={() => (over = false)}
    ondrop={dropped}
  ></textarea>
  <input
    bind:this={input}
    class="sr"
    type="file"
    accept=".txt,.text,.md,.csv,.log,text/plain"
    tabindex="-1"
    aria-hidden="true"
    onchange={() => {
      const file = input.files?.[0];
      input.value = '';
      void open(file);
    }}
  />
  {#if problem}
    <p class="note bad" role="alert">{problem}</p>
  {:else if opened && value}
    <p class="note" aria-live="polite">{w('opened', { name: opened })}</p>
  {/if}
</div>

<style>
  .text-in {
    display: grid;
    gap: 8px;
    min-width: 0;
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

  .note {
    overflow-wrap: anywhere;
  }
</style>
