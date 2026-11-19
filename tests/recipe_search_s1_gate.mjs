// S1 of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md; Jason 2026-11-19: "follow lean, start
// the build plan"; D7 "follow lean"): a search that finds the recipe, and never offers one a plate refuses.
//
//   - any words in any order: "pork adobo" finds "Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)";
//   - a regular box lists recipes that fit first, then "Other recipes" (only the category check relaxes);
//   - the vegan box never offers a recipe whose list names Milk, Eggs, Fish or shellfish, nor one off the vegan line;
//     the halal and no-pork boxes never offer a recipe whose name says pork. A refused recipe may show greyed with its
//     reason, never pickable, and slotSelect refuses it;
//   - recipeMatchesSlotDef is unchanged (Rex import and the Special Meal editor read it);
//   - clicking away from a recipe name links nothing: the words are held and Save asks (W3e hold, kind exact);
//   - the vegan and halal "gets instead" boxes link no recipe the line refuses.
//
// Authored-to-fail against main d7a3e65: none of doorSlotSearchGroups / doorSlotRefusal / doorLineRefusal exist, the
// any-order rank returns -1, a blur on a recipe name links it, slotSearch has no Other recipes heading.
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
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' = ');
  assert.ok(start >= 0, 'could not find const ' + name);
  const end = html.indexOf(';\n', start);
  return html.slice(start, end + 1);
}

const RECIPES = [
  { recipeName: 'Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)', category: 'sauce', stream: 'regular', allergens: ['Soy (Soy Sauce)'] },
  { recipeName: 'Pork Griot', category: 'protein', stream: 'regular', allergens: ['Spicy (Scotch Bonnet)'] },
  { recipeName: 'Chicken Griot', category: 'protein', stream: 'regular', allergens: [] },
  { recipeName: 'Halal Glazed Chicken (for Glazed Ham)', category: 'protein', stream: 'regular', allergens: [] },
  { recipeName: 'Vegan Sausage', category: 'protein', stream: 'vegan', allergens: ['Soy'] },
  { recipeName: 'Jamcaican Patty Dough', category: 'protein', stream: 'vegan', allergens: ['Milk (Butter)'] },
  { recipeName: 'Red Red Bean Stew', category: 'stew_main', stream: 'regular', veganFriendly: true, allergens: [] },
  { recipeName: 'Garlic Green Bean', category: 'veg_side', stream: 'regular', allergens: [] },
  { recipeName: 'Cornbread', category: 'starch_side', stream: 'regular', allergens: ['Gluten', 'Milk', 'Eggs'] },
  { recipeName: 'Butter Chicken', category: 'protein', stream: 'regular', veganFriendly: false, allergens: ['Tree Nuts (Coconut)'] },
];
const DEFS = {
  main: { id: 'main', cats: ['protein', 'stew_main', 'salad'], streams: ['regular', ''] },
  mainalt: { id: 'mainalt', cats: ['protein', 'stew_main'], streams: ['regular', ''] },
  noporkalt: { id: 'noporkalt', cats: ['protein', 'stew_main'], streams: ['regular', ''] },
  veganalt: { id: 'veganalt', cats: ['protein', 'stew_main'], streams: ['vegan'] },
  vegside: { id: 'vegside', cats: ['veg_side', 'stew_side'], streams: null },
};

function ctx() {
  const c = { DOOR_RECIPE_DATA: RECIPES, isHubLoaded: () => true };
  vm.createContext(c);
  for (const k of ['DOOR_ANIMAL_FAMILIES', 'DOOR_PORK_NAME_RE', 'DOOR_SLOT_LINE', 'DOOR_REGULAR_SLOT_IDS']) {
    vm.runInContext(constBlock(k), c);
    vm.runInContext('this.' + k + ' = ' + k + ';', c);
  }
  for (const f of ['doorAllergenFamily', 'doorNamesAnimalFamily', 'doorNormDishName', 'doorRecipeMatchRank', 'recipeMatchesSlotDef',
    'doorRecipeNamesPork', 'doorAnimalFamilyNamed', 'doorLineRefusal', 'doorSlotRefusal', 'doorSlotSearchGroups'])
    vm.runInContext(fnBlock(f), c);
  return c;
}
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
const names = list => list.map(x => (x.r || x).recipeName);

