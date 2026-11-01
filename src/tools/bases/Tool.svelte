<!--
  F-911 Number bases: one field takes 0x…, 0b…, 0o…, a decimal or digits in a base picked (2 to 36),
  spaces and _ as separators. Out come binary, octal, decimal, hex and one more base, each with
  Copy; the bits and the bytes both ways round; the two's complement at 8, 16, 32 and 64 bits.
  BigInt throughout (bases.ts), so big numbers stay exact.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Row from './Row.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { parse, plain, shown, bitLength, bytes, hexBytes, twos, decimal, validBase, WIDTHS, MAX_DIGITS, type ParseError } from './bases.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      number: 'Number',
      base: 'Base',
      other: 'Other',
      otherBase: 'Base, 2 to 36',
      also: 'Also in',
      alsoBase: 'One more base, 2 to 36',
      hint: '0x, 0b and 0o read as hex, binary and octal, whatever the base. Spaces and _ group digits.',
      readAs: 'Read as {what}',
      hexP: 'hex (0x)',
      binP: 'binary (0b)',
      octP: 'octal (0o)',
      baseN: 'base {n}',
      bases: 'Bases',
      binary: 'Binary',
      octal: 'Octal',
      dec: 'Decimal',
      hex: 'Hex',
      baseRow: 'Base {n}',
      bitsBytes: 'Bits and bytes',
      bits: 'Bits',
      bitsTwos: 'as two’s complement',
      bigEndian: 'Big-endian',
      littleEndian: 'Little-endian',
      'bytes.one': '1 byte',
      'bytes.other': '{n} bytes',
      bytesTwos: '{bytes}, two’s complement',
      twos: 'Two’s complement',
      widthBits: '{n} bits',
      meaning: 'signed {s} · unsigned {u}',
      noFitNeg: 'Doesn’t fit: {n} bits hold {min} to {max}.',
      noFitPos: 'Doesn’t fit: {n} bits hold up to {max}.',
      empty: 'Type a number: 255, 0xFF, 0b1111_1111 or −1.',
      digit: '“{char}” at position {position} isn’t a digit in base {base}.',
      hexHint: 'For hex, start with 0x or pick 16.',
      noDigits: 'Digits are missing after {prefix}.',
      noDigitsBare: 'Digits are missing.',
      fractionComma: 'Whole numbers only, no decimal comma. Group digits with spaces or _.',
      fractionPoint: 'Whole numbers only, no decimal point. Group digits with spaces or _.',
      tooLong: 'Up to {n} digits.',
      baseBad: 'A base from 2 to 36.',
    },
    de: {
      number: 'Zahl',
      base: 'Basis',
      other: 'Andere',
      otherBase: 'Basis, 2 bis 36',
      also: 'Auch in',
      alsoBase: 'Noch eine Basis, 2 bis 36',
      hint: '0x, 0b und 0o lesen sich als hex, binär und oktal, egal welche Basis. Leerzeichen und _ gliedern die Ziffern.',
      readAs: 'Gelesen als {what}',
      hexP: 'hex (0x)',
      binP: 'binär (0b)',
      octP: 'oktal (0o)',
      baseN: 'Basis {n}',
      bases: 'Basen',
      binary: 'Binär',
      octal: 'Oktal',
      dec: 'Dezimal',
      hex: 'Hex',
      baseRow: 'Basis {n}',
      bitsBytes: 'Bits und Bytes',
      bits: 'Bits',
      bitsTwos: 'im Zweierkomplement',
      bigEndian: 'Big-Endian',
      littleEndian: 'Little-Endian',
      'bytes.one': '1 Byte',
      'bytes.other': '{n} Bytes',
      bytesTwos: '{bytes}, Zweierkomplement',
      twos: 'Zweierkomplement',
      widthBits: '{n} Bit',
      meaning: 'mit Vorzeichen {s} · ohne {u}',
      noFitNeg: 'Passt nicht: {n} Bit fassen {min} bis {max}.',
      noFitPos: 'Passt nicht: {n} Bit fassen bis {max}.',
      empty: 'Tipp eine Zahl: 255, 0xFF, 0b1111_1111 oder −1.',
      digit: '„{char}“ an Stelle {position} ist keine Ziffer zur Basis {base}.',
      hexHint: 'Für hex fang mit 0x an oder wähl 16.',
      noDigits: 'Nach {prefix} fehlen die Ziffern.',
      noDigitsBare: 'Die Ziffern fehlen.',
      fractionComma: 'Nur ganze Zahlen, kein Dezimalkomma. Gliedere die Ziffern mit Leerzeichen oder _.',
      fractionPoint: 'Nur ganze Zahlen, kein Dezimalpunkt. Gliedere die Ziffern mit Leerzeichen oder _.',
      tooLong: 'Bis {n} Ziffern.',
      baseBad: 'Eine Basis von 2 bis 36.',
    },
  });

  // The bases are kept; the number is not.
  const o = remember('bases', { base: '10' as '2' | '8' | '10' | '16' | 'other', other: 36, out: 36 });

  let number = $state('');
  let otherText = $state(untrack(() => String(o.other)));
  let outText = $state(untrack(() => String(o.out)));

  // A number from the home: as a decimal, unless it carries its own prefix (that reads anyway).
  const given = untrack(() => texts(items)[0]?.trim());
  if (given) {
    number = given;
    if (parse(given, 10)?.ok) o.base = '10';
  }

  const toBase = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s.trim()) : NaN);
  const inBase = $derived(o.base === 'other' ? toBase(otherText) : Number(o.base));
  const outBase = $derived(toBase(outText));
  const parsed = $derived(parse(number, inBase));
  const v = $derived(parsed?.ok ? parsed.value : null);

  function setOther(s: string) {
    otherText = s;
    if (validBase(toBase(s))) o.other = toBase(s);
  }

  function setOut(s: string) {
    outText = s;
    if (validBase(toBase(s))) o.out = toBase(s);
  }

  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);
  const group3 = (n: number) => decimal(BigInt(n));

  function problem(e: ParseError): string {
    if (e.code === 'digit') {
      const text = w('digit', { char: e.char, position: e.position, base: e.base });
      return e.base === 10 && /[a-f]/i.test(e.char) ? `${text} ${w('hexHint')}` : text;
    }
    if (e.code === 'noDigits') return e.prefix ? w('noDigits', { prefix: e.prefix }) : w('noDigitsBare');
    if (e.code === 'fraction') return w(e.char === ',' ? 'fractionComma' : 'fractionPoint');
    if (e.code === 'tooLong') return w('tooLong', { n: group3(MAX_DIGITS) });
    return w('baseBad');
  }

  const readAs = $derived.by(() => {
    if (!parsed?.ok) return '';
    if (parsed.prefix === '0x') return w('hexP');
    if (parsed.prefix === '0b') return w('binP');
    if (parsed.prefix === '0o') return w('octP');
    return w('baseN', { n: parsed.base });
  });
  /** The answer: the hex of a decimal, the decimal of anything else. */
  const fromDecimal = $derived(parsed?.ok === true && parsed.base === 10);
  const list = $derived(v === null ? [] : bytes(v));
  const bytesNote = $derived(v !== null && v < 0n ? w('bytesTwos', { bytes: w('bytes', { n: list.length }) }) : w('bytes', { n: list.length }));
