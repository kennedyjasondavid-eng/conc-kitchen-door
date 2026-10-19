// tests/anaph_every_tag_gate.mjs — every anaphylactic tag DOOR can flag is contained on its flag (2026-10-18, v31-standard.31).
// The anaphylactic tag picker (populateAnaphTags) offers every allergen tag, and DOOR's design note says allergen flags
// "also trigger room-level containment" for anaphylactic residents. But ANAPH_TAG_TO_MEAL_FLAG held only peanuts, fish,
// shellfish, dairy and gluten: a tick on Tree Nuts, Soy, Sesame, Mustard, Sulphites, Eggs, Coconut, Nightshades or Beef
// gave no room lockout, no Anaphylactic Alternative, no anaphylactic alert, and the plating sheet's anaphylactic line
// named nothing. Jason, 2026-10-18: "every tag with a flag". The week-ahead conflict list's red line knew peanuts only;
// it keeps that line and adds one per other tag a meal sets off. No Oats can't be contained: DOOR has no oats flag.
// Nothing moves today: the published resident list's two anaphylactic residents are both peanuts (checked below).
// Runs the REAL compliance core, routing and anaphylactic helpers from index.html in a vm. Authored to fail on main
// 9cf22d9 (v31-standard.30).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
// A function this change adds is missing on main: leave it out, so the tests that need it fail on their own.
function fnOpt(name) { return html.includes('function ' + name + '(') ? fn(name) : ''; }
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));

const NINE = { 'No Tree Nuts': 'hasTreeNuts', 'No Soy': 'hasSoy', 'No Sesame': 'hasSesame', 'No Mustard': 'hasMustard',
  'No Sulphites': 'hasSulphites', 'No Eggs': 'hasEgg', 'No Coconut': 'hasCoconut', 'No Nightshades': 'hasNightshades', 'No Beef': 'hasBeef' };
const TAG_KEY = { 'No Tree Nuts': 'noTreeNuts', 'No Soy': 'noSoy', 'No Sesame': 'noSesame', 'No Mustard': 'noMustard',
  'No Sulphites': 'noSulphites', 'No Eggs': 'noEggs', 'No Coconut': 'noCoconut', 'No Nightshades': 'noNightshades', 'No Beef': 'noBeef' };
const FLAGS = ['hasPeanuts', 'hasTreeNuts', 'hasFish', 'hasShellfish', 'hasDairy', 'hasGluten', 'hasSoy', 'hasSesame', 'hasMustard',
  'hasSulphites', 'hasEgg', 'hasCoconut', 'hasNightshades', 'hasBeef', 'hasPork', 'hasCorn'];

const src = [
  html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0],
  between('const ROUTING_TAGS = new Set([', ']);') + ']);',
  between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
  between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
  fn('getRoomBase') + fn('findRoommates') + fnOpt('doorIsAnaphResident') + fn('getAnaphConflictRooms') + fn('getAnaphAlertInfo') + fn('routeResident') + fnOpt('doorAnaphMealLines'),
].join('\n');
// The map as it was before this change: without the nine tags. On main the replacement finds nothing.
const before = (s) => s.replace(/\n[ \t]*'No (Tree Nuts|Soy|Sesame|Mustard|Sulphites|Eggs|Coconut|Nightshades|Beef)': \[[^\]]*\],?/g, '');

function ctxFor(transform = (s) => s) {
  const ctx = { REGISTRY_LIST: [], anaphRooms: [], MEAL_DATA: { lunch: {}, dinner: {} } };
  vm.createContext(ctx);
  vm.runInContext(transform(src) + '\nthis.__set = (reg, rooms, meals) => { REGISTRY_LIST = reg; anaphRooms = rooms; if (meals) MEAL_DATA = meals; };',
    ctx, { filename: 'index.html#anaph-every-tag', timeout: 5000 });
  return ctx;
}
const out = (v) => JSON.parse(JSON.stringify(v));
const rooms = (set) => [...set].sort();
const ROOMMATES = [{ room: '310a', tags: [] }, { room: '312', tags: [] }];
const anaph = (tags, anaphTags) => ({ room: '310b', tags, anaphTags, isAnaph: true });

test('each of the nine tags is contained on its own flag, with roommates, at lunch or at dinner', () => {
  const c = ctxFor();
  for (const [tag, flag] of Object.entries(NINE)) {
    for (const [how, r] of [['as an anaphylactic tag', anaph([tag, 'Halal'], [TAG_KEY[tag]])], ['with no anaphTags', anaph([tag], [])]]) {
      c.__set([r, ...ROOMMATES], []);
      assert.deepEqual(rooms(c.getAnaphConflictRooms({ [flag]: true }, {})), ['310a', '310b'], tag + ' ' + how + ': lunch');
      assert.deepEqual(rooms(c.getAnaphConflictRooms({}, { [flag]: true })), ['310a', '310b'], tag + ' ' + how + ': dinner');
      assert.deepEqual(rooms(c.getAnaphConflictRooms({ hasPeanuts: true }, {})), [], tag + ' ' + how + ': not on a peanut meal');
    }
  }
});

