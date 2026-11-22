// Compliance Review C4 (2026-11-22, v31-standard.138): the nudge that rises to meet the person, the badge that means
// something, and the email to Health & Wellness in the page. Plan docs/DOOR_COMPLIANCE_REVIEW_PLAN_2026-11-22.md §5 C4.
//   1. the nudge: red for an anaphylactic room past its reminder, amber for any other, else calm: anaphylactic first,
//      then allergies, medical diets, preferences; rooms already asked and waiting are not asked about again
//   2. the badge counts every anaphylactic room still needing a note and any room past its reminder; nothing else
//   3. Mark as asked records who asked and when, and a reminder a week out (never earlier than one set); Undo puts it back
//   4. the email is in the page (no popup window), grouped by what to ask, rooms only, anaphylactic marked
//   6. C4 review: due on the reminder day; a reminder never asked says so; a moderate allergy alone is not emailed;
//      a room with no allergen recorded is never called kept off its allergens
//   5. the row says when H&W was asked and when a new person moved into a room; the handlers are allow-listed
// Authored to fail on main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { complianceDocsSource, doorSource } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.COMPLIANCE_C4_HTML || new URL('../index.html', import.meta.url), 'utf8');
const { between, fn, fnOpt } = doorSource(html);
const out = (v) => JSON.parse(JSON.stringify(v));

function box(reg, rooms = []) {
  const NAMES = ['doorIsAnaphResident', 'getComplianceResidents', 'doorComplianceToday', 'doorComplianceStateOf', 'cxMarkAsked', 'cxUndoLast',
    'cxShowToast', 'cxDayPlus', 'cxAskText', 'cxCloseAsk', 'cxOpenAsk', 'doorText', 'escapeHtml', 'formatCompactDate'];
  const SRC = [complianceDocsSource(html), ...NAMES.map(fnOpt), 'let _cxUndo = null; let _cxToastTimer = null; var _cxAskRooms = []; var _cxAskReturnFocus = null;',
    'this.__setAsk = (r) => { _cxAskRooms = r; };', 'this.__state = () => REGISTRY_LIST;'].join('\n');
  const els = {};
  const c = {
    console: { log() {}, warn() {} }, REGISTRY_LIST: reg, anaphRooms: rooms, setTimeout, clearTimeout,
    document: { getElementById: (id) => (els[id] = els[id] || { value: '', style: {}, classList: { remove() {}, add() {}, contains: () => false } }), contains: () => true, activeElement: null },
    showToast() {}, ensureOperatorName: () => true, getOperatorName: () => 'Fiona', renderComplianceView() {},
    saveRegistryState() {}, setRegistryProvenance() {}, publishAndSync() {}, doorTakeNewerKitchenList: async () => 'current',
  };
  vm.createContext(c);
  vm.runInContext(SRC, c, { filename: 'index.html#compliance-c4', timeout: 20000 });
  return c;
}
const R = (room, tags, extra) => Object.assign({ room, tags, section: 'Regular', rawRestriction: tags.join(', '), confirm: 'Provisional', confirmBy: '—' }, extra || {});
const T = '2026-11-22';

// Re-pinned 2026-11-22 (v31-standard.140): No Pork is self-declared (Jason: "we don't usually request docs for no pork"), so No Spicy is the preference example.
test('1. the nudge rises: red, amber, else calm in the order to ask', () => {
  const c = box([]);
  const it = (room, tags, extra, anaph) => ({ room, st: c.doorDocState(R(room, tags, extra), T, !!anaph) });
  assert.equal(c.doorDocNudge([], T), null, 'nothing outstanding, no nudge');
  const calm = c.doorDocNudge([it('101', ['Diabetic']), it('213', ['No Tree Nuts'], {}, true), it('102', ['No Spicy'])], T);
  assert.deepEqual([calm.level, calm.group, calm.rooms], ['calm', 'anaph', ['213']], 'anaphylactic first');
  const asked = c.doorDocNudge([it('213', ['No Tree Nuts'], { docAsk: { at: '2026-11-21' }, complianceDeadline: '2026-11-28' }, true), it('101', ['GF'])], T);
  assert.deepEqual([asked.group, asked.rooms, asked.asked], ['allergy', ['101'], 0], 'asked and waiting is not asked again');
  const amber = c.doorDocNudge([it('101', ['GF'], { complianceDeadline: '2026-11-20' }), it('213', ['No Tree Nuts'], {}, true)], T);
  assert.deepEqual([amber.level, amber.kind, amber.rooms], ['amber', 'late', ['101']], 'a passed reminder rises above the calm order');
  const red = c.doorDocNudge([it('101', ['GF'], { complianceDeadline: '2026-11-20' }), it('213', ['No Tree Nuts'], { complianceDeadline: '2026-11-21' }, true)], T);
  assert.deepEqual([red.level, red.rooms], ['red', ['213']], 'an anaphylactic room past its reminder rises to red');
  const pref = c.doorDocNudge([it('102', ['No Pork']), it('103', ['No Spicy', 'Halal'])], T);
  assert.deepEqual([pref.group, pref.rooms], ['preference', ['103']], 'No Pork alone needs no note');
  const waiting = c.doorDocNudge([it('101', ['GF'], { docAsk: { at: '2026-11-21' }, complianceDeadline: '2026-11-29' })], T);
  assert.equal(waiting.kind, 'waiting');
});

