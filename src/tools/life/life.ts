// The numbers of Life in numbers. Plain TypeScript with erasable types, tested as it is.
//
// Calendar counts (days, weeks, months, birthdays, the round days) are whole local calendar days
// (dates.ts: plain dates, no time of day), so no clock change can shift them. Hours, minutes and
// seconds are real elapsed time from the moment of birth in the device's own zone: the time given,
// else the start of that day. A 29 February birthday falls on 28 February in other years (dates.ts).

import { toDays, fromDays, addMonths, ymd, isoOf, age } from '../dates/dates.ts';
import { crc32 } from '../../lib/exif.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
/** A Julian year: what "years" on other planets are counted in. */
export const YEAR = 365.25 * DAY;
export const HEARTBEATS_PER_MINUTE = 70;

/** The local calendar date of an instant, in the device's zone. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return isoOf({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
}

/** "07:30" or "7:30:15" as [hours, minutes, seconds]; null for anything else. */
export function parseTime(time: string): [number, number, number] | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time ?? '').trim());
  if (!m) return null;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return h < 24 && min < 60 && s < 60 ? [h, min, s] : null;
}

/** The instant of a local date at a time ("07:30"; the day's start without one), in the device's zone. */
export function instant(date: string, time = ''): number {
  const p = ymd(date);
  if (!p) return NaN;
  const [h, min, s] = parseTime(time) ?? [0, 0, 0];
  const d = new Date(2000, 0, 1);
  // setFullYear, not the constructor: it reads years 0–99 as 1900–1999.
  d.setFullYear(p.y, p.m - 1, p.d);
  d.setHours(h, min, s, 0);
  return d.getTime();
}

// ── Counts ─────────────────────────────────────────────────────────────────────────────────

export interface Counts {
  /** The age: whole years, then months, then days. */
  years: number;
  months: number;
  days: number;
  /** Calendar days since the day of birth. */
  totalDays: number;
  /** totalDays as whole weeks and the days left. */
  weeks: number;
  weekDays: number;
  /** Whole calendar months. */
  totalMonths: number;
  /** Elapsed time since the moment of birth. */
  hours: number;
  minutes: number;
  seconds: number;
  /** About, at 70 a minute. */
  heartbeats: number;
  /** Elapsed milliseconds. */
  ms: number;
}

/** Everything counted at `now`; null before the birth (or without a date). */
export function counts(birth: string, time: string, now: number): Counts | null {
  const born = instant(birth, time);
  if (!Number.isFinite(born) || born > now) return null;
  const a = age(birth, localDate(now));
  if (!a) return null;
  const ms = now - born;
  return {
    years: a.years,
    months: a.months,
    days: a.days,
    totalDays: a.total,
    weeks: Math.floor(a.total / 7),
    weekDays: a.total % 7,
    totalMonths: a.years * 12 + a.months,
    hours: Math.floor(ms / HOUR),
    minutes: Math.floor(ms / MINUTE),
    seconds: Math.floor(ms / 1000),
    heartbeats: Math.floor((ms / MINUTE) * HEARTBEATS_PER_MINUTE),
    ms,
  };
}

export interface Birthday {
  /** The date, the age turned on it, and the days until it (0: today). */
  date: string;
  turns: number;
  inDays: number;
}

/** The next birthday (today's, when it's today; never the day of birth itself). */
export function nextBirthday(birth: string, today: string): Birthday | null {
  const a = age(birth, today);
  if (!a) return null;
  if (a.turns > 0) return { date: a.next, turns: a.turns, inDays: a.nextIn };
  const date = addMonths(birth, 12);
  return { date, turns: 1, inDays: toDays(date) - toDays(today) };
}

/** The next round birthday, a multiple of ten (today's, when it's today). */
export function roundBirthday(birth: string, today: string): Birthday | null {
  const a = age(birth, today);
  if (!a) return null;
  const isToday = a.nextIn === 0 && a.years > 0;
  const turns = isToday && a.years % 10 === 0 ? a.years : (Math.floor(a.years / 10) + 1) * 10;
  const date = addMonths(birth, turns * 12);
  return { date, turns, inDays: toDays(date) - toDays(today) };
}

// ── Round numbers ──────────────────────────────────────────────────────────────────────────

export type Unit = 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';
export interface Count {
  unit: Unit;
  n: number;
}

export interface Milestone {
  /** What turns round that day: two at once when they fall on the same date (7,000 days and 1,000 weeks). */
  counts: Count[];
  /** The local date. */
  date: string;
  /** For the order: the moment for hours, minutes and seconds, the day's start for the others. */
  at: number;
  /** Hours, minutes or seconds: it has a time of day. */
  timed: boolean;
}

const steps = (from: number, to: number, by: number) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);

