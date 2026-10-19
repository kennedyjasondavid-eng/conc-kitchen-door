// tests/restore_original_gate.mjs — putting a meal back means the meal as it was before its first change (2026-10-19).
// Jason, 2026-10-19, on what "the original" should mean: "A, go ahead and build it" (the meal before its first change).
// Revert to Original (the meal panel), Reset to Original (Edit Menu) and ↩ Undo Last deleted the change and fell back to
// the base menu. Every DOOR computer's base is the last published menu_current.json, and Make Permanent and Edit Menu's
// save publish at once, so from that computer's next load (and on every other computer) the base held the change:
// putting the meal back did nothing, the meal stopped reading as changed, and Reset's question named the changed meal on
// both sides. ↩ Undo Last cleared a legacy store the Edit Menu save no longer writes, so it never undid a meal change.
// Checks, on the published menu and overlay (Wk3 TUE dinner, Caribbean Chicken Curry, Naan):
//   1. Make Permanent keeps the meal as it was; after the publish and the next load, Revert to Original puts it all
//      back, names it, sends it, and the plating sheet prints it
//   2. the other computer, its base the published change, puts it back from the copy the overlay brought; the first
//      computer takes the restore at its next load
//   3. the banner's Make Permanent, Edit Menu's save and Edit Flags keep the copy; a later change keeps the first; a
//      meal changed back by hand drops it; Reset to Original puts it back and names it
//   4. ↩ Undo Last undoes only the latest change, from the copy saved with it; it refuses a meal that changed since,
//      and a change saved before the copies
//   5. no saved original: Revert to Original says so, changes nothing and offers Edit Menu
//   6. the copy stays DOOR's: never in menu_current.json, no publish stop, editor-only on the P4 list; the change log
//      keeps copies on its newest entries; a workbook import starts fresh
// Authored to fail on ce6a9fa (1–6). Env: RESTORE_ORIGINAL_ROOT (another checkout's directory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.RESTORE_ORIGINAL_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return (html.includes('async function ' + name + '(') ? 'async ' : '') + between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const out = (v) => JSON.parse(JSON.stringify(v));

const CORE = between('/* DOOR_TESTABLE_CORE_START publish-validation */', '/* DOOR_TESTABLE_CORE_END publish-validation */');
const PARTS_SRC = lineOf('const DOOR_KITCHEN_ALT_FIELDS = ') + between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n';
const COPY_SRC = html.includes('const DOOR_MEAL_FIELDS = ') ? between('const DOOR_MEAL_FIELDS = ', '\nfunction doorKitchenAlternatives(') + '\n' : '';
const MENU_SRC = [CORE, PARTS_SRC, fn('doorEmptyDishParts'), fn('doorSetMealFlags'), COPY_SRC,
  fn('flagsToMenuAllergens'), fn('mergeDoorMenuDataWithOverlay'), fn('dayLabel'), between('const FLAG_DEFS = [', '\n];\n') + '\n];\n',
  fn('appendChangeLog'), fn('makePermanent'), fn('makeSwapPermanentFromBanner'), fn('revertMealSwap'), fn('revertMenuEdit'),
  fn('saveEditFlags'), fn('_finishMenuSave'), fn('revertLastChange'), fn('buildMenuJSON')].join('\n');

const PUBLISHED = json('menu_current.json');
const BASE = PUBLISHED.menu;                 // every DOOR computer's base menu: the last published one
const OVERLAY = json('menu_overlay.json');
const W = '3', D = 'TUESDAY', P = 'dinner';  // Caribbean Chicken Curry, Naan
const ORIGINAL = BASE[W][D];
const NEW = { name: 'Beef Burger, Side Salad', veg: 'Veggie Burger, Side Salad', ticks: ['hasBeef', 'hasGluten'] };
const DISH_PARTS = ['_mainItem', '_mainAlt', '_sides', '_halal', '_softAlt', '_noPorkAlt', '_gfAlt', '_altMeals', '_altMealsNone', '_slots',
  '_diabeticAlt', '_noDairyAlt', '_blandAlt', '_noEggAlt', '_anaphAlt'];

// A meal as DOOR reads it: an empty part and a missing one are both none, and only the ticks that are on count.
function reads(day) {
  const o = {};
  for (const s of ['', '_veg', '_flags', ...DISH_PARTS]) {
    const v = day[P + s];
    if (s === '_flags') { const on = Object.keys(v || {}).filter((k) => v[k]).sort(); if (on.length) o[s] = on; continue; }
    if (v === undefined || v === null || v === '' || v === false || (typeof v === 'object' && !Object.keys(v).length)) continue;
    o[s] = v;
  }
  return JSON.stringify(o);
}
const asDay = (meal) => Object.fromEntries(Object.entries(meal || {}).map(([s, v]) => [P + s, v]));

