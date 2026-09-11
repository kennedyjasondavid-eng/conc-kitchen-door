// P5 — registry publish gating (refined: adopt-then-publish).
// (DOOR_DEVICE_PUBLISH_RESILIENCE_ACTION_PLAN_2026-09-11.md §5 P5, F3 = manual override with dated confirm)
//
// The frozen-roster republish: a machine that only edits menus published ITS roster
// into door_state.json for 40 publishes, May 21 – Aug 31. Before every publish, DOOR now
// asks the shared board for its registry timestamp. If the shared roster is NEWER than
// this computer's, the auto path ADOPTS it first (the same read-side pull the boot sync
// uses — safe, because "local older" means local has no unpublished registry edits)
// and publishes a coherent four-artifact set from the newer roster. This is the plan's
// "omit the registry artifacts" refined: omitting would leave routing/menu stamps
// desynced; adopting keeps the set whole and heals the stale machine. A MANUAL Publish
// Now may instead FORCE the older roster after a confirm that names both dates (F3).
// Legacy remote (no registryModifiedAt) or unreachable remote → publish as today.
//
// Authored-to-fail: preflight/gate absent; _doPublishToGitHub never consults the remote.
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

const REMOTE_NEWER = { registryModifiedAt: '2026-09-11T12:19:54.146Z', exported: '2026-09-11T12:19:56.766Z' };
const LOCAL_OLD = new Date('2026-05-20T12:00:00Z').getTime();
const LOCAL_NEW = new Date('2026-09-12T08:00:00Z').getTime();

test('P5 symbols exist', () => {
  ['doorFetchRemoteRegistryMeta', 'doorRegistryPublishGate', 'doorRegistryPublishPreflight'].forEach(n =>
    assert.ok(new RegExp('(?:async\\s+)?function\\s+' + n + '\\s*\\(').test(html), 'missing ' + n));
});

test('gate (pure): remote newer → adopt; equal/older → keep local; legacy remote → publish as today; unreachable/malformed → unknown, publish as today', () => {
  const sb = { console }; vm.createContext(sb); vm.runInContext(fnBlock('doorRegistryPublishGate'), sb);
  const g = (meta, local) => vm.runInContext('doorRegistryPublishGate(' + JSON.stringify(meta) + ',' + local + ')', sb);
  const a = g(REMOTE_NEWER, LOCAL_OLD); assert.equal(a.adopt, true); assert.equal(a.reason, 'remote-newer'); assert.equal(a.remoteTs, new Date(REMOTE_NEWER.registryModifiedAt).getTime()); assert.equal(a.localTs, LOCAL_OLD);
  assert.equal(g(REMOTE_NEWER, LOCAL_NEW).adopt, false); assert.equal(g(REMOTE_NEWER, LOCAL_NEW).reason, 'local-current');
  assert.equal(g(REMOTE_NEWER, new Date(REMOTE_NEWER.registryModifiedAt).getTime()).adopt, false, 'equal → keep local');
  assert.equal(g({ exported: '2026-08-31T09:41:46.434Z' }, LOCAL_OLD).adopt, false); assert.equal(g({ exported: '2026-08-31T09:41:46.434Z' }, LOCAL_OLD).reason, 'legacy');
  assert.equal(g(null, LOCAL_OLD).adopt, false); assert.equal(g(null, LOCAL_OLD).reason, 'unknown');
  assert.equal(g({ registryModifiedAt: 'garbage' }, LOCAL_OLD).reason, 'unknown');
  assert.equal(g(REMOTE_NEWER, 0).adopt, true, 'a device with no provenance at all adopts');
});

function preflightSandbox({ meta, fetchThrows, localTs, confirmAnswer }) {
  const calls = { pull: [], confirm: [] };
  const sb = {
    console, calls,
    getRegistryProvenanceTs: () => localTs,
    doorFetchRemoteRegistryMeta: async () => { if (fetchThrows) throw new Error('offline'); return meta; },
    pullStateFromGitHub: async (manual) => { calls.pull.push(manual); },
    confirm: (msg) => { calls.confirm.push(msg); return confirmAnswer; }
  };
  vm.createContext(sb);
  vm.runInContext(fnBlock('doorRegistryPublishGate') + '\n' + fnBlock('doorRegistryPublishPreflight'), sb);
  return sb;
}

