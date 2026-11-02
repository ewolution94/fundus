<!--
  F-912 Easing curves: a cubic Bézier dragged by its two handles (or typed, or picked from CSS's
  keywords and the usual families), or a spring (bounce and duration) as CSS linear(). A preview
  runs a block at the duration set, with a faint linear one to compare; the timing function, a
  transition line and the Web Animations call to copy. A pasted cubic-bezier(), linear() or whole
  transition line opens in it. Kept: the kind, the last preset picked, the duration and the bounce;
  never what was typed or pasted.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { RotateCcw } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Graph from './Graph.svelte';
  import Code from './Code.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { parseNumber, formatNumber } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import {
    PRESETS,
    GROUPS,
    presetOf,
    parseEasing,
    formatEasing,
    formatLinear,
    springStops,
    transitionLine,
    animateLine,
    num,
    TOLERANCE,
    type Bezier,
    type Easing,
    type Stop,
    type Read,
    type ReadError,
  } from './easing.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      kind: 'Kind',
      bezier: 'Bézier',
      spring: 'Spring',
      curve: 'Curve',
      handles: 'P1 {a} · P2 {b}',
      dragHint: 'Drag the two handles, or focus one and use the arrow keys (Shift for bigger steps).',
      springHint: 'Where the spring is over the duration. Bounce 0 arrives without overshooting.',
      linearHint: 'Your linear(), as it runs.',
      preset: 'Preset',
      custom: 'Custom',
      css: 'CSS',
      sine: 'Sine',
      quad: 'Quad',
      cubic: 'Cubic',
      quart: 'Quart',
      quint: 'Quint',
      expo: 'Expo',
      circ: 'Circ',
      back: 'Back',
      function: 'Function',
      functionPh: 'ease-out, cubic-bezier(…), linear(…)',
      unreadable: 'That isn’t a timing function this tool can read. Try ease-out, cubic-bezier(0.34, 1.56, 0.64, 1) or linear(0, 0.6, 1).',
      outside: 'The two x values have to be between 0 and 1: time can’t run backwards.',
      steps: 'steps() jumps instead of easing: this tool draws curves.',
      duration: 'Duration',
      durationBad: 'A duration from 1 to 60,000 ms.',
      bounce: 'Bounce',
      bounceHint: '0 arrives without overshooting, 0.9 swings for long.',
      preview: 'Preview',
      replay: 'Replay',
      ghost: 'The faint one runs linear, to compare.',
      still: 'Reduced motion is on, so it only runs when you tap Replay.',
      out: 'CSS',
      timing: 'Timing function',
      transition: 'Transition',
      waapi: 'Web Animations',
      'points.one': '1 point, within 0.002 of the spring.',
      'points.other': '{n} points, each within 0.002 of the spring.',
      'stops.one': '1 point',
      'stops.other': '{n} points',
    },
    de: {
      kind: 'Art',
      bezier: 'Bézier',
      spring: 'Feder',
      curve: 'Kurve',
      handles: 'P1 {a} · P2 {b}',
      dragHint: 'Zieh die beiden Griffe, oder fokussier einen und nimm die Pfeiltasten (mit Umschalt weiter).',
      springHint: 'Wo die Feder während der Dauer ist. Bei Nachfedern 0 kommt sie ohne Überschwingen an.',
      linearHint: 'Dein linear(), so wie es läuft.',
      preset: 'Vorlage',
      custom: 'Eigene',
      function: 'Funktion',
      functionPh: 'ease-out, cubic-bezier(…), linear(…)',
      unreadable: 'Das ist keine Zeitfunktion, die dieses Werkzeug lesen kann. Versuch ease-out, cubic-bezier(0.34, 1.56, 0.64, 1) oder linear(0, 0.6, 1).',
      outside: 'Die beiden x-Werte müssen zwischen 0 und 1 liegen: die Zeit läuft nicht rückwärts.',
      steps: 'steps() springt, statt zu gleiten: dieses Werkzeug zeichnet Kurven.',
      duration: 'Dauer',
      durationBad: 'Eine Dauer von 1 bis 60.000 ms.',
      bounce: 'Nachfedern',
      bounceHint: 'Bei 0 kommt sie ohne Überschwingen an, bei 0,9 schwingt sie lange nach.',
      preview: 'Vorschau',
      replay: 'Nochmal',
      ghost: 'Die blasse läuft linear, zum Vergleich.',
      still: 'Weniger Bewegung ist an: es läuft nur, wenn du auf Nochmal tippst.',
      out: 'CSS',
      timing: 'Zeitfunktion',
      transition: 'Transition',
      waapi: 'Web Animations',
      'points.one': '1 Punkt, höchstens 0,002 neben der Feder.',
      'points.other': '{n} Punkte, jeder höchstens 0,002 neben der Feder.',
      'stops.one': '1 Punkt',
      'stops.other': '{n} Punkte',
    },
  });

  type Mode = 'bezier' | 'spring' | 'linear';

  // The kind, the last preset picked, the duration and the bounce are kept; a typed or pasted
  // curve is not (the curve comes back as the last preset picked).
  const o = remember('easing', { mode: 'bezier' as 'bezier' | 'spring', preset: 'out-back', duration: 600, bounce: 0.3 });

  const startPreset = PRESETS.find((x) => x.id === untrack(() => o.preset)) ?? PRESETS.find((x) => x.id === 'out-back')!;
  let mode = $state<Mode>(untrack(() => o.mode));
  let p = $state<Bezier>([...startPreset.p]);
  /** A linear() that was typed or pasted: shown as itself, under its own kind. */
  let pasted = $state<Stop[] | null>(null);
  let property = $state('transform');
  let text = $state(formatEasing({ kind: 'bezier', p: startPreset.p }));
  let problem = $state<ReadError | null>(null);
  let durationText = $state(untrack(() => String(o.duration)));
  let dragging = $state(false);

  function setMode(m: Mode) {
    mode = m;
    if (m !== 'linear') o.mode = m;
    problem = null;
    if (m === 'bezier') text = formatEasing({ kind: 'bezier', p });
    if (m === 'linear' && pasted) text = formatLinear(pasted);
  }

  /** A timing function read from the field or the home: its kind, numbers, property and duration. */
  function apply(r: Read) {
    if (r.easing.kind === 'bezier') {
      p = r.easing.p;
      mode = 'bezier';
      o.mode = 'bezier';
    } else {
      pasted = r.easing.stops;
      mode = 'linear';
    }
    if (r.property) property = r.property;
    if (r.duration && r.duration >= 1 && r.duration <= 60_000) {
      o.duration = r.duration;
      durationText = String(r.duration);
    }
  }

  function typed(value: string) {
    text = value;
    if (!value.trim()) {
      problem = null;
      return;
    }
    const r = parseEasing(value);
    if ('error' in r) {
      problem = r.error;
      return;
    }
    problem = null;
    apply(r);
  }

  /** Once the field is left, it shows the function as it's written out (a transition line, too). */
  function settle() {
    if (!problem && text.trim()) text = fn;
  }

  function moved(next: Bezier) {
    p = next;
    text = formatEasing({ kind: 'bezier', p: next });
    problem = null;
  }

  function pick(id: string) {
    const preset = PRESETS.find((x) => x.id === id);
    if (!preset) return;
    o.preset = id;
    moved([...preset.p]);
  }

  function setDuration(s: string) {
    durationText = s;
    const n = parseNumber(s);
    if (Number.isFinite(n) && n >= 1 && n <= 60_000) o.duration = Math.round(n);
  }

  // A timing function from the home (or a transition line) opens here.
  for (const given of untrack(() => texts(items))) {
    const r = parseEasing(given);
    if ('error' in r) continue;
    apply(r);
    text = formatEasing(r.easing);
    break;
  }

  const springs = $derived(springStops(o.bounce));
  const easing = $derived<Easing>(
    mode === 'bezier' ? { kind: 'bezier', p } : mode === 'spring' || !pasted ? { kind: 'linear', stops: springs } : { kind: 'linear', stops: pasted },
  );
  const fn = $derived(formatEasing(easing));
  const ms = $derived(o.duration);
  const durationOk = $derived.by(() => {
    const n = parseNumber(durationText);
    return Number.isFinite(n) && n >= 1 && n <= 60_000;
  });
  const preset = $derived(presetOf(p));
  const pair = (x: number, y: number) => `(${num(x)}, ${num(y)})`;
  const decimal = (n: number) => formatNumber(n, shared.decimal, { min: 2, max: 2 });

  // ── The preview ──────────────────────────────────────────────────────────────────────

  let graph = $state<ReturnType<typeof Graph>>();
  let track = $state<HTMLDivElement>();
  let block = $state<HTMLSpanElement>();
  let ghost = $state<HTMLSpanElement>();

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = $state(motion.matches);
  $effect(() => {
    const on = () => (reduced = motion.matches);
    motion.addEventListener('change', on);
    return () => motion.removeEventListener('change', on);
  });

  function play() {
    if (!track || !block || !ghost) return;
    const run = (el: HTMLElement, easing: string) => {
      for (const a of el.getAnimations()) a.cancel();
      try {
        // In the track's own width (cqw), so a resize keeps the block where it should be.
        el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(calc(80cqw - 32px))' }], { duration: ms, easing, fill: 'forwards' });
      } catch {
        // A timing function this browser can't run (an old one and linear()): nothing moves.
      }
    };
    run(ghost, 'linear');
    run(block, fn);
    graph?.play(fn, ms);
  }

  // It runs by itself a moment after the curve or the duration settles, not during a drag, and
  // never with reduced motion on.
  $effect(() => {
    void fn;
    void ms;
    if (dragging || reduced) return;
    const t = setTimeout(play, 350);
    return () => clearTimeout(t);
  });
