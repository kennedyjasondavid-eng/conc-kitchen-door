// tests/vegan_friendly_gate.mjs — CODEX C8 (K4): a vegan-friendly main is a vegan option (v31-standard.35).
// Jason, 2026-10-17, on the vegan line: "split the two meanings". CODEX now works out `veganFriendly` from each recipe's
// ingredients (true; false; null while a bought item waits on its label) and publishes it beside `stream` in
// DOOR_RECIPE_DATA.json and in each shared-Library record's `door` block. The line (`stream`) keeps meaning the line a
// recipe is made for, so EXPO's board can't move. DOOR reads the new field in one place: Edit Menu's Vegan Alt slot
// offers a main CODEX found no animal ingredient in, as well as the vegan line's own recipes.
// Authored to fail on 8c4c734 (v31-standard.33).
// Independent review fold (2026-10-18): a list that names an animal family is never vegan-friendly — the overlay clears
// the flag when Option C keeps such a label (P1-3), and the Vegan Alt slot never offers such a recipe (P2). Those checks
// (the last four tests) fail on 65dd2ab, the first push of this PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
const fnSrc = (html.match(/function recipeMatchesSlotDef\(def, recipe\) \{[\s\S]*?\n\}/) || [''])[0];
const defsSrc = (html.match(/const MEAL_SLOT_DEFS = \[[\s\S]*?\n\];/) || [''])[0];
const core = between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */');
const sb = vm.createContext({});
vm.runInContext(fnSrc + '\n' + defsSrc + '\n' + core
  + '\nglobalThis.match = recipeMatchesSlotDef; globalThis.DEFS = MEAL_SLOT_DEFS; globalThis.overlay = doorOverlaySharedRecipes; globalThis.one = doorSharedDoorRecord;'
  + '\nglobalThis.animal = typeof doorNamesAnimalFamily === "function" ? doorNamesAnimalFamily : null;', sb);
const J = v => JSON.parse(JSON.stringify(v));
const def = id => sb.DEFS.find(d => d.id === id);
const rec = (extra) => Object.assign({ recipeName: 'Red Red Bean Stew', allergens: ['Nightshades (Paprika)'], category: 'stew_main', stream: 'regular' }, extra || {});

// Re-pinned 2026-10-18: PR #128 (the swap revert) merged first as v31-standard.34, so this build is .35.
test('the version stamp moves to v31-standard.35', () => {
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.35';/);
});

test('Vegan Alt offers a vegan-friendly main from the regular line, and only a vegan-friendly one', () => {
  assert.ok(fnSrc && defsSrc, 'recipeMatchesSlotDef and MEAL_SLOT_DEFS extract');
  assert.equal(sb.match(def('veganalt'), rec({ veganFriendly: true })), true, 'vegan-friendly regular stew: offered');
  assert.equal(sb.match(def('veganalt'), rec({ veganFriendly: false })), false, 'an animal ingredient: not offered');
  assert.equal(sb.match(def('veganalt'), rec({ veganFriendly: null })), false, 'waiting on a label: not offered');
  assert.equal(sb.match(def('veganalt'), rec()), false, 'no flag (an older feed, the offline list): as before');
  assert.equal(sb.match(def('veganalt'), rec({ stream: 'vegan' })), true, 'the vegan line: as before');
  assert.equal(sb.match(def('veganalt'), rec({ category: 'sauce', veganFriendly: true })), false, 'the slot still takes only mains');
});

test('no other slot changes: Main, Main Alt and No Pork Alt still read only the line', () => {
  for (const id of ['main', 'mainalt', 'noporkalt']) {
    assert.equal(sb.match(def(id), rec({ veganFriendly: true })), true, id + ': a regular recipe still fits');
    assert.equal(sb.match(def(id), rec({ stream: 'vegan', veganFriendly: true })), false, id + ': a vegan-line recipe still does not');
  }
  assert.equal(sb.match(def('starch'), rec({ category: 'starch_side', veganFriendly: false })), true, 'slots with no line are untouched');
});

