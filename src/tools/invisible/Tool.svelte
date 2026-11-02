<!--
  F-307 Invisible characters: what hides in a text, shown and cleaned (invisible.ts). A one-line
  summary, the kinds with their count, name and code point and what Clean does with them, the text
  with every finding marked in place, and the clean text with Copy. The no-break switch is kept; the
  text never is.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import TextIn from '../../components/kit/TextIn.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { readText } from '../../lib/textfile.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { scan, MAX_MARKED, type Kind, type Script } from './invisible.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      text: 'Text',
      placeholder: 'Paste the text that won’t match or won’t go through, or drop a .txt here',
      found: 'Found',
      'hidden.one': '{n} hidden character',
      'hidden.other': '{n} hidden characters',
      'looks.one': '{n} look-alike letter',
      'looks.other': '{n} look-alike letters',
      nothing: 'Nothing hidden',
      empty: 'Paste or type a text, or open a .txt: what hides in it shows here.',
      'fine.one': '{n} more is fine where it is.',
      'fine.other': '{n} more are fine where they are.',
      clean: 'Clean',
      nbsp: 'No-break spaces too',
      nbspHint: 'Off, they stay: German uses them on purpose (5 €)',
      kinds: 'What hides',
      does: 'In the clean text',
      remove: 'Removed',
      space: '→ space',
      break: '→ line break',
      twin: '→ {to}',
      keep: 'Kept',
      noTwin: 'Kept: no twin',
      nbspFine: 'Fine: on purpose',
      emojiFine: 'Fine: in an emoji',
      flagFine: 'Fine: in a flag',
      scriptFine: 'Fine: in the word',
      hanFine: 'Fine: a variant',
      spells: 'They spell “{text}”',
      marked: 'Marked in the text',
      cut: 'The first {n} places are marked; the clean text has them all.',
      result: 'Clean text',
      same: 'Nothing to clean: the text is what it looks like.',
      copy: 'Copy the text',
      Latin: 'Latin',
      Cyrillic: 'Cyrillic',
      Greek: 'Greek',
    },
    de: {
      text: 'Text',
      placeholder: 'Den Text einfügen, der nicht passt oder nicht durchgeht, oder eine .txt hier ablegen',
      found: 'Gefunden',
      'hidden.one': '{n} verstecktes Zeichen',
      'hidden.other': '{n} versteckte Zeichen',
      'looks.one': '{n} Doppelgänger-Buchstabe',
      'looks.other': '{n} Doppelgänger-Buchstaben',
      nothing: 'Nichts versteckt',
      empty: 'Text einfügen oder tippen, oder eine .txt öffnen: was sich darin versteckt, steht hier.',
      'fine.one': '{n} weiteres steht richtig da.',
      'fine.other': '{n} weitere stehen richtig da.',
      clean: 'Aufräumen',
      nbsp: 'Geschützte Leerzeichen auch',
      nbspHint: 'Aus, dann bleiben sie: im Deutschen stehen sie mit Absicht (5 €)',
      kinds: 'Was sich versteckt',
      does: 'Im sauberen Text',
      remove: 'Entfernt',
      space: '→ Leerzeichen',
      break: '→ Zeilenumbruch',
      twin: '→ {to}',
      keep: 'Bleibt',
      noTwin: 'Bleibt: kein Zwilling',
      nbspFine: 'Richtig: mit Absicht',
      emojiFine: 'Richtig: im Emoji',
      flagFine: 'Richtig: in einer Flagge',
      scriptFine: 'Richtig: im Wort',
      hanFine: 'Richtig: eine Variante',
      spells: 'Sie ergeben „{text}“',
      marked: 'Im Text markiert',
      cut: 'Die ersten {n} Stellen sind markiert; der saubere Text hat alle.',
      result: 'Sauberer Text',
      same: 'Nichts aufzuräumen: der Text ist, wie er aussieht.',
      copy: 'Text kopieren',
      Latin: 'Lateinisch',
      Cyrillic: 'Kyrillisch',
      Greek: 'Griechisch',
    },
  });

  // The switch is kept between visits; the text never is.
  const o = remember('invisible', { nbsp: false });

  let text = $state('');

  const given = untrack(() => texts(items));
  if (given.length) text = given.join('\n\n');
  else {
    const file = untrack(() => files(items))[0];
    if (file) void readText(file).then((r) => 'text' in r && (text = r.text));
  }

  // A whole book waits for a pause in typing; everyday texts follow every key.
  let settled = $state(untrack(() => text));
  $effect(() => {
    const t = text;
    if (t.length < 100_000) {
      settled = t;
      return;
    }
    const timer = setTimeout(() => (settled = t), 250);
    return () => clearTimeout(timer);
  });

  const r = $derived(scan(settled, { nbsp: o.nbsp }));
  const byKey = $derived(new Map(r.kinds.map((k) => [k.key, k])));
  const found = $derived(r.hidden + r.looks > 0);
  const summary = $derived.by(() => {
    if (!found) return w('nothing');
    const parts: string[] = [];
    if (r.hidden) parts.push(w('hidden', { n: r.hidden }));
    if (r.looks) parts.push(w('looks', { n: r.looks }));
    return parts.join(', ');
  });
  const changed = $derived(r.clean !== settled);
  const nextItems = $derived(changed && r.clean.trim() ? [{ text: r.clean }] : null);

  const name = (k: Kind) => (locale() === 'de' ? k.de : k.en);
  const script = (s: Script) => w(s);

  function does(k: Kind): string {
    if (k.fine) return w(`${k.fine}Fine`);
    if (k.fix === 'twin') return w('twin', { to: k.to ?? '' });
    if (k.look) return w('noTwin');
    return w(k.fix);
  }

  /** The badge for a run of findings in the text. */
  function badge(k: Kind, n: number): string {
    if (k.key === 'piled') return `+${n}`;
    return n > 1 ? `${k.badge}×${n}` : k.badge;
  }
