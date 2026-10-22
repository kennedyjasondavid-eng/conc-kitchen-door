// tests/w1b_safe_side_ticks_gate.mjs — DOOR's meal ticks follow CODEX's safe-side allergens (W1b, 2026-10-22).
//
// DOOR checks residents against each meal's own ticks (`<period>_flags` in menu_current.json), not against CODEX's feed.
// CODEX v29 (W1, conc-recipe-hub #179; Jason, 2026-10-21: "add Sulphites to all 29 now (safe side), naming the juice";
// "safe side now") gave Library recipes Sulphites (bottled lemon / lime juice, molasses) and Nightshades (bought BBQ
// sauce, lemon-pepper seasoning), and v30 (ruled 2026-10-22) gives Sulphites to the five recipes with raisins or dried
// cranberries. The meals that serve those dishes need the matching tick. It only ever adds a warning.
//
// Which plate a tick belongs to — the precedent (#121, a295eca; #135, the plating review): a meal's ticks are its
// regular plate: the regular line, the sides it shares with the other lines, and the halal dish. The vegan plate reads
// its own dishes (getVegAltSlotAllergenStr, v31-standard.29: a linked slot brings its recipe's allergens from today's
// CODEX list; getVegAltAllergenStr reads the vegan line by name), so a dish only the vegan line serves reaches the
// vegan plate without a meal tick, and a fresh tablet's sweepAltFlagPollution would take such a tick off a regular plate
// that no regular dish carries it on. Each tick here is written as #121 and #135 wrote theirs: through DOOR's own menu
// save (saveMenuBaseOverlay, the day stamped so the newest edit wins on every computer), on the meal's ticks and its
// main dish (Edit Menu's convention: the main dish carries the meal's ticks), then rebuilt with the publish builders.
//
// The checks:
//   1. every W1b tick is on its meal while the dish is still there, the main dish carries it, the allergen line names it;
//   2. the overlay every DOOR computer merges carries each tick, and its day is stamped after 2026-10-19's edit;
//   3. the meals that already tick these dishes' families keep them (Honey BBQ, the Griots, the souvlaki's tzatziki…);
//   4. nothing else moves: with the W1b ticks put back, every day of menu_current.json and menu_overlay.json is 1c2756c's
//      (a day edited in DOOR since is not checked);
//   5. a fresh tablet's sweep takes none of them off;
//   6. the ticks move no resident: DOOR's plating engine seats everyone where it seats them without the ticks, and only
//      a plate line's ticked family or a note naming it may differ;
//   7. with CODEX's feed beside this repo: each tick's recipe lists the family, and the dishes only the vegan line serves
//      reach the vegan plate through its own reader;
//   8. the published set is one valid publish (Stop 0, Review 0; routing, state and summary built from this menu).
// Authored to fail on main 1c2756c (checks 1 and 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const menuArtifact = read('menu_current.json');
const menu = menuArtifact.menu;
const overlay = read('menu_overlay.json');
const state = read('door_state.json');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const fnOpt = (name) => (html.includes('function ' + name + '(') ? fn(name) : '');
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// DOOR's own code: the publish-validation core (doorContentHash, validateDoorPublishArtifacts) and the allergen line.
const core = {};
vm.createContext(core);
vm.runInContext(between('/* DOOR_TESTABLE_CORE_START publish-validation */', '/* DOOR_TESTABLE_CORE_END publish-validation */')
  + '\n' + fn('flagsToMenuAllergens'), core, { filename: 'index.html#w1b-core', timeout: 4000 });

