// tests/vegan_plate_dishes_gate.mjs — the vegan plate reads the dishes set on the vegan line (2026-10-17, v31-standard.29).
// DOOR guessed most vegan dishes' allergens from the menu TEXT (getVegAltAllergenStr, a fuzzy name match on vegan-stream
// CODEX recipes): only 6 of the 56 lunches and dinners were linked to a recipe, about half the names matched nothing or
// the wrong recipe, and a linked dish or a tag set in Edit Menu was never read. Six vegan plates made with tofu or vegan
// chik'n didn't say Soy. Jason, 2026-10-17: "Rexdale falafel", then the vegan-dish list (leans, plus: the tenders are
// Gardein — soy and gluten; the black bean patty is Vegan Bean Patties; the chickpea drumstick is Rex's chickpea drums).
// getVegAltSlotAllergenStr reads each vegan-plate slot: its own tags (what the editor preview shows) plus, for a linked
// slot, the recipe's allergens from today's CODEX list. It is a floor — it only ever adds — and a stored statement wins.
// Runs the REAL functions from index.html in a vm. Authored to fail on a295eca (v31-standard.28).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const menu = JSON.parse(fs.readFileSync(path.join(root, 'menu_current.json'), 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync(path.join(root, 'menu_overlay.json'), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const hasReader = html.indexOf('function getVegAltSlotAllergenStr(') >= 0;
const fallbackSrc = between('const DOOR_RECIPE_DATA_FALLBACK', 'let DOOR_RECIPE_DATA =');
const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');

function ctxFor(recipeData) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fallbackSrc + '\n' + fn('flagsToAllergenStr') + fn('getVegAltAllergenStr') + fn('mergeVegAltAllergenFloor')
    + (hasReader ? fn('getVegAltSlotAllergenStr') : '')
    + between('const DOOR_DECLARED_FREE', 'let _LAST_SLOT_FLAGS'), ctx, { filename: 'index.html#vegan-plate-dishes', timeout: 4000 });
  if (recipeData) ctx.DOOR_RECIPE_DATA = recipeData;
  return ctx;
}
const read = (ctx, slots) => { ctx.__S = slots; return vm.runInContext('getVegAltSlotAllergenStr(__S)', ctx); };
const CANON = { WHEAT: 'GLUTEN', MILK: 'DAIRY', EGGS: 'EGG' };
const canonSet = (s) => new Set(String(s || '').split(',').map((t) => t.trim().toUpperCase().replace(/\s+/g, ' ')).filter(Boolean).map((t) => CANON[t] || t));
const PROTEINS = ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'hasFish', 'hasShellfish'];
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
const on = (f) => Object.keys(f || {}).filter((k) => f[k]).sort();

// The vegan plate's allergen line as computePlatingData builds it: before (name guess + floor) and with the slots.
function plates(ctx) {
  const out = {};
  for (const wk of Object.keys(menu)) for (const day of Object.keys(menu[wk])) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const d = menu[wk][day];
    if (!d || !d[period]) continue;
    const safe = { ...(d[period + '_flags'] || {}) };
    PROTEINS.forEach((k) => { safe[k] = false; });
    ctx.__F = safe; ctx.__V = d[period + '_veg'] || 'Vegan alternative'; ctx.__S = d[period + '_slots'] || null;
    out[wk + ' ' + day.slice(0, 3) + ' ' + period] = vm.runInContext(`(() => {
      const lookup = getVegAltAllergenStr(__V);
      const floor = stripDeclaredFreeAllergens(flagsToAllergenStr(__F).toUpperCase(), __V);
      const before = mergeVegAltAllergenFloor(lookup, floor);
      const after = typeof getVegAltSlotAllergenStr === 'function'
        ? mergeVegAltAllergenFloor(mergeVegAltAllergenFloor(lookup, getVegAltSlotAllergenStr(__S)), floor) : before;
      return { before, after };
    })()`, ctx);
  }
  return out;
}

