// tests/anaph_names_no_allergen_gate.mjs — a room on the anaphylactic list whose restriction names none of its allergens
// is asked about once, at Generate (2026-10-18). Room 813 read as anaphylactic from Sep 17 with "Regular" recorded, so
// DOOR had nothing to contain, and the meal list can't say who is anaphylactic: its "Regular" can't take a room off by
// itself. Jason, 2026-10-18: "yes let's build that", leaving 813 on the list to try it.
//   1. 813 as published today: Generate asks about 813 only; taken off, it is off on both computers, and the other
//      computer isn't asked
//   2. kept: the answer is stamped on the resident, travels with the list, and is asked again only when the restriction
//      changes
//   3. a resident replaced between two imports (an update, not a discharge): asked when the new restriction drops every
//      allergen the room is anaphylactic to, not when it keeps one
//   4. not asked: a room the queue discharges (the discharge question's), a listed room with no resident, one the queue
//      moves, one whose restriction names an allergen DOOR has no flag for
//   5. a room kept on the list at its discharge is asked about when a resident naming no allergen moves in
//   6. the Review screen names the room; the anaphylactic picker reads the same allergen rule
//   7. Generate takes the kitchen's newer list, asks the discharge question, then this one, then snapshots for Undo and
//      applies the queue with the answers
// Authored to fail on main cef6cc4 (1–7). Env: ANAPH_NAMES_NONE_HTML (another index.html, e.g. main's).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { twoComputers, out, R, discharge, intake } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.ANAPH_NAMES_NONE_HTML || new URL('../index.html', import.meta.url), 'utf8');
const { computer, kitchen, morning, fn } = twoComputers(html);
const update = (room, tags) => ({ room, type: 'update', tags, tagLabels: [], route: 'Regular', notes: 'From daily list import', isAnaph: false, isModerate: false, moderateNote: '', hadSection: 'Regular' });
const rec = (state, room) => (state.residents || state.reg).find((r) => r.room === room) || {};
const keepAll = (c) => { c.doorAsk = async (o) => { c.__asked.push({ title: o.title, lines: o.lines || [] }); return false; }; };
// One computer on its own: no kitchen file, so Generate's first step takes nothing from an earlier test.
const alone = (answer, reg, rooms) => { kitchen.state = null; kitchen.down = false; const c = computer('t', answer); c.__set(reg, rooms); return c; };
const asked = (c, room) => c.__asked.filter((q) => q.title === 'Room ' + room + ' is anaphylactic');

// The four listed rooms as door_state.json published them (2026-10-16 14:39, Joan Wandera), and two others.
const PUBLISHED = () => [
  R('213', ['Soft Meals', 'No Tree Nuts', 'No Corn', 'No Coconut'], { section: 'Soft Meals', isAnaph: false, anaphTags: ['noCoconut', 'noTreeNuts'], allergenFlags: ['No Tree Nuts', 'No Coconut'], avoidances: ['No Tree Nuts', 'No Coconut', 'No Corn'] }),
  R('1213', ['Diabetic', 'No Peanuts'], { section: 'Diabetic', isAnaph: true, allergenFlags: ['No Peanuts'], avoidances: ['No Peanuts'] }),
  R('607a', ['No Dairy', 'No Peanuts'], { section: 'Anaphylactic Alternative', isAnaph: true, anaphTags: ['noPeanuts'], allergenFlags: ['No Peanuts'], avoidances: ['No Peanuts'] }),
  R('813', ['Regular'], { isAnaph: false, allergenFlags: [], avoidances: [] }),
  R('305', ['Regular']), R('912', ['GF', 'No Pork'], { section: 'Gluten Free' }),
];
const ROOMS = () => ['213', '813', '607a', '1213'];

