// Resoconto: come usi il guardaroba e se regge i prossimi giorni.
// Nessuna dipendenza dal DOM: si testa con `node --test tests/`.

import { suggestOutfits, weatherNeed, daysBetween, slotOf, isWaterproof, CORE_SLOTS } from './rules.js';

const owned = (it) => (it.status ?? 'disponibile') !== 'desiderato';
// Fuori stagione e rovinati non sono "dimenticati": sono messi da parte apposta.
const inUse = (it) => ['disponibile', 'lavare'].includes(it.status ?? 'disponibile');

function isoOf(ms) {
  return new Date(ms).toLocaleDateString('sv-SE');
}

// Quante volte è stato messo ogni capo negli ultimi `days` giorni.
function wearCounts(log, today, days) {
  const counts = new Map();
  for (const e of log) {
    const d = daysBetween(e.date, today);
    if (d < 0 || d >= days) continue;
    for (const id of e.itemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// Il problema principale di un giorno, se il guardaroba non lo copre bene.
function dayIssue(sug) {
  const best = sug.outfits[0];
  if (!best) return `mancano ${sug.missing.join(', ') || 'capi disponibili'}`;
  const { need } = sug;
  if (need.snow && !(isWaterproof(best.shoes) || best.shoes.category === 'stivali')) return 'neve senza scarpe adatte';
  if (need.wet && need.level >= 1 && !(best.outer && isWaterproof(best.outer))) return 'pioggia senza capospalla impermeabile';
  if (need.deep && !best.gloves) return 'gelo senza guanti';
  if (need.level >= 3 && !best.scarf) return 'freddo senza sciarpa';
  return null;
}

// forecast: i giorni di Open-Meteo, già con `commute` se c'è.
export function weekSummary({ items, log = [], today, forecast = [], coldBias = 0, noRepeatDays = 14 }) {
  const mine = items.filter(owned);
  const byId = new Map(items.map((it) => [it.id, it]));

  const week = log.filter((e) => { const d = daysBetween(e.date, today); return d >= 0 && d < 7; });
  const weekItems = new Set(week.flatMap((e) => e.itemIds));
  const month = wearCounts(log, today, 30);
  const top = [...month.entries()]
    .filter(([id]) => byId.has(id) && CORE_SLOTS.includes(slotOf(byId.get(id))))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ item: byId.get(id), wears: n }));

  // Dimenticati: nell'armadio da almeno due settimane e non messi da un mese.
  const lastWorn = new Map();
  for (const e of log) for (const id of e.itemIds) if (!lastWorn.has(id) || lastWorn.get(id) < e.date) lastWorn.set(id, e.date);
  const forgotten = mine
    .filter((it) => inUse(it) && CORE_SLOTS.includes(slotOf(it)))
    .map((it) => {
      const since = lastWorn.get(it.id) ?? (it.createdAt ? isoOf(it.createdAt) : today);
      return { item: it, days: daysBetween(since, today), never: !lastWorn.has(it.id) };
    })
    .filter((f) => f.days >= 30 || (f.never && f.days >= 14))
    .sort((a, b) => b.days - a.days)
    .slice(0, 6);

  const priced = mine.filter((it) => it.price > 0);
  const cost = priced
    .map((it) => ({ item: it, wears: it.totalWears ?? 0, perWear: it.price / Math.max(1, it.totalWears ?? 0) }))
    .sort((a, b) => a.perWear - b.perWear);

  const ahead = forecast
    .filter((d) => d.date >= today)
    .slice(0, 7)
    .map((d) => {
      const sug = suggestOutfits(items, { today: d.date, weather: d, log, coldBias, noRepeatDays });
      return { date: d.date, code: d.code, label: d.label, tMin: d.tMin, tMax: d.tMax, need: weatherNeed(d, { coldBias }), issue: dayIssue(sug) };
    });

  return {
    worn: week.length,
    distinct: weekItems.size,
    owned: mine.length,
    top,
    forgotten,
    cost: { cheapest: cost.filter((c) => c.wears > 0).slice(0, 3), dearest: [...cost].reverse().slice(0, 3), total: priced.reduce((t, it) => t + it.price, 0) },
    ahead,
    issues: ahead.filter((d) => d.issue),
  };
}
