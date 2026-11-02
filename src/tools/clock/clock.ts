// The sums of the Flip clock: the face at a moment in 24 or 12 hours, the parts of a countdown in
// calendar days (so a countdown across a clock change still reads "2 days" at the same time of day),
// which cards change from one second to the next, and a date handed in from the home. Local time,
// the device's. Plain TypeScript with erasable types, tested as it is.

export type Cycle = 12 | 24;

/** 12 or 24 hours from Intl's hour cycle (h11/h12 or h23/h24), else from hour12; 24 when unknown. */
export function cycleOf(hourCycle?: string, hour12?: boolean): Cycle {
  if (hourCycle === 'h11' || hourCycle === 'h12') return 12;
  if (hourCycle === 'h23' || hourCycle === 'h24') return 24;
  return hour12 === true ? 12 : 24;
}

/** The device's own: its locale's hour cycle. (Only a format with an hour says which.) */
export function deviceCycle(): Cycle {
  try {
    const o = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    return cycleOf(o.hourCycle, o.hour12);
  } catch {
    return 24;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface ClockFace {
  /** Hours, minutes (and seconds): two characters each; a 12-hour clock leaves the first card blank before 10. */
  groups: string[];
  period: 'am' | 'pm' | null;
}

/** The face for a time of day. Midnight is 00:00 or 12:00 AM, noon 12:00 or 12:00 PM. */
export function clockFace(h: number, m: number, s: number, cycle: Cycle, seconds: boolean): ClockFace {
  let hours: string;
  let period: ClockFace['period'] = null;
  if (cycle === 12) {
    period = h < 12 ? 'am' : 'pm';
    hours = String(h % 12 || 12).padStart(2, ' ');
  } else hours = pad(h);
  const groups = [hours, pad(m)];
  if (seconds) groups.push(pad(s));
  return { groups, period };
}

/** The face at a moment, in the device's time zone. */
export function faceAt(ms: number, cycle: Cycle, seconds: boolean): ClockFace {
  const d = new Date(ms);
  return clockFace(d.getHours(), d.getMinutes(), d.getSeconds(), cycle, seconds);
}

// ── The countdown ────────────────────────────────────────────────────────────────────────────

/** A local date and time ("2026-12-24", "18:00") as a moment; NaN for a date that doesn't exist. A
 *  time in a clock change's gap moves on with the clock (02:30 on the spring day is 03:30). */
export function targetOf(date: string, time: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? '').trim());
  if (!d) return NaN;
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time ?? '').trim() || '00:00');
  if (!t) return NaN;
  const [y, mo, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm, ss] = [Number(t[1]), Number(t[2]), Number(t[3] ?? 0)];
  if (hh > 23 || mm > 59 || ss > 59) return NaN;
  const at = new Date(2000, 0, 1);
  at.setFullYear(y, mo - 1, day);
  at.setHours(hh, mm, ss, 0);
  if (at.getFullYear() !== y || at.getMonth() !== mo - 1 || at.getDate() !== day) return NaN;
  return at.getTime();
}

export interface Left {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** The target is reached (or was already past). */
  done: boolean;
}

/** Whole calendar days later, at the same time of day. */
function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * What's left until `target` at `now`: whole calendar days (the same time of day so many days on,
 * across a clock change too), then hours, minutes and seconds of real time. A second that has begun
 * still counts, so it reads 00:00:00 only at the target, and holds there.
 */
export function countdown(target: number, now: number): Left {
  const ms = target - now;
  if (!Number.isFinite(ms) || ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: Number.isFinite(ms) };
  const from = target - Math.ceil(ms / 1000) * 1000;
  let days = Math.floor((target - from) / 86_400_000);
  while (days > 0 && addDays(from, days) > target) days--;
  while (addDays(from, days + 1) <= target) days++;
  const rest = Math.round((target - addDays(from, days)) / 1000);
  return { days, hours: Math.floor(rest / 3600), minutes: Math.floor((rest % 3600) / 60), seconds: rest % 60, done: false };
}

/** The countdown's cards: days (as many as it takes), hours, minutes, seconds. */
export function countdownGroups(left: Left): string[] {
  return [String(left.days), pad(left.hours), pad(left.minutes), pad(left.seconds)];
}

/** Which cards change between two faces (a card that's new changes too). */
export function changed(before: string[], after: string[]): boolean[][] {
  return after.map((group, g) => [...group].map((ch, i) => before[g]?.length !== group.length || before[g][i] !== ch));
}

// ── A date handed in ─────────────────────────────────────────────────────────────────────────

/**
 * A pasted date, as the home reads one: 2026-12-24 (with a time, and a zone, too), 24.12.2026,
 * 12/24/2026; two-digit years as the home does (over 50: the 1900s). Null for anything else.
 */
export function handedIn(text: string): { date: string; time: string } | null {
  const t = String(text ?? '').trim();
  let m: RegExpExecArray | null;
  let date = '';
  let time = '';
  const year = (y: string) => (y.length === 2 ? (Number(y) > 50 ? '19' : '20') + y : y);
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(t))) {
    if (m[7]) {
      // A moment with its zone: shown as the time here.
      const zone = m[7] === 'Z' ? 'Z' : m[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
      const at = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}${zone}`);
      if (Number.isNaN(at.getTime())) return null;
      date = `${String(at.getFullYear()).padStart(4, '0')}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
      time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    } else {
      date = `${m[1]}-${m[2]}-${m[3]}`;
      time = m[4] ? `${m[4]}:${m[5]}` : '';
    }
  } else if ((m = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2}|\d{4})$/.exec(t))) {
    date = `${year(m[3])}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t))) {
    let [mo, d] = [m[1], m[2]];
    if (Number(mo) > 12 && Number(d) <= 12) [mo, d] = [d, mo];
    date = `${year(m[3])}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else return null;
  return Number.isFinite(targetOf(date, time)) ? { date, time } : null;
}