test('preflight (auto): shared roster newer → adopts via the read-side pull, never asks', async () => {
  const sb = preflightSandbox({ meta: REMOTE_NEWER, localTs: LOCAL_OLD, confirmAnswer: true });
  const r = await vm.runInContext('doorRegistryPublishPreflight(false)', sb);
  assert.equal(r.adopted, true); assert.equal(r.forced, false);
  assert.deepEqual([...sb.calls.pull], [false], 'one quiet pull (the boot-sync path)');
  assert.equal(sb.calls.confirm.length, 0, 'auto path never prompts');
});

test('preflight (manual, F3): OK → adopt shared; Cancel → FORCE this computer’s older roster; the prompt names BOTH dates', async () => {
  const ok = preflightSandbox({ meta: REMOTE_NEWER, localTs: LOCAL_OLD, confirmAnswer: true });
  const r1 = await vm.runInContext('doorRegistryPublishPreflight(true)', ok);
  assert.equal(r1.adopted, true); assert.equal(r1.forced, false); assert.equal(ok.calls.pull.length, 1);
  assert.equal(ok.calls.confirm.length, 1);
  assert.match(ok.calls.confirm[0], /2026|Sep/); assert.match(ok.calls.confirm[0], /May|2026-05|never/);
  assert.match(ok.calls.confirm[0], /older|newer/i);
  const cancel = preflightSandbox({ meta: REMOTE_NEWER, localTs: LOCAL_OLD, confirmAnswer: false });
  const r2 = await vm.runInContext('doorRegistryPublishPreflight(true)', cancel);
  assert.equal(r2.adopted, false); assert.equal(r2.forced, true); assert.equal(cancel.calls.pull.length, 0, 'forced → local roster untouched');
});

test('preflight: local current, legacy remote, or unreachable remote → no pull, no prompt, no throw', async () => {
  for (const cfg of [{ meta: REMOTE_NEWER, localTs: LOCAL_NEW }, { meta: { exported: 'x' }, localTs: LOCAL_OLD }, { meta: null, localTs: LOCAL_OLD }, { meta: REMOTE_NEWER, localTs: LOCAL_OLD, fetchThrows: true }]) {
    const sb = preflightSandbox({ ...cfg, confirmAnswer: true });
    const r = await vm.runInContext('doorRegistryPublishPreflight(true)', sb);
    assert.equal(r.adopted, false); assert.equal(r.forced, false);
    assert.equal(sb.calls.pull.length, 0); assert.equal(sb.calls.confirm.length, 0);
  }
});

test('wiring: _doPublishToGitHub runs the preflight after credentials and BEFORE building the artifact set; adoption/force is visible in the success line; confirm only on the manual path', () => {
  const pub = fnBlock('_doPublishToGitHub');
  const pre = pub.indexOf('doorRegistryPublishPreflight(');
  const creds = pub.indexOf('_getSavedCredentials()');
  const build = pub.indexOf("'menu_current.json': buildMenuJSON()");
  assert.ok(pre > 0, 'preflight must be called');
  assert.ok(creds > 0 && pre > creds, 'after credentials (no remote call for a device that cannot publish anyway)');
  assert.ok(build > 0 && pre < build, 'before the artifacts are built (they must come from the adopted roster)');
  assert.match(pub, /_registryPreflight[\s\S]*?(adopted|forced)[\s\S]*?updateSyncBar/, 'the outcome reaches the sync bar');
  const pf = fnBlock('doorRegistryPublishPreflight');
  assert.match(pf, /manual\s*&&[\s\S]{0,80}confirm/, 'confirm gated on manual');
  assert.match(pf, /pullStateFromGitHub\(false\)/, 'adoption reuses the read-side pull, quietly');
});
