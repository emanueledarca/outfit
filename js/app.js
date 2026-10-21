import { db, setSetting } from './db.js';
import {
  CATEGORIES, STATES, OCCASIONS, COLORS, COLOR_RGB, SLOTS,
  suggestOutfits, applyWear, undoWear, washed, voteDelta, weatherNeed, isoDay, daysBetween,
  signatureOf, outfitItems, slotOf, categoryOf, warmthOf, formalityOf, isWaterproof, washAfterOf,
} from './rules.js';
import { fetchForecast, geocode, STOCKHOLM } from './weather.js';
import { analyzeGarment, testKey, MODELS } from './gemini.js';
import { resizeImage, makeThumb, dominantColor, blobToDataUrl, dataUrlToBlob, isCutout, imageFromClipboard } from './images.js';
import { buildSheet, tryOnPrompt, fixPrompt, PERSON_PLACEHOLDER, DEFAULT_RULES } from './sheet.js';
import { DEMO_ITEMS } from './demo.js';
import { h, icon, blobUrl, toast, openSheet, pickFile, copyText, shareOrDownload, formatDay } from './ui.js';

const S = {
  tab: 'oggi',
  items: [],
  log: [],
  votes: {},
  disliked: {},
  tryons: [],
  settings: {},
  forecast: null,
  weatherError: false,
  occasion: 'lab',
  pick: 0,
  override: null,
  filter: 'tutti',
  category: 'tutte',
  tryIds: null,
  version: 0,
};

const today = () => isoDay();
const place = () => S.settings.place ?? STOCKHOLM;
const thresholds = () => S.settings.washThresholds ?? {};
const byId = (id) => S.items.find((it) => it.id === id);
const todayWeather = () => S.forecast?.find((d) => d.date === today()) ?? null;
const todayLog = () => S.log.find((e) => e.id === today());
const changed = () => { S.version += 1; };

// ---------- dati ----------

async function load() {
  const [items, log, votes, tryons, settings] = await Promise.all(
    ['items', 'log', 'votes', 'tryons', 'settings'].map((s) => db.all(s)),
  );
  S.items = items.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  S.log = log.sort((a, b) => a.date.localeCompare(b.date));
  S.votes = Object.fromEntries(votes.filter((v) => !v.key.startsWith('sig:')).map((v) => [v.key, v.value]));
  S.disliked = Object.fromEntries(votes.filter((v) => v.key.startsWith('sig:')).map((v) => [v.key.slice(4), v.date]));
  S.tryons = tryons.sort((a, b) => b.createdAt - a.createdAt);
  S.settings = Object.fromEntries(settings.map((r) => [r.key, r.value]));
}

async function saveSetting(key, value) {
  S.settings[key] = value;
  await setSetting(key, value);
}

async function saveItems(list) {
  await db.putMany('items', list);
  for (const it of list) {
    const i = S.items.findIndex((x) => x.id === it.id);
    if (i >= 0) S.items[i] = it;
    else S.items.push(it);
  }
  changed();
}

async function loadWeather(force = false) {
  const p = place();
  const key = `${p.lat},${p.lon}`;
  const cache = S.settings.forecastCache;
  if (!force && cache?.key === key && Date.now() - cache.at < 3 * 3600e3) {
    S.forecast = cache.days;
    return;
  }
  try {
    const days = await fetchForecast(p);
    S.forecast = days;
    S.weatherError = false;
    await saveSetting('forecastCache', { key, at: Date.now(), days });
  } catch {
    S.forecast = cache?.key === key ? cache.days : null;
    S.weatherError = true;
  }
  changed();
}

// ---------- outfit ----------

let suggestionKey = null;
let suggestion = null;

function currentSuggestion() {
  const key = [today(), S.occasion, S.version, S.log.length].join('|');
  if (key !== suggestionKey) {
    suggestion = suggestOutfits(S.items, {
      today: today(),
      weather: todayWeather(),
      occasion: S.occasion,
      log: S.log,
      votes: S.votes,
      disliked: S.disliked,
      noRepeatDays: S.settings.noRepeatDays ?? 14,
    });
    suggestionKey = key;
    S.pick = 0;
    S.override = null;
  }
  return suggestion;
}

const shownOutfit = (sug) => S.override ?? sug.outfits[S.pick % sug.outfits.length];

async function markWorn(outfit) {
  const t = today();
  const ids = outfitItems(outfit).map((it) => it.id);
  const { updated, moved } = applyWear(S.items, ids, thresholds());
  await saveItems(updated);
  const w = todayWeather();
  const entry = {
    id: t, date: t, itemIds: ids, signature: signatureOf(outfit), occasion: S.occasion,
    weather: w ? { tMin: w.tMin, tMax: w.tMax, label: w.label } : null, createdAt: Date.now(),
  };
  await db.put('log', entry);
  S.log.push(entry);
  changed();
  toast(moved.length ? `Segnato. A lavare: ${moved.map((m) => m.name).join(', ')}` : 'Segnato. Buona giornata');
  render();
}

