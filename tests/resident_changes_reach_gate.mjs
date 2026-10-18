// tests/resident_changes_reach_gate.mjs — a note, a compliance action or an Undo made on one DOOR computer reaches the
// other (2026-10-18). Found with room 813 (anaph_list_reaches_gate, v31-standard.37): these changes never marked the
// resident list as this computer's change, so another computer kept its own copy and its next Generate sent it back.
// Jason, 2026-10-18: "please sweep up those housekeeping notes". The rule is #132's: take the kitchen's newer list first,
// then make the change and mark it newest.
//   1. a service note survives the other computer's Generate
//   2. Confirm, Set Deadline and Resolve on a batch survive it
//   3. a typed compliance field survives it, and is put back on the kitchen's newer list when this computer's is older
//   4. Re-open and the Resolve form survive it
//   5. Undo Generate reaches the other computer
//   6. Undo Generate says when the kitchen's list has changed since, and by whom, and then replaces it
//   7. every one of these writers takes the kitchen's newer list first and marks itself newest
// Authored to fail on main 3bd1fad (1–7). Env: RESIDENT_REACH_HTML (another index.html, e.g. main's).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { twoComputers, out, R, intake } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.RESIDENT_REACH_HTML || new URL('../index.html', import.meta.url), 'utf8');
const WRITERS = ['saveInlineNote', 'batchConfirmCompliance', 'batchSetDeadline', 'batchResolveCompliance', 'reopenComplianceItem', 'submitResolve', 'debouncedComplianceSave', 'updateComplianceField', 'revertLastGenerate'];
const { computer, kitchen, morning, fn } = twoComputers(html, {
  fns: WRITERS,
  // declared beside debouncedComplianceSave in index.html (the pending list only on this branch)
  extraSrc: 'let _complianceSaveTimer = null; const _compliancePendingFields = [];',
  ctx: (c) => ({
    _complianceSelected: new Set(), _resolveRoom: '', RECENT_LOG: [],
    renderComplianceView() {}, updateComplianceBadge() {}, closeResolveModal() {}, saveRecentLog() {}, updateRevertButton() {},
    prompt: () => c.__prompt,
    // the compliance save waits 1.5 s; here it waits for the test to fire it
    setTimeout: (f, ms, ...a) => (ms === 1500 ? ((c.__debounced = f), 1) : setTimeout(f, ms, ...a)),
  }),
});

const LIST = () => [
  R('213', ['Soft Meals', 'No Tree Nuts', 'No Coconut'], { isAnaph: true, anaphTags: ['noCoconut', 'noTreeNuts'] }),
  R('305', ['Regular']),
  R('500', ['No Peanuts'], { confirm: 'Provisional', confirmBy: '—', rawRestriction: 'No Peanuts' }),
  R('600', ['Halal'], { confirm: 'Confirmed', complianceResolved: 'updated', complianceResolvedBy: 'JK', rawRestriction: 'Halal' }),
];
const rec = (state, room) => (state.residents || state.reg).find((r) => r.room === room) || {};
// B's next Generate: its tab open since the morning, the day's import queued.
async function bGenerates(b, room = '900') { b.__queue([intake(room, { regular: true })]); await b.__generate(); }

test('1. a service note survives the other computer\'s Generate', async () => {
  const { a, b } = await morning(LIST(), ['213']);
  a.__els['reg-note-input-305'] = { value: 'Soft bread only' };
  await a.saveInlineNote('305'); await a.__pending;
  await bGenerates(b);
  assert.deepEqual([rec(kitchen.state, '305').serviceNote, rec(b.__state(), '305').serviceNote], ['Soft bread only', 'Soft bread only'],
    'the kitchen and B keep the note: ' + JSON.stringify(rec(kitchen.state, '305')));
});

test('2. Confirm, Set Deadline and Resolve on a batch survive the other computer\'s Generate', async () => {
  for (const [name, check] of [
    ['batchConfirmCompliance', (r) => r.confirm === 'Confirmed' && r.complianceResolutionNote === 'Batch confirmed'],
    ['batchSetDeadline', (r) => r.complianceDeadline === '2026-11-01'],
    ['batchResolveCompliance', (r) => r.confirm === 'Confirmed' && r.complianceResolutionNote === 'Batch resolved'],
  ]) {
    const { a, b } = await morning(LIST(), ['213']);
    a._complianceSelected = new Set(['500']);
    a.__prompt = '2026-11-01';
    await a[name](); await a.__pending;
    await bGenerates(b);
    assert.ok(check(rec(kitchen.state, '500')) && check(rec(b.__state(), '500')), name + ' kept: ' + JSON.stringify(rec(kitchen.state, '500')));
  }
});

test('3. a typed compliance field survives the other computer\'s Generate, and lands on the kitchen\'s newer list', async () => {
  let { a, b } = await morning(LIST(), ['213']);
  a.updateComplianceField('500', 'complianceDeadline', '2026-11-15');
  await a.__debounced(); await a.__pending;
  await bGenerates(b);
  assert.equal(rec(kitchen.state, '500').complianceDeadline, '2026-11-15', 'kept after B\'s Generate');
  // A's list older than the kitchen's: B generated first.
  ({ a, b } = await morning(LIST(), ['213']));
  await bGenerates(b, '901');
  a.updateComplianceField('500', 'complianceDeadline', '2026-11-20');
  await a.__debounced(); await a.__pending;
  assert.deepEqual([rec(kitchen.state, '500').complianceDeadline, !!rec(kitchen.state, '901').room], ['2026-11-20', true],
    'the kitchen has A\'s field and B\'s intake');
});