// The confirmed list: week, day, meal → the CODEX recipe the vegan dish links to, or the tags it carries.
// Re-pinned 2026-10-30 (Mat's Rexdale changes): Wk2 FRI lunch (CONC Salad → Beef Chili) and Wk3 SUN dinner (meatballs →
// Bolognese) leave the list; their vegan batches come from the same pot and have no CODEX recipe yet.
const LINKS = [
  ['1', 'MONDAY', 'lunch', 'Quinoa Cakes'], ['1', 'TUESDAY', 'dinner', 'Vegan Carnitas'], ['1', 'WEDNESDAY', 'lunch', 'Vegan Drumstick'],
  ['1', 'WEDNESDAY', 'dinner', 'Butter Chickpeas'], ['1', 'THURSDAY', 'lunch', 'Vegan Sausage'], ['1', 'THURSDAY', 'dinner', 'Roast Tofu'],
  ['1', 'FRIDAY', 'lunch', 'Vegan Drumstick'], ['1', 'FRIDAY', 'dinner', 'Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)'],
  ['1', 'SATURDAY', 'lunch', 'Vegan Fajitas'], ['1', 'SATURDAY', 'dinner', 'Vegan Gomen Be Siga'],
  ['2', 'SUNDAY', 'dinner', 'Sausage and Greens Pasta Sauce (Pork, Halal Chicken + Vegan)'], ['2', 'MONDAY', 'lunch', 'Vegan Gyro'],
  ['2', 'MONDAY', 'dinner', 'African Peanut Chicken Stew'], ['2', 'TUESDAY', 'lunch', 'Rexdale Falafel'], ['2', 'TUESDAY', 'dinner', 'Vegan Vindaloo'],
  ['2', 'THURSDAY', 'lunch', 'Veggie Burger (Black Bean)'], ['2', 'THURSDAY', 'dinner', 'Vegan Sausage'],
  ['2', 'FRIDAY', 'dinner', 'Arroz Con Pollo (Regular + Vegan)'], ['2', 'SATURDAY', 'dinner', 'Vegan Meatloaf'],
  ['3', 'TUESDAY', 'lunch', 'Tofu and Potato Hash'], ['3', 'TUESDAY', 'dinner', 'Caribbean Stew with Sweet Potato and Collard Greens'],
  ['3', 'WEDNESDAY', 'lunch', 'Vegan Nacho Mix'], ['3', 'WEDNESDAY', 'dinner', 'Baked Tomato Tofu'], ['3', 'FRIDAY', 'lunch', 'Nigerian Pepper Stew Tofu'],
  ['3', 'FRIDAY', 'dinner', 'Soy-Free Mushroom Fried Rice'], ['3', 'SATURDAY', 'lunch', 'Roast Tofu'], ['4', 'SUNDAY', 'lunch', 'Vegan Bean Patties'],
  ['4', 'SUNDAY', 'dinner', 'White Chicken & Chickpea Chili'], ['4', 'MONDAY', 'lunch', 'Rexdale Falafel'], ['4', 'MONDAY', 'dinner', 'Vegan Thai Green Curry Sauce'],
  ['4', 'TUESDAY', 'lunch', 'Vegan Taco (al pastor)'], ['4', 'WEDNESDAY', 'dinner', 'Vegan  Pie Filling'], ['4', 'THURSDAY', 'lunch', 'Veggie Burger (Black Bean)'],
  ['4', 'THURSDAY', 'dinner', 'Teriyaki Tofu'], ['4', 'FRIDAY', 'lunch', 'Vegan Lasagna Sauce'],
  ['4', 'SATURDAY', 'dinner', 'Massaman Beef Curry with Baby Corn and Vegetables'],
];
const TAGS = [
  ['1', 'MONDAY', 'dinner', ['hasSoy']], ['2', 'WEDNESDAY', 'lunch', ['hasSoy', 'hasGluten']], ['2', 'WEDNESDAY', 'dinner', ['hasSoy']],
  ['2', 'SATURDAY', 'lunch', ['hasSoy', 'hasGluten']], ['3', 'MONDAY', 'dinner', ['hasMushroom']], ['3', 'THURSDAY', 'lunch', ['hasSoy']],
  ['3', 'THURSDAY', 'dinner', ['hasSoy']], ['4', 'TUESDAY', 'dinner', ['hasSoy', 'hasGluten']], ['4', 'FRIDAY', 'dinner', ['hasSoy']],
  ['4', 'SATURDAY', 'lunch', ['hasSoy']],
];

