// tests/label_unchecked_gate.mjs — a recipe whose label is not checked is unknown, never safe (C2 DOOR half, 2026-11-18).
// Jason, 2026-11-18 ("follow lean"): CODEX bought items (Rice Chex, Silk coconut yogurt, Kirkland oat and soy drinks)
// arrive as Library records with allergens null until someone reads the package. DOOR keeps null as null, a slot linked
// to such a recipe brings no flags and is marked labelUnchecked, the editor says "label not checked", and on the plating
// sheet every resident with an allergen restriction on a plate holding it reads "check label: <dish>" (an anaphylactic
// resident in red, ANAPHYLACTIC). Nothing changes on today's data: no recipe carries null today (CODEX turns null into []
// until its own PR, after this one). Plan: docs/DOOR_BACK_ON_TRACK_PLAN_2026-11-18.md §5 U3, §9 C2.
// Authored red on main 1faaca8 (the helpers do not exist there). Every resident here is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const J = (v) => JSON.parse(JSON.stringify(v));

// ── 1. the shared Library overlay keeps null ─────────────────────────────────────────────────────────────────────────
const core = between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */');
const sb = vm.createContext({});
vm.runInContext(core + '\nglobalThis.overlay = doorOverlaySharedRecipes; globalThis.one = doorSharedDoorRecord; globalThis.unchecked = typeof doorRecipeLabelUnchecked === "function" ? doorRecipeLabelUnchecked : undefined;', sb);
const BASE = [
  { recipeName: 'Granola', allergens: ['Gluten (Oats)', 'Tree Nuts (Almonds)'], category: 'breakfast', stream: 'regular', recipeId: 'granola' },
  { recipeName: 'Plain Rice', allergens: [], category: 'starch_side', stream: 'vegan', recipeId: 'plain-rice' },
  { recipeName: 'Oat Drink', allergens: null, category: 'breakfast', stream: 'vegan', recipeId: 'oat-drink' }
];
const door = (recipeName, extra) => Object.assign({ recipeName, allergens: null, category: 'breakfast', stream: 'regular' }, extra || {});

test('the shared Library keeps allergens null as not checked, never [] or None', () => {
  const rec = { recipeName: 'Rice Chex', door: door('Rice Chex', { recipeId: 'rice-chex' }) };
  const d = J(sb.one(rec));
  assert.equal(d.allergens, null, 'null stays null');
  const out = J(sb.overlay(BASE, { recipes: [rec] }));
  const chex = out.list.find((r) => r.recipeName === 'Rice Chex');
  assert.equal(chex.allergens, null);
  assert.equal(sb.unchecked(chex), true);
  assert.deepEqual(out.receipt.added, ['Rice Chex']);
  assert.deepEqual(out.receipt.labelUnchecked, ['Rice Chex']);
  assert.deepEqual(out.receipt.skipped, [], 'a null record is read, not left out');
  // the one rule: checked lists are checked, [] included; null and not-a-list are not
  assert.equal(sb.unchecked(BASE[0]), false);
  assert.equal(sb.unchecked(BASE[1]), false, '[] is checked, none');
  assert.equal(sb.unchecked(BASE[2]), true);
  assert.equal(sb.unchecked({ recipeName: 'X' }), true, 'no allergens at all is not checked');
  // malformed lists are still refused
  assert.equal(sb.one({ recipeName: 'X', door: door('X', { allergens: 'Gluten' }) }), null);
  assert.equal(sb.one({ recipeName: 'X', door: door('X', { allergens: [1] }) }), null);
});

