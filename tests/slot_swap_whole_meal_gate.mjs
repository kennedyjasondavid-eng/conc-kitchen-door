// tests/slot_swap_whole_meal_gate.mjs — Swap Slots moves each meal whole (2026-11-04, v31-standard.50).
// Jason, 2026-11-04: "Swap should move everything that needs moving." He swapped Wk2 THU <-> FRI dinner in Menu Config
// (Arroz con Pollo and the sausage dinner) and made both halves permanent from the Active Swaps banner. Only each meal's
// name, vegan line and ticks moved: a swap entry held only those (the shape of a dish typed into the swap panel), and
// both Make Permanent paths and the one-time swap's reader (doorApplyDatedMeal) wrote every other part empty, on purpose,
// for a typed dish (2026-10-19, tests/make_permanent_whole_dish_gate.mjs). The sausage dinner lost its halal line ("Halal
// beef sausages") and its soft plate: the two soft residents went to the halal line, and the Arroz day opened a Soft
// Meals section with no plate written. Its recipe-linked slots and parts went too.
// Now a swap that moves a rotation meal carries it whole (`_meal`, doorMealCopy's shape), and every reader writes it.
// Checks, running index.html's own code:
//   1. Swap Slots stores each half's whole meal: its halal line, soft plate, parts and slots
//   2. a one-time slot swap reaches the plating sheet whole: the halal plate, the soft plate, the vegan dish's links
//   3. Make Permanent from the banner writes the moved meal whole
//   4. Make Permanent from the meal panel writes it whole, with the panel's own change on top
//   5. a typed swap still brings only its words and ticks (the 2026-10-19 rule), and a whole meal under another name is
//      never read (a swap renamed later)
//   6. a special meal that displaces the rotation meal moves the displaced meal whole
// Authored to fail on DOOR 94f1cd2 (1-4, 6). Env: SLOT_SWAP_ROOT (another checkout's directory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SLOT_SWAP_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// The menu is this checkout's: the meals as published with every part (a red run on 94f1cd2 still reads them whole).
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return (html.includes('async function ' + name + '(') ? 'async ' : '') + between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const fnOpt = (name) => (html.includes('function ' + name + '(') ? fn(name) : '');
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const out = (v) => JSON.parse(JSON.stringify(v));

const BASE = json('menu_current.json').menu;
// The two Wk2 dinners Jason swapped, found by name wherever they are: A Arroz con Pollo, B the sausage dinner. The checks
// below swap A <-> B, so A's day receives the sausages with their halal line and soft plate.
const P = 'dinner';
const dayOf = (re) => { const d = Object.keys(BASE['2']).filter((k) => re.test(BASE['2'][k][P] || '')); assert.equal(d.length, 1, String(re)); return d[0]; };
const A = { week: '2', day: dayOf(/^Arroz Con Pollo/), period: P }, B = { week: '2', day: dayOf(/^Sausages, Roasted Potatoes/), period: P };
const at = (s) => BASE[s.week][s.day];
const DATES = { THURSDAY: '2026-11-05', FRIDAY: '2026-11-06' };

const HELPERS = [
  between('const FLAG_DEFS = [', '\n];\n') + '\n];\n', fn('flagsToMenuAllergens'),
  lineOf('const DOOR_KITCHEN_ALT_FIELDS = '), between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n',
  fn('doorEmptyDishParts'), fn('doorSetMealFlags'),
  between('const DOOR_MEAL_FIELDS = ', '\nfunction doorKitchenAlternatives(') + '\n', fnOpt('doorStableJSON'),
  between('const SM_ALLERGENS = [', '\n];\n') + '\n];\n', fn('doorDatedMealFlags'), fn('doorApplyDatedMeal'),
  fn('mergeDoorMenuDataWithOverlay'), fn('dayLabel'),
].join('\n');