const MERGE = vm.createContext({});
vm.runInContext(fn('mergeDoorMenuDataWithOverlay'), MERGE);
const mergedOf = (store) => out(MERGE.mergeDoorMenuDataWithOverlay(store.base, store.overlay));
const mealOf = (store) => mergedOf(store)[W][D];

// One DOOR computer: its base menu, its overlay, swaps, legacy edits and change log. Every save stamps its days, as the
// real saveMenuBaseOverlay does, on one clock for all computers, so the newest edit wins at the next load.
let CLOCK = Date.now() + 1000;
const computer = (over = {}) => Object.assign({ base: out(BASE), overlay: out(OVERLAY), swaps: {}, edits: {}, log: [],
  asked: [], alerts: [], toasts: [], published: [] }, over);
function makeBox(store, answers = []) {
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, value: '', checked: false, style: {}, textContent: '' }));
  const box = {
    console, document: { getElementById: el }, location: { hash: '' }, setTimeout() {},
    mcEditKey: W + '-' + D + '-' + P, mcMenuEditKey: W + '-' + D + '-' + P, mealSwaps: {}, REVERTED_SWAP_KEYS: new Set(),
    MENU_DATA: {}, loadUploadedMenu: () => out(store.base), DOOR_SCHEMA_VERSIONS: { menu_current: 32 },
    getMenuData: () => mergedOf(store), guardStandardMenuWrite: () => true,
    doorAsk: async (o) => { store.asked.push(out(o)); return answers.length ? answers.shift() : true; },
    alert: (m) => { store.alerts.push(String(m)); },
    loadMenuBaseOverlay: () => out(store.overlay),
    saveMenuBaseOverlay: (o) => { store.overlay = out(box.doorStampOverlayEdits(store.overlay, box.doorNormalizeMenuOverlay(o), ++CLOCK)); },
    loadMealSwaps: () => out(store.swaps), saveMealSwaps: (s) => { store.swaps = out(s); }, doorSwapKeysForSlot: (w, d, p, swaps) => Object.keys(swaps || {}),
    loadMenuEdits: () => out(store.edits), saveMenuEdits: (e) => { store.edits = out(e); }, getMenuEdit: (w, d, p) => store.edits[w + '-' + d + '-' + p] || null,
    loadChangeLog: () => out(store.log), saveChangeLog: (l) => { store.log = out(l); },
    getSelectedSite: () => 'rexdale', getOperatorName: () => 'Jason',
    logMenuEvent() {}, showToast: (m) => { store.toasts.push(String(m)); }, renderMenuConfig() {}, closeMenuEdit() {},
    closeMealEdit: () => { store.closedPanel = true; }, publishAndSync: (why) => { store.published.push(why); },
    nextDateForSlot: () => null, getMealForDate: () => ({ week: Number(W), day: D }),
    loadSpecialMeals: () => ({}), saveSpecialMeals() {}, renderRoutingTab() {}, doorAddKitchenPlateFlags: (f) => f,
    // Edit Menu's save, its editor holding the new dish
    buildVegAltFlags: () => ({}), flagsToAllergenStr: () => '', buildSoftAlt: () => '', buildAltMeals: () => [], ALT_MEALS_NONE: false,
    doorKitchenAltInputValues: () => ({ gfAlt: '', diabeticAlt: '', noDairyAlt: '', blandAlt: '', noEggAlt: '', anaphAlt: '' }),
    buildNoPorkAlt: () => '', buildMainItem: () => 'Beef Burger', buildMainAltItem: () => 'Halal Beef Burger', buildSides: () => 'Side Salad',
    _buildSlotSnapshot: () => ({ main: { manual: 'Beef Burger', flags: {} }, xtra: { manual: 'Side Salad', flags: {} } }),
  };
  vm.createContext(box);
  vm.runInContext(MENU_SRC, box, { filename: 'index.html#restore-original', timeout: 10000 });
  box.__els = els;
  return box;
}
async function makePermanentOnPanel(store) {
  const box = makeBox(store);
  box.__els['mc-swap-name'] = { value: NEW.name };
  box.__els['mc-swap-veg'] = { value: NEW.veg };
  box.__els['mc-swap-softalt'] = { value: '' };
  vm.runInContext('FLAG_DEFS', box).forEach((f) => { box.__els['mc-flag-' + f.key] = { checked: NEW.ticks.includes(f.key) }; });
  await box.makePermanent();
}
function editFlags(store, on) {
  const box = makeBox(store);
  vm.runInContext('FLAG_DEFS', box).forEach((f) => { box.__els['mc-ef-' + f.key] = { checked: on.includes(f.key) }; });
  box.saveEditFlags();
}
const ticksOn = (day) => Object.keys(day[P + '_flags'] || {}).filter((k) => day[P + '_flags'][k]);
// What a computer sends (menu_current.json from the menu export, menu_overlay.json), and what one takes at its next
// load: the overlay day by day (the newest edit wins) and the newer menu as its base.
const publish = (store) => ({ menu: out(makeBox(store).buildMenuJSON()), overlay: out(store.overlay) });
function load(store, sent) {
  store.overlay = out(makeBox(store).doorMergeMenuOverlayWithCloud(store.overlay, sent.overlay).merged);
  store.base = out(sent.menu.menu);
}

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
    'this.doorDatedMealFor = () => null;', PARTS_SRC, fn('doorKitchenAlternatives'), fn('doorAddKitchenPlateFlags'), fn('doorRegularServiceNote'),
    fn('getAltMeal'), fn('computePlatingData'),
  ].join('\n'), c, { filename: 'index.html#restore-original-plating', timeout: 30000 });
  return c;
}

