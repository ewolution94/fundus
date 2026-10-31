<!--
  F-402 Make a password: strong (length, character sets, no look-alikes) or memorable (words from
  EFF's English list or dys2p's German one, picked by the shared Password words setting). Drawn from
  crypto.getRandomValues without bias (password.ts); entropy in bits with a plain strength line. The
  options are kept; a password never is.
-->
<script lang="ts">
  import { Minus, Plus, RefreshCw } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import { words, t } from '../../lib/i18n.svelte.ts';
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import type { Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { strong, strongBits, memorable, memorableBits, strength, wordsOf, MIN_LENGTH, MAX_LENGTH, MIN_WORDS, MAX_WORDS, type SetName } from './password.ts';

  let {}: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      kind: 'Kind',
      strong: 'Strong',
      memorable: 'Memorable',
      password: 'Password',
      again: 'New password',
      copy: 'Copy',
      entropy: 'Entropy',
      bits: '{n} bits',
      weak: 'Weak',
      fair: 'Fair',
      strongWord: 'Strong',
      very: 'Very strong',
      weakLine: 'A computer guessing fast finds it in hours or less.',
      fairLine: 'Enough where wrong tries get locked out; short for an email or a bank.',
      strongLine: 'Out of reach of fast guessing for years.',
      veryLine: 'Beyond any guessing.',
      length: 'Length',
      shorter: 'Shorter',
      longer: 'Longer',
      chars: 'Characters',
      upper: 'A–Z',
      lower: 'a–z',
      digits: '0–9',
      symbols: 'Symbols',
      symbolsHint: '! # $ % & * + - . : ; = ? @ ^ _ ~',
      lookalikes: 'Avoid look-alikes',
      lookalikesHint: 'No I, l, 1, O or 0',
      oneSet: 'Keep at least one kind of character.',
      words: 'Words',
      separator: 'Between',
      space: 'Space',
      capitalise: 'Capitalise',
      capitaliseHint: 'Each word starts with a capital',
      digit: 'Add a digit',
      digitHint: 'After one of the words, for sites that ask for one',
      language: 'Language',
      english: 'English',
      german: 'German',
      nowWords: 'Memorable passwords now use {lang} words',
      loading: 'Loading the words…',
      local: 'Made on this device from its own randomness. Not kept anywhere.',
    },
    de: {
      kind: 'Art',
      strong: 'Stark',
      memorable: 'Merkbar',
      password: 'Passwort',
      again: 'Neues Passwort',
      copy: 'Kopieren',
      entropy: 'Entropie',
      bits: '{n} Bit',
      weak: 'Schwach',
      fair: 'Mittel',
      strongWord: 'Stark',
      very: 'Sehr stark',
      weakLine: 'Ein schnell ratender Computer findet es in Stunden oder schneller.',
      fairLine: 'Genug, wo Fehlversuche gesperrt werden; zu kurz für E-Mail oder Bank.',
      strongLine: 'Jahrelang außer Reichweite schnellen Ratens.',
      veryLine: 'Jenseits jedes Ratens.',
      length: 'Länge',
      shorter: 'Kürzer',
      longer: 'Länger',
      chars: 'Zeichen',
      upper: 'A–Z',
      lower: 'a–z',
      digits: '0–9',
      symbols: 'Sonderzeichen',
      symbolsHint: '! # $ % & * + - . : ; = ? @ ^ _ ~',
      lookalikes: 'Verwechselbare meiden',
      lookalikesHint: 'Kein I, l, 1, O oder 0',
      oneSet: 'Mindestens eine Art Zeichen bleibt an.',
      words: 'Wörter',
      separator: 'Dazwischen',
      space: 'Leerzeichen',
      capitalise: 'Großschreiben',
      capitaliseHint: 'Jedes Wort beginnt groß',
      digit: 'Eine Ziffer dazu',
      digitHint: 'Hinter einem der Wörter, für Seiten, die eine verlangen',
      language: 'Sprache',
      english: 'Englisch',
      german: 'Deutsch',
      nowWords: 'Merkbare Passwörter nehmen jetzt {lang}e Wörter',
      loading: 'Die Wörter laden…',
      local: 'Auf diesem Gerät aus seinem eigenen Zufall gemacht. Nirgends gespeichert.',
    },
  });

  // Only the options are kept: the password lives on this page until it's closed.
  const o = remember('password', {
    mode: 'strong' as 'strong' | 'memorable',
    length: 20,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    avoid: false,
    words: 6,
    separator: '-',
    capitalise: false,
    digit: false,
  });

  const SET_LABELS: { key: SetName; label: () => string; hint?: () => string }[] = [
    { key: 'upper', label: () => w('upper') },
    { key: 'lower', label: () => w('lower') },
    { key: 'digits', label: () => w('digits') },
    { key: 'symbols', label: () => w('symbols'), hint: () => w('symbolsHint') },
  ];

  let refusal = $state('');
  function toggleSet(key: SetName, on: boolean) {
    const others = SET_LABELS.filter((s) => s.key !== key).some((s) => o[s.key]);
    if (!on && !others) {
      refusal = w('oneSet');
      return;
    }
    refusal = '';
    o[key] = on;
  }

  // The word lists load when Memorable needs them, each its own file.
  const lang = $derived(shared.passwordWords);
  let lists = $state.raw<{ en?: string[]; de?: string[] }>({});
  $effect(() => {
    const l = lang;
    if (o.mode !== 'memorable' || lists[l]) return;
    void (l === 'de' ? import('./words-de.ts') : import('./words-en.ts')).then((m) => (lists = { ...lists, [l]: wordsOf(m.default) }));
  });

  let fresh = $state(0);
  const strongOptions = $derived({ length: o.length, sets: { upper: o.upper, lower: o.lower, digits: o.digits, symbols: o.symbols }, avoidLookalikes: o.avoid });
  const memorableOptions = $derived({ words: o.words, separator: o.separator, capitalise: o.capitalise, digit: o.digit });
  const list = $derived(lists[lang]);

  // A new password for every change of an option, and for New password.
  const password = $derived.by(() => {
    void fresh;
    if (o.mode === 'strong') return strong(strongOptions);
    return list ? memorable(memorableOptions, list) : '';
  });
  const bits = $derived(o.mode === 'strong' ? strongBits(strongOptions) : list ? memorableBits(memorableOptions, list.length) : 0);
  const level = $derived(strength(bits));
  const levelWord = $derived(w(level === 'strong' ? 'strongWord' : level));

  const setLength = (n: number) => (o.length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(n))));
