// Recipe-attach S2 — editor bind + "Shown on menu as" control.
// Extracts the REAL slot functions from index.html and runs them in a vm. Authored-to-fail:
// the whole S2 surface (slotSetDisplayText, _slotDisplayRoutingWarn, the renderSlotCard
// "Shown as" block, the rebind displayText preservation) is ABSENT pre-S2, so every
// extraction/assertion fails against the pre-slice source.
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
function assertContains(hay, needle, msg) { assert.ok(hay.includes(needle), msg + ' — missing: ' + needle); }

const FLAG_KEYS = ['hasNightshades', 'isSpicy', 'hasFish', 'hasSoy', 'hasDairy'];
function freshCtx() {
  const ctx = {
    console: { warn() {} },
    window: {},
    document: { getElementById() { return null; } },
    MEAL_SLOT_STATE: {},
    MEAL_SLOT_DEFS: [
      { id: 'main', cats: ['protein'], streams: ['regular'] },
      { id: 'veganalt', cats: ['protein'], streams: ['vegan'] },
    ],
    MAIN_SLOT_IDS: ['main', 'starch', 'vegside', 'xtra', 'extras'],
    FLAG_DEFS: FLAG_KEYS.map(key => ({ key })),
    HUB_ALLERGEN_MAP: { Nightshades: 'hasNightshades', Tomato: 'hasNightshades', Soy: 'hasSoy', Fish: 'hasFish' },
    DOOR_RECIPE_DATA: [
      { recipeName: 'Pork Al Pastor', category: 'protein', stream: 'regular', allergens: ['Nightshades', 'Spicy'] },
      { recipeName: 'Blackened Fish', category: 'protein', stream: 'regular', allergens: ['Fish'] },
    ],
    escapeHtml: (s) => String(s),
    renderSlots() {}, updateSlotSummary() {},
  };
  vm.createContext(ctx);
  vm.runInContext([
    fnBlock('isHubLoaded'), fnBlock('recipeMatchesSlotDef'),
    fnBlock('_hubAllergenResolve'), fnBlock('hubAllergenToFlags'),
    fnBlock('_slotText'), fnBlock('buildMealName'), fnBlock('buildMainItem'),
    fnBlock('_slotDisplayRoutingWarn'), fnBlock('_slotRouteWarnHTML'), fnBlock('_refreshSlotRoutingWarn'),
    fnBlock('slotSetDisplayText'), fnBlock('slotSelect'), fnBlock('slotClear'),
  ].join('\n\n'), ctx, { filename: 'index.html#s2-bind-ui', timeout: 1000 });
  return ctx;
}
const onFlags = (f) => Object.entries(f).filter(([, v]) => v).map(([k]) => k).sort();

test('the soft routing warn fires only when a recipe word is dropped, never blocks', () => {
  const c = freshCtx();
  // spread the vm-realm array into a test-realm one before deepEqual (cross-realm prototype).
  const warn = (r, d) => [...c._slotDisplayRoutingWarn(r, d)];
  assert.deepEqual(warn('Pork Al Pastor', 'Pork Al Pastor Taco'), [], 'a superset rename (the motivating case) does not warn');
  assert.deepEqual(warn('Pork Al Pastor', 'Al Pastor Street Tacos'), ['pork'], 'dropping the protein word warns');
  assert.deepEqual(warn('Beef Meatloaf', 'Meatloaf'), ['beef'], 'dropping a significant word warns');
  assert.deepEqual(warn('Pork Al Pastor', 'pork al pastor taco'), [], 'case-insensitive; still no warn');
  assert.deepEqual(warn('Pork Al Pastor', 'Pork Al Pastor'), [], 'identical = not decoupled = no warn');
  assert.deepEqual(warn('Pork Al Pastor', ''), [], 'empty display = no warn');
  // punctuation is stripped to spaces (never treated as / kept in a word) before matching
  assert.deepEqual(warn('Mac & Cheese', 'Macaroni Cheese'), ['mac'], '"&" is stripped; word-matching drops "mac"');
  assert.deepEqual(warn('Sauté Tofu', 'Grilled Tofu'), ['saut'], 'accent strips to the ascii token "saut"; a real word-drop still warns');
  assert.deepEqual(warn('Sauté Tofu', 'Saut Tofu'), [], 'accented recipe matches its de-accented display — no false warn');
});

