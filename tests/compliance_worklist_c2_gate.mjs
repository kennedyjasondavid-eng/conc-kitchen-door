// Compliance Review C2 + C3 (2026-11-22, v31-standard.137): the worklist and the one question.
// Plan docs/DOOR_COMPLIANCE_REVIEW_PLAN_2026-11-22.md §5 (C2 and C3 shipped together). The browser half is
// tests/browser/compliance_worklist.mjs.
//   1. the screen is a worklist: groups in order, no table, filter, sort, saving banner or header buttons
//   2. the one question: four answers, Confirmed first; "It's a preference" never for an anaphylactic room
//   3. It's a preference records a preference; Still waiting sets a reminder and records nothing
//   4. Not needed any more opens the resident record and writes nothing here
//   5. the batch: Got the notes, It's a preference (skips an anaphylactic room), Remind me (no prompt)
//   6. Undo takes the answers back on the kitchen newer list
//   7. quiet saving: no page banner; a "Saved" beside the row
//   8. C2 review: a picker with nothing ticked records nothing; one row's reminder keeps the selection; Undo keeps an ask
// Authored to fail on main ed97d83.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { complianceDocsSource, doorSource } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.COMPLIANCE_C2_HTML || new URL('../index.html', import.meta.url), 'utf8');
const { between, fn, fnOpt, has } = doorSource(html);
const out = (v) => JSON.parse(JSON.stringify(v));
const screen = () => { const a = html.indexOf('<div class="screen" id="screen-compliance">'); return html.slice(a, html.indexOf('<!-- ===== MEAL LOG', a)); };
const modal = () => { const a = html.indexOf('id="settle-compliance-modal"'); return html.slice(a, html.indexOf('<!-- ===== IMPORT DAILY LIST MODAL', a)); };

function box(reg, rooms = [], radio = 'note', extraEls = {}) {
  const NAMES = ['doorIsAnaphResident', 'getComplianceResidents', 'doorComplianceToday', 'doorComplianceStateOf', 'submitResolve',
    'batchConfirmCompliance', 'batchPreferenceCompliance', 'batchSetDeadline', 'cxUndoLast', 'cxShowToast', 'cxLeftText', 'cxShortDate',
    'cxDayPlus', 'cxRoomId', 'settleOpenResidentRecord', 'doorText', 'escapeHtml', 'formatCompactDate', 'snapshotResident', 'pushResidentHistory'];
  const SRC = [complianceDocsSource(html), between('const _HISTORY_SNAPSHOT_KEYS', ';\n') + ';\n', ...NAMES.map(fnOpt),
    'let _cxUndo = null; let _cxToastTimer = null;', 'this.__state = () => REGISTRY_LIST;'].join('\n');
  const els = Object.assign({}, extraEls);
  const opened = [];
  const c = {
    console: { log() {}, warn() {} }, REGISTRY_LIST: reg, anaphRooms: rooms, RECENT_LOG: [], _complianceSelected: new Set(), _resolveRoom: null,
    localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout,
    document: {
      getElementById: (id) => (els[id] = els[id] || { value: '', style: {}, focus() {}, classList: { remove() {}, add() {} } }),
      querySelector: (sel) => (/settle-how\]:checked/.test(sel) ? { value: radio } : null), querySelectorAll: () => [],
    },
    doorAsk: async () => true, showToast() {}, ensureOperatorName: () => true, getOperatorName: () => 'Fiona', setOperatorName() {},
    renderComplianceView() {}, closeResolveModal() {}, openEditResident: (room) => opened.push(room),
    saveRegistryState() {}, setRegistryProvenance() {}, publishAndSync() { c.__sent = (c.__sent || 0) + 1; }, doorTakeNewerKitchenList: async () => { c.__took = (c.__took || 0) + 1; return 'current'; },
  };
  c.__els = els; c.__opened = opened;
  vm.createContext(c);
  vm.runInContext(SRC, c, { filename: 'index.html#compliance-c2', timeout: 20000 });
  return c;
}
const R = (room, tags, extra) => Object.assign({ room, tags, section: 'Regular', rawRestriction: tags.join(', '), confirm: 'Provisional', confirmBy: '—' }, extra || {});
const by = { 'settle-resolved-by': { value: 'Fiona', style: {}, focus() {} }, 'settle-resolution-note': { value: '' } };