test('…alerted, named on the anaphylactic line, and given the Anaphylactic Alternative', () => {
  const c = ctxFor();
  for (const [tag, flag] of Object.entries(NINE)) {
    c.__set([anaph([tag], [TAG_KEY[tag]]), ...ROOMMATES], [], { lunch: { [flag]: true }, dinner: {} });
    const alerts = out(c.getAnaphAlertInfo({ [flag]: true }, {}));
    assert.deepEqual(alerts.map(a => [a.anaphRoom, a.allergen, a.mealsAffected, a.roommateRooms]), [['310b', tag, 'Lunch', ['310a']]], tag + ': alert');
    assert.deepEqual(out(c.getAnaphDisplayAllergens({ tags: [tag], anaphTags: [TAG_KEY[tag]] }, { [flag]: true })), [tag], tag + ': anaphylactic line');
    assert.deepEqual(out(c.getAnaphDisplayAllergens({ tags: [tag], anaphTags: [TAG_KEY[tag]] }, { hasPeanuts: true })), [], tag + ': only its meal');
    assert.equal(c.routeResident({ [TAG_KEY[tag]]: true }, { [flag]: true }, null, true), 'Anaphylactic Alternative', tag + ': routeResident');
  }
});

test('a tag is contained on exactly its own flags, for every tag in the map', () => {
  const c = ctxFor();
  const map = out(vm.runInContext('ANAPH_TAG_TO_MEAL_FLAG', c));
  const expected = { 'No Peanuts': ['hasPeanuts'], 'No Fish': ['hasFish'], 'No Shellfish': ['hasFish', 'hasShellfish'],
    'No Molluscs': ['hasFish', 'hasShellfish'], 'No Dairy': ['hasDairy'], 'GF': ['hasGluten'],
    ...Object.fromEntries(Object.entries(NINE).map(([t, f]) => [t, [f]])) };
  assert.deepEqual(map, expected, 'the map');
  for (const [tag, flags] of Object.entries(expected)) {
    for (const f of FLAGS) {
      c.__set([anaph([tag], []), ...ROOMMATES], []);
      assert.equal(c.getAnaphConflictRooms({ [f]: true }, {}).size > 0, flags.includes(f), tag + ' on ' + f);
    }
  }
});

