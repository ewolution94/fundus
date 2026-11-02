<!--
  The ground to choose, as swatches that show it (their colours are the picture's, not the page's).
  A radio group like Seg: the arrows move the choice; the chosen one is ringed in ink and marked
  with the highlighter under it.
-->
<script lang="ts">
  import { Pipette } from '@lucide/svelte';
  import type { GroundId, Paint } from './frame.ts';

  interface Option {
    id: GroundId;
    label: string;
    /** What it paints; null for none (shown see-through). */
    paint: Paint | null;
    /** Nothing to show yet (the picture's own edges before a picture). */
    empty?: boolean;
  }

  interface Props {
    label: string;
    options: Option[];
    value: GroundId;
    onchange: (id: GroundId) => void;
  }

  let { label, options, value, onchange }: Props = $props();
  let group: HTMLDivElement;

  const css = (p: Paint) => (p.from === p.to ? p.from : `linear-gradient(${p.vertical ? '180deg' : '135deg'}, ${p.from}, ${p.to})`);

  function key(e: KeyboardEvent) {
    const i = options.findIndex((o) => o.id === value);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onchange(options[next].id);
    queueMicrotask(() => group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }
</script>

<div class="grounds" role="radiogroup" aria-label={label} bind:this={group} onkeydown={key} tabindex="-1">
  {#each options as o (o.id)}
    <button type="button" role="radio" aria-checked={o.id === value} aria-label={o.label} title={o.label} tabindex={o.id === value ? 0 : -1} onclick={() => onchange(o.id)}>
      {#if o.empty}
        <span class="chip blank"><Pipette aria-hidden="true" /></span>
      {:else if o.paint}
        <span class="chip" style:background={css(o.paint)}></span>
      {:else}
        <span class="chip clear"></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .grounds {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    outline: none;
  }

  button {
    position: relative;
    display: grid;
    place-items: center;
    width: 40px;
    height: 44px;
    padding: 0 0 4px;
  }

  .chip {
    width: 32px;
    height: 32px;
    border: 1px solid var(--rule);
    border-radius: 2px;
  }

  [aria-checked='true'] .chip {
    border: 2px solid var(--ink);
  }

  /* The highlighter under the chosen one. */
  [aria-checked='true']::after {
    content: '';
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 0;
    height: 4px;
    background: var(--mark);
  }

  .blank {
    display: grid;
    place-items: center;
    background: var(--card);
    color: var(--ink-2);
  }

  .blank :global(svg) {
    width: 16px;
    height: 16px;
  }

  /* See-through: the usual checks. */
  .clear {
    background: repeating-conic-gradient(var(--sunk) 0 25%, var(--card) 0 50%) 0 0 / 10px 10px;
  }

  @media (hover: hover) and (pointer: fine) {
    [aria-checked='false']:hover .chip {
      border-color: var(--ink-2);
    }
  }
</style>
