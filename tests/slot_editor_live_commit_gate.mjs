// Slot editor — a fast Save right after typing must not lose the dish.
//
// Free-typed text in a slot's SEARCH input (`slot-search-<id>`) only reached
// MEAL_SLOT_STATE on blur / Enter / dropdown-row click; saveMenuEdit reads STATE
// (buildMealName / _buildSlotSnapshot), never the live inputs. Clicking Save fast enough
// after typing therefore saved the previous text — a real publish went out with an empty
// diff that way. `_commitLiveSlotInputs()` now runs first and routes each changed input
// through the SAME commit function the blur uses, so matching/flags/manual-fallback are
// identical to a blur.
//
// Authored-to-fail against pre-slice origin/main (720bc33): `_commitLiveSlotInputs` and
// `_commitLiveSmSlotInputs` do not exist, and neither save function calls them.
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

const SLOT_DEFS = [
  { id: 'main' },
  { id: 'starch' },
  { id: 'extras', manual: true },
];

// Run the REAL _commitLiveSlotInputs + the REAL slotAutoSave it delegates to, over a
// scriptable DOM. `inputs` maps slot id -> the live value in its search box; a slot id
// left out of `inputs` has NO element (panel not rendered).
function ctx({ state = {}, inputs = {}, recipes = [] } = {}) {
  const c = {
    console: { warn() {}, error() {} },
    document: {
      getElementById(id) {
        const m = /^slot-search-(.+)$/.exec(id);
        if (m) return Object.prototype.hasOwnProperty.call(inputs, m[1]) ? { value: inputs[m[1]] } : null;
        return null;                       // slot-dd-* etc: absent is fine, callers null-check
      },
    },
    MEAL_SLOT_DEFS: SLOT_DEFS,
    MEAL_SLOT_STATE: state,
    DOOR_RECIPE_DATA: recipes,
    isHubLoaded: () => recipes.length > 0,
    recipeMatchesSlotDef: () => true,
    hubAllergenToFlags: (a) => ({ _from: a || null }),
    renderSlots() { c._renders = (c._renders || 0) + 1; },
    updateSlotSummary() {},
  };
  vm.createContext(c);
  vm.runInContext([fnBlock('slotAutoSave'), fnBlock('_commitLiveSlotInputs')].join('\n\n'),
    c, { filename: 'index.html#live-commit', timeout: 1000 });
  return c;
}

test('1. free-typed text still in the box is committed as manual on save', () => {
  const c = ctx({ state: { main: { manual: 'Old' }, starch: null }, inputs: { main: 'New Dish', starch: '' } });
  vm.runInContext('_commitLiveSlotInputs()', c);
  assert.equal(c.MEAL_SLOT_STATE.main.manual, 'New Dish');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, undefined);
});

test('2. an exact recipe name in the box binds the recipe (exact-match path preserved)', () => {
  const recipes = [{ recipeName: 'Jerk Tofu', recipeId: 'r-42', allergens: ['soy'] }];
  const c = ctx({ state: { main: null }, inputs: { main: 'jerk tofu' }, recipes });
  vm.runInContext('_commitLiveSlotInputs()', c);
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, 'Jerk Tofu');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeId, 'r-42');
  assert.equal(c.MEAL_SLOT_STATE.main.manual, undefined);
});

test('3. an unchanged bound slot is left byte-identical (no flag reset, no displayText loss)', () => {
  const bound = { recipeName: 'Jerk Tofu', recipeId: 'r-42', displayText: 'Island Tofu', flags: { soy: true } };
  const c = ctx({
    state: { main: bound },
    inputs: { main: 'Jerk Tofu' },                        // the box shows the recipe name
    recipes: [{ recipeName: 'Jerk Tofu', recipeId: 'r-42', allergens: ['soy'] }],
  });
  vm.runInContext('_commitLiveSlotInputs()', c);
  assert.equal(c.MEAL_SLOT_STATE.main, bound, 'same object — not rebuilt');
  assert.equal(c.MEAL_SLOT_STATE.main.displayText, 'Island Tofu');
  assert.deepEqual(c.MEAL_SLOT_STATE.main.flags, { soy: true });
  assert.equal(c._renders, undefined, 'nothing changed, so nothing re-rendered');
});

test('4. a missing input element is a no-op (panel not rendered)', () => {
  const s = { main: { manual: 'Old' } };
  const c = ctx({ state: s, inputs: {} });               // no elements at all
  assert.doesNotThrow(() => vm.runInContext('_commitLiveSlotInputs()', c));
  assert.equal(c.MEAL_SLOT_STATE.main.manual, 'Old');
});

test('4b. a manual-only slot is never routed through slotAutoSave', () => {
  // `extras` commits per keystroke via slotSetManual; if the helper claimed it, its state
  // would be rebuilt from a search box it does not own.
  const c = ctx({ state: { extras: { manual: 'Jerk Night' } }, inputs: { extras: 'stale' } });
  vm.runInContext('_commitLiveSlotInputs()', c);
  assert.equal(c.MEAL_SLOT_STATE.extras.manual, 'Jerk Night');
});

test('5. saveMenuEdit commits the live inputs BEFORE it reads state', () => {
  const body = fnBlock('saveMenuEdit');
  const commit = body.indexOf('_commitLiveSlotInputs(');
  const read = body.indexOf('buildMealName(');
  assert.ok(commit >= 0, 'saveMenuEdit does not commit the live inputs');
  assert.ok(read >= 0, 'saveMenuEdit no longer calls buildMealName — re-pin this gate');
  assert.ok(commit < read, 'the commit must run before buildMealName reads MEAL_SLOT_STATE');
  // and after the write guard, so a blocked save never mutates state
  const guard = body.indexOf('guardStandardMenuWrite(');
  assert.ok(guard >= 0 && guard < commit, 'the standard-menu write guard must still run first');
});

test('5b. the Special Meal editor gets the same mirror, before it reads state', () => {
  const body = fnBlock('saveSpecialMeal');
  const commit = body.indexOf('_commitLiveSmSlotInputs(');
  const read = body.indexOf('buildSmMealName(');
  assert.ok(commit >= 0, 'saveSpecialMeal does not commit the live inputs');
  assert.ok(read >= 0 && commit < read, 'the commit must run before buildSmMealName');
  const sm = fnBlock('_commitLiveSmSlotInputs');
  assert.match(sm, /sm-slot-search-/, 'the SM mirror must read the SM inputs');
  assert.match(sm, /smSlotAutoSave\(/, 'the SM mirror must delegate to smSlotAutoSave');
});

test('6. the helpers only read inputs and delegate — no overlay/publish/write path', () => {
  for (const name of ['_commitLiveSlotInputs', '_commitLiveSmSlotInputs']) {
    const body = fnBlock(name);
    assert.doesNotMatch(body, /overlay\[/, name + ' must not touch the overlay');
    assert.doesNotMatch(body, /publish|pushFile|saveMenuEdits|saveSpecialMeals|localStorage/i,
      name + ' must not write or publish');
    assert.doesNotMatch(body, /\.blur\(|\.focus\(|setTimeout/, name + ' must not use focus tricks or timers');
    assert.doesNotMatch(body, /MEAL_SLOT_STATE\[[^\]]+\]\s*=|SM_SLOT_STATE\[[^\]]+\]\s*=/,
      name + ' must commit through the shared AutoSave, never assign state itself');
  }
});

test('6b. the search input still commits on blur (the helper is a backstop, not a replacement)', () => {
  const card = fnBlock('renderSlotCard');
  assert.match(card, /onblur=.*AutoSave/, 'the blur commit must stay');
});
