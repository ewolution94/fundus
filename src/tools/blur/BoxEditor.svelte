<!--
  The photo with its boxes: drag on the photo to draw a box, drag a box to move it, drag a corner of
  the chosen one to resize it (mouse and finger alike, pointer events with the pointer captured;
  every move worked out from where the drag began, so nothing drifts). A box is focusable: arrow keys
  move it (Shift for bigger steps), Delete removes it. The canvas shows the boxes as they'll be saved:
  pixelated or blacked out.
-->
<script lang="ts">
  import { words } from '../../lib/i18n.svelte.ts';
  import { pixelate, region, fromCorners, moveBox, resizeBox, type Box, type Corner, type Region } from './blur.ts';

  interface Props {
    /** The photo, drawn small enough to work on smoothly. */
    base: ImageBitmap;
    /** The photo's own size: the boxes are in its pixels. */
    width: number;
    height: number;
    boxes: Box[];
    chosen: number | null;
    /** A block's side in the photo's pixels. */
    block: number;
    /** A new box drawn, as a region; the tool gives it its id and style. */
    ondraw: (r: Region) => number;
    onchange: (boxes: Box[]) => void;
    onchoose: (id: number | null) => void;
    onremove: (id: number) => void;
    oncommit: () => void;
  }

  let { base, width, height, boxes, chosen, block, ondraw, onchange, onchoose, onremove, oncommit }: Props = $props();

  const w = words({
    en: {
      box: 'Box {n}, {style}',
      pixelate: 'pixelated',
      black: 'blacked out',
      keys: 'Arrow keys move it, Shift moves it further, Delete removes it.',
    },
    de: {
      box: 'Feld {n}, {style}',
      pixelate: 'verpixelt',
      black: 'geschwärzt',
      keys: 'Pfeiltasten verschieben es, mit Umschalt weiter, Entf entfernt es.',
    },
  });

  let stage: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  type Drag =
    | { kind: 'draw'; id: number; ax: number; ay: number }
    | { kind: 'move' | Corner; id: number; start: Box; x: number; y: number };
  let drag: (Drag & { pointer: number; scale: number; origin: DOMRect }) | null = null;
  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  const MIN = 12;

  /** The point under the pointer in the photo's pixels. */
  const at = (e: PointerEvent, rect: DOMRect, s: number) => ({ x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s });

  function down(e: PointerEvent, kind: 'stage' | 'move' | Corner, box?: Box) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = stage.getBoundingClientRect();
    const scale = width / origin.width;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (kind === 'stage') {
      const p = at(e, origin, scale);
      const id = ondraw({ x: p.x, y: p.y, w: 0, h: 0 });
      drag = { kind: 'draw', id, ax: p.x, ay: p.y, pointer: e.pointerId, scale, origin };
      return;
    }
    onchoose(box!.id);
    drag = { kind, id: box!.id, start: { ...box! }, x: e.clientX, y: e.clientY, pointer: e.pointerId, scale, origin };
  }

  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    let next: Box[];
    if (d.kind === 'draw') {
      const p = at(e, d.origin, d.scale);
      const r = fromCorners(d.ax, d.ay, p.x, p.y, width, height);
      next = boxes.map((b) => (b.id === d.id ? { ...b, ...r } : b));
    } else {
      const dx = (e.clientX - d.x) * d.scale;
      const dy = (e.clientY - d.y) * d.scale;
      const min = MIN * d.scale;
      const moved = d.kind === 'move' ? moveBox(d.start, dx, dy, width, height) : resizeBox(d.start, d.kind, dx, dy, width, height, min);
      next = boxes.map((b) => (b.id === d.id ? moved : b));
    }
    onchange(next);
  }

  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // The pointer is gone already (a cancelled touch): nothing to release.
    }
    if (d.kind === 'draw') {
      const b = boxes.find((x) => x.id === d.id);
      // A tap, not a drag: no box, and nothing chosen.
      if (b && (b.w < MIN * d.scale || b.h < MIN * d.scale)) {
        onremove(d.id);
        onchoose(null);
        return;
      }
    }
    oncommit();
  }

  function key(e: KeyboardEvent, box: Box) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onremove(box.id);
      return;
    }
    const step = (e.shiftKey ? 0.05 : 0.01) * Math.max(width, height);
    const dir: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const by = dir[e.key];
    if (!by) return;
    e.preventDefault();
    onchange(boxes.map((b) => (b.id === box.id ? moveBox(b, by[0], by[1], width, height) : b)));
    clearTimeout(commitTimer);
    commitTimer = setTimeout(oncommit, 250);
  }

  // The canvas: the photo, then each box as it will be saved. At most once a frame.
  let frame = 0;
  $effect(() => {
    const list = boxes.map((b) => ({ ...b }));
    const blk = block;
    const img = base;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => paint(img, list, blk));
    return () => cancelAnimationFrame(frame);
  });

  function paint(img: ImageBitmap, list: Box[], blk: number) {
    if (!canvas) return;
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width;
      canvas.height = img.height;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const s = img.width / width;
    for (const b of list) {
      const r = region(b, width, height, s);
      if (!r.w || !r.h) continue;
      if (b.style === 'black') {
        ctx.fillStyle = '#000';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else {
        const data = ctx.getImageData(r.x, r.y, r.w, r.h);
        pixelate(data.data, r.w, r.h, Math.max(2, blk * s));
        ctx.putImageData(data, r.x, r.y);
      }
    }
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
</script>

<div class="stage" role="presentation" bind:this={stage} style:--ratio={width / height} onpointerdown={(e) => down(e, 'stage')} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  {#each boxes as b, i (b.id)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="box"
      class:on={b.id === chosen}
      role="group"
      tabindex="0"
      aria-label={w('box', { n: i + 1, style: w(b.style) })}
      aria-describedby="blur-keys"
      style:left={pct(b.x, width)}
      style:top={pct(b.y, height)}
      style:width={pct(b.w, width)}
      style:height={pct(b.h, height)}
      onpointerdown={(e) => down(e, 'move', b)}
      onkeydown={(e) => key(e, b)}
      onfocus={() => onchoose(b.id)}
    >
      {#if b.id === chosen}
        {#each ['nw', 'ne', 'se', 'sw'] as const as c (c)}
          <span class="corner {c}" aria-hidden="true" onpointerdown={(e) => down(e, c, b)}></span>
        {/each}
      {/if}
    </div>
  {/each}
  <span id="blur-keys" class="sr">{w('keys')}</span>
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
    cursor: crosshair;
  }

  canvas {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* Two thin lines, light and dark, so a box shows on any photo and on black. */
  .box {
    position: absolute;
    box-sizing: border-box;
    border: 1px dashed var(--card);
    outline: 1px dashed var(--ink);
    outline-offset: -2px;
    cursor: move;
    touch-action: none;
  }

  .box.on {
    border: 2px solid var(--mark);
    outline: none;
  }

  .box:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  .corner {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    touch-action: none;
  }

  .corner::after {
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

  /* On the middle of the chosen box's 2 px border, not inside it. */
  .nw {
    left: -1px;
    top: -1px;
    cursor: nwse-resize;
  }
  .ne {
    left: calc(100% + 1px);
    top: -1px;
    cursor: nesw-resize;
  }
  .se {
    left: calc(100% + 1px);
    top: calc(100% + 1px);
    cursor: nwse-resize;
  }
  .sw {
    left: -1px;
    top: calc(100% + 1px);
    cursor: nesw-resize;
  }
</style>
