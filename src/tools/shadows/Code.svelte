<!--
  A declaration to copy: what it is and Copy on top, the code under it in mono, one layer a line.
  A line too long for the box wraps with a hanging indent, so each layer still starts on its own
  line; nothing widens the page. `hl` puts the code under the highlighter: the answer.
-->
<script lang="ts">
  import CopyButton from '../../components/kit/CopyButton.svelte';

  interface Props {
    label: string;
    value: string;
    hl?: boolean;
  }

  let { label, value, hl = false }: Props = $props();
  /** Each line split into its indent and the rest: only the rest goes under the highlighter. */
  const lines = $derived(value.split('\n').map((l) => ({ lead: l.match(/^\s*/)![0], rest: l.trimStart() })));
</script>

<div class="out-row" class:answer={hl}>
  <div class="top">
    <span class="lab">{label}</span>
    <CopyButton text={value} />
  </div>
  <code class="val">{#each lines as line, i (i)}<span class="ln" class:in={line.lead !== ''}><span class="ind">{line.lead}</span><span class="tx">{line.rest}</span></span>{/each}</code>
</div>

<style>
  .out-row {
    display: grid;
    gap: 6px;
    padding: 10px 0 12px;
    border-bottom: 1px dashed var(--rule);
    min-width: 0;
  }

  .out-row:last-child {
    border-bottom: 0;
  }

  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .lab {
    font-size: 14px;
    font-weight: 600;
    min-width: 0;
  }

  .val {
    display: block;
    min-width: 0;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
  }

  /* An indented line (a layer) starts 2 characters in; where it wraps, it goes on 4 in. */
  .ln {
    display: block;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .ln.in {
    padding-left: 4ch;
    text-indent: -4ch;
  }

  .answer .lab {
    font-weight: 800;
  }

  .answer .tx {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 3px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
</style>