test('1. the screen is a worklist, grouped by what to ask', () => {
  const s = screen();
  for (const id of ['cx-groups', 'cx-progress', 'cx-selbar', 'cx-toast', 'compliance-resolved-section']) assert.ok(s.includes('id="' + id + '"'), id);
  for (const gone of ['compliance-thead', 'compliance-body', 'compliance-filter', 'compliance-pending-banner', 'compliance-summary-bar', 'compliance-select-all'])
    assert.ok(!html.includes('id="' + gone + '"'), gone + ' is gone');
  assert.ok(!has('setComplianceSort'), 'no sort');
  assert.doesNotMatch(s.slice(0, s.indexOf('<div class="content')), /<button/, 'the header holds no buttons; sharing tools sit at the bottom');
  const order = html.match(/const CX_GROUPS = \[([\s\S]*?)\];/);
  assert.ok(order, 'CX_GROUPS');
  assert.deepEqual([...order[1].matchAll(/key: '(\w+)'/g)].map((m) => m[1]), ['anaph', 'allergy', 'medical', 'preference']);
  assert.match(fn('renderComplianceView'), /doorComplianceStateOf\(r\)[\s\S]*st\.group/, 'rows are grouped by the one reader');
});

test('2. the one question: four answers, Confirmed first; no preference for an anaphylactic room', () => {
  const m = modal();
  assert.deepEqual([...m.matchAll(/name="settle-how" value="(\w+)"/g)].map((x) => x[1]), ['note', 'preference', 'notneeded', 'waiting']);
  assert.match(m, /name="settle-how" value="note" checked/);
  assert.ok(!m.includes('settle-status-select') && !m.includes('settle-revert-check'));
  assert.match(fn('openResolveModal'), /prefOpt\.hidden = st\.anaph/, 'the preference answer hides for an anaphylactic room');
});

test('3. It\'s a preference records a preference; Still waiting sets a reminder and records nothing', async () => {
  let c = box([R('115', ['No Pork', 'Halal'])], [], 'preference', by);
  c._resolveRoom = '115';
  await c.submitResolve();
  let r = c.__state()[0];
  assert.deepEqual([r.confirm, r.docs['No Pork'].how, r.docs['No Pork'].by], ['Confirmed', 'preference', 'Fiona']);
  // never for an anaphylactic room, even when asked
  c = box([R('213', ['No Tree Nuts'], { isAnaph: true })], ['213'], 'preference', by);
  c._resolveRoom = '213';
  await c.submitResolve();
  assert.deepEqual([c.__state()[0].confirm, c.__state()[0].docs], ['Provisional', undefined]);
  // Still waiting
  c = box([R('410', ['Low Sodium'])], [], 'waiting', Object.assign({ 'settle-wait-days': { value: '14' } }, by));
  c._resolveRoom = '410';
  await c.submitResolve();
  r = c.__state()[0];
  assert.deepEqual([r.confirm, r.docs, r.complianceDeadline], ['Provisional', undefined, c.cxDayPlus(14)]);
});

test('4. Not needed any more opens the resident record and writes nothing here', async () => {
  const c = box([R('512', ['Diabetic'])], [], 'notneeded', by);
  c._resolveRoom = '512';
  await c.submitResolve();
  assert.deepEqual([c.__opened, c.__state()[0].docs, c.__sent || 0], [['512'], undefined, 0]);
});

