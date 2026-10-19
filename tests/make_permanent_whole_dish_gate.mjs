// tests/make_permanent_whole_dish_gate.mjs — a permanent menu change brings the new dish whole (2026-10-19).
// Found while copying the kitchen's alternatives (v31-standard.41): both Make Permanent paths (the meal panel's swap tab,
// makePermanent, and the Active Swaps banner, makeSwapPermanentFromBanner) DELETED the old dish's parts from the menu
// overlay. Every DOOR computer's base menu is the last published menu_current.json (pulled into concUploadedMenu), and
// the overlay is laid over it field by field, so the deleted parts came straight back:
//   - the plating sheet kept printing the old dish: its main item and sides outrank the new name ("Caribbean Chicken
//     Curry, Naan" on a meal made "Beef Burger, Side Salad"), and the halal plate read "Halal Caribbean Chicken Curry";
//   - the old dish's slots stayed, with their recipe links (EXPO and HUB read them) and the old vegan dish's allergens
//     on the vegan plate; the old halal line stayed too;
//   - the overlay's allergen line kept the old dish's, and the publish check stopped on it (overlay-menu-conflict, never
//     overridable): no publish went out, resident list included. An Edit Menu or Edit Flags tick change did the same.
// Jason, 2026-10-19: "Do this task here". Checks, on the published menu and overlay:
//   1. Make Permanent (meal panel): the merged day is the new dish, every part of the old one empty, its allergen line
//      the new ticks'; the plating sheet prints the new dish, with nothing of the old dish's on its plates
//   2. the banner's Make Permanent does the same with the swap's dish
//   3. Restore the original (before the next sync, while the base still holds it) brings back every part
//   4. every overlay writer of a meal's ticks writes the allergen line with them
//   5. the publish check: an older allergen line in the overlay stops nothing; a contradictory dish still stops
//   6. one list of a dish's parts: a swap drops the same ones, and DOOR reads the empty values as none
// Authored to fail on 4bedd9d (1–6). Env: MAKE_PERMANENT_ROOT (another checkout's directory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.MAKE_PERMANENT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return (html.includes('async function ' + name + '(') ? 'async ' : '') + between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const has = (name) => html.includes('function ' + name + '(');
const fnOpt = (name) => (has(name) ? fn(name) : '');
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const out = (v) => JSON.parse(JSON.stringify(v));
const PARTS_SRC = lineOf('const DOOR_KITCHEN_ALT_FIELDS = ')
  + (html.includes('const DOOR_DISH_PART_EMPTY = ') ? between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n' : '');
// Re-pinned 2026-10-19 (v31-standard.43, Jason: "A"): Make Permanent keeps the meal as it was before its first change
// and Restore puts that copy back (tests/restore_original_gate.mjs), so the box carries the copy helpers.
const COPY_SRC = html.includes('const DOOR_MEAL_FIELDS = ') ? between('const DOOR_MEAL_FIELDS = ', '\nfunction doorKitchenAlternatives(') + '\n' : '';
const MENU_HELPERS = [PARTS_SRC, fnOpt('doorEmptyDishParts'), fnOpt('doorSetMealFlags'), fnOpt('doorClearOverlayMeal'), COPY_SRC, fnOpt('doorStableJSON'),
  fn('flagsToMenuAllergens'), fn('mergeDoorMenuDataWithOverlay'), fn('dayLabel'), between('const FLAG_DEFS = [', '\n];\n') + '\n];\n'].join('\n');

// The parts of a meal's dish, as a swap dropped them before this change (doorApplyDatedMeal, v31-standard.41).
const DISH_PARTS = ['_mainItem', '_mainAlt', '_sides', '_halal', '_softAlt', '_noPorkAlt', '_gfAlt', '_altMeals', '_altMealsNone', '_slots',
  '_diabeticAlt', '_noDairyAlt', '_blandAlt', '_noEggAlt', '_anaphAlt'];
const EMPTY = (k) => (k === '_altMeals' ? [] : k === '_altMealsNone' ? false : k === '_slots' ? null : '');

const PUBLISHED = json('menu_current.json');
const BASE = PUBLISHED.menu;                 // every DOOR computer's base menu: the last published one
const OVERLAY = json('menu_overlay.json');
const W = '3', D = 'TUESDAY', P = 'dinner';  // Caribbean Chicken Curry, Naan: linked slots, a halal plate, the kitchen's plates
const NEW = { name: 'Beef Burger, Side Salad', veg: 'Veggie Burger, Side Salad', ticks: ['hasBeef', 'hasGluten'] };

// The menu screens' Make Permanent and Restore, run for real against a store of the overlay and swaps.
function menuBox(store) {
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, value: '', checked: false }));
  const box = {
    console, document: { getElementById: el },
    mcEditKey: W + '-' + D + '-' + P, mealSwaps: {}, REVERTED_SWAP_KEYS: new Set(),
    guardStandardMenuWrite: () => true, doorAsk: async () => true, alert() {},
    loadMenuBaseOverlay: () => out(store.overlay), saveMenuBaseOverlay: (o) => { store.overlay = out(o); },
    loadMealSwaps: () => out(store.swaps || {}), saveMealSwaps: (s) => { store.swaps = out(s); },
    doorSwapKeysForSlot: () => [], loadMenuEdits: () => ({}), saveMenuEdits() {},
    logMenuEvent() {}, showToast() {}, renderMenuConfig() {}, publishAndSync() {},
    nextDateForSlot: () => null, formatShortDate: () => '', getMealForDate: () => ({ week: Number(W), day: D }),
    // 2026-10-19 (v31-standard.43): the copy reads the stored meal (the base under the overlay) and goes in the change log.
    MENU_DATA: {}, loadUploadedMenu: () => out(BASE), getOperatorName: () => 'Jason', appendChangeLog() {}, location: { hash: '' },
  };
  vm.createContext(box);
  vm.runInContext([MENU_HELPERS, fn('makePermanent'), fn('makeSwapPermanentFromBanner'), fn('revertMealSwap')].join('\n'), box,
    { filename: 'index.html#make-permanent', timeout: 5000 });
  box.__els = els;
  return box;
}
async function makePermanentOnPanel(store, soft = '') {
  const box = menuBox(store);
  box.__els['mc-swap-name'] = { value: NEW.name };
  box.__els['mc-swap-veg'] = { value: NEW.veg };
  box.__els['mc-swap-softalt'] = { value: soft };
  vm.runInContext('FLAG_DEFS', box).forEach((f) => { box.__els['mc-flag-' + f.key] = { checked: NEW.ticks.includes(f.key) }; });
  await box.makePermanent();
  return box;
}
const merged = (store) => out(vm.runInNewContext(fn('mergeDoorMenuDataWithOverlay') + ';mergeDoorMenuDataWithOverlay(B, O)', { B: BASE, O: store.overlay }));
const newTicksLine = () => vm.runInNewContext(fn('flagsToMenuAllergens') + `;flagsToMenuAllergens(${JSON.stringify(Object.fromEntries(NEW.ticks.map((k) => [k, true])))})`);

