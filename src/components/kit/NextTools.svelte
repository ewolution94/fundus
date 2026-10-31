<!--
  Chaining: a result goes on into the next tool with the file already in ("Go on with the result:
  Resize & crop, Blur parts, Photos to PDF"). Only the tools that take it are offered.
-->
<script lang="ts">
  import { ArrowRight } from '@lucide/svelte';
  import { TOOLS, href, articleNo, type Tool } from '../../lib/catalog.ts';
  import { accepts } from '../../lib/detect.ts';
  import { inbox, type Item } from '../../lib/inbox.svelte.ts';
  import { go } from '../../lib/router.svelte.ts';
  import { pick, t } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';

  interface Props {
    /** What the next tool gets: usually the result as a File. */
    items: Item[] | null;
    /** This tool's id (left out of the list). */
    from: string;
    /** At most this many. */
    max?: number;
    /** A preferred order of tool ids, first ones first. */
    prefer?: string[];
  }

  let { items, from, max = 4, prefer = [] }: Props = $props();
  let next = $state<Tool[]>([]);

  $effect(() => {
    const list = items;
    const dev = shared.dev;
    if (!list?.length) {
      next = [];
      return;
    }
    let live = true;
    (async () => {
      const out: Tool[] = [];
      for (const tool of TOOLS) {
        if (tool.id === from || (tool.chip === 'dev' && !dev)) continue;
        if (await accepts(tool, list[0])) out.push(tool);
      }
      const rank = (t: Tool) => (prefer.includes(t.id) ? prefer.indexOf(t.id) : 100 + t.no / 1000);
      out.sort((a, b) => rank(a) - rank(b));
      if (live) next = out.slice(0, max);
      // A file that can't be read any more (the page is leaving) offers nothing next.
    })().catch(() => {});
    return () => (live = false);
  });

  function open(tool: Tool, e: MouseEvent) {
    e.preventDefault();
    inbox.put(items ?? [], { for: tool.id, from });
    go(href(tool));
  }
</script>

{#if next.length}
  <nav class="next" aria-label={t('tool.next')}>
    <h2 class="h">{t('tool.next')}</h2>
    {#each next as tool (tool.id)}
      <a href={href(tool)} onclick={(e) => open(tool, e)}>
        <code class="m">{articleNo(tool)}</code>
        <b>{pick(tool.name)}</b>
        <ArrowRight aria-hidden="true" />
      </a>
    {/each}
  </nav>
{/if}

<style>
  .next {
    display: grid;
    min-width: 0;
  }

  a {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) 18px;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
    text-decoration: none;
  }

  code {
    color: var(--ink-2);
  }

  b {
    font-size: 15px;
    font-weight: 600;
  }

  a :global(svg) {
    width: 16px;
    height: 16px;
    color: var(--ink-2);
  }

  @media (hover: hover) and (pointer: fine) {
    a:hover b {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
</style>