</script>

<div class="bases">
  <div class="cols">
    <div class="stack">
      <dl class="spec">
        <div>
          <dt>{w('number')}</dt>
          <dd><NumIn label={w('number')} value={number} width="100%" inputmode="text" oninput={(s) => (number = s)} /></dd>
        </div>
        <div>
          <dt>{w('base')}</dt>
          <dd>
            <Seg
              label={w('base')}
              value={o.base}
              options={[
                { value: '2', label: '2' },
                { value: '8', label: '8' },
                { value: '10', label: '10' },
                { value: '16', label: '16' },
                { value: 'other', label: w('other') },
              ]}
              onchange={(b) => (o.base = b)}
            />
            {#if o.base === 'other'}
              <NumIn label={w('otherBase')} value={otherText} size="mid" width="120px" inputmode="numeric" oninput={setOther} />
            {/if}
            {#if readAs}<span class="note" aria-live="polite">{w('readAs', { what: readAs })}</span>{/if}
          </dd>
        </div>
        <div>
          <dt>{w('also')}</dt>
          <dd><NumIn label={w('alsoBase')} value={outText} prefix={w('base')} size="mid" width="200px" inputmode="numeric" oninput={setOut} /></dd>
        </div>
      </dl>
      <p class="note">{w('hint')}</p>
    </div>

    <div class="stack results">
      {#if parsed && !parsed.ok}
        <p class="error" role="alert">{problem(parsed)}</p>
      {:else if v === null}
        <p class="note">{w('empty')}</p>
      {:else}
        <Receipt title={w('bases')} aside={quote(number.trim().length > 24 ? `${number.trim().slice(0, 22)}…` : number.trim())}>
          <Row label={w('binary')} value={shown(v, 2)} copy={plain(v, 2)} />
          <Row label={w('octal')} value={shown(v, 8)} copy={plain(v, 8)} />
          <Row label={w('dec')} value={shown(v, 10)} copy={plain(v, 10)} hl={!fromDecimal} />
          <Row label={w('hex')} value={shown(v, 16)} copy={plain(v, 16)} hl={fromDecimal} />
          {#if validBase(outBase)}
            <Row label={w('baseRow', { n: outBase })} value={shown(v, outBase)} copy={plain(v, outBase)} />
          {:else}
            <Row label={w('baseRow', { n: outText.trim() || '?' })} value={w('baseBad')} copy={null} quiet />
          {/if}
        </Receipt>

        <Receipt title={w('bitsBytes')}>
          <Row label={w('bits')} value={String(bitLength(v))} sub={v < 0n ? w('bitsTwos') : ''} />
          <Row label={w('bigEndian')} value={hexBytes(list)} copy={hexBytes(list).replace(/ /g, '')} sub={bytesNote} />
          <Row label={w('littleEndian')} value={hexBytes([...list].reverse())} copy={hexBytes([...list].reverse()).replace(/ /g, '')} sub={bytesNote} />
        </Receipt>

        <Receipt title={w('twos')}>
          {#each WIDTHS as width (width)}
            {@const t = twos(v, width)}
            {#if t.fits}
              <Row label={w('widthBits', { n: width })} value={t.hex} copy={t.hex.replace(/ /g, '')} sub={`${t.binary} · ${w('meaning', { s: decimal(t.signed), u: decimal(t.unsigned) })}`} />
            {:else}
              <Row
                label={w('widthBits', { n: width })}
                value={t.negative ? w('noFitNeg', { n: width, min: decimal(t.min), max: decimal(t.max) }) : w('noFitPos', { n: width, max: decimal(t.max) })}
                copy={null}
                quiet
              />
            {/if}
          {/each}
        </Receipt>
      {/if}
    </div>
  </div>
</div>

<style>
  .bases {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .results {
    container-type: inline-size;
  }
</style>
