// tests/anaph_list_reaches_gate.mjs — the anaphylactic list follows the resident, on every DOOR computer (2026-10-18).
// Room 813: its shellfish-anaphylactic resident was discharged by the Sep 11 import, the room stayed on the list, and the
// Regular resident who moved in on Sep 17 read as anaphylactic. Jason, 2026-10-18: "Ask once at Generate", "After the
// fix, in DOOR" (813 is taken off by hand), and "Yes, in the same PR" (list and resident changes take the kitchen's
// newer list first, then mark themselves as this computer's change).
//   1. a queued discharge of a room on the list asks once at Generate; the answer travels on the change; taken off, the
//      next resident in the room is not anaphylactic; kept, the list is as before
//   2. Generate takes the kitchen's newer list, then asks, then applies; the review row and the queue say so; the
//      one-room Discharge names the list
//   3-5. two computers sharing one kitchen file, running the real list, sync and publish-preflight code:
//      3. a room put on the list survives the other computer's Generate (its tab open since the morning)
//      4. a room put on the list from a computer whose list is older than the kitchen's is sent, with the newer list
//      5. 813 taken off on one computer stays off after the other computer's Generate
//   6. every resident and list writer takes the kitchen's newer list first and marks itself newest
//   7. a kitchen that can't be read leaves the change on this computer's list
// Authored to fail on main 57c92b3 (1, 2, 3, 4, 5, 6). Env: ANAPH_REACH_HTML (another index.html, e.g. main's).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(process.env.ANAPH_REACH_HTML || new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) {
  const m = html.match(new RegExp('\\n(async )?function ' + name + '\\('));
  assert.ok(m, 'missing ' + name);
  const s = m.index + 1; const e = html.indexOf('\n}\n', s); return html.slice(s, e) + '\n}\n';
}
const has = (name) => new RegExp('\\n(async )?function ' + name + '\\(').test(html);
const fnOpt = (name) => (has(name) ? fn(name) : '');
const out = (v) => JSON.parse(JSON.stringify(v));

const SRC = [
  html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0], between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
  fn('getRegistryProvenanceTs'), fn('setRegistryProvenance'), fn('doorRegistryDataTs'), fn('doorRegistrySyncShouldSkip'),
  fn('doorFetchRemoteRegistryMeta'), fn('doorRegistryPublishGate'), fnOpt('doorTakeNewerKitchenList'), fn('doorRegistryPublishPreflight'),
  fn('pullStateFromGitHub'), fn('saveRegistryState'), fn('dedupeRegistryList'), fn('buildStateJSON'),
  fn('doorIsAnaphResident'), fn('doorAskTakeOffAnaphList'), fn('addAnaphRoom'), fn('removeAnaphRoom'),
  fnOpt('doorDischargeAnaphRoom'), fnOpt('doorAskDischargedAnaphRooms'), fn('applyQueueToRegistry'),
  // Generate's own order (test 2 pins it in generateFiles): the kitchen's newer list, the question, the queue.
  `this.__generate = async () => {
     if (typeof doorTakeNewerKitchenList === 'function') await doorTakeNewerKitchenList();
     if (typeof doorAskDischargedAnaphRooms === 'function') await doorAskDischargedAnaphRooms(changesQueue);
     applyQueueToRegistry(); changesQueue = []; publishAndSync('generate'); await this.__pending; };`,
  'this.__set = (reg, rooms) => { REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...reg); REGISTRY_MAP = {}; reg.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; }); anaphRooms = rooms; };',
  'this.__state = () => ({ rooms: anaphRooms, reg: REGISTRY_LIST });',
  'this.__queue = (q) => { changesQueue.push(...q); };',
].join('\n');

// One clock for every computer: each "now" is a second later, so the order of saves is the order they happened.
let NOW = Date.parse('2026-10-18T12:00:00Z');
class FakeDate extends Date {
  constructor(...a) { if (a.length) super(...a); else { NOW += 1000; super(NOW); } }
  static now() { NOW += 1000; return NOW; }
}
// The kitchen: door_state.json as the last publish left it.
const kitchen = { state: null, down: false };
const fetchStub = async (url) => {
  if (kitchen.down) throw new Error('offline');
  if (!/door_state\.json/.test(String(url)) || !kitchen.state) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => out(kitchen.state) };
};

function computer(name, answer = true) {
  const store = {};
  const asked = [];
  const c = {
    console: { log() {}, warn() {}, info() {}, error: console.error }, Date: FakeDate, fetch: fetchStub, setTimeout, Promise,
    REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], changesQueue: [],
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { getElementById: (id) => (id === 'anaph-input' ? c.__input : null) },
    PublishAuth: { getRepo: () => 'kennedyjasondavid-eng/conc-kitchen-door' },
    doorAsk: async (o) => { asked.push(o.title); return answer; },
    showToast() {}, updateSyncBar() {}, renderRegistry() {}, renderAnaphList() {}, updateDailyImportPrompt() {}, doorRefreshBaseSections() {},
    pullSecondaryState: async () => {}, getOperatorName: () => name, pushResidentHistory() {}, clearResidentHistory() {},
    dedupeServiceNote: (a, b) => b || a, filterServiceNote: (a, b) => b || a, requiresDocumentation: () => false, doorApplyPendingImportStamp() {},
    // A publish runs the real preflight (it takes the kitchen's list when that one is newer), then sends this list.
    publishAndSync() {
      c.__pending = (async () => {
        const pre = await c.doorRegistryPublishPreflight(false);
        if (pre && pre.cancelled) return;
        kitchen.state = out(c.buildStateJSON());
      })();
    },
  };
  c.__input = { value: '' };
  vm.createContext(c);
  vm.runInContext(SRC, c, { filename: 'index.html#anaph-reach', timeout: 20000 });
  c.__asked = asked;
  c.__store = store;
  return c;
}

