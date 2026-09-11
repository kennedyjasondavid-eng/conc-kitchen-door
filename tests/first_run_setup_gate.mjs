// P4 — first-run device setup card.
// (DOOR_DEVICE_PUBLISH_RESILIENCE_ACTION_PLAN_2026-09-11.md §5 P4, F2 = read-only skip allowed, F4 copy)
//
// A genuinely new device (no operator name, nothing ever generated, nothing owed, setup
// never completed) gets a one-time card on Enter Changes: operator name (required),
// connection key (optional: Test & connect, or "skip — this computer will only read"),
// and the site it is set to. Skipping is recorded (concDeviceReadOnly) and the P1 banner
// carries the consequence in its own words. Re-openable from Settings.
//
// Authored-to-fail: predicate/card/handlers absent; prompt does not render the card;
// capability has no read-only reason; Settings has no re-run button.
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
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(m.index, i + 1);
}
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing const ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(start, html.indexOf(';', i) + 1);
}
const NO_GH = /token|github/i;

test('P4 symbols exist', () => {
  ['doorIsNewDevice', 'doorFirstRunShouldShow', '_doorFirstRunCardHTML', 'doorFirstRunSubmit', 'doorFirstRunSkip', 'doorFirstRunReopen'].forEach(n =>
    assert.ok(new RegExp('function\\s+' + n + '\\s*\\(').test(html), 'missing ' + n));
});

test('predicate: new device only when name empty, nothing generated, nothing owed, and setup never completed', () => {
  const sb = { console }; vm.createContext(sb); vm.runInContext(fnBlock('doorIsNewDevice'), sb);
  const f = (o) => vm.runInContext('doorIsNewDevice(' + JSON.stringify(o) + ')', sb);
  const fresh = { operatorName: '', lastGeneratedAt: null, outboxCount: 0, firstRunDone: false };
  assert.equal(f(fresh), true);
  assert.equal(f({ ...fresh, operatorName: 'Joan' }), false, 'a named device is not new');
  assert.equal(f({ ...fresh, lastGeneratedAt: '2026-09-11T10:00:00Z' }), false, 'a device that has generated is not new');
  assert.equal(f({ ...fresh, outboxCount: 2 }), false, 'a device with owed work is not new');
  assert.equal(f({ ...fresh, firstRunDone: true }), false, 'completed or skipped setup never re-shows on its own');
  assert.equal(f({}), true, 'missing fields read as a fresh device');
});

test('card HTML: name field, masked optional key, site shown, Set up + Skip(read-only) buttons, no GitHub vocabulary', () => {
  const sb = { console, escapeHtml: s => String(s), _escAttr: s => String(s), currentSite: { id: 'rexdale', name: 'Rexdale' } }; vm.createContext(sb);
  vm.runInContext(fnBlock('_doorFirstRunCardHTML'), sb);
  const out = vm.runInContext('_doorFirstRunCardHTML()', sb);
  assert.match(out, /id="door-firstrun-name"/);
  assert.match(out, /id="door-firstrun-key"[^>]*type="password"|type="password"[^>]*id="door-firstrun-key"/);
  assert.match(out, /Rexdale/);
  assert.match(out, /doorFirstRunSubmit\(\)/); assert.match(out, /doorFirstRunSkip\(\)/);
  assert.match(out, /only read|read-only|read only/i);
  assert.match(out, /kitchen lead|Jason/i);
  assert.ok(!NO_GH.test(out.replace(/doorFirstRun\w+/g, '')), 'card copy leaked GitHub vocabulary');
});

function runSandbox({ name, key, validate }) {
  const store = {}; const calls = { validate: [], saved: [], drained: 0, prompt: 0, opName: [] };
  const status = { textContent: '', style: {} };
  const els = { 'door-firstrun-name': { value: name }, 'door-firstrun-key': { value: key }, 'door-firstrun-status': status };
  const sb = {
    console, calls, status,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, _store: store },
    setOperatorName: (n) => { calls.opName.push(n); store.concOperatorName = n; },
    getOperatorName: () => store.concOperatorName || '',
    PublishAuth: { getRepo: () => 'org/repo', validateToken: async (t) => { calls.validate.push(t); return validate(t); }, saveValidatedToken: (t) => { calls.saved.push(t); }, rememberFailure: () => {} },
    doorOutboxDrain: () => { calls.drained++; return 0; },
    updateDailyImportPrompt: () => { calls.prompt++; },
    document: { getElementById: (id) => els[id] || null }
  };
  vm.createContext(sb);
  vm.runInContext([fnBlock('doorSanitizeConnectionKey'), fnBlock('doorConnectFailureCopy'), fnBlock('_doorFirstRunName'), fnBlock('doorFirstRunSubmit'), fnBlock('doorFirstRunSkip')].join('\n') + '\nlet _doorFirstRunForce = false;', sb);
  return sb;
}

