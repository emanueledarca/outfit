// Regole del guardaroba e scelta dell'outfit del giorno.
// Nessuna dipendenza dal DOM: si testa con `node --test tests/`.

import { aesthetic, traitsOf } from './style.js';

export const SLOTS = ['outer', 'mid', 'base', 'bottom', 'shoes', 'scarf', 'hat', 'gloves'];
export const CORE_SLOTS = ['outer', 'mid', 'base', 'bottom', 'shoes'];

// washAfter: utilizzi prima di finire "a lavare" (null = mai in automatico).
// open: sotto si vede la maglia (cardigan, overshirt, gilet).
export const CATEGORIES = {
  cappotto:  { label: 'Cappotto',  slot: 'outer',  warmth: 5, formality: 4, washAfter: null },
  giacca:    { label: 'Giacca',    slot: 'outer',  warmth: 3, formality: 3, washAfter: null },
  blazer:    { label: 'Blazer',    slot: 'outer',  warmth: 2, formality: 4, washAfter: null },
  parka:     { label: 'Parka',     slot: 'outer',  warmth: 5, formality: 2, washAfter: null, waterproof: true },
  maglione:  { label: 'Maglione',  slot: 'mid',    warmth: 3, formality: 3, washAfter: 4 },
  dolcevita: { label: 'Dolcevita', slot: 'mid',    warmth: 3, formality: 4, washAfter: 4 },
  cardigan:  { label: 'Cardigan',  slot: 'mid',    warmth: 2, formality: 3, washAfter: 4, open: true },
  overshirt: { label: 'Overshirt', slot: 'mid',    warmth: 2, formality: 2, washAfter: 4, open: true },
  gilet:     { label: 'Gilet',     slot: 'mid',    warmth: 2, formality: 3, washAfter: 5, open: true },
  pile:      { label: 'Pile',      slot: 'mid',    warmth: 3, formality: 1, washAfter: 4 },
  felpa:     { label: 'Felpa',     slot: 'mid',    warmth: 2, formality: 1, washAfter: 3 },
  camicia:   { label: 'Camicia',   slot: 'base',   warmth: 1, formality: 3, washAfter: 2 },
  polo:      { label: 'Polo',      slot: 'base',   warmth: 1, formality: 2, washAfter: 1 },
  tshirt:    { label: 'T-shirt',   slot: 'base',   warmth: 1, formality: 2, washAfter: 1 },
  pantalone: { label: 'Pantalone', slot: 'bottom', warmth: 2, formality: 4, washAfter: 5 },
  jeans:     { label: 'Jeans',     slot: 'bottom', warmth: 2, formality: 2, washAfter: 8 },
  shorts:    { label: 'Shorts',    slot: 'bottom', warmth: 0, formality: 1, washAfter: 3 },
  scarpe:    { label: 'Scarpe',    slot: 'shoes',  warmth: 1, formality: 3, washAfter: null },
  sneakers:  { label: 'Sneakers',  slot: 'shoes',  warmth: 1, formality: 1, washAfter: null },
  stivali:   { label: 'Stivali',   slot: 'shoes',  warmth: 2, formality: 3, washAfter: null, waterproof: true },
  sciarpa:   { label: 'Sciarpa',   slot: 'scarf',  warmth: 1, formality: 3, washAfter: null },
  berretto:  { label: 'Berretto',  slot: 'hat',    warmth: 1, formality: 2, washAfter: null },
  guanti:    { label: 'Guanti',    slot: 'gloves', warmth: 1, formality: 2, washAfter: null },
};

export const STATES = {
  disponibile: 'Disponibile',
  lavare: 'A lavare',
  rovinato: 'Rovinato',
  stagione: 'Fuori stagione',
  desiderato: 'Da comprare',
};

export const OCCASIONS = {
  lab: { label: 'Lab', formality: 3 },
  uscita: { label: 'Uscita', formality: 4 },
  relax: { label: 'Relax', formality: 2 },
};

