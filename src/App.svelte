<script lang="ts">
  import Header from './components/Header.svelte';
  import Home from './components/Home.svelte';
  import ToolPage from './components/ToolPage.svelte';
  import Settings from './components/Settings.svelte';
  import Licences from './components/Licences.svelte';
  import { route, go, nav } from './lib/router.svelte.ts';
  import { toolByPath } from './lib/catalog.ts';
  import { ui } from './lib/prefs.svelte.ts';
  import { inbox, arrivals } from './lib/inbox.svelte.ts';
  import { t } from './lib/i18n.svelte.ts';

  const tool = $derived(toolByPath(route.path));
  const page = $derived(route.path === '/' || route.path === '' ? 'home' : route.path.replace(/\/+$/, '') === '/licences' ? 'licences' : tool ? 'tool' : 'missing');

  $effect(() => {
    if (page === 'home') document.title = 'Fundus';
    ui.search = false;
  });

  // What another app sent (the share sheet, "Open with"): it waits on the home with its tools.
  $effect(() => {
    arrivals().then((items) => {
      if (!items.length) return;
      inbox.put(items);
      if (route.path !== '/') go('/');
    });
  });

  function keys(e: KeyboardEvent) {
    const inField = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]');
    if (e.metaKey || e.ctrlKey || e.altKey || inField) return;
    // A tool's own stage (the teleprompter, the flip clock) has the keys while it's open.
    if (e.defaultPrevented || ui.settings || document.querySelector('[aria-modal="true"]')) return;
    if (e.key === '/') {
      e.preventDefault();
      ui.search = true;
    } else if (e.key === ',') {
      e.preventDefault();
      ui.settings = true;
    } else if (e.key === 'Escape' && page !== 'home' && !ui.search) {
      go('/');
    }
  }
</script>

<svelte:window onkeydown={keys} />

<Header />
{#key route.path}
  {#if page === 'home'}
    <Home />
  {:else if page === 'tool' && tool}
    <ToolPage {tool} />
  {:else if page === 'licences'}
    <Licences />
  {:else}
    <main class="sheet">
      <h1 class="missing">{t('tool.notFound')}</h1>
      <a class="link" href="/" onclick={nav}>{t('tool.notFoundBack')}</a>
    </main>
  {/if}
{/key}
<Settings />
<ewo-toaster position="bottom"></ewo-toaster>

<style>
  .missing {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.05;
  }
</style>
