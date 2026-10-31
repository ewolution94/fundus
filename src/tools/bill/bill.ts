// The sums of Split a bill, all in whole cents: a tip, shares that add up to the total exactly,
// and who pays whom so everyone has paid their share. Plain TypeScript with erasable types, tested
// as it is.

import { roundCents } from '../../lib/numbers.ts';

/** Euros (as read with parseNumber) to whole cents, rounded the way a receipt does. */
export const toCents = (euros: number) => (Number.isFinite(euros) ? Math.round(roundCents(euros) * 100) : NaN);

/**
 * `total` cents in `n` shares: as even as cents allow, the leftover cents one each to the first
 * ones, so the shares always add up to the total.
 */
export function split(total: number, n: number): number[] {
  if (!Number.isInteger(total) || !Number.isInteger(n) || n < 1) return [];
  const base = Math.floor(total / n);
  const left = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < left ? 1 : 0));
}

export interface Bill {
  /** The bill without the tip, in cents. */
  base: number;
  tip: number;
  /** What rounding each share up added (more tip). */
  extra: number;
  /** base + tip + extra: what everyone pays together. */
  total: number;
  shares: number[];
}

/**
 * The bill for `people`: the tip at `percent` on top of `amount`, or already in it (`in`: then the
 * amount is the total, and the tip is what's left over the bill without it). With `roundUp`, each
 * share goes up to whole euros and the extra is more tip. Null for no amount or no people.
 */
export function bill(amount: number, percent: number, tipIs: 'top' | 'in', people: number, roundUp = false): Bill | null {
  if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(people) || people < 1 || !Number.isFinite(percent) || percent < 0) return null;
  let base: number;
  let tip: number;
  if (tipIs === 'top') {
    base = amount;
    tip = Math.round((amount * percent) / 100 + 1e-9);
  } else {
    base = Math.round(amount / (1 + percent / 100) + 1e-9);
    tip = amount - base;
  }
  const due = base + tip;
  const shares = roundUp ? Array.from({ length: people }, () => Math.ceil(due / people / 100) * 100) : split(due, people);
  const total = shares.reduce((a, b) => a + b, 0);
  return { base, tip, extra: total - due, total, shares };
}

export interface Transfer {
  /** Who pays (an index into the people). */
  from: number;
  /** Who gets it. */
  to: number;
  amount: number;
}

/**
 * Who pays whom, from what each person paid and what their share is: few payments, never more
 * than one less than the people involved. First the ones who are exactly even with each other
 * (one payment settles both), then the largest debt to the largest credit, again and again.
 * Every balance ends at zero to the cent; null when the payments don't add up to the shares.
 */
export function settle(paid: number[], shares: number[]): Transfer[] | null {
  if (paid.length !== shares.length) return null;
  const balance = paid.map((p, i) => p - shares[i]);
  if (balance.reduce((a, b) => a + b, 0) !== 0) return null;
  const out: Transfer[] = [];
  // Exact pairs.
  for (let i = 0; i < balance.length; i++) {
    if (balance[i] >= 0) continue;
    const j = balance.findIndex((b) => b === -balance[i]);
    if (j === -1) continue;
    out.push({ from: i, to: j, amount: balance[j] });
    balance[j] = 0;
    balance[i] = 0;
  }
  // The rest, largest first.
  for (;;) {
    let debtor = -1;
    let creditor = -1;
    for (let i = 0; i < balance.length; i++) {
      if (balance[i] < 0 && (debtor === -1 || balance[i] < balance[debtor])) debtor = i;
      if (balance[i] > 0 && (creditor === -1 || balance[i] > balance[creditor])) creditor = i;
    }
    if (debtor === -1 || creditor === -1) break;
    const amount = Math.min(-balance[debtor], balance[creditor]);
    out.push({ from: debtor, to: creditor, amount });
    balance[debtor] += amount;
    balance[creditor] -= amount;
  }
  return out;
}

/** The tip as a share of the bill, in percent (for "rounded up: 11.1 % tip"). */
export const tipPercent = (b: Bill) => (b.base ? ((b.tip + b.extra) / b.base) * 100 : 0);
