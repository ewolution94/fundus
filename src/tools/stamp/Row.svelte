<!--
  One result line: what it is, the value in mono, Copy. Like the kit's Line, but a long value
  (a date with its zone, RFC 2822) wraps, and below 440 px of room it goes under its label.
  `hl` puts the value under the highlighter (the answer).
-->
<script lang="ts">
  import CopyButton from '../../components/kit/CopyButton.svelte';

  interface Props {
    label: string;
    value: string;
    /** What Copy copies, when it isn't the value shown. */
    copy?: string;
    hl?: boolean;
  }

  let { label, value, copy, hl = false }: Props = $props();
</script>

<div class="row" class:answer={hl}>
  <span class="lab">{label}</span>
  <span class="val">{value}</span>
  <CopyButton text={copy ?? value} />
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

  .answer .val {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 5px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
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
