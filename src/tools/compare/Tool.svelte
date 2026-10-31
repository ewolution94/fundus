<!--
  F-303 Compare texts: two texts (typed, pasted, or a .txt dropped into each), compared by words or
  by lines (compare.ts, jsdiff). Insertions under the highlighter, deletions struck through; the two
  side by side on a computer, one above the other on a phone. Copy gives a plain unified diff.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import TextIn from '../../components/kit/TextIn.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { compare, unified, type Mode, type Part } from './compare.ts';
  import { readText } from '../../lib/textfile.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      before: 'Before',
      after: 'After',
      firstHolder: 'The first version: type, paste, or drop a .txt',
      secondHolder: 'The second version',
      compare: 'Compare',
      byWords: 'By words',
      byLines: 'By lines',
      ignore: 'Ignore',
      case: 'Case',
      caseHint: 'Hello and hello are the same',
      space: 'Whitespace',
      spaceHint: 'Extra spaces, tabs and blank lines',
      changes: 'Changes',
      'words.one': '{n} word',
      'words.other': '{n} words',
      'lines.one': '{n} line',
      'lines.other': '{n} lines',
      'places.one': 'in {n} place',
      'places.other': 'in {n} places',
      added: '{what} added',
      removed: '{what} removed',
      same: 'No differences.',
      sameIgnoring: 'No differences, with {what} ignored.',
      caseWord: 'case',
      spaceWord: 'whitespace',
      both: 'case and whitespace',
      empty: 'Put a text on each side: what changed shows here as you type.',
      oneEmpty: 'Now the other side.',
      tooFar: 'These two are too far apart to compare word by word in time. Try by lines.',
      copy: 'Copy as a unified diff',
      working: 'Comparing…',
      legendAdded: 'added',
      legendRemoved: 'removed',
    },
    de: {
      before: 'Vorher',
      after: 'Nachher',
      firstHolder: 'Die erste Fassung: tippen, einfügen oder eine .txt ablegen',
      secondHolder: 'Die zweite Fassung',
      compare: 'Vergleich',
      byWords: 'Nach Wörtern',
      byLines: 'Nach Zeilen',
      ignore: 'Ignorieren',
      case: 'Groß/klein',
      caseHint: 'Hallo und hallo sind gleich',
      space: 'Leerraum',
      spaceHint: 'Zusätzliche Leerzeichen, Tabs und Leerzeilen',
      changes: 'Änderungen',
      'words.one': '{n} Wort',
      'words.other': '{n} Wörter',
      'lines.one': '{n} Zeile',
      'lines.other': '{n} Zeilen',
      'places.one': 'an {n} Stelle',
      'places.other': 'an {n} Stellen',
      added: '{what} dazu',
      removed: '{what} weg',
      same: 'Keine Unterschiede.',
      sameIgnoring: 'Keine Unterschiede, ohne {what}.',
      caseWord: 'Groß/klein',
      spaceWord: 'Leerraum',
      both: 'Groß/klein und Leerraum',
      empty: 'Auf jede Seite einen Text: was sich geändert hat, steht beim Tippen hier.',
      oneEmpty: 'Jetzt die andere Seite.',
      tooFar: 'Die beiden sind zu verschieden, um sie rechtzeitig Wort für Wort zu vergleichen. Versuch es nach Zeilen.',
      copy: 'Als Unified Diff kopieren',
      working: 'Wird verglichen…',
      legendAdded: 'dazu',
      legendRemoved: 'weg',
    },
  });

  // How it compares is kept; the texts never are.
  const o = remember('compare', { mode: 'words' as Mode, ignoreCase: false, ignoreSpace: false });

  let first = $state('');
  let second = $state('');
  let names = $state<[string | null, string | null]>([null, null]);

  // Texts from the home: the first one goes left, a second one right. A .txt goes the same way.
  const given = untrack(() => texts(items));
  if (given[0] !== undefined) first = given[0];
  if (given[1] !== undefined) second = given[1];
  const givenFiles = untrack(() => files(items));
  givenFiles.slice(0, 2).forEach((file, i) => {
    void readText(file).then((r) => {
      if (!('text' in r)) return;
      if (i === 0 && !first) {
        first = r.text;
        names[0] = file.name;
      } else if (!second) {
        second = r.text;
        names[1] = file.name;
      }
    });
  });

  // Long texts wait for a pause in typing; short ones are compared straight away (no effect in
  // between, so the first paint has them).
  const LONG = 40_000;
  const short = $derived(first.length + second.length < LONG);
  let late = $state.raw<[string, string]>(['', '']);
  $effect(() => {
    const pair: [string, string] = [first, second];
    if (short) return;
    const timer = setTimeout(() => (late = pair), 300);
    return () => clearTimeout(timer);
  });
  const settled = $derived<[string, string]>(short ? [first, second] : late);
  const pending = $derived(settled[0] !== first || settled[1] !== second);

  const result = $derived(settled[0] || settled[1] ? compare(settled[0], settled[1], { mode: o.mode, ignoreCase: o.ignoreCase, ignoreSpace: o.ignoreSpace, locale: locale() }) : null);
  const patch = $derived(
    result && !result.same
      ? unified(settled[0], settled[1], { ignoreCase: o.ignoreCase, ignoreSpace: o.ignoreSpace, locale: locale(), names: [names[0] ?? w('before'), names[1] ?? w('after')] })
      : '',
  );

  const unit = (n: number) => w(o.mode === 'words' ? 'words' : 'lines', { n });
  const ignored = $derived(o.ignoreCase && o.ignoreSpace ? w('both') : o.ignoreCase ? w('caseWord') : o.ignoreSpace ? w('spaceWord') : '');

  const setName = (i: 0 | 1, name: string | undefined, value: string) => {
    if (name !== undefined || !value) names[i] = name ?? null;
  };
