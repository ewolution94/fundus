<!--
  One split-flap card, in the classic four layers: behind, the new character's upper half and the
  old one's lower half; in front, for one flip, the old upper half folds down (0 to −90°) and the new
  lower half falls onto the old (90° to 0). Without motion the character just changes.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  let { value, still = false }: { value: string; still?: boolean } = $props();

  let cur = $state(untrack(() => value));
  let prev = $state(untrack(() => value));
  let flipping = $state(false);
  let flips = $state(0);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const next = value;
    untrack(() => {
      if (next === cur) return;
      clearTimeout(timer);
      // Asked live too: the media query's change event can arrive after the next tick.
      if (still || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        prev = cur = next;
        flipping = false;
        return;
      }
      // A change mid-flip starts from what's on the card now.
      prev = cur;
      cur = next;
      flips++;
      flipping = true;
      // The animation's own end, or this, whichever comes first (hidden tabs never end one).
      timer = setTimeout(done, 700);
    });
  });

  $effect(() => () => clearTimeout(timer));

  function done() {
    clearTimeout(timer);
    flipping = false;
    prev = cur;
  }
</script>

<span class="flap" data-v={cur} aria-hidden="true">
  <span class="half up"><b>{cur}</b></span>
  <span class="half down"><b>{flipping ? prev : cur}</b></span>
  {#if flipping}
    {#key flips}
      <span class="half up fold"><b>{prev}</b></span>
      <span class="half down unfold" onanimationend={done}><b>{cur}</b></span>
    {/key}
  {/if}
</span>

<style>
  .flap {
    position: relative;
    flex: none;
    width: var(--cw);
    height: calc(var(--cw) * 1.42);
    perspective: calc(var(--cw) * 5);
  }

  .half {
    position: absolute;
    left: 0;
    right: 0;
    height: calc(50% - max(0.5px, var(--cw) * 0.008));
    overflow: hidden;
    background: var(--card);
    border-radius: 2px;
  }

  .up {
    top: 0;
  }

  .down {
    bottom: 0;
  }

  .half b {
    position: absolute;
    left: 0;
    right: 0;
    height: calc(var(--cw) * 1.42);
    line-height: calc(var(--cw) * 1.42);
    text-align: center;
    font-family: var(--sans);
    font-size: calc(var(--cw) * 1.08);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    color: var(--ink);
    white-space: pre;
  }

  .up b {
    top: 0;
  }

  .down b {
    bottom: 0;
  }

  .fold,
  .unfold {
    z-index: 1;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .fold {
    transform-origin: 50% 100%;
    animation: fold 0.24s ease-in both;
  }

  .unfold {
    transform-origin: 50% 0;
    animation: unfold 0.24s 0.24s ease-out both;
  }

  @keyframes fold {
    from {
      transform: rotateX(0deg);
    }
    to {
      transform: rotateX(-90deg);
    }
  }

  @keyframes unfold {
    from {
      transform: rotateX(90deg);
    }
    to {
      transform: rotateX(0deg);
    }
  }
</style>
