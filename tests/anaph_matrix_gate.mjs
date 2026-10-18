// tests/anaph_matrix_gate.mjs — anaphylaxis, every tag × every flag × every way of being anaphylactic (2026-10-18, audit A3).
// The rules (docs/DOOR_ROUTING_RULES_2026-10-18.md §5; tests/helpers/routing_oracle.mjs): a resident is anaphylactic by
// their flag or their room on the list; their anaphylactic tags (or every tag when none are picked) contain their room
// and roommates on a meal that sets one off; one meal at a time (Jason, 2026-10-18: "Per meal everywhere"); and no path
// takes a room off the list without a deliberate act, asked once (Jason: "List removal clears the flag").
// Runs the REAL readers and the REAL list, queue and Intake Portal paths from index.html in a vm, beside the oracle.
// Authored to fail on main 66e0bec:
//   - routeResident contained a room for lunch when the allergen was at dinner;
//   - the list's Remove asked nothing and left the resident's flag set;
//   - an Intake Portal update read its toggle by a class it never has, so it took the room off the list (and the
//     flag) even with the toggle on; a Daily Entry update reset the flag; a room switch left the list on the old room.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ANAPH_FLAGS, anaphContained, anaphSetOff, isAnaph } from './helpers/routing_oracle.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) {
  const m = html.match(new RegExp('\\n(async )?function ' + name + '\\('));
  assert.ok(m, 'missing ' + name);
  const s = m.index + 1; const e = html.indexOf('\n}\n', s); return html.slice(s, e) + '\n}\n';
}
const fnOpt = (name) => (new RegExp('\\n(async )?function ' + name + '\\(').test(html) ? fn(name) : '');
const TAG_LABELS = html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0];
const LABEL_OF = vm.runInNewContext(TAG_LABELS + ';TAG_LABELS_MAP');
const KEY_OF = Object.fromEntries(Object.entries(LABEL_OF).map(([k, v]) => [v, k]));
const out = (v) => JSON.parse(JSON.stringify(v));

const SRC = [
  TAG_LABELS, between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
  between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
  between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
  fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fnOpt('doorAskTakeOffAnaphList'), fn('getAnaphConflictRooms'),
  fn('getAnaphAlertInfo'), fn('routeResident'), fn('doorAnaphMealLines'),
  fn('removeAnaphRoom'), fn('applyQueueToRegistry'), fn('commitIntakeQueue'),
  'this.__set = (reg, rooms, meals) => { REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...reg); REGISTRY_MAP = {}; reg.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; }); anaphRooms = rooms; if (meals) MEAL_DATA = meals; };',
  'this.__state = () => ({ rooms: anaphRooms, reg: REGISTRY_LIST });',
].join('\n');
function box(answer = true) {
  const asked = [];
  const c = {
    console, REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], MEAL_DATA: { lunch: {}, dinner: {} }, changesQueue: [], INTAKE_QUEUE: [],
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    doorAsk: async (o) => { asked.push(o.title); return answer; }, showToast() {}, renderAnaphList() {}, saveRegistryState() {}, publishAndSync() {},
    saveIntakeQueue() {}, renderIntakeQueue() {}, renderRecentLog() {}, logQueueCommit() {}, pushResidentHistory() {}, clearResidentHistory() {},
    dedupeServiceNote: (a, b) => b || a, filterServiceNote: (a, b) => b || a, getOperatorName: () => 'test', setRegistryProvenance() {},
    doorApplyPendingImportStamp() {}, requiresDocumentation: () => false,
  };
  vm.createContext(c);
  vm.runInContext(SRC, c, { filename: 'index.html#anaph-matrix', timeout: 20000 });
  c.__asked = asked;
  return c;
}

// ── the matrix ──────────────────────────────────────────────────────────────────────────────────────────────────
const TAGS = Object.keys(ANAPH_FLAGS);
const FLAGS = [...new Set(Object.values(ANAPH_FLAGS).flat()), 'hasPork', 'isSpicy'];
const WAYS = ['flag + picked', 'list + picked', 'flag, none picked', 'list, none picked'];
function roster(tag, way, i) {
  const base = String(300 + i);
  const a = { room: base + 'a', tags: [tag, 'No Pork'] };
  if (way.startsWith('flag')) a.isAnaph = true;
  if (way.endsWith('picked') && !way.includes('none')) a.anaphTags = [KEY_OF[tag]];
  const rooms = way.startsWith('list') ? [a.room] : [];
  return { a, residents: [a, { room: base + 'B', tags: ['Regular'] }, { room: base + '1', tags: ['Regular'] }, { room: '999', tags: [tag] }], rooms };
}

