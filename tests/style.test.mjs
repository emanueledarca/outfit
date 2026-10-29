// Gusto, lavaggi e acquisti. Esegui dalla cartella del progetto: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { styleFitOf, guessFabric, guessVolume, aesthetic, traitsOf, oklab, deltaE } from '../js/style.js';
import { careOf, laundryGroups } from '../js/care.js';
import { wardrobeCoverage, gainOf, verdict, shoppingList, similarOwned, examplesWith } from '../js/shop.js';
import { COLOR_RGB, slotOf, isAccent } from '../js/rules.js';
import { DEMO_ITEMS } from '../js/demo.js';

const items = DEMO_ITEMS.map((it) => ({ ...it, status: 'disponibile' }));
const byId = (id) => items.find((it) => it.id === id);
const piece = (it) => ({ it, slot: slotOf(it), t: traitsOf(it, slotOf(it), (n) => COLOR_RGB[n]) });

test('fabric and volume are guessed from the name', () => {
  assert.equal(guessFabric({ name: 'Cappotto spigato' }, 'lana'), 'tweed');
  assert.equal(guessFabric({ name: 'Felpa', composition: '100% cotone' }, 'cotone'), 'felpa');
  assert.equal(guessVolume({ name: 'Jeans skinny' }), 1);
  assert.equal(guessVolume({ name: 'Jeans baggy' }), 3);
});

test('the capsule is in style; skinny, logos and loud colours are not', () => {
  for (const it of items) assert.ok(styleFitOf(it, slotOf(it)).fit >= 0.6, `${it.name} fuori stile`);
  const skinny = styleFitOf({ category: 'jeans', color: 'indaco', volume: 1 }, 'bottom');
  assert.ok(skinny.fit < 0.45);
  assert.equal(skinny.why, 'pantalone aderente');
  const logo = styleFitOf({ category: 'felpa', color: 'grigio', logo: true }, 'mid');
  assert.ok(logo.fit < styleFitOf({ category: 'felpa', color: 'grigio' }, 'mid').fit);
  assert.ok(styleFitOf({ category: 'maglione', color: 'rosa' }, 'mid').fit < 0.68, 'un maglione rosa non è pienamente nel tuo stile');
});

test('OKLab distance: navy is closer to black than to cream', () => {
  const navy = oklab(COLOR_RGB['blu navy']);
  assert.ok(deltaE(navy, oklab(COLOR_RGB.nero)) < deltaE(navy, oklab(COLOR_RGB.panna)));
});

test('tone on tone and texture beat a flat, near-miss outfit', () => {
  const good = aesthetic(['demo-01', 'demo-05', 'demo-12', 'demo-14'].map((id) => piece(byId(id))), isAccent);
  const flat = aesthetic([
    piece({ id: 'a', category: 'tshirt', color: 'nero', fabric: 'cotone' }),
    piece({ id: 'b', category: 'pantalone', color: 'blu navy', fabric: 'cotone' }),
    piece({ id: 'c', category: 'scarpe', color: 'nero', fabric: 'pelle', volume: 1 }),
  ], isAccent);
  assert.ok(good.score > flat.score + 1, `${good.score} vs ${flat.score}`);
  assert.ok(good.notes.includes('Tono su tono'));
});

test('care: suede and leather are never machine washed, the label wins over the fabric', () => {
  assert.equal(careOf(byId('demo-16')).program, 'niente');
  assert.equal(careOf(byId('demo-14')).program, 'niente');
  assert.equal(careOf(byId('demo-07')).program, 'lana');
  assert.equal(careOf(byId('demo-06')).program, 'mano');
  assert.equal(careOf(byId('demo-01')).program, 'secco');
  const fromLabel = careOf({ category: 'tshirt', care: 'cotone 30°, no asciugatrice' });
  assert.deepEqual([fromLabel.program, fromLabel.temp, fromLabel.dryer, fromLabel.fromLabel], ['colorati', 30, false, true]);
});

test('laundry groups follow the washing order', () => {
  const groups = laundryGroups([byId('demo-07'), byId('demo-09'), byId('demo-11'), byId('demo-08')]);
  assert.deepEqual(groups.map((g) => g.program), ['cotone', 'colorati', 'lana']);
  assert.equal(groups.find((g) => g.program === 'colorati').items.length, 2);
});

test('coverage: the full capsule has good outfits for every kind of day', () => {
  const cov = wardrobeCoverage(items);
  for (const s of cov.byScenario) assert.ok(s.good > 0, `nessun outfit per ${s.label}`);
  assert.equal(cov.total, cov.byScenario.reduce((t, s) => t + s.good, 0));
});

test('items on the wish list do not count as owned', () => {
  const wished = items.map((it) => (it.category === 'parka' || it.category === 'stivali' ? { ...it, status: 'desiderato' } : it));
  const cov = wardrobeCoverage(wished);
  assert.ok(cov.byScenario.find((s) => s.id === 'gelo').good < wardrobeCoverage(items).byScenario.find((s) => s.id === 'gelo').good);
});

test('shopping: without boots and parka, those come first and cover the rain', () => {
  const partial = items.filter((it) => !['demo-04', 'demo-14'].includes(it.id));
  const list = shoppingList(partial, DEMO_ITEMS);
  const top2 = list.slice(0, 2).map((g) => g.candidate.id).sort();
  assert.deepEqual(top2, ['demo-04', 'demo-14']);
  assert.equal(verdict(list[0], partial).kind, 'si');
  assert.ok(list.every((g) => !partial.some((it) => it.id === g.candidate.id)));
});

test('verdict: a near twin of something owned is a no', () => {
  const twin = { id: 'x', name: 'Altro cappotto', category: 'cappotto', color: 'marrone', fabric: 'tweed' };
  assert.equal(similarOwned(twin, items)?.id, 'demo-01');
  assert.equal(verdict(gainOf(twin, items), items).kind, 'no');
});

test('verdict: skinny red jeans are out of style, whatever they add', () => {
  const v = verdict(gainOf({ id: 'y', name: 'Skinny rossi', category: 'jeans', color: 'rosso', volume: 1 }, items), items, 60);
  assert.equal(v.kind, 'no');
  assert.equal(v.title, 'Non è il tuo stile');
});

test('verdict: regular red jeans match a lot but are only a maybe', () => {
  const v = verdict(gainOf({ id: 'z', name: 'Jeans rossi', category: 'jeans', color: 'rosso', volume: 2 }, items), items);
  assert.equal(v.kind, 'forse');
});

test('examples with a new piece are varied and include it', () => {
  const coat = byId('demo-01');
  const ex = examplesWith(coat, items, 3);
  assert.equal(ex.length, 3);
  for (const o of ex) assert.equal(o.outer.id, coat.id);
  const tops = new Set(ex.map((o) => `${(o.mid ?? o.base).id}|${o.bottom.id}`));
  assert.equal(tops.size, 3);
});