test('2. the badge counts only what needs the person now', () => {
  const c = box([]);
  const it = (room, tags, extra, anaph) => ({ room, st: c.doorDocState(R(room, tags, extra), T, !!anaph) });
  assert.deepEqual(out(c.doorDocBadge([it('101', ['GF']), it('102', ['Diabetic'])], T)), { count: 0, level: '' }, 'nothing due: hidden');
  assert.deepEqual(out(c.doorDocBadge([it('101', ['GF'], { complianceDeadline: '2026-11-20' }), it('102', ['Diabetic'])], T)), { count: 1, level: 'amber' });
  assert.deepEqual(out(c.doorDocBadge([it('213', ['No Tree Nuts'], { docAsk: { at: '2026-11-21' }, complianceDeadline: '2026-11-29' }, true), it('101', ['GF'])], T)), { count: 1, level: 'red' },
    'an anaphylactic room still needing a note always counts (plan review P3-10)');
  assert.match(fn('updateComplianceBadge'), /doorDocBadge\(/);
});

test('3. Mark as asked: who and when, a reminder a week out, Undo puts it back', async () => {
  const c = box([R('101', ['GF']), R('102', ['Diabetic'], { complianceDeadline: '2099-01-01' })]);
  c.__setAsk(['101', '102']);
  await c.cxMarkAsked();
  const [a, b] = c.__state();
  assert.deepEqual([a.docAsk.by, a.docAsk.at, a.complianceDeadline], ['Fiona', c.doorComplianceToday(), c.cxDayPlus(7)]);
  assert.equal(b.complianceDeadline, '2099-01-01', 'a later reminder is kept');
  assert.equal(a.confirm, 'Provisional', 'asking documents nothing');
  await c.cxUndoLast();
  assert.deepEqual([c.__state()[0].docAsk, c.__state()[0].complianceDeadline], [undefined, '']);
});

test('4. the email is in the page, grouped by what to ask, rooms only', () => {
  assert.doesNotMatch(fn('draftComplianceDigest'), /window\.open/, 'no popup window');
  assert.ok(html.includes('id="cx-ask-modal"') && html.includes('onclick="cxMarkAsked()"'));
  const c = box([R('213', ['No Tree Nuts'], { isAnaph: true, name: 'Should Not Appear' }), R('101', ['GF', 'Halal']), R('115', ['No Spicy', 'No Pork'])], ['213']);
  const t = c.cxAskText(['213', '101', '115']);
  assert.match(t.body, /Anaphylactic:\n  Room 213 — No Tree Nuts \(anaphylactic\)/);
  assert.match(t.body, /Allergies:\n  Room 101 — GF\n/);
  assert.match(t.body, /Possible preferences[^\n]*:\n  Room 115 — No Spicy\n/);
  assert.doesNotMatch(t.body, /Halal|Should Not Appear/, 'only what needs a note; no names');
  assert.equal(t.subject, 'Dietary notes needed for 3 residents (Rexdale)');
});

test('5. the row says when H&W was asked and when a new person moved in; the nudge buttons act on its rooms', () => {
  const a = html.indexOf('function cxRowHtml('); const row = html.slice(a, html.indexOf('\nasync function cxRemindRoom(', a));
  assert.match(row, /Asked ' \+ escapeHtml\(formatCompactDate\(st\.askedOn\)\)/);
  assert.match(row, /New resident since/);
  // the nudge buttons act on the rooms the nudge keeps (an inline handler carries no list)
  assert.match(fn('cxRenderNudge'), /_cxNudgeRooms = n\.rooms\.slice\(\)[\s\S]*onclick="cxNudgeAsk\(\)"[\s\S]*onclick="cxNudgeWeek\(\)"/);
  assert.match(html, /function cxNudgeWeek\(\) \{ return batchSetDeadline\(7, _cxNudgeRooms\.slice\(\)\); \}/);
});

test('6. C4 review: the reminder day is due; never-asked wording; moderate-only not emailed; no allergen recorded', () => {
  const c = box([R('300', ['Regular'], { isModerate: true, rawRestriction: 'Regular' }), R('101', ['GF']), R('813', ['Regular'], { isAnaph: true })], ['813']);
  const it = (room, tags, extra, anaph) => ({ room, st: c.doorDocState(R(room, tags, extra), T, !!anaph) });
  const due = c.doorDocNudge([it('101', ['GF'], { complianceDeadline: T, docAsk: { at: '2026-11-15' } })], T);
  assert.deepEqual([due.level, due.kind, due.asked], ['amber', 'late', true], 'on the reminder day itself');
  assert.equal(c.doorDocNudge([it('101', ['GF'], { complianceDeadline: '2026-11-20' })], T).asked, false, 'a reminder with no ask');
  assert.deepEqual(out(c.doorDocBadge([it('101', ['GF'], { complianceDeadline: T })], T)), { count: 1, level: 'amber' });
  const na = c.doorDocNudge([it('813', ['Regular'], { confirm: 'Provisional' }, true)], T);
  assert.deepEqual([na.group, na.noAllergen], ['anaph', ['813']]);
  const nudge = fn('cxRenderNudge');
  assert.match(nudge, /no allergen recorded: ask which allergen/);
  assert.match(nudge, /n\.asked \? 'Health &amp; Wellness hasn’t answered yet'/);
  // moderate only: not asked about
  c.cxOpenAsk(['300', '101', '813']);
  const t = c.cxAskText(['101', '813']);
  assert.match(t.body, /Room 813 — anaphylactic, allergen not recorded: which allergen\?/);
  assert.match(fn('cxOpenAsk'), /st\.needs\.length > 0 \|\| st\.anaphNoAllergen/);
});