test('lockout, the alert, routing and the display read each anaphylactic tag on its own flags, one meal at a time', () => {
  const c = box();
  const bad = [];
  let cases = 0;
  TAGS.forEach((tag, i) => WAYS.forEach((way) => FLAGS.forEach((flag) => {
    const { a, residents, rooms } = roster(tag, way, i);
    const meal = { [flag]: true };
    c.__set(residents.map((r) => ({ ...r })), [...rooms], { lunch: meal, dinner: {} });
    cases++;
    const got = out([...c.getAnaphConflictRooms(meal, {})]).sort();
    const want = residents.filter((r) => anaphContained(r.room, residents, rooms, meal, LABEL_OF)).map((r) => r.room).sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${tag} / ${way} / ${flag}: lockout ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
    const alerts = out(c.getAnaphAlertInfo(meal, {})).map((x) => x.anaphRoom + ':' + x.allergen).sort();
    const wantAlerts = anaphSetOff(a, meal, LABEL_OF).map((t) => a.room + ':' + t).sort();
    if (JSON.stringify(alerts) !== JSON.stringify(wantAlerts)) bad.push(`${tag} / ${way} / ${flag}: alert ${JSON.stringify(alerts)} ≠ ${JSON.stringify(wantAlerts)}`);
    const display = out(c.getAnaphDisplayAllergens(a, meal)).sort();
    if (JSON.stringify(display) !== JSON.stringify(anaphSetOff(a, meal, LABEL_OF).sort())) bad.push(`${tag} / ${way} / ${flag}: display ${JSON.stringify(display)}`);
    const keys = Object.fromEntries(a.tags.map((t) => [KEY_OF[t], true]));
    const route = c.routeResident(keys, meal, a.room, !!a.isAnaph);
    if ((route === 'Anaphylactic Alternative') !== want.includes(a.room)) bad.push(`${tag} / ${way} / ${flag}: routeResident ${route}`);
    const mate = c.routeResident({}, meal, residents[1].room, false);
    if ((mate === 'Anaphylactic Alternative') !== want.includes(residents[1].room)) bad.push(`${tag} / ${way} / ${flag}: roommate routes ${mate}`);
  })));
  assert.ok(cases >= 900, cases + ' cases');
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' disagreements');
});

test('one meal at a time: a dinner-only allergen leaves lunch alone in routeResident (F1)', () => {
  const c = box();
  const r213 = { room: '213', tags: ['Soft Meals', 'No Tree Nuts', 'No Coconut'], anaphTags: ['noCoconut', 'noTreeNuts'] };
  const lunch = { hasGluten: true }, dinner = { hasCoconut: true, hasTreeNuts: true };
  c.__set([{ ...r213 }, { room: '213b', tags: ['Regular'] }], ['213'], { lunch, dinner });
  const tags = { softMeals: true, noTreeNuts: true, noCoconut: true };
  assert.equal(c.routeResident(tags, lunch, '213', false), 'Soft Meals', 'lunch: the soft plate, as the lunch sheet seats it');
  assert.equal(c.routeResident(tags, dinner, '213', false), 'Anaphylactic Alternative', 'dinner: contained');
  assert.equal(c.routeResident({}, lunch, '213b', false), 'Regular', 'the roommate, at lunch');
  assert.equal(c.routeResident({}, dinner, '213b', false), 'Anaphylactic Alternative', 'the roommate, at dinner');
  assert.equal(c.routeResident({ noPeanuts: true }, lunch, '999', true), 'Regular', 'a flagged resident on a meal without their allergen');
});

test('the anaphylactic list\'s Remove asks once, and takes the flag and the picked tags with the room (F7)', async () => {
  const keep = box(false);
  keep.__set([{ room: '607a', tags: ['No Peanuts'], isAnaph: true, anaphTags: ['noPeanuts'] }], ['607a', '213']);
  await keep.removeAnaphRoom('607a');
  assert.deepEqual(keep.__asked.length, 1, 'asked once');
  let st = out(keep.__state());
  assert.deepEqual([st.rooms, st.reg[0].isAnaph], [['607a', '213'], true], '"Keep it anaphylactic" changes nothing');
  const off = box(true);
  off.__set([{ room: '607a', tags: ['No Peanuts'], isAnaph: true, anaphTags: ['noPeanuts'] }], ['607a', '213']);
  await off.removeAnaphRoom('607a');
  st = out(off.__state());
  assert.deepEqual([st.rooms, st.reg[0].isAnaph, st.reg[0].anaphTags], [['213'], false, []], 'off the list, and no longer contained by its flag');
  assert.equal(isAnaph(st.reg[0], st.rooms), false, 'the oracle agrees: not anaphylactic');
});

