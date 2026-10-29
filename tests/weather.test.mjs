// Meteo del tragitto, vento e freddo vero. Esegui dalla cartella del progetto: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { commuteOf } from '../js/weather.js';
import { weatherNeed, suggestOutfits } from '../js/rules.js';
import { DEMO_ITEMS } from '../js/demo.js';

const items = DEMO_ITEMS.map((it) => ({ ...it, status: 'disponibile' }));

// Una giornata oraria finta: f(ora) per ogni variabile.
function day(f) {
  const keys = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'snowfall', 'snow_depth', 'wind_speed_10m', 'wind_gusts_10m'];
  return { appMax: 8, appMin: 0, precipProb: 0, precipSum: 0, snow: 0, hours: Object.fromEntries(keys.map((k) => [k, Array.from({ length: 24 }, (_, h) => f(k, h))])) };
}

test('commute reads the hours you are outside, not the daily extremes', () => {
  const d = day((k, h) => (k === 'apparent_temperature' ? (h === 8 ? -4 : h === 18 ? 2 : 10) : k === 'precipitation_probability' ? (h === 13 ? 90 : 5) : 0));
  const c = commuteOf(d, 8, 18);
  assert.deepEqual([c.outApp, c.backApp, c.precipProb], [-4, 2, 5]);
  const need = weatherNeed({ ...d, commute: c });
  assert.equal(need.level, 3);
  assert.equal(need.wet, false, 'la pioggia delle 13 non conta: sei dentro');
});

test('wind: strong gusts make the day windy', () => {
  const calm = day((k) => (k === 'apparent_temperature' ? 6 : k === 'wind_speed_10m' ? 12 : k === 'wind_gusts_10m' ? 25 : 0));
  const gusty = day((k) => (k === 'apparent_temperature' ? 6 : k === 'wind_speed_10m' ? 22 : k === 'wind_gusts_10m' ? 60 : 0));
  assert.equal(weatherNeed({ ...calm, commute: commuteOf(calm) }).windy, false);
  assert.equal(weatherNeed({ ...gusty, commute: commuteOf(gusty) }).windy, true);
  assert.equal(weatherNeed({ appMax: 6, appMin: 2, windMax: 40, gustMax: 70 }).windy, true, 'senza dati orari valgono i massimi del giorno');
});

test('cold sensitivity shifts the layers', () => {
  const w = { appMax: 6, appMin: 4 };
  assert.equal(weatherNeed(w).level, 2);
  assert.equal(weatherNeed(w, { coldBias: 3 }).level, 3);
  assert.equal(weatherNeed(w, { coldBias: -2 }).level, 2);
});

test('windy and rainy: a waterproof outer, no umbrella, and a scarf already at 6 degrees', () => {
  const w = { appMax: 7, appMin: 5, precipProb: 90, precipSum: 6, snow: 0, windMax: 40, gustMax: 70 };
  const { outfits, need } = suggestOutfits(items, { today: '2026-11-04', weather: w });
  assert.equal(need.level, 2);
  const best = outfits[0];
  assert.equal(best.outer.waterproof, true);
  assert.ok(best.scarf, 'con il vento la sciarpa serve prima');
  assert.ok(best.reasons.some((r) => r.includes('niente ombrello')), best.reasons.join(' / '));
});

test('deep cold: boots, warmest coat, hat; never suede', () => {
  const w = { appMax: -12, appMin: -18, precipProb: 0, precipSum: 0, snow: 0 };
  const { outfits, need } = suggestOutfits(items, { today: '2026-01-15', weather: w });
  assert.equal(need.deep, true);
  for (const o of outfits.slice(0, 3)) {
    assert.equal(o.shoes.category, 'stivali');
    assert.ok(o.outer.warmth >= 5);
    assert.ok(o.hat);
  }
});
