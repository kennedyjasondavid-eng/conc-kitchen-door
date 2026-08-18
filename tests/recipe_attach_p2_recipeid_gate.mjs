// Recipe-attach phase-2 (store + publish the id).
// Binding a CODEX recipe additively stores its stable recipeId on the slot; the snapshot
// persists it and buildMenuJSON publishes it in _slots (for HUB's exact ?recipe= deep-link).
// Nothing in DOOR reads it yet. Authored-to-fail: pre-slice, no bind stores recipeId and the
// snapshot carries none. Byte-neutral: a recipe WITHOUT an id (the baked fallback) adds no key.
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

const FLAG_KEYS = ['hasNightshades', 'isSpicy', 'hasFish', 'hasSoy'];
function bindCtx() {
  const ctx = {
    console: { warn() {} }, window: {},
    document: { getElementById() { return null; } },
    MEAL_SLOT_STATE: {},
    MEAL_SLOT_DEFS: [{ id: 'main', cats: ['protein'], streams: ['regular'] }, { id: 'starch' }],
    MAIN_SLOT_IDS: ['main', 'starch', 'vegside', 'xtra', 'extras'],
    FLAG_DEFS: FLAG_KEYS.map(k => ({ key: k })),
    HUB_ALLERGEN_MAP: { Nightshades: 'hasNightshades', Soy: 'hasSoy' },
    DOOR_RECIPE_DATA: [
      { recipeName: 'Pork Al Pastor', recipeId: 'pork-al-pastor', category: 'protein', stream: 'regular', allergens: ['Nightshades'] },
      { recipeName: 'Legacy Dish', category: 'protein', stream: 'regular', allergens: ['Soy'] }, // no recipeId (baked-fallback shape)
    ],
    recipeMatchesSlotDef: undefined,
    renderSlots() {}, updateSlotSummary() {},
  };
  vm.createContext(ctx);
  vm.runInContext([
    fnBlock('isHubLoaded'), fnBlock('recipeMatchesSlotDef'),
    fnBlock('_hubAllergenResolve'), fnBlock('hubAllergenToFlags'),
    fnBlock('slotSelect'), fnBlock('slotAutoSave'),
    fnBlock('_buildSlotSnapshot'), fnBlock('_restoreSlotSnapshot'),
  ].join('\n\n'), ctx, { filename: 'index.html#p2-recipeid', timeout: 1000 });
  return ctx;
}

test('binding stores the recipe stable id (slotSelect + slotAutoSave)', () => {
  const c = bindCtx();
  c.slotSelect('main', 'Pork Al Pastor');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeId, 'pork-al-pastor', 'slotSelect stores the id');
  const c2 = bindCtx();
  c2.slotAutoSave('main', 'pork al pastor');   // exact-name blur bind (case-insensitive)
  assert.equal(c2.MEAL_SLOT_STATE.main.recipeId, 'pork-al-pastor', 'slotAutoSave stores the id');
});

test('a recipe with NO id (baked fallback) stores no recipeId key — byte-neutral', () => {
  const c = bindCtx();
  c.slotSelect('main', 'Legacy Dish');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, 'Legacy Dish');
  assert.equal('recipeId' in c.MEAL_SLOT_STATE.main, false, 'no id available → no key added');
});

test('snapshot persists recipeId for a bound slot; a phase-1 slot (no id) is byte-identical', () => {
  const c = bindCtx();
  c.MEAL_SLOT_STATE.main = { recipeName: 'Pork Al Pastor', recipeId: 'pork-al-pastor', flags: {} };
  c.MEAL_SLOT_STATE.starch = { recipeName: 'Rice', flags: {} };   // phase-1 bound, no id
  const snap = c._buildSlotSnapshot();
  assert.equal(snap.main.recipeId, 'pork-al-pastor', 'the id is persisted');
  assert.deepEqual(Object.keys(snap.starch), ['recipeName', 'flags'], 'a no-id slot serializes byte-identically to pre-phase-2');
  assert.equal('recipeId' in snap.starch, false);
});

test('restore carries recipeId back onto the slot', () => {
  const c = bindCtx();
  assert.equal(c._restoreSlotSnapshot({ main: { recipeName: 'Pork Al Pastor', recipeId: 'pork-al-pastor', flags: {} } }), true);
  assert.equal(c.MEAL_SLOT_STATE.main.recipeId, 'pork-al-pastor', 'round-trips');
});

test('buildMenuJSON publishes recipeId in _slots and the id is allergen-NEUTRAL', () => {
  const day = (withId) => ({ '1': { MONDAY: {
    lunch: 'Pork Al Pastor Taco',
    lunch_flags: { hasNightshades: true, hasSoy: true },
    lunch_slots: { main: Object.assign(
      { recipeName: 'Pork Al Pastor', displayText: 'Pork Al Pastor Taco', flags: { hasNightshades: true, hasSoy: true } },
      withId ? { recipeId: 'pork-al-pastor' } : {}) },
  } } });
  const build = (withId) => {
    const ctx = { Date, Object, getMenuData: () => day(withId), DOOR_SCHEMA_VERSIONS: { menu_current: 32 }, currentSite: { id: 'rexdale' } };
    vm.createContext(ctx);
    vm.runInContext([fnBlock('flagsToMenuAllergens'), fnBlock('buildMenuJSON')].join('\n\n'), ctx, { timeout: 1000 });
    return ctx.buildMenuJSON().menu['1'].MONDAY;
  };
  const withId = build(true), without = build(false);
  assert.equal(withId.lunch_slots.main.recipeId, 'pork-al-pastor', 'the id publishes in _slots');
  assert.equal(withId.lunch_slots.main.displayText, 'Pork Al Pastor Taco', 'the binding + display still publish');
  assert.equal('recipeId' in without.lunch_slots.main, false, 'a slot without an id publishes no key');
  // the id never perturbs the allergen feed EXPO/HUB consume
  assert.equal(withId.allergens_lunch, without.allergens_lunch, 'allergens_lunch is identical with or without the id');
  assert.deepEqual(Object.keys(withId.lunch_flags).sort(), Object.keys(without.lunch_flags).sort(), '_flags identical');
});

test('NO CRY WOLF / opt-in: not one committed slot carries a recipeId today', () => {
  const menu = JSON.parse(fs.readFileSync(path.join(root, 'menu_current.json'), 'utf8')).menu;
  let slots = 0, withId = 0;
  for (const w of Object.keys(menu)) for (const d of Object.keys(menu[w])) {
    const day = menu[w][d];
    for (const k of Object.keys(day)) {
      if (!k.endsWith('_slots') || !day[k] || typeof day[k] !== 'object') continue;
      for (const sid of Object.keys(day[k])) { slots++; if (day[k][sid] && 'recipeId' in day[k][sid]) withId++; }
    }
  }
  assert.ok(slots > 0, 'sanity: found slots');
  assert.equal(withId, 0, `${withId}/${slots} committed slots carry recipeId — the feature must be opt-in (menu byte-unchanged until a rebind)`);
});
