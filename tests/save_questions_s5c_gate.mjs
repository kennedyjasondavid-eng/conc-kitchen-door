// S5c of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): Save asks only what it must.
// D3, Jason 2026-11-19: "Follow lean". Node half; the browser half is tests/browser/save_questions_s5c.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const fn = (name) => {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' is defined');
  return html.slice(i, html.indexOf('\n}\n', i) + 2);
};
const out = (x) => JSON.parse(JSON.stringify(x));

test('S5c-1 Save no longer asks about a run-on box or held words; What changes says them', () => {
  const save = fn('saveMenuEdit');
  assert.ok(!save.includes('More than one dish in a slot?'));
  assert.ok(!save.includes('doorSlotHeldQuestion('));
  assert.match(save, /Nothing was saved: /, 'held words alone: nothing saved, and it says so');
  const h = fn('doorWhatChangesHTML');
  assert.match(h, /reads like more than one dish/);
  assert.match(h, /Not saved: “/);
  assert.match(h, /No soft plate is set for this meal/);
});

test('S5c-2 any allergen removal is asked, keep by default; the meat marks follow the dish (W3a)', () => {
  const c = { FLAG_DEFS: [{ key: 'hasPork', label: 'Pork' }, { key: 'hasEgg', label: 'Egg' }],
    getMenuData: () => ({ 1: { MONDAY: { lunch_flags: { hasEgg: true, hasPork: true, isSpicy: true, halalCertifiedMeat: true } } } }) };
  vm.createContext(c);
  const at = html.indexOf("const DOOR_MEAT_MARKS = ");
  vm.runInContext(html.slice(at, html.indexOf('\n', at)) + '\n' + fn('doorAllergenRemovals') + fn('doorRemovalQuestion') + fn('doorTicksQuestion'), c);
  assert.deepEqual(out(c.doorAllergenRemovals('1-MONDAY-lunch', { hasPork: false })), ['hasEgg', 'isSpicy'], 'allergens and warnings, never the meat marks');
  const q = out(c.doorRemovalQuestion(['hasEgg']));
  assert.equal(q.goLabel, 'Keep them');
  assert.equal(q.altLabel, 'Take them off');
  assert.deepEqual(q.items, ['Egg']);
  assert.equal(out(c.doorTicksQuestion({ oldMain: 'Glazed Ham', newMain: 'Ginger Tofu', sameDish: false }, ['hasPork'])).goLabel, 'Take them off');
  assert.equal(out(c.doorTicksQuestion({ oldMain: 'Glazed Ham', newMain: 'Ham Steak', sameDish: true }, ['hasPork'])).goLabel, 'Keep them');
  const save = fn('saveMenuEdit');
  assert.match(save, /if \(ans !== 'alt'\) _removed\.forEach\(k => \{ flags\[k\] = true; \}\);/);
  assert.ok(save.indexOf('doorAllergenRemovals(') > save.indexOf('doorCarriedTicks('), 'after the meat marks are settled');
});

test('S5c-3 halal is asked only when the meat changed since the meal opened', () => {
  assert.match(fn('saveMenuEdit'), /&& doorMeatChangedSinceOpen\(hasPorkInMain \? 'mainalt' : 'main'\);/);
  const c = { mcMenuEditKey: '1-MONDAY-lunch', MEAL_SLOT_STATE: { main: { manual: 'Roast Chicken' }, mainalt: {} }, _slotText: (s) => (s && (s.displayText || s.recipeName || s.manual)) || '' };
  vm.createContext(c);
  vm.runInContext(['var _doorSaveAskAtOpen = null;', fn('doorEditorDetectMeat').replace(/^/, 'const DOOR_EDITOR_MEAT_DETECT = [{ kw: /chicken/i, flag: "hasChicken" }, { kw: /beef/i, flag: "hasBeef" }];\n'),
    fn('doorSaveAskSnapshot'), fn('doorMeatChangedSinceOpen'), fn('doorDishesChangedSinceOpen')].join('\n'), c);
  vm.runInContext('_doorSaveAskAtOpen = doorSaveAskSnapshot();', c);
  assert.equal(c.doorMeatChangedSinceOpen('main'), false, 'the same meat');
  c.MEAL_SLOT_STATE.main = { manual: 'Chicken Curry' };
  assert.equal(c.doorMeatChangedSinceOpen('main'), false, 'another chicken dish: the meat is the same');
  assert.equal(c.doorDishesChangedSinceOpen(), true);
  c.MEAL_SLOT_STATE.main = { manual: 'Beef Stew' };
  assert.equal(c.doorMeatChangedSinceOpen('main'), true, 'chicken to beef');
  vm.runInContext('_doorSaveAskAtOpen = null;', c);
  assert.equal(c.doorMeatChangedSinceOpen('main'), true, 'unknown: ask, as before');
});

