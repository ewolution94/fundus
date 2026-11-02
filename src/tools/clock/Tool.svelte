<!--
  F-509 Flip clock: a split-flap clock, or a countdown to a date and time, in a dark frame on the
  page; Full screen puts the same frame over the whole window (and the screen, where the browser
  allows it), with the screen kept on and the clock moved by a few pixels every minute so an OLED
  screen doesn't keep its picture. It ticks on whole seconds, reading the time each tick. The
  countdown's date and time are kept; a typed label isn't.
-->
<script lang="ts">
  import { untrack, tick } from 'svelte';
  import { Maximize, X } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import Flap from './Flap.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { Awake, canFullscreen, enterFullscreen, exitFullscreen, onFullscreenChange } from '../../lib/awake.svelte.ts';
  import { lockScroll } from '../../../vendor/ewo/elements/scroll-lock.js';
  import { trapTab } from './trap.ts';
  import { deviceCycle, faceAt, targetOf, countdown, countdownGroups, handedIn, type Cycle } from './clock.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      clock: 'Clock',
      countdown: 'Countdown',
      hours: 'Hours',
      h24: '24 h',
      h12: '12 h',
      show: 'Show',
      seconds: 'Seconds',
      date: 'Date',
      time: 'Time',
      label: 'Label',
      labelPlaceholder: 'A trip, a launch, the holidays…',
      am: 'AM',
      pm: 'PM',
      days: 'Days',
      hoursCap: 'Hours',
      minutes: 'Minutes',
      secondsCap: 'Seconds',
      until: 'Until {when}',
      pick: 'Pick a date and time to count down to.',
      reached: 'It’s time.',
      fullscreen: 'Full screen',
      close: 'Close',
      lockOn: 'In full screen the screen stays on, and the clock moves a few pixels every minute so the screen doesn’t burn in. Esc leaves it.',
      lockOff: 'This browser can’t keep the screen on: keep it awake yourself. In full screen the clock moves a few pixels every minute. Esc leaves it.',
      spokenLeft: '{d} days, {t} left',
    },
    de: {
      mode: 'Modus',
      clock: 'Uhr',
      countdown: 'Countdown',
      hours: 'Stunden',
      h24: '24 Std.',
      h12: '12 Std.',
      show: 'Zeigen',
      seconds: 'Sekunden',
      date: 'Datum',
      time: 'Uhrzeit',
      label: 'Titel',
      labelPlaceholder: 'Eine Reise, ein Start, die Ferien…',
      am: 'AM',
      pm: 'PM',
      days: 'Tage',
      hoursCap: 'Stunden',
      minutes: 'Minuten',
      secondsCap: 'Sekunden',
      until: 'Bis {when}',
      pick: 'Wähl ein Datum und eine Uhrzeit für den Countdown.',
      reached: 'Es ist so weit.',
      fullscreen: 'Vollbild',
      close: 'Schließen',
      lockOn: 'Im Vollbild bleibt der Bildschirm an, und die Uhr rückt jede Minute ein paar Pixel weiter, damit sich nichts einbrennt. Esc beendet es.',
      lockOff: 'Dieser Browser kann den Bildschirm nicht anlassen: halt ihn selbst wach. Im Vollbild rückt die Uhr jede Minute ein paar Pixel weiter. Esc beendet es.',
      spokenLeft: 'noch {d} Tage, {t}',
    },
  });

  // The mode, the face and the countdown's date and time are kept; the label is not.
  const o = remember('clock', { mode: 'clock' as 'clock' | 'countdown', hours: '' as '' | '12' | '24', seconds: false, date: true, day: '', at: '' });
  let label = $state('');

  // A date pasted on the home: the countdown to it (its time too, if it has one; else midnight).
  const handed = untrack(() => texts(items))
    .map((s) => handedIn(s))
    .find((x) => x !== null);
  if (handed)
    untrack(() => {
      o.mode = 'countdown';
      o.day = handed.date;
      o.at = handed.time || '00:00';
    });

  const device = deviceCycle();
  const cycle = $derived<Cycle>(o.hours === '12' ? 12 : o.hours === '24' ? 24 : device);

  // ── The tick: on every whole second, reading the time each time ────────────────────────────

  let now = $state(Date.now());

  $effect(() => {
    let id: ReturnType<typeof setTimeout>;
    const next = () => {
      now = Date.now();
      id = setTimeout(next, 1000 - (Date.now() % 1000));
    };
    id = setTimeout(next, 1000 - (Date.now() % 1000));
    // A background tab's timers slow down: catch up as it shows again.
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(id);
      next();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', back);
    };
  });

  // Reduced motion: the cards change without the flip.
  let still = $state(false);
  $effect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    still = q.matches;
    const on = () => (still = q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  });

  // ── The face ───────────────────────────────────────────────────────────────────────────────

  interface Group {
    id: string;
    chars: string;
    caption: string;
  }

  const target = $derived(targetOf(o.day, o.at));
  const left = $derived(countdown(target, now));
  const hasTarget = $derived(Number.isFinite(target));

  const groups = $derived.by<Group[]>(() => {
    if (o.mode === 'clock') {
      const f = faceAt(now, cycle, o.seconds);
      const period = f.period ? w(f.period) : '';
      return f.groups.map((chars, i) => ({ id: 'hms'[i], chars, caption: i === 0 ? period : '' }));
    }
    const caps = [w('days'), w('hoursCap'), w('minutes'), w('secondsCap')];
    const parts = hasTarget ? countdownGroups(left) : [' ', '  ', '  ', '  '];
    return parts.map((chars, i) => ({ id: 'dhms'[i], chars, caption: caps[i] }));
  });

  const dateLine = $derived.by(() => {
    if (o.mode === 'clock') return o.date ? new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now) : '';
    if (!hasTarget) return w('pick');
    const when = new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: cycle === 12 }).format(target);
    return w('until', { when });
  });

  const done = $derived(o.mode === 'countdown' && hasTarget && left.done);
  const title = $derived(o.mode === 'countdown' ? label.trim() : '');

  // Sizes, in card widths, for the stylesheet: across (one row) and stacked (a phone upright, staged).
  const GAP = 0.08;
  const SEP = 0.42;
  const CARD = 1.42;
  const sizes = $derived.by(() => {
    const cards = groups.reduce((n, g) => n + g.chars.length, 0);
    const across = cards + groups.reduce((n, g) => n + (g.chars.length - 1) * GAP, 0) + (groups.length - 1) * SEP;
    const widest = Math.max(...groups.map((g) => g.chars.length));
    const cols = widest + (widest - 1) * GAP;
    // Heights, in card widths: a caption line and its gap, the date line, the label (one or two
    // lines), the message at zero, each with the board's gap; a little to spare.
    const caption = groups.some((g) => g.caption) ? 0.3 : 0;
    const extra = (dateLine ? 0.42 : 0) + (title ? (title.length > 24 ? 0.9 : 0.52) : 0) + (done ? 0.58 : 0) + 0.1;
    return {
      across: across.toFixed(3),
      cols: cols.toFixed(3),
      tall: (CARD + caption + extra).toFixed(3),
      stackedTall: (groups.length * (CARD + caption) + (groups.length - 1) * 0.16 + extra).toFixed(3),
    };
  });

  const spoken = $derived.by(() => {
    if (o.mode === 'clock') {
      const [h, m, s] = groups.map((g) => g.chars.trim());
      return `${h}:${m}${s ? `:${s}` : ''}${groups[0].caption ? ` ${groups[0].caption}` : ''}`;
    }
    if (!hasTarget) return w('pick');
    if (done) return w('reached');
    return w('spokenLeft', { d: left.days, t: `${groups[1].chars}:${groups[2].chars}:${groups[3].chars}` });
  });

  // ── Full screen ────────────────────────────────────────────────────────────────────────────

  let staged = $state(false);
  let dial = $state<HTMLDivElement>();
  let opener = $state<HTMLButtonElement>();
  let shift = $state({ x: 0, y: 0 });
  let controls = $state(true);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let unlock: (() => void) | null = null;
  const awake = new Awake();
  const canLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  function stage() {
    if (staged || !dial) return;
    staged = true;
    // Straight from the tap, as the browser asks.
    if (canFullscreen()) void enterFullscreen(dial);
    unlock = lockScroll();
    void awake.set(true);
    nudge();
    reveal();
    dial.focus({ preventScroll: true });
  }

  function unstage() {
    if (!staged) return;
    staged = false;
    clearTimeout(idleTimer);
    controls = true;
    shift = { x: 0, y: 0 };
    unlock?.();
    unlock = null;
    void awake.set(false);
    // Focus back on the button once full screen has ended (leaving it drops the focus).
    void exitFullscreen()
      .then(() => tick())
      .then(() => opener?.focus({ preventScroll: true }));
  }

  /** A few pixels somewhere else (decoration: Math.random is fine). */
  function nudge() {
    const r = () => Math.round((Math.random() * 2 - 1) * 8);
    shift = { x: r(), y: r() };
  }

  // Every minute on the stage, the clock moves.
  let minute = 0;
  $effect(() => {
    const m = Math.floor(now / 60_000);
    untrack(() => {
      if (m !== minute && staged) nudge();
      minute = m;
    });
  });

  // A mouse that really moves brings the controls back. Browsers send moves that go nowhere after a
  // scroll, and WebKit gives pointer moves no movementX, so the position is compared.
  let mouseAt = '';
  function mouseMoved(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    const at = `${Math.round(e.clientX)},${Math.round(e.clientY)}`;
    if (at === mouseAt) return;
    const first = !mouseAt;
    mouseAt = at;
    if (!first) reveal();
  }

  /** The close button comes back, and goes again after a while. */
  function reveal() {
    controls = true;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => (controls = false), 3000);
  }

  $effect(() => {
    // Ahead of the page's own keys (capture, on the window), so Esc leaves the stage, not the tool.
    const key = (e: KeyboardEvent) => {
      if (!staged) return;
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        unstage();
      } else if (e.key === 'Tab' && dial) trapTab(e, dial);
    };
    addEventListener('keydown', key, true);
    // Full screen ended by the browser's own means: the stage closes with it.
    const offFs = onFullscreenChange((on) => {
      if (!on) unstage();
    });
    return () => {
      removeEventListener('keydown', key, true);
      offFs();
      clearTimeout(idleTimer);
      unlock?.();
      unlock = null;
      void exitFullscreen();
      awake.destroy();
    };
  });
