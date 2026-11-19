// S2b of the Edit Menu redesign, the node half (the browser half is tests/browser/plate_summary_s2b.mjs, in CI):
//   - Save and the plate summary read one writer (doorWriteEditorMeal) and one meat reader (doorEditorDetectMeat);
//   - "turkey bacon" is not pork (re-saving a Monday breakfast added a false Pork tick, found by the summary census);
//   - D8 (Jason 2026-11-19: "Follow lean"): a halal dish named pork is listed (doorHalalPorkDishes) and the halal plate
//     says PORK; a "Halal ..." name, and a copied pork tick on a halal chicken dish, are not pork.
// Authored-to-fail against main 7d33af4: none of these functions exist.
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
  return html.slice(start, html.indexOf(';\n', start) + 1);
}
const J = (x) => JSON.stringify(x);

test('S2b-1 Save and the summary share one writer and one meat reader', () => {
  assert.match(fnBlock('_finishMenuSave'), /doorWriteEditorMeal\(overlay\[week\]\[day\], period, name, veg, flags\);/);
  assert.match(fnBlock('doorDraftPlateFacts'), /doorWriteEditorMeal\(overlay\[week\]\[day\], period, buildMealName\(\), buildVegAlt\(\), flags\);/);
  assert.match(fnBlock('doorDraftPlateFacts'), /return doorPlateFacts\(dayData, period, \{ dated: null, menuEdit \}\);/);
  assert.match(fnBlock('doorDraftPlateFacts'), /finally \{ setDoorPublishMenuOverlayOverride\(was\); \}/, 'the menu override is always put back');
  assert.match(fnBlock('saveMenuEdit'), /return doorEditorDetectMeat\(slotId\);/);
  assert.match(fnBlock('updateSlotSummary'), /flags\._vegAltSafe = !!draftFacts\.mealFlags\._vegAltSafe/, 'the preview reads plating egg and mustard check');
  assert.doesNotMatch(fnBlock('_finishMenuSave'), /vegAllergens/, 'the unused vegan string is gone');
});

test('S2b-2 turkey bacon is not pork; pork, ham, bacon and carnitas still are', () => {
  const c = { MEAL_SLOT_STATE: {} };
  vm.createContext(c);
  vm.runInContext(constBlock('DOOR_EDITOR_MEAT_DETECT') + '\n' + fnBlock('doorEditorDetectMeat'), c);
  const flags = (s) => { c.MEAL_SLOT_STATE.main = s; return c.doorEditorDetectMeat('main').map((m) => m.flag).sort(); };
  assert.equal(J(flags({ manual: 'Pancakes, turkey bacon, fruit & yoghurt' })), J(['hasTurkey']));
  assert.equal(J(flags({ manual: 'Turkey Bacon' })), J(['hasTurkey']));
  assert.equal(J(flags({ manual: 'Bacon and eggs' })), J(['hasPork']));
  assert.equal(J(flags({ manual: 'Pork Carnitas' })), J(['hasPork']));
  assert.equal(J(flags({ recipeName: 'Meatloaf', displayText: 'Pork & Beef Meatloaf' })), J(['hasBeef', 'hasPork']));
});

test('S2b-3 D8: a halal dish named pork is listed; Halal names and copied ticks are not', () => {
  const c = {};
  vm.createContext(c);
  vm.runInContext([constBlock('DOOR_PORK_NAME_RE'), constBlock('DOOR_LINE_SIDE_IDS'), constBlock('DOOR_LINE_EXTRAS'),
    fnBlock('doorRecipeNamesPork'), fnBlock('doorLinePieces'), fnBlock('doorHalalPorkDishes')].join('\n'), c);
  const day = (halal, slots) => ({ dinner: 'X', dinner_halal: halal || '', dinner_slots: slots || null });
  assert.equal(J(c.doorHalalPorkDishes(day('Ham Steak, Rice'), 'dinner')), J(['Ham Steak']));
  const d2 = { dinner: 'X', dinner_halal: '', dinner_slots: { mainalt: { manual: 'Pork Griot', flags: {} } } };
  assert.equal(J(c.doorHalalPorkDishes(d2, 'dinner')), J(['Pork Griot']));
  const tandoori = { dinner: 'X', dinner_halal: 'Tandoori Chicken', dinner_slots: { mainalt: { recipeName: 'Tandoori Chicken', flags: { hasPork: true } } } };
  assert.equal(J(c.doorHalalPorkDishes(tandoori, 'dinner')), J([]), 'a copied pork tick is not a dish named pork');
  const halalName = { dinner: 'X', dinner_halal: 'Halal Glazed Chicken (for Glazed Ham)', dinner_slots: null };
  assert.equal(J(c.doorHalalPorkDishes(halalName, 'dinner')), J([]));
  const version = { dinner: 'X', dinner_halal: '', dinner_slots: { mainalt: { manual: 'Chicken', flags: {} }, starch: { manual: 'Rice', flags: {}, lines: { halal: { mode: 'swap', manual: 'Bacon Rice', flags: {} } } } } };
  assert.equal(J(c.doorHalalPorkDishes(version, 'dinner')), J(['Bacon Rice']), 'a halal side version is read');
  const f = fnBlock('doorPlateFacts');
  assert.match(f, /halalAllergenStr \? halalAllergenStr \+ ', PORK' : 'PORK'/, 'the halal plate says PORK when a dish is named pork');
});
