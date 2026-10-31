<!--
  F-904 Timestamps: a Unix time to a date, or a date to its Unix time. Seconds, milliseconds,
  microseconds or nanoseconds are told apart by size (or picked); each result in the home zone
  (Settings) and in UTC, as ISO 8601, RFC 2822, a readable form and "3 days ago". With nothing
  typed it shows now, live. Logic in stamp.ts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import Row from './Row.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { parseStamp, parseDate, typedToInstant, inUnit, iso, rfc2822, readable, relative, offsetAt, offsetText, wallAt, validZone, zoneCity, type Unit, type Instant, type Wall } from './stamp.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      toDate: 'Unix time → date',
      toStamp: 'Date → Unix time',
      unix: 'Unix time',
      receipt: 'Timestamp',
      unit: 'Unit',
      auto: 'Auto',
      readAs: 'Read as {unit}',
      unitS: 'seconds',
      unitMs: 'milliseconds',
      unitUs: 'microseconds',
      unitNs: 'nanoseconds',
      date: 'Date and time',
      pick: 'Pick a date and time',
      datePh: '2026-10-31 21:20',
      dateHint: 'Like 2026-10-31 21:20 or 31.10.2026 21:20; Z or +01:00 at the end sets its own offset.',
      zone: 'Typed in',
      ownOffset: 'Its own offset counts: {offset}.',
      gap: 'The clocks in {zone} skip this time that day: read as {shifted}.',
      twice: 'This time happens twice that day in {zone}, as the clocks go back: this is the first.',
      now: 'Now',
      use: 'Use',
      live: 'now, live',
      rowS: 'Seconds',
      rowMs: 'Milliseconds',
      rowUs: 'Microseconds',
      rowNs: 'Nanoseconds',
      relative: 'Relative',
      iso: 'ISO 8601',
      rfc: 'RFC 2822',
      readable: 'Readable',
      homeNote: 'Home zone {zone}, from Settings.',
      emptyStamp: 'Showing now. Type a Unix time to read another.',
      emptyDate: 'Showing now. Type a date and time to get its Unix time.',
      nan: 'That’s not a Unix time: digits, perhaps with a minus or a decimal point.',
      range: 'Out of range: dates go from the year −271821 to 275760.',
      format: 'Not a date this reads. Try 2026-10-31 21:20 or 31.10.2026 21:20.',
      invalid: 'That date or time doesn’t exist: a 13th month, a 31 April, 25 o’clock?',
    },
    de: {
      mode: 'Modus',
      toDate: 'Unix-Zeit → Datum',
      toStamp: 'Datum → Unix-Zeit',
      unix: 'Unix-Zeit',
      receipt: 'Zeitstempel',
      unit: 'Einheit',
      auto: 'Auto',
      readAs: 'Gelesen als {unit}',
      unitS: 'Sekunden',
      unitMs: 'Millisekunden',
      unitUs: 'Mikrosekunden',
      unitNs: 'Nanosekunden',
      date: 'Datum und Uhrzeit',
      pick: 'Datum und Uhrzeit wählen',
      datePh: '31.10.2026 21:20',
      dateHint: 'Etwa 31.10.2026 21:20 oder 2026-10-31 21:20; Z oder +01:00 am Ende setzt den eigenen Versatz.',
      zone: 'Getippt in',
      ownOffset: 'Sein eigener Versatz zählt: {offset}.',
      gap: 'Die Uhren in {zone} überspringen diese Uhrzeit an dem Tag: gelesen als {shifted}.',
      twice: 'Diese Uhrzeit gibt es an dem Tag in {zone} zweimal, die Uhren werden zurückgestellt: hier die erste.',
      now: 'Jetzt',
      use: 'Übernehmen',
      live: 'jetzt, live',
      rowS: 'Sekunden',
      rowMs: 'Millisekunden',
      rowUs: 'Mikrosekunden',
      rowNs: 'Nanosekunden',
      relative: 'Relativ',
      iso: 'ISO 8601',
      rfc: 'RFC 2822',
      readable: 'Lesbar',
      homeNote: 'Heimatzone {zone}, aus den Einstellungen.',
      emptyStamp: 'Zu sehen ist jetzt. Tipp eine Unix-Zeit, um eine andere zu lesen.',
      emptyDate: 'Zu sehen ist jetzt. Tipp Datum und Uhrzeit für die Unix-Zeit.',
      nan: 'Das ist keine Unix-Zeit: Ziffern, vielleicht mit Minus oder Dezimalpunkt.',
      range: 'Außerhalb des Bereichs: Daten gehen vom Jahr −271821 bis 275760.',
      format: 'Kein Datum, das sich lesen lässt. Versuch 31.10.2026 21:20 oder 2026-10-31 21:20.',
      invalid: 'Dieses Datum oder diese Uhrzeit gibt es nicht: ein 13. Monat, ein 31. April, 25 Uhr?',
    },
  });

  // The mode, the unit and the zone typed in are kept; what was typed is not.
  const o = remember('stamp', { mode: 'toDate' as 'toDate' | 'toStamp', unit: 'auto' as Unit | 'auto', zone: 'home' as 'home' | 'utc' });

  let stampText = $state('');
  let dateText = $state('');

  // Now, on the second.
  let now = $state(Date.now());
  $effect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      now = Date.now();
      timer = setTimeout(tick, 1005 - (now % 1000));
    };
    timer = setTimeout(tick, 1005 - (Date.now() % 1000));
    return () => clearTimeout(timer);
  });

  const home = $derived(validZone(shared.homeZone));
  const homeIsUtc = $derived(home === 'UTC' || home === 'Etc/UTC');
  const typedZone = $derived(o.zone === 'utc' || homeIsUtc ? 'UTC' : home);

  const stamp = $derived(o.mode === 'toDate' ? parseStamp(stampText, o.unit) : null);
  const typed = $derived(o.mode === 'toStamp' ? parseDate(dateText) : null);
  const fromTyped = $derived(typed?.ok ? typedToInstant(typed, typedZone) : null);
  /** Nothing typed: now, ticking. */
  const live = $derived(o.mode === 'toDate' ? stamp === null : typed === null);
  const instant = $derived<Instant | null>(live ? { ms: now, sub: 0, digits: 0 } : stamp?.ok ? stamp.instant : (fromTyped?.instant ?? null));
  const problem = $derived(stamp && !stamp.ok ? w(stamp.code) : typed && !typed.ok ? w(typed.code) : '');

  const UNIT_WORD = { s: 'unitS', ms: 'unitMs', us: 'unitUs', ns: 'unitNs' } as const;
  const ROW_WORD = { s: 'rowS', ms: 'rowMs', us: 'rowUs', ns: 'rowNs' } as const;
  const fine = $derived(stamp?.ok && (stamp.unit === 'us' || stamp.unit === 'ns') ? stamp.unit : null);

  const p2 = (n: number) => String(n).padStart(2, '0');
  const wallText = (x: Wall, seconds = true) => `${String(x.year).padStart(4, '0')}-${p2(x.month)}-${p2(x.day)} ${p2(x.hour)}:${p2(x.minute)}${seconds ? `:${p2(x.second)}` : ''}`;
  /** What the native picker shows: the typed wall time, when it has no offset of its own. */
  const pickerValue = $derived(typed?.ok && typed.offset === null && typed.wall.year >= 1 && typed.wall.year <= 9999 ? wallText(typed.wall).replace(' ', 'T') : '');

  function useNow() {
    const at = Date.now();
    if (o.mode === 'toDate') stampText = String(Math.floor(at / 1000));
    else dateText = wallText(wallAt(at, typedZone));
  }

  // What was pasted on the home: a Unix time to read, or a date to turn into one.
  const given = untrack(() => texts(items)[0]?.trim());
  if (given) {
    if (parseStamp(given, 'auto')?.ok) {
      o.mode = 'toDate';
      stampText = given;
    } else if (parseDate(given)?.ok) {
      o.mode = 'toStamp';
      dateText = given;
    } else if (o.mode === 'toDate') stampText = given;
    else dateText = given;
  }
