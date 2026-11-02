// This visit's draws: the coin's tally and the last ten results. Kept while the page is open (to
// another tool and back too), never stored: a reload starts again.

import type { Face } from './random.ts';

export type Kind = 'coin' | 'dice' | 'one' | 'some' | 'shuffle' | 'teams';

export interface Entry {
  /** The draw's number this visit, from 1. */
  n: number;
  kind: Kind;
  face?: Face;
  dice?: number[];
  sides?: number;
  names?: string[];
  teams?: string[][];
}

export const MAX_LOG = 10;

export const visit = $state({ heads: 0, tails: 0, count: 0, log: [] as Entry[] });

export function record(entry: Omit<Entry, 'n'>) {
  visit.count++;
  visit.log = [{ ...entry, n: visit.count }, ...visit.log].slice(0, MAX_LOG);
}
