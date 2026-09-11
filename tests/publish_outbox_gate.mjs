// P3 — durable publish outbox.
// (DOOR_DEVICE_PUBLISH_RESILIENCE_ACTION_PLAN_2026-09-11.md §5 P3, F1 = pointer flag)
//
// Every skipped or failed publish appends a POINTER entry {ts, context, reason,
// registryModifiedAt} to concPublishOutbox — never a payload; the state is already in
// localStorage. Drain points: after a successful Connect (P2 card), at boot when a key
// exists. Drain publishes CURRENT state once; the outbox is "something is owed" with
// provenance, not a replay log. Only a landed publish clears it. Writes go through
// doorSetItemSafe (HOUSE_PROVEN_SEAMS row 1, DOOR's named gap): on quota, drop the
// expendable pre-Generate undo snapshot and retry once; fail loud, never throw.
// The P1 banner's "unpublished" reads the outbox count first, the Generate-vs-publish
// timestamp proxy second.
//
// Authored-to-fail: outbox helpers absent; publish paths neither append nor clear;
// connect re-runs publishAndSync directly; boot has no drain.
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
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing const ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(start, html.indexOf(';', i) + 1);
}
function fakeStorage(seed, opts) {
  const store = { ...(seed || {}) }; let failures = (opts && opts.failWrites) || 0;
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { if (failures > 0 || failures === Infinity) { if (failures !== Infinity) failures--; const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _store: store, _removed: []
  };
  const rm = ls.removeItem; ls.removeItem = k => { ls._removed.push(k); rm(k); };
  return ls;
}
const CONSTS = "\nconst DOOR_PUBLISH_OUTBOX_KEY='concPublishOutbox';\nconst DOOR_OUTBOX_MAX=50;\nconst DOOR_EXPENDABLE_KEYS=['concRegistrySnapshot'];";
const OUTBOX_SRC = () => ['doorSetItemSafe', 'doorOutboxRead', 'doorOutboxAppend', 'doorOutboxClear', 'doorOutboxDrain'].map(fnBlock).join('\n') + CONSTS;

test('the expendable-keys list names the pre-Generate undo snapshot and nothing load-bearing', () => {
  const m = /const DOOR_EXPENDABLE_KEYS\s*=\s*\[([^\]]*)\]/.exec(html);
  assert.ok(m, 'missing DOOR_EXPENDABLE_KEYS');
  assert.match(m[1], /'concRegistrySnapshot'/);
  ['concRegistryState', 'conc-door-settings', 'concUploadedMenu', 'concMenuBase', 'concPublishOutbox', 'concLearnedNR'].forEach(k =>
    assert.ok(!m[1].includes(k), k + ' must never be expendable'));
});

test('P3 symbols exist', () => {
  ['doorSetItemSafe', 'doorOutboxRead', 'doorOutboxAppend', 'doorOutboxClear', 'doorOutboxDrain'].forEach(n =>
    assert.ok(new RegExp('function\\s+' + n + '\\s*\\(').test(html), 'missing ' + n));
  assert.ok(/const DOOR_PUBLISH_OUTBOX_KEY\s*=\s*'concPublishOutbox'/.test(html));
  assert.ok(/const DOOR_OUTBOX_MAX\s*=\s*\d+/.test(html));
});

test('append records pointer entries (no payload) with provenance; read tolerates garbage; cap holds', () => {
  const warns = [];
  const sb = { console: { warn: (...a) => warns.push(a.join(' ')), log() {}, error() {} }, localStorage: fakeStorage(), getRegistryProvenanceTs: () => 1789129194146 };
  vm.createContext(sb); vm.runInContext(OUTBOX_SRC(), sb);
  vm.runInContext("doorOutboxAppend('plating sheets generated', 'missing_auth'); doorOutboxAppend('registry edit: Room 912', 'stale-tab'); doorOutboxAppend('menu edit', 'error')", sb);
  const ob = vm.runInContext('doorOutboxRead()', sb);
  assert.equal(ob.length, 3);
  assert.equal(ob[0].context, 'plating sheets generated'); assert.equal(ob[0].reason, 'missing_auth');
  assert.match(ob[0].ts, /^\d{4}-\d{2}-\d{2}T/); assert.equal(ob[0].registryModifiedAt, new Date(1789129194146).toISOString());
  assert.ok(!('residents' in ob[0]) && !('payload' in ob[0]), 'pointer only — never a payload');
  // garbage → []
  sb.localStorage._store.concPublishOutbox = '{not json';
  assert.equal(vm.runInContext('doorOutboxRead().length', sb), 0);
  // cap: 60 appends → at most DOOR_OUTBOX_MAX, newest kept
  sb.localStorage._store.concPublishOutbox = '[]';
  vm.runInContext("for (let i=0;i<60;i++) doorOutboxAppend('ctx'+i,'error')", sb);
  const capped = vm.runInContext('doorOutboxRead()', sb);
  assert.ok(capped.length <= 50 && capped.length >= 40, 'capped, got ' + capped.length);
  assert.equal(capped[capped.length - 1].context, 'ctx59', 'newest survive the cap');
});