</script>

<div class="cols">
  <div class="stack">
    <Seg
      large
      label={w('mode')}
      value={o.mode}
      options={[
        { value: 'clock', label: w('clock') },
        { value: 'countdown', label: w('countdown') },
      ]}
      onchange={(m) => (o.mode = m)}
    />

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="dial"
      class:staged
      class:idle={staged && !controls}
      role={staged ? 'dialog' : 'group'}
      aria-modal={staged ? 'true' : undefined}
      aria-label={o.mode === 'clock' ? w('clock') : w('countdown')}
      tabindex={staged ? -1 : undefined}
      bind:this={dial}
      onpointermove={(e) => staged && mouseMoved(e)}
      onpointerdown={() => staged && reveal()}
      style:--across={sizes.across}
      style:--cols={sizes.cols}
      style:--tall={sizes.tall}
      style:--stacked-tall={sizes.stackedTall}
    >
      <div class="board" style:translate={staged ? `${shift.x}px ${shift.y}px` : null}>
        {#if title}<p class="title">{title}</p>{/if}
        <div class="face" class:captioned={groups.some((g) => g.caption)} role="timer" data-face={groups.map((g) => g.chars).join(':')}>
          {#each groups as g, gi (g.id)}
            {#if gi > 0}<i class="sep" aria-hidden="true"></i>{/if}
            <div class="group" data-group={g.id}>
              <div class="cards">
                {#each g.chars.split('') as ch, i (i)}
                  <Flap value={ch} {still} />
                {/each}
              </div>
              {#if g.caption}<small class="cap" aria-hidden="true">{g.caption}</small>{:else if groups.some((x) => x.caption)}<small class="cap" aria-hidden="true">&nbsp;</small>{/if}
            </div>
          {/each}
          <span class="sr">{spoken}</span>
        </div>
        {#if done}<p class="reached"><span>{w('reached')}</span></p>{/if}
        {#if dateLine}<p class="when">{dateLine}</p>{/if}
      </div>
      {#if staged}
        <button type="button" class="shut" class:gone={!controls} aria-label={w('close')} title={w('close')} onclick={unstage}><X aria-hidden="true" /></button>
      {/if}
    </div>

    <button type="button" class="btn ink wide-go" bind:this={opener} onclick={stage}><Maximize aria-hidden="true" />{w('fullscreen')}</button>
    <p class="note">{canLock ? w('lockOn') : w('lockOff')}</p>
  </div>

  <div class="stack">
    <dl class="spec">
      {#if o.mode === 'clock'}
        <div>
          <dt>{w('hours')}</dt>
          <dd>
            <Seg
              label={w('hours')}
              value={String(cycle) as '12' | '24'}
              options={[
                { value: '24', label: w('h24') },
                { value: '12', label: w('h12') },
              ]}
              onchange={(v) => (o.hours = v)}
            />
          </dd>
        </div>
        <div>
          <dt>{w('show')}</dt>
          <dd>
            <Check checked={o.seconds} label={w('seconds')} onchange={(v) => (o.seconds = v)} />
            <Check checked={o.date} label={w('date')} onchange={(v) => (o.date = v)} />
          </dd>
        </div>
      {:else}
        <div>
          <dt><label for="clock-day">{w('date')}</label></dt>
          <dd><input id="clock-day" class="pick" type="date" min="0001-01-01" max="9999-12-31" value={o.day} oninput={(e) => (o.day = e.currentTarget.value)} /></dd>
        </div>
        <div>
          <dt><label for="clock-at">{w('time')}</label></dt>
          <dd><input id="clock-at" class="pick" type="time" value={o.at || '00:00'} oninput={(e) => (o.at = e.currentTarget.value)} /></dd>
        </div>
        <div>
          <dt><label for="clock-label">{w('label')}</label></dt>
          <dd><input id="clock-label" class="field" type="text" autocomplete="off" maxlength="60" placeholder={w('labelPlaceholder')} value={label} oninput={(e) => (label = e.currentTarget.value)} /></dd>
        </div>
      {/if}
    </dl>
  </div>
</div>

<style>
  /* ── The dial: dark in both themes, on the page or over the whole window ── */

  .dial {
    position: relative;
    color-scheme: dark;
    background: var(--sunk);
    color: var(--ink);
    border: 1px solid var(--rule);
    border-radius: 2px;
    padding: 22px 14px 18px;
    container-type: inline-size;
    min-width: 0;
    overflow: hidden;
    outline: none;
    /* A card's width: the row across the frame. */
    --cw: calc(100cqw / var(--across) * 0.98);
  }

  .dial.staged {
    position: fixed;
    inset: 0;
    z-index: 100;
    border: 0;
    border-radius: 0;
    display: grid;
    place-items: center;
    /* Clear of the close button above. */
    padding: calc(env(safe-area-inset-top) + 68px) max(28px, env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom)) max(28px, env(safe-area-inset-left));
    container-type: size;
    touch-action: none;
    overscroll-behavior: contain;
    user-select: none;
    -webkit-user-select: none;
    --cw: min(calc(100cqw / var(--across) * 0.98), calc(100cqh / var(--tall)));
  }

  .dial.idle {
    cursor: none;
  }

  .board {
    display: grid;
    justify-items: center;
    gap: calc(var(--cw) * 0.14);
    min-width: 0;
    transition: translate 1.6s ease;
  }

  .face {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
  }

  .group {
    display: grid;
    justify-items: center;
    gap: calc(var(--cw) * 0.08);
  }

  .cards {
    display: flex;
    gap: calc(var(--cw) * 0.08);
  }

  /* Two dots between the groups, at a third and two thirds of a card. */
  .sep {
    position: relative;
    flex: none;
    width: calc(var(--cw) * 0.42);
    height: calc(var(--cw) * 1.42);
  }

  .sep::before,
  .sep::after {
    content: '';
    position: absolute;
    left: 50%;
    width: calc(var(--cw) * 0.1);
    height: calc(var(--cw) * 0.1);
    translate: -50% -50%;
    background: var(--ink-2);
    border-radius: 1px;
  }

  .sep::before {
    top: 34%;
  }

  .sep::after {
    top: 66%;
  }

  .cap {
    font-family: var(--mono);
    font-size: max(10px, calc(var(--cw) * 0.16));
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-2);
    white-space: nowrap;
  }

  /* At most two lines (the board's height counts on it). */
  .title {
    font-size: max(16px, calc(var(--cw) * 0.3));
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    overflow-wrap: anywhere;
    max-width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .when {
    font-size: max(13px, calc(var(--cw) * 0.2));
    line-height: 1.3;
    color: var(--ink-2);
    text-align: center;
  }

  /* At zero: the one highlighter mark. */
  .reached span {
    display: inline-block;
    font-size: max(16px, calc(var(--cw) * 0.28));
    font-weight: 700;
    padding: 0 0.3em;
    background: var(--mark);
    color: var(--mark-ink);
  }

  /* A phone held upright, on the stage: the groups one under another, as big as they go. (The
     query asks the dial, so the size goes on the board inside it.) */
  @container (orientation: portrait) {
    .dial.staged .board {
      --cw: min(calc(100cqw / var(--cols) * 0.98), calc(100cqh / var(--stacked-tall)));
    }

    .dial.staged .face {
      flex-direction: column;
      align-items: center;
      gap: calc(var(--cw) * 0.16);
    }

    .dial.staged .sep {
      display: none;
    }
  }

  .shut {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    right: max(12px, env(safe-area-inset-right));
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--rule);
    border-radius: 2px;
    background: var(--card);
    color: var(--ink);
    transition: opacity 0.35s ease;
  }

  .shut.gone {
    opacity: 0;
    pointer-events: none;
  }

  .shut :global(svg) {
    width: 18px;
    height: 18px;
  }

  .wide-go {
    min-height: 48px;
    font-size: 16px;
    justify-self: start;
  }

  .wide-go :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* The countdown's date and time: the browser's own pickers, underlined like NumIn. */
  .pick {
    width: 100%;
    max-width: 230px;
    min-width: 0;
    min-height: 40px;
    padding: 2px 0;
    border: 0;
    border-bottom: 2px solid var(--ink);
    border-radius: 0;
    background: none;
    color: var(--ink);
    font-family: var(--sans);
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .pick:focus {
    box-shadow: 0 3px 0 var(--mark);
  }

  .pick::-webkit-date-and-time-value {
    text-align: left;
    min-height: 1.4em;
  }

  .pick::-webkit-calendar-picker-indicator {
    cursor: pointer;
  }
</style>
