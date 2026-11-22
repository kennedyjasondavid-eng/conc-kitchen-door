// Edit Menu redesign U1 (D9, Jason 2026-11-19: "Follow lean on D9"): the combined dish boxes are split, the vegan plate
// does not get the tzatziki (Jason: "Follow lean"), and Turmeric is spelled right, as published (publication 39).
// Reads the published menu_current.json; a later reviewed menu change that touches these meals re-pins this with a
// dated note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const meal = (w, d) => menu[w][d];

test('U1-1 no dish box holds two dishes on the four meals that did', () => {
  for (const [w, d, p] of [['1', 'FRIDAY', 'dinner'], ['4', 'SUNDAY', 'lunch'], ['4', 'MONDAY', 'lunch'], ['4', 'SATURDAY', 'lunch']]) {
    const slots = meal(w, d)[p + '_slots'] || {};
    for (const id of ['main', 'veganalt']) {
      const s = slots[id] || {};
      const words = s.displayText || s.manual || '';
      assert.ok(!/[&,]/.test(words), `Wk${w} ${d} ${p} ${id} holds one dish: ${words}`);
    }
  }
});
test('U1-2 the vegan plate does not get the tzatziki on Wk4 SUN lunch; the regular plate still does', () => {
  const m = meal('4', 'SUNDAY');
  assert.equal(m.lunch_veg, 'Black bean patty, Naan, Steamed Carrots');
  assert.match(m.lunch, /Tzatziki/);
  assert.deepEqual(m.lunch_slots.xtra.lines.vegan, { mode: 'none' });
});
test('U1-3 Turmeric is spelled right and the falafel line has no double space', () => {
  // Re-pinned 2026-11-19 (the U1 side boxes answered, publication 40): Wk4 SAT lunch's Turmeric Quinoa box now links
  // CODEX's recipe, whose record name is still "Tumeric Quinoa" until CODEX renames it; the menu's words (meal lines and
  // what each box shows) are what must be spelled right.
  // Review fold: the whole published menu is scanned, skipping only a linked recipe's record name.
  const scan = JSON.stringify(menu, (k, v) => (k === 'recipeName' ? undefined : v));
  assert.ok(!scan.includes('Tumeric'), 'no menu words say Tumeric');
  assert.equal(meal('4', 'SATURDAY').lunch_slots.vegextras.displayText, 'Turmeric Quinoa');
  assert.equal(meal('4', 'MONDAY').lunch_veg, 'Falafel Sandwich, Fruit and Chips, Sub Bun');
});
test('U1-4 the regular menu words did not change on these meals', () => {
  assert.equal(meal('1', 'FRIDAY').dinner, 'Pork Adobo, Rice, Garlic Green Bean');
  assert.equal(meal('4', 'SUNDAY').lunch, 'Pork Souvlaki, Naan, Steamed Carrots, Tzatziki');
  assert.equal(meal('4', 'MONDAY').lunch, 'Chicken Ranch Salad Sandwich, Fruit and Chips');
  assert.equal(meal('4', 'SATURDAY').lunch, 'Lime-Spiced Chicken Legs, Garlic Bread, Steamed Broccoli');
});
test('U1-5 the safety ticks stayed: each meal keeps its allergen ticks; the tzatziki box carries its own', () => {
  // Review fold: pin what the split must not lose (as published at publication 39).
  const f = (w, d, p) => meal(w, d)[p + '_flags'] || {};
  assert.ok(f('1', 'FRIDAY', 'dinner').hasPork && f('1', 'FRIDAY', 'dinner').hasSoy && f('1', 'FRIDAY', 'dinner').hasTreeNuts && f('1', 'FRIDAY', 'dinner').hasCoconut);
  assert.ok(f('4', 'SUNDAY', 'lunch').hasPork && f('4', 'SUNDAY', 'lunch').hasDairy && f('4', 'SUNDAY', 'lunch').hasGluten && f('4', 'SUNDAY', 'lunch').hasSulphites);
  assert.ok(meal('4', 'SUNDAY').lunch_slots.xtra.flags.hasDairy && meal('4', 'SUNDAY').lunch_slots.xtra.flags.hasSulphites);
  assert.ok(meal('4', 'SUNDAY').lunch_slots.main.flags.hasDairy, 'the main box keeps the meal ticks it carried');
  assert.ok(meal('1', 'FRIDAY').dinner_slots.main.flags.hasPork);
});
test('U1-6 routing: the section counts of the four meals are what plating gave before the split', () => {
  const r = JSON.parse(fs.readFileSync('routing_by_meal.json', 'utf8')).routing;
  const sections = (w, d, p) => Object.fromEntries(Object.entries(r[w][d][p]).filter(([k]) => k !== '_components'));
  const total = (o) => Object.values(o).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  for (const [w, d, p] of [['1', 'FRIDAY', 'dinner'], ['4', 'SUNDAY', 'lunch'], ['4', 'MONDAY', 'lunch'], ['4', 'SATURDAY', 'lunch']]) assert.ok(total(sections(w, d, p)) > 0, 'every resident still has a plate');
  // 2026-11-22 (re-pinned: it held the live count, 150, so every resident change on a publish turned it red):
  // the vegan plate no longer gets the tzatziki, so the tzatziki goes to everyone the naan goes to, less the vegan plate.
  const m = r['4'].SUNDAY.lunch;
  assert.equal(m._components.Tzatziki, m._components.Naan - m['Vegan / Vegetarian'], 'the vegan plate no longer gets the tzatziki');
});

