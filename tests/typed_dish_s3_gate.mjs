// S3 of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md; D2, Jason 2026-11-19: "Follow lean"):
// a typed dish (no recipe) says what it contains. Answered = declared: true ("Nothing to declare" included) or an
// allergen tick. A dish typed now reads amber until answered; one saved before S3 reads quietly, and Menu Config lists them
// for one sitting. The marker travels in the published _slots (EXPO ignores _slots; HUB reads only recipeId). Rex import
// marks a dish its review ticked. The Special Meal editor keeps no per-dish allergens (its meal grid is the answer).
// Authored-to-fail against main 14d6198: none of these exist.
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
const FLAG_DEFS = [{ key: 'hasSoy' }, { key: 'hasGluten' }, { key: 'isSpicy', mealLevel: true }, { key: 'isCarb', mealLevel: true }];
function ctx(extra) {
  const c = Object.assign({ FLAG_DEFS, escapeHtml: (s) => String(s), _escAttr: (s) => String(s), _jsArgLiteral: (s) => JSON.stringify(s) }, extra || {});
  vm.createContext(c);
  vm.runInContext([constBlock('DOOR_TYPED_DISH_IDS'), fnBlock('doorTypedDishUnanswered'), fnBlock('doorMealsTypedUnanswered'),
    'var SLOT_TYPED_AT_OPEN = {};', fnBlock('doorTypedDishNoteHTML'), 'this.setOpen = (o) => { SLOT_TYPED_AT_OPEN = o; };'].join('\n'), c);
  return c;
}

test('S3-1 answered means declared or an allergen tick; Spicy or Carb alone is not an answer', () => {
  const c = ctx();
  assert.equal(c.doorTypedDishUnanswered({ manual: 'Rice', flags: {} }), true);
  assert.equal(c.doorTypedDishUnanswered({ manual: 'Rice', flags: {}, declared: true }), false);
  assert.equal(c.doorTypedDishUnanswered({ manual: 'Peanut Noodles', flags: { hasSoy: true } }), false);
  assert.equal(c.doorTypedDishUnanswered({ manual: 'Chili', flags: { isSpicy: true, isCarb: true } }), true);
  assert.equal(c.doorTypedDishUnanswered({ recipeName: 'Rice Pilaf', flags: {} }), false, 'a linked dish has its recipe');
  assert.equal(c.doorTypedDishUnanswered(null), false);
});

test('S3-2 a dish typed now reads amber; one the meal opened with reads quietly; both offer Nothing to declare', () => {
  const c = ctx();
  c.setOpen({ starch: 'Rice' });
  const old = c.doorTypedDishNoteHTML({ id: 'starch' }, { manual: 'Rice', flags: {} });
  assert.match(old, /slot-typed-old/); assert.match(old, /not answered yet/); assert.match(old, /slotDeclareNothing\("starch"\)/);
  const fresh = c.doorTypedDishNoteHTML({ id: 'starch' }, { manual: 'Peanut Noodles', flags: {} });
  assert.match(fresh, /slot-typed-new/); assert.match(fresh, /What does “Peanut Noodles” contain\?/);
  assert.equal(c.doorTypedDishNoteHTML({ id: 'starch' }, { manual: 'Rice', flags: {}, declared: true }), '');
});

test('S3-3 the marker travels in the saved slots; a tick on a typed dish answers it; the Event Name is not a dish', () => {
  assert.match(fnBlock('_buildSlotSnapshot'), /if \(s\.declared === true\) snap\[d\.id\]\.declared = true;/);
  assert.match(fnBlock('slotToggleFlag'), /MEAL_SLOT_STATE\[slotId\]\.declared = true;/);
  assert.match(fnBlock('slotDeclareNothing'), /s\.declared = true;/);
  assert.ok(!/'extras'/.test(constBlock('DOOR_TYPED_DISH_IDS')), 'the Event Name is free text');
  assert.match(fnBlock('renderSlotCard'), /ns === 'slot' && hasValue && typeof doorTypedDishNoteHTML === 'function' \? doorTypedDishNoteHTML\(def, state\)/);
  assert.match(fnBlock('openMenuEdit'), /SLOT_TYPED_AT_OPEN = \{\};[\s\S]*_doorMenuDraftBaseline = \{key:mcMenuEditKey/, 'the open-time list is taken before the draft baseline');
});

test('S3-4 Menu Config lists the typed dishes not answered, by meal; the published menu has them', () => {
  const c = ctx();
  const menu = { 1: { MONDAY: { lunch_slots: { main: { manual: 'Stew', flags: {} }, starch: { manual: 'Rice', flags: {}, declared: true },
    extras: { manual: 'Jerk Night' }, vegside: { manual: 'Slaw', flags: { hasSoy: true } } } } } };
  assert.equal(JSON.stringify(c.doorMealsTypedUnanswered(menu)), JSON.stringify([{ week: '1', day: 'MONDAY', period: 'lunch', dishes: ['Stew'] }]));
  const published = JSON.parse(fs.readFileSync(path.join(root, 'menu_current.json'), 'utf8')).menu;
  const pc = ctx({ FLAG_DEFS: [{ key: 'hasSoy' }, { key: 'hasGluten' }, { key: 'hasDairy' }, { key: 'hasEgg' }, { key: 'hasFish' }, { key: 'hasPeanuts' },
    { key: 'hasTreeNuts' }, { key: 'hasSesame' }, { key: 'hasMustard' }, { key: 'hasShellfish' }, { key: 'hasSulphites' }, { key: 'hasPork' }, { key: 'hasBeef' },
    { key: 'hasChicken' }, { key: 'hasTurkey' }, { key: 'hasCoconut' }, { key: 'hasMushroom' }, { key: 'hasBrassicas' }, { key: 'hasCorn' }, { key: 'hasNightshades' },
    { key: 'hasBeans' }, { key: 'isSpicy', mealLevel: true }, { key: 'isCarb', mealLevel: true }, { key: 'halalCertifiedMeat', mealLevel: true }, { key: 'hasProcessedMeat', mealLevel: true }] });
  const list = pc.doorMealsTypedUnanswered(published);
  assert.ok(list.length > 0 && list.length < 84, 'some meals, not all: ' + list.length);
  assert.match(html, /<div id="mc-typed-unanswered"/);
  assert.match(fnBlock('renderTypedUnansweredList'), /#menu-config\/edit\//, 'each meal links to Edit Menu');
});

test('S3-5 Rex import marks a typed dish its review ticked', () => {
  assert.match(fnBlock('doorRexBuildMeal'), /if \(\(\(a\.ticks \|\| \{\}\)\[ln \+ '\|' \+ piece\] \|\| \[\]\)\.length\) typed\.declared = true;/);
});
