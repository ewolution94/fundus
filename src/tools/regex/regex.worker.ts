// The matching, away from the page: a pattern that backtracks without end blocks only this worker,
// and the page stops it after a second (Tool.svelte). It says "started" first, so the second counts
// from when the work begins, not from when the worker loaded.

import { run } from './regex.ts';

export interface Job {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  replacement: string | null;
}

const scope = globalThis as unknown as { postMessage(message: unknown): void; onmessage: ((e: MessageEvent<Job>) => void) | null };

scope.onmessage = (e) => {
  const { id, pattern, flags, text, replacement } = e.data;
  scope.postMessage({ id, started: true });
  scope.postMessage({ id, result: run(pattern, flags, text, replacement) });
};
