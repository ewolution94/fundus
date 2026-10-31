<!--
  A tool's head on its spec sheet: the crumbs (F-102 · Photo · Shrink a photo), the name big, what it
  does, and the pin. A result handed on from another tool says where it came from.
-->
<script lang="ts">
  import { Pin, PinOff } from '@lucide/svelte';
  import { articleNo, chipOf, toolById, type Tool } from '../lib/catalog.ts';
  import { pick, t } from '../lib/i18n.svelte.ts';
  import { yours } from '../lib/memory.svelte.ts';
  import { nav } from '../lib/router.svelte.ts';

  interface Props {
    tool: Tool;
    /** The tool the input came from (chaining). */
    from?: string | null;
  }

  let { tool, from = null }: Props = $props();
  const pinned = $derived(yours.isPinned(tool.id));
  const source = $derived(from ? toolById(from) : null);
</script>

<header class="head">
  <nav class="crumbs m" aria-label="Breadcrumbs">
    <a href="/" onclick={nav}>Fundus</a>
    <span aria-hidden="true">/</span>
    <span>{pick(chipOf(tool).name)}</span>
    <span aria-hidden="true">/</span>
    <span class="cur">{articleNo(tool)}</span>
  </nav>
  <h1>{pick(tool.name)}</h1>
  <div class="sub">
    <p>{pick(tool.desc)}</p>
    <button type="button" class="pin" aria-pressed={pinned} onclick={() => yours.togglePin(tool.id)}>
      {#if pinned}<PinOff aria-hidden="true" />{:else}<Pin aria-hidden="true" />{/if}
      {pinned ? t('tool.pinned') : t('tool.pin')}
    </button>
  </div>
  {#if source}<p class="from m">{t('tool.from', { tool: `${articleNo(source)} ${pick(source.name)}` })}</p>{/if}
</header>

<style>
  .head {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .crumbs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 10px;
    color: var(--ink-2);
    text-transform: uppercase;
  }

  .crumbs a {
    text-decoration: none;
  }

  .crumbs .cur {
    color: var(--ink);
  }

  h1 {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    overflow-wrap: anywhere;
  }

  .sub {
    display: flex;
    align-items: baseline;
    gap: 12px;
    justify-content: space-between;
  }

  .sub p {
    color: var(--ink-2);
    font-size: 15px;
  }

  .pin {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-2);
    padding: 4px 0;
  }

  .pin[aria-pressed='true'] {
    color: var(--ink);
  }

  .pin :global(svg) {
    width: 14px;
    height: 14px;
  }

  .from {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink);
  }

  .from::before {
    content: '→ ';
  }

  @media (min-width: 760px) {
    h1 {
      font-size: 54px;
    }
  }
</style>
