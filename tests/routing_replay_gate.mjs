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
  // Re-pinned 2026-11-04: the receipt named the audit's rooms, so a resident leaving turned it red while the rule held
  // (704, Halal + No Beef, discharged in DOOR's 2026-11-04T14:48 publish). Each row now checks every resident who holds
  // the restriction today, on that plate, and needs at least one, so a row never passes by checking no one.
  const holding = (t) => state.residents.filter((r) => (r.tags || []).includes(t)).map((r) => r.room);
  const onPlate = (m, t, key) => holding(t).filter((room) => { const l = lineFor(m, room); return !!l && (!key || l.key === key); });
  function everyNamed(m, t, note, key, label) {
    assert.ok(m, label + ': no such meal');
    const rooms = onPlate(m, t, key);
    assert.ok(rooms.length >= 1, label + ': no ' + t + ' resident on the ' + key + ' plate');
    assert.deepEqual(rooms.filter((room) => !named(m, room, note)), [], label + ': ' + t + ' not named');
  }
  // Every meal where a resident holding the restriction sits as `pick` says, and the ones whose line misses the note.
  function acrossMeals(t, pick, note) {
    const hits = [];
    for (const room of holding(t)) for (const m of MEALS) if (pick(m, room)) hits.push({ m, room });
    return { count: hits.length, missing: hits.filter(({ m, room }) => !named(m, room, note)).map(({ m, room }) => room + ' ' + tag(m)) };
  }
  // #1 No Spicy on the halal plate: Wk2 TUE dinner's halal plate is Chicken Vindaloo.
  everyNamed(at('2', 'TUE', 'dinner'), 'No Spicy', 'not spicy', 'halal', 'Wk2 TUE dinner');
  // #2 No Spicy on a vegan plate whose line says SPICY, every such meal.
  const spicyVegan = acrossMeals('No Spicy', (m, room) => /\bSPICY\b/.test(m.pd.vegAllergenStr || '') && (lineFor(m, room) || {}).key === 'vegan', 'not spicy');
  assert.ok(spicyVegan.count >= 15, spicyVegan.count + ' plates');
  assert.deepEqual(spicyVegan.missing, []);
  // #3, #4 Soft Meals on another plate, never served the soft alternative there.
  const softOut = acrossMeals('Soft Meals', (m, room) => { const l = lineFor(m, room); return !!l && l.key !== 'soft' && !(l.key === 'halal' && m.pd.mealFlags.hasPork && !(m.pd.mealFlags._altMeals || []).length); }, 'soft');
  assert.deepEqual(softOut.missing, []);
  // Re-pinned 2026-10-19 (the plating review): with no bland plate on every spicy meal, a Soft Meals resident eats the soft
  // plate there, or the regular plate where the kitchen marks "no soft alternative needed", with "soft" in the Regular notes.
  const onRegular = (m, room) => (m.pd.sections.find((x) => x.rule.key === 'regular') || { residents: [] }).residents.some((r) => r.room === room);
  const regularNote = (m, room) => { const n = (m.pd.regularNotes || []).find((x) => x.room === room); return n ? splitNotes([n.conflictNote, n.serviceNote].filter(Boolean).join(' · ')) : new Set(); };
  const softRegular = [];
  for (const room of holding('Soft Meals')) for (const m of MEALS) if (m.pd.mealFlags._altMealsNone && onRegular(m, room)) softRegular.push({ m, room });
  assert.deepEqual(softRegular.filter(({ m, room }) => !regularNote(m, room).has('soft')).map(({ m, room }) => room + ' ' + tag(m)), []);
  assert.ok(softOut.count + softRegular.length >= 10, softOut.count + ' + ' + softRegular.length + ' plates');
  // #5 No Processed Food folded into Halal on a processed-pork day.
  const proc = acrossMeals('No Processed Food', (m, room) => m.pd.mealFlags.hasProcessedMeat && (lineFor(m, room) || {}).key === 'halal', 'no processed meat');
  assert.ok(proc.count >= 10, proc.count + ' plates');
  assert.deepEqual(proc.missing, []);
  // #6 No Beef on Wk1 THU lunch's halal beef sausage; #7 No Turkey on Wk3 FRI breakfast's halal plate.
  everyNamed(at('1', 'THU', 'lunch'), 'No Beef', 'no beef', 'halal', 'Wk1 THU lunch');
  everyNamed(at('3', 'FRI', 'breakfast'), 'No Turkey', 'no turkey', null, 'Wk3 FRI breakfast');
  // #8, #9 GF and No Beans on vegan plates whose own line has wheat or beans. The vegan sausage dinner is found by its
  // name wherever it is in Wk2 (2026-11-04: Jason moves meals between days).
  const sausages = MEALS.find((m) => m.wk === '2' && m.period === 'dinner' && /^Vegan Sausages/.test(m.pd.ctx.vegName || m.pd.vegName || MENU['2'][m.day].dinner_veg || ''));
  everyNamed(sausages, 'GF', 'gluten-free', 'vegan', 'the Wk2 vegan sausage dinner');
  // Re-pinned 2026-10-30 (Mat's Rexdale changes): Wk3 SUN dinner is Bolognese again, and its vegan batch has no beans;
  // the vegan Wk2 FRI lunch (the chili's vegan batch) does.
  everyNamed(at('2', 'FRI', 'lunch'), 'No Beans', 'no beans', 'vegan', 'Wk2 FRI lunch');
  // Found by the flag-source census (A5): the halal plate's own dish. Wk2 SAT lunch's halal plate is Halal Breaded Chicken
  // Burgers (egg, spicy, nightshades); the main meal (chicken tenders) ticks no egg.
  const w2sat = at('2', 'SAT', 'lunch');
  assert.match(w2sat.pd.ctx.halalAllergenStr || '', /\bEGGS?\b/, 'the halal plate says egg');
  everyNamed(w2sat, 'No Eggs', 'no egg', 'halal', 'Wk2 SAT lunch');
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
