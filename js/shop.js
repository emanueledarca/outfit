// Acquisti: quanti outfit buoni aggiunge un capo al guardaroba di oggi.
// Serve a "Cosa comprare" e a "Lo compro?". Nessuna dipendenza dal DOM.

import {
  SLOTS, CORE_SLOTS, OCCASIONS, GOOD_QUALITY, combinations, qualityOf, traitCache, weatherNeed, slotOf, signatureOf, COLOR_RGB,
} from './rules.js';
import { styleFitOf, styleLabel, oklab, deltaE, guessFabric, CATEGORY_STYLE } from './style.js';

// Giornate tipiche di un anno a Stoccolma, con il loro peso.
export const SCENARIOS = [
  { id: 'freddo', label: 'giorni freddi', weight: 0.3, weather: { appMax: 1, appMin: -5, precipProb: 10, precipSum: 0, snow: 0 } },
  { id: 'pioggia', label: 'giorni di pioggia', weight: 0.25, weather: { appMax: 7, appMin: 2, precipProb: 85, precipSum: 6, snow: 0 } },
  { id: 'gelo', label: 'giorni di neve', weight: 0.15, weather: { appMax: -5, appMin: -12, precipProb: 60, precipSum: 2, snow: 3 } },
  { id: 'mezza', label: 'mezza stagione', weight: 0.2, weather: { appMax: 14, appMin: 7, precipProb: 10, precipSum: 0, snow: 0 } },
  { id: 'estate', label: 'giorni caldi', weight: 0.1, weather: { appMax: 23, appMin: 14, precipProb: 10, precipSum: 0, snow: 0 } },
];
const SHOP_OCCASIONS = ['lab', 'uscita', 'relax'];

const usable = (it) => (it.status ?? 'disponibile') !== 'desiderato';

function bySlot(items) {
  return Object.fromEntries(SLOTS.map((s) => [s, items.filter((it) => slotOf(it) === s)]));
}

// Insiemi degli outfit buoni per scenario, con o senza un capo obbligatorio.
// Un outfit è la combinazione dei vestiti: cambiare solo le scarpe non lo rende nuovo.
function goodSets(items, traits, must = null) {
  const by = bySlot(items);
  if (must) by[slotOf(must)] = [must];
  const out = {};
  for (const sc of SCENARIOS) {
    const need = weatherNeed(sc.weather);
    const good = new Set();
    for (const occ of SHOP_OCCASIONS) {
      const ctx = { need, target: OCCASIONS[occ].formality, traits };
      for (const o of combinations(by, need)) {
        if (must && o[slotOf(must)] !== must) continue;
        const sig = signatureOf(o);
        if (good.has(sig)) continue;
        if (qualityOf(o, ctx).q >= GOOD_QUALITY) good.add(sig);
      }
    }
    out[sc.id] = good;
  }
  return out;
}

const count = (sets) => Object.values(sets).reduce((t, s) => t + s.size, 0);

// Quanti outfit buoni ha il guardaroba, per scenario.
export function wardrobeCoverage(items) {
  const traits = traitCache();
  const sets = goodSets(items.filter(usable), traits);
  return {
    total: count(sets),
    byScenario: SCENARIOS.map((sc) => ({ ...sc, good: sets[sc.id].size })),
  };
}

// Un capo quasi uguale già nell'armadio.
export function similarOwned(candidate, items) {
  const slot = slotOf(candidate);
  const lab = oklab(candidate.rgb ?? COLOR_RGB[candidate.color] ?? [150, 150, 150]);
  const fabric = candidate.fabric ?? guessFabric(candidate, CATEGORY_STYLE[candidate.category]?.fabric);
  return items.find((it) => {
    if (it.id === candidate.id || !usable(it) || slotOf(it) !== slot || it.category !== candidate.category) return false;
    const other = oklab(it.rgb ?? COLOR_RGB[it.color] ?? [150, 150, 150]);
    const f = it.fabric ?? guessFabric(it, CATEGORY_STYLE[it.category]?.fabric);
    return deltaE(lab, other) < 0.07 && f === fabric;
  }) ?? null;
}

// Cosa aggiunge `candidate` agli outfit buoni del guardaroba `items`.
// value ordina la lista: premia i giorni oggi scoperti e smorza i capi aperti
// (un cardigan moltiplica le combinazioni senza valere dieci maglioni).
export function gainOf(candidate, items, base = null) {
  const traits = traitCache();
  const owned = items.filter((it) => usable(it) && it.id !== candidate.id);
  const before = base ?? goodSets(owned, traits);
  const slot = slotOf(candidate);
  const style = styleFitOf(candidate, slot);
  if (!CORE_SLOTS.includes(slot)) {
    const others = owned.filter((it) => slotOf(it) === slot).length;
    return { candidate, slot, style, added: others ? 0 : 1, value: others ? 0 : 0.5, byScenario: [], filled: null, before: count(before), accessory: true };
  }
  const withIt = goodSets([...owned, candidate], traits, candidate);
  const byScenario = SCENARIOS.map((sc) => {
    const prev = before[sc.id];
    let added = 0;
    for (const sig of withIt[sc.id]) if (!prev.has(sig)) added += 1;
    return { ...sc, before: prev.size, added };
  });
  const filled = byScenario.filter((s) => s.before < 2 && s.added > 0 && s.weight >= 0.15).sort((a, b) => b.weight - a.weight)[0] ?? null;
  const added = byScenario.reduce((t, s) => t + s.added, 0);
  const value = byScenario.reduce((t, s) => t + s.weight * Math.log1p(s.added) * (s.before < 3 ? 3 : 1), 0) * (0.5 + style.fit);
  return { candidate, slot, style, added, value, byScenario, filled, before: count(before), accessory: false };
}

