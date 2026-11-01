<!--
  One result line: what it is, the value in mono (it wraps at its groups), Copy; `sub` a line of
  notes under the value. Below 440 px of room the value goes under its label. `hl` puts the value
  under the highlighter (the answer).
-->
<script lang="ts">
  import CopyButton from '../../components/kit/CopyButton.svelte';

  interface Props {
    label: string;
    value: string;
    /** What Copy copies, when it isn't the value shown; null for no Copy. */
    copy?: string | null;
    sub?: string;
    hl?: boolean;
    /** The value as a note (a value that isn't one, like "doesn't fit"). */
    quiet?: boolean;
  }

  let { label, value, copy, sub = '', hl = false, quiet = false }: Props = $props();
</script>

<div class="row" class:answer={hl}>
  <span class="lab">{label}</span>
  <span class="val" class:quiet>{value}{#if sub}<small>{sub}</small>{/if}</span>
  {#if copy !== null}<CopyButton text={copy ?? value} />{:else}<span></span>{/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 7.2rem minmax(0, 1fr) auto;
    gap: 4px 12px;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .row:last-child {
    border-bottom: 0;
  }

  .lab {
    font-size: 14px;
    font-weight: 600;
  }

  .val {
    justify-self: start;
    font-family: var(--mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  /* Words, not figures: tabular figures would space out their punctuation. */
  .val.quiet {
    font-family: var(--sans);
    font-size: 13px;
    font-variant-numeric: normal;
    color: var(--ink-2);
  }

  small {
    display: block;
    margin-top: 2px;
    font-family: var(--sans);
    font-size: 12px;
    font-variant-numeric: normal;
    color: var(--ink-2);
  }

  .answer .val {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 5px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  .answer small {
    color: var(--mark-ink);
  }

  @container (max-width: 440px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .val {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
