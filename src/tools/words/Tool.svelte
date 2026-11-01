<!--
  F-507 Amount in words: a number in German or English words, for a contract (in Euro, Dollar or
  none) or a cheque (the cents as 50/100); and Roman numerals both ways, 1 to 3,999. A Roman numeral
  pasted on the home opens in its own section. The choices are kept; the numbers typed are not.
-->
<script lang="ts">
  import { untrack, onMount } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import { parseNumber, formatNumber, formatMoney } from '../../lib/numbers.ts';
  import { shapes } from '../../lib/shapes.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { inWords, breakable, toRoman, fromRoman, MAX, type Lang, type Currency } from './words.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      amount: 'Amount',
      currency: 'Currency',
      eur: 'Euro',
      usd: 'Dollar',
      none: 'None',
      lang: 'Words in',
      cheque: 'Cheque',
      chequeLabel: 'Cents as a fraction',
      chequeHint: 'The way a cheque writes them: … and 50/100',
      inWords: 'In words',
      empty: 'Type an amount: its words appear here.',
      nan: 'That isn’t a number. Type one like 1250,50 or 1,250.50.',
      range: 'Up to {max}: this one is out of range.',
      rounded: 'Rounded to the cent.',
      copy: 'Copy the words',
      roman: 'Roman numerals',
      romanRange: '1 to 3,999',
      toRoman: 'Number to Roman',
      toNumber: 'Roman numeral',
      number: 'Number',
      numeral: 'Roman',
      romanEmpty: 'Type a whole number from 1 to 3,999.',
      romanOut: 'Roman numerals go from 1 to 3,999.',
      numeralEmpty: 'Type a numeral like MCMXCIV.',
      letters: 'Roman numerals use only I, V, X, L, C, D and M.',
      numeralOut: 'That adds up to more than 3,999.',
      usually: 'Usually written {canonical}.',
    },
    de: {
      amount: 'Betrag',
      currency: 'Währung',
      eur: 'Euro',
      usd: 'Dollar',
      none: 'Keine',
      lang: 'Worte auf',
      cheque: 'Scheck',
      chequeLabel: 'Cent als Bruch',
      chequeHint: 'So, wie ein Scheck sie schreibt: … 50/100',
      inWords: 'In Worten',
      empty: 'Tipp einen Betrag: seine Worte erscheinen hier.',
      nan: 'Das ist keine Zahl. Tipp eine wie 1250,50 oder 1.250,50.',
      range: 'Bis {max}: dieser liegt außerhalb.',
      rounded: 'Auf den Cent gerundet.',
      copy: 'Worte kopieren',
      roman: 'Römische Zahlen',
      romanRange: '1 bis 3.999',
      toRoman: 'Zahl zu römisch',
      toNumber: 'Römische Zahl',
      number: 'Zahl',
      numeral: 'Römisch',
      romanEmpty: 'Tipp eine ganze Zahl von 1 bis 3.999.',
      romanOut: 'Römische Zahlen gehen von 1 bis 3.999.',
      numeralEmpty: 'Tipp eine Zahl wie MCMXCIV.',
      letters: 'Römische Zahlen bestehen nur aus I, V, X, L, C, D und M.',
      numeralOut: 'Das ergibt mehr als 3.999.',
      usually: 'Üblich geschrieben: {canonical}.',
    },
  });

  // The choices are kept; the numbers typed are not. No language picked: the app's.
  const o = remember('words', { currency: 'eur' as Currency, lang: '' as '' | Lang, cheque: false });

  let amount = $state('');
  let arabic = $state('');
  let numeral = $state('');
  let romanSection = $state<HTMLElement>();

  // A number from the home goes into the amount; a Roman numeral into its own section.
  const given = untrack(() => texts(items)).map((s) => s.trim());
  const givenRoman = given.find((s) => shapes(s).includes('roman'));
  const givenNumber = given.find((s) => Number.isFinite(parseNumber(s.replace(/\s*(€|\$|eur|usd)$/i, ''))));
  if (givenRoman) numeral = givenRoman;
  else if (givenNumber) amount = givenNumber.replace(/\s*(€|\$|eur|usd)$/i, '');

  onMount(() => {
    if (givenRoman) romanSection?.scrollIntoView({ block: 'start' });
  });

  const lang = $derived<Lang>(o.lang || locale());
  const mark = $derived(shared.decimal);
  const value = $derived(parseNumber(amount));
  const said = $derived(amount.trim() ? inWords(value, { lang, currency: o.currency, cheque: o.cheque }) : null);
  const rounded = $derived(o.currency !== 'none' || o.cheque ? Number.isFinite(value) && Math.abs(Math.round(value * 100) - value * 100) > 1e-6 : false);
  const shown = $derived.by(() => {
    if (!Number.isFinite(value)) return '';
    if (o.currency === 'none' && !o.cheque) return formatNumber(value, mark, { max: 6 });
    const money = formatMoney(value, mark);
    if (o.currency === 'eur') return `${money} €`;
    if (o.currency === 'usd') return `$${money}`;
    return money;
  });

  const arabicValue = $derived(parseNumber(arabic));
  const asRoman = $derived(arabic.trim() ? toRoman(arabicValue) : null);
  const fromNumeral = $derived(numeral.trim() ? fromRoman(numeral) : null);
