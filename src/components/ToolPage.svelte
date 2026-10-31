<!--
  A tool's page: its head, then the tool itself, loaded when it's opened (each tool and its libraries
  are their own files, fetched once and kept for offline by the service worker). Whatever waited in
  the inbox goes in.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import ToolHead from './ToolHead.svelte';
  import { inbox, type Item } from '../lib/inbox.svelte.ts';
  import { pick, t } from '../lib/i18n.svelte.ts';
  import { yours } from '../lib/memory.svelte.ts';
  import { LOADERS } from '../lib/loaders.ts';
  import type { Tool } from '../lib/catalog.ts';

  interface Props {
    tool: Tool;
  }

  let { tool }: Props = $props();

  // The inbox is read once, when the tool opens: a later visit starts empty.
  const from = inbox.from;
  const items: Item[] = inbox.take();

  let Loaded = $state<Component<{ tool: Tool; items: Item[] }> | null>(null);
  let failed = $state(false);

  $effect(() => {
    const load = LOADERS[tool.id];
    if (!load) {
      failed = true;
      return;
    }
    load()
      .then((m) => (Loaded = m.default))
      .catch(() => (failed = true));
    yours.used(tool.id);
    document.title = `${pick(tool.name)} · Fundus`;
  });
</script>

<!-- data-ready tells the end-to-end tests the tool is in. -->
<main class="sheet" data-tool={tool.id} data-ready={Loaded ? '' : undefined}>
  <ToolHead {tool} {from} />
  {#if Loaded}
    <Loaded {tool} {items} />
  {:else if failed}
    <p class="error" role="alert">{t('tool.loadFailed')}</p>
  {:else}
    <p class="note" aria-live="polite">{t('tool.loading')}</p>
  {/if}
  <p class="foot">{t('tool.local')}</p>
</main>