</script>

<div class="easing">
  <Seg
    large
    label={w('kind')}
    value={mode}
    options={[
      { value: 'bezier', label: w('bezier') },
      { value: 'spring', label: w('spring') },
      ...(pasted ? [{ value: 'linear' as Mode, label: 'linear()' }] : []),
    ]}
    onchange={setMode}
  />

  <div class="cols">
    <div class="stack">
      <h2 class="h">
        {w('curve')}
        {#if easing.kind === 'bezier'}<em class="pair">{w('handles', { a: pair(p[0], p[1]), b: pair(p[2], p[3]) })}</em>
        {:else if mode === 'linear'}<em class="pair">{w('stops', { n: easing.stops.length })}</em>{/if}
      </h2>
      <Graph bind:this={graph} {easing} onmove={moved} ondrag={(d) => (dragging = d)} />
      <p class="note">{mode === 'bezier' ? w('dragHint') : mode === 'spring' ? w('springHint') : w('linearHint')}</p>

      <div class="h">
        <span>{w('preview')}</span>
        <em><button type="button" class="btn" onclick={play}><RotateCcw aria-hidden="true" />{w('replay')}</button></em>
      </div>
      <div class="track" bind:this={track} aria-hidden="true">
        <span class="lane"></span>
        <span class="ghost" bind:this={ghost}></span>
        <span class="block" bind:this={block}></span>
      </div>
      <p class="note">{reduced ? w('still') : w('ghost')}</p>
    </div>

    <div class="stack">
      <dl class="spec">
        {#if mode === 'bezier'}
          <div>
            <dt><label for="easing-preset">{w('preset')}</label></dt>
            <dd>
              <select id="easing-preset" class="field" value={preset?.id ?? ''} onchange={(e) => pick(e.currentTarget.value)}>
                <option value="" disabled>{w('custom')}</option>
                {#each GROUPS as g (g)}
                  <optgroup label={g === 'css' ? w('css') : w(g as 'sine')}>
                    {#each PRESETS.filter((x) => x.group === g) as x (x.id)}
                      <option value={x.id}>{g === 'css' ? x.name : `${w(g as 'sine')} · ${x.name}`}</option>
                    {/each}
                  </optgroup>
                {/each}
              </select>
            </dd>
          </div>
        {/if}
        {#if mode !== 'spring'}
          <div>
            <dt><label for="easing-fn">{w('function')}</label></dt>
            <dd>
              <input
                id="easing-fn"
                class="field code"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder={w('functionPh')}
                value={text}
                oninput={(e) => typed(e.currentTarget.value)}
                onchange={settle}
              />
              {#if problem}<span class="note bad" role="alert">{w(problem)}</span>{/if}
            </dd>
          </div>
        {:else}
          <div>
            <dt><label for="easing-bounce">{w('bounce')}</label></dt>
            <dd class="slide">
              <input id="easing-bounce" class="range" type="range" min="0" max="0.9" step="0.01" value={o.bounce} oninput={(e) => (o.bounce = Number(e.currentTarget.value))} />
              <b class="count">{decimal(o.bounce)}</b>
              <span class="note">{w('bounceHint')}</span>
            </dd>
          </div>
        {/if}
        <div>
          <dt>{w('duration')}</dt>
          <dd>
            <NumIn label={w('duration')} value={durationText} unit="ms" size="mid" width="160px" inputmode="numeric" oninput={setDuration} />
            {#if !durationOk}<span class="note bad" role="alert">{w('durationBad')}</span>{/if}
          </dd>
        </div>
      </dl>

      <Receipt title={w('out')}>
        <Code label={w('timing')} value={fn} hl />
        <Code label={w('transition')} value={transitionLine(fn, ms, property)} />
        <Code label={w('waapi')} value={animateLine(fn, ms)} />
      </Receipt>
      {#if mode === 'spring'}<p class="note">{w('points', { n: springs.length })}</p>{/if}
    </div>
  </div>
</div>

<style>
  .easing {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .pair {
    font-family: var(--mono);
    font-size: 11px;
  }

  /* 40 px to tap, without making the heading much taller. */
  .h .btn {
    min-height: 40px;
    margin: -5px 0;
    font-family: var(--sans);
    text-transform: none;
    letter-spacing: 0;
  }

  .code {
    font-family: var(--mono);
    font-size: 14px;
  }

  @media (hover: none) {
    .code {
      font-size: 16px;
    }
  }

  /* The preview: a lane the block runs along, from a tenth in to a tenth from the end; what
     overshoots past the box is cut off, never widening the page. */
  .track {
    position: relative;
    container-type: inline-size;
    height: 76px;
    border: 1.5px solid var(--ink);
    background: var(--sunk);
    overflow: clip;
  }

  .lane {
    position: absolute;
    left: 10%;
    right: 10%;
    top: 50%;
    border-top: 1px dashed var(--rule);
  }

  .block,
  .ghost {
    position: absolute;
    left: 10%;
    top: 50%;
    width: 32px;
    height: 32px;
    margin-top: -16px;
  }

  .block {
    background: var(--ink);
  }

  .ghost {
    border: 1.5px dashed var(--ink-2);
    opacity: 0.55;
  }

  .slide {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    gap: 4px 12px;
  }

  .slide .note {
    grid-column: 1 / -1;
  }

  .count {
    font-family: var(--mono);
    font-size: 17px;
    font-variant-numeric: tabular-nums;
  }

  /* An ink rule with an ink knob. */
  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    min-width: 0;
    height: 40px;
    margin: 0;
    background: transparent;
  }

  .range::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--ink);
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -9px;
    background: var(--ink);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }

  .range::-moz-range-track {
    height: 2px;
    background: var(--ink);
  }

  .range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--ink);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }
</style>