</script>

<div class="cols">
  <dl class="spec">
    <div>
      <dt>{w('amount')}</dt>
      <dd>
        <NumIn
          label={w('amount')}
          value={amount}
          unit={o.currency === 'eur' ? '€' : undefined}
          prefix={o.currency === 'usd' ? '$' : undefined}
          width="320px"
          oninput={(s) => (amount = s)}
        />
      </dd>
    </div>
    <div>
      <dt>{w('currency')}</dt>
      <dd>
        <Seg
          label={w('currency')}
          value={o.currency}
          options={[
            { value: 'eur', label: w('eur') },
            { value: 'usd', label: w('usd') },
            { value: 'none', label: w('none') },
          ]}
          onchange={(v) => (o.currency = v)}
        />
      </dd>
    </div>
    <div>
      <dt>{w('lang')}</dt>
      <dd>
        <Seg
          label={w('lang')}
          value={lang}
          options={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
          onchange={(v) => (o.lang = v)}
        />
      </dd>
    </div>
    <div>
      <dt>{w('cheque')}</dt>
      <dd><Check checked={o.cheque} label={w('chequeLabel')} hint={w('chequeHint')} onchange={(v) => (o.cheque = v)} /></dd>
    </div>
  </dl>

  <section class="said" aria-label={w('inWords')}>
    <h3><span>{w('inWords')}</span><span>{shown}</span></h3>
    <div aria-live="polite">
      {#if !said}
        <p class="note">{w('empty')}</p>
      {:else if 'error' in said}
        <p class="note bad">{said.error === 'nan' ? w('nan') : w('range', { max: formatMoney(MAX, mark) })}</p>
      {:else}
        <p class="text" lang={lang}><span class="answer">{breakable(said.words)}</span></p>
        {#if rounded}<p class="note">{w('rounded')}</p>{/if}
      {/if}
    </div>
    {#if said && 'words' in said}
      <div class="acts"><CopyButton text={said.words} variant="button" label={w('copy')} /></div>
    {/if}
  </section>

  <section class="wide stack" aria-label={w('roman')} bind:this={romanSection}>
    <h2 class="h">{w('roman')} <em>{w('romanRange')}</em></h2>
    <div class="cols even under">
      <dl class="spec">
        <div>
          <dt>{w('number')}</dt>
          <dd><NumIn label={w('toRoman')} value={arabic} size="mid" width="160px" inputmode="numeric" oninput={(s) => (arabic = s)} /></dd>
        </div>
        <div>
          <dt>{w('numeral')}</dt>
          <dd aria-live="polite">
            {#if asRoman}
              <div class="pair"><b class="roman">{asRoman}</b><CopyButton text={asRoman} /></div>
            {:else}
              <span class="note" class:bad={!!arabic.trim()}>{arabic.trim() ? w('romanOut') : w('romanEmpty')}</span>
            {/if}
          </dd>
        </div>
      </dl>
      <dl class="spec">
        <div>
          <dt><label for="words-numeral">{w('numeral')}</label></dt>
          <dd>
            <input
              id="words-numeral"
              class="field roman-in"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              aria-label={w('toNumber')}
              placeholder="MCMXCIV"
              value={numeral}
              oninput={(e) => (numeral = e.currentTarget.value)}
            />
          </dd>
        </div>
        <div>
          <dt>{w('number')}</dt>
          <dd aria-live="polite">
            {#if fromNumeral && 'value' in fromNumeral}
              <div class="pair"><b class="roman">{fromNumeral.value}</b><CopyButton text={String(fromNumeral.value)} /></div>
              {#if !fromNumeral.valid}<span class="note">{w('usually', { canonical: fromNumeral.canonical })}</span>{/if}
            {:else if fromNumeral}
              <span class="note bad">{fromNumeral.error === 'letters' ? w('letters') : w('numeralOut')}</span>
            {:else}
              <span class="note">{w('numeralEmpty')}</span>
            {/if}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</div>

<style>
  .said {
    display: grid;
    align-content: start;
    gap: 12px;
    padding: 4px 14px 14px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    min-width: 0;
  }

  .said h3 {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--rule);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .said h3 span:last-child {
    text-transform: none;
    font-size: 11px;
    color: var(--ink);
  }

  .text {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
    hyphens: manual;
  }

  .answer {
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 4px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pair {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }

  .roman {
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.02em;
    overflow-wrap: anywhere;
  }

  .roman-in {
    font-family: var(--mono);
    max-width: 260px;
    text-transform: uppercase;
  }

  .roman-in::placeholder {
    text-transform: none;
  }

  /* Right under the heading its rule is the line: the spec's own would double it (QR's .read). */
  .under > .spec:first-child {
    border-top: 0;
  }

  @media (min-width: 760px) {
    .under > .spec {
      border-top: 0;
    }
  }
</style>
