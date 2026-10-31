<!--
  F-505 Split a bill: the total (or a few items), the tip on top or already in it, the people
  (names optional), each share rounded up if wanted; then who paid what, and who pays whom to
  settle, with as few payments as can be. All in cents: the shares always add up to the total.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Minus, Plus, X } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Check from '../../components/kit/Check.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Line from '../../components/kit/Line.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { parseNumber, formatNumber, formatMoney } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { toCents, bill, settle, tipPercent } from './bill.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      amount: 'Amount',
      oneTotal: 'One total',
      items: 'Items',
      total: 'Total',
      item: 'Item {n}',
      addItem: 'Add an item',
      removeItem: 'Remove item {n}',
      tip: 'Tip',
      other: 'Other',
      otherTip: 'Other tip',
      tipIs: 'Tip is',
      top: 'On top',
      in: 'In the total',
      people: 'People',
      fewer: 'One fewer',
      more: 'One more',
      roundUp: 'Round up',
      roundUpLabel: 'Round each share up to a whole euro',
      roundUpHint: 'The extra goes to the tip.',
      whoPaid: 'Who paid',
      whoPaidLabel: 'Note who paid what',
      whoPaidHint: 'Then see who pays whom.',
      person: 'Person {n}',
      name: 'Name of person {n}',
      paidBy: 'Paid by {name}',
      paid: 'paid',
      share: 'share',
      receipt: 'Bill',
      bill: 'Bill',
      billBefore: 'Bill before tip',
      tipAt: 'Tip {p} %',
      rounded: 'Rounded up',
      tipAfter: 'With the rounding, the tip is {p} %.',
      'payments.one': '{n} payment',
      'payments.other': '{n} payments',
      sumTotal: 'Total',
      each: 'Each pays',
      shares: 'Shares',
      peopleN: '{n} people',
      onePerson: '1 person',
      cent: 'Shares differ by a cent so they add up to the total exactly.',
      settle: 'Settle up',
      pays: '{from} → {to}',
      even: 'Everyone has paid their share.',
      paidSum: 'Paid in all: {paid} of {total}.',
      open: '{diff} still open.',
      over: '{diff} too much.',
      typeTotal: 'Type the total, or what each person paid.',
      bad: 'Not an amount: try 47,90 or 47.90.',
      badPeople: 'People: a whole number from 1 to 100.',
      badTip: 'Tip: a percentage, like 12 or 12,5.',
      summary: 'Copy the summary',
      summaryEach: '{n} people, {share} each',
      summaryRange: '{n} people, {from} to {to} each',
      decimal: 'Decimal {mark} from Settings',
      point: 'point',
      comma: 'comma',
    },
    de: {
      amount: 'Betrag',
      oneTotal: 'Eine Summe',
      items: 'Posten',
      total: 'Summe',
      item: 'Posten {n}',
      addItem: 'Posten dazu',
      removeItem: 'Posten {n} entfernen',
      tip: 'Trinkgeld',
      other: 'Anderes',
      otherTip: 'Anderes Trinkgeld',
      tipIs: 'Trinkgeld ist',
      top: 'Obendrauf',
      in: 'In der Summe',
      people: 'Personen',
      fewer: 'Eine weniger',
      more: 'Eine mehr',
      roundUp: 'Aufrunden',
      roundUpLabel: 'Jeden Anteil auf ganze Euro aufrunden',
      roundUpHint: 'Das Mehr geht ans Trinkgeld.',
      whoPaid: 'Wer zahlte',
      whoPaidLabel: 'Notieren, wer was bezahlt hat',
      whoPaidHint: 'Dann siehst du, wer wem zahlt.',
      person: 'Person {n}',
      name: 'Name von Person {n}',
      paidBy: 'Bezahlt von {name}',
      paid: 'bezahlt',
      share: 'Anteil',
      receipt: 'Rechnung',
      bill: 'Rechnung',
      billBefore: 'Rechnung ohne Trinkgeld',
      tipAt: 'Trinkgeld {p} %',
      rounded: 'Aufgerundet',
      tipAfter: 'Mit dem Aufrunden sind es {p} % Trinkgeld.',
      'payments.one': '{n} Zahlung',
      'payments.other': '{n} Zahlungen',
      sumTotal: 'Gesamt',
      each: 'Pro Person',
      shares: 'Anteile',
      peopleN: '{n} Personen',
      onePerson: '1 Person',
      cent: 'Die Anteile weichen um einen Cent ab, damit sie genau die Summe ergeben.',
      settle: 'Ausgleich',
      pays: '{from} → {to}',
      even: 'Alle haben ihren Anteil bezahlt.',
      paidSum: 'Bezahlt insgesamt: {paid} von {total}.',
      open: '{diff} fehlen noch.',
      over: '{diff} zu viel.',
      typeTotal: 'Gib die Summe ein, oder was jede Person bezahlt hat.',
      bad: 'Kein Betrag: versuch 47,90 oder 47.90.',
      badPeople: 'Personen: eine ganze Zahl von 1 bis 100.',
      badTip: 'Trinkgeld: ein Prozentsatz, etwa 12 oder 12,5.',
      summary: 'Zusammenfassung kopieren',
      summaryEach: '{n} Personen, je {share}',
      summaryRange: '{n} Personen, je {from} bis {to}',
      decimal: 'Dezimal{mark} aus den Einstellungen',
      point: 'punkt',
      comma: 'komma',
    },
  });

  // How it's split is kept; amounts, names and the number of people are not.
  const o = remember('bill', {
    entry: 'total' as 'total' | 'items',
    tip: '10',
    tipIs: 'top' as 'top' | 'in',
    roundUp: false,
    whoPaid: false,
  });

  let amount = $state('');
  let itemList = $state<string[]>(['', '']);
  let otherTip = $state('');
  let count = $state('2');
  let names = $state<string[]>([]);
  let paid = $state<string[]>([]);

  // A number from the home is the total.
  const given = untrack(() => texts(items)).find((s) => Number.isFinite(parseNumber(s.replace(/\s*(€|eur)$/i, ''))));
  if (given) {
    amount = given.replace(/\s*(€|eur)$/i, '').trim();
    o.entry = 'total';
  }

  const mark = $derived(shared.decimal);
  const euro = (cents: number) => (Number.isFinite(cents) ? (locale() === 'de' ? `${formatMoney(cents / 100, mark)} €` : `€${formatMoney(cents / 100, mark)}`) : '–');
  // What Copy copies: the plain amount with the setting's decimal mark.
  const raw = (cents: number) => formatNumber(cents / 100, mark, { min: 2, max: 2, group: false });

  const people = $derived(parseNumber(count));
  const n = $derived(Number.isInteger(people) && people >= 1 && people <= 100 ? people : 0);
  const nameOf = (i: number) => names[i]?.trim() || w('person', { n: i + 1 });

  function setCount(next: number) {
    count = String(Math.min(100, Math.max(1, next)));
  }

  // What was typed, in cents: NaN for nonsense, 0 for nothing.
  const cents = (s: string) => (s.trim() ? toCents(parseNumber(s.replace(/\s*€\s*/g, ''))) : 0);
  const itemCents = $derived(itemList.map(cents));
  const typed = $derived(o.entry === 'total' ? cents(amount) : itemCents.some((c) => Number.isNaN(c)) ? NaN : itemCents.reduce((a, b) => a + b, 0));
  const tipRate = $derived(o.tip === 'other' ? (otherTip.trim() ? parseNumber(otherTip) : 0) : Number(o.tip));
  const paidCents = $derived(Array.from({ length: n }, (_, i) => cents(paid[i] ?? '')));
  const paidSum = $derived(paidCents.reduce((a, b) => a + b, 0));
  // With nothing typed but who paid what, what they paid is the bill.
  const fromPayments = $derived(o.whoPaid && typed === 0 && paidSum > 0 && !paidCents.some((c) => Number.isNaN(c)));

  const problem = $derived.by(() => {
    if (Number.isNaN(typed) || (o.whoPaid && paidCents.some((c) => Number.isNaN(c)))) return w('bad');
    if (!n) return w('badPeople');
    if (!Number.isFinite(tipRate) || tipRate < 0 || tipRate > 1000) return w('badTip');
    return '';
  });

  const result = $derived(problem || !n ? null : fromPayments ? bill(paidSum, 0, 'top', n, false) : typed > 0 ? bill(typed, tipRate, o.tipIs, n, o.roundUp) : null);
  const shareMin = $derived(result ? Math.min(...result.shares) : 0);
  const shareMax = $derived(result ? Math.max(...result.shares) : 0);
  const transfers = $derived(result && o.whoPaid ? settle(paidCents, result.shares) : null);
  const pctText = (p: number) => formatNumber(p, mark, { max: 2 });

  const summary = $derived.by(() => {
    if (!result) return '';
    const lines: string[] = [];
    const tipShown = fromPayments ? 0 : tipRate;
    lines.push(`${o.tipIs === 'in' && !fromPayments ? w('billBefore') : w('bill')}: ${euro(result.base)}`);
    if (tipShown || result.tip) lines.push(`${w('tipAt', { p: pctText(tipShown) })}: ${euro(result.tip)}`);
    if (result.extra) lines.push(`${w('rounded')}: ${euro(result.extra)}`);
    lines.push(`${w('sumTotal')}: ${euro(result.total)}`);
    lines.push(shareMin === shareMax ? w('summaryEach', { n, share: euro(shareMax) }) : w('summaryRange', { n, from: euro(shareMin), to: euro(shareMax) }));
    if (names.some((x) => x?.trim()) || shareMin !== shareMax) lines.push(result.shares.map((s, i) => `${nameOf(i)}: ${euro(s)}`).join(' · '));
    if (transfers?.length) {
      lines.push('', `${w('settle')}:`);
      for (const t of transfers) lines.push(`${w('pays', { from: nameOf(t.from), to: nameOf(t.to) })}: ${euro(t.amount)}`);
    }
    return lines.join('\n');
  });
