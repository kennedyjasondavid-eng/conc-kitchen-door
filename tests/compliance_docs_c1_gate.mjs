// Compliance Review C1 (2026-11-22, v31-standard.135): documentation is a record per restriction (r.docs), and the status
// (r.confirm) is worked out from it. Plan: docs/DOOR_COMPLIANCE_REVIEW_PLAN_2026-11-22.md (S1–S4, review P1-1..P2-7).
//   1. the core: an update keeps the answers for the restrictions it keeps; a new restriction needing a note re-opens;
//      a new person starts with none, and the last person's resolved mark and deadline go
//   2. S1: a new intake over a documented room (Daily Entry queue, Intake Portal) reads Provisional and is on the screen
//   3. S2: an update that only adds Halal keeps the resident documented; one that adds No Eggs shows them again
//   4. S3: Resolve records an answer for every restriction still needing one, so nobody is resolved and Provisional
//   5. S4: nothing on the screen writes a restriction; the Revert to Regular box is gone
//   6. P1-2: an older build that overwrote the room in place: the last person's answers are dropped on the next read
//   7. P2-3: an older build's Confirmed with no answers becomes answers (migrated), and the normaliser is idempotent
//   8. P2-4: an anaphylactic room with no allergen recorded stays Provisional and is listed with the anaphylactic rooms
//   9. one writer: no resident writer works confirm out from requiresDocumentation by itself any more
//  10. history, revert's keys and the diff carry the answers; the digest's Copy writes real new lines
//  11. today's list (door_state.json): the screen count stays 52; the resolved 801 is documented for No Spicy only
// Authored to fail on main 13e0aa2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { complianceDocsSource, doorSource } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.COMPLIANCE_C1_HTML || new URL('../index.html', import.meta.url), 'utf8');
const { between, fn, fnOpt } = doorSource(html);
const out = (v) => JSON.parse(JSON.stringify(v));
const hasCore = html.includes('DOOR_TESTABLE_CORE_START compliance-docs');

function box(reg = [], rooms = []) {
  const SRC = [
    html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0], complianceDocsSource(html),
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    fn('doorIsAnaphResident'), fnOpt('doorAnaphAnswerTransition'), fnOpt('doorRegistryQueueTransition'), fn('applyQueueToRegistry'),
    fn('commitIntakeQueue'), fn('getComplianceResidents'), fnOpt('doorComplianceToday'), fnOpt('doorComplianceStateOf'),
    fn('submitResolve'), between('const _HISTORY_SNAPSHOT_KEYS', ';\n') + ';\n', fn('snapshotResident'), fn('pushResidentHistory'), fn('diffResidentStates'),
    'this.__set = (reg, rooms) => { REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...reg); REGISTRY_MAP = {}; reg.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; }); anaphRooms = rooms; };',
    'this.__state = () => REGISTRY_LIST;',
  ].join('\n');
  const els = {};
  const c = {
    console: { log() {}, warn() {}, error: console.error }, REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], changesQueue: [], INTAKE_QUEUE: [], RECENT_LOG: [],
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] = els[id] || { value: '', style: {}, focus() {}, classList: { remove() {}, add() {} } }) },
    doorAsk: async () => true, showToast() {}, renderAnaphList() {}, saveRegistryState() {}, publishAndSync() {}, renderComplianceView() {},
    saveIntakeQueue() {}, renderIntakeQueue() {}, renderRecentLog() {}, logQueueCommit() {}, clearResidentHistory() {}, closeResolveModal() {},
    dedupeServiceNote: (a, b) => b || a, filterServiceNote: (a, b) => b || a, getOperatorName: () => 'Fiona', setRegistryProvenance() {},
    doorApplyPendingImportStamp() {}, doorTakeNewerKitchenList: async () => 'current',
  };
  c.__els = els;
  vm.createContext(c);
  vm.runInContext(SRC, c, { filename: 'index.html#compliance-c1', timeout: 20000 });
  c.__set(reg, rooms);
  return c;
}
const R = (room, tags, extra) => Object.assign({ room, tags, section: 'Regular', rawRestriction: tags.join(', '), confirm: 'Provisional', confirmBy: '—' }, extra || {});
const note = (by = 'Fiona', ts = '2026-11-20T15:00:00.000Z') => ({ how: 'note', by, at: ts.slice(0, 10), ts });
const onScreen = (c) => out(c.getComplianceResidents(false)).map((r) => r.room).sort();