// The ticks W1b adds (red on 1c2756c). recipe: the CODEX recipe the family comes from; how: how the meal names the dish.
// mainLacksKey: the main dish's flags had no hasSulphites key at 1c2756c (so putting the tick back deletes it).
const TICKS = [
  { wk: '1', day: 'FRIDAY', period: 'lunch', flag: 'hasSulphites', dish: 'Potato Salad', ruling: 'v29',
    recipe: 'Potato Salad (for Honey BBQ Drums)', how: 'by name: the side both lines share, beside the Honey BBQ drumsticks' },
  { wk: '2', day: 'MONDAY', period: 'lunch', flag: 'hasSulphites', dish: 'Chicken Gyro', ruling: 'v29',
    recipe: 'Tzatziki Sauce', how: 'judgement: CODEX lists "Milk (Tzatziki)" on Chicken Gyro, and the meal ticks its Dairy' },
  { wk: '2', day: 'TUESDAY', period: 'lunch', flag: 'hasSulphites', dish: 'Tuna Salad Sandwich Mix', ruling: 'v29',
    recipe: 'Tuna Salad Sandwich Mix', how: 'linked by name (the main dish)' },
  { wk: '2', day: 'FRIDAY', period: 'dinner', flag: 'hasSulphites', dish: 'Refried Beans', ruling: 'v29',
    recipe: 'Refried Beans', how: 'by name: the side both lines share' },
  { wk: '4', day: 'MONDAY', period: 'dinner', flag: 'hasSulphites', dish: 'Fish Curry', ruling: 'v29',
    recipe: 'Vegan Thai Green Curry Sauce', how: 'ruled 2026-10-16 (#121): the Fish Curry is fish with the green curry sauce' },
  { wk: '4', day: 'WEDNESDAY', period: 'lunch', flag: 'hasSulphites', dish: 'Tuna Rex Salad', ruling: 'v29',
    recipe: 'Rex Tuna Salad Mix', how: 'by name (no dish slots)' },
  { wk: '4', day: 'FRIDAY', period: 'dinner', flag: 'hasSulphites', dish: 'Tandoori Pork', ruling: 'v29', mainLacksKey: true,
    recipe: 'CONC Tandoori Marinade', how: 'by name: the one tandoori marinade, for the pork, the halal chicken and the tofu' },
  ...['1', '2', '3', '4'].map((wk) => ({ wk, day: 'SATURDAY', period: 'breakfast', flag: 'hasSulphites', dish: 'Granola', ruling: 'v30',
    recipe: 'Granola', how: 'judgement: by name, on both lines (no dish slots); the Library\'s Granola, not a bought one' })),
];

// The meals that already tick a family these dishes carry: they stay on while the dish is there (pass on 1c2756c).
const HELD = [
  ['1', 'FRIDAY', 'lunch', 'hasNightshades', 'Honey BBQ', 'Honey BBQ Sauce (v29: Nightshades)'],
  ['3', 'THURSDAY', 'dinner', 'hasSulphites', 'Pork Griot', 'Griot Marinade, Epis (v29 relabel); Citrus Tofu on the vegan line'],
  ['3', 'THURSDAY', 'dinner', 'hasNightshades', 'Pork Griot', 'Epis'],
  ['3', 'THURSDAY', 'dinner', 'isSpicy', 'Pork Griot', 'Epis'],
  ['3', 'FRIDAY', 'lunch', 'hasSulphites', 'Lime Coconut Rice', 'Lime and Coconut Rice (v29)'],
  ['4', 'SUNDAY', 'lunch', 'hasSulphites', 'Tzatziki', 'Tzatziki Sauce (v29), Souvlaki Marinade (v29)'],
  ['4', 'SUNDAY', 'dinner', 'hasSulphites', 'White Chilli Chicken', 'White Chicken & Chickpea Chili (v29)'],
  ['4', 'SATURDAY', 'dinner', 'hasSulphites', 'Beef Massaman Curry', 'Massaman Beef Curry, Massaman Curry Paste (v29)'],
  ['2', 'FRIDAY', 'lunch', 'hasGluten', 'naan', 'the naan (v29 gave Beef CONC Salad Mix Gluten; v30 takes it off; the meal keeps it)'],
];

