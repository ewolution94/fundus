<!--
  The home, the parts index. Three layers (plans/fundus.md):
  1. What you have: the register of chips (Photo, PDF, Text, From scratch, Numbers & time, and
     Developer with its switch on). A strip on a phone, a column on a computer.
  2. Detection: drop, paste or pick something anywhere on the page, and the tools that take it come
     first, each with its reason.
  3. Yours: pinned and recent tools on top.
  Then every tool as an article: number, figure, name, what it takes and gives.
-->
<script lang="ts">
  import { ArrowRight, X } from '@lucide/svelte';
  import DropWell from './kit/DropWell.svelte';
  import FileRow from './kit/FileRow.svelte';
  import { CHIPS, TOOLS, listed, articleNo, href, toolById, type Tool } from '../lib/catalog.ts';
  import { CHIP_ICONS, iconFor } from '../lib/icons.ts';
  import { inbox, fromTransfer, type Item } from '../lib/inbox.svelte.ts';
  import { suggest, type Suggestion } from '../lib/detect.ts';
  import { yours } from '../lib/memory.svelte.ts';
  import { ui } from '../lib/prefs.svelte.ts';
  import { go, nav } from '../lib/router.svelte.ts';
  import { shared } from '../lib/settings.svelte.ts';
  import { pick, t, locale } from '../lib/i18n.svelte.ts';
  import { formatBytes } from '../lib/files.ts';

  const tools = $derived(listed());
  const chips = $derived(CHIPS.filter((c) => c.id !== 'dev' || shared.dev));
  const count = (chip: string) => (chip === 'all' ? tools.length : tools.filter((t) => t.chip === chip).length);
  const groups = $derived(chips.filter((c) => ui.chip === 'all' || ui.chip === c.id).map((c) => ({ chip: c, tools: tools.filter((t) => t.chip === c.id) })));

  let suggestions = $state<Suggestion[]>([]);
  let thumbs = $state<Record<number, string>>({});

  $effect(() => {
    const items = inbox.items;
    void locale();
    let live = true;
    suggest(items).then((s) => {
      if (live) suggestions = s;
    });
    const urls: Record<number, string> = {};
    items.forEach((item, i) => {
      if ('file' in item && /^image\/(jpeg|png|webp|gif|avif)$/.test(item.file.type)) urls[i] = URL.createObjectURL(item.file);
    });
    thumbs = urls;
    return () => {
      live = false;
      for (const u of Object.values(urls)) URL.revokeObjectURL(u);
    };
  });

  const yourList = $derived([...new Set([...yours.pins, ...yours.recents])].map((id) => toolById(id)).filter((t): t is Tool => !!t && (t.chip !== 'dev' || shared.dev)).slice(0, 8));

  function take(items: Item[]) {
    if (items.length) inbox.put(items);
  }

  function open(tool: Tool, e?: MouseEvent) {
    e?.preventDefault();
    if (inbox.items.length) inbox.for = tool.id;
    else inbox.clear();
    go(href(tool));
  }

  // Paste and drop anywhere on the home (not while typing in a field).
  $effect(() => {
    const paste = (e: ClipboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return;
      const items = fromTransfer(e.clipboardData);
      if (!items.length) return;
      e.preventDefault();
      take(items);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      if (e.target instanceof Element && e.target.closest('.well')) return;
      e.preventDefault();
      take(fromTransfer(e.dataTransfer));
    };
    addEventListener('paste', paste);
    addEventListener('dragover', over);
    addEventListener('drop', drop);
    return () => {
      removeEventListener('paste', paste);
      removeEventListener('dragover', over);
      removeEventListener('drop', drop);
    };
  });

  const itemLabel = (item: Item) => ('file' in item ? item.file.name : item.text.trim().slice(0, 80));
  const itemMeta = (item: Item) => ('file' in item ? `${formatBytes(item.file.size, shared.decimal)}${item.file.type ? ` · ${item.file.type.split('/')[1]?.toUpperCase()}` : ''}` : t('home.text'));
</script>