test('Option C: a shared copy not checked is never a removal and never none', () => {
  // over a CODEX list with real allergens: the list stays, marked not checked
  const out = J(sb.overlay(BASE, { recipes: [{ recipeName: 'Granola', door: door('Granola') }] }));
  const g = out.list.find((r) => r.recipeName === 'Granola');
  assert.deepEqual(g.allergens, ['Gluten (Oats)', 'Tree Nuts (Almonds)'], 'no warning comes off');
  assert.equal(g.labelUnchecked, true);
  assert.equal(sb.unchecked(g), true);
  assert.equal(g.recipeId, 'granola');
  assert.deepEqual(out.receipt.replaced, ['Granola']);
  // a confirmed removal does not apply to a list nobody checked
  const conf = J(sb.overlay(BASE, { recipes: [{ recipeName: 'Granola', door: door('Granola', { removedAllergens: ['Tree Nuts'] }) }] }));
  assert.deepEqual(conf.list.find((r) => r.recipeName === 'Granola').allergens, ['Gluten (Oats)', 'Tree Nuts (Almonds)']);
  // over a checked-none list: not checked, null (never read as none)
  const rice = J(sb.overlay(BASE, { recipes: [{ recipeName: 'Plain Rice', door: door('Plain Rice', { stream: 'vegan' }) }] })).list.find((r) => r.recipeName === 'Plain Rice');
  assert.equal(rice.allergens, null);
  // a checked shared list over a null base is checked, with nothing kept from null
  const read = J(sb.overlay(BASE, { recipes: [{ recipeName: 'Oat Drink', door: door('Oat Drink', { allergens: ['Gluten (Oats)'], stream: 'vegan' }) }] })).list.find((r) => r.recipeName === 'Oat Drink');
  assert.deepEqual(read.allergens, ['Gluten (Oats)']);
  assert.equal(sb.unchecked(read), false);
  // vegan-friendly is never kept on a kept Milk label
  const milk = J(sb.overlay([{ recipeName: 'Yogurt', allergens: ['Milk (Milk)'], category: 'breakfast', stream: 'regular' }],
    { recipes: [{ recipeName: 'Yogurt', door: door('Yogurt', { veganFriendly: true }) }] })).list[0];
  assert.equal(milk.veganFriendly, false);
});

test('the flow block reads a recipe not checked as unknown', () => {
  const src = fn('doorFlowRecipeInput');
  assert.match(src, /allergens:Array\.isArray\(r\.allergens\) && r\.labelUnchecked !== true \? r\.allergens\.slice\(\) : null/);
});

// ── the slot and plate helpers in a vm ───────────────────────────────────────────────────────────────────────────────
const RECIPES = [
  { recipeName: 'Rice Chex', allergens: null, category: 'starch_side', stream: 'regular', recipeId: 'rice-chex' },
  { recipeName: 'Silk Coconut Yogurt', allergens: null, category: 'veg_side', stream: 'vegan', recipeId: 'silk-coconut-yogurt' },
  { recipeName: 'Soy Glazed Chicken', allergens: ['Soy (Soy Sauce)'], category: 'protein', stream: 'regular', recipeId: 'soy-glazed-chicken' },
  { recipeName: 'Baked Tofu', allergens: ['Soy (Tofu)'], category: 'protein', stream: 'vegan', recipeId: 'baked-tofu' },
  { recipeName: 'Steamed Rice', allergens: [], category: 'starch_side', stream: 'vegan', recipeId: 'steamed-rice' }
];
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
    between('function doorSlotRecipeToday(', 'function doorLabelUncheckedTagHTML('),
    fn('doorLabelUncheckedTagHTML'), fn('doorLabelUncheckedLinesHTML'), fn('doorText'), fn('escapeHtml'),
    lineOf('function _slotText('), between('const DOOR_LINE_SIDE_IDS', '\n') + '\n', between('const DOOR_LINE_EXTRAS', '\n') + '\n', fn('doorLinePieces'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between('const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'),
    'this.doorDatedMealFor = () => null;',
    lineOf('const DOOR_KITCHEN_ALT_FIELDS = '), fn('doorKitchenAlternatives'), fn('doorAddKitchenPlateFlags'), fn('doorRegularServiceNote'),
    between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fn('doorAllergenStrFlags'),
    between('const DOOR_LABEL_CHECK_SKIP_TAGS', 'function doorSectionLineNotes('), fn('doorSectionLineNotes'), fn('doorSectionAllergenStr'),
    fn('computePlatingData'),
    between('const MEAL_SLOT_DEFS = [', '\n];\n') + '\n];\n', fn('recipeMatchesSlotDef'), fn('doorKeepCapturedFlags'),
    fn('slotSelect'), fn('slotAutoSave'), fn('smSlotSelect'), fn('_buildSlotSnapshot'), fn('doorMakeLineVersion'),
    'function isHubLoaded() { return true; }'
  ].join('\n'), c, { filename: 'index.html#label-unchecked', timeout: 30000 });
  return c;
}

