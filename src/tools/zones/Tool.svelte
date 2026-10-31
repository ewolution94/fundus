<!--
  F-504 Time zones: the time in the places chosen, ticking each minute, and a time that suits
  both: pick a time at home and see it everywhere, with each place's day as a strip of 24 home
  hours, its working hours (9–17) filled and the hours everyone is at work marked. Home is the
  home time zone from Settings. The places chosen are kept.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { X } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { wall, offsetAt, zonedToUtc, offsetLabel, diffLabel, placeById, placeForZone, search, strip, overlap, runs, status, usable, type Place, type Status, type Hour } from './zones.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      show: 'Show',
      now: 'Now',
      pick: 'Pick a time',
      add: 'Add',
      addLabel: 'Add a place',
      placeholder: 'City, country or zone',
      foundLabel: 'Places found',
      noMatch: 'No place or zone called “{q}”.',
      date: 'Date',
      time: 'Time',
      timeAt: 'Time at home',
      home: 'Home',
      homeNote: '{zone}, the home time zone from Settings',
      places: 'Places',
      nowAt: 'Now',
      atHome: '{time} at home',
      empty: 'Add a place to compare: a city, a country or a zone.',
      remove: 'Remove {name}',
      work: 'at work',
      morning: 'morning',
      evening: 'evening',
      night: 'night',
      yesterday: 'yesterday',
      tomorrow: 'tomorrow',
      overlap: 'Everyone at work',
      overlapAt: 'Everyone is at work {list}, your time.',
      noOverlap: 'No hour when everyone is at work (9–17 there).',
      pickRun: 'Pick {time}',
      hours: 'Working hours 9–17, on the home clock',
      badTime: 'Pick a date and a time.',
    },
    de: {
      show: 'Zeigen',
      now: 'Jetzt',
      pick: 'Zeit wählen',
      add: 'Dazu',
      addLabel: 'Ort hinzufügen',
      placeholder: 'Stadt, Land oder Zone',
      foundLabel: 'Gefundene Orte',
      noMatch: 'Kein Ort und keine Zone namens „{q}“.',
      date: 'Datum',
      time: 'Uhrzeit',
      timeAt: 'Uhrzeit zu Hause',
      home: 'Zu Hause',
      homeNote: '{zone}, die eigene Zeitzone aus den Einstellungen',
      places: 'Orte',
      nowAt: 'Jetzt',
      atHome: '{time} zu Hause',
      empty: 'Füg einen Ort zum Vergleichen hinzu: eine Stadt, ein Land oder eine Zone.',
      remove: '{name} entfernen',
      work: 'bei der Arbeit',
      morning: 'Morgen',
      evening: 'Abend',
      night: 'Nacht',
      yesterday: 'gestern',
      tomorrow: 'morgen',
      overlap: 'Alle bei der Arbeit',
      overlapAt: 'Alle sind {list} bei der Arbeit, deine Zeit.',
      noOverlap: 'Keine Stunde, in der alle arbeiten (dort 9–17 Uhr).',
      pickRun: '{time} wählen',
      hours: 'Arbeitszeit 9–17 Uhr, auf der Uhr von zu Hause',
      badTime: 'Wähl ein Datum und eine Uhrzeit.',
    },
  });

  // Which places and whether it's now or a picked time are kept; the picked time is not.
  const o = remember('zones', { mode: 'now' as 'now' | 'pick', places: [] as string[] });

  const lang = $derived(locale());
  const home = $derived(usable(shared.homeZone) ?? 'UTC');
  const homePlace = $derived(placeForZone(home));
  const places = $derived(o.places.map(placeById).filter((p): p is Place => p !== null));

  // The clock, read again at each full minute (and when the tab comes back).
  let now = $state(Date.now());
  $effect(() => {
    let id: ReturnType<typeof setTimeout>;
    const next = () => {
      now = Date.now();
      id = setTimeout(next, 60_000 - (Date.now() % 60_000) + 20);
    };
    id = setTimeout(next, 60_000 - (Date.now() % 60_000) + 20);
    const back = () => {
      if (!document.hidden) now = Date.now();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', back);
    };
  });

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDay = (t: number, zone: string) => {
    const x = wall(zone, t);
    return `${x.y}-${pad(x.m)}-${pad(x.d)}`;
  };

  // The picked time starts at the next full hour at home.
  const start = untrack(() => now + 3_600_000);
  let pickDate = $state(untrack(() => isoDay(start, home)));
  let pickTime = $state(untrack(() => `${pad(wall(home, start).h)}:00`));
  // A time handed in ("15:30") opens the picker with it.
  const givenTime = untrack(() => texts(items))
    .map((s) => /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(s))
    .find((m) => m && Number(m[1]) < 24 && Number(m[2]) < 60);
  if (givenTime) {
    pickTime = `${pad(Number(givenTime[1]))}:${givenTime[2]}`;
    o.mode = 'pick';
  }

  const picked = $derived.by(() => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pickDate);
    const t = /^(\d{1,2}):(\d{2})/.exec(pickTime);
    return d && t ? zonedToUtc(pickDate, Number(t[1]), Number(t[2]), home) : NaN;
  });
  const at = $derived(o.mode === 'pick' && Number.isFinite(picked) ? picked : now);
  const day = $derived(isoDay(at, home));

  // Times as the language writes them (8:00 AM in US English, 08:00 elsewhere).
  const intl = $derived(lang === 'de' ? 'de-DE' : navigator.language?.toLowerCase().startsWith('en') ? navigator.language : 'en-GB');
  const twelve = $derived(/h1[12]/.test(new Intl.DateTimeFormat(intl, { hour: 'numeric' }).resolvedOptions().hourCycle ?? ''));
  const timeIn = (t: number, zone: string) => new Intl.DateTimeFormat(intl, { hour: twelve ? 'numeric' : '2-digit', minute: '2-digit', timeZone: zone }).format(t);
  const weekdayIn = (t: number, zone: string) => new Intl.DateTimeFormat(intl, { weekday: 'short', timeZone: zone }).format(t);

  const countryName = $derived.by(() => {
    const names = (l: string) => {
      try {
        return new Intl.DisplayNames([l], { type: 'region' });
      } catch {
        return null;
      }
    };
    const en = names('en');
    const de = names('de');
    return (code: string) => (code ? [en?.of(code) ?? code, de?.of(code) ?? code] : []);
  });
  const country = (p: Place) => (p.country ? countryName(p.country)[lang === 'de' ? 1 : 0] : p.zone);

  const allZones = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return [] as string[];
    }
  })();

  let query = $state('');
  const found = $derived(search(query, countryName, allZones));

  function addPlace(p: Place) {
    if (!o.places.includes(p.id) && p.id !== homePlace.id) o.places = [...o.places, p.id];
    query = '';
  }

  function removePlace(id: string) {
    o.places = o.places.filter((x) => x !== id);
  }

  interface Row {
    place: Place;
    home: boolean;
    time: string;
    offset: string;
    diff: string;
    dayShift: number;
    weekday: string;
    status: Status;
    hours: Hour[];
  }

  const rows = $derived.by((): Row[] => {
    const homeOffset = offsetAt(home, at);
    return [{ place: homePlace, home: true }, ...places.map((place) => ({ place, home: false }))].map(({ place, home: isHome }) => {
      const zone = isHome ? home : place.zone;
      const off = offsetAt(zone, at);
      const x = wall(zone, at);
      const there = Date.UTC(x.y, x.m - 1, x.d);
      const here = Date.parse(`${day}T00:00:00Z`);
      return {
        place,
        home: isHome,
        time: timeIn(at, zone),
        offset: offsetLabel(off),
        diff: diffLabel(off - homeOffset),
        dayShift: Math.round((there - here) / 86_400_000),
        weekday: weekdayIn(at, zone),
        status: status(x.h + x.min / 60),
        hours: strip(day, home, zone),
      };
    });
  });

  const common = $derived(rows.length < 2 ? null : overlap(rows.map((r) => r.hours)));
  const commonRuns = $derived(common ? runs(common) : []);
  const hourAt = (h: number) => zonedToUtc(day, h % 24, 0, home) + (h >= 24 ? 86_400_000 : 0);
  const runText = (r: [number, number]) => `${timeIn(hourAt(r[0]), home)}–${timeIn(hourAt(r[1]), home)}`;

  // Where the time sits on the home day: 0 to 1.
  const homeWall = $derived(wall(home, at));
  const position = $derived((homeWall.h + homeWall.min / 60) / 24);

  function pickRun(r: [number, number]) {
    pickDate = day;
    pickTime = `${pad(r[0])}:00`;
    o.mode = 'pick';
  }

  function keys(e: KeyboardEvent) {
    if (e.key === 'Enter' && found.length) {
      e.preventDefault();
      addPlace(found[0]);
    } else if (e.key === 'Escape') query = '';
  }