test('1. Make Permanent keeps the meal as it was; after the publish and the next load, Revert to Original puts it all back', async () => {
  assert.equal(ORIGINAL[P], 'Caribbean Chicken Curry, Naan');
  const A = computer();
  await makePermanentOnPanel(A);
  assert.equal(mealOf(A)[P], NEW.name, 'the change is on the menu');
  const copy = A.overlay[W][D][P + '_original'];
  assert.ok(copy && copy.meal, 'the first change keeps the meal as it was');
  assert.equal(reads(asDay(copy.meal)), reads(ORIGINAL), 'the copy is the whole meal');
  assert.equal(copy.by, 'Jason');
  assert.equal(copy.how, 'Make Permanent');
  assert.ok(!isNaN(new Date(copy.at)), 'and when');
  // The change goes out, and the next load takes the published menu as the base: the base now holds the change.
  const sent = publish(A);
  load(A, sent);
  assert.equal(A.base[W][D][P], NEW.name, 'the base holds the change');
  await makeBox(A).revertMealSwap();
  const q = A.asked.at(-1);
  assert.equal(q.goLabel, 'Restore the original');
  assert.match(q.lines[0], /goes back to “Caribbean Chicken Curry, Naan”, as it was before it was changed on [A-Z][a-z]{2} \d{1,2} by Jason\./, 'it names the meal');
  const day = mealOf(A);
  assert.equal(reads(day), reads(ORIGINAL), 'the whole meal is back, after the load');
  assert.equal(day['allergens_' + P], ORIGINAL['allergens_' + P], 'with its allergen line');
  assert.equal(day[P + '_original'], undefined, 'the copy is dropped');
  assert.ok(A.published.includes('menu meal restored'), 'and the restore is sent');
  const restored = platingBox(mergedOf(A)).computePlatingData(P, W, D), before = platingBox(BASE).computePlatingData(P, W, D);
  assert.equal(restored.mealName, before.mealName, 'the plating sheet prints the original meal');
  assert.equal(restored.ctx.mealHalal, before.ctx.mealHalal, 'with its halal line');
});

test('2. the other computer puts it back from the copy the overlay brought; the first takes it at its next load', async () => {
  const A = computer();
  await makePermanentOnPanel(A);
  const B = computer();                    // this morning's menu and overlay
  load(B, publish(A));                     // B's next load: A's day and A's published menu
  assert.equal(mealOf(B)[P], NEW.name);
  assert.ok(B.overlay[W][D][P + '_original'], 'the copy came with the overlay');
  await makeBox(B).revertMealSwap();
  assert.equal(reads(mealOf(B)), reads(ORIGINAL), 'B puts the whole meal back, though its base holds the change');
  const sentB = publish(B);
  assert.equal(reads(sentB.menu.menu[W][D]), reads(ORIGINAL), 'B sends it');
  load(A, sentB);
  assert.equal(reads(mealOf(A)), reads(ORIGINAL), 'A takes it at its next load');
  assert.equal(A.overlay[W][D][P + '_original'], undefined, 'without the copy');
});

