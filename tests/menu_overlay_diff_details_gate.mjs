// P4 follow-up (2026-10-08, v31-standard.24): the "differs from the published menu" line says WHAT differs.
//
// The P4 line compared whole menu days and only named them ("1 day (Wk1 MON)"), so the operator had to
// pick a copy blind. The live case was four per-dish editor tags on Wk1 MON lunch (Chicken, Carb-swap and
// Halal-Certified Meat on the chicken burger; Gluten on the quinoa burger) — inside `lunch_slots`, the
// editor's per-dish snapshot. Plating, routing and the published allergens are built from the meal-level
// fields, never from `_slots`, so the menu staff see was identical on both computers.
//
// Now: `doorOverlayDayDifferences` lists each difference in plain words (meal, what, this computer,
// published, and whether it reaches plates/routing); the line reads as a calm note when only editor
// details differ, and a "Show what's different" list links each meal to its editor. Display only.
//
// Authored-to-fail against origin/main 9fd65b2: the helper does not exist and the line has no list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const CORE_S = '/* DOOR_TESTABLE_CORE_START publish-validation */';
const CORE_E = '/* DOOR_TESTABLE_CORE_END publish-validation */';

function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
  return html.slice(start, i);
}
function core(extra) {
  const c = { Array, JSON, Object, Number, isFinite, String, ...(extra || {}) };
  vm.createContext(c);
  vm.runInContext(html.slice(html.indexOf(CORE_S), html.indexOf(CORE_E)), c, { timeout: 1000 });
  return c;
}
const plain = v => JSON.parse(JSON.stringify(v));
const LABELS = { hasChicken: 'Chicken', isCarb: 'Carb-swap', halalCertifiedMeat: 'Halal-Certified Meat', hasGluten: 'Gluten', hasEgg: 'Egg' };

// The live Wk1 MON lunch case, trimmed to the fields that matter.
const MEAL = {
  lunch: 'Breaded Chicken Burgers, Home Fry Potatoes',
  lunch_veg: 'Crispy Quinoa Cake Burger, Home Fry Potatoes',
  lunch_flags: { hasGluten: true, hasEgg: true, hasChicken: true, isCarb: true, halalCertifiedMeat: true },
};
const PUBLISHED = { ...MEAL, lunch_slots: {
  main: { recipeName: 'Halal Breaded Chicken Burgers', flags: { hasGluten: true, hasEgg: true, hasChicken: false, isCarb: false, halalCertifiedMeat: false } },
  veganalt: { recipeName: 'Crispy Quinoa Cake Burger', flags: {} },
} };
const HERE = { ...MEAL, lunch_slots: {
  main: { recipeName: 'Halal Breaded Chicken Burgers', flags: { hasGluten: true, hasEgg: true, hasChicken: true, isCarb: true, halalCertifiedMeat: true } },
  veganalt: { recipeName: 'Crispy Quinoa Cake Burger', flags: { hasGluten: true } },
} };

test('1. the live Wk1 MON case: four per-dish editor tags, none reaching plates or routing', () => {
  const C = core();
  const rows = plain(C.doorOverlayDayDifferences(HERE, PUBLISHED, LABELS));
  assert.equal(rows.length, 4);
  assert.ok(rows.every(r => r.meal === 'lunch' && r.staffSees === false), 'all lunch, all editor-only');
  assert.deepEqual(rows.map(r => [r.what, r.here, r.published]), [
    ['Main (Halal Breaded Chicken Burgers) tag: Chicken', 'on', 'off'],
    ['Main (Halal Breaded Chicken Burgers) tag: Carb-swap', 'on', 'off'],
    ['Main (Halal Breaded Chicken Burgers) tag: Halal-Certified Meat', 'on', 'off'],
    ['Vegan alternative (Crispy Quinoa Cake Burger) tag: Gluten', 'on', 'off'],
  ]);
});

test('2. a missing tag reads as off, so absent-vs-off is never listed; matching days list nothing', () => {
  const C = core();
  const a = { lunch_slots: { main: { recipeName: 'X', flags: { hasEgg: false } } } };
  const b = { lunch_slots: { main: { recipeName: 'X', flags: {} } } };
  assert.equal(C.doorOverlayDayDifferences(a, b, LABELS).filter(r => r.what.indexOf('tag:') >= 0).length, 0);
  assert.equal(C.doorOverlayDayDifferences(MEAL, { ...MEAL }, LABELS).length, 0);
});

