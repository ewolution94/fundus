<!--
  The table's first rows, scrolling sideways (and down) inside its own frame, never the page. Each
  column's head holds its type (Number, Text, Date), then its name from the header row, or its
  letter when there is none. Row numbers count the way Excel will: the header is row 1.
-->
<script lang="ts">
  import { columnLetter } from '../../lib/csv.ts';
  import type { ColumnType, Value } from './csv.ts';

  interface Props {
    /** The rows to show, the header row first when there is one. */
    rows: Value[][];
    columns: number;
    header: boolean;
    types: ColumnType[];
    show: (v: Value) => string;
    ontype: (column: number, type: ColumnType) => void;
    labels: { caption: string; row: string; type: string; number: string; text: string; date: string; column: string };
  }

  let { rows, columns, header, types, show, ontype, labels }: Props = $props();

  const names = $derived(Array.from({ length: columns }, (_, c) => (header ? show(rows[0]?.[c] ?? null) : '')));
  const body = $derived(header ? rows.slice(1) : rows);
  const first = $derived(header ? 2 : 1);
  const oneLine = (s: string) => s.replace(/\r\n?|\n/g, ' ↵ ');
  const label = (c: number) => labels.type.replace('{name}', names[c] || labels.column.replace('{n}', columnLetter(c)));
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex: a frame that scrolls is reached by the keyboard -->
<div class="work scroller" role="region" aria-label={labels.caption} tabindex="0">
  <table class="cells">
    <caption class="sr">{labels.caption}</caption>
    <thead>
      <tr>
        <th class="no" scope="col"><span class="sr">{labels.row}</span></th>
        {#each names as name, c (c)}
          <th scope="col" class:num={types[c] === 'number'}>
            <select class="kind" aria-label={label(c)} value={types[c]} onchange={(e) => ontype(c, e.currentTarget.value as ColumnType)}>
              <option value="number">{labels.number}</option>
              <option value="text">{labels.text}</option>
              <option value="date">{labels.date}</option>
            </select>
            {#if header}
              <span class="name" title={name}>{oneLine(name) || ' '}</span>
            {:else}
              <span class="name letter">{columnLetter(c)}</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each body as row, r (r)}
        <tr>
          <th class="no" scope="row">{first + r}</th>
          {#each row as v, c (c)}
            {@const s = show(v)}
            <td class:num={types[c] === 'number'} class:day={types[c] === 'date'} title={s.length > 24 || s.includes('\n') ? s : undefined}>{oneLine(s)}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroller {
    overflow: auto;
    max-height: min(70vh, 560px);
    overscroll-behavior-x: contain;
  }

  .cells {
    border-collapse: separate;
    border-spacing: 0;
    min-width: 100%;
    font-size: 13px;
    line-height: 1.35;
  }

  th,
  td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--rule);
    text-align: left;
    white-space: nowrap;
    vertical-align: baseline;
  }

  td {
    max-width: 24ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  td + td,
  th + th,
  .no + td {
    border-left: 1px solid var(--rule);
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--card);
    border-bottom: 1.5px solid var(--ink);
    vertical-align: bottom;
    padding-top: 4px;
  }

  .no {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--card);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 400;
    color: var(--ink-2);
    text-align: right;
    min-width: 34px;
    border-right: 1px solid var(--rule);
  }

  thead .no {
    z-index: 2;
  }

  .num,
  .day {
    font-family: var(--mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .num {
    text-align: right;
  }

  thead .num {
    text-align: right;
  }

  .name {
    display: block;
    max-width: 24ch;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 700;
  }

  .letter {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 400;
    color: var(--ink-2);
  }

  .kind {
    appearance: none;
    display: inline-block;
    margin: 0 0 4px;
    padding: 2px 16px 2px 0;
    border: 0;
    border-radius: 0;
    background-color: transparent;
    background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      calc(100% - 7px) 55%,
      calc(100% - 3px) 55%;
    background-size: 4px 4px;
    background-repeat: no-repeat;
    color: var(--ink-2);
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    cursor: pointer;
  }

  .kind:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  @media (hover: hover) and (pointer: fine) {
    .kind:hover {
      color: var(--ink);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }

  /* The iPhone zooms into a field under 16 px. */
  @media (hover: none) {
    .kind {
      font-size: 16px;
      text-transform: none;
      letter-spacing: 0;
    }
  }
</style>