// Dishes only the vegan line serves: no meal tick (the regular plate doesn't serve them); the vegan plate's own reader
// brings the family from CODEX's feed. [week, day, period, the vegan dish, its recipe, how]
const VEGAN_PLATE = [
  ['1', 'MONDAY', 'lunch', 'Crispy Quinoa Cake Burger', 'Quinoa Cakes', 'linked'],
  ['4', 'WEDNESDAY', 'dinner', 'Vegan Pot Pie', 'Vegan  Pie Filling', 'linked'],
  ['4', 'MONDAY', 'dinner', 'Tofu Curry', 'Vegan Thai Green Curry Sauce', 'linked'],
  ...[['1', 'SUNDAY'], ['1', 'MONDAY'], ['2', 'SUNDAY'], ['2', 'MONDAY'], ['3', 'SUNDAY'], ['3', 'MONDAY'], ['4', 'SUNDAY'], ['4', 'MONDAY']]
    .map(([wk, day]) => [wk, day, 'breakfast', 'Vegan Breakfast', 'Breakfast Vegan Patty', 'by name']),
];

const WORD = { hasSulphites: 'sulphites' };            // the allergen line prints only these of the ticked families
const BASE_STAMP = 1792415770014;                      // every overlay day's stamp at 1c2756c (2026-10-19T13:16:10Z)
const servesDish = (d, period, dish) => [d[period], d[period + '_sides'], d[period + '_veg']].some((t) => norm(t).includes(norm(dish)));
const ticksOn = (wk, day) => TICKS.filter((t) => t.wk === wk && t.day === day);

// Put the W1b ticks back: the meal's flag off, the main dish's as it was at 1c2756c, the allergen line rebuilt from the
// ticks (buildMenuJSON writes it so; in the overlay only where the day carries one).
function putBack(day, wk, dayName) {
  const d = clone(day);
  for (const t of ticksOn(wk, dayName)) {
    const flags = d[t.period + '_flags'];
    if (flags) flags[t.flag] = false;
    const main = d[t.period + '_slots'] && d[t.period + '_slots'].main;
    if (main && main.flags) { if (t.mainLacksKey) delete main.flags[t.flag]; else main.flags[t.flag] = false; }
    if (flags && Object.prototype.hasOwnProperty.call(d, 'allergens_' + t.period)) d['allergens_' + t.period] = core.flagsToMenuAllergens(flags);
  }
  return d;
}
function putBackMenu(m) {
  const out = {};
  for (const wk of Object.keys(m)) { out[wk] = {}; for (const day of Object.keys(m[wk])) out[wk][day] = putBack(m[wk][day], wk, day); }
  return out;
}
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
function dayDigests(weeks) {
  const out = {};
  for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) {
    if (weeks[wk] && weeks[wk][day]) out[wk + '|' + day] = core.doorContentHash(putBack(weeks[wk][day], wk, day));
  }
  return out;
}
// 1c2756c's days (menu_current.json and menu_overlay.json), each read as dayDigests reads it. Printed on 1c2756c with
// W1B_PRINT_DIGESTS=1 (re-pin them, with a dated note, only for a menu change a ruling makes).
if (process.env.W1B_PRINT_DIGESTS) console.log(JSON.stringify({ menu: dayDigests(menu), overlay: dayDigests(overlay) }));
const BASE_MENU = {"1|SUNDAY":"18ndmyl","1|MONDAY":"104mz9c","1|TUESDAY":"19kkyey","1|WEDNESDAY":"1u7i180","1|THURSDAY":"1oy14i1","1|FRIDAY":"ksxdvk","1|SATURDAY":"11sf6me","2|SUNDAY":"na5ld9","2|MONDAY":"1sppph0","2|TUESDAY":"11wv92c","2|WEDNESDAY":"1b2zd2h","2|THURSDAY":"f9au6q","2|FRIDAY":"ab65vq","2|SATURDAY":"liwhm9","3|SUNDAY":"1fz9c5k","3|MONDAY":"d4e9wl","3|TUESDAY":"yppxlp","3|WEDNESDAY":"ojflui","3|THURSDAY":"qvo0m1","3|FRIDAY":"1wi8t7w","3|SATURDAY":"u04dga","4|SUNDAY":"1vybib1","4|MONDAY":"1ax174z","4|TUESDAY":"lm1th6","4|WEDNESDAY":"1secppu","4|THURSDAY":"3ladbb","4|FRIDAY":"y1jn1b","4|SATURDAY":"3i67ma"};
const BASE_OVERLAY = {"1|SUNDAY":"1ubyc88","1|MONDAY":"1flvb5w","1|TUESDAY":"eipwo0","1|WEDNESDAY":"1u7i180","1|THURSDAY":"2ttipt","1|FRIDAY":"ksxdvk","1|SATURDAY":"e70gb5","2|SUNDAY":"1lajpfg","2|MONDAY":"1sppph0","2|TUESDAY":"1mss2y3","2|WEDNESDAY":"meqo50","2|THURSDAY":"hj1rq8","2|FRIDAY":"u041w8","2|SATURDAY":"liwhm9","3|SUNDAY":"1fz9c5k","3|MONDAY":"d4e9wl","3|TUESDAY":"y3qdk2","3|WEDNESDAY":"4v91pd","3|THURSDAY":"qvo0m1","3|FRIDAY":"1wi8t7w","3|SATURDAY":"u04dga","4|SUNDAY":"1rk1emw","4|MONDAY":"1ax174z","4|TUESDAY":"12i4yun","4|WEDNESDAY":"1secppu","4|THURSDAY":"3ladbb","4|FRIDAY":"y0ufgq","4|SATURDAY":"gccbgd"};

