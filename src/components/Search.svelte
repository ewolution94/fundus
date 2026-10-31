<!--
  The search: a field in the header and the hits under it. Names, what a tool does, synonyms in both
  languages, and article numbers ("verkl", "mwst", "502"). Enter opens the first hit (or the one
  picked with the arrows), Escape closes.
-->
<script lang="ts">
  import { findTools } from '../lib/search.ts';
  import { listed, TOOLS, articleNo, href, type Tool } from '../lib/catalog.ts';
  import { pick, t } from '../lib/i18n.svelte.ts';
  import { ui } from '../lib/prefs.svelte.ts';
  import { go } from '../lib/router.svelte.ts';
  import { shared } from '../lib/settings.svelte.ts';

  let input: HTMLInputElement;
  let sel = $state(0);

  // The developer shelf is searchable once it's on; its tools are public either way, but out of
  // the way until then.
  const hits = $derived(findTools(ui.query, shared.dev ? TOOLS : listed()));

  $effect(() => {
    input.focus();
  });

  $effect(() => {
    void ui.query;
    sel = 0;
  });

  function close() {
    ui.search = false;
    ui.query = '';
  }

  function open(tool: Tool) {
    close();
    go(href(tool));
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      sel = Math.min(hits.length - 1, sel + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(0, sel - 1);
    } else if (e.key === 'Enter' && hits[sel]) {
      e.preventDefault();
      open(hits[sel].tool);
    }
  }
</script>

<div class="search">
  <label class="field-wrap">
    <span class="sr">{t('search.label')}</span>
    <input
      bind:this={input}
      type="search"
      enterkeyhint="go"
      autocomplete="off"
      spellcheck="false"
      placeholder={t('search.placeholder')}
      value={ui.query}
      oninput={(e) => (ui.query = e.currentTarget.value)}
      onkeydown={key}
      role="combobox"
      aria-expanded={!!ui.query}
      aria-controls="search-hits"
      aria-activedescendant={hits[sel] ? `hit-${hits[sel].tool.id}` : undefined}
    />
  </label>
  <button type="button" class="cancel" onclick={close}>{t('search.cancel')}</button>

  <div class="results" id="search-hits" role="listbox" aria-label={t('search.label')}>
    {#if ui.query.trim()}
      {#each hits as hit, i (hit.tool.id)}
        <a
          id={`hit-${hit.tool.id}`}
          class="hit"
          class:sel={i === sel}
          role="option"
          aria-selected={i === sel}
          href={href(hit.tool)}
          onclick={(e) => {
            e.preventDefault();
            open(hit.tool);
          }}
          onpointerenter={() => (sel = i)}
        >
          <code class="m">{articleNo(hit.tool)}</code>
          <span>
            <b>{pick(hit.tool.name)}</b>
            <small>{hit.via ? t('search.matches', { w: hit.via }) : pick(hit.tool.desc)}</small>
          </span>
          {#if i === sel}<kbd class="m">↵</kbd>{/if}
        </a>
      {:else}
        <p class="empty">{t('search.none', { q: ui.query.trim() })}</p>
      {/each}
    {:else}
      <p class="tip">{t('search.tip')}</p>
    {/if}
  </div>
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') close();
  }}
/>

<style>
  .search {
    position: static;
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .field-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 10px;
    border: 2px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    font-size: 16px;
    color: var(--ink);
    outline: none;
    padding: 0;
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  .cancel {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }

  .results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: calc(100dvh - 100%);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px var(--gutter) 24px;
    background: var(--bg);
    border-top: 1px solid var(--rule);
  }

  .hit {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 11px 8px;
    border-bottom: 1px solid var(--rule);
    text-decoration: none;
  }

  .hit code {
    color: var(--ink-2);
  }

  .hit b {
    display: block;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
  }

  .hit small {
    display: block;
    font-size: 13px;
    color: var(--ink-2);
    margin-top: 2px;
  }

  .hit.sel {
    background: var(--mark);
    color: var(--mark-ink);
  }

  .hit.sel code,
  .hit.sel small {
    color: var(--mark-ink);
  }

  kbd {
    font-size: 12px;
  }

  .empty,
  .tip {
    padding: 16px 8px;
    color: var(--ink-2);
    font-size: 14px;
  }

  @media (min-width: 760px) {
    .search {
      position: relative;
      flex: none;
      width: 420px;
    }

    .cancel {
      display: none;
    }

    .results {
      top: calc(100% + 8px);
      left: auto;
      right: 0;
      width: 520px;
      height: auto;
      max-height: min(70vh, 640px);
      padding: 6px 12px 14px;
      background: var(--card);
      border: 2px solid var(--ink);
      box-shadow: 0 18px 40px rgb(0 0 0 / 0.18);
    }
  }
</style>