test('S1a any words in any order: "pork adobo" finds the adobo recipe', () => {
  const c = ctx();
  assert.equal(c.doorRecipeMatchRank('Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)', 'pork adobo'), 4);
  assert.equal(c.doorRecipeMatchRank('Garlic Green Bean', 'beans green'), 4, 'plurals and order');
  assert.equal(c.doorRecipeMatchRank('Garlic Green Bean', 'pork bean'), -1, 'every word must be there');
  assert.equal(c.doorRecipeMatchRank('Pork Griot', 'pork griot'), 0, 'the earlier ranks are unchanged');
});

test('S1b a regular box lists fitting recipes first, then Other recipes (category relaxed only)', () => {
  const c = ctx();
  const g = c.doorSlotSearchGroups(DEFS.main, 'pork adobo', 6);
  same(names(g.fit), []);
  same(names(g.other), ['Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)']);
  const g2 = c.doorSlotSearchGroups(DEFS.main, 'griot', 6);
  same(names(g2.fit), ['Pork Griot', 'Chicken Griot']);
  same(c.doorSlotSearchGroups(DEFS.main, '', 6).other, [], 'nothing extra before anything is typed');
});

test('S1c the vegan box never offers a pork or Milk-listing recipe; they show refused with the reason', () => {
  const c = ctx();
  const g = c.doorSlotSearchGroups(DEFS.veganalt, 'pork', 6);
  same(names(g.fit).concat(names(g.other)), []);
  same(g.refused.map(x => x.r.recipeName + ': ' + x.reason), ['Pork Griot: not a vegan recipe', 'Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce): not a vegan recipe']);
  const pd = c.doorSlotSearchGroups(DEFS.veganalt, 'patty', 6);
  same(names(pd.fit), []);
  assert.equal(pd.refused[0].reason, 'lists Milk');
  same(names(c.doorSlotSearchGroups(DEFS.veganalt, 'stew', 6).fit), ['Red Red Bean Stew'], 'CODEX vegan-friendly still fits');
  same(names(c.doorSlotSearchGroups(DEFS.veganalt, 'sausage', 6).fit), ['Vegan Sausage']);
});

test('S1d the halal and no-pork boxes never offer a pork recipe; Halal names are fine', () => {
  const c = ctx();
  for (const def of [DEFS.mainalt, DEFS.noporkalt]) {
    const g = c.doorSlotSearchGroups(def, 'griot', 6);
    same(names(g.fit), ['Chicken Griot']);
    same(g.refused.map(x => x.reason), ['pork']);
    same(g.other, [], 'a line box relaxes nothing');
  }
  assert.equal(c.doorSlotRefusal(DEFS.mainalt, RECIPES[3]), '', '"Halal Glazed Chicken (for Glazed Ham)" is not pork');
  assert.equal(c.doorSlotRefusal(DEFS.main, RECIPES[1]), '', 'the regular main may be pork');
});

test('S1e recipeMatchesSlotDef is unchanged: still a yes/no filter for Rex and the Special Meal editor', () => {
  const src = fnBlock('recipeMatchesSlotDef');
  assert.doesNotMatch(src, /doorSlotRefusal|Other recipes/);
  const c = ctx();
  assert.equal(c.recipeMatchesSlotDef(DEFS.main, RECIPES[0]), false, 'a sauce is still not a main by the filter');
  assert.equal(c.recipeMatchesSlotDef(DEFS.mainalt, RECIPES[1]), true, 'the filter itself has no pork rule (unchanged)');
});

