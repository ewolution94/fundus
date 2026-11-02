<!--
  "Used by F-101, F-102" under a shared setting, each number naming its tool: on hover with a mouse,
  on focus from the keyboard, on a tap or a longer press on touch. The name floats in the top layer (a
  manual popover), so the sheet's scroll box never clips it. Past seven tools the rest wait behind
  "+n".
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { articleNo, type Tool } from '../../lib/catalog.ts';
  import { pick, t } from '../../lib/i18n.svelte.ts';

  let { tools }: { tools: Tool[] } = $props();

  const HOLD = 350;
  const LINGER = 2500;

  let all = $state(false);
  const shown = $derived(all || tools.length <= 7 ? tools : tools.slice(0, 6));

  let current = $state.raw<Tool | null>(null);
  let tip = $state<HTMLElement>();
  let anchor: HTMLElement | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  // A press long enough to show the name also ends in a click, which mustn't toggle it off again; a
  // mouse already showed it on hover.
  let held = false;
  let pointer = '';

  async function show(el: HTMLElement, tool: Tool, linger = false) {
    clearTimeout(hideTimer);
    anchor = el;
    current = tool;
    await tick();
    if (!tip) return;
    if (tip.showPopover && !tip.matches(':popover-open')) tip.showPopover();
    place();
    if (linger) hideTimer = setTimeout(hide, LINGER);
  }

  function hide() {
    clearTimeout(hideTimer);
    if (tip?.showPopover && tip.matches(':popover-open')) tip.hidePopover();
    current = null;
    anchor = null;
  }

  // Centred above the number, kept on screen; below it when there's no room above.
  function place() {
    if (!anchor || !tip) return;
    const a = anchor.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(Math.max(8, a.left + a.width / 2 - w / 2), innerWidth - w - 8);
    const top = a.top - h - 6 >= 8 ? a.top - h - 6 : a.bottom + 6;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function down(e: PointerEvent, tool: Tool) {
    pointer = e.pointerType;
    held = false;
    if (pointer === 'mouse') return;
    clearTimeout(holdTimer);
    const el = e.currentTarget as HTMLElement;
    holdTimer = setTimeout(() => {
      held = true;
      void show(el, tool);
    }, HOLD);
  }

  function up(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    clearTimeout(holdTimer);
    if (held) hideTimer = setTimeout(hide, LINGER);
  }

  function click(e: MouseEvent, tool: Tool) {
    if (pointer === 'mouse' && e.detail > 0) return;
    if (held) {
      held = false;
      return;
    }
    const el = e.currentTarget as HTMLElement;
    if (current === tool && anchor === el) hide();
    else void show(el, tool, true);
  }

  // While a name shows: a scroll, a press elsewhere or Escape puts it away.
  $effect(() => {
    if (!current) return;
    const away = (e: Event) => {
      if (!(e.target instanceof Element && e.target.closest('.ref'))) hide();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && current) {
        e.preventDefault();
        e.stopPropagation();
        hide();
      }
    };
    addEventListener('scroll', hide, { capture: true, passive: true });
    addEventListener('resize', hide);
    addEventListener('pointerdown', away, true);
    addEventListener('keydown', key, true);
    return () => {
      removeEventListener('scroll', hide, { capture: true });
      removeEventListener('resize', hide);
      removeEventListener('pointerdown', away, true);
      removeEventListener('keydown', key, true);
    };
  });

  $effect(() => () => {
    clearTimeout(holdTimer);
    clearTimeout(hideTimer);
  });
</script>

<p class="used m">
  <span>{t('settings.usedByLabel')}</span>
  {#each shown as tool (tool.id)}
    <button
      type="button"
      class="ref"
      class:on={current === tool}
      aria-label={`${articleNo(tool)}, ${pick(tool.name)}`}
      onpointerenter={(e) => e.pointerType === 'mouse' && show(e.currentTarget, tool)}
      onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
      onpointerdown={(e) => down(e, tool)}
      onpointerup={up}
      onpointercancel={up}
      onfocus={(e) => e.currentTarget.matches(':focus-visible') && show(e.currentTarget, tool)}
      onblur={hide}
      onclick={(e) => click(e, tool)}
      oncontextmenu={(e) => e.preventDefault()}>{articleNo(tool)}</button
    >
  {/each}
  {#if shown.length < tools.length}
    <button type="button" class="more" aria-label={t('settings.showAll', { n: tools.length })} onclick={() => (all = true)}>+{tools.length - shown.length}</button>
  {/if}
</p>

{#if current}
  <span class="tip" popover="manual" aria-hidden="true" bind:this={tip}>{pick(current.name)}</span>
{/if}

<style>
  .used {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 7px;
    row-gap: 2px;
    color: var(--ink-2);
    font-size: 10px;
  }

  .ref,
  .more {
    font: inherit;
    color: inherit;
    padding: 2px 0;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .ref {
    text-decoration: underline dotted;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
    cursor: help;
  }

  .ref:hover,
  .ref.on {
    color: var(--ink);
    text-decoration-style: solid;
    text-decoration-color: var(--ink);
  }

  .more {
    color: var(--ink);
    cursor: pointer;
  }

  .tip {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 5px 8px;
    border: 0;
    border-radius: 2px;
    background: var(--ink);
    color: var(--bg);
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
  }
</style>
