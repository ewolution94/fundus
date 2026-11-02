<!--
  F-404 Coin, dice, pick one: a coin that flips in 3D, one to six dice of four to twenty sides, and a
  list to pick from, shuffle or split into teams. Every result is drawn first from the browser's
  crypto (random.ts); the flip, the tumble and the flicker only stage it, and reduced motion skips
  them. The last ten results stay on screen for this visit; nothing is stored but the options.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Minus, Plus } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import TextIn from '../../components/kit/TextIn.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, type Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { flip, landing, flipFrames, roll, sum, tumble, entries, pickOne, pickSome, shuffled, teams, flicker, slowing, teamsText, SIDES, MAX_DICE, type Face } from './random.ts';
  import { visit, record, type Entry } from './visit.svelte.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      coin: 'Coin',
      dice: 'Dice',
      list: 'List',
      heads: 'Heads',
      tails: 'Tails',
      flip: 'Flip',
      flipCoin: 'Flip the coin',
      inAir: 'In the air…',
      tapCoin: 'Tap the coin, or Flip.',
      tally: 'This visit',
      count: 'How many',
      sides: 'Sides',
      side: 'd{n}',
      roll: 'Roll',
      rolling: 'Rolling…',
      total: 'Total',
      tapRoll: 'Tap Roll.',
      rolled: 'Rolled {values}: {total}',
      names: 'One per line',
      placeholder: 'Names or options, one per line',
      draw: 'Draw',
      one: 'Pick one',
      some: 'Pick several',
      shuffle: 'Shuffle',
      teams: 'Teams',
      howMany: 'How many',
      teamCount: 'Teams',
      fewer: 'Fewer',
      more: 'More',
      pickN: 'Pick {n}',
      makeTeams: 'Make {n} teams',
      picking: 'Drawing…',
      needTwo: 'Two names or more, one per line.',
      'n.names.one': '{n} name',
      'n.names.other': '{n} names',
      repeats: 'Repeats count once: {n} left out.',
      picked: 'Picked',
      order: 'New order',
      teamN: 'Team {n}',
      copyList: 'Copy the list',
      copyTeams: 'Copy the teams',
      last: 'Last draws',
      lastNote: 'this visit, newest first',
      none: 'Nothing drawn yet.',
      diceN: '{n} × d{s}',
      teamsN: '{n} teams',
      fair: 'Every result is drawn from the browser’s crypto before anything moves; the animation only shows it.',
    },
    de: {
      mode: 'Modus',
      coin: 'Münze',
      dice: 'Würfel',
      list: 'Liste',
      heads: 'Kopf',
      tails: 'Zahl',
      flip: 'Werfen',
      flipCoin: 'Münze werfen',
      inAir: 'In der Luft…',
      tapCoin: 'Tipp auf die Münze oder auf Werfen.',
      tally: 'Dieser Besuch',
      count: 'Anzahl',
      sides: 'Seiten',
      side: 'W{n}',
      roll: 'Würfeln',
      rolling: 'Rollt…',
      total: 'Summe',
      tapRoll: 'Tipp auf Würfeln.',
      rolled: 'Gewürfelt {values}: {total}',
      names: 'Eine pro Zeile',
      placeholder: 'Namen oder Optionen, eine pro Zeile',
      draw: 'Ziehung',
      one: 'Eins losen',
      some: 'Mehrere losen',
      shuffle: 'Mischen',
      teams: 'Teams',
      howMany: 'Wie viele',
      teamCount: 'Teams',
      fewer: 'Weniger',
      more: 'Mehr',
      pickN: '{n} losen',
      makeTeams: '{n} Teams bilden',
      picking: 'Wird gelost…',
      needTwo: 'Zwei Namen oder mehr, einer pro Zeile.',
      'n.names.one': '{n} Name',
      'n.names.other': '{n} Namen',
      repeats: 'Doppelte zählen einmal: {n} weggelassen.',
      picked: 'Gelost',
      order: 'Neue Reihenfolge',
      teamN: 'Team {n}',
      copyList: 'Liste kopieren',
      copyTeams: 'Teams kopieren',
      last: 'Letzte Ziehungen',
      lastNote: 'dieser Besuch, neueste zuerst',
      none: 'Noch nichts gezogen.',
      diceN: '{n} × W{s}',
      teamsN: '{n} Teams',
      fair: 'Jedes Ergebnis kommt aus dem Krypto-Zufall des Browsers, bevor sich etwas bewegt; die Animation zeigt es nur.',
    },
  });

  type Mode = 'coin' | 'dice' | 'list';
  type Draw = 'one' | 'some' | 'shuffle' | 'teams';
  // How it's set is kept; the list isn't.
  const o = remember('random', { mode: 'coin' as Mode, count: 1, sides: 6, draw: 'one' as Draw, some: 2, teams: 2 });

  // A list handed in (pasted on the home) fills the field and opens the list.
  let text = $state('');
  const given = untrack(() => texts(items)).find((s) => entries(s).names.length >= 2);
  if (given) {
    text = given;
    o.mode = 'list';
  }

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  let said = $state('');

  // ── Coin ─────────────────────────────────────────────────────────────────────────────────

  // The coin's turn so far (each flip carries on from it), and the face it shows.
  let angle = $state(0);
  let up = $state<Face>('heads');
  let face = $state<Face | null>(null);
  let flipping = $state(false);
  let coinEl = $state<HTMLElement>();
  let tossEl = $state<HTMLElement>();
  let faceEls = $state<Record<Face, HTMLElement | undefined>>({ heads: undefined, tails: undefined });
  const FLIP_MS = 1150;
  const FACES: Face[] = ['heads', 'tails'];

  async function flipCoin() {
    if (flipping) return;
    // The result first; the flip only lands on it.
    const result = flip();
    const from = angle;
    const moving = !still() && coinEl && tossEl;
    const to = landing(from, result, moving ? 5 : 0);
    angle = to;
    up = result;
    if (moving) {
      flipping = true;
      face = null;
      said = '';
      // Drawn flat (the coin's height and which face shows, frame by frame): the same in every
      // browser, and the last frame is the result.
      const frames = flipFrames(from, to);
      const timing = { duration: FLIP_MS, easing: 'linear' };
      const spin = coinEl!.animate(
        frames.map((f) => ({ offset: f.offset, transform: `scaleY(${f.scale.toFixed(3)})` })),
        timing,
      );
      for (const side of FACES) faceEls[side]?.animate(frames.map((f) => ({ offset: f.offset, opacity: f.face === side ? 1 : 0 })), timing);
      tossEl!.animate(
        [
          { transform: 'translateY(0) scale(1)', easing: 'cubic-bezier(0.25, 0.7, 0.45, 1)' },
          { transform: 'translateY(-72px) scale(1.08)', offset: 0.42, easing: 'cubic-bezier(0.55, 0, 0.75, 0.3)' },
          { transform: 'translateY(0) scale(1)' },
        ],
        { duration: FLIP_MS * 0.82 },
      );
      await spin.finished.catch(() => undefined);
      flipping = false;
    }
    face = result;
    visit[result]++;
    record({ kind: 'coin', face: result });
    said = w(result);
  }

  // ── Dice ─────────────────────────────────────────────────────────────────────────────────

  const count = $derived(Math.min(MAX_DICE, Math.max(1, o.count)));
  const sides = $derived((SIDES as readonly number[]).includes(o.sides) ? o.sides : 6);
  let shown = $state<number[]>([]);
  let tilt = $state<number[]>([]);
  let rolled = $state<number[] | null>(null);
  let rolling = $state(false);

  // New dice, nothing rolled on them yet.
  $effect(() => {
    const n = count;
    const s = sides;
    untrack(() => {
      if (rolling) return;
      rolled = null;
      shown = Array.from({ length: n }, () => s);
      tilt = shown.map(() => 0);
    });
  });

  async function rollDice() {
    if (rolling) return;
    const n = count;
    const s = sides;
    const result = roll(n, s);
    if (!still()) {
      rolling = true;
      rolled = null;
      said = '';
      const frames = tumble(result, s, 9);
      const times = slowing(frames.length, 620);
      for (let i = 0; i < frames.length; i++) {
        await wait(times[i] - (times[i - 1] ?? 0));
        shown = frames[i];
        // Decoration only: how far each die is turned mid-tumble.
        tilt = i === frames.length - 1 ? frames[i].map(() => 0) : frames[i].map(() => Math.round((Math.random() - 0.5) * 50));
      }
      rolling = false;
    }
    shown = result;
    tilt = result.map(() => 0);
    rolled = result;
    record({ kind: 'dice', dice: result, sides: s });
    said = w('rolled', { values: result.join(', '), total: sum(result) });
  }

  const PIPS: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[29, 29], [71, 71]],
    3: [[29, 29], [50, 50], [71, 71]],
    4: [[29, 29], [71, 29], [29, 71], [71, 71]],
    5: [[29, 29], [71, 29], [50, 50], [29, 71], [71, 71]],
    6: [[29, 27], [71, 27], [29, 50], [71, 50], [29, 73], [71, 73]],
  };

  /** Outlines for the dice without pips, in a 100 × 100 box; where their number sits. */
  const pentagon = Array.from({ length: 5 }, (_, i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return `${(50 + 47 * Math.cos(a)).toFixed(1)} ${(53 + 47 * Math.sin(a)).toFixed(1)}`;
  }).join(' L');
  const hexagon = Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return `${(50 + 47 * Math.cos(a)).toFixed(1)} ${(50 + 47 * Math.sin(a)).toFixed(1)}`;
  }).join(' L');
  const SHAPES: Record<number, { d: string; inner?: string; y: number }> = {
    4: { d: 'M50 6 L95 88 L5 88 Z', y: 74 },
    8: { d: 'M50 3 L97 50 L50 97 L3 50 Z', y: 62 },
    10: { d: 'M50 3 L96 42 L50 97 L4 42 Z', y: 58 },
    12: { d: `M${pentagon} Z`, y: 66 },
    20: { d: `M${hexagon} Z`, inner: 'M50 18 L82 72 L18 72 Z', y: 62 },
  };

  // ── A list ───────────────────────────────────────────────────────────────────────────────

  const list = $derived(entries(text));
  const n = $derived(list.names.length);
  const some = $derived(Math.max(1, Math.min(o.some, Math.max(1, n))));
  const teamCount = $derived(Math.max(2, Math.min(o.teams, Math.max(2, n))));

  interface Picked {
    kind: Draw;
    names: string[];
    teams?: string[][];
  }
  let picked = $state<Picked | null>(null);
  let flick = $state<string | null>(null);
  let picking = $state(false);

  async function drawList() {
    if (picking || n < 2) return;
    const names = list.names;
    const kind = o.draw;
    if (kind === 'one') {
      const one = pickOne(names);
      if (!still()) {
        picking = true;
        picked = null;
        said = '';
        const frames = flicker(names, one, Math.min(16, 6 + names.length * 2));
        const times = slowing(frames.length, 950);
        for (let i = 0; i < frames.length; i++) {
          await wait(times[i] - (times[i - 1] ?? 0));
          flick = frames[i];
        }
        picking = false;
      }
      flick = null;
      picked = { kind, names: [one] };
      record({ kind: 'one', names: [one] });
      said = `${w('picked')}: ${one}`;
      return;
    }
    if (kind === 'some') {
      const chosen = pickSome(names, some);
      picked = { kind, names: chosen };
      record({ kind: 'some', names: chosen });
      said = `${w('picked')}: ${chosen.join(', ')}`;
    } else if (kind === 'shuffle') {
      const order = shuffled(names);
      picked = { kind, names: order };
      record({ kind: 'shuffle', names: order });
      said = `${w('order')}: ${order.join(', ')}`;
    } else {
      const split = teams(names, teamCount);
      picked = { kind, names: split.flat(), teams: split };
      record({ kind: 'teams', teams: split });
      said = teamsText(split, (k) => w('teamN', { n: k }));
    }
  }

  const drawLabel = $derived(o.draw === 'one' ? w('one') : o.draw === 'some' ? w('pickN', { n: some }) : o.draw === 'shuffle' ? w('shuffle') : w('makeTeams', { n: teamCount }));
  const copyText = $derived.by(() => {
    if (!picked) return '';
    if (picked.teams) return teamsText(picked.teams, (k) => w('teamN', { n: k }));
    if (picked.kind === 'shuffle') return picked.names.map((x, i) => `${i + 1}. ${x}`).join('\n');
    return picked.names.join('\n');
  });

  function step(key: 'some' | 'teams', by: number) {
    const now = key === 'some' ? some : teamCount;
    const min = key === 'some' ? 1 : 2;
    o[key] = Math.max(min, Math.min(Math.max(min, n), now + by));
  }

  // ── The last draws ───────────────────────────────────────────────────────────────────────

  function describe(e: Entry): { what: string; result: string } {
    if (e.kind === 'coin') return { what: w('coin'), result: w(e.face!) };
    if (e.kind === 'dice') {
      const d = e.dice!;
      return { what: w('diceN', { n: d.length, s: e.sides! }), result: d.length > 1 ? `${d.join(' + ')} = ${sum(d)}` : String(d[0]) };
    }
    if (e.kind === 'one') return { what: w('one'), result: e.names![0] };
    if (e.kind === 'some') return { what: w('pickN', { n: e.names!.length }), result: e.names!.join(', ') };
    if (e.kind === 'shuffle') return { what: w('shuffle'), result: e.names!.join(', ') };
    return { what: w('teamsN', { n: e.teams!.length }), result: e.teams!.map((t) => t.join(', ')).join(' / ') };
  }

  const busy = $derived(flipping || rolling || picking);
