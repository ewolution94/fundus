// The three sums of Percent & VAT. Plain TypeScript with erasable types, tested as it is.
//
// VAT works in cents the way a receipt does: from a gross amount the net is rounded to the cent
// and the VAT is what's left, so net + VAT is always the gross typed; from a net amount the VAT is
// rounded and added.

import { roundCents } from '../../lib/numbers.ts';

export interface Vat {
  net: number;
  vat: number;
  gross: number;
}

/** `amount` is gross (VAT included) or net; `rate` in percent (19, 7). */
export function vat(amount: number, rate: number, amountIs: 'gross' | 'net'): Vat {
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return { net: NaN, vat: NaN, gross: NaN };
  if (amountIs === 'gross') {
    const gross = roundCents(amount);
    const net = roundCents(gross / (1 + rate / 100));
    return { net, vat: roundCents(gross - net), gross };
  }
  const net = roundCents(amount);
  const tax = roundCents(net * (rate / 100));
  return { net, vat: tax, gross: roundCents(net + tax) };
}

export interface PercentOf {
  /** x % of y */
  part: number;
  /** y + x % */
  plus: number;
  /** y − x % */
  minus: number;
}

export function percentOf(x: number, y: number): PercentOf {
  const part = (y * x) / 100;
  return { part, plus: y + part, minus: y - part };
}

export interface Change {
  /** In percent; NaN from 0. */
  percent: number;
  difference: number;
  /** `to` as a percentage of `from`; NaN from 0. */
  ratio: number;
}

export function change(from: number, to: number): Change {
  return {
    percent: from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100,
    difference: to - from,
    ratio: from === 0 ? NaN : (to / from) * 100,
  };
}

/** The usual rates: Germany's two. Others are typed. */
export const RATES = [19, 7];
