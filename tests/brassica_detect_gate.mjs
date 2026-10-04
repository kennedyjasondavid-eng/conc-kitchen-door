// tests/brassica_detect_gate.mjs — DOOR reads brassicas from the dish text (2026-10-04).
// Every brassica meal (broccoli, cauliflower, cabbage, slaw, collards…) carried hasBrassicas:false: nothing set it
// from the dish text, so a No Brassicas resident was never flagged. The menu as read (getMenuData → Menu Config,
// plating, routing, publish) now carries the flag wherever the text names a brassica; the import's name detector
// sets it too. Additive only — a flag is never cleared.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const menuCur = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const sb = vm.createContext({});
vm.runInContext(fn('emptyMealFlags') + between('// Brassica words in a dish name', 'function getMenuData() {') + fn('nameDetectFlags') + 'globalThis.R = DOOR_BRASSICA_RE;', sb);
const textOf = (d, meal) => [d[meal], d[meal + '_veg'], d[meal + '_sides']].filter(x => typeof x === 'string').join(' , ');
const BRASSICA_MEALS = [];
for (const [wk, days] of Object.entries(menuCur.menu)) for (const [day, d] of Object.entries(days))
  for (const meal of ['breakfast', 'lunch', 'dinner']) if (/brocc|brocol|cauliflower|cabbage|slaw|collard|gomen/i.test(textOf(d, meal))) BRASSICA_MEALS.push([wk, day, meal]);

test('the brassica word list catches the dishes on the menu and misses non-brassicas', () => {
  for (const t of ['Broccoli Salad', 'Steamed Brocolli', 'Cauliflower & Carrot', 'Cabbage Stirfry', 'Creamy Coleslaw', 'red cabbage',
    'Vegetarian Collard Stew', 'Gomen Besiga with Vegetable', 'Chow Mein + Nappa Cabbage', 'Kale Salad', 'Bok Choy'])
    assert.ok(sb.R.test(t), t);
  for (const t of ['Seasonal Vegetables', 'Peas and Carrots', 'Green Beans', 'Sausage & Greens Pasta', 'Rice and Beans', 'Coconut Rice'])
    assert.ok(!sb.R.test(t), t);
});
test('every brassica meal on the menu is read with hasBrassicas', () => {
  assert.ok(BRASSICA_MEALS.length >= 12, 'the menu names brassicas in at least 12 meals: ' + BRASSICA_MEALS.length);
  const out = vm.runInContext('doorApplyTextDetectedFlags(' + JSON.stringify(menuCur.menu) + ')', sb);
  for (const [wk, day, meal] of BRASSICA_MEALS) assert.equal(out[wk][day][meal + '_flags'].hasBrassicas, true, wk + ' ' + day + ' ' + meal);
});
test('only brassica meals change, the source is never mutated, and a set flag is never cleared', () => {
  const src = JSON.parse(JSON.stringify(menuCur.menu));
  sb.SRC = src; const out = vm.runInContext('doorApplyTextDetectedFlags(SRC)', sb);
  assert.deepEqual(src, menuCur.menu, 'source untouched');
  const isB = (wk, day, meal) => BRASSICA_MEALS.some(x => x[0] === wk && x[1] === day && x[2] === meal);
  for (const [wk, days] of Object.entries(src)) for (const [day, d] of Object.entries(days)) {
    const changed = ['breakfast', 'lunch', 'dinner'].filter(meal => JSON.stringify(out[wk][day][meal + '_flags']) !== JSON.stringify(d[meal + '_flags']));
    for (const meal of changed) {
      assert.ok(isB(wk, day, meal), 'changed a non-brassica meal ' + wk + day + meal);
      const before = d[meal + '_flags'] || {}, after = out[wk][day][meal + '_flags'];
      for (const [k, v] of Object.entries(before)) if (k !== 'hasBrassicas') assert.equal(after[k], v, k);
    }
    if (!changed.length) assert.equal(out[wk][day], d, 'an unchanged day is passed through as is');
  }
  sb.T = { '1': { MONDAY: { dinner: 'Rice', dinner_flags: { hasBrassicas: true } } } };
  assert.equal(vm.runInContext('doorApplyTextDetectedFlags(T)', sb)['1'].MONDAY.dinner_flags.hasBrassicas, true, 'a set flag stays set');
});
test('the import name detector sets hasBrassicas', () => {
  const f = vm.runInContext('nameDetectFlags("Jerk Chicken, Cabbage Stirfry", emptyMealFlags())', sb);
  assert.equal(f.hasBrassicas, true);
  assert.equal(vm.runInContext('nameDetectFlags("Jerk Chicken, Rice", emptyMealFlags())', sb).hasBrassicas, false);
});
test('the menu as read goes through the detector, defined before the boot-time read', () => {
  const body = fn('getMenuData');
  assert.match(body, /doorApplyTextDetectedFlags\(merged\)/);
  assert.ok(html.indexOf('const DOOR_BRASSICA_RE') < html.indexOf('const MEAL_DATA = getMealForDate'), 'the regex is declared before the first menu read');
});
test('the published menu carries the flag on every brassica meal', () => {
  for (const [wk, day, meal] of BRASSICA_MEALS) assert.equal((menuCur.menu[wk][day][meal + '_flags'] || {}).hasBrassicas, true, wk + ' ' + day + ' ' + meal);
});