// The plating sheet, as routing_replay_gate runs it: the real computePlatingData over a given menu.
function platingBox(menu) {
  const state = json('door_state.json');
  const c = { console, REGISTRY_LIST: state.residents.map((r) => ({ ...r })), anaphRooms: [...state.anaphRooms], DOOR_RECIPE_DATA: null,
    getMenuData: () => menu, loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}) };
  vm.createContext(c);
  vm.runInContext([
    html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0], lineOf('const DOOR_RECIPE_DATA_FALLBACK = '),
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
    between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    fn('formatConflictNote'), fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fn('getAnaphConflictRooms'),
    between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', fn('flagsToAllergenStr'), fn('emptyMealFlags'), fn('hasCarbAccommodation'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between('const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'),
    'this.doorDatedMealFor = () => null;', PARTS_SRC, fnOpt('doorKitchenAlternatives'), fnOpt('doorAddKitchenPlateFlags'), fnOpt('doorRegularServiceNote'),
    fn('getAltMeal'), fn('computePlatingData'),
  ].join('\n'), c, { filename: 'index.html#make-permanent-plating', timeout: 30000 });
  return c;
}
const tokens = (s) => new Set(String(s || '').split(',').map((t) => t.trim().toUpperCase()).filter(Boolean));

test('1. Make Permanent writes the new dish whole; the plating sheet prints it, with nothing of the old dish on its plates', async () => {
  const before = BASE[W][D];
  assert.ok(before[P + '_slots'] && before[P + '_mainItem'] && before[P + '_sides'] && before[P + '_anaphAlt'], 'the published meal has parts to lose');
  const store = { overlay: out(OVERLAY) };
  await makePermanentOnPanel(store);
  const day = merged(store)[W][D];
  assert.equal(day[P], NEW.name);
  for (const k of DISH_PARTS) assert.deepEqual(day[P + k], EMPTY(k), `the old dish's ${k} doesn't come back from the base menu`);
  assert.equal(day['allergens_' + P], newTicksLine(), 'the allergen line is the new ticks');
  // The sheet: the new dish's name, its halal plate, and the vegan plate without the old vegan dish's allergens.
  const menu = out(BASE); menu[W][D] = day;
  const pd = platingBox(menu).computePlatingData(P, W, D);
  assert.equal(pd.mealName, NEW.name, 'the sheet prints the new dish');
  assert.equal(pd.ctx.mealHalal, '', 'no halal line of the old dish');
  assert.doesNotMatch(vm.runInContext('getAltMeal("halal_alt", __ctx)', Object.assign(platingBox(menu), { __ctx: pd.ctx })), /Caribbean/);
  const oldVeg = platingBox(BASE).computePlatingData(P, W, D);
  const oldOnly = [...tokens(oldVeg.vegAllergenStr)].filter((t) => !tokens(pd.allergenStr).has(t));
  assert.ok(oldOnly.length > 0, 'the old vegan dish had allergens of its own: ' + oldVeg.vegAllergenStr);
  assert.deepEqual(oldOnly.filter((t) => tokens(pd.vegAllergenStr).has(t)), [], 'the vegan plate keeps none of them');
  // A soft alternative typed on the panel is the new dish's.
  const store2 = { overlay: out(OVERLAY) };
  await makePermanentOnPanel(store2, 'Plain chicken, rice');
  assert.equal(merged(store2)[W][D][P + '_softAlt'], 'Plain chicken, rice');
});