// [nome, rgb, neutro]. I neutri si abbinano a tutto; gli altri sono colori d'accento.
export const COLORS = [
  ['nero', [25, 25, 25], true],
  ['bianco', [245, 245, 240], true],
  ['grigio chiaro', [190, 190, 188], true],
  ['grigio', [128, 128, 128], true],
  ['antracite', [60, 60, 62], true],
  ['panna', [236, 228, 212], true],
  ['avena', [214, 200, 176], true],
  ['beige', [200, 180, 150], true],
  ['cammello', [176, 136, 90], true],
  ['marrone', [110, 80, 55], true],
  ['testa di moro', [70, 48, 36], true],
  ['blu navy', [30, 40, 70], true],
  ['indaco', [45, 60, 100], true],
  ['oliva', [100, 105, 60], true],
  ['verde bosco', [40, 70, 45], false],
  ['azzurro', [130, 170, 210], false],
  ['bordeaux', [100, 30, 40], false],
  ['ruggine', [160, 75, 40], false],
  ['rosso', [190, 40, 40], false],
  ['arancione', [230, 130, 40], false],
  ['giallo', [230, 200, 60], false],
  ['rosa', [230, 160, 170], false],
  ['viola', [110, 70, 140], false],
];
export const NEUTRALS = new Set(COLORS.filter((c) => c[2]).map((c) => c[0]));
export const isAccent = (it) => Boolean(it.color) && !NEUTRALS.has(it.color);
export const COLOR_RGB = Object.fromEntries(COLORS.map(([name, rgb]) => [name, rgb]));

