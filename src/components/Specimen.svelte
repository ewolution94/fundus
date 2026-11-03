<!--
  A tool's specimen plate: the figure in its head (plans/fundus.md, the wall's round 2, sketch D). It
  draws itself on once when the tool opens, and again on a hover or a press; nothing moves while the
  tool is used. Each tool's drawing is its own small file (src/tools/<id>/plate.ts), loaded with it.
  Decorative: the name and the description beside it say what it shows.
-->
<script lang="ts">
  import './specimen.css';
  import { chipOf, type Tool } from '../lib/catalog.ts';
  import { locale, pick, t } from '../lib/i18n.svelte.ts';
  import type { Figure } from '../lib/plate.ts';

  const FIGURES = import.meta.glob<Figure>('../tools/*/plate.ts', { import: 'default' });

  interface Props {
    tool: Tool;
  }

  let { tool }: Props = $props();

  let figure = $state.raw<Figure | null>(null);
  // The card holds the plate's place while its file comes, so the tool doesn't jump; gone if it can't.
  let failed = $state(false);
  let held = $state(false);
  let fig = $state<HTMLSpanElement>();
  let timer = 0;
  let release = 0;

  const svg = $derived(figure ? figure(locale()) : '');

  /** Draws it on from the start, even when a draw is under way. */
  function draw() {
    const el = fig;
    if (!el) return;
    clearTimeout(timer);
    el.classList.remove('drawing');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void el.getBoundingClientRect();
    el.classList.add('drawing');
    timer = window.setTimeout(() => el.classList.remove('drawing'), 2000);
  }

  $effect(() => {
    const load = FIGURES[`../tools/${tool.id}/plate.ts`];
    let live = true;
    figure = null;
    failed = false;
    load?.()
      .then((f) => {
        if (!live) return;
        // The class goes on before the drawing is in, so it never shows drawn first.
        draw();
        figure = f;
      })
      .catch(() => {
        if (live) failed = true;
      });
    return () => {
      live = false;
      clearTimeout(timer);
      clearTimeout(release);
    };
  });

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    clearTimeout(release);
    held = true;
    draw();
  }

  function up() {
    clearTimeout(release);
    release = window.setTimeout(() => (held = false), 260);
  }
</script>

{#if FIGURES[`../tools/${tool.id}/plate.ts`] && !failed}
  <figure
    class="specimen"
    class:held
    aria-hidden="true"
    onpointerenter={(e) => e.pointerType === 'mouse' && figure && draw()}
    onpointerdown={down}
    onpointerup={up}
    onpointercancel={up}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <span class="fig" bind:this={fig}><svg viewBox="0 0 160 120" focusable="false">{@html svg}</svg></span>
    <figcaption class="cap"><span class="no">{t('tool.fig', { no: tool.no })}</span><span class="sh">{pick(chipOf(tool).name)}</span></figcaption>
  </figure>
{/if}
