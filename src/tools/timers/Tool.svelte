<!--
  F-506 Timers: several named timers at once and a stopwatch with laps. Every time shown comes
  from timestamps (when a timer ends, when the stopwatch started), so a background tab or a
  reload loses nothing: running timers and the stopwatch are kept with their end and start times.
  While something runs the screen stays on (Wake Lock), the tab's title shows the nearest timer,
  and at zero a timer beeps (Web Audio), flashes and says so.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Play, Pause, RotateCcw, X, Flag, Square } from '@lucide/svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import { words, pick } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import {
    parseDuration,
    clock,
    watchClock,
    timer,
    start,
    pause,
    reset,
    remaining,
    due,
    ring,
    nearest,
    nextEnd,
    watch as newWatch,
    go,
    stop,
    lap,
    elapsed,
    laps,
    fastest,
    readTimers,
    readWatch,
    type Timer,
    type Watch,
  } from './timers.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      name: 'Name',
      namePlaceholder: 'Tea, pasta, a break…',
      time: 'Time',
      minutes: '{n} min',
      hours: '{n} h',
      seconds: '{n} s',
      startN: 'Start a {n} minute timer',
      typedLabel: 'Minutes, or m:ss',
      orType: 'Or type: 7, 1:30, 1:02:03',
      start: 'Start',
      pause: 'Pause',
      resume: 'Resume',
      reset: 'Reset',
      remove: 'Remove {name}',
      timers: 'Timers',
      none: 'No timers yet: pick a time above.',
      running: '{n} running',
      doneShort: 'Done',
      isDone: '{name} is done.',
      doneTitle: 'Done: {name}',
      bad: 'Not a time: try 5, 1:30 or 1:02:03.',
      stopwatch: 'Stopwatch',
      lap: 'Lap',
      laps: 'Laps',
      stop: 'Stop',
      lapN: 'Lap {n}',
      fastest: 'Fastest',
      lockOn: 'The screen stays on while something runs.',
      lockOff: 'This browser can’t keep the screen on: keep it awake yourself.',
      lockDenied: 'The browser didn’t let the screen stay on: it may turn off.',
      sound: 'At zero a timer beeps, flashes and says so. Keep the sound on.',
    },
    de: {
      name: 'Name',
      namePlaceholder: 'Tee, Nudeln, eine Pause…',
      time: 'Zeit',
      minutes: '{n} Min.',
      hours: '{n} Std.',
      seconds: '{n} Sek.',
      startN: 'Einen Timer über {n} Minuten starten',
      typedLabel: 'Minuten, oder m:ss',
      orType: 'Oder tippen: 7, 1:30, 1:02:03',
      start: 'Start',
      pause: 'Pause',
      resume: 'Weiter',
      reset: 'Zurücksetzen',
      remove: '{name} entfernen',
      timers: 'Timer',
      none: 'Noch keine Timer: wähl oben eine Zeit.',
      running: '{n} laufen',
      doneShort: 'Fertig',
      isDone: '{name} ist fertig.',
      doneTitle: 'Fertig: {name}',
      bad: 'Keine Zeit: versuch 5, 1:30 oder 1:02:03.',
      stopwatch: 'Stoppuhr',
      lap: 'Runde',
      laps: 'Runden',
      stop: 'Stopp',
      lapN: 'Runde {n}',
      fastest: 'Schnellste',
      lockOn: 'Der Bildschirm bleibt an, solange etwas läuft.',
      lockOff: 'Dieser Browser kann den Bildschirm nicht anlassen: halt ihn selbst wach.',
      lockDenied: 'Der Browser lässt den Bildschirm nicht an: er kann ausgehen.',
      sound: 'Bei null piept ein Timer, blinkt und sagt es. Lass den Ton an.',
    },
  });

  const PRESETS = [1, 3, 5, 10, 15, 25];

  // The timers and the stopwatch, with their end and start times, are kept: they're what lets a
  // running timer survive a reload. (The names come along; nothing else typed does.)
  const o = remember('timers', { list: [] as Timer[], watch: newWatch() as Watch });
  untrack(() => {
    o.list = readTimers(o.list);
    o.watch = readWatch(o.watch);
  });

  let now = $state(Date.now());
  let name = $state('');
  let typed = $state('');
  let error = $state('');
  let said = $state('');

  // A length handed in ("5", "1:30") waits in the field.
  const given = untrack(() => texts(items)).find((s) => Number.isFinite(parseDuration(s)));
  if (given) typed = given.trim();

  // ── Sound: a beep pattern made on the spot (no audio file). The context starts from a tap
  //    (iOS allows nothing else), so every Start unlocks it.
  let audio: AudioContext | null = null;
  function unlock() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio && Ctx) audio = new Ctx();
      if (audio?.state === 'suspended') void audio.resume().catch(() => {});
    } catch {
      audio = null;
    }
  }

  function beep() {
    if (!audio) return;
    try {
      const t0 = audio.currentTime + 0.05;
      // Three groups of three short beeps.
      for (let k = 0; k < 3; k++) {
        for (let j = 0; j < 3; j++) {
          const at = t0 + k * 0.8 + j * 0.17;
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = 'sine';
          osc.frequency.value = 1046.5;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.35, at + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
          osc.connect(gain).connect(audio.destination);
          osc.start(at);
          osc.stop(at + 0.13);
        }
      }
    } catch {}
  }

  // ── Timers ─────────────────────────────────────────────────────────────────────────────────

  function add(length: number, label: string) {
    unlock();
    const at = Date.now();
    o.list = [...o.list, start(timer(name.trim() || label, length), at)];
    name = '';
    typed = '';
    error = '';
    now = at;
  }

  /** A length in words, for a timer nobody named: "1 h 30 min", "45 s". */
  function spoken(ms: number) {
    const s = Math.round(ms / 1000);
    const parts: string[] = [];
    if (s >= 3600) parts.push(w('hours', { n: Math.floor(s / 3600) }));
    if (s % 3600 >= 60) parts.push(w('minutes', { n: Math.floor((s % 3600) / 60) }));
    if (s % 60) parts.push(w('seconds', { n: s % 60 }));
    return parts.join(' ');
  }

  function addTyped(e: SubmitEvent) {
    e.preventDefault();
    const ms = parseDuration(typed);
    if (!Number.isFinite(ms)) {
      error = w('bad');
      return;
    }
    add(ms, spoken(ms));
  }

  function update(id: string, fn: (t: Timer) => Timer) {
    o.list = o.list.map((t) => (t.id === id ? fn(t) : t));
  }

  function toggle(t: Timer) {
    unlock();
    const at = Date.now();
    update(t.id, (x) => (x.end !== null ? pause(x, at) : start(x, at)));
    now = at;
  }

  /** The time now, and any timer that just reached zero rings. */
  function check() {
    const at = Date.now();
    now = at;
    const rung = untrack(() => o.list.filter((t) => due(t, at)));
    if (!rung.length) return;
    o.list = untrack(() => o.list.map((t) => (due(t, at) ? ring(t) : t)));
    said = rung.map((t) => w('isDone', { name: t.name })).join(' ');
    beep();
    // A phone buzzes too, once someone has tapped the page (browsers refuse it before).
    try {
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([200, 100, 200, 100, 200]);
    } catch {}
  }

  // Timers that ended while the page was closed ring as it opens (silently: no tap yet).
  untrack(check);

  const timersRun = $derived(o.list.some((t) => t.end !== null));
  const watchRuns = $derived(o.watch.start !== null);
  const busy = $derived(timersRun || watchRuns);

  // The clock on screen: every frame while the stopwatch runs, four times a second for timers.
  $effect(() => {
    if (!busy) return;
    let frame = 0;
    if (watchRuns) {
      const loop = () => {
        now = Date.now();
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }
    const id = setInterval(check, 250);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  });

  // And a wake-up for the next end, in case the interval is slowed in a background tab.
  const soonest = $derived(nextEnd(o.list));
  $effect(() => {
    if (soonest === null) return;
    const id = setTimeout(check, Math.max(0, soonest - Date.now()) + 5);
    return () => clearTimeout(id);
  });

  // ── The screen stays on ────────────────────────────────────────────────────────────────────

  let lockNote = $state<'' | 'on' | 'off' | 'denied'>('');
  let sentinel: WakeLockSentinel | null = null;

  async function keepAwake(on: boolean) {
    if (!on) {
      lockNote = '';
      const s = sentinel;
      sentinel = null;
      try {
        await s?.release();
      } catch {}
      return;
    }
    if (!('wakeLock' in navigator)) {
      lockNote = 'off';
      return;
    }
    if (sentinel || document.visibilityState !== 'visible') return;
    try {
      const s = await navigator.wakeLock.request('screen');
      sentinel = s;
      lockNote = 'on';
      // The browser lets it go when the tab is hidden; visibilitychange takes it back.
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      lockNote = 'denied';
    }
  }

  $effect(() => {
    void keepAwake(busy);
  });

  $effect(() => {
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      check();
      if (untrack(() => busy)) void keepAwake(true);
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      void keepAwake(false);
    };
  });

  // ── The tab's title: the nearest timer ─────────────────────────────────────────────────────

  // The page's own title comes back when nothing runs, and when the page is left (unless someone
  // else has set one since).
  let set = '';
  $effect(() => {
    const base = `${pick(tool.name)} · Fundus`;
    const next = nearest(o.list, now);
    const rang = o.list.find((t) => t.done);
    set = next ? `${clock(remaining(next, now))} ${next.name} · Fundus` : rang ? `${w('doneTitle', { name: rang.name })} · Fundus` : base;
    if (document.title !== set) document.title = set;
  });
  $effect(() => () => {
    if (document.title === set) document.title = `${pick(tool.name)} · Fundus`;
  });

  // ── The stopwatch ──────────────────────────────────────────────────────────────────────────

  const shown = $derived(elapsed(o.watch, now));
  const lapList = $derived(laps(o.watch));
  const best = $derived(fastest(lapList));

  function startStop() {
    const at = Date.now();
    o.watch = o.watch.start === null ? go(o.watch, at) : stop(o.watch, at);
    now = at;
  }

  function lapOrReset() {
    const at = Date.now();
    o.watch = o.watch.start !== null ? lap(o.watch, at) : newWatch();
    now = at;
  }
