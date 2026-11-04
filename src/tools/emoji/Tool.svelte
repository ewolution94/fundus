<!--
  F-309 Emoji picker: every emoji in Unicode's groups, found by a word in either language, a
  :shortcode:, a code point or the emoji itself (emoji.ts). A tap copies it at once and adds it to the
  line, to copy several together; the chosen one shows its names and its codes. Kept: the skin tone
  and the last ones picked (options, not content). The line is never kept.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { Clock, Flag, Hand, Lightbulb, PawPrint, Plane, Search, Shapes, Smile, Trophy, Utensils, X } from '@lucide/svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import { locale, t, words } from '../../lib/i18n.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { copyText } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { toast } from '../../../vendor/ewo/elements/toaster.js';
  import { GROUPS, cap, codes, entries, find, samples, search, versionLabel, withTone, type Emoji, type Lang } from './emoji.ts';
  import { EMOJI_FACE, newestShown } from './support.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      find: 'Find an emoji',
      placeholder: 'A word or :shortcode:',
      clearFind: 'Clear the search',
      tone: 'Skin tone',
      tone0: 'No skin tone',
      tone1: 'Light',
      tone2: 'Medium-light',
      tone3: 'Medium',
      tone4: 'Medium-dark',
      tone5: 'Dark',
      groups: 'Groups',
      recent: 'Recent',
      g0: 'Smileys & emotion',
      g1: 'People & body',
      g3: 'Animals & nature',
      g4: 'Food & drink',
      g5: 'Travel & places',
      g6: 'Activities',
      g7: 'Objects',
      g8: 'Symbols',
      g9: 'Flags',
      found: 'Found',
      count: '{n}',
      none: 'No emoji for “{q}”.',
      left: '{n} newer emoji are left out: this device can’t draw them yet.',
      copied: 'Copied',
      copiedSr: '{emoji} {name}, copied',
      empty: 'Tap an emoji: it’s copied at once, and its name and codes show here.',
      codes: 'Codes',
      points: 'Code points',
      shortcode: 'Shortcode',
      version: 'Since',
      versionValue: 'Emoji {v}',
      copyIt: 'Copy',
      line: 'Line',
      lineHint: 'Every emoji you tap joins the line, to copy them together.',
      copyLine: 'Copy all',
      clearLine: 'Clear the line',
    },
    de: {
      find: 'Emoji finden',
      placeholder: 'Ein Wort oder :shortcode:',
      clearFind: 'Suche leeren',
      tone: 'Hautfarbe',
      tone0: 'Ohne Hautfarbe',
      tone1: 'Hell',
      tone2: 'Mittelhell',
      tone3: 'Mittel',
      tone4: 'Mitteldunkel',
      tone5: 'Dunkel',
      groups: 'Gruppen',
      recent: 'Zuletzt',
      g0: 'Smileys & Gefühle',
      g1: 'Menschen & Körper',
      g3: 'Tiere & Natur',
      g4: 'Essen & Trinken',
      g5: 'Reisen & Orte',
      g6: 'Aktivitäten',
      g7: 'Objekte',
      g8: 'Symbole',
      g9: 'Flaggen',
      found: 'Gefunden',
      count: '{n}',
      none: 'Kein Emoji für „{q}“.',
      left: '{n} neuere Emoji fehlen: dieses Gerät kann sie noch nicht zeichnen.',
      copied: 'Kopiert',
      copiedSr: '{emoji} {name}, kopiert',
      empty: 'Tipp ein Emoji an: es ist sofort kopiert, und hier stehen sein Name und seine Codes.',
      codes: 'Codes',
      points: 'Codepunkte',
      shortcode: 'Shortcode',
      version: 'Seit',
      versionValue: 'Emoji {v}',
      copyIt: 'Kopieren',
      line: 'Zeile',
      lineHint: 'Jedes angetippte Emoji kommt in die Zeile, um sie zusammen zu kopieren.',
      copyLine: 'Alle kopieren',
      clearLine: 'Zeile leeren',
    },
  });

  const ICONS = { recent: Clock, g0: Smile, g1: Hand, g3: PawPrint, g4: Utensils, g5: Plane, g6: Trophy, g7: Lightbulb, g8: Shapes, g9: Flag };
  type SectionId = keyof typeof ICONS | 'found';

  const o = remember('emoji', { tone: 0, recent: [] as string[] });

  // Only what this device can draw: an emoji newer than its fonts would show as a box or in parts.
  const every = entries();
  const newest = newestShown(samples(every));
  const list = every.filter((e) => e.version <= newest);
  const leftOut = every.length - list.length;
  const byGroup = new Map<number, Emoji[]>(GROUPS.map((g) => [g, list.filter((e) => e.group === g)]));

  // The last ones picked as they were when the page opened: a list that changed under the finger
  // would move the whole grid (Safari doesn't hold the scroll on what's in view).
  const recent = untrack(() => o.recent)
    .map((s) => find(list, s))
    .filter((e): e is Emoji => !!e);

  const lang = $derived<Lang>(locale() === 'de' ? 'de' : 'en');
  const other = $derived<Lang>(lang === 'de' ? 'en' : 'de');

  let query = $state(untrack(() => texts(items))[0]?.trim().slice(0, 60) ?? '');
  const found = $derived(query.trim() ? search(list, query, lang) : null);

  interface Section {
    id: SectionId;
    items: Emoji[];
  }

  const sections = $derived.by<Section[]>(() => {
    if (found) return [{ id: 'found', items: found }];
    const out: Section[] = recent.length ? [{ id: 'recent', items: recent }] : [];
    for (const g of GROUPS) {
      const items = byGroup.get(g)!;
      if (items.length) out.push({ id: `g${g}` as SectionId, items });
    }
    return out;
  });
  const index = (['recent', ...GROUPS.map((g) => `g${g}`)] as (keyof typeof ICONS)[]).filter((id) => (id === 'recent' ? recent.length > 0 : byGroup.get(Number(id.slice(1)))!.length > 0));

  // What was tapped: the entry and the very text copied (in the tone it had).
  let chosen = $state<{ entry: Emoji; text: string } | null>(null);
  let line = $state('');
  let flash = $state(0);
  let said = $state('');
  let toneOpen = $state(false);
  let codesOpen = $state(false);
  let typing = $state(false);
  let current = $state<SectionId>(index[0] ?? 'g0');
  let cursor = $state('');

  const wide = new MediaQuery('min-width: 760px', false);

  // The bar and the chosen one stick under the page's header, however tall it comes out.
  let head = $state(0);
  $effect(() => {
    const top = document.querySelector<HTMLElement>('header.top');
    if (!top) return;
    const ro = new ResizeObserver(() => (head = top.offsetHeight));
    ro.observe(top);
    return () => ro.disconnect();
  });
  const info = $derived(chosen ? codes(chosen.text) : null);

  let bar: HTMLDivElement;
  let grid: HTMLDivElement;
  let field: HTMLInputElement;
  let lineOut = $state<HTMLOutputElement>();
  let flashTimer: ReturnType<typeof setTimeout>;

  // A tap copies straight away (Safari allows the clipboard only inside the tap), then the emoji joins
  // the line and the recent ones.
  async function pick(entry: Emoji) {
    const text = withTone(entry, o.tone);
    const copying = copyText(text);
    chosen = { entry, text };
    line += text;
    o.recent = [entry.emoji, ...o.recent.filter((s) => s !== entry.emoji)].slice(0, 24);
    if (await copying) {
      flash++;
      said = w('copiedSr', { emoji: text, name: entry.name[lang] });
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flash = 0), 1400);
    } else toast(t('tool.copyFailed'), { tone: 'bad' });
  }

  async function copyLine() {
    if (await copyText(line)) {
      said = `${line}, ${w('copied')}`;
      flash++;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flash = 0), 1400);
    } else toast(t('tool.copyFailed'), { tone: 'bad' });
  }

  // The newest in the line stays in view.
  $effect(() => {
    void line;
    if (lineOut) lineOut.scrollLeft = lineOut.scrollWidth;
  });

  // A search started deep in the grid shows its results right under the bar.
  async function typed(next: string) {
    const fresh = !query.trim() && next.trim();
    query = next;
    if (!fresh) return;
    await tick();
    const top = grid.getBoundingClientRect().top + scrollY - barEnd() - 6;
    if (scrollY > top) scrollTo({ top });
  }

  const keyOf = (section: SectionId, e: Emoji) => `${section}:${e.emoji}`;
  const shownKeys = $derived(new Set(sections.flatMap((s) => s.items.map((e) => keyOf(s.id, e)))));
  const firstKey = $derived(sections[0]?.items[0] ? keyOf(sections[0].id, sections[0].items[0]) : '');
  const active = $derived(shownKeys.has(cursor) ? cursor : firstKey);

  // Where the bar ends once it sticks: under the page's header, its own height.
  const barEnd = () => parseFloat(getComputedStyle(bar).top) + bar.offsetHeight;
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  async function jump(id: SectionId) {
    if (found) query = '';
    await tick();
    const section = grid.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!section) return;
    current = id;
    scrollTo({ top: section.getBoundingClientRect().top + scrollY - barEnd() - 6, behavior: smooth() });
  }

  let frame = 0;
  function scrolled() {
    if (frame || found) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const end = barEnd() + 12;
      let at = sections[0]?.id;
      for (const s of grid.querySelectorAll<HTMLElement>('[data-section]')) if (s.getBoundingClientRect().top <= end) at = s.dataset.section as SectionId;
      if (at) current = at;
    });
  }

  // Arrows move through the grid: left and right in order, up and down to the nearest in the next row.
  function keys(e: KeyboardEvent) {
    const at = e.target as HTMLElement;
    if (!at.matches('button.cell')) return;
    const cells = [...grid.querySelectorAll<HTMLButtonElement>('button.cell')];
    const i = cells.indexOf(at as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowRight') next = cells[i + 1];
    else if (e.key === 'ArrowLeft') next = cells[i - 1];
    else if (e.key === 'Home') next = cells[0];
    else if (e.key === 'End') next = cells.at(-1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') next = row(cells, i, e.key === 'ArrowDown' ? 1 : -1);
    else return;
    e.preventDefault();
    if (next) {
      cursor = next.dataset.key!;
      next.focus();
    } else if (e.key === 'ArrowUp') field.focus();
  }

  function row(cells: HTMLButtonElement[], i: number, dir: 1 | -1) {
    const from = cells[i].getBoundingClientRect();
    const middle = from.left + from.width / 2;
    let j = i + dir;
    while (cells[j] && Math.abs(cells[j].getBoundingClientRect().top - from.top) < 2) j += dir;
    if (!cells[j]) return undefined;
    const top = cells[j].getBoundingClientRect().top;
    let best = cells[j];
    let gap = Infinity;
    for (let k = j; cells[k] && Math.abs(cells[k].getBoundingClientRect().top - top) < 2; k += dir) {
      const r = cells[k].getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - middle);
      if (d < gap) [gap, best] = [d, cells[k]];
    }
    return best;
  }

  function fieldKeys(e: KeyboardEvent) {
    if (e.key === 'Enter' && found?.[0]) {
      e.preventDefault();
      void pick(found[0]);
    } else if (e.key === 'ArrowDown') {
      const first = grid.querySelector<HTMLButtonElement>('button.cell');
      if (!first) return;
      e.preventDefault();
      cursor = first.dataset.key!;
      first.focus();
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      query = '';
    }
  }

  // The tray at the thumb steps aside while the keyboard is up (WayBack does the same).
  const read = () => queueMicrotask(() => (typing = !!document.activeElement?.matches('input, textarea')));

  const tones = $derived([0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n ? `✋${['🏻', '🏼', '🏽', '🏾', '🏿'][n - 1]}` : '✋', title: w(`tone${n}` as 'tone0') })));