test('3. the banner, Edit Menu and Edit Flags keep the copy; a later change keeps the first; Reset to Original puts it back', async () => {
  // The Active Swaps banner's Make Permanent keeps the rotation meal as it was.
  const key = '2026-11-03-' + P;
  const S = computer({ swaps: { [key]: { specialName: NEW.name, veg: NEW.veg, _flagsRaw: { hasBeef: true, hasGluten: true } } } });
  await makeBox(S).makeSwapPermanentFromBanner(key);
  const first = S.overlay[W][D][P + '_original'];
  assert.ok(first && reads(asDay(first.meal)) === reads(ORIGINAL), 'the banner keeps it');
  // A later change keeps the first copy.
  editFlags(S, [...NEW.ticks, 'hasMustard']);
  assert.ok(mealOf(S)[P + '_flags'].hasMustard, 'the tick change is saved');
  assert.deepEqual(S.overlay[W][D][P + '_original'], first, 'a later change keeps the first copy');
  // Reset to Original, after the next load: it names the original and puts it back.
  load(S, publish(S));
  await makeBox(S).revertMenuEdit();
  const q = S.asked.at(-1);
  assert.equal(q.title, 'Reset this meal?');
  assert.match(q.lines[0], /^“Beef Burger, Side Salad” goes back to “Caribbean Chicken Curry, Naan”, as it was before it was changed/, q.lines[0]);
  assert.equal(reads(mealOf(S)), reads(ORIGINAL), 'Reset puts the whole meal back');
  assert.ok(S.published.includes('menu meal reset'), 'and sends it');
  // Edit Menu's save keeps it too.
  const E = computer();
  makeBox(E)._finishMenuSave(NEW.name, NEW.veg, { hasBeef: true, hasGluten: true });
  assert.equal(mealOf(E)[P], NEW.name);
  assert.equal(reads(asDay((E.overlay[W][D][P + '_original'] || {}).meal)), reads(ORIGINAL), 'Edit Menu keeps it');
  // So does Edit Flags alone, and a meal changed back by hand drops its copy: there is nothing to put back.
  const F = computer();
  editFlags(F, [...ticksOn(ORIGINAL), 'hasMustard']);
  assert.equal(reads(asDay((F.overlay[W][D][P + '_original'] || {}).meal)), reads(ORIGINAL), 'Edit Flags keeps it');
  editFlags(F, ticksOn(ORIGINAL));
  assert.equal(F.overlay[W][D][P + '_original'], undefined, 'back to the original by hand: no copy left');
  // Reset to Original is offered when the meal has a copy.
  assert.match(fn('openMenuEdit'), /const savedOriginal = dayData\[period \+ '_original'\];[\s\S]{0,200}revertBtn\.style\.display = \(existing \|\| \(savedOriginal && typeof savedOriginal === 'object'\)\)/);
});

test('4. ↩ Undo Last undoes only the latest change, from the copy saved with it', async () => {
  const U = computer();
  await makePermanentOnPanel(U);                       // change 1: the curry becomes the burger
  const afterFirst = reads(mealOf(U));
  editFlags(U, [...NEW.ticks, 'hasMustard']);          // change 2: a tick
  load(U, publish(U));
  assert.equal(U.log.filter((e) => e.type === 'permanent_edit').length, 2, 'both changes are in the change log');
  await makeBox(U).revertLastChange();
  assert.equal(reads(mealOf(U)), afterFirst, 'only the tick change is undone');
  assert.ok(U.overlay[W][D][P + '_original'], 'the meal keeps its original');
  assert.equal(U.log[0].type, 'undo');
  // The first change undone: the meal is its original again, and the copy goes.
  const V = computer();
  await makePermanentOnPanel(V);
  load(V, publish(V));
  await makeBox(V).revertLastChange();
  assert.match(V.asked.at(-1).lines.join(' '), /goes back to “Caribbean Chicken Curry, Naan”/);
  assert.equal(reads(mealOf(V)), reads(ORIGINAL), 'Undo Last puts the meal back');
  assert.equal(V.overlay[W][D][P + '_original'], undefined, 'and the copy goes');
  // The meal changed since: refused, nothing changes.
  const X = computer();
  await makePermanentOnPanel(X);
  X.overlay[W][D][P] = 'Another dinner';
  const xOverlay = out(X.overlay), xLog = out(X.log);
  await makeBox(X).revertLastChange();
  assert.equal(X.asked.at(-1).title, 'Can’t undo this change');
  assert.match(X.asked.at(-1).lines[0], /has changed since/);
  assert.deepEqual(X.overlay, xOverlay, 'the meal is left as it is');
  assert.deepEqual(X.log, xLog);
  // A change saved before DOOR kept copies: refused, nothing changes.
  const Y = computer({ log: [{ id: 1, type: 'permanent_edit', week: W, day: D, period: P, oldName: ORIGINAL[P], newName: NEW.name }] });
  const yOverlay = out(Y.overlay);
  await makeBox(Y).revertLastChange();
  assert.equal(Y.asked.at(-1).title, 'Can’t undo this change');
  assert.match(Y.asked.at(-1).lines[0], /saved before DOOR kept a copy/);
  assert.deepEqual(Y.overlay, yOverlay);
  assert.equal(Y.log.length, 1, 'nothing is logged as undone');
});