test('S5c-4 the soft plate is asked only when it can matter, and always with no resident list', () => {
  const c = { REGISTRY_LIST: [], doorDishesChangedSinceOpen: () => true };
  vm.createContext(c);
  vm.runInContext(fn('doorSoftQuestionNeeded'), c);
  assert.equal(c.doorSoftQuestionNeeded(), true, 'no list: asked');
  c.REGISTRY_LIST.push({ room: '1', tags: ['Regular'] });
  assert.equal(c.doorSoftQuestionNeeded(), false, 'nobody eats soft');
  c.REGISTRY_LIST.push({ room: '2', tags: ['Soft Meals'] });
  assert.equal(c.doorSoftQuestionNeeded(), true, 'a soft resident and a dish changed');
  c.doorDishesChangedSinceOpen = () => false;
  assert.equal(c.doorSoftQuestionNeeded(), false, 'only ticks changed');
  assert.match(fn('saveMenuEdit'), /if \(!_alts\.length && !ALT_MEALS_NONE && doorSoftQuestionNeeded\(\)\)/);
});

test('S5c-5 a new anaphylactic conflict is a red question before the halal question and any write', () => {
  const save = fn('saveMenuEdit');
  const at = save.indexOf('doorAnaphSaveQuestion(flags)');
  assert.ok(at > save.indexOf('doorCarriedTicks(') && at < save.indexOf('needsHalalPrompt'), 'after the ticks answer, before halal');
  const q = fn('doorAnaphSaveQuestionInner');
  assert.match(q, /danger: true/);
  assert.match(q, /sb\[r\.room\] !== 'Anaphylactic Alternative' && sa\[r\.room\] === 'Anaphylactic Alternative'/);
  assert.match(q, /if \(!list\.length\) return null;/, 'no list: nothing to name (What changes says counts not available)');
  assert.match(q, /\(shares the room\)/, 'the roommates the sheet contains are named');
  assert.match(fn('doorAnaphSaveQuestion'), /return \{ hold: true \};/, 'a check that cannot run holds Save');
  assert.match(save, /Not saved: DOOR could not check the anaphylactic residents/);
  assert.match(fn('doorAsk'), /if \(o\.danger\) h\.style\.color = 'var\(--danger-ink, #991b1b\)';/);
});

test('S5c-6 splitting a side box is not a changed dish; moving a dish to another plate or changing a line version is (U1 review, 2026-11-19)', () => {
  // A side box split in two ("Fruit & Chips"): every plate keeps the same dishes. (A dish split out of the main box
  // becomes a shared side, so the vegan and halal plates gain it in the data: that still asks, the safe side.)
  const c = { mcMenuEditKey: '4-MONDAY-lunch', MEAL_SLOT_STATE: { main: { manual: 'Pork Adobo' }, starch: { manual: 'Rice' }, xtra: { manual: 'Fruit & Chips' } }, _slotText: (s) => (s && (s.displayText || s.recipeName || s.manual)) || '' };
  vm.createContext(c);
  const html2 = html;
  const constLine = (name) => { const i = html2.indexOf('const ' + name + ' = '); return i < 0 ? '' : html2.slice(i, html2.indexOf(';\n', i) + 2); };
  vm.runInContext(['var _doorSaveAskAtOpen = null;', 'const DOOR_EDITOR_MEAT_DETECT = [];', constLine('DOOR_LINE_SIDE_IDS'), constLine('DOOR_LINE_EXTRAS'), fn('doorLinePieces'), fn('doorEditorDetectMeat'), fn('doorSaveAskSnapshot'), fn('doorDishesChangedSinceOpen')].join('\n'), c);
  vm.runInContext('_doorSaveAskAtOpen = doorSaveAskSnapshot();', c);
  c.MEAL_SLOT_STATE.xtra = { manual: 'Fruit' };
  c.MEAL_SLOT_STATE.vegside = { manual: 'Chips' };
  assert.equal(c.doorDishesChangedSinceOpen(), false, 'the same dishes in more boxes');
  c.MEAL_SLOT_STATE.vegside = { manual: 'Steamed Kale' };
  assert.equal(c.doorDishesChangedSinceOpen(), true, 'a dish changed');
  // Review fold: a dish moved to another plate, or a line version changed, is a change.
  const reset = () => { c.MEAL_SLOT_STATE = { main: { manual: 'Pork Adobo' }, starch: { manual: 'Rice' }, vegside: { manual: 'Garlic Green Bean' } };
    vm.runInContext('_doorSaveAskAtOpen = doorSaveAskSnapshot();', c); };
  reset(); delete c.MEAL_SLOT_STATE.starch; c.MEAL_SLOT_STATE.vegextras = { manual: 'Rice' };
  assert.equal(c.doorDishesChangedSinceOpen(), true, 'rice moved from the regular plate to the vegan plate only');
  reset(); c.MEAL_SLOT_STATE.starch = { manual: 'Rice', lines: { halal: { mode: 'none' } } };
  assert.equal(c.doorDishesChangedSinceOpen(), true, 'the halal plate stops getting the rice');
  reset(); c.MEAL_SLOT_STATE.starch = { manual: 'Rice', lines: { halal: { mode: 'swap', manual: 'Couscous' } } };
  assert.equal(c.doorDishesChangedSinceOpen(), true, 'the halal plate gets couscous instead');
});