async function unmarkWorn(entry) {
  const reverted = undoWear(S.items, entry.itemIds, thresholds());
  await saveItems(reverted);
  await db.del('log', entry.id);
  S.log = S.log.filter((e) => e.id !== entry.id);
  changed();
  render();
}

async function vote(outfit, value) {
  const rows = [];
  for (const [key, delta] of Object.entries(voteDelta(outfit, value))) {
    S.votes[key] = (S.votes[key] ?? 0) + delta;
    rows.push({ key, value: S.votes[key] });
  }
  if (value < 0) {
    S.disliked[outfit.signature] = today();
    rows.push({ key: `sig:${outfit.signature}`, date: today() });
    changed();
  }
  await db.putMany('votes', rows);
  toast(value > 0 ? 'Me lo ricordo' : 'Non te lo ripropongo per un mese');
  render();
}

function swapPiece(outfit, slot) {
  const options = S.items.filter((it) => slotOf(it) === slot && (it.status ?? 'disponibile') === 'disponibile');
  const optional = ['outer', 'mid', 'base', 'scarf', 'hat', 'gloves'].includes(slot);
  let close;
  const choose = (it) => {
    const next = { ...outfit, [slot]: it };
    S.override = { ...next, signature: signatureOf(next), reasons: [] };
    close();
    render();
  };
  const body = h('div', { class: 'pick-list' },
    options.map((it) => h('button', { class: 'pick', 'aria-pressed': String(outfit[slot]?.id === it.id), onclick: () => choose(it) },
      thumb(it), h('span', {}, it.name))),
    optional && outfit[slot] ? h('button', { class: 'pick', onclick: () => choose(null) }, h('span', { class: 'swatch none' }, icon('x')), h('span', {}, 'Niente')) : null,
    options.length ? null : h('p', { class: 'muted' }, 'Nessun altro capo disponibile per questa parte.'));
  close = openSheet('Cambia capo', body);
}

// ---------- pezzi di interfaccia ----------

function thumb(it, cls = 'thumb') {
  if (it?.thumb) return h('img', { class: `${cls}${isCutout(it.thumb) ? ' cutout' : ''}`, src: blobUrl(it.thumb), alt: '' });
  const [r, g, b] = COLOR_RGB[it?.color] ?? [170, 170, 170];
  return h('span', { class: `${cls} swatch`, style: { background: `rgb(${r},${g},${b})` }, 'aria-hidden': 'true' });
}

function weatherIcon(code) {
  if (code == null) return 'cloud';
  if (code <= 1) return 'sun';
  if (code <= 3) return 'cloud';
  if (code <= 48) return 'mist';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowflake';
  if (code >= 95) return 'cloud-storm';
  return 'cloud-rain';
}

function weatherLine(w) {
  if (!w) {
    return h('p', { class: 'weather muted' }, icon('cloud-off'),
      S.weatherError ? 'Meteo non disponibile: propongo un outfit per una giornata fresca' : 'Carico il meteo…');
  }
  const need = weatherNeed(w);
  const rain = w.precipProb >= 30 ? ` · pioggia ${w.precipProb}%` : '';
  return h('p', { class: 'weather' }, icon(weatherIcon(w.code)),
    h('span', {}, `${place().name.split(',')[0]} ${Math.round(w.tMin)}° / ${Math.round(w.tMax)}°, ${w.label}`),
    h('span', { class: 'muted' }, ` · ${need.temp}° percepiti${rain}`));
}

function pageHead(eyebrow, title, extra) {
  return h('header', { class: 'page-head' }, eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null, h('h1', {}, title), extra);
}

function board(items, onPiece) {
  return h('div', { class: 'board' }, items.map((it) =>
    h(onPiece ? 'button' : 'div', { class: 'piece', onclick: onPiece ? () => onPiece(it) : null, 'aria-label': onPiece ? `Cambia ${it.name}` : null },
      thumb(it), h('span', { class: 'piece-name' }, it.name))));
}

// ---------- Oggi ----------

