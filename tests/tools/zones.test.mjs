import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wall, offsetAt, zonedToUtc, offsetLabel, diffLabel, PLACES, placeById, placeForZone, search, strip, overlap, runs, status, zoneOk, usable } from '../../src/tools/zones/zones.ts';
import { CITIES } from '../../src/tools/zones/cities.ts';

const Z = (iso) => Date.parse(iso);
const countries = (code) => (code ? [new Intl.DisplayNames(['en'], { type: 'region' }).of(code), new Intl.DisplayNames(['de'], { type: 'region' }).of(code)] : []);
const zones = Intl.supportedValuesOf('timeZone');

test('every city’s zone is one the browser knows, and every id is unique', () => {
  assert.ok(CITIES.length >= 150, `${CITIES.length} cities`);
  assert.equal(PLACES.length, CITIES.length, 'none left out');
  for (const p of PLACES) assert.ok(zoneOk(p.zone), p.zone);
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length);
  for (const p of PLACES) assert.match(p.country, /^[A-Z]{2}$/, p.name.en);
  assert.equal(usable('Not/AZone'), null);
});

test('offsets through daylight saving in Europe/Berlin', () => {
  assert.equal(offsetAt('Europe/Berlin', Z('2026-03-29T00:59:00Z')), 60);
  assert.equal(offsetAt('Europe/Berlin', Z('2026-03-29T01:00:00Z')), 120, 'summer time from 01:00 UTC');
  assert.equal(offsetAt('Europe/Berlin', Z('2026-10-25T00:59:00Z')), 120);
  assert.equal(offsetAt('Europe/Berlin', Z('2026-10-25T01:00:00Z')), 60, 'back on the last Sunday of October');
  assert.equal(offsetAt('Asia/Kolkata', Z('2026-06-01T00:00:00Z')), 330);
  assert.equal(offsetAt('Asia/Kathmandu', Z('2026-06-01T00:00:00Z')), 345);
  assert.equal(offsetAt('America/St_Johns', Z('2026-01-15T12:00:00Z')), -210);
  assert.equal(offsetAt('Pacific/Kiritimati', Z('2026-01-15T12:00:00Z')), 840);
  assert.equal(offsetAt('UTC', Z('2026-01-15T12:00:00Z')), 0);
});

test('offsets through daylight saving in America/New_York', () => {
  assert.equal(offsetAt('America/New_York', Z('2026-03-08T06:59:00Z')), -300);
  assert.equal(offsetAt('America/New_York', Z('2026-03-08T07:00:00Z')), -240, 'second Sunday of March, 2:00 local');
  assert.equal(offsetAt('America/New_York', Z('2026-11-01T05:59:00Z')), -240);
  assert.equal(offsetAt('America/New_York', Z('2026-11-01T06:00:00Z')), -300, 'first Sunday of November');
});

test('Berlin and New York are 5 hours apart for a week in spring and one in autumn', () => {
  const gap = (iso) => (offsetAt('Europe/Berlin', Z(iso)) - offsetAt('America/New_York', Z(iso))) / 60;
  assert.equal(gap('2026-01-15T12:00:00Z'), 6);
  assert.equal(gap('2026-03-15T12:00:00Z'), 5, 'the US has moved, Europe not yet');
  assert.equal(gap('2026-04-15T12:00:00Z'), 6);
  assert.equal(gap('2026-10-31T12:00:00Z'), 5, 'Europe is back, the US not yet');
  assert.equal(gap('2026-11-02T12:00:00Z'), 6);
});

test('a home time to an instant, through the changes', () => {
  assert.equal(new Date(zonedToUtc('2026-10-31', 15, 0, 'Europe/Berlin')).toISOString(), '2026-10-31T14:00:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-07-01', 15, 0, 'Europe/Berlin')).toISOString(), '2026-07-01T13:00:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-03-29', 12, 0, 'Europe/Berlin')).toISOString(), '2026-03-29T10:00:00.000Z', 'later on the day the clocks go forward');
  assert.equal(new Date(zonedToUtc('2026-10-25', 12, 0, 'Europe/Berlin')).toISOString(), '2026-10-25T11:00:00.000Z', 'later on the day they go back');
  assert.equal(new Date(zonedToUtc('2026-03-29', 2, 30, 'Europe/Berlin')).toISOString(), '2026-03-29T01:30:00.000Z', '02:30 doesn’t exist: 03:30 summer time');
  assert.equal(new Date(zonedToUtc('2026-10-25', 2, 30, 'Europe/Berlin')).toISOString(), '2026-10-25T00:30:00.000Z', '02:30 happens twice: the first');
  assert.equal(new Date(zonedToUtc('2026-03-08', 2, 30, 'America/New_York')).toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-11-01', 1, 30, 'America/New_York')).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-11-01', 9, 0, 'America/New_York')).toISOString(), '2026-11-01T14:00:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-06-01', 0, 0, 'Asia/Kolkata')).toISOString(), '2026-05-31T18:30:00.000Z');
  // Every hour of a year, both zones: the wall clock of the instant reads the hour asked for,
  // except the skipped one.
  for (const zone of ['Europe/Berlin', 'America/New_York']) {
    for (let day = 0; day < 365; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      for (let h = 0; h < 24; h++) {
        const w = wall(zone, zonedToUtc(date, h, 0, zone));
        if (w.h !== h) assert.equal(w.h, h + 1, `${zone} ${date} ${h}:00 → ${w.h}`);
      }
    }
  }
});