const R = (room, tags, extra) => Object.assign({ room, tags, section: 'Regular' }, extra || {});
// The published list on Sep 11, before the import that morning (the four anaphylactic rooms, a few others).
const SEP11 = () => [
  R('213', ['Soft Meals', 'No Tree Nuts', 'No Coconut'], { isAnaph: true, anaphTags: ['noCoconut', 'noTreeNuts'] }),
  R('813', ['GF', 'No Dairy', 'No Shellfish', 'Lactose Intolerant'], { isAnaph: true, anaphTags: ['noShellfish'], section: 'Anaphylactic Alternative' }),
  R('607a', ['No Dairy', 'No Peanuts'], { isAnaph: true, anaphTags: ['noPeanuts'] }),
  R('1213', ['Diabetic', 'No Peanuts'], { isAnaph: true }),
  R('305', ['Regular']), R('500', ['No Peanuts']),
];
const LIST = () => ['213', '813', '607a', '1213'];
const discharge = (room) => ({ room, type: 'discharge', tags: {}, tagLabels: [], route: 'REMOVE', notes: 'Not on daily list', isAnaph: false, isModerate: false, moderateNote: '', hadSection: 'Regular' });
const intake = (room, tags) => ({ room, type: 'intake', tags, route: 'Regular', notes: 'From daily list import', isAnaph: false, isModerate: false, moderateNote: '', hadSection: null });
// Two computers that both took the kitchen's list this morning.
async function morning(reg, rooms) {
  kitchen.down = false; kitchen.state = null;      // a fresh kitchen: the seed would otherwise take the last test's list
  const seed = computer('seed'); seed.__set(reg, rooms); seed.publishAndSync(); await seed.__pending;
  const a = computer('JK'), b = computer('Joan Wandera');
  await a.pullStateFromGitHub(false); await b.pullStateFromGitHub(false);
  return { a, b };
}

test('1. a queued discharge of an anaphylactic room asks once at Generate; taken off, the next resident in 813 is not anaphylactic', async () => {
  assert.ok(has('doorAskDischargedAnaphRooms'), 'the question exists');
  // Kept (Escape, or "Keep it on the list"): as before, the room stays.
  const keep = computer('t', false);
  keep.__set(SEP11(), LIST());
  keep.__queue([discharge('813'), discharge('305')]);
  await keep.doorAskDischargedAnaphRooms(keep.changesQueue);
  assert.deepEqual(keep.__asked, ['Room 813 is anaphylactic'], 'asked once, about 813 only');
  assert.equal(keep.changesQueue[0].anaphCleared, false, 'the answer travels on the change');
  keep.applyQueueToRegistry();
  assert.deepEqual(out(keep.__state().rooms), LIST(), 'kept on the list');
  // Taken off: the Sep 17 intake of a Regular resident is not anaphylactic.
  const off = computer('t', true);
  off.__set(SEP11(), LIST());
  off.__queue([discharge('813')]);
  await off.doorAskDischargedAnaphRooms(off.changesQueue);
  off.applyQueueToRegistry();
  assert.deepEqual(out(off.__state().rooms), ['213', '607a', '1213'], 'off the list');
  off.changesQueue.length = 0; off.__queue([intake('813', { regular: true })]);
  off.applyQueueToRegistry();
  const r813 = off.__state().reg.find((r) => r.room === '813');
  assert.equal(off.doorIsAnaphResident(r813), false, 'the Regular resident who moved in is not anaphylactic');
  // An answer already given isn't asked again; nothing anaphylactic, nothing asked; a room on the list by flag only counts.
  const again = computer('t', true);
  again.__set(SEP11(), ['213']);
  again.__queue([{ ...discharge('813'), anaphCleared: false }, discharge('305'), discharge('607a')]);
  await again.doorAskDischargedAnaphRooms(again.changesQueue);
  assert.deepEqual(again.__asked, ['Room 607a is anaphylactic'], '813 already answered; 305 not anaphylactic; 607a by its flag');
});

