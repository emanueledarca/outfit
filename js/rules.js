// Regole del guardaroba e scelta dell'outfit del giorno.
// Nessuna dipendenza dal DOM: si testa con `node --test tests/`.

export const SLOTS = ['outer', 'mid', 'base', 'bottom', 'shoes', 'scarf', 'hat', 'gloves'];
export const CORE_SLOTS = ['outer', 'mid', 'base', 'bottom', 'shoes'];

// washAfter: utilizzi prima di finire "a lavare" (null = mai in automatico).
export const CATEGORIES = {
  cappotto:  { label: 'Cappotto',  slot: 'outer',  warmth: 5, formality: 4, washAfter: null },
  giacca:    { label: 'Giacca',    slot: 'outer',  warmth: 3, formality: 3, washAfter: null },
  parka:     { label: 'Parka',     slot: 'outer',  warmth: 5, formality: 2, washAfter: null, waterproof: true },
  maglione:  { label: 'Maglione',  slot: 'mid',    warmth: 3, formality: 3, washAfter: 4 },
  dolcevita: { label: 'Dolcevita', slot: 'mid',    warmth: 3, formality: 4, washAfter: 4 },
  cardigan:  { label: 'Cardigan',  slot: 'mid',    warmth: 2, formality: 3, washAfter: 4 },
  felpa:     { label: 'Felpa',     slot: 'mid',    warmth: 2, formality: 1, washAfter: 3 },
  camicia:   { label: 'Camicia',   slot: 'base',   warmth: 1, formality: 3, washAfter: 2 },
  tshirt:    { label: 'T-shirt',   slot: 'base',   warmth: 1, formality: 2, washAfter: 1 },
  pantalone: { label: 'Pantalone', slot: 'bottom', warmth: 2, formality: 4, washAfter: 5 },
  jeans:     { label: 'Jeans',     slot: 'bottom', warmth: 2, formality: 2, washAfter: 8 },
  scarpe:    { label: 'Scarpe',    slot: 'shoes',  warmth: 1, formality: 2, washAfter: null },
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
export const fearsRain = (it) => FEARS_RAIN.test(`${it.name ?? ''} ${it.composition ?? ''}`);

export const pairKey = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);

// "Stesso outfit" = stessi capi dal capospalla in giù; le scarpe possono ripetersi.
export function signatureOf(outfit) {
  return ['outer', 'mid', 'base', 'bottom'].map((s) => outfit[s]?.id ?? '-').join('|');
}

export function outfitItems(outfit) {
  return SLOTS.map((s) => outfit[s]).filter(Boolean);
}

// Livello di calore richiesto dalla temperatura percepita di giorno.
export function weatherNeed(w) {
  if (!w) return { level: 2, wet: false, snow: false, temp: null };
  const t = 0.7 * w.appMax + 0.3 * w.appMin;
  const level = t >= 18 ? 0 : t >= 12 ? 1 : t >= 5 ? 2 : t >= -3 ? 3 : 4;
  const snow = (w.snow ?? 0) > 0;
  const wet = snow || (w.precipProb ?? 0) >= 50 || (w.precipSum ?? 0) >= 1;
  return { level, wet, snow, temp: Math.round(t) };
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

function* combinations(by, need) {
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

  for (const outer of outers) {
    for (const mid of mids) {
      if (need.level === 1 && !outer && !mid) continue;
      // Sotto un maglione la maglietta non si vede: la si propone solo da sola o sotto un cardigan.
      const bases = !mid || mid.category === 'cardigan' ? by.base : [null];
      for (const base of bases) {
        if (!mid && !base) continue;
        for (const bottom of by.bottom) {
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

function scoreOutfit(o, ctx) {
  const { need, last, today, votes, target } = ctx;
  const core = CORE_SLOTS.map((s) => o[s]).filter(Boolean);
  const since = (it) => (last.has(it.id) ? Math.min(14, daysBetween(last.get(it.id), today)) : 14);
  let score = 0;

  // Rotazione: conta soprattutto per le maglie, poco per capospalla e scarpe.
  const weight = { outer: 0.3, mid: 1, base: 1, bottom: 0.5, shoes: 0.3 };
  for (const s of CORE_SLOTS) if (o[s]) score += weight[s] * (since(o[s]) / 14) * 3;

  const warmth = ['outer', 'mid', 'base'].reduce((t, s) => t + (o[s] ? warmthOf(o[s]) : 0), 0);
  score -= 0.4 * Math.abs(warmth - TARGET_WARMTH[need.level]);

  const forms = core.map(formalityOf);
  const avg = forms.reduce((a, b) => a + b, 0) / forms.length;
  score -= 0.6 * Math.abs(avg - target);
  score -= 0.5 * Math.max(0, Math.max(...forms) - Math.min(...forms) - 2);

  if (need.wet) {
    if (o.outer && isWaterproof(o.outer)) score += 2;
    if (isWaterproof(o.shoes)) score += 1.5;
    for (const it of core) if (fearsRain(it)) score -= 2;
  }
  if (need.level === 0 && o.shoes.category === 'stivali') score -= 1;

  const accents = core.filter((it) => it.color && !NEUTRALS.has(it.color)).length;
  score -= 1.5 * Math.max(0, accents - 1);

  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) score += 0.8 * (votes[pairKey(core[i].id, core[j].id)] ?? 0);
  }
  return score + 0.6 * hash01(`${today}|${signatureOf(o)}`);
}

function reasonsFor(o, ctx) {
  const { need, last, today, votes } = ctx;
  const reasons = [];
  if (need.snow && o.outer) reasons.push(`Neve: ${o.outer.name.toLowerCase()} e ${o.shoes.name.toLowerCase()}`);
  else if (need.wet && o.outer && isWaterproof(o.outer)) reasons.push(`Pioggia: ${o.outer.name.toLowerCase()}`);
  else if (need.temp != null && need.level >= 3) reasons.push(`${need.temp}° percepiti: tre strati`);

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
  return reasons.slice(0, 2);
}

// Restituisce gli outfit possibili per `today`, dal migliore.
// ctx: { today, weather, occasion, log, votes, disliked, noRepeatDays }
//   log: [{ date, itemIds, signature }], votes: { "a+b": n }, disliked: { signature: date }
export function suggestOutfits(items, ctx) {
  const { today, weather, occasion = 'lab', log = [], votes = {}, disliked = {}, noRepeatDays = 14 } = ctx;
  const need = weatherNeed(weather);
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
  const sctx = { need, last, today, votes, target };

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
      .map((o) => ({ ...o, score: scoreOutfit(o, sctx) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((o) => {
        const full = { ...o };
        if (need.level >= 3) full.scarf = pickAccessory(by.scarf, last, today);
        if (need.level >= 4 || (need.level >= 3 && need.snow)) full.hat = pickAccessory(by.hat, last, today);
        if (need.level >= 4) full.gloves = pickAccessory(by.gloves, last, today);
        return { ...full, signature: signatureOf(full), reasons: reasonsFor(full, sctx) };
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
