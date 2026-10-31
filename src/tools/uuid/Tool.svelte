<!--
  F-905 UUIDs: one to a hundred v4 (random) or v7 (time-ordered) UUIDs, in lower or upper case, with
  or without hyphens and braces, each with Copy and all at once; and a pasted UUID checked: valid
  or not, its version and variant, the time inside a v1, v6 or v7. The UUIDs are made here and kept
  nowhere; only the choices are. Logic in uuid.ts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { RefreshCw } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Row from './Row.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { v4, v7Maker, format, canonical, parse, inspect, isoTime, clampCount, type Bytes, type Info } from './uuid.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      version: 'Version',
      v4: 'v4, random',
      v7: 'v7, by time',
      v4Note: '122 random bits each.',
      v7Note: 'The time in milliseconds first, then random: they sort in the order they were made.',
      count: 'How many',
      clamped: 'From 1 to 100: making {n}.',
      case: 'Case',
      lower: 'lower',
      upper: 'UPPER',
      form: 'Form',
      hyphens: 'Hyphens',
      braces: 'Braces',
      list: 'UUIDs',
      copyAll: 'Copy all',
      fresh: 'New ones',
      made: 'Made here, kept nowhere.',
      check: 'Check a UUID',
      checkLabel: 'A UUID to check',
      checkPh: 'Paste a UUID',
      checkEmpty: 'Paste one to see whether it’s valid, its version and variant, and the time inside a v1, v6 or v7.',
      valid: 'Valid UUID',
      nil: 'The nil UUID: all zeros, no version.',
      max: 'The max UUID: all ones, no version.',
      rowCanonical: 'Canonical',
      rowVersion: 'Version',
      rowVariant: 'Variant',
      rowTime: 'Time (UTC)',
      rowHome: 'At home',
      rowClock: 'Clock sequence',
      rowNode: 'Node',
      randomNode: '{node}, random (not a network card)',
      'ver.1': '1, time and MAC address',
      'ver.2': '2, DCE security',
      'ver.3': '3, from a name (MD5)',
      'ver.4': '4, random',
      'ver.5': '5, from a name (SHA-1)',
      'ver.6': '6, time, sortable',
      'ver.7': '7, Unix time, sortable',
      'ver.8': '8, custom',
      verOther: '{n}, not defined',
      verNone: 'none: this variant has no versions',
      'var.ncs': 'NCS, from the 1980s',
      'var.rfc': 'RFC 9562, the usual one',
      'var.microsoft': 'Microsoft, an old GUID',
      'var.future': 'Reserved for the future',
      oddVariant: 'A valid shape, but not the usual variant: tools may read it differently.',
      char: '“{char}” at position {position} isn’t a hex digit.',
      length: '{digits} hex digits: a UUID has 32.',
      hyphens8: 'The hyphens go after 8, 12, 16 and 20 digits: 8-4-4-4-12.',
      bracesBad: 'A brace is missing: { at the start, } at the end, or neither.',
    },
    de: {
      version: 'Version',
      v4: 'v4, zufällig',
      v7: 'v7, nach Zeit',
      v4Note: 'Jede aus 122 zufälligen Bits.',
      v7Note: 'Erst die Zeit in Millisekunden, dann Zufall: Sie sortieren sich in der Reihenfolge, in der sie entstanden.',
      count: 'Wie viele',
      clamped: 'Von 1 bis 100: es werden {n}.',
      case: 'Schreibung',
      lower: 'klein',
      upper: 'GROSS',
      form: 'Form',
      hyphens: 'Bindestriche',
      braces: 'Klammern',
      list: 'UUIDs',
      copyAll: 'Alle kopieren',
      fresh: 'Neue',
      made: 'Hier erzeugt, nirgends gespeichert.',
      check: 'UUID prüfen',
      checkLabel: 'Eine UUID zum Prüfen',
      checkPh: 'UUID einfügen',
      checkEmpty: 'Füg eine ein: ob sie gültig ist, ihre Version und Variante und die Zeit in einer v1, v6 oder v7.',
      valid: 'Gültige UUID',
      nil: 'Die Nil-UUID: alles Nullen, keine Version.',
      max: 'Die Max-UUID: alles Einsen, keine Version.',
      rowCanonical: 'Normalform',
      rowVersion: 'Version',
      rowVariant: 'Variante',
      rowTime: 'Zeit (UTC)',
      rowHome: 'Zu Hause',
      rowClock: 'Taktfolge',
      rowNode: 'Knoten',
      randomNode: '{node}, zufällig (keine Netzwerkkarte)',
      'ver.1': '1, Zeit und MAC-Adresse',
      'ver.2': '2, DCE-Sicherheit',
      'ver.3': '3, aus einem Namen (MD5)',
      'ver.4': '4, zufällig',
      'ver.5': '5, aus einem Namen (SHA-1)',
      'ver.6': '6, Zeit, sortierbar',
      'ver.7': '7, Unix-Zeit, sortierbar',
      'ver.8': '8, eigenes Format',
      verOther: '{n}, nicht festgelegt',
      verNone: 'keine: diese Variante hat keine Versionen',
      'var.ncs': 'NCS, aus den 1980ern',
      'var.rfc': 'RFC 9562, die übliche',
      'var.microsoft': 'Microsoft, eine alte GUID',
      'var.future': 'Für die Zukunft reserviert',
      oddVariant: 'Die Form stimmt, aber nicht die übliche Variante: Programme lesen sie vielleicht anders.',
      char: '„{char}“ an Stelle {position} ist keine Hex-Ziffer.',
      length: '{digits} Hex-Ziffern: Eine UUID hat 32.',
      hyphens8: 'Die Bindestriche kommen nach 8, 12, 16 und 20 Ziffern: 8-4-4-4-12.',
      bracesBad: 'Eine Klammer fehlt: { am Anfang, } am Ende, oder keine.',
    },
  });

  // The choices are kept; the UUIDs and what was pasted are not.
  const o = remember('uuid', { version: 'v4' as 'v4' | 'v7', count: 5, upper: false, hyphens: true, braces: false });

  // One maker for the page, so every v7 made here comes after the one before.
  const nextV7 = v7Maker();
  const make = (version: 'v4' | 'v7') => (version === 'v7' ? nextV7() : v4());

  let countText = $state(untrack(() => String(o.count)));
  const counted = $derived(clampCount(countText));
  let ids = $state<Bytes[]>(untrack(() => Array.from({ length: o.count }, () => make(o.version))));

  function setCount(text: string) {
    countText = text;
    const c = clampCount(text);
    if (!c) return;
    o.count = c.n;
    if (c.n > ids.length) ids = [...ids, ...Array.from({ length: c.n - ids.length }, () => make(o.version))];
    else ids = ids.slice(0, c.n);
  }

  function setVersion(version: 'v4' | 'v7') {
    o.version = version;
    fresh();
  }

  function fresh() {
    ids = Array.from({ length: o.count }, () => make(o.version));
  }

  const style = $derived({ upper: o.upper, hyphens: o.hyphens, braces: o.braces });
  const shown = $derived(ids.map((b) => format(b, style)));

  // Checking one.
  let checkText = $state('');
  const checked = $derived(parse(checkText));
  const info = $derived<Info | null>(checked?.ok ? inspect(checked.bytes) : null);

  const VERSIONS = ['ver.1', 'ver.2', 'ver.3', 'ver.4', 'ver.5', 'ver.6', 'ver.7', 'ver.8'] as const;
  const versionText = (i: Info) => (i.version === null ? w('verNone') : i.version >= 1 && i.version <= 8 ? w(VERSIONS[i.version - 1]) : w('verOther', { n: i.version }));
  const VARIANTS = { ncs: 'var.ncs', rfc: 'var.rfc', microsoft: 'var.microsoft', future: 'var.future' } as const;

  function atHome(ms: number) {
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'long' };
    try {
      return new Intl.DateTimeFormat(locale(), { ...options, timeZone: shared.homeZone }).format(ms);
    } catch {
      return new Intl.DateTimeFormat(locale(), options).format(ms);
    }
  }

  const problem = $derived.by(() => {
    if (!checked || checked.ok) return '';
    if (checked.code === 'char') return w('char', { char: checked.char, position: checked.position });
    if (checked.code === 'length') return w('length', { digits: checked.digits });
    if (checked.code === 'hyphens') return w('hyphens8');
    return w('bracesBad');
  });

  // A UUID handed in (pasted on the home, or from another tool) is checked.
  const given = untrack(() => texts(items)[0]?.trim());
  if (given) checkText = given;
