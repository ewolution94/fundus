// The sums of Dates & weeks, on plain calendar dates ("2026-10-31"): no time of day, no zone, so
// no DST can shift a day. Dates count as whole days since 1970-01-01; today comes from the home
// zone (todayIn) and is the only place a clock or a zone comes in. Plain TypeScript with erasable
// types, tested as it is.
//
// Months are calendar months that clamp at the month's end: 31 January + 1 month is 28 February
// (29 in a leap year), the way a contract or a bank counts. Birthdays use the same rule, so a
// 29 February birthday falls on 28 February in other years.

const DAY = 86_400_000;

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export const daysInMonth = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

export function valid({ y, m, d }: Ymd): boolean {
  return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) && y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** "2026-10-31" */
export const isoOf = ({ y, m, d }: Ymd) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** The parts of an ISO date, or null when it isn't a real day. */
export function ymd(iso: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const date = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  return valid(date) ? date : null;
}

/** Whole days since 1970-01-01 (negative before); NaN for no date. */
export function toDays(iso: string): number {
  const p = ymd(iso);
  if (!p) return NaN;
  // setUTCFullYear, not Date.UTC: Date.UTC reads years 0–99 as 1900–1999.
  const t = new Date(0);
  t.setUTCFullYear(p.y, p.m - 1, p.d);
  return Math.round(t.getTime() / DAY);
}

export function fromDays(n: number): string {
  const t = new Date(n * DAY);
  return isoOf({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

/** A Date at midnight UTC of that day, for Intl.DateTimeFormat with timeZone 'UTC'. */
export const asUtcDate = (iso: string) => new Date(toDays(iso) * DAY);

/** 1 Monday … 7 Sunday (ISO 8601). 1970-01-01 was a Thursday. */
export const weekdayOfDays = (n: number) => ((((n + 3) % 7) + 7) % 7) + 1;
export const weekday = (iso: string) => weekdayOfDays(toDays(iso));
const workday = (n: number) => weekdayOfDays(n) <= 5;

/**
 * A date as people type or paste it: "2026-10-31", "31.10.2026", "31.10.26", "10/31/2026",
 * "2026/10/31". With slashes the month comes first, unless the first number can only be a day
 * ("31/10/2026"). A two-digit year is the one within ten years ahead of `thisYear`, else the
 * century before ("85" is 1985, "30" is 2030 in 2026).
 */
export function parseDate(text: string, thisYear = new Date().getFullYear()): string | null {
  const t = String(text ?? '').trim();
  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}.*)?$/.exec(t))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2}|\d{4})$/.exec(t))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), year(match[3], thisYear)];
  } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), year(match[3], thisYear)];
    if (m > 12 && d <= 12) [m, d] = [d, m];
  } else return null;
  const date = { y, m, d };
  return valid(date) ? isoOf(date) : null;
}

function year(text: string, thisYear: number): number {
  if (text.length === 4) return Number(text);
  const yy = Number(text);
  const century = Math.floor(thisYear / 100) * 100;
  return yy <= (thisYear % 100) + 10 ? century + yy : century - 100 + yy;
}

/** Today's date in a time zone (the home zone), at `now`. */
export function todayIn(zone: string, now = Date.now()): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return isoOf({ y: get('year'), m: get('month'), d: get('day') });
}

// ── Days between ───────────────────────────────────────────────────────────────────────────

export interface Between {
  /** The end minus the start: the end day not counted. Negative when the end comes first. */
  days: number;
  /** Both days counted (from the earlier to the later). */
  inclusive: number;
  /** Monday to Friday from the earlier to the later, both days counted. */
  workdays: number;
  /** |days| as whole weeks and the days left. */
  weeks: number;
  rest: number;
  backwards: boolean;
}

export function between(a: string, b: string): Between | null {
  const from = toDays(a);
  const to = toDays(b);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const days = to - from;
  const span = Math.abs(days);
  return {
    days,
    inclusive: span + 1,
    workdays: workdaysIn(Math.min(from, to), Math.max(from, to)),
    weeks: Math.floor(span / 7),
    rest: span % 7,
    backwards: days < 0,
  };
}

/** Monday to Friday in [from, to], both counted. */
function workdaysIn(from: number, to: number): number {
  const total = to - from + 1;
  let count = Math.floor(total / 7) * 5;
  for (let n = from + Math.floor(total / 7) * 7; n <= to; n++) if (workday(n)) count++;
  return count;
}

// ── Plus or minus ──────────────────────────────────────────────────────────────────────────

export type Step = 'days' | 'weeks' | 'months' | 'years' | 'workdays';

export const addDays = (iso: string, n: number) => fromDays(toDays(iso) + n);

