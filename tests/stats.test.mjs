// Resoconto della settimana. Esegui dalla cartella del progetto: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekSummary } from '../js/stats.js';
import { DEMO_ITEMS } from '../js/demo.js';

const created = Date.UTC(2026, 9, 1);
const items = DEMO_ITEMS.map((it) => ({ ...it, status: 'disponibile', createdAt: created }));
const log = [
  { date: '2026-11-02', itemIds: ['demo-01', 'demo-05', 'demo-10', 'demo-14'] },
  { date: '2026-11-03', itemIds: ['demo-01', 'demo-06', 'demo-11', 'demo-14'] },
  { date: '2026-10-01', itemIds: ['demo-03', 'demo-08', 'demo-13', 'demo-16'] },
];

test('last week, most worn and forgotten pieces', () => {
  const r = weekSummary({ items, log, today: '2026-11-04' });
  assert.equal(r.worn, 2);
  assert.equal(r.distinct, 6);
  assert.deepEqual(r.top.slice(0, 2).map((t) => t.item.id).sort(), ['demo-01', 'demo-14']);
  const forgotten = r.forgotten.map((f) => f.item.id);
  assert.ok(forgotten.includes('demo-03'), 'field jacket non messa da un mese');
  assert.ok(!forgotten.includes('demo-01'));
  assert.ok(!forgotten.includes('demo-17'), 'gli accessori non contano');
});

test('items put aside or on the wish list are not forgotten', () => {
  const aside = items.map((it) => (it.id === 'demo-03' ? { ...it, status: 'stagione' } : it.id === 'demo-02' ? { ...it, status: 'desiderato' } : it));
  const ids = weekSummary({ items: aside, log, today: '2026-11-04' }).forgotten.map((f) => f.item.id);
  assert.ok(!ids.includes('demo-03') && !ids.includes('demo-02'));
});

test('cost per wear', () => {
  const priced = items.map((it) => (it.id === 'demo-01' ? { ...it, price: 300, totalWears: 30 } : it.id === 'demo-02' ? { ...it, price: 200, totalWears: 0 } : it));
  const { cost } = weekSummary({ items: priced, log, today: '2026-11-04' });
  assert.equal(cost.cheapest[0].perWear, 10);
  assert.equal(cost.dearest[0].item.id, 'demo-02');
  assert.equal(cost.total, 500);
});

test('the week ahead flags rain without a waterproof outer', () => {
  const noParka = items.filter((it) => it.id !== 'demo-04');
  const forecast = [
    { date: '2026-11-04', code: 3, appMax: 5, appMin: 1, precipProb: 10, precipSum: 0 },
    { date: '2026-11-05', code: 63, appMax: 7, appMin: 3, precipProb: 90, precipSum: 8 },
  ];
  const r = weekSummary({ items: noParka, log, today: '2026-11-04', forecast });
  assert.equal(r.ahead.length, 2);
  assert.equal(r.ahead[0].issue, null);
  assert.equal(r.ahead[1].issue, 'pioggia senza capospalla impermeabile');
  assert.equal(weekSummary({ items, log, today: '2026-11-04', forecast }).issues.length, 0);
});
