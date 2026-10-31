<!--
  F-503 Convert units: one value and its unit in, every unit of that kind out on a receipt, the
  Units setting's system first. The kitchen turns cups and spoons into grams per ingredient. A unit
  typed after the number ("5 km", "350 °F") picks the unit, and the kind.
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
  import { INGREDIENTS, DEFAULT_FROM, unitById, ordered, convert, decimals, parseQuantity, belowZero, shortOf, type Kind, type Unit } from './units.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      kind: 'Kind',
      length: 'Length',
      weight: 'Weight',
      temperature: 'Temperature',
      volume: 'Volume',
      kitchen: 'Kitchen',
      value: 'Value',
      unit: 'Unit',
      ingredient: 'Ingredient',
      first: 'First',
      metric: 'Metric',
      imperial: 'Imperial',
      nowMetric: 'Every tool now puts metric units first',
      nowImperial: 'Every tool now puts imperial units first',
      type: 'Type a value, like 5 or 5 km.',
      bad: 'Not a value we know: try 12,5 or 5 km.',
      belowZero: 'Below absolute zero (−273.15 °C): no such temperature.',
      kitchenNote: 'Spoons hold 15 and 5 ml. The US cup is 236.6 ml, the metric cup 250 ml. A packed cup of flour weighs more than a spooned one: weigh it when it matters.',
      source: 'Weights per cup from USDA FoodData Central.',
      decimal: 'Decimal {mark} from Settings',
      point: 'point',
      comma: 'comma',
    },
    de: {
      kind: 'Art',
      length: 'Länge',
      weight: 'Gewicht',
      temperature: 'Temperatur',
      volume: 'Volumen',
      kitchen: 'Küche',
      value: 'Wert',
      unit: 'Einheit',
      ingredient: 'Zutat',
      first: 'Zuerst',
      metric: 'Metrisch',
      imperial: 'Imperial',
      nowMetric: 'Jedes Werkzeug nennt jetzt metrische Einheiten zuerst',
      nowImperial: 'Jedes Werkzeug nennt jetzt imperiale Einheiten zuerst',
      type: 'Gib einen Wert ein, etwa 5 oder 5 km.',
      bad: 'Kein Wert, den wir kennen: versuch 12,5 oder 5 km.',
      belowZero: 'Unter dem absoluten Nullpunkt (−273,15 °C): diese Temperatur gibt es nicht.',
      kitchenNote: 'Löffel fassen 15 und 5 ml. Die US-Tasse hat 236,6 ml, die metrische 250 ml. Fest gedrücktes Mehl wiegt mehr als locker gelöffeltes: wieg es, wenn es darauf ankommt.',
      source: 'Gewichte pro Tasse von USDA FoodData Central.',
      decimal: 'Dezimal{mark} aus den Einstellungen',
      point: 'punkt',
      comma: 'komma',
    },
  });

  // The kind, each kind's unit and the ingredient are kept; the value typed is not.
  const o = remember('units', {
    kind: 'length' as Kind,
    from: { length: '', weight: '', temperature: '', volume: '', kitchen: '' } as Record<Kind, string>,
    ingredient: 'flour',
  });

  let text = $state('');

  /** Whatever was typed after the number picks the unit (and the kind). */
  function typed(s: string) {
    text = s;
    const q = parseQuantity(s, o.kind, parseNumber);
    if (q.unit) {
      if (q.unit.kind !== o.kind) o.kind = q.unit.kind;
      o.from[q.unit.kind] = q.unit.id;
    }
  }

  // A number (or "5 km") from the home goes in.
  const given = untrack(() => texts(items)).find((s) => Number.isFinite(parseQuantity(s, untrack(() => o.kind), parseNumber).value));
  if (given) untrack(() => typed(given.trim()));

  const lang = $derived(locale());
  const mark = $derived(shared.decimal);
  const from = $derived.by((): Unit => {
    const own = unitById(o.from[o.kind] ?? '');
    return own && own.kind === o.kind ? own : unitById(DEFAULT_FROM[o.kind][shared.units])!;
  });
  const ingredient = $derived(INGREDIENTS.find((i) => i.id === o.ingredient) ?? INGREDIENTS[0]);
  const q = $derived(parseQuantity(text, o.kind, parseNumber));
  const value = $derived(q.value);
  const hasUnit = $derived(q.unit !== null);
  const rows = $derived(ordered(o.kind, shared.units).filter((u) => u.id !== from.id));

  const show = (n: number, unit: Unit) => formatNumber(n, mark, { max: decimals(n, unit) });
  // What Copy copies: no grouping, the setting's decimal mark.
  const raw = (n: number, unit: Unit) => formatNumber(n, mark, { max: decimals(n, unit), group: false });
  // "1 US cup" but "1.25 US cups": the word follows the number as shown.
  const withUnit = (n: number, unit: Unit) => `${show(n, unit)} ${shortOf(unit, Number(raw(n, unit).replace(',', '.')), lang)}`;

  // "Kilometres · km", but "US cups, 236.6 ml" once.
  const optionName = (u: Unit) => {
    const [name, short] = [u.name[lang], u.short[lang]];
    return short.length > 2 && name.toLowerCase().includes(short.toLowerCase()) ? name : `${name} · ${short}`;
  };

  const problem = $derived(!text.trim() ? w('type') : !Number.isFinite(value) ? w('bad') : belowZero(value, from) ? w('belowZero') : '');
