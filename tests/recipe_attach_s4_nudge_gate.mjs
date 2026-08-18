// Recipe-attach S4 — the F-E "no allergen source" nudge.
// A meal-level (not per-slot) advisory: a named meal that would save with NO allergen data
// at all (no flag set AND no recipe-linked slot). Meal-level on purpose — a per-slot check
// cries wolf on every legacy manual slot. Authored-to-fail: _mealNoAllergenSource is absent
// pre-S4. The data invariant proves it never fires on the live committed menu.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fnBlock('_mealNoAllergenSource'), ctx, { timeout: 1000 });
const noSrc = (flags, linked, name) => ctx._mealNoAllergenSource(flags, linked, name);

test('fires only on a named meal with no flags AND no recipe link', () => {
  assert.equal(noSrc({}, false, 'Pork Chops'), true, 'text + no flag + no recipe → nudge');
  assert.equal(noSrc({ hasGluten: false, hasSoy: false }, false, 'Pork Chops'), true, 'all-false flags still nudge');
  assert.equal(noSrc({ hasSoy: true }, false, 'Tofu Stirfry'), false, 'a set flag is an allergen source');
  assert.equal(noSrc({}, true, 'Pork Al Pastor'), false, 'a recipe-linked slot is a source');
  assert.equal(noSrc({}, false, ''), false, 'no meal text → nothing to nudge');
  assert.equal(noSrc(null, false, 'Rice'), true, 'missing flags object treated as empty');
});

test('NO CRY WOLF: not one committed meal fires the nudge', () => {
  const menu = JSON.parse(fs.readFileSync(path.join(root, 'menu_current.json'), 'utf8')).menu;
  const PERIODS = ['breakfast', 'lunch', 'dinner'];
  let meals = 0, fired = 0;
  for (const w of Object.keys(menu)) for (const d of Object.keys(menu[w])) {
    const day = menu[w][d];
    for (const p of PERIODS) {
      if (!day[p]) continue;
      meals++;
      const flags = day[p + '_flags'] || {};
      const slots = day[p + '_slots'] || {};
      const linked = ['main', 'starch', 'vegside', 'xtra'].some(id => slots[id] && slots[id].recipeName);
      if (noSrc(flags, linked, day[p])) fired++;
    }
  }
  assert.ok(meals > 0, 'sanity: found meals');
  assert.equal(fired, 0, `the nudge fired on ${fired}/${meals} committed meals — it must be silent on healthy data`);
});

test('source lock: the nudge is wired into updateSlotSummary', () => {
  const summary = fnBlock('updateSlotSummary');
  assert.ok(summary.includes('_mealNoAllergenSource'), 'updateSlotSummary evaluates the nudge');
  assert.ok(summary.includes('No allergen source'), 'the nudge copy is rendered');
  assert.ok(summary.includes("anyRecipeLinked"), 'the nudge accounts for a recipe-linked slot');
});
