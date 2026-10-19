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
import { plateFor, requiredNotes, regularServiceNotes, anaphContained, NOTES } from './helpers/routing_oracle.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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

test('the receipt: each restriction the audit found unserved and unnamed is named now (rules table §8)', () => {
  const at = (wk, day, period) => MEALS.find((m) => m.wk === wk && m.day.startsWith(day) && m.period === period);
  const named = (m, room, note) => { const l = lineFor(m, room); return !!(l && l.notes.has(note)); };
  // #1 No Spicy on the halal plate: Wk2 TUE dinner's halal plate is Chicken Vindaloo.
  for (const room of ['709', '910']) assert.ok(named(at('2', 'TUE', 'dinner'), room, 'not spicy'), room + ' at Wk2 TUE dinner');
  // #2 No Spicy on a vegan plate whose line says SPICY: 801, every such meal.
  const spicyVegan = MEALS.filter((m) => /\bSPICY\b/.test(m.pd.vegAllergenStr || '') && (lineFor(m, '801') || {}).key === 'vegan');
  assert.ok(spicyVegan.length >= 15, spicyVegan.length + ' meals');
  assert.deepEqual(spicyVegan.filter((m) => !named(m, '801', 'not spicy')).map(tag), []);
  // #3, #4 Soft Meals on another plate: 709, never served the soft alternative there.
  const softOut = MEALS.filter((m) => { const l = lineFor(m, '709'); return l && l.key !== 'soft' && !(l.key === 'halal' && m.pd.mealFlags.hasPork && !(m.pd.mealFlags._altMeals || []).length); });
  assert.deepEqual(softOut.filter((m) => !named(m, '709', 'soft')).map(tag), []);
  // Re-pinned 2026-10-19 (the plating review): with no bland plate on every spicy meal, 709 eats the soft plate there,
  // or the regular plate where the kitchen marks "no soft alternative needed", with "soft" in the Regular notes.
  const onRegular = (m, room) => (m.pd.sections.find((x) => x.rule.key === 'regular') || { residents: [] }).residents.some((r) => r.room === room);
  const regularNote = (m, room) => { const n = (m.pd.regularNotes || []).find((x) => x.room === room); return n ? splitNotes([n.conflictNote, n.serviceNote].filter(Boolean).join(' · ')) : new Set(); };
  const softRegular = MEALS.filter((m) => m.pd.mealFlags._altMealsNone && onRegular(m, '709'));
  assert.deepEqual(softRegular.filter((m) => !regularNote(m, '709').has('soft')).map(tag), []);
  assert.ok(softOut.length + softRegular.length >= 10, softOut.length + ' + ' + softRegular.length + ' meals');
  // #5 No Processed Food folded into Halal on a processed-pork day: 614b.
  const proc = MEALS.filter((m) => m.pd.mealFlags.hasProcessedMeat && (lineFor(m, '614b') || {}).key === 'halal');
  assert.ok(proc.length >= 10, proc.length + ' meals');
  assert.deepEqual(proc.filter((m) => !named(m, '614b', 'no processed meat')).map(tag), []);
  // #6 No Beef on Wk1 THU lunch's halal beef sausage; #7 No Turkey on Wk3 FRI breakfast's halal plate.
  for (const room of ['704', '901']) assert.ok(named(at('1', 'THU', 'lunch'), room, 'no beef'), room);
  assert.ok(named(at('3', 'FRI', 'breakfast'), '1006', 'no turkey'));
  // #8, #9 301a (GF, No Beans, Vegetarian) on vegan plates whose own line has wheat or beans.
  assert.ok(named(at('2', 'THU', 'dinner'), '301a', 'gluten-free'), 'Wk2 THU dinner: vegan sausages');
  assert.ok(named(at('3', 'SUN', 'dinner'), '301a', 'no beans'), 'Wk3 SUN dinner');
  // Found by the flag-source census (A5): the halal plate's own dish. Wk2 SAT lunch's halal plate is Halal Breaded Chicken
  // Burgers (egg, spicy, nightshades); the main meal (chicken tenders) ticks no egg. 304 is Halal + No Eggs.
  const w2sat = at('2', 'SAT', 'lunch');
  assert.match(w2sat.pd.ctx.halalAllergenStr || '', /\bEGGS?\b/, 'the halal plate says egg');
  assert.ok(named(w2sat, '304', 'no egg'), '304 at Wk2 SAT lunch');
});

test('room 213 is contained meal by meal on the 10 published meals with tree nuts or coconut, and only there', () => {
  // Re-pinned 2026-10-19 (the plating review): W3 THU dinner's Pork Griot comes with coconut rice and takes the Coconut
  // tick (tests/plating_review_ticks_gate.mjs).
  const contained = MEALS.filter((m) => m.pd.anaphSect.some((r) => r.room === '213')).map(tag).sort();
  assert.deepEqual(contained, ['W1 FRI dinner', 'W1 MON dinner', 'W1 WED dinner', 'W2 MON dinner', 'W2 WED dinner', 'W3 FRI lunch',
    'W3 THU dinner', 'W3 TUE dinner', 'W4 MON dinner', 'W4 SAT dinner']);
});

test('review P2: a halal plate never says PORK, whatever a slot\'s copied ticks say', () => {
  const pork = MEALS.filter((m) => /\bPORK\b/.test(m.pd.ctx.halalAllergenStr || '')).map(tag);
  assert.deepEqual(pork, []);
  const w4fri = MEALS.find((m) => m.wk === '4' && m.day === 'FRIDAY' && m.period === 'dinner');
  assert.ok(w4fri.pd.ctx.halalAllergenStr, 'Wk4 FRI dinner\'s halal plate (Tandoori Chicken) has a CONTAINS line');
});