test('3. what staff see is marked as such: meal text, alternatives and meal-level tags', () => {
  const C = core();
  const pub = { ...MEAL, lunch: 'Fish Burgers, Home Fry Potatoes', lunch_flags: { ...MEAL.lunch_flags, hasFish: true } };
  const rows = plain(C.doorOverlayDayDifferences(MEAL, pub, { ...LABELS, hasFish: 'Fish' }));
  assert.deepEqual(rows.map(r => [r.what, r.here, r.published, r.staffSees]), [
    ['Meal', MEAL.lunch, 'Fish Burgers, Home Fry Potatoes', true],
    ['Meal tag: Fish', 'off', 'on', true],
  ]);
});

test('4. meals come out breakfast → lunch → dinner, and an unknown field is treated as staff-visible', () => {
  const C = core();
  const rows = plain(C.doorOverlayDayDifferences(
    { dinner: 'B', breakfast: 'A', lunch_newThing: 1 },
    { dinner: 'b', breakfast: 'a', lunch_newThing: 2 }, LABELS));
  assert.deepEqual(rows.map(r => r.meal), ['breakfast', 'lunch', 'dinner']);
  assert.equal(rows[1].staffSees, true, 'never guess that an unknown field is harmless');
});

function renderCtx(local, cloud) {
  const store = {};
  const el = { style: {}, innerHTML: '' };
  const writes = { set: 0, side: 0 };
  const c = core({
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { writes.set++; store[k] = String(v); } },
    document: { getElementById: id => (id === 'mc-overlay-diff-banner' ? el : null) },
    PublishAuth: { sidePublish: () => { writes.side++; } },
    FLAG_DEFS: Object.keys(LABELS).map(key => ({ key, label: LABELS[key] })),
    escapeHtml: v => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[ch]),
  });
  vm.runInContext(['let _doorOverlayCloudDiff = { days: [], cloud: null };', fnBlock('loadMenuBaseOverlay'),
    fnBlock('doorRecordOverlayCloudDiff'), fnBlock('renderOverlayDiffBanner')].join('\n'), c);
  const meta = { ...c.doorNormalizeMenuOverlay({})._meta };
  store.concMenuBase = JSON.stringify({ _meta: meta, ...local }); // the cutover marker, or the overlay drops the day
  c.doorRecordOverlayCloudDiff({ _meta: meta, ...local }, { _meta: meta, ...cloud });
  return { el, writes };
}

test('5. editor-only differences read as a calm note, with the list, a link to the meal and both choices', () => {
  const { el, writes } = renderCtx({ '1': { MONDAY: HERE } }, { '1': { MONDAY: PUBLISHED } });
  assert.equal(el.style.display, 'block');
  assert.match(el.innerHTML, /editor details/);
  assert.match(el.innerHTML, /Plates, routing and allergens are the same on both computers/);
  assert.doesNotMatch(el.innerHTML, /would replace the other computer/, 'no alarm when nothing staff see differs');
  assert.match(el.innerHTML, /<details[^>]*><summary[^>]*>Show what’s different<\/summary>/);
  assert.match(el.innerHTML, /Wk1 MON · Lunch/);
  assert.match(el.innerHTML, /href="#menu-config\/edit\/1\/MONDAY\/lunch"/);
  assert.match(el.innerHTML, /Main \(Halal Breaded Chicken Burgers\) tag: Chicken/);
  assert.match(el.innerHTML, /Use the published one/);
  assert.match(el.innerHTML, /open the meal in Edit Menu and save it/);
  assert.deepEqual(writes, { set: 0, side: 0 }, 'rendering writes nothing and sends nothing');
});

test('6. a difference staff see keeps the warning (and the P4 wording) and is marked in the list', () => {
  const pub = { ...PUBLISHED, lunch: 'Fish Burgers, Home Fry Potatoes' };
  const { el } = renderCtx({ '1': { MONDAY: HERE } }, { '1': { MONDAY: pub } });
  assert.match(el.innerHTML, /differs from the published menu on 1 day \(Wk1 MON\)/);
  assert.match(el.innerHTML, /Sending from here would replace the other computer’s version/);
  assert.match(el.innerHTML, /editor only/, 'editor-only rows are labelled when mixed with visible ones');
});

test('7. menu text in the list is escaped', () => {
  const evil = { ...HERE, lunch: '<img src=x onerror=alert(1)>' };
  const { el } = renderCtx({ '1': { MONDAY: evil } }, { '1': { MONDAY: PUBLISHED } });
  assert.ok(!el.innerHTML.includes('<img'), 'raw markup never reaches the page');
  assert.ok(el.innerHTML.includes('&lt;img'));
});
