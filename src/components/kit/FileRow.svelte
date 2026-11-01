<!-- One file in a tool: its picture (when there is one), its name, a line about it, and Remove. -->
<script lang="ts">
  import { X, FileText } from '@lucide/svelte';
  import { t } from '../../lib/i18n.svelte.ts';
  import type { Component, Snippet } from 'svelte';

  interface Props {
    name: string;
    /** "3.8 MB · 4032 × 3024 · HEIC" */
    meta?: string;
    /** An object URL of a small picture of it. */
    thumb?: string | null;
    /** The figure when there's no picture: a document unless the tool says otherwise (a sound). */
    icon?: Component<{ 'aria-hidden'?: 'true' }>;
    onremove?: () => void;
    /** Extra controls at the end (rotate, move). */
    actions?: Snippet;
  }

  let { name, meta = '', thumb = null, icon: Icon = FileText, onremove, actions }: Props = $props();
</script>

<div class="file">
  <div class="thumb">
    {#if thumb}<img src={thumb} alt="" />{:else}<Icon aria-hidden="true" />{/if}
  </div>
  <div class="text">
    <b>{name}</b>
    {#if meta}<small>{meta}</small>{/if}
  </div>
  <div class="acts">
    {@render actions?.()}
    {#if onremove}
      <button type="button" class="x" onclick={onremove} aria-label={`${t('tool.remove')}: ${name}`} title={t('tool.remove')}><X aria-hidden="true" /></button>
    {/if}
  </div>
</div>

<style>
  .file {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 8px 10px;
    border: 1.5px solid var(--ink);
    background: var(--card);
  }

  .thumb {
    width: 56px;
    height: 42px;
    display: grid;
    place-items: center;
    background: var(--sunk);
    border: 1px solid var(--rule);
    overflow: hidden;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb :global(svg) {
    width: 20px;
    height: 20px;
    stroke-width: 1.5;
  }

  b {
    display: block;
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    display: block;
    font-size: 12px;
    color: var(--ink-2);
    font-family: var(--mono);
  }

  .acts {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .acts :global(button) {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
  }

  .acts :global(svg) {
    width: 18px;
    height: 18px;
  }
</style>
