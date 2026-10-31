// Numbers people type and numbers we show. Plain TypeScript with erasable types, so the tests run it
// as it is.
//
// Typing is lenient: "249,90", "249.90", "1.234,5", "1,234.5" and "1 234" all read as people mean
// them. The last `.` or `,` followed by one or two digits is the decimal mark; every other `.`, `,`
// and space groups thousands. Three digits after a single mark are a thousands group ("1.500" is
// 1500), the way both languages write prices. Showing follows the Decimal mark setting.

export type DecimalMark = 'comma' | 'point';

/** The number in what someone typed, or NaN. */
export function parseNumber(input: string): number {
  let t = String(input).trim().replace(/[\s  ']/g, '').replace(/^\+/, '');
  if (!t) return NaN;
  const negative = /^[-−]/.test(t);
  t = t.replace(/^[-−]/, '');
  if (!/^[\d.,]+$/.test(t)) return NaN;
  const m = t.match(/^([\d.,]*?)[.,](\d{1,2})$/);
  let value: number;
  if (m) value = parseFloat(`${m[1].replace(/[.,]/g, '') || '0'}.${m[2]}`);
  else {
    // A single mark with more than two digits after it: a decimal unless it's exactly three
    // (a thousands group). "0.125" is a decimal; "1.500" is fifteen hundred.
    const one = t.match(/^(\d+)[.,](\d+)$/);
    if (one && one[2].length !== 3) value = parseFloat(`${one[1]}.${one[2]}`);
    else if (one && one[1] === '0') value = parseFloat(`0.${one[2]}`);
    else value = parseFloat(t.replace(/[.,]/g, ''));
  }
  if (!Number.isFinite(value)) return NaN;
  return negative ? -value : value;
}

/** Shows a number with the setting's decimal mark and thousands grouping. */
export function formatNumber(value: number, mark: DecimalMark, { min = 0, max = 2, group = true }: { min?: number; max?: number; group?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '–';
  return new Intl.NumberFormat(mark === 'comma' ? 'de-DE' : 'en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
    useGrouping: group,
  })
    .format(value)
    .replace(/^-/, '−');
}

/** Money: always two decimals ("249,90"). */
export const formatMoney = (value: number, mark: DecimalMark) => formatNumber(value, mark, { min: 2, max: 2 });

/** Rounds to cents the way a receipt does (half away from zero), without float drift. */
export function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) * 100 + 1e-9) / 100;
}
