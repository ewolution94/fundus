// "Everything offline" (Settings): the MP3 worker and the LAME file it loads come later than the
// tool's component, so they're fetched here once, for the service worker to keep.

import { warmUp } from './media.ts';

export default function preload(): Promise<void> {
  return warmUp();
}
