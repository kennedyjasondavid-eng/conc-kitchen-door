// Mat's Rexdale menu changes (2026-10-30), every cycle (Jason, 2026-10-30). Authored red on DOOR c71a5cf.
// Wk2 FRI lunch: CONC Salad → Beef Chili (Bloor; its vegan batch is the vegetarian chili), Cornbread and Sautéed Cabbage
// from Rex (vegan: Rex's vegan cornbread, the cabbage in oil). Wk2 THU dinner: roasted potatoes hot from Bloor for the mash.
// Wk2 SAT lunch: no parsnip and carrot; Rex's buttered green beans (plain for vegan). Wk2 SAT dinner: BBQ meatloaf (beef and
// vegan, a bought BBQ glaze) with mashed potato. Wk3 SUN dinner: Bolognese, not meatballs. Wk3 MON dinner's "Roast Chicken"
// is the Moroccan legs (EXPO read it as the Shakshuka legs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { putBackRexMenuChanges } from './helpers/rex_menu_changes_2026-10-30.mjs';

const read = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const menu = read('menu_current.json').menu, overlay = read('menu_overlay.json'), routing = read('routing_by_meal.json');
const F = read('tests/fixtures/rex_menu_changes_2026-10-30.json');
const on = (flags) => Object.keys(flags || {}).filter((k) => flags[k]).sort();

test('Wk2 FRI lunch is Beef Chili with Rex’s cornbread and cabbage; the vegan line is the chili’s vegan batch', () => {
  const d = menu['2'].FRIDAY;
  assert.equal(d.lunch, 'Beef Chili, Cornbread, Sautéed Cabbage');
  assert.equal(d.lunch_veg, 'Vegetarian Chili, Vegan Cornbread, Sautéed Cabbage (no butter)');
  assert.deepEqual(on(d.lunch_flags), ['halalCertifiedMeat', 'hasBeans', 'hasBeef', 'hasBrassicas', 'hasCorn', 'hasDairy', 'hasEgg', 'hasGluten', 'hasNightshades', 'isCarb', 'isSpicy']);
  assert.deepEqual(on(d.lunch_slots.main.flags), on(d.lunch_flags), 'the main dish carries the meal’s ticks');
  assert.deepEqual(on(d.lunch_slots.veganalt.flags), ['hasBeans', 'hasCorn', 'hasGluten', 'hasNightshades', 'hasSulphites', 'isSpicy']);
  assert.ok(!/CONC Salad/i.test(JSON.stringify(d).replace(/"lunch_original":[\s\S]*$/, '')), 'no CONC Salad left in the meal');
  assert.equal(d.lunch_noDairyAlt, 'Beef Chili, Sautéed Cabbage (no butter)');
  assert.equal(d.lunch_gfAlt, 'Beef Chili, Sautéed Cabbage');
  assert.ok(d.lunch_blandAlt, 'a spicy main gets a bland plate');
});

// Re-pinned 2026-10-30 (Rex's week sheet is canon for meal placement, Jason): the sausage dinner with its roasted
// potatoes is Wk2 FRI now, and Arroz con Pollo with refried beans Wk2 THU (the two whole meals traded days).
test('the sausage dinner (Wk2 FRI) has roasted potatoes, Wk2 SAT lunch buttered green beans, Wk2 SAT dinner BBQ meatloaf and mash', () => {
  assert.equal(menu['2'].FRIDAY.dinner, 'Sausages, Roasted Potatoes, Gravy, Peas & Carrots');
  assert.equal(menu['2'].FRIDAY.dinner_veg, 'Vegan Sausages, Roasted Potatoes, Gravy, Peas & Carrots');
  assert.equal(menu['2'].FRIDAY.dinner_slots.veganalt.displayText, 'Vegan Sausages');
  assert.equal(menu['2'].FRIDAY.dinner_halal, F.menu['2|THURSDAY'].dinner_halal, 'the halal sausages move with it');
  assert.equal(menu['2'].THURSDAY.dinner, F.menu['2|FRIDAY'].dinner, 'Arroz con Pollo is Wk2 THU dinner');
  assert.deepEqual(menu['2'].THURSDAY.dinner_flags, F.menu['2|FRIDAY'].dinner_flags, 'with its own ticks');
  assert.deepEqual(menu['2'].FRIDAY.dinner_flags, F.menu['2|THURSDAY'].dinner_flags, 'and the sausages with theirs');
  assert.equal(menu['2'].SATURDAY.lunch, 'Chicken Tenders, Sweet Potato, Buttered Green Beans');
  assert.equal(menu['2'].SATURDAY.lunch_veg, 'Vegan Tenders, Sweet Potato, Green Beans');
  assert.equal(menu['2'].SATURDAY.dinner, 'BBQ Beef Meatloaf, Mashed Potato, Roasted Zucchini');
  assert.equal(menu['2'].SATURDAY.dinner_veg, 'BBQ Vegan Meatloaf, Mashed Potato, Roasted Zucchini, Butternut Squash');
  for (const [d, p] of [['SATURDAY', 'lunch'], ['SATURDAY', 'dinner']])
    assert.deepEqual(menu['2'][d][p + '_flags'], F.menu['2|' + d][p + '_flags'], `Wk2 ${d} ${p} keeps its ticks`);
});

