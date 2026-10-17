// tests/vegan_plate_linked_recipe_gate.mjs — the vegan plate reads the recipes its slots are linked to (2026-10-17, v31-standard.29).
// The vegan line's "Falafel Sandwich" (Wk2 TUE lunch, Wk4 MON lunch) matched no CODEX falafel by name, so the
// falafel's Gluten, Spicy and Nightshades never reached the vegan plate; on Wk2 TUE lunch nothing else warned of Spicy
// or Nightshades either. Jason, 2026-10-17: "Rexdale falafel" — both slots link to Rexdale Falafel, shown as before.
// Linking alone changed nothing: computePlatingData read the vegan allergens only from the line's TEXT
// (getVegAltAllergenStr). getVegAltLinkedAllergenStr now adds the allergens of every linked vegan-plate slot (vegan
// alt, starch, veg side, extras), by recipeId, else by name, else the flags captured at link time. It is a floor: it
// only ever adds, and a stored operator statement still wins. The same reading closes Wk3 WED lunch: "Vegan Nachos
// Supreme" is linked to Vegan Nacho Mix, whose Soy, Gluten, Sulphites and Spicy the name lookup missed.
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
const fallbackSrc = between('const DOOR_RECIPE_DATA_FALLBACK', 'let DOOR_RECIPE_DATA =');
const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');

// One context per recipe list. recipeData null = the baked offline fallback (DOOR_RECIPE_DATA unset).
function ctxFor(recipeData) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fallbackSrc + '\n' + fn('flagsToAllergenStr') + fn('getVegAltAllergenStr') + fn('mergeVegAltAllergenFloor')
    + (html.indexOf('function getVegAltLinkedAllergenStr(') >= 0 ? fn('getVegAltLinkedAllergenStr') : '')
    + between('const DOOR_DECLARED_FREE', 'let _LAST_SLOT_FLAGS'), ctx, { filename: 'index.html#vegan-plate-linked', timeout: 4000 });
  if (recipeData) ctx.DOOR_RECIPE_DATA = recipeData;
  return ctx;
}
const has = (ctx, name) => vm.runInContext('typeof ' + name, ctx) === 'function';
const linked = (ctx, slots) => { ctx.__S = slots; return vm.runInContext('getVegAltLinkedAllergenStr(__S)', ctx); };
const CANON = { WHEAT: 'GLUTEN', MILK: 'DAIRY', EGGS: 'EGG' };
const canonSet = (s) => new Set(String(s || '').split(',').map((t) => t.trim().toUpperCase().replace(/\s+/g, ' ')).filter(Boolean).map((t) => CANON[t] || t));
const PROTEINS = ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'hasFish', 'hasShellfish'];

// The vegan plate's allergen line as computePlatingData builds it, before (text lookup + floor) and after (+ linked).
function plates(ctx) {
  const out = {};
  for (const wk of Object.keys(menu)) for (const day of Object.keys(menu[wk])) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const d = menu[wk][day];
    if (!d || !d[period]) continue;
    const veg = d[period + '_veg'] || 'Vegan alternative';
    const safe = { ...(d[period + '_flags'] || {}) };
    PROTEINS.forEach((k) => { safe[k] = false; });
    ctx.__F = safe; ctx.__V = veg; ctx.__S = d[period + '_slots'] || null;
    const r = vm.runInContext(`(() => {
      const lookup = getVegAltAllergenStr(__V);
      const floor = stripDeclaredFreeAllergens(flagsToAllergenStr(__F).toUpperCase(), __V);
      const before = mergeVegAltAllergenFloor(lookup, floor);
      const after = typeof getVegAltLinkedAllergenStr === 'function'
        ? mergeVegAltAllergenFloor(mergeVegAltAllergenFloor(lookup, getVegAltLinkedAllergenStr(__S)), floor) : before;
      return { before, after };
    })()`, ctx);
    out[wk + ' ' + day + ' ' + period] = r;
  }
  return out;
}
const safeOf = (s) => !/EGG|MUSTARD/i.test(s || '');
const FALAFEL_FLAGS = ['hasGluten', 'hasNightshades', 'isSpicy'];

