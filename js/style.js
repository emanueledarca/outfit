// Gusto: quanto un capo è nello stile scelto e quanto un outfit sta bene insieme.
// Nessuna dipendenza dal DOM: si testa con `node --test tests/`.

// Stile di arrivo, scelto il 2026-10-20: "vintage nordico" più un lato comodo skate.
export const TARGET_BRIEF = [
  'vintage nordico: tweed, velluto a coste, lana, maglie grosse, denim scuro, workwear e field jacket, stivaletti in pelle;',
  'palette marrone, cammello, panna, avena, oliva, blu navy, grigio, antracite;',
  'pantaloni ampi o dritti; lato comodo skate: felpe, jeans baggy, scarpe da skate in camoscio.',
  'Da evitare: capi aderenti, pantaloni skinny, loghi grandi, sportivo da palestra.',
].join(' ');

// Famiglie di stile e quanto ciascuna appartiene allo stile di arrivo.
export const FAMILIES = {
  vintage:  { label: 'Vintage',  target: 1 },
  workwear: { label: 'Workwear', target: 1 },
  nordico:  { label: 'Nordico',  target: 1 },
  skate:    { label: 'Skate',    target: 0.75 },
  minimal:  { label: 'Minimal',  target: 0.65 },
  tecnico:  { label: 'Tecnico',  target: 0.5 },
  formale:  { label: 'Formale',  target: 0.45 },
  sportivo: { label: 'Sportivo', target: 0.1 },
};

// Quanto due famiglie stanno bene nello stesso outfit (simmetrica, 1 = sempre).
const COMPAT = {
  'vintage|workwear': 1, 'vintage|nordico': 1, 'workwear|nordico': 1,
  'vintage|skate': 0.45, 'workwear|skate': 0.8, 'nordico|skate': 0.75,
  'vintage|minimal': 0.85, 'workwear|minimal': 0.85, 'nordico|minimal': 0.85, 'skate|minimal': 0.85,
  'vintage|tecnico': 0.35, 'workwear|tecnico': 0.6, 'nordico|tecnico': 0.75, 'skate|tecnico': 0.75, 'minimal|tecnico': 0.75,
  'vintage|formale': 0.85, 'workwear|formale': 0.5, 'nordico|formale': 0.6, 'skate|formale': 0.1, 'minimal|formale': 0.85, 'tecnico|formale': 0.15,
  'vintage|sportivo': 0.15, 'workwear|sportivo': 0.3, 'nordico|sportivo': 0.35, 'skate|sportivo': 0.7, 'minimal|sportivo': 0.6,
  'tecnico|sportivo': 0.8, 'formale|sportivo': 0,
};
export function familyCompat(a, b) {
  if (a === b) return 1;
  return COMPAT[`${a}|${b}`] ?? COMPAT[`${b}|${a}`] ?? 0.5;
}

// Tessuti. texture: 0 liscio, 1 medio, 2 materico.
export const FABRICS = {
  lana:     { label: 'Lana',            texture: 2 },
  tweed:    { label: 'Tweed',           texture: 2 },
  maglia:   { label: 'Maglia grossa',   texture: 2 },
  velluto:  { label: 'Velluto a coste', texture: 2 },
  sherpa:   { label: 'Pile o sherpa',   texture: 2 },
  camoscio: { label: 'Camoscio',        texture: 2 },
  denim:    { label: 'Denim',           texture: 1 },
  felpa:    { label: 'Felpa',           texture: 1 },
  flanella: { label: 'Flanella',        texture: 1 },
  lino:     { label: 'Lino',            texture: 1 },
  cotone:   { label: 'Cotone liscio',   texture: 0 },
  pelle:    { label: 'Pelle',           texture: 0 },
  tecnico:  { label: 'Tecnico (nylon)', texture: 0 },
};