test('S1f the search list shows Other recipes and refused rows that cannot be picked; slotSelect refuses them', () => {
  const ss = fnBlock('slotSearch');
  assert.match(ss, /doorSlotSearchGroups\(def, q, 6\)/);
  assert.match(ss, /Other recipes/);
  assert.match(ss, /slot-dd-refused" aria-disabled="true"/);
  assert.doesNotMatch(ss.slice(ss.indexOf('refusedHtml'), ss.indexOf('dd.innerHTML')), /slotSelect/, 'a refused row calls nothing');
  const sel = fnBlock('slotSelect');
  assert.match(sel, /doorSlotRefusal\(_def, recipe\)[\s\S]*can’t go in this box/);
});

test('S1g clicking away from a recipe name links nothing: it is held and Save asks', () => {
  const sa = fnBlock('slotAutoSave');
  assert.match(sa, /held\[slotId\] = \{ kind: 'exact', typed: val, recipe: match\.recipeName \}/);
  assert.match(sa, /how !== 'enter'/, 'Enter on the name still links it');
  assert.match(sa, /!refused\(r\)/, 'a refused recipe is never linked by name');
  const q = fnBlock('doorSlotHeldQuestion');
  assert.match(q, /h\.kind === 'exact'[\s\S]*Link the recipe\?/);
  // Re-pinned 2026-11-19 (Edit Menu redesign S5c, D3: "Follow lean"): held words are no longer a Save question. They
  // stay out of the saved meal; the note under the box links the recipe, and What changes lists them.
  assert.ok(!fnBlock('saveMenuEdit').includes('doorSlotHeldQuestion('), 'Save no longer asks about held words');
  assert.match(fnBlock('doorSlotHeldNoteHTML'), /btn\('Link “' \+ escapeHtml\(h\.recipe\) \+ '”', 'slotSelect', \[slotId, h\.recipe\]\)/);
  assert.match(fnBlock('doorSlotHeldNoteHTML'), /h\.kind === 'exact'/);
});

// Review fold (2026-11-19, P1-A): a recipe the line refuses is refused out loud at the "gets instead" box; the line keeps
// what it had. The open-time read-in keeps linking by name (nothing changes on open). Re-pinned from the first cut,
// which saved the words as a typed dish with no allergens.
test('S1h the vegan and halal "gets instead" boxes refuse a recipe the line refuses, out loud', () => {
  const c = ctx();
  const toasts = [];
  Object.assign(c, { doorLinkFlags: () => ({ linked: true }), showToast: (m) => toasts.push(m), renderSlots: () => {}, updateSlotSummary: () => {},
    MEAL_SLOT_STATE: { starch: { recipeName: 'Rice', flags: {} } } });
  for (const f of ['doorMakeLineVersion', 'doorRefusedExactRecipe', 'slotLineText']) vm.runInContext(fnBlock(f), c);
  c.slotLineText('starch', 'vegan', 'Cornbread');
  assert.equal(c.MEAL_SLOT_STATE.starch.lines, undefined, 'the vegan line keeps what it had');
  assert.match(toasts[0], /Cornbread” can’t go on the vegan line: lists Milk/);
  c.slotLineText('starch', 'halal', 'Pork Griot');
  assert.equal(c.MEAL_SLOT_STATE.starch.lines, undefined);
  assert.match(toasts[1], /halal line: pork/);
  c.slotLineText('starch', 'halal', 'Cornbread');
  assert.equal(c.MEAL_SLOT_STATE.starch.lines.halal.recipeName, 'Cornbread', 'allowed on the halal line, linked');
  c.slotLineText('starch', 'vegan', 'Butter Chicken');
  assert.equal(c.MEAL_SLOT_STATE.starch.lines.vegan, undefined, 'P1-B: a meat recipe (CODEX veganFriendly false) is refused on the vegan line');
  assert.match(toasts[2], /Butter Chicken” can’t go on the vegan line: not vegan/);
  assert.equal(c.doorMakeLineVersion('Cornbread').recipeName, 'Cornbread', 'the read-in still links by name');
  assert.match(html, /list="door-recipe-names-' \+ line \+ '"/);
  assert.match(html, /DOOR_RECIPE_DATA\.filter\(r => typeof doorLineRefusal !== 'function' \|\| !doorLineRefusal\(line, r\)\)/);
});

// Review fold (P1-A): a click away, Enter, or Save on words naming a refused recipe never saves a bare typed dish.
function slotCtx(state) {
  const c = ctx();
  const toasts = [];
  Object.assign(c, { showToast: (m) => toasts.push(m), renderSlots: () => {}, updateSlotSummary: () => {}, document: { getElementById: () => null },
    MEAL_SLOT_DEFS: Object.values(DEFS).concat([{ id: 'vegextras', list: true, streams: null }, { id: 'halalextras', list: true, streams: null }]),
    MEAL_SLOT_STATE: state || {}, SLOT_HELD: {}, SLOT_OFFERED: {}, _slotRenderDepth: 0, doorMarkLabelUnchecked: (x) => x,
    doorKeepCapturedFlags: () => false, doorLinkFlags: () => ({ linked: true }), doorSlotHoldTyped: () => null, toasts });
  for (const f of ['doorRefusedExactRecipe', 'slotAutoSave', 'slotSaveManual', 'slotDropHeld']) vm.runInContext(fnBlock(f), c);
  return c;
}
test('S1i a refused recipe name is held and refused, never saved as a typed dish (blur, Enter, the typed row)', () => {
  const c = slotCtx({ mainalt: { recipeName: 'Chicken Griot', flags: { hasChicken: true } } });
  for (const how of [undefined, 'enter']) {
    c.slotAutoSave('mainalt', 'Pork Griot', how);
    assert.equal(c.MEAL_SLOT_STATE.mainalt.recipeName, 'Chicken Griot', 'the last saved value stays (' + how + ')');
    assert.equal(c.SLOT_HELD.mainalt.kind, 'refused');
    assert.equal(c.SLOT_HELD.mainalt.reason, 'pork');
  }
  c.slotSaveManual('mainalt', 'Pork Griot');
  assert.equal(c.MEAL_SLOT_STATE.mainalt.recipeName, 'Chicken Griot', 'the typed-dish row refuses it too');
  c.slotDropHeld('mainalt');
  assert.equal(c.SLOT_HELD.mainalt, undefined, 'Put the box back clears the words');
  c.slotAutoSave('vegextras', 'Butter Chicken');
  assert.equal(c.MEAL_SLOT_STATE.vegextras, undefined, 'P1-B: Vegan line also gets refuses a meat recipe');
  assert.equal(c.SLOT_HELD.vegextras.reason, 'not vegan');
  c.slotAutoSave('vegextras', 'Jamcaican Patty Dough');
  assert.equal(c.SLOT_HELD.vegextras.reason, 'lists Milk');
  c.slotAutoSave('halalextras', 'Pork Griot');
  assert.equal(c.SLOT_HELD.halalextras.reason, 'pork');
  c.slotAutoSave('mainalt', 'Halal Lamb Stew');
  assert.equal(c.MEAL_SLOT_STATE.mainalt.manual, 'Halal Lamb Stew', 'words naming no recipe still save as typed');
  const q = fnBlock('doorSlotHeldQuestion');
  assert.match(q, /h\.kind === 'refused'[\s\S]*Put the box back/);
  assert.match(html, /\n  slotDropHeld: true,/, 'the card button is an allowed inline handler (the browser gate found it missing)');
  // Re-pinned 2026-11-19 (S5c, D3): the note puts the box back; Save no longer asks.
  assert.match(fnBlock('doorSlotHeldNoteHTML'), /btn\('Put the box back', 'slotDropHeld', \[slotId\]\)/);
  assert.match(fnBlock('slotSearch'), /groups\.refused\.some\(x => x\.r\.recipeName\.toLowerCase\(\) === q\)/, 'no typed-dish row for a refused exact name');
});

test('S1j "Link to …?" never offers a refused recipe; the Special Meal search widens only its word order', () => {
  const c = ctx();
  vm.runInContext(fnBlock('doorRecipeSuggestionFor'), c);
  assert.equal(c.doorRecipeSuggestionFor(DEFS.mainalt, 'pork griot'), null);
  assert.equal(c.doorRecipeSuggestionFor(DEFS.main, 'pork griot').recipeName, 'Pork Griot');
  // Pinned: the Special Meal editor keeps its filter (recipeMatchesSlotDef) and links on a click away as before; only the
  // shared rank reads words in any order.
  assert.match(fnBlock('smSlotSearch'), /doorRankedRecipeMatches\(def, q, 6\)/);
  assert.match(fnBlock('doorRankedRecipeMatches'), /DOOR_RECIPE_DATA\.filter\(r => recipeMatchesSlotDef\(def, r\)\)/);
  assert.doesNotMatch(fnBlock('smSlotAutoSave'), /doorSlotRefusal|SLOT_HELD/);
});
