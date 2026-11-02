import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS,
  GROUNDS,
  fallOf,
  angleOf,
  grow,
  shares,
  layersOf,
  darkStrength,
  tintOf,
  hsl,
  cardOn,
  px,
  shadowValue,
  boxShadow,
  dropShadow,
  parseShadow,
  pastedValue,
  settingsNear,
  presetOf,
} from '../../src/tools/shadows/shadows.ts';

const close = (a, b, eps = 1e-9, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} ≠ ${b}`);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

test('the light’s angle: from the top the shadow falls down, from the top left down and right', () => {
  assert.deepEqual(fallOf(0), { x: 0, y: 1 });
  const right = fallOf(90);
  close(right.x, -1);
  close(right.y, 0, 1e-12);
  const topLeft = fallOf(315);
  close(topLeft.x, Math.SQRT1_2, 1e-12);
  close(topLeft.y, Math.SQRT1_2, 1e-12);
  // And back: the angle from a shadow's offset.
  assert.equal(angleOf(0, 10), 0);
  assert.equal(angleOf(-10, 0), 90);
  assert.equal(angleOf(6, 6), 315);
  assert.equal(angleOf(0, -4), 180);
  assert.equal(angleOf(0, 0), 0);
  for (let a = 0; a < 360; a += 15) {
    const d = fallOf(a);
    assert.equal(angleOf(d.x * 20, d.y * 20), a);
  }
});

test('the layers: as many as asked, growing offsets and blurs, the alphas adding up to the strength', () => {
  for (let n = 1; n <= 8; n++) {
    for (const strength of [0.01, 0.12, 0.2, 0.333, 0.95, 1]) {
      const ls = layersOf({ layers: n, distance: 24, blur: 48, angle: 0, strength });
      assert.equal(ls.length, n);
      close(sum(ls.map((l) => l.alpha)), strength, 1e-9, `n ${n}, strength ${strength}`);
      for (let i = 1; i < n; i++) {
        assert.ok(ls[i].y > ls[i - 1].y, 'offsets grow');
        assert.ok(ls[i].blur > ls[i - 1].blur, 'blurs grow');
      }
      // The farthest falls the whole distance, with the whole blur.
      close(ls.at(-1).y, 24);
      close(ls.at(-1).blur, 48);
      assert.ok(ls.every((l) => l.x === 0));
    }
  }
  // Along an ease-in: the first layers close together.
  const five = layersOf({ layers: 5, distance: 25, blur: 50, angle: 0, strength: 0.2 });
  five.forEach((l, i) => close(l.y, [1, 4, 9, 16, 25][i], 1e-9));
  assert.deepEqual(five.map((l) => l.alpha), [0.04, 0.04, 0.04, 0.04, 0.04]);
  assert.equal(grow(3, 3), 1);
  // Thousandths that don't split evenly go to the closest layers.
  assert.deepEqual(shares(0.2, 3), [0.067, 0.067, 0.066]);
  assert.deepEqual(shares(0.002, 4), [0.001, 0.001, 0, 0]);
  // From the left, the shadow falls right.
  const side = layersOf({ layers: 2, distance: 10, blur: 0, angle: 270, strength: 0.2 });
  close(side[1].x, 10);
  close(side[1].y, 0, 1e-9);
});

test('a dark ground gets 2.5 times the strength, at most 0.95', () => {
  assert.equal(darkStrength(0.2), 0.5);
  assert.equal(darkStrength(0.12), 0.3);
  assert.equal(darkStrength(0.5), 0.95);
});

test('the tint: the ground’s hue, a dark shade; off, plain black', () => {
  const t = tintOf(GROUNDS.light);
  assert.ok(t.h > 30 && t.h < 60, `hue ${t.h}`);
  assert.ok(t.s > 5 && t.s < 30, `saturation ${t.s}`);
  assert.ok(t.l > 20 && t.l < 35, `lightness ${t.l}`);
  assert.deepEqual(tintOf(GROUNDS.light, false), { h: 0, s: 0, l: 0 });
  const grey = tintOf('#2a2a2a');
  assert.equal(grey.s, 0);
  assert.ok(grey.l < 6);
  const blue = tintOf('hsl(220 80% 90%)');
  close(blue.h, 220, 0.5);
  assert.equal(blue.s, 60);
  close(blue.l, 27, 0.2);
  assert.equal(hsl({ h: 43.4, s: 17.25, l: 28.04 }, 0.0405), 'hsl(43 17% 28% / 0.041)');
  assert.equal(hsl({ h: 0, s: 0, l: 0 }), 'hsl(0 0% 0%)');
});

test('a card on its ground: near white on a light one, a step lighter on a dark one', () => {
  assert.match(cardOn('#f2f0eb').card, /^hsl\(\d+ \d+% 98%\)$/);
  assert.match(cardOn('#f2f0eb').ink, / 12%\)$/);
  assert.equal(cardOn('#2a2a2a').card, 'hsl(0 0% 24%)');
  assert.match(cardOn('#2a2a2a').ink, / 92%\)$/);
});

test('writing: one layer per line, lengths in px with a decimal at most, colours as hsl()', () => {
  const ls = layersOf({ layers: 3, distance: 9, blur: 18, angle: 0, strength: 0.15 });
  const c = { h: 43, s: 17, l: 28 };
  assert.equal(
    boxShadow(ls, c),
    'box-shadow:\n  0 1px 2px hsl(43 17% 28% / 0.05),\n  0 4px 8px hsl(43 17% 28% / 0.05),\n  0 9px 18px hsl(43 17% 28% / 0.05);',
  );
  assert.equal(shadowValue(ls.slice(0, 1), c), '0 1px 2px hsl(43 17% 28% / 0.05)');
  // drop-shadow()'s blur is half: a standard deviation, not a radius.
  assert.equal(
    dropShadow(ls, c),
    'filter:\n  drop-shadow(0 1px 1px hsl(43 17% 28% / 0.05))\n  drop-shadow(0 4px 4px hsl(43 17% 28% / 0.05))\n  drop-shadow(0 9px 9px hsl(43 17% 28% / 0.05));',
  );
  assert.equal(px(0.04), '0');
  assert.equal(px(-0.04), '0');
  assert.equal(px(2.56), '2.6px');
  assert.equal(px(-7.07), '-7.1px');
});

test('reading: several layers, commas inside colours, inset, colours either side', () => {
  const read = parseShadow('box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 0 0 1px hsl(220, 50%, 50%, 0.5), 4px 8px 16px -4px #00000033, rgb(0 0 0 / 10%) 0 12px 24px;');
  assert.equal(read.length, 4);
  assert.deepEqual(read[0], { inset: false, x: 0, y: 1, blur: 2, spread: 0, colour: 'rgba(0, 0, 0, 0.2)', alpha: 0.2 });
  assert.deepEqual(read[1], { inset: true, x: 0, y: 0, blur: 0, spread: 1, colour: 'hsl(220, 50%, 50%, 0.5)', alpha: 0.5 });
  assert.equal(read[2].spread, -4);
  close(read[2].alpha, 0.2);
  assert.equal(read[3].colour, 'rgb(0 0 0 / 10%)');
  close(read[3].alpha, 0.1);
  assert.equal(read[3].y, 12);
  // Colours this tool can't name keep their "/ alpha"; rem counts 16 px; inset at the end.
  const more = parseShadow('0 0.25rem 1rem color(display-p3 0 0 0 / 0.3) inset');
  assert.deepEqual(more, [{ inset: true, x: 0, y: 4, blur: 16, spread: 0, colour: 'color(display-p3 0 0 0 / 0.3)', alpha: 0.3 }]);
  // No colour: currentcolor.
  assert.equal(parseShadow('2px 2px')[0].colour, 'currentcolor');
  assert.equal(parseShadow('0 2px 4px black;')[0].alpha, 1);
  assert.equal(parseShadow('0 2px 4px transparent')[0].alpha, 0);
});

test('reading: what isn’t a box-shadow', () => {
  assert.equal(parseShadow('none'), null);
  assert.equal(parseShadow(''), null);
  assert.equal(parseShadow('0 2px black red'), null);
  assert.equal(parseShadow('2px black'), null);
  assert.equal(parseShadow('1px 2px 3px 4px 5px black'), null);
  assert.equal(parseShadow('1px black 2px 3px'), null);
  // A comma left at the end of a copied line doesn't matter.
  assert.equal(parseShadow('0 2px 4px rgba(0,0,0,.2),').length, 1);
});

test('a pasted shadow written back, and the controls near it', () => {
  const read = parseShadow('0 1px 2px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.08), -6px 6px 24px 2px rgba(0,0,0,.08)');
  assert.equal(pastedValue(read), '0 1px 2px rgba(0,0,0,.08),\n  0 4px 8px rgba(0,0,0,.08),\n  -6px 6px 24px 2px rgba(0,0,0,.08)');
  const s = settingsNear(read);
  assert.equal(s.layers, 3);
  assert.equal(s.distance, 8);
  assert.equal(s.blur, 24);
  assert.equal(s.angle, 45);
  assert.equal(s.strength, 0.24);
  // Inset layers don't count when there are others; a single inset one does.
  assert.equal(settingsNear(parseShadow('inset 0 1px 0 white, 0 10px 20px rgba(0,0,0,.3)')).layers, 1);
  assert.equal(settingsNear(parseShadow('inset 0 2px 4px rgba(0,0,0,.5)')).strength, 0.5);
  // More than eight layers: eight; far ones: at most 100 px.
  const many = parseShadow(Array.from({ length: 12 }, (_, i) => `0 ${i * 20}px ${i * 40}px rgba(0,0,0,0.2)`).join(', '));
  const m = settingsNear(many);
  assert.equal(m.layers, 8);
  assert.equal(m.distance, 100);
  assert.equal(m.blur, 200);
  assert.equal(m.strength, 1);
});

test('the presets: each one recognised by its numbers, and nothing else', () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    assert.equal(presetOf({ ...p, angle: 120 }), id);
    const ls = layersOf({ ...p, angle: 0 });
    assert.equal(ls.length, p.layers);
    close(sum(ls.map((l) => l.alpha)), p.strength);
  }
  assert.equal(presetOf({ ...PRESETS.card, angle: 0, blur: 31 }), null);
});
