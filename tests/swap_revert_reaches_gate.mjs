// tests/swap_revert_reaches_gate.mjs — a swap revert reaches every DOOR computer; a slot swap's halves land together
// (2026-10-18, Jason: "Remove it" on the Nov 3 swap, and "Fix in DOOR" on the slot swap).
//
// The Nov 3 lunch swap (Halal Beef Burger in Wk2 TUE's slot) was left over from Oct 7: someone swapped Wk2 TUE ⇄ THU
// lunch on a Wednesday, then set the rotation back to the workbook order. The slot swap gave each half its own next
// date, so Thursday's half landed on Oct 8 and Tuesday's four weeks out, on Nov 3. And a revert never reached the
// other DOOR computers: each keeps its own copy of the swaps and merges the kitchen's file into it, so the next one to
// publish put the swap back.
//
// Now a revert is published (meal_swaps_reverted.json, key → when), every sync merges the kitchen's list in before the
// swaps, and a swap made before its key's revert is dropped on every computer (one made after it is kept). A slot
// swap's two dates are as far apart as the two meals are on the menu, on the first such pair still ahead.
//
// Authored red on main 8c4c734: none of the swap-store functions exist, the publish sends no revert list, and the
// published file still holds the Nov 3 swap. DOOR_GATE_HTML=<path> runs the gate against another copy of index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(process.env.DOOR_GATE_HTML || path.join(root, 'index.html'), 'utf8');
const J = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const plain = x => JSON.parse(JSON.stringify(x)); // objects built inside the vm compare by value
const between = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, 'missing ' + a); const j = html.indexOf(b, i); return html.slice(i, j); };
function blockFrom(start) {
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
  return html.slice(start, i);
}
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'could not find function ' + name);
  return blockFrom(m.index);
}
const core = () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(between('/* DOOR_TESTABLE_CORE_START swap-store */', '/* DOOR_TESTABLE_CORE_END swap-store */'), ctx);
  return ctx;
};

// The Nov 3 swap as DOOR recorded it on Oct 7, and its key.
const NOV3 = '2026-11-03-lunch';
const RECORDED = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/meal_swap_2026-11-03_recorded.json'), 'utf8'))[NOV3];

test('1. a revert drops a swap made before it, and keeps one made after it', () => {
  const c = core();
  const rev = { [NOV3]: '2026-10-18T15:00:00.000Z' };
  assert.equal(c.doorSwapRevertedOver(NOV3, RECORDED, rev), true, 'the Oct 7 swap is reverted');
  assert.equal(c.doorSwapRevertedOver(NOV3, { ...RECORDED, createdAt: '2026-10-19T09:00:00.000Z' }, rev), false, 'made again after the revert');
  assert.equal(c.doorSwapRevertedOver(NOV3, { specialName: 'x' }, rev), true, 'no creation time: the revert wins');
  assert.equal(c.doorSwapRevertedOver('2026-11-05-lunch', RECORDED, rev), false, 'another key');
});

test('2. a computer that still holds the swap drops it at its next sync, and so never publishes it again', () => {
  const c = core();
  const today = '2026-10-18';
  const rev = { [NOV3]: '2026-10-18T15:00:00.000Z' };
  // computer B: its own copy has the swap; the kitchen's file (after A's revert) does not
  const merged = c.doorMergeSwapStores({ [NOV3]: RECORDED }, {}, rev, today);
  assert.deepEqual(Object.keys(merged), [], 'B drops it');
  // the old merge (no revert list) kept B's copy, which B's next publish sent back
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({ [NOV3]: RECORDED }, {}, {}, today)), [NOV3]);
  // a swap B makes again after the revert survives A's list, on both sides
  const again = { ...RECORDED, createdAt: '2026-10-19T09:00:00.000Z' };
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({ [NOV3]: again }, {}, rev, today)), [NOV3]);
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({}, { [NOV3]: again }, rev, today)), [NOV3]);
  // past dates leave; the file wins a key both hold
  const past = { '2026-10-08-lunch': { specialName: 'Tuna', createdAt: '2026-10-07T13:36:46.682Z' } };
  assert.deepEqual(Object.keys(c.doorMergeSwapStores(past, past, {}, today)), [], 'Oct 8 has passed');
  const k = '2026-11-10-dinner';
  assert.equal(c.doorMergeSwapStores({ [k]: { specialName: 'mine' } }, { [k]: { specialName: 'kitchen' } }, {}, today)[k].specialName, 'kitchen');
});