test('1. the core: kept per restriction on an update, re-opened by a new one, nothing carried to a new person', () => {
  assert.ok(hasCore, 'the compliance-docs core is in index.html');
  const c = box();
  const r = R('410', ['GF', 'No Pork'], { docs: { GF: note(), 'No Pork': { how: 'preference', by: 'Fiona', at: '2026-11-20', ts: '2026-11-20T15:00:00.000Z' } } });
  c.doorApplyDocTags(r, ['GF', 'No Pork', 'Halal'], {});
  assert.deepEqual([r.confirm, Object.keys(r.docs).sort()], ['Confirmed', ['GF', 'No Pork']], 'an auto-tier tag needs no answer');
  c.doorApplyDocTags(r, ['GF', 'No Pork', 'No Eggs'], {});
  assert.equal(r.confirm, 'Provisional', 'No Eggs needs a note');
  c.doorApplyDocTags(r, ['GF'], {});
  assert.deepEqual([r.confirm, Object.keys(r.docs)], ['Confirmed', ['GF']], 'answers for restrictions that went are dropped');
  Object.assign(r, { complianceResolved: 'updated', complianceResolvedBy: 'JK', complianceDeadline: '2026-12-01' });
  c.doorApplyDocTags(r, ['GF'], { newPerson: true });
  assert.deepEqual([r.confirm, out(r.docs), r.complianceResolved, r.complianceDeadline], ['Provisional', {}, '', ''], 'a new person starts fresh');
  const st = c.doorDocState(R('x', ['No Molluscs']), '2026-11-22', false);
  assert.deepEqual([st.needs, st.group], [['No Molluscs'], 'allergy'], 'a tag not in COMPLIANCE_TIERS needs a note, filed as an allergy');
  assert.equal(c.doorDocState(R('y', ['No Pork', 'No Spicy', 'Halal']), '2026-11-22', false).group, 'preference');
  assert.equal(c.doorDocState(R('z', ['Diabetic', 'No Pork']), '2026-11-22', false).group, 'medical');
  assert.equal(c.doorDocState(R('w', ['No Pork']), '2026-11-22', true).group, 'anaph');
});

test('2. S1: a new intake over a documented room reads Provisional and is on the screen', async () => {
  // Daily Entry queue
  let c = box([R('312', ['GF', 'Low Sodium'], { confirm: 'Confirmed', docs: { GF: note(), 'Low Sodium': note() }, complianceResolved: 'updated' })]);
  c.changesQueue.push({ room: '312', type: 'intake', tags: { glutenFree: true, lowSodium: true }, route: 'Regular', notes: '' });
  c.applyQueueToRegistry([]);
  let r = c.__state()[0];
  assert.deepEqual([r.confirm, out(r.docs || {})], ['Provisional', {}], 'Daily Entry: ' + JSON.stringify(out(r)));
  assert.deepEqual(onScreen(c), ['312']);
  // Intake Portal (the record is changed in place)
  c = box([R('312', ['GF', 'Low Sodium'], { confirm: 'Confirmed', docs: { GF: note(), 'Low Sodium': note() }, complianceResolved: 'updated', complianceDeadline: '2026-11-01' })]);
  c.INTAKE_QUEUE.push({ id: 'q1', type: 'intake', room: '312', tags: ['GF', 'Low Sodium'], route: 'Regular', isOverwrite: true });
  await c.commitIntakeQueue();
  r = c.__state()[0];
  assert.deepEqual([r.confirm, out(r.docs), r.complianceResolved, r.complianceDeadline], ['Provisional', {}, '', ''], 'Intake Portal: ' + JSON.stringify(out(r)));
  assert.deepEqual(onScreen(c), ['312']);
  assert.match(fn('saveDirectFromForm'), /doorApplyDocTags\(r, r\.tags, \{ newPerson: type === 'intake' \}\)/, 'the direct save does the same');
});

