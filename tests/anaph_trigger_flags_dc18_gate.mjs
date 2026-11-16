// tests/anaph_trigger_flags_dc18_gate.mjs — DOOR publishes the anaphylactic trigger flags EXPO reads (2026-11-16, v31-standard.74).
// EXPO field test, deferred call DC18 (conc-kitchen-expo EXPO_JOB_PANEL_FIELD_TEST_ACTION_PLAN_2026-11-14.md §6); Jason,
// 2026-11-16: "Open both pairs now". EXPO's anaphylactic check (extractAnaphylacticResidents) reads
// registry_summary.json's anaphylactic_trigger_flags (meal flag names) and anaphylactic_trigger_tags. DOOR never wrote them,
// so in production EXPO's check read no anaphylactic resident at all: a peanut meal planned onto the board raised no
// anaphylactic conflict in EXPO or on HUB. The kitchen failure it prevents: EXPO plans a dish that sets off a resident's
// anaphylaxis with nothing said.
//   1  the summary carries both fields, as the union over anaphylactic residents of the scoping the lockout acts on;
//   2  each flag is one the lockout itself contains on (anaphTagMealFlags), and a resident not anaphylactic adds nothing;
//   3  anaphTags scope it (a resident anaphylactic to Tree Nuts only publishes hasTreeNuts, not every allergen tag);
//   4  no room or resident field rides along (the file is served on Pages);
//   5  today's published resident list gives a non-empty set (the four listed rooms have allergens recorded);
//   6  anaphylactic_residents_mapped counts the anaphylactic residents whose every allergen became a meal flag, so EXPO
//      can tell a complete list from one that left a resident out (No Oats has no flag; no allergen recorded at all).
// Authored to fail on main 54b6c75 (v31-standard.73).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
function fnOpt(name) { return html.includes('function ' + name + '(') ? fn(name) : ''; }
const state = JSON.parse(fs.readFileSync(new URL('../door_state.json', import.meta.url), 'utf8'));

function ctxFor(residents, rooms) {
  const c = { REGISTRY_LIST: residents, anaphRooms: rooms };
  vm.createContext(c);
  vm.runInContext(between('const TAG_LABELS_MAP = {', '\n};\n') + '\n};\n' + between('const ANAPH_TAG_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n' +
    between('const ALLERGEN_TAGS = new Set([', '\n]);\n') + '\n]);\n' + 'const ANAPH_ROUTING_ALLERGEN_TAGS = ' + between('const ANAPH_ROUTING_ALLERGEN_TAGS = ', ';\n').slice('const ANAPH_ROUTING_ALLERGEN_TAGS = '.length) + ';\n' + fn('doorIsAnaphAllergenTag') +
    fn('anaphTagMealFlags') + fn('getAnaphDisplayAllergens') + fnOpt('doorIsAnaphResident') + fnOpt('doorAnaphTriggerSummary') + fn('buildRegistrySummaryJSON') +
    ';this.__map = ANAPH_TAG_TO_MEAL_FLAG; this.__labels = TAG_LABELS_MAP;', c, { filename: 'index.html#dc18', timeout: 2000 });
  return c;
}

test('1 the summary carries anaphylactic_trigger_flags and anaphylactic_trigger_tags', () => {
  const s = ctxFor([{ room: 'case_a', tags: ['No Peanuts', 'Halal'], isAnaph: true }], []).buildRegistrySummaryJSON();
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_flags)), ['hasPeanuts']);
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_tags)), ['No Peanuts']);
});

