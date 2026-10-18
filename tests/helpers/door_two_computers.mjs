// tests/helpers/door_two_computers.mjs — two DOOR computers sharing one kitchen file (door_state.json), each running
// index.html's real resident-list, sync and publish-preflight code in its own vm sandbox (2026-10-18). Used by
// anaph_list_reaches_gate (room 813) and resident_changes_reach_gate (notes, compliance, Undo Generate).
// A publish runs the real preflight (it takes the kitchen's list when that one is newer), then writes this computer's
// list to the kitchen. Generate is modelled in generateFiles' own order, which anaph_list_reaches_gate test 2 pins.
import assert from 'node:assert/strict';
import vm from 'node:vm';

export function doorSource(html) {
  const between = (a, b) => { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); };
  const fn = (name) => {
    const m = html.match(new RegExp('\\n(async )?function ' + name + '\\('));
    assert.ok(m, 'missing ' + name);
    const s = m.index + 1; const e = html.indexOf('\n}\n', s); return html.slice(s, e) + '\n}\n';
  };
  const has = (name) => new RegExp('\\n(async )?function ' + name + '\\(').test(html);
  const fnOpt = (name) => (has(name) ? fn(name) : '');
  return { between, fn, has, fnOpt };
}

export const out = (v) => JSON.parse(JSON.stringify(v));
export const R = (room, tags, extra) => Object.assign({ room, tags, section: 'Regular' }, extra || {});
export const discharge = (room) => ({ room, type: 'discharge', tags: {}, tagLabels: [], route: 'REMOVE', notes: 'Not on daily list', isAnaph: false, isModerate: false, moderateNote: '', hadSection: 'Regular' });
export const intake = (room, tags) => ({ room, type: 'intake', tags, route: 'Regular', notes: 'From daily list import', isAnaph: false, isModerate: false, moderateNote: '', hadSection: null });

// fns: more writers to run (they must exist); optFns: ones that may not exist on an older index.html;
// extraSrc: declarations those writers need; ctx(c): more sandbox globals, given the computer being built.
export function twoComputers(html, { fns = [], optFns = [], extraSrc = '', ctx = () => ({}) } = {}) {
  const { between, fn, has, fnOpt } = doorSource(html);
  const SRC = [
    html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0], between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    fn('getRegistryProvenanceTs'), fn('setRegistryProvenance'), fn('doorRegistryDataTs'), fn('doorRegistrySyncShouldSkip'),
    fn('doorFetchRemoteRegistryMeta'), fn('doorRegistryPublishGate'), fnOpt('doorTakeNewerKitchenList'), fn('doorRegistryPublishPreflight'),
    fn('pullStateFromGitHub'), fn('saveRegistryState'), fn('dedupeRegistryList'), fn('buildStateJSON'),
    fn('doorIsAnaphResident'), fn('applyQueueToRegistry'), fnOpt('doorDischargeAnaphRoom'), fnOpt('doorAskDischargedAnaphRooms'),
    ...fns.map(fn), ...optFns.map(fnOpt), extraSrc,
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
      console: { log() {}, warn() {}, info() {}, error: console.error }, Date: FakeDate, fetch: fetchStub, setTimeout, clearTimeout, Promise,
      REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], changesQueue: [],
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
      document: { getElementById: (id) => (id in c.__els ? c.__els[id] : null) },
      PublishAuth: { getRepo: () => 'kennedyjasondavid-eng/conc-kitchen-door' },
      doorAsk: async (o) => { asked.push({ title: o.title, lines: o.lines || [] }); return answer; },
      showToast() {}, updateSyncBar() {}, renderRegistry() {}, renderAnaphList() {}, updateDailyImportPrompt() {}, doorRefreshBaseSections() {},
      pullSecondaryState: async () => {}, getOperatorName: () => name, pushResidentHistory() {}, clearResidentHistory() {},
      dedupeServiceNote: (a, b) => b || a, filterServiceNote: (a, b) => b || a, requiresDocumentation: () => false, doorApplyPendingImportStamp() {},
      publishAndSync() {
        c.__pending = (async () => {
          const pre = await c.doorRegistryPublishPreflight(false);
          if (pre && pre.cancelled) return;
          kitchen.state = out(c.buildStateJSON());
        })();
      },
    };
    c.__input = { value: '' };
    c.__els = { 'anaph-input': c.__input };
    Object.assign(c, ctx(c));
    vm.createContext(c);
    vm.runInContext(SRC, c, { filename: 'index.html#two-computers', timeout: 20000 });
    c.__asked = asked;
    c.__store = store;
    return c;
  }

  // Two computers that both took the kitchen's list this morning.
  async function morning(reg, rooms) {
    kitchen.down = false; kitchen.state = null;      // a fresh kitchen: the seed would otherwise take the last test's list
    const seed = computer('seed'); seed.__set(reg, rooms); seed.publishAndSync(); await seed.__pending;
    const a = computer('JK'), b = computer('Joan Wandera');
    await a.pullStateFromGitHub(false); await b.pullStateFromGitHub(false);
    return { a, b };
  }

  return { computer, kitchen, morning, fn, has };
}
