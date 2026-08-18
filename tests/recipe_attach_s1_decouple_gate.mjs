// Recipe-attach S1 — display decouple gate.
// A menu slot may carry a `displayText` that differs from its bound `recipeName`, so the
// menu shows "Pork Al Pastor Taco" while the allergen flags come from the bound recipe
// "Pork Al Pastor". This extracts the REAL slot builders + snapshot/restore from index.html
// and runs them in a vm. Authored-to-fail: the "shows displayText" assertions FAIL against
// pre-S1 code (which resolved only `recipeName || manual`). The byte-neutrality assertions
// guard that every legacy/unbound/manual slot serializes + renders exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function fn(name) {
  // minimal function-block extractor: `function NAME(...) { ... }` balanced to the first
  // top-level close brace. The builders here are all single-scope, so brace-count works.
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

const FLAG_KEYS = ['hasNightshades', 'isSpicy', 'hasFish', 'hasDairy'];
function freshCtx() {
  const ctx = {
    MEAL_SLOT_STATE: {},
    MEAL_SLOT_DEFS: ['main', 'mainalt', 'noporkalt', 'veganalt', 'starch', 'vegside', 'xtra', 'extras'].map(id => ({ id })),
    MAIN_SLOT_IDS: ['main', 'starch', 'vegside', 'xtra', 'extras'],
    FLAG_DEFS: FLAG_KEYS.map(key => ({ key })),
  };
  vm.createContext(ctx);
  vm.runInContext([
    fn('_slotText'), fn('buildMealName'), fn('buildMainItem'), fn('buildMainAltItem'),
    fn('buildSides'), fn('buildVegAlt'), fn('buildNoPorkAlt'), fn('buildUnionFlags'),
    fn('_buildSlotSnapshot'), fn('_restoreSlotSnapshot'),
  ].join('\n\n'), ctx, { filename: 'index.html#s1-decouple', timeout: 1000 });
  return ctx;
}
const onFlags = (f) => Object.entries(f).filter(([, v]) => v).map(([k]) => k).sort();

test('a decoupled slot SHOWS displayText yet derives allergens from the recipe (authored-to-fail)', () => {
  const c = freshCtx();
  c.MEAL_SLOT_STATE.main = { recipeName: 'Pork Al Pastor', displayText: 'Pork Al Pastor Taco', flags: { hasNightshades: true, isSpicy: true } };
  c.MEAL_SLOT_STATE.starch = { recipeName: 'Cilantro Rice', flags: {} };
  assert.equal(c.buildMealName(), 'Pork Al Pastor Taco, Cilantro Rice', 'the menu shows the display text, not the recipe name');
  assert.equal(c.buildMainItem(), 'Pork Al Pastor Taco', 'the main-item header shows the display text');
  // allergens come from the bound recipe's flags, NOT from the display text
  assert.deepEqual(onFlags(c.buildUnionFlags()), ['hasNightshades', 'isSpicy'], 'flags derive from the bound recipe, untouched by displayText');
});

test('legacy welded + manual slots resolve byte-identically (no displayText path)', () => {
  const c = freshCtx();
  c.MEAL_SLOT_STATE.main = { recipeName: 'Beef Stew', flags: {} };       // welded, no displayText
  c.MEAL_SLOT_STATE.starch = { manual: 'House Rice', flags: {} };         // manual
  assert.equal(c.buildMainItem(), 'Beef Stew', 'a welded slot shows its recipe name');
  assert.equal(c.buildMealName(), 'Beef Stew, House Rice', 'welded + manual join exactly as before');
  assert.equal(c.buildSides(), 'House Rice');
  // a bound slot whose displayText EQUALS the recipe name is not a decouple → no snapshot key
  c.MEAL_SLOT_STATE.main.displayText = 'Beef Stew';
  const snap = c._buildSlotSnapshot();
  // (compare keys/values, not the whole object — snap.main is created in the vm realm, so a
  // strict deepEqual would fail on the cross-realm prototype, not on content.)
  assert.deepEqual(Object.keys(snap.main).sort(), ['flags', 'recipeName'], 'displayText === recipeName adds no snapshot key');
  assert.equal(snap.main.recipeName, 'Beef Stew');
  assert.equal('displayText' in snap.starch, false, 'a manual slot never carries displayText');
});

test('snapshot carries displayText ONLY for a decoupled main-group slot', () => {
  const c = freshCtx();
  c.MEAL_SLOT_STATE.main = { recipeName: 'Pork Al Pastor', displayText: 'Pork Al Pastor Taco', flags: { hasNightshades: true } };
  // an ALT slot with a stray displayText must NOT persist it (bind is main-group-only)
  c.MEAL_SLOT_STATE.veganalt = { recipeName: 'Tofu Al Pastor', displayText: 'Tofu Taco', flags: {} };
  const snap = c._buildSlotSnapshot();
  assert.equal(snap.main.displayText, 'Pork Al Pastor Taco', 'decoupled main-group slot persists displayText');
  assert.deepEqual(snap.main.flags, { hasNightshades: true }, 'flags still carried');
  assert.equal('displayText' in snap.veganalt, false, 'an alt slot never persists displayText');
});

test('save → snapshot → restore round-trip preserves displayText', () => {
  const c = freshCtx();
  c.MEAL_SLOT_STATE.main = { recipeName: 'Pork Al Pastor', displayText: 'Pork Al Pastor Taco', flags: { hasNightshades: true } };
  const snap = c._buildSlotSnapshot();
  c.MEAL_SLOT_STATE = {};                       // simulate re-open into a clean editor
  vm.createContext(c);                          // rebind globals to the reset state object
  vm.runInContext([fn('_slotText'), fn('buildMainItem'), fn('_restoreSlotSnapshot')].join('\n\n'), c, { timeout: 1000 });
  assert.equal(c._restoreSlotSnapshot(snap), true);
  assert.equal(c.MEAL_SLOT_STATE.main.displayText, 'Pork Al Pastor Taco', 'displayText survives the round-trip');
  assert.equal(c.buildMainItem(), 'Pork Al Pastor Taco', 'and still resolves after restore');
});

test('displayText never leaks into allergen flags or the veg-alt string', () => {
  const c = freshCtx();
  // veg main is its own recipe; the SHARED sides carry a display override
  c.MEAL_SLOT_STATE.veganalt = { recipeName: 'Tofu Al Pastor', flags: { hasSoy: true } };
  c.MEAL_SLOT_STATE.xtra = { recipeName: 'Pico de Gallo', displayText: 'Fresh Salsa', flags: { hasNightshades: true } };
  assert.equal(c.buildVegAlt(), 'Tofu Al Pastor, Fresh Salsa', 'the vegan plate shows the shared side\'s display text too');
  // union flags read s.flags only — displayText is inert to allergens
  assert.deepEqual(onFlags(c.buildUnionFlags()), ['hasNightshades'], 'xtra flags union in; displayText irrelevant');
});
