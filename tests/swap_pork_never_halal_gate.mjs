// tests/swap_pork_never_halal_gate.mjs — a swap carries each meal's own ticks, and a pork meal is never halal-certified
// wherever it is copied (2026-11-17, EXPO walkthrough finding A2-P1-1; Jason ruled EXPO ships its own guard and DOOR
// its half in a paired PR).
// DOOR's Swap Slots of Wk4 THU lunch (beef lasagna) <-> Wk4 FRI lunch (Pork Tacos Al Pastor), on the 2026-11-17
// publication, wrote a meal_swaps.json half for Nov 19 that is the pork meal with `halalCertifiedMeat: true`, in both
// `_flagsRaw` and `_meal._flags`. EXPO plans a meal's halal plate only when the meal is not marked halal-certified, so on
// Nov 19 EXPO and HUB planned no "Halal chicken al pastor" while DOOR routed 56 halal plates.
// Where it came from: not the other slot. The swap copies each slot's own ticks. Wk4 FRI lunch's own stored ticks in the
// overlay (menu_overlay.json) held the mark, left from the Nov 11 week sheet that replaced a beef lasagna with the pork
// tacos. Only the menu export cleared a pork meal's mark (buildMenuJSON), so menu_current.json read false; Swap Slots reads
// the menu as read (getMenuData), which did not. `hasChicken` on the pork half is FRI's own (its halal chicken line), as in
// menu_current.json.
// Checks, running index.html's own code:
//   1. the menu as read never marks a pork meal halal-certified, and never changes the stored menu
//   2. Swap Slots: each half carries its own meal's ticks (name, hasChicken, hasBeef...), and the pork half is not
//      halal-certified in `_flagsRaw` or `_meal._flags`; the lasagna half keeps its own mark
//   3. a swap stored before the fix is read, saved and planted without the mark (load, save, the plating reader, the whole
//      meal written back, Make Permanent's tick writer)
//   4. what a publish sends: swaps and special meals from this computer and the kitchen file, without the mark
// Authored red on DOOR main ef8cca3 (2, 3, 4; 1 too). Env: PORK_HALAL_ROOT (another checkout's directory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.PORK_HALAL_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return (html.includes('async function ' + name + '(') ? 'async ' : '') + between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const fnOpt = (name) => (html.includes('function ' + name + '(') ? fn(name) : '');
const out = (v) => JSON.parse(JSON.stringify(v));

// The two meals as they stood on the 2026-11-17 publication (conc-kitchen-expo
// docs/walkthrough_2026-11-17/door_constructed/newdish): the ticks that are on, the halal line, a slot each.
const on = (...keys) => Object.fromEntries(keys.map((k) => [k, true]));
const LASAGNA = on('hasGluten', 'hasDairy', 'hasBeef', 'isCarb', 'halalCertifiedMeat', 'hasNightshades');
const TACOS_PUBLISHED = on('hasGluten', 'hasSulphites', 'hasPork', 'hasChicken', 'isSpicy', 'isCarb', 'hasNightshades');
const TACOS_STORED = { ...TACOS_PUBLISHED, halalCertifiedMeat: true };   // the overlay's stale mark
const THU = { lunch: 'Beef lasagna, Zucchini & Carrot', lunch_veg: 'Veggie lasagna, Zucchini & Carrot', lunch_halal: '',
  lunch_mainItem: 'Beef lasagna', lunch_sides: 'Zucchini & Carrot', lunch_flags: LASAGNA, lunch_slots: { main: { manual: 'Beef lasagna' } } };
const FRI = { lunch: 'Pork Tacos Al Pastor, Pea & Carrots', lunch_veg: 'Vegetarian Tacos, Pea & Carrots',
  lunch_halal: 'Halal chicken al pastor', lunch_mainAlt: 'Halal chicken al pastor', lunch_mainItem: 'Pork Tacos Al Pastor',
  lunch_sides: 'Pea & Carrots', lunch_flags: TACOS_PUBLISHED,
  lunch_slots: { main: { recipeName: 'Pork Al Pastor', recipeId: 'pork-al-pastor' }, mainalt: { recipeName: 'Chicken Al Pastor', displayText: 'Halal chicken al pastor' } } };
const BASE = { '4': { THURSDAY: THU, FRIDAY: FRI } };
const OVERLAY = { '4': { THURSDAY: { lunch: THU.lunch, lunch_flags: LASAGNA }, FRIDAY: { lunch: FRI.lunch, lunch_flags: TACOS_STORED } } };
const A = { week: '4', day: 'THURSDAY', period: 'lunch' }, B = { week: '4', day: 'FRIDAY', period: 'lunch' };
const DATES = { THURSDAY: '2026-11-19', FRIDAY: '2026-11-20' };

