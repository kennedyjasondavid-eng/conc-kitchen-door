// P0 — registry freshness stamp fires at APPLY, not at import-commit.
// (DOOR_DEVICE_PUBLISH_RESILIENCE_ACTION_PLAN_2026-09-11.md §5 P0)
//
// Before P0, commitImportToQueue stamped every imported resident's `lastImported`
// the moment the import was committed to the queue — before Review & Generate ever
// applied it. An import that was committed and then abandoned read as "registry
// current as of today" to the stale-registry banner (whose ground truth is the
// freshest lastImported), the exact blind spot the 2026-08-31 hardening described.
//
// After P0: commit RECORDS the imported room list (concPendingImportStamp) when it
// queued changes, and applyQueueToRegistry stamps those rooms once the queue is
// applied. A zero-change import (nothing to apply — the roster is verified current)
// stamps immediately, so daily "0 changes" checks still keep the banner honest.
//
// Authored-to-fail: against pre-P0 index.html the helpers are missing and the
// source scans find the stamp inside commitImportToQueue.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(m.index, i + 1);
}

function fakeStorage(seed) {
  const store = { ...(seed || {}) };
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _store: store
  };
}

function makeSandbox(residents, storageSeed) {
  const REGISTRY_LIST = residents.map(r => ({ ...r }));
  const REGISTRY_MAP = {};
  REGISTRY_LIST.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const sb = {
    console, REGISTRY_LIST, REGISTRY_MAP, anaphRooms: [], changesQueue: [],
    localStorage: fakeStorage(storageSeed),
    TAG_LABELS_MAP: { noPork: 'No Pork', halal: 'Halal' },
    ROUTING_TAGS: new Set(['Halal']), ALLERGEN_TAGS: new Set([]), ACCOMMODATION_TAGS: new Set(['No Pork']),
    requiresDocumentation: () => false, filterServiceNote: () => '', dedupeServiceNote: (a, b) => b,
    pushResidentHistory: () => {}, clearResidentHistory: () => {}, getOperatorName: () => 'test',
    saveRegistryState: () => { sb._saves = (sb._saves || 0) + 1; }, setRegistryProvenance: () => {},
    _saves: 0
  };
  vm.createContext(sb);
  return sb;
}

const HELPERS = ['doorStampImportedRooms', 'doorRecordImportStamp', 'doorApplyPendingImportStamp'];

test('P0 helpers exist (stamp / record / apply-pending)', () => {
  HELPERS.forEach(h => assert.ok(new RegExp('function\\s+' + h + '\\s*\\(').test(html), 'missing ' + h));
  assert.ok(/const DOOR_PENDING_IMPORT_STAMP_KEY\s*=\s*'concPendingImportStamp'/.test(html), 'pending-stamp key const missing');
});

test('commitImportToQueue no longer stamps lastImported itself; it records via doorRecordImportStamp(rooms, date, pushed)', () => {
  const body = fnBlock('commitImportToQueue');
  assert.ok(!/\.lastImported\s*=/.test(body), 'commitImportToQueue still assigns lastImported directly');
  assert.ok(/doorRecordImportStamp\([\s\S]*?,\s*pushed\)/.test(body), 'commitImportToQueue must call doorRecordImportStamp(..., pushed)');
});

test('applyQueueToRegistry consumes the pending stamp after the registry map is rebuilt', () => {
  const body = fnBlock('applyQueueToRegistry');
  const rebuild = body.indexOf('Rebuild REGISTRY_MAP');
  const stamp = body.indexOf('doorApplyPendingImportStamp()');
  const save = body.lastIndexOf('saveRegistryState()');
  assert.ok(stamp > 0, 'applyQueueToRegistry must call doorApplyPendingImportStamp()');
  assert.ok(rebuild > 0 && stamp > rebuild, 'stamp must run after the REGISTRY_MAP rebuild (so new intakes are stampable)');
  assert.ok(save > stamp, 'stamp must run before the final saveRegistryState()');
});

