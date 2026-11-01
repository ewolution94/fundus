<!--
  The trim: the sound's waveform on a canvas, the part kept under the highlighter, and an edge at
  each end of it. Drag an edge (mouse or finger, the pointer captured), click the waveform to bring
  the nearer edge there (a tap on a touch screen; a sideways drag moves it too, an upward one still
  scrolls the page), or focus an edge and use the arrow keys: a tenth of a second, with Shift a
  second; Home and End go to the ends. `onchange` follows every move; `oncommit` comes once a drag or
  a run of keys ends, and that's what the result is made for.
-->
<script lang="ts">
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { formatTime, isTrimmed, setEdge, STEP, BIG_STEP, type Span } from './audio.ts';

  interface Props {
    /** The loudest sample in each part of the sound, 0–1. */
    peaks: Float32Array;
    duration: number;
    span: Span;
    /** Where the playback is, in seconds; null while it's still. */
    at: number | null;
    onchange: (span: Span) => void;
    oncommit: () => void;
  }

  let { peaks, duration, span, at, onchange, oncommit }: Props = $props();

  const w = words({
    en: {
      wave: 'Waveform',
      start: 'Start of the part kept',
      end: 'End of the part kept',
      keys: 'Drag an edge, or use the arrow keys: a tenth of a second, with Shift a second.',
    },
    de: {
      wave: 'Wellenform',
      start: 'Anfang des Ausschnitts',
      end: 'Ende des Ausschnitts',
      keys: 'Zieh einen Rand oder nimm die Pfeiltasten: eine Zehntelsekunde, mit Umschalt eine Sekunde.',
    },
  });

  type Edge = 'start' | 'end';
  const EDGES: Edge[] = ['start', 'end'];

  let track: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let inkProbe: HTMLSpanElement;
  let onProbe: HTMLSpanElement;
  let offProbe: HTMLSpanElement;
  let width = $state(0);
  let height = $state(0);
  // Bumped when the theme changes: the canvas reads its colours from the page.
  let themeTick = $state(0);

  $effect(() => {
    const size = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    });
    size.observe(track);
    const bump = () => themeTick++;
    const attrs = new MutationObserver(bump);
    attrs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', bump);
    return () => {
      size.disconnect();
      attrs.disconnect();
      scheme.removeEventListener('change', bump);
    };
  });

  /** Something is cut off: only then does the part kept go under the highlighter (the whole sound
   *  in yellow would be the loudest thing on the page). */
  const cut = $derived(isTrimmed(span, duration));

  $effect(() => {
    void themeTick;
    draw(width, height, peaks, span.start, span.end, cut);
  });

  /** Bars of two pixels, the loudest part reaching nearly the top: in ink, or, once something is
   *  cut off, the highlighter's ink on the part kept and the paler ink on what goes. */
  function draw(w: number, h: number, p: Float32Array, start: number, end: number, trimmed: boolean) {
    if (!w || !h || !canvas) return;
    const dpr = Math.min(3, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ink = getComputedStyle(inkProbe).color;
    const on = getComputedStyle(onProbe).color;
    const off = getComputedStyle(offProbe).color;
    const bar = 2 * dpr;
    const gap = 1 * dpr;
    const n = Math.max(1, Math.floor(canvas.width / (bar + gap)));
    const mid = canvas.height / 2;
    const reach = canvas.height / 2 - 12 * dpr;
    let top = 0.05;
    for (let i = 0; i < p.length; i++) if (p[i] > top) top = p[i];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < n; i++) {
      const b0 = Math.floor((i * p.length) / n);
      const b1 = Math.max(b0 + 1, Math.floor(((i + 1) * p.length) / n));
      let m = 0;
      for (let b = b0; b < b1 && b < p.length; b++) if (p[b] > m) m = p[b];
      const x = i * (bar + gap);
      const t = ((x + bar / 2) / canvas.width) * duration;
      const half = Math.max(dpr / 2, (m / top) * reach);
      ctx.fillStyle = !trimmed ? ink : t >= start && t <= end ? on : off;
      ctx.fillRect(x, mid - half, bar, half * 2);
    }
  }

  // ── Pointer ───────────────────────────────────────────────────────────────────────────

  /** A drag of an edge, or a touch on the waveform that isn't one yet (a tap, or a scroll). */
  let drag: { edge: Edge; id: number } | null = null;
  let pending: { x: number; y: number; id: number } | null = null;

  const timeAt = (clientX: number) => {
    const r = track.getBoundingClientRect();
    return ((clientX - r.left) / Math.max(1, r.width)) * duration;
  };
  const nearest = (t: number): Edge => (Math.abs(t - span.start) <= Math.abs(t - span.end) ? 'start' : 'end');

  function begin(e: PointerEvent, edge: Edge, el: Element) {
    el.setPointerCapture(e.pointerId);
    drag = { edge, id: e.pointerId };
    track.querySelector<HTMLElement>(`.edge.${edge}`)?.focus({ preventScroll: true });
  }

  function downOnEdge(e: PointerEvent, edge: Edge) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    begin(e, edge, e.currentTarget as Element);
  }

  function downOnWave(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      const t = timeAt(e.clientX);
      const edge = nearest(t);
      onchange(setEdge(span, edge, t, duration));
      begin(e, edge, track);
    } else pending = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function move(e: PointerEvent) {
    if (pending && e.pointerId === pending.id) {
      const dx = Math.abs(e.clientX - pending.x);
      if (dx > 6 && dx > Math.abs(e.clientY - pending.y)) {
        const edge = nearest(timeAt(pending.x));
        pending = null;
        begin(e, edge, track);
      }
    }
    if (!drag || e.pointerId !== drag.id) return;
    onchange(setEdge(span, drag.edge, timeAt(e.clientX), duration));
  }

  function up(e: PointerEvent) {
    if (pending && e.pointerId === pending.id) {
      // A tap: the nearer edge comes to it.
      pending = null;
      const t = timeAt(e.clientX);
      onchange(setEdge(span, nearest(t), t, duration));
      oncommit();
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // The pointer is gone already (a cancelled touch): nothing to release.
    }
    oncommit();
  }

  function cancel(e: PointerEvent) {
    if (pending && e.pointerId === pending.id) pending = null;
    else if (drag && e.pointerId === drag.id) {
      drag = null;
      oncommit();
    }
  }

  // ── Keys ──────────────────────────────────────────────────────────────────────────────

  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  function key(e: KeyboardEvent, edge: Edge) {
    const big = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
    const step = big ? BIG_STEP : STEP;
    const now = edge === 'start' ? span.start : span.end;
    let to: number;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') to = now - step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') to = now + step;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = duration;
    else return;
    e.preventDefault();
    onchange(setEdge(span, edge, to, duration));
    clearTimeout(commitTimer);
    commitTimer = setTimeout(oncommit, 400);
  }

  function blurred() {
    if (commitTimer === undefined) return;
    clearTimeout(commitTimer);
    commitTimer = undefined;
    oncommit();
  }

  const pct = (t: number) => `${(Math.min(duration, Math.max(0, t)) / duration) * 100}%`;
  const mark = $derived(shared.decimal);