const HELPERS = [
  between('const FLAG_DEFS = [', '\n];\n') + '\n];\n', fn('flagsToMenuAllergens'), fn('emptyMealFlags'),
  between('const DOOR_KITCHEN_ALT_FIELDS = ', '\n') + '\n', between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n',
  fn('doorEmptyDishParts'),
  fnOpt('doorPorkNeverHalal'), fnOpt('doorDatedEntryPorkNeverHalal'), fnOpt('doorDatedStorePorkNeverHalal'), fnOpt('doorMenuPorkNeverHalal'),
  fn('doorSetMealFlags'), between('const DOOR_MEAL_FIELDS = ', '\nfunction doorMealSig(') + '\n', fn('doorWriteMealCopy'), fn('doorSwapWholeMeal'),
  between('const SM_ALLERGENS = [', '\n];\n') + '\n];\n', fn('doorDatedMealFlags'), fn('doorApplyDatedMeal'),
  fn('mergeDoorMenuDataWithOverlay'), between('const DOOR_BRASSICA_RE = ', '\n') + '\n', fn('doorApplyTextDetectedFlags'),
  fn('getMenuData'), fn('dayLabel'), fn('executeSlotSwap'),
  fn('loadMealSwaps'), fn('saveMealSwaps'), fn('loadSpecialMeals'), fn('saveSpecialMeals'), fn('doorPublishCapture'),
].join('\n');

function box(store) {
  const ls = store.ls || (store.ls = {});
  const b = {
    console, Date, JSON, Object, Array, Set,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    PublishAuth: { sidePublish: (f, text) => { (store.sent || (store.sent = {}))[f] = JSON.parse(text); } },
    MENU_DATA: {}, loadUploadedMenu: () => out(BASE), getDoorPublishMenuOverlayOverride: () => null,
    loadMenuBaseOverlay: () => out(store.overlay || OVERLAY), mealSwaps: {},
    doorSlotSwapDates: (slots) => slots.map((s) => new Date(DATES[s.day] + 'T12:00:00')),
    getSundayStart: (d) => new Date(d), doorRotationWeekOf: () => 4, nextDateForSlot: (w, d) => new Date(DATES[d] + 'T12:00:00'),
    doorDateKey: (d) => new Date(d).toISOString().slice(0, 10), formatShortDate: () => '', getSelectedSite: () => 'rexdale',
    logMenuEvent() {}, showToast() {}, renderTodayMealContext() {},
    doorMergeSwapReverts: () => ({}), doorMergeSwapStores: (local, cloud) => Object.assign({}, cloud || {}, local || {}),
    doorMergeMenuOverlayWithCloud: () => ({ merged: {} }), doorOutboxRead: () => [], doorFlowRecipeInput: () => null,
  };
  vm.createContext(b);
  vm.runInContext(HELPERS, b, { filename: 'index.html#pork-never-halal', timeout: 5000 });
  return b;
}
// A swap stored before the fix, as the Nov 17 publication wrote it.
const BAD_SWAP = () => ({
  '2026-11-19-lunch': { specialName: FRI.lunch, veg: FRI.lunch_veg, _flagsRaw: { ...TACOS_STORED },
    _meal: { '': FRI.lunch, _veg: FRI.lunch_veg, _halal: FRI.lunch_halal, _flags: { ...TACOS_STORED } }, _rotationSlot: '4-THURSDAY-lunch' },
  '2026-11-20-lunch': { specialName: THU.lunch, veg: THU.lunch_veg, _flagsRaw: { ...LASAGNA },
    _meal: { '': THU.lunch, _veg: THU.lunch_veg, _flags: { ...LASAGNA } }, _rotationSlot: '4-FRIDAY-lunch' },
});
const notHalal = (f, label) => { assert.ok(f && f.hasPork, label + ': is the pork meal'); assert.notEqual(f.halalCertifiedMeat, true, label + ': a pork meal is never halal-certified'); };
const same = (got, want, label) => { const k = (f) => Object.keys(f || {}).filter((x) => f[x]).sort(); assert.deepEqual(k(got), k(want), label); };

test('the case: the overlay holds the stale mark the published menu does not', () => {
  assert.equal(OVERLAY['4'].FRIDAY.lunch_flags.halalCertifiedMeat, true);
  assert.notEqual(FRI.lunch_flags.halalCertifiedMeat, true);
});

test('1. the menu as read never marks a pork meal halal-certified, and leaves the stored menu as it is', () => {
  const store = {};
  const b = box(store);
  const menu = b.getMenuData();
  notHalal(menu['4'].FRIDAY.lunch_flags, 'Wk4 FRI lunch as read');
  assert.equal(menu['4'].THURSDAY.lunch_flags.halalCertifiedMeat, true, 'the beef lasagna keeps its own mark');
  assert.equal(menu['4'].FRIDAY.lunch_flags.hasChicken, true, 'and nothing else moves');
  assert.equal(OVERLAY['4'].FRIDAY.lunch_flags.halalCertifiedMeat, true, 'the stored overlay is not mutated');
});

