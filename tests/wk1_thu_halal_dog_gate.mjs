// Wk1 THU lunch: the halal plate names its dish (data, publication 58, 2026-11-24).
// Jason, 2026-11-24 (EXPO plan EXPO_DISH_PARTS_ACTION_PLAN_2026-11-24.md, R10 and C3): the regular dog stays as DOOR ticks it
// (Pork + Beef, not halal-certified), and "C3 follow lean, you make the DOOR change": the halal plate's dish is
// "Halal Beef Hot Dog", in its own halal box, where DOOR used to plate 57 residents a made-up "Halal Chili Cheese Hot Dog".
// Written through Edit Menu's Save and one publish through DOOR's publisher (W6 method). Receipt:
// docs/receipts/door_wk1_thu_halal_dog_2026-11-24.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const where = (menu) => {
  // The meal is found by its words, wherever DOOR has it, so a later move does not redden this check.
  for (const [wk, days] of Object.entries(menu)) for (const [day, d] of Object.entries(days)) if (/chili cheese hot ?dog/i.test(d.lunch || '')) return { wk, day, d };
  return null;
};

test('HD1 the chili cheese dog lunch names its halal dish in its own halal box', () => {
  const m = where(read('menu_current.json').menu);
  assert.ok(m, 'the chili cheese dog lunch is on the menu');
  assert.equal(m.d.lunch_halal, 'Halal Beef Hot Dog');
  assert.equal(m.d.lunch_mainAlt, 'Halal Beef Hot Dog');
  const box = m.d.lunch_slots && m.d.lunch_slots.mainalt;
  assert.ok(box, 'a halal main box');
  assert.equal(box.manual, 'Halal Beef Hot Dog');
  assert.equal(box.flags.hasBeef, true, 'beef');
  assert.equal(box.flags.hasProcessedMeat, true, 'processed meat');
  assert.notEqual(box.flags.hasPork, true, 'never pork on the halal box');
  assert.equal(box.declared, true, 'its allergens are answered');
});

test('HD2 what must not move: the regular dog stays as ticked (R10), the words and the vegan line', () => {
  const m = where(read('menu_current.json').menu);
  const f = m.d.lunch_flags;
  assert.equal(f.hasPork, true, 'R10: pork, as DOOR ticks it');
  assert.equal(f.hasBeef, true);
  assert.notEqual(f.halalCertifiedMeat, true, 'not halal-certified, so the halal plate stays its own plate');
  assert.equal(m.d.lunch, 'Chili Cheese Hot Dog, Seasonal Side');
  assert.equal(m.d.lunch_veg, 'Vegan Chili Cheese Hotdog, Seasonal Side');
});

test('HD3 the plating counts: the halal plate serves the named dish; no made-up name is left', () => {
  const m = where(read('menu_current.json').menu);
  const r = read('routing_by_meal.json').routing[m.wk][m.day].lunch;
  assert.ok(Number.isInteger(r._components['Halal Beef Hot Dog']) && r._components['Halal Beef Hot Dog'] === r.Halal, 'every halal plate gets the named dish');
  assert.equal(r._components['Halal Chili Cheese Hot Dog'], undefined, 'no made-up halal name');
  assert.ok(r._components['Seasonal Side'] >= r.Halal + r.Regular, 'the halal plates keep the seasonal side');
});