// Dal nome e dalla composizione, quando Gemini non c'è.
const FABRIC_HINTS = [
  [/tweed|spigat|herringbone/i, 'tweed'],
  [/velluto|corduroy|coste/i, 'velluto'],
  [/sherpa|pile|fleece|teddy/i, 'sherpa'],
  [/camoscio|suede|scamosciat|nabuk/i, 'camoscio'],
  [/denim|jeans/i, 'denim'],
  [/flanella|flannel/i, 'flanella'],
  [/islandese|trecce|cable|chunky|grosso/i, 'maglia'],
  [/lana|wool|cashmere|merino|alpaca|mohair/i, 'lana'],
  [/felpa|hoodie|sweatshirt/i, 'felpa'],
  [/lino|linen/i, 'lino'],
  [/nylon|poliestere|polyester|gore|tecnic|shell|impermeabil/i, 'tecnico'],
  [/pelle|leather/i, 'pelle'],
];

export function guessFabric(it, fallback) {
  const text = `${it.name ?? ''} ${it.composition ?? ''} ${it.descriptionEn ?? ''}`;
  for (const [re, fabric] of FABRIC_HINTS) if (re.test(text)) return fabric;
  return fallback;
}

// Volume: 1 aderente (scarpa slanciata), 2 regolare, 3 ampio (scarpa robusta).
const VOLUME_HINTS = [
  [/skinny|slim|aderent|stretto|attillat/i, 1],
  [/ampi|larg|baggy|wide|oversize|relaxed|loose|chunky|robust|carrarmato/i, 3],
];
export function guessVolume(it, fallback = 2) {
  const text = `${it.name ?? ''} ${it.descriptionEn ?? ''}`;
  for (const [re, v] of VOLUME_HINTS) if (re.test(text)) return v;
  return fallback;
}

export const VOLUME_LABELS = {
  shoes: ['slanciata', 'media', 'robusta'],
  other: ['aderente', 'regolare', 'ampio'],
};

// ---------- colore ----------

function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