test('2. Swap Slots: each half carries its own meal and ticks; the pork half is not halal-certified', () => {
  const store = {};
  const b = box(store);
  b.executeSlotSwap(A, B);
  const swaps = JSON.parse(store.ls.concMealSwaps);
  const thu = swaps['2026-11-19-lunch'], fri = swaps['2026-11-20-lunch'];
  assert.ok(thu && fri, 'both halves are stored');
  assert.equal(thu.specialName, FRI.lunch, 'Nov 19 gets the pork tacos');
  assert.equal(fri.specialName, THU.lunch, 'Nov 20 gets the beef lasagna');
  notHalal(thu._flagsRaw, 'Nov 19 _flagsRaw');
  notHalal(thu._meal && thu._meal._flags, 'Nov 19 _meal._flags');
  same(thu._flagsRaw, TACOS_PUBLISHED, 'the pork half carries the pork meal own ticks, hasChicken included (its halal line), and no other');
  same(thu._meal._flags, TACOS_PUBLISHED, 'the whole meal carries the same ticks');
  assert.equal(thu._meal._halal, 'Halal chicken al pastor', 'and its halal line');
  same(fri._flagsRaw, LASAGNA, 'the lasagna half carries the lasagna own ticks, its halal-certified mark included');
  same(fri._meal._flags, LASAGNA, 'in its whole meal too');
  assert.notEqual(fri._flagsRaw.hasPork, true, 'no pork crosses to the lasagna');
  notHalal(store.sent['meal_swaps.json']['2026-11-19-lunch']._meal._flags, 'the side publish');
});

test('2b. a typed swap already on a slot moves without the mark too', () => {
  const store = {};
  const b = box(store);
  b.mealSwaps['4-FRIDAY-lunch'] = { name: 'Pork Souvlaki', veg: '', flags: { hasPork: true, halalCertifiedMeat: true }, meal: null };
  b.executeSlotSwap(A, B);
  const thu = JSON.parse(store.ls.concMealSwaps)['2026-11-19-lunch'];
  notHalal(thu._flagsRaw, 'typed swap _flagsRaw');
});

test('3. a swap stored before the fix is read, saved and planted without the mark', () => {
  const store = { ls: { concMealSwaps: JSON.stringify(BAD_SWAP()), concSpecialMeals: JSON.stringify(BAD_SWAP()) } };
  const b = box(store);
  const read = b.loadMealSwaps();
  notHalal(read['2026-11-19-lunch']._flagsRaw, 'loadMealSwaps _flagsRaw');
  notHalal(read['2026-11-19-lunch']._meal._flags, 'loadMealSwaps _meal._flags');
  assert.equal(read['2026-11-20-lunch']._flagsRaw.halalCertifiedMeat, true, 'the lasagna keeps its mark');
  notHalal(b.loadSpecialMeals()['2026-11-19-lunch']._meal._flags, 'loadSpecialMeals');
  b.saveMealSwaps(BAD_SWAP());
  notHalal(JSON.parse(store.ls.concMealSwaps)['2026-11-19-lunch']._flagsRaw, 'saveMealSwaps stores');
  notHalal(store.sent['meal_swaps.json']['2026-11-19-lunch']._meal._flags, 'saveMealSwaps publishes');
  b.saveSpecialMeals(BAD_SWAP());
  notHalal(store.sent['special_meals.json']['2026-11-19-lunch']._flagsRaw, 'saveSpecialMeals publishes');
  const entry = BAD_SWAP()['2026-11-19-lunch'];
  notHalal(b.doorDatedMealFlags(entry), 'the plating reader (doorDatedMealFlags)');
  const typed = { ...entry }; delete typed._meal;
  notHalal(out(b.doorApplyDatedMeal(THU, 'lunch', { name: entry.specialName, entry: typed })).lunch_flags, 'a typed swap reaching the day');
  notHalal(out(b.doorApplyDatedMeal(THU, 'lunch', { name: entry.specialName, entry })).lunch_flags, 'the whole meal written back');
  const day = {}; b.doorSetMealFlags(day, 'lunch', { ...TACOS_STORED });
  notHalal(day.lunch_flags, 'Make Permanent and Edit Flags write through doorSetMealFlags');
  assert.doesNotMatch(day.allergens_lunch || '', /halal/i, 'and its allergen line says no halal');
});

test('4. a publish sends swaps and special meals without the mark, from this computer or the kitchen file', () => {
  const store = { ls: { concMealSwaps: JSON.stringify(BAD_SWAP()) } };
  const b = box(store);
  const revision = { paths: {}, data: { 'meal_swaps.json': {}, 'special_meals.json': BAD_SWAP(), 'custom_tag_rules.json': [], 'learned_nr.json': {} } };
  const inputs = b.doorPublishCapture(revision);
  notHalal(inputs.swaps['2026-11-19-lunch']._meal._flags, 'published swap (this computer)');
  notHalal(inputs.specials['2026-11-19-lunch']._flagsRaw, 'published special meal (the kitchen file)');
  assert.equal(inputs.swaps['2026-11-20-lunch']._meal._flags.halalCertifiedMeat, true, 'the lasagna keeps its mark');
});
