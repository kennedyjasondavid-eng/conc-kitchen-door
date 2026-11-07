// Journey check, 2026-11-07 (menu-flow plan, "Next slice" S2; HOUSE rule "checks support, never obstruct":
// a kitchen-journey check). It prevents this kitchen failure: a menu edit made on a DOOR computer never
// reaches the kitchen's published files, and nobody is told. That is what happened on 2026-11-06, when
// the F1 update (#155) left every computer without a saved key and only an amber new-computer line showed.
//
// DOOR's real publisher (the F1 publish box) runs with DOOR's real sign-in layer (PublishAuth) over one
// computer's storage. The menu, routing and roster builders are the F1 box's fixed stand-ins (no live
// data); the full-shape build is covered by door-smoke's structural checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { publishBox, editedOverlay, html } from './helpers/door_publish_transaction_box.mjs';

const EDIT = 'Fixture Beef Stew';

function realAuth(storage) {
  const authAt = html.indexOf('const PublishAuth = {');
  const auth = html.slice(authAt, html.indexOf('window.PublishAuth = PublishAuth;', authAt));
  const literals = [...html.slice(authAt - 1500, authAt).matchAll(/^const \w+\s*=\s*'[^'\n]*';/gm)].map(x => x[0]).join('\n');
  let settings = {};
  try { settings = JSON.parse(storage['conc-door-settings'] || '{}'); } catch {}
  const c = {
    console: { log() {}, warn() {}, error() {} }, Date, JSON, Object, Promise, appSettings: settings,
    DEFAULT_SETTINGS: { 'gh-repo': 'fixture/door' },
    document: { getElementById: () => null },
    doorSanitizeConnectionKey: s => String(s || '').replace(/[^\x20-\x7e]/g, '').trim(),
    localStorage: { getItem: k => storage[k] ?? null, setItem(k, v) { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } },
    doorSetItemSafe(k, v) { storage[k] = String(v); return true; }
  };
  vm.createContext(c);
  vm.runInContext(literals + '\n' + auth + '\nthis.auth = PublishAuth;', c);
  c.auth.renderStatus = () => {};
  return c.auth;
}

function capability(meta, hasToken) {
  const sb = { console };
  vm.createContext(sb);
  const reasonsAt = html.indexOf('const DOOR_PUBLISH_SKIP_REASONS =');
  const reasons = html.slice(reasonsAt, html.indexOf('});', reasonsAt) + 3);
  const fnAt = html.indexOf('function doorDeviceCapability(inp)');
  let depth = 0, i = html.indexOf('{', fnAt);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  vm.runInContext(reasons + '\n' + html.slice(fnAt, i + 1), sb);
  const inp = { hasToken, tokenExpired: false, operatorName: 'Fixture Operator', autoPublishOn: true,
    migrationNeeded: !!(meta && meta.migrationNeeded) };
  return vm.runInContext('doorDeviceCapability(' + JSON.stringify(inp) + ')', sb);
}

// The publish box, signed in through the real PublishAuth over the same storage.
function computer(storage) {
  const auth = realAuth(storage);
  const box = publishBox({ storage });
  const P = box.c.PublishAuth;
  const creds = () => auth._getSavedCredentials();
  P.getSavedToken = () => auth.getSavedToken();
  P._getSavedCredentials = creds;
  P.getCredentialsForManualPublish = creds;
  return { auth, box };
}
const dinner = box => box.remote.files['menu_current.json']?.menu?.['2']?.FRIDAY?.dinner;
const portions = box => box.remote.files['routing_by_meal.json']?.routing?.['2']?.FRIDAY?.dinner?._components || {};

test('journey: on a connected computer, a menu edit reaches the kitchen files EXPO reads', async () => {
  const storage = { concMenuBase: JSON.stringify(editedOverlay(EDIT)) };
  const { auth, box } = computer(storage);
  auth.saveValidatedToken('fixture-key', 'fixture/door');
  const result = await box.publish();
  assert.equal(result?.ok, true, 'the publish completes');
  assert.equal(box.remote.visibleWrites.length, 1, 'one commit');
  assert.equal(dinner(box), EDIT, 'menu_current.json carries the edit');
  assert.deepEqual(portions(box), { [EDIT]: 1 }, 'routing_by_meal.json counts the edited dish');
  assert.equal(capability(auth.getMeta(), true).level, 'none', 'nothing to warn about');
});

test('journey: a computer set up before the update can\'t send; it says so in red, and keeps the edit', async () => {
  const storage = {
    concMenuBase: JSON.stringify(editedOverlay(EDIT)),
    'conc-door-settings': JSON.stringify({ 'gh-token': 'fixture-legacy-key', 'gh-repo': 'fixture/door' }),
    conc_gh_token: 'fixture-legacy-key'
  };
  const { auth, box } = computer(storage);
  auth.migrateLegacyState();
  assert.equal(auth.getSavedToken(), '', 'the update does not carry the old key over');
  await box.publish();
  assert.equal(box.remote.visibleWrites.length, 0, 'nothing reaches the kitchen');
  const cap = capability(auth.getMeta(), false);
  assert.equal(cap.level, 'red', 'the banner is red, not the amber new-computer line');
  assert.ok(cap.reasons.some(r => r.code === 'reconnect-after-update'), 'it says the update stopped sending');
  assert.equal(JSON.parse(storage.concMenuBase)['2'].FRIDAY.dinner, EDIT, 'the edit stays on this computer');

  // Saving the connection again (Settings → Kitchen connection) sends it, and the red line clears.
  auth.saveValidatedToken('fixture-key', 'fixture/door');
  const result = await box.publish();
  assert.equal(result?.ok, true);
  assert.equal(dinner(box), EDIT);
  assert.deepEqual(portions(box), { [EDIT]: 1 });
  assert.equal(capability(auth.getMeta(), true).level, 'none');
});
