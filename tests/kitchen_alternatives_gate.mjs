// tests/kitchen_alternatives_gate.mjs — DOOR's plating sheets follow the kitchen's alternatives (2026-10-19).
// The plating review compared DOOR's sheets with the kitchen's manual ones (the eight Oct 17 workbooks). Jason,
// 2026-10-19: "Copy the kitchen's": copy each meal's alternatives into DOOR's menu, and follow the kitchen on five
// groupings DOOR decided differently:
//   1. a diabetic plate only where the kitchen makes one (its whole-wheat version); otherwise the regular plate,
//      "extra veg less starch" on a starchy meal
//   2. a bland plate only on a spicy meal where the kitchen makes one; otherwise the regular plate, the Regular notes
//      naming "No Spicy"
//   3. no soft plate on a meal the kitchen marks "no soft alternative needed": the regular plate, noted "soft"; a pork
//      meal with no soft plate still seats soft residents on the halal plate, as the kitchen does
//   4. No Dairy gets the kitchen's dairy-free version of the main where there is one, else the vegan plate
//   5. No Pork on the halal plate on pork only (the kitchen serves them the regular plate on Wk2 SAT's tenders)
// Also: the copied alternatives on the published menu, Edit Menu's "Alternatives the kitchen makes", a swap or a
// permanent change dropping the old dish's alternatives, and a plate's dishes split outside brackets.
// Authored to fail on 2e37447 (DOOR PR #135's head). Env: KITCHEN_ALTS_ROOT (another checkout's directory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.KITCHEN_ALTS_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const has = (name) => html.includes('function ' + name + '(');
const fnOpt = (name) => (has(name) ? fn(name) : '');
const out = (v) => JSON.parse(JSON.stringify(v));