</script>

<div class="cols">
  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('amount')}</dt>
        <dd>
          <Seg
            label={w('amount')}
            value={o.entry}
            options={[
              { value: 'total', label: w('oneTotal') },
              { value: 'items', label: w('items') },
            ]}
            onchange={(v) => (o.entry = v)}
          />
          {#if o.entry === 'total'}
            <NumIn label={w('total')} value={amount} unit="€" oninput={(s) => (amount = s)} />
          {:else}
            <div class="items">
              {#each itemList as value, i (i)}
                <div class="item">
                  <NumIn label={w('item', { n: i + 1 })} value={value} unit="€" size="mid" width="180px" oninput={(s) => (itemList[i] = s)} />
                  {#if itemList.length > 1}
                    <button type="button" class="x" aria-label={w('removeItem', { n: i + 1 })} onclick={() => (itemList = itemList.filter((_, k) => k !== i))}><X aria-hidden="true" /></button>
                  {/if}
                </div>
              {/each}
              <button type="button" class="btn small" onclick={() => (itemList = [...itemList, ''])}><Plus aria-hidden="true" />{w('addItem')}</button>
              {#if Number.isFinite(typed) && typed > 0}<span class="note">{w('total')}: {euro(typed)}</span>{/if}
            </div>
          {/if}
        </dd>
      </div>
      <div>
        <dt>{w('tip')}</dt>
        <dd>
          <Seg
            label={w('tip')}
            value={o.tip}
            options={[...['0', '5', '10', '15'].map((p) => ({ value: p, label: `${p} %` })), { value: 'other', label: w('other') }]}
            onchange={(v) => (o.tip = v)}
          />
          {#if o.tip === 'other'}
            <NumIn label={w('otherTip')} value={otherTip} unit="%" size="mid" width="120px" oninput={(s) => (otherTip = s)} />
          {/if}
        </dd>
      </div>
      <div>
        <dt>{w('tipIs')}</dt>
        <dd>
          <Seg
            label={w('tipIs')}
            value={o.tipIs}
            options={[
              { value: 'top', label: w('top') },
              { value: 'in', label: w('in') },
            ]}
            onchange={(v) => (o.tipIs = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('people')}</dt>
        <dd>
          <div class="stepper">
            <button type="button" class="btn" aria-label={w('fewer')} disabled={n <= 1} onclick={() => setCount((n || 2) - 1)}><Minus aria-hidden="true" /></button>
            <NumIn label={w('people')} value={count} size="mid" width="64px" inputmode="numeric" oninput={(s) => (count = s)} />
            <button type="button" class="btn" aria-label={w('more')} disabled={n >= 100} onclick={() => setCount((n || 0) + 1)}><Plus aria-hidden="true" /></button>
          </div>
        </dd>
      </div>
      <div>
        <dt>{w('roundUp')}</dt>
        <dd><Check checked={o.roundUp} label={w('roundUpLabel')} hint={w('roundUpHint')} onchange={(v) => (o.roundUp = v)} /></dd>
      </div>
      <div>
        <dt>{w('whoPaid')}</dt>
        <dd><Check checked={o.whoPaid} label={w('whoPaidLabel')} hint={w('whoPaidHint')} onchange={(v) => (o.whoPaid = v)} /></dd>
      </div>
    </dl>

    {#if n}
      <section class="stack">
        <h2 class="h">{w('people')} <em>{n === 1 ? w('onePerson') : w('peopleN', { n })}</em></h2>
        <ul class="folk" class:paying={o.whoPaid}>
          {#each Array.from({ length: n }, (_, i) => i) as i (i)}
            <li>
              <input class="field" type="text" autocomplete="off" aria-label={w('name', { n: i + 1 })} placeholder={w('person', { n: i + 1 })} value={names[i] ?? ''} oninput={(e) => (names[i] = e.currentTarget.value)} />
              <span class="owe">
                <small class="m">{w('share')}</small>
                <b>{result ? euro(result.shares[i]) : '–'}</b>
              </span>
              {#if o.whoPaid}
                <span class="gave">
                  <small class="m">{w('paid')}</small>
                  <NumIn label={w('paidBy', { name: nameOf(i) })} value={paid[i] ?? ''} unit="€" size="mid" width="120px" oninput={(s) => (paid[i] = s)} />
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>

  <div class="stack">
    {#if problem}
      <p class="note bad" role="alert">{problem}</p>
    {:else if !result}
      <p class="note">{w('typeTotal')}</p>
    {:else}
      <Receipt title={w('receipt')} aside={n === 1 ? w('onePerson') : w('peopleN', { n })}>
        <Line label={o.tipIs === 'in' && !fromPayments ? w('billBefore') : w('bill')} value={euro(result.base)} copy={raw(result.base)} />
        {#if !fromPayments}
          <Line label={w('tipAt', { p: pctText(tipRate) })} value={euro(result.tip)} copy={raw(result.tip)} />
        {/if}
        {#if result.extra}
          <Line label={w('rounded')} value={`+${euro(result.extra)}`} copy={raw(result.extra)} />
        {/if}
        <Line label={w('sumTotal')} value={euro(result.total)} copy={raw(result.total)} />
        <Line label={w('each')} value={shareMin === shareMax ? euro(shareMax) : `${euro(shareMin)}–${euro(shareMax)}`} copy={shareMin === shareMax ? raw(shareMax) : null} hl total />
      </Receipt>
      {#if shareMin !== shareMax}<p class="note">{w('cent')}</p>{/if}
      {#if result.extra}<p class="note">{w('tipAfter', { p: pctText(tipPercent(result)) })}</p>{/if}

      {#if o.whoPaid}
        {#if transfers}
          <Receipt title={w('settle')} aside={transfers.length ? w('payments', { n: transfers.length }) : ''}>
            {#each transfers as t, k (k)}
              <Line label={w('pays', { from: nameOf(t.from), to: nameOf(t.to) })} value={euro(t.amount)} copy={raw(t.amount)} />
            {/each}
            {#if !transfers.length}<p class="note even">{w('even')}</p>{/if}
          </Receipt>
        {:else}
          <p class="note bad" role="alert">
            {w('paidSum', { paid: euro(paidSum), total: euro(result.total) })}
            {paidSum < result.total ? w('open', { diff: euro(result.total - paidSum) }) : w('over', { diff: euro(paidSum - result.total) })}
          </p>
        {/if}
      {/if}

      <CopyButton text={summary} label={w('summary')} variant="button" />
    {/if}
    <p class="note">{w('decimal', { mark: w(mark) })}</p>
  </div>
</div>

<style>
  .items {
    display: grid;
    gap: 8px;
    justify-items: start;
    width: 100%;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    max-width: 230px;
  }

  .x {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--ink-2);
  }

  .x :global(svg),
  .stepper :global(svg),
  .items .btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stepper .btn {
    width: 40px;
    min-height: 40px;
    padding: 0;
  }

  .folk {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    container-type: inline-size;
  }

  .folk li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--rule);
  }

  /* What each paid: under the name on a phone, beside it where there's room. */
  .folk .gave {
    grid-column: 1 / -1;
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 10px;
  }

  .gave small,
  .owe small {
    color: var(--ink-2);
    font-size: 10px;
    text-transform: uppercase;
  }

  @container (min-width: 440px) {
    .folk.paying li {
      grid-template-columns: minmax(0, 1fr) auto 170px;
    }

    .folk .gave {
      grid-column: auto;
    }
  }

  .folk .field {
    max-width: 260px;
  }

  .owe {
    display: grid;
    justify-items: end;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .owe b {
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
  }

  .even {
    padding: 10px 0;
  }
</style>