function viewOggi() {
  const t = today();
  const head = pageHead(formatDay(t), 'Outfit di oggi', weatherLine(todayWeather()));
  if (!S.items.length) {
    return h('section', {}, head, h('div', { class: 'card empty' },
      h('p', {}, 'Il guardaroba è vuoto. Aggiungi i tuoi capi, oppure prova l\'app con la capsule "vintage nordico".'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => openEditor() }, icon('plus'), 'Aggiungi un capo'),
        h('button', { class: 'btn', onclick: loadDemo }, 'Carica l\'esempio'))));
  }

  const worn = todayLog();
  if (worn) {
    const items = worn.itemIds.map(byId).filter(Boolean);
    return h('section', {}, head, h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, 'Oggi indossi'),
      board(items),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => goTry(worn.itemIds) }, icon('camera'), 'Vediti con questo'),
        h('button', { class: 'btn', onclick: () => unmarkWorn(worn) }, icon('arrow-back-up'), 'Annulla'))));
  }

  const occasions = h('div', { class: 'chips', role: 'group', 'aria-label': 'Occasione' },
    Object.entries(OCCASIONS).map(([k, o]) => h('button', {
      class: 'chip', 'aria-pressed': String(S.occasion === k), onclick: () => { S.occasion = k; render(); },
    }, o.label)));

  const sug = currentSuggestion();
  if (!sug.outfits.length) {
    return h('section', {}, head, occasions, h('div', { class: 'card empty' },
      h('p', {}, `Per proporti un outfit mancano: ${sug.missing.join(', ') || 'capi disponibili'}.`),
      h('p', { class: 'muted' }, 'Controlla anche i capi "a lavare" o "rovinati".'),
      h('button', { class: 'btn', onclick: () => go('guardaroba') }, 'Vai al guardaroba')));
  }

  const outfit = shownOutfit(sug);
  const items = outfitItems(outfit);
  const total = sug.outfits.length;
  return h('section', {}, head, occasions, h('div', { class: 'card' },
    board(items, (it) => swapPiece(outfit, slotOf(it))),
    outfit.reasons?.length ? h('ul', { class: 'reasons' }, outfit.reasons.map((r) => h('li', {}, r))) : null,
    sug.relaxed ? h('p', { class: 'note' }, 'Hai pochi capi disponibili: ho allentato la regola sulle ripetizioni.') : null,
    h('p', { class: 'hint' }, 'Tocca un capo per cambiarlo.'),
    h('div', { class: 'row' },
      h('button', { class: 'icon-btn', 'aria-label': 'Mi piace', onclick: () => vote(outfit, 1) }, icon('thumb-up')),
      h('button', { class: 'icon-btn', 'aria-label': 'Non mi piace', onclick: () => vote(outfit, -1) }, icon('thumb-down')),
      h('button', { class: 'btn grow', disabled: total < 2 && !S.override, onclick: () => { S.override = null; S.pick += 1; render(); } },
        icon('refresh'), 'Un altro')),
    h('button', { class: 'btn primary wide', onclick: () => markWorn(outfit) }, icon('check'), 'L\'ho messo oggi'),
    h('button', { class: 'link', onclick: () => goTry(items.map((it) => it.id)) }, icon('camera'), 'Vediti con questo')));
}

// ---------- Guardaroba ----------

function viewGuardaroba() {
  const counts = Object.fromEntries(Object.keys(STATES).map((k) => [k, 0]));
  for (const it of S.items) counts[it.status ?? 'disponibile'] += 1;
  const cats = [...new Set(S.items.map((it) => it.category))];
  const list = S.items.filter((it) =>
    (S.filter === 'tutti' || (it.status ?? 'disponibile') === S.filter) && (S.category === 'tutte' || it.category === S.category));

  const filters = h('div', { class: 'chips', role: 'group', 'aria-label': 'Stato' },
    [['tutti', 'Tutti', S.items.length], ...Object.entries(STATES).map(([k, l]) => [k, l, counts[k]])]
      .filter(([k, , n]) => k === 'tutti' || n > 0)
      .map(([k, label, n]) => h('button', { class: 'chip', 'aria-pressed': String(S.filter === k), onclick: () => { S.filter = k; render(); } },
        `${label} ${n}`)));
  const catSelect = h('select', { 'aria-label': 'Categoria', onchange: (e) => { S.category = e.target.value; render(); } },
    h('option', { value: 'tutte' }, 'Tutte le categorie'),
    cats.map((c) => h('option', { value: c, selected: S.category === c }, CATEGORIES[c]?.label ?? c)));

  return h('section', {}, pageHead(null, 'Guardaroba', h('p', { class: 'muted' }, `${S.items.length} capi`)),
    filters,
    h('div', { class: 'row' }, catSelect,
      counts.lavare ? h('button', { class: 'btn', onclick: laundryDone }, icon('wash-machine'), `Ho fatto il bucato (${counts.lavare})`) : null),
    list.length
      ? h('div', { class: 'grid' }, list.map(itemCard))
      : h('p', { class: 'muted empty-line' }, S.items.length ? 'Nessun capo con questi filtri.' : 'Ancora nessun capo.'),
    h('button', { class: 'fab', 'aria-label': 'Aggiungi un capo', onclick: () => openEditor() }, icon('plus')));
}

