// The allergen ticks Jason confirmed for the menu (2026-10-16) stay on while their dish is on that meal.
//
// DOOR checks residents against each meal's ticks, and those came from the July workbook, so some meals were behind
// the CODEX recipe they serve (Pork Adobo had no Soy or Coconut tick). Jason, 2026-10-16, on the meal-by-meal list:
// "assume no gluten in boullion or soy, otherwise follow leans"; Spicy "leans look good"; Vindaloo is made with the
// Vindaloo Sauce, Caribbean Chicken Curry is the Caribbean Stew, Fish Curry is fish with the green curry sauce (its
// paste brings Soy and Nightshades); the Sweet Potato Biscuit is left (provenance unknown). Each tick was added through
// DOOR's own menu save (days stamped, newest edit wins) and only ever adds a warning.
// A meal whose dish has changed since is not checked: the tick belonged to the old dish.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const menu = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8')).menu;
const TICKS = [
  ['1','FRIDAY','dinner','hasCoconut',"Pork Adobo"],
  ['1','FRIDAY','dinner','hasSoy',"Pork Adobo"],
  ['1','FRIDAY','dinner','hasSulphites',"Pork Adobo"],
  ['1','FRIDAY','dinner','hasTreeNuts',"Pork Adobo"],
  ['1','FRIDAY','lunch','hasNightshades',"Potato Salad"],
  ['1','MONDAY','dinner','hasNightshades',"Jerk Chicken"],
  ['1','MONDAY','dinner','hasTreeNuts',"Rice and Beans"],
  ['1','SATURDAY','dinner','hasDairy',"Gomen Besiga with Vegetable"],
  ['1','SATURDAY','dinner','hasNightshades',"Gomen Besiga with Vegetable"],
  ['1','SATURDAY','dinner','isSpicy',"Gomen Besiga with Vegetable"],
  ['1','SATURDAY','lunch','hasNightshades',"Chicken Fajitas"],
  ['1','TUESDAY','lunch','hasNightshades',"Blackened Fish"],
  ['2','FRIDAY','dinner','hasNightshades',"Refried Beans"],
  ['2','MONDAY','dinner','hasCoconut',"West African Peanut Stew"],
  ['2','MONDAY','dinner','hasNightshades',"West African Peanut Stew"],
  ['2','MONDAY','dinner','hasSulphites',"West African Peanut Stew"],
  ['2','MONDAY','dinner','hasTreeNuts',"West African Peanut Stew"],
  ['2','MONDAY','dinner','isSpicy',"West African Peanut Stew"],
  ['2','SATURDAY','dinner','hasEgg',"Beef Meatloaf"],
  ['2','SATURDAY','dinner','hasGluten',"Beef Meatloaf"],
  ['2','SATURDAY','dinner','hasMustard',"Beef Meatloaf"],
  ['2','SATURDAY','dinner','hasNightshades',"Potatoes"],
  ['2','SATURDAY','dinner','hasSulphites',"Beef Meatloaf"],
  ['2','THURSDAY','dinner','hasNightshades',"Sausages & Mash"],
  ['2','TUESDAY','dinner','hasMustard',"Pork Vindaloo"],
  ['2','TUESDAY','dinner','hasNightshades',"Pork Vindaloo"],
  ['2','TUESDAY','dinner','isSpicy',"Pork Vindaloo"],
  ['2','WEDNESDAY','dinner','hasNightshades',"Okra and cassava stew"],
  ['2','WEDNESDAY','dinner','hasNightshades',"Yetisse Fish"],
  ['2','WEDNESDAY','dinner','isSpicy',"Okra and cassava stew"],
  ['2','WEDNESDAY','dinner','isSpicy',"Yetisse Fish"],
  ['3','FRIDAY','dinner','hasNightshades',"Chicken and Mushroom Fried Rice"],
  ['3','FRIDAY','lunch','hasTreeNuts',"Lime Coconut Rice"],
  ['3','MONDAY','lunch','hasEgg',"Creamy Coleslaw"],
  ['3','MONDAY','lunch','hasSulphites',"Creamy Coleslaw"],
  ['3','SATURDAY','lunch','hasNightshades',"Pineapple Rice"],
  ['3','SUNDAY','lunch','hasMustard',"Coronation Chicken Salad Sandwich"],
  ['3','SUNDAY','lunch','hasNightshades',"Coronation Chicken Salad Sandwich"],
  ['3','TUESDAY','dinner','hasNightshades',"Caribbean Chicken Curry"],
  ['3','TUESDAY','dinner','hasSulphites',"Caribbean Chicken Curry"],
  ['3','TUESDAY','dinner','hasTreeNuts',"Caribbean Chicken Curry"],
  ['3','TUESDAY','lunch','hasNightshades',"Roast Potatoes"],
  ['3','TUESDAY','lunch','hasSulphites',"Glazed Ham"],
  ['3','WEDNESDAY','dinner','hasNightshades',"Baked Tomato Fish"],
  ['3','WEDNESDAY','dinner','hasNightshades',"Couscous"],
  ['4','FRIDAY','dinner','hasCorn',"Vegetable Briyani"],
  ['4','FRIDAY','lunch','hasNightshades',"Beef lasagna"],
  ['4','MONDAY','dinner','hasNightshades',"Fish Curry"],
  ['4','MONDAY','dinner','hasSoy',"Fish Curry"],
  ['4','MONDAY','dinner','hasTreeNuts',"Fish Curry"],
  ['4','MONDAY','lunch','hasEgg',"Chicken Ranch Salad Sandwich"],
  ['4','MONDAY','lunch','hasNightshades',"Chicken Ranch Salad Sandwich"],
  ['4','SATURDAY','dinner','hasNightshades',"Beef Massaman Curry"],
  ['4','SATURDAY','lunch','hasNightshades',"Lime-Spiced Chicken Legs"],
  ['4','SATURDAY','lunch','hasSulphites',"Lime-Spiced Chicken Legs"],
  ['4','SUNDAY','lunch','hasSulphites',"Pork Souvlaki"],
  ['4','TUESDAY','dinner','hasNightshades',"BBQ Chicken Leg"],
  ['4','TUESDAY','lunch','hasNightshades',"Pork Al Pastor Taco"],
  ['4','TUESDAY','lunch','hasSulphites',"Pork Al Pastor Taco"],
  ['4','WEDNESDAY','dinner','hasNightshades',"Beef and Vegetable Stew"],
  ['4','WEDNESDAY','dinner','hasNightshades',"Potatoes"]
];
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
test('every confirmed tick is on its meal while the dish is still there', () => {
  const missing = [], checked = [];
  TICKS.forEach(([wk, day, period, flag, dish]) => {
    const d = menu[wk] && menu[wk][day];
    if (!d) return;
    const lines = [d[period], d[period + '_sides']].map(norm).join(' | ');
    if (lines.indexOf(norm(dish)) < 0) return; // the dish changed; its tick went with it
    checked.push(dish);
    if (!(d[period + '_flags'] || {})[flag]) missing.push(`W${wk} ${day} ${period} ${dish}: ${flag}`);
  });
  assert.ok(checked.length >= 50, 'the published menu still serves most of these dishes (' + checked.length + ')');
  assert.deepEqual(missing, []);
});
test('the gluten Jason ruled out (bouillon, soy sauce) was not ticked by this change', () => {
  assert.equal(TICKS.filter(([, , , flag]) => flag === 'hasGluten').length, 1); // only the meatloaf's panko
});
