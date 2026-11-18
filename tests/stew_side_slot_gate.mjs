// stew_side_slot_gate (2026-11-18, call C7). Jason: a new CODEX category for a vegetable-based side that is made on a
// stew cycle (Okra and Cassava Stew, Atakilt Wat, Shakshuka). DOOR offers a Stew / Side recipe (stew_side) in the
// Veg Side slot; the main slots do not take it, and a stew_main recipe still does not reach Veg Side.
// Authored red on main 92eee8c.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) { i++; break; } }
  return html.slice(start, i);
}
const defsStart = html.indexOf('const MEAL_SLOT_DEFS');
const defsEnd = html.indexOf('];', defsStart) + 2;
const c = { doorNamesAnimalFamily: () => false };
vm.createContext(c);
vm.runInContext(html.slice(defsStart, defsEnd).replace('const MEAL_SLOT_DEFS', 'globalThis.MEAL_SLOT_DEFS') + '\n' + fnBlock('recipeMatchesSlotDef'), c);
const def = id => c.MEAL_SLOT_DEFS.find(d => d.id === id);
const okra = { recipeName: 'Okra and Cassava Stew', category: 'stew_side', stream: 'vegan', allergens: [] };
const stewMain = { recipeName: 'Vegan Stew', category: 'stew_main', stream: 'vegan', allergens: [] };

test('Veg Side offers a Stew / Side recipe', () => {
  assert.equal(c.recipeMatchesSlotDef(def('vegside'), okra), true);
  assert.equal(c.recipeMatchesSlotDef(def('vegside'), { ...okra, stream: 'regular' }), true);
});
test('the main slots do not take a Stew / Side recipe, and Veg Side still refuses a Stew / Main', () => {
  for (const id of ['main', 'mainalt', 'veganalt']) assert.equal(c.recipeMatchesSlotDef(def(id), okra), false, id);
  assert.equal(c.recipeMatchesSlotDef(def('vegside'), stewMain), false);
});
