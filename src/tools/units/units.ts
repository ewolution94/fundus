// The units of Convert units and how they convert. Plain TypeScript with erasable types, tested as
// it is. Every factor is the exact legal definition (the international yard and pound of 1959, the
// US gallon of 231 cubic inches, the imperial gallon of 4.54609 litres), so a round trip comes back
// to what was typed.
//
// The kitchen turns volumes into weights with each ingredient's density. Source: USDA FoodData
// Central, SR Legacy, the household measure "1 cup" in grams of each food (the food's number in
// brackets below), divided by the US cup's 236.588 ml. Dry ingredients are spooned and levelled,
// so a packed cup of flour weighs more: the tool says to weigh when it matters.

export type Kind = 'length' | 'weight' | 'temperature' | 'volume' | 'kitchen';
export type System = 'metric' | 'imperial';
type Words = { en: string; de: string };

export interface Unit {
  id: string;
  kind: Kind;
  /** For a list "metric first" or "imperial first"; `both` sits with either (spoons). */
  system: System | 'both';
  name: Words;
  /** After the number: "km". `one` when it differs for exactly one ("1 cup"). */
  short: Words;
  one?: Words;
  /** How many of the kind's base unit one of it is: metres, kilograms, litres; in the kitchen,
   *  grams for weights and millilitres for volumes. Temperatures convert by formula. */
  factor: number;
  /** A kitchen weight (grams, ounces), against a volume. */
  mass?: boolean;
  /** The unit people most likely want from this one: its line carries the highlighter. */
  pair: string;
  /** At most this many decimals; otherwise five significant digits. */
  dp?: number;
  /** What people type after the number, lower case. */
  aliases: string[];
  /** Short ones that mean this unit only inside its kind ("350 F" among temperatures; in a
   *  length, "5 f" is on its way to "5 ft"). */
  near?: string[];
}

const w = (en: string, de = en): Words => ({ en, de });

// Exact definitions.
const INCH = 0.0254;
const FOOT = 0.3048;
const YARD = 0.9144;
const MILE = 1609.344;
const POUND = 0.45359237;
const OUNCE = POUND / 16;
const STONE = POUND * 14;
const US_GALLON = 3.785411784;
const US_CUP = US_GALLON / 16;
const UK_GALLON = 4.54609;

