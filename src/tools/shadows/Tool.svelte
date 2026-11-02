<!--
  F-913 Shadows: a smooth, layered box-shadow from a few controls (layers, distance, blur, the
  light's angle, strength; tinted by the ground), four presets, and a card on a light and a dark
  ground side by side, each ground picked; the dark one gets its own, stronger value. Out come the
  box-shadow, the dark-ground one and filter: drop-shadow(), each to copy. A pasted box-shadow shows
  as "Yours" beside the smoothed one, and the controls start near it. Kept: the controls and the
  grounds; never a pasted shadow.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import Code from './Code.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { parseColour, toHex } from '../colours/colours.ts';
  import {
    PRESETS,
    GROUNDS,
    LIMITS,
    layersOf,
    darkStrength,
    tintOf,
    hslOf,
    hsl,
    cardOn,
    boxShadow,
    shadowValue,
    dropShadow,
    parseShadow,
    pastedValue,
    settingsNear,
    presetOf,
    type PresetId,
    type Settings,
  } from './shadows.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      preset: 'Preset',
      subtle: 'Subtle',
      card: 'Card',
      floating: 'Floating',
      sharp: 'Sharp',
      custom: 'Custom',
      layers: 'Layers',
      distance: 'Distance',
      distanceHint: 'How far the farthest layer falls',
      blur: 'Blur',
      blurHint: 'How soft the farthest layer is',
      light: 'Light',
      'dir.0': 'from the top',
      'dir.1': 'from the top right',
      'dir.2': 'from the right',
      'dir.3': 'from the bottom right',
      'dir.4': 'from the bottom',
      'dir.5': 'from the bottom left',
      'dir.6': 'from the left',
      'dir.7': 'from the top left',
      strength: 'Strength',
      strengthHint: 'All layers’ opacity added up; {dark} on the dark ground',
      tint: 'Tinted by the ground',
      tintHint: '{colour} on the light ground, not plain black',
      tintOff: 'Plain black',
      preview: 'Preview',
      lightGround: 'Light ground',
      darkGround: 'Dark ground',
      'layerCount.one': '1 layer',
      'layerCount.other': '{n} layers',
      yours: 'Yours',
      smoothed: 'Smoothed',
      yourShadow: 'Your box-shadow',
      yoursPh: 'Paste a box-shadow to compare',
      yoursNote: 'Yours: {layers}. The controls start near it.',
      unreadable: 'That isn’t a box-shadow this tool can read. Try 0 2px 8px rgba(0, 0, 0, 0.2).',
      cantDraw: 'This browser can’t draw it as written.',
      clear: 'Clear',
      out: 'CSS',
      boxShadow: 'box-shadow',
      dark: 'On the dark ground',
      drop: 'drop-shadow()',
      dropHint: 'drop-shadow() follows the shape: a PNG with see-through parts, an SVG, a clipped box. Its blur is half of box-shadow’s, so it looks the same.',
      formula: 'The layers grow along an ease-in: layer i of n falls (i/n)² of the distance with (i/n)² of the blur, and each gets an equal share of the strength.',
    },
    de: {
      preset: 'Vorlage',
      subtle: 'Dezent',
      card: 'Karte',
      floating: 'Schwebend',
      sharp: 'Scharf',
      custom: 'Eigene',
      layers: 'Ebenen',
      distance: 'Abstand',
      distanceHint: 'Wie weit die äußerste Ebene fällt',
      blur: 'Unschärfe',
      blurHint: 'Wie weich die äußerste Ebene ist',
      light: 'Licht',
      'dir.0': 'von oben',
      'dir.1': 'von oben rechts',
      'dir.2': 'von rechts',
      'dir.3': 'von unten rechts',
      'dir.4': 'von unten',
      'dir.5': 'von unten links',
      'dir.6': 'von links',
      'dir.7': 'von oben links',
      strength: 'Stärke',
      strengthHint: 'Die Deckkraft aller Ebenen zusammen; {dark} auf dem dunklen Grund',
      tint: 'Vom Grund getönt',
      tintHint: '{colour} auf dem hellen Grund, nicht einfach Schwarz',
      tintOff: 'Einfach Schwarz',
      preview: 'Vorschau',
      lightGround: 'Heller Grund',
      darkGround: 'Dunkler Grund',
      'layerCount.one': '1 Ebene',
      'layerCount.other': '{n} Ebenen',
      yours: 'Deiner',
      smoothed: 'Geglättet',
      yourShadow: 'Dein box-shadow',
      yoursPh: 'Einen box-shadow zum Vergleich einfügen',
      yoursNote: 'Deiner: {layers}. Die Regler starten in seiner Nähe.',
      unreadable: 'Das ist kein box-shadow, den dieses Werkzeug lesen kann. Versuch 0 2px 8px rgba(0, 0, 0, 0.2).',
      cantDraw: 'Dieser Browser kann ihn so nicht zeichnen.',
      clear: 'Leeren',
      out: 'CSS',
      boxShadow: 'box-shadow',
      dark: 'Auf dem dunklen Grund',
      drop: 'drop-shadow()',
      dropHint: 'drop-shadow() folgt der Form: ein PNG mit durchsichtigen Stellen, ein SVG, ein beschnittener Kasten. Seine Unschärfe ist halb so groß wie bei box-shadow, damit es gleich aussieht.',
      formula: 'Die Ebenen wachsen entlang einer Ease-in-Kurve: Ebene i von n fällt (i/n)² des Abstands mit (i/n)² der Unschärfe, und jede bekommt den gleichen Anteil der Stärke.',
    },
  });

  type Preset = PresetId | 'custom';

  // The controls, the preset and the grounds are kept; a pasted shadow is not.
  const o = remember('shadows', {
    preset: 'card' as Preset,
    ...PRESETS.card,
    angle: 0,
    tint: true,
    light: GROUNDS.light,
    dark: GROUNDS.dark,
  });

  let yoursText = $state('');
  const yours = $derived(yoursText.trim() ? parseShadow(yoursText) : null);
  const yoursValue = $derived(yours ? pastedValue(yours) : '');
  const drawable = $derived(!yours || CSS.supports('box-shadow', yoursValue));

  function setAll(s: Settings) {
    o.layers = s.layers;
    o.distance = s.distance;
    o.blur = s.blur;
    o.angle = s.angle;
    o.strength = s.strength;
    o.preset = presetOf(s) ?? 'custom';
  }

  function paste(text: string) {
    yoursText = text;
    const read = text.trim() ? parseShadow(text) : null;
    if (read) setAll(settingsNear(read));
  }

  function pick(id: Preset) {
    o.preset = id;
    if (id !== 'custom') Object.assign(o, PRESETS[id]);
  }

  function set<K extends 'layers' | 'distance' | 'blur' | 'angle' | 'strength'>(key: K, value: number) {
    o[key] = value;
    o.preset = presetOf(settings) ?? 'custom';
  }

  // A shadow from the home opens as "Yours"; a colour becomes the ground it suits.
  for (const given of untrack(() => texts(items))) {
    if (parseShadow(given)) {
      paste(given.trim());
      break;
    }
    const c = parseColour(given);
    if (c) {
      const hex = toHex({ ...c, alpha: 1 });
      if ((hslOf(hex)?.l ?? 100) >= 50) o.light = hex;
      else o.dark = hex;
      break;
    }
  }

  const settings = $derived<Settings>({ layers: o.layers, distance: o.distance, blur: o.blur, angle: o.angle, strength: o.strength });
  const lightLayers = $derived(layersOf(settings));
  const darkLayers = $derived(layersOf(settings, darkStrength(o.strength)));
  const lightTint = $derived(tintOf(o.light, o.tint));
  const darkTint = $derived(tintOf(o.dark, o.tint));
  const percent = (n: number) => `${Math.round(n * 100)} %`;

  const sides = $derived([
    { key: 'light', label: w('lightGround'), ground: o.light, value: shadowValue(lightLayers, lightTint), colours: cardOn(o.light) },
    { key: 'dark', label: w('darkGround'), ground: o.dark, value: shadowValue(darkLayers, darkTint), colours: cardOn(o.dark) },
  ] as const);

  function setGround(key: 'light' | 'dark', hex: string) {
    if (key === 'light') o.light = hex;
    else o.dark = hex;
  }