/** The round numbers looked for, per unit. */
export const LADDER: Record<Unit, number[]> = {
  days: [100, 500, ...steps(1_000, 40_000, 1_000)],
  weeks: [100, 500, 1_000, 2_000, 3_000, 4_000, 5_000],
  months: steps(100, 1_200, 100),
  hours: steps(100_000, 900_000, 100_000),
  minutes: [1_000_000, 10_000_000, 20_000_000, 30_000_000, 40_000_000, 50_000_000],
  seconds: [1_000_000_000, 2_000_000_000, 3_000_000_000],
};

const UNIT_MS = { hours: HOUR, minutes: MINUTE, seconds: 1000 };
const RANK: Unit[] = ['months', 'weeks', 'days', 'hours', 'minutes', 'seconds'];

/** Every round number of a life, in order. */
export function milestones(birth: string, time = ''): Milestone[] {
  const start = toDays(birth);
  if (!Number.isFinite(start)) return [];
  const byDate = new Map<string, Milestone>();
  const onDay = (unit: Unit, n: number, date: string) => {
    if (!ymd(date)) return;
    const had = byDate.get(date);
    if (had) had.counts.push({ unit, n });
    else byDate.set(date, { counts: [{ unit, n }], date, at: instant(date), timed: false });
  };
  for (const n of LADDER.days) onDay('days', n, fromDays(start + n));
  for (const n of LADDER.weeks) onDay('weeks', n, fromDays(start + 7 * n));
  for (const n of LADDER.months) onDay('months', n, addMonths(birth, n));
  const out = [...byDate.values()];
  for (const m of out) m.counts.sort((a, b) => RANK.indexOf(a.unit) - RANK.indexOf(b.unit));
  const born = instant(birth, time);
  for (const unit of ['hours', 'minutes', 'seconds'] as const) {
    for (const n of LADDER[unit]) {
      const at = born + n * UNIT_MS[unit];
      out.push({ counts: [{ unit, n }], date: localDate(at), at, timed: true });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Whether a round number is behind: a day once it's over, a moment once it's come. */
export const passed = (m: Milestone, now: number) => (m.timed ? m.at <= now : m.date < localDate(now));

/** The last round number passed, and the next `count`. */
export function around(list: Milestone[], now: number, count = 5): { last: Milestone | null; next: Milestone[] } {
  const i = list.findIndex((m) => !passed(m, now));
  const behind = i < 0 ? list.length : i;
  return { last: behind > 0 ? list[behind - 1] : null, next: i < 0 ? [] : list.slice(i, i + count) };
}

/** Calendar days from today to a date: negative before. */
export const daysUntil = (date: string, today: string) => toDays(date) - toDays(today);

// ── Other planets ──────────────────────────────────────────────────────────────────────────

/** Orbital periods in Earth years. */
export const PLANETS = [
  { id: 'mercury', period: 0.2408467 },
  { id: 'venus', period: 0.61519726 },
  { id: 'mars', period: 1.8808158 },
  { id: 'jupiter', period: 11.862615 },
  { id: 'saturn', period: 29.447498 },
  { id: 'uranus', period: 84.016846 },
  { id: 'neptune', period: 164.79132 },
] as const;

export type Planet = (typeof PLANETS)[number]['id'];

/** The age in each planet's own years, from the time alive. */
export function planetAges(ms: number): { id: Planet; age: number }[] {
  return PLANETS.map((p) => ({ id: p.id, age: ms / YEAR / p.period }));
}

// ── Your life in weeks ─────────────────────────────────────────────────────────────────────

export const ROWS = 90;
export const COLS = 52;

export interface Weeks {
  /** The row (the year of life) and the column (its week) of this week; row is ROWS past 90. */
  row: number;
  col: number;
  /** Boxes filled: every week before this one. */
  lived: number;
}

/**
 * A row is a year of life from one birthday to the next, a column a week of it; a year's last day
 * or two (or a leap year's) stay in its 52nd week.
 */
export function lifeWeeks(birth: string, today: string): Weeks | null {
  const a = age(birth, today);
  if (!a) return null;
  if (a.years >= ROWS) return { row: ROWS, col: 0, lived: ROWS * COLS };
  const since = toDays(today) - toDays(addMonths(birth, a.years * 12));
  const col = Math.min(COLS - 1, Math.floor(since / 7));
  return { row: a.years, col, lived: a.years * COLS + col };
}

export interface PosterWords {
  title: string;
  /** "Born 15 May 1990" */
  born: string;
  /** The line at the foot: what a box is, how many are filled. */
  legend: string;
  age: string;
  week: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mm = (n: number) => String(Number(n.toFixed(3)));

/** The poster's layout on an A4 page, in millimetres. */
export const PAGE = { width: 210, height: 297 };
const TOP = 58;
const BOTTOM = 280;
/** A box's pitch, and the extra space after every tenth row. */
const PITCH = (BOTTOM - TOP) / (ROWS + 8 * 0.6);
const GAP = PITCH * 0.6;
const BOX = PITCH * 0.78;
const LEFT = (PAGE.width - COLS * PITCH) / 2 + 3;

/** Where a box sits. */
export function boxAt(row: number, col: number): { x: number; y: number } {
  return { x: LEFT + col * PITCH, y: TOP + row * PITCH + Math.floor(row / 10) * GAP };
}

/**
 * The poster: 90 rows of 52 weeks on an A4 page, the weeks lived filled, this week in the
 * highlighter, the decades along the side. Ink on white whatever the theme: it's for printing.
 */
export function posterSvg(weeks: Weeks, words: PosterWords): string {
  const INK = '#121212';
  const MARK = '#ffe14a';
  let filled = '';
  let empty = '';
  let current = '';
  const b = mm(BOX);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const { x, y } = boxAt(row, col);
      const box = `M${mm(x)} ${mm(y)}h${b}v${b}h-${b}z`;
      if (i < weeks.lived) filled += box;
      else if (i === weeks.lived && weeks.row < ROWS) current = box;
      else empty += box;
    }
  }
  const sans = `font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"`;
  const labels: string[] = [];
  for (let row = 0; row < ROWS; row += 10) {
    const { y } = boxAt(row, 0);
    labels.push(`<text x="${mm(LEFT - 2.2)}" y="${mm(y + BOX)}" text-anchor="end" font-size="2.6">${row}</text>`);
  }
  for (const col of [1, 10, 20, 30, 40, 52]) {
    const { x } = boxAt(0, col - 1);
    labels.push(`<text x="${mm(x + BOX / 2)}" y="${mm(TOP - 2)}" text-anchor="middle" font-size="2.2">${col}</text>`);
  }
  const right = LEFT + COLS * PITCH - (PITCH - BOX);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}mm" height="${PAGE.height}mm" viewBox="0 0 ${PAGE.width} ${PAGE.height}">`,
    `<rect width="${PAGE.width}" height="${PAGE.height}" fill="#ffffff"/>`,
    `<g fill="${INK}" ${sans}>`,
    `<text x="${mm(LEFT)}" y="30" font-size="10" font-weight="700" letter-spacing="-0.3">${esc(words.title)}</text>`,
    `<text x="${mm(LEFT)}" y="38" font-size="4.2">${esc(words.born)}</text>`,
    `<text x="${mm(LEFT - 2.2)}" y="${mm(TOP - 6)}" text-anchor="end" font-size="2.4" font-weight="700">${esc(words.age)} ↓</text>`,
    `<text x="${mm(LEFT)}" y="${mm(TOP - 6)}" font-size="2.4" font-weight="700">${esc(words.week)} →</text>`,
    ...labels,
    `</g>`,
    `<path d="${filled}" fill="${INK}"/>`,
    `<path d="${empty}" fill="none" stroke="${INK}" stroke-width="0.16"/>`,
    current ? `<path d="${current}" fill="${MARK}" stroke="${INK}" stroke-width="0.35"/>` : '',
    `<text x="${mm(LEFT)}" y="289" fill="${INK}" font-size="2.8" ${sans}>${esc(words.legend)}</text>`,
    `<line x1="${mm(LEFT)}" x2="${mm(right)}" y1="284" y2="284" stroke="${INK}" stroke-width="0.3"/>`,
    `</svg>`,
  ].join('\n');
}