test('the Daily Entry queue: an update keeps the resident anaphylactic unless it was taken off; a switch takes the list along', () => {
  const run = (change, reg, rooms) => { const c = box(); c.__set(reg.map((r) => ({ ...r })), [...rooms]); c.changesQueue.push(change); c.applyQueueToRegistry(); return out(c.__state()); };
  const r607a = { room: '607a', tags: ['No Peanuts'], isAnaph: true, anaphTags: ['noPeanuts'], section: 'Regular' };
  let st = run({ room: '607a', type: 'update', tags: { noPeanuts: true, noDairy: true }, route: 'Regular', isAnaph: false }, [r607a], ['607a']);
  assert.deepEqual([st.reg[0].isAnaph, st.rooms], [true, ['607a']], 'an import\'s update (isAnaph false, nothing asked) keeps the flag');
  st = run({ room: '607a', type: 'update', tags: { noPeanuts: true }, route: 'Regular', isAnaph: false, anaphCleared: true }, [r607a], ['607a']);
  assert.deepEqual([st.reg[0].isAnaph, st.rooms], [false, []], 'taken off when asked');
  st = run({ room: '213', type: 'switch', route: '→ 410', tags: {} }, [{ room: '213', tags: ['No Coconut'], anaphTags: ['noCoconut'] }, { room: '305', tags: ['Regular'] }], ['213', '1213']);
  assert.deepEqual([st.reg[0].room, st.rooms.sort()], ['410', ['1213', '410']], 'the list follows 213 to room 410');
});

test('the Intake Portal: an update keeps the resident anaphylactic unless it was taken off, asked', async () => {
  const run = async (q, reg, rooms) => { const c = box(true); c.__set(reg.map((r) => ({ ...r })), [...rooms]); c.INTAKE_QUEUE.push(q); await c.commitIntakeQueue(); return out(c.__state()); };
  const r213 = { room: '213', tags: ['Soft Meals', 'No Tree Nuts', 'No Coconut'], isAnaph: false, anaphTags: ['noCoconut', 'noTreeNuts'] };
  const upd = { id: 'q1', type: 'update', room: '213', tags: ['Soft Meals', 'No Tree Nuts', 'No Coconut', 'No Corn'], isAnaph: false, route: 'Soft Meals' };
  let st = await run(upd, [r213], ['213']);
  assert.deepEqual([st.rooms, st.reg[0].isAnaph], [['213'], true], 'an older queued update (no answer recorded) keeps 213 on the list');
  st = await run({ ...upd, anaphCleared: true }, [r213], ['213']);
  assert.deepEqual([st.rooms, st.reg[0].isAnaph], [[], false], 'taken off when asked');
  st = await run({ ...upd, isAnaph: true }, [r213], ['213']);
  assert.deepEqual([st.rooms, st.reg[0].isAnaph], [['213'], true]);
});

test('the Enter Changes form reads its anaphylactic toggle as it is, and an update starts it from the resident', () => {
  const toggleReads = html.match(/getElementById\('anaph-toggle'\)[^\n]*?classList\.contains\('(\w+)'\)/g) || [];
  assert.ok(toggleReads.length >= 2, 'the readers were found: ' + toggleReads.length);   // addToIntakeQueue, saveDirectFromForm
  assert.deepEqual(toggleReads.filter((x) => !x.includes("contains('on')")), [], 'every reader asks for "on", the class toggleAnaph sets');
  assert.match(html, /classList\.toggle\('on', anaphActive\)/, 'toggleAnaph sets "on"');
  const lookup = fn('lookupRoom');
  assert.match(lookup, /prePopulateCheckboxes\(exact\.tags\);[\s\S]{0,300}anaphActive = doorIsAnaphResident\(exact\)/, 'an update starts the toggle from the resident');
  for (const name of ['addChange', 'addToIntakeQueue', 'saveDirectFromForm']) {
    assert.match(fn(name), /doorAskTakeOffAnaphList\(/, name + ' asks before taking an anaphylactic resident off');
  }
});

test('an anaphylactic resident with no restriction recorded still gets a red label and a place on the restriction sheet (813)', () => {
  // Found by the browser replay (tests/browser/routing_replay.mjs): every label and sheet chose residents by a non-Regular
  // tag, so 813 (on the list, tags Regular) had no label at all.
  for (const name of ['printLabels', 'buildLabelsXlsx', 'buildRestrictionListXlsx']) {
    const body = fn(name);
    assert.match(body, /every\(t => t === 'Regular'\)\)[^\n]*doorIsAnaphResident\(r\)/, name + ' includes an anaphylactic Regular resident');
  }
});