test('5. no saved original: Revert to Original says so, changes nothing and offers Edit Menu', async () => {
  // The published Wk3 TUE dinner: its ticks and alternatives were changed before DOOR kept copies (its name never was,
  // so the panel's old check, the name alone, skipped it without a word).
  const N = computer();
  assert.ok(Object.keys(N.overlay[W][D]).some((k) => k.startsWith(P + '_')) && !N.overlay[W][D][P + '_original'], 'changed, with no copy');
  const before = out(N.overlay);
  await makeBox(N, [false]).revertMealSwap();
  const q = N.asked.at(-1);
  assert.ok(q, 'Revert to Original says something, not nothing');
  assert.equal(q.title, 'No saved original');
  assert.match(q.lines[0], /^DOOR has no copy of Wk3 Tuesday dinner from before it was changed, so it can’t put it back\./);
  assert.equal(q.goLabel, 'Open in Edit Menu');
  assert.deepEqual(N.overlay, before, 'nothing changes');
  const box = makeBox(N, [true]);
  await box.revertMealSwap();
  assert.equal(box.location.hash, '#menu-config/edit/3/TUESDAY/dinner', 'Open in Edit Menu opens the meal there');
  assert.equal(N.closedPanel, true);
  assert.deepEqual(N.overlay, before);
  // With a one-time swap on the meal: the swap goes, the permanent change stays, and DOOR says so.
  const M = computer({ swaps: { ['2026-11-03-' + P]: { specialName: 'Pizza Lunch' } } });
  const mBefore = out(M.overlay);
  await makeBox(M).revertMealSwap();
  assert.deepEqual(M.swaps, {}, 'the swap goes');
  assert.deepEqual(M.overlay, mBefore, 'the permanent change stays');
  assert.match(M.toasts.at(-1) || '', /The permanent change stays/);
});

test('6. the copy stays DOOR\'s: not in menu_current.json, no publish stop, editor-only on the P4 list; the change log keeps copies on its newest entries', () => {
  const copy = { meal: { '': ORIGINAL[P], _flags: out(ORIGINAL[P + '_flags']) }, at: '2026-10-19T14:00:00.000Z', by: 'Jason', how: 'Make Permanent' };
  const withCopy = out(OVERLAY);
  withCopy[W][D][P + '_original'] = copy;
  const S = computer({ overlay: withCopy });
  const box = makeBox(S);
  const built = out(box.buildMenuJSON());
  for (const wk of Object.keys(built.menu)) for (const d of Object.keys(built.menu[wk]))
    assert.deepEqual(Object.keys(built.menu[wk][d]).filter((k) => /_original$/.test(k)), [], 'menu_current.json carries no copy (' + wk + ' ' + d + ')');
  // The publish check: the copy in the overlay is no contradiction.
  const res = box.validateDoorPublishArtifacts({ 'menu_current.json': PUBLISHED, 'registry_summary.json': json('registry_summary.json'),
    'routing_by_meal.json': json('routing_by_meal.json'), 'door_state.json': json('door_state.json'), 'menu_overlay.json': withCopy });
  assert.deepEqual(out(res.stop), [], 'no publish stop');
  // The P4 "what's different" list: a copy on one computer only is an editor detail, named by its meal.
  assert.deepEqual(out(box.doorOverlayDayDifferences(withCopy[W][D], OVERLAY[W][D], {})),
    [{ meal: P, staffSees: false, what: 'Saved original (Revert to Original)', here: ORIGINAL[P], published: '(none)' }]);
  // The change log keeps the meal copies on its newest entries only: ↩ Undo Last only undoes the newest.
  const L = computer();
  const lb = makeBox(L);
  for (let i = 0; i < 12; i++) lb.appendChangeLog({ type: 'permanent_edit', week: W, day: D, period: P, oldName: 'a', newName: 'b', before: { '': 'x' + i } });
  assert.deepEqual(L.log.map((e) => !!e.before), [...Array(10).fill(true), false, false]);
  // A workbook import starts fresh: the overlay goes, copies and all.
  assert.match(html, /saveUploadedMenu\(finalMenu\);\s*\n\s*\/\/ Clear the base overlay[^\n]*\n\s*saveMenuBaseOverlay\(\{\}\);/);
});