// Distanza "redmean": approssima la percezione meglio dell'euclidea in RGB.
export function nearestColorName([r, g, b]) {
  let best = COLORS[0][0];
  let bestD = Infinity;
  for (const [name, [r2, g2, b2]] of COLORS) {
    const rm = (r + r2) / 2;
    const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

export function isoDay(d = new Date()) {
  return d.toLocaleDateString('sv-SE');
}

export function daysBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export const categoryOf = (it) => CATEGORIES[it.category] ?? CATEGORIES.tshirt;
export const slotOf = (it) => categoryOf(it).slot;
export const warmthOf = (it) => it.warmth ?? categoryOf(it).warmth;
export const formalityOf = (it) => it.formality ?? categoryOf(it).formality;
export const isWaterproof = (it) => it.waterproof ?? Boolean(categoryOf(it).waterproof);
export const washAfterOf = (it, thresholds = {}) =>
  it.washAfter ?? thresholds[it.category] ?? categoryOf(it).washAfter;

// Una persona non mette il camoscio sotto la pioggia.
const FEARS_RAIN = /camoscio|suede|nabuk|scamosciat/i;
export const fearsRain = (it) => it.fabric === 'camoscio' || FEARS_RAIN.test(`${it.name ?? ''} ${it.composition ?? ''}`);

// Col vento conta che il capospalla non lasci passare l'aria.
export const isWindproof = (it) => isWaterproof(it) || ['cappotto', 'parka'].includes(it.category) || ['tecnico', 'pelle'].includes(it.fabric);

export const pairKey = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);

// "Stesso outfit" = stessi capi dal capospalla in giù; le scarpe possono ripetersi.
export function signatureOf(outfit) {
  return ['outer', 'mid', 'base', 'bottom'].map((s) => outfit[s]?.id ?? '-').join('|');
}

export function outfitItems(outfit) {
  return SLOTS.map((s) => outfit[s]).filter(Boolean);
}

// Vento forte (km/h): l'ombrello non regge e sciarpa e berretto servono prima.
export const WINDY = { wind: 30, gust: 50 };

// Livello di calore richiesto. Con le previsioni orarie (w.commute) conta il tragitto:
// il capospalla deve reggere il momento più freddo fra uscita e rientro.
// coldBias: gradi da togliere per chi soffre il freddo (negativo per chi non lo sente).
// La temperatura percepita di Open-Meteo tiene già conto del vento.
export function weatherNeed(w, { coldBias = 0 } = {}) {
  if (!w) return { level: 2, wet: false, snow: false, snowGround: false, windy: false, deep: false, wind: 0, temp: null };
  const c = w.commute;
  const t = (c
    ? 0.6 * Math.min(c.outApp, c.backApp) + 0.4 * Math.max(c.outApp, c.backApp)
    : 0.7 * w.appMax + 0.3 * w.appMin) - coldBias;
  const level = t >= 18 ? 0 : t >= 12 ? 1 : t >= 5 ? 2 : t >= -3 ? 3 : 4;
  // Sotto i -10 percepiti, l'inverno di Stoccolma vero: tutto coperto, stivali.
  const deep = t < -10;
  const wind = c ? c.wind ?? 0 : w.windMax ?? 0;
  const gust = c ? c.gust ?? 0 : w.gustMax ?? 0;
  const windy = wind >= WINDY.wind || gust >= WINDY.gust;
  const snowGround = Boolean(c && c.snowDepth > 0.01);
  const snow = (c ? c.snowfall > 0 : (w.snow ?? 0) > 0) || snowGround;
  const rainy = c
    ? c.precipProb >= 50 || c.precip >= 0.3 || (w.precipProb ?? 0) >= 80 || (w.precipSum ?? 0) >= 4
    : (w.precipProb ?? 0) >= 50 || (w.precipSum ?? 0) >= 1;
  return { level, wet: snow || rainy, snow, snowGround, windy, deep, wind: Math.round(Math.max(wind, gust * 0.6)), temp: Math.round(t) };
}

const TARGET_WARMTH = [1, 3, 6, 8, 10];

function lastWornMap(log) {
  const last = new Map();
  for (const e of log) {
    for (const id of e.itemIds) if (!last.has(id) || last.get(id) < e.date) last.set(id, e.date);
  }
  return last;
}

function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function* combinations(by, need) {
  const minOuter = need.level >= 4 ? 5 : need.level === 3 ? 4 : 3;
  let outers;
  if (need.level === 0) outers = [null, ...by.outer.filter((o) => warmthOf(o) <= 3)];
  else if (need.level === 1) outers = [null, ...by.outer];
  else {
    const warm = by.outer.filter((o) => warmthOf(o) >= minOuter);
    outers = warm.length ? warm : by.outer;
  }
  if (!outers.length) outers = [null];
  const mids = need.level >= 2 && by.mid.length ? by.mid : need.level >= 1 ? [null, ...by.mid] : [null];
  const bottoms = by.bottom.filter((b) => (b.category === 'shorts' ? need.level === 0 : true));

  for (const outer of outers) {
    for (const mid of mids) {
      if (need.level === 1 && !outer && !mid) continue;
      // Sotto un maglione la maglietta non si vede: la si propone da sola o sotto un capo aperto.
      const bases = !mid || categoryOf(mid).open ? by.base : [null];
      for (const base of bases) {
        if (!mid && !base) continue;
        if (mid && categoryOf(mid).open && !base) continue;
        for (const bottom of bottoms) {
          for (const shoes of by.shoes) yield { outer, mid, base, bottom, shoes };
        }
      }
    }
  }
}

function missingSlots(by, need) {
  const missing = [];
  if (!by.bottom.length) missing.push('pantaloni');
  if (!by.shoes.length) missing.push('scarpe');
  if (!by.mid.length && !by.base.length) missing.push('una maglia');
  if (need.level >= 2 && !by.outer.length) missing.push('una giacca o un cappotto');
  return missing;
}

function pickAccessory(list, last, today) {
  if (!list.length) return null;
  const since = (it) => (last.has(it.id) ? daysBetween(last.get(it.id), today) : 99);
  return [...list].sort((a, b) => since(b) - since(a))[0];
}

// Tratti dei capi (colore, tessuto, volume, stile), calcolati una volta per capo.
export function traitCache() {
  const cache = new WeakMap();
  return (it) => {
    let t = cache.get(it);
    if (!t) {
      t = traitsOf(it, slotOf(it), (name) => COLOR_RGB[name]);
      cache.set(it, t);
    }
    return t;
  };
}

// Qualità di un outfit, senza rotazione né voti: gusto, meteo, formalità.
// È il numero che decide se un outfit è "buono" anche per gli acquisti.
export function qualityOf(o, { need, target, traits }) {
  const pieces = CORE_SLOTS.filter((s) => o[s]).map((s) => ({ it: o[s], slot: s, t: traits(o[s]) }));
  const core = pieces.map((p) => p.it);
  const look = aesthetic(pieces, isAccent);
  let q = 1.5 * look.score;

  const warmth = ['outer', 'mid', 'base'].reduce((t, s) => t + (o[s] ? warmthOf(o[s]) : 0), 0);
  q -= 0.4 * Math.abs(warmth - TARGET_WARMTH[need.level]);

  const forms = core.map(formalityOf);
  const avg = forms.reduce((a, b) => a + b, 0) / forms.length;
  q -= 0.6 * Math.abs(avg - target);
  q -= 0.5 * Math.max(0, Math.max(...forms) - Math.min(...forms) - 2);

  if (need.wet) {
    q += o.outer && isWaterproof(o.outer) ? 1 : -1;
    q += isWaterproof(o.shoes) ? 0.75 : -0.25;
    for (const it of core) if (fearsRain(it)) q -= 2;
  }
  if (need.level === 0 && o.shoes.category === 'stivali') q -= 1;

  if (need.windy && need.level >= 1) {
    if (o.outer) q += isWindproof(o.outer) ? 0.6 : -0.3;
    else if (o.mid && categoryOf(o.mid).open) q -= 0.8;
    // Pioggia col vento: l'ombrello non serve, conta il capospalla.
    if (need.wet && o.outer && !isWaterproof(o.outer)) q -= 0.7;
  }
  if (need.deep) {
    if (o.shoes.category !== 'stivali') q -= 1.2;
    if (o.outer && warmthOf(o.outer) < 5) q -= 1;
  }
  return { q, notes: look.notes, styleFit: look.styleFit };
}

// Sopra questa soglia un outfit conta come "buono".
export const GOOD_QUALITY = 1;

function scoreOutfit(o, ctx) {
  const { need, last, today, votes } = ctx;
  const core = CORE_SLOTS.map((s) => o[s]).filter(Boolean);
  const since = (it) => (last.has(it.id) ? Math.min(14, daysBetween(last.get(it.id), today)) : 14);
  const { q, notes } = qualityOf(o, ctx);
  let score = q;

  // Rotazione: conta soprattutto per le maglie, poco per capospalla e scarpe.
  const weight = { outer: 0.3, mid: 1, base: 1, bottom: 0.5, shoes: 0.3 };
  for (const s of CORE_SLOTS) if (o[s]) score += weight[s] * (since(o[s]) / 14) * 3;

  if (need.wet) {
    if (o.outer && isWaterproof(o.outer)) score += 1;
    if (isWaterproof(o.shoes)) score += 0.75;
  }

  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) score += 0.8 * (votes[pairKey(core[i].id, core[j].id)] ?? 0);
  }
  return { score: score + 0.6 * hash01(`${today}|${signatureOf(o)}`), quality: q, notes };
}