export const UNITS: Unit[] = [
  // Length, in metres.
  { id: 'mm', kind: 'length', system: 'metric', name: w('Millimetres', 'Millimeter'), short: w('mm'), factor: 0.001, pair: 'in', aliases: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'] },
  { id: 'cm', kind: 'length', system: 'metric', name: w('Centimetres', 'Zentimeter'), short: w('cm'), factor: 0.01, pair: 'in', aliases: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres', 'zentimeter'] },
  { id: 'm', kind: 'length', system: 'metric', name: w('Metres', 'Meter'), short: w('m'), factor: 1, pair: 'ft', aliases: ['m', 'meter', 'meters', 'metre', 'metres', 'metern'] },
  { id: 'km', kind: 'length', system: 'metric', name: w('Kilometres', 'Kilometer'), short: w('km'), factor: 1000, pair: 'mi', aliases: ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'kilometern'] },
  { id: 'in', kind: 'length', system: 'imperial', name: w('Inches', 'Zoll'), short: w('in'), factor: INCH, pair: 'cm', aliases: ['in', 'inch', 'inches', 'zoll', '"', '″'] },
  { id: 'ft', kind: 'length', system: 'imperial', name: w('Feet', 'Fuß'), short: w('ft'), factor: FOOT, pair: 'm', aliases: ['ft', 'foot', 'feet', 'fuß', 'fuss', "'", '′'] },
  { id: 'yd', kind: 'length', system: 'imperial', name: w('Yards'), short: w('yd'), factor: YARD, pair: 'm', aliases: ['yd', 'yard', 'yards'] },
  { id: 'mi', kind: 'length', system: 'imperial', name: w('Miles', 'Meilen'), short: w('mi'), factor: MILE, pair: 'km', aliases: ['mi', 'mile', 'miles', 'meile', 'meilen'] },
  { id: 'nmi', kind: 'length', system: 'imperial', name: w('Nautical miles', 'Seemeilen'), short: w('nmi', 'sm'), factor: 1852, pair: 'km', aliases: ['nmi', 'nm', 'nautical mile', 'nautical miles', 'seemeile', 'seemeilen', 'sm'] },

  // Weight, in kilograms.
  { id: 'g', kind: 'weight', system: 'metric', name: w('Grams', 'Gramm'), short: w('g'), factor: 0.001, pair: 'oz', aliases: ['g', 'gr', 'gram', 'grams', 'gramm', 'gramme'] },
  { id: 'kg', kind: 'weight', system: 'metric', name: w('Kilograms', 'Kilogramm'), short: w('kg'), factor: 1, pair: 'lb', aliases: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramm'] },
  { id: 't', kind: 'weight', system: 'metric', name: w('Tonnes', 'Tonnen'), short: w('t'), factor: 1000, pair: 'lb', aliases: ['t', 'tonne', 'tonnes', 'tonne', 'tonnen'] },
  { id: 'oz', kind: 'weight', system: 'imperial', name: w('Ounces', 'Unzen'), short: w('oz'), factor: OUNCE, pair: 'g', aliases: ['oz', 'ounce', 'ounces', 'unze', 'unzen'] },
  { id: 'lb', kind: 'weight', system: 'imperial', name: w('Pounds', 'Pfund (lb)'), short: w('lb'), factor: POUND, pair: 'kg', aliases: ['lb', 'lbs', 'pound', 'pounds', 'pfund'] },
  { id: 'st', kind: 'weight', system: 'imperial', name: w('Stone'), short: w('st'), factor: STONE, pair: 'kg', aliases: ['st', 'stone', 'stones'] },

  // Temperature: by formula (toKelvin, fromKelvin).
  { id: 'c', kind: 'temperature', system: 'metric', name: w('Celsius'), short: w('°C'), factor: 1, pair: 'f', dp: 2, aliases: ['°c', 'celsius', 'grad celsius', '° c', 'ºc'], near: ['c', 'grad'] },
  { id: 'f', kind: 'temperature', system: 'imperial', name: w('Fahrenheit'), short: w('°F'), factor: 1, pair: 'c', dp: 2, aliases: ['°f', 'fahrenheit', '° f', 'ºf'], near: ['f'] },
  { id: 'k', kind: 'temperature', system: 'metric', name: w('Kelvin'), short: w('K'), factor: 1, pair: 'c', dp: 2, aliases: ['kelvin'], near: ['k'] },

  // Volume, in litres.
  { id: 'ml', kind: 'volume', system: 'metric', name: w('Millilitres', 'Milliliter'), short: w('ml'), factor: 0.001, pair: 'floz', aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'] },
  { id: 'cl', kind: 'volume', system: 'metric', name: w('Centilitres', 'Zentiliter'), short: w('cl'), factor: 0.01, pair: 'floz', aliases: ['cl', 'centiliter', 'centilitre', 'zentiliter'] },
  { id: 'l', kind: 'volume', system: 'metric', name: w('Litres', 'Liter'), short: w('l'), factor: 1, pair: 'gal', aliases: ['l', 'liter', 'liters', 'litre', 'litres', 'litern'] },
  { id: 'm3', kind: 'volume', system: 'metric', name: w('Cubic metres', 'Kubikmeter'), short: w('m³'), factor: 1000, pair: 'gal', aliases: ['m3', 'm³', 'cubic meter', 'cubic metre', 'kubikmeter', 'cbm'] },
  { id: 'tsp', kind: 'volume', system: 'imperial', name: w('US teaspoons', 'US-Teelöffel'), short: w('tsp', 'TL'), factor: US_CUP / 48, pair: 'ml', aliases: ['tsp', 'teaspoon', 'teaspoons', 'tl', 'teelöffel'] },
  { id: 'tbsp', kind: 'volume', system: 'imperial', name: w('US tablespoons', 'US-Esslöffel'), short: w('tbsp', 'EL'), factor: US_CUP / 16, pair: 'ml', aliases: ['tbsp', 'tablespoon', 'tablespoons', 'el', 'esslöffel'] },
  { id: 'floz', kind: 'volume', system: 'imperial', name: w('US fluid ounces', 'US-Flüssigunzen'), short: w('fl oz'), factor: US_GALLON / 128, pair: 'ml', aliases: ['fl oz', 'floz', 'fl. oz.', 'fluid ounce', 'fluid ounces', 'oz'] },
  { id: 'cup', kind: 'volume', system: 'imperial', name: w('US cups', 'US-Tassen'), short: w('cups', 'Tassen'), one: w('cup', 'Tasse'), factor: US_CUP, pair: 'ml', aliases: ['cup', 'cups', 'us cup', 'us cups', 'tasse', 'tassen'] },
  { id: 'pt', kind: 'volume', system: 'imperial', name: w('US pints', 'US-Pints'), short: w('pt'), factor: US_GALLON / 8, pair: 'l', aliases: ['pt', 'pint', 'pints', 'us pint', 'us pints'] },
  { id: 'qt', kind: 'volume', system: 'imperial', name: w('US quarts', 'US-Quarts'), short: w('qt'), factor: US_GALLON / 4, pair: 'l', aliases: ['qt', 'quart', 'quarts'] },
  { id: 'gal', kind: 'volume', system: 'imperial', name: w('US gallons', 'US-Gallonen'), short: w('gal'), factor: US_GALLON, pair: 'l', aliases: ['gal', 'gallon', 'gallons', 'us gal', 'us gallon', 'gallone', 'gallonen'] },
  { id: 'ukpt', kind: 'volume', system: 'imperial', name: w('UK pints', 'UK-Pints'), short: w('UK pt'), factor: UK_GALLON / 8, pair: 'l', aliases: ['uk pt', 'uk pint', 'uk pints', 'imperial pint'] },
  { id: 'ukgal', kind: 'volume', system: 'imperial', name: w('UK gallons', 'UK-Gallonen'), short: w('UK gal'), factor: UK_GALLON, pair: 'l', aliases: ['uk gal', 'uk gallon', 'uk gallons', 'imperial gallon'] },

  // The kitchen: weights in grams, volumes in millilitres, joined by the ingredient's density.
  // Spoons are the metric 15 and 5 ml (the US ones are 1.4 % less: no spoon measures that close).
  { id: 'k-g', kind: 'kitchen', system: 'metric', name: w('Grams', 'Gramm'), short: w('g'), factor: 1, mass: true, pair: 'k-cup', aliases: ['g', 'gr', 'gram', 'grams', 'gramm'] },
  { id: 'k-ml', kind: 'kitchen', system: 'metric', name: w('Millilitres', 'Milliliter'), short: w('ml'), factor: 1, pair: 'k-g', aliases: ['ml', 'milliliter', 'millilitre', 'millilitres'] },
  { id: 'k-mcup', kind: 'kitchen', system: 'metric', name: w('Metric cups, 250 ml', 'Tassen, 250 ml'), short: w('cups', 'Tassen'), one: w('cup', 'Tasse'), factor: 250, pair: 'k-g', aliases: ['metric cup', 'metric cups', 'tasse', 'tassen'] },
  { id: 'k-tbsp', kind: 'kitchen', system: 'both', name: w('Tablespoons, 15 ml', 'Esslöffel, 15 ml'), short: w('tbsp', 'EL'), factor: 15, pair: 'k-g', aliases: ['tbsp', 'tablespoon', 'tablespoons', 'el', 'esslöffel'] },
  { id: 'k-tsp', kind: 'kitchen', system: 'both', name: w('Teaspoons, 5 ml', 'Teelöffel, 5 ml'), short: w('tsp', 'TL'), factor: 5, pair: 'k-g', aliases: ['tsp', 'teaspoon', 'teaspoons', 'tl', 'teelöffel'] },
  { id: 'k-cup', kind: 'kitchen', system: 'imperial', name: w('US cups, 236.6 ml', 'US-Tassen, 236,6 ml'), short: w('US cups', 'US-Tassen'), one: w('US cup', 'US-Tasse'), factor: US_CUP * 1000, pair: 'k-g', aliases: ['cup', 'cups', 'us cup', 'us cups', 'us-tasse', 'us-tassen'] },
  { id: 'k-oz', kind: 'kitchen', system: 'imperial', name: w('Ounces', 'Unzen'), short: w('oz'), factor: OUNCE * 1000, mass: true, pair: 'k-g', aliases: ['oz', 'ounce', 'ounces', 'unze', 'unzen'] },
];

export const KINDS: Kind[] = ['length', 'weight', 'temperature', 'volume', 'kitchen'];

export const unitById = (id: string) => UNITS.find((u) => u.id === id);

/** What a kind opens with, by the Units setting. */
export const DEFAULT_FROM: Record<Kind, Record<System, string>> = {
  length: { metric: 'km', imperial: 'mi' },
  weight: { metric: 'kg', imperial: 'lb' },
  temperature: { metric: 'c', imperial: 'f' },
  volume: { metric: 'l', imperial: 'gal' },
  kitchen: { metric: 'k-cup', imperial: 'k-cup' },
};

/** A kind's units, the setting's system first (spoons, which are both, right after it). */
export function ordered(kind: Kind, first: System): Unit[] {
  const list = UNITS.filter((u) => u.kind === kind);
  const rank = (u: Unit) => (u.system === first ? 0 : u.system === 'both' ? 1 : 2);
  return list.map((u, i) => ({ u, i })).sort((a, b) => rank(a.u) - rank(b.u) || a.i - b.i).map((x) => x.u);
}

// ── The kitchen's ingredients ────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string;
  name: Words;
  /** Grams in one US cup (USDA), the source of the density. */
  perCup: number;
}

export const INGREDIENTS: Ingredient[] = [
  { id: 'flour', name: w('Flour', 'Mehl'), perCup: 125 }, // wheat flour, white, all-purpose (20081)
  { id: 'sugar', name: w('Sugar', 'Zucker'), perCup: 200 }, // sugars, granulated (19335)
  { id: 'powdered', name: w('Powdered sugar', 'Puderzucker'), perCup: 120 }, // sugars, powdered, unsifted (19336)
  { id: 'butter', name: w('Butter'), perCup: 227 }, // butter, salted (01001)
  { id: 'rice', name: w('Rice, raw', 'Reis, roh'), perCup: 185 }, // rice, white, long-grain, raw (20044)
  { id: 'oats', name: w('Rolled oats', 'Haferflocken'), perCup: 81 }, // oats, regular and quick, dry (08120)
  { id: 'cocoa', name: w('Cocoa powder', 'Kakaopulver'), perCup: 86 }, // cocoa, dry powder, unsweetened (19165)
  { id: 'honey', name: w('Honey', 'Honig'), perCup: 339 }, // honey (19296)
  { id: 'milk', name: w('Milk', 'Milch'), perCup: 244 }, // milk, whole, 3.25 % (01077)
  { id: 'water', name: w('Water', 'Wasser'), perCup: US_CUP * 1000 }, // 1 g per ml (14411 lists 237 g)
  { id: 'oil', name: w('Oil', 'Öl'), perCup: 218 }, // oil, canola (04582)
  { id: 'salt', name: w('Salt', 'Salz'), perCup: 292 }, // salt, table (02047)
];

/** Grams per millilitre. */
export const density = (ingredient: Ingredient) => ingredient.perCup / (US_CUP * 1000);

// ── Converting ───────────────────────────────────────────────────────────────────────────────

export function toKelvin(value: number, unit: string): number {
  if (unit === 'c') return value + 273.15;
  if (unit === 'f') return ((value - 32) * 5) / 9 + 273.15;
  return value;
}

export function fromKelvin(kelvin: number, unit: string): number {
  if (unit === 'c') return kelvin - 273.15;
  if (unit === 'f') return ((kelvin - 273.15) * 9) / 5 + 32;
  return kelvin;
}

/**
 * `value` in `from` as `to`. In the kitchen a weight and a volume meet through the ingredient's
 * density; without one that's NaN.
 */
export function convert(value: number, from: Unit, to: Unit, ingredient?: Ingredient): number {
  if (!Number.isFinite(value) || from.kind !== to.kind) return NaN;
  if (from.kind === 'temperature') return fromKelvin(toKelvin(value, from.id), to.id);
  let base = value * from.factor;
  if (from.kind === 'kitchen' && !!from.mass !== !!to.mass) {
    if (!ingredient) return NaN;
    base = from.mass ? base / density(ingredient) : base * density(ingredient);
  }
  return base / to.factor;
}

/** Below absolute zero: no such temperature. */
export const belowZero = (value: number, unit: Unit) => unit.kind === 'temperature' && toKelvin(value, unit.id) < -1e-9;

/**
 * How many decimals to show: the unit's own limit, or five significant digits (5 km is 3.1069 mi,
 * 1 inch is 25.4 mm), never more than ten. The kitchen rounds like a recipe: whole grams and
 * millilitres from 10 on, cups to two decimals, spoons and ounces to one.
 */
export function decimals(value: number, unit: Unit): number {
  const a = Math.abs(value);
  if (unit.kind === 'kitchen') {
    if (unit.id === 'k-g' || unit.id === 'k-ml') return a >= 10 ? 0 : 1;
    if (unit.id === 'k-cup' || unit.id === 'k-mcup') return 2;
    return 1;
  }
  if (unit.dp !== undefined) return unit.dp;
  if (a === 0 || !Number.isFinite(a)) return 0;
  return Math.min(10, Math.max(0, 4 - Math.floor(Math.log10(a))));
}

/**
 * A value with its unit, typed or pasted: "5 km", "350°F", "−40 °C", "2,5 cups". The unit is looked
 * for in `kind` first (an "oz" in the kitchen is a kitchen ounce), then in every kind. No unit, or
 * one we don't know, gives `unit: null` with the number alone.
 */
export function parseQuantity(text: string, kind?: Kind, parse: (s: string) => number = Number): { value: number; unit: Unit | null } {
  const t = String(text ?? '').trim();
  const m = /^([-−+]?[\d\s.,' ]*\d|[-−+]?[.,]\d+)\s*(.*)$/.exec(t);
  if (!m) return { value: NaN, unit: null };
  const value = parse(m[1]);
  const rest = m[2].trim().toLowerCase().replace(/\.$/, '');
  if (!rest) return { value, unit: null };
  const match = (u: Unit) => u.aliases.includes(rest);
  const inKind = (u: Unit) => u.kind === kind && (match(u) || !!u.near?.includes(rest));
  const unit = (kind ? UNITS.find(inKind) : undefined) ?? UNITS.find((u) => u.kind !== 'kitchen' && match(u)) ?? UNITS.find(match) ?? null;
  return { value: unit ? value : NaN, unit };
}

/** The unit's word after a number: "1 cup", "2 cups". */
export function shortOf(unit: Unit, value: number, lang: 'en' | 'de'): string {
  return unit.one && Math.abs(value) === 1 ? unit.one[lang] : unit.short[lang];
}