test('a vegan-plate slot brings its tags, and a linked slot also brings its recipe from the CODEX list', () => {
  assert.ok(hasReader, 'getVegAltSlotAllergenStr is defined');
  const ctx = ctxFor([
    { recipeName: 'Rexdale Falafel', recipeId: 'rexdale-falafel', allergens: ['Gluten (Wheat)', 'Nightshades (Cayenne)', 'Spicy (Cayenne)'], stream: 'vegan' },
    { recipeName: 'Chips', allergens: ['None'], stream: 'regular' },
  ]);
  assert.equal(read(ctx, { veganalt: { recipeName: 'Old Falafel Name', recipeId: 'rexdale-falafel', flags: {} } }), 'GLUTEN, NIGHTSHADES, SPICY', 'recipeId wins over a stale name');
  assert.equal(read(ctx, { veganalt: { recipeName: 'Rexdale Falafel', flags: {} } }), 'GLUTEN, NIGHTSHADES, SPICY', 'by name without a recipeId');
  assert.equal(read(ctx, { starch: { recipeName: 'Chips', flags: {} } }), '', '"None" is not an allergen');
  assert.equal(read(ctx, { veganalt: { manual: 'Citrus Tofu', flags: { hasSoy: true } } }), 'SOY', 'a typed dish brings its Edit Menu tags');
  assert.equal(read(ctx, { veganalt: { recipeName: 'Rexdale Falafel', flags: { hasMushroom: true } } }), 'MUSHROOM, GLUTEN, NIGHTSHADES, SPICY',
    'a linked dish keeps its own tags beside the recipe');
  assert.equal(read(ctx, { veganalt: { recipeName: 'Gone', recipeId: 'gone', flags: { hasGluten: true, isSpicy: true } } }), 'WHEAT, SPICY',
    'a recipe the list lost: the flags captured when it was linked');
});

test('the regular line\'s own slots, empty slots and nothing at all bring nothing', () => {
  const ctx = ctxFor([{ recipeName: 'Beef Nacho Mix', allergens: ['Nightshades (Paprika)'], stream: 'regular' }]);
  assert.equal(read(ctx, null), '');
  assert.equal(read(ctx, {}), '');
  assert.equal(read(ctx, { veganalt: { manual: 'Spiced Tofu', flags: {} } }), '', 'a typed dish with no tag is read by its text, as before');
  assert.equal(read(ctx, { main: { recipeName: 'Beef Nacho Mix', flags: { hasDairy: true } }, mainalt: { manual: 'x', flags: { hasEgg: true } } }), '');
});

test('computePlatingData merges the vegan line\'s slots into the floor; a stored statement still wins outright', () => {
  const body = fn('computePlatingData');
  assert.match(body, /const vegAllergenSlots = typeof getVegAltSlotAllergenStr !== 'undefined' \? getVegAltSlotAllergenStr\(dayData\[period \+ '_slots'\]\) : '';/);
  assert.match(body, /const vegAllergenStr = vegAllergenStored\s*\n\s*\|\| mergeVegAltAllergenFloor\(mergeVegAltAllergenFloor\(vegAllergenLookup, vegAllergenSlots\), vegAllergenFallback\)/);
  assert.match(body, /mealFlags\._vegAltSafe = !vegAllergenCheck \|\| \(!\/EGG\/i\.test\(vegAllergenCheck\) && !\/MUSTARD\/i\.test\(vegAllergenCheck\)\);/);
  assert.ok(html.indexOf('function getVegAltSlotAllergenStr(') < html.indexOf('function computePlatingData('), 'declared before use');
});

test('the menu links each confirmed vegan dish to its recipe and still shows what the menu said', () => {
  for (const [wk, day, period, recipe] of LINKS) {
    const d = menu[wk][day]; const label = `Wk${wk} ${day} ${period}`;
    const v = ((d[period + '_slots'] || {}).veganalt) || {};
    assert.equal(v.recipeName, recipe, label + ' links to ' + recipe);
    const shown = v.displayText || v.recipeName;
    // What the editor shows for the dish is the menu's own words (its reading of the vegan line can keep a side with it).
    assert.ok(String(shown).split(',').every((part) => norm(d[period + '_veg']).includes(norm(part))), label + ' shows "' + shown + '" from "' + d[period + '_veg'] + '"');
    const o = overlay[wk] && overlay[wk][day] && overlay[wk][day][period + '_slots'];
    assert.deepEqual(o && o.veganalt, v, label + ' the overlay carries the same slot');
  }
});

test('dishes with no CODEX recipe carry their tags: Soy on the tofu dishes, Soy and Gluten on the Gardein tenders', () => {
  for (const [wk, day, period, flags] of TAGS) {
    const v = ((menu[wk][day][period + '_slots'] || {}).veganalt) || {};
    const label = `Wk${wk} ${day} ${period} (${v.manual})`;
    assert.ok(v.manual && !v.recipeName, label + ' stays a typed dish');
    flags.forEach((f) => assert.equal(v.flags && v.flags[f], true, label + ' carries ' + f));
  }
});

