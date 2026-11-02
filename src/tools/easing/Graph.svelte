<!--
  The curve on its graph: time from left to right, progress from bottom to top, the unit square
  ruled, and room above and below for overshoot (−0.5 to 1.5, wider when a handle or the curve goes
  further; never re-scaled during a drag). A Bézier has its two handles: dragged with a mouse or a
  finger (pointer events with the pointer captured, every move worked out from where the drag
  began), or focused and moved with the arrow keys, 0.01 a press, 0.1 with Shift. `play()` runs a dot
  along the curve with the preview.
-->
<script lang="ts">
  import { words } from '../../lib/i18n.svelte.ts';
  import { viewRange, clampHandle, round, num, type Easing, type Bezier } from './easing.ts';

  interface Props {
    easing: Easing;
    /** A Bézier's handles, while it's one. */
    onmove?: (p: Bezier) => void;
    ondrag?: (dragging: boolean) => void;
  }

  let { easing, onmove, ondrag }: Props = $props();

  const w = words({
    en: {
      handle: 'Handle {n}: x {x}, y {y}. Arrow keys move it.',
      graph: 'The curve: time from left to right, progress from bottom to top',
    },
    de: {
      handle: 'Griff {n}: x {x}, y {y}. Die Pfeiltasten bewegen ihn.',
      graph: 'Die Kurve: Zeit von links nach rechts, Fortschritt von unten nach oben',
    },
  });

  // The drawing's own units: 2 wide by 3 tall, the unit square square.
  const VW = 320;
  const VH = 480;
  const PAD = 18;

  let plot: HTMLDivElement;
  let runner: HTMLSpanElement;
  let dot: HTMLSpanElement;

  /** The range held still while a handle is dragged. */
  let held = $state<[number, number] | null>(null);
  const range = $derived(held ?? viewRange(easing));
  const scale = $derived((VH - 2 * PAD) / (range[1] - range[0]));
  const X = (x: number) => VW / 2 + (x - 0.5) * scale;
  const Y = (y: number) => PAD + (range[1] - y) * scale;

  const p = $derived(easing.kind === 'bezier' ? easing.p : null);

  const path = $derived.by(() => {
    if (easing.kind === 'bezier') {
      const [x1, y1, x2, y2] = easing.p;
      return `M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(1)} ${Y(1)}`;
    }
    return 'M' + easing.stops.map((s) => `${X(s.x).toFixed(2)} ${Y(s.y).toFixed(2)}`).join(' L');
  });

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const KNOBS: (0 | 1)[] = [0, 1];

  // ── Dragging ─────────────────────────────────────────────────────────────────────────

  let drag: { i: 0 | 1; id: number; x0: number; y0: number; cx: number; cy: number; unit: number } | null = null;
  let said = $state('');

  function down(e: PointerEvent, i: 0 | 1) {
    if (!p || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId);
    held = [range[0], range[1]];
    // Pixels on screen per unit of the curve, for this drag.
    const unit = (plot.getBoundingClientRect().width / VW) * scale;
    drag = { i, id: e.pointerId, x0: p[i * 2], y0: p[i * 2 + 1], cx: e.clientX, cy: e.clientY, unit };
    ondrag?.(true);
  }

  function move(e: PointerEvent) {
    if (!drag || !p || e.pointerId !== drag.id) return;
    // Browsers send moves without movement; a click alone changes nothing.
    if (e.clientX === drag.cx && e.clientY === drag.cy) return;
    const [x, y] = clampHandle(round(drag.x0 + (e.clientX - drag.cx) / drag.unit, 2), round(drag.y0 - (e.clientY - drag.cy) / drag.unit, 2));
    const next = [...p] as Bezier;
    next[drag.i * 2] = x;
    next[drag.i * 2 + 1] = y;
    onmove?.(next);
  }

  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    held = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // The pointer is gone already (a cancelled touch): nothing to release.
    }
    ondrag?.(false);
  }

  function key(e: KeyboardEvent, i: 0 | 1) {
    if (!p) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    const by: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = by[e.key];
    if (!d) return;
    e.preventDefault();
    const [x, y] = clampHandle(round(p[i * 2] + d[0], 3), round(p[i * 2 + 1] + d[1], 3));
    const next = [...p] as Bezier;
    next[i * 2] = x;
    next[i * 2 + 1] = y;
    onmove?.(next);
    said = `x ${num(x)}, y ${num(y)}`;
  }

  // ── The dot that runs with the preview ──────────────────────────────────────────────

  /** A dot along the curve: across in time (linear), up by the timing function itself. */
  export function play(fn: string, ms: number) {
    for (const el of [runner, dot]) for (const a of el.getAnimations()) a.cancel();
    try {
      runner.animate(
        [
          { left: pct(X(0), VW), opacity: 1 },
          { left: pct(X(1), VW), opacity: 1 },
        ],
        { duration: ms, easing: 'linear' },
      );
      dot.animate([{ top: pct(Y(0), VH) }, { top: pct(Y(1), VH) }], { duration: ms, easing: fn });
    } catch {
      // A timing function this browser can't run: the curve still shows.
    }
  }