</script>

<div class="pw-tool">
  <Seg
    large
    label={w('kind')}
    value={o.mode}
    options={[
      { value: 'strong', label: w('strong') },
      { value: 'memorable', label: w('memorable') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  <div class="cols">
    <div class="stack">
      <div class="work box">
        <!-- Words break only after a separator; a strong one anywhere. -->
        <output class="pw" class:words={o.mode === 'memorable'} aria-label={w('password')} aria-live="polite"
          >{#if !password}{w('loading')}{:else if o.mode === 'memorable'}{#each password.split(o.separator) as piece, i}{#if i}{o.separator}<wbr />{/if}{piece}{/each}{:else}{password}{/if}</output
        >
      </div>
      <div class="acts">
        <button type="button" class="btn ink" onclick={() => fresh++}><RefreshCw aria-hidden="true" />{w('again')}</button>
        {#if password}<CopyButton text={password} variant="button" label={w('copy')} />{/if}
      </div>
      <dl class="spec">
        <div>
          <dt>{w('entropy')}</dt>
          <dd>
            <div class="big"><b>{w('bits', { n: formatNumber(Math.floor(bits), shared.decimal, { max: 0 }) })}</b><em>{levelWord}</em></div>
            <span class="note">{w(`${level}Line`)}</span>
          </dd>
        </div>
      </dl>
      <p class="note">{w('local')}</p>
    </div>

    <div class="stack">
      <dl class="spec">
        {#if o.mode === 'strong'}
          <div>
            <dt><label for="pw-length">{w('length')}</label></dt>
            <dd class="length">
              <button type="button" class="step" aria-label={w('shorter')} disabled={o.length <= MIN_LENGTH} onclick={() => setLength(o.length - 1)}><Minus aria-hidden="true" /></button>
              <input id="pw-length" class="range" type="range" min={MIN_LENGTH} max={MAX_LENGTH} step="1" value={o.length} oninput={(e) => setLength(Number(e.currentTarget.value))} />
              <button type="button" class="step" aria-label={w('longer')} disabled={o.length >= MAX_LENGTH} onclick={() => setLength(o.length + 1)}><Plus aria-hidden="true" /></button>
              <b class="count" aria-hidden="true">{o.length}</b>
            </dd>
          </div>
          <div>
            <dt>{w('chars')}</dt>
            <dd>
              {#each SET_LABELS as s (s.key)}
                <Check checked={o[s.key]} label={s.label()} hint={s.hint?.()} onchange={(v) => toggleSet(s.key, v)} />
              {/each}
              {#if refusal}<span class="note bad" role="alert">{refusal}</span>{/if}
            </dd>
          </div>
          <div>
            <dt></dt>
            <dd><Check checked={o.avoid} label={w('lookalikes')} hint={w('lookalikesHint')} onchange={(v) => (o.avoid = v)} /></dd>
          </div>
        {:else}
          <div>
            <dt>{w('words')}</dt>
            <dd>
              <Seg
                label={w('words')}
                value={o.words}
                options={Array.from({ length: MAX_WORDS - MIN_WORDS + 1 }, (_, i) => ({ value: MIN_WORDS + i, label: String(MIN_WORDS + i) }))}
                onchange={(n) => (o.words = n)}
              />
            </dd>
          </div>
          <div>
            <dt>{w('separator')}</dt>
            <dd>
              <Seg
                label={w('separator')}
                value={o.separator}
                options={[
                  { value: '-', label: '-' },
                  { value: '.', label: '.' },
                  { value: '_', label: '_' },
                  { value: ' ', label: w('space') },
                ]}
                onchange={(s) => (o.separator = s)}
              />
            </dd>
          </div>
          <div>
            <dt></dt>
            <dd>
              <Check checked={o.capitalise} label={w('capitalise')} hint={w('capitaliseHint')} onchange={(v) => (o.capitalise = v)} />
              <Check checked={o.digit} label={w('digit')} hint={w('digitHint')} onchange={(v) => (o.digit = v)} />
            </dd>
          </div>
          <div>
            <dt>{w('language')}</dt>
            <dd>
              <Seg
                label={w('language')}
                value={shared.passwordWords}
                options={[
                  { value: 'en', label: w('english') },
                  { value: 'de', label: w('german') },
                ]}
                onchange={(l) => setShared('passwordWords', l, w('nowWords', { lang: l === 'de' ? w('german') : w('english') }), t('tool.undo'))}
              />
              <SharedNote chip="scratch" />
            </dd>
          </div>
        {/if}
      </dl>
    </div>
  </div>
</div>

<style>
  .pw-tool {
    display: grid;
    gap: 18px;
  }

  .box {
    padding: 18px 16px;
    min-height: 96px;
    display: grid;
    align-items: center;
  }

  .pw {
    font-family: var(--mono);
    font-size: clamp(19px, 4.6vw, 27px);
    line-height: 1.35;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
    word-break: break-all;
    user-select: all;
  }

  .pw.words {
    word-break: normal;
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .acts :global(.btn) {
    min-height: 44px;
  }

  .length {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px 3ch;
    align-items: center;
    gap: 6px;
    justify-items: stretch;
    width: 100%;
  }

  .step {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--ink);
    background: var(--card);
  }

  .step :global(svg) {
    width: 16px;
    height: 16px;
  }

  .count {
    font-family: var(--mono);
    font-size: 17px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* An ink rule with a highlighter knob: the choice. */
  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    min-width: 0;
    height: 40px;
    margin: 0;
    background: transparent;
  }

  .range::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--ink);
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -9px;
    background: var(--mark);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }

  .range::-moz-range-track {
    height: 2px;
    background: var(--ink);
  }

  .range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--mark);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }
</style>
