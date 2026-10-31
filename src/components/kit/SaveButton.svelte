<!--
  The ink Save bar. On a phone it opens the share sheet (Save Image, Save to Files), elsewhere it
  downloads; from the Many files setting's count on, the files go as one ZIP. The results must be
  ready before the tap: the share sheet only opens straight from it.
-->
<script lang="ts">
  import { Download, Share } from '@lucide/svelte';
  import { save, sharesFiles, type Output } from '../../lib/save.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { t } from '../../lib/i18n.svelte.ts';
  import { toast } from '../../../vendor/ewo/elements/toaster.js';
  import { yours } from '../../lib/memory.svelte.ts';

  interface Props {
    outputs: Output[] | null;
    /** The ZIP's name when there are several. */
    zipName?: string;
    busy?: boolean;
    /** The tool, for its place in the recents. */
    tool?: string;
    /** Instead of "Save <name>". */
    label?: string;
  }

  let { outputs, zipName = 'fundus', busy = false, tool, label }: Props = $props();
  const phone = sharesFiles();

  const text = $derived.by(() => {
    if (busy) return t('tool.working');
    if (label) return label;
    const n = outputs?.length ?? 0;
    if (n === 1) return t('tool.saveAs', { name: outputs![0].name });
    if (n > 1) return shared.zipFrom > 0 && n >= shared.zipFrom ? t('tool.saveZip', { n }) : t('tool.saveN', { n });
    return t('tool.save');
  });

  async function go() {
    if (!outputs?.length) return;
    const result = await save(outputs, zipName);
    if (result === 'cancelled') return;
    if (tool) yours.used(tool);
    toast(result === 'shared' ? t('tool.shared') : t('tool.saved'), { tone: 'ok', duration: 2200 });
  }
</script>

<button type="button" class="save" disabled={busy || !outputs?.length} onclick={go}>
  {#if phone}<Share aria-hidden="true" />{:else}<Download aria-hidden="true" />{/if}
  <span>{text}</span>
</button>
