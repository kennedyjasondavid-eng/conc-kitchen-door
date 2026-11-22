// tests/breakfast_note_s1_gate.mjs — U3 S1, the resident breakfast note (2026-11-19, Jason: "Follow leans on all four";
// call C1, the simple breakfast design, docs/DOOR_BACK_ON_TRACK_PLAN_2026-11-18.md §5 U3). One field on the resident for a
// confirmed standing instruction ("oat milk only"). It is kept through the resident editor, Enter Changes, the queues,
// intake resets, history and revert, door_state.json and the two-computer merge; it is never in registry_summary.json or a
// file Pages serves; it prints beside the resident at breakfast only (preview, print, XLSX), checked against the words of
// the plate they are seated on, a conflict in amber, never fixed. Routing, counts and the plates do not change.
//   1. the check: "<kind> milk only" against the plate's milks; any other note just prints
//   2. the plating sheet at breakfast: the section row, the anaphylactic row and a regular resident with only a note; the
//      plate the check reads; nothing at lunch or dinner; counts unchanged
//   3. both renderers print it (HTML escaped, the CHECK amber; XLSX the same text, the cell amber)
//   4. the resident record: an update keeps it, a change that carries it sets or clears it, a new person starts without
//      it, history and revert, the diff
//   5. the forms: Enter Changes, the resident editor and the Intake Portal carry it; a box filled for one room never
//      rides to the next
//   6. two computers: a note saved on one reaches the other and survives its Generate
//   7. privacy: door_state.json carries it; registry_summary.json and the files Pages serves never do
// Authored to fail on main b284b00. Every resident here is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { twoComputers, out, R, intake, complianceDocsSource } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.BREAKFAST_NOTE_HTML || new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { const m = html.match(new RegExp('\\n(async )?function ' + name + '\\(')); assert.ok(m, 'missing ' + name); const s = m.index + 1; return html.slice(s, html.indexOf('\n}\n', s)) + '\n}\n'; }
const lineOf = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
const CORE = () => between('/* DOOR_TESTABLE_CORE_START breakfast-note */', '/* DOOR_TESTABLE_CORE_END breakfast-note */');

function core(extra = {}) {
  const c = Object.assign({ console }, extra);
  vm.createContext(c);
  vm.runInContext(CORE(), c, { filename: 'index.html#breakfast-note' });
  return c;
}

