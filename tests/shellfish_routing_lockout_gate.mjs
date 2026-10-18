// tests/shellfish_routing_lockout_gate.mjs — a shellfish meal routes and contains like a fish meal (2026-10-18, v31-standard.31).
// Since v31-standard.30 a CODEX shrimp or mussel recipe sets hasShellfish on its meal, but two places still keyed shellfish
// on hasFish alone, so a shrimp-only meal (hasShellfish, no hasFish):
//   - never opened the "No Fish / Shellfish" section (ROUTING_RULES no_fish triggered on hasFish only), so No Shellfish
//     residents stayed on the regular plate;
//   - never contained an anaphylactic No Shellfish resident: room lockout, the Anaphylactic Alternative and the
//     anaphylactic alert read No Shellfish as hasFish (ANAPH_TAG_TO_MEAL_FLAG), and No Molluscs had no entry at all.
// Jason, 2026-10-18: "follow your lean on routing and lockout". hasShellfish also opens no_fish, and containment checks
// hasFish or hasShellfish for No Shellfish and No Molluscs. The plating-sheet note gains "no molluscs" on a shellfish
// meal (CONFLICT_MAP). It only ever adds: 0 published meals carry hasShellfish and no anaphylactic resident has either
// tag, so the published routing and containment are unchanged (checked below).
// Runs the REAL ROUTING_RULES + computeSections, the compliance core, CONFLICT_MAP and the anaphylactic helpers from
// index.html in a vm. Authored to fail on main 9cf22d9 (v31-standard.30).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));

const routing = between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek =');
const core = between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */');
const tagLabels = html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0];
const routingTags = between('const ROUTING_TAGS = new Set([', ']);') + ']);\n';
const fnOpt = (name) => html.includes('function ' + name + '(') ? fn(name) : '';
const anaph = fn('getRoomBase') + fn('findRoommates') + fnOpt('doorIsAnaphResident') + fn('getAnaphConflictRooms') + fn('getAnaphAlertInfo') + fn('routeResident');
const conflictMap = between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n' + fn('getIngredientConflicts');

