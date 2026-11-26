// tests/veg_chili_mushroom_gate.mjs — 2026-11-25 (publication 60). Wk2 FRI lunch's vegan dish, Vegetarian Chili, is the
// Beef Chili pot's vegan batch: the base set aside before the beef, with the house Vegan Meat Replacement. CODEX's Beef
// Chili record (conc-recipe-hub #418, edition 2026-11-25-beef-chili) lists Mushroom for that replacement's button mushrooms
// (Jason, 2026-11-25: "Add Beans + Mushroom"; every other CODEX dish made with it lists Mushroom too). DOOR's vegan box had
// its six other ticks from the recipe card (Oct 30) but not Mushroom (Jason, 2026-11-25: "Yes, tick Mushroom").
// Reads the published files; a later reviewed change to this meal re-pins this with a dated note.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const d = menu['2'].FRIDAY;
const on = (flags) => Object.keys(flags || {}).filter((k) => flags[k]).sort();

test('VC-1 the Vegetarian Chili box carries Mushroom with its six ticks, in the menu and the shared overlay', () => {
  assert.equal(d.lunch_slots.veganalt.manual, 'Vegetarian Chili');
  const want = ['hasBeans', 'hasCorn', 'hasGluten', 'hasMushroom', 'hasNightshades', 'hasSulphites', 'isSpicy'];
  assert.deepEqual(on(d.lunch_slots.veganalt.flags), want);
  assert.deepEqual(on(overlay['2'].FRIDAY.lunch_slots.veganalt.flags), want, 'the overlay other computers merge carries it too');
});
test('VC-2 the regular plate does not move: the meal ticks and the Beef Chili box have no Mushroom, and the words stay', () => {
  assert.equal(d.lunch_flags.hasMushroom, undefined, 'the beef batch has no mushroom');
  assert.equal(d.lunch_slots.main.flags.hasMushroom, undefined);
  assert.equal(d.lunch, 'Beef Chili, Cornbread, Sautéed Cabbage');
  assert.equal(d.lunch_veg, 'Vegetarian Chili, Vegan Cornbread, Sautéed Cabbage (no butter)');
});
test('VC-3 the meal keeps its Oct 30 original, so Put back the original still reaches the meal before Mat’s change', () => {
  const o = overlay['2'].FRIDAY.lunch_original;
  assert.ok(o && o.meal, 'no kept original');
  assert.doesNotMatch(String(o.meal[''] || ''), /Beef Chili/, 'the original is the meal before the Oct 30 change');
});
