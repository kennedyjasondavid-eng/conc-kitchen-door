// The Tuesday vegan breakfast names oat milk (Jason, 2026-11-20: "yes, make the Tuesday vegan breakfast oat milk"),
// written as Edit Menu's writer writes a permanent change, without its box rebuild, and one publish through DOOR's
// publisher (publication 43). Reads the published
// menu_current.json, menu_overlay.json and routing_by_meal.json; a later reviewed menu change that touches these
// breakfasts re-pins this with a dated note.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const routing = JSON.parse(fs.readFileSync('routing_by_meal.json', 'utf8')).routing;
const WEEKS = ['1', '2', '3', '4'];

test('TO-1 each Tuesday vegan breakfast names oat milk; the regular line is unchanged', () => {
  for (const w of WEEKS) {
    assert.equal(menu[w].TUESDAY.breakfast_veg, 'Cereal and oat milk, fruit', 'Wk' + w);
    assert.equal(menu[w].TUESDAY.breakfast, 'Cereal and milk, fruit', 'Wk' + w + ' regular');
  }
});

test('TO-2 the soft plate is as it was: none set, and none marked "not needed"', () => {
  // Only the vegan line was written; the soft-plate state (no soft plate, none marked "not needed") is as it was.
  for (const w of WEEKS) {
    const b = menu[w].TUESDAY;
    assert.notEqual(b.breakfast_altMealsNone, true, 'Wk' + w);
    assert.ok(!(b.breakfast_altMeals || []).length, 'Wk' + w);
  }
});

test('TO-3 each meal keeps its original, so Put back the original works', () => {
  for (const w of WEEKS) {
    const o = ((overlay.menu || overlay)[w] || {}).TUESDAY || {};
    assert.ok(o.breakfast_original && o.breakfast_original.meal, 'Wk' + w + ' has a kept original');
    assert.equal(o.breakfast_original.meal._veg, 'Cereal and milk, fruit', 'Wk' + w + ' the original vegan line');
  }
});

test('TO-4 the routing file splits the cereal: the vegan plate gets the oat milk', () => {
  for (const w of WEEKS) {
    const c = routing[w].TUESDAY.breakfast._components;
    assert.ok(c['Cereal and oat milk'] > 0, 'Wk' + w);
    assert.ok(c['Cereal and milk'] > 0, 'Wk' + w);
  }
});

test('TO-5 an "oat milk only" breakfast note reads the vegan plate without a CHECK', () => {
  const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n?/g, '\n');
  const a = html.indexOf('/* DOOR_TESTABLE_CORE_START breakfast-note */'), b = html.indexOf('/* DOOR_TESTABLE_CORE_END breakfast-note */');
  assert.ok(a >= 0 && b > a, 'the breakfast-note core');
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(a, b) + '\nthis.conflict = doorBreakfastNoteConflict;', ctx);
  for (const w of WEEKS) {
    assert.equal(ctx.conflict('oat milk only', menu[w].TUESDAY.breakfast_veg), '', 'Wk' + w);
    assert.match(ctx.conflict('oat milk only', menu[w].TUESDAY.breakfast), /CHECK/, 'Wk' + w + ' regular still names plain milk');
  }
});
