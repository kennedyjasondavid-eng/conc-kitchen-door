// P2 — connect at the moment of need.
// (DOOR_DEVICE_PUBLISH_RESILIENCE_ACTION_PLAN_2026-09-11.md §5 P2, F4 ruling)
//
// When a publish is skipped for want of a connection key, or when staff press the
// banner's Connect button, an INLINE card (not the Settings screen) asks for the
// connection key the kitchen lead supplied, tests it, stores it, and immediately
// re-runs the owed publish. Staff-facing copy never says "token" or "GitHub".
// Also closes HOUSE_PROVEN_SEAMS row 3 for DOOR: the key is sanitized (non-printable
// ASCII stripped, trimmed) before it ever reaches an Authorization header.
//
// Authored-to-fail: helpers/card absent, sanitizer absent from PublishAuth, no
// auto-open on missing_auth.
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
function methodBlock(objName, method) {
  const objStart = html.indexOf('const ' + objName + ' = {');
  assert.ok(objStart >= 0, 'missing ' + objName);
  const m = new RegExp('\\n  (?:async\\s+)?' + method + '\\(').exec(html.slice(objStart));
  assert.ok(m, 'missing method ' + objName + '.' + method);
  const start = objStart + m.index;
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}

const NO_GH = /token|github/i;

test('P2 symbols exist', () => {
  ['doorSanitizeConnectionKey', 'doorConnectFailureCopy', '_doorConnectCardHTML', 'doorConnectCardSubmit', 'doorConnectCardClose'].forEach(n =>
    assert.ok(new RegExp('function\\s+' + n + '\\s*\\(').test(html), 'missing ' + n));
  assert.ok(/(let|var)\s+_doorConnectCardOpen\s*=\s*false/.test(html), 'missing _doorConnectCardOpen flag');
});

test('sanitizer strips smart quotes / zero-width / newline paste artifacts and trims (seam row 3)', () => {
  const sb = { console }; vm.createContext(sb);
  vm.runInContext(fnBlock('doorSanitizeConnectionKey'), sb);
  const clean = vm.runInContext("doorSanitizeConnectionKey('\\u201Cgithub_pat_ABC123\\u201D\\u200B \\n')", sb);
  assert.equal(clean, 'github_pat_ABC123');
  assert.equal(vm.runInContext("doorSanitizeConnectionKey('  plain_key_9  ')", sb), 'plain_key_9');
  assert.equal(vm.runInContext("doorSanitizeConnectionKey(null)", sb), '');
});