test('3. two revert lists merge: a key both hold keeps its later time; past dates leave', () => {
  const c = core();
  const m = c.doorMergeSwapReverts({ [NOV3]: '2026-10-18T15:00:00.000Z', '2026-10-01-lunch': '2026-09-30T10:00:00.000Z' },
    { [NOV3]: '2026-10-19T08:00:00.000Z', '2026-11-05-lunch': '2026-10-18T16:00:00.000Z', 'x': 5 }, '2026-10-18');
  assert.deepEqual(plain(m), { [NOV3]: '2026-10-19T08:00:00.000Z', '2026-11-05-lunch': '2026-10-18T16:00:00.000Z' });
});

// The revert-list factory in a vm: localStorage, the timer, fetch (the kitchen's list) and the publish are stubbed.
function revertList(stored, remote) {
  const store = { concRevertedSwapKeys: JSON.stringify(stored) };
  const sent = [], timers = [];
  const ctx = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    fetch: async () => ({ ok: !!remote, json: async () => remote }),
    PublishAuth: { getRepo: () => 'kennedyjasondavid-eng/conc-kitchen-door', sidePublish: (p, content, label, visible) => { sent.push({ p, content: JSON.parse(content), visible }); } },
    Date, JSON, Object, Set, String, Array, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(between('/* DOOR_TESTABLE_CORE_START swap-store */', '/* DOOR_TESTABLE_CORE_END swap-store */') + '\n' +
    fnBlock('doorMakeRevertList') + '\nvar R = doorMakeRevertList("concRevertedSwapKeys", "meal_swaps_reverted.json", "Swap reverts");', ctx);
  const flush = async () => { for (const f of timers.splice(0)) await f(); };
  return { R: ctx.R, store, sent, flush };
}

test('4. the revert list keeps when each key was reverted, reads the older list of keys, and is sent quietly', async () => {
  const { R, store, sent, flush } = revertList([NOV3, '2026-01-01-lunch'], null);
  // the older list: the future key reads as reverted now; the past one leaves
  const pub = R.toPublished();
  assert.deepEqual(plain(Object.keys(pub)), [NOV3]);
  assert.match(pub[NOV3], /^\d{4}-\d\d-\d\dT/);
  assert.equal(R.has(NOV3), true, 'Set API kept');
  // the kitchen's list merged in: a later time wins, nothing is sent back
  R.mergeRemote({ [NOV3]: '2999-01-01T00:00:00.000Z', '2999-02-02-dinner': '2026-10-18T16:00:00.000Z' });
  assert.equal(R.toPublished()[NOV3], '2999-01-01T00:00:00.000Z');
  assert.equal(R.has('2999-02-02-dinner'), true);
  await flush();
  assert.equal(sent.length, 0, 'a merge sends nothing');
  // a revert here: stored with its time, and the list sent once, quietly
  R.add('2999-03-03-lunch'); R.add('2999-03-04-lunch');
  await flush();
  assert.equal(sent.length, 1, 'one send for the two reverts');
  assert.equal(sent[0].p, 'meal_swaps_reverted.json');
  assert.equal(sent[0].visible, false);
  assert.deepEqual(Object.keys(sent[0].content).sort(), [NOV3, '2999-02-02-dinner', '2999-03-03-lunch', '2999-03-04-lunch'].sort());
  assert.deepEqual(JSON.parse(store.concRevertedSwapKeys), plain(R.toPublished()), 'stored as key → time');
  // making the swap again takes its key off
  R.delete('2999-03-03-lunch');
  assert.equal(R.has('2999-03-03-lunch'), false);
  assert.equal('2999-03-03-lunch' in R.toPublished(), false);
});

test('4b. review P1: a computer that has not synced never sends a shorter revert list', async () => {
  // computer B holds no revert; the kitchen's list has A's Nov 3 revert. B reverts another swap: what B sends holds both.
  const { R, sent, flush } = revertList([], { [NOV3]: '2026-10-18T15:00:04.730Z' });
  R.add('2999-05-05-dinner');
  await flush();
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0].content).sort(), [NOV3, '2999-05-05-dinner'].sort(), 'the kitchen\'s revert survives B\'s send');
  // the full publish merges the kitchen's files before staging the swaps and both lists
  const pub = fnBlock('_doPublishToGitHub');
  const iMerge = pub.indexOf('await preMergeSwapsWithCloud(creds);'), iSwaps = pub.indexOf("_push('meal_swaps.json'");
  assert.ok(iMerge > 0 && iSwaps > iMerge, 'preMergeSwapsWithCloud runs before the swaps are staged');
  const pre = fnBlock('preMergeSwapsWithCloud');
  assert.match(pre, /doorApplyRemoteSwaps\(swaps, rev\)/);
  assert.match(pre, /doorApplyRemoteSpecials\(specials, rem\)/);
  assert.match(pre, /res\.status === 404\) return \{\}/, 'a missing file is empty');
  // and B's own copy of the reverted swap is dropped by that merge (doorApplyRemoteSwaps's rule)
  const c = core();
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({ [NOV3]: RECORDED }, { [NOV3]: RECORDED }, { [NOV3]: '2026-10-18T15:00:04.730Z' }, '2026-10-18')), []);
});