<div class="body">
  <nav class="register" aria-label={t('register.label')}>
    <p class="q">{t('register.label')}</p>
    {#each [{ id: 'all', no: 0, name: { en: 'All', de: 'Alle' } }, ...chips] as c (c.id)}
      {@const Icon = CHIP_ICONS[c.id as keyof typeof CHIP_ICONS]}
      <button type="button" class="chip" class:hl={ui.chip === c.id} aria-pressed={ui.chip === c.id} onclick={() => (ui.chip = c.id)}>
        <Icon aria-hidden="true" />
        <code class="m">{String(c.no).padStart(3, '0')}</code>
        <span>{c.id === 'all' ? t('register.all') : pick(c.name)}</span>
        <em class="m">{count(c.id)}</em>
      </button>
    {/each}
  </nav>

  <main class="main">
    <section class="intake" aria-label={t('home.well')}>
      {#if inbox.items.length}
        <div class="items">
          {#each inbox.items as item, i (i)}
            <FileRow name={itemLabel(item)} meta={itemMeta(item)} thumb={thumbs[i] ?? null} />
          {/each}
          <button type="button" class="clear link" onclick={() => inbox.clear()}><X aria-hidden="true" />{t('home.clear')}</button>
        </div>
      {:else}
        <DropWell accept="image/*,.heic,.heif,application/pdf,.pdf,text/plain,.txt,.json" multiple onfiles={(f) => take(f.map((file) => ({ file })))} />
      {/if}
    </section>

    {#if inbox.items.length}
      <section class="sec">
        <h2 class="h">{t('home.forThis')}<em>{t('home.tools', { n: suggestions.length })}</em></h2>
        {#each suggestions as s (s.tool.id)}
          {@const Icon = iconFor(s.tool.id)}
          <a class="row" href={href(s.tool)} onclick={(e) => open(s.tool, e)}>
            <code class="no m">{articleNo(s.tool)}</code>
            <span class="fig"><Icon aria-hidden="true" /></span>
            <span class="name"><b>{pick(s.tool.name)}</b><small class="why">{pick(s.why)}</small></span>
            <span class="io m">{pick(s.tool.takes)} → {pick(s.tool.gives)}</span>
            <span class="go"><ArrowRight aria-hidden="true" /></span>
          </a>
        {:else}
          <p class="note pad">{t('home.nothing')}</p>
        {/each}
      </section>
    {:else if yourList.length}
      <section class="sec">
        <h2 class="h">{t('home.yours')}<em>{t('home.yoursNote', { p: yourList.filter((x) => yours.pins.includes(x.id)).length, r: yourList.filter((x) => !yours.pins.includes(x.id)).length })}</em></h2>
        <div class="yours">
          {#each yourList as tool (tool.id)}
            <a class="mini" href={href(tool)} onclick={(e) => open(tool, e)}>
              <code class="m"><span>{articleNo(tool)}</span><span>{yours.isPinned(tool.id) ? '★' : ''}</span></code>
              <b>{pick(tool.name)}</b>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#each groups as g (g.chip.id)}
      <section class="sec" aria-labelledby={`chip-${g.chip.id}`}>
        <h2 class="h" id={`chip-${g.chip.id}`}><code class="m">{g.chip.no}</code>{pick(g.chip.name)}<em>{t('home.tools', { n: g.tools.length })}</em></h2>
        <div class="thead m" aria-hidden="true">
          <span>{t('home.thead.no')}</span><span>{t('home.thead.fig')}</span><span>{t('home.thead.tool')}</span><span>{t('home.thead.io')}</span><span></span>
        </div>
        {#each g.tools as tool (tool.id)}
          {@const Icon = iconFor(tool.id)}
          <a class="row" href={href(tool)} onclick={nav}>
            <code class="no m">{articleNo(tool)}</code>
            <span class="fig"><Icon aria-hidden="true" /></span>
            <span class="name"><b>{pick(tool.name)}</b><small>{pick(tool.desc)}</small></span>
            <span class="io m">{pick(tool.takes)} → {pick(tool.gives)}</span>
            <span class="go"><ArrowRight aria-hidden="true" /></span>
          </a>
        {/each}
      </section>
    {/each}

    {#if !shared.dev && ui.chip === 'all'}
      <p class="note pad">{t('home.devOff')}</p>
    {/if}
    <p class="foot">{t('home.local')}</p>
  </main>
</div>

<style>
  .body {
    display: grid;
    max-width: 1440px;
    margin-inline: auto;
  }

  .register {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 10px 12px;
    border-bottom: 1px solid var(--rule);
  }

  .register::-webkit-scrollbar {
    display: none;
  }

  .q {
    display: none;
  }

  .chip {
    flex: none;
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 8px;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }

  .chip :global(svg) {
    display: none;
  }

  .chip code,
  .chip em {
    color: var(--ink-2);
    font-style: normal;
  }

  .chip em {
    font-size: 10px;
  }

  .chip.hl code,
  .chip.hl em {
    color: var(--mark-ink);
  }

  .main {
    display: grid;
    align-content: start;
    padding-bottom: 44px;
    min-width: 0;
  }

  .intake {
    padding: 14px var(--gutter) 4px;
  }

  .items {
    display: grid;
    gap: 8px;
  }

  .clear {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .clear :global(svg) {
    width: 14px;
    height: 14px;
  }

  .sec {
    padding: 6px var(--gutter);
    min-width: 0;
  }

  .sec .h {
    padding-top: 16px;
  }

  .h code {
    color: var(--ink-2);
    font-weight: 400;
  }

  .thead {
    display: none;
  }

  .row {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
    text-decoration: none;
  }

  .row .no {
    grid-column: 3;
    grid-row: 1;
    align-self: start;
    padding-top: 3px;
    color: var(--ink-2);
  }

  .row .fig {
    grid-column: 1;
    grid-row: 1;
  }

  .row .name {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }

  .fig {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 1px solid var(--rule);
    background: var(--card);
  }

  .fig :global(svg) {
    width: 22px;
    height: 22px;
    stroke-width: 1.4;
  }

  .name b {
    display: block;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
  }

  .name small {
    display: block;
    font-size: 13px;
    color: var(--ink-2);
    line-height: 1.35;
    margin-top: 2px;
  }

  .name small.why {
    color: var(--ink);
  }

  .name small.why::before {
    content: '→ ';
  }

  .io,
  .go {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .row:hover .name b,
    .mini:hover b {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }

  .yours {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding-top: 10px;
  }

  .mini {
    display: grid;
    gap: 4px;
    padding: 10px;
    border: 1px solid var(--rule);
    background: var(--card);
    text-decoration: none;
    min-width: 0;
  }

  .mini code {
    color: var(--ink-2);
    display: flex;
    justify-content: space-between;
  }

  .mini b {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  .pad {
    padding: 14px var(--gutter) 0;
  }

  .foot {
    padding: 28px var(--gutter) 0;
  }

  @media (min-width: 760px) {
    .body {
      grid-template-columns: 236px minmax(0, 1fr);
    }

    .register {
      flex-direction: column;
      align-items: stretch;
      gap: 2px;
      padding: 26px 18px 24px 32px;
      border-bottom: 0;
      border-right: 1px solid var(--rule);
      overflow: visible;
      position: sticky;
      top: 74px;
      align-self: start;
    }

    .q {
      display: block;
      font-family: var(--mono);
      font-size: 10px;
      text-transform: uppercase;
      color: var(--ink-2);
      margin: 0 0 10px 8px;
    }

    .chip em {
      margin-left: auto;
    }

    .main {
      padding: 6px 0 64px;
    }

    .intake {
      padding-top: 18px;
    }

    .thead {
      display: grid;
      padding: 8px 0;
      border-bottom: 1px solid var(--rule);
      font-size: 10px;
      text-transform: uppercase;
      color: var(--ink-2);
    }

    .row,
    .thead {
      grid-template-columns: 58px 40px minmax(0, 1fr) 240px 18px;
      gap: 16px;
    }

    .row .no,
    .row .fig,
    .row .name {
      grid-column: auto;
      grid-row: auto;
    }

    .row .no {
      align-self: center;
      padding: 0;
    }

    .io {
      display: block;
      font-size: 10.5px;
      color: var(--ink-2);
      line-height: 1.5;
    }

    .go {
      display: block;
      color: var(--ink-2);
    }

    .go :global(svg) {
      width: 16px;
      height: 16px;
    }

    .yours {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