function itemCard(it) {
  const status = it.status ?? 'disponibile';
  const limit = washAfterOf(it, thresholds());
  return h('button', { class: 'item-card', onclick: () => openEditor(it) },
    thumb(it, 'item-photo'),
    status !== 'disponibile' ? h('span', { class: `badge ${status}` }, STATES[status]) : null,
    h('span', { class: 'item-name' }, it.name),
    h('span', { class: 'item-meta' }, categoryOf(it).label, limit ? ` · ${it.wearsSinceWash ?? 0}/${limit}` : ''));
}

async function laundryDone() {
  const dirty = S.items.filter((it) => it.status === 'lavare').map(washed);
  await saveItems(dirty);
  toast(`${dirty.length} capi di nuovo disponibili`);
  render();
}

function lastWorn(id) {
  const dates = S.log.filter((e) => e.itemIds.includes(id)).map((e) => e.date).sort();
  return dates.at(-1) ?? null;
}

function openEditor(item) {
  const isNew = !item;
  const draft = item ? { ...item } : { id: crypto.randomUUID(), status: 'disponibile', category: 'maglione', createdAt: Date.now(), wearsSinceWash: 0, totalWears: 0 };
  const prevStatus = draft.status;
  let busy = false;
  const body = h('div', { class: 'editor' });
  let close;

  const field = (label, input, hint) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
  const text = (key, placeholder = '') => h('input', { type: 'text', value: draft[key] ?? '', placeholder, oninput: (e) => { draft[key] = e.target.value; } });
  const range = (key, value, labels) => {
    const out = h('span', { class: 'range-value' }, labels[value - 1]);
    return h('div', { class: 'range' }, h('input', {
      type: 'range', min: '1', max: '5', step: '1', value: String(value),
      oninput: (e) => { draft[key] = Number(e.target.value); out.textContent = labels[draft[key] - 1]; },
    }), out);
  };
  const check = (key, label, value) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: Boolean(value), onchange: (e) => { draft[key] = e.target.checked; } }), label);

  async function setPhoto(kind, fromClipboard = false) {
    let file;
    try {
      file = fromClipboard ? await imageFromClipboard() : await pickFile();
    } catch {
      file = null;
    }
    if (!file) {
      if (fromClipboard) toast('Negli appunti non c\'è un\'immagine: in Foto tieni premuto sul capo e scegli "Copia"', 'error');
      return;
    }
    try {
      const blob = await resizeImage(file, 1280);
      if (kind === 'photo') {
        draft.photo = blob;
        draft.thumb = await makeThumb(blob);
        if (!draft.colorTouched) draft.color = (await dominantColor(blob)).name;
      } else {
        draft.label = blob;
      }
      paint();
    } catch {
      toast('Non riesco a leggere questa foto', 'error');
    }
  }

  async function readWithGemini() {
    if (!S.settings.geminiKey) {
      toast('Aggiungi prima la chiave Gemini nelle impostazioni', 'error');
      return;
    }
    if (!draft.photo && !draft.label) {
      toast('Prima fai la foto al capo o all\'etichetta', 'error');
      return;
    }
    busy = true;
    paint();
    try {
      const r = await analyzeGarment(S.settings.geminiKey, S.settings.geminiModel ?? MODELS[0], draft.photo ?? draft.label, draft.photo ? draft.label : null);
      for (const [k, v] of Object.entries(r)) {
        if (v === null || v === '') continue;
        if (k === 'color' && draft.colorTouched) continue;
        draft[k] = v;
      }
      toast('Dati letti: controllali e salva');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      busy = false;
      paint();
    }
  }

  async function save() {
    if (!draft.name?.trim()) {
      body.querySelector('.name-error').textContent = 'Dai un nome al capo';
      body.querySelector('input[type=text]').focus();
      return;
    }
    draft.name = draft.name.trim();
    if (prevStatus === 'lavare' && draft.status === 'disponibile') draft.wearsSinceWash = 0;
    delete draft.colorTouched;
    await saveItems([draft]);
    close();
    toast(isNew ? 'Capo aggiunto' : 'Salvato');
    render();
  }

  async function remove() {
    if (!confirm(`Eliminare "${draft.name}"? Non si può annullare.`)) return;
    await db.del('items', draft.id);
    S.items = S.items.filter((it) => it.id !== draft.id);
    changed();
    close();
    render();
  }

  function photoTile(kind, label, blob) {
    return h('button', { class: 'photo-tile', onclick: () => setPhoto(kind) },
      blob ? h('img', { class: isCutout(blob) ? 'cutout' : null, src: blobUrl(blob), alt: label }) : h('span', { class: 'photo-empty' }, icon(kind === 'photo' ? 'camera' : 'tag'), label));
  }

  function paint() {
    const cat = categoryOf(draft);
    const limit = washAfterOf({ ...draft, washAfter: undefined }, thresholds());
    const last = isNew ? null : lastWorn(draft.id);
    body.replaceChildren(
      h('div', { class: 'photos' }, photoTile('photo', 'Foto del capo', draft.photo), photoTile('label', 'Foto etichetta', draft.label)),
      h('button', { class: 'link', onclick: () => setPhoto('photo', true) }, icon('clipboard'), 'Incolla il capo scontornato'),
      draft.photo ? null : h('p', { class: 'hint' }, 'Scontorno: in Foto tieni premuto sul capo, tocca "Copia", poi torna qui e incolla.'),
      h('button', { class: 'btn wide', disabled: busy, onclick: readWithGemini }, icon('sparkles'), busy ? 'Leggo…' : 'Leggi con Gemini'),
      field('Nome', text('name', 'Cappotto tweed marrone')),
      h('p', { class: 'name-error error', 'aria-live': 'polite' }),
      h('div', { class: 'two' },
        field('Categoria', h('select', { onchange: (e) => { draft.category = e.target.value; delete draft.warmth; delete draft.formality; paint(); } },
          Object.entries(CATEGORIES).map(([k, c]) => h('option', { value: k, selected: draft.category === k }, c.label)))),
        field('Colore', h('select', { onchange: (e) => { draft.color = e.target.value; draft.colorTouched = true; } },
          h('option', { value: '' }, '—'),
          COLORS.map(([name]) => h('option', { value: name, selected: draft.color === name }, name))))),
      h('div', { class: 'checks' },
        check('pattern', 'Fantasia (righe, quadri…)', draft.pattern),
        check('waterproof', 'Impermeabile', isWaterproof(draft))),
      field('Calore', range('warmth', warmthOf(draft), ['leggerissimo', 'leggero', 'medio', 'caldo', 'pesante'])),
      field('Formalità', range('formality', formalityOf(draft), ['sportivo', 'casual', 'smart casual', 'curato', 'elegante'])),
      h('div', { class: 'state-row', role: 'group', 'aria-label': 'Stato' },
        Object.entries(STATES).map(([k, l]) => h('button', {
          class: 'chip', 'aria-pressed': String(draft.status === k), onclick: () => { draft.status = k; paint(); },
        }, l))),
      h('details', { class: 'more', open: Boolean(draft.composition || draft.care) },
        h('summary', {}, 'Etichetta e prova'),
        field('Composizione', text('composition', '80% lana, 20% poliammide')),
        field('Lavaggio', text('care', 'a mano 30°, no asciugatrice')),
        h('div', { class: 'two' }, field('Taglia', text('size')), field('Marca', text('brand'))),
        field('Descrizione per la prova', text('descriptionEn', 'brown herringbone tweed overcoat'), 'In inglese: è il nome che finisce nel foglio prova.'),
        field('A lavare dopo', h('input', {
          type: 'number', min: '1', max: '30', inputmode: 'numeric', value: draft.washAfter ?? '',
          placeholder: limit ? `${limit} utilizzi` : 'mai in automatico',
          oninput: (e) => { draft.washAfter = e.target.value ? Number(e.target.value) : undefined; },
        }), cat.washAfter ? null : 'Per questa categoria di solito non serve.'),
        field('Note', text('notes'))),
      isNew ? null : h('p', { class: 'muted stats' },
        `Messo ${draft.totalWears ?? 0} ${(draft.totalWears ?? 0) === 1 ? 'volta' : 'volte'} · ${draft.wearsSinceWash ?? 0} dall'ultimo lavaggio${last ? ` · ultima volta ${formatDay(last, { day: 'numeric', month: 'short' })}` : ''}`),
      h('div', { class: 'row end' },
        isNew ? null : h('button', { class: 'btn danger', onclick: remove }, icon('trash'), 'Elimina'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary', onclick: save }, icon('check'), 'Salva')));
  }

  paint();
  close = openSheet(isNew ? 'Nuovo capo' : draft.name, body);
}

// ---------- Prova ----------

let sheetCache = { key: null, blob: null, building: null };

function goTry(ids) {
  S.tryIds = ids;
  go('prova');
}

function garmentsFor(ids) {
  const order = (it) => SLOTS.indexOf(slotOf(it));
  return ids.map(byId).filter((it) => it && slotOf(it) !== 'gloves').sort((a, b) => order(a) - order(b));
}

function ensureSheet(garments) {
  const ref = S.settings.refPhoto;
  const key = `${S.settings.refPhotoAt}|${garments.map((g) => `${g.id}:${g.updatedAt ?? ''}`).join(',')}|${S.version}`;
  if (sheetCache.key === key || sheetCache.building === key) return;
  sheetCache.building = key;
  buildSheet(ref, garments)
    .then((blob) => { sheetCache = { key, blob, building: null }; if (S.tab === 'prova') render(); })
    .catch(() => { sheetCache = { key: null, blob: null, building: null }; toast('Non riesco a comporre il foglio', 'error'); });
}

function viewProva() {
  const head = pageHead(null, 'Prova su di te');
  if (!S.settings.refPhoto) {
    return h('section', {}, head, h('div', { class: 'card' },
      h('p', {}, 'Serve una tua foto di riferimento, da fare una volta sola:'),
      h('ul', { class: 'tips' },
        h('li', {}, 'figura intera, dalla testa ai piedi, contro un muro chiaro;'),
        h('li', {}, 'vestiti scuri, semplici e tinta unita, così il modello non li copia;'),
        h('li', {}, 'braccia lungo i fianchi e niente telefono in mano: usa il timer.')),
      h('button', { class: 'btn primary', onclick: setRefPhoto }, icon('user'), 'Carica la foto di riferimento')));
  }

  const ids = S.tryIds ?? todayLog()?.itemIds ?? (() => {
    const sug = S.items.length ? currentSuggestion() : null;
    return sug?.outfits.length ? outfitItems(shownOutfit(sug)).map((it) => it.id) : [];
  })();
  const garments = garmentsFor(ids);
  if (!garments.length) {
    return h('section', {}, head, h('div', { class: 'card empty' },
      h('p', {}, 'Scegli prima un outfit nella pagina Oggi.'),
      h('button', { class: 'btn', onclick: () => go('oggi') }, 'Vai a Oggi')), gallery());
  }
  ensureSheet(garments);
  const opts = { person: S.settings.person ?? '', rules: S.settings.styleRules || DEFAULT_RULES, city: place().name.split(',')[0] };
  const ready = sheetCache.blob && !sheetCache.building;

  return h('section', {}, head,
    h('div', { class: 'card' },
      board(garments),
      h('ol', { class: 'steps' },
        h('li', {},
          h('span', {}, 'Copia il testo'),
          h('button', { class: 'btn', onclick: () => copyText(tryOnPrompt(garments, opts)) }, icon('copy'), 'Copia')),
        h('li', {},
          h('span', {}, 'Condividi il foglio su Gemini (o ChatGPT), incolla il testo e invia'),
          h('button', { class: 'btn primary', disabled: !ready, onclick: () => shareOrDownload(sheetCache.blob, 'foglio-prova.jpg') },
            icon('share'), ready ? 'Condividi' : 'Preparo…')),
        h('li', {},
          h('span', {}, 'Se sbaglia i vestiti, rispondi con la correzione'),
          h('button', { class: 'btn', onclick: () => copyText(fixPrompt(garments)) }, icon('copy'), 'Copia correzione')),
        h('li', {},
          h('span', {}, 'Salva la foto e importala qui'),
          h('button', { class: 'btn', onclick: () => importTryOn(garments) }, icon('photo-plus'), 'Importa'))),
      ready ? h('details', { class: 'more' }, h('summary', {}, 'Vedi il foglio'), h('img', { class: 'sheet-preview', src: blobUrl(sheetCache.blob), alt: 'Foglio prova' })) : null,
      h('p', { class: 'hint' }, 'In Gemini: tocca + e scegli "Crea immagine" prima di inviare.')),
    gallery());
}

async function setRefPhoto() {
  const file = await pickFile();
  if (!file) return;
  const blob = await resizeImage(file, 1600, 0.9);
  await saveSetting('refPhoto', blob);
  await saveSetting('refPhotoAt', Date.now());
  toast('Foto di riferimento salvata');
  render();
}

async function importTryOn(garments) {
  const file = await pickFile();
  if (!file) return;
  const photo = await resizeImage(file, 1600, 0.88);
  const entry = { id: crypto.randomUUID(), createdAt: Date.now(), date: today(), itemIds: garments.map((g) => g.id), photo };
  await db.put('tryons', entry);
  S.tryons.unshift(entry);
  toast('Prova salvata');
  render();
}

function gallery() {
  if (!S.tryons.length) return null;
  return h('div', { class: 'card' },
    h('p', { class: 'eyebrow' }, 'Le tue prove'),
    h('div', { class: 'gallery' }, S.tryons.map((t) => h('button', { class: 'shot', onclick: () => openTryOn(t) },
      h('img', { src: blobUrl(t.photo), alt: `Prova del ${formatDay(t.date, { day: 'numeric', month: 'long' })}`, loading: 'lazy' })))));
}

function openTryOn(t) {
  let close;
  const names = t.itemIds.map(byId).filter(Boolean).map((it) => it.name);
  close = openSheet(formatDay(t.date), h('div', {},
    h('img', { class: 'full', src: blobUrl(t.photo), alt: '' }),
    names.length ? h('p', { class: 'muted' }, names.join(' · ')) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => shareOrDownload(t.photo, `prova-${t.date}.jpg`) }, icon('share'), 'Condividi'),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'btn danger',
        onclick: async () => {
          if (!confirm('Eliminare questa prova?')) return;
          await db.del('tryons', t.id);
          S.tryons = S.tryons.filter((x) => x.id !== t.id);
          close();
          render();
        },
      }, icon('trash'), 'Elimina'))));
}

