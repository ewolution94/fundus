<!--
  The crop frame on the photo: drag it to move it, drag a corner or a side to resize it (mouse and
  finger alike, through pointer events with the pointer captured), or focus it and use the arrow keys
  (Shift for bigger steps, + and − for its size). Every move is worked out from where the drag began
  (resize.ts), so it never drifts, and it never leaves the photo. Outside the frame the photo fades to
  paper. `onchange` follows every move; `oncommit` comes once a drag or a run of keys ends.
-->
<script lang="ts">
  import { words } from '../../lib/i18n.svelte.ts';
  import { HANDLES, moveRect, resizeRect, type Handle, type Rect } from './resize.ts';

  interface Props {
    src: string;
    /** The photo's own size: the frame is in its pixels. */
    width: number;
    height: number;
    rect: Rect;
    ratio: number | null;
    onchange: (rect: Rect) => void;
    oncommit: () => void;
  }

  let { src, width, height, rect, ratio, onchange, oncommit }: Props = $props();

  const w = words({
    en: {
      frame: 'Crop frame',
      keys: 'Drag it or use the arrow keys to move it; drag a corner, or press + and −, to change its size.',
      handle: 'Resize from the {side}',
      nw: 'top left',
      n: 'top',
      ne: 'top right',
      e: 'right',
      se: 'bottom right',
      s: 'bottom',
      sw: 'bottom left',
      w: 'left',
    },
    de: {
      frame: 'Zuschnitt-Rahmen',
      keys: 'Ziehen oder mit den Pfeiltasten verschieben; an einer Ecke ziehen oder + und − drücken, um die Größe zu ändern.',
      handle: 'Größe ändern: {side}',
      nw: 'oben links',
      n: 'oben',
      ne: 'oben rechts',
      e: 'rechts',
      se: 'unten rechts',
      s: 'unten',
      sw: 'unten links',
      w: 'links',
    },
  });

  let stage: HTMLDivElement;
  let drag: { kind: 'move' | Handle; start: Rect; x: number; y: number; scale: number; id: number } | null = null;
  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  /** Photo pixels per screen pixel. */
  const scale = () => width / stage.getBoundingClientRect().width;
  /** Nothing smaller than a thumb's width on screen. */
  const minSide = (s: number) => Math.min(40 * s, width, height);

  function down(e: PointerEvent, kind: 'move' | Handle) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    drag = { kind, start: { ...rect }, x: e.clientX, y: e.clientY, scale: scale(), id: e.pointerId };
    (el.closest('.crop') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = (e.clientX - drag.x) * drag.scale;
    const dy = (e.clientY - drag.y) * drag.scale;
    onchange(drag.kind === 'move' ? moveRect(drag.start, dx, dy, width, height) : resizeRect(drag.start, drag.kind, dx, dy, width, height, ratio, minSide(drag.scale)));
  }

  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // The pointer is gone already (a cancelled touch): nothing to release.
    }
    oncommit();
  }

  function key(e: KeyboardEvent) {
    const step = (e.shiftKey ? 0.1 : 0.01) * Math.max(width, height);
    let next: Rect | null = null;
    if (e.key === 'ArrowLeft') next = moveRect(rect, -step, 0, width, height);
    else if (e.key === 'ArrowRight') next = moveRect(rect, step, 0, width, height);
    else if (e.key === 'ArrowUp') next = moveRect(rect, 0, -step, width, height);
    else if (e.key === 'ArrowDown') next = moveRect(rect, 0, step, width, height);
    else if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '−') {
      // Grow or shrink about the middle: pull the bottom-right corner, then centre again.
      const d = (e.key === '-' || e.key === '−' ? -1 : 1) * 0.05 * rect.w;
      const r = resizeRect(rect, 'se', d, ratio ? d / ratio : (d * rect.h) / rect.w, width, height, ratio, minSide(scale()));
      next = moveRect(r, (rect.w - r.w) / 2, (rect.h - r.h) / 2, width, height);
    } else return;
    e.preventDefault();
    onchange(next);
    clearTimeout(commitTimer);
    commitTimer = setTimeout(oncommit, 250);
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
</script>

<!-- The stage only follows a pointer captured by the frame or a handle; the keys live on the frame. -->
<div class="stage" role="presentation" bind:this={stage} style:--ratio={width / height} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <img {src} alt="" draggable="false" />
  <!-- Outside the frame the photo fades to paper: four bands around it. -->
  <span class="fade" style:left="0" style:top="0" style:width="100%" style:height={pct(rect.y, height)}></span>
  <span class="fade" style:left="0" style:top={pct(rect.y + rect.h, height)} style:width="100%" style:bottom="0"></span>
  <span class="fade" style:left="0" style:top={pct(rect.y, height)} style:width={pct(rect.x, width)} style:height={pct(rect.h, height)}></span>
  <span class="fade" style:left={pct(rect.x + rect.w, width)} style:top={pct(rect.y, height)} style:right="0" style:height={pct(rect.h, height)}></span>
  <!-- A focusable group: the arrow keys move it (a slider or a button would say the wrong thing). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="crop"
    role="group"
    tabindex="0"
    aria-label={w('frame')}
    aria-describedby="crop-keys"
    style:left={pct(rect.x, width)}
    style:top={pct(rect.y, height)}
    style:width={pct(rect.w, width)}
    style:height={pct(rect.h, height)}
    onpointerdown={(e) => down(e, 'move')}
    onkeydown={key}
  >
    <span id="crop-keys" class="sr">{w('keys')}</span>
    {#each HANDLES as h (h)}
      <span class="handle {h}" aria-hidden="true" title={w('handle', { side: w(h) })} onpointerdown={(e) => down(e, h)}></span>
    {/each}
  </div>
</div>

<style>
  .stage {
    position: relative;
    width: min(100%, calc(min(62vh, 620px) * var(--ratio)));
    aspect-ratio: var(--ratio);
    margin-inline: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  img {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .fade {
    position: absolute;
    background: color-mix(in srgb, var(--bg) 62%, transparent);
    pointer-events: none;
  }

  .crop {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid var(--mark);
    cursor: move;
    touch-action: none;
  }

  .crop:focus-visible {
    border-color: var(--ink);
  }

  .handle {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    touch-action: none;
  }

  /* What shows: a small highlighter square at each corner, a bar on each side. */
  .handle::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 14px;
    height: 14px;
    translate: -50% -50%;
    background: var(--mark);
    border: 1.5px solid var(--mark-ink);
  }

  .handle.n::after,
  .handle.s::after {
    width: 22px;
    height: 8px;
  }

  .handle.e::after,
  .handle.w::after {
    width: 8px;
    height: 22px;
  }

  .nw {
    left: 0;
    top: 0;
    cursor: nwse-resize;
  }
  .n {
    left: 50%;
    top: 0;
    cursor: ns-resize;
  }
  .ne {
    left: 100%;
    top: 0;
    cursor: nesw-resize;
  }
  .e {
    left: 100%;
    top: 50%;
    cursor: ew-resize;
  }
  .se {
    left: 100%;
    top: 100%;
    cursor: nwse-resize;
  }
  .s {
    left: 50%;
    top: 100%;
    cursor: ns-resize;
  }
  .sw {
    left: 0;
    top: 100%;
    cursor: nesw-resize;
  }
  .w {
    left: 0;
    top: 50%;
    cursor: ew-resize;
  }
</style>