</script>

<div class="rand">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'coin', label: w('coin') },
      { value: 'dice', label: w('dice') },
      { value: 'list', label: w('list') },
    ]}
    onchange={(m) => {
      if (!busy) o.mode = m;
    }}
  />

  <div class="cols">
    <div class="stack">
      {#if o.mode === 'coin'}
        <div class="stage">
          <button type="button" class="toss" bind:this={tossEl} aria-label={w('flipCoin')} disabled={flipping} onclick={flipCoin}>
            <span class="coin" bind:this={coinEl} data-angle={angle} data-up={up}>
              {#each FACES as side (side)}
                <span class="face" class:up={up === side} bind:this={faceEls[side]}>
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="48" class="rim" />
                    <circle cx="50" cy="50" r="40.5" class="ring" />
                    {#each Array.from({ length: 40 }, (_, i) => i) as i (i)}
                      {@const a = (i * 9 * Math.PI) / 180}
                      <circle cx={50 + 44.3 * Math.cos(a)} cy={50 + 44.3 * Math.sin(a)} r="1.15" class="bead" />
                    {/each}
                    {#if side === 'heads'}
                      <path class="mark" d="M62 77 C60 73 59 70 59 66 C62 66 64.5 64.5 65 61.5 L66.5 59.5 L68.5 58.5 L66.8 56.8 L68.6 55 L67.2 52.6 C69.8 51.6 72.2 50.4 72.8 48.6 C71 45.6 69.4 42.6 69 39.5 C68.6 30 61 23 51 23 C39 23 30 31 29 43 C28.4 51.5 31.5 58.5 36.5 63 C38 66 38.5 70 37.5 74 L36 80.5 Z" />
                    {:else}
                      <text class="mark" x="50" y="66" text-anchor="middle">1</text>
                    {/if}
                  </svg>
                </span>
              {/each}
            </span>
          </button>
        </div>
        <div class="answer-row">
          {#if face && !flipping}
            <b class="word hl" data-face={face}>{w(face)}</b>
          {:else}
            <span class="word quiet">{flipping ? w('inAir') : w('tapCoin')}</span>
          {/if}
        </div>
      {:else if o.mode === 'dice'}
        <div class="tray" class:rolling aria-busy={rolling}>
          {#each shown as v, i (i)}
            {@const shape = SHAPES[sides]}
            <svg class="die" class:dim={!rolled && !rolling} viewBox="0 0 100 100" role="img" aria-label={String(v)} data-value={v} style:transform={tilt[i] ? `rotate(${tilt[i]}deg)` : undefined}>
              {#if sides === 6}
                <rect x="5" y="5" width="90" height="90" rx="9" class="body" />
                {#each PIPS[Math.min(6, Math.max(1, v))] as [x, y], k (k)}
                  <circle cx={x} cy={y} r="8.5" class="pip" />
                {/each}
              {:else}
                <path d={shape.d} class="body" />
                {#if shape.inner}<path d={shape.inner} class="edge" />{/if}
                <text x="50" y={shape.y} text-anchor="middle" class="num">{v}</text>
              {/if}
            </svg>
          {/each}
        </div>
        <div class="answer-row">
          {#if rolled}
            <span class="sum"><small>{count > 1 ? w('total') : w('diceN', { n: 1, s: sides })}</small><b class="hl" data-total={sum(rolled)}>{sum(rolled)}</b></span>
          {:else}
            <span class="word quiet">{rolling ? w('rolling') : w('tapRoll')}</span>
          {/if}
        </div>
      {:else}
        <TextIn id="random-list" label={w('names')} value={text} placeholder={w('placeholder')} rows={9} oninput={(v) => (text = v)} />
        <p class="note">
          {w('n.names', { n })}{#if list.repeats}{` · ${w('repeats', { n: list.repeats })}`}{/if}
        </p>
      {/if}
    </div>

    <div class="stack">
      {#if o.mode === 'coin'}
        <button type="button" class="btn ink go" disabled={flipping} onclick={flipCoin}>{w('flip')}</button>
        <dl class="spec">
          <div>
            <dt>{w('tally')}</dt>
            <dd>
              <span class="tally" data-tally>
                <span><b data-heads>{visit.heads}</b> {w('heads')}</span>
                <span><b data-tails>{visit.tails}</b> {w('tails')}</span>
              </span>
            </dd>
          </div>
        </dl>
      {:else if o.mode === 'dice'}
        <dl class="spec">
          <div>
            <dt>{w('count')}</dt>
            <dd>
              <Seg label={w('count')} value={count} options={Array.from({ length: MAX_DICE }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} onchange={(v) => (o.count = v)} />
            </dd>
          </div>
          <div>
            <dt>{w('sides')}</dt>
            <dd>
              <Seg label={w('sides')} value={sides} options={SIDES.map((s) => ({ value: s as number, label: w('side', { n: s }) }))} onchange={(v) => (o.sides = v)} />
            </dd>
          </div>
        </dl>
        <button type="button" class="btn ink go" disabled={rolling} onclick={rollDice}>{w('roll')}</button>
      {:else}
        <dl class="spec">
          <div>
            <dt>{w('draw')}</dt>
            <dd>
              <Seg
                label={w('draw')}
                value={o.draw}
                options={[
                  { value: 'one', label: w('one') },
                  { value: 'some', label: w('some') },
                  { value: 'shuffle', label: w('shuffle') },
                  { value: 'teams', label: w('teams') },
                ]}
                onchange={(v) => (o.draw = v)}
              />
            </dd>
          </div>
          {#if o.draw === 'some' || o.draw === 'teams'}
            {@const key = o.draw}
            {@const value = key === 'some' ? some : teamCount}
            {@const min = key === 'some' ? 1 : 2}
            <div>
              <dt>{key === 'some' ? w('howMany') : w('teamCount')}</dt>
              <dd class="stepper">
                <button type="button" class="btn step" aria-label={w('fewer')} disabled={value <= min} onclick={() => step(key, -1)}><Minus aria-hidden="true" /></button>
                <b class="k" aria-live="polite" data-k>{value}</b>
                <button type="button" class="btn step" aria-label={w('more')} disabled={value >= Math.max(min, n)} onclick={() => step(key, 1)}><Plus aria-hidden="true" /></button>
              </dd>
            </div>
          {/if}
        </dl>
        <button type="button" class="btn ink go" disabled={picking || n < 2} onclick={drawList}>{drawLabel}</button>
        {#if n < 2}<p class="note">{w('needTwo')}</p>{/if}

        {#if picking && flick !== null}
          <div class="result" aria-hidden="true">
            <p class="one flicking">{flick}</p>
          </div>
        {:else if picked}
          <section class="result" aria-label={picked.kind === 'shuffle' ? w('order') : picked.kind === 'teams' ? w('teams') : w('picked')} data-result={picked.kind}>
            {#if picked.kind === 'one'}
              <p class="one"><span class="hl" data-pick>{picked.names[0]}</span></p>
            {:else if picked.teams}
              <div class="teams">
                {#each picked.teams as team, i (i)}
                  <div class="team" data-team={i + 1}>
                    <h3 class="label">{w('teamN', { n: i + 1 })} · {team.length}</h3>
                    <ul>
                      {#each team as name (name)}<li>{name}</li>{/each}
                    </ul>
                  </div>
                {/each}
              </div>
              <CopyButton text={copyText} variant="button" label={w('copyTeams')} />
            {:else}
              <ol class="names">
                {#each picked.names as name (name)}<li>{name}</li>{/each}
              </ol>
              <CopyButton text={copyText} variant="button" label={w('copyList')} />
            {/if}
          </section>
        {/if}
      {/if}

      <section class="log" aria-labelledby="random-log">
        <h2 class="h" id="random-log">{w('last')}<em>{w('lastNote')}</em></h2>
        {#if visit.log.length}
          <ol class="draws">
            {#each visit.log as e (e.n)}
              {@const d = describe(e)}
              <li data-draw={e.n}>
                <span class="m no">#{e.n}</span>
                <span class="what">{d.what}</span>
                <span class="res">{d.result}</span>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="note">{w('none')}</p>
        {/if}
      </section>
      <p class="note">{w('fair')}</p>
    </div>
  </div>
</div>
<p class="sr" aria-live="polite">{said}</p>

<style>
  .rand {
    display: grid;
    gap: 18px;
  }

  .go {
    min-height: 52px;
    font-size: 17px;
    width: 100%;
  }

  /* ── Coin ── */

  .stage {
    display: grid;
    place-items: center;
    padding: 84px 0 18px;
    border-bottom: 1.5px solid var(--ink);
  }

  .toss {
    width: min(220px, 62vw);
    aspect-ratio: 1;
    display: block;
    border-radius: 50%;
  }

  .toss:disabled {
    opacity: 1;
    cursor: default;
  }

  .coin {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
  }

  .face {
    position: absolute;
    inset: 0;
    display: block;
    opacity: 0;
  }

  .face.up {
    opacity: 1;
  }

  .face svg {
    width: 100%;
    height: 100%;
  }

  .rim {
    fill: var(--card);
    stroke: var(--ink);
    stroke-width: 2.5;
  }

  .ring {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1;
  }

  .bead {
    fill: var(--ink);
  }

  .mark {
    fill: var(--ink);
  }

  text.mark {
    font-family: var(--sans);
    font-size: 46px;
    font-weight: 800;
  }

  .answer-row {
    display: flex;
    justify-content: center;
    align-items: baseline;
    min-height: 56px;
  }

  .word {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.2;
    padding: 0 8px;
  }

  .word.quiet {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-2);
    letter-spacing: 0;
    align-self: center;
  }

  .tally {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    font-size: 15px;
  }

  .tally b {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  /* ── Dice ── */

  .tray {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: center;
    gap: 14px;
    min-height: 220px;
    padding: 24px 0;
    border-bottom: 1.5px solid var(--ink);
  }

  .die {
    width: 76px;
    height: 76px;
    flex: none;
  }

  .die .body {
    fill: var(--card);
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linejoin: round;
  }

  .die .edge {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .die .pip {
    fill: var(--ink);
  }

  .die .num {
    fill: var(--ink);
    font-family: var(--sans);
    font-size: 30px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .die.dim .pip,
  .die.dim .num {
    fill: var(--ink-2);
  }

  .die.dim .body,
  .die.dim .edge {
    stroke: var(--ink-2);
  }

  .sum {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .sum small {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .sum b {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.1;
    padding: 0 8px;
    font-variant-numeric: tabular-nums;
  }

  /* ── List ── */

  .stepper {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .step {
    width: 40px;
    min-height: 40px;
    padding: 0;
  }

  .k {
    min-width: 2ch;
    text-align: center;
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .result {
    display: grid;
    gap: 12px;
    justify-items: start;
    padding: 14px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    min-width: 0;
  }

  .one {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .one span {
    padding: 0 6px;
  }

  .one.flicking {
    color: var(--ink-2);
    padding: 0 6px;
  }

  .names {
    margin: 0;
    padding-left: 2.2em;
    display: grid;
    gap: 4px;
    font-size: 17px;
    font-weight: 600;
    min-width: 0;
  }

  .names li {
    overflow-wrap: anywhere;
  }

  .names li::marker {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-2);
  }

  .teams {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 14px 18px;
    width: 100%;
  }

  .team {
    min-width: 0;
  }

  .team h3 {
    padding-bottom: 6px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--rule);
  }

  .team ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 16px;
    font-weight: 600;
  }

  .team li {
    overflow-wrap: anywhere;
  }

  /* ── The last draws ── */

  .log {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .draws {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .draws li {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    gap: 10px;
    align-items: baseline;
    padding: 7px 0;
    border-bottom: 1px dashed var(--rule);
    font-size: 14px;
  }

  .draws .no {
    color: var(--ink-2);
  }

  .draws .what {
    font-weight: 600;
    white-space: nowrap;
  }

  .draws .res {
    font-family: var(--mono);
    font-size: 12px;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  @media (min-width: 760px) {
    .stage {
      padding-top: 96px;
    }

    .die {
      width: 88px;
      height: 88px;
    }
  }
</style>
