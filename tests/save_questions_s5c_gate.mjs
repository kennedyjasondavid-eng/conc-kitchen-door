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

test('S5c-2 an allergen removal keeps by default, for the same dish and a different one', () => {
  const c = { FLAG_DEFS: [{ key: 'hasPork', label: 'Pork' }] };
  vm.createContext(c);
  vm.runInContext(fn('doorTicksQuestion') + '\nthis.f = doorTicksQuestion;', c);
  for (const sameDish of [true, false]) {
    const q = out(c.f({ oldMain: 'Glazed Ham', newMain: 'Ginger Tofu', sameDish }, ['hasPork']));
    assert.equal(q.goLabel, 'Keep them');
    assert.equal(q.altLabel, 'Take them off');
  }
  assert.match(fn('saveMenuEdit'), /const takeOff = ans === 'alt';/);
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
  const q = fn('doorAnaphSaveQuestion');
  assert.match(q, /danger: true/);
  assert.match(q, /a\.before !== 'Anaphylactic Alternative' && a\.after === 'Anaphylactic Alternative'/);
  assert.match(q, /if \(!list\.length\) return null;/, 'no list: nothing to name (What changes says counts not available)');
  assert.match(fn('doorAsk'), /if \(o\.danger\) h\.style\.color = 'var\(--danger-ink, #991b1b\)';/);
});