</script>

<div class="cols">
  <div class="stack">
    <TextIn id="invisible-text" label={w('text')} value={text} rows={8} placeholder={w('placeholder')} oninput={(v) => (text = v)} />
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('found')}</dt>
        <dd aria-live="polite">
          {#if !settled}
            <span class="note">{w('empty')}</span>
          {:else}
            <p class="sum" class:found>{summary}</p>
            {#if r.fine}<span class="note">{w('fine', { n: r.fine })}</span>{/if}
          {/if}
        </dd>
      </div>
      <div>
        <dt>{w('clean')}</dt>
        <dd><Check checked={o.nbsp} label={w('nbsp')} hint={w('nbspHint')} onchange={(v) => (o.nbsp = v)} /></dd>
      </div>
    </dl>

    {#if r.kinds.length}
      <section class="stack" aria-label={w('kinds')}>
        <h2 class="h">{w('kinds')} <em>{w('does')}</em></h2>
        <ul class="kinds">
          {#each r.kinds as k (k.key)}
            <li class:fine={k.fine}>
              <b class="n">{k.count}</b>
              <span class="what">
                <span class="name">
                  {#if !k.look}<span class="badge">{k.badge}</span>{/if}
                  {name(k)}
                </span>
                <code>{k.code}</code>
                {#if k.spells}<span class="spells">{w('spells', { text: k.spells })}</span>{/if}
              </span>
              <span class="does">{does(k)}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>

  {#if settled}
    {#if r.kinds.length}
      <section class="wide stack" aria-label={w('marked')}>
        <h2 class="h">{w('marked')}</h2>
        <pre class="work mono-out shown">{#each r.pieces as p, i (i)}{#if !p.key}{p.text}{:else}{@const k = byKey.get(p.key)!}{#if k.look}<span class="look"><span class="letter">{p.text}</span><span class="badge">{script(k.look)}</span></span>{:else}<span class="badge" class:quiet={k.fine} title={`${name(k)} ${k.code}`}>{badge(k, p.n ?? 1)}</span>{#if k.fix === 'break' && !k.fine}{'\n'}{/if}{/if}{/if}{/each}</pre>
        {#if r.cut}<p class="note">{w('cut', { n: MAX_MARKED })}</p>{/if}
      </section>
    {/if}

    <section class="wide stack" aria-label={w('result')}>
      <h2 class="h">{w('result')}</h2>
      {#if changed}
        <pre class="work mono-out out">{r.clean}</pre>
        <div class="acts">
          <CopyButton text={r.clean} variant="button" label={w('copy')} />
        </div>
        <NextTools items={nextItems} from={tool.id} prefer={['clean', 'count', 'compare']} />
      {:else}
        <p class="note">{w('same')}</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .sum {
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .sum.found {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 1px 6px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .kinds {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .kinds li {
    display: grid;
    grid-template-columns: 2.6em minmax(0, 1fr) auto;
    gap: 10px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px dashed var(--rule);
    min-width: 0;
  }

  .kinds li:last-child {
    border-bottom: 0;
  }

  .n {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 500;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .what {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .what code {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-2);
  }

  .spells {
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .does {
    font-size: 13px;
    color: var(--ink-2);
    text-align: right;
    max-width: 11em;
  }

  .fine .name,
  .fine .n {
    color: var(--ink-2);
    font-weight: 500;
  }

  /* A finding's short name: an ink tag in the list, under the highlighter in the text. */
  .badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 0 4px;
    border: 1px solid var(--ink);
    border-radius: 2px;
    vertical-align: 2px;
    white-space: nowrap;
  }

  .name .badge {
    margin-right: 4px;
  }

  .fine .badge {
    border-color: var(--rule);
    color: var(--ink-2);
  }

  .shown,
  .out {
    margin: 0;
    padding: 12px 14px;
    max-height: min(60dvh, 520px);
    overflow: auto;
  }

  .shown .badge {
    margin: 0 2px;
    background: var(--mark);
    color: var(--mark-ink);
    border-color: var(--mark-ink);
  }

  .shown .badge.quiet {
    background: none;
    color: var(--ink-2);
    border-color: var(--ink-2);
  }

  .look {
    white-space: nowrap;
  }

  .look .letter {
    background: var(--mark);
    color: var(--mark-ink);
    outline: 1px solid var(--mark-ink);
  }

  .look .badge {
    margin-left: 2px;
  }

  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
