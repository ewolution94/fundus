<!--
  F-508 Life in numbers: from a birth date (and the time, if known) the age, the days, weeks, hours
  and seconds alive (ticking), the round numbers coming up, the next birthday and the next round
  one, the age on the other planets, and a poster of a life in weeks to save as PNG (A4, 300 dpi) or
  SVG. The birth date is kept only when asked ("Remember on this device"), like Sign's signature.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Check from '../../components/kit/Check.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Line from '../../components/kit/Line.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import { drawSvg } from '../../lib/svg.ts';
  import { toBlob } from '../../lib/images.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import DateIn from '../dates/DateIn.svelte';
  import { parseDate, ymd, asUtcDate } from '../dates/dates.ts';
  import { counts, nextBirthday, roundBirthday, milestones, around, daysUntil, localDate, planetAges, lifeWeeks, posterSvg, withDpi, parseTime, PRINT, ROWS, COLS, type Count } from './life.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      born: 'Born',
      time: 'Time',
      timeHint: 'If you know it',
      keepLabel: 'Keep',
      keep: 'Remember on this device',
      keepHint: 'Only the birth date and time, in this browser.',
      pickBirth: 'Pick your birth date.',
      notBorn: 'That’s after today: not born yet.',
      age: 'Age',
      'u.years.one': 'year',
      'u.years.other': 'years',
      'u.months.one': 'month',
      'u.months.other': 'months',
      'u.days.one': 'day',
      'u.days.other': 'days',
      'n.months.one': '{n} month',
      'n.months.other': '{n} months',
      'n.days.one': '{n} day',
      'n.days.other': '{n} days',
      'n.weeks.one': '{n} week',
      'n.weeks.other': '{n} weeks',
      'n.hours.one': '{n} hour',
      'n.hours.other': '{n} hours',
      'n.minutes.one': '{n} minute',
      'n.minutes.other': '{n} minutes',
      'mmin.one': '{n} million minutes',
      'mmin.other': '{n} million minutes',
      'bsec.one': '{n} billion seconds',
      'bsec.other': '{n} billion seconds',
      alive: 'Alive',
      days: 'Days',
      weeks: 'Weeks',
      months: 'Months',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
      heartbeats: 'Heartbeats',
      fromMidnight: 'Hours and seconds count from midnight; add the time of birth for more.',
      heartNote: 'Heartbeats at about 70 a minute.',
      nextBirthday: 'Next birthday',
      roundBirthday: 'Next round birthday',
      turns: 'turns {n}',
      date: 'Date',
      until: 'Until then',
      isToday: 'today',
      'in.one': 'in {n} day',
      'in.other': 'in {n} days',
      'ago.one': '{n} day ago',
      'ago.other': '{n} days ago',
      leapling: 'Born on 29 February: in other years the birthday is 28 February.',
      round: 'Round numbers',
      roundNote: 'the last one and the next five',
      last: 'Last',
      planets: 'On other planets',
      planetsNote: 'Your age in each planet’s own years.',
      yrs: '{n} years',
      mercury: 'Mercury',
      venus: 'Venus',
      mars: 'Mars',
      jupiter: 'Jupiter',
      saturn: 'Saturn',
      uranus: 'Uranus',
      neptune: 'Neptune',
      poster: 'Your life in weeks',
      posterOf: '{n} of {total} weeks',
      posterBorn: 'Born {date}',
      legend: 'Each box is a week, each row a year. {n} weeks lived as of {date}.',
      posterAge: 'Age',
      posterWeek: 'Week',
      posterAlt: 'Your life in weeks: {n} of {total} boxes filled, this week marked.',
      format: 'Format',
      pngNote: 'PNG: A4 at 300 dpi. SVG: any size. Ink on white, for printing.',
      failed: 'This browser couldn’t draw the PNG. Save the SVG instead.',
    },
    de: {
      born: 'Geboren',
      time: 'Uhrzeit',
      timeHint: 'Falls du sie weißt',
      keepLabel: 'Merken',
      keep: 'Auf diesem Gerät merken',
      keepHint: 'Nur Geburtsdatum und Uhrzeit, in diesem Browser.',
      pickBirth: 'Wähl dein Geburtsdatum.',
      notBorn: 'Das liegt nach heute: noch nicht geboren.',
      age: 'Alter',
      'u.years.one': 'Jahr',
      'u.years.other': 'Jahre',
      'u.months.one': 'Monat',
      'u.months.other': 'Monate',
      'u.days.one': 'Tag',
      'u.days.other': 'Tage',
      'n.months.one': '{n} Monat',
      'n.months.other': '{n} Monate',
      'n.days.one': '{n} Tag',
      'n.days.other': '{n} Tage',
      'n.weeks.one': '{n} Woche',
      'n.weeks.other': '{n} Wochen',
      'n.hours.one': '{n} Stunde',
      'n.hours.other': '{n} Stunden',
      'n.minutes.one': '{n} Minute',
      'n.minutes.other': '{n} Minuten',
      'mmin.one': '{n} Million Minuten',
      'mmin.other': '{n} Millionen Minuten',
      'bsec.one': '{n} Milliarde Sekunden',
      'bsec.other': '{n} Milliarden Sekunden',
      alive: 'Auf der Welt',
      days: 'Tage',
      weeks: 'Wochen',
      months: 'Monate',
      hours: 'Stunden',
      minutes: 'Minuten',
      seconds: 'Sekunden',
      heartbeats: 'Herzschläge',
      fromMidnight: 'Stunden und Sekunden zählen ab Mitternacht; mit der Uhrzeit wird es genauer.',
      heartNote: 'Herzschläge bei etwa 70 pro Minute.',
      nextBirthday: 'Nächster Geburtstag',
      roundBirthday: 'Nächster runder',
      turns: 'wird {n}',
      date: 'Datum',
      until: 'Bis dahin',
      isToday: 'heute',
      'in.one': 'in {n} Tag',
      'in.other': 'in {n} Tagen',
      'ago.one': 'vor {n} Tag',
      'ago.other': 'vor {n} Tagen',
      leapling: 'Am 29. Februar geboren: in anderen Jahren ist der Geburtstag am 28. Februar.',
      round: 'Runde Zahlen',
      roundNote: 'die letzte und die nächsten fünf',
      last: 'Zuletzt',
      planets: 'Auf anderen Planeten',
      planetsNote: 'Dein Alter in den Jahren des jeweiligen Planeten.',
      yrs: '{n} Jahre',
      mercury: 'Merkur',
      venus: 'Venus',
      mars: 'Mars',
      jupiter: 'Jupiter',
      saturn: 'Saturn',
      uranus: 'Uranus',
      neptune: 'Neptun',
      poster: 'Dein Leben in Wochen',
      posterOf: '{n} von {total} Wochen',
      posterBorn: 'Geboren am {date}',
      legend: 'Jedes Kästchen ist eine Woche, jede Zeile ein Jahr. {n} Wochen gelebt, Stand {date}.',
      posterAge: 'Alter',
      posterWeek: 'Woche',
      posterAlt: 'Dein Leben in Wochen: {n} von {total} Kästchen gefüllt, diese Woche markiert.',
      format: 'Format',
      pngNote: 'PNG: A4 mit 300 dpi. SVG: in jeder Größe. Schwarz auf Weiß, zum Drucken.',
      failed: 'Dieser Browser konnte das PNG nicht zeichnen. Speicher stattdessen das SVG.',
    },
  });

  // The format is kept. The birth date and time only when "Remember on this device" is on.
  const o = remember('life', { keep: false, birth: '', time: '', format: 'png' as 'png' | 'svg' });

  // A date handed in (pasted on the home) goes in; else the kept one, if any.
  const given = untrack(() => texts(items))
    .map((s) => parseDate(s))
    .find((d) => d !== null);
  const kept = untrack(() => (o.keep ? { birth: o.birth, time: o.time } : { birth: '', time: '' }));
  let birth = $state(given ?? kept.birth);
  let time = $state(given ? '' : kept.time);

  // Kept while it's on, and gone the moment it's off.
  $effect(() => {
    const b = birth;
    const t = time;
    const keep = o.keep;
    untrack(() => {
      if (keep) {
        if (o.birth !== b) o.birth = b;
        if (o.time !== t) o.time = t;
      } else if (o.birth || o.time) {
        o.birth = '';
        o.time = '';
      }
    });
  });

  // The seconds tick.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });

  const today = $derived(localDate(now));
  const timeOk = $derived(parseTime(time) !== null);
  const born = $derived(ymd(birth) ? birth : '');
  const c = $derived(born ? counts(born, timeOk ? time : '', now) : null);
  const next = $derived(c ? nextBirthday(born, today) : null);
  const roundDay = $derived(c ? roundBirthday(born, today) : null);
  const list = $derived(born ? milestones(born, timeOk ? time : '') : []);
  const near = $derived(c ? around(list, now) : { last: null, next: [] });
  const planets = $derived(c ? planetAges(c.ms) : []);
  const weeks = $derived(c ? lifeWeeks(born, today) : null);

  const mark = $derived(shared.decimal);
  const int = (n: number) => formatNumber(n, mark, { max: 0 });

  // English as the browser writes it (US or British order), German as Germany does.
  const intl = $derived(locale() === 'de' ? 'de-DE' : navigator.language?.toLowerCase().startsWith('en') ? navigator.language : 'en-GB');
  const midDate = $derived(new Intl.DateTimeFormat(intl, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
  const longDate = $derived(new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
  const shortDate = $derived(new Intl.DateTimeFormat(intl, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }));
  const clock = $derived(new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit' }));
  const mid = (iso: string) => (ymd(iso) ? midDate.format(asUtcDate(iso)) : '–');
  const long = (iso: string) => (ymd(iso) ? longDate.format(asUtcDate(iso)) : '');
  const short = (iso: string) => (ymd(iso) ? shortDate.format(asUtcDate(iso)) : '');

  function relative(days: number) {
    if (days === 0) return w('isToday');
    return days > 0 ? w('in', { n: int(days) }) : w('ago', { n: int(-days) });
  }

  function countLabel(x: Count) {
    if (x.unit === 'seconds') return w('bsec', { n: x.n / 1e9 });
    if (x.unit === 'minutes') return x.n >= 1e6 ? w('mmin', { n: x.n / 1e6 }) : w('n.minutes', { n: int(x.n) });
    return w(`n.${x.unit}`, { n: int(x.n) });
  }

  // ── The poster ───────────────────────────────────────────────────────────────────────────

  const TOTAL = ROWS * COLS;
  const poster = $derived(
    weeks
      ? posterSvg(weeks, {
          title: w('poster'),
          born: w('posterBorn', { date: long(born) }),
          legend: w('legend', { n: int(weeks.lived), date: long(today) }),
          age: w('posterAge'),
          week: w('posterWeek'),
        })
      : '',
  );
  const fileBase = $derived(`life-in-weeks-${born}`);

  let preview = $state('');
  $effect(() => {
    const svg = poster;
    if (!svg) {
      preview = '';
      return;
    }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    preview = url;
    return () => URL.revokeObjectURL(url);
  });

  // The PNG is drawn a moment after the date settles, so Save hands it out straight from the tap.
  let png = $state<Output | null>(null);
  let failed = $state(false);
  $effect(() => {
    const svg = poster;
    const name = fileBase;
    const wanted = o.format === 'png';
    png = null;
    failed = false;
    if (!svg || !wanted) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const canvas = await drawSvg(svg, PRINT.width, PRINT.height, '#ffffff');
        const blob = await toBlob(canvas, 'image/png', 1);
        const bytes = withDpi(new Uint8Array(await blob.arrayBuffer()), PRINT.dpi);
        if (live) png = { blob: new Blob([bytes as BlobPart], { type: 'image/png' }), name: `${name}.png` };
      } catch {
        if (live) failed = true;
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  });

  const outputs = $derived.by((): Output[] | null => {
    if (!poster) return null;
    if (o.format === 'svg') return [{ blob: new Blob([poster], { type: 'image/svg+xml' }), name: `${fileBase}.svg` }];
    return png ? [png] : null;
  });
</script>

<div class="cols">
  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('born')}</dt>
        <dd><DateIn label={w('born')} value={birth} oninput={(v) => (birth = v)} /></dd>
      </div>
      <div>
        <dt>{w('time')}</dt>
        <dd class="time-row">
          <input class="time-in" type="time" aria-label={w('time')} value={time} oninput={(e) => (time = e.currentTarget.value)} />
          <small class="note">{w('timeHint')}</small>
        </dd>
      </div>
      <div>
        <dt>{w('keepLabel')}</dt>
        <dd><Check checked={o.keep} label={w('keep')} hint={w('keepHint')} onchange={(v) => (o.keep = v)} /></dd>
      </div>
    </dl>

    {#if !born}
      <p class="note">{w('pickBirth')}</p>
    {:else if !c}
      <p class="note bad" role="alert">{w('notBorn')}</p>
    {:else}
      <p class="age" data-age>
        <span><b>{int(c.years)}</b> {w('u.years', { n: c.years })}</span>
        <span><b>{int(c.months)}</b> {w('u.months', { n: c.months })}</span>
        <span><b>{int(c.days)}</b> {w('u.days', { n: c.days })}</span>
      </p>

      <Receipt title={w('alive')} aside={short(today)}>
        <Line label={w('days')} value={int(c.totalDays)} copy={String(c.totalDays)} hl total />
        <Line label={w('weeks')} value={int(c.weeks)} copy={String(c.weeks)} />
        <Line label={w('months')} value={int(c.totalMonths)} copy={String(c.totalMonths)} />
        <Line label={w('hours')} value={int(c.hours)} copy={String(c.hours)} />
        <Line label={w('minutes')} value={int(c.minutes)} copy={String(c.minutes)} />
        <Line label={w('seconds')} value={int(c.seconds)} copy={String(c.seconds)} />
        <Line label={w('heartbeats')} value={`≈ ${int(c.heartbeats)}`} copy={null} />
      </Receipt>
      <p class="note">{w('heartNote')}{#if !timeOk}{` ${w('fromMidnight')}`}{/if}</p>

      {#if next}
        <Receipt title={w('nextBirthday')} aside={w('turns', { n: next.turns })}>
          <Line label={w('date')} value={mid(next.date)} copy={short(next.date)} />
          <Line label={w('until')} value={relative(next.inDays)} copy={String(next.inDays)} />
        </Receipt>
      {/if}
      {#if roundDay && roundDay.turns !== next?.turns}
        <Receipt title={w('roundBirthday')} aside={w('turns', { n: roundDay.turns })}>
          <Line label={w('date')} value={mid(roundDay.date)} copy={short(roundDay.date)} />
          <Line label={w('until')} value={relative(roundDay.inDays)} copy={String(roundDay.inDays)} />
        </Receipt>
      {/if}
      {#if born.endsWith('-02-29')}<p class="note">{w('leapling')}</p>{/if}
    {/if}
  </div>

  <div class="stack">
    {#if c}
      <section class="stack" aria-labelledby="life-round">
        <h2 class="h" id="life-round">{w('round')}<em>{w('roundNote')}</em></h2>
        <ol class="miles">
          {#if near.last}
            {@const m = near.last}
            <li class="gone" data-mile="last">
              <span class="what"><small class="m">{w('last')}</small>{m.counts.map(countLabel).join(' · ')}</span>
              <span class="when">{relative(daysUntil(m.date, today))}</span>
              <span class="date m">{mid(m.date)}{#if m.timed && timeOk}{`, ${clock.format(m.at)}`}{/if}</span>
            </li>
          {/if}
          {#each near.next as m, i (m.at + m.date + m.counts[0].unit)}
            <li data-mile={i}>
              <span class="what">{#if i === 0}<span class="hl">{m.counts.map(countLabel).join(' · ')}</span>{:else}{m.counts.map(countLabel).join(' · ')}{/if}</span>
              <span class="when">{relative(daysUntil(m.date, today))}</span>
              <span class="date m">{mid(m.date)}{#if m.timed && timeOk}{`, ${clock.format(m.at)}`}{/if}</span>
            </li>
          {/each}
        </ol>
      </section>

      <Receipt title={w('planets')}>
        {#each planets as p (p.id)}
          <Line label={w(p.id)} value={w('yrs', { n: formatNumber(p.age, mark, { min: 2, max: 2 }) })} copy={null} />
        {/each}
      </Receipt>
      <p class="note">{w('planetsNote')}</p>
    {/if}

    {#if weeks && preview}
      <section class="stack" aria-labelledby="life-poster">
        <h2 class="h" id="life-poster">{w('poster')}<em>{w('posterOf', { n: int(weeks.lived), total: int(TOTAL) })}</em></h2>
        <figure class="plate">
          <div class="frame paper"><img src={preview} alt={w('posterAlt', { n: int(weeks.lived), total: int(TOTAL) })} /></div>
        </figure>
        <dl class="spec">
          <div>
            <dt>{w('format')}</dt>
            <dd>
              <Seg
                label={w('format')}
                value={o.format}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'svg', label: 'SVG' },
                ]}
                onchange={(v) => (o.format = v)}
              />
            </dd>
          </div>
        </dl>
        <SaveButton {outputs} busy={o.format === 'png' && !png && !failed} tool={tool.id} />
        {#if failed}<p class="note bad" role="alert">{w('failed')}</p>{/if}
        <p class="note">{w('pngNote')}</p>
      </section>
    {/if}
  </div>
</div>

<style>
  .time-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 12px;
  }

  .time-in {
    flex: 0 1 140px;
    min-width: 0;
    width: 140px;
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

  .time-in:focus {
    box-shadow: 0 3px 0 var(--mark);
  }

  .time-in::-webkit-date-and-time-value {
    text-align: left;
    min-height: 1.4em;
  }

  .age {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 16px;
    padding: 6px 0 2px;
    font-size: 17px;
    font-weight: 600;
  }

  .age b {
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .miles {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .miles li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 12px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .miles .what {
    font-size: 15px;
    font-weight: 700;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .miles .what .hl {
    padding: 0 4px;
  }

  .miles .what small {
    margin-right: 8px;
    color: var(--ink-2);
    text-transform: uppercase;
    font-size: 10px;
    font-weight: 400;
  }

  .miles .when {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    text-align: right;
  }

  .miles .date {
    grid-column: 1 / -1;
    color: var(--ink-2);
  }

  .miles .gone .what,
  .miles .gone .when {
    color: var(--ink-2);
    font-weight: 600;
  }

  /* The poster is paper, whatever the theme. */
  .paper {
    background: var(--sunk);
    padding: 14px;
  }

  .paper img {
    border: 1px solid var(--rule);
    max-height: min(70vh, 720px);
  }
</style>