// I migliori outfit con il capo nuovo, per mostrarli.
export function examplesWith(candidate, items, n = 3) {
  const traits = traitCache();
  const owned = items.filter((it) => usable(it) && it.id !== candidate.id);
  const slot = slotOf(candidate);
  if (!CORE_SLOTS.includes(slot)) return [];
  const by = bySlot([...owned, candidate]);
  by[slot] = [candidate];
  const seen = new Set();
  const all = [];
  for (const sc of SCENARIOS.slice(0, 4)) {
    const need = weatherNeed(sc.weather);
    const ctx = { need, target: OCCASIONS.lab.formality, traits };
    for (const o of combinations(by, need)) {
      if (o[slot] !== candidate) continue;
      const sig = `${signatureOf(o)}|${o.shoes?.id}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const { q, notes } = qualityOf(o, ctx);
      all.push({ ...o, quality: q, notes, scenario: sc.label });
    }
  }
  // Varietà: non tre outfit che cambiano solo le scarpe.
  const picked = [];
  for (const o of all.sort((a, b) => b.quality - a.quality)) {
    if (o.quality < GOOD_QUALITY) break;
    const top = (o.mid ?? o.base)?.id;
    if (picked.some((p) => (p.mid ?? p.base)?.id === top && p.bottom?.id === o.bottom?.id)) continue;
    picked.push(o);
    if (picked.length === n) break;
  }
  return picked;
}

// Verdetto per "Lo compro?": { kind: 'si' | 'forse' | 'no', title, reasons }.
export function verdict(gain, items, price = null, currency = '€') {
  const { candidate, style, added, filled, before } = gain;
  const twin = similarOwned(candidate, items);
  const reasons = [];
  let kind;
  let title;

  const ownedCount = items.filter(usable).length;
  if (style.fit < 0.45) {
    kind = 'no';
    title = 'Non è il tuo stile';
    reasons.push(style.why ? `Il problema è: ${style.why}.` : 'Si allontana dal vintage nordico.');
  } else if (twin) {
    kind = 'no';
    title = 'Ce l\'hai già, quasi uguale';
    reasons.push(`Assomiglia troppo a: ${twin.name}.`);
  } else if (ownedCount < 6) {
    kind = style.fit >= 0.68 ? 'si' : 'forse';
    title = style.fit >= 0.68 ? 'Nel tuo stile' : 'Neutro: si abbina';
    reasons.push('Inserisci i tuoi capi e ti dico anche quanti outfit ci fai.');
  } else if (gain.accessory) {
    kind = added ? 'si' : 'forse';
    title = added ? 'Compralo' : 'Ne hai già uno';
    reasons.push(added ? 'Ti manca e si abbina a tutto.' : 'Prendilo solo se ti piace di più di quello che hai.');
  } else {
    const strong = Math.max(8, 0.15 * before);
    if (filled || added >= strong) {
      kind = 'si';
      title = 'Compralo';
    } else if (added >= 3) {
      kind = 'forse';
      title = 'Forse: solo se costa poco';
    } else {
      kind = 'no';
      title = 'Non ne vale la pena';
    }
    reasons.push(added === 1 ? 'Con i tuoi capi fa 1 outfit buono nuovo.' : `Con i tuoi capi fa ${added} outfit buoni nuovi.`);
    if (filled) reasons.push(`Per i ${filled.label} oggi non hai quasi niente di buono: questo li copre.`);
    else if (before && added) reasons.push(`Gli outfit buoni che puoi fare aumentano del ${Math.round((100 * added) / before)}%.`);
  }
  if (kind !== 'no' && style.fit >= 0.68) reasons.push('È pienamente nel tuo stile.');

  if (price && kind !== 'no' && !gain.accessory && ownedCount >= 6) {
    const share = Math.min(0.6, added / Math.max(1, before + added));
    const wears = Math.max(5, Math.round(150 * share));
    reasons.push(`Stima: circa ${wears} utilizzi l'anno, ${(price / wears).toFixed(price / wears < 10 ? 1 : 0)} ${currency} a utilizzo.`);
  }
  return { kind, title, reasons, styleText: styleLabel(style.fit), twin };
}

// Classifica dei capi da comprare: lista dei desideri più la capsule ideale non ancora coperta.
export function shoppingList(items, capsule) {
  const traits = traitCache();
  const owned = items.filter(usable);
  const base = goodSets(owned, traits);
  const wished = items.filter((it) => it.status === 'desiderato');
  const fromCapsule = capsule
    .filter((c) => !similarOwned(c, owned) && !wished.some((w) => w.templateId === c.id) && !items.some((it) => it.id === c.id))
    .map((c) => ({ ...c, template: true }));
  return [...wished, ...fromCapsule]
    .map((c) => gainOf(c, owned, CORE_SLOTS.includes(slotOf(c)) ? base : null))
    .sort((a, b) => b.value - a.value);
}