test('bind a recipe + rename the display → shows the rename, allergens stay from the recipe', () => {
  const c = freshCtx();
  c.slotSelect('main', 'Pork Al Pastor');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, 'Pork Al Pastor');
  assert.deepEqual(onFlags(c.MEAL_SLOT_STATE.main.flags), ['hasNightshades'], 'flags from the bound recipe (Spicy is not in this test map; Nightshades is)');
  c.slotSetDisplayText('main', 'Pork Al Pastor Taco');
  assert.equal(c.MEAL_SLOT_STATE.main.displayText, 'Pork Al Pastor Taco');
  assert.equal(c.buildMealName(), 'Pork Al Pastor Taco', 'the menu shows the display text');
  assert.deepEqual(onFlags(c.MEAL_SLOT_STATE.main.flags), ['hasNightshades'], 'renaming the display NEVER changes the flags');
});

test('slotSetDisplayText: clears on empty / equal-to-recipe, and is a no-op off a bound main-group slot', () => {
  const c = freshCtx();
  c.slotSelect('main', 'Pork Al Pastor');
  c.slotSetDisplayText('main', 'Taco'); assert.equal(c.MEAL_SLOT_STATE.main.displayText, 'Taco');
  c.slotSetDisplayText('main', 'Pork Al Pastor'); assert.equal('displayText' in c.MEAL_SLOT_STATE.main, false, 'display === recipe clears the override');
  c.slotSetDisplayText('main', 'Taco'); c.slotSetDisplayText('main', '   '); assert.equal('displayText' in c.MEAL_SLOT_STATE.main, false, 'blank clears');
  // no-op on an alt slot (bound) and on a manual slot
  c.MEAL_SLOT_STATE.veganalt = { recipeName: 'Tofu Al Pastor', flags: {} };
  c.slotSetDisplayText('veganalt', 'Tofu Taco'); assert.equal('displayText' in c.MEAL_SLOT_STATE.veganalt, false, 'alt slot rejects a display override');
  c.MEAL_SLOT_STATE.main = { manual: 'House Dish', flags: {} };
  c.slotSetDisplayText('main', 'Anything'); assert.equal('displayText' in c.MEAL_SLOT_STATE.main, false, 'a manual (unbound) slot rejects a display override');
});

test('display override survives a same-recipe re-confirm, drops on a genuine recipe change', () => {
  const c = freshCtx();
  c.slotSelect('main', 'Pork Al Pastor');
  c.slotSetDisplayText('main', 'Pork Al Pastor Taco');
  c.slotSelect('main', 'Pork Al Pastor');   // re-confirm same recipe
  assert.equal(c.MEAL_SLOT_STATE.main.displayText, 'Pork Al Pastor Taco', 'same-recipe re-confirm keeps the display override');
  c.slotSelect('main', 'Blackened Fish');   // genuine recipe change
  assert.equal('displayText' in c.MEAL_SLOT_STATE.main, false, 'a real recipe change drops the stale rename');
  assert.deepEqual(onFlags(c.MEAL_SLOT_STATE.main.flags), ['hasFish'], 'flags follow the new recipe');
});

test('the "Shown as" control is gated to the regular editor + bound main-group slots (source)', () => {
  const card = fnBlock('renderSlotCard');
  assertContains(card, "ns === 'slot'", 'showAsHtml is regular-editor-only (absent on sm-slot cards)');
  assertContains(card, 'MAIN_SLOT_IDS.includes(def.id)', 'showAsHtml is main-group-only (absent on alt slots)');
  assertContains(card, 'slotSetDisplayText(', 'the shown-as input wires to slotSetDisplayText');
  assertContains(card, '${showAsHtml}', 'the block is actually rendered into the card');
  // the two bind paths preserve the override on re-confirm
  assertContains(fnBlock('slotAutoSave'), 'sameRecipe && current.displayText', 'slotAutoSave preserves displayText on same-recipe re-confirm');
  assertContains(fnBlock('slotSelect'), 'sameRecipe && current.displayText', 'slotSelect preserves displayText on same-recipe re-confirm');
});

test('the new display sinks are escaped, and carb-detect keys off the recipe (source locks)', () => {
  const card = fnBlock('renderSlotCard');
  // the sole new stored-input HTML sink: the "Shown as" input value MUST go through _escAttr
  assertContains(card, '_escAttr(state.displayText', 'the display-text input value is _escAttr-escaped (XSS surface locked)');
  assertContains(fnBlock('_slotRouteWarnHTML'), 'escapeHtml(w)', 'the routing-warn words are escapeHtml-escaped');
  // P3-1 fold: carb auto-detect must probe the recipe identity, not just the renamed display
  const summary = fnBlock('updateSlotSummary');
  assertContains(summary, 'carbProbe', 'carb detect uses the recipe-inclusive probe, not the display name alone');
  assertContains(summary, 's.recipeName', 'the carb probe reads recipe names so a rename cannot suppress isCarb');
});