</script>

<div class="units">
  <Seg
    large
    label={w('kind')}
    value={o.kind}
    options={[
      { value: 'length', label: w('length') },
      { value: 'weight', label: w('weight') },
      { value: 'temperature', label: w('temperature') },
      { value: 'volume', label: w('volume') },
      { value: 'kitchen', label: w('kitchen') },
    ]}
    onchange={(k) => (o.kind = k)}
  />

  <div class="cols">
    <dl class="spec">
      <div>
        <dt>{w('value')}</dt>
        <dd><NumIn label={w('value')} value={text} unit={hasUnit ? undefined : shortOf(from, value, lang)} oninput={typed} /></dd>
      </div>
      <div>
        <dt>{w('unit')}</dt>
        <dd>
          <select class="field pick" aria-label={w('unit')} value={from.id} onchange={(e) => (o.from[o.kind] = e.currentTarget.value)}>
            {#each ordered(o.kind, shared.units) as u (u.id)}
              <option value={u.id}>{optionName(u)}</option>
            {/each}
          </select>
        </dd>
      </div>
      {#if o.kind === 'kitchen'}
        <div>
          <dt>{w('ingredient')}</dt>
          <dd>
            <select class="field pick" aria-label={w('ingredient')} value={ingredient.id} onchange={(e) => (o.ingredient = e.currentTarget.value)}>
              {#each INGREDIENTS as i (i.id)}
                <option value={i.id}>{i.name[lang]}</option>
              {/each}
            </select>
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('first')}</dt>
        <dd>
          <Seg
            label={w('first')}
            value={shared.units}
            options={[
              { value: 'metric', label: w('metric') },
              { value: 'imperial', label: w('imperial') },
            ]}
            onchange={(v) => setShared('units', v, v === 'metric' ? w('nowMetric') : w('nowImperial'), t('tool.undo'))}
          />
          <SharedNote chip="numbers" />
        </dd>
      </div>
    </dl>

    <div class="stack">
      {#if problem}
        <p class="note" class:bad={problem !== w('type')} role={problem !== w('type') ? 'alert' : undefined}>{problem}</p>
      {:else}
        <Receipt title={withUnit(value, from)} aside={o.kind === 'kitchen' ? ingredient.name[lang] : w(o.kind)}>
          {#each rows as u (u.id)}
            {@const out = convert(value, from, u, ingredient)}
            <Line label={u.name[lang]} value={withUnit(out, u)} copy={raw(out, u)} hl={u.id === from.pair} total={u.id === from.pair} />
          {/each}
        </Receipt>
      {/if}
      {#if o.kind === 'kitchen'}
        <p class="note">{w('kitchenNote')}</p>
        <p class="note">{w('source')}</p>
      {/if}
      <p class="note">{w('decimal', { mark: w(mark) })}</p>
    </div>
  </div>
</div>

<style>
  .units {
    display: grid;
    gap: 18px;
  }

  .pick {
    max-width: 320px;
  }
</style>