test('a linked vegan-plate slot brings its recipe\'s allergens: by recipeId, else by name, labels by family', () => {
  const ctx = ctxFor([
    { recipeName: 'Rexdale Falafel', recipeId: 'rexdale-falafel', allergens: ['Gluten (Wheat)', 'Nightshades (Cayenne)', 'Spicy (Cayenne)'], stream: 'vegan' },
    { recipeName: 'Chips', allergens: ['None'], stream: 'regular' },
    { recipeName: 'Sesame Slaw', allergens: ['Sesame (Sesame Oil)'], stream: 'regular' },
  ]);
  assert.ok(has(ctx, 'getVegAltLinkedAllergenStr'), 'getVegAltLinkedAllergenStr is defined');
  assert.equal(linked(ctx, { veganalt: { recipeName: 'Renamed Falafel', recipeId: 'rexdale-falafel', displayText: 'Falafel Sandwich', flags: {} } }),
    'GLUTEN, NIGHTSHADES, SPICY', 'recipeId wins over a stale name');
  assert.equal(linked(ctx, { veganalt: { recipeName: 'Rexdale Falafel', flags: {} } }), 'GLUTEN, NIGHTSHADES, SPICY', 'by name without a recipeId');
  assert.equal(linked(ctx, { starch: { recipeName: 'Chips', flags: {} } }), '', '"None" is not an allergen');
  assert.equal(linked(ctx, { veganalt: { recipeName: 'Rexdale Falafel', flags: {} }, vegside: { recipeName: 'Sesame Slaw', flags: {} }, xtra: { recipeName: 'Chips', flags: {} } }),
    'GLUTEN, NIGHTSHADES, SPICY, SESAME', 'vegan alt, veg side and extras all count, each label once');
});

test('typed slots, regular-line slots and nothing at all bring nothing; a recipe the list lost brings its captured flags', () => {
  const ctx = ctxFor([{ recipeName: 'Beef Nacho Mix', allergens: ['Nightshades (Paprika)'], stream: 'regular' }]);
  assert.equal(linked(ctx, null), '');
  assert.equal(linked(ctx, {}), '');
  assert.equal(linked(ctx, { veganalt: { manual: 'Falafel Sandwich', flags: { hasGluten: true } } }), '', 'a typed slot is read by its text, as before');
  assert.equal(linked(ctx, { main: { recipeName: 'Beef Nacho Mix', flags: {} }, softalt: { recipeName: 'Beef Nacho Mix', flags: {} } }), '',
    'the regular line\'s own slots are not on the vegan plate');
  assert.equal(linked(ctx, { veganalt: { recipeName: 'Gone Falafel', recipeId: 'gone', flags: { hasGluten: true, isSpicy: true, hasEgg: false } } }),
    'WHEAT, SPICY', 'not in the list: the flags captured when it was linked');
});

test('computePlatingData merges the linked recipes into the floor; a stored statement still wins outright', () => {
  const body = fn('computePlatingData');
  assert.match(body, /const vegAllergenLinked = typeof getVegAltLinkedAllergenStr !== 'undefined' \? getVegAltLinkedAllergenStr\(dayData\[period \+ '_slots'\]\) : '';/);
  assert.match(body, /const vegAllergenStr = vegAllergenStored\s*\n\s*\|\| mergeVegAltAllergenFloor\(mergeVegAltAllergenFloor\(vegAllergenLookup, vegAllergenLinked\), vegAllergenFallback\)/);
  assert.match(body, /mealFlags\._vegAltSafe = !vegAllergenCheck \|\| \(!\/EGG\/i\.test\(vegAllergenCheck\) && !\/MUSTARD\/i\.test\(vegAllergenCheck\)\);/,
    'the No Egg / No Mustard check reads the merged line');
  assert.ok(html.indexOf('function getVegAltLinkedAllergenStr(') < html.indexOf('function computePlatingData('), 'declared before use');
});

test('the menu links both falafel sandwiches to Rexdale Falafel and shows them as before', () => {
  const t = menu['2'].TUESDAY, m = menu['4'].MONDAY;
  for (const [label, d, ov, shown, veg] of [['Wk2 TUE', t, overlay['2'].TUESDAY, 'Falafel Sandwich', 'Falafel Sandwich, Chips, Fruit Cup'],
    ['Wk4 MON', m, overlay['4'].MONDAY, 'Falafel Sandwich, Sub Bun', 'Falafel  Sandwich, Fruit and Chips, Sub Bun']]) {
    const s = (d.lunch_slots || {}).veganalt || {};
    assert.equal(s.recipeName, 'Rexdale Falafel', label + ' linked');
    assert.equal(s.recipeId, 'rexdale-falafel', label + ' by recipeId');
    assert.equal(s.displayText, shown, label + ' shows what the menu said');
    assert.deepEqual(Object.keys(s.flags || {}).filter((k) => s.flags[k]).sort(), FALAFEL_FLAGS.slice().sort(), label + ' captured flags');
    assert.equal(d.lunch_veg, veg, label + ' vegan line text unchanged');
    assert.deepEqual(ov.lunch_slots.veganalt, s, label + ' the overlay carries the same slot (so a device sync keeps it)');
  }
  assert.ok(overlay._meta.dayEditedAt['2|TUESDAY'] > 1792163622899 && overlay._meta.dayEditedAt['4|MONDAY'] > 1792163622899,
    'both days are stamped newer than the last publish (newest edit wins)');
  // The regular line is not touched: the falafel's flags stay on its slot.
  assert.equal(t.lunch_flags.isSpicy, false); assert.equal(t.lunch_flags.hasNightshades, false);
  assert.equal(m.lunch_flags.isSpicy, false);
  assert.equal(t.lunch_slots.main.recipeName, 'Tuna Salad Sandwich Mix');
  assert.equal(m.lunch_slots.main.manual, 'Chicken Ranch Salad Sandwich');
  assert.equal(m.lunch_slots.xtra.manual, 'Fruit and Chips');
});