test('a shared-Library save carries the flag from its door block; a record from before the flag carries none', () => {
  const base = [rec({ recipeId: 'red-red-bean-stew', veganFriendly: true })];
  const door = (extra) => ({ recipeName: 'Red Red Bean Stew', door: Object.assign({ recipeName: 'Red Red Bean Stew', allergens: ['Nightshades (Paprika)'], category: 'stew_main', stream: 'regular' }, extra || {}) });
  for (const v of [true, false, null]) assert.equal(J(sb.one(door({ veganFriendly: v }))).veganFriendly, v, 'door block ' + v + ' is carried');
  assert.equal(Object.prototype.hasOwnProperty.call(J(sb.one(door({ veganFriendly: 'yes' }))), 'veganFriendly'), false, 'anything but true/false/null is dropped');
  const same = J(sb.overlay(base, { recipes: [door({ veganFriendly: true })] }));
  assert.deepEqual(same.receipt.unchanged, ['Red Red Bean Stew'], 'same flag: unchanged');
  const changed = J(sb.overlay(base, { recipes: [door({ veganFriendly: false })] }));
  assert.deepEqual(changed.receipt.replaced, ['Red Red Bean Stew'], 'a different flag is a change');
  assert.equal(changed.list[0].veganFriendly, false);
  const old = J(sb.overlay(base, { recipes: [door()] }));
  assert.equal(Object.prototype.hasOwnProperty.call(old.list[0], 'veganFriendly'), false,
    'a shared version from before the flag replaces the record whole: the CODEX list\'s true does not survive under ingredients it was not worked out from');
  assert.deepEqual(old.receipt.replaced, ['Red Red Bean Stew']);
  assert.equal(sb.match(def('veganalt'), old.list[0]), false, 'so it falls back to its line');
});

test('DOOR reads the flag in these places only (the vegan plate\'s allergen guess still reads the vegan line)', () => {
  // Re-pinned 2026-10-18 (review fold, P1-3): the overlay also clears the flag when a kept allergen names an animal family.
  const code = html.split('\n').filter(l => /veganFriendly/.test(l) && !/^\s*\/\//.test(l));
  assert.equal(code.length, 5, code.join('\n'));
  assert.ok(/out\.veganFriendly = d\.veganFriendly/.test(code[0]));
  assert.ok(/d\.veganFriendly === true && doorNamesAnimalFamily\(d\.allergens\)/.test(code[1]));
  assert.ok(/d\.veganFriendly = false/.test(code[2]));
  assert.ok(/const same = /.test(code[3]));
  assert.ok(/recipe\.veganFriendly === true/.test(code[4]));
});

// Against CODEX's checked-in feed (when conc-recipe-hub is beside this repo): the Vegan Alt slot gains exactly the one
// regular-line main with no animal ingredient. The other vegan-friendly mains are already on the vegan line (CODEX's
// projection moves vegan_protein there), and the 15 waiting on a label are never offered by the flag.
test('with the CODEX feed, Vegan Alt gains Red Red Bean Stew and nothing else', (t) => {
  const p = new URL('../../conc-recipe-hub/DOOR_RECIPE_DATA.json', import.meta.url);
  if (!fs.existsSync(p)) { t.skip('conc-recipe-hub not checked out beside this repo'); return; }
  const feed = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!feed.some(r => Object.prototype.hasOwnProperty.call(r, 'veganFriendly'))) { t.skip('CODEX feed predates C8'); return; }
  // Before C8 the slot read only the line and the kind of dish.
  const before = feed.filter(r => def('veganalt').cats.includes(r.category) && def('veganalt').streams.includes(r.stream)).map(r => r.recipeName);
  const after = feed.filter(r => sb.match(def('veganalt'), r)).map(r => r.recipeName);
  assert.deepEqual(after.filter(n => !before.includes(n)), ['Red Red Bean Stew']);
  // Re-pinned 2026-10-18 (review fold, P2): the one vegan-line recipe whose list names an animal family leaves the
  // slot. No menu slot links it (checked on the published menu and overlay).
  assert.deepEqual(before.filter(n => !after.includes(n)), ['Jamcaican Patty Dough'], 'only the record that lists Milk leaves the slot');
});