</script>

<!-- A clock's colons and points sit closer than its (equal-width) digits. -->
{#snippet digits(text: string)}{#each text.split(/([:.])/) as part, i (i)}{#if part === ':' || part === '.'}<i class="sep">{part}</i>{:else}{part}{/if}{/each}{/snippet}

<div class="cols">
  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('name')}</dt>
        <dd><input class="field" type="text" autocomplete="off" aria-label={w('name')} placeholder={w('namePlaceholder')} maxlength="80" value={name} oninput={(e) => (name = e.currentTarget.value)} /></dd>
      </div>
      <div>
        <dt>{w('time')}</dt>
        <dd>
          <div class="presets">
            {#each PRESETS as p (p)}
              <button type="button" class="btn" aria-label={w('startN', { n: p })} onclick={() => add(p * 60_000, w('minutes', { n: p }))}>{w('minutes', { n: p })}</button>
            {/each}
          </div>
          <small class="m own" aria-hidden="true">{w('orType')}</small>
          <form class="typed" onsubmit={addTyped}>
            <NumIn label={w('typedLabel')} value={typed} size="mid" width="170px" inputmode="text" oninput={(s) => ((typed = s), (error = ''))} />
            <button type="submit" class="btn ink"><Play aria-hidden="true" />{w('start')}</button>
          </form>
          {#if error}<span class="note bad" role="alert">{error}</span>{/if}
        </dd>
      </div>
    </dl>

    <h2 class="h">{w('timers')}{#if timersRun}<em>{w('running', { n: o.list.filter((t) => t.end !== null).length })}</em>{/if}</h2>
    {#each o.list as t (t.id)}
      {@const left = remaining(t, now)}
      {@const on = t.end !== null}
      <article class="timer" class:on class:rang={t.done} aria-label={t.name} data-timer={t.name}>
        <div class="top">
          <b>{t.name}</b>
          <small class="m">{clock(t.length)}</small>
        </div>
        <div class="face">
          <span class="left">{@render digits(clock(left))}</span>
          {#if t.done}<span class="tag">{w('doneShort')}</span>{/if}
        </div>
        <div class="bar" aria-hidden="true"><i style:transform={`scaleX(${t.length ? left / t.length : 0})`}></i></div>
        <div class="acts">
          <button type="button" class="btn" onclick={() => toggle(t)}>
            {#if on}<Pause aria-hidden="true" />{w('pause')}{:else}<Play aria-hidden="true" />{t.left < t.length && !t.done ? w('resume') : w('start')}{/if}
          </button>
          <button type="button" class="btn" disabled={!on && !t.done && t.left === t.length} onclick={() => update(t.id, reset)}><RotateCcw aria-hidden="true" />{w('reset')}</button>
          <button type="button" class="x" aria-label={w('remove', { name: t.name })} title={w('remove', { name: t.name })} onclick={() => (o.list = o.list.filter((x) => x.id !== t.id))}><X aria-hidden="true" /></button>
        </div>
      </article>
    {:else}
      <p class="note">{w('none')}</p>
    {/each}
  </div>

  <div class="stack">
    <section class="stack sw" aria-labelledby="sw-title">
      <h2 class="h" id="sw-title">{w('stopwatch')}</h2>
      <div class="watch" class:on={watchRuns}>
        <span class="left">{@render digits(watchClock(shown))}</span>
      </div>
      <div class="acts wide-acts">
        <button type="button" class="btn ink" onclick={startStop}>
          {#if watchRuns}<Square aria-hidden="true" />{w('stop')}{:else}<Play aria-hidden="true" />{shown > 0 ? w('resume') : w('start')}{/if}
        </button>
        <button type="button" class="btn" disabled={!watchRuns && shown === 0} onclick={lapOrReset}>
          {#if watchRuns}<Flag aria-hidden="true" />{w('lap')}{:else}<RotateCcw aria-hidden="true" />{w('reset')}{/if}
        </button>
      </div>
      {#if lapList.length}
        <ol class="laps" aria-label={w('laps')}>
          {#each lapList as l (l.n)}
            <li data-lap={l.n}>
              <span class="lab">{w('lapN', { n: l.n })}{#if best === l.n}<small class="m">{w('fastest')}</small>{/if}</span>
              <span class="time" class:best={best === l.n}>{watchClock(l.time)}</span>
              <span class="total m">{watchClock(l.total)}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    {#if lockNote === 'on'}<p class="note">{w('lockOn')}</p>{:else if lockNote === 'off'}<p class="note">{w('lockOff')}</p>{:else if lockNote === 'denied'}<p class="note">{w('lockDenied')}</p>{/if}
    <p class="note">{w('sound')}</p>
  </div>
</div>
<p class="sr" aria-live="assertive">{said}</p>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .presets .btn {
    min-width: 64px;
    min-height: 40px;
  }

  .typed {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    margin-top: 2px;
    width: 100%;
  }

  .own {
    display: block;
    margin-top: 12px;
    color: var(--ink-2);
    font-size: 11px;
  }

  .sep {
    font-style: normal;
    margin: 0 -0.1em;
  }

  .typed .btn,
  .acts .btn {
    min-height: 40px;
  }

  .timer {
    display: grid;
    gap: 6px;
    padding: 10px 12px 12px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    min-width: 0;
  }

  .timer:not(.on):not(.rang) .left {
    color: var(--ink-2);
  }

  /* At zero: the highlighter blinks a few times, then stays. */
  .timer.rang {
    background: var(--mark);
    color: var(--mark-ink);
    animation: ring 0.5s steps(1) 8;
  }

  @keyframes ring {
    50% {
      background: var(--card);
      color: var(--ink);
    }
  }

  .timer.rang :is(.btn, small, .x) {
    color: var(--mark-ink);
    border-color: var(--mark-ink);
    background: transparent;
  }

  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }

  .top b {
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .top small {
    color: var(--ink-2);
    flex: none;
  }

  .face {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .left {
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .tag {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    border: 1px solid currentColor;
    padding: 2px 6px;
  }

  .bar {
    height: 4px;
    background: var(--sunk);
    overflow: hidden;
  }

  .bar i {
    display: block;
    height: 100%;
    background: var(--ink);
    transform-origin: left;
  }

  .acts {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .acts .btn :global(svg),
  .typed .btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .x {
    margin-left: auto;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--ink-2);
  }

  .x :global(svg) {
    width: 18px;
    height: 18px;
  }

  .watch {
    padding: 14px 0 6px;
  }

  .watch .left {
    font-size: 56px;
  }

  .watch:not(.on) .left {
    color: var(--ink-2);
  }

  .wide-acts .btn {
    flex: 1 1 0;
    max-width: 200px;
  }

  .laps {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1.5px solid var(--ink);
  }

  .laps li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 14px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .laps .lab {
    font-size: 15px;
    font-weight: 600;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .laps .lab small {
    color: var(--ink-2);
    text-transform: uppercase;
    font-size: 10px;
  }

  .laps .time {
    font-family: var(--mono);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .laps .time.best {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 5px;
  }

  .laps .total {
    color: var(--ink-2);
  }
</style>