// ---------- Impostazioni ----------

function viewAltro() {
  const s = S.settings;
  const keyInput = h('input', { type: 'password', autocomplete: 'off', placeholder: 'AIza…', value: s.geminiKey ?? '' });
  const modelSelect = h('select', {}, MODELS.map((m) => h('option', { value: m, selected: (s.geminiModel ?? MODELS[0]) === m }, m)));
  const cityInput = h('input', { type: 'text', placeholder: 'Stoccolma', value: '' });
  const washable = Object.entries(CATEGORIES).filter(([, c]) => c.washAfter);

  return h('section', {}, pageHead(null, 'Impostazioni'),
    h('div', { class: 'card' },
      h('h2', {}, 'Foto di riferimento'),
      s.refPhoto ? h('img', { class: 'ref', src: blobUrl(s.refPhoto), alt: 'Foto di riferimento' }) : h('p', { class: 'muted' }, 'Non ancora caricata.'),
      h('button', { class: 'btn', onclick: setRefPhoto }, icon('user'), s.refPhoto ? 'Cambia foto' : 'Carica foto'),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Come ti descrive il testo della prova (in inglese)'),
        h('input', { type: 'text', value: s.person ?? '', placeholder: PERSON_PLACEHOLDER, onchange: (e) => saveSetting('person', e.target.value.trim()) }),
        h('span', { class: 'field-hint' }, 'Aiuta il modello a non cambiarti viso e corporatura. Resta su questo dispositivo.'))),

    h('div', { class: 'card' },
      h('h2', {}, 'Gemini (gratis)'),
      h('p', { class: 'muted' }, 'Serve solo a leggere foto ed etichette dei capi. Sul piano gratuito Google può usare le immagini inviate: partono solo foto di vestiti.'),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Chiave API'), keyInput,
        h('span', { class: 'field-hint' }, 'Si crea gratis su aistudio.google.com/apikey e resta solo su questo dispositivo.')),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Modello'), modelSelect),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn primary',
          onclick: async () => {
            await saveSetting('geminiKey', keyInput.value.trim());
            await saveSetting('geminiModel', modelSelect.value);
            toast('Salvato');
          },
        }, 'Salva'),
        h('button', {
          class: 'btn',
          onclick: async () => {
            try {
              await testKey(keyInput.value.trim(), modelSelect.value);
              toast('La chiave funziona');
            } catch (e) {
              toast(e.message, 'error');
            }
          },
        }, 'Verifica'))),

    h('div', { class: 'card' },
      h('h2', {}, 'Città per il meteo'),
      h('p', {}, place().name),
      h('div', { class: 'row' }, cityInput,
        h('button', {
          class: 'btn',
          onclick: async () => {
            if (!cityInput.value.trim()) return;
            try {
              await saveSetting('place', await geocode(cityInput.value.trim()));
              await loadWeather(true);
              toast(`Meteo per ${place().name}`);
              render();
            } catch (e) {
              toast(e.message, 'error');
            }
          },
        }, 'Cerca'))),

    h('div', { class: 'card' },
      h('h2', {}, 'Regole'),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Giorni prima di riproporre lo stesso outfit'),
        h('input', {
          type: 'number', min: '1', max: '60', inputmode: 'numeric', value: s.noRepeatDays ?? 14,
          onchange: (e) => { saveSetting('noRepeatDays', Math.max(1, Number(e.target.value) || 14)); changed(); },
        })),
      h('p', { class: 'field-label' }, 'A lavare dopo quanti utilizzi'),
      h('div', { class: 'wash-grid' }, washable.map(([k, c]) => h('label', { class: 'field' },
        h('span', { class: 'field-hint' }, c.label),
        h('input', {
          type: 'number', min: '1', max: '30', inputmode: 'numeric', value: thresholds()[k] ?? c.washAfter,
          onchange: (e) => { saveSetting('washThresholds', { ...thresholds(), [k]: Math.max(1, Number(e.target.value) || c.washAfter) }); changed(); },
        }))))),

    h('div', { class: 'card' },
      h('h2', {}, 'Dati'),
      h('p', { class: 'muted' }, 'Tutto resta su questo dispositivo. Fai un backup ogni tanto: se cancelli i dati del browser, i capi si perdono.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: exportBackup }, icon('download'), 'Esporta backup'),
        h('button', { class: 'btn', onclick: importBackup }, icon('upload'), 'Importa backup')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: loadDemo }, 'Carica capi di esempio'),
        S.items.some((it) => it.demo) ? h('button', { class: 'btn danger', onclick: removeDemo }, 'Elimina capi di esempio') : null)));
}

