<!--
  Where files go in: a dashed well to tap (the picker) or drop onto. While it's on screen, a paste
  of files anywhere in the page lands here too (not while typing in a field).
-->
<script lang="ts">
  import { Upload } from '@lucide/svelte';
  import { t } from '../../lib/i18n.svelte.ts';

  interface Props {
    /** The picker's `accept`, e.g. "image/*,.heic,.heif". */
    accept: string;
    multiple?: boolean;
    /** The well's bold line; the home's by default. */
    title?: string;
    /** Its second line. */
    hint?: string;
    /** A slimmer well, for "add more" under a list. */
    compact?: boolean;
    onfiles: (files: File[]) => void;
  }

  let { accept, multiple = false, title, hint, compact = false, onfiles }: Props = $props();

  let input: HTMLInputElement;
  let over = $state(false);

  function picked() {
    const list = [...(input.files ?? [])];
    input.value = '';
    if (list.length) onfiles(multiple ? list : list.slice(0, 1));
  }

  function dropped(e: DragEvent) {
    e.preventDefault();
    over = false;
    const list = [...(e.dataTransfer?.files ?? [])];
    if (list.length) onfiles(multiple ? list : list.slice(0, 1));
  }

  $effect(() => {
    const paste = (e: ClipboardEvent) => {
      // On the page itself (the target can be the document, which has no closest()), not in a field.
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return;
      const list = [...(e.clipboardData?.files ?? [])];
      if (!list.length) return;
      e.preventDefault();
      onfiles(multiple ? list : list.slice(0, 1));
    };
    addEventListener('paste', paste);
    return () => removeEventListener('paste', paste);
  });
</script>

<button
  type="button"
  class="well"
  class:over
  class:compact
  onclick={() => input.click()}
  ondragover={(e) => {
    e.preventDefault();
    over = true;
  }}
  ondragleave={() => (over = false)}
  ondrop={dropped}
>
  <Upload aria-hidden="true" />
  <span>
    <b>{title ?? t('home.well')}</b>
    {#if !compact}<small>{hint ?? t('home.wellSmall', { choose: t('home.choose') })}</small>{/if}
  </span>
</button>
<input bind:this={input} class="sr" type="file" {accept} {multiple} tabindex="-1" aria-hidden="true" onchange={picked} />

<style>
  .well {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1.5px dashed var(--ink);
    border-radius: 2px;
    background: var(--card);
    text-align: left;
  }

  .well.compact {
    padding: 10px 12px;
  }

  .well.over {
    background: var(--mark);
    color: var(--mark-ink);
    border-style: solid;
  }

  .well :global(svg) {
    width: 24px;
    height: 24px;
    stroke-width: 1.5;
    flex: none;
  }

  b {
    display: block;
    font-size: 15px;
    font-weight: 700;
  }

  small {
    display: block;
    font-size: 13px;
    color: var(--ink-2);
  }

  .over small {
    color: inherit;
  }

  @media (min-width: 760px) {
    .well:not(.compact) {
      padding: 22px 18px;
    }
  }
</style>