test('1. the check: "<kind> milk only" against the plate\'s milks; any other note just prints', () => {
  const c = core();
  const cases = [
    ['oat milk only', 'Cereal & Milk, Fresh Fruit', 'CHECK: the plate names milk, not oat milk'],
    ['Oat milk only', 'Chex cereal with soy or oat milk, whole fruit', ''],
    ['oat milk only', 'Chex cereal, soy milk, whole fruit', 'CHECK: the plate names soy milk, not oat milk'],
    ['only soy milk', 'Rice Chex, soy drink, fruit', ''],
    ['oat milk only', 'Pancakes, turkey bacon, fruit & yoghurt', ''],          // no milk on the plate: nothing to check
    ['oat milk only', 'Buttermilk pancakes, fruit', ''],                        // buttermilk is not milk to pour
    ['oat milk only', 'Cereal, lactose-free milk', 'CHECK: the plate names lactose-free milk, not oat milk'],
    ['smaller breakfast starch portion plus extra protein', 'Cereal & Milk', ''],
    ['oat milk only', null, ''],                                                // a plate not named yet is not checked
    // Review fold (P3-1, P3-2): a dairy-free note is met by any plant milk; a list of kinds; "no … only" reads the
    // other way; "Rice & oat milk" names oat milk, not rice milk; "oatmilk" is one word.
    ['dairy-free milk only', 'Cereal, soy milk', ''],
    ['dairy-free milk only', 'Cereal, plant milk', ''],
    ['dairy-free milk only', 'Cereal & Milk', 'CHECK: the plate names milk, not dairy-free milk'],
    ['oat or soy milk only', 'Cereal, oat milk', ''],
    ['no soy milk only', 'Cereal, soy milk', ''],
    ['rice milk only', 'Rice & oat milk', 'CHECK: the plate names oat milk, not rice milk'],
    ['rice milk only', 'Congee rice, soy milk', 'CHECK: the plate names soy milk, not rice milk'],
    ['oatmilk only', 'Cereal & Milk', 'CHECK: the plate names milk, not oat milk'],
    ['soy milk only', 'Cereal, soymilk', ''],
    ['oat milk only', 'Cereal, plant milk', 'CHECK: the plate names plant milk, not oat milk'],
    ['oat milk only', 'Soy milk, milk', 'CHECK: the plate names milk and soy milk, not oat milk'],
  ];
  for (const [note, plate, want] of cases) assert.equal(c.doorBreakfastNoteConflict(note, plate), want, note + ' | ' + plate);
  assert.equal(c.doorBreakfastNoteFor({ room: '9a' }, 'Cereal & Milk'), null, 'no note, nothing printed');
  assert.equal(c.doorBreakfastNoteFor({ room: '9a', breakfastNote: '   ' }, 'Cereal & Milk'), null, 'a blank note is none');
  const n = c.doorBreakfastNoteFor({ room: '9a', breakfastNote: ' oat  milk only ' }, 'Cereal & Milk');
  assert.deepEqual([n.note, n.conflict, n.text], ['oat milk only', 'CHECK: the plate names milk, not oat milk',
    'Breakfast note: oat milk only (CHECK: the plate names milk, not oat milk)']);
});

// The real plating engine, as tests/yoghurt_swap_gate.mjs loads it, plus the breakfast-note helpers.
function plating(residents, menu, anaph = []) {
  const c = { console, DOOR_RECIPE_DATA: [], REGISTRY_LIST: residents, anaphRooms: anaph, getMenuData: () => menu,
    loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}), document: { getElementById: () => null }, doorIcon: () => '' };
  vm.createContext(c);
  const shared = between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */');
  vm.runInContext([
    html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0], shared,
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
    between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    fn('formatConflictNote'), fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fn('getAnaphConflictRooms'),
    between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', between('const FLAG_DEFS = [', '\n];\n') + '\n];\n',
    fn('flagsToAllergenStr'), fn('emptyMealFlags'), fn('hasCarbAccommodation'), fn('_hubAllergenResolve'), fn('hubAllergenToFlags'),
    'const _hubUnmappedLabels = new Set();', between('const DOOR_NON_CODEX_TICKS', '\n') + '\n', fn('doorLinkFlags'),
    between('function doorSlotRecipesToday(', 'function doorLabelUncheckedTagHTML('), fn('doorText'), fn('escapeHtml'),
    lineOf('function _slotText('), between('const DOOR_LINE_SIDE_IDS', '\n') + '\n', between('const DOOR_LINE_EXTRAS', '\n') + '\n', fn('doorLinePieces'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between('const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'), 'this.doorDatedMealFor = () => null;',
    lineOf('const DOOR_KITCHEN_ALT_FIELDS = '), fn('doorKitchenAlternatives'), fn('doorAddKitchenPlateFlags'),
    CORE(), fn('doorRegularServiceNote'), between('const DOOR_YOGHURT_SWAP_NOTE', 'function doorYoghurtSwapFor('), fn('doorYoghurtSwapFor'),
    between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fn('doorAllergenStrFlags'),
    between('const DOOR_LABEL_CHECK_SKIP_TAGS', 'function doorSectionLineNotes('), fn('doorSectionLineNotes'), fn('doorSectionAllergenStr'),
    fn('doorPlateFacts'), fn('computePlatingData'), fn('doorPlatingBreakfastNotes'), fn('doorPlatingNoteCellHTML'),
    fn('getAltMeal'), fn('doorBreakfastDefinitionGap'), fn('doorSplitDishes'),
    // The separate anaphylactic meal: its own line, as the sheet prints it.
    'function doorAnaphAlternativeLine(pd) { return "Oatmeal with oat milk \\u2014 prepared separately"; }',
  ].join('\n'), c, { filename: 'index.html#breakfast-plating', timeout: 30000 });
  return c;
}
const F = (o) => Object.assign({ hasDairy: false, hasGluten: false, hasEgg: false, hasPeanuts: false, hasPork: false }, o || {});
const DAY = () => ({ breakfast: 'Cereal & Milk, Fresh Fruit', breakfast_veg: 'Cereal & oat milk, Fresh Fruit', breakfast_flags: F({ hasDairy: true, hasGluten: true }),
  breakfast_gfAlt: 'Chex cereal with soy or oat milk, whole fruit',
  lunch: 'Chicken Curry, Rice', lunch_veg: 'Chickpea Curry, Rice', lunch_flags: F({ hasChicken: true }),
  dinner: 'Beef Stew, Bread', dinner_veg: 'Lentil Stew, Bread', dinner_flags: F({ hasBeef: true, hasGluten: true }) });
