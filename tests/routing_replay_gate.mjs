// tests/routing_replay_gate.mjs — the published residents through the published menu, against the rules table (2026-10-18, audit A4).
// Runs the REAL plating engine (computePlatingData → computeSections, the vegan line's lookups, anaphylactic lockout) and
// the REAL line notes (doorSectionAllergenStr, doorSectionLineNotes) from index.html in a vm, over every resident of
// door_state.json on every meal of menu_current.json (the menu as DOOR published it, overlay applied), with the baked
// CODEX list DOOR falls back to offline. Each resident must sit where the oracle says (tests/helpers/routing_oracle.mjs)
// and carry every note it requires. The receipt pins the places the audit found a restriction neither served nor named
// (docs/DOOR_ROUTING_RULES_2026-10-18.md §8), each now named. The real-browser run that writes the full receipt is
// tests/browser/routing_replay.mjs. Authored to fail on main 66e0bec (the §8 rows; Bland Diet, No Mustard, No Molluscs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { historical, syntheticResident } from './helpers/historical_menu.mjs';
import { liftCornDoor } from './helpers/corn_gate_runtime.mjs';
import { plateFor, requiredNotes, regularServiceNotes, anaphContained, NOTES } from './helpers/routing_oracle.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const fnOpt = (name) => (html.includes('function ' + name + '(') ? fn(name) : '');
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const TAG_LABELS = html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0];
const LABEL_OF = vm.runInNewContext(TAG_LABELS + ';TAG_LABELS_MAP');

const state = json('door_state.json');
const MENU = json('menu_current.json').menu;
const c = { console, REGISTRY_LIST: state.residents.map((r) => ({ ...r })), anaphRooms: [...state.anaphRooms], DOOR_RECIPE_DATA: null,
  getMenuData: () => MENU, loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}) };
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
  // main had no doorDatedMealFor (and nextDateForSlot read the menu per day): a stand-in that finds nothing.
  'if (typeof doorDatedMealFor !== "function") this.doorDatedMealFor = () => null;',
  // 2026-10-19 (the plating review): the kitchen's alternatives and the Regular line's service note.
  html.includes('const DOOR_KITCHEN_ALT_FIELDS = ') ? lineOf('const DOOR_KITCHEN_ALT_FIELDS = ') : '',
  // 2026-10-19 (v31-standard.42): the parts of a dish a swap drops (doorApplyDatedMeal reads the list).
  html.includes('const DOOR_DISH_PART_EMPTY = ') ? between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n' : '',
  fnOpt('doorKitchenAlternatives'), fnOpt('doorAddKitchenPlateFlags'), fnOpt('doorRegularServiceNote'),
  fn('computePlatingData'),
].join('\n'), c, { filename: 'index.html#routing-replay', timeout: 30000 });
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MEALS = [];
for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const period of ['breakfast', 'lunch', 'dinner']) {
  const pd = c.computePlatingData(period, wk, day);
  if (pd) MEALS.push({ wk, day, period, pd });
}
const byRoom = Object.fromEntries(state.residents.map((r) => [r.room, r]));
const splitNotes = (s) => new Set(String(s || '').split(/ · |, /).map((x) => x.trim()).filter(Boolean));
const tag = (m) => 'W' + m.wk + ' ' + m.day.slice(0, 3) + ' ' + m.period;
function lineFor(m, room) {
  if (typeof c.doorSectionLineNotes !== 'function') return null;
  const s = m.pd.sections.find((x) => x.residents.some((r) => r.room === room));
  if (!s || s.rule.key === 'regular') return null;
  return { key: s.rule.key, notes: splitNotes(c.doorSectionLineNotes(byRoom[room], s, m.pd.mealFlags, c.doorSectionAllergenStr(s, m.pd))) };
}

test('every published meal replays, and every resident sits exactly once on each', () => {
  assert.equal(MEALS.length, 84);
  const bad = [];
  for (const m of MEALS) {
    const seen = {};
    m.pd.anaphSect.forEach((r) => { seen[r.room] = (seen[r.room] || 0) + 1; });
    m.pd.sections.forEach((s) => s.residents.forEach((r) => { seen[r.room] = (seen[r.room] || 0) + 1; }));
    state.residents.forEach((r) => { if (seen[r.room] !== 1) bad.push(tag(m) + ' ' + r.room + ' ×' + (seen[r.room] || 0)); });
  }
  assert.deepEqual(bad, []);
});

test('every resident sits where the rules table says, on every published meal', () => {
  const bad = [];
  for (const m of MEALS) {
    const f = m.pd.mealFlags;
    for (const r of state.residents) {
      const want = anaphContained(r.room, state.residents, state.anaphRooms, f, LABEL_OF) ? 'anaph' : plateFor((r.tags || []), f);
      const got = m.pd.anaphSect.some((x) => x.room === r.room) ? 'anaph'
        : m.pd.sections.find((s) => s.residents.some((x) => x.room === r.room)).rule.key;
      if (got !== want) bad.push(tag(m) + ' ' + r.room + ' ' + (r.tags || []).join('+') + ': ' + got + ' ≠ ' + want);
    }
  }
  assert.deepEqual(bad, []);
});