test('a meal that gets dish slots for the first time keeps its ticks on its regular dish (a fresh tablet\'s sweep takes nothing)', () => {
  const ctx = { __OV: JSON.parse(JSON.stringify(overlay)) };
  vm.createContext(ctx);
  vm.runInContext(between('const MAIN_SLOT_IDS', 'function sweepAltFlagPollution(') + fn('sweepAltFlagPollution')
    + 'function loadMenuBaseOverlay() { return __OV; } function saveMenuBaseOverlay() {}', ctx);
  const report = JSON.parse(vm.runInContext('JSON.stringify(sweepAltFlagPollution({ dryRun: true }))', ctx));
  // Before this change one meal was exposed (Wk4 FRI dinner: a fresh tablet dropped Chicken); it is one of the meals
  // touched here, so its ticks now ride on its regular dish too.
  assert.deepEqual(report.details, [], JSON.stringify(report.details));
  for (const [wk, day, period] of LINKS.concat(TAGS)) {
    const d = menu[wk][day]; const s = d[period + '_slots'] || {};
    on(d[period + '_flags']).forEach((f) => {
      const onRegular = ['main', 'starch', 'vegside', 'xtra', 'extras'].some((id) => s[id] && s[id].flags && s[id].flags[f]);
      if (!onRegular) assert.notEqual(((s.veganalt || {}).flags || {})[f], true, `Wk${wk} ${day} ${period}: ${f} is a meal tick no regular dish carries but the vegan dish does`);
    });
  }
});

function census(ctx) {
  const p = plates(ctx);
  const lost = [], flips = [];
  for (const [k, { before, after }] of Object.entries(p)) {
    const b = canonSet(before), a = canonSet(after);
    if ([...b].some((t) => !a.has(t))) lost.push(k);
    if (/EGG|MUSTARD/i.test(before) !== /EGG|MUSTARD/i.test(after)) flips.push(k);
  }
  assert.deepEqual(lost, [], 'no plate loses a warning');
  assert.deepEqual(flips, [], 'no meal changes whether No Egg / No Mustard residents can take the vegan plate');
  return p;
}
const has = (p, k, toks) => toks.every((t) => canonSet(p[k].after).has(t));

test('offline (the baked list): the tofu and Gardein plates say Soy, the tenders say Gluten, the falafel says Spicy', () => {
  const p = census(ctxFor(null));
  for (const k of ['1 MON dinner', '2 WED dinner', '3 THU lunch', '3 THU dinner', '4 FRI dinner', '4 SAT lunch']) assert.ok(has(p, k, ['SOY']), k + ': ' + p[k].after);
  for (const k of ['2 WED lunch', '2 SAT lunch', '4 TUE dinner']) assert.ok(has(p, k, ['SOY', 'GLUTEN']), k + ': ' + p[k].after);
  for (const k of ['2 TUE lunch', '4 MON lunch']) assert.ok(has(p, k, ['GLUTEN', 'NIGHTSHADES', 'SPICY']), k + ': ' + p[k].after);
  assert.ok(has(p, '3 MON dinner', ['MUSHROOM']), 'the portobello plate says Mushroom');
});

test('with the CODEX feed: each linked recipe\'s allergens reach its plate', () => {
  if (!fs.existsSync(feedPath)) { console.log('SKIP: sibling recipe-hub feed not checked out'); return; }
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  const p = census(ctxFor(feed));
  const byName = Object.fromEntries(feed.map((r) => [r.recipeName, r]));
  const fam = (a) => { const t = String(a).split('(')[0].trim().toUpperCase(); return CANON[t] || t; };
  for (const [wk, day, period, recipe] of LINKS) {
    const k = wk + ' ' + day.slice(0, 3) + ' ' + period;
    const want = (byName[recipe].allergens || []).filter((a) => a && a !== 'None').map(fam);
    assert.ok(want.every((t) => canonSet(p[k].after).has(t)), k + ' carries ' + recipe + "'s " + want.join(',') + ': ' + p[k].after);
  }
  assert.ok(has(p, '3 WED lunch', ['SOY', 'GLUTEN', 'SULPHITES', 'SPICY']), 'the vegan nachos carry Vegan Nacho Mix');
  assert.ok(has(p, '1 SAT lunch', ['SOY', 'SPICY']), 'Vegetarian Fajitas carry Vegan Fajitas');
  assert.ok(has(p, '4 FRI lunch', ['SOY', 'SULPHITES']), 'Veggie lasagna carries Vegan Lasagna Sauce');
});
