<!--
  A number to type, big, underlined in ink (yellow under it while typing). It keeps what was typed
  as text, so "249,90" stays as written; read it with parseNumber() (src/lib/numbers.ts).
-->
<script lang="ts">
  interface Props {
    value: string;
    /** For screen readers (the spec row's label is beside it, not around it). */
    label: string;
    unit?: string;
    /** Unit before the number (a currency sign). */
    prefix?: string;
    size?: 'big' | 'mid';
    width?: string;
    oninput: (value: string) => void;
    id?: string;
    inputmode?: 'decimal' | 'numeric' | 'text';
  }

  let { value, label, unit, prefix, size = 'big', width = '230px', oninput, id, inputmode = 'decimal' }: Props = $props();
</script>

<label class="in" class:mid={size === 'mid'} style:max-width={width}>
  {#if prefix}<span class="unit">{prefix}</span>{/if}
  <input {id} type="text" {inputmode} autocomplete="off" spellcheck="false" aria-label={label} {value} oninput={(e) => oninput(e.currentTarget.value)} />
  {#if unit}<span class="unit">{unit}</span>{/if}
</label>

<style>
  .in {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 2px 0;
    border-bottom: 2px solid var(--ink);
  }

  input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    outline: none;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .mid input {
    font-size: 20px;
    font-weight: 700;
  }

  .unit {
    font-size: 20px;
    font-weight: 700;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .mid .unit {
    font-size: 15px;
  }

  .in:focus-within {
    box-shadow: 0 3px 0 var(--mark);
  }
</style>