test('2. the Active Swaps banner\'s Make Permanent brings the swap\'s dish whole too', async () => {
  const key = '2026-11-03-' + P;
  const store = { overlay: out(OVERLAY), swaps: { [key]: { specialName: NEW.name, veg: NEW.veg, _flagsRaw: { hasBeef: true, hasGluten: true } } } };
  const box = menuBox(store);
  await box.makeSwapPermanentFromBanner(key);
  const day = merged(store)[W][D];
  assert.equal(day[P], NEW.name);
  for (const k of DISH_PARTS) assert.deepEqual(day[P + k], EMPTY(k), `the old dish's ${k}`);
  assert.equal(day['allergens_' + P], newTicksLine());
  assert.equal(store.swaps[key], undefined, 'the swap is gone');
});

test('3. Restore the original, before the next sync, brings back every part of the meal', async () => {
  const store = { overlay: out(OVERLAY) };
  const box = await makePermanentOnPanel(store);
  await box.revertMealSwap();
  const day = merged(store)[W][D], base = BASE[W][D];
  // Re-pinned 2026-10-19 (v31-standard.43): Restore writes the meal's saved copy back, every part written so it holds after
  // the next sync too, so a part the meal never had reads as its empty value: as DOOR reads it, none (test 6).
  const none = (v) => (v === undefined || v === null || v === '' || v === false || (typeof v === 'object' && !Object.keys(v).length) ? undefined : v);
  for (const k of ['', '_veg', '_flags', ...DISH_PARTS]) assert.deepEqual(none(day[P + k]), none(base[P + k]), `${P}${k} is the original's`);
  assert.equal(day['allergens_' + P], base['allergens_' + P]);
  assert.match(fn('revertMenuEdit'), /doorRestoreMealOriginal\(overlay, week, day, period\)/, 'Reset this meal puts back the same copy');
});