test('doorSetItemSafe: quota once → drops the expendable undo snapshot, retries, succeeds; persistent quota → false, loud, no throw', () => {
  const warns = [];
  const sb = { console: { warn: (...a) => warns.push(a.join(' ')), log() {}, error() {} }, localStorage: fakeStorage({ concRegistrySnapshot: 'x'.repeat(10) }, { failWrites: 1 }) };
  vm.createContext(sb); vm.runInContext(fnBlock('doorSetItemSafe') + CONSTS, sb);
  assert.equal(vm.runInContext("doorSetItemSafe('k','v')", sb), true);
  assert.ok(sb.localStorage._removed.includes('concRegistrySnapshot'), 'expendable snapshot dropped for headroom');
  assert.equal(sb.localStorage._store.k, 'v');
  const sb2 = { console: { warn: (...a) => warns.push(a.join(' ')), log() {}, error() {} }, localStorage: fakeStorage({}, { failWrites: Infinity }) };
  vm.createContext(sb2); vm.runInContext(fnBlock('doorSetItemSafe') + CONSTS, sb2);
  assert.equal(vm.runInContext("doorSetItemSafe('k','v')", sb2), false);
  assert.ok(warns.some(w => /doorSetItemSafe/.test(w)), 'failure is loud on the console');
});

test('drain: owed + key present → ONE publishAndSync naming the count; nothing owed or no key → no call', () => {
  const mk = (outbox, hasKey) => {
    const calls = [];
    const sb = { console, localStorage: fakeStorage(outbox ? { concPublishOutbox: JSON.stringify(outbox) } : {}), getRegistryProvenanceTs: () => 0,
      PublishAuth: { getSavedToken: () => hasKey ? 'k' : '' }, publishAndSync: (ctx) => calls.push(ctx) };
    vm.createContext(sb); vm.runInContext(OUTBOX_SRC(), sb); return { sb, calls };
  };
  const two = [{ ts: '2026-09-11T09:00:00Z', context: 'a', reason: 'missing_auth' }, { ts: '2026-09-11T10:00:00Z', context: 'b', reason: 'missing_auth' }];
  const a = mk(two, true); assert.equal(vm.runInContext("doorOutboxDrain('connect')", a.sb), 2); assert.equal(a.calls.length, 1); assert.match(a.calls[0], /2/);
  const b = mk(null, true); assert.equal(vm.runInContext("doorOutboxDrain('boot')", b.sb), 0); assert.equal(b.calls.length, 0);
  const c = mk(two, false); assert.equal(vm.runInContext("doorOutboxDrain('boot')", c.sb), 0); assert.equal(c.calls.length, 0);
  // drain does NOT clear the outbox itself — only a landed publish does
  assert.equal(vm.runInContext('doorOutboxRead().length', a.sb), 2);
  vm.runInContext('doorOutboxClear()', a.sb); assert.equal(vm.runInContext('doorOutboxRead().length', a.sb), 0);
});

test('capability: outbox count drives "unpublished" (red) ahead of the timestamp proxy; both empty → nothing pending', () => {
  const sb = { console }; vm.createContext(sb);
  vm.runInContext(constBlock('DOOR_PUBLISH_SKIP_REASONS') + '\n' + fnBlock('doorDeviceCapability'), sb);
  const base = { hasToken: true, tokenExpired: false, operatorName: 'J', autoPublishOn: true, tabStale: false, lastSkip: null, lastError: null, lastGeneratedAt: '2026-09-11T10:00:00Z', lastPublishOkAt: '2026-09-11T11:00:00Z' };
  const c = (o) => vm.runInContext('doorDeviceCapability(' + JSON.stringify({ ...base, ...o }) + ')', sb);
  const withBox = c({ outbox: [{ ts: '2026-09-11T12:00:00Z', context: 'x' }, { ts: '2026-09-11T12:30:00Z', context: 'y' }] });
  assert.equal(withBox.unpublished.pending, true); assert.equal(withBox.unpublished.count, 2); assert.equal(withBox.unpublished.since, '2026-09-11T12:00:00Z'); assert.equal(withBox.level, 'red');
  assert.equal(c({ outbox: [] }).unpublished.pending, false);
  const proxy = c({ outbox: [], lastGeneratedAt: '2026-09-11T12:00:00Z' });
  assert.equal(proxy.unpublished.pending, true, 'timestamp proxy still works when the outbox is empty');
  assert.equal(c({ outbox: undefined }).unpublished.pending, false, 'missing outbox field tolerated');
});

test('wiring: publish paths append on skip/throw and clear on landed publish; connect drains; boot drains; input reads the outbox', () => {
  const pas = fnBlock('publishAndSync');
  assert.ok((pas.match(/doorOutboxAppend\(/g) || []).length >= 2, 'publishAndSync must append on skip AND on throw');
  assert.match(fnBlock('_doPublishToGitHub'), /concLastPublishOk[\s\S]{0,200}doorOutboxClear\(\)/, 'landed publish clears the outbox next to the ok stamp');
  const connect = fnBlock('doorConnectCardSubmit');
  assert.match(connect, /doorOutboxDrain\(/, 'connect drains the outbox');
  assert.ok(!/publishAndSync\(/.test(connect), 'connect must not bypass the drain with a direct publishAndSync');
  assert.match(html, /ensureRegistrySynced\(\)[\s\S]{0,200}doorOutboxDrain\('boot'\)/, 'boot chains a drain after the registry sync');
  assert.match(fnBlock('doorDeviceCapabilityInput'), /outbox\s*:\s*doorOutboxRead\(\)/);
  assert.match(fnBlock('_doorDeviceBannerHTML'), /unpublished\.count/, 'banner shows the count');
});
