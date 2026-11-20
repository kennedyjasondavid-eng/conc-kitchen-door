// tests/halal_dish_box_gate.mjs — 2026-11-20 (publication 47; Jason: "Follow lean"). Wk2 SUN dinner's halal plate had no
// dish box, so its section printed no CONTAINS line, and a No Turkey resident on it got no note. The halal plate now has
// its own box, "Halal Turkey Sausage" (Turkey, Corn, Gluten, Beans, Processed Meat), and the halal section's notes also
// read that box's ticks: the allergen line has no word for Turkey or Chicken, so the plate's line alone could not carry
// it. The meal's own ticks and every line's words do not move. Residents here are made up. Authored red on main 4da2c52.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const menu = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync(new URL('../menu_overlay.json', import.meta.url), 'utf8'));
const d = menu['2'].SUNDAY;
function fn(name) {
  const s = html.indexOf('function ' + name + '('); assert.ok(s >= 0, 'missing ' + name);
  return html.slice(s, html.indexOf('\n}\n', s)) + '\n}\n';
}

test('HD-1 the halal plate has its own dish box, Halal Turkey Sausage, with the label families', () => {
  const box = d.dinner_slots.mainalt;
  assert.ok(box, 'no halal dish box on Wk2 SUN dinner');
  assert.equal(box.manual, 'Halal Turkey Sausage');
  for (const k of ['hasTurkey', 'hasCorn', 'hasGluten', 'hasBeans', 'hasProcessedMeat']) assert.equal(box.flags[k], true, k);
  for (const k of ['hasPork', 'hasChicken', 'hasBeef']) assert.equal(box.flags[k], false, k + ' on a halal turkey dish');
  assert.deepEqual(overlay['2'].SUNDAY.dinner_slots.mainalt, box, 'the shared overlay carries the same box');
});
test('HD-2 nothing else moves: the meal ticks (no Turkey on a pork meal), the words and the kept original', () => {
  assert.equal(d.dinner_flags.hasTurkey, false, 'Turkey on the meal would open the halal triggers on the regular plate');
  assert.equal(d.dinner_flags.hasPork, true);
  assert.equal(d.dinner, 'Sausage and Vegetable Pasta');
  assert.equal(d.dinner_halal, 'Halal Turkey Sausage');
  const o = overlay['2'].SUNDAY.dinner_original;
  assert.ok(o && o.meal && !((o.meal._slots || {}).mainalt), 'the kept original is the meal before these changes');
});
test('HD-3 the halal section notes read the halal dish box; other sections and the meal do not', () => {
  const c = {
    CONFLICT_MAP: [{ mealFlag: 'hasTurkey', residentTag: 'No Turkey', note: 'no turkey' }],
    doorAllergenStrFlags: () => ({}), hasCarbAccommodation: () => false,
  };
  vm.createContext(c);
  vm.runInContext(fn('doorSectionLineNotes'), c);
  const r = { tags: ['Halal', 'No Turkey'] };
  const f = { hasPork: true };
  Object.defineProperty(f, '_halalDishFlags', { value: { hasTurkey: true }, enumerable: false });
  assert.equal(c.doorSectionLineNotes(r, { rule: { key: 'halal' } }, f, 'WHEAT, CORN'), 'no turkey');
  assert.equal(c.doorSectionLineNotes(r, { rule: { key: 'vegan' } }, f, 'WHEAT'), '', 'only the halal plate eats the halal box');
  assert.equal(c.doorSectionLineNotes(r, { rule: { key: 'halal' } }, { hasPork: true }, 'WHEAT'), '', 'no box, no note');
});
test('HD-4 the plate facts hand the box ticks to the notes without publishing them (not enumerable, pork never)', () => {
  const s = html.indexOf("Object.defineProperty(mealFlags, '_halalDishFlags'");
  assert.ok(s > 0, 'doorPlateFacts does not hand the halal box ticks on');
  assert.match(html.slice(s, s + 200), /hasPork: false[\s\S]*enumerable: false/);
});