</script>

<div class="zones">
  <Seg
    large
    label={w('show')}
    value={o.mode}
    options={[
      { value: 'now', label: w('now') },
      { value: 'pick', label: w('pick') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols">
    <dl class="spec">
      <div>
        <dt>{w('add')}</dt>
        <dd class="finder">
          <input
            class="field"
            type="text"
            enterkeyhint="done"
            autocomplete="off"
            spellcheck="false"
            aria-label={w('addLabel')}
            placeholder={w('placeholder')}
            value={query}
            oninput={(e) => (query = e.currentTarget.value)}
            onkeydown={keys}
          />
          {#if query.trim()}
            {#if found.length}
              <ul class="found" aria-label={w('foundLabel')}>
                {#each found as p (p.id)}
                  <li>
                    <button type="button" onclick={() => addPlace(p)}>
                      <b>{p.name[lang]}</b>
                      <small>{p.country ? `${country(p)} · ` : ''}{offsetLabel(offsetAt(p.zone, at))}</small>
                    </button>
                  </li>
                {/each}
              </ul>
            {:else}
              <span class="note">{w('noMatch', { q: query.trim() })}</span>
            {/if}
          {/if}
        </dd>
      </div>
      {#if o.mode === 'pick'}
        <div>
          <dt>{w('date')}</dt>
          <dd><input class="when" type="date" aria-label={w('date')} value={pickDate} oninput={(e) => (pickDate = e.currentTarget.value)} /></dd>
        </div>
        <div>
          <dt>{w('timeAt')}</dt>
          <dd>
            <input class="when" type="time" aria-label={w('timeAt')} value={pickTime} oninput={(e) => (pickTime = e.currentTarget.value)} />
            {#if !Number.isFinite(picked)}<span class="note bad" role="alert">{w('badTime')}</span>{/if}
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('home')}</dt>
        <dd>
          <span class="note">{w('homeNote', { zone: home })}</span>
          <SharedNote chip="numbers" />
        </dd>
      </div>
    </dl>

    <section class="stack" aria-label={w('places')}>
      <h2 class="h">{w('places')} <em>{o.mode === 'now' ? w('nowAt') : w('atHome', { time: timeIn(at, home) })}</em></h2>
      <ul class="rows">
        {#each rows as r (r.place.id)}
          <li class="row" class:home={r.home} data-place={r.place.id}>
            <div class="who">
              <b>{r.place.name[lang]}{#if r.home}<span class="tag m">{w('home')}</span>{/if}</b>
              <small>{country(r.place)} · {r.offset}{r.home ? '' : ` · ${r.diff}`}</small>
            </div>
            <div class="clock">
              <b class="t">{#each r.time.split(/(:)/) as part, i (i)}{#if part === ':'}<i class="sep">:</i>{:else}{part}{/if}{/each}</b>
              <small>{r.dayShift < 0 ? w('yesterday') : r.dayShift > 0 ? w('tomorrow') : r.weekday} · {w(r.status)}</small>
            </div>
            {#if !r.home}
              <button type="button" class="x" aria-label={w('remove', { name: r.place.name[lang] })} title={w('remove', { name: r.place.name[lang] })} onclick={() => removePlace(r.place.id)}><X aria-hidden="true" /></button>
            {:else}
              <span></span>
            {/if}
            <div class="strip" aria-hidden="true">
              {#each r.hours as h (h.home)}<i class:on={h.working}></i>{/each}
              <span class="at" style:left={`${position * 100}%`}></span>
            </div>
          </li>
        {/each}
      </ul>

      {#if common}
        <div class="row both">
          <div class="who"><b>{w('overlap')}</b></div>
          <div class="strip" aria-hidden="true">
            {#each Array.from({ length: 24 }, (_, h) => h) as h (h)}<i class:hit={common.includes(h)}></i>{/each}
            <span class="at" style:left={`${position * 100}%`}></span>
          </div>
        </div>
        <div class="scale m" aria-hidden="true"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
        {#if commonRuns.length}
          <p class="note" aria-live="polite">{w('overlapAt', { list: commonRuns.map(runText).join(', ') })}</p>
          <div class="picks">
            {#each commonRuns as r (r[0])}
              <button type="button" class="btn small" onclick={() => pickRun(r)}>{w('pickRun', { time: timeIn(hourAt(r[0]), home) })}</button>
            {/each}
          </div>
        {:else}
          <p class="note" aria-live="polite">{w('noOverlap')}</p>
        {/if}
        <p class="note">{w('hours')}</p>
      {:else}
        <p class="note">{w('empty')}</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .zones {
    display: grid;
    gap: 18px;
  }

  .finder {
    width: 100%;
  }

  .finder .field {
    max-width: 360px;
  }

  .found {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 360px;
    border: 1.5px solid var(--ink);
    background: var(--card);
  }

  .found li + li {
    border-top: 1px solid var(--rule);
  }

  .found button {
    display: grid;
    width: 100%;
    min-height: 44px;
    padding: 6px 10px;
    text-align: left;
  }

  .found b {
    font-size: 15px;
    font-weight: 600;
  }

  .found small {
    font-size: 12px;
    color: var(--ink-2);
  }

  @media (hover: hover) and (pointer: fine) {
    .found button:hover {
      background: var(--sunk);
    }
  }

  .when {
    min-height: 40px;
    padding: 2px 0;
    border: 0;
    border-bottom: 2px solid var(--ink);
    border-radius: 0;
    background: none;
    color: var(--ink);
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    max-width: 230px;
    width: 100%;
  }

  .when:focus {
    box-shadow: 0 3px 0 var(--mark);
  }

  .when::-webkit-date-and-time-value {
    text-align: left;
    min-height: 1.4em;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 36px;
    gap: 4px 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
  }

  .row.both {
    grid-template-columns: minmax(0, 1fr);
    border-bottom: 0;
    padding-bottom: 0;
  }

  .who {
    min-width: 0;
  }

  .who b {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .tag {
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .who small,
  .clock small {
    display: block;
    font-size: 12px;
    color: var(--ink-2);
  }

  .clock {
    text-align: right;
  }

  .t {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* The colon sits closer than the equal-width digits. */
  .sep {
    font-style: normal;
    margin: 0 -0.1em;
  }

  .x {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    color: var(--ink-2);
  }

  .x :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* 24 home hours; working hours there in ink, the hours everyone works under the highlighter. */
  .strip {
    grid-column: 1 / -1;
    position: relative;
    display: grid;
    grid-template-columns: repeat(24, minmax(0, 1fr));
    gap: 1px;
    height: 14px;
  }

  .strip i {
    background: var(--sunk);
    border: 1px solid var(--rule);
  }

  .strip i.on {
    background: var(--ink-2);
    border-color: var(--ink-2);
  }

  .strip i.hit {
    background: var(--mark);
    border-color: var(--mark);
  }

  .at {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    background: var(--ink);
  }

  .scale {
    display: flex;
    justify-content: space-between;
    color: var(--ink-2);
    font-size: 10px;
  }

  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