test('4. Re-open and the Resolve form survive the other computer\'s Generate', async () => {
  let { a, b } = await morning(LIST(), ['213']);
  await a.reopenComplianceItem('600'); await a.__pending;
  await bGenerates(b);
  assert.equal(rec(kitchen.state, '600').complianceResolved, '', 'still re-opened: ' + JSON.stringify(rec(kitchen.state, '600')));
  ({ a, b } = await morning(LIST(), ['213']));
  a._resolveRoom = '500';
  Object.assign(a.__els, {
    'settle-resolved-by': { value: 'JK', focus() {}, style: {} }, 'settle-status-select': { value: 'Confirmed' },
    'settle-revert-check': { checked: false }, 'settle-resolution-note': { value: 'H&W letter on file' },
  });
  await a.submitResolve(); await a.__pending;
  await bGenerates(b);
  const r = rec(kitchen.state, '500');
  assert.deepEqual([r.confirm, r.complianceResolutionNote, r.complianceResolvedBy], ['Confirmed', 'H&W letter on file', 'JK'], 'still resolved');
});

// A Generate on A, with the snapshot generateFiles takes first (for Undo).
async function aGenerates(a, room) {
  a.__store.concRegistrySnapshot = JSON.stringify({ _meta: { snapshotAt: new Date().toISOString(), by: 'JK' }, residents: out(a.__state().reg), anaphRooms: out(a.__state().rooms) });
  a.__queue([intake(room, { regular: true })]); await a.__generate();
}

test('5. Undo Generate reaches the other computer', async () => {
  const { a, b } = await morning(LIST(), ['213']);
  await aGenerates(a, '900');
  await b.pullStateFromGitHub(false);             // B takes A's Generate
  assert.ok(rec(b.__state(), '900').room, 'B has the intake');
  await a.revertLastGenerate(); await a.__pending;
  assert.ok(!rec(kitchen.state, '900').room, 'the kitchen is back to before');
  await b.pullStateFromGitHub(false);
  await bGenerates(b, '901');
  assert.deepEqual([!!rec(kitchen.state, '900').room, !!rec(b.__state(), '900').room], [false, false],
    'still undone after B\'s Generate: ' + kitchen.state.residents.map((x) => x.room));
});

test('6. Undo Generate says when the kitchen\'s list has changed since, and by whom, and then replaces it', async () => {
  const { a, b } = await morning(LIST(), ['213']);
  await aGenerates(a, '900');
  await b.pullStateFromGitHub(false);
  await bGenerates(b, '901');                      // the kitchen changes after A's Generate
  await a.revertLastGenerate(); await a.__pending;
  const q = a.__asked.find((x) => x.title === 'Undo the last Generate');
  assert.ok(q && q.lines.some((l) => /has changed since this Generate \(Joan Wandera, /.test(l) && /replaces those changes too/.test(l)),
    'the question names it: ' + JSON.stringify(q && q.lines));
  assert.deepEqual([!!rec(kitchen.state, '900').room, !!rec(kitchen.state, '901').room], [false, false], 'Undo replaced the kitchen\'s list, as it said');
  // Nothing changed since: no extra line.
  const quiet = await morning(LIST(), ['213']);
  await aGenerates(quiet.a, '900');
  await quiet.a.revertLastGenerate(); await quiet.a.__pending;
  const q2 = quiet.a.__asked.find((x) => x.title === 'Undo the last Generate');
  assert.equal(q2.lines.length, 2, 'the question as before');
});

test('7. every one of these writers takes the kitchen\'s newer list first and marks itself newest', () => {
  for (const name of ['saveInlineNote', 'batchConfirmCompliance', 'batchSetDeadline', 'batchResolveCompliance', 'reopenComplianceItem', 'submitResolve']) {
    const body = fn(name);
    const iTake = body.indexOf('await doorTakeNewerKitchenList()'), iMark = body.lastIndexOf('setRegistryProvenance()'), iSave = body.lastIndexOf('saveRegistryState()');
    assert.ok(/^async function /.test(body) && iTake > 0 && iMark > iTake && iSave > iMark, name + ': ' + [iTake, iMark, iSave]);
  }
  const deb = fn('debouncedComplianceSave');
  assert.match(deb, /_compliancePendingFields\.splice\(0\)[\s\S]*await doorTakeNewerKitchenList\(\)\) === 'adopted'[\s\S]*r\[p\.field\] = p\.value[\s\S]*setRegistryProvenance\(\);\s*saveRegistryState\(\)/, 'the field save');
  assert.match(fn('updateComplianceField'), /_compliancePendingFields\.push\(\{ room, field, value \}\)/, 'a typed field is remembered for the save');
  const undo = fn('revertLastGenerate');
  assert.ok(undo.indexOf('doorRegistryPublishGate(meta, getRegistryProvenanceTs())') > 0 && undo.indexOf('setRegistryProvenance();') > undo.indexOf('REGISTRY_LIST.splice('), 'Undo checks the kitchen, then marks itself newest');
  assert.ok(!/doorTakeNewerKitchenList/.test(undo), 'Undo never takes the kitchen\'s list: it would undo the Undo');
});
