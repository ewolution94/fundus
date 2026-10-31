/**
 * The inbox: whatever someone dropped, pasted or picked, on its way into a tool. The home holds it
 * while it shows the tools that take it; opening one hands it over (`take`), and a tool's result
 * can go on to the next tool the same way (chaining). Only in memory: close the tab and it's gone.
 *
 * It also picks up what other apps sent: Android's and desktop Chrome's share sheet (public/sw.js
 * keeps it until here) and files opened with the installed app (the launch queue).
 */

export type Item = { file: File } | { text: string };

class Inbox {
  items = $state<Item[]>([]);
  /** Which tool the items are meant for, when they came from a tool's result. */
  for = $state<string | null>(null);
  /** The tool and result they came from, for the next tool's "from" line. */
  from = $state<string | null>(null);

  put(items: Item[], options: { for?: string; from?: string } = {}) {
    this.items = items;
    this.for = options.for ?? null;
    this.from = options.from ?? null;
  }

  /** Hands the items to a tool and empties the inbox. */
  take(): Item[] {
    const items = this.items;
    this.items = [];
    this.for = null;
    this.from = null;
    return items;
  }

  clear() {
    this.take();
  }
}

export const inbox = new Inbox();

export const files = (items: Item[]) => items.filter((i): i is { file: File } => 'file' in i).map((i) => i.file);
export const texts = (items: Item[]) => items.filter((i): i is { text: string } => 'text' in i).map((i) => i.text);

/** Files and text from a paste or a drop (a dropped link comes as text). */
export function fromTransfer(data: DataTransfer | null): Item[] {
  if (!data) return [];
  const list = [...data.files].map((file) => ({ file }));
  if (list.length) return list;
  const text = data.getData('text/plain') || data.getData('text/uri-list');
  return text.trim() ? [{ text }] : [];
}

/** What the share sheet or the launch queue brought, once, at start. */
export async function arrivals(): Promise<Item[]> {
  const items: Item[] = [];
  if (new URLSearchParams(location.search).has('shared') && 'caches' in self) {
    try {
      const cache = await caches.open('fundus-shared');
      for (const req of await cache.keys()) {
        const res = await cache.match(req);
        if (!res) continue;
        if (req.url.endsWith('/shared/text')) items.push({ text: await res.text() });
        else {
          const name = decodeURIComponent(res.headers.get('x-name') ?? 'shared');
          items.push({ file: new File([await res.blob()], name, { type: res.headers.get('content-type') ?? '' }) });
        }
        await cache.delete(req);
      }
    } catch {}
    history.replaceState(null, '', location.pathname);
  }
  const queue = (window as unknown as { launchQueue?: { setConsumer(fn: (p: { files: FileSystemFileHandle[] }) => void): void } }).launchQueue;
  if (queue) {
    await new Promise<void>((resolve) => {
      let done = false;
      queue.setConsumer(async (params) => {
        for (const handle of params.files ?? []) items.push({ file: await handle.getFile() });
        if (!done) resolve();
        done = true;
      });
      setTimeout(() => {
        if (!done) resolve();
        done = true;
      }, 50);
    });
  }
  return items;
}