// The menu screens, run for real against a store of the overlay and the swaps.
function box(store, extra = {}) {
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, value: '', checked: false, style: {}, innerHTML: '', textContent: '' }));
  const b = Object.assign({
    console, document: { getElementById: el }, Date, alert() {},
    mcEditKey: null, mealSwaps: {}, REVERTED_SWAP_KEYS: new Set(),
    getMenuData: () => out(BASE), MENU_DATA: {}, loadUploadedMenu: () => out(BASE),
    loadMenuBaseOverlay: () => out(store.overlay), saveMenuBaseOverlay: (o) => { store.overlay = out(o); },
    loadMealSwaps: () => out(store.swaps || {}), saveMealSwaps: (s) => { store.swaps = out(s); },
    loadSpecialMeals: () => out(store.specials || {}), saveSpecialMeals: (s) => { store.specials = out(s); },
    doorSwapKeysForSlot: (w, d, p, sw) => Object.keys(sw || store.swaps || {}).filter((k) => k === DATES[d] + '-' + p),
    doorSlotSwapDates: (slots) => slots.map((s) => new Date(DATES[s.day] + 'T12:00:00')),
    getSundayStart: (d) => new Date(d), doorRotationWeekOf: () => 2, nextDateForSlot: (w, d) => new Date(DATES[d] + 'T12:00:00'),
    doorDateKey: (d) => d.toISOString().slice(0, 10), formatShortDate: () => '', getSelectedSite: () => 'rexdale',
    getMealForDate: (d) => ({ week: 2, day: Object.keys(DATES).find((k) => DATES[k] === d.toISOString().slice(0, 10)) }),
    guardStandardMenuWrite: () => true, doorAsk: async () => true, loadMenuEdits: () => ({}), saveMenuEdits() {},
    logMenuEvent() {}, showToast() {}, renderMenuConfig() {}, renderTodayMealContext() {}, publishAndSync() {},
    getOperatorName: () => 'Jason', appendChangeLog() {}, location: { hash: '' },
  }, extra);
  vm.createContext(b);
  vm.runInContext([HELPERS, fn('executeSlotSwap'), fn('makePermanent'), fn('makeSwapPermanentFromBanner')].join('\n'), b,
    { filename: 'index.html#slot-swap', timeout: 5000 });
  b.__els = els;
  return b;
}
const merged = (overlay) => out(vm.runInNewContext(fn('mergeDoorMenuDataWithOverlay') + ';mergeDoorMenuDataWithOverlay(B, O)', { B: BASE, O: overlay }));
const MEAL_KEYS = (d) => Object.keys(d).filter((k) => (k.startsWith(P) && !k.endsWith('_original')) || k === 'allergens_' + P).sort();
const mealOf = (d) => Object.fromEntries(MEAL_KEYS(d).map((k) => [k, d[k]]));
// The parts that matter on the floor: the moved meal must bring each one it has.
const PARTS = ['_halal', '_softAlt', '_altMeals', '_altMealsNone', '_slots', '_mainItem', '_sides'];
function assertWhole(got, want, label) {
  for (const k of [''].concat(['_veg'], PARTS)) assert.deepEqual(got[P + k] ?? null, want[P + k] ?? null, `${label}: ${P}${k}`);
}

function swapStore() { return { overlay: out(json('menu_overlay.json')), swaps: {} }; }
function slotSwap(store) { const b = box(store); b.executeSlotSwap(A, B); return b; }

test('the meals carry parts a swap could lose', () => {
  assert.ok(at(B).dinner_halal && at(B).dinner_softAlt && at(B).dinner_slots, 'the sausage dinner has a halal line, a soft plate and slots');
  assert.equal(at(A).dinner_altMealsNone, true, 'Arroz con Pollo needs no soft plate');
});

test('1. Swap Slots stores each half\'s whole meal', () => {
  const store = swapStore();
  slotSwap(store);
  const thu = store.swaps[DATES[A.day] + '-' + P], fri = store.swaps[DATES[B.day] + '-' + P];
  assert.ok(thu && fri, 'both halves are stored');
  assert.equal(thu.specialName, at(B).dinner, 'Arroz\'s day gets the sausage dinner');
  assert.ok(thu._meal, 'that half carries the whole meal');
  assert.equal(thu._meal._halal, at(B).dinner_halal, 'with its halal line');
  assert.equal(thu._meal._softAlt, at(B).dinner_softAlt, 'its soft plate');
  assert.deepEqual(thu._meal._slots, at(B).dinner_slots, 'and its slots, recipe links included');
  assert.equal(fri._meal && fri._meal._altMealsNone, true, 'the other half (Arroz) keeps "no soft plate needed"');
});