const MENU = () => ({ 1: { TUESDAY: DAY() } });
const RES = () => [
  R('901', ['GF'], { rawRestriction: 'GF', breakfastNote: 'oat milk only' }),                       // GF plate names oat milk
  R('902', ['Vegetarian'], { section: 'Vegan / Vegetarian', rawRestriction: 'Vegetarian', breakfastNote: 'soy milk only' }),   // vegan plate names oat milk only
  R('903', ['Regular'], { rawRestriction: 'Regular', breakfastNote: 'oat milk only' }),              // regular plate names plain milk
  R('904', ['Low Sodium'], { rawRestriction: 'Low Sodium', breakfastNote: 'smaller breakfast starch portion plus extra protein' }),
  R('905', ['Regular'], { rawRestriction: 'Regular' }),
  R('906', ['No Peanuts'], { rawRestriction: 'No Peanuts', isAnaph: true, anaphTags: ['noPeanuts'], breakfastNote: 'oat milk only' }),
];

test('2. the plating sheet at breakfast: every seat, the plate the check reads, nothing at lunch or dinner, counts unchanged', () => {
  const c = plating(RES(), MENU());
  const pd = c.computePlatingData('breakfast', 1, 'TUESDAY');
  assert.ok(pd.breakfastNotes, 'breakfast carries the notes');
  const n = out(pd.breakfastNotes);
  assert.deepEqual(Object.keys(n).sort(), ['901', '902', '903', '904', '906'], 'one per resident with a note: ' + JSON.stringify(n));
  assert.equal(n['901'].conflict, '', 'the gluten-free plate names oat milk');
  assert.equal(n['902'].conflict, 'CHECK: the plate names oat milk, not soy milk', 'the vegan plate');
  assert.equal(n['903'].conflict, 'CHECK: the plate names milk, not oat milk', 'the regular plate');
  assert.equal(n['904'].conflict, '', 'a note with nothing to check prints only');
  assert.equal(n['906'].conflict, 'CHECK: the plate names milk, not oat milk', 'not contained today: read against the regular plate');
  // A regular resident with only a breakfast note gets a notes row; one without stays off it.
  const reg = pd.regularNotes.map((r) => r.room);
  assert.ok(reg.includes('903') && !reg.includes('905'), 'regular notes: ' + reg.join(','));
  // The anaphylactic resident: anaphylactic on a peanut meal only, so the note reads their own seat today.
  const pdA = plating(RES(), { 1: { TUESDAY: Object.assign(DAY(), { breakfast_flags: F({ hasDairy: true, hasPeanuts: true }) }) } }, ['906']).computePlatingData('breakfast', 1, 'TUESDAY');
  assert.ok(pdA.anaphSect.some((r) => r.room === '906'), 'contained on a peanut breakfast');
  assert.equal(out(pdA.breakfastNotes)['906'].conflict, '', 'checked against the separate anaphylactic meal (oat milk)');
  // Counts and seats are what they are without notes.
  const bare = plating(RES().map((r) => { const x = Object.assign({}, r); delete x.breakfastNote; return x; }), MENU()).computePlatingData('breakfast', 1, 'TUESDAY');
  const seats = (p) => out(p.sections.map((s) => s.rule.key + ':' + s.residents.map((r) => r.room).join(',')));
  assert.deepEqual(seats(pd), seats(bare), 'the note never moves a resident');
  assert.equal(bare.breakfastNotes && Object.keys(bare.breakfastNotes).length, 0, 'no note, nothing');
  for (const period of ['lunch', 'dinner']) {
    const p = c.computePlatingData(period, 1, 'TUESDAY');
    assert.equal(p.breakfastNotes, undefined, period + ' carries no breakfast notes');
    assert.ok(!p.regularNotes.some((r) => r.room === '903'), period + ': no notes row for a breakfast note');
  }
  // The cell, as the HTML sheet prints it: escaped, the CHECK amber.
  const cell = c.doorPlatingNoteCellHTML('soft', { note: '<b>oat</b> milk only', conflict: 'CHECK: the plate names milk, not oat milk' });
  assert.ok(cell.startsWith('soft · ') && cell.includes('&lt;b&gt;oat&lt;/b&gt;') && !cell.includes('<b>'), 'escaped: ' + cell);
  assert.match(cell, /class="ps-bf-check" style="background:#FFE699/, 'the CHECK in amber');
  assert.equal(c.doorPlatingNoteCellHTML('soft', null), 'soft', 'no note: the cell as before');
});

test('3. both renderers print it: the HTML sheet (preview and print) and the XLSX', () => {
  const html1 = fn('buildPlatingHtml');
  assert.ok(html1.includes('pd.breakfastNotes'), 'the HTML sheet reads the notes');
  assert.equal((html1.match(/noteCell\(/g) || []).length >= 5, true, 'anaphylactic, roommate, section and both regular rows');
  const xlsx = fn('buildDaySheet');
  assert.ok(xlsx.includes('pd.breakfastNotes'), 'the XLSX reads the notes');
  assert.equal((xlsx.match(/bfText\(/g) || []).length >= 4, true, 'the XLSX prints it on every kind of row');
  assert.ok(/bfAmber\(r\.room\)\) addRow\([^\n]*'FFE699'/.test(xlsx), 'a CHECK turns the XLSX cell amber');
  // Only computePlatingData makes them, and only at breakfast.
  assert.match(fn('computePlatingData'), /if \(period === 'breakfast' && typeof doorPlatingBreakfastNotes === 'function'\) pd\.breakfastNotes =/);
});

// applyQueueToRegistry with the breakfast-note core, on a stand-in registry.
function registry(list) {
  const c = { console, REGISTRY_LIST: list, REGISTRY_MAP: {}, anaphRooms: [], RECENT_LOG: [],
    getOperatorName: () => 'JK', pushResidentHistory() {}, clearResidentHistory() {}, dedupeServiceNote: (a, b) => b || a, filterServiceNote: (a, b) => b || a,
    requiresDocumentation: () => false, doorApplyPendingImportStamp() {}, saveRegistryState() {}, setRegistryProvenance() {} };
  vm.createContext(c);
  vm.runInContext([html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0], between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    CORE(), complianceDocsSource(html), fn('doorIsAnaphResident'), html.includes('function doorRegistryQueueTransition(') ? fn('doorRegistryQueueTransition') : '',
    html.includes('function doorAnaphAnswerTransition(') ? fn('doorAnaphAnswerTransition') : '', fn('applyQueueToRegistry'),
    between('const _HISTORY_SNAPSHOT_KEYS', ';\n') + ';\n', fn('snapshotResident'), fn('diffResidentStates')].join('\n'), c);
  return c;
}
const upd = (room, extra) => Object.assign({ room, type: 'update', tags: { vegetarian: true }, route: 'Vegan / Vegetarian', notes: '', isAnaph: false }, extra || {});

test('4. the resident record: kept, set, cleared, fresh for a new person; history, revert and the diff', () => {
  const c = registry([R('301z', ['Vegetarian'], { breakfastNote: 'oat milk only' }), R('302z', ['Regular'], { breakfastNote: 'soy milk only' })]);
  c.changesQueue = [upd('301z'), intake('302z', { regular: true })];
  vm.runInContext('applyQueueToRegistry([])', c);
  const by = (room) => c.REGISTRY_LIST.find((r) => r.room === room);
  assert.equal(by('301z').breakfastNote, 'oat milk only', 'an update that does not carry it (an import) keeps it');
  assert.equal(by('302z').breakfastNote, undefined, 'a new intake over an occupied room is a new person: no note carries');
  c.changesQueue = [upd('301z', { breakfastNote: '  soy  milk only ' }), Object.assign(intake('303z', { regular: true }), { breakfastNote: 'oat milk only' })];
  vm.runInContext('applyQueueToRegistry([])', c);
  assert.equal(by('301z').breakfastNote, 'soy milk only', 'a change that carries it sets it');
  assert.equal(by('303z').breakfastNote, 'oat milk only', 'a new intake can carry one');
  c.changesQueue = [upd('301z', { breakfastNote: '' })];
  vm.runInContext('applyQueueToRegistry([])', c);
  assert.ok(!('breakfastNote' in by('301z')), 'an empty one clears it');
  // History keeps it; the diff names it; a revert to a state without one takes it off.
  assert.ok(vm.runInContext('_HISTORY_SNAPSHOT_KEYS', c).includes('breakfastNote'), 'history snapshots keep it');
  assert.equal(c.snapshotResident({ room: '1', breakfastNote: 'oat milk only' }).breakfastNote, 'oat milk only');
  const d = out(c.diffResidentStates({ tags: [], breakfastNote: 'oat milk only' }, { tags: [] }));
  assert.deepEqual(d, [{ field: 'Breakfast note', from: 'oat milk only', to: '—' }], 'the diff');
  assert.match(fn('revertResident'), /if \(target\.breakfastNote === undefined\) delete r\.breakfastNote;/, 'revert takes off a note added since');
  // The two intake paths outside the Daily Entry queue: the Intake Portal commit and the direct save.
  assert.match(fn('commitIntakeQueue'), /doorApplyBreakfastNote\(r, q, q\.type === 'intake'\)/);
  assert.match(fn('saveDirectFromForm'), /doorApplyBreakfastNote\(r, \{ breakfastNote: formBreakfastNote \}, type === 'intake'\)/);
});

test('5. the forms: Enter Changes, the resident editor and the Intake Portal carry it; a filled box never rides to the next room', () => {
  for (const id of ['change-breakfast-note', 'ce-breakfast-note']) assert.ok(html.includes('id="' + id + '"'), id);
  const el = { value: '', dataset: { room: '' } };
  const c = core({ document: { getElementById: (id) => (id === 'change-breakfast-note' ? el : null) } });
  vm.runInContext(fn('doorFormBreakfastNote'), c);
  assert.equal(c.doorFormBreakfastNote('301z', 'update'), undefined, 'an empty box never filled for this room: keep the note');
  el.value = ' oat milk only '; assert.equal(c.doorFormBreakfastNote('301z', 'update'), 'oat milk only', 'typed: set it');
  el.value = ''; el.dataset.room = '301Z'; assert.equal(c.doorFormBreakfastNote('301z', 'update'), '', 'filled for this room and emptied: clear it');
  assert.equal(c.doorFormBreakfastNote('302z', 'update'), undefined, 'filled for another room: keep');
  el.value = 'oat milk only'; assert.equal(c.doorFormBreakfastNote('301z', 'discharge'), undefined, 'a discharge carries none');
  // Review fold (P2-1, P2-2): a box filled from one resident goes with no other room, and never with a new intake.
  el.value = 'oat milk only'; el.dataset.room = '301z';
  assert.equal(c.doorFormBreakfastNote('306z', 'update'), undefined, 'room retyped before the lookup ran: not sent with it');
  assert.equal(c.doorFormBreakfastNote('301z', 'intake'), undefined, 'switched to New intake: the new person gets none');
  assert.equal(c.doorFormBreakfastNote('301z', 'update'), 'oat milk only', 'the room it was filled for: sent');
  el.dataset.room = ''; assert.equal(c.doorFormBreakfastNote('307z', 'intake'), 'oat milk only', 'typed for a new intake: sent');
  assert.match(fn('lookupRoom'), /typeEl\.value !== 'update'/, 'the lookup clears a filled box once the type is not Update');
  // Second review: Edit empties the box before the lookup (an update shows the resident note), and an intake item's note
  // goes back unmarked, so re-adding it still sends it.
  const eq = fn('editQueueItem');
  assert.ok(eq.indexOf("bfEl0.value = ''") >= 0 && eq.indexOf("bfEl0.value = ''") < eq.indexOf('lookupRoom(item.room)'), 'Edit empties the box before the lookup');
  assert.match(eq, /bfEl\.dataset\.room = item\.type === 'update' \? item\.room : '';/, 'an intake item note goes back unmarked');
  el.value = 'oat milk only'; el.dataset.room = '';
  assert.equal(c.doorFormBreakfastNote('410z', 'intake'), 'oat milk only', 'an intake edited and re-added keeps its note');
  assert.match(fn('saveChangeEdit'), /v !== String\(bfEl\.dataset\.filled/, 'the editor writes the note only when it was changed there');
  // Every place the form becomes a change carries it; the lookup fills it and clears one filled for another room.
  assert.match(fn('addChange'), /item\.breakfastNote = breakfastNote/);
  assert.match(fn('addToIntakeQueue'), /queued\.breakfastNote = breakfastNote/);
  assert.match(fn('lookupRoom'), /bfEl\.value = ''; bfEl\.dataset\.room = '';/);
  assert.match(fn('lookupRoom'), /bfEl\.value = doorBreakfastNoteText\(exact\); bfEl\.dataset\.room = exact\.room;/);
  assert.match(fn('clearForm'), /bfEl\.value = ''; bfEl\.dataset\.room = '';/);
  // The resident editor: the queue item (or the resident on an update) when it opens; written on save.
  assert.match(fn('openChangeEditor'), /typeof c\.breakfastNote === 'string' \? c\.breakfastNote :/);
  assert.match(fn('openRegistryEditor'), /ce-breakfast-note/);
  assert.match(fn('saveChangeEdit'), /c\.breakfastNote = v;/);
  assert.match(fn('saveRegistryEdit'), /doorApplyBreakfastNote\(r, \{ breakfastNote \}, false\)/);
  assert.ok(fn('buildResidentDetailHTML').includes('Breakfast note: ${escapeHtml(doorBreakfastNoteText(r))}'), 'the resident card shows it, escaped');
});

test('6. two computers: a note saved on one reaches the other and survives its Generate', async () => {
  const { computer, kitchen, morning } = twoComputers(html, {
    extraSrc: CORE(),
    fns: ['saveRegistryEdit'], optFns: ['doorEditorChangesOnlyNotes'],
    ctx: (c) => ({
      ceRoom: '', RECENT_LOG: [], saveRecentLog() {}, closeChangeEditor() {}, getCETags: () => ({ vegetarian: true }),
      getTagLabels: () => ['Vegetarian'], getAnaphTagsFromEditor: () => [], routeResident: () => 'Vegan / Vegetarian', doorTodayMealFlags: () => ({}),
    }),
  });
  const { a, b } = await morning([R('301z', ['Vegetarian'], { rawRestriction: 'veggie, list words' }), R('305', ['Regular'])], []);
  a.__els['ce-anaph'] = { checked: false }; a.__els['ce-notes'] = { value: '' }; a.__els['ce-breakfast-note'] = { value: 'oat milk only' };
  a.ceRoom = '301z';
  vm.runInContext('ceRoom = "301z"', a);
  await a.saveRegistryEdit(); await a.__pending;
  const rec = (st, room) => (st.residents || st.reg).find((r) => r.room === room) || {};
  assert.equal(rec(kitchen.state, '301z').breakfastNote, 'oat milk only', 'sent with the list');
  // Review fold: a save that changes only the notes writes only the notes. The full save re-routes by the lunch served
  // today (here the stand-in says Vegan / Vegetarian) and rewrites the list words from the ticked boxes.
  assert.deepEqual([rec(kitchen.state, '301z').section, rec(kitchen.state, '301z').rawRestriction, 'anaphTags' in rec(kitchen.state, '301z')],
    ['Regular', 'veggie, list words', false], 'a note alone moves nobody and keeps the list words: ' + JSON.stringify(rec(kitchen.state, '301z')));
  b.__queue([intake('900', { regular: true })]); await b.__generate();
  assert.deepEqual([rec(kitchen.state, '301z').breakfastNote, rec(b.__state(), '301z').breakfastNote], ['oat milk only', 'oat milk only'],
    'B took the kitchen\'s newer list before its Generate, so the note stays');
  // A real tag change still saves in full (the stand-in boxes now tick No Pork too).
  a.getTagLabels = () => ['Vegetarian', 'No Pork']; vm.runInContext('getTagLabels = this.getTagLabels', a);
  a.__els['ce-breakfast-note'] = { value: 'oat milk only' };
  await a.saveRegistryEdit(); await a.__pending;
  assert.equal(rec(kitchen.state, '301z').section, 'Vegan / Vegetarian', 'a tag change re-routes as before');
  assert.equal(rec(kitchen.state, '301z').breakfastNote, 'oat milk only', 'and keeps the note');
  // Nothing changed: nothing is saved or sent.
  const sent = JSON.stringify(kitchen.state);
  await a.saveRegistryEdit(); await (a.__pending || Promise.resolve());
  assert.equal(JSON.stringify(kitchen.state), sent, 'an unchanged save sends nothing');
  void computer;
});

test('7. privacy: door_state.json carries it; registry_summary.json and the files Pages serves never do', () => {
  const c = { console, REGISTRY_LIST: [R('301z', ['Vegetarian'], { breakfastNote: 'oat milk only' })], anaphRooms: [], localStorage: { getItem: () => null },
    getOperatorName: () => 'JK', currentSite: { id: 'rexdale' } };
  vm.createContext(c);
  vm.runInContext([fn('doorIsAnaphResident'), fn('buildStateJSON'), fn('buildRegistrySummaryJSON'),
    'function doorAnaphTriggerSummary() { return { flags: [], tags: [], mapped: 0 }; }'].join('\n'), c);
  assert.equal(c.buildStateJSON().residents[0].breakfastNote, 'oat milk only', 'the kitchen file');
  assert.ok(!JSON.stringify(c.buildRegistrySummaryJSON()).includes('oat milk'), 'the served summary has no resident text');
  const pages = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const served = pages.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.ok(/menu_current\.json/.test(served) && !/door_state\.json/.test(served), 'Pages never serves door_state.json');
  // Not part of the count receipt: the note changes no plate or count.
  assert.ok(!fn('doorFlowRegistryInput').includes('breakfastNote'), 'the F4 registry input is unchanged');
});