test('every W1b tick is on its meal while the dish is still there, on the main dish too, and its allergen line names it', () => {
  const missing = [];
  let checked = 0;
  for (const t of TICKS) {
    const d = (menu[t.wk] || {})[t.day];
    if (!d || !servesDish(d, t.period, t.dish)) continue;   // the dish changed; its tick went with it
    checked++;
    const where = `W${t.wk} ${t.day} ${t.period} (${t.dish} — ${t.recipe})`;
    if (!(d[t.period + '_flags'] || {})[t.flag]) missing.push(where + ': ' + t.flag);
    const main = d[t.period + '_slots'] && d[t.period + '_slots'].main;
    if (main && !(main.flags || {})[t.flag]) missing.push(where + ': the main dish carries ' + t.flag);
    const word = WORD[t.flag];
    if (word && !new RegExp('\\b' + word + '\\b', 'i').test(String(d['allergens_' + t.period] || ''))) missing.push(where + ': its allergen line names ' + word);
  }
  assert.ok(checked >= 9, 'the published menu still serves most of these dishes (' + checked + ' of ' + TICKS.length + ')');
  assert.deepEqual(missing, []);
});

test('the overlay every DOOR computer merges carries each tick, and each day was saved after 2026-10-19 (newest edit wins)', () => {
  const missing = [];
  const stamps = (overlay._meta && overlay._meta.dayEditedAt) || {};
  for (const t of TICKS) {
    const od = (overlay[t.wk] || {})[t.day];
    const d = (menu[t.wk] || {})[t.day];
    if (!od || !d || !servesDish(d, t.period, t.dish)) continue;
    const where = `overlay W${t.wk} ${t.day} ${t.period} (${t.dish})`;
    if (od[t.period + '_flags'] && !od[t.period + '_flags'][t.flag]) missing.push(where + ': ' + t.flag);
    const main = od[t.period + '_slots'] && od[t.period + '_slots'].main;
    if (main && !(main.flags || {})[t.flag]) missing.push(where + ': the main dish carries ' + t.flag);
    const word = WORD[t.flag];
    if (word && typeof od['allergens_' + t.period] === 'string' && !new RegExp('\\b' + word + '\\b', 'i').test(od['allergens_' + t.period])) missing.push(where + ': its allergen line names ' + word);
    if (!(Number(stamps[t.wk + '|' + t.day]) > BASE_STAMP)) missing.push(where + ': the day is stamped after ' + new Date(BASE_STAMP).toISOString());
  }
  assert.deepEqual(missing, []);
});