test('Wk3 SUN dinner is Bolognese again: the meatballs’ egg, mustard and sulphites come off', () => {
  const d = menu['3'].SUNDAY;
  assert.equal(d.dinner, 'Beef Bolognese, Pasta, Peas & Carrots');
  assert.equal(d.dinner_veg, 'Vegetarian Bolognese, Pasta, Peas & Carrots');
  assert.deepEqual(on(d.dinner_flags), ['halalCertifiedMeat', 'hasBeef', 'hasGluten', 'hasNightshades', 'isCarb']);
  assert.equal(d.dinner_diabeticAlt, 'Whole wheat pasta, Beef Bolognese, Peas & Carrots');
  assert.ok(!d.dinner_noEggAlt, 'no egg plate: nothing on the meal has egg');
});

test('Wk3 MON dinner’s Roast Chicken links to the Moroccan legs and still shows Roast Chicken; Wk1 THU’s does not', () => {
  const main = menu['3'].MONDAY.dinner_slots.main;
  assert.equal(main.recipeName, 'Moroccan Chicken Legs');
  assert.equal(main.recipeId, 'moroccan-chicken-legs');
  assert.equal(main.displayText, 'Roast Chicken');
  assert.equal(menu['3'].MONDAY.dinner, F.menu['3|MONDAY'].dinner, 'the menu text is unchanged');
  assert.notEqual((menu['1'].THURSDAY.dinner_slots || {}).main?.recipeName, 'Moroccan Chicken Legs');
});

test('the overlay carries every change, keeps each meal’s original and stamps the five days newer', () => {
  for (const k of F.days) assert.ok(Number(overlay._meta.dayEditedAt[k]) > Number(F.dayEditedAtBefore[k] || 0), k + ' stamped newer, so every DOOR computer takes it');
  for (const [wk, day, p] of [['2', 'FRIDAY', 'lunch'], ['2', 'THURSDAY', 'dinner'], ['2', 'SATURDAY', 'lunch'], ['2', 'SATURDAY', 'dinner'], ['3', 'SUNDAY', 'dinner'], ['3', 'MONDAY', 'dinner']]) {
    const kept = overlay[wk][day][p + '_original'];
    assert.ok(kept && kept.meal && kept.how === 'Mat (Rexdale), 2026-10-30', `Wk${wk} ${day} ${p} keeps its original for Revert`);
    assert.equal(kept.meal[''], F.menu[wk + '|' + day][p], `Wk${wk} ${day} ${p}'s original is the meal as published`);
  }
  for (const k of F.days) {
    const [wk, day] = k.split('|');
    for (const f of Object.keys(menu[wk][day])) if (!f.endsWith('_original'))
      assert.deepEqual(menu[wk][day][f], { ...F.menu[k], ...overlay[wk][day] }[f] ?? menu[wk][day][f], k + ' ' + f + ' is what the overlay says');
  }
});

test('putting back the five days recovers the menu as published before them', () => {
  const after = putBackRexMenuChanges(menu, 'menu');
  for (const k of F.days) { const [wk, day] = k.split('|'); assert.deepEqual(after[wk][day], F.menu[k]); }
});

test('routing counts the new dishes, not the old ones', () => {
  const c = (wk, day, p) => (((routing.routing[wk] || {})[day] || {})[p] || {})._components || {};
  const fl = c('2', 'FRIDAY', 'lunch'), sun = c('3', 'SUNDAY', 'dinner');
  assert.ok(fl['Beef Chili'] > 100 && fl['Vegetarian Chili'] > 0 && !fl['CONC Salad - Beef'], JSON.stringify(fl));
  assert.ok(sun['Beef Bolognese'] > 100 && !sun['Halal Beef Meatballs'], JSON.stringify(sun));
  assert.ok(c('2', 'FRIDAY', 'dinner')['Roasted Potatoes'] > 100 && !c('2', 'FRIDAY', 'dinner')['Mashed Potato']);
  assert.ok(!c('2', 'THURSDAY', 'dinner')['Roasted Potatoes'] && !c('2', 'FRIDAY', 'dinner')['Refried Beans'], 'the dishes count where their meal is now');
  assert.ok(c('2', 'SATURDAY', 'dinner')['Mashed Potato'] > 100 && !c('2', 'SATURDAY', 'lunch')['Roasted Parsnip and Carrot']);
});

// 2026-10-30, Rex's week sheet: Wk2 SUN's vegan lunch is Rex's "Portobello Cheese Melt"; Jason: it has vegan cheese.
test('the vegan Sunday lunch reads as Rex names it, keeps its recipe link, and never reads as dairy', () => {
  const d = menu['2'].SUNDAY;
  assert.equal(d.lunch_veg, 'Portobello Cheese Melt (vegan cheese), Chips, Fruit');
  assert.equal(d.lunch_slots.veganalt.recipeName, 'Vegan Mushroom Sandwich');
  assert.equal(d.lunch_slots.veganalt.displayText, 'Portobello Cheese Melt (vegan cheese)');
  assert.equal(d.lunch_slots.veganalt.flags.hasDairy, false);
});