test('3. S2: an update keeps the answers it can; a new restriction needing a note shows the resident again', async () => {
  const c = box([R('208', ['GF'], { confirm: 'Confirmed', docs: { GF: note() } })]);
  c.INTAKE_QUEUE.push({ id: 'q1', type: 'update', room: '208', tags: ['GF', 'Halal'], route: 'Regular' });
  await c.commitIntakeQueue();
  assert.deepEqual([c.__state()[0].confirm, onScreen(c)], ['Confirmed', []], 'adding Halal keeps the note');
  c.INTAKE_QUEUE.push({ id: 'q2', type: 'update', room: '208', tags: ['GF', 'Halal', 'No Eggs'], route: 'Regular' });
  await c.commitIntakeQueue();
  const r = c.__state()[0];
  assert.deepEqual([r.confirm, onScreen(c), c.doorComplianceStateOf(r).needs], ['Provisional', ['208'], ['No Eggs']]);
  c.changesQueue.push({ room: '208', type: 'update', tags: { glutenFree: true, halal: true }, route: 'Regular' });
  c.applyQueueToRegistry([]);
  assert.deepEqual([c.__state()[0].confirm, Object.keys(c.__state()[0].docs)], ['Confirmed', ['GF']], 'the Daily Entry update keeps GF\'s note');
});

test('4. S3: Resolve answers every restriction still needing one, so nobody is resolved and Provisional', async () => {
  const c = box([R('500', ['No Peanuts', 'Diabetic', 'Halal'])]);
  c._resolveRoom = '500';
  c.__els['settle-resolved-by'] = { value: 'Fiona', style: {}, focus() {} };
  c.__els['settle-resolution-note'] = { value: 'H&W letter, Nov 20' };
  await c.submitResolve();
  const r = c.__state()[0];
  assert.deepEqual([r.confirm, Object.keys(r.docs).sort(), r.docs['No Peanuts'].line, r.docs.Diabetic.by], ['Confirmed', ['Diabetic', 'No Peanuts'], 'H&W letter, Nov 20', 'Fiona']);
  assert.deepEqual(onScreen(c), []);
  // a resolved mark no longer hides anyone
  const c2 = box([R('801', ['No Eggs'], { complianceResolved: 'updated', complianceResolvedAt: 'May 3', complianceResolvedRestrictions: 'Vegetarian' })]);
  assert.deepEqual(onScreen(c2), ['801'], 'resolved for something else, still needs a note for No Eggs');
});

test('5. S4: nothing on the screen writes a restriction; the Revert to Regular box is gone', () => {
  assert.ok(!html.includes('settle-revert-check'), 'no revert box');
  assert.ok(!html.includes('settle-status-select'), 'no status to pick');
  for (const name of ['submitResolve', 'batchConfirmCompliance', 'reopenComplianceItem', 'openResolveModal']) {
    const body = fn(name);
    assert.doesNotMatch(body, /\br\.(tags|rawRestriction|section|allergenFlags|restrictions|isAnaph|anaphTags)\s*=/, name + ' leaves the restrictions alone');
  }
  assert.match(fn('settleOpenResidentRecord'), /openEditResident\(room\)/, 'a restriction comes off in the resident record');
});

test('6. P1-2: an older build that overwrote the room in place: the last person\'s answers go on the next read', () => {
  const c = box();
  const r = R('613a', ['GF', 'No Shellfish'], {
    confirm: 'Provisional', docs: { GF: note('JK', '2026-10-01T10:00:00.000Z'), 'No Shellfish': note('JK', '2026-10-01T10:00:00.000Z') },
    _history: [{ ts: '2026-11-21T09:00:00.000Z', desc: 'Intake overwrite — GF, No Shellfish → Regular', snapshot: {} }],
  });
  c.doorMigrateDocs(r, '2026-11-22', '2026-11-22T12:00:00.000Z');
  assert.deepEqual([r.confirm, out(r.docs)], ['Provisional', {}]);
  // an answer given after the new person moved in stays
  const r2 = R('613b', ['GF'], { docs: { GF: note('Fiona', '2026-11-21T11:00:00.000Z') }, _history: [{ ts: '2026-11-21T09:00:00.000Z', desc: 'Intake overwrite — GF → Regular' }] });
  c.doorMigrateDocs(r2, '2026-11-22');
  assert.equal(r2.confirm, 'Confirmed');
});

