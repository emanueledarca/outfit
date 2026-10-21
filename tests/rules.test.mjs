// Esegui dalla cartella del progetto: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestOutfits, applyWear, undoWear, washed, weatherNeed, daysBetween, signatureOf, nearestColorName, slotOf,
} from '../js/rules.js';
import { DEMO_ITEMS } from '../js/demo.js';

const items = DEMO_ITEMS.map((it) => ({ ...it, status: 'disponibile' }));
const cold = { appMax: 1, appMin: -5, precipProb: 10, precipSum: 0, snow: 0 };
const snowy = { appMax: -1, appMin: -6, precipProb: 80, precipSum: 3, snow: 2 };
const mild = { appMax: 16, appMin: 10, precipProb: 0, precipSum: 0, snow: 0 };

const top = (o) => o.mid ?? o.base;
const logOf = (date, o) => ({ date, itemIds: Object.values(o).filter((x) => x?.id).map((x) => x.id), signature: o.signature });

test('date helpers', () => {
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(weatherNeed(cold).level, 3);
  assert.equal(weatherNeed(snowy).snow, true);
  assert.equal(weatherNeed(mild).level, 1);
});

test('nearest colour names', () => {
  assert.equal(nearestColorName([28, 38, 72]), 'blu navy');
  assert.equal(nearestColorName([238, 230, 214]), 'panna');
});

test('cold day: warm outer layer, a mid layer and a scarf', () => {
  const { outfits } = suggestOutfits(items, { today: '2026-11-04', weather: cold });
  assert.ok(outfits.length > 0);
  const best = outfits[0];
  assert.ok(best.outer && best.outer.warmth >= 4);
  assert.ok(best.mid);
  assert.ok(best.scarf);
});

test('snow: waterproof parka and boots, never suede', () => {
  const { outfits } = suggestOutfits(items, { today: '2026-11-04', weather: snowy });
  const best = outfits[0];
  assert.equal(best.outer.category, 'parka');
  assert.equal(best.shoes.category, 'stivali');
  assert.ok(best.hat);
});

test('no top worn yesterday, no outfit repeated within 14 days', () => {
  let log = [];
  let wardrobe = items.map((it) => ({ ...it }));
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
  let prev = null;
  for (const day of days) {
    const { outfits } = suggestOutfits(wardrobe, { today: day, weather: cold, log });
    const best = outfits[0];
    assert.ok(best, `nessun outfit il ${day}`);
    if (prev) assert.notEqual(top(best).id, top(prev).id, `stessa maglia due giorni di fila il ${day}`);
    assert.ok(!log.some((e) => e.signature === best.signature), `outfit ripetuto il ${day}`);
    const ids = logOf(day, best).itemIds;
    const { updated } = applyWear(wardrobe, ids);
    wardrobe = wardrobe.map((it) => updated.find((u) => u.id === it.id) ?? it);
    log = [...log, logOf(day, best)];
    prev = best;
  }
});

test('laundry: t-shirt after one wear, sweater after four; washing resets', () => {
  const tee = items.find((it) => it.category === 'tshirt');
  const { updated, moved } = applyWear([tee], [tee.id]);
  assert.equal(updated[0].status, 'lavare');
  assert.equal(moved.length, 1);
  assert.equal(undoWear(updated, [tee.id])[0].status, 'disponibile');

  let sweater = items.find((it) => it.category === 'dolcevita');
  for (let i = 0; i < 3; i++) sweater = applyWear([sweater], [sweater.id]).updated[0];
  assert.equal(sweater.status, 'disponibile');
  sweater = applyWear([sweater], [sweater.id]).updated[0];
  assert.equal(sweater.status, 'lavare');
  assert.deepEqual([washed(sweater).status, washed(sweater).wearsSinceWash], ['disponibile', 0]);
});

test('items in the wash or damaged are never proposed', () => {
  const wardrobe = items.map((it) => (it.category === 'dolcevita' ? { ...it, status: 'lavare' } : it.category === 'parka' ? { ...it, status: 'rovinato' } : it));
  const { outfits } = suggestOutfits(wardrobe, { today: '2026-11-04', weather: snowy });
  for (const o of outfits) {
    assert.notEqual(o.mid?.category, 'dolcevita');
    assert.notEqual(o.outer?.category, 'parka');
  }
});

test('a disliked outfit is not proposed again for 30 days', () => {
  const first = suggestOutfits(items, { today: '2026-11-04', weather: cold }).outfits[0];
  const again = suggestOutfits(items, { today: '2026-11-10', weather: cold, disliked: { [first.signature]: '2026-11-04' } });
  assert.ok(again.outfits.every((o) => o.signature !== first.signature));
});

test('mild day: no heavy coat needed, a t-shirt alone is allowed', () => {
  const { outfits } = suggestOutfits(items, { today: '2026-05-04', weather: mild });
  assert.ok(outfits.length > 0);
  assert.ok(outfits.every((o) => o.outer || o.mid));
});

test('tiny wardrobe: rules relax instead of returning nothing', () => {
  const tiny = items.filter((it) => ['demo-01', 'demo-05', 'demo-10', 'demo-14'].includes(it.id));
  const o1 = suggestOutfits(tiny, { today: '2026-11-04', weather: cold }).outfits[0];
  const log = [logOf('2026-11-04', o1)];
  const r2 = suggestOutfits(tiny, { today: '2026-11-05', weather: cold, log });
  assert.ok(r2.outfits.length > 0);
  assert.equal(r2.relaxed, true);
});

test('missing slots are reported', () => {
  const r = suggestOutfits(items.filter((it) => slotOf(it) !== 'shoes'), { today: '2026-11-04', weather: cold });
  assert.equal(r.outfits.length, 0);
  assert.ok(r.missing.includes('scarpe'));
});

test('signature ignores shoes', () => {
  const a = { outer: { id: 'c' }, mid: { id: 'm' }, base: null, bottom: { id: 'p' }, shoes: { id: 's1' } };
  assert.equal(signatureOf(a), signatureOf({ ...a, shoes: { id: 's2' } }));
});
