<!--
  A choice of a few: each option a word, the chosen one under the highlighter. Radio semantics, and
  arrow keys move the choice.
-->
<script lang="ts" generics="V extends string | number">
  interface Option {
    value: V;
    label: string;
    title?: string;
    disabled?: boolean;
  }

  interface Props {
    options: Option[];
    value: V;
    /** The group's name for screen readers. */
    label: string;
    onchange: (value: V) => void;
    /** Bigger words, for a tool's main switch (the mode). */
    large?: boolean;
  }

  let { options, value, label, onchange, large = false }: Props = $props();

  let group: HTMLDivElement;

  function key(e: KeyboardEvent) {
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === value);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + enabled.length) % enabled.length;
    else return;
    e.preventDefault();
    onchange(enabled[next].value);
    queueMicrotask(() => group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }
</script>

<div class="seg" class:large role="radiogroup" aria-label={label} bind:this={group} onkeydown={key} tabindex="-1">
  {#each options as o (o.value)}
    <button
      type="button"
      role="radio"
      aria-checked={o.value === value}
      tabindex={o.value === value ? 0 : -1}
      title={o.title}
      disabled={o.disabled}
      class:hl={o.value === value}
      onclick={() => onchange(o.value)}>{o.label}</button
    >
  {/each}
</div>

<style>
  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    outline: none;
  }

  button {
    padding: 4px 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .large button {
    padding: 5px 9px;
  }

  button[aria-checked='true'] {
    color: var(--mark-ink);
  }

  @media (hover: hover) and (pointer: fine) {
    button[aria-checked='false']:not(:disabled):hover {
      color: var(--ink);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
</style>