</script>

<div class="wave">
  <!-- The waveform follows a pointer captured by it or by an edge; the keys live on the edges. -->
  <div
    class="track"
    role="presentation"
    bind:this={track}
    onpointerdown={downOnWave}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={cancel}
  >
    {#if cut}<span class="kept" style:left={pct(span.start)} style:width={pct(span.end - span.start)}></span>{/if}
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
    {#if at !== null}<span class="playhead" class:cut style:left={pct(at)}></span>{/if}
    <span id="trim-keys" class="sr">{w('keys')}</span>
    {#each EDGES as edge (edge)}
      {@const value = edge === 'start' ? span.start : span.end}
      <div
        class="edge {edge}"
        role="slider"
        tabindex="0"
        aria-label={w(edge)}
        aria-describedby="trim-keys"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 10) / 10}
        aria-valuenow={Math.round(value * 10) / 10}
        aria-valuetext={formatTime(value, mark)}
        style:left={pct(value)}
        onpointerdown={(e) => downOnEdge(e, edge)}
        onkeydown={(e) => key(e, edge)}
        onblur={blurred}
      >
        <span class="tab"></span>
      </div>
    {/each}
    <span class="probe-ink" bind:this={inkProbe} aria-hidden="true"></span>
    <span class="probe-on" bind:this={onProbe} aria-hidden="true"></span>
    <span class="probe-off" bind:this={offProbe} aria-hidden="true"></span>
  </div>
</div>

<style>
  .wave {
    position: relative;
    height: 132px;
    padding: 0 16px;
    border: 1px solid var(--ink);
    background: var(--sunk);
    overflow: clip;
    user-select: none;
    -webkit-user-select: none;
  }

  @media (min-width: 760px) {
    .wave {
      height: 168px;
    }
  }

  .track {
    position: relative;
    height: 100%;
    /* An upward swipe still scrolls the page; a sideways one moves an edge. */
    touch-action: pan-y;
    cursor: pointer;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* The part kept, under the highlighter. */
  .kept {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--mark);
  }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--ink);
    pointer-events: none;
  }

  /* On the highlighter, its own ink. */
  .playhead.cut {
    background: var(--mark-ink);
  }

  /* An edge: a line the height of the waveform with a tab on its outer side; the area that takes a
     finger reaches 36 px outwards and 8 px in. */
  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 44px;
    touch-action: none;
    cursor: ew-resize;
    outline: none;
  }

  .edge.start {
    margin-left: -36px;
  }

  .edge.end {
    margin-left: -8px;
  }

  .edge::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--ink);
  }

  .edge.start::before {
    left: 35px;
  }

  .edge.end::before {
    left: 7px;
  }

  .tab {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 32px;
    margin-top: -16px;
    background: var(--ink);
    border-radius: 2px;
  }

  .edge.start .tab {
    left: 24px;
    border-radius: 2px 0 0 2px;
  }

  .edge.end .tab {
    left: 8px;
    border-radius: 0 2px 2px 0;
  }

  .edge:focus-visible .tab {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  .probe-ink,
  .probe-on,
  .probe-off {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
  }

  .probe-ink {
    color: var(--ink);
  }

  .probe-on {
    color: var(--mark-ink);
  }

  .probe-off {
    color: var(--ink-2);
  }
</style>