async function loadDemo() {
  const have = new Set(S.items.map((it) => it.id));
  const added = [];
  for (const [i, d] of DEMO_ITEMS.entries()) {
    if (have.has(d.id)) continue;
    let photo = null;
    let thumbBlob = null;
    if (d.photo) {
      photo = await (await fetch(d.photo)).blob();
      thumbBlob = await makeThumb(photo);
    }
    added.push({ ...d, photo, thumb: thumbBlob, demo: true, status: 'disponibile', wearsSinceWash: 0, totalWears: 0, createdAt: Date.now() + i });
  }
  await saveItems(added);
  toast(added.length ? `${added.length} capi di esempio caricati` : 'I capi di esempio ci sono già');
  render();
}

async function removeDemo() {
  if (!confirm('Eliminare tutti i capi di esempio?')) return;
  const ids = S.items.filter((it) => it.demo).map((it) => it.id);
  await db.delMany('items', ids);
  S.items = S.items.filter((it) => !it.demo);
  changed();
  render();
}

async function exportBackup() {
  const enc = (b) => (b ? blobToDataUrl(b) : null);
  const items = await Promise.all(S.items.map(async (it) => ({ ...it, photo: await enc(it.photo), thumb: await enc(it.thumb), label: await enc(it.label) })));
  const tryons = await Promise.all(S.tryons.map(async (t) => ({ ...t, photo: await enc(t.photo) })));
  const { geminiKey, forecastCache, ...settings } = S.settings;
  settings.refPhoto = await enc(settings.refPhoto);
  const data = { app: 'app-outfit', version: 1, exportedAt: new Date().toISOString(), items, log: S.log, votes: await db.all('votes'), tryons, settings };
  await shareOrDownload(new Blob([JSON.stringify(data)], { type: 'application/json' }), `app-outfit-backup-${today()}.json`);
}

