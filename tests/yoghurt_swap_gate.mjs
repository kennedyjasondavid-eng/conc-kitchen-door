// tests/yoghurt_swap_gate.mjs — call 4 (2026-11-19, Jason: "Follow lean"): on a breakfast plate that serves dairy yoghurt,
// a No Dairy or Lactose Intolerant resident's plating-sheet note reads "dairy-free: vegan yoghurt" (the Silk coconut yoghurt,
// CODEX's Vegan yoghurt). A plate naming DF, dairy-free, vegan or coconut yoghurt is already dairy-free; lactose-free
// yoghurt is dairy. Lunch and dinner, menu text, routing and published files are unchanged. Authored red on main 9eff740.
// Every resident here is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const fnOpt = (name) => (html.includes('function ' + name + '(') ? fn(name) : '');
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const J = (v) => JSON.parse(JSON.stringify(v));

const core = between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */');
function harness(recipes, residents, menu) {
  const c = { console, DOOR_RECIPE_DATA: recipes, REGISTRY_LIST: residents || [], anaphRooms: [], getMenuData: () => menu || {},
    loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}), document: { getElementById: () => null }, showToast: () => {},
    renderSlots() {}, renderSmSlots() {}, updateSlotSummary() {}, updateSmSlotSummary() {}, MEAL_SLOT_STATE: {}, SM_SLOT_STATE: {},
    SLOT_HELD: {}, SLOT_OFFERED: {}, _slotRenderDepth: 0, doorIcon: () => '' };
  vm.createContext(c);
  vm.runInContext([
    html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0],
    core,
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
    between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    fn('formatConflictNote'), fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fn('getAnaphConflictRooms'),
    between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', between('const FLAG_DEFS = [', '\n];\n') + '\n];\n',
    fn('flagsToAllergenStr'), fn('emptyMealFlags'), fn('hasCarbAccommodation'), fn('_hubAllergenResolve'), fn('hubAllergenToFlags'),
    'const _hubUnmappedLabels = new Set();', between('const DOOR_NON_CODEX_TICKS', '\n') + '\n', fn('doorLinkFlags'),
    between(html.includes('function doorSlotRecipesToday(') ? 'function doorSlotRecipesToday(' : 'function doorSlotRecipeToday(', 'function doorLabelUncheckedTagHTML('),
    fn('doorLabelUncheckedTagHTML'), fn('doorLabelUncheckedLinesHTML'), fn('doorText'), fn('escapeHtml'),
    lineOf('function _slotText('), between('const DOOR_LINE_SIDE_IDS', '\n') + '\n', between('const DOOR_LINE_EXTRAS', '\n') + '\n', fn('doorLinePieces'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between('const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'),
    'this.doorDatedMealFor = () => null;',
    lineOf('const DOOR_KITCHEN_ALT_FIELDS = '), fn('doorKitchenAlternatives'), fn('doorAddKitchenPlateFlags'), fn('doorRegularServiceNote'),
    between('const DOOR_YOGHURT_SWAP_NOTE', 'function doorYoghurtSwapFor('), fn('doorYoghurtSwapFor'),
    between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fn('doorAllergenStrFlags'),
    between('const DOOR_LABEL_CHECK_SKIP_TAGS', 'function doorSectionLineNotes('), fn('doorSectionLineNotes'), fn('doorSectionAllergenStr'),
    fn('computePlatingData'),
    between('const MEAL_SLOT_DEFS = [', '\n];\n') + '\n];\n', fn('recipeMatchesSlotDef'), fn('doorKeepCapturedFlags'),
    fn('slotSelect'), fn('slotAutoSave'), fn('smSlotSelect'), fn('_buildSlotSnapshot'), fn('doorMakeLineVersion'),
    // review fold (2026-11-18): the name-read dishes, the Special Meal blur, the search preview, the re-save list
    fn('doorSplitDishes'), fn('smSlotAutoSave'), fn('_allergenPreview'),
    'function isHubLoaded() { return true; }'
  ].join('\n'), c, { filename: 'index.html#label-unchecked', timeout: 30000 });
  return c;
}

const RECIPES = [{ recipeName: 'Steamed Rice', allergens: [], category: 'starch_side', stream: 'vegan', recipeId: 'steamed-rice' }];
const R = (room, tags, extra) => Object.assign({ room, rawRestriction: tags.join(', ') || 'Regular', tags }, extra || {});
function seatOf(pd, room) { for (const s of pd.sections) if (s.residents.some((r) => r.room === room)) return s; return null; }
function noteOf(c, pd, room) {
  const s = seatOf(pd, room);
  if (s.rule.key === 'regular') { const n = pd.regularNotes.find((x) => x.room === room); return n ? [n.conflictNote, n.serviceNote].filter(Boolean).join(' · ') : ''; }
  return c.doorSectionLineNotes(s.residents.find((r) => r.room === room), s, pd.mealFlags, c.doorSectionAllergenStr(s, pd));
}
const RES = [R('9501', ['No Dairy']), R('9502', ['Lactose Intolerant']), R('9503', ['Regular']), R('9504', ['Soft Meals', 'No Dairy']), R('9505', ['Vegan', 'No Dairy'])];