</script>

{#snippet pane(parts: Part[], side: 'before' | 'after', title: string, note: string)}
  <section class="pane" data-side={side}>
    <h3 class="h">{title}<em>{note}</em></h3>
    <div class="work mono-out diff">{#each parts as p, i (i)}{#if p.kind === 'added'}<ins>{p.text}</ins>{:else if p.kind === 'removed'}<del>{p.text}</del>{:else}<span>{p.text}</span>{/if}{/each}</div>
  </section>
{/snippet}

<div class="cols even">
  <div class="stack">
    <TextIn id="compare-first" label={w('before')} value={first} rows={9} placeholder={w('firstHolder')} oninput={(v, name) => ((first = v), setName(0, name, v))} />
  </div>
  <div class="stack">
    <TextIn id="compare-second" label={w('after')} value={second} rows={9} placeholder={w('secondHolder')} oninput={(v, name) => ((second = v), setName(1, name, v))} />
  </div>

  <div class="wide stack">
    <dl class="spec">
      <div>
        <dt>{w('compare')}</dt>
        <dd>
          <Seg
            label={w('compare')}
            value={o.mode}
            options={[
              { value: 'words', label: w('byWords') },
              { value: 'lines', label: w('byLines') },
            ]}
            onchange={(m) => (o.mode = m)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('ignore')}</dt>
        <dd class="checks">
          <Check checked={o.ignoreCase} label={w('case')} hint={w('caseHint')} onchange={(v) => (o.ignoreCase = v)} />
          <Check checked={o.ignoreSpace} label={w('space')} hint={w('spaceHint')} onchange={(v) => (o.ignoreSpace = v)} />
        </dd>
      </div>
      <div>
        <dt>{w('changes')}</dt>
        <dd aria-live="polite">
          {#if pending}
            <span class="note">{w('working')}</span>
          {:else if !settled[0].trim() && !settled[1].trim()}
            <span class="note">{w('empty')}</span>
          {:else if !result}
            <span class="note bad" role="alert">{w('tooFar')}</span>
          {:else if result.same}
            <b class="verdict">{ignored ? w('sameIgnoring', { what: ignored }) : w('same')}</b>
          {:else}
            <p class="tally">
              <ins>+{w('added', { what: unit(result.added) })}</ins>
              <b>−{w('removed', { what: unit(result.removed) })}</b>
              <span>{w('places', { n: result.changes })}</span>
            </p>
            {#if !settled[0].trim() || !settled[1].trim()}<span class="note">{w('oneEmpty')}</span>{/if}
          {/if}
        </dd>
      </div>
    </dl>
    {#if patch}
      <div class="acts"><CopyButton text={patch} variant="button" label={w('copy')} /></div>
    {/if}
  </div>

  {#if result && !result.same}
    {@render pane(result.before, 'before', w('before'), `− ${w('legendRemoved')}`)}
    {@render pane(result.after, 'after', w('after'), `+ ${w('legendAdded')}`)}
  {/if}
</div>

<style>
  .checks {
    gap: 8px;
  }

  .tally {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: baseline;
    font-size: 16px;
    font-weight: 700;
  }

  .tally span {
    font-weight: 400;
    color: var(--ink-2);
  }

  .verdict {
    font-size: 16px;
  }

  ins {
    text-decoration: none;
    background: var(--mark);
    color: var(--mark-ink);
  }

  del {
    text-decoration: line-through;
    text-decoration-thickness: 1.5px;
    color: var(--ink-2);
  }

  .tally ins {
    padding: 0 5px;
  }

  .pane {
    display: grid;
    gap: 8px;
    min-width: 0;
    align-content: start;
  }

  .diff {
    padding: 12px 14px;
    max-height: min(70dvh, 640px);
    overflow: auto;
  }

  .acts {
    display: flex;
    gap: 8px;
  }
</style>
