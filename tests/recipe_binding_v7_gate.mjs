// V7 (2026-10-07, Jason: "follow your leans, go ahead with 2, 3, 4 and 5"): DOOR makes binding a dish to its
// recipe the normal path, and asks about a run-on line at save time instead of leaving EXPO to guess.
//
//   - the slot dropdown lists the best match first (same name → starts with → a word starts with → contains);
//   - a dish typed by hand that is a recipe's name in all but case, punctuation, "&"/"and" or a plural is
//     offered "Link to …" on its card (picking it stays the operator's click);
//   - Save asks when a slot reads like several dishes ("A & B", "A, B", "A; B", "A + B").
//
// Authored-to-fail against pre-slice origin/main: none of doorRecipeMatchRank / doorRankedRecipeMatches /
// doorRecipeSuggestionFor / doorRunOnSlots exist, slotSearch lists recipes in file order, saveMenuEdit has
// no run-on question.
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
function constLine(name) {
  const m = new RegExp('const ' + name + ' = [^\\n]*').exec(html);
  assert.ok(m, 'could not find const ' + name);
  return m[0];
}

const RECIPES = [
  { recipeName: 'Herbed Couscous', allergens: [] },
  { recipeName: 'Couscous Salad', allergens: [] },
  { recipeName: 'Couscous', allergens: ['GLUTEN'] },
  { recipeName: 'Roasted Parsnip and Carrot', allergens: [] },
  { recipeName: 'Halal Chicken Mac & Cheese', allergens: ['MILK'] },
  { recipeName: 'Green Beans', allergens: [] },
];
function ctx() {
  const c = { DOOR_RECIPE_DATA: RECIPES, isHubLoaded: () => true, recipeMatchesSlotDef: () => true, escapeHtml: s => String(s),
    _escAttr: s => String(s), _jsArgLiteral: s => JSON.stringify(s) };
  vm.createContext(c);
  for (const f of ['doorNormDishName', 'doorRecipeMatchRank', 'doorRankedRecipeMatches', 'doorRecipeSuggestionFor', 'doorRunOnSlots', '_slotLinkSuggestionHTML'])
    vm.runInContext(fnBlock(f), c);
  vm.runInContext(constLine('DOOR_RUNON_RE'), c);
  vm.runInContext('this.DOOR_RUNON_RE = DOOR_RUNON_RE;', c);
  return c;
}

test('V7a the dropdown lists the best match first', () => {
  const c = ctx();
  const names = c.doorRankedRecipeMatches({ id: 'starch' }, 'couscous', 6).map(r => r.recipeName);
  assert.deepEqual(names, ['Couscous', 'Couscous Salad', 'Herbed Couscous']);
});

test('V7b a word-start match outranks a mid-word match, and a non-match is left out', () => {
  const c = ctx();
  assert.equal(c.doorRecipeMatchRank('Roasted Parsnip and Carrot', 'carrot'), 2);
  assert.equal(c.doorRecipeMatchRank('Green Beans', 'reen'), 3);
  assert.equal(c.doorRecipeMatchRank('Green Beans', 'zucchini'), -1);
});

test('V7c a hand-typed dish that is a recipe in all but spelling details is offered the link', () => {
  const c = ctx();
  const def = { id: 'vegside', label: 'Veg Side' };
  assert.equal(c.doorRecipeSuggestionFor(def, 'roasted parsnip & carrots').recipeName, 'Roasted Parsnip and Carrot');
  assert.equal(c.doorRecipeSuggestionFor(def, 'Green bean').recipeName, 'Green Beans');
  assert.equal(c.doorRecipeSuggestionFor(def, 'Steamed Zucchini'), null);
  const html1 = c._slotLinkSuggestionHTML(def, { manual: 'green bean', flags: {} }, 'slot');
  assert.match(html1, /Link to “Green Beans”/);
  assert.match(html1, /slotSelect\("vegside","Green Beans"\)/);
  assert.equal(c._slotLinkSuggestionHTML(def, { recipeName: 'Green Beans', flags: {} }, 'slot'), '', 'a linked slot offers nothing');
  assert.equal(c._slotLinkSuggestionHTML({ id: 'extras', manual: true }, { manual: 'Green Beans' }, 'slot'), '', 'never on the Event Name slot');
});

test('V7d Save asks about a slot that reads like several dishes, and only that', () => {
  const c = ctx();
  const defs = [{ id: 'main', label: 'Main' }, { id: 'starch', label: 'Starch Side' }, { id: 'vegside', label: 'Veg Side' }, { id: 'extras', label: 'Event Name', manual: true }];
  const runOn = c.doorRunOnSlots({
    main: { manual: 'Beef Nachos Supreme & Tortilla chips & Sour Cream' },
    starch: { recipeName: 'Halal Chicken Mac & Cheese' },            // the recipe is named that way: fine
    vegside: { manual: 'Peas and Carrots' },                           // one dish with "and": fine
    extras: { manual: 'Jerk Night, with music' },                      // free-text event name: fine
  }, defs);
  assert.deepEqual(JSON.parse(JSON.stringify(runOn)), [{ id: 'main', label: 'Main', text: 'Beef Nachos Supreme & Tortilla chips & Sour Cream' }]);
  assert.equal(c.doorRunOnSlots({ main: { recipeName: 'Beef Nacho Mix', displayText: 'Beef Nachos, Tortillas' } }, defs).length, 1, 'a display text that lists dishes is asked about');
});

test('V7e both editors use the ranked list, and Save asks before it writes anything', () => {
  assert.match(fnBlock('slotSearch'), /doorRankedRecipeMatches\(def, q, 6\)/);
  assert.match(fnBlock('smSlotSearch'), /doorRankedRecipeMatches\(def, q, 6\)/);
  const save = fnBlock('saveMenuEdit');
  const ask = save.indexOf('doorRunOnSlots(MEAL_SLOT_STATE, MEAL_SLOT_DEFS)');
  assert.ok(ask > 0 && ask < save.indexOf('buildAltMeals()'), 'the run-on question comes before the alternatives question and any write');
  assert.match(save, /if \(!ok\) return;\s*\}\s*\/\/ Require an explicit decision/);
  assert.match(fnBlock('renderSlotCard'), /_slotLinkSuggestionHTML\(def, state, fn\)/);
});
