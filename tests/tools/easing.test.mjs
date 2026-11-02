import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bezierAt,
  bezierPoint,
  solveT,
  bezierExtent,
  PRESETS,
  GROUPS,
  KEYWORDS,
  presetOf,
  keywordOf,
  parseEasing,
  formatEasing,
  formatBezier,
  parseStops,
  formatLinear,
  linearAt,
  transitionLine,
  animateLine,
  spring,
  simplify,
  springStops,
  viewRange,
  clampHandle,
  num,
  SETTLE,
  TOLERANCE,
} from '../../src/tools/easing/easing.ts';

const close = (a, b, eps = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} ≠ ${b} (±${eps})`);

test('a Bézier: linear is the identity, ease at 0.5 is CSS’s 0.8024, in-out is symmetric', () => {
  for (let i = 0; i <= 20; i++) close(bezierAt([0, 0, 1, 1], i / 20), i / 20, 1e-6);
  close(bezierAt(KEYWORDS.ease, 0.5), 0.8024033877, 1e-6);
  close(bezierAt(KEYWORDS['ease-in'], 0.5), 0.3153568125, 1e-6);
  for (let i = 0; i <= 20; i++) close(bezierAt(KEYWORDS['ease-in-out'], i / 20) + bezierAt(KEYWORDS['ease-in-out'], 1 - i / 20), 1, 1e-6);
  // Outside the time it holds its ends.
  assert.equal(bezierAt([0.3, 2, 0.7, -1], -0.2), 0);
  assert.equal(bezierAt([0.3, 2, 0.7, -1], 1.4), 1);
});

test('x → t is solved on steep, flat and degenerate curves alike (Newton, then bisection)', () => {
  const curves = [
    [0, 0, 1, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0.99, 0, 0.01, 1],
    [0, 0, 0, 1],
    [1, 0, 1, 1],
    [0.5, -1, 0.5, 2],
    [0.87, 0, 0.13, 1],
    [0, 0.55, 0.45, 1],
  ];
  for (const p of curves) {
    for (let i = 0; i <= 400; i++) {
      const x = i / 400;
      const t = solveT(p[0], p[2], x);
      assert.ok(t >= 0 && t <= 1, `t in range for ${p}`);
      close(bezierPoint(p, t).x, x, 1e-6, `x(t) for ${p} at ${x}`);
    }
  }
  // Monotonic in time: output follows input for a curve without overshoot.
  let last = -1;
  for (let i = 0; i <= 100; i++) {
    const y = bezierAt([0.65, 0, 0.35, 1], i / 100);
    assert.ok(y >= last - 1e-12);
    last = y;
  }
});

test('the extent: past 0 and 1 only where the handles take it', () => {
  assert.deepEqual(bezierExtent([0.25, 0.1, 0.25, 1]), [0, 1]);
  const [lo, hi] = bezierExtent([0.68, -0.6, 0.32, 1.6]);
  assert.ok(lo < -0.05 && lo > -0.2, `lo ${lo}`);
  assert.ok(hi > 1.05 && hi < 1.2, `hi ${hi}`);
});

test('every preset: a valid curve with a unique id, close to the function it stands for', () => {
  assert.equal(PRESETS.length, 5 + 8 * 3);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(GROUPS.includes(p.group), p.id);
    assert.equal(p.p.length, 4);
    assert.ok(p.p.every(Number.isFinite), p.id);
    assert.ok(p.p[0] >= 0 && p.p[0] <= 1 && p.p[2] >= 0 && p.p[2] <= 1, `${p.id}: x inside 0–1`);
    // It reads back as itself.
    const read = parseEasing(formatBezier(p.p));
    assert.deepEqual(read.easing, { kind: 'bezier', p: p.p }, p.id);
    assert.equal(presetOf(p.p)?.id, p.id);
  }
  // easings.net's values, checked against the functions they approximate.
  const c1 = 1.70158;
  const fns = {
    'in-out-sine': (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    'out-quad': (x) => 1 - (1 - x) ** 2,
    'in-cubic': (x) => x ** 3,
    'out-quart': (x) => 1 - (1 - x) ** 4,
    'in-quint': (x) => x ** 5,
    'out-expo': (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
    'out-circ': (x) => Math.sqrt(1 - (x - 1) ** 2),
    'out-back': (x) => 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2,
  };
  for (const [id, f] of Object.entries(fns)) {
    const p = PRESETS.find((x) => x.id === id).p;
    for (let i = 0; i <= 100; i++) close(bezierAt(p, i / 100), f(i / 100), 0.015, id);
  }
});

test('reading: keywords, cubic-bezier() any way written, four bare numbers', () => {
  assert.deepEqual(parseEasing('ease-out').easing, { kind: 'bezier', p: [0, 0, 0.58, 1] });
  assert.deepEqual(parseEasing('  EASE  ').easing, { kind: 'bezier', p: [0.25, 0.1, 0.25, 1] });
  assert.deepEqual(parseEasing('linear').easing, { kind: 'bezier', p: [0, 0, 1, 1] });
  assert.deepEqual(parseEasing('cubic-bezier(0.34, 1.56, 0.64, 1)').easing, { kind: 'bezier', p: [0.34, 1.56, 0.64, 1] });
  assert.deepEqual(parseEasing('Cubic-Bezier( .4,0,.2,1 );').easing, { kind: 'bezier', p: [0.4, 0, 0.2, 1] });
  assert.deepEqual(parseEasing('0.4, 0, 0.2, 1').easing, { kind: 'bezier', p: [0.4, 0, 0.2, 1] });
  assert.deepEqual(parseEasing('cubic-bezier(0.5, -1.5, 0.5, 2.5)').easing, { kind: 'bezier', p: [0.5, -1.5, 0.5, 2.5] });
  // Time can't run backwards: CSS refuses an x outside 0–1, and so does this.
  assert.deepEqual(parseEasing('cubic-bezier(1.2, 0, 0.5, 1)'), { error: 'outside' });
  assert.deepEqual(parseEasing('cubic-bezier(0.2, 0, -0.1, 1)'), { error: 'outside' });
  assert.deepEqual(parseEasing('steps(4, end)'), { error: 'steps' });
  assert.deepEqual(parseEasing('cubic-bezier(0.2, 0, 1)'), { error: 'unreadable' });
  assert.deepEqual(parseEasing('bouncy'), { error: 'unreadable' });
  assert.deepEqual(parseEasing(''), { error: 'unreadable' });
});

test('reading a transition line: the curve, the property and the duration', () => {
  assert.deepEqual(parseEasing('transition: opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1);'), {
    easing: { kind: 'bezier', p: [0.34, 1.56, 0.64, 1] },
    property: 'opacity',
    duration: 300,
  });
  const s = parseEasing('transition: transform .25s ease-in-out 0.1s');
  assert.equal(s.duration, 250);
  assert.equal(s.property, 'transform');
  assert.deepEqual(s.easing.p, [0.42, 0, 0.58, 1]);
  // Of several, the first that names a timing function.
  const list = parseEasing('transition: color 0.2s, transform 0.4s cubic-bezier(0.2, 0, 0, 1)');
  assert.equal(list.property, 'transform');
  assert.equal(list.duration, 400);
  assert.deepEqual(list.easing.p, [0.2, 0, 0, 1]);
  const anim = parseEasing('animation: pop 1.2s linear(0, 0.8 40%, 1) infinite;');
  assert.equal(anim.duration, 1200);
  assert.equal(anim.property, undefined);
  assert.equal(anim.easing.kind, 'linear');
  assert.deepEqual(parseEasing('transition-timing-function: ease-in;').easing.p, [0.42, 0, 1, 1]);
  assert.deepEqual(parseEasing('animation-timing-function: linear(0, 0.25, 1)').easing.stops, [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.25 },
    { x: 1, y: 1 },
  ]);
});

test('writing: the keyword where the numbers are one, else cubic-bezier with up to three decimals', () => {
  assert.equal(formatEasing({ kind: 'bezier', p: [0.42, 0, 0.58, 1] }), 'ease-in-out');
  assert.equal(formatEasing({ kind: 'bezier', p: [0, 0, 1, 1] }), 'linear');
  assert.equal(formatEasing({ kind: 'bezier', p: [0.34, 1.56, 0.64, 1] }), 'cubic-bezier(0.34, 1.56, 0.64, 1)');
  assert.equal(formatEasing({ kind: 'bezier', p: [0.1234, -0.00001, 0.5, 1] }), 'cubic-bezier(0.123, 0, 0.5, 1)');
  assert.equal(keywordOf([0.25, 0.1, 0.25, 1]), 'ease');
  assert.equal(keywordOf([0.25, 0.1, 0.25, 0.99]), undefined);
  assert.equal(num(-0.0001), '0');
  assert.equal(num(1.5000001), '1.5');
  assert.equal(transitionLine('ease-out', 600), 'transition: transform 600ms ease-out;');
  assert.equal(transitionLine('ease', 250, 'opacity'), 'transition: opacity 250ms ease;');
  assert.equal(animateLine('cubic-bezier(0.34, 1.56, 0.64, 1)', 600), "el.animate(keyframes, { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });");
});

test('linear(): missing inputs filled in the CSS way, two inputs make two points', () => {
  assert.deepEqual(parseStops('0, 0.25, 1'), [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.25 },
    { x: 1, y: 1 },
  ]);
  assert.deepEqual(parseStops('0, 0.5 20% 60%, 1'), [
    { x: 0, y: 0 },
    { x: 0.2, y: 0.5 },
    { x: 0.6, y: 0.5 },
    { x: 1, y: 1 },
  ]);
  // A position going backwards is raised to the one before it; a run without spread evenly.
  assert.deepEqual(parseStops('0, 0.3 50%, 0.4 30%, 0.6, 0.8, 1'), [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.3 },
    { x: 0.5, y: 0.4 },
    { x: 0.5 + 0.5 / 3, y: 0.6 },
    { x: 0.5 + 1 / 3, y: 0.8 },
    { x: 1, y: 1 },
  ]);
  // The percentage may come first.
  assert.deepEqual(parseStops('0, 40% 0.9, 1')[1], { x: 0.4, y: 0.9 });
  assert.equal(parseStops('0'), null);
  assert.equal(parseStops('0, , 1'), null);
  assert.equal(parseStops('0, a, 1'), null);
  assert.equal(parseStops('0, 0.5 10% 20% 30%, 1'), null);
});

test('linear(): evaluated between its points, a jump takes the later one, carried on past its ends', () => {
  const stops = parseStops('0, 0.5 50%, 1 50%, 1');
  close(linearAt(stops, 0.25), 0.25);
  close(linearAt(stops, 0.5), 1);
  close(linearAt(stops, 0.75), 1);
  const ramp = parseStops('0.2 10%, 0.8 90%');
  close(linearAt(ramp, 0.5), 0.5);
  close(linearAt(ramp, 0), 0.125);
  close(linearAt(ramp, 1), 0.875);
});

test('linear(): written and read back as the same points', () => {
  const stops = [
    { x: 0, y: 0 },
    { x: 0.1235, y: 0.4 },
    { x: 0.5, y: 1.052 },
    { x: 0.8, y: -0.25 },
    { x: 1, y: 1 },
  ];
  const text = formatLinear(stops);
  assert.equal(text, 'linear(0, 0.4 12.35%, 1.052 50%, -0.25 80%, 1)');
  assert.deepEqual(parseStops(text.slice(7, -1)), stops);
  const read = parseEasing(text);
  assert.equal(formatEasing(read.easing), text);
  // A start or end that isn't at 0 or 1 keeps its position.
  assert.equal(formatLinear([{ x: 0.2, y: 0 }, { x: 0.9, y: 1 }]), 'linear(0 20%, 1 90%)');
});

test('a spring starts at 0, settles at 1 by the end; bounce makes it overshoot', () => {
  for (const b of [0, 0.05, 0.3, 0.5, 0.7, 0.9]) {
    const f = spring(b);
    assert.equal(f(0), 0);
    assert.equal(f(1), 1);
    close(f(0.999), 1, SETTLE * 1.01, `settled at bounce ${b}`);
    // The last tenth stays within the settling distance.
    for (let i = 900; i < 1000; i++) assert.ok(Math.abs(f(i / 1000) - 1) <= 0.02, `bounce ${b} at ${i / 1000}`);
  }
  let peak0 = 0;
  for (let i = 0; i <= 1000; i++) peak0 = Math.max(peak0, spring(0)(i / 1000));
  assert.ok(peak0 <= 1, 'no bounce, no overshoot');
  const peak = (b) => Math.max(...Array.from({ length: 1001 }, (_, i) => spring(b)(i / 1000)));
  assert.ok(peak(0.3) > 1.02 && peak(0.3) < 1.1, `0.3 overshoots a little: ${peak(0.3)}`);
  assert.ok(peak(0.5) > peak(0.3));
  assert.ok(peak(0.9) > peak(0.5) && peak(0.9) < 2);
});

test('the simplification keeps every dropped sample within its tolerance', () => {
  for (const b of [0, 0.3, 0.6, 0.9]) {
    const f = spring(b);
    const samples = Array.from({ length: 2001 }, (_, i) => ({ x: i / 2000, y: f(i / 2000) }));
    const kept = simplify(samples, TOLERANCE);
    assert.ok(kept.length < samples.length / 8, `${kept.length} points for bounce ${b}`);
    assert.deepEqual(kept[0], samples[0]);
    assert.deepEqual(kept.at(-1), samples.at(-1));
    for (const s of samples) assert.ok(Math.abs(linearAt(kept, s.x) - s.y) <= TOLERANCE + 1e-12, `bounce ${b} at ${s.x}`);
  }
  // A straight line needs only its ends.
  assert.equal(simplify(Array.from({ length: 50 }, (_, i) => ({ x: i / 49, y: i / 49 })), 0.001).length, 2);
});

test('the spring as linear(): read back, it follows the spring within about 0.002', () => {
  for (const b of [0, 0.25, 0.5, 0.75, 0.9]) {
    const text = formatLinear(springStops(b));
    assert.match(text, /^linear\(0, .+, 1\)$/);
    const back = parseEasing(text);
    assert.equal(back.easing.kind, 'linear');
    const f = spring(b);
    let worst = 0;
    for (let i = 0; i <= 10000; i++) worst = Math.max(worst, Math.abs(linearAt(back.easing.stops, i / 10000) - f(i / 10000)));
    assert.ok(worst <= 0.0022, `bounce ${b}: off by ${worst}`);
  }
});

test('the graph’s range: −0.5 to 1.5, wider for a handle past it, never past −1.1 to 2.1', () => {
  assert.deepEqual(viewRange({ kind: 'bezier', p: [0.25, 0.1, 0.25, 1] }), [-0.5, 1.5]);
  const [lo, hi] = viewRange({ kind: 'bezier', p: [0.68, -0.6, 0.32, 1.6] });
  close(lo, -0.7, 1e-9);
  close(hi, 1.7, 1e-9);
  assert.deepEqual(viewRange({ kind: 'bezier', p: [0.5, -1, 0.5, 2] }), [-1.1, 2.1]);
  assert.deepEqual(clampHandle(1.3, 2.5), [1, 2]);
  assert.deepEqual(clampHandle(-0.2, -3), [0, -1]);
});
