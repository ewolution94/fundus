<!-- A receipt: a box of Lines under a mono heading (left) and a note (right). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    aside?: string;
    children: Snippet;
  }

  let { title, aside = '', children }: Props = $props();
</script>

<section class="receipt" aria-label={title}>
  <h3><span>{title}</span><span>{aside}</span></h3>
  {@render children()}
</section>

<style>
  .receipt {
    display: grid;
    align-content: start;
    padding: 4px 14px 8px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    min-width: 0;
  }

  h3 {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--rule);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ink-2);
  }
</style>