test('5. the batch: notes, preferences (never an anaphylactic room), a reminder with no prompt', async () => {
  let c = box([R('101', ['GF']), R('102', ['No Pork']), R('213', ['No Tree Nuts'], { isAnaph: true })], ['213']);
  ['101', '102', '213'].forEach((x) => c._complianceSelected.add(x));
  await c.batchPreferenceCompliance();
  const st = out(c.__state());
  assert.deepEqual(st.map((r) => r.confirm), ['Confirmed', 'Confirmed', 'Provisional'], 'the anaphylactic room is skipped');
  c = box([R('101', ['GF'])]);
  c._complianceSelected.add('101');
  await c.batchSetDeadline(7);
  assert.equal(c.__state()[0].complianceDeadline, c.cxDayPlus(7));
  assert.doesNotMatch(fn('batchSetDeadline'), /prompt\(/, 'no browser prompt');
  c = box([R('101', ['GF', 'Diabetic'])]);
  c._complianceSelected.add('101');
  await c.batchConfirmCompliance();
  assert.deepEqual(Object.keys(c.__state()[0].docs).sort(), ['Diabetic', 'GF']);
});

test('6. Undo takes the answers back, on the kitchen newer list', async () => {
  const c = box([R('208', ['No Eggs'])], [], 'note', by);
  c._resolveRoom = '208';
  await c.submitResolve();
  assert.equal(c.__state()[0].confirm, 'Confirmed');
  const took = c.__took;
  await c.cxUndoLast();
  assert.deepEqual([c.__state()[0].confirm, c.__state()[0].docs, c.__took], ['Provisional', undefined, took + 1]);
});

test('7. quiet saving: no page banner; a "Saved" beside the row', () => {
  assert.doesNotMatch(fn('updateComplianceField'), /compliance-pending-banner/);
  assert.doesNotMatch(fn('debouncedComplianceSave'), /compliance-pending-banner/);
  assert.match(fn('debouncedComplianceSave'), /'cx-saved-' \+ cxRoomId\(room\)[\s\S]*Saved ✓/);
});

test('8. C2 review: nothing ticked records nothing; a row reminder keeps the selection; Undo keeps an earlier ask', async () => {
  // P2-1: two restrictions, the picker showing, both unticked
  let c = box([R('300', ['GF', 'Diabetic'])], [], 'note', by);
  const boxes = [{ value: 'GF', checked: false }, { value: 'Diabetic', checked: false }];
  c.document.querySelectorAll = (sel) => (sel === '.settle-tag' || sel === '.settle-tag:checked' ? boxes.filter((b) => sel === '.settle-tag' || b.checked) : []);
  c._resolveRoom = '300';
  await c.submitResolve();
  assert.deepEqual([c.__state()[0].docs, c.__sent || 0], [undefined, 0], 'nothing recorded, nothing sent');
  boxes[1].checked = true;
  c._resolveRoom = '300';
  await c.submitResolve();
  assert.deepEqual(Object.keys(c.__state()[0].docs), ['Diabetic'], 'only the ticked one');
  // P3-3: one row's reminder leaves the selection alone
  c = box([R('101', ['GF']), R('102', ['GF'])]);
  c._complianceSelected.add('102');
  await c.batchSetDeadline(7, ['101']);
  assert.deepEqual([c.__state()[0].complianceDeadline, c.__state()[1].complianceDeadline || '', [...c._complianceSelected]], [c.cxDayPlus(7), '', ['102']]);
  // P3-8: Undo of a batch answer puts back the ask the answer cleared
  c = box([R('208', ['No Eggs'], { docAsk: { at: '2026-11-20', by: 'Fiona' } })]);
  c._complianceSelected.add('208');
  await c.batchConfirmCompliance();
  assert.equal(c.__state()[0].docAsk, undefined, 'an answer clears the ask');
  await c.cxUndoLast();
  assert.deepEqual(out(c.__state()[0].docAsk), { at: '2026-11-20', by: 'Fiona' });
});
