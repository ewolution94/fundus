<!-- A square ink check box with its words beside it: on/off, as a switch reads it. -->
<script lang="ts">
  import { Check } from '@lucide/svelte';

  interface Props {
    checked: boolean;
    label: string;
    hint?: string;
    onchange: (checked: boolean) => void;
    disabled?: boolean;
  }

  let { checked, label, hint, onchange, disabled = false }: Props = $props();
</script>

<button type="button" class="check" role="switch" aria-checked={checked} {disabled} onclick={() => onchange(!checked)}>
  <span class="box"><Check aria-hidden="true" /></span>
  <span class="words">
    <b>{label}</b>
    {#if hint}<small>{hint}</small>{/if}
  </span>
</button>

<style>
  .check {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    text-align: left;
    padding: 2px 0;
  }

  .box {
    flex: none;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border: 1.5px solid var(--ink);
    display: grid;
    place-items: center;
  }

  .box :global(svg) {
    width: 14px;
    height: 14px;
    stroke-width: 2.6;
    opacity: 0;
  }

  .check[aria-checked='true'] .box {
    background: var(--ink);
    color: var(--bg);
  }

  .check[aria-checked='true'] .box :global(svg) {
    opacity: 1;
  }

  b {
    display: block;
    font-size: 15px;
    font-weight: 600;
  }

  small {
    display: block;
    font-size: 12px;
    color: var(--ink-2);
  }
</style>