test('submit with name + valid key → name set, key stored (sanitized), setup marked done, not read-only, outbox drained', async () => {
  const sb = runSandbox({ name: '  Joan Wan ', key: '“key_ok_1”', validate: async () => ({}) });
  await vm.runInContext('doorFirstRunSubmit()', sb);
  assert.deepEqual([...sb.calls.opName], ['Joan Wan']);
  assert.deepEqual([...sb.calls.saved], ['key_ok_1']);
  assert.equal(sb.localStorage._store.concFirstRunDone, '1');
  assert.equal(sb.localStorage._store.concDeviceReadOnly, undefined);
  assert.equal(sb.calls.drained, 1);
});

test('submit with a rejected key → name still saved, key NOT stored, card stays (setup not done), kitchen-word status', async () => {
  const sb = runSandbox({ name: 'Joan', key: 'bad', validate: async () => { throw new Error('401 Bad credentials'); } });
  await vm.runInContext('doorFirstRunSubmit()', sb);
  assert.deepEqual([...sb.calls.opName], ['Joan']);
  assert.equal(sb.calls.saved.length, 0);
  assert.equal(sb.localStorage._store.concFirstRunDone, undefined, 'setup incomplete until the key is right or skipped');
  assert.match(sb.status.textContent, /not accepted/i); assert.ok(!NO_GH.test(sb.status.textContent));
});

test('submit without a name never proceeds; skip without a name never proceeds', async () => {
  const sb = runSandbox({ name: '  ', key: 'k', validate: async () => ({}) });
  await vm.runInContext('doorFirstRunSubmit()', sb);
  assert.equal(sb.calls.validate.length, 0); assert.equal(sb.calls.opName.length, 0); assert.match(sb.status.textContent, /name/i);
  vm.runInContext('doorFirstRunSkip()', sb);
  assert.equal(sb.localStorage._store.concFirstRunDone, undefined); assert.equal(sb.localStorage._store.concDeviceReadOnly, undefined);
});

test('skip with a name → name set, read-only recorded, setup done, nothing validated or stored', () => {
  const sb = runSandbox({ name: 'Joan', key: 'ignored_even_if_typed', validate: async () => ({}) });
  vm.runInContext('doorFirstRunSkip()', sb);
  assert.deepEqual([...sb.calls.opName], ['Joan']);
  assert.equal(sb.localStorage._store.concDeviceReadOnly, '1');
  assert.equal(sb.localStorage._store.concFirstRunDone, '1');
  assert.equal(sb.calls.validate.length, 0); assert.equal(sb.calls.saved.length, 0);
});

test('capability: a read-only device without a key carries its own reason (in its own words), and the banner stays amber', () => {
  const sb = { console }; vm.createContext(sb);
  vm.runInContext(constBlock('DOOR_PUBLISH_SKIP_REASONS') + '\n' + fnBlock('doorDeviceCapability'), sb);
  const base = { hasToken: false, tokenExpired: false, operatorName: 'Joan', autoPublishOn: true, tabStale: false, lastSkip: null, lastError: null, lastGeneratedAt: null, lastPublishOkAt: null, outbox: [] };
  const ro = vm.runInContext('doorDeviceCapability(' + JSON.stringify({ ...base, readOnly: true }) + ')', sb);
  const r = ro.reasons.find(x => x.code === 'read-only');
  assert.ok(r, 'read-only reason expected'); assert.equal(r.action, 'connect'); assert.ok(!NO_GH.test(r.label));
  assert.ok(!ro.reasons.find(x => x.code === 'no-connection'), 'read-only replaces the generic no-connection line');
  assert.equal(ro.level, 'amber');
  const notRo = vm.runInContext('doorDeviceCapability(' + JSON.stringify({ ...base, readOnly: false }) + ')', sb);
  assert.ok(notRo.reasons.find(x => x.code === 'no-connection'));
  assert.match(fnBlock('doorDeviceCapabilityInput'), /readOnly\s*:/, 'live input must read concDeviceReadOnly');
});

test('wiring: daily prompt shows the card for a new device and hides the device banner while it does; Settings can re-run setup; connecting later clears read-only', () => {
  const prompt = fnBlock('updateDailyImportPrompt');
  assert.match(prompt, /doorFirstRunShouldShow\(\)/);
  assert.match(prompt, /_doorFirstRunCardHTML\(\)/);
  assert.match(prompt, /_firstRun\s*\?\s*''\s*:/, 'device banner suppressed while the first-run card is showing');
  assert.match(html, /onclick="doorFirstRunReopen\(\)"/, 'Settings needs a re-run button');
  assert.match(fnBlock('doorConnectCardSubmit'), /concDeviceReadOnly/, 'a later successful Connect clears read-only');
});
