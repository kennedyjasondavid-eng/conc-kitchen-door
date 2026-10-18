// tests/vegan_friendly_gate.mjs — CODEX C8 (K4): a vegan-friendly main is a vegan option (v31-standard.34).
// Jason, 2026-10-17, on the vegan line: "split the two meanings". CODEX now works out `veganFriendly` from each recipe's
// ingredients (true; false; null while a bought item waits on its label) and publishes it beside `stream` in
// DOOR_RECIPE_DATA.json and in each shared-Library record's `door` block. The line (`stream`) keeps meaning the line a
// recipe is made for, so EXPO's board can't move. DOOR reads the new field in one place: Edit Menu's Vegan Alt slot
// offers a main CODEX found no animal ingredient in, as well as the vegan line's own recipes.
// Authored to fail on 8c4c734 (v31-standard.33).
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
  + '\nglobalThis.match = recipeMatchesSlotDef; globalThis.DEFS = MEAL_SLOT_DEFS; globalThis.overlay = doorOverlaySharedRecipes; globalThis.one = doorSharedDoorRecord;', sb);
const J = v => JSON.parse(JSON.stringify(v));
const def = id => sb.DEFS.find(d => d.id === id);
const rec = (extra) => Object.assign({ recipeName: 'Red Red Bean Stew', allergens: ['Nightshades (Paprika)'], category: 'stew_main', stream: 'regular' }, extra || {});

test('the version stamp moves to v31-standard.34', () => {
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.34';/);
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

test('DOOR reads the flag in these three places only (the vegan plate\'s allergen guess still reads the vegan line)', () => {
  const code = html.split('\n').filter(l => /veganFriendly/.test(l) && !/^\s*\/\//.test(l));
  assert.equal(code.length, 3, code.join('\n'));
  assert.ok(/out\.veganFriendly = d\.veganFriendly/.test(code[0]));
  assert.ok(/const same = /.test(code[1]));
  assert.ok(/recipe\.veganFriendly === true/.test(code[2]));
});

// Against CODEX's checked-in feed (when conc-recipe-hub is beside this repo): the Vegan Alt slot gains exactly the one
// regular-line main with no animal ingredient. The other vegan-friendly mains are already on the vegan line (CODEX's
// projection moves vegan_protein there), and the 15 waiting on a label are never offered by the flag.
test('with the CODEX feed, Vegan Alt gains Red Red Bean Stew and nothing else', (t) => {
  const p = new URL('../../conc-recipe-hub/DOOR_RECIPE_DATA.json', import.meta.url);
  if (!fs.existsSync(p)) { t.skip('conc-recipe-hub not checked out beside this repo'); return; }
  const feed = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!feed.some(r => Object.prototype.hasOwnProperty.call(r, 'veganFriendly'))) { t.skip('CODEX feed predates C8'); return; }
  const before = feed.filter(r => sb.match(def('veganalt'), Object.assign({}, r, { veganFriendly: undefined }))).map(r => r.recipeName);
  const after = feed.filter(r => sb.match(def('veganalt'), r)).map(r => r.recipeName);
  assert.deepEqual(after.filter(n => !before.includes(n)), ['Red Red Bean Stew']);
  assert.deepEqual(before.filter(n => !after.includes(n)), [], 'nothing leaves the slot');
});