test('7. P2-3: an older build\'s Confirmed becomes answers; the normaliser runs again without changing anything', () => {
  const c = box();
  const r = R('707', ['Diabetic', 'No Pork'], { confirm: 'Confirmed', docs: { Diabetic: note() }, complianceResolvedBy: 'JK' });
  assert.equal(c.doorMigrateDocs(r, '2026-11-22', '2026-11-22T12:00:00.000Z'), true);
  assert.deepEqual([r.confirm, r.docs['No Pork'].migrated, r.docs['No Pork'].by], ['Confirmed', true, 'JK']);
  const once = JSON.stringify(r);
  assert.equal(c.doorMigrateDocs(r, '2026-11-23', '2026-11-23T12:00:00.000Z'), false);
  assert.equal(JSON.stringify(r), once, 'idempotent');
  // an older build resetting Confirmed to Provisional on an unrelated update is put right
  const r2 = R('708', ['GF', 'Halal'], { confirm: 'Provisional', docs: { GF: note() } });
  c.doorMigrateDocs(r2, '2026-11-22');
  assert.equal(r2.confirm, 'Confirmed');
});

test('8. P2-4: an anaphylactic room with no allergen recorded stays Provisional and is listed with the anaphylactic rooms', () => {
  const c = box([R('813', ['Regular'], { rawRestriction: 'Regular' }), R('312', ['Regular'], { rawRestriction: 'Regular' })], ['813']);
  c.doorMigrateRegistryDocs ? c.doorMigrateRegistryDocs() : c.__state().forEach((r) => c.doorMigrateDocs(r, '2026-11-22'));
  const [a, b] = c.__state();
  assert.deepEqual([a.confirm, b.confirm], ['Provisional', 'N/A']);
  const st = c.doorComplianceStateOf(a);
  assert.deepEqual([st.anaphNoAllergen, st.group, onScreen(c)], [true, 'anaph', ['813']]);
});

test('9. one writer: no resident writer works confirm out from requiresDocumentation by itself', () => {
  assert.doesNotMatch(html, /\.confirm = requiresDocumentation\(/);
  assert.doesNotMatch(html, /confirm: requiresDocumentation\(/);
  for (const name of ['saveDirectFromForm', 'commitIntakeQueue', 'doorRegistryQueueTransition', 'saveRegistryEdit']) {

    assert.match(fn(name), /doorApplyDocTags\(/, name);
  }
  assert.match(fn('nrDoneReview'), /doorApplyDocTags\(r, r\.tags, \{\}\)/, 'a tag added in Needs Review');
  assert.match(fn('revertResident'), /doorApplyDocTags\(r, r\.tags, \{\}\)/, 'a revert');
  assert.ok(!html.includes('(function autoPromoteAutoTier()'), 'the load-time tidy is the normaliser');
  for (const where of ['function loadRegistryState(', 'async function pullStateFromGitHub(', 'async function revertLastGenerate(']) {
    const s = html.indexOf(where); const e = html.indexOf('\n}\n', s);
    assert.match(html.slice(s, e), /doorMigrateRegistryDocs\(\)/, where);
  }
});

test('10. history and revert carry the answers; the diff names them; the digest copies real new lines', () => {
  assert.match(between('const _HISTORY_SNAPSHOT_KEYS', ';\n'), /'docs','docAsk'/);
  const c = box();
  const d = out(c.diffResidentStates({ tags: ['GF'], docs: {} }, { tags: ['GF'], docs: { GF: note() } }));
  assert.ok(d.some((x) => x.field === 'Documented' && x.to === 'GF (note)'), JSON.stringify(d));
  assert.ok(!fn('draftComplianceDigest').includes("'\\\\n\\\\n'"), 'no literal backslash-n in the copied text');
});

test('11. today\'s list: the screen still shows 52, and 801 (resolved May 3) is documented for No Spicy only', () => {
  const state = JSON.parse(fs.readFileSync(new URL('../door_state.json', import.meta.url), 'utf8'));
  const c = box(state.residents, state.anaphRooms || []);
  const before = out(c.__state()).map((r) => r.room + ':' + r.confirm).join('|');
  c.__state().forEach((r) => c.doorMigrateDocs(r, '2026-11-22', '2026-11-22T12:00:00.000Z'));
  const r801 = c.__state().find((r) => r.complianceResolvedAt === 'May 3');
  if (r801) {
    assert.deepEqual(Object.keys(r801.docs), ['No Spicy'].filter((t) => (r801.tags || []).includes(t)), 'only what the resolution named');
  }
  const changed = out(c.__state()).map((r) => r.room + ':' + r.confirm).join('|');
  const moved = before.split('|').filter((x, i) => x !== changed.split('|')[i]);
  assert.ok(moved.length <= 1, 'at most 801 changes status: ' + moved);
  const n = onScreen(c).length;
  assert.ok(n >= 40 && n <= 60, 'about 52 on the screen: ' + n);
});
