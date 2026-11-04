<!--
  The way back to all the tools, at the start of a page's crumbs (Esc on a computer does the same). On
  a phone, once it has scrolled under the header, a button at the bottom left takes over, in the
  thumb's reach; it steps aside while a text field has the keyboard (the user's pick, 2026-11-04).
-->
<script lang="ts">
  import { ArrowLeft } from '@lucide/svelte';
  import { t } from '../lib/i18n.svelte.ts';
  import { home } from '../lib/router.svelte.ts';

  let crumb = $state<HTMLElement>();
  let gone = $state(false);
  let typing = $state(false);

  // Out of sight means under the sticky header, not just above the screen's edge.
  $effect(() => {
    if (!crumb) return;
    const bar = document.querySelector('header.top')?.getBoundingClientRect().height ?? 0;
    const io = new IntersectionObserver(([e]) => (gone = !e.isIntersecting && e.boundingClientRect.top < bar), {
      rootMargin: `-${Math.round(bar)}px 0px 0px 0px`,
    });
    io.observe(crumb);
    return () => io.disconnect();
  });

  const TEXT = 'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="color"])';
  // Read once focus has settled: a page leaving drops focus while it's being taken down.
  $effect(() => {
    const read = () => queueMicrotask(() => (typing = !!document.activeElement?.matches(TEXT)));
    addEventListener('focusin', read);
    addEventListener('focusout', read);
    return () => {
      removeEventListener('focusin', read);
      removeEventListener('focusout', read);
    };
  });

  // A plain click goes back in the page; a modified one opens the home in a tab, as a link does.
  function back(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    home();
  }
</script>

<a class="back" href="/" onclick={back} bind:this={crumb}>
  <ArrowLeft aria-hidden="true" />
  <span>{t('nav.back')}</span>
  <kbd>Esc</kbd>
</a>
<a class="thumb" class:shown={gone && !typing} href="/" onclick={back} aria-label={t('nav.back')}>
  <ArrowLeft aria-hidden="true" />
</a>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px 0 8px;
    margin-right: 4px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
    color: var(--ink);
    text-decoration: none;
  }

  .back :global(svg) {
    width: 15px;
    height: 15px;
    stroke-width: 2.4;
  }

  .back kbd {
    display: none;
    margin-left: 2px;
    font-family: var(--mono);
    font-size: 9px;
    border: 1px solid var(--rule);
    padding: 0 4px;
    color: var(--ink-2);
  }

  /* Under the header's line, above the page; a tool's own stage (z-index 100) covers it. */
  .thumb {
    position: fixed;
    z-index: 9;
    left: max(var(--gutter), env(safe-area-inset-left, 0px));
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 2px;
    background: var(--ink);
    color: var(--bg);
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.22);
    visibility: hidden;
    opacity: 0;
    translate: 0 8px;
    transition:
      opacity 0.16s,
      translate 0.16s,
      visibility 0s 0.16s;
  }

  .thumb.shown {
    visibility: visible;
    opacity: 1;
    translate: 0 0;
    transition:
      opacity 0.16s,
      translate 0.16s;
  }

  .thumb:active {
    background: var(--ink-2);
  }

  .thumb :global(svg) {
    width: 22px;
    height: 22px;
    stroke-width: 2.4;
  }

  @media (min-width: 760px) {
    .back kbd {
      display: inline;
    }

    .thumb {
      display: none;
    }
  }
</style>
