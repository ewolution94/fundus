import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, INGREDIENTS, unitById, convert, ordered, decimals, parseQuantity, belowZero, density, shortOf } from '../../src/tools/units/units.ts';
import { parseNumber } from '../../src/lib/numbers.ts';

const u = (id) => unitById(id);
const near = (actual, expected, digits = 6, what = '') => assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${what} ${actual} ≠ ${expected}`);
const ing = (id) => INGREDIENTS.find((i) => i.id === id);

test('the legal definitions', () => {
  near(convert(1, u('in'), u('cm')), 2.54, 12);
  near(convert(1, u('mi'), u('km')), 1.609344, 12);
  near(convert(1, u('ft'), u('in')), 12, 12);
  near(convert(1, u('yd'), u('ft')), 3, 12);
  near(convert(1, u('mi'), u('yd')), 1760, 9);
  near(convert(1, u('nmi'), u('m')), 1852, 9);
  near(convert(1, u('lb'), u('g')), 453.59237, 9);
  near(convert(1, u('lb'), u('oz')), 16, 12);
  near(convert(1, u('st'), u('lb')), 14, 12);
  near(convert(1, u('gal'), u('l')), 3.785411784, 12);
  near(convert(1, u('gal'), u('cup')), 16, 12);
  near(convert(1, u('cup'), u('ml')), 236.5882365, 6);
  near(convert(1, u('cup'), u('tbsp')), 16, 12);
  near(convert(1, u('tbsp'), u('tsp')), 3, 12);
  near(convert(1, u('floz'), u('ml')), 29.5735295625, 9);
  near(convert(1, u('ukgal'), u('l')), 4.54609, 12);
  near(convert(1, u('ukpt'), u('ml')), 568.26125, 9);
  near(convert(1, u('m3'), u('l')), 1000, 9);
});

test('every unit goes there and back', () => {
  for (const from of UNITS) {
    for (const to of UNITS.filter((x) => x.kind === from.kind)) {
      for (const v of [1, 0.3, 12.5, 1234.5678, -7]) {
        if (from.kind === 'temperature' && belowZero(v, from)) continue;
        const back = convert(convert(v, from, to, ing('flour')), to, from, ing('flour'));
        assert.ok(Math.abs(back - v) <= Math.abs(v) * 1e-12 + 1e-9, `${v} ${from.id} → ${to.id} → ${back}`);
      }
    }
  }
});

test('temperatures', () => {
  near(convert(100, u('c'), u('f')), 212, 9);
  near(convert(0, u('c'), u('f')), 32, 9);
  near(convert(-40, u('c'), u('f')), -40, 9, 'where both scales meet');
  near(convert(350, u('f'), u('c')), 176.6666667, 6);
  near(convert(98.6, u('f'), u('c')), 37, 9);
  near(convert(0, u('k'), u('c')), -273.15, 9);
  near(convert(0, u('k'), u('f')), -459.67, 9);
  near(convert(20, u('c'), u('k')), 293.15, 9);
  assert.equal(belowZero(-274, u('c')), true);
  assert.equal(belowZero(-273.15, u('c')), false, 'absolute zero itself is fine');
  assert.equal(belowZero(-460, u('f')), true);
  assert.equal(belowZero(-1, u('k')), true);
  assert.equal(belowZero(-500, u('m')), false, 'only temperatures have a floor');
});

test('the kitchen: cups to grams per ingredient', () => {
  near(convert(1, u('k-cup'), u('k-g'), ing('flour')), 125, 9);
  near(convert(1, u('k-cup'), u('k-g'), ing('sugar')), 200, 9);
  near(convert(1, u('k-cup'), u('k-g'), ing('butter')), 227, 9);
  near(convert(250, u('k-g'), u('k-cup'), ing('sugar')), 1.25, 9);
  near(convert(100, u('k-ml'), u('k-g'), ing('water')), 100, 9, 'water is 1 g per ml');
  near(convert(1, u('k-mcup'), u('k-ml')), 250, 9, 'a metric cup is 250 ml');
  near(convert(1, u('k-cup'), u('k-ml')), 236.5882365, 6);
  near(convert(1, u('k-tbsp'), u('k-tsp')), 3, 12);
  near(convert(1, u('k-tbsp'), u('k-g'), ing('salt')), (292 / 236.5882365) * 15, 9);
  near(convert(1, u('k-oz'), u('k-g'), ing('flour')), 28.349523125, 9, 'a weight to a weight needs no density');
  assert.ok(Number.isNaN(convert(1, u('k-cup'), u('k-g'))), 'no ingredient, no grams');
  assert.ok(Number.isNaN(convert(1, u('k-cup'), u('m'))), 'not across kinds');
  for (const i of INGREDIENTS) assert.ok(density(i) > 0.3 && density(i) < 1.5, `${i.id}: ${density(i)} g/ml`);
  assert.equal(INGREDIENTS.length, 12);
});

test('the setting’s units first', () => {
  assert.deepEqual(ordered('length', 'metric').map((x) => x.id), ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi', 'nmi']);
  assert.deepEqual(ordered('length', 'imperial').map((x) => x.id), ['in', 'ft', 'yd', 'mi', 'nmi', 'mm', 'cm', 'm', 'km']);
  assert.deepEqual(ordered('kitchen', 'imperial').map((x) => x.id), ['k-cup', 'k-oz', 'k-tbsp', 'k-tsp', 'k-g', 'k-ml', 'k-mcup']);
  assert.deepEqual(ordered('kitchen', 'metric').map((x) => x.id), ['k-g', 'k-ml', 'k-mcup', 'k-tbsp', 'k-tsp', 'k-cup', 'k-oz']);
  for (const unit of UNITS) assert.ok(unitById(unit.pair)?.kind === unit.kind, `${unit.id}'s pair ${unit.pair}`);
});