test('the load-time tidy: a Regular resident left Provisional reads N/A; an anaphylactic one stays Provisional (Jason: "Tidy to N/A")', () => {
  const body = between('(function autoPromoteAutoTier() {', '\n})();') + '\n})();';
  const run = (reg, rooms) => {
    const c = { REGISTRY_LIST: reg, anaphRooms: rooms, saveRegistryState() {}, console: { log() {} },
      requiresDocumentation: (tags) => tags.some((t) => ['No Peanuts', 'GF'].includes(t)) };
    vm.createContext(c);
    vm.runInContext(fn('doorIsAnaphResident') + body, c);
    return reg.map((r) => r.room + ':' + r.confirm);
  };
  assert.deepEqual(run([
    { room: '312', tags: ['Regular'], confirm: 'Provisional', confirmBy: '—' },
    { room: '813', tags: ['Regular'], confirm: 'Provisional', confirmBy: '—' },
    { room: '405', tags: ['Vegetarian'], confirm: 'Provisional' },
    { room: '607a', tags: ['No Peanuts'], confirm: 'Provisional' },
  ], ['813']), ['312:N/A', '813:Provisional', '405:Confirmed', '607a:Provisional']);
});

// The routing audit's independent review (2026-10-18, FIX-BEFORE-SHIP, folded):
test('review P1: a new intake over an occupied room starts the new resident\'s anaphylactic state fresh', async () => {
  const c = box(true);
  c.__set([{ room: '213', tags: ['Soft Meals', 'No Tree Nuts', 'No Coconut'], isAnaph: false, anaphTags: ['noCoconut', 'noTreeNuts'], isModerate: true, serviceNote: 'No Popcorn' }], ['213']);
  c.INTAKE_QUEUE.push({ id: 'q1', type: 'intake', room: '213', tags: ['No Peanuts'], isAnaph: true, route: 'Regular', isOverwrite: true });
  await c.commitIntakeQueue();
  const r = out(c.__state()).reg[0];
  assert.deepEqual([r.isAnaph, r.anaphTags, r.isModerate, r.serviceNote], [true, [], false, ''], 'nothing carried from the last resident');
  assert.deepEqual(out([...c.getAnaphConflictRooms({ hasPeanuts: true }, {})]), ['213'], 'contained on the new resident\'s peanuts');
  assert.match(fn('saveDirectFromForm'), /type === 'intake' && existing\) \{ r\.anaphTags = \[\]/, 'the direct save does the same');
});

test('review P1/P2/P3: the Enter Changes and queue editors keep what they were told', () => {
  const edit = fn('editQueueItem');
  assert.match(edit, /clearTimeout\(lookupDebounce\);\s*lookupRoom\(item\.room\);\s*prePopulateCheckboxes\(item\.tags[^)]*\);\s*anaphActive = !!item\.isAnaph/,
    'editing a queued item looks the room up first, then puts back the item\'s own tags and toggle');
  assert.doesNotMatch(edit, /data-tag=/, 'no reader of markup the form does not have');
  const save = fn('saveChangeEdit');
  assert.match(save, /doorAskTakeOffAnaphList\(resident\.room\)/, 'the queue editor asks before taking a resident off');
  assert.match(save, /c\.anaphCleared = false/, 'ticked again, the change no longer takes the room off');
  assert.match(fn('lookupRoom'), /if \(_doorAnaphPrefilled\) \{[\s\S]{0,200}anaphActive = false/, 'a pre-filled toggle does not ride to the next room');
  assert.match(fn('toggleAnaph'), /_doorAnaphPrefilled = null/, 'a toggle someone touched stays as they set it');
});

test('review P2: every swap and special-meal "today" is the kitchen\'s local day', () => {
  for (const name of ['renderTodayMealContext', 'clearAllSwaps', 'renderSwapsBanner', 'getSpecialsForRotationSlot', 'getPersistedSwapForSlot',
    'renderSpecialsBanner', 'clearPastSpecials', 'clearPastSwaps', 'applyMealSwap', 'makePermanent', 'revertMealSwap', 'executeSlotSwap', 'openMealEdit', '_finishMenuSave', 'getMealForDate']) {
    assert.doesNotMatch(fn(name), /toISOString\(\)\.slice\(0, ?10\)/, name + ' reads a UTC date');
  }
  assert.doesNotMatch(between("fetch(base+'meal_swaps.json'+bust)", '\n'), /toISOString/, 'the boot swap sync');
});

test('review P2: today\'s sections follow the resident list; the previews list 813', () => {
  assert.match(fn('saveRegistryState'), /doorRefreshBaseSections\(\);\s*\}\s*$/, 'after every save');
  assert.match(fn('loadRegistryState'), /doorRefreshBaseSections\(\)/, 'after the saved list is read');
  const demo = fn('openDemoFile');
  assert.equal((demo.match(/\|\| doorIsAnaphResident\(r\)\)\.sort/g) || []).length, 2, 'both previews include an anaphylactic Regular resident');
});
