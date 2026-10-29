// Come lavare un capo: dall'etichetta letta da Gemini, oppure dal tessuto.
// Nessuna dipendenza dal DOM.

import { guessFabric, CATEGORY_STYLE } from './style.js';

// Programmi della lavatrice, nell'ordine in cui conviene farli.
export const PROGRAMS = {
  cotone:   { label: 'Cotone 40°',           order: 1 },
  colorati: { label: 'Colorati 30°, al rovescio', order: 2 },
  sintetici:{ label: 'Sintetici 30°',        order: 3 },
  lana:     { label: 'Lana 30° o a mano',    order: 4 },
  mano:     { label: 'A mano, acqua fredda', order: 5 },
  secco:    { label: 'Lavanderia a secco',   order: 6 },
  niente:   { label: 'Non si lava: si pulisce', order: 7 },
};

// Per tessuto: programma, asciugatrice e consigli pratici.
const BY_FABRIC = {
  lana:     { program: 'lana', dryer: false, tips: ['Stendilo in piano su un asciugamano: appeso si allunga.', 'Tra un uso e l\'altro arieggialo: la lana si lava poco.', 'Contro i pallini: pettine o rasoio per maglie.'] },
  maglia:   { program: 'lana', dryer: false, tips: ['Stendilo in piano: appeso si deforma.', 'Piegalo, non appenderlo nell\'armadio.'] },
  tweed:    { program: 'secco', dryer: false, tips: ['Spazzolalo dopo l\'uso e arieggialo.', 'Macchie piccole: spugna umida, senza strofinare.', 'In lavanderia una volta a stagione basta.'] },
  velluto:  { program: 'colorati', dryer: false, tips: ['Al rovescio, centrifuga bassa.', 'Non stirarlo sul dritto: schiaccia le coste.'] },
  sherpa:   { program: 'sintetici', dryer: false, tips: ['Acqua fredda, niente ammorbidente.', 'Da asciutto spazzolalo per ridargli volume.'] },
  denim:    { program: 'colorati', dryer: false, tips: ['Al rovescio, 30°: perde meno colore.', 'Lavalo poco: arieggiarlo spesso basta.', 'Le prime volte da solo o con capi scuri.'] },
  felpa:    { program: 'colorati', dryer: false, tips: ['Al rovescio, con colori simili.', 'Asciugatrice no: si restringe.'] },
  flanella: { program: 'colorati', dryer: false, tips: ['30° con colori simili, stendila subito.'] },
  lino:     { program: 'colorati', dryer: false, tips: ['Stendilo ancora umido, si stira meglio.'] },
  cotone:   { program: 'cotone', dryer: false, tips: ['Bianchi con i bianchi.', 'Stendi le t-shirt dalla parte bassa, non dalle spalle.'] },
  tecnico:  { program: 'sintetici', dryer: true, tips: ['Detersivo liquido, niente ammorbidente: rovina l\'impermeabilità.', 'Asciugatrice a bassa temperatura riattiva l\'idrorepellenza.'] },
  pelle:    { program: 'niente', dryer: false, tips: ['Panno umido e crema per pelle una volta al mese.', 'Il sale delle strade va tolto subito: acqua e un po\' d\'aceto.', 'Riposo di un giorno tra un uso e l\'altro, con il tendiscarpe.'] },
  camoscio: { program: 'niente', dryer: false, tips: ['Spazzola per camoscio dopo l\'uso.', 'Spray impermeabilizzante prima dell\'inverno.', 'Neve e sale lo macchiano: con la neve a terra meglio di no.'] },
};

const SHOES = new Set(['scarpe', 'sneakers', 'stivali']);

const PROGRAM_HINTS = [
  [/secco|dry clean/i, 'secco'],
  [/a mano|hand wash/i, 'mano'],
  [/lana|wool/i, 'lana'],
  [/sintetic|synthetic/i, 'sintetici'],
  [/non lavare|do not wash/i, 'niente'],
];

// Restituisce { program, temp, dryer, tips, fromLabel }.
export function careOf(it) {
  const fabric = it.fabric ?? guessFabric(it, CATEGORY_STYLE[it.category]?.fabric ?? 'cotone');
  const base = BY_FABRIC[fabric] ?? BY_FABRIC.cotone;
  let program = base.program;
  let dryer = base.dryer;
  let temp = null;
  const label = `${it.care ?? ''}`;
  if (label) {
    for (const [re, p] of PROGRAM_HINTS) if (re.test(label)) { program = p; break; }
    const t = label.match(/(\d{2})\s*°/);
    if (t) temp = Number(t[1]);
    if (/no asciugatrice|non.*asciugatrice|no tumble/i.test(label)) dryer = false;
    if (program === 'cotone' && temp != null && temp <= 30) program = 'colorati';
  }
  if (SHOES.has(it.category) && fabric !== 'cotone') program = 'niente';
  if (it.category === 'sneakers' && fabric === 'cotone') {
    return { program: 'colorati', temp: 30, dryer: false, fromLabel: false, tips: ['Togli lacci e soletta, mettile in una federa.', 'Asciugale all\'aria, mai sul termosifone.'] };
  }
  return { program, temp, dryer, tips: base.tips, fromLabel: Boolean(label) };
}

// Raggruppa i capi da lavare per programma, nell'ordine dei lavaggi.
export function laundryGroups(items) {
  const groups = new Map();
  for (const it of items) {
    const { program } = careOf(it);
    if (!groups.has(program)) groups.set(program, []);
    groups.get(program).push(it);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => PROGRAMS[a].order - PROGRAMS[b].order)
    .map(([program, list]) => ({ program, label: PROGRAMS[program].label, items: list }));
}