// OKLab: distanze e luminosità vicine a come le percepisce l'occhio.
export function oklab([r, g, b]) {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export const deltaE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

// Gruppi di tinta per riconoscere il tono su tono.
export const COLOR_GROUP = {
  marrone: 'terra', 'testa di moro': 'terra', cammello: 'terra', beige: 'terra', avena: 'terra', panna: 'terra', ruggine: 'terra',
  nero: 'grigi', antracite: 'grigi', grigio: 'grigi', 'grigio chiaro': 'grigi', bianco: 'grigi',
  'blu navy': 'blu', indaco: 'blu', azzurro: 'blu',
  oliva: 'verdi', 'verde bosco': 'verdi',
  bordeaux: 'rossi', rosso: 'rossi', rosa: 'rossi',
  arancione: 'caldi', giallo: 'caldi', viola: 'viola',
};

// Quanto un colore sta nella palette dello stile di arrivo.
const PALETTE = {
  marrone: 1, 'testa di moro': 1, cammello: 1, beige: 0.9, avena: 1, panna: 1, oliva: 1, 'blu navy': 1, indaco: 1,
  grigio: 0.9, antracite: 1, 'grigio chiaro': 0.85, nero: 0.8, bianco: 0.8, 'verde bosco': 0.85, ruggine: 0.85, bordeaux: 0.75,
  azzurro: 0.6, rosso: 0.3, arancione: 0.3, giallo: 0.3, rosa: 0.25, viola: 0.3,
};
export const paletteFit = (color) => PALETTE[color] ?? 0.6;

// ---------- capo ----------

// Valori predefiniti per categoria; rules.js li unisce a CATEGORIES.
export const CATEGORY_STYLE = {
  cappotto:  { fabric: 'lana',    families: ['vintage'] },
  giacca:    { fabric: 'cotone',  families: ['workwear'] },
  blazer:    { fabric: 'lana',    families: ['formale', 'vintage'] },
  parka:     { fabric: 'tecnico', families: ['nordico', 'tecnico'] },
  maglione:  { fabric: 'lana',    families: ['nordico'] },
  dolcevita: { fabric: 'lana',    families: ['vintage'] },
  cardigan:  { fabric: 'lana',    families: ['vintage'] },
  overshirt: { fabric: 'cotone',  families: ['workwear'] },
  gilet:     { fabric: 'lana',    families: ['vintage'] },
  pile:      { fabric: 'sherpa',  families: ['nordico', 'tecnico'] },
  felpa:     { fabric: 'felpa',   families: ['skate'] },
  camicia:   { fabric: 'cotone',  families: ['workwear'] },
  polo:      { fabric: 'cotone',  families: ['minimal'] },
  tshirt:    { fabric: 'cotone',  families: ['minimal'] },
  pantalone: { fabric: 'cotone',  families: ['vintage'] },
  jeans:     { fabric: 'denim',   families: ['workwear'] },
  shorts:    { fabric: 'cotone',  families: ['minimal'] },
  scarpe:    { fabric: 'pelle',   families: ['vintage'] },
  sneakers:  { fabric: 'cotone',  families: ['minimal'] },
  stivali:   { fabric: 'pelle',   families: ['workwear'] },
  sciarpa:   { fabric: 'lana',    families: ['nordico'] },
  berretto:  { fabric: 'lana',    families: ['nordico'] },
  guanti:    { fabric: 'lana',    families: ['nordico'] },
};

const TOP_SLOTS = new Set(['mid', 'base']);

// Quanto un capo è nello stile di arrivo, da 0 a 1, con il motivo principale.
export function styleFitOf(it, slot) {
  const families = it.families?.length ? it.families : CATEGORY_STYLE[it.category]?.families ?? ['minimal'];
  const fabric = it.fabric ?? guessFabric(it, CATEGORY_STYLE[it.category]?.fabric ?? 'cotone');
  const fam = Math.max(...families.map((f) => FAMILIES[f]?.target ?? 0.5));
  const pal = paletteFit(it.color);
  const tex = (FABRICS[fabric]?.texture ?? 0) / 2;
  let fit = 0.5 * fam + 0.4 * pal + 0.1 * tex + 0.05;
  if (pal < 0.5) fit *= 0.7;
  const volume = it.volume ?? guessVolume(it);
  let why = null;
  if (slot === 'bottom' && volume === 1) { fit *= 0.35; why = 'pantalone aderente'; }
  if (TOP_SLOTS.has(slot) && volume === 1) { fit *= 0.6; why = 'maglia aderente'; }
  if (it.logo) { fit *= 0.55; why ??= 'logo in vista'; }
  if (Number.isFinite(it.styleScore)) fit = 0.5 * fit + 0.5 * ((it.styleScore - 1) / 4);
  if (!why) {
    if (fam < 0.4) why = `stile ${FAMILIES[families[0]]?.label.toLowerCase() ?? 'diverso'}`;
    else if (pal < 0.5) why = `colore ${it.color}`;
  }
  return { fit: Math.max(0, Math.min(1, fit)), why: it.styleWhy || why };
}

export function styleLabel(fit) {
  if (fit >= 0.68) return 'nel tuo stile';
  if (fit >= 0.45) return 'neutro, si abbina';
  return 'fuori dal tuo stile';
}

// Tratti di un capo usati nei calcoli, ricavati una volta sola.
export function traitsOf(it, slot, colorRgb) {
  const rgb = it.rgb ?? colorRgb(it.color) ?? [150, 150, 150];
  const families = it.families?.length ? it.families : CATEGORY_STYLE[it.category]?.families ?? ['minimal'];
  const fabric = it.fabric ?? guessFabric(it, CATEGORY_STYLE[it.category]?.fabric ?? 'cotone');
  const volume = it.volume ?? guessVolume(it, slot === 'shoes' && it.category === 'stivali' ? 3 : 2);
  const { fit } = styleFitOf({ ...it, families, fabric, volume }, slot);
  return { lab: oklab(rgb), families, fabric, texture: FABRICS[fabric]?.texture ?? 0, volume, styleFit: fit, group: COLOR_GROUP[it.color] ?? null };
}

// ---------- outfit ----------

// Punteggio estetico di un outfit (circa da -5 a +3) e note leggibili.
// pieces: [{ it, slot, t }] con t = traitsOf(...). accentOf(it) dice se il colore è un accento.
export function aesthetic(pieces, accentOf) {
  let score = 0;
  const notes = [];
  const clothes = pieces.filter((p) => p.slot !== 'shoes');
  const bottom = pieces.find((p) => p.slot === 'bottom');
  const shoes = pieces.find((p) => p.slot === 'shoes');
  const tops = pieces.filter((p) => TOP_SLOTS.has(p.slot));

  // Colore: un solo accento, contrasto voluto o tono su tono, niente "quasi uguali".
  const accents = pieces.filter((p) => accentOf(p.it)).length;
  score -= 1.5 * Math.max(0, accents - 1);

  const Ls = clothes.map((p) => p.t.lab.L);
  const spread = Ls.length ? Math.max(...Ls) - Math.min(...Ls) : 0;
  const groups = new Set(clothes.map((p) => p.t.group));
  const tonal = clothes.length >= 2 && groups.size === 1 && !groups.has(null) && !groups.has('grigi');
  if (tonal && spread >= 0.1) {
    score += 0.9;
    notes.push('Tono su tono');
  } else if (spread >= 0.3) {
    score += 0.6;
    notes.push('Contrasto chiaro e scuro');
  } else if (spread < 0.08 && clothes.length >= 2) {
    score -= 0.6;
  }

  let nearMiss = 0;
  for (let i = 0; i < clothes.length; i++) {
    for (let j = i + 1; j < clothes.length; j++) {
      const a = clothes[i];
      const b = clothes[j];
      // Due scuri di famiglie diverse (nero e blu navy) sembrano un abbinamento sbagliato.
      const d = deltaE(a.t.lab, b.t.lab);
      const dark = a.t.lab.L < 0.4 && b.t.lab.L < 0.4 && Math.abs(a.t.lab.L - b.t.lab.L) < 0.1;
      if (a.t.group !== b.t.group && (dark || (d > 0.02 && d < 0.065))) nearMiss += 1;
      if (a.t.fabric === 'denim' && b.t.fabric === 'denim' && Math.abs(a.t.lab.L - b.t.lab.L) < 0.15) score -= 1.2;
    }
  }
  score -= 0.6 * Math.min(2, nearMiss);

  // Proporzioni: niente skinny, niente maglie strette, pantalone ampio con scarpa robusta.
  if (bottom) {
    if (bottom.t.volume === 1) score -= 1.5;
    if (bottom.t.volume === 3 && shoes?.t.volume === 1) score -= 1;
    if (bottom.t.volume === 3 && shoes?.t.volume === 3) {
      score += 0.3;
      notes.push('Pantalone ampio su scarpa robusta');
    }
    const top = tops[0];
    const bothSkate = top && top.t.families.includes('skate') && bottom.t.families.includes('skate');
    if (top && top.t.volume === 3 && bottom.t.volume === 3 && !bothSkate) score -= 0.5;
  }
  for (const p of tops) if (p.t.volume === 1) score -= 0.8;

  // Texture: almeno un tessuto materico accanto a uno più liscio.
  const textures = new Set(clothes.map((p) => p.t.texture));
  if (textures.has(2) && textures.size >= 2) {
    score += 0.5;
    const rich = clothes.filter((p) => p.t.texture === 2).map((p) => FABRICS[p.t.fabric]?.label.toLowerCase());
    notes.push(`Texture: ${[...new Set(rich)].slice(0, 2).join(' e ')}`);
  }

  // Coerenza di stile fra tutti i capi.
  let compat = 0;
  let pairs = 0;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      let best = 0;
      for (const fa of pieces[i].t.families) for (const fb of pieces[j].t.families) best = Math.max(best, familyCompat(fa, fb));
      compat += best;
      pairs += 1;
    }
  }
  if (pairs) score += 2.5 * (compat / pairs - 0.75);

  // Quanto l'insieme assomiglia allo stile di arrivo.
  const fit = pieces.reduce((t, p) => t + p.t.styleFit, 0) / (pieces.length || 1);
  score += 3 * (fit - 0.6);

  return { score, notes, styleFit: fit };
}
