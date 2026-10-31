<!--
  F-302 Clean up text: steps switched on, applied top to bottom in a fixed order (clean.ts), the
  result with Copy and Save as .txt, and a line saying what changed. The steps are kept; the text
  is not.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Check from '../../components/kit/Check.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import TextIn from '../../components/kit/TextIn.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { outName } from '../../lib/files.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { clean, anyStep, type CaseMode, type SortMode, type Changes } from './clean.ts';
  import { readText } from '../../lib/textfile.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      text: 'Text',
      quotesRow: 'Quotes',
      quotes: 'Plain quotes and dashes',
      quotesHint: '“ ” ‘ ’ – — … become " \' - -- ...',
      spacesRow: 'Spaces',
      trim: 'Trim lines',
      trimHint: 'Spaces at the start and end of each line',
      spaces: 'Collapse double spaces',
      spacesHint: 'Two or more between words become one',
      breaksRow: 'Breaks',
      join: 'Join stray line breaks',
      joinHint: 'Wrapped lines become paragraphs; blank lines and lists stay',
      empty: 'Remove empty lines',
      caseRow: 'Case',
      keep: 'As is',
      upper: 'UPPER',
      lower: 'lower',
      title: 'Title Case',
      sentence: 'Sentence case',
      linesRow: 'Lines',
      dupes: 'Remove duplicate lines',
      dupesHint: 'The first one stays',
      sort: 'Sort',
      off: 'Off',
      az: 'A–Z',
      za: 'Z–A',
      num: 'By number',
      order: 'The steps run top to bottom, whichever are on.',
      result: 'Result',
      emptyIn: 'Type or paste a text, or open a .txt, and switch on the steps it needs.',
      noSteps: 'Switch on a step to clean the text.',
      nothing: 'Already clean for these steps: nothing changed.',
      copy: 'Copy the text',
      'n_quotes.one': '{n} quote or dash',
      'n_quotes.other': '{n} quotes and dashes',
      'n_trimmed.one': '{n} line trimmed',
      'n_trimmed.other': '{n} lines trimmed',
      'n_spaces.one': '{n} double space',
      'n_spaces.other': '{n} double spaces',
      'n_joined.one': '{n} line break joined',
      'n_joined.other': '{n} line breaks joined',
      'n_empty.one': '{n} empty line',
      'n_empty.other': '{n} empty lines',
      'n_cased.one': '{n} word in a new case',
      'n_cased.other': '{n} words in a new case',
      'n_dupes.one': '{n} duplicate line',
      'n_dupes.other': '{n} duplicate lines',
      'n_sorted.one': '{n} line sorted',
      'n_sorted.other': '{n} lines sorted',
    },
    de: {
      text: 'Text',
      quotesRow: 'Zeichen',
      quotes: 'Gerade Anführungszeichen und Striche',
      quotesHint: '“ ” ‘ ’ – — … werden zu " \' - -- ...',
      spacesRow: 'Abstände',
      trim: 'Zeilen trimmen',
      trimHint: 'Leerzeichen am Anfang und Ende jeder Zeile',
      spaces: 'Doppelte Leerzeichen zusammenfassen',
      spacesHint: 'Zwei oder mehr zwischen Wörtern werden eins',
      breaksRow: 'Umbrüche',
      join: 'Verirrte Umbrüche verbinden',
      joinHint: 'Umbrochene Zeilen werden Absätze; Leerzeilen und Listen bleiben',
      empty: 'Leere Zeilen entfernen',
      caseRow: 'Schreibung',
      keep: 'Wie es ist',
      upper: 'GROSS',
      lower: 'klein',
      title: 'Wörter Groß',
      sentence: 'Satzanfang groß',
      linesRow: 'Zeilen',
      dupes: 'Doppelte Zeilen entfernen',
      dupesHint: 'Die erste bleibt',
      sort: 'Sortieren',
      off: 'Aus',
      az: 'A–Z',
      za: 'Z–A',
      num: 'Nach Zahl',
      order: 'Die Schritte laufen von oben nach unten, welche auch an sind.',
      result: 'Ergebnis',
      emptyIn: 'Text tippen oder einfügen, oder eine .txt öffnen, und die nötigen Schritte einschalten.',
      noSteps: 'Schalte einen Schritt ein, um den Text aufzuräumen.',
      nothing: 'Für diese Schritte schon sauber: nichts geändert.',
      copy: 'Text kopieren',
      'n_quotes.one': '{n} Anführungszeichen oder Strich',
      'n_quotes.other': '{n} Anführungszeichen und Striche',
      'n_trimmed.one': '{n} Zeile getrimmt',
      'n_trimmed.other': '{n} Zeilen getrimmt',
      'n_spaces.one': '{n} doppeltes Leerzeichen',
      'n_spaces.other': '{n} doppelte Leerzeichen',
      'n_joined.one': '{n} Umbruch verbunden',
      'n_joined.other': '{n} Umbrüche verbunden',
      'n_empty.one': '{n} leere Zeile',
      'n_empty.other': '{n} leere Zeilen',
      'n_cased.one': '{n} Wort in neuer Schreibung',
      'n_cased.other': '{n} Wörter in neuer Schreibung',
      'n_dupes.one': '{n} doppelte Zeile',
      'n_dupes.other': '{n} doppelte Zeilen',
      'n_sorted.one': '{n} Zeile umsortiert',
      'n_sorted.other': '{n} Zeilen umsortiert',
    },
  });

  // The steps are kept between visits; the text never is.
  const o = remember('clean', {
    quotes: false,
    trim: true,
    spaces: true,
    join: false,
    empty: false,
    case: 'keep' as CaseMode,
    dupes: false,
    sort: 'off' as SortMode,
  });

  let text = $state('');
  let from = $state<string | null>(null);

  const given = untrack(() => texts(items));
  if (given.length) text = given.join('\n\n');
  else {
    const file = untrack(() => files(items))[0];
    if (file)
      void readText(file).then((r) => {
        if ('text' in r) {
          text = r.text;
          from = file.name;
        }
      });
  }

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

  const result = $derived(clean(settled, { ...o }, locale()));
  const output = $derived(result.text);

  const ORDER: (keyof Changes)[] = ['quotes', 'trimmed', 'spaces', 'joined', 'empty', 'cased', 'dupes', 'sorted'];
  const said = $derived.by(() => {
    if (!settled.trim()) return { line: w('emptyIn'), done: false };
    if (!anyStep(o)) return { line: w('noSteps'), done: false };
    const parts = ORDER.filter((k) => result.changes[k] > 0).map((k) => w(`n_${k}`, { n: result.changes[k] }));
    return parts.length ? { line: parts.join(', '), done: true } : { line: w('nothing'), done: false };
  });

  const outputs = $derived(
    output && settled === text ? [{ blob: new Blob([output], { type: 'text/plain;charset=utf-8' }), name: outName(from ?? 'text.txt', 'clean', 'txt', shared.names) }] : null,
  );
  const nextItems = $derived(output.trim() ? [{ text: output }] : null);
