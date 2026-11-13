// tests/rex_import_safety_gate.mjs — the Week 4 setup's import fixes (2026-11-12; Week4_Setup_Friction_Notes_2026-11-11.md,
// items 1, 4, 5, 6, 11, 13, 14, 16; Jason: "Clean up any remaining DOOR: fix menu-import gaps from Week 4 setup work").
// Prevents, food safety first:
//   - the review offering, ticked, to take a real allergen off the plate when the new dish has no recipe yet
//     (Wk4: lasagna replacing a burger offered Dairy; tortilla tacos replacing lasagna offered Gluten and Nightshades);
//   - the halal plate inheriting Pork from a dish name ("Halal chicken al pastor");
//   - the packaging row ("12 x 12 Thermfoil & Labels", "Small Square") read as breakfast food;
//   - "Beef Massaman Curry and Rice" read as a new dish against "Beef Massaman Curry, Rice";
//   - the upload reading the wrong tab when two match ("Week 4 Kitchen" and "Week 4 Kitchen (Mod)");
//   - an unticked Spicy ticking itself back on in Edit Menu; the "No matches" row only half clickable.
// Fixed examples only (never the live menu): a small Week 4 sheet and a fixed DOOR week below.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { rexWeekBox, rexCtx } from './helpers/rex_week_box.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));
const api = rexWeekBox(ROOT);
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const row = (label, cells) => [label].concat(DAYS.map((_, i) => cells[i] || ''));
// Rex's sheet, Week 4, laid out as the kitchen's workbook (labels in column A, an unlabelled packaging row).
const ROWS = [
  row('WEEK 4', DAYS),
  row('BREAKFAST', ['Turkey Breakfast sandwich', 'Pancakes, turkey bacon', 'Cereal and milk', 'Vegetarian Frittata', 'Scrambled eggs & sausage', 'Oatmeal', 'Bagel']),
  row('Vegetarian', ['Vegan Breakfast Patties Sandwich', 'Pancakes, Vegan Breakfast Patties', 'Cereal and milk', 'Vegetarian Frittata', 'Scrambled eggs & veg patty', 'Oatmeal', 'Bagel']),
  row('', ['fruit & yoghurt', 'fruit & yoghurt', 'fruit', 'fruit & yoghurt', 'fruit & yoghurt', 'fruit & yoghurt', 'fruit & yoghurt']),
  row('', ['12 x 12 Thermfoil & Labels', 'Small Square & Soup Lids', 'Big Brown Bag', 'Small Square', 'Small Square', 'Small Square', 'Small Brown Bags']),
  row('LUNCH', ['Pork Souvlaki, Naan', 'Chicken Ranch Salad Sandwich', 'Japanese Beef Donburi, Rice', 'Tuna Rex Salad', 'Beef lasagna, Zucchini & Carrot', 'Pork Tacos Al Pastor, Pea & Carrots', 'Lime-Spiced Chicken Legs, Garlic Bread']),
  row('Vegetarian', ['Black bean patty, Naan', 'Falafel Sandwich', 'Japanese Mushroom Donburi, Rice', 'Chickpea Rex Salad', 'Veggie lasagna, Zucchini & Carrot', 'Vegetarian Tacos, Pea & Carrots', 'Roasted Veg and Tofu Medley, Garlic Bread']),
  row('Halal Option', ['Halal chicken Souvlaki', '', '', '', '', 'Halal chicken al pastor', '']),
  row('DINNER', ['White Chilli Chicken Pasta Casserole', 'Fish Curry, Steamed Rice', 'Tandoori Pork, Vegetable Briyani', 'Beef and Vegetable Stew, Potatoes', 'Teriyaki Chicken, Vegetable Egg Noodles', 'Kimchi Chicken Fried Rice', 'Beef Massaman Curry and Rice']),
  row('Vegetarian', ['White Chilli Pasta Casserole', 'Tofu Curry, Steamed Rice', 'Tandoori Tofu, Vegetable Briyani', 'Vegan Pot Pie', 'Teriyaki Tofu, Vegetable Egg Noodles', 'Kimchi Fried Rice', 'Vegetarian Massaman Curry and Rice']),
];
// DOOR's Week 4 before the change: the meals that move, with the ticks they had.
const F = (...k) => Object.fromEntries(k.map(x => [x, true]));
const DOOR = {
  THURSDAY: { lunch: 'Beef Burger, Side Salad', lunch_veg: 'Veggie Burger, Side Salad', lunch_flags: F('hasBeef', 'hasDairy', 'hasGluten', 'halalCertifiedMeat') },
  FRIDAY: { lunch: 'Beef lasagna, Cauliflower & Carrot', lunch_veg: 'Veggie lasagna, Cauliflower & Carrot',
    lunch_flags: F('hasBeef', 'hasDairy', 'hasGluten', 'hasNightshades', 'hasBrassicas') },
  SATURDAY: { dinner: 'Beef Massaman Curry, Rice', dinner_veg: 'Vegetarian Massaman Curry, Rice',
    dinner_flags: F('hasBeef', 'hasPeanuts', 'hasTreeNuts', 'hasCoconut', 'hasGluten', 'hasSoy', 'hasSulphites', 'hasNightshades', 'isSpicy') },
};
const plan = () => out(api.doorPlanRexWeek(api.doorReadRexWeekRows(ROWS), DOOR, rexCtx(api)));
const meal = (key) => plan().meals.find(m => m.key === key);

test('the packaging row is not breakfast food', () => {
  const rex = out(api.doorReadRexWeekRows(ROWS));
  assert.equal(rex.week, 4);
  for (const d of DAYS) assert.doesNotMatch(rex.days[d].breakfast.reg + ' ' + rex.days[d].breakfast.veg, /therm|square|brown bag|label|lid/i, d);
  assert.match(rex.days.SUNDAY.breakfast.reg, /fruit & yoghurt$/, 'the real side row still joins breakfast');
});

