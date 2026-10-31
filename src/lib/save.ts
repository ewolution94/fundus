/**
 * Results leave the device's memory only when someone saves them, and only to the device itself:
 * on a phone through the share sheet (the iPhone's "Save Image", "Save to Files", AirDrop), on a
 * computer as a download. From the Many files setting's count on (5 by default) they go as one ZIP.
 *
 * `navigator.share` needs the tap that asked for it, so tools compute their results first and call
 * `save()` straight from the Save button's click.
 */

import { zipSync } from 'fflate';
import { shared } from './settings.svelte.ts';

export interface Output {
  blob: Blob;
  name: string;
}

/** A phone or tablet: results go through the share sheet. */
export const sharesFiles = () => matchMedia('(pointer: coarse)').matches && typeof navigator.canShare === 'function';

/** One ZIP of several results; stored, not compressed again (photos and PDFs already are). */
export async function zip(outputs: Output[], name: string): Promise<Output> {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  const used = new Set<string>();
  for (const o of outputs) {
    let n = o.name;
    for (let k = 2; used.has(n); k++) n = o.name.replace(/(\.[^.]+)?$/, `-${k}$1`);
    used.add(n);
    files[n] = [new Uint8Array(await o.blob.arrayBuffer()), { level: 0 }];
  }
  const bytes = zipSync(files);
  return { blob: new Blob([bytes as BlobPart], { type: 'application/zip' }), name: name.endsWith('.zip') ? name : `${name}.zip` };
}

export type Saved = 'shared' | 'downloaded' | 'cancelled';

/**
 * Saves results: zipped from the setting's count on (under `zipName`), shared on a phone,
 * downloaded elsewhere. Resolves with what happened, so the tool can say so.
 */
export async function save(outputs: Output[], zipName = 'fundus'): Promise<Saved> {
  if (!outputs.length) return 'cancelled';
  let list = outputs;
  if (shared.zipFrom > 0 && outputs.length >= shared.zipFrom) list = [await zip(outputs, zipName)];

  if (sharesFiles()) {
    const files = list.map((o) => new File([o.blob], o.name, { type: o.blob.type || 'application/octet-stream' }));
    if (navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return 'shared';
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
        // NotAllowedError (the tap's moment passed) or a type the sheet refuses: download instead.
      }
    }
  }
  for (const o of list) download(o);
  return 'downloaded';
}

export function download(o: Output) {
  const url = URL.createObjectURL(o.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = o.name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Text to the clipboard; false when the browser refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older Safari without the async clipboard over a non-secure origin: the textarea way.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