async function importBackup() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
    if (data.app !== 'app-outfit') throw new Error();
  } catch {
    toast('Questo file non è un backup dell\'app', 'error');
    return;
  }
  if (!confirm(`Sostituire i dati attuali con il backup del ${data.exportedAt?.slice(0, 10)}?`)) return;
  const dec = (u) => (u ? dataUrlToBlob(u) : null);
  const items = await Promise.all(data.items.map(async (it) => ({ ...it, photo: await dec(it.photo), thumb: await dec(it.thumb), label: await dec(it.label) })));
  const tryons = await Promise.all((data.tryons ?? []).map(async (t) => ({ ...t, photo: await dec(t.photo) })));
  const settings = { ...data.settings, refPhoto: await dec(data.settings?.refPhoto) };
  for (const store of ['items', 'log', 'votes', 'tryons']) await db.clear(store);
  await db.putMany('items', items);
  await db.putMany('log', data.log ?? []);
  await db.putMany('votes', data.votes ?? []);
  await db.putMany('tryons', tryons);
  await db.putMany('settings', Object.entries(settings).map(([key, value]) => ({ key, value })));
  await load();
  changed();
  toast('Backup importato');
  render();
}

// ---------- navigazione ----------

const VIEWS = { oggi: viewOggi, guardaroba: viewGuardaroba, prova: viewProva, altro: viewAltro };

function go(tab) {
  if (tab !== 'prova') S.tryIds = tab === 'oggi' ? null : S.tryIds;
  S.tab = tab;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const main = document.getElementById('main');
  main.replaceChildren(VIEWS[S.tab]());
  for (const b of document.querySelectorAll('.tabbar button')) {
    b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false');
  }
}

async function start() {
  for (const b of document.querySelectorAll('.tabbar button')) b.addEventListener('click', () => go(b.dataset.tab));
  await load();
  render();
  navigator.storage?.persist?.();
  await loadWeather();
  render();
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    await loadWeather();
    render();
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

start().catch((e) => {
  document.getElementById('main').replaceChildren(h('p', { class: 'error' }, `Errore all'avvio: ${e.message}`));
});