</script>

<div class="uuid">
  <Seg
    large
    label={w('version')}
    value={o.version}
    options={[
      { value: 'v4', label: w('v4') },
      { value: 'v7', label: w('v7') },
    ]}
    onchange={setVersion}
  />

  <div class="cols">
    <div class="stack">
      <dl class="spec">
        <div>
          <dt>{w('count')}</dt>
          <dd>
            <NumIn label={w('count')} value={countText} width="120px" inputmode="numeric" oninput={setCount} />
            {#if counted?.clamped}<span class="note">{w('clamped', { n: counted.n })}</span>{/if}
          </dd>
        </div>
        <div>
          <dt>{w('case')}</dt>
          <dd>
            <Seg
              label={w('case')}
              value={o.upper ? 'upper' : 'lower'}
              options={[
                { value: 'lower', label: w('lower') },
                { value: 'upper', label: w('upper') },
              ]}
              onchange={(c) => (o.upper = c === 'upper')}
            />
          </dd>
        </div>
        <div>
          <dt>{w('form')}</dt>
          <dd>
            <div class="checks">
              <Check label={w('hyphens')} checked={o.hyphens} onchange={(v) => (o.hyphens = v)} />
              <Check label={w('braces')} checked={o.braces} onchange={(v) => (o.braces = v)} />
            </div>
          </dd>
        </div>
      </dl>
      <p class="note">{o.version === 'v7' ? w('v7Note') : w('v4Note')} {w('made')}</p>
    </div>

    <div class="stack">
      <h2 class="h">{w('list')}<em>{shown.length}</em></h2>
      <div class="bar">
        <CopyButton variant="button" label={w('copyAll')} text={shown.join('\n')} />
        <button type="button" class="btn" onclick={fresh}><RefreshCw aria-hidden="true" />{w('fresh')}</button>
      </div>
      <ol class="ids work" aria-label={w('list')}>
        {#each shown as id, i (i)}
          <li>
            <span class="no" aria-hidden="true">{i + 1}</span>
            <code>{id}</code>
            <CopyButton text={id} />
          </li>
        {/each}
      </ol>
    </div>

    <div class="wide stack check">
      <h2 class="h">{w('check')}</h2>
      <input class="field" type="text" aria-label={w('checkLabel')} placeholder={w('checkPh')} autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={checkText} />
      <div class="result">
        {#if problem}
          <p class="error" role="alert">{problem}</p>
        {:else if info && checked?.ok}
          {#if info.special}
            <p class="special" role="status">{w(info.special)}</p>
          {/if}
          <Receipt title={w('valid')} aside={info.version !== null ? `v${info.version}` : ''}>
            <Row label={w('rowCanonical')} value={canonical(checked.bytes)} />
            {#if !info.special}
              <Row label={w('rowVersion')} value={versionText(info)} copy={String(info.version ?? '')} hl={!info.time} />
              <Row label={w('rowVariant')} value={w(VARIANTS[info.variant])} />
            {/if}
            {#if info.time}
              <Row label={w('rowTime')} value={isoTime(info.time)} hl />
              <Row label={w('rowHome')} value={atHome(info.time.ms)} />
            {/if}
            {#if info.clockSeq !== null}<Row label={w('rowClock')} value={String(info.clockSeq)} />{/if}
            {#if info.node}<Row label={w('rowNode')} value={info.randomNode ? w('randomNode', { node: info.node }) : info.node} copy={info.node} />{/if}
          </Receipt>
          {#if !info.special && info.variant !== 'rfc'}<p class="note">{w('oddVariant')}</p>{/if}
        {:else}
          <p class="note">{w('checkEmpty')}</p>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .uuid {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .checks {
    display: grid;
    gap: 8px;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ids {
    container-type: inline-size;
    list-style: none;
    margin: 0;
    padding: 2px 12px;
    max-height: 480px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .ids li {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .ids li:last-child {
    border-bottom: 0;
  }

  .no {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-2);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ids code {
    font-family: var(--mono);
    font-size: 14px;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  /* A phone: no numbers, a smaller face, so a UUID in braces stays on one line. */
  @container (max-width: 400px) {
    .ids li {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }

    .no {
      display: none;
    }

    .ids code {
      /* Martian Mono is wide (0.7 em): 38 characters at 11 px just fit beside Copy at 390 px. */
      font-size: 11px;
      letter-spacing: -0.02em;
    }
  }

  @media (max-width: 440px) {
    .ids {
      padding: 2px 6px;
    }
  }

  .check .field {
    max-width: 760px;
    font-family: var(--mono);
  }

  .result {
    container-type: inline-size;
    display: grid;
    gap: 10px;
    max-width: 760px;
  }

  .special {
    font-weight: 600;
  }
</style>
