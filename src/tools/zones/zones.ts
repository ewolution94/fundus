// The sums of Time zones, with the browser's own zone data (Intl) and plain arithmetic: no zone
// library, so daylight saving is whatever the browser's tz database says for that day. Plain
// TypeScript with erasable types, tested as it is.

import { CITIES, OLD_NAMES } from './cities.ts';

const HOUR = 3_600_000;
const MIN = 60_000;

export interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function parts(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    partsCache.set(zone, f);
  }
  return f;
}

/** The wall clock in a zone at an instant. */
export function wall(zone: string, t: number): Wall {
  const out: Record<string, number> = {};
  for (const p of parts(zone).formatToParts(t)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return { y: out.year, m: out.month, d: out.day, h: out.hour % 24, min: out.minute };
}

/** Minutes the zone is ahead of UTC at an instant (−240 for New York in summer). */
export function offsetAt(zone: string, t: number): number {
  const w = wall(zone, t);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min);
  return Math.round((asUtc - Math.floor(t / MIN) * MIN) / MIN);
}

/**
 * The instant a wall-clock time happens in a zone. A time the clocks skip (02:30 on the spring
 * morning) is read as the same time on the old offset, so it lands an hour later, the way a clock
 * would show it; a time that happens twice (the autumn hour) is the first one.
 */
export function zonedToUtc(date: string, h: number, min: number, zone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const before = offsetAt(zone, guess - 12 * HOUR);
  const first = guess - before * MIN;
  const at = offsetAt(zone, first);
  if (at === before) return first;
  // The offset changes near this time: try the new one, and keep it if the wall clock agrees.
  const second = guess - at * MIN;
  const w = wall(zone, second);
  return w.h === h && w.min === min ? second : first;
}

