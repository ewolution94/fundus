<!--
  F-502 Percent & VAT: three everyday sums. Type, and the answer follows on a receipt, each line
  with its own Copy. Numbers are read leniently (parseNumber) and shown with the Decimal mark setting.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Line from '../../components/kit/Line.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { parseNumber, formatNumber, formatMoney } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { vat, percentOf, change, RATES } from './percent.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Sum',
      vat: 'VAT',
      pct: 'x % of y',
      chg: 'Change in %',
      amount: 'Amount',
      amountIs: 'It’s',
      gross: 'Gross',
      net: 'Net',
      rate: 'Rate',
      other: 'Other',
      otherRate: 'Other rate',
      receipt: 'Receipt',
      vatAt: 'VAT {rate} %',
      result: 'Result',
      percent: 'Percent',
      of: 'Of',
      from: 'From',
      to: 'To',
      xOfY: '{x} % of {y}',
      plus: '{y} + {x} %',
      minus: '{y} − {x} %',
      change: 'Change',
      difference: 'Difference',
      is: '{b} is',
      ofA: '{r} % of {a}',
      decimal: 'Decimal {mark} from Settings',
      point: 'point',
      comma: 'comma',
    },
    de: {
      mode: 'Rechnung',
      vat: 'MwSt.',
      pct: 'x % von y',
      chg: 'Änderung in %',
      amount: 'Betrag',
      amountIs: 'Er ist',
      gross: 'Brutto',
      net: 'Netto',
      rate: 'Satz',
      other: 'Anderer',
      otherRate: 'Anderer Satz',
      receipt: 'Beleg',
      vatAt: 'MwSt. {rate} %',
      result: 'Ergebnis',
      percent: 'Prozent',
      of: 'Von',
      from: 'Von',
      to: 'Auf',
      xOfY: '{x} % von {y}',
      plus: '{y} + {x} %',
      minus: '{y} − {x} %',
      change: 'Änderung',
      difference: 'Differenz',
      is: '{b} sind',
      ofA: '{r} % von {a}',
      decimal: 'Dezimal{mark} aus den Einstellungen',
      point: 'punkt',
      comma: 'komma',
    },
  });

  // The sum and how it's set are kept; the numbers typed are not.
  const o = remember('percent', { mode: 'vat' as 'vat' | 'pct' | 'chg', amountIs: 'gross' as 'gross' | 'net', rate: '19' });

  let amount = $state('');
  let otherRate = $state('');
  let x = $state('');
  let y = $state('');
  let from = $state('');
  let to = $state('');

  // A number from the home goes into the first field of the sum that's open.
  const given = untrack(() => texts(items)).find((s) => Number.isFinite(parseNumber(s)));
  if (given) {
    if (o.mode === 'vat') amount = given;
    else if (o.mode === 'pct') y = given;
    else from = given;
  }

  const mark = $derived(shared.decimal);
  const num = (n: number, max = 2) => formatNumber(n, mark, { max });
  // What Copy copies: no grouping, the setting's decimal mark, so it pastes into a form.
  const raw = (n: number, digits?: number) => (Number.isFinite(n) ? formatNumber(n, mark, digits === undefined ? { max: 10, group: false } : { min: digits, max: digits, group: false }) : '');
  const euro = (n: number) => (Number.isFinite(n) ? (locale() === 'de' ? `${formatMoney(n, mark)} €` : `€${formatMoney(n, mark)}`) : '–');
  const signed = (n: number, max = 2) => (Number.isFinite(n) ? `${n > 0 ? '+' : n < 0 ? '' : '±'}${num(n, max)}` : '–');

  const rate = $derived(o.rate === 'other' ? parseNumber(otherRate) : Number(o.rate));
  const v = $derived(vat(parseNumber(amount), rate, o.amountIs));
  const p = $derived(percentOf(parseNumber(x), parseNumber(y)));
  const c = $derived(change(parseNumber(from), parseNumber(to)));
  const rateText = $derived(Number.isFinite(rate) ? num(rate) : '–');
</script>