</script>

<svelte:window onscroll={scrolled} onfocusin={read} onfocusout={read} />

{#snippet details()}
  <div class="card" class:blank={!chosen}>
    <div class="glyph" aria-hidden="true">{chosen?.text ?? ''}</div>
    <div class="names">
      {#if chosen}
        <b>{cap(chosen.entry.name[lang])}</b>
        <span lang={other}>{cap(chosen.entry.name[other])}</span>
        <span class="stamp m" class:on={flash > 0}>{w('copied')}</span>
      {:else}
        <span>{w('empty')}</span>
      {/if}
    </div>
    {#if chosen && wide.current}
      <CopyButton text={chosen.text} variant="button" label={w('copyIt')} />
    {:else if chosen}
      <button type="button" class="btn" aria-expanded={codesOpen} onclick={() => (codesOpen = !codesOpen)}>{w('codes')}</button>
    {/if}
  </div>
  {#if chosen && info && (wide.current || codesOpen)}
    {#if wide.current}<h2 class="h">{w('codes')}</h2>{/if}
    <dl class="spec codes">
      <div><dt>{w('points')}</dt><dd><code>{info.unicode}</code><CopyButton text={info.unicode} /></dd></div>
      {#if chosen.entry.shortcodes.length}
        {@const sc = chosen.entry.shortcodes.map((s) => `:${s}:`)}
        <div><dt>{w('shortcode')}</dt><dd><code>{sc.join(' ')}</code><CopyButton text={sc[0]} /></dd></div>
      {/if}
      <div><dt>HTML</dt><dd><code>{info.html}</code><CopyButton text={info.html} /></dd></div>
      <div><dt>CSS</dt><dd><code>content: {info.css}</code><CopyButton text={info.css} /></dd></div>
      <div><dt>JavaScript</dt><dd><code>'{info.js}'</code><CopyButton text={`'${info.js}'`} /></dd></div>
      <div><dt>{w('version')}</dt><dd>{w('versionValue', { v: versionLabel(chosen.entry.version) })}</dd></div>
    </dl>
  {/if}
{/snippet}

<div class="cols picker" style:--emoji={EMOJI_FACE} style:--head={head ? `${head}px` : null}>
  <aside class="stack side" aria-label={chosen ? cap(chosen.entry.name[lang]) : w('codes')}>
    {@render details()}
    {#if line}
      <div class="tray" class:away={typing && !wide.current}>
        <span class="tray-label m">{w('line')}</span>
        <output class="line" aria-label={w('line')} bind:this={lineOut}>{line}</output>
        <button type="button" class="tray-btn" onclick={copyLine}>{w('copyLine')}</button>
        <button type="button" class="tray-x" aria-label={w('clearLine')} title={w('clearLine')} onclick={() => (line = '')}><X aria-hidden="true" /></button>
      </div>
    {:else if wide.current}
      <p class="note">{w('lineHint')}</p>
    {/if}
  </aside>

  <div class="stack main">
    <div class="bar" bind:this={bar}>
      <div class="find">
        <div class="search">
          <Search aria-hidden="true" />
          <label class="sr" for="emoji-find">{w('find')}</label>
          <input
            bind:this={field}
            id="emoji-find"
            type="search"
            class="field"
            class:has={!!query}
            enterkeyhint="done"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder={w('placeholder')}
            value={query}
            oninput={(e) => typed(e.currentTarget.value)}
            onkeydown={fieldKeys} />
          {#if query}
            <button
              type="button"
              class="clear"
              aria-label={w('clearFind')}
              title={w('clearFind')}
              onclick={() => {
                query = '';
                field.focus();
              }}><X aria-hidden="true" /></button
            >
          {/if}
        </div>
        <button type="button" class="tone-btn" aria-expanded={toneOpen} aria-label={w('tone')} title={w('tone')} onclick={() => (toneOpen = !toneOpen)}>
          <span aria-hidden="true">{tones[o.tone].label}</span>
        </button>
      </div>
      {#if toneOpen}
        <div class="tones">
          <Seg
            label={w('tone')}
            value={o.tone}
            options={tones}
            onchange={(n) => {
              o.tone = n;
              toneOpen = false;
            }} />
          <span class="m tone-name">{w(`tone${o.tone}` as 'tone0')}</span>
        </div>
      {/if}
      <nav class="index" aria-label={w('groups')}>
        {#each index as id (id)}
          {@const Icon = ICONS[id]}
          <button type="button" aria-label={w(id)} title={w(id)} aria-current={!found && current === id ? 'true' : undefined} onclick={() => jump(id)}>
            <Icon aria-hidden="true" />
          </button>
        {/each}
      </nav>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sections" bind:this={grid} onkeydown={keys}>
      {#each sections as section (section.id)}
        <section data-section={section.id} aria-labelledby="emoji-{section.id}">
          <h2 class="h" id="emoji-{section.id}">
            <span>{w(section.id)}</span>
            <em>{w('count', { n: section.items.length })}</em>
          </h2>
          <div class="grid" role="group" aria-labelledby="emoji-{section.id}">
            {#each section.items as entry (entry.emoji)}
              {@const key = keyOf(section.id, entry)}
              {@const text = withTone(entry, o.tone)}
              <button
                type="button"
                class="cell"
                class:on={chosen?.text === text}
                data-key={key}
                tabindex={key === active ? 0 : -1}
                aria-label={entry.name[lang]}
                title={cap(entry.name[lang])}
                onfocus={() => (cursor = key)}
                onclick={() => pick(entry)}>{text}</button
              >
            {/each}
          </div>
        </section>
      {/each}
      {#if found && !found.length}
        <p class="note none">{w('none', { q: query.trim() })}</p>
      {/if}
      {#if leftOut > 0 && !found}
        <p class="note">{w('left', { n: leftOut })}</p>
      {/if}
    </div>
  </div>
</div>

<p class="sr" aria-live="polite">{said}</p>

<style>
  .cell,
  .glyph,
  .line,
  .tone-btn,
  .tones :global(button) {
    font-family: var(--emoji), var(--sans);
  }

  /* Apple's emoji face has digits too (for the keycaps): the codes keep to the mono face. */
  .codes code {
    font-family: var(--mono);
  }

  /* On a computer the picker takes the room and the chosen one stands at its right; on a phone the
     chosen one comes first, one card high, and the line waits at the thumb. */
  .picker {
    align-items: start;
  }

  .side {
    order: 0;
  }

  .main {
    order: 1;
  }

  /* ── The chosen one ── */

  .card {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 64px;
  }

  .glyph {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    font-size: 44px;
    line-height: 1;
    border: 1.5px solid var(--ink);
    background: var(--card);
  }

  .blank .glyph {
    border-style: dashed;
    border-color: var(--rule);
  }

  .blank .names {
    grid-column: 2 / -1;
    color: var(--ink-2);
    font-size: 14px;
  }

  .names {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .names b {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .names span {
    color: var(--ink-2);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .stamp {
    justify-self: start;
    font-size: 10px;
    text-transform: uppercase;
    padding: 0 5px;
    visibility: hidden;
  }

  .stamp.on {
    visibility: visible;
    background: var(--mark);
    color: var(--mark-ink);
  }

  .h + .codes {
    border-top: 0;
  }

  .codes code {
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .codes dd {
    grid-template-columns: minmax(0, 1fr) auto;
    justify-items: stretch;
    align-items: center;
    gap: 10px;
  }

  .codes dd :global(.tag) {
    justify-self: end;
  }

  /* ── The line: at the thumb on a phone (right of the way back), in place on a computer ── */

  .tray {
    position: fixed;
    z-index: 8;
    left: calc(max(var(--gutter), env(safe-area-inset-left, 0px)) + 62px);
    right: max(var(--gutter), env(safe-area-inset-right, 0px));
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas: 'line copy x';
    align-items: center;
    gap: 4px;
    height: 54px;
    padding: 0 4px 0 12px;
    background: var(--ink);
    color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.22);
  }

  .tray.away {
    visibility: hidden;
  }

  .tray-label {
    display: none;
  }

  .line {
    grid-area: line;
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
    font-size: 24px;
    line-height: 54px;
    scrollbar-width: none;
  }

  .tray-btn {
    grid-area: copy;
    height: 40px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 700;
    border: 1.5px solid var(--bg);
    border-radius: 2px;
  }

  .tray-x {
    grid-area: x;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
  }

  .tray-x :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* ── The search, the tone, the groups: they stay under the header ── */

  .bar {
    position: sticky;
    top: var(--head, 68px);
    z-index: 3;
    display: grid;
    gap: 8px;
    padding: 10px 0 0;
    margin-top: -10px;
    background: var(--bg);
  }

  .find {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 8px;
  }

  .search {
    position: relative;
    min-width: 0;
  }

  .search > :global(svg) {
    position: absolute;
    left: 12px;
    top: 50%;
    translate: 0 -50%;
    width: 18px;
    height: 18px;
    color: var(--ink-2);
    pointer-events: none;
  }

  .search .field {
    height: 44px;
    padding-left: 38px;
  }

  .search .field.has {
    padding-right: 44px;
  }

  .search .field::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }

  .clear {
    position: absolute;
    right: 2px;
    top: 2px;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    color: var(--ink-2);
  }

  .clear :global(svg) {
    width: 18px;
    height: 18px;
  }

  .tone-btn {
    display: grid;
    place-items: center;
    height: 44px;
    font-size: 24px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
  }

  .tone-btn[aria-expanded='true'] {
    background: var(--mark);
  }

  .tones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }

  .tones :global(button) {
    font-size: 22px;
    min-width: 40px;
    min-height: 40px;
  }

  .tone-name {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .index {
    display: flex;
    border-bottom: 1.5px solid var(--ink);
  }

  .index button {
    flex: 1;
    display: grid;
    place-items: center;
    height: 40px;
    min-width: 0;
    color: var(--ink-2);
  }

  .index button[aria-current='true'] {
    color: var(--ink);
    box-shadow: inset 0 -3px 0 var(--ink);
  }

  .index :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* ── The emoji ── */

  .sections {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .sections .h {
    border-bottom-width: 1px;
    border-bottom-color: var(--rule);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    padding-top: 6px;
  }

  .cell {
    display: grid;
    place-items: center;
    height: 48px;
    min-width: 0;
    font-size: 30px;
    line-height: 1;
    border-radius: 2px;
  }

  .cell:active {
    background: var(--sunk);
  }

  .cell.on {
    background: var(--mark);
  }

  .cell:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: -2px;
  }

  @media (hover: hover) {
    .cell:hover {
      background: var(--sunk);
    }

    .cell.on:hover {
      background: var(--mark);
    }
  }

  .none {
    padding: 12px 0;
    font-size: 15px;
  }

  @media (min-width: 760px) {
    .picker {
      grid-template-columns: minmax(0, 1fr) 340px;
    }

    .side {
      order: 2;
      position: sticky;
      top: calc(var(--head, 78px) + 20px);
    }

    .main {
      order: 1;
    }

    .bar {
      padding-top: 20px;
      margin-top: -20px;
    }

    .glyph {
      width: 96px;
      height: 96px;
      font-size: 68px;
    }

    .card {
      grid-template-columns: 96px minmax(0, 1fr);
      min-height: 96px;
    }

    .card > :global(.btn) {
      grid-column: 1 / -1;
    }

    .blank .names {
      grid-column: 2;
    }

    .tray {
      position: static;
      grid-template-columns: minmax(0, 1fr) auto auto;
      grid-template-areas: 'label label label' 'line copy x';
      height: auto;
      padding: 8px 4px 4px 12px;
      box-shadow: none;
    }

    .tray-label {
      display: block;
      grid-area: label;
      font-size: 10px;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .line {
      line-height: 48px;
    }

    .grid {
      grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    }
  }
</style>