function plateCensus(ctx, label) {
  const p = plates(ctx);
  const grew = [], lost = [], safeFlip = [];
  for (const [k, { before, after }] of Object.entries(p)) {
    const b = canonSet(before), a = canonSet(after);
    if ([...b].some((t) => !a.has(t))) lost.push(k);
    if ([...a].some((t) => !b.has(t))) grew.push(k + ': +' + [...a].filter((t) => !b.has(t)).join(','));
    if (safeOf(before) !== safeOf(after)) safeFlip.push(k);
  }
  assert.deepEqual(lost, [], label + ': no plate loses a warning');
  return { p, grew: grew.sort(), safeFlip };
}

test('offline (the baked list): both falafel plates warn Gluten, Nightshades and Spicy; nothing is lost anywhere', () => {
  const { p, grew } = plateCensus(ctxFor(null), 'baked');
  for (const k of ['2 TUESDAY lunch', '4 MONDAY lunch']) {
    const a = canonSet(p[k].after);
    for (const t of ['GLUTEN', 'NIGHTSHADES', 'SPICY']) assert.ok(a.has(t), k + ' carries ' + t + ' (' + p[k].after + ')');
  }
  assert.ok(grew.some((g) => g.startsWith('2 TUESDAY lunch')) && grew.some((g) => g.startsWith('4 MONDAY lunch')), JSON.stringify(grew));
});

test('with the CODEX feed: exactly the two falafel lunches and the Wk3 WED vegan nachos gain warnings, and No Egg routing does not move', () => {
  if (!fs.existsSync(feedPath)) { console.log('SKIP: sibling recipe-hub feed not checked out'); return; }
  const { grew, safeFlip } = plateCensus(ctxFor(JSON.parse(fs.readFileSync(feedPath, 'utf8'))), 'feed');
  const meals = grew.map((g) => g.split(':')[0]);
  assert.deepEqual(meals, ['2 TUESDAY lunch', '3 WEDNESDAY lunch', '4 MONDAY lunch'], JSON.stringify(grew));
  const by = Object.fromEntries(grew.map((g) => [g.split(':')[0], new Set(g.split('+')[1].split(','))]));
  for (const t of ['SPICY']) assert.ok(by['2 TUESDAY lunch'].has(t) && by['4 MONDAY lunch'].has(t), JSON.stringify(grew));
  for (const t of ['SOY', 'GLUTEN', 'SULPHITES', 'SPICY']) assert.ok(by['3 WEDNESDAY lunch'].has(t), 'the vegan nachos carry ' + t + ': ' + JSON.stringify(grew));
  assert.deepEqual(safeFlip, [], 'no meal changes whether No Egg / No Mustard residents can take the vegan plate');
});

test('a fresh tablet\'s one-time alt-flag cleanup takes no tick off either linked lunch', () => {
  // sweepAltFlagPollution runs once per device and drops a meal tick that only an alternative's slot carries. The
  // falafel's Gluten and Nightshades are on the vegan slot, so the regular slots must carry the regular line's ticks
  // (Wk4 MON's typed sandwich slot carries the meal's own ticks), or a fresh tablet would take Gluten off the
  // chicken ranch sandwich lunch.
  const run = (ov) => {
    const ctx = { __OV: JSON.parse(JSON.stringify(ov)) };
    vm.createContext(ctx);
    vm.runInContext(between('const MAIN_SLOT_IDS', 'function sweepAltFlagPollution(') + fn('sweepAltFlagPollution')
      + 'function loadMenuBaseOverlay() { return __OV; } function saveMenuBaseOverlay() {}', ctx);
    return JSON.parse(vm.runInContext('JSON.stringify(sweepAltFlagPollution({ dryRun: true }))', ctx));
  };
  const report = run(overlay);
  const hit = report.details.filter((d) => (d.week === '2' && d.day === 'TUESDAY' && d.period === 'lunch') || (d.week === '4' && d.day === 'MONDAY' && d.period === 'lunch'));
  assert.deepEqual(hit, [], JSON.stringify(hit));
  // The check bites: the same Wk4 MON slots with an untagged sandwich would lose Gluten and Nightshades.
  const bare = JSON.parse(JSON.stringify(overlay));
  bare['4'].MONDAY.lunch_slots.main.flags = {};
  const lost = run(bare).details.find((d) => d.week === '4' && d.day === 'MONDAY' && d.period === 'lunch');
  assert.deepEqual((lost || {}).dropped, ['hasGluten', 'hasNightshades']);
});
