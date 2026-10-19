// tests/plating_review_ticks_gate.mjs — the menu ticks the plating review found missing stay on while their dish is on
// the meal (2026-10-19). The review compared DOOR's plating sheets with the kitchen's manual ones (Oct 17 workbooks):
// the manual CONTAINS lines named an allergen DOOR's menu didn't tick, so No Dairy residents got cheese on both burger
// lunches, the No Beef residents (704, 901) got the Philly, the No Eggs residents (304, 412) the Tuna Rex Salad's egg,
// GF residents the al pastor tortillas, and room 213 (anaphylactic: coconut) the Pork Griot's coconut rice. Arroz con
// Pollo and the Philly are halal-certified (the manual sheets make no halal plate for either), so ticking the Philly's
// beef doesn't open a halal plate the kitchen doesn't make. Jason, 2026-10-19: "Add them all".
// Each tick was added through DOOR's own menu save (days stamped, newest edit wins); the meal's main dish carries it
// where the meal has dish slots, as Edit Menu writes it. A meal whose dish has changed since is not checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const menu = read('menu_current.json').menu;
const overlay = read('menu_overlay.json');
const TICKS = [
  ['1', 'MONDAY', 'lunch', 'hasMustard', 'Breaded Chicken Burgers', 'mustard'],
  ['2', 'SUNDAY', 'lunch', 'hasBeef', 'Philly Cheese Melt', 'beef'],
  ['2', 'SUNDAY', 'lunch', 'halalCertifiedMeat', 'Philly Cheese Melt', null],
  ['2', 'TUESDAY', 'lunch', 'hasMustard', 'Tuna Salad', 'mustard'],
  ['2', 'WEDNESDAY', 'lunch', 'hasEgg', 'Oven Fried Chicken', 'egg'],
  ['2', 'THURSDAY', 'lunch', 'hasDairy', 'Halal Beef Burger', 'dairy'],
  ['2', 'FRIDAY', 'dinner', 'halalCertifiedMeat', 'Arroz Con Pollo', null],
  ['2', 'SATURDAY', 'lunch', 'hasDairy', 'Chicken Tenders', 'dairy'],
  ['2', 'SATURDAY', 'lunch', 'hasEgg', 'Chicken Tenders', 'egg'],
  ['3', 'TUESDAY', 'dinner', 'hasDairy', 'Caribbean Chicken Curry', 'dairy'],
  ['3', 'THURSDAY', 'dinner', 'hasCoconut', 'Pork Griot', null],   // the allergen line prints priority allergens only
  ['4', 'TUESDAY', 'lunch', 'hasGluten', 'Pork Al Pastor Taco', 'gluten'],
  ['4', 'WEDNESDAY', 'lunch', 'hasEgg', 'Tuna Rex Salad', 'egg'],
  ['4', 'THURSDAY', 'lunch', 'hasDairy', 'Beef Burger', 'dairy'],
];
const onMenu = ([wk, day, period, , dish]) => String((menu[wk][day] || {})[period] || '').includes(dish);

test('each tick is on the published meal while its dish is on it, on the main dish too, and its allergen line names it', () => {
  let checked = 0;
  for (const t of TICKS) {
    if (!onMenu(t)) continue;
    const [wk, day, period, flag, dish, word] = t;
    const d = menu[wk][day];
    assert.equal((d[period + '_flags'] || {})[flag], true, `W${wk} ${day} ${period} (${dish}): ${flag}`);
    const main = d[period + '_slots'] && d[period + '_slots'].main;
    if (main) assert.equal((main.flags || {})[flag], true, `W${wk} ${day} ${period}: the main dish carries ${flag}`);
    if (word) assert.match(String(d['allergens_' + period] || ''), new RegExp('\\b' + word + '\\b', 'i'), `W${wk} ${day} ${period}: allergen line names ${word}`);
    checked++;
  }
  assert.ok(checked >= 12, 'most ticks still apply: ' + checked);
});

test('the overlay every DOOR computer merges carries each tick it holds the meal for', () => {
  for (const t of TICKS) {
    if (!onMenu(t)) continue;
    const [wk, day, period, flag] = t;
    const od = (overlay[wk] || {})[day] || {};
    if (od[period + '_flags']) assert.equal(od[period + '_flags'][flag], true, `overlay W${wk} ${day} ${period}: ${flag}`);
    const main = od[period + '_slots'] && od[period + '_slots'].main;
    if (main) assert.equal((main.flags || {})[flag], true, `overlay W${wk} ${day} ${period}: the main dish carries ${flag}`);
  }
});