test('4c. review P2: a special meal removed on one computer is removed on every computer', () => {
  const c = core();
  const sm = { specialName: 'Holiday Dinner', createdAt: '2026-10-01T10:00:00.000Z' };
  const removed = { '2026-12-25-dinner': '2026-10-18T15:00:00.000Z' };
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({ '2026-12-25-dinner': sm }, { '2026-12-25-dinner': sm }, removed, '')), [], 'removed after it was made: gone');
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({}, { '2026-12-25-dinner': { ...sm, createdAt: '2026-10-19T10:00:00.000Z' } }, removed, '')), ['2026-12-25-dinner'], 'saved again since: kept');
  assert.deepEqual(Object.keys(c.doorMergeSwapStores({ '2026-01-01-dinner': sm }, {}, {}, '')), ['2026-01-01-dinner'], 'a past special meal stays until Clear expired');
  assert.match(html, /const REMOVED_SPECIAL_KEYS = doorMakeRevertList\('concRemovedSpecialKeys', 'special_meals_removed\.json'/);
  assert.match(fnBlock('removeSpecialMeal'), /REMOVED_SPECIAL_KEYS\.add\(key\)/, 'Remove records it');
  assert.match(fnBlock('saveSpecialMeal'), /REMOVED_SPECIAL_KEYS\.delete\(key\)/, 'saving it again takes the removal off');
  const pull = fnBlock('pullSecondaryState');
  const iRem = pull.indexOf("['special_meals_removed.json'"), iSm = pull.indexOf("['special_meals.json'");
  assert.ok(iRem > 0 && iSm > iRem && /doorApplyRemoteSpecials\(d, null\)/.test(pull), 'the sync reads the removal list first');
  assert.match(between("fetch(base+'special_meals_removed.json'+bust)", '.catch(()=>{});'), /doorApplyRemoteSpecials\(d, rem\)/, 'and so does the boot sync');
  assert.match(fnBlock('_doPublishToGitHub'), /_push\('special_meals_removed\.json', JSON\.stringify\(loadSpecialRemovals\(\)/);
  assert.match(between('const ALLOW_SHRINK_PATHS', '\n'), /'special_meals_removed\.json'/);
});

test('4d. review P2: a slot\'s Revert, Make permanent and Edit Menu save find every upcoming swap of the slot', () => {
  const ctx = { Date, Object, String, Number };
  vm.createContext(ctx);
  vm.runInContext(fnBlock('doorDateKey') + fnBlock('doorSwapKeysForSlot') +
    'function nextDateForSlot() { return new Date(2026, 9, 8); } function loadMealSwaps() { return {}; }', ctx);
  // Oct 7: Wk2 TUE ⇄ THU landed on Nov 3 and Nov 5; THU's next date is Oct 8, which the old lookup read
  const swaps = { '2026-11-03-lunch': { _rotationSlot: '2-TUESDAY-lunch' }, '2026-11-05-lunch': { _rotationSlot: '2-THURSDAY-lunch' } };
  const RealDate = Date;
  ctx.Date = class extends RealDate { constructor(...a) { if (!a.length) super(2026, 9, 7, 12); else super(...a); } };
  const keys = vm.runInContext('doorSwapKeysForSlot', ctx)(2, 'THURSDAY', 'lunch', swaps);
  assert.deepEqual(plain(keys), ['2026-11-05-lunch'], 'THU\'s half, on its second date');
  for (const fn of ['revertMealSwap', 'makePermanent']) assert.match(fnBlock(fn), /doorSwapKeysForSlot\(week, day, period/, fn + ' uses it');
  assert.match(fnBlock('_finishMenuSave'), /doorSwapKeysForSlot\(week, day, period, swaps\)/, 'the Edit Menu save uses it');
});

test('5. the publish sends the revert list; every sync reads it before the swaps', () => {
  const pub = fnBlock('_doPublishToGitHub');
  assert.match(pub, /_push\('meal_swaps_reverted\.json', JSON\.stringify\(loadSwapReverts\(\)/, 'the publish sends it');
  assert.match(between('const ALLOW_SHRINK_PATHS', '\n'), /'meal_swaps_reverted\.json'/, 'it may shrink as dates pass');
  const pull = fnBlock('pullSecondaryState');
  const iRev = pull.indexOf("['meal_swaps_reverted.json'"), iSw = pull.indexOf("['meal_swaps.json'");
  assert.ok(iRev > 0 && iSw > iRev, 'pullSecondaryState reads the revert list first');
  assert.match(pull.slice(iSw, iSw + 200), /doorApplyRemoteSwaps\(d, null\)/);
  const boot = between("fetch(base+'meal_swaps_reverted.json'+bust)", '.catch(()=>{});');
  assert.match(boot, /fetch\(base\+'meal_swaps\.json'\+bust\)[\s\S]*doorApplyRemoteSwaps\(d, rev\)/, 'the boot sync reads the revert list, then the swaps');
  assert.doesNotMatch(html, /REVERTED_SWAP_KEYS\.has\(k\)\)\s*delete/, 'no merge strips by key alone any more');
  assert.match(fnBlock('doorApplyRemoteSwaps'), /doorMergeSwapStores\(loadMealSwaps\(\), remote, REVERTED_SWAP_KEYS\.toPublished\(\), today\)/);
});

test('6. a slot swap lands both halves as far apart as the meals are on the menu', () => {
  const c = core();
  const CYCLE = new Date(2026, 8, 27); // Sun Sep 27: Week 1 of the cycle that holds Oct 7
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const run = (a, b, today, start = CYCLE) => plain(c.doorSlotSwapDates([a, b], today, start).map(iso));
  const TUE = { week: 2, day: 'TUESDAY' }, THU = { week: 2, day: 'THURSDAY' };
  // Oct 7 (a Wednesday, Wk2): Tuesday was served — both halves go to the next Wk2
  assert.deepEqual(run(TUE, THU, new Date(2026, 9, 7, 11, 18)), ['2026-11-03', '2026-11-05'], 'not Nov 3 and Oct 8');
  assert.deepEqual(run(THU, TUE, new Date(2026, 9, 7)), ['2026-11-05', '2026-11-03'], 'either order');
  // Mon Oct 5: both still ahead this week
  assert.deepEqual(run(TUE, THU, new Date(2026, 9, 5)), ['2026-10-06', '2026-10-08']);
  // Thu Oct 8: today counts as ahead, but Tuesday is gone
  assert.deepEqual(run(TUE, THU, new Date(2026, 9, 8)), ['2026-11-03', '2026-11-05']);
  // across the wrap: Wk4 SAT ⇄ Wk1 SUN on Sun Oct 18 (Wk4) is the coming weekend
  assert.deepEqual(run({ week: 4, day: 'SATURDAY' }, { week: 1, day: 'SUNDAY' }, new Date(2026, 9, 18)), ['2026-10-24', '2026-10-25']);
  // two meals in different weeks keep their distance (Wk1 MON ⇄ Wk2 WED on Oct 18: the coming Wk1 MON is Oct 26)
  assert.deepEqual(run({ week: 1, day: 'MONDAY' }, { week: 2, day: 'WEDNESDAY' }, new Date(2026, 9, 18)), ['2026-10-26', '2026-11-04']);
  // executeSlotSwap uses it, from the current cycle's Week 1 Sunday, and names the dates
  const ex = fnBlock('executeSlotSwap');
  assert.match(ex, /doorSlotSwapDates\(\[a, b\], _today, _cycleStart\)/);
  assert.match(ex, /const targetDate = _dateFor\[swapData\.key\];/);
  assert.doesNotMatch(ex.slice(ex.indexOf('function persistSlot')), /nextDateForSlot\(week, dayName\)/, 'a half no longer takes its own next date');
  assert.match(ex, /formatShortDate\(d\)/, 'the toast names the dates');
});

test('7. the Nov 3 swap is removed, and the revert is published', () => {
  const swaps = J('meal_swaps.json'), rev = J('meal_swaps_reverted.json');
  assert.equal(swaps[NOV3], undefined, 'not in the swap file');
  assert.ok(rev[NOV3] && rev[NOV3] > RECORDED.createdAt, 'reverted after it was made: every computer drops its copy');
  // the routing file's Wk2 TUE lunch is the rotation's again
  const r = J('routing_by_meal.json').routing['2'].TUESDAY.lunch;
  assert.ok(r._components['Tuna Salad Sandwich Mix'] > 0 && !r._components['Halal Beef Burger'], JSON.stringify(r._components));
  // every artifact is stamped from the one menu
  const stamp = J('menu_current.json')._meta;
  for (const f of ['routing_by_meal.json', 'door_state.json', 'registry_summary.json'])
    assert.equal(J(f)._meta.builtFromMenu.exported, stamp.exported, f);
});
