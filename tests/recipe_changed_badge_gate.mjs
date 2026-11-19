// tests/recipe_changed_badge_gate.mjs — U2 (2026-11-19, Jason: "Follow lean"): a linked slot whose recipe CODEX has
// changed since it was linked (or a tick someone took off) says so beside its badge ("CODEX lists Beans, not ticked here"), with an Add them
// button that adds those ticks and never takes one off. Spicy (the kitchen decides), meats, carb and halal-certified are
// never offered; a label not checked is read elsewhere. Authored red on main 04eb4ac (the helpers do not exist there).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const J = (v) => JSON.parse(JSON.stringify(v));

function box(recipes) {
  const c = { console, DOOR_RECIPE_DATA: recipes || [] };
  vm.createContext(c);
  vm.runInContext([
    between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */'),
    between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', between('const FLAG_DEFS = [', '\n];\n') + '\n];\n',
    fn('emptyMealFlags'), fn('_hubAllergenResolve'), fn('hubAllergenToFlags'), 'const _hubUnmappedLabels = new Set();',
    between('const DOOR_NON_CODEX_TICKS', '\n') + '\n', fn('doorLinkFlags'),
    between('const DOOR_RECIPE_CHANGE_SKIP', '\n') + '\n', fn('doorSlotRecipeChanged'), fn('doorFlagLabel'), fn('doorAddCodexTicks'),
    'function doorSlotRecipeToday(s) { return DOOR_RECIPE_DATA.find(r => r.recipeId === s.recipeId) || null; }',
    'this.SKIP = DOOR_RECIPE_CHANGE_SKIP;'
  ].join('\n'), c);
  return c;
}
const STEW = { recipeName: 'Bean Stew', recipeId: 'bean-stew', allergens: ['Beans (Chickpeas)', 'Mushroom (Button)', 'Spicy (Chili)', 'Soy (Tofu)'], category: 'stew_main', stream: 'vegan' };

test('a recipe CODEX changed names its new families; Spicy and the meal marks are never offered', () => {
  const c = box([STEW]);
  assert.deepEqual(J(c.doorSlotRecipeChanged({ recipeName: 'Bean Stew', recipeId: 'bean-stew', flags: { hasSoy: true } }, STEW)).sort(), ['hasBeans', 'hasMushroom']);
  assert.deepEqual(J(c.doorSlotRecipeChanged({ recipeName: 'Bean Stew', recipeId: 'bean-stew', flags: { hasSoy: true, hasBeans: true, hasMushroom: true } }, STEW)), [], 'current');
  assert.equal(c.doorFlagLabel('hasBeans'), 'Beans');
  assert.equal(c.doorFlagLabel('hasMushroom'), 'Mushroom');
  const meat = { recipeName: 'Beef Chili', recipeId: 'beef-chili', allergens: ['Spicy (Chili)'], category: 'protein', stream: 'regular' };
  assert.deepEqual(J(c.doorSlotRecipeChanged({ recipeName: 'Beef Chili', recipeId: 'beef-chili', flags: {} }, meat)), [], 'Spicy is the kitchen call');
  for (const k of ['isSpicy', 'isCarb', 'halalCertifiedMeat', 'hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'hasProcessedMeat']) assert.ok(c.SKIP.includes(k), k);
});

test('a label not checked is read elsewhere, never as a change', () => {
  const c = box();
  assert.deepEqual(J(c.doorSlotRecipeChanged({ recipeName: 'Bean Stew', recipeId: 'bean-stew', flags: {}, labelUnchecked: true }, STEW)), []);
  assert.deepEqual(J(c.doorSlotRecipeChanged({ recipeName: 'Oat milk', flags: {} }, { recipeName: 'Oat milk', allergens: null })), []);
  assert.deepEqual(J(c.doorSlotRecipeChanged(null, STEW)), []);
  assert.deepEqual(J(c.doorSlotRecipeChanged({ recipeName: 'Bean Stew', flags: {} }, null)), []);
});

test('Add them adds the new ticks and never takes one off', () => {
  const c = box([STEW]);
  const states = { veganalt: { recipeName: 'Bean Stew', recipeId: 'bean-stew', flags: { hasSoy: true, hasGluten: true } } };
  assert.deepEqual(J(c.doorAddCodexTicks(states, 'veganalt')).sort(), ['hasBeans', 'hasMushroom']);
  assert.deepEqual(J(states.veganalt.flags), { hasSoy: true, hasGluten: true, hasBeans: true, hasMushroom: true }, 'Gluten, which CODEX does not list, stays');
  assert.deepEqual(J(c.doorAddCodexTicks(states, 'veganalt')), [], 'nothing more to add');
  assert.equal(states.veganalt.flags.isSpicy, undefined, 'Spicy is not added');
});

test('the badge says so, with Add them, in both editors', () => {
  const card = between('const binding = (() => {', 'const labelTag');
  assert.match(card, /doorSlotRecipeChanged\(state, ids\[0\]\)/);
  assert.match(card, /return \{ok:true, label:'Linked to CODEX', changed: changed\.length \? changed : null\}/, 'the link stays linked');
  const note = between('const changedBtn', 'const borderColor');
  assert.match(note, /'CODEX lists ' \+ binding\.changed\.map\(doorFlagLabel\)\.join\(', '\) \+ ', not ticked here'/);
  assert.match(note, /fn \+ 'AddCodexTicks\('/);
  assert.match(html, /\$\{matchBadge\}\$\{changedBtn\}/);
  assert.match(fn('slotAddCodexTicks'), /doorAddCodexTicks\(MEAL_SLOT_STATE, slotId\)/);
  assert.match(fn('smSlotAddCodexTicks'), /doorAddCodexTicks\(SM_SLOT_STATE, slotId\)/);
});

// Butter Chickpeas' Milk sits in the shared Library, not the base feed read here, so after the C4 refresh nothing reads as
// changed against CODEX's base feed.
const EXPECTED = [];
test('today: after the C4 refresh no linked slot reads as changed against CODEX\'s base feed', () => {
  const feedUrl = new URL('../../conc-recipe-hub/DOOR_RECIPE_DATA.json', import.meta.url);
  if (!fs.existsSync(feedUrl)) return;   // CI has no CODEX copy beside DOOR
  const feed = JSON.parse(fs.readFileSync(feedUrl, 'utf8'));
  const list = Array.isArray(feed) ? feed : feed.recipes;
  const c = box(list);
  const menu = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8')).menu;
  const changed = new Set();
  for (const w of Object.keys(menu)) for (const d of Object.keys(menu[w])) for (const p of ['breakfast', 'lunch', 'dinner']) {
    const sl = menu[w][d] && menu[w][d][p + '_slots']; if (!sl) continue;
    const visit = (s) => {
      if (!s || !s.recipeId) return;
      const r = list.filter((x) => x.recipeId === s.recipeId);
      if (r.length !== 1) return;
      if (c.doorSlotRecipeChanged(s, r[0]).length) changed.add(r[0].recipeName);
    };
    for (const id of Object.keys(sl)) { const s = sl[id]; if (Array.isArray(s)) s.forEach(visit); else { visit(s); if (s && s.lines) Object.values(s.lines).forEach(visit); } }
  }
  console.log('# changed today: ' + [...changed].sort().join(', '));
  assert.deepEqual([...changed].sort(), EXPECTED);
});