// The routing engine, the plates' text and the Regular line, as the plating sheet runs them.
const c = vm.createContext({ console });
vm.runInContext([
  between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
  between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers(') + fn('migrateResidentTiers'),
  between('const RESIDENT_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n', fn('checkResidentMealConflicts'), fn('formatConflictNote'),
  fnOpt('doorRegularServiceNote'), fn('getAltMeal'), fn('doorSectionAllergenStr'), fnOpt('doorSplitDishes'),
  (html.match(/const DOOR_KITCHEN_ALT_FIELDS = [^\n]*\n/) || [''])[0], fnOpt('doorKitchenAlternatives'), fnOpt('doorAddKitchenPlateFlags'),
].join('\n'), c, { filename: 'index.html#kitchen-alternatives', timeout: 10000 });
const seat = (tags, meal) => out(c.computeSections({ ...meal }, [{ room: '101', tags }])).find((s) => s.residents.length).rule.key;
const regularLine = (tags, meal) => {
  const r = { room: '101', tags }; c.migrateResidentTiers(r);
  assert.equal(typeof c.doorRegularServiceNote, 'function', 'doorRegularServiceNote');
  return [c.formatConflictNote(c.checkResidentMealConflicts(meal, r)), c.doorRegularServiceNote(r, meal)].filter(Boolean).join(' · ');
};
const plate = (altType, ctx) => c.getAltMeal(altType, { mealName: 'Main dish, Rice', mealVeg: 'Vegan dish', ...ctx });
const section = (key) => out(c.ROUTING_RULES || vm.runInContext('ROUTING_RULES', c)).find((r) => r.key === key);

test('1. a diabetic plate only where the kitchen makes one; otherwise the regular plate, noted on a starchy meal', () => {
  const WW = 'Whole Wheat Pita, Tuna Salad Sandwich, Seasonal Soup or Salad';
  for (const tags of [['Diabetic'], ['Low Carb']]) {
    assert.equal(seat(tags, { isCarb: true }), 'regular', tags + ' on a starchy meal with no diabetic plate');
    assert.equal(seat(tags, { isCarb: true, _diabeticAlt: WW }), 'diabetic', tags + ' with the kitchen’s diabetic plate');
  }
  assert.equal(seat(['Diabetic'], { _diabeticAlt: WW }), 'diabetic', 'the kitchen’s plate opens it whatever DOOR’s starch tick');
  assert.equal(section('diabetic').altType, 'diabetic_alt');
  assert.equal(plate('diabetic_alt', { diabeticAlt: WW }), WW, 'the plate is the kitchen’s');
  assert.equal(regularLine(['Diabetic'], { isCarb: true }), 'extra veg less starch');
  assert.equal(regularLine(['Diabetic'], {}), '', 'not on a meal with no starch');
  assert.equal(regularLine(['Low Carb'], {}), 'extra veg less starch', 'Low Carb on every regular plate, as before');
});

test('2. a bland plate only on a spicy meal where the kitchen makes one; otherwise the regular plate, the notes naming No Spicy', () => {
  const PLAIN = 'Roast Chicken Leg, Cabbage & Carrot Stirfry, Plain Rice and Green Peas';
  for (const tags of [['No Spicy'], ['Bland Diet']]) {
    assert.equal(seat(tags, { isSpicy: true }), 'regular', tags + ' with no bland plate');
    assert.equal(seat(tags, { isSpicy: true, _blandAlt: PLAIN }), 'bland', tags + ' with the kitchen’s bland plate');
    assert.equal(seat(tags, { _blandAlt: PLAIN }), 'regular', tags + ': a meal that isn’t spicy');
  }
  assert.equal(plate('bland_alt', { blandAlt: PLAIN }), PLAIN);
  assert.equal(plate('bland_alt', {}), 'Main dish, Rice — lightly seasoned', 'no kitchen plate: as before');
  // The bland plate is another dish, so its CONTAINS line doesn't repeat the main's allergens.
  assert.equal(c.doorSectionAllergenStr({ rule: section('bland') }, { allergenStr: 'SPICY, GLUTEN', ctx: { blandAlt: PLAIN } }), null);
  assert.equal(regularLine(['No Spicy'], { isSpicy: true }), 'No Spicy', 'the Regular notes name it');
  assert.equal(regularLine(['Halal', 'No Spicy'], { isSpicy: true, hasPeanuts: true }), 'No Spicy', 'only what the meal sets off');
  assert.equal(regularLine(['No Spicy', 'No Peanuts'], { isSpicy: true, hasPeanuts: true }), '⚠ No Peanuts · No Spicy');
});

test('3. no soft plate on a meal marked "no soft alternative needed"; a pork meal with none still seats soft residents on the halal plate', () => {
  assert.equal(seat(['Soft Meals'], { _altMealsNone: true }), 'regular');
  assert.equal(seat(['Soft Meals'], {}), 'soft', 'a meal with no answer keeps its soft section');
  assert.equal(seat(['Soft Meals'], { hasPork: true }), 'halal', 'pork, no soft plate: the halal plate (the kitchen’s practice)');
  assert.equal(seat(['Soft Meals'], { hasPork: true, _altMeals: [{ type: 'soft', text: 'Roast Chicken Leg, Rice' }] }), 'soft');
  assert.equal(regularLine(['Soft Meals'], { _altMealsNone: true }), 'soft');
  assert.equal(regularLine(['Soft Meals'], {}), '', 'only where the soft plate is closed');
  assert.equal(regularLine(['Soft Meals', 'Diabetic'], { _altMealsNone: true, isCarb: true }), 'extra veg less starch · soft');
});

test('4. No Dairy gets the kitchen’s dairy-free version of the main where there is one, else the vegan plate', () => {
  const DF = 'Halal Beef Burger, Lettuce, Tomato, DF Cheese and Chickpea Salad';
  for (const tags of [['No Dairy'], ['Lactose Intolerant']]) {
    assert.equal(seat(tags, { hasDairy: true }), 'vegan', tags);
    assert.equal(seat(tags, { hasDairy: true, _noDairyAlt: DF }), 'no_dairy', tags + ' with the dairy-free version');
  }
  assert.equal(seat(['No Dairy'], { _noDairyAlt: DF }), 'regular', 'no dairy on the meal: the regular plate');
  assert.equal(seat(['GF', 'No Dairy'], { hasDairy: true, hasGluten: true, _noDairyAlt: DF }), 'gf', 'GF still comes first');
  assert.equal(section('no_dairy').altType, 'nodairy_alt');
  assert.equal(plate('nodairy_alt', { noDairyAlt: DF }), DF);
  assert.equal(plate('nodairy_alt', {}), 'Vegan dish', 'no kitchen plate: the vegan line');
  assert.equal(c.doorSectionAllergenStr({ rule: section('no_dairy') }, { allergenStr: 'DAIRY, GLUTEN, MUSTARD', ctx: {} }), 'GLUTEN, MUSTARD');
});

test('5. No Pork on the halal plate on pork only; Halal keeps it on meat that isn’t halal-certified', () => {
  const tenders = { hasChicken: true, hasDairy: true, hasEgg: true, halalCertifiedMeat: false };
  assert.equal(seat(['No Pork'], tenders), 'regular', 'Wk2 SAT’s tenders: the regular plate, as the kitchen serves them');
  assert.equal(seat(['Halal'], tenders), 'halal');
  assert.equal(seat(['No Pork'], { hasPork: true }), 'halal');
  assert.equal(seat(['No Pork', 'Halal'], tenders), 'halal');
});

// The published menu: the kitchen's alternatives, copied from the eight workbooks (scratchpad mapping, majority rule).
const MENU = json('menu_current.json').menu;
const OVERLAY = json('menu_overlay.json');
const MEALS = [];
for (const wk of ['1', '2', '3', '4']) for (const day of Object.keys(MENU[wk] || {})) for (const period of ['lunch', 'dinner'])
  if (MENU[wk][day] && MENU[wk][day][period]) MEALS.push({ wk, day, period, d: MENU[wk][day] });
const field = (m, k) => m.d[m.period + '_' + k];
const count = (pred) => MEALS.filter(pred).length;

test('6. the published menu carries the kitchen’s alternatives, and every DOOR computer’s overlay with it', () => {
  assert.deepEqual({
    gfAlt: count((m) => field(m, 'gfAlt')), diabeticAlt: count((m) => field(m, 'diabeticAlt')), noDairyAlt: count((m) => field(m, 'noDairyAlt')),
    noEggAlt: count((m) => field(m, 'noEggAlt')), anaphAlt: count((m) => field(m, 'anaphAlt')), blandAlt: count((m) => field(m, 'blandAlt')),
    softPlate: count((m) => (field(m, 'altMeals') || []).some((a) => a && a.type === 'soft' && a.text)),
  // Re-pinned 2026-10-30 (Mat's Rexdale changes): Wk2 FRI lunch's Beef Chili adds a no-dairy, no-egg and bland plate.
  }, { gfAlt: 25, diabeticAlt: 10, noDairyAlt: 7, noEggAlt: 5, anaphAlt: 4, blandAlt: 3, softPlate: 21 });
  const at = (wk, day, period) => MEALS.find((m) => m.wk === wk && m.day === day && m.period === period);
  const philly = at('2', 'SUNDAY', 'lunch');
  assert.equal(field(philly, 'diabeticAlt'), 'Whole Wheat Tortilla, Philly Cheese Melt (Onions and Green Peppers)');
  assert.equal(field(philly, 'noDairyAlt'), 'Philly Cheese Melt (DF Cheese, Onions and Green Peppers)');
  assert.equal(field(philly, 'gfAlt'), 'Rice, Chicken Leg and Vegetable stirfry');
  const jerk = at('1', 'MONDAY', 'dinner');
  assert.equal(field(jerk, 'blandAlt'), 'Roast Chicken Leg, Cabbage & Carrot Stirfry, Plain Rice and Green Peas');
  assert.equal(field(jerk, 'altMealsNone'), true, 'Jerk Chicken: soft residents on the regular plate, as the kitchen has them');
  assert.equal(field(at('2', 'MONDAY', 'dinner'), 'anaphAlt'), 'Plain chicken, Veg Stirfry, plain rice. NO PEANUTS PLEASE');
  // Wk4 WED dinner's manual sheet says FISH under its roast chicken plate (copied from another day): not copied.
  const stew = at('4', 'WEDNESDAY', 'dinner');
  assert.deepEqual((field(stew, 'altMeals') || [])[0], { text: 'Roasted Chicken Leg, Rice and Stirfry veg', type: 'soft', flags: {} });
  // A pork meal with no soft plate is never marked "none needed": its soft residents eat the halal plate.
  assert.deepEqual(MEALS.filter((m) => (field(m, 'flags') || {}).hasPork && field(m, 'altMealsNone') === true).map((m) => m.wk + m.day + m.period), []);
  assert.ok(count((m) => field(m, 'altMealsNone') === true) >= 20, 'most meals with no soft plate say so');
  // The overlay every DOOR computer merges holds each field it holds the meal for.
  for (const m of MEALS) {
    const od = (OVERLAY[m.wk] || {})[m.day];
    if (!od) continue;
    for (const k of ['gfAlt', 'diabeticAlt', 'noDairyAlt', 'noEggAlt', 'anaphAlt', 'blandAlt', 'altMealsNone']) {
      if (od[m.period + '_' + k] !== undefined) assert.deepEqual(od[m.period + '_' + k], field(m, k), `overlay W${m.wk} ${m.day} ${m.period} ${k}`);
    }
  }
});

test('7. on every published meal the plates open as the kitchen’s alternatives say', () => {
  const residents = json('door_state.json').residents;
  assert.equal(typeof c.doorAddKitchenPlateFlags, 'function', 'doorAddKitchenPlateFlags');
  // The sheet, the routing file's fallback and the menu screens' previews all read a meal's plates through it.
  assert.match(fn('computePlatingData'), /doorAddKitchenPlateFlags\(mealFlags, dayData, period\);/);
  assert.match(fn('buildRoutingByMealJSON'), /const mealFlags = doorAddKitchenPlateFlags\(\{ \.\.\.\(dayData\[period\+'_flags'\] \|\| emptyFlags\) \}, dayData, period\);/);
  assert.match(fn('openMealEdit'), /renderRoutingTab\(doorAddKitchenPlateFlags\(\{ \.\.\.flags \}, dayData, period\), currentVeg\);/);
  assert.match(fn('updateEditFlagsPreview'), /doorAddKitchenPlateFlags\(flags, /);
  const bad = [];
  for (const m of MEALS) {
    const flags = c.doorAddKitchenPlateFlags({ ...(field(m, 'flags') || {}), _altMeals: field(m, 'altMeals') || [] }, m.d, m.period);
    const secs = out(c.computeSections(flags, residents.map((r) => ({ ...r }))));
    const open = new Set(secs.map((s) => s.rule.key));
    const tag = `W${m.wk} ${m.day.slice(0, 3)} ${m.period}`;
    if (open.has('diabetic') && !field(m, 'diabeticAlt')) bad.push(tag + ': a diabetic plate the kitchen doesn’t make');
    if (open.has('bland') && !field(m, 'blandAlt')) bad.push(tag + ': a bland plate the kitchen doesn’t make');
    if (open.has('soft') && field(m, 'altMealsNone') === true) bad.push(tag + ': a soft plate on a "none needed" meal');
    if (open.has('no_dairy') && !field(m, 'noDairyAlt')) bad.push(tag + ': a No Dairy plate with no dairy-free version');
    const seated = new Set(secs.flatMap((s) => s.residents.map((r) => r.room)));
    residents.forEach((r) => { if (!seated.has(r.room)) bad.push(tag + ': ' + r.room + ' has no plate'); });
  }
  assert.deepEqual(bad, []);
  // The plates the kitchen makes do open: Wk2 SUN lunch's diabetic and dairy-free Philly.
  const philly = MEALS.find((m) => m.wk === '2' && m.day === 'SUNDAY' && m.period === 'lunch');
  const flags = c.doorAddKitchenPlateFlags({ ...field(philly, 'flags') }, philly.d, 'lunch');
  const keys = out(c.computeSections(flags, residents.map((r) => ({ ...r })))).map((s) => s.rule.key);
  assert.ok(keys.includes('diabetic') && keys.includes('no_dairy'), keys.join(', '));
});

test('8. Edit Menu edits the alternatives: filled when a meal opens, read by the preview, saved or cleared', () => {
  assert.ok(html.includes('id="mc-kitchen-alt-fields"'), 'the "Alternatives the kitchen makes" block');
  assert.match(fn('openMenuEdit'), /doorFillKitchenAltInputs\(dayData, period\);/, 'filled when the meal opens');
  assert.match(fn('updateSlotSummary'), /doorEditorPlateFlags\(flags\);/, 'the preview opens the plates the sheet will');
  // An emptied box is saved empty, not deleted: every DOOR computer's base menu is the last published one
  // (menu_current.json is pulled into concUploadedMenu), so a deleted field would come back from it.
  assert.match(fn('_finishMenuSave'), /Object\.entries\(doorKitchenAltInputValues\(\)\)\.forEach\(\(\[k, v\]\) => \{ overlay\[week\]\[day\]\[period \+ '_' \+ k\] = v; \}\);/,
    'every box saves as it reads, an emptied one as empty');
  const merge = vm.createContext({});
  vm.runInContext(fn('mergeDoorMenuDataWithOverlay'), merge);
  const base = { '2': { SUNDAY: { lunch: 'Philly', lunch_diabeticAlt: 'WW Tortilla' } } };
  assert.equal(out(merge.mergeDoorMenuDataWithOverlay(base, { '2': { SUNDAY: { lunch_diabeticAlt: '' } } }))['2'].SUNDAY.lunch_diabeticAlt, '',
    'an empty box overrides the published base');
  assert.equal(out(merge.mergeDoorMenuDataWithOverlay(base, { '2': { SUNDAY: {} } }))['2'].SUNDAY.lunch_diabeticAlt, 'WW Tortilla',
    'a deleted one would not (why the save writes it empty)');
  // The real helpers, with a page of inputs: staff text is escaped, read back trimmed, and opens the preview's plates.
  const inputs = {};
  const box = { set innerHTML(h) { this._h = h; for (const mt of h.matchAll(/<input id="(mc-kalt-[a-zA-Z]+)"[^>]*value="([^"]*)">/g)) inputs[mt[1]] = { value: mt[2] }; }, get innerHTML() { return this._h; } };
  const e = vm.createContext({ document: { getElementById: (id) => (id === 'mc-kitchen-alt-fields' ? box : inputs[id] || null) },
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    _escAttr: (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'), testMealActive: false, ALT_MEALS_NONE: true });
  vm.runInContext([html.match(/const DOOR_KITCHEN_ALT_LABELS = \{[^\n]*\};/)[0], fn('doorFillKitchenAltInputs'), fn('doorKitchenAltInputValues'),
    fn('doorEditorPlateFlags')].join('\n'), e);
  e.doorFillKitchenAltInputs({ lunch_diabeticAlt: 'WW Wrap "x"><img src=x>', lunch_gfAlt: 'GF bun' }, 'lunch');
  assert.ok(!/<img/.test(box.innerHTML), 'staff text is escaped');
  assert.equal(Object.keys(inputs).length, 6, 'six boxes: GF, diabetic, no dairy, no egg, bland, anaphylactic');
  inputs['mc-kalt-noDairyAlt'].value = '  DF Burger  ';
  const vals = out(e.doorKitchenAltInputValues());
  assert.equal(vals.noDairyAlt, 'DF Burger'); assert.equal(vals.gfAlt, 'GF bun');
  assert.deepEqual(out(e.doorEditorPlateFlags({})), { _diabeticAlt: vals.diabeticAlt, _noDairyAlt: 'DF Burger', _altMealsNone: true });
});

test('9. a swap or a permanent change drops the old dish’s alternatives; a plate’s dishes split outside brackets', () => {
  const sw = vm.createContext({});
  const PART_LIST = html.match(/const DOOR_KITCHEN_ALT_FIELDS = [^\n]*\n/)[0]
    + (html.includes('const DOOR_DISH_PART_EMPTY = ') ? between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n' : '');
  vm.runInContext(PART_LIST + 'function doorDatedMealFlags() { return {}; }\n' + fn('doorApplyDatedMeal'), sw);
  const day = { lunch: 'Philly Cheese Melt', lunch_gfAlt: 'GF', lunch_diabeticAlt: 'WW', lunch_noDairyAlt: 'DF', lunch_blandAlt: 'B', lunch_noEggAlt: 'NE', lunch_anaphAlt: 'A', dinner_diabeticAlt: 'keep' };
  const d = out(sw.doorApplyDatedMeal(day, 'lunch', { name: 'Halal Beef Burger', entry: { veg: 'Veggie Burger' } }));
  assert.deepEqual(Object.keys(d).filter((k) => /^lunch_.*Alt$/.test(k)), [], 'the swap’s dish brings none of them');
  assert.equal(d.dinner_diabeticAlt, 'keep', 'the other meal keeps its own');
  // Re-pinned 2026-10-19 (v31-standard.42): both Make Permanent paths write every part of the old dish empty through one
  // list (tests/make_permanent_whole_dish_gate.mjs drives them); here, that the alternatives are on it, empty.
  for (const name of ['makePermanent', 'makeSwapPermanentFromBanner'])
    assert.match(fn(name), /doorEmptyDishParts\(overlay\[String\(week\)\]\[(day|dayName)\], period\);/, name + ' writes them empty');
  const parts = vm.runInNewContext(PART_LIST + ';DOOR_DISH_PART_EMPTY');
  for (const k of ['_gfAlt', '_diabeticAlt', '_noDairyAlt', '_blandAlt', '_noEggAlt', '_anaphAlt']) assert.equal(parts[k], '', k);
  assert.equal(parts._altMealsNone, false, 'the new dish starts with its soft plate open');
  assert.deepEqual(out(parts._altMeals), [], 'and without the old dish’s soft plate');
  assert.equal(typeof c.doorSplitDishes, 'function', 'doorSplitDishes');
  assert.deepEqual(out(c.doorSplitDishes('Roasted Chicken and Vegetable strify (No Corn, No Sauce or Beans), Rice')),
    ['Roasted Chicken and Vegetable strify (No Corn, No Sauce or Beans)', 'Rice']);
  assert.deepEqual(out(c.doorSplitDishes('Jerk Chicken, Rice and Beans,  Cabbage Stirfry')), ['Jerk Chicken', 'Rice and Beans', 'Cabbage Stirfry']);
  assert.match(fn('buildRoutingByMealJSON'), /doorSplitDishes\(mealStr\)\.forEach/, 'the routing file’s dishes use it');
});
