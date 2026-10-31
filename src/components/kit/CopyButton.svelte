<!-- Copies a text; says "Copied" for a moment. -->
<script lang="ts">
  import { copyText } from '../../lib/save.ts';
  import { t } from '../../lib/i18n.svelte.ts';
  import { toast } from '../../../vendor/ewo/elements/toaster.js';

  interface Props {
    text: string;
    label?: string;
    /** The small mono tag (in a receipt line) or a full button. */
    variant?: 'tag' | 'button';
  }

  let { text, label, variant = 'tag' }: Props = $props();
  let done = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  async function copy() {
    if (await copyText(text)) {
      done = true;
      clearTimeout(timer);
      timer = setTimeout(() => (done = false), 1400);
    } else toast(t('tool.copyFailed'), { tone: 'bad' });
  }
</script>

<button type="button" class={variant === 'tag' ? 'tag' : 'btn'} onclick={copy} aria-live="polite">{done ? t('tool.copied') : (label ?? t('tool.copy'))}</button>

<style>
  .tag {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    padding: 3px 6px;
    border: 1px solid var(--ink);
    white-space: nowrap;
  }
</style>
