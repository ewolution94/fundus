<!-- The small note under a shared setting inside a tool: "for every photo tool". -->
<script lang="ts">
  import { CHIPS } from '../../lib/catalog.ts';
  import { locale, pick, t } from '../../lib/i18n.svelte.ts';

  interface Props {
    chip: string;
  }

  let { chip }: Props = $props();
  const name = $derived(pick(CHIPS.find((c) => c.id === chip)?.name ?? { en: '', de: '' }));
</script>

<!-- "for every photo tool"; German keeps the noun's capital: "für jedes Foto-Werkzeug". A shelf whose
     name is more than a noun says it whole: "for every tool in Numbers & time". -->
{#if ['photo', 'pdf', 'text'].includes(chip)}
  <span class="note">{t('tool.forEvery', { chip: locale() === 'en' && name !== 'PDF' ? name.toLowerCase() : name })}</span>
{:else}
  <span class="note">{t('tool.forEveryIn', { chip: name })}</span>
{/if}