test('1. 813 as published: Generate asks about 813 only; taken off, it is off on both computers', async () => {
  const { a, b } = await morning(PUBLISHED(), ROOMS());
  a.__queue([update('305', { softMeals: true })]);   // the day's import: nothing for 813
  await a.__generate();
  assert.deepEqual(a.__asked.map((q) => q.title), ['Room 813 is anaphylactic'], 'asked once, about 813 only');
  assert.match(a.__asked[0].lines[0], /on the anaphylactic list, but its restriction names no allergen \(now: Regular\), so DOOR has nothing to keep out of its meals/);
  assert.deepEqual([out(kitchen.state.anaphRooms), rec(kitchen.state, '813').isAnaph, out(rec(kitchen.state, '813').anaphTags)], [['213', '607a', '1213'], false, []],
    'off the list in the kitchen');
  await b.pullStateFromGitHub(false);
  b.__queue([intake('900', { regular: true })]); await b.__generate();
  assert.deepEqual([b.__asked.length, kitchen.state.anaphRooms.includes('813'), out(b.__state().rooms).includes('813')], [0, false, false],
    'the other computer isn\'t asked and 813 stays off');
});

test('2. kept: stamped on the resident, travels with the list, asked again only when the restriction changes', async () => {
  const { a, b } = await morning(PUBLISHED(), ROOMS());
  keepAll(a);
  await a.__generate();
  const stamp = rec(kitchen.state, '813').anaphListKept;
  assert.ok(kitchen.state.anaphRooms.includes('813') && stamp && stamp.by === 'JK' && stamp.at, 'kept, stamped: ' + JSON.stringify(stamp));
  await a.__generate();
  assert.equal(asked(a, '813').length, 1, 'not asked again on this computer');
  await b.pullStateFromGitHub(false);
  await b.__generate();
  assert.equal(b.__asked.length, 0, 'nor on the other');
  b.__queue([update('813', { softMeals: true })]);   // the restriction changes, still no allergen
  await b.__generate();
  assert.equal(asked(b, '813').length, 1, 'asked again');
  assert.match(asked(b, '813')[0].lines[0], /\(now: Soft Meals\)/);
  assert.ok(!kitchen.state.anaphRooms.includes('813'), 'and taken off (B\'s answer)');
});

test('3. a resident replaced between two imports: asked when the new restriction drops every allergen the room is anaphylactic to', async () => {
  const LISTED = () => [R('1104', ['GF', 'No Shellfish'], { isAnaph: true, anaphTags: ['noShellfish'] }), R('305', ['Regular'])];
  const off = alone(true, LISTED(), ['1104']);
  off.__queue([update('1104', {})]); await off.__generate();
  assert.equal(asked(off, '1104').length, 1, 'asked');
  assert.match(asked(off, '1104')[0].lines[0], /on the anaphylactic list for shellfish, but its restriction doesn’t say No Shellfish any more \(now: Regular\)/);
  assert.deepEqual([out(off.__state().rooms), rec(off.__state(), '1104').isAnaph, out(rec(off.__state(), '1104').anaphTags)], [[], false, []], 'off, flag and tags cleared');
  // Another allergy: still asked (DOOR contains shellfish for a resident whose list no longer says it).
  const other = alone(false, LISTED(), ['1104']);
  other.__queue([update('1104', { noPeanuts: true })]); await other.__generate();
  assert.equal(asked(other, '1104').length, 1, 'asked about another allergy');
  assert.ok(out(other.__state().rooms).includes('1104') && rec(other.__state(), '1104').anaphListKept, 'kept and stamped');
  // The allergen stays: not asked.
  const same = alone(true, LISTED(), ['1104']);
  same.__queue([update('1104', { noShellfish: true, diabetic: true })]); await same.__generate();
  assert.equal(same.__asked.length, 0, 'not asked while it still names shellfish');
});