test('4. every overlay writer of a meal\'s ticks writes its allergen line with them', () => {
  for (const name of ['_finishMenuSave', 'saveEditFlags', 'makePermanent', 'makeSwapPermanentFromBanner']) {
    const body = fn(name);
    assert.match(body, /doorSetMealFlags\(/, name + ' writes the ticks with their allergen line');
    assert.doesNotMatch(body, /\[period \+ '_flags'\]\s*=/, name + ' writes no ticks on their own');
  }
  assert.equal(typeof has, 'function');
  const box = vm.createContext({});
  vm.runInContext(fn('flagsToMenuAllergens') + fnOpt('doorSetMealFlags'), box);
  assert.equal(typeof box.doorSetMealFlags, 'function', 'doorSetMealFlags');
  const day = { dinner_flags: { hasDairy: true }, allergens_dinner: 'dairy' };
  box.doorSetMealFlags(day, 'dinner', { hasMustard: true, hasGluten: true });
  assert.deepEqual(out(day), { dinner_flags: { hasMustard: true, hasGluten: true }, allergens_dinner: 'gluten, mustard' });
});

test('5. the publish check: an older allergen line in the overlay stops nothing; a contradictory dish still does', () => {
  const core = vm.createContext({ Array, JSON, Object, isFinite });
  vm.runInContext(between('/* DOOR_TESTABLE_CORE_START publish-validation */', '/* DOOR_TESTABLE_CORE_END publish-validation */'), core);
  const artifacts = (overlay) => ({ 'menu_current.json': PUBLISHED, 'registry_summary.json': json('registry_summary.json'),
    'routing_by_meal.json': json('routing_by_meal.json'), 'door_state.json': json('door_state.json'), 'menu_overlay.json': overlay });
  const stops = (overlay) => out(core.validateDoorPublishArtifacts(artifacts(overlay)).stop || []).map((s) => s.code + ':' + (s.details || {}).field);
  assert.deepEqual(stops(out(OVERLAY)), [], 'the published files pass');
  const older = out(OVERLAY);
  older[W][D]['allergens_' + P] = 'gluten, dairy, tree nuts, sulphites, peanuts';
  assert.deepEqual(stops(older), [], 'an older copy of a derived line is no contradiction');
  const contradictory = out(OVERLAY);
  contradictory[W][D][P] = 'Contradictory dinner';
  assert.deepEqual(stops(contradictory), ['overlay-menu-conflict:' + P], 'a contradictory dish still stops the send');
});

test('6. one list of a dish\'s parts: a swap drops the same ones, and DOOR reads the empty values as none', () => {
  assert.ok(html.includes('const DOOR_DISH_PART_EMPTY = '), 'DOOR_DISH_PART_EMPTY');
  const parts = out(vm.runInNewContext(PARTS_SRC + ';DOOR_DISH_PART_EMPTY'));
  assert.deepEqual(Object.keys(parts).sort(), DISH_PARTS.slice().sort());
  for (const k of DISH_PARTS) assert.deepEqual(parts[k], EMPTY(k), k);
  assert.match(fn('doorApplyDatedMeal'), /Object\.keys\(DOOR_DISH_PART_EMPTY\)\.forEach\(k => \{ delete d\[period \+ k\]; \}\);/, 'a swap drops the list');
  // DOOR's readers: no slots restore nothing and bring no allergens; empty text is no part.
  const r = vm.createContext({ MEAL_SLOT_STATE: {}, DOOR_RECIPE_DATA: [], DOOR_RECIPE_DATA_FALLBACK: [] });
  vm.runInContext(fn('_restoreSlotSnapshot') + fn('getVegAltSlotAllergenStr'), r);
  assert.equal(r._restoreSlotSnapshot(null), false);
  assert.equal(r.getVegAltSlotAllergenStr(null), '');
  assert.match(fn('computePlatingData'), /const mealMainItem\s+= dayData\[period\+'_mainItem'\] \|\| '';/, 'an empty main item is no main item');
});
