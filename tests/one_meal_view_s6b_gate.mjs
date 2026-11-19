// S6b of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): one meal view.
// D5, Jason 2026-11-19: "Follow lean". Node half; the browser half is tests/browser/one_meal_view_s6b.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const fn = (name) => {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' is defined');
  return html.slice(i, html.indexOf('\n}\n', i) + 2);
};

test('S6b-1 a meal cell opens the meal view; the old panel and Test Meal are retired, with their code', () => {
  assert.match(fn('handleMealCellClick'), /if \(!slotSwapMode\) \{\s*openMenuEdit\(week, day, period\);/);
  for (const gone of ['function openMealEdit(', 'function makePermanent(', 'function saveEditFlags(', 'function applyMealSwap(',
    'function revertMealSwap(', 'function openTestMeal(', 'function generateTestPlating(', 'id="mc-edit-panel"', 'id="mc-test-meal-panel"',
    'testMealActive', 'mcEditKey']) assert.ok(!html.includes(gone), gone + ' is gone');
});

test('S6b-2 what stays: the banner Make Permanent and Revert, the footer Put back, the Just on writer', () => {
  for (const kept of ['makeSwapPermanentFromBanner', 'revertSwapFromBanner', 'revertMenuEdit', 'doorSaveJustOn']) fn(kept);
});

test('S6b-3 a halal main changed since the meal opened replaces the stored halal line', () => {
  assert.match(fn('doorWriteEditorMeal'), /else if \(typeof doorHalalMainChangedSinceOpen === 'function' && doorHalalMainChangedSinceOpen\(\)\) target\[period \+ '_halal'\] = buildMainAltItem\(\) \|\| '';/);
  assert.match(fn('doorHalalMainChangedSinceOpen'), /if \(!o \|\| o\.key !== mcMenuEditKey \|\| !o\.dishes\) return false;/, 'unknown: the stored line is kept');
});