test('2. a one-time slot swap reaches the day whole', () => {
  const store = swapStore();
  slotSwap(store);
  const b = box(store);
  for (const [slot, from] of [[A, B], [B, A]]) {
    const entry = store.swaps[DATES[slot.day] + '-' + P];
    const day = out(b.doorApplyDatedMeal(at(slot), P, { name: entry.specialName, entry }));
    assertWhole(day, at(from), `${slot.day} on ${DATES[slot.day]}`);
    assert.equal(day['allergens_' + P], at(from)['allergens_' + P], `${slot.day}: the allergen line is the moved meal's`);
    assert.equal(day.lunch, at(slot).lunch, `${slot.day}: lunch is untouched`);
  }
});

test('3. Make Permanent from the banner writes the moved meal whole', async () => {
  const store = swapStore();
  slotSwap(store);
  for (const slot of [A, B]) await box(store).makeSwapPermanentFromBanner(DATES[slot.day] + '-' + P);
  const m = merged(store.overlay)['2'];
  assertWhole(m[A.day], at(B), 'Wk2 ' + A.day + ' dinner');
  assertWhole(m[B.day], at(A), 'Wk2 ' + B.day + ' dinner');
  assert.deepEqual(m[A.day].dinner_flags, at(B).dinner_flags);
  assert.deepEqual(m[B.day].dinner_flags, at(A).dinner_flags);
});

test('4. Make Permanent from the meal panel writes it whole, with the panel\'s change on top', async () => {
  const store = swapStore();
  const b = slotSwap(store);
  const moved = at(B);
  const p = box(store, { mcEditKey: '2-' + A.day + '-dinner', mealSwaps: b.mealSwaps });
  p.__els['mc-swap-name'] = { value: moved.dinner };
  p.__els['mc-swap-veg'] = { value: 'Vegan Sausages, Mashed Potato' };
  p.__els['mc-swap-softalt'] = { value: '' };
  vm.runInContext('FLAG_DEFS', p).forEach((f) => { p.__els['mc-flag-' + f.key] = { checked: !!(moved.dinner_flags || {})[f.key] }; });
  await p.makePermanent();
  const d = merged(store.overlay)['2'][A.day];
  assert.equal(d.dinner_veg, 'Vegan Sausages, Mashed Potato', 'the panel\'s vegan line wins');
  for (const k of PARTS) assert.deepEqual(d[P + k] ?? null, moved[P + k] ?? null, 'the rest of the meal comes whole: ' + k);
  assert.deepEqual(d.dinner_flags, moved.dinner_flags);
});

test('5. a typed swap brings only its words and ticks; a whole meal under another name is never read', () => {
  const b = box(swapStore());
  const typed = { specialName: 'Halal Beef Burger', veg: 'Veggie Burger', _flagsRaw: { hasBeef: true, hasGluten: true } };
  const t = out(b.doorApplyDatedMeal(at(B), P, { name: typed.specialName, entry: typed }));
  assert.equal(t.dinner, 'Halal Beef Burger');
  assert.equal(t.dinner_halal ?? '', '', 'no halal line of the rotation dish');
  assert.equal(t.dinner_softAlt ?? '', '', 'no soft plate of the rotation dish');
  const renamed = { ...typed, _meal: vm.runInContext('doorMealCopy', b)(at(B), P) };
  const r = out(b.doorApplyDatedMeal(at(A), P, { name: renamed.specialName, entry: renamed }));
  assert.equal(r.dinner, 'Halal Beef Burger');
  assert.equal(r.dinner_halal ?? '', '', 'the sausages\' parts never ride on a burger');
});

test('6. a special meal that displaces the rotation meal moves the displaced meal whole', () => {
  const body = fn('saveSpecialMeal');
  const i = body.indexOf("specialName: origMeal.name || '(rotation meal)'");
  assert.ok(i >= 0, 'the displace branch');
  assert.match(body.slice(i, i + 600), /_meal: doorMealCopy\(/, 'the displaced entry carries the whole rotation meal');
});