</script>

<div class="shadows">
  <div class="cols">
    <div class="stack">
      <h2 class="h">{w('preview')}</h2>
      <div class="grounds">
        {#each sides as side (side.key)}
          <figure class="side">
            <div class="ground" style:background={side.ground}>
              {#if yours && drawable}
                {@render card(w('yours'), w('layerCount', { n: yours.length }), yoursValue, side.colours, 'yours')}
              {/if}
              {@render card(yours ? w('smoothed') : '', w('layerCount', { n: lightLayers.length }), side.value, side.colours, 'ours')}
            </div>
            <figcaption>
              <label class="pickground">
                <input type="color" value={side.ground} oninput={(e) => setGround(side.key, e.currentTarget.value)} />
                <span>{side.label}</span>
              </label>
              <code>{side.ground}</code>
            </figcaption>
          </figure>
        {/each}
      </div>

      <div class="h">
        <label for="shadows-yours">{w('yourShadow')}</label>
        {#if yoursText}<em><button type="button" class="link clear" onclick={() => (yoursText = '')}>{w('clear')}</button></em>{/if}
      </div>
      <textarea
        id="shadows-yours"
        class="field code"
        rows="3"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder={w('yoursPh')}
        value={yoursText}
        oninput={(e) => paste(e.currentTarget.value)}
      ></textarea>
      {#if yoursText.trim() && !yours}
        <p class="note bad" role="alert">{w('unreadable')}</p>
      {:else if yours && !drawable}
        <p class="note bad" role="alert">{w('cantDraw')}</p>
      {:else if yours}
        <p class="note" aria-live="polite">{w('yoursNote', { layers: w('layerCount', { n: yours.length }) })}</p>
      {/if}
    </div>

    <div class="stack">
      <dl class="spec">
        <div>
          <dt>{w('preset')}</dt>
          <dd>
            <Seg
              label={w('preset')}
              value={o.preset}
              options={[
                { value: 'subtle', label: w('subtle') },
                { value: 'card', label: w('card') },
                { value: 'floating', label: w('floating') },
                { value: 'sharp', label: w('sharp') },
                { value: 'custom', label: w('custom') },
              ]}
              onchange={pick}
            />
          </dd>
        </div>
        {@render slider('layers', w('layers'), o.layers, 1, String(o.layers))}
        {@render slider('distance', w('distance'), o.distance, 1, `${o.distance} px`, w('distanceHint'))}
        {@render slider('blur', w('blur'), o.blur, 1, `${o.blur} px`, w('blurHint'))}
        {@render slider('angle', w('light'), o.angle, 1, `${o.angle}°`, w(`dir.${Math.round(o.angle / 45) % 8}` as 'dir.0'))}
        {@render slider('strength', w('strength'), o.strength, 0.01, percent(o.strength), w('strengthHint', { dark: percent(darkStrength(o.strength)) }))}
        <div>
          <dt></dt>
          <dd>
            <Check
              checked={o.tint}
              label={w('tint')}
              hint={o.tint ? w('tintHint', { colour: hsl(lightTint) }) : w('tintOff')}
              onchange={(v) => (o.tint = v)}
            />
          </dd>
        </div>
      </dl>

      <Receipt title={w('out')}>
        <Code label={w('boxShadow')} value={boxShadow(lightLayers, lightTint)} hl />
        <Code label={w('dark')} value={boxShadow(darkLayers, darkTint)} />
        <Code label={w('drop')} value={dropShadow(lightLayers, lightTint)} />
      </Receipt>
      <p class="note">{w('dropHint')}</p>
      <p class="note">{w('formula')}</p>
    </div>
  </div>
</div>

{#snippet card(title: string, sub: string, shadow: string, colours: { card: string; ink: string; line: string }, kind: string)}
  <div class="sample {kind}" style:background={colours.card} style:color={colours.ink} style:box-shadow={shadow}>
    {#if title}<b>{title}</b>{/if}
    <small>{sub}</small>
    <span class="bar" style:background={colours.line}></span>
    <span class="bar short" style:background={colours.line}></span>
  </div>
{/snippet}

{#snippet slider(key: 'layers' | 'distance' | 'blur' | 'angle' | 'strength', label: string, value: number, step: number, readout: string, hint = '')}
  <div>
    <dt><label for="shadows-{key}">{label}</label></dt>
    <dd class="slide">
      <input
        id="shadows-{key}"
        class="range"
        type="range"
        min={LIMITS[key][0]}
        max={LIMITS[key][1]}
        {step}
        {value}
        oninput={(e) => set(key, Number(e.currentTarget.value))}
      />
      <b class="count">{readout}</b>
      {#if hint}<span class="note">{hint}</span>{/if}
    </dd>
  </div>
{/snippet}

<style>
  .shadows {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  /* Light and dark side by side, on a phone too. */
  .grounds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .side {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  /* The ground is content: its colour is the one picked, and what's cast on it stays inside. */
  .ground {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 36px;
    min-height: 260px;
    padding: 44px 18px;
    border: 1.5px solid var(--ink);
    overflow: hidden;
  }

  @media (min-width: 760px) {
    .ground {
      min-height: 340px;
      padding: 56px 28px;
    }
  }

  .sample {
    display: grid;
    gap: 6px;
    width: min(100%, 200px);
    padding: 14px 14px 16px;
    border-radius: 10px;
  }

  .sample b {
    font-size: 13px;
    font-weight: 700;
  }

  .sample small {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .bar {
    display: block;
    height: 6px;
    border-radius: 3px;
  }

  .bar.short {
    width: 60%;
  }

  figcaption {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 13px;
    min-width: 0;
  }

  figcaption code {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-2);
  }

  .pickground {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    font-weight: 600;
    cursor: pointer;
  }

  input[type='color'] {
    -webkit-appearance: none;
    appearance: none;
    flex: none;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1.5px solid var(--ink);
    border-radius: 0;
    background: none;
    cursor: pointer;
  }

  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  input[type='color']::-webkit-color-swatch {
    border: 0;
    border-radius: 0;
  }

  input[type='color']::-moz-color-swatch {
    border: 0;
    border-radius: 0;
  }

  .code {
    font-family: var(--mono);
    font-size: 13px;
    min-height: 0;
    line-height: 1.5;
  }

  @media (hover: none) {
    .code {
      font-size: 16px;
    }
  }

  .h label {
    min-width: 0;
  }

  /* 40 px to tap, without making the heading taller. */
  .h .clear {
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0;
    padding: 11px 0;
    margin: -11px 0;
  }

  .slide {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    gap: 2px 12px;
  }

  .slide .note {
    grid-column: 1 / -1;
  }

  .count {
    min-width: 4.6em;
    text-align: right;
    font-family: var(--mono);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* An ink rule with an ink knob. */
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
    background: var(--ink);
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
    background: var(--ink);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }
</style>