</script>

<div class="cols">
  <div class="stack">
    <TextIn
      id="clean-text"
      label={w('text')}
      value={text}
      rows={12}
      oninput={(v, name) => {
        text = v;
        if (name !== undefined || !v) from = name ?? null;
      }}
    />
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('quotesRow')}</dt>
        <dd><Check checked={o.quotes} label={w('quotes')} hint={w('quotesHint')} onchange={(v) => (o.quotes = v)} /></dd>
      </div>
      <div>
        <dt>{w('spacesRow')}</dt>
        <dd>
          <Check checked={o.trim} label={w('trim')} hint={w('trimHint')} onchange={(v) => (o.trim = v)} />
          <Check checked={o.spaces} label={w('spaces')} hint={w('spacesHint')} onchange={(v) => (o.spaces = v)} />
        </dd>
      </div>
      <div>
        <dt>{w('breaksRow')}</dt>
        <dd>
          <Check checked={o.join} label={w('join')} hint={w('joinHint')} onchange={(v) => (o.join = v)} />
          <Check checked={o.empty} label={w('empty')} onchange={(v) => (o.empty = v)} />
        </dd>
      </div>
      <div>
        <dt>{w('caseRow')}</dt>
        <dd>
          <Seg
            label={w('caseRow')}
            value={o.case}
            options={[
              { value: 'keep', label: w('keep') },
              { value: 'upper', label: w('upper') },
              { value: 'lower', label: w('lower') },
              { value: 'title', label: w('title') },
              { value: 'sentence', label: w('sentence') },
            ]}
            onchange={(v) => (o.case = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('linesRow')}</dt>
        <dd>
          <Check checked={o.dupes} label={w('dupes')} hint={w('dupesHint')} onchange={(v) => (o.dupes = v)} />
          <Seg
            label={w('sort')}
            value={o.sort}
            options={[
              { value: 'off', label: `${w('sort')}: ${w('off')}` },
              { value: 'az', label: w('az') },
              { value: 'za', label: w('za') },
              { value: 'num', label: w('num') },
            ]}
            onchange={(v) => (o.sort = v)}
          />
        </dd>
      </div>
    </dl>
    <p class="note">{w('order')}</p>
  </div>

  <section class="wide stack" aria-label={w('result')}>
    <h2 class="h">{w('result')}</h2>
    <p class="changed" class:done={said.done} aria-live="polite">{said.line}</p>
    {#if output}
      <pre class="work mono-out out">{output}</pre>
      <div class="acts">
        <CopyButton text={output} variant="button" label={w('copy')} />
      </div>
      <SaveButton {outputs} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['count', 'compare']} />
    {/if}
  </section>
</div>

<style>
  .changed {
    font-size: 15px;
    font-weight: 600;
    justify-self: start;
  }

  .changed:not(.done) {
    font-weight: 400;
    font-size: 14px;
    color: var(--ink-2);
  }

  .changed.done {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 1px 6px;
  }

  .out {
    margin: 0;
    padding: 12px 14px;
    max-height: min(60dvh, 520px);
    overflow: auto;
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