test('2. Generate takes the kitchen\'s newer list, then asks, then applies; the review and the queue say so; Discharge names the list', () => {
  const gen = fn('generateFiles');
  assert.match(gen, /^async function generateFiles\(/, 'Generate is async');
  const iTake = gen.indexOf('await doorTakeNewerKitchenList()'), iAsk = gen.indexOf('await doorAskDischargedAnaphRooms(changesQueue)'), iApply = gen.indexOf('applyQueueToRegistry()');
  assert.ok(iTake > 0 && iAsk > iTake && iApply > iAsk, 'the kitchen\'s list, the question, then the queue: ' + [iTake, iAsk, iApply]);
  assert.match(fn('applyQueueToRegistry'), /if \(c\.anaphCleared\) \{[\s\S]{0,200}anaphRooms\.splice/, 'a discharge takes the room off only when answered');
  assert.match(html, /doorDischargeAnaphRoom\(c\) \? \(c\.anaphCleared === true \? [^\n]*comes off the anaphylactic list[^\n]*stays on the anaphylactic list[^\n]*Generate asks/, 'the review row names it');
  assert.match(fn('renderQueue'), /doorDischargeAnaphRoom\(c\) \?[^\n]*Anaphylactic/, 'the queue tags it');
  assert.match(fn('saveDirectFromForm'), /also comes off the anaphylactic list/, 'the one-room Discharge says the room comes off the list');
});

test('3. a room put on the list survives the other computer\'s Generate (its tab open since the morning)', async () => {
  const { a, b } = await morning(SEP11(), ['213']);
  a.__input.value = '500';
  await a.addAnaphRoom(); await a.__pending;
  assert.ok(kitchen.state.anaphRooms.includes('500'), 'sent to the kitchen');
  b.__queue([intake('900', { regular: true })]);   // the morning's import, applied at Generate
  await b.__generate();
  assert.deepEqual([kitchen.state.anaphRooms.includes('500'), out(b.__state().rooms).includes('500')], [true, true],
    'after B\'s Generate the kitchen and B still have 500 on the list: ' + JSON.stringify(kitchen.state.anaphRooms));
  assert.ok(kitchen.state.residents.some((r) => r.room === '900'), 'and B\'s intake is there');
});

test('4. a room put on the list from a computer whose list is older than the kitchen\'s is sent, with the newer list', async () => {
  const { a, b } = await morning(SEP11(), ['213']);
  b.__queue([intake('900', { regular: true })]);
  await b.__generate();                             // the kitchen is now newer than A
  a.__input.value = '500';
  await a.addAnaphRoom(); await a.__pending;
  assert.deepEqual([kitchen.state.anaphRooms.includes('500'), kitchen.state.residents.some((r) => r.room === '900')], [true, true],
    'the kitchen has A\'s room and B\'s intake: ' + JSON.stringify(kitchen.state.anaphRooms));
  assert.ok(out(a.__state().rooms).includes('500'), 'and A still shows it');
});

test('5. 813 taken off on one computer stays off after the other computer\'s Generate', async () => {
  const reg = SEP11().map((r) => (r.room === '813' ? R('813', ['Regular']) : r));   // since Sep 17
  const { a, b } = await morning(reg, LIST());
  await a.removeAnaphRoom('813'); await a.__pending;
  assert.ok(!kitchen.state.anaphRooms.includes('813'), 'off in the kitchen');
  await b.pullStateFromGitHub(false);               // B's next sync
  b.__queue([intake('900', { regular: true })]);
  await b.__generate();
  assert.deepEqual([kitchen.state.anaphRooms.includes('813'), out(b.__state().rooms).includes('813')], [false, false],
    'still off after B\'s Generate: ' + JSON.stringify(kitchen.state.anaphRooms));
});

test('6. every resident and list writer takes the kitchen\'s newer list first and marks itself newest', () => {
  for (const name of ['saveRegistryEdit', 'saveDirectFromForm', 'commitIntakeQueue', 'revertResident', 'addAnaphRoom', 'removeAnaphRoom']) {
    const body = fn(name);
    const iTake = body.indexOf('await doorTakeNewerKitchenList()');
    const iMark = body.lastIndexOf('setRegistryProvenance()');
    const iSave = body.lastIndexOf('saveRegistryState()');
    assert.ok(/^async function /.test(body), name + ' is async');
    assert.ok(iTake > 0, name + ' takes the kitchen\'s newer list');
    assert.ok(iMark > iTake && iSave > iMark, name + ' marks itself newest before it saves: ' + [iTake, iMark, iSave]);
  }
  assert.match(fn('saveRegistryEdit'), /const pickedAnaphTags = [^\n]*\n\s*await doorTakeNewerKitchenList\(\);\n\s*const r = REGISTRY_MAP\[room\.toLowerCase\(\)\]/,
    'Enter Changes reads the form first, then finds the room on the newer list');
  assert.match(fn('saveChangeEdit'), /await saveRegistryEdit\(\)/, 'its caller waits for it');
  assert.match(fn('confirmRevertResidentFromEditor'), /await revertResident\(/, 'Revert\'s caller waits for it');
});

test('7. a kitchen that can\'t be read leaves the change on this computer\'s list', async () => {
  const { a } = await morning(SEP11(), ['213']);
  kitchen.down = true;
  assert.equal(await a.doorTakeNewerKitchenList(), 'unchecked');
  a.__input.value = '500';
  await a.addAnaphRoom();
  assert.ok(out(a.__state().rooms).includes('500'), 'added here');
  kitchen.down = false;
});