test('4. not asked: a discharged room (its own question), a vacant room, a room the queue moves, an allergen DOOR has no flag for', async () => {
  const c = alone(false, [
    R('813', ['GF', 'No Shellfish'], { isAnaph: true, anaphTags: ['noShellfish'] }),
    R('1400', ['Regular']), R('1300', ['No Oats']), R('305', ['Regular']),
  ], ['813', '700', '1400', '1300']);
  c.__queue([discharge('813'), { room: '1400', type: 'switch', tags: {}, tagLabels: [], route: '→ 1401', notes: '', isAnaph: false }]);
  const found = c.doorAnaphRoomsNamingNoAllergen(c.__state().reg, c.__state().rooms, c.changesQueue);
  assert.deepEqual(out(found), [], 'none: ' + JSON.stringify(found));
  await c.doorAskDischargedAnaphRooms(c.changesQueue);
  await c.doorAskAnaphRoomsNamingNoAllergen(c.changesQueue);
  assert.equal(c.__asked.length, 1, 'asked once: ' + JSON.stringify(c.__asked));
  assert.match(c.__asked[0].lines[0], /^Room 813 leaves today’s list\./, 'the discharge question only');
});

test('5. a room kept on the list at its discharge is asked about when a resident naming no allergen moves in', async () => {
  const c = alone(false, [R('813', ['GF', 'No Shellfish'], { isAnaph: true, anaphTags: ['noShellfish'] }), R('305', ['Regular'])], ['813']);
  c.__queue([discharge('813')]); await c.__generate();   // Sep 11: kept on the list
  assert.deepEqual([c.__asked.length, out(c.__state().rooms)], [1, ['813']], 'the discharge question, kept');
  c.__queue([intake('813', { regular: true })]); await c.__generate();   // Sep 17: a Regular resident moves in
  assert.equal(c.__asked.length, 2, 'asked once more');
  assert.match(c.__asked[1].lines[0], /Room 813 is on the anaphylactic list, but its restriction names no allergen \(now: Regular\)/);
});

test('6. the Review screen names the room; the anaphylactic picker reads the same allergen rule', () => {
  const review = fn('buildReview');
  assert.match(review, /const anaphNamingNone = doorAnaphRoomsNamingNoAllergen\(REGISTRY_LIST, anaphRooms, changesQueue\);\s*const totalFlags = flags \+ anaphAlerts\.length \+ anaphNamingNone\.length;/, 'counted with the flags');
  assert.match(review, /anaphNamingNone\.map\([\s\S]{0,400}is on the anaphylactic list, but its restriction names[\s\S]{0,300}Generate asks whether to take it off the list/, 'and listed');
  const picker = fn('populateAnaphTags');
  assert.equal((picker.match(/doorIsAnaphAllergenTag\(label\)/g) || []).length, 2, 'the picker uses the one rule');
  assert.ok(!/'No Beef','GF'\]/.test(picker), 'no second copy of the list');
});

test('7. Generate: the kitchen\'s list, the discharge question, this question, the Undo snapshot, then the queue with the answers', () => {
  const gen = fn('generateFiles');
  const at = (s) => gen.indexOf(s);
  const order = [at('await doorTakeNewerKitchenList()'), at('await doorAskDischargedAnaphRooms(changesQueue)'),
    at('anaphListAnswers = await doorAskAnaphRoomsNamingNoAllergen(changesQueue)'), at("localStorage.setItem('concRegistrySnapshot'"),
    at('applyQueueToRegistry(anaphListAnswers)')];
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), 'in order: ' + order);
  assert.match(gen, /anaphListAnswers\.filter\(a => a\.off\)[\s\S]{0,400}Taken off the anaphylactic list/, 'the change log names it');
  const apply = fn('applyQueueToRegistry');
  assert.ok(apply.indexOf('doorApplyAnaphListAnswers(anaphListAnswers)') > 0 && apply.indexOf('doorApplyAnaphListAnswers(anaphListAnswers)') < apply.lastIndexOf('saveRegistryState()'), 'applied before the list is saved');
});
