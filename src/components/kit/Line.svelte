<!--
  One line of a receipt: what it is, a dotted leader, the value in mono, and Copy. `hl` puts the
  value under the highlighter (the answer), `total` sets the line heavier.
-->
<script lang="ts">
  import CopyButton from './CopyButton.svelte';

  interface Props {
    label: string;
    value: string;
    /** What Copy copies, when it isn't the shown value (a number without its grouping). */
    copy?: string | null;
    hl?: boolean;
    total?: boolean;
  }

  let { label, value, copy, hl = false, total = false }: Props = $props();
</script>

<!-- `answer`, not `hl`: the global .hl draws the highlighter across the whole box. -->
<div class="line" class:answer={hl} class:total>
  <span class="lab">{label}</span>
  <span class="lead" aria-hidden="true"></span>
  <span class="val">{value}</span>
  {#if copy !== null}<CopyButton text={copy ?? value} />{:else}<span></span>{/if}
</div>

<style>
  .line {
    display: grid;
    grid-template-columns: auto minmax(12px, 1fr) auto auto;
    gap: 10px;
    align-items: baseline;
    padding: 11px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .line:last-child {
    border-bottom: 0;
  }

  .lab {
    font-size: 15px;
    font-weight: 600;
    min-width: 0;
  }

  .lead {
    align-self: center;
    border-bottom: 1.5px dotted var(--ink-2);
    opacity: 0.6;
  }

  .val {
    font-family: var(--mono);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .answer .val {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 5px;
  }

  .total .lab {
    font-size: 17px;
    font-weight: 800;
  }

  .total .val {
    font-size: 17px;
    font-weight: 500;
  }
</style>