test('doorStampImportedRooms stamps only rooms present, case-insensitively, and returns the count', () => {
  const sb = makeSandbox([{ room: '912', lastImported: '2026-05-20' }, { room: '213', lastImported: '2026-05-20' }]);
  vm.runInContext(fnBlock('doorStampImportedRooms'), sb);
  const n = vm.runInContext("doorStampImportedRooms(['912', 'ABSENT', '213'.toUpperCase()], '2026-09-11')", sb);
  assert.equal(n, 2);
  assert.equal(sb.REGISTRY_MAP['912'].lastImported, '2026-09-11');
  assert.equal(sb.REGISTRY_MAP['213'].lastImported, '2026-09-11');
});

test('doorRecordImportStamp: zero queued changes → stamps NOW (roster verified current); queued changes → pending only', () => {
  const sb = makeSandbox([{ room: '912', lastImported: '2026-05-20' }]);
  vm.runInContext(fnBlock('doorStampImportedRooms') + '\n' + fnBlock('doorRecordImportStamp') + "\nconst DOOR_PENDING_IMPORT_STAMP_KEY='concPendingImportStamp';", sb);
  // queued>0 → nothing stamped yet, pending written
  const r1 = vm.runInContext("doorRecordImportStamp(['912','605'], '2026-09-11', 3)", sb);
  assert.equal(r1, 'pending');
  assert.equal(sb.REGISTRY_MAP['912'].lastImported, '2026-05-20', 'must NOT stamp before apply');
  assert.deepEqual(JSON.parse(sb.localStorage._store.concPendingImportStamp), { date: '2026-09-11', rooms: ['912', '605'] });
  // zero → stamped immediately
  const r2 = vm.runInContext("doorRecordImportStamp(['912'], '2026-09-12', 0)", sb);
  assert.equal(r2, 'stamped');
  assert.equal(sb.REGISTRY_MAP['912'].lastImported, '2026-09-12');
  // empty rooms → no-op
  assert.equal(vm.runInContext("doorRecordImportStamp([], '2026-09-12', 0)", sb), 'none');
});

test('applyQueueToRegistry with a pending stamp: existing + NEW intake rooms get stamped, untouched rooms do not, pending is cleared', () => {
  const sb = makeSandbox(
    [{ room: '912', lastImported: '2026-05-20', tags: ['Regular'] }, { room: '213', lastImported: '2026-05-20', tags: ['Regular'] }],
    { concPendingImportStamp: JSON.stringify({ date: '2026-09-11', rooms: ['912', '605'] }) }
  );
  vm.runInContext(HELPERS.map(fnBlock).join('\n') + "\nconst DOOR_PENDING_IMPORT_STAMP_KEY='concPendingImportStamp';\n" + fnBlock('applyQueueToRegistry'), sb);
  sb.changesQueue.push({ room: '605', type: 'intake', tags: { noPork: true }, route: 'Regular', notes: '' });
  vm.runInContext('applyQueueToRegistry()', sb);
  assert.equal(sb.REGISTRY_MAP['605'].lastImported, '2026-09-11', 'new intake must carry the import date');
  assert.equal(sb.REGISTRY_MAP['912'].lastImported, '2026-09-11');
  assert.equal(sb.REGISTRY_MAP['213'].lastImported, '2026-05-20', 'room not on the list is untouched');
  assert.equal(sb.localStorage.getItem('concPendingImportStamp'), null, 'pending stamp consumed');
});

test('applyQueueToRegistry with no pending stamp (legacy / manual queue) changes no lastImported and does not throw', () => {
  const sb = makeSandbox([{ room: '912', lastImported: '2026-05-20', tags: ['Regular'] }]);
  vm.runInContext(HELPERS.map(fnBlock).join('\n') + "\nconst DOOR_PENDING_IMPORT_STAMP_KEY='concPendingImportStamp';\n" + fnBlock('applyQueueToRegistry'), sb);
  vm.runInContext('applyQueueToRegistry()', sb);
  assert.equal(sb.REGISTRY_MAP['912'].lastImported, '2026-05-20');
  // malformed pending → cleared, nothing stamped, no throw
  sb.localStorage.setItem('concPendingImportStamp', '{not json');
  vm.runInContext('applyQueueToRegistry()', sb);
  assert.equal(sb.REGISTRY_MAP['912'].lastImported, '2026-05-20');
  assert.equal(sb.localStorage.getItem('concPendingImportStamp'), null);
});