test('the meals that already tick these dishes\' families keep them while the dish is there', () => {
  const missing = [];
  let checked = 0;
  for (const [wk, day, period, flag, dish, why] of HELD) {
    const d = (menu[wk] || {})[day];
    if (!d || !servesDish(d, period, dish)) continue;
    checked++;
    if (!(d[period + '_flags'] || {})[flag]) missing.push(`W${wk} ${day} ${period} (${dish} — ${why}): ${flag}`);
  }
  assert.ok(checked >= 7, 'most still apply: ' + checked);
  assert.deepEqual(missing, []);
});

test('nothing else moves: with the W1b ticks put back, every day of the menu and the overlay is 1c2756c\'s', () => {
  // A day edited in DOOR after the W1b save carries a newer stamp and is not checked. The W1b save is the one stamp the
  // ticked days share (saveMenuBaseOverlay stamps every day it changes with one time).
  // Pinned 2026-10-22 (PR #139 review P3-2): it was guessed as the most common stamp among the ticked days, so a later
  // save that re-stamped six or more of them would have checked the wrong days. The W1b save is 2026-10-22T11:09:35.478Z.
  const stamps = (overlay._meta && overlay._meta.dayEditedAt) || {};
  const W1B_STAMP = 1792667375478;
  const unedited = (k) => { const s = Number(stamps[k]); return s === BASE_STAMP || s === W1B_STAMP; };
  const moved = [], skipped = [];
  for (const [what, weeks, base] of [['menu_current.json', menu, BASE_MENU], ['menu_overlay.json', overlay, BASE_OVERLAY]]) {
    const now = dayDigests(weeks);
    for (const k of new Set([...Object.keys(base), ...Object.keys(now)])) {
      if (!unedited(k)) { skipped.push(k); continue; }
      if (now[k] !== base[k]) moved.push(what + ' ' + k);
    }
  }
  if (skipped.length) console.log('# w1b: days edited in DOOR since the W1b save, not checked: ' + [...new Set(skipped)].join(', '));
  assert.deepEqual(moved, [], 'a day changed beyond its W1b ticks');
});

test('a fresh tablet\'s one-time sweep takes none of the ticks off (they ride on the regular dish)', () => {
  const ctx = { __OV: clone(overlay) };
  vm.createContext(ctx);
  vm.runInContext(between('const MAIN_SLOT_IDS', 'function sweepAltFlagPollution(') + fn('sweepAltFlagPollution')
    + 'function loadMenuBaseOverlay() { return __OV; } function saveMenuBaseOverlay() {}', ctx);
  const report = JSON.parse(vm.runInContext('JSON.stringify(sweepAltFlagPollution({ dryRun: true }))', ctx));
  const hits = report.details.filter((r) => TICKS.some((t) => t.wk === r.week && t.day === r.day && t.period === r.period && r.dropped.includes(t.flag)));
  assert.deepEqual(hits, []);
});