/** Calendar months, clamped at the month's end: 2026-01-31 + 1 → 2026-02-28. */
export function addMonths(iso: string, n: number): string {
  const p = ymd(iso);
  if (!p) return '';
  const index = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return isoOf({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

/**
 * Working days (Monday to Friday) after a date, the date itself not counted: Friday + 1 is Monday,
 * Saturday + 1 is Monday too. Backwards for a negative n.
 */
export function addWorkdays(iso: string, n: number): string {
  let d = toDays(iso);
  const step = Math.sign(n);
  let left = Math.abs(n);
  while (left > 0) {
    // From a working day, a whole week on passes five of them.
    if (left > 5 && workday(d)) {
      d += 7 * step;
      left -= 5;
      continue;
    }
    d += step;
    if (workday(d)) left--;
  }
  return fromDays(d);
}

/** The date `n` steps on (or back, for a negative n); null when it leaves the years 1–9999. */
export function add(iso: string, n: number, step: Step): string | null {
  if (!ymd(iso) || !Number.isInteger(n)) return null;
  let out: string;
  if (step === 'days') out = addDays(iso, n);
  else if (step === 'weeks') out = addDays(iso, n * 7);
  else if (step === 'months') out = addMonths(iso, n);
  else if (step === 'years') out = addMonths(iso, n * 12);
  else {
    if (Math.abs(n) > 1_000_000) return null;
    out = addWorkdays(iso, n);
  }
  return ymd(out) ? out : null;
}

// ── Weeks ──────────────────────────────────────────────────────────────────────────────────

export interface Week {
  /** The year the week belongs to (it can differ from the date's own at New Year). */
  year: number;
  week: number;
  /** The week's first and last day: Monday–Sunday (ISO) or Sunday–Saturday (US). */
  first: string;
  last: string;
}

const yearOfDays = (n: number) => new Date(n * DAY).getUTCFullYear();

/**
 * ISO 8601: weeks start on Monday, and week 1 is the one with the year's first Thursday (the one
 * with 4 January). So 2027-01-01 is in week 53 of 2026, and 2024-12-30 in week 1 of 2025.
 */
export function isoWeek(iso: string): Week | null {
  const days = toDays(iso);
  if (!Number.isFinite(days)) return null;
  const monday = days - weekdayOfDays(days) + 1;
  const thursday = monday + 3;
  const year = yearOfDays(thursday);
  const jan1 = toDays(isoOf({ y: year, m: 1, d: 1 }));
  return { year, week: Math.floor((thursday - jan1) / 7) + 1, first: fromDays(monday), last: fromDays(monday + 6) };
}

/**
 * US weeks: they start on Sunday, and week 1 is the one with 1 January, whole: its days in December
 * belong to it too. So 2026-12-30 is in week 1 of 2027, and 2022 has 53 weeks.
 */
export function usWeek(iso: string): Week | null {
  const days = toDays(iso);
  if (!Number.isFinite(days)) return null;
  const sunday = days - (weekdayOfDays(days) % 7);
  const saturday = sunday + 6;
  const year = yearOfDays(saturday);
  const jan1 = toDays(isoOf({ y: year, m: 1, d: 1 }));
  const firstSunday = jan1 - (weekdayOfDays(jan1) % 7);
  return { year, week: Math.floor((sunday - firstSunday) / 7) + 1, first: fromDays(sunday), last: fromDays(saturday) };
}

export const weekOf = (iso: string, system: 'iso' | 'us') => (system === 'us' ? usWeek(iso) : isoWeek(iso));

/** How many weeks a year has: 52 or 53. */
export function weeksIn(year: number, system: 'iso' | 'us'): number {
  if (system === 'iso') return isoWeek(isoOf({ y: year, m: 12, d: 28 }))!.week;
  // The year's last Saturday that still counts for it: the week with 1 January next is next year's.
  const dec31 = toDays(isoOf({ y: year, m: 12, d: 31 }));
  const last = weekdayOfDays(dec31) === 6 ? dec31 : dec31 - (weekdayOfDays(dec31) % 7) - 1;
  return usWeek(fromDays(last))!.week;
}

/** 1 for 1 January. */
export function dayOfYear(iso: string): number {
  const p = ymd(iso);
  if (!p) return NaN;
  return toDays(iso) - toDays(isoOf({ y: p.y, m: 1, d: 1 })) + 1;
}

// ── Age ────────────────────────────────────────────────────────────────────────────────────

export interface Age {
  years: number;
  months: number;
  days: number;
  /** Days alive. */
  total: number;
  /** The next birthday (today's, when it's today). */
  next: string;
  /** Days until it: 0 on the birthday. */
  nextIn: number;
  /** The age turned on it. */
  turns: number;
  /** Born on 29 February: in other years the birthday is 28 February. */
  leapling: boolean;
}

/** Age on `today`; null when the birthday is after it (or either isn't a date). */
export function age(birth: string, today: string): Age | null {
  const b = ymd(birth);
  const t = ymd(today);
  if (!b || !t || toDays(birth) > toDays(today)) return null;
  const on = (months: number) => toDays(addMonths(birth, months));
  const now = toDays(today);
  let years = t.y - b.y;
  if (on(years * 12) > now) years--;
  let months = 0;
  while (months < 11 && on(years * 12 + months + 1) <= now) months++;
  const days = now - on(years * 12 + months);
  const thisOne = on(years * 12);
  const nextDay = thisOne === now ? now : on((years + 1) * 12);
  return {
    years,
    months,
    days,
    total: now - toDays(birth),
    next: fromDays(nextDay),
    nextIn: nextDay - now,
    turns: thisOne === now ? years : years + 1,
    leapling: b.m === 2 && b.d === 29,
  };
}