test('linking a recipe not checked sets no flags and marks the slot; a checked one is as before', () => {
  const c = harness(RECIPES);
  c.slotSelect('starch', 'Rice Chex');
  const s = J(c.MEAL_SLOT_STATE.starch);
  assert.equal(s.labelUnchecked, true);
  assert.equal(s.recipeId, 'rice-chex');
  assert.deepEqual(Object.keys(s.flags).filter((k) => s.flags[k]), [], 'no allergen flag from a label nobody read');
  c.slotSelect('main', 'Soy Glazed Chicken');
  const m = J(c.MEAL_SLOT_STATE.main);
  assert.equal('labelUnchecked' in m, false, 'a checked recipe carries no mark (byte-identical slot)');
  assert.equal(m.flags.hasSoy, true);
  // typed on blur, and on the Special Meal editor
  c.MEAL_SLOT_STATE.vegside = null;
  c.slotAutoSave('vegside', 'Silk Coconut Yogurt');
  assert.equal(c.MEAL_SLOT_STATE.vegside.labelUnchecked, true);
  c.smSlotSelect('starch', 'Rice Chex');
  assert.equal(c.SM_SLOT_STATE.starch.labelUnchecked, true);
  // a line version too
  assert.equal(J(c.doorMakeLineVersion('Rice Chex')).labelUnchecked, true);
  // the saved slots carry the mark; a checked slot gains no key
  const snap = J(c._buildSlotSnapshot());
  assert.equal(snap.starch.labelUnchecked, true);
  assert.equal('labelUnchecked' in snap.main, false);
});

test('read again from today: a later label check clears the mark and brings the flags', () => {
  const recipes = J(RECIPES);
  const c = harness(recipes);
  c.slotSelect('starch', 'Rice Chex');
  c.MEAL_SLOT_STATE.starch.flags.hasCorn = true;   // a tick set by hand
  assert.equal(c.doorSlotLabelUnchecked(c.MEAL_SLOT_STATE.starch), true);
  recipes[0].allergens = ['Gluten (Barley Malt)'];   // the package is read
  // the captured mark still holds in plating until the editor shows it
  assert.equal(c.doorSlotLabelUnchecked(c.MEAL_SLOT_STATE.starch), true);
  c.doorRefreshLabelChecks(c.MEAL_SLOT_STATE);
  const s = J(c.MEAL_SLOT_STATE.starch);
  assert.equal('labelUnchecked' in s, false);
  assert.equal(s.flags.hasGluten, true, 'the checked label brings its allergens');
  assert.equal(s.flags.hasCorn, true, 'a tick set by hand stays');
  // a re-confirm of the same recipe takes the checked flags, not the empty ones captured before
  const c2 = harness(J(RECIPES));
  c2.slotSelect('starch', 'Rice Chex');
  c2.DOOR_RECIPE_DATA[0].allergens = ['Gluten (Barley Malt)'];
  c2.slotSelect('starch', 'Rice Chex');
  assert.equal(c2.MEAL_SLOT_STATE.starch.flags.hasGluten, true);
  assert.equal('labelUnchecked' in c2.MEAL_SLOT_STATE.starch, false);
  // and a recipe that turns not checked marks a slot linked while it was checked
  const c3 = harness(J(RECIPES));
  c3.slotSelect('main', 'Soy Glazed Chicken');
  c3.DOOR_RECIPE_DATA[2].allergens = null;
  assert.equal(c3.doorSlotLabelUnchecked(c3.MEAL_SLOT_STATE.main), true);
});

test('the editor shows an amber "label not checked" tag and a preview line; Save is never blocked by it', () => {
  const c = harness(RECIPES);
  assert.match(c.doorLabelUncheckedTagHTML(), /label not checked/);
  assert.match(c.doorLabelUncheckedTagHTML(), /amber-pale/);
  const lines = c.doorLabelUncheckedLinesHTML(['Rice Chex', '<b>x</b>']);
  assert.match(lines, /Rice Chex: label not checked/);
  assert.match(lines, /&lt;b&gt;x&lt;\/b&gt;: label not checked/, 'the dish name is escaped');
  c.slotSelect('starch', 'Rice Chex');
  c.slotSelect('main', 'Soy Glazed Chicken');
  assert.deepEqual(J(c.doorUncheckedSlotDishes(c.MEAL_SLOT_STATE)), ['Rice Chex']);
  // wired: both slot cards, both summaries
  assert.match(fn('renderSlotCard'), /doorSlotLabelUnchecked\(state\) \? doorLabelUncheckedTagHTML\(\)/);
  assert.match(fn('renderSlotCard'), /\$\{matchBadge\}\$\{labelTag\}/);
  assert.match(fn('updateSlotSummary'), /doorLabelUncheckedLinesHTML\(doorUncheckedSlotDishes\(MEAL_SLOT_STATE\)\)/);
  assert.match(fn('updateSmSlotSummary'), /doorLabelUncheckedLinesHTML\(doorUncheckedSlotDishes\(SM_SLOT_STATE\)\)/);
  assert.match(fn('renderSlots'), /doorRefreshLabelChecks\(MEAL_SLOT_STATE\)/);
  assert.match(fn('renderSmSlots'), /doorRefreshLabelChecks\(SM_SLOT_STATE\)/);
  // no save path reads the mark to hold or refuse
  for (const name of ['saveMenuEdit', 'saveSpecialMeal']) assert.doesNotMatch(fn(name).replace(/labelUnchecked\.length\) meals\[key\]\.labelUnchecked = labelUnchecked;/, ''), /labelUnchecked[^\n]*(return|throw|doorAsk)/, name);
});

