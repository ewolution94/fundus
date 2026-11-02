<!--
  One line of CSS to copy: what it is and Copy on top, the code under it in mono, wrapping (and
  scrolling inside its box when it's long, like a spring's linear()), never widening the page.
  `hl` puts the code under the highlighter: the answer.
-->
<script lang="ts">
  import CopyButton from '../../components/kit/CopyButton.svelte';

  interface Props {
    label: string;
    value: string;
    hl?: boolean;
  }

  let { label, value, hl = false }: Props = $props();
</script>

<div class="out-row" class:answer={hl}>
  <div class="top">
    <span class="lab">{label}</span>
    <CopyButton text={value} />
  </div>
  <div class="val"><code>{value}</code></div>
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

  /* Six lines at most, cut between lines; a longer one (a spring's linear()) scrolls inside. */
  .val {
    font-size: 13px;
    line-height: 1.6;
    max-height: calc(6 * 1.6em);
    overflow: auto;
    min-width: 0;
  }

  code {
    font-family: var(--mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .answer .lab {
    font-weight: 800;
  }

  .answer code {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 4px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
</style>