</script>

<div class="graph-frame">
  <div class="plot" bind:this={plot} class:dragging={held !== null} role="group" aria-label={w('graph')}>
    <svg viewBox="0 0 {VW} {VH}" aria-hidden="true">
      <!-- The outside of the time, faintly. -->
      <rect class="sq" x={X(0)} y={Y(1)} width={X(1) - X(0)} height={Y(0) - Y(1)} />
      <line class="guide" x1="0" x2={VW} y1={Y(0)} y2={Y(0)} />
      <line class="guide" x1="0" x2={VW} y1={Y(1)} y2={Y(1)} />
      <line class="diag" x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} />
      <text class="tick" x={X(0) - 6} y={Y(0) + 4}>0</text>
      <text class="tick" x={X(0) - 6} y={Y(1) + 4}>1</text>
      {#if p}
        <line class="arm" x1={X(0)} y1={Y(0)} x2={X(p[0])} y2={Y(p[1])} />
        <line class="arm" x1={X(1)} y1={Y(1)} x2={X(p[2])} y2={Y(p[3])} />
      {/if}
      <path class="curve" d={path} />
    </svg>

    <span class="runner" bind:this={runner} aria-hidden="true"><span class="dot" bind:this={dot}></span></span>

    {#if p}
      {#each KNOBS as i (i)}
        <button
          type="button"
          class="knob"
          style:left={pct(X(p[i * 2]), VW)}
          style:top={pct(Y(p[i * 2 + 1]), VH)}
          aria-label={w('handle', { n: i + 1, x: num(p[i * 2]), y: num(p[i * 2 + 1]) })}
          onpointerdown={(e) => down(e, i)}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
          onkeydown={(e) => key(e, i)}
        ><span class="sqr" aria-hidden="true">{i + 1}</span></button>
      {/each}
    {/if}
  </div>
  <p class="sr" aria-live="polite">{said}</p>
</div>

<style>
  .graph-frame {
    border: 1.5px solid var(--ink);
    background: var(--card);
    padding: 6px 0;
    min-width: 0;
  }

  /* As wide as the column allows, as tall as the screen allows: one height while you work. */
  .plot {
    position: relative;
    aspect-ratio: 2 / 3;
    width: min(100%, calc(min(62vh, 540px) * 2 / 3));
    margin-inline: auto;
  }

  svg {
    width: 100%;
    height: 100%;
    /* A handle dragged past the edge stays in sight until the graph widens on release. */
    overflow: visible;
  }

  .sq {
    fill: var(--sunk);
    stroke: var(--rule);
    stroke-width: 1;
  }

  .guide {
    stroke: var(--rule);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .diag {
    stroke: var(--rule);
    stroke-width: 1.5;
    stroke-dasharray: 2 5;
  }

  .tick {
    font-family: var(--mono);
    font-size: 11px;
    fill: var(--ink-2);
    text-anchor: end;
  }

  .arm {
    stroke: var(--ink-2);
    stroke-width: 1.25;
  }

  .curve {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  /* 44 px to grab; the square in the middle is what shows. */
  .knob {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    display: grid;
    place-items: center;
    touch-action: none;
    cursor: grab;
    outline: none;
  }

  .dragging .knob {
    cursor: grabbing;
  }

  .sqr {
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    background: var(--mark);
    color: var(--mark-ink);
    border: 1.5px solid var(--mark-ink);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .knob:focus-visible .sqr {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }

  .runner {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    opacity: 0;
    pointer-events: none;
  }

  .dot {
    position: absolute;
    left: -6px;
    width: 12px;
    height: 12px;
    margin-top: -6px;
    border-radius: 50%;
    background: var(--ink);
  }
</style>