test('labels', () => {
  assert.equal(offsetLabel(60), 'UTC+1');
  assert.equal(offsetLabel(-240), 'UTC−4');
  assert.equal(offsetLabel(330), 'UTC+5:30');
  assert.equal(offsetLabel(-210), 'UTC−3:30');
  assert.equal(offsetLabel(0), 'UTC');
  assert.equal(diffLabel(-300), '−5 h');
  assert.equal(diffLabel(270), '+4:30 h');
  assert.equal(diffLabel(0), '±0 h');
});

test('search: cities in both languages, countries, any zone', () => {
  const names = (q) => search(q, countries, zones).map((p) => p.name.en);
  assert.equal(names('new y')[0], 'New York');
  assert.equal(names('münchen')[0], 'Munich');
  assert.equal(names('munchen')[0], 'Munich', 'without the umlaut');
  assert.equal(names('Tokio')[0], 'Tokyo');
  assert.equal(names('sao paulo')[0], 'São Paulo');
  assert.ok(names('japan').includes('Tokyo'), 'by country');
  assert.ok(names('Japan').includes('Osaka'));
  assert.ok(names('vereinigte staaten').length > 0, 'by country in German');
  const kol = search('Asia/Kolkata', countries, zones);
  assert.ok(kol.some((p) => p.zone === 'Asia/Kolkata'));
  const rare = search('ushuaia', countries, zones);
  assert.equal(rare[0].id, 'tz:America/Argentina/Ushuaia', 'a zone with no city in the list');
  assert.equal(rare[0].name.en, 'Ushuaia');
  assert.ok(search('utc', countries, zones).some((p) => p.zone === 'UTC'));
  assert.deepEqual(search('', countries, zones), []);
  assert.deepEqual(search('xyzzy', countries, zones), []);
  assert.ok(search('a', countries, zones).length <= 8);
});

test('places by id and for a zone', () => {
  assert.equal(placeById('new-york').zone, 'America/New_York');
  assert.equal(placeById('sao-paulo').name.en, 'São Paulo');
  assert.equal(placeById('tz:America/Argentina/Ushuaia').name.en, 'Ushuaia');
  assert.equal(placeById('tz:Nowhere/Land'), null);
  assert.equal(placeById('atlantis'), null);
  assert.equal(placeForZone('Europe/Berlin').name.en, 'Berlin', 'the city the zone is named after');
  assert.equal(placeForZone('America/Detroit').name.en, 'Detroit');
  assert.equal(placeForZone('Asia/Calcutta').name.en, 'New Delhi', 'an old name finds the cities');
  assert.equal(search('calcutta', countries, zones).filter((p) => p.id.startsWith('tz:')).length, 0, 'no second Kolkata under its old name');
  assert.equal(placeForZone('America/Argentina/Ushuaia').id, 'tz:America/Argentina/Ushuaia');
});

test('the strip: working hours there, on the home clock', () => {
  // 31 October 2026: Berlin is back on winter time, New York not yet: 5 hours.
  const ny = strip('2026-10-31', 'Europe/Berlin', 'America/New_York');
  assert.equal(ny.length, 24);
  assert.equal(ny[14].local, 9.5, 'Berlin 14:00–15:00 is New York 9:00–10:00');
  assert.deepEqual(ny.filter((h) => h.working).map((h) => h.home), [14, 15, 16, 17, 18, 19, 20, 21]);
  assert.equal(ny[3].day, -1, 'Berlin 3:00 is the evening before there');
  assert.equal(ny[12].day, 0);
  const berlin = strip('2026-10-31', 'Europe/Berlin', 'Europe/Berlin');
  assert.deepEqual(berlin.filter((h) => h.working).map((h) => h.home), [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual(runs(overlap([berlin, ny])), [[14, 17]]);
  // Two days later both are on winter time: 6 hours, one hour less in common.
  const ny2 = strip('2026-11-02', 'Europe/Berlin', 'America/New_York');
  assert.deepEqual(runs(overlap([strip('2026-11-02', 'Europe/Berlin', 'Europe/Berlin'), ny2])), [[15, 17]]);
  // Half an hour off: an hour counts when most of it is working time.
  const india = strip('2026-10-31', 'Europe/Berlin', 'Asia/Kolkata');
  assert.equal(india[5].local, 10, 'Berlin 5:00–6:00 is 9:30–10:30 in India');
  assert.deepEqual(india.filter((h) => h.working).map((h) => h.home), [4, 5, 6, 7, 8, 9, 10, 11]);
  const tokyo = strip('2026-10-31', 'Europe/Berlin', 'Asia/Tokyo');
  assert.equal(tokyo[20].day, 1, 'Berlin 20:00 is tomorrow in Tokyo');
  assert.deepEqual(overlap([berlin, ny, tokyo]), [], 'no hour suits all three');
  assert.deepEqual(overlap([]), []);
});

test('runs and what people are doing', () => {
  assert.deepEqual(runs([16, 14, 15, 20]), [[14, 17], [20, 21]]);
  assert.deepEqual(runs([]), []);
  assert.equal(status(10), 'work');
  assert.equal(status(8), 'morning');
  assert.equal(status(17), 'evening');
  assert.equal(status(23.5), 'night');
  assert.equal(status(3), 'night');
});