test('an animal family on the list: one rule, compounds included', () => {
  assert.equal(typeof sb.animal, 'function', 'doorNamesAnimalFamily is in the shared-recipes core');
  for (const l of [['Milk (Butter)'], ['Dairy'], ['Eggs (Mayo)'], ['Egg and Mustard (Mayo)'], ['Fish (Basa)'], ['Shellfish'], ['Crustaceans (Shrimp)'], ['Molluscs (Oyster Sauce)'], ['Gluten', 'milk']]) {
    assert.equal(sb.animal(l), true, JSON.stringify(l));
  }
  for (const l of [[], ['None'], ['Gluten (Flour)', 'Soy (Tofu)'], ['Tree Nuts (Coconut)', 'Coconut'], ['Mustard (Dijon)'], ['Sesame']]) {
    assert.equal(sb.animal(l), false, JSON.stringify(l));
  }
});

test('Option C keeps a Milk label a shorter shared copy left out: the flag that copy carried does not stand', () => {
  const base = [rec({ recipeName: 'Garlic Bread', category: 'protein', allergens: ['Gluten (Bread)', 'Milk (Butter)'], recipeId: 'garlic-bread', veganFriendly: false })];
  const door = (extra) => ({ recipeName: 'Garlic Bread', door: Object.assign({ recipeName: 'Garlic Bread', allergens: ['Gluten (Bread)'], category: 'protein', stream: 'regular', veganFriendly: true }, extra || {}) });
  const unconfirmed = J(sb.overlay(base, { recipes: [door()] }));
  assert.deepEqual(unconfirmed.list[0].allergens, ['Gluten (Bread)', 'Milk (Butter)'], 'no stamp: Milk stays (Option C)');
  assert.equal(unconfirmed.list[0].veganFriendly, false, 'and the copy\'s vegan-friendly does not stand');
  assert.deepEqual(unconfirmed.receipt.notVeganFriendly, ['Garlic Bread']);
  assert.equal(sb.match(def('veganalt'), unconfirmed.list[0]), false, 'not offered in Vegan Alt');
  const confirmed = J(sb.overlay(base, { recipes: [door({ removedAllergens: ['Milk'] })] }));
  assert.deepEqual(confirmed.list[0].allergens, ['Gluten (Bread)'], 'a confirmed removal drops Milk');
  assert.equal(confirmed.list[0].veganFriendly, true, 'then the flag stands');
  assert.deepEqual(confirmed.receipt.notVeganFriendly, []);
  assert.equal(sb.match(def('veganalt'), confirmed.list[0]), true);
  const added = J(sb.overlay([], { recipes: [{ recipeName: 'New Dish', door: { recipeName: 'New Dish', allergens: ['Egg and Mustard (Mayo)'], category: 'protein', stream: 'regular', veganFriendly: true } }] }));
  assert.equal(added.list[0].veganFriendly, false, 'a new shared record listing Eggs is not vegan-friendly either');
});

test('the Vegan Alt slot never offers a recipe whose list names an animal family; the regular slots are untouched', () => {
  assert.equal(sb.match(def('veganalt'), rec({ stream: 'vegan', allergens: ['Milk', 'Gluten (Wheat)'] })), false, 'a vegan-line recipe that lists Milk');
  assert.equal(sb.match(def('veganalt'), rec({ veganFriendly: true, allergens: ['Fish (Anchovy)'] })), false, 'a vegan-friendly record that lists Fish');
  assert.equal(sb.match(def('veganalt'), rec({ stream: 'vegan', allergens: ['Soy (Tofu)'] })), true, 'a vegan-line recipe with plant allergens');
  assert.equal(sb.match(def('main'), rec({ allergens: ['Milk (Butter)'] })), true, 'Main still takes a regular recipe that lists Milk');
});
