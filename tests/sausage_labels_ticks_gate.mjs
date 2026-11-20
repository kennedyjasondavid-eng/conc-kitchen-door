// tests/sausage_labels_ticks_gate.mjs — 2026-11-20 (publication 46). Jason read the two meat sausage labels in Wk2 SUN
// dinner's pasta (CODEX #396): the pork sausage (corn syrup solids; lemon juice solids) and the halal turkey sausage
// (modified corn starch, corn syrup solids). The meal gains Corn and Sulphites, add only. Review fold: Beans too, from the
// bean puree in the greens base all three versions share (CODEX lists Beans on the pot; C4, saved ticks follow CODEX). Reads the published files; a
// later reviewed change to this meal re-pins this with a dated note.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const d = menu['2'].SUNDAY;

test('SL-1 Wk2 SUN dinner carries Corn, Sulphites and Beans, on the meal and on its main dish', () => {
  assert.equal(d.dinner_flags.hasCorn, true);
  assert.equal(d.dinner_flags.hasBeans, true, 'the shared bean base (a No Beans resident on the halal plate eats it)');
  assert.equal(d.dinner_slots.main.flags.hasBeans, true);
  assert.equal(d.dinner_flags.hasSulphites, true);
  assert.equal(d.dinner_slots.main.flags.hasCorn, true, 'the main dish carries the meal ticks (a fresh tablet sweep keeps them)');
  assert.equal(d.dinner_slots.main.flags.hasSulphites, true);
  assert.equal(overlay['2'].SUNDAY.dinner_flags.hasCorn, true, 'the shared overlay carries them too');
});
test('SL-2 add only: every tick the meal had stays, and the words do not move', () => {
  for (const k of ['hasGluten', 'hasPork', 'hasProcessedMeat', 'isCarb']) assert.equal(d.dinner_flags[k], true, k);
  assert.equal(d.dinner, 'Sausage and Vegetable Pasta');
  assert.match(d.dinner_veg, /^Vegan Sausage and Vegetable Pasta/);
});
test('SL-3 the meal keeps its original, so Put back the original can undo this', () => {
  const o = overlay['2'].SUNDAY.dinner_original;
  assert.ok(o && o.meal, 'no kept original');
  assert.ok(!(o.meal._flags || {}).hasCorn, 'the original is the meal before this change');
});