test('2 every published flag is one the lockout contains on; a resident who is not anaphylactic adds nothing', () => {
  const residents = [
    { room: 'case_a', tags: ['No Shellfish', 'GF'], isAnaph: true },
    { room: 'case_b', tags: ['No Sesame'], isAnaph: false },          // not anaphylactic: adds nothing
    { room: 'case_c', tags: ['No Coconut'], isAnaph: false },         // on the list: counts
  ];
  const c = ctxFor(residents, ['case_c']);
  const s = c.buildRegistrySummaryJSON();
  const contained = new Set(Object.values(c.__map).flat());
  for (const f of s.anaphylactic_trigger_flags) assert.ok(contained.has(f), f + ' is a lockout flag');
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_flags)), ['hasCoconut', 'hasFish', 'hasGluten', 'hasShellfish']);
  assert.ok(!s.anaphylactic_trigger_flags.includes('hasSesame'));
  assert.equal(s.flags.anaphylactic, 2);
});

test('3 anaphTags scope it: anaphylactic to tree nuts only publishes hasTreeNuts', () => {
  const s = ctxFor([{ room: 'case_a', tags: ['No Tree Nuts', 'No Dairy', 'Vegan'], anaphTags: ['noTreeNuts'], isAnaph: true }], []).buildRegistrySummaryJSON();
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_flags)), ['hasTreeNuts']);
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_tags)), ['No Tree Nuts']);
});

test('4 no room or resident field rides along', () => {
  const c = ctxFor(state.residents, (state.anaphRooms || []).slice());
  const s = c.buildRegistrySummaryJSON();
  const text = JSON.stringify({ f: s.anaphylactic_trigger_flags, t: s.anaphylactic_trigger_tags });
  for (const r of state.residents) if (r.room && String(r.room).length > 2) assert.ok(!text.includes('"' + r.room + '"'), 'no room in the trigger fields');
  for (const v of s.anaphylactic_trigger_flags) assert.match(v, /^(has|is)[A-Z][A-Za-z]+$/);
  for (const v of s.anaphylactic_trigger_tags) assert.ok(Object.prototype.hasOwnProperty.call(c.__map, v), v + ' is an allergen tag');
});

test('5 today\'s resident list publishes the trigger flags of its anaphylactic residents', () => {
  const c = ctxFor(state.residents, (state.anaphRooms || []).slice());
  const s = c.buildRegistrySummaryJSON();
  const anaph = state.residents.filter(r => c.doorIsAnaphResident(r));
  const want = new Set();
  for (const r of anaph) for (const l of c.getAnaphDisplayAllergens(r)) for (const f of c.anaphTagMealFlags(l)) want.add(f);
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_flags)), [...want].sort());
  assert.ok(s.anaphylactic_trigger_flags.length > 0, 'today\'s anaphylactic residents have allergens recorded');
  assert.equal(s.anaphylactic_residents_mapped, s.flags.anaphylactic, 'every anaphylactic resident today has every allergen as a meal flag');
});

test('6 anaphylactic_residents_mapped counts only residents whose every allergen became a meal flag', () => {
  const residents = [
    { room: 'case_a', tags: ['No Peanuts', 'No Pork', 'Halal'], isAnaph: true },               // mapped: No Pork is not an allergen
    { room: 'case_b', tags: ['No Oats', 'No Peanuts'], anaphTags: ['noOats', 'noPeanuts'], isAnaph: true }, // oats has no flag
    { room: 'case_c', tags: ['Regular'], isAnaph: true },                                      // no allergen recorded
    { room: 'case_d', tags: ['No Sesame'], isAnaph: false },                                   // not anaphylactic
    { room: 'case_e', tags: ['No Coconut'], anaphTags: ['noCoconut'], isAnaph: true },        // mapped
  ];
  const s = ctxFor(residents, []).buildRegistrySummaryJSON();
  assert.equal(s.flags.anaphylactic, 4);
  assert.equal(s.anaphylactic_residents_mapped, 2);
  assert.ok(Number.isInteger(s.anaphylactic_residents_mapped));
  // The union still carries what is known, so EXPO can check those meals.
  assert.deepEqual(JSON.parse(JSON.stringify(s.anaphylactic_trigger_flags)), ['hasCoconut', 'hasPeanuts']);
});