/** A4 at 300 dpi, portrait: the PNG's size in pixels. */
export const PRINT = { dpi: 300, width: 2480, height: 3508 };

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A PNG's chunks: type, where it starts and its whole length (12 + data). */
export function pngChunks(png: Uint8Array): { type: string; start: number; size: number }[] {
  const out = [];
  for (let i = 8; i + 8 <= png.length; ) {
    const size = 12 + u32(png, i);
    out.push({ type: String.fromCharCode(...png.subarray(i + 4, i + 8)), start: i, size });
    i += size;
  }
  return out;
}

/**
 * The same PNG saying it's `dpi` dots per inch (a pHYs chunk right after the header, any old one
 * gone), so it prints at A4. Browsers' canvases write none.
 */
export function withDpi(png: Uint8Array, dpi: number): Uint8Array {
  const perMetre = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  const v = new DataView(data.buffer);
  v.setUint32(0, perMetre);
  v.setUint32(4, perMetre);
  data[8] = 1;
  const phys = chunk('pHYs', data);
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  for (const c of pngChunks(png)) {
    if (c.type === 'pHYs') continue;
    parts.push(png.subarray(c.start, c.start + c.size));
    if (c.type === 'IHDR') parts.push(phys);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The dots per inch a PNG says it has; null without a pHYs in metres. */
export function dpiOf(png: Uint8Array): number | null {
  const c = pngChunks(png).find((x) => x.type === 'pHYs');
  if (!c || png[c.start + 16] !== 1) return null;
  return Math.round(u32(png, c.start + 8) * 0.0254);
}