function reasonsFor(o, ctx, notes = []) {
  const { need, last, today, votes } = ctx;
  const reasons = [];
  if (need.snow && o.outer) reasons.push(`Neve: ${o.outer.name.toLowerCase()} e ${o.shoes.name.toLowerCase()}`);
  else if (need.wet && o.outer && isWaterproof(o.outer)) reasons.push(`Pioggia${need.windy ? ' e vento' : ''}: ${o.outer.name.toLowerCase()}${need.windy ? ', niente ombrello' : ''}`);
  else if (need.windy && o.outer && isWindproof(o.outer)) reasons.push(`Vento a ${need.wind} km/h: ${o.outer.name.toLowerCase()}${need.wet ? ', niente ombrello' : ''}`);
  else if (need.deep) reasons.push(`${need.temp}° percepiti: guanti, berretto e stivali`);
  else if (need.temp != null && need.level >= 3) reasons.push(`${need.temp}° percepiti nel tragitto: tre strati`);

  if (notes.length) reasons.push(notes[0]);

  const top = o.mid ?? o.base;
  if (top) {
    if (!last.has(top.id)) reasons.push(`${top.name}: primo utilizzo`);
    else {
      const d = daysBetween(last.get(top.id), today);
      if (d >= 5) reasons.push(`${top.name}: ultima volta ${d} giorni fa`);
    }
  }
  const core = CORE_SLOTS.map((s) => o[s]).filter(Boolean);
  const liked = core.some((a, i) => core.slice(i + 1).some((b) => (votes[pairKey(a.id, b.id)] ?? 0) > 0));
  if (liked) reasons.push('Abbinamento che ti è piaciuto');
  return reasons.slice(0, 3);
}

