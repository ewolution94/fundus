<!--
  The sticky header: away from the home, the way back to all the tools; Fundus and its count, the
  search, and Settings. Nothing else (the family's rule: the header carries only the primary actions).
  While searching on a phone the field takes the bar.
-->
<script lang="ts">
  import { ArrowLeft, Search as SearchIcon } from '@lucide/svelte';
  import Search from './Search.svelte';
  import { ui } from '../lib/prefs.svelte.ts';
  import { listed } from '../lib/catalog.ts';
  import { t } from '../lib/i18n.svelte.ts';
  import { home, nav, route } from '../lib/router.svelte.ts';

  const count = $derived(listed().length);
  const away = $derived(route.path !== '/' && route.path !== '');

  // A plain click goes back in the page; a modified one opens the home in a tab, as a link does.
  function back(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    home();
  }
</script>

<header class="top" class:searching={ui.search}>
  {#if away}
    <a class="back" href="/" onclick={back} aria-label={t('nav.back')}>
      <ArrowLeft aria-hidden="true" />
      <span>{t('nav.back')}</span>
      <kbd>Esc</kbd>
    </a>
  {/if}
  <a class="brand" href="/" onclick={nav}>
    <b>Fundus</b>
    <span>{t('brand.line', { n: count })}</span>
  </a>
  {#if ui.search}
    <Search />
  {:else}
    <button type="button" class="find" onclick={() => (ui.search = true)} aria-label={t('search.label')}>
      <SearchIcon aria-hidden="true" />
      <span>{t('search.label')}</span>
      <kbd>/</kbd>
    </button>
  {/if}
  <!-- A real <button> inside (Folio's element): Enter and Space click it, the click reaches here. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <ewo-settings-button class="gear" label={t('settings.open')} onclick={() => (ui.settings = true)}></ewo-settings-button>
</header>

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px var(--gutter);
    padding-top: max(12px, env(safe-area-inset-top));
    background: var(--bg);
    border-bottom: 2px solid var(--ink);
  }

  .brand {
    display: grid;
    margin-right: auto;
    min-width: 0;
    text-decoration: none;
  }

  .brand b {
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1;
  }

  .brand span {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-2);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-top: 4px;
    white-space: nowrap;
  }

  .find,
  .back {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 38px;
    min-width: 38px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
    color: var(--ink);
    font-size: 14px;
  }

  .back {
    text-decoration: none;
  }

  .find :global(svg),
  .back :global(svg) {
    width: 18px;
    height: 18px;
  }

  .find span,
  .find kbd,
  .back span,
  .back kbd {
    display: none;
  }

  .gear::part(button) {
    width: 38px;
    height: 38px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
    color: var(--ink);
  }

  .searching .back,
  .searching .brand,
  .searching .gear {
    display: none;
  }

  @media (min-width: 760px) {
    .top {
      gap: 14px;
      padding-block: 16px;
    }

    .brand span {
      font-size: 10px;
    }

    .find {
      width: 420px;
      justify-content: flex-start;
      padding: 0 12px;
      color: var(--ink-2);
    }

    .find span {
      display: inline;
      flex: 1;
      text-align: left;
    }

    .back {
      padding: 0 12px;
    }

    .back span {
      display: inline;
      font-weight: 600;
    }

    .find kbd,
    .back kbd {
      display: inline;
      font-family: var(--mono);
      font-size: 10px;
      border: 1px solid var(--rule);
      padding: 1px 5px;
    }

    .searching .brand,
    .searching .gear {
      display: grid;
    }

    .searching .back {
      display: flex;
    }
  }
</style>