test('sensible precision', () => {
  assert.equal(decimals(3.10686, u('mi')), 4, 'five significant digits');
  assert.equal(decimals(25.4, u('mm')), 3);
  assert.equal(decimals(1609.344, u('m')), 1);
  assert.equal(decimals(123456, u('m')), 0);
  assert.equal(decimals(0.0000006, u('mi')), 10, 'never more than ten');
  assert.equal(decimals(176.6667, u('c')), 2);
  assert.equal(decimals(125.3, u('k-g')), 0, 'whole grams');
  assert.equal(decimals(4.2, u('k-g')), 1);
  assert.equal(decimals(1.25, u('k-cup')), 2);
  assert.equal(decimals(2.37, u('k-tbsp')), 1);
});

test('a value with its unit, typed or pasted', () => {
  const q = (s, kind) => {
    const r = parseQuantity(s, kind, parseNumber);
    return [r.value, r.unit?.id ?? null];
  };
  assert.deepEqual(q('5 km'), [5, 'km']);
  assert.deepEqual(q('5km'), [5, 'km']);
  assert.deepEqual(q('350°F'), [350, 'f']);
  assert.deepEqual(q('−40 °C'), [-40, 'c']);
  assert.deepEqual(q('2,5 cups', 'kitchen'), [2.5, 'k-cup']);
  assert.deepEqual(q('2,5 cups'), [2.5, 'cup'], 'outside the kitchen, the volume');
  assert.deepEqual(q('12 oz'), [12, 'oz'], 'an ounce is a weight');
  assert.deepEqual(q('12 oz', 'volume'), [12, 'floz'], 'unless it’s a volume');
  assert.deepEqual(q('1.234,5 m'), [1234.5, 'm']);
  assert.deepEqual(q('6 ft'), [6, 'ft']);
  assert.deepEqual(q('250 Gramm'), [250, 'g']);
  assert.deepEqual(q('42'), [42, null]);
  assert.deepEqual(q('350 F', 'temperature'), [350, 'f'], 'a bare F among temperatures');
  assert.equal(q('5 f', 'length')[1], null, 'but not on the way to "5 ft"');
  const bad = q('5 parsecs');
  assert.ok(Number.isNaN(bad[0]) && bad[1] === null);
  assert.ok(Number.isNaN(q('km')[0]));
});

test('one cup, two cups', () => {
  assert.equal(shortOf(u('k-cup'), 1, 'en'), 'US cup');
  assert.equal(shortOf(u('k-cup'), 1.25, 'en'), 'US cups');
  assert.equal(shortOf(u('k-cup'), 2, 'de'), 'US-Tassen');
  assert.equal(shortOf(u('km'), 1, 'en'), 'km');
});