test('a new dish with no recipe: nothing starts ticked to come off, and what its name carries is never offered', () => {
  const fri = meal('4-FRIDAY-lunch');   // tortilla tacos al pastor replace lasagna
  assert.equal(fri.mainChanged, true);
  assert.equal(fri.unlinkedNew, true, 'no CODEX recipe is called "Pork Tacos Al Pastor"');
  assert.equal(fri.removeDefault, false, 'so nothing starts ticked');
  for (const k of ['hasGluten', 'hasNightshades']) assert.ok(!fri.removeFlags.includes(k), k + ' is named by tacos / al pastor, never offered');
  const thu = meal('4-THURSDAY-lunch');  // lasagna replaces a burger
  assert.ok(!thu.removeFlags.includes('hasDairy'), 'lasagna names its cheese: Dairy is not offered');
  assert.ok(!thu.removeFlags.includes('hasGluten'), 'nor Gluten');
  assert.equal(thu.removeDefault, false);
  const ui = fnBlock('doorRexRemovalsHTML');
  assert.match(ui, /has no CODEX recipe yet, so DOOR can’t tell what it carries/, 'the review says why nothing is ticked');
});

test('what a dish name carries, read without a recipe', () => {
  const f = (t) => out(api.doorRexPieceFlags(t, null, api.hubAllergenToFlags));
  assert.equal(f('Pork Tacos Al Pastor').hasGluten, true);
  assert.equal(f('Pork Tacos Al Pastor').hasNightshades, true);
  assert.equal(f('Beef lasagna').hasDairy, true);
  assert.equal(f('Beef lasagna').hasGluten, true);
  assert.notEqual(f('Veggie lasagna (vegan)').hasDairy, true, 'a vegan lasagna names no dairy');
  assert.notEqual(f('Japanese Beef Donburi').hasGluten, true, 'a name that carries nothing adds nothing');
});

test('"Curry and Rice" is "Curry, Rice": the same dish, no question', () => {
  const sat = meal('4-SATURDAY-dinner');
  assert.equal(sat.mainChanged, false, 'the main is the same dish');
  assert.notEqual(sat.status, 'ask', 'no question for a reworded plate');
  assert.deepEqual(sat.removeFlags.filter(k => /Peanuts|TreeNuts|Coconut|Soy/.test(k)), [], 'nothing of the curry is offered to come off');
});

test('the halal plate never inherits Pork from a dish name', () => {
  const fri = meal('4-FRIDAY-lunch');
  const built = out(api.doorRexBuildMeal(fri, DOOR.FRIDAY, { removeFlags: [] }, rexCtx(api)));
  assert.equal(built.halal, 'Halal chicken al pastor');
  assert.ok(built.slots.mainalt, 'the halal plate is a slot');
  assert.notEqual(built.slots.mainalt.flags.hasPork, true, 'no Pork on "Halal chicken al pastor"');
  assert.equal(built.slots.main.flags.hasPork, true, 'the regular pork tacos keep Pork');
  assert.equal(built.flags.hasGluten, true, 'and the meal keeps Gluten (tortillas)');
});

test('the tab the workbook was saved on is read first, and named', () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(fnBlock('doorRexSheetOrder') + '\nthis.f = doorRexSheetOrder;', c);
  const names = [' Week 1 Kitchen', 'Week 4 Kitchen', 'Week 4 Kitchen (Mod)', 'Week 4 Intake'];
  assert.deepEqual(out(c.f(names, 'Week 4 Kitchen (Mod)')), ['Week 4 Kitchen (Mod)', ' Week 1 Kitchen', 'Week 4 Kitchen', 'Week 4 Intake']);
  assert.deepEqual(out(c.f(names, ' Week 1 Kitchen')), names, 'already first: unchanged');
  assert.deepEqual(out(c.f(names, null)), names, 'no saved-on tab: unchanged');
  const up = fnBlock('triggerRexWeekUpload');
  assert.match(up, /doorRexSheetOrder\(wb\.SheetNames, active\)/);
  assert.match(up, /rex\.sheetName = n/);
  // Re-pinned 2026-11-13 (upload_read_banner_gate, Week 4 log 3): the tab line moved into the large banner at the top
  // of the review (doorUploadReadHTML), which names the tab read on every upload, not only a many-tab one.
  assert.match(fnBlock('doorRenderRexWeekReview'), /tabs: \[R\.rex\.sheetName\]/, 'the review names the tab');
  assert.match(fnBlock('doorUploadReadHTML'), /Read from the ' \+ tabs\(/, 'in so many words');
  assert.match(fnBlock('parseMenuWorkbook'), /active && re\.test\(active\) \? active :/, 'Menu Config upload prefers the saved-on tab too');
});

test('Edit Menu: an unticked Spicy stays off; the "No matches" row is one button and says it unlinks', () => {
  assert.match(fnBlock('updateSlotSummary'), /isOn && !cb\.checked && !\(f\.mealLevel && wasOn\)/);
  const ss = fnBlock('slotSearch');
  assert.match(ss, /<div onclick="' \+ _escJsAttrCall\('slotSaveManual', \[slotId\]\) \+ '" onmousedown="event\.preventDefault\(\)"/, 'the whole row is clickable');
  assert.match(ss, /unlink “' \+ escapeHtml\(cur\.recipeName\) \+ '” and use/, 'on a linked slot it says it unlinks');
  assert.match(fnBlock('slotSaveManual'), /MEAL_SLOT_STATE\[slotId\] = \{ manual: val \}/, 'and it does: the slot becomes the typed words');
});