test('PublishAuth reads and stores the key through the sanitizer (getSavedToken / getTypedToken / saveValidatedToken)', () => {
  assert.match(methodBlock('PublishAuth', 'getSavedToken'), /doorSanitizeConnectionKey\(/);
  assert.match(methodBlock('PublishAuth', 'getTypedToken'), /doorSanitizeConnectionKey\(/);
  assert.match(methodBlock('PublishAuth', 'saveValidatedToken'), /doorSanitizeConnectionKey\(/);
});

test('failure copy: rejected vs unreachable vs other, none of it in GitHub vocabulary', () => {
  const sb = { console }; vm.createContext(sb);
  vm.runInContext(fnBlock('doorConnectFailureCopy'), sb);
  const f = (msg) => vm.runInContext('doorConnectFailureCopy(' + JSON.stringify(msg) + ')', sb);
  const rejected = f('GitHub rejected the token (401 Bad credentials)');
  const forbidden = f('403 Forbidden — token lacks contents:write');
  const network = f('Failed to fetch');
  const other = f('Something odd');
  assert.equal(rejected.kind, 'rejected'); assert.equal(forbidden.kind, 'rejected');
  assert.equal(network.kind, 'network'); assert.equal(other.kind, 'other');
  [rejected, forbidden, network, other].forEach(x => assert.ok(!NO_GH.test(x.text), 'copy leaked: ' + x.text));
  assert.notEqual(rejected.text, network.text);
});

test('card HTML: masked key field, kitchen-lead wording, Test & connect + Cancel, no GitHub vocabulary', () => {
  const sb = { console, escapeHtml: s => String(s), _escAttr: s => String(s) }; vm.createContext(sb);
  vm.runInContext(fnBlock('_doorConnectCardHTML'), sb);
  const out = vm.runInContext('_doorConnectCardHTML()', sb);
  assert.match(out, /type="password"/);
  assert.match(out, /id="door-connect-key"/);
  assert.match(out, /id="door-connect-status"/);
  assert.match(out, /Test &amp; connect|Test & connect/);
  assert.match(out, /doorConnectCardSubmit\(\)/);
  assert.match(out, /doorConnectCardClose\(\)/);
  assert.match(out, /kitchen lead|Jason/i);
  assert.ok(!NO_GH.test(out.replace(/doorConnect\w+/g, '')), 'card copy leaked GitHub vocabulary');
});

// P3: after a successful connect the card DRAINS the outbox (doorOutboxDrain), which
// publishes once only when something is owed and a key is now saved.
function submitSandbox({ validate, typed, outbox }) {
  const calls = { validate: [], saved: [], published: [], prompt: 0 };
  const status = { textContent: '', style: {} };
  const input = { value: typed };
  const store = outbox ? { concPublishOutbox: JSON.stringify(outbox) } : {};
  let savedKey = '';
  const sb = {
    console, calls, status, input,
    _doorConnectCardOpen: true,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    getRegistryProvenanceTs: () => 0,
    PublishAuth: {
      getRepo: () => 'org/repo',
      getSavedToken: () => savedKey,
      validateToken: async (t, r) => { calls.validate.push(t); return validate(t, r); },
      saveValidatedToken: (t, r) => { calls.saved.push(t); savedKey = t; },
      rememberFailure: () => {}
    },
    publishAndSync: (ctx) => { calls.published.push(ctx); },
    updateDailyImportPrompt: () => { calls.prompt++; },
    document: { getElementById: (id) => id === 'door-connect-key' ? input : (id === 'door-connect-status' ? status : null) }
  };
  vm.createContext(sb);
  vm.runInContext([fnBlock('doorSanitizeConnectionKey'), fnBlock('doorConnectFailureCopy'), fnBlock('doorConnectCardClose'), fnBlock('doorConnectCardSubmit'),
    fnBlock('doorSetItemSafe'), fnBlock('doorOutboxRead'), fnBlock('doorOutboxAppend'), fnBlock('doorOutboxClear'), fnBlock('doorOutboxDrain')].join('\n') +
    "\nconst DOOR_PUBLISH_OUTBOX_KEY='concPublishOutbox';\nconst DOOR_OUTBOX_MAX=50;\nconst DOOR_EXPENDABLE_KEYS=['concRegistrySnapshot'];", sb);
  return sb;
}

test('submit: a key that validates is stored (sanitized), the card closes, and the owed publish drains exactly once', async () => {
  const owed = [{ ts: '2026-09-11T09:00:00Z', context: 'plating sheets generated', reason: 'missing_auth' }];
  const sb = submitSandbox({ validate: async () => ({}), typed: '“good_key_123”\n', outbox: owed });
  await vm.runInContext('doorConnectCardSubmit()', sb);
  assert.deepEqual([...sb.calls.validate], ['good_key_123'], 'validated with the SANITIZED key');
  assert.deepEqual([...sb.calls.saved], ['good_key_123']);
  assert.equal(sb.calls.published.length, 1, 'owed publish drained once');
  assert.match(sb.calls.published[0], /1 unpublished/);
  assert.equal(sb._doorConnectCardOpen, false, 'card closed');
  assert.ok(sb.calls.prompt >= 1, 'banner re-rendered');
});

test('submit: a key that validates with NOTHING owed stores the key and publishes nothing (the next Generate publishes normally)', async () => {
  const sb = submitSandbox({ validate: async () => ({}), typed: 'good_key_123', outbox: null });
  await vm.runInContext('doorConnectCardSubmit()', sb);
  assert.deepEqual([...sb.calls.saved], ['good_key_123']);
  assert.equal(sb.calls.published.length, 0, 'nothing owed → no publish');
  assert.equal(sb._doorConnectCardOpen, false);
});

test('submit: a rejected key is NOT stored, nothing publishes, status says rejected in kitchen words', async () => {
  const sb = submitSandbox({ validate: async () => { throw new Error('GitHub rejected the token (401 Bad credentials)'); }, typed: 'bad_key' });
  await vm.runInContext('doorConnectCardSubmit()', sb);
  assert.equal(sb.calls.saved.length, 0); assert.equal(sb.calls.published.length, 0);
  assert.equal(sb._doorConnectCardOpen, true, 'card stays open for a retry');
  assert.match(sb.status.textContent, /not accepted|rejected/i);
  assert.ok(!NO_GH.test(sb.status.textContent), 'status leaked: ' + sb.status.textContent);
});

test('submit: an unreachable network is NOT stored, and the copy is distinct from a rejection', async () => {
  const sb = submitSandbox({ validate: async () => { throw new TypeError('Failed to fetch'); }, typed: 'some_key' });
  await vm.runInContext('doorConnectCardSubmit()', sb);
  assert.equal(sb.calls.saved.length, 0); assert.equal(sb.calls.published.length, 0);
  assert.match(sb.status.textContent, /reach|internet|connection/i);
  assert.ok(!/not accepted|rejected/i.test(sb.status.textContent));
});

test('submit: an empty field never calls out', async () => {
  const sb = submitSandbox({ validate: async () => ({}), typed: '   ' });
  await vm.runInContext('doorConnectCardSubmit()', sb);
  assert.equal(sb.calls.validate.length, 0); assert.equal(sb.calls.saved.length, 0);
  assert.ok(sb.status.textContent.length > 0, 'asks for the key');
});

test('wiring: Connect button opens the card inline; a missing_auth skip auto-opens it; the banner renders it while open', () => {
  assert.match(fnBlock('doorDeviceBannerFix'), /_doorConnectCardOpen\s*=\s*true/);
  const pas = fnBlock('publishAndSync');
  assert.match(pas, /missing_auth[\s\S]{0,200}_doorConnectCardOpen\s*=\s*true/);
  // P3 e2e finding: with NO key, _doPublishToGitHub THROWS from the credentials lookup
  // (it never returns a missing_auth skip), so the catch branch must classify a missing
  // key itself — otherwise a brand-new device records "error" and the card never opens.
  const catchBranch = pas.slice(pas.lastIndexOf('.catch('));
  assert.match(catchBranch, /getSavedToken\(\)/, 'catch branch must check for a missing key');
  assert.match(catchBranch, /missing_auth/, 'catch branch must classify a missing key as missing_auth');
  assert.match(catchBranch, /_doorConnectCardOpen\s*=\s*true/, 'catch branch must open the card on a missing key');
  assert.match(fnBlock('_doorDeviceBannerHTML'), /_doorConnectCardOpen[\s\S]{0,200}_doorConnectCardHTML\(\)/);
});
