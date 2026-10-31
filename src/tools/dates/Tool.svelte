<!--
  F-501 Dates & weeks: days between two dates, a date plus or minus days, weeks or months, the
  weekday, the calendar week (ISO or US, from the Week setting) and age. Today is the home time
  zone's. A date pasted on the home goes into the first field.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Line from '../../components/kit/Line.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import { words, locale, t } from '../../lib/i18n.svelte.ts';
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { parseNumber, formatNumber } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import DateIn from './DateIn.svelte';
  import { parseDate, todayIn, between, add, weekOf, weeksIn, dayOfYear, age, toDays, asUtcDate, ymd, type Step } from './dates.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Find',
      between: 'Days between',
      add: 'Plus, minus',
      weekday: 'Weekday',
      week: 'Calendar week',
      age: 'Age',
      from: 'From',
      to: 'To',
      date: 'Date',
      birthday: 'Birthday',
      today: 'Today',
      direction: 'Direction',
      plus: 'Plus',
      minus: 'Minus',
      amount: 'Amount',
      unit: 'Unit',
      days: 'Days',
      weeks: 'Weeks',
      months: 'Months',
      years: 'Years',
      workdays: 'Working days',
      system: 'Weeks',
      iso: 'Monday, ISO',
      us: 'Sunday, US',
      nowIso: 'Every tool now counts ISO weeks from Monday',
      nowUs: 'Every tool now counts US weeks from Sunday',
      result: 'Result',
      daysBetween: 'Days',
      withEnd: 'With the end day',
      workdaysLine: 'Working days, Mon–Fri',
      weeksDays: 'Weeks and days',
      backwards: 'The end comes before the start: counted backwards.',
      bothCounted: 'Working days count both dates.',
      pickTo: 'Pick the end date.',
      pickDate: 'Pick a date.',
      pickBirthday: 'Pick the birthday.',
      typeAmount: 'Type how many.',
      whole: 'Whole numbers only: 1, 2, 3 …',
      tooFar: 'That’s past the years 1 to 9999.',
      dayDiff: 'Days from the start',
      weekdayLine: 'Weekday',
      calendarWeek: 'Calendar week',
      dayOfYear: 'Day of the year',
      ofYear: '{n} of {total}',
      fromToday: 'From today',
      isToday: 'today',
      weekN: 'Week {n}',
      weekOfYear: 'Week {n} of {year}',
      firstDay: 'First day',
      lastDay: 'Last day',
      weeksInYear: 'Weeks in {year}',
      isoNote: 'ISO 8601: weeks start on Monday; week 1 holds the year’s first Thursday.',
      usNote: 'US: weeks start on Sunday; week 1 holds 1 January.',
      ageLine: 'Age',
      daysAlive: 'Days alive',
      nextBirthday: 'Next birthday',
      nextIn: 'Until then',
      birthdayToday: 'Today: turns {n}',
      turns: 'turns {n}',
      leapling: 'Born on 29 February: in other years the birthday is 28 February.',
      notBorn: 'That’s after today: not born yet.',
      todayIs: 'Today is {date} in {zone}, the home time zone from Settings.',
      'n.days.one': '{n} day',
      'n.days.other': '{n} days',
      'n.weeks.one': '{n} week',
      'n.weeks.other': '{n} weeks',
      'n.months.one': '{n} month',
      'n.months.other': '{n} months',
      'n.years.one': '{n} year',
      'n.years.other': '{n} years',
      'in.one': 'in {n} day',
      'in.other': 'in {n} days',
      'ago.one': '{n} day ago',
      'ago.other': '{n} days ago',
    },
    de: {
      mode: 'Gesucht',
      between: 'Tage dazwischen',
      add: 'Plus, minus',
      weekday: 'Wochentag',
      week: 'Kalenderwoche',
      age: 'Alter',
      from: 'Von',
      to: 'Bis',
      date: 'Datum',
      birthday: 'Geburtstag',
      today: 'Heute',
      direction: 'Richtung',
      plus: 'Plus',
      minus: 'Minus',
      amount: 'Anzahl',
      unit: 'Einheit',
      days: 'Tage',
      weeks: 'Wochen',
      months: 'Monate',
      years: 'Jahre',
      workdays: 'Werktage',
      system: 'Wochen',
      iso: 'Montag, ISO',
      us: 'Sonntag, US',
      nowIso: 'Jedes Werkzeug zählt jetzt ISO-Wochen ab Montag',
      nowUs: 'Jedes Werkzeug zählt jetzt US-Wochen ab Sonntag',
      result: 'Ergebnis',
      daysBetween: 'Tage',
      withEnd: 'Mit dem letzten Tag',
      workdaysLine: 'Werktage, Mo–Fr',
      weeksDays: 'Wochen und Tage',
      backwards: 'Das Ende liegt vor dem Anfang: rückwärts gezählt.',
      bothCounted: 'Werktage zählen beide Daten mit.',
      pickTo: 'Wähl das Enddatum.',
      pickDate: 'Wähl ein Datum.',
      pickBirthday: 'Wähl den Geburtstag.',
      typeAmount: 'Gib an, wie viele.',
      whole: 'Nur ganze Zahlen: 1, 2, 3 …',
      tooFar: 'Das liegt außerhalb der Jahre 1 bis 9999.',
      dayDiff: 'Tage ab dem Start',
      weekdayLine: 'Wochentag',
      calendarWeek: 'Kalenderwoche',
      dayOfYear: 'Tag im Jahr',
      ofYear: '{n} von {total}',
      fromToday: 'Ab heute',
      isToday: 'heute',
      weekN: 'KW {n}',
      weekOfYear: 'KW {n} in {year}',
      firstDay: 'Erster Tag',
      lastDay: 'Letzter Tag',
      weeksInYear: 'Wochen in {year}',
      isoNote: 'ISO 8601: Wochen beginnen am Montag; KW 1 enthält den ersten Donnerstag des Jahres.',
      usNote: 'US: Wochen beginnen am Sonntag; Woche 1 enthält den 1. Januar.',
      ageLine: 'Alter',
      daysAlive: 'Tage auf der Welt',
      nextBirthday: 'Nächster Geburtstag',
      nextIn: 'Bis dahin',
      birthdayToday: 'Heute: wird {n}',
      turns: 'wird {n}',
      leapling: 'Am 29. Februar geboren: in anderen Jahren ist der Geburtstag am 28. Februar.',
      notBorn: 'Das liegt nach heute: noch nicht geboren.',
      todayIs: 'Heute ist {date} in {zone}, der eigenen Zeitzone aus den Einstellungen.',
      'n.days.one': '{n} Tag',
      'n.days.other': '{n} Tage',
      'n.weeks.one': '{n} Woche',
      'n.weeks.other': '{n} Wochen',
      'n.months.one': '{n} Monat',
      'n.months.other': '{n} Monate',
      'n.years.one': '{n} Jahr',
      'n.years.other': '{n} Jahre',
      'in.one': 'in {n} Tag',
      'in.other': 'in {n} Tagen',
      'ago.one': 'vor {n} Tag',
      'ago.other': 'vor {n} Tagen',
    },
  });

  type Mode = 'between' | 'add' | 'weekday' | 'week' | 'age';
  // The sum and how it's set are kept; the dates and the amount are not.
  const o = remember('dates', { mode: 'between' as Mode, dir: 'plus' as 'plus' | 'minus', step: 'days' as Step });

  // Today, in the home zone; looked at again each minute (a tab left open past midnight).
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(id);
  });
  const today = $derived(todayIn(shared.homeZone, now));

  // A date from the home goes into the first field of the sum that's open.
  const given = untrack(() => texts(items))
    .map((s) => parseDate(s))
    .find((d) => d !== null);
  let a = $state(given && untrack(() => o.mode) !== 'age' ? given : untrack(() => todayIn(shared.homeZone)));
  let b = $state('');
  let birth = $state(given && untrack(() => o.mode) === 'age' ? given : '');
  let amount = $state('');

  const mark = $derived(shared.decimal);
  const int = (n: number) => formatNumber(n, mark, { max: 0 });
  const plural = (key: 'n.days' | 'n.weeks' | 'n.months' | 'n.years', n: number) => w(key, { n: int(n) });

  // English as the browser writes it (US or British order), German as Germany does.
  const intl = $derived(locale() === 'de' ? 'de-DE' : navigator.language?.toLowerCase().startsWith('en') ? navigator.language : 'en-GB');
  const longDate = $derived(new Intl.DateTimeFormat(intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
  // In a receipt line, which doesn't wrap: short enough for a phone.
  const midDate = $derived(new Intl.DateTimeFormat(intl, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
  const shortDate = $derived(new Intl.DateTimeFormat(intl, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }));
  const dayName = $derived(new Intl.DateTimeFormat(intl, { weekday: 'long', timeZone: 'UTC' }));
  const long = (iso: string) => (ymd(iso) ? longDate.format(asUtcDate(iso)) : '–');
  const mid = (iso: string) => (ymd(iso) ? midDate.format(asUtcDate(iso)) : '–');
  const short = (iso: string) => (ymd(iso) ? shortDate.format(asUtcDate(iso)) : '');

  const relative = (iso: string) => {
    const d = toDays(iso) - toDays(today);
    if (d === 0) return w('isToday');
    return d > 0 ? w('in', { n: int(d) }) : w('ago', { n: int(-d) });
  };

  const span = $derived(o.mode === 'between' && ymd(a) && ymd(b) ? between(a, b) : null);

  const typed = $derived(parseNumber(amount));
  const added = $derived.by(() => {
    if (o.mode !== 'add' || !ymd(a)) return { date: null, error: '' };
    if (!amount.trim()) return { date: null, error: w('typeAmount') };
    if (!Number.isFinite(typed)) return { date: null, error: w('whole') };
    if (!Number.isInteger(typed)) return { date: null, error: w('whole') };
    const date = add(a, o.dir === 'minus' ? -typed : typed, o.step);
    return date ? { date, error: '' } : { date: null, error: w('tooFar') };
  });

  const week = $derived(ymd(a) ? weekOf(a, shared.week) : null);
  const years = $derived(o.mode === 'age' && ymd(birth) ? age(birth, today) : null);

  function setWeek(v: 'iso' | 'us') {
    setShared('week', v, v === 'iso' ? w('nowIso') : w('nowUs'), t('tool.undo'));
  }
</script>

<div class="dates">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'between', label: w('between') },
      { value: 'add', label: w('add') },
      { value: 'weekday', label: w('weekday') },
      { value: 'week', label: w('week') },
      { value: 'age', label: w('age') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols">
    <dl class="spec">
      {#if o.mode === 'age'}
        <div>
          <dt>{w('birthday')}</dt>
          <dd><DateIn label={w('birthday')} value={birth} oninput={(v) => (birth = v)} /></dd>
        </div>
      {:else}
        <div>
          <dt>{o.mode === 'between' || o.mode === 'add' ? w('from') : w('date')}</dt>
          <dd><DateIn label={o.mode === 'between' || o.mode === 'add' ? w('from') : w('date')} value={a} {today} todayLabel={w('today')} oninput={(v) => (a = v)} /></dd>
        </div>
      {/if}
      {#if o.mode === 'between'}
        <div>
          <dt>{w('to')}</dt>
          <dd><DateIn label={w('to')} value={b} {today} todayLabel={w('today')} oninput={(v) => (b = v)} /></dd>
        </div>
      {:else if o.mode === 'add'}
        <div>
          <dt>{w('direction')}</dt>
          <dd>
            <Seg
              label={w('direction')}
              value={o.dir}
              options={[
                { value: 'plus', label: `+ ${w('plus')}` },
                { value: 'minus', label: `− ${w('minus')}` },
              ]}
              onchange={(v) => (o.dir = v)}
            />
          </dd>
        </div>
        <div>
          <dt>{w('amount')}</dt>
          <dd><NumIn label={w('amount')} value={amount} size="mid" width="140px" inputmode="numeric" oninput={(s) => (amount = s)} /></dd>
        </div>
        <div>
          <dt>{w('unit')}</dt>
          <dd>
            <Seg
              label={w('unit')}
              value={o.step}
              options={[
                { value: 'days', label: w('days') },
                { value: 'weeks', label: w('weeks') },
                { value: 'months', label: w('months') },
                { value: 'years', label: w('years') },
                { value: 'workdays', label: w('workdays') },
              ]}
              onchange={(v) => (o.step = v)}
            />
          </dd>
        </div>
      {:else if o.mode === 'week'}
        <div>
          <dt>{w('system')}</dt>
          <dd>
            <Seg
              label={w('system')}
              value={shared.week}
              options={[
                { value: 'iso', label: w('iso') },
                { value: 'us', label: w('us') },
              ]}
              onchange={setWeek}
            />
            <SharedNote chip="numbers" />
          </dd>
        </div>
      {/if}
    </dl>

    <div class="stack">
      {#if o.mode === 'between'}
        {#if !ymd(a)}
          <p class="note">{w('pickDate')}</p>
        {:else if !span}
          <p class="note">{w('pickTo')}</p>
        {:else}
          <Receipt title={w('result')} aside={`${short(a)} → ${short(b)}`}>
            <Line label={w('daysBetween')} value={int(span.days)} copy={String(span.days)} hl total />
            <Line label={w('withEnd')} value={int(span.backwards ? -span.inclusive : span.inclusive)} copy={String(span.backwards ? -span.inclusive : span.inclusive)} />
            <Line label={w('workdaysLine')} value={int(span.workdays)} copy={String(span.workdays)} />
            <Line label={w('weeksDays')} value={`${plural('n.weeks', span.weeks)}, ${plural('n.days', span.rest)}`} copy={null} />
          </Receipt>
          {#if span.backwards}<p class="note">{w('backwards')}</p>{/if}
          <p class="note">{w('bothCounted')}</p>
        {/if}
      {:else if o.mode === 'add'}
        {#if !ymd(a)}
          <p class="note">{w('pickDate')}</p>
        {:else if !added.date}
          <p class="note" class:bad={added.error !== w('typeAmount')} role={added.error !== w('typeAmount') ? 'alert' : undefined}>{added.error}</p>
        {:else}
          {@const wk = weekOf(added.date, shared.week)}
          <Receipt title={w('result')} aside={`${short(a)} ${o.dir === 'minus' ? '−' : '+'} ${int(Math.abs(typed))} ${w(o.step)}`}>
            <Line label={w('date')} value={mid(added.date)} copy={short(added.date)} hl total />
            <Line label={w('calendarWeek')} value={wk ? w('weekOfYear', { n: wk.week, year: wk.year }) : '–'} copy={wk ? String(wk.week) : null} />
            <Line label={w('dayDiff')} value={int(toDays(added.date) - toDays(a))} copy={String(toDays(added.date) - toDays(a))} />
            <Line label={w('fromToday')} value={relative(added.date)} copy={null} />
          </Receipt>
        {/if}
      {:else if o.mode === 'weekday'}
        {#if !ymd(a)}
          <p class="note">{w('pickDate')}</p>
        {:else}
          {@const y = ymd(a)!.y}
          <Receipt title={w('result')} aside={short(a)}>
            <Line label={w('weekdayLine')} value={dayName.format(asUtcDate(a))} copy={null} hl total />
            <Line label={w('date')} value={mid(a)} copy={short(a)} />
            <Line label={w('dayOfYear')} value={w('ofYear', { n: dayOfYear(a), total: dayOfYear(`${String(y).padStart(4, '0')}-12-31`) })} copy={String(dayOfYear(a))} />
            <Line label={w('calendarWeek')} value={week ? w('weekOfYear', { n: week.week, year: week.year }) : '–'} copy={week ? String(week.week) : null} />
            <Line label={w('fromToday')} value={relative(a)} copy={null} />
          </Receipt>
          <p class="note">{w('todayIs', { date: long(today), zone: shared.homeZone })}</p>
        {/if}
      {:else if o.mode === 'week'}
        {#if !week}
          <p class="note">{w('pickDate')}</p>
        {:else}
          <Receipt title={w('result')} aside={shared.week === 'iso' ? 'ISO 8601' : 'US'}>
            <Line label={w('calendarWeek')} value={w('weekOfYear', { n: week.week, year: week.year })} copy={String(week.week)} hl total />
            <Line label={w('firstDay')} value={mid(week.first)} copy={short(week.first)} />
            <Line label={w('lastDay')} value={mid(week.last)} copy={short(week.last)} />
            <Line label={w('weeksInYear', { year: week.year })} value={String(weeksIn(week.year, shared.week))} copy={null} />
          </Receipt>
          <p class="note">{shared.week === 'iso' ? w('isoNote') : w('usNote')}</p>
        {/if}
      {:else if !ymd(birth)}
        <p class="note">{w('pickBirthday')}</p>
      {:else if !years}
        <p class="note bad" role="alert">{w('notBorn')}</p>
      {:else}
        <Receipt title={w('ageLine')} aside={`${plural('n.years', years.years)}, ${plural('n.months', years.months)}, ${plural('n.days', years.days)}`}>
          <Line label={w('years')} value={int(years.years)} copy={String(years.years)} hl total />
          <Line label={w('months')} value={int(years.months)} copy={String(years.months)} />
          <Line label={w('days')} value={int(years.days)} copy={String(years.days)} />
          <Line label={w('daysAlive')} value={int(years.total)} copy={String(years.total)} />
        </Receipt>
        <Receipt title={w('nextBirthday')} aside={years.nextIn === 0 ? w('birthdayToday', { n: years.turns }) : w('turns', { n: years.turns })}>
          <Line label={w('date')} value={mid(years.next)} copy={short(years.next)} />
          <Line label={w('nextIn')} value={years.nextIn === 0 ? w('isToday') : plural('n.days', years.nextIn)} copy={String(years.nextIn)} />
        </Receipt>
        {#if years.leapling}<p class="note">{w('leapling')}</p>{/if}
        <p class="note">{w('todayIs', { date: long(today), zone: shared.homeZone })}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .dates {
    display: grid;
    gap: 18px;
  }
</style>
