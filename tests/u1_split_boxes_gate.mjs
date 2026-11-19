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
  assert.ok(!JSON.stringify(menu).includes('Tumeric'));
  assert.equal(meal('4', 'MONDAY').lunch_veg, 'Falafel Sandwich, Fruit and Chips, Sub Bun');
});
test('U1-4 the regular menu words did not change on these meals', () => {
  assert.equal(meal('1', 'FRIDAY').dinner, 'Pork Adobo, Rice, Garlic Green Bean');
  assert.equal(meal('4', 'SUNDAY').lunch, 'Pork Souvlaki, Naan, Steamed Carrots, Tzatziki');
  assert.equal(meal('4', 'MONDAY').lunch, 'Chicken Ranch Salad Sandwich, Fruit and Chips');
  assert.equal(meal('4', 'SATURDAY').lunch, 'Lime-Spiced Chicken Legs, Garlic Bread, Steamed Broccoli');
});
