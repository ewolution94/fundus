<!--
  F-908 Regex: a pattern (a pasted /abc/gi splits into pattern and flags), the eight flags with a
  word on each, a text, and the matches marked in it; each match listed with its place and groups
  (named ones by name); a replace with its preview. The matching runs in a worker that's stopped
  after a second, so a runaway pattern can't freeze the page. Nothing typed is kept; the flags are.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { CircleCheck, ChevronDown } from '@lucide/svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import type { Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { FLAGS, tidyFlags, splitLiteral, stretches, hasSets, LIMIT, type Flag, type Run } from './regex.ts';
  import type { Job } from './regex.worker.ts';

  let {}: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      pattern: 'Pattern',
      patternPh: 'Type a pattern, or paste /abc/gi',
      flags: 'Flags',
      'flag.g': 'All matches, not just the first',
      'flag.i': 'Upper and lower case alike',
      'flag.m': '^ and $ at every line',
      'flag.s': '. takes line breaks too',
      'flag.u': 'Unicode: whole characters, \\p{…}',
      'flag.v': 'Unicode with sets: [\\p{L}--[a-z]]',
      'flag.y': 'Sticky: only right where the last one ended',
      'flag.d': 'The place of every group',
      noSets: 'Not in this browser',
      sheet: 'Cheat sheet',
      sheetNote: 'Tap one to put it in at the cursor.',
      insert: 'Insert {token}',
      'tok.digit': 'a digit',
      'tok.word': 'letter, digit or _',
      'tok.space': 'a space, tab or line break',
      'tok.any': 'any character',
      'tok.start': 'start',
      'tok.end': 'end',
      'tok.none': 'none or more',
      'tok.more': 'one or more',
      'tok.maybe': 'maybe; after * or +: as few as possible',
      'tok.class': 'one of these',
      'tok.group': 'a group',
      'tok.named': 'a named group',
      text: 'Text',
      textPh: 'Type or paste the text to test',
      replace: 'Replace',
      replaceHint: '$1, $<name>, $& for what was matched',
      with: 'Replace with',
      withPh: 'Empty deletes each match',
      marked: 'Matches marked',
      list: 'Matches',
      replaced: 'Replaced',
      empty: 'Type a pattern and a text: the matches are marked as you type.',
      noText: 'Type or paste a text to test the pattern on.',
      broken: 'The pattern doesn’t work: {message}',
      slow: 'It took longer than a second, so it’s stopped: the pattern backtracks too much on this text. Nested repeats like (a+)+ are the usual cause.',
      gaveUp: 'This browser stopped early: the pattern backtracks too much on this text, so there may be matches it didn’t find. Nested repeats like (a+)+ are the usual cause.',
      working: 'Working …',
      none: 'No match',
      'count.one': '1 match',
      'count.other': '{n} matches',
      firstOnly: 'Only the first: switch on g for all of them.',
      markedFirst: 'Marked and listed: the first {n}.',
      listedFirst: 'Listed: the first {n}.',
      emptyMatch: 'empty',
      unset: 'not taking part',
      at: 'at {from}–{to}',
      matchNo: 'Match {n}',
    },
    de: {
      pattern: 'Muster',
      patternPh: 'Muster tippen oder /abc/gi einfügen',
      flags: 'Flags',
      'flag.g': 'Alle Treffer, nicht nur den ersten',
      'flag.i': 'Groß und klein gleich',
      'flag.m': '^ und $ an jeder Zeile',
      'flag.s': '. nimmt auch Zeilenumbrüche',
      'flag.u': 'Unicode: ganze Zeichen, \\p{…}',
      'flag.v': 'Unicode mit Mengen: [\\p{L}--[a-z]]',
      'flag.y': 'Klebend: nur genau dort, wo der letzte endete',
      'flag.d': 'Die Stelle jeder Gruppe',
      noSets: 'Nicht in diesem Browser',
      sheet: 'Spickzettel',
      sheetNote: 'Tipp eins an, es kommt an die Stelle des Cursors.',
      insert: '{token} einfügen',
      'tok.digit': 'eine Ziffer',
      'tok.word': 'Buchstabe, Ziffer oder _',
      'tok.space': 'Leerzeichen, Tab oder Zeilenumbruch',
      'tok.any': 'ein beliebiges Zeichen',
      'tok.start': 'Anfang',
      'tok.end': 'Ende',
      'tok.none': 'keins oder mehr',
      'tok.more': 'eins oder mehr',
      'tok.maybe': 'vielleicht; nach * oder +: so wenig wie möglich',
      'tok.class': 'eins davon',
      'tok.group': 'eine Gruppe',
      'tok.named': 'eine benannte Gruppe',
      text: 'Text',
      textPh: 'Den Text zum Testen tippen oder einfügen',
      replace: 'Ersetzen',
      replaceHint: '$1, $<name>, $& für den Treffer',
      with: 'Ersetzen durch',
      withPh: 'Leer löscht jeden Treffer',
      marked: 'Treffer markiert',
      list: 'Treffer',
      replaced: 'Ersetzt',
      empty: 'Tipp ein Muster und einen Text: die Treffer werden beim Tippen markiert.',
      noText: 'Tipp oder füg einen Text ein, um das Muster daran zu testen.',
      broken: 'Das Muster geht nicht: {message}',
      slow: 'Es hat länger als eine Sekunde gedauert, deshalb ist Schluss: das Muster probiert an diesem Text zu viel durch. Verschachtelte Wiederholungen wie (a+)+ sind meist der Grund.',
      gaveUp: 'Dieser Browser hat früh aufgegeben: das Muster probiert an diesem Text zu viel durch, es kann also Treffer geben, die er nicht gefunden hat. Verschachtelte Wiederholungen wie (a+)+ sind meist der Grund.',
      working: 'Läuft …',
      none: 'Kein Treffer',
      'count.one': '1 Treffer',
      'count.other': '{n} Treffer',
      firstOnly: 'Nur der erste: schalt g ein für alle.',
      markedFirst: 'Markiert und aufgelistet: die ersten {n}.',
      listedFirst: 'Aufgelistet: die ersten {n}.',
      emptyMatch: 'leer',
      unset: 'nicht beteiligt',
      at: 'bei {from}–{to}',
      matchNo: 'Treffer {n}',
    },
  });

  const NAMES: Record<Flag, string> = { g: 'global', i: 'ignoreCase', m: 'multiline', s: 'dotAll', u: 'unicode', v: 'unicodeSets', y: 'sticky', d: 'hasIndices' };

  /** The tokens of the cheat sheet: what's inserted, or what wraps the selection. */
  const TOKENS = [
    { token: '\\d', word: 'tok.digit' },
    { token: '\\w', word: 'tok.word' },
    { token: '\\s', word: 'tok.space' },
    { token: '.', word: 'tok.any' },
    { token: '^', word: 'tok.start' },
    { token: '$', word: 'tok.end' },
    { token: '*', word: 'tok.none' },
    { token: '+', word: 'tok.more' },
    { token: '?', word: 'tok.maybe' },
    { token: '[…]', word: 'tok.class', wrap: ['[', ']'] },
    { token: '(…)', word: 'tok.group', wrap: ['(', ')'] },
    { token: '(?<name>…)', word: 'tok.named', wrap: ['(?<name>', ')'], select: [3, 7] },
  ] as const;

  // The flags, whether to replace and the cheat sheet's state are kept; pattern and text are not.
  const o = remember('regex', { flags: 'g', replace: false, sheet: matchMedia('(min-width: 760px)').matches });

  const sets = hasSets();
  let pattern = $state('');
  let text = $state('');
  let replacement = $state('');
  let patternEl: HTMLInputElement;

  const flags = $derived(tidyFlags(o.flags));
  const on = (f: Flag) => flags.includes(f);

  function setFlag(f: Flag, value: boolean) {
    let next = flags.replace(f, '');
    if (value) {
      next += f;
      // u and v exclude each other: v is u with sets.
      if (f === 'u') next = next.replace('v', '');
      if (f === 'v') next = next.replace('u', '');
    }
    o.flags = tidyFlags(next);
  }

  /** A pasted /abc/gi, into an empty field or over all of it, splits into pattern and flags. */
  function paste(e: ClipboardEvent) {
    const lit = splitLiteral(e.clipboardData?.getData('text/plain') ?? '');
    const el = e.currentTarget as HTMLInputElement;
    const all = el.selectionStart === 0 && el.selectionEnd === el.value.length;
    if (!lit || !(all || !pattern)) return;
    e.preventDefault();
    pattern = lit.pattern;
    o.flags = tidyFlags(lit.flags);
  }

  async function insert(t: (typeof TOKENS)[number]) {
    const s = patternEl.selectionStart ?? pattern.length;
    const e = patternEl.selectionEnd ?? s;
    const chosen = pattern.slice(s, e);
    let piece: string = t.token;
    let from = s + piece.length;
    let to = from;
    if ('wrap' in t) {
      piece = t.wrap[0] + chosen + t.wrap[1];
      if ('select' in t) [from, to] = [s + t.select[0], s + t.select[1]];
      else from = to = chosen ? s + piece.length : s + t.wrap[0].length;
    }
    pattern = pattern.slice(0, s) + piece + pattern.slice(e);
    await tick();
    patternEl.focus();
    patternEl.setSelectionRange(from, to);
  }

  // The worker: one at a time; a new job stops the one still running. The second starts when the
  // worker says it started (loading it doesn't count).
  type Outcome = { kind: 'done'; run: Run; text: string } | { kind: 'slow' } | null;
  let outcome = $state<Outcome>(null);
  let working = $state(false);
  let worker: Worker | null = null;
  let busy = false;
  let seq = 0;
  let clock: ReturnType<typeof setTimeout> | undefined;
  let shown: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    worker?.terminate();
    worker = null;
    busy = false;
  }

  function send(job: Omit<Job, 'id'>) {
    if (busy) stop();
    clearTimeout(clock);
    clearTimeout(shown);
    const id = ++seq;
    worker ??= new Worker(new URL('./regex.worker.ts', import.meta.url), { type: 'module' });
    busy = true;
    shown = setTimeout(() => (working = true), 200);
    // Loading the worker gets its own, longer limit.
    clock = setTimeout(stop, 10_000);
    worker.onmessage = (e: MessageEvent<{ id: number; started?: boolean; result?: Run }>) => {
      if (e.data.id !== id) return;
      if (e.data.started) {
        clearTimeout(clock);
        clock = setTimeout(() => {
          if (id !== seq) return;
          stop();
          clearTimeout(shown);
          working = false;
          outcome = { kind: 'slow' };
        }, 1000);
        return;
      }
      busy = false;
      clearTimeout(clock);
      clearTimeout(shown);
      working = false;
      if (e.data.result) outcome = { kind: 'done', run: e.data.result, text: job.text };
    };
    worker.postMessage({ id, ...job } satisfies Job);
  }

  $effect(() => {
    const job = { pattern, flags, text, replacement: o.replace ? replacement : null };
    if (!pattern || !text) {
      seq++;
      if (busy) stop();
      clearTimeout(clock);
      clearTimeout(shown);
      working = false;
      outcome = null;
      return;
    }
    const wait = setTimeout(() => send(job), 120);
    return () => clearTimeout(wait);
  });

  $effect(() => () => {
    clearTimeout(clock);
    clearTimeout(shown);
    worker?.terminate();
  });

  const num = (n: number) => formatNumber(n, shared.decimal);
  const done = $derived(outcome?.kind === 'done' && outcome.run.ok ? outcome.run : null);
  const parts = $derived(done && outcome?.kind === 'done' ? stretches(outcome.text, done.matches) : []);
  const LIST = 100;
