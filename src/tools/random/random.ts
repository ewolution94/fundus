// The draws behind Coin, dice, pick one, and the staging that shows them. Plain TypeScript with
// erasable types, tested as it is.
//
// Every result is drawn first, from fair whole numbers (src/lib/random.ts: crypto words by default,
// rejection, Fisher–Yates). The flip, the tumble and the flicker only play their way to it: their
// decoration may come from Math.random (`Decor`), and none of it decides anything
// (learnings/randomness.md). Each draw takes a `WordSource` so the tests can seed it.

import { fairInt, shuffle, pick, cryptoWords, type WordSource } from '../../lib/random.ts';

export type Face = 'heads' | 'tails';

/** A float in [0, 1) for the show only: which name flickers past, which face a die shows mid-air. */
export type Decor = () => number;

// ── Coin ───────────────────────────────────────────────────────────────────────────────────

export function flip(words: WordSource = cryptoWords): Face {
  return fairInt(2, words) === 0 ? 'heads' : 'tails';
}

/** Where a face is up: heads at a multiple of 360°, tails half a turn past one. */
export const faceAngle = (face: Face) => (face === 'heads' ? 0 : 180);

/** The face up at a turn (degrees about the coin's axis); null when it's on its edge. */
export function faceAt(angle: number): Face | null {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  return a === 0 ? 'heads' : a === 180 ? 'tails' : null;
}

/**
 * The turn a flip from `from` ends on to land on `face`: at least `turns` whole turns on, and less
 * than one more. The coin's turn only ever grows, so each flip spins the same way.
 */
export function landing(from: number, face: Face, turns = 5): number {
  const to = from + turns * 360;
  const off = (((to - faceAngle(face)) % 360) + 360) % 360;
  return off === 0 ? to : to + 360 - off;
}

export interface FlipFrame {
  /** 0 … 1 through the flip. */
  offset: number;
  /** How tall the coin looks: |cos| of its turn, the edge never quite flat. */
  scale: number;
  /** The face towards you. */
  face: Face;
}

/**
 * The flip from one turn to another as `steps` + 1 frames: fast at first, slowing down (ease-out),
 * each frame the coin's height as seen from the front and the face showing. Drawn flat, so it looks
 * the same in every browser; the last frame is the face at `to`, full height.
 */
export function flipFrames(from: number, to: number, steps = 120): FlipFrame[] {
  const out: FlipFrame[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const turn = from + (to - from) * (1 - (1 - t) ** 3);
    const c = Math.cos((turn * Math.PI) / 180);
    out.push({ offset: t, scale: Math.max(0.03, Math.abs(c)), face: c >= 0 ? 'heads' : 'tails' });
  }
  return out;
}

// ── Dice ───────────────────────────────────────────────────────────────────────────────────

export const SIDES = [4, 6, 8, 10, 12, 20] as const;
export type Sides = (typeof SIDES)[number];
export const MAX_DICE = 6;

/** `count` dice of `sides` sides, each from 1 to `sides`. */
export function roll(count: number, sides: number, words: WordSource = cryptoWords): number[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_DICE) throw new RangeError(`roll: 1 to ${MAX_DICE} dice, not ${count}`);
  if (!(SIDES as readonly number[]).includes(sides)) throw new RangeError(`roll: no d${sides}`);
  return Array.from({ length: count }, () => fairInt(sides, words) + 1);
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * What the dice show while they tumble: `frames` faces each, the last frame the result. Faces in
 * between come from `decor` and never repeat the frame before (so every frame moves).
 */
export function tumble(result: number[], sides: number, frames: number, decor: Decor = Math.random): number[][] {
  const out: number[][] = [];
  let prev = result.map(() => 0);
  for (let f = 0; f < frames - 1; f++) {
    const faces = result.map((_, i) => {
      if (!prev[i]) return Math.min(sides, 1 + Math.floor(decor() * sides));
      // One of the sides - 1 faces that aren't the one shown before.
      let face = 1 + Math.floor(decor() * (sides - 1));
      if (face >= prev[i]) face++;
      return Math.min(face, sides);
    });
    out.push(faces);
    prev = faces;
  }
  out.push(result.slice());
  return out;
}

// ── A list ─────────────────────────────────────────────────────────────────────────────────

export interface Entries {
  /** Each name once, in the order typed. */
  names: string[];
  /** Lines left out because they repeat one above. */
  repeats: number;
}

/**
 * The names in a typed or pasted list: one per line, or, on a single line, between commas or
 * semicolons. Blank lines and list bullets ("- ", "• ") go; a name that repeats counts once.
 */
export function entries(text: string): Entries {
  let lines = String(text ?? '').split(/\r?\n/);
  const filled = lines.filter((l) => l.trim());
  if (filled.length === 1 && /[,;]/.test(filled[0])) lines = filled[0].split(/[,;]/);
  const names: string[] = [];
  const seen = new Set<string>();
  let repeats = 0;
  for (const line of lines) {
    const name = line.replace(/^\s*[-*•·–]\s+/, '').trim();
    if (!name) continue;
    if (seen.has(name)) {
      repeats++;
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return { names, repeats };
}

export function pickOne(names: readonly string[], words: WordSource = cryptoWords): string {
  if (!names.length) throw new RangeError('pickOne: an empty list');
  return names[fairInt(names.length, words)];
}

/** `k` different names, in the order drawn. */
export function pickSome(names: readonly string[], k: number, words: WordSource = cryptoWords): string[] {
  return pick(names, k, words);
}

/** The whole list in a new order. */
export function shuffled(names: readonly string[], words: WordSource = cryptoWords): string[] {
  return shuffle(names, words);
}

/**
 * `k` teams whose sizes differ by one at most: the list shuffled, then dealt round the teams like
 * cards. Never more teams than names.
 */
export function teams(names: readonly string[], k: number, words: WordSource = cryptoWords): string[][] {
  const n = Math.max(1, Math.min(Math.floor(k), names.length));
  const out: string[][] = Array.from({ length: n }, () => []);
  shuffle(names, words).forEach((name, i) => out[i % n].push(name));
  return out;
}

/**
 * The names that flicker past before a pick lands: `steps` of them, the last the pick, and no name
 * twice in a row (so the landing is a change too). Built back from the pick.
 */
export function flicker(names: readonly string[], result: string, steps: number, decor: Decor = Math.random): string[] {
  if (names.length < 2 || steps < 2) return [result];
  const out = [result];
  let later = names.indexOf(result);
  for (let i = 1; i < steps; i++) {
    let j = Math.floor(decor() * (names.length - 1));
    if (later >= 0 && j >= later) j++;
    j = Math.min(j, names.length - 1);
    out.unshift(names[j]);
    later = j;
  }
  return out;
}

/**
 * When each of `steps` frames shows, in ms from the start: quick at first, slowing down, the last
 * at `total`.
 */
export function slowing(steps: number, total: number): number[] {
  if (steps < 2) return [0];
  // Gaps grow linearly; their sum is total.
  const weights = Array.from({ length: steps - 1 }, (_, i) => 1 + i * 0.6);
  const scale = total / sum(weights);
  const out = [0];
  for (const w of weights) out.push(out[out.length - 1] + w * scale);
  out[out.length - 1] = total;
  return out;
}

/** Teams as text to copy: "Team 1: Anna, Ben" per line. */
export function teamsText(list: string[][], label: (n: number) => string): string {
  return list.map((t, i) => `${label(i + 1)}: ${t.join(', ')}`).join('\n');
}