// The same code as it was before this change. On main the replacements find nothing, so "before" is main itself.
const before = (src) => src
  .replace("triggers:['hasFish','hasShellfish']", "triggers:['hasFish']")
  .replace("'No Shellfish': ['hasFish', 'hasShellfish']", "'No Shellfish': ['hasFish']")
  .replace(/\n[ \t]*'No Molluscs': \[[^\]]*\],?/, '')
  .replace(/\n[ \t]*\{ mealFlag:'hasShellfish', +residentTag:'No Molluscs'[^\n]*/, '');

function ctxFor(transform = (s) => s) {
  const ctx = { REGISTRY_LIST: [], anaphRooms: [], MEAL_DATA: { lunch: {}, dinner: {} } };
  vm.createContext(ctx);
  vm.runInContext([tagLabels, routingTags, transform(routing), transform(core), transform(anaph), transform(conflictMap),
    'this.__set = (reg, rooms, meals) => { REGISTRY_LIST = reg; anaphRooms = rooms; if (meals) MEAL_DATA = meals; };'].join('\n'),
    ctx, { filename: 'index.html#shellfish-routing', timeout: 5000 });
  return ctx;
}
// The vm's objects have their own prototypes: copy results out before a deep compare.
const out = (v) => JSON.parse(JSON.stringify(v));
const seats = (c, flags, residents) => out(c.computeSections(JSON.parse(JSON.stringify(flags)), residents)
  .map(s => [s.rule.key, s.residents.map(r => r.room)]));
const seatOf = (c, flags, residents, room) => (seats(c, flags, residents).find(([, rooms]) => rooms.includes(room)) || [null])[0];
const rooms = (set) => [...set].sort();

const ROSTER = [
  { room: '101', tags: [] }, { room: '201', tags: ['No Shellfish'] }, { room: '202', tags: ['No Fish'] },
  { room: '203', tags: ['No Molluscs'] }, { room: '204', tags: ['Halal', 'No Shellfish'] }, { room: '205', tags: ['Vegan'] },
  { room: '206', tags: ['GF'] }, { room: '207', tags: ['No Dairy'] },
];

test('a shrimp-only meal opens the No Fish / Shellfish section: No Shellfish and No Fish residents get the vegan plate', () => {
  const c = ctxFor();
  const meal = { hasShellfish: true };
  assert.equal(seatOf(c, meal, ROSTER, '201'), 'vegan', 'No Shellfish (merged into the vegan section, as on a fish meal)');
  assert.equal(seatOf(c, meal, ROSTER, '202'), 'vegan', 'No Fish, as a fish meal seats No Shellfish');
  assert.equal(seatOf(c, meal, ROSTER, '204'), 'vegan', 'the first matching section wins, as before');
  // Re-pinned 2026-10-18 (Jason: "No Molluscs routes like Shellfish"; the routing audit, routing_oracle_gate): it was warned
  // and contained but kept the regular plate. It now routes as No Shellfish does.
  assert.equal(seatOf(c, meal, ROSTER, '203'), 'vegan', 'No Molluscs routes like No Shellfish');
  assert.equal(seatOf(c, meal, ROSTER, '101'), 'regular');
  assert.equal(seatOf(c, meal, ROSTER, '206'), 'regular', 'nothing else opens');
});

test('routing is unchanged on every meal without hasShellfish, and on every meal that also has fish', () => {
  const now = ctxFor(), was = ctxFor(before);
  const keys = ['hasFish', 'hasGluten', 'hasDairy', 'hasPork', 'hasBeef', 'isSpicy', 'hasEgg', 'isCarb'];
  for (let m = 0; m < (1 << keys.length); m++) {
    const flags = {};
    keys.forEach((k, i) => { if (m & (1 << i)) flags[k] = true; });
    assert.deepEqual(seats(now, flags, ROSTER), seats(was, flags, ROSTER), JSON.stringify(flags));
    if (flags.hasFish) {
      const both = { ...flags, hasShellfish: true };
      assert.deepEqual(seats(now, both, ROSTER), seats(was, both, ROSTER), JSON.stringify(both));
    }
  }
});

function publishedMeals() {
  const meals = [];
  for (const [src, data] of [['menu', json('menu_current.json').menu], ['overlay', json('menu_overlay.json')]]) {
    for (const wk of Object.keys(data)) {
      if (wk === '_meta' || !data[wk] || typeof data[wk] !== 'object') continue;
      for (const day of Object.keys(data[wk])) {
        const d = data[wk][day] || {};
        meals.push({ where: `${src} W${wk} ${day}`, lunch: d.lunch_flags || {}, dinner: d.dinner_flags || {}, breakfast: d.breakfast_flags || {} });
      }
    }
  }
  return meals;
}

test('on the published menu, overlay and resident list, every meal routes and contains as before', () => {
  const residents = json('door_state.json').residents;
  const meals = publishedMeals();
  assert.ok(meals.length > 50, 'published meals read: ' + meals.length);
  assert.equal(meals.filter(m => m.lunch.hasShellfish || m.dinner.hasShellfish || m.breakfast.hasShellfish).length, 0,
    'no published meal carries hasShellfish today');
  const now = ctxFor(), was = ctxFor(before);
  for (const c of [now, was]) c.__set(residents, json('door_state.json').anaphRooms.slice());
  for (const m of meals) {
    for (const p of ['breakfast', 'lunch', 'dinner']) assert.deepEqual(seats(now, m[p], residents), seats(was, m[p], residents), m.where + ' ' + p);
    assert.deepEqual(rooms(now.getAnaphConflictRooms(m.lunch, m.dinner)), rooms(was.getAnaphConflictRooms(m.lunch, m.dinner)), m.where);
    assert.deepEqual(out(now.getAnaphAlertInfo(m.lunch, m.dinner)), out(was.getAnaphAlertInfo(m.lunch, m.dinner)), m.where);
  }
});

const anaphResident = (room, tags, anaphTags) => ({ room, tags, anaphTags, isAnaph: true });
const ROOMMATES = [{ room: '310a', tags: [] }, { room: '312', tags: [] }];

test('an anaphylactic No Shellfish or No Molluscs resident is contained on a shellfish meal, with their roommates', () => {
  const c = ctxFor();
  for (const [who, tags, anaphTags] of [
    ['No Shellfish, no anaphTags', ['No Shellfish'], []],
    ['No Shellfish as an anaphylactic tag', ['No Shellfish', 'Halal'], ['noShellfish']],
    ['No Molluscs, no anaphTags', ['No Molluscs'], []],
    ['No Molluscs as an anaphylactic tag', ['No Molluscs'], ['noMolluscs']],
  ]) {
    c.__set([anaphResident('310b', tags, anaphTags), ...ROOMMATES], []);
    assert.deepEqual(rooms(c.getAnaphConflictRooms({ hasShellfish: true }, {})), ['310a', '310b'], who + ': lunch');
    assert.deepEqual(rooms(c.getAnaphConflictRooms({}, { hasShellfish: true })), ['310a', '310b'], who + ': dinner');
    assert.deepEqual(rooms(c.getAnaphConflictRooms({ hasFish: true }, {})), ['310a', '310b'], who + ': a fish meal too');
    assert.deepEqual(rooms(c.getAnaphConflictRooms({ hasGluten: true }, { hasDairy: true })), [], who + ': not on other meals');
    const alerts = out(c.getAnaphAlertInfo({ hasShellfish: true }, { hasShellfish: true }));
    assert.equal(alerts.length, 1, who + ': one alert');
    assert.equal(alerts[0].anaphRoom, '310b');
    assert.equal(alerts[0].allergen, tags[0]);
    assert.equal(alerts[0].mealsAffected, 'Lunch & Dinner');
    assert.deepEqual(alerts[0].roommateRooms, ['310a']);
  }
});

test('an anaphylactic No Fish resident is not contained on a shellfish-only meal (fish is a separate allergy)', () => {
  const c = ctxFor();
  c.__set([anaphResident('310b', ['No Fish'], []), ...ROOMMATES], []);
  assert.deepEqual(rooms(c.getAnaphConflictRooms({ hasShellfish: true }, {})), []);
  assert.deepEqual(rooms(c.getAnaphConflictRooms({ hasFish: true }, {})), ['310a', '310b']);
});

test('the Anaphylactic Alternative and the anaphylactic allergen lists read the same flags', () => {
  const c = ctxFor();
  c.__set([], [], { lunch: { hasShellfish: true }, dinner: {} });
  assert.equal(c.routeResident({ noShellfish: true }, { hasShellfish: true }, null, true), 'Anaphylactic Alternative', 'No Shellfish');
  assert.equal(c.routeResident({ noMolluscs: true }, { hasShellfish: true }, null, true), 'Anaphylactic Alternative', 'No Molluscs');
  assert.notEqual(c.routeResident({ noFish: true }, { hasShellfish: true }, null, true), 'Anaphylactic Alternative', 'No Fish');
  const r = { tags: ['No Shellfish', 'No Molluscs', 'No Peanuts'], anaphTags: [] };
  assert.deepEqual(out(c.getAnaphDisplayAllergens(r, { hasShellfish: true })), ['No Shellfish', 'No Molluscs'], 'on a shellfish meal');
  assert.deepEqual(out(c.getAnaphDisplayAllergens(r, { hasPeanuts: true })), ['No Peanuts']);
  assert.deepEqual(out(c.getAnaphDisplayAllergens({ tags: ['GF'], anaphTags: [] })), ['GF'], 'a map-recognized non-"No" label still listed');
});

// Re-pinned 2026-10-18 (Jason: "every tag with a flag"): No Tree Nuts, No Eggs and No Soy are now contained on their own
// flags; tests/anaph_every_tag_gate.mjs owns them. The four tags this change leaves alone are checked here.
test('every other anaphylactic tag is contained exactly as before', () => {
  const now = ctxFor(), was = ctxFor(before);
  const flags = ['hasPeanuts', 'hasFish', 'hasShellfish', 'hasDairy', 'hasGluten', 'hasEgg', 'hasTreeNuts', 'hasSoy'];
  for (const tag of ['No Peanuts', 'No Fish', 'No Dairy', 'GF']) {
    for (const f of flags) {
      for (const c of [now, was]) c.__set([anaphResident('310b', [tag], []), ...ROOMMATES], []);
      assert.deepEqual(rooms(now.getAnaphConflictRooms({ [f]: true }, {})), rooms(was.getAnaphConflictRooms({ [f]: true }, {})), tag + ' on ' + f);
    }
  }
  // what this change adds, and only that
  for (const c of [now, was]) c.__set([anaphResident('310b', ['No Shellfish'], []), ...ROOMMATES], []);
  assert.deepEqual(rooms(was.getAnaphConflictRooms({ hasFish: true }, {})), ['310a', '310b'], 'No Shellfish on fish: kept');
});

test('the plating-sheet note says "no molluscs" to a No Molluscs resident on a shellfish meal', () => {
  const c = ctxFor();
  const notes = (flags, tags) => out(c.getIngredientConflicts(flags, [{ room: '203', tags }])).map(x => x.note);
  assert.deepEqual(notes({ hasShellfish: true }, ['No Molluscs']), ['no molluscs']);
  assert.deepEqual(notes({ hasShellfish: true }, ['No Shellfish']), ['no shellfish'], 'No Shellfish as before');
  assert.deepEqual(notes({ hasFish: true }, ['No Molluscs']), [], 'not on a fish-only meal (the note says what is in the meal)');
  // 2026-10-18: the table listed No Coconut twice, so the week-ahead list showed "Coconut" twice.
  const rows = out(vm.runInContext('CONFLICT_MAP', c)).map(r => r.mealFlag + '|' + r.residentTag);
  assert.deepEqual(rows.filter((r, i) => rows.indexOf(r) !== i), [], 'no row twice');
  assert.deepEqual(notes({ hasCoconut: true }, ['No Coconut']), ['no coconut'], 'No Coconut once');
  // …and every row names a tag a resident can carry (2026-10-18: a "Gluten Free" row matched nobody; the tag is GF).
  const labels = Object.values(out(vm.runInContext('TAG_LABELS_MAP', c)));
  const tags = out(vm.runInContext('CONFLICT_MAP', c)).map(r => r.residentTag);
  assert.deepEqual(tags.filter(t => !labels.includes(t)), [], 'every residentTag is a TAG_LABELS_MAP label');
  assert.deepEqual(notes({ hasGluten: true }, ['GF']), ['gluten-free'], 'a GF resident outside the GF section gets the note');
});

test('the changes carry the dated ruling', () => {
  assert.match(between('const ROUTING_RULES = [', '];'), /2026-10-18/, 'ROUTING_RULES');
  assert.match(between('ROOM-LEVEL ANAPHYLACTIC CONTAINMENT', 'const RESIDENT_TO_MEAL_FLAG'), /2026-10-18/, 'ANAPH_TAG_TO_MEAL_FLAG');
});