test('every published line names every restriction its meal and its plate set off', () => {
  assert.equal(typeof c.doorSectionLineNotes, 'function', 'doorSectionLineNotes is missing');
  const bad = [];
  for (const m of MEALS) {
    for (const r of state.residents) {
      const line = lineFor(m, r.room);
      if (!line) continue;
      const plate = line.key === 'vegan' ? c.doorAllergenStrFlags(m.pd.vegAllergenStr || '')
        : line.key === 'halal' ? c.doorAllergenStrFlags(m.pd.ctx.halalAllergenStr || '') : {};
      const missing = [...requiredNotes(r.tags || [], m.pd.mealFlags, line.key, plate)].filter((n) => !line.notes.has(n));
      if (missing.length) bad.push(tag(m) + ' ' + r.room + ' in ' + line.key + ': missing ' + missing.join(', '));
    }
  }
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' lines miss a note');
});

// The plating review (2026-10-19): diabetics, No Spicy and soft residents eat the regular plate on many meals now, so
// the Regular notes must name what the meal sets off for them, as each section's line does.
test('every published Regular line names the restrictions and service notes its meal sets off', () => {
  const bad = [];
  for (const m of MEALS) {
    const reg = m.pd.sections.find((s) => s.rule.key === 'regular');
    if (!reg) continue;
    const noteOf = Object.fromEntries((m.pd.regularNotes || []).map((n) => [n.room, [n.conflictNote, n.serviceNote].filter(Boolean).join(' · ')]));
    for (const r of reg.residents) {
      const tags = r.tags || [];
      const note = noteOf[r.room] || '';
      const want = NOTES.filter(([k, t]) => tags.includes(t) && m.pd.mealFlags[k]).map(([, t]) => t);
      const missing = want.filter((t) => !note.includes(t));
      const got = splitNotes(note);
      regularServiceNotes(tags, m.pd.mealFlags).forEach((n) => { if (!got.has(n)) missing.push(n); });
      if (missing.length) bad.push(tag(m) + ' ' + r.room + ': missing ' + missing.join(', '));
    }
  }
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' Regular lines miss a note');
});

// Named incidents stay as fixed inputs; the four tests above still check every current resident/meal.
const examples = [
  ['spicy_halal', ['Halal', 'No Spicy'], '2|TUESDAY|dinner', 'halal', 'not spicy'],
  ['spicy_vegan', ['Vegan', 'No Spicy'], '2|TUESDAY|dinner', 'vegan', 'not spicy'],
  ['soft_halal', ['Halal', 'Soft Meals'], '1|THURSDAY|lunch', 'halal', 'soft'],
  ['processed', ['No Processed Food'], '2|THURSDAY|dinner', 'halal', 'no processed meat'],
  ['beef_halal', ['Halal', 'No Beef'], '1|THURSDAY|lunch', 'halal', 'no beef'],
  ['turkey_halal', ['Halal', 'No Turkey'], '3|FRIDAY|breakfast', 'halal', 'no turkey'],
  ['gluten_vegan', ['Vegan', 'GF'], '2|THURSDAY|dinner', 'vegan', 'gluten-free'],
  ['beans_vegan', ['Vegan', 'No Beans'], '2|FRIDAY|lunch', 'vegan', 'no beans'],
  ['egg_halal', ['Halal', 'No Eggs'], '2|SATURDAY|lunch', 'halal', 'no egg'],
];
test('fixed audit examples name each restriction, independent of current dishes and cohort sizes', () => {
  const residents = examples.map(([id, tags]) => syntheticResident('case_' + id, tags));
  const replay = liftCornDoor(html).engine(historical.menu, null, residents).out;
  for (const [id, , meal, plate, note] of examples) {
    assert.equal(replay[meal].seat['case_' + id], plate, id + ' plate');
    assert.ok(splitNotes(replay[meal].notes['case_' + id]).has(note), id + ': missing ' + note);
  }
});

test('a synthetic coconut-anaphylactic resident is contained exactly when a fixed meal sets off the flag', () => {
  const resident = syntheticResident('case_anaphylaxis', ['No Coconut'], { isAnaph: true, anaphTags: ['noCoconut'] });
  const { ctx, out: replay } = liftCornDoor(html).engine(historical.menu, null, [resident]);
  let affected = 0, unaffected = 0;
  for (const [meal, result] of Object.entries(replay)) {
    const [wk, day, period] = meal.split('|');
    const pd = ctx.computePlatingData(period, wk, day);
    const expected = anaphContained(resident.room, [resident], [], pd.mealFlags, LABEL_OF);
    assert.equal(result.seat[resident.room] === 'anaph', expected, meal);
    expected ? affected++ : unaffected++;
  }
  assert.ok(affected > 0 && unaffected > 0, 'the fixture exercises containment and ordinary service');
});

test('a halal plate never says PORK, on current meals and a fixed known halal alternative', () => {
  assert.deepEqual(MEALS.filter(m => /\bPORK\b/.test(m.pd.ctx.halalAllergenStr || '')).map(tag), []);
  const { ctx } = liftCornDoor(html).engine(historical.menu, null, [syntheticResident('case_halal', ['Halal'])]);
  const pd = ctx.computePlatingData('dinner', '4', 'FRIDAY');
  assert.ok(pd.ctx.halalAllergenStr, 'the fixed Tandoori Chicken alternative has a CONTAINS line');
  assert.doesNotMatch(pd.ctx.halalAllergenStr, /\bPORK\b/);
});
