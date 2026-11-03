<!--
  One shelf of the wall, the home's other view (plans/fundus.md, the wall's round 2: the user picked
  the drawer fronts). Each tool a drawer: its number in the label holder, its icon, its name. Pointing
  at a drawer, focusing it or pressing it plays its icon once; on a phone each drawer also plays the
  first time it's fully in view. Nothing loops, and under reduced motion nothing moves.
-->
<script lang="ts">
  import './drawers.css';
  import { articleNo, href, type Tool } from '../lib/catalog.ts';
  import { pick } from '../lib/i18n.svelte.ts';
  import { nav } from '../lib/router.svelte.ts';

  interface Props {
    tools: Tool[];
  }

  let { tools }: Props = $props();

  const ICONS = Object.fromEntries(
    Object.entries(import.meta.glob<string>('../tools/*/drawer.svg', { query: '?raw', import: 'default', eager: true })).map(([file, svg]) => [file.split('/').at(-2), svg]),
  );
  // These rest on their other side after a play (the next digit, the pages swapped) and go back on the next.
  const SWAP = new Set(['clock', 'csvjson', 'yaml']);

  // Empty drawers close the shelf's last row: one more for each column count that needs it.
  const blanks = $derived.by(() => {
    const need = (cols: number) => (cols - (tools.length % cols)) % cols;
    const most = Math.max(need(3), need(4), need(6));
    return Array.from({ length: most }, (_, i) => [3, 4, 6].filter((cols) => i < need(cols)).map((cols) => `c${cols}`).join(' '));
  });

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const running = (el: Element) => el.getAnimations({ subtree: true }).some((a) => a instanceof CSSAnimation && a.playState === 'running');

  /** Plays a drawer's icon once; a play already under way runs to its end. */
  function play(el: HTMLElement, wait = 0) {
    if (still() || el.classList.contains('play')) return;
    el.style.setProperty('--wait', `${wait}ms`);
    el.classList.add('play');
  }

  function settle(el: HTMLElement, id: string) {
    if (!el.classList.contains('play') || running(el)) return;
    if (SWAP.has(id)) el.classList.toggle('alt');
    el.classList.remove('play');
  }

  function drawer(el: HTMLElement, id: string) {
    const enter = (e: PointerEvent) => e.pointerType === 'mouse' && play(el);
    const focus = () => el.matches(':focus-visible') && play(el);
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      el.classList.add('down');
      play(el);
    };
    const up = () => el.classList.remove('down');
    const end = () => settle(el, id);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('focus', focus);
    el.addEventListener('pointerdown', down);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(type, up);
    el.addEventListener('animationend', end);
    el.addEventListener('animationcancel', end);
    return {
      destroy() {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('focus', focus);
        el.removeEventListener('pointerdown', down);
        for (const type of ['pointerup', 'pointercancel', 'pointerleave']) el.removeEventListener(type, up);
        el.removeEventListener('animationend', end);
        el.removeEventListener('animationcancel', end);
      },
    };
  }

  let shelf: HTMLDivElement;

  // On a phone (no fine pointer, or three columns), each drawer plays once the first time it's fully in view.
  $effect(() => {
    void tools;
    const touch = !matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!(touch || shelf.clientWidth < 600) || !('IntersectionObserver' in window)) return;
    const els = [...shelf.querySelectorAll<HTMLElement>('[data-drawer]')];
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting && e.intersectionRatio >= 0.99).map((e) => e.target as HTMLElement);
        shown.sort((a, b) => els.indexOf(a) - els.indexOf(b));
        shown.forEach((el, n) => {
          io.unobserve(el);
          play(el, n * 110);
        });
      },
      { threshold: 1 },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  });
</script>

<div class="drawers">
  <div class="dw" bind:this={shelf}>
    {#each tools as tool (tool.id)}
      <a class="t" href={href(tool)} onclick={nav} data-drawer={tool.id} use:drawer={tool.id}>
        <span class="lab"><span>{articleNo(tool)}</span></span>
        {@html ICONS[tool.id] ?? ''}
        <span class="nm">{pick(tool.name)}</span>
      </a>
    {/each}
    {#each blanks as b, i (i)}
      <span class="t blank {b}" aria-hidden="true"></span>
    {/each}
  </div>
</div>