</script>

<div class="stamp">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'toDate', label: w('toDate') },
      { value: 'toStamp', label: w('toStamp') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols even">
    <div class="stack">
      <dl class="spec">
        {#if o.mode === 'toDate'}
          <div>
            <dt>{w('unix')}</dt>
            <dd><NumIn label={w('unix')} value={stampText} width="380px" inputmode="decimal" oninput={(v) => (stampText = v)} /></dd>
          </div>
          <div>
            <dt>{w('unit')}</dt>
            <dd>
              <Seg
                label={w('unit')}
                value={o.unit}
                options={[
                  { value: 'auto', label: w('auto') },
                  { value: 's', label: 's', title: w('unitS') },
                  { value: 'ms', label: 'ms', title: w('unitMs') },
                  { value: 'us', label: 'µs', title: w('unitUs') },
                  { value: 'ns', label: 'ns', title: w('unitNs') },
                ]}
                onchange={(u) => (o.unit = u)}
              />
              {#if stamp?.ok}<span class="note">{w('readAs', { unit: w(UNIT_WORD[stamp.unit]) })}</span>{/if}
            </dd>
          </div>
        {:else}
          <div>
            <dt>{w('date')}</dt>
            <dd>
              <div class="typed">
                <input class="field" type="text" aria-label={w('date')} placeholder={w('datePh')} autocomplete="off" spellcheck="false" bind:value={dateText} />
                <input class="pick" type="datetime-local" step="1" aria-label={w('pick')} value={pickerValue} onchange={(e) => (dateText = e.currentTarget.value.replace('T', ' '))} />
              </div>
              <span class="note">{w('dateHint')}</span>
            </dd>
          </div>
          {#if !homeIsUtc}
            <div>
              <dt>{w('zone')}</dt>
              <dd>
                <Seg
                  label={w('zone')}
                  value={o.zone}
                  options={[
                    { value: 'home', label: zoneCity(home), title: home },
                    { value: 'utc', label: 'UTC' },
                  ]}
                  onchange={(z) => (o.zone = z)}
                />
                {#if typed?.ok && typed.offset !== null}<span class="note">{w('ownOffset', { offset: offsetText(typed.offset) })}</span>{/if}
              </dd>
            </div>
          {/if}
        {/if}
        <div>
          <dt>{w('now')}</dt>
          <dd>
            <div class="now">
              <code aria-live="off">{Math.floor(now / 1000)}</code>
              <CopyButton text={String(Math.floor(now / 1000))} />
              <button type="button" class="btn small" onclick={useNow}>{w('use')}</button>
            </div>
          </dd>
        </div>
      </dl>
      <p class="note">{w('homeNote', { zone: home })}</p>
    </div>

    <div class="stack results">
      {#if problem}
        <p class="error" role="alert">{problem}</p>
      {:else if instant}
        {#if live}<p class="note">{o.mode === 'toDate' ? w('emptyStamp') : w('emptyDate')}</p>{/if}
        {#if fromTyped?.fold === 'gap'}
          <p class="note" role="status">{w('gap', { zone: zoneCity(typedZone), shifted: wallText(wallAt(fromTyped.instant.ms, typedZone), false).slice(11) })}</p>
        {:else if fromTyped?.fold === 'twice'}
          <p class="note" role="status">{w('twice', { zone: zoneCity(typedZone) })}</p>
        {/if}
        <Receipt title={w('receipt')} aside={live ? w('live') : stamp?.ok ? w(UNIT_WORD[stamp.unit]) : ''}>
          <Row label={w('rowS')} value={inUnit(instant, 's')} hl={o.mode === 'toStamp'} />
          <Row label={w('rowMs')} value={inUnit(instant, 'ms')} />
          {#if fine}<Row label={w(ROW_WORD[fine])} value={inUnit(instant, fine)} />{/if}
          <Row label={w('relative')} value={relative(instant.ms, now, locale())} />
        </Receipt>
        <Receipt title={home} aside={homeIsUtc ? '' : offsetText(offsetAt(instant.ms, home))}>
          <Row label={w('iso')} value={iso(instant, home)} />
          <Row label={w('rfc')} value={rfc2822(instant, home)} />
          <Row label={w('readable')} value={readable(instant, home, locale())} hl={o.mode === 'toDate'} />
        </Receipt>
        {#if !homeIsUtc}
          <Receipt title="UTC">
            <Row label={w('iso')} value={iso(instant, 'UTC')} />
            <Row label={w('rfc')} value={rfc2822(instant, 'UTC')} />
            <Row label={w('readable')} value={readable(instant, 'UTC', locale())} />
          </Receipt>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .stamp {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .results {
    container-type: inline-size;
  }

  .typed {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }

  .typed .field {
    flex: 1 1 180px;
    font-family: var(--mono);
    font-size: 15px;
  }

  @media (hover: none) {
    .typed .field {
      font-size: 16px;
    }
  }

  .pick {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    min-height: 40px;
    padding: 6px 8px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
    color: var(--ink);
    font-size: 16px;
  }

  .now {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }

  .now code {
    font-family: var(--mono);
    font-size: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