// Restituisce gli outfit possibili per `today`, dal migliore.
// ctx: { today, weather, occasion, log, votes, disliked, noRepeatDays, coldBias }
//   log: [{ date, itemIds, signature }], votes: { "a+b": n }, disliked: { signature: date }
export function suggestOutfits(items, ctx) {
  const { today, weather, occasion = 'lab', log = [], votes = {}, disliked = {}, noRepeatDays = 14 } = ctx;
  const need = weatherNeed(weather, { coldBias: ctx.coldBias ?? 0 });
  const available = items.filter((it) => (it.status ?? 'disponibile') === 'disponibile');
  const by = Object.fromEntries(SLOTS.map((s) => [s, available.filter((it) => slotOf(it) === s)]));
  const past = log.filter((e) => e.date < today);
  const last = lastWornMap(past);

  // Maglie (sopra e sotto) messe ieri: oggi no.
  const byId = new Map(items.map((it) => [it.id, it]));
  const yesterday = new Set(
    past
      .filter((e) => daysBetween(e.date, today) === 1)
      .flatMap((e) => e.itemIds)
      .filter((id) => ['mid', 'base'].includes(byId.get(id) && slotOf(byId.get(id)))),
  );
  const recent = past.map((e) => [e.signature, daysBetween(e.date, today)]);
  const blocked = new Set(
    Object.entries(disliked)
      .filter(([, date]) => daysBetween(date, today) < 30)
      .map(([sig]) => sig),
  );
  const target = (OCCASIONS[occasion] ?? OCCASIONS.lab).formality;
  const sctx = { need, last, today, votes, target, traits: ctx.traits ?? traitCache() };

  const attempts = [
    { repeatDays: noRepeatDays, yesterdayRule: true },
    { repeatDays: Math.min(7, noRepeatDays), yesterdayRule: true },
    { repeatDays: 2, yesterdayRule: true },
    { repeatDays: 0, yesterdayRule: false },
  ];
  for (const [i, rules] of attempts.entries()) {
    const out = [];
    for (const o of combinations(by, need)) {
      const sig = signatureOf(o);
      if (blocked.has(sig)) continue;
      if (recent.some(([s, d]) => s === sig && d <= rules.repeatDays)) continue;
      if (rules.yesterdayRule && ((o.mid && yesterday.has(o.mid.id)) || (o.base && yesterday.has(o.base.id)))) continue;
      if (CORE_SLOTS.filter((s) => o[s]?.pattern).length > 1) continue;
      out.push(o);
    }
    if (!out.length) continue;
    const ranked = out
      .map((o) => ({ o, ...scoreOutfit(o, sctx) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ o, score, quality, notes }) => {
        const full = { ...o, score, quality };
        if (need.level >= 3 || (need.level >= 2 && need.windy)) full.scarf = pickAccessory(by.scarf, last, today);
        if (need.level >= 4 || (need.level >= 3 && (need.snow || need.windy))) full.hat = pickAccessory(by.hat, last, today);
        if (need.level >= 4 || need.deep) full.gloves = pickAccessory(by.gloves, last, today);
        return { ...full, signature: signatureOf(full), reasons: reasonsFor(full, sctx, notes) };
      });
    return { need, relaxed: i > 0, outfits: ranked, missing: [] };
  }
  return { need, relaxed: false, outfits: [], missing: missingSlots(by, need) };
}

// Segna un utilizzo; i capi che raggiungono la soglia passano "a lavare".
export function applyWear(items, ids, thresholds = {}) {
  const moved = [];
  const updated = items
    .filter((it) => ids.includes(it.id))
    .map((it) => {
      const wears = (it.wearsSinceWash ?? 0) + 1;
      const next = { ...it, wearsSinceWash: wears, totalWears: (it.totalWears ?? 0) + 1 };
      const limit = washAfterOf(it, thresholds);
      if (limit && wears >= limit && (next.status ?? 'disponibile') === 'disponibile') {
        next.status = 'lavare';
        moved.push(next);
      }
      return next;
    });
  return { updated, moved };
}

export function undoWear(items, ids, thresholds = {}) {
  return items
    .filter((it) => ids.includes(it.id))
    .map((it) => {
      const wears = Math.max(0, (it.wearsSinceWash ?? 0) - 1);
      const next = { ...it, wearsSinceWash: wears, totalWears: Math.max(0, (it.totalWears ?? 0) - 1) };
      const limit = washAfterOf(it, thresholds);
      if (it.status === 'lavare' && limit && wears < limit) next.status = 'disponibile';
      return next;
    });
}

export function washed(it) {
  return { ...it, status: 'disponibile', wearsSinceWash: 0 };
}

// Voto su un outfit: rafforza o indebolisce ogni coppia di capi.
export function voteDelta(outfit, value) {
  const core = CORE_SLOTS.map((s) => outfit[s]).filter(Boolean);
  const deltas = {};
  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) deltas[pairKey(core[i].id, core[j].id)] = value;
  }
  return deltas;
}