</script>

<div class="regex">
  <div class="cols">
    <div class="stack">
      <div class="h"><label for="regex-pattern">{w('pattern')}</label></div>
      <div class="pat">
        <span class="slash" aria-hidden="true">/</span>
        <input
          id="regex-pattern"
          bind:this={patternEl}
          class="field"
          type="text"
          placeholder={w('patternPh')}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          bind:value={pattern}
          onpaste={paste}
        />
        <span class="slash" aria-hidden="true">/{flags}</span>
      </div>

      <fieldset class="flags">
        <legend class="label">{w('flags')}</legend>
        {#each FLAGS as f (f)}
          <Check
            checked={on(f)}
            label={`${f} · ${NAMES[f]}`}
            hint={f === 'v' && !sets ? w('noSets') : w(`flag.${f}`)}
            disabled={f === 'v' && !sets}
            onchange={(value) => setFlag(f, value)}
          />
        {/each}
      </fieldset>

      <div class="h"><label for="regex-text">{w('text')}</label></div>
      <textarea id="regex-text" class="field code" placeholder={w('textPh')} spellcheck="false" autocapitalize="off" autocomplete="off" bind:value={text}></textarea>

      <Check checked={o.replace} label={w('replace')} hint={w('replaceHint')} onchange={(v) => (o.replace = v)} />
      {#if o.replace}
        <input class="field mono" type="text" aria-label={w('with')} placeholder={w('withPh')} spellcheck="false" autocapitalize="off" autocomplete="off" bind:value={replacement} />
      {/if}

      <div class="cheats">
        <button type="button" class="opener" aria-expanded={o.sheet} aria-controls="regex-sheet" onclick={() => (o.sheet = !o.sheet)}>
          <span class="label">{w('sheet')}</span>
          <ChevronDown aria-hidden="true" />
        </button>
        {#if o.sheet}
          <div id="regex-sheet" class="stack">
            <p class="note">{w('sheetNote')}</p>
            <div class="tokens">
              {#each TOKENS as t (t.token)}
                <button type="button" class="tok" aria-label={`${w('insert', { token: t.token })}: ${w(t.word)}`} onclick={() => insert(t)}>
                  <code>{t.token}</code>
                  <small>{w(t.word)}</small>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="stack">
      <div class="status" aria-live="polite">
        {#if !pattern}
          <p class="note">{w('empty')}</p>
        {:else if !text}
          <p class="note">{w('noText')}</p>
        {:else if outcome?.kind === 'slow'}
          <p class="error" role="alert">{w('slow')}</p>
        {:else if outcome?.kind === 'done' && !outcome.run.ok}
          <p class="error" role="alert">{w('broken', { message: outcome.run.error })}</p>
        {:else if done?.gaveUp && !done.count}
          <p class="error" role="alert">{w('gaveUp')}</p>
        {:else if done}
          <p class="ok" class:zero={!done.count}>
            {#if done.count}<CircleCheck aria-hidden="true" />{/if}
            <span>{done.count ? w('count', { n: num(done.count) }) : w('none')}</span>
          </p>
          {#if done.gaveUp}<p class="note bad" role="alert">{w('gaveUp')}</p>{/if}
          {#if done.count === 1 && !on('g')}<p class="note">{w('firstOnly')}</p>{/if}
          {#if done.count > LIMIT}<p class="note">{w('markedFirst', { n: num(LIMIT) })}</p>{:else if done.count > LIST}<p class="note">{w('listedFirst', { n: num(LIST) })}</p>{/if}
        {/if}
        {#if working}<p class="note">{w('working')}</p>{/if}
      </div>

      {#if done && outcome?.kind === 'done' && !(done.gaveUp && !done.count)}
        <h2 class="h">{w('marked')}</h2>
        <div class="work out" role="region" aria-label={w('marked')}>
          <pre class="mono-out">{#each parts as p, k (k)}{#if p.n < 0}{p.text}{:else}<mark class:gap={!p.text} class:touch={k > 0 && parts[k - 1].n >= 0} title={w('matchNo', { n: p.n + 1 })}>{p.text}</mark>{/if}{/each}</pre>
        </div>

        {#if done.matches.length}
          <h2 class="h">{w('list')}</h2>
          <ol class="found">
            {#each done.matches.slice(0, LIST) as m, k (k)}
              <li>
                <div class="top">
                  <span class="no">{k + 1}</span>
                  <span class="m at">{w('at', { from: m.index, to: m.end })}</span>
                  {#if m.end > m.index}<code class="what">{outcome.text.slice(m.index, m.end)}</code>{:else}<span class="note">{w('emptyMatch')}</span>{/if}
                </div>
                {#if m.groups.length}
                  <dl class="grp">
                    {#each m.groups as g, n (n)}
                      <div>
                        <dt>{done.names[n] ?? n + 1}</dt>
                        <dd>
                          {#if g.value === null}<span class="note">{w('unset')}</span>{:else}<code>{g.value}</code>{/if}
                          {#if g.start !== undefined}<span class="m">{g.start}–{g.end}</span>{/if}
                        </dd>
                      </div>
                    {/each}
                  </dl>
                {/if}
              </li>
            {/each}
          </ol>
        {/if}

        {#if done.replaced}
          {@const r = done.replaced}
          {@const replacedParts = stretches(r.text, r.marks.map(([index, end]) => ({ index, end })))}
          <div class="bar">
            <h2 class="h grow">{w('replaced')}</h2>
            <CopyButton variant="button" text={r.text} />
          </div>
          <div class="work out" role="region" aria-label={w('replaced')}>
            <pre class="mono-out">{#each replacedParts as p, k (k)}{#if p.n < 0}{p.text}{:else}<mark class:gap={!p.text} class:touch={k > 0 && replacedParts[k - 1].n >= 0}>{p.text}</mark>{/if}{/each}</pre>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .regex {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .h label {
    min-width: 0;
  }

  .pat {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .slash {
    font-family: var(--mono);
    font-size: 18px;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .pat .field,
  .mono {
    font-family: var(--mono);
    font-size: 16px;
  }

  .pat .field {
    flex: 1;
  }

  .flags {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: 10px 16px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .flags legend {
    padding: 0 0 8px;
  }

  .flags :global(.check b) {
    font-family: var(--mono);
    font-size: 14px;
  }

  .cheats {
    display: grid;
    gap: 4px;
    border-top: 1px solid var(--rule);
  }

  .opener {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    color: var(--ink-2);
  }

  .opener :global(svg) {
    width: 16px;
    height: 16px;
    transition: transform 0.15s;
  }

  .opener[aria-expanded='true'] :global(svg) {
    transform: rotate(180deg);
  }

  .tokens {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  @media (min-width: 1000px) {
    .tokens {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .tok {
    display: grid;
    align-content: start;
    gap: 2px;
    min-height: 52px;
    padding: 6px 8px;
    border: 1px solid var(--rule);
    border-radius: 2px;
    background: var(--card);
    text-align: left;
    min-width: 0;
  }

  .tok code {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .tok small {
    font-size: 11px;
    line-height: 1.3;
    color: var(--ink-2);
  }

  @media (hover: hover) and (pointer: fine) {
    .tok:hover {
      border-color: var(--ink);
    }
  }

  .code {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.55;
    min-height: 180px;
  }

  @media (hover: none) {
    .code {
      font-size: 16px;
    }
  }

  .status {
    display: grid;
    gap: 4px;
    min-height: 24px;
  }

  .ok {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 700;
    color: var(--ok);
  }

  .ok.zero {
    color: var(--ink-2);
  }

  .ok :global(svg) {
    width: 18px;
    height: 18px;
    flex: none;
  }

  .error {
    overflow-wrap: anywhere;
  }

  .out {
    max-height: 360px;
    overflow: auto;
    padding: 10px 12px;
  }

  .out pre {
    margin: 0;
  }

  mark {
    background: var(--mark);
    color: var(--mark-ink);
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  /* Two matches side by side: a hairline between them. */
  mark.touch {
    border-left: 1.5px solid var(--mark-ink);
  }

  mark.gap {
    display: inline-block;
    width: 2px;
    height: 1.2em;
    vertical-align: text-bottom;
    background: var(--mark-ink);
  }

  .found {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 480px;
    overflow: auto;
  }

  .found li {
    display: grid;
    gap: 4px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--rule);
    min-width: 0;
  }

  .top {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .no {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
    min-width: 2ch;
  }

  .at {
    color: var(--ink-2);
  }

  .what,
  .grp code {
    font-family: var(--mono);
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .what {
    font-weight: 600;
  }

  .grp {
    display: grid;
    gap: 2px;
    margin: 0 0 0 calc(2ch + 10px);
  }

  .grp > div {
    display: grid;
    grid-template-columns: minmax(3ch, max-content) minmax(0, 1fr);
    gap: 10px;
    align-items: baseline;
  }

  .grp dt {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  .grp dd {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
    margin: 0;
    min-width: 0;
  }

  .bar {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }
</style>