// ── 3. the plating sheet ─────────────────────────────────────────────────────────────────────────────────────────────
const R = (room, tags, extra) => Object.assign({ room, rawRestriction: tags.join(', ') || 'Regular', tags }, extra || {});
const RESIDENTS = [
  R('9001', ['No Soy']),                              // allergen-restricted, regular plate
  R('9002', ['Regular']),                             // no restriction
  R('9003', ['Regular'], { isAnaph: true, anaphTags: ['peanuts'] }),   // anaphylactic, not contained by this meal
  R('9004', ['Vegan', 'No Sesame']),                  // vegan plate, allergen-restricted
  R('9005', ['Vegan'])                                // vegan plate, no restriction
];
function menuWith(starchRecipe) {
  return { 1: { MONDAY: {
    lunch: 'Soy Glazed Chicken, ' + starchRecipe, lunch_veg: 'Baked Tofu, ' + starchRecipe,
    lunch_flags: { hasSoy: true, hasChicken: true },
    lunch_slots: {
      main: { recipeName: 'Soy Glazed Chicken', recipeId: 'soy-glazed-chicken', flags: { hasSoy: true, hasChicken: true } },
      starch: { recipeName: starchRecipe, flags: {} },
      veganalt: { recipeName: 'Baked Tofu', recipeId: 'baked-tofu', flags: { hasSoy: true } }
    } } } };
}
function seatNotes(c, pd) {
  const out = {};
  pd.sections.forEach((s) => s.residents.forEach((r) => {
    out[r.room] = s.rule.key === 'regular'
      ? ((pd.regularNotes.find((n) => n.room === r.room) || {}).labelNote || '')
      : c.doorSectionLineNotes(r, s, pd.mealFlags, c.doorSectionAllergenStr(s, pd));
  }));
  return out;
}

test('a plate holding a dish not checked: "check label" for allergen-restricted residents, none for others, red for anaphylactic', () => {
  const c = harness(RECIPES, RESIDENTS.map((r) => ({ ...r })), menuWith('Rice Chex'));
  const pd = c.computePlatingData('lunch', '1', 'MONDAY');
  const notes = seatNotes(c, pd);
  assert.match(notes['9001'], /check label: Rice Chex/);
  assert.equal(notes['9002'], '', 'an unrestricted resident gets no note');
  assert.equal(notes['9003'], 'ANAPHYLACTIC: check label: Rice Chex');
  const anaphRow = pd.regularNotes.find((n) => n.room === '9003');
  assert.equal(anaphRow.labelRed, true, 'drawn red');
  assert.equal(pd.regularNotes.find((n) => n.room === '9001').labelRed, false);
  assert.match(notes['9004'], /check label: Rice Chex/, 'the vegan plate shares the side');
  assert.doesNotMatch(notes['9005'] || '', /check label/);
  // never enumerable: no copy, count or published file carries it
  assert.equal(Object.keys(pd.mealFlags).includes('_labelUnchecked'), false);
  assert.doesNotMatch(JSON.stringify(pd.mealFlags), /labelUnchecked/);
  // routing counts are the same as with the label checked
  const c2 = harness(RECIPES.map((r) => (r.recipeName === 'Rice Chex' ? { ...r, allergens: [] } : r)), RESIDENTS.map((r) => ({ ...r })), menuWith('Rice Chex'));
  const pd2 = c2.computePlatingData('lunch', '1', 'MONDAY');
  const seats = (p) => p.sections.map((s) => s.rule.key + ':' + s.residents.map((r) => r.room).join(','));
  assert.deepEqual(J(seats(pd)), J(seats(pd2)));
  assert.equal(pd.regCount, pd2.regCount);
  assert.deepEqual(seatNotes(c2, pd2), { '9001': '', '9002': '', '9003': '', '9004': '', '9005': '' });
  // a dish only on the vegan line marks the vegan plate only
  const veganOnly = { slots: { main: { recipeName: 'Soy Glazed Chicken' }, veganalt: { recipeName: 'Silk Coconut Yogurt' } } };
  const plates = J(c.doorPlatesLabelUnchecked({ lunch_slots: veganOnly.slots }, 'lunch', null));
  assert.deepEqual(plates, { regular: [], vegan: ['Silk Coconut Yogurt'], halal: [], nopork: [] });
  // a typed special meal: its linked recipes and the marks saved with it
  const sp = J(c.doorPlatesLabelUnchecked({}, 'lunch', { entry: { linkedRecipes: { main: 'Gone Bar' }, labelUnchecked: ['main'] } }));
  assert.deepEqual(sp.regular, ['Gone Bar']);
});