/** "UTC+1", "UTC−4", "UTC+5:30", "UTC". */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '−';
  const a = Math.abs(minutes);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`;
}

/** How far a place is ahead of home: "+6 h", "−4:30 h", "±0 h". */
export function diffLabel(minutes: number): string {
  if (minutes === 0) return '±0 h';
  const sign = minutes > 0 ? '+' : '−';
  const a = Math.abs(minutes);
  return `${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''} h`;
}

/** Whether a zone name works in this browser. */
export function zoneOk(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const canonicalCache = new Map<string, string>();
/** The name the browser resolves a zone to ("Asia/Kolkata" and "Asia/Calcutta" are one). */
export function canonical(zone: string): string {
  let c = canonicalCache.get(zone);
  if (c === undefined) {
    try {
      c = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
    } catch {
      c = zone;
    }
    canonicalCache.set(zone, c);
  }
  return c;
}

/** The name this browser knows a zone by (its old one, for an older browser), or null. */
export const usable = (zone: string): string | null => (zoneOk(zone) ? zone : OLD_NAMES[zone] && zoneOk(OLD_NAMES[zone]) ? OLD_NAMES[zone] : null);

// ── Places ───────────────────────────────────────────────────────────────────────────────────

export interface Place {
  /** A city's slug ("new-york"), or "tz:" and a zone for a zone picked by name. */
  id: string;
  name: { en: string; de: string };
  /** ISO country code; none for a bare zone. */
  country: string;
  zone: string;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const PLACES: Place[] = CITIES.flatMap(([en, de, country, zone]) => {
  const z = usable(zone);
  return z ? [{ id: slug(en), name: { en, de: de || en }, country, zone: z }] : [];
});

/** A zone's own words: "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export const zoneCity = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ');

/** A place from its id; a bare zone becomes a place of its own. */
export function placeById(id: string): Place | null {
  if (id.startsWith('tz:')) {
    const zone = usable(id.slice(3));
    return zone ? { id, name: { en: zoneCity(zone), de: zoneCity(zone) }, country: '', zone } : null;
  }
  return PLACES.find((p) => p.id === id) ?? null;
}

/** The place for a zone: the city the zone is named after, else the zone's first city, else the zone. */
export function placeForZone(zone: string): Place {
  const same = PLACES.filter((p) => canonical(p.zone) === canonical(zone));
  return same.find((p) => p.name.en === zoneCity(zone)) ?? same[0] ?? { id: `tz:${zone}`, name: { en: zoneCity(zone), de: zoneCity(zone) }, country: '', zone };
}

/** Lower case, without accents, "ß" as "ss", separators as spaces. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[/_\-.,’']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Places for what's typed: a city in English or German, a country, or any IANA zone by name
 * ("kolkata", "Asia/Kol", "utc"). Best first: a name that starts with it, then a word in a name,
 * then the country, then the zone.
 */
export function search(query: string, countryName: (code: string) => string[], allZones: string[], limit = 8): Place[] {
  const q = fold(query);
  if (!q) return [];
  const scored: { place: Place; score: number }[] = [];
  for (const place of PLACES) {
    const names = [fold(place.name.en), fold(place.name.de)];
    const countries = countryName(place.country).map(fold);
    let score = -1;
    if (names.some((n) => n === q)) score = 0;
    else if (names.some((n) => n.startsWith(q))) score = 1;
    else if (names.some((n) => n.split(' ').some((word) => word.startsWith(q)))) score = 2;
    else if (countries.some((c) => c === q || c.startsWith(q) || c.split(' ').some((word) => word.startsWith(q)))) score = 3;
    else if (fold(place.zone).includes(q) || fold(canonical(place.zone)).includes(q)) score = 4;
    if (score >= 0) scored.push({ place, score });
  }
  scored.sort((a, b) => a.score - b.score || a.place.name.en.localeCompare(b.place.name.en));
  const out = scored.map((s) => s.place);
  // Zones by name, for anywhere the list has no city (a zone may come under its old name too).
  const covered = new Set(out.map((p) => canonical(p.zone)));
  for (const zone of allZones.includes('UTC') ? allZones : [...allZones, 'UTC']) {
    if (covered.has(canonical(zone)) || !fold(zone).includes(q)) continue;
    out.push({ id: `tz:${zone}`, name: { en: zoneCity(zone), de: zoneCity(zone) }, country: '', zone });
    covered.add(canonical(zone));
  }
  return out.slice(0, limit);
}

// ── A time that suits both ───────────────────────────────────────────────────────────────────

/** Working hours there: 9 to 17. */
export const WORK = [9, 17] as const;

export interface Hour {
  /** The home hour this cell is (0–23 on the home clock). */
  home: number;
  /** The instant it starts. */
  at: number;
  /** The place's clock at the middle of that hour, in hours (13.5 for 13:30). */
  local: number;
  /** The place's day against home's: −1 yesterday, +1 tomorrow. */
  day: number;
  working: boolean;
}

/**
 * A day on the home clock, hour by hour, as it is in a place: what time it is there and whether
 * it's working hours. A place half an hour off counts an hour as working when most of it is.
 */
export function strip(date: string, home: string, zone: string): Hour[] {
  const [y, m, d] = date.split('-').map(Number);
  const homeDay = Date.UTC(y, m - 1, d);
  return Array.from({ length: 24 }, (_, h) => {
    const at = zonedToUtc(date, h, 0, home);
    const w = wall(zone, at + 30 * MIN);
    const local = w.h + w.min / 60;
    const there = Date.UTC(w.y, w.m - 1, w.d);
    const day = Math.round((there - homeDay) / (24 * HOUR));
    return { home: h, at, local, day, working: local >= WORK[0] && local < WORK[1] };
  });
}

/** The home hours in which every place is at work. */
export function overlap(strips: Hour[][]): number[] {
  if (!strips.length) return [];
  return Array.from({ length: 24 }, (_, h) => h).filter((h) => strips.every((s) => s[h].working));
}

/** Runs of whole hours: [14, 15, 16] → [[14, 17]]. */
export function runs(hours: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}

export type Status = 'work' | 'morning' | 'evening' | 'night';

/** What people there are likely doing at a local time, in hours. */
export function status(local: number): Status {
  if (local >= WORK[0] && local < WORK[1]) return 'work';
  if (local >= 7 && local < WORK[0]) return 'morning';
  if (local >= WORK[1] && local < 22) return 'evening';
  return 'night';
}