test('what reads as dairy yoghurt', () => {
  const c = harness(RECIPES);
  for (const t of ['Pancakes, turkey bacon, fruit & yoghurt', 'Turkey & Cheese and Eggs, Yogurt', 'Oatmeal, Yogurt', 'Gluten-free oatmeal, jam, lactose-free yoghurt', 'Cheese and Eggs yoghurt'])
    assert.equal(c.doorNamesDairyYoghurt(t), true, t);
  for (const t of ['Soft Scrambled Eggs, DF Yoghurt & Fruit', 'Coconut yogurt, fruit', 'Vegan yoghurt', 'dairy-free yoghurt', 'Chex cereal with milk (soy milk where noted), whole fruit', ''])
    assert.equal(c.doorNamesDairyYoghurt(t), false, t);
});

test('a breakfast with dairy yoghurt: the swap note for No Dairy and Lactose Intolerant residents, on the plate they eat', () => {
  const menu = { 1: { MONDAY: {
    breakfast: 'Pancakes, turkey bacon, fruit & yoghurt', breakfast_veg: 'Pancakes, Vegan Breakfast Sausage, fruit & yoghurt',
    breakfast_flags: { hasDairy: true, hasGluten: true, hasProcessedMeat: true },
    breakfast_softAlt: 'Soft Scrambled Eggs, DF Yoghurt & Fruit'
  } } };
  const c = harness(RECIPES, RES.map((r) => ({ ...r })), menu);
  const pd = c.computePlatingData('breakfast', '1', 'MONDAY');
  assert.match(noteOf(c, pd, '9501'), /dairy-free: vegan yoghurt/);
  assert.match(noteOf(c, pd, '9502'), /dairy-free: vegan yoghurt/);
  assert.doesNotMatch(noteOf(c, pd, '9503') || '', /yoghurt/);
  // a Soft + No Dairy resident is seated on the vegan plate (No Dairy routes first); the soft plate itself serves DF yoghurt
  assert.equal(c.doorYoghurtSwapFor(R('x', ['No Dairy']), 'soft', pd.mealFlags), false, 'the soft plate already serves DF yoghurt');
  assert.equal(c.doorYoghurtSwapFor(R('x', ['No Dairy']), 'regular', pd.mealFlags), true);
  assert.match(noteOf(c, pd, '9505'), /dairy-free: vegan yoghurt/, 'the vegan line serves dairy yoghurt too');
  assert.doesNotMatch(noteOf(c, pd, '9501'), /dairy-free, |, dairy-free$|dairy-free · /, 'the plain dairy-free note is replaced, not repeated');
  // not enumerable: no copy, count or published file carries it
  assert.equal(Object.keys(pd.mealFlags).includes('_yoghurtPlates'), false);
  assert.doesNotMatch(JSON.stringify(pd.mealFlags), /yoghurt/i);
});

test('lunch and dinner, and a breakfast with no yoghurt, are unchanged', () => {
  const menu = { 1: { MONDAY: {
    breakfast: 'Chex cereal with milk, whole fruit', breakfast_veg: 'Chex cereal with soy milk, whole fruit', breakfast_flags: { hasDairy: true },
    lunch: 'Chicken, rice, yoghurt sauce', lunch_veg: 'Tofu, rice', lunch_flags: { hasDairy: true, hasChicken: true }
  } } };
  const c = harness(RECIPES, RES.map((r) => ({ ...r })), menu);
  for (const period of ['breakfast', 'lunch']) {
    const pd = c.computePlatingData(period, '1', 'MONDAY');
    for (const r of RES) assert.doesNotMatch(noteOf(c, pd, r.room) || '', /vegan yoghurt/, period + ' ' + r.room);
  }
});

test('today: every published yoghurt breakfast gives a No Dairy resident the swap; routing counts never move', () => {
  const menu = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8')).menu;
  let swaps = 0, breakfasts = 0;
  const c = harness(RECIPES, [R('9601', ['No Dairy']), R('9602', ['Regular'])], menu);
  for (const w of Object.keys(menu)) for (const d of Object.keys(menu[w])) {
    if (!menu[w][d] || !menu[w][d].breakfast) continue;
    breakfasts++;
    const pd = c.computePlatingData('breakfast', w, d);
    const s = seatOf(pd, '9601');
    const plate = c.doorSectionLabelPlate(s, pd.mealFlags);
    const has = /dairy-free: vegan yoghurt/.test(noteOf(c, pd, '9601') || '');
    assert.equal(has, !!pd.mealFlags._yoghurtPlates[plate], w + ' ' + d);
    if (has) swaps++;
    assert.doesNotMatch(noteOf(c, pd, '9602') || '', /yoghurt/);
  }
  assert.equal(breakfasts, 28);
  assert.ok(swaps >= 20, 'most published breakfasts serve yoghurt: ' + swaps);
});