// DOOR's plating engine (computePlatingData, its line notes and plate lines), as tests/routing_replay_gate.mjs runs it,
// over every published meal with the published residents. feed: CODEX's list, or the baked list DOOR falls back to.
function engine(weeks, feed) {
  const TAG_LABELS = html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0];
  const c = { console, REGISTRY_LIST: state.residents.map((r) => ({ ...r })), anaphRooms: [...state.anaphRooms], DOOR_RECIPE_DATA: feed || null,
    getMenuData: () => weeks, loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}) };
  vm.createContext(c);
  vm.runInContext([
    TAG_LABELS, lineOf('const DOOR_RECIPE_DATA_FALLBACK = '),
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
    between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    fn('formatConflictNote'), fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fn('getAnaphConflictRooms'),
    between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', fn('flagsToAllergenStr'), fn('emptyMealFlags'), fn('hasCarbAccommodation'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between('const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'),
    fn('getSundayStart'), fn('nextDateForSlot'), fnOpt('doorRotationWeekOf'), fnOpt('doorDateKey'), fnOpt('doorDatedMealFlags'),
    fnOpt('doorDatedMealFor'), fnOpt('doorApplyDatedMeal'),
    between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fnOpt('doorAllergenStrFlags'), fnOpt('doorSectionLineNotes'), fnOpt('doorSectionAllergenStr'),
    'if (typeof doorDatedMealFor !== "function") this.doorDatedMealFor = () => null;',
    html.includes('const DOOR_KITCHEN_ALT_FIELDS = ') ? lineOf('const DOOR_KITCHEN_ALT_FIELDS = ') : '',
    html.includes('const DOOR_DISH_PART_EMPTY = ') ? between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n' : '',
    fnOpt('doorKitchenAlternatives'), fnOpt('doorAddKitchenPlateFlags'), fnOpt('doorRegularServiceNote'),
    fn('computePlatingData'),
  ].join('\n'), c, { filename: 'index.html#w1b-engine', timeout: 30000 });
  const byRoom = Object.fromEntries(state.residents.map((r) => [r.room, r]));
  const out = {};
  for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const pd = c.computePlatingData(period, wk, day);
    if (!pd) continue;
    const seat = {}, notes = {};
    pd.anaphSect.forEach((r) => { seat[r.room] = 'anaph'; });
    pd.sections.forEach((s) => s.residents.forEach((r) => {
      seat[r.room] = s.rule.key;
      if (s.rule.key !== 'regular') notes[r.room] = c.doorSectionLineNotes(byRoom[r.room], s, pd.mealFlags, c.doorSectionAllergenStr(s, pd));
    }));
    (pd.regularNotes || []).forEach((n) => { notes[n.room] = [n.conflictNote, n.serviceNote].filter(Boolean).join(' · '); });
    out[wk + '|' + day + '|' + period] = { seat, notes, veg: pd.vegAllergenStr || '', halal: (pd.ctx && pd.ctx.halalAllergenStr) || '' };
  }
  return { out, conflictMap: vm.runInContext('CONFLICT_MAP', c) };
}
const tokens = (s) => new Set(String(s || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean));
const FAMILY_TOKEN = { hasSulphites: 'SULPHITES', hasNightshades: 'NIGHTSHADES', isSpicy: 'SPICY', hasGluten: 'GLUTEN' };

test('the ticks move no resident: every plate, line and note is as it is without them, but for the ticked family', () => {
  const now = engine(menu), without = engine(putBackMenu(menu));
  const bad = [];
  let meals = 0;
  for (const k of Object.keys(without.out)) {
    meals++;
    const a = without.out[k], b = now.out[k];
    const [wk, day, period] = k.split('|');
    const flags = TICKS.filter((t) => t.wk === wk && t.day === day && t.period === period).map((t) => t.flag);
    const famNotes = new Set(now.conflictMap.filter((m) => flags.includes(m.mealFlag)).map((m) => m.note));
    const famTokens = new Set(flags.map((f) => FAMILY_TOKEN[f]));
    for (const room of Object.keys(a.seat)) {
      // a resident anaphylactic to a ticked family would be contained: the one move a tick may make
      if (b.seat[room] !== a.seat[room] && b.seat[room] !== 'anaph') bad.push(`${k} ${room}: ${a.seat[room]} → ${b.seat[room]}`);
    }
    for (const room of new Set([...Object.keys(a.notes), ...Object.keys(b.notes)])) {
      const before = new Set(String(a.notes[room] || '').split(/ · |, /).filter(Boolean));
      const after = new Set(String(b.notes[room] || '').split(/ · |, /).filter(Boolean));
      const lost = [...before].filter((n) => !after.has(n)), added = [...after].filter((n) => !before.has(n) && !famNotes.has(n));
      if (lost.length || added.length) bad.push(`${k} ${room} notes: -${lost.join('/')} +${added.join('/')}`);
    }
    for (const plate of ['veg', 'halal']) {
      const before = tokens(a[plate]), after = tokens(b[plate]);
      const lost = [...before].filter((x) => !after.has(x)), added = [...after].filter((x) => !before.has(x) && !famTokens.has(x));
      if (lost.length || added.length) bad.push(`${k} ${plate} plate: -${lost.join('/')} +${added.join('/')}`);
    }
  }
  assert.equal(meals, 84);
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' differences beyond the ticked families');
  // Today (registry published 2026-10-21): no resident is No Sulphites, so the ticks move nobody and change no note.
  const holds = (r) => (r.tags || []).includes('No Sulphites') || (r.anaphTags || []).some((t) => /sulphite/i.test(t));
  if (!state.residents.some(holds)) {
    const moved = Object.keys(without.out).filter((k) => JSON.stringify(without.out[k].seat) !== JSON.stringify(now.out[k].seat) || JSON.stringify(without.out[k].notes) !== JSON.stringify(now.out[k].notes));
    assert.deepEqual(moved, [], 'with no No Sulphites resident nothing moves');
  }
});