test('every tag the anaphylactic picker offers that DOOR can flag is contained on that flag; No Oats is the one it can\'t', () => {
  const allergenTags = [...between('const ALLERGEN_TAGS = new Set([', ']);').matchAll(/'([^']+)'/g)].map(m => m[1]);
  // Re-pinned 2026-10-18 (v31-standard.39): the picker's own list is ANAPH_ROUTING_ALLERGEN_TAGS, read through
  // doorIsAnaphAllergenTag (Generate's check on the anaphylactic list reads the same rule).
  assert.match(fn('populateAnaphTags'), /doorIsAnaphAllergenTag\(label\)/, 'populateAnaphTags reads the one rule');
  const extra = between('const ANAPH_ROUTING_ALLERGEN_TAGS = [', '];');
  assert.ok(extra, 'the picker still adds the routing allergens');
  const offered = [...new Set(allergenTags.concat([...extra.matchAll(/'([^']+)'/g)].map(m => m[1])))];
  const c = ctxFor();
  const r2m = out(vm.runInContext('RESIDENT_TO_MEAL_FLAG', c));
  const unflagged = [];
  for (const tag of offered) {
    const flag = r2m[tag];
    if (!flag) { unflagged.push(tag); continue; }
    assert.ok(out(c.anaphTagMealFlags(tag)).includes(flag), tag + ' is contained on ' + flag);
  }
  assert.deepEqual(unflagged, ['No Oats'], 'DOOR has no oats flag');
});

test('the week-ahead list gives each tag a meal sets off its own red line; peanuts keeps its line', () => {
  const c = ctxFor();
  assert.equal(typeof c.doorAnaphMealLines, 'function', 'doorAnaphMealLines');
  const residents = [anaph(['No Tree Nuts'], ['noTreeNuts']), { room: '402', tags: ['No Shellfish', 'No Peanuts'], isAnaph: true, anaphTags: [] },
    { room: '213', tags: ['GF'], anaphTags: [] }, { room: '500', tags: ['No Soy'] }];
  const lines = out(c.doorAnaphMealLines({ hasTreeNuts: true, hasShellfish: true, hasPeanuts: true, hasGluten: true, hasSoy: true }, residents, ['213']));
  assert.deepEqual(lines, [
    { type: 'Tree Nuts — ANAPHYLACTIC', residents: 1, rooms: '310b', severity: 'red' },
    { type: 'Shellfish — ANAPHYLACTIC', residents: 1, rooms: '402', severity: 'red' },
    { type: 'Gluten — ANAPHYLACTIC', residents: 1, rooms: '213', severity: 'red' },
  ], 'one line per tag; peanuts left to its own line; a room on the anaphylactic list counts; a non-anaphylactic No Soy does not');
  assert.deepEqual(out(c.doorAnaphMealLines({ hasPeanuts: true }, residents, [])), [], 'a peanut-only meal adds no line');
  const block = between("} else if (type === 'menu_conflict') {", "} else if (type === 'welfare_patterns') {");
  assert.match(block, /type: 'Peanuts — ANAPHYLACTIC'/, 'the peanut line stays as it was');
  assert.match(block, /dayConflicts\.push\(\.\.\.doorAnaphMealLines\(meal, REGISTRY_LIST, anaphRooms\)\)/, 'wired into the list');
});

function publishedMeals() {
  const meals = [];
  for (const [where, data] of [['menu', json('menu_current.json').menu], ['overlay', json('menu_overlay.json')]]) {
    for (const wk of Object.keys(data)) {
      if (wk === '_meta' || !data[wk] || typeof data[wk] !== 'object') continue;
      for (const day of Object.keys(data[wk])) {
        const d = data[wk][day] || {};
        meals.push({ where: `${where} W${wk} ${day}`, lunch: d.lunch_flags || {}, dinner: d.dinner_flags || {} });
      }
    }
  }
  return meals;
}

// The one live change. Room 213 is on DOOR's anaphylactic list (H&W, April 22) with Tree Nuts and Coconut ticked as its
// anaphylactic tags; neither tag was in the map, so 213 had no lockout or alert on the published menu's coconut and
// tree-nut meals (9 of them). Now it does — and nothing else moves: no other resident, no other meal.
test('on the published menu, overlay and resident list, only room 213 moves: contained and alerted on its tree-nut and coconut meals', () => {
  const state = json('door_state.json');
  const residents = state.residents;
  const r213 = residents.find(r => r.room === '213');
  assert.ok(state.anaphRooms.includes('213') && r213 && JSON.stringify(r213.anaphTags) === JSON.stringify(['noCoconut', 'noTreeNuts']),
    'room 213 is on the anaphylactic list with Coconut and Tree Nuts as its anaphylactic tags');
  const now = ctxFor(), was = ctxFor(before);
  for (const c of [now, was]) c.__set(residents, state.anaphRooms.slice());
  const hits213 = (...ms) => ms.some(f => f.hasTreeNuts || f.hasCoconut);
  let contained = 0;
  for (const m of publishedMeals()) {
    const w = rooms(was.getAnaphConflictRooms(m.lunch, m.dinner));
    const expected = hits213(m.lunch, m.dinner) ? [...new Set(w.concat('213'))].sort() : w;
    assert.deepEqual(rooms(now.getAnaphConflictRooms(m.lunch, m.dinner)), expected, m.where);
    const alertsNow = out(now.getAnaphAlertInfo(m.lunch, m.dinner)), alertsWas = out(was.getAnaphAlertInfo(m.lunch, m.dinner));
    assert.deepEqual(alertsNow.filter(a => a.anaphRoom !== '213'), alertsWas.filter(a => a.anaphRoom !== '213'), m.where + ': other alerts');
    assert.deepEqual(alertsNow.filter(a => a.anaphRoom === '213').map(a => a.allergen).sort(),
      (hits213(m.lunch, m.dinner) ? ['No Coconut', 'No Tree Nuts'].filter(t => [m.lunch, m.dinner].some(f => f[t === 'No Coconut' ? 'hasCoconut' : 'hasTreeNuts'])) : []).sort(),
      m.where + ': 213\'s alerts');
    // the routing file counts lockout per meal (buildRoutingByMealJSON: getAnaphConflictRooms(mealFlags, emptyFlags))
    for (const p of ['lunch', 'dinner']) {
      const wp = rooms(was.getAnaphConflictRooms(m[p], {}));
      const ep = hits213(m[p]) ? [...new Set(wp.concat('213'))].sort() : wp;
      assert.deepEqual(rooms(now.getAnaphConflictRooms(m[p], {})), ep, m.where + ' ' + p);
      if (m.where.startsWith('menu') && hits213(m[p])) contained++;
    }
  }
  // Re-pinned 2026-10-19 (the plating review): Wk3 THU dinner's Pork Griot is served with coconut rice and takes the
  // Coconut tick (tests/plating_review_ticks_gate.mjs), so 213 is contained there too.
  assert.equal(contained, 10, 'the published menu\'s tree-nut and coconut meals');
});

test('the map carries the dated ruling', () => {
  assert.match(between('ROOM-LEVEL ANAPHYLACTIC CONTAINMENT', 'const RESIDENT_TO_MEAL_FLAG'), /every\s*\n?\/\/ tag with a flag/);
});
