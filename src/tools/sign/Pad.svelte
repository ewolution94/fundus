<!--
  The signing pad: paper, a baseline with its ×, and a pen that follows a finger, a pen or a mouse.
  Strokes are kept in pad widths and eased as they come (sign.ts), drawn as curves through their
  points, and handed up when a stroke ends. A kept signature shows on it until a new one is begun.
-->
<script lang="ts">
  import { nextPoint, type Stroke } from './sign.ts';
  import { paint } from './ink.ts';

  interface Props {
    strokes: Stroke[];
    color: string;
    /** For screen readers. */
    label: string;
    /** A kept signature's picture, shown while nothing is drawn. */
    kept?: string | null;
    onchange: (strokes: Stroke[]) => void;
  }

  let { strokes, color, label, kept = null, onchange }: Props = $props();

  /** The pad's width over its height (its CSS says the same). */
  const ASPECT = 2.4;

  let canvas: HTMLCanvasElement;
  let width = $state(0);
  let drawing: { stroke: Stroke; pointerId: number; last: { x: number; y: number; t: number } } | null = null;

  /** The whole drawing again, at the pad's size (on a resize, an undo, a new colour). */
  function redraw(extra?: Stroke) {
    if (!canvas || !width) return;
    const dpr = Math.min(3, devicePixelRatio || 1);
    const w = Math.round(width * dpr);
    const h = Math.round((width / ASPECT) * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    paint(ctx, extra ? [...strokes, extra] : strokes, w, color);
  }

  $effect(() => {
    void strokes;
    void color;
    void width;
    redraw();
  });

  /** A pointer's place in pad widths. */
  function at(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.width, t: e.timeStamp, pressure: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : undefined };
  }

  function down(e: PointerEvent) {
    if (e.button !== 0 || drawing) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // A made-up pointer: the canvas still gets its moves while it's over it.
    }
    const p = at(e);
    const stroke: Stroke = [];
    stroke.push(nextPoint(stroke, p, null));
    drawing = { stroke, pointerId: e.pointerId, last: p };
    redraw(stroke);
  }

  function move(e: PointerEvent) {
    if (!drawing || e.pointerId !== drawing.pointerId) return;
    // Every sample since the last frame, not just the last one: smoother curves on fast strokes.
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) {
      const p = at(ev);
      drawing.stroke.push(nextPoint(drawing.stroke, p, drawing.last));
      drawing.last = p;
    }
    redraw(drawing.stroke);
  }

  function up(e: PointerEvent) {
    if (!drawing || e.pointerId !== drawing.pointerId) return;
    const p = at(e);
    if (drawing.stroke.length > 1 || p.x !== drawing.last.x || p.y !== drawing.last.y) drawing.stroke.push(nextPoint(drawing.stroke, p, drawing.last, true));
    const done = drawing.stroke;
    drawing = null;
    onchange([...strokes, done]);
  }

  function cancel(e: PointerEvent) {
    if (!drawing || e.pointerId !== drawing.pointerId) return;
    drawing = null;
    redraw();
  }
</script>

<div class="pad" role="group" aria-label={label} bind:clientWidth={width}>
  {#if kept && !strokes.length}<img class="kept" src={kept} alt="" />{/if}
  <span class="base" aria-hidden="true"><span>×</span></span>
  <canvas bind:this={canvas} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={cancel}></canvas>
</div>

<style>
  /* Paper in both themes: ink shows on it as it will on the page. */
  .pad {
    position: relative;
    width: 100%;
    aspect-ratio: 2.4;
    background: #fff;
    border: 1.5px solid var(--ink);
    color: #121212;
    overflow: hidden;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
  }

  .base {
    position: absolute;
    left: 6%;
    right: 6%;
    top: 72%;
    border-top: 1px solid #8a8a84;
    pointer-events: none;
  }

  .base span {
    position: absolute;
    left: 0;
    bottom: 2px;
    font-size: 18px;
    line-height: 1;
    color: #8a8a84;
  }

  .kept {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 10%;
    bottom: 18%;
    width: 84%;
    height: 72%;
    object-fit: contain;
    opacity: 0.9;
    pointer-events: none;
  }
</style>