test('both renderers draw the note through the one owner, red for an anaphylactic resident; no new block', () => {
  const sheet = fn('buildDaySheet'), preview = fn('buildPlatingHtml');
  for (const [name, src] of [['xlsx', sheet], ['preview', preview]]) {
    assert.match(src, /doorSectionLineNotes\(r, s, mealFlags, sectionAllergenStr\)/, name);
    assert.match(src, /doorLabelCheckNote\(r, doorSectionLabelPlate\(s, mealFlags\), mealFlags\)\.red/, name);
    assert.match(src, /r\.conflictNote, r\.serviceNote, r\.labelNote/, name);
  }
  assert.match(sheet, /F\.noteRed,'F2DCDC',B\.anaph/);
  assert.match(preview, /ps-anaph-row/);
  assert.match(fn('doorSectionLineNotes'), /doorLabelCheckNote\(r, doorSectionLabelPlate\(section, f\), f\)\.note/);
});

// ── 4. today's data is unchanged ─────────────────────────────────────────────────────────────────────────────────────
test('today: no recipe is not checked, and every published meal plates exactly as without the label check', () => {
  const fallback = vm.runInNewContext(lineOf('const DOOR_RECIPE_DATA_FALLBACK = ') + ';DOOR_RECIPE_DATA_FALLBACK');
  assert.deepEqual(J(fallback.filter((r) => sb.unchecked(r)).map((r) => r.recipeName)), []);
  const sibling = new URL('../../conc-recipe-hub/DOOR_RECIPE_DATA.json', import.meta.url);
  if (fs.existsSync(sibling)) assert.deepEqual(JSON.parse(fs.readFileSync(sibling, 'utf8')).filter((r) => sb.unchecked(r)).map((r) => r.recipeName), []);
  const menu = json('menu_current.json').menu, state = json('door_state.json');
  assert.doesNotMatch(JSON.stringify(menu), /labelUnchecked/);
  const withCheck = harness(fallback, state.residents.map((r) => ({ ...r })), menu);
  const without = harness(fallback, state.residents.map((r) => ({ ...r })), menu);
  without.doorPlatesLabelUnchecked = () => null;   // the build before this slice
  withCheck.anaphRooms.push(...state.anaphRooms); without.anaphRooms.push(...state.anaphRooms);
  let meals = 0;
  for (const wk of ['1', '2', '3', '4']) for (const day of ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const a = withCheck.computePlatingData(period, wk, day), b = without.computePlatingData(period, wk, day);
    if (!a) { assert.equal(b, null); continue; }
    meals++;
    assert.equal(a.mealFlags._labelUnchecked, undefined, 'W' + wk + ' ' + day + ' ' + period);
    assert.equal(JSON.stringify([a.sections, a.regularNotes, a.anaphSect, a.allergenStr, a.vegAllergenStr]), JSON.stringify([b.sections, b.regularNotes, b.anaphSect, b.allergenStr, b.vegAllergenStr]));
    assert.deepEqual(seatNotes(withCheck, a), seatNotes(without, b));
  }
  assert.equal(meals, 84);
});
