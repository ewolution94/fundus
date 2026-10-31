<!--
  F-301 Count words: live as you type or paste. Words, characters with and without spaces,
  sentences, paragraphs, lines, reading and speaking time, as a receipt with Copy on each line
  (count.ts). A .txt dropped on the area, picked, or brought from the home goes in.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Line from '../../components/kit/Line.svelte';
  import TextIn from '../../components/kit/TextIn.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { count, splitDuration, READ_WPM, SPEAK_WPM, type Counts } from './count.ts';
  import { readText } from '../../lib/textfile.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      text: 'Text',
      counts: 'Counts',
      words: 'Words',
      characters: 'Characters',
      noSpaces: 'Without spaces',
      sentences: 'Sentences',
      paragraphs: 'Paragraphs',
      lines: 'Lines',
      reading: 'Reading time',
      speaking: 'Speaking time',
      empty: 'Type or paste a text, or open a .txt: the counts follow as you type.',
      pace: 'Reading at {read} words a minute, speaking at {speak}.',
      h: '{n} h',
      min: '{n} min',
      s: '{n} s',
      counting: 'Counting…',
    },
    de: {
      text: 'Text',
      counts: 'Zahlen',
      words: 'Wörter',
      characters: 'Zeichen',
      noSpaces: 'Ohne Leerzeichen',
      sentences: 'Sätze',
      paragraphs: 'Absätze',
      lines: 'Zeilen',
      reading: 'Lesezeit',
      speaking: 'Sprechzeit',
      empty: 'Text tippen oder einfügen, oder eine .txt öffnen: die Zahlen folgen beim Tippen.',
      pace: 'Lesen mit {read} Wörtern pro Minute, Sprechen mit {speak}.',
      h: '{n} Std.',
      min: '{n} Min.',
      s: '{n} Sek.',
      counting: 'Wird gezählt…',
    },
  });

  let text = $state('');

  // Text pasted on the home, or a .txt dropped there, goes in once.
  const given = untrack(() => texts(items));
  if (given.length) text = given.join('\n\n');
  else {
    const file = untrack(() => files(items))[0];
    if (file) void readText(file).then((r) => 'text' in r && (text = r.text));
  }

  // Counting is quick; a whole book (hundreds of thousands of characters) waits for a pause in typing.
  // Short texts are counted straight away (no effect in between, so the first paint has them).
  const LONG = 60_000;
  let late = $state('');
  $effect(() => {
    const t = text;
    if (t.length < LONG) return;
    const timer = setTimeout(() => (late = t), 250);
    return () => clearTimeout(timer);
  });
  const settled = $derived(text.length < LONG ? text : late);

  const c: Counts = $derived(count(settled, locale()));
  const pending = $derived(settled !== text);
  const mark = $derived(shared.decimal);
  const num = (n: number) => formatNumber(n, mark, { max: 0 });
  const raw = (n: number) => String(n);

  function time(seconds: number): string {
    const d = splitDuration(seconds);
    const parts: string[] = [];
    if (d.h) parts.push(w('h', { n: d.h }));
    if (d.m) parts.push(w('min', { n: d.m }));
    if (d.s || !parts.length) parts.push(w('s', { n: d.s }));
    return parts.join(' ');
  }
</script>

<div class="cols">
  <div class="stack">
    <TextIn id="count-text" label={w('text')} value={text} oninput={(v) => (text = v)} rows={14} />
  </div>

  <div class="stack">
    <Receipt title={w('counts')} aside={pending ? w('counting') : ''}>
      <Line label={w('words')} value={num(c.words)} copy={raw(c.words)} hl total />
      <Line label={w('characters')} value={num(c.characters)} copy={raw(c.characters)} />
      <Line label={w('noSpaces')} value={num(c.charactersNoSpaces)} copy={raw(c.charactersNoSpaces)} />
      <Line label={w('sentences')} value={num(c.sentences)} copy={raw(c.sentences)} />
      <Line label={w('paragraphs')} value={num(c.paragraphs)} copy={raw(c.paragraphs)} />
      <Line label={w('lines')} value={num(c.lines)} copy={raw(c.lines)} />
      <Line label={w('reading')} value={time(c.reading)} />
      <Line label={w('speaking')} value={time(c.speaking)} />
    </Receipt>
    {#if !text.trim()}
      <p class="note">{w('empty')}</p>
    {:else}
      <p class="note">{w('pace', { read: READ_WPM, speak: SPEAK_WPM })}</p>
    {/if}
  </div>
</div>