const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
const feed = fs.existsSync(feedPath) ? JSON.parse(fs.readFileSync(feedPath, 'utf8')) : null;
const families = (r) => new Set((r && r.allergens || []).map((a) => String(a).split('(')[0].trim()));
const feedHasW1 = !!(feed && families(feed.find((r) => r.recipeName === 'Quinoa Cakes')).has('Sulphites'));
const feedHasV30 = !!(feed && families(feed.find((r) => r.recipeName === 'Granola')).has('Sulphites'));

test('with CODEX\'s feed: each tick\'s recipe lists the family, and the vegan line\'s own dishes reach the vegan plate', { skip: !feedHasW1 && 'CODEX v29 feed not beside this repo' }, () => {
  const FAMILY = { hasSulphites: 'Sulphites', hasNightshades: 'Nightshades', isSpicy: 'Spicy', hasGluten: 'Gluten' };
  const notListed = [];
  for (const t of TICKS) {
    if (t.ruling === 'v30' && !feedHasV30) continue;           // v30 is ruled; its feed lands with conc-recipe-hub v30
    const r = feed.find((x) => x.recipeName === t.recipe);
    if (!r || !families(r).has(FAMILY[t.flag])) notListed.push(`${t.recipe}: ${FAMILY[t.flag]}`);
  }
  assert.deepEqual(notListed, []);
  const plates = engine(menu, feed).out;
  const missing = [];
  for (const [wk, day, period, dish, recipe] of VEGAN_PLATE) {
    const d = menu[wk][day];
    if (!norm(d[period + '_veg']).includes(norm(dish))) continue;
    if (!families(feed.find((x) => x.recipeName === recipe)).has('Sulphites')) continue;
    if (!tokens(plates[wk + '|' + day + '|' + period].veg).has('SULPHITES')) missing.push(`W${wk} ${day} ${period} (${dish} — ${recipe})`);
  }
  assert.deepEqual(missing, [], 'the vegan plate names SULPHITES');
});

test('the published set is one valid publish: Stop 0, Review 0, and routing, state and summary were built from this menu', () => {
  const arts = {
    'menu_current.json': menuArtifact, 'registry_summary.json': read('registry_summary.json'),
    'routing_by_meal.json': read('routing_by_meal.json'), 'door_state.json': state, 'menu_overlay.json': overlay,
  };
  const v = core.validateDoorPublishArtifacts(arts, {});
  assert.equal(v.counts.Stop, 0, JSON.stringify(v.stop));
  assert.equal(v.counts.Review, 0, JSON.stringify(v.review));
  const hash = core.doorContentHash(menu);
  for (const f of ['routing_by_meal.json', 'registry_summary.json', 'door_state.json']) {
    assert.equal(arts[f]._meta.builtFromMenu && arts[f]._meta.builtFromMenu.hash, hash, f + ' was built from this menu');
  }
});
