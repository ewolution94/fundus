<!--
  A tool's head on its spec sheet: the crumbs (the way back, the tool's shelf, F-102), the name big,
  what it does, the pin, and the tool's specimen plate beside them (at the right on a computer, beside
  the line under the name on a phone). A result handed on from another tool says where it came from.
-->
<script lang="ts">
  import { Pin, PinOff } from '@lucide/svelte';
  import { articleNo, chipOf, toolById, type Tool } from '../lib/catalog.ts';
  import { pick, t } from '../lib/i18n.svelte.ts';
  import { yours } from '../lib/memory.svelte.ts';
  import { ui } from '../lib/prefs.svelte.ts';
  import { go } from '../lib/router.svelte.ts';
  import Specimen from './Specimen.svelte';
  import WayBack from './WayBack.svelte';

  interface Props {
    tool: Tool;
    /** The tool the input came from (chaining). */
    from?: string | null;
  }

  let { tool, from = null }: Props = $props();
  const pinned = $derived(yours.isPinned(tool.id));
  const source = $derived(from ? toolById(from) : null);

  // The shelf opens the home on its chip; a modified click opens the whole home in a tab.
  function shelf(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ui.chip = tool.chip;
    go('/');
  }
</script>

<header class="head">
  <nav class="crumbs m" aria-label="Breadcrumbs">
    <WayBack />
    <a class="shelf" href="/" onclick={shelf}>{pick(chipOf(tool).name)}</a>
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
  <div class="plate-at">
    {#key tool.id}<Specimen {tool} />{/key}
  </div>
</header>

<style>
  /* On a phone the plate sits beside the line under the name, which stacks the pin under it. */
  .head {
    display: grid;
    grid-template-columns: 152px minmax(0, 1fr);
    grid-template-areas: 'crumbs crumbs' 'title title' 'plate sub' 'plate from';
    grid-template-rows: auto auto auto 1fr;
    column-gap: 14px;
    row-gap: 6px;
    min-width: 0;
  }

  .crumbs {
    grid-area: crumbs;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 10px;
    color: var(--ink-2);
    text-transform: uppercase;
  }

  .shelf {
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 2px;
  }

  .crumbs .cur {
    color: var(--ink);
  }

  h1 {
    grid-area: title;
    margin-bottom: 4px;
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    overflow-wrap: anywhere;
  }

  .sub {
    grid-area: sub;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-top: 2px;
  }

  .plate-at {
    grid-area: plate;
    align-self: start;
  }

  .plate-at :global(.specimen) {
    width: 152px;
    --ow: 1.6;
    --cw: 0.75;
    --af: 9.6px;
    --kf: 10.2px;
  }

  .plate-at :global(.specimen .cap) {
    padding: 4px 7px 5px;
  }

  .plate-at :global(.specimen .sh) {
    display: none;
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
    grid-area: from;
    align-self: start;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink);
  }

  .from::before {
    content: '→ ';
  }

  /* On a computer it stands at the right of the name and what the tool does. */
  @media (min-width: 760px) {
    .head {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'crumbs plate' 'title plate' 'sub plate' 'from plate';
      grid-template-rows: auto auto auto 1fr;
      column-gap: 32px;
    }

    h1 {
      margin-bottom: 0;
      font-size: 54px;
    }

    .sub {
      flex-direction: row;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding-top: 0;
    }

    .plate-at :global(.specimen) {
      width: 208px;
      --ow: 1.3;
      --cw: 0.6;
      --af: 7.6px;
      --kf: 8.2px;
    }

    .plate-at :global(.specimen .cap) {
      padding: 6px 10px 7px;
    }

    .plate-at :global(.specimen .sh) {
      display: block;
    }
  }
</style>
