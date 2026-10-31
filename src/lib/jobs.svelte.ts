/**
 * Work on each file that follows a tool's options. A file is worked on once per set of options
 * (the key: everything the result depends on, as a string); a change of options starts over, the
 * work for the old ones stops between files, and a result made for other options is never offered,
 * so Save can't hand out a stale file.
 *
 * Call it while the component sets up (it holds an effect):
 *
 *   const jobs = perFile(() => files, () => `${target}|${format}`, async (file, stale) => …);
 *   jobs.get(file)?.value   jobs.ready   jobs.busy
 */

import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export interface Done<R> {
  key: string;
  value?: R;
  error?: unknown;
}

export function perFile<R>(files: () => File[], key: () => string, work: (file: File, stale: () => boolean) => Promise<R>) {
  const done = new SvelteMap<File, Done<R>>();
  let busy = $state(false);

  $effect(() => {
    const list = files();
    const k = key();
    let cancelled = false;
    const stale = () => cancelled;
    busy = list.length > 0;
    (async () => {
      for (const file of list) {
        if (cancelled) return;
        if (untrack(() => done.get(file))?.key === k) continue;
        try {
          const value = await work(file, stale);
          if (!cancelled) done.set(file, { key: k, value });
        } catch (error) {
          if (!cancelled) done.set(file, { key: k, error });
        }
      }
      if (!cancelled) busy = false;
    })();
    return () => {
      cancelled = true;
    };
  });

  return {
    /** Still working on something. */
    get busy() {
      return busy;
    },
    /** A file's result for the current options, if it's there yet. */
    get(file: File): Done<R> | undefined {
      const d = done.get(file);
      return d && d.key === key() ? d : undefined;
    },
    /** Every file has its result (or its error) for the current options. */
    get ready() {
      const list = files();
      const k = key();
      return list.length > 0 && list.every((f) => done.get(f)?.key === k);
    },
    /** The values, in the files' order, once every file has one; null before (or if one failed). */
    get values(): R[] | null {
      const list = files();
      const k = key();
      const out: R[] = [];
      for (const f of list) {
        const d = done.get(f);
        if (!d || d.key !== k || d.error !== undefined) return null;
        out.push(d.value as R);
      }
      return out.length ? out : null;
    },
    forget(file: File) {
      done.delete(file);
    },
  };
}