<div class="calc">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'vat', label: w('vat') },
      { value: 'pct', label: w('pct') },
      { value: 'chg', label: w('chg') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols">
    <dl class="spec">
      {#if o.mode === 'vat'}
        <div>
          <dt>{w('amount')}</dt>
          <dd><NumIn label={w('amount')} value={amount} unit="€" oninput={(s) => (amount = s)} /></dd>
        </div>
        <div>
          <dt>{w('amountIs')}</dt>
          <dd>
            <Seg
              label={w('amountIs')}
              value={o.amountIs}
              options={[
                { value: 'gross', label: w('gross') },
                { value: 'net', label: w('net') },
              ]}
              onchange={(d) => (o.amountIs = d)}
            />
          </dd>
        </div>
        <div>
          <dt>{w('rate')}</dt>
          <dd>
            <Seg
              label={w('rate')}
              value={o.rate}
              options={[...RATES.map((r) => ({ value: String(r), label: `${r} %` })), { value: 'other', label: w('other') }]}
              onchange={(r) => (o.rate = r)}
            />
            {#if o.rate === 'other'}
              <NumIn label={w('otherRate')} value={otherRate} unit="%" size="mid" width="140px" oninput={(s) => (otherRate = s)} />
            {/if}
          </dd>
        </div>
      {:else if o.mode === 'pct'}
        <div>
          <dt>{w('percent')}</dt>
          <dd><NumIn label={w('percent')} value={x} unit="%" oninput={(s) => (x = s)} /></dd>
        </div>
        <div>
          <dt>{w('of')}</dt>
          <dd><NumIn label={w('of')} value={y} oninput={(s) => (y = s)} /></dd>
        </div>
      {:else}
        <div>
          <dt>{w('from')}</dt>
          <dd><NumIn label={w('from')} value={from} oninput={(s) => (from = s)} /></dd>
        </div>
        <div>
          <dt>{w('to')}</dt>
          <dd><NumIn label={w('to')} value={to} oninput={(s) => (to = s)} /></dd>
        </div>
      {/if}
    </dl>

    <div class="stack">
      {#if o.mode === 'vat'}
        <Receipt title={w('receipt')} aside={w('vatAt', { rate: rateText })}>
          <Line label={w('net')} value={euro(v.net)} copy={raw(v.net, 2)} hl={o.amountIs === 'gross'} />
          <Line label={w('vatAt', { rate: rateText })} value={euro(v.vat)} copy={raw(v.vat, 2)} />
          <Line label={w('gross')} value={euro(v.gross)} copy={raw(v.gross, 2)} hl={o.amountIs === 'net'} total />
        </Receipt>
      {:else if o.mode === 'pct'}
        {@const xs = num(parseNumber(x), 4)}
        {@const ys = num(parseNumber(y), 4)}
        <Receipt title={w('result')} aside={w('xOfY', { x: xs, y: ys })}>
          <Line label={w('xOfY', { x: xs, y: ys })} value={num(p.part, 4)} copy={raw(p.part)} hl total />
          <Line label={w('plus', { x: xs, y: ys })} value={num(p.plus, 4)} copy={raw(p.plus)} />
          <Line label={w('minus', { x: xs, y: ys })} value={num(p.minus, 4)} copy={raw(p.minus)} />
        </Receipt>
      {:else}
        {@const as = num(parseNumber(from), 4)}
        {@const bs = num(parseNumber(to), 4)}
        <Receipt title={w('result')} aside={`${as} → ${bs}`}>
          <Line label={w('change')} value={Number.isFinite(c.percent) ? `${signed(c.percent)} %` : '–'} copy={raw(c.percent)} hl total />
          <Line label={w('difference')} value={signed(c.difference, 4)} copy={raw(c.difference)} />
          <Line label={w('is', { b: bs })} value={Number.isFinite(c.ratio) ? w('ofA', { r: num(c.ratio), a: as }) : '–'} copy={raw(c.ratio)} />
        </Receipt>
      {/if}
      <p class="note">{w('decimal', { mark: w(mark) })} · <SharedNote chip="numbers" /></p>
    </div>
  </div>
</div>

<style>
  .calc {
    display: grid;
    gap: 18px;
  }
</style>
