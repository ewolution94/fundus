<!--
  A date to pick: the browser's own date field (its picker on a phone), drawn as an underlined
  figure like NumIn, with a small Today beside it. The value is ISO ("2026-10-31") or empty.
-->
<script lang="ts">
  interface Props {
    value: string;
    label: string;
    oninput: (value: string) => void;
    /** Today's ISO date for the Today button; none without it. */
    today?: string;
    todayLabel?: string;
  }

  let { value, label, oninput, today, todayLabel = 'Today' }: Props = $props();
</script>

<div class="date-row">
  <input class="date-in" type="date" aria-label={label} min="0001-01-01" max="9999-12-31" {value} oninput={(e) => oninput(e.currentTarget.value)} />
  {#if today}
    <button type="button" class="btn small" disabled={value === today} onclick={() => oninput(today)}>{todayLabel}</button>
  {/if}
</div>

<style>
  .date-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .date-in {
    flex: 0 1 230px;
    min-width: 0;
    width: 100%;
    min-height: 40px;
    padding: 2px 0;
    border: 0;
    border-bottom: 2px solid var(--ink);
    border-radius: 0;
    background: none;
    color: var(--ink);
    font-family: var(--sans);
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .date-in:focus {
    box-shadow: 0 3px 0 var(--mark);
  }

  /* iOS centres the date and collapses an empty field. */
  .date-in::-webkit-date-and-time-value {
    text-align: left;
    min-height: 1.4em;
  }

  .date-in::-webkit-calendar-picker-indicator {
    cursor: pointer;
  }
</style>
