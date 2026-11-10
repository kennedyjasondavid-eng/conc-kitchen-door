// One reader for the kitchen's files; viewing keys; saying plainly when the list can't be read (2026-11-01,
// v31-standard.49). Jason, 2026-11-01: "go ahead with phase 2" (DOOR resident-data privacy plan, D3 and D4).
//
// The repository is still public, and DOOR read its own files from GitHub's raw file address with no key. Once the
// repository is private those reads fail on every computer, and the guard against publishing an older resident list
// (P5) goes quiet. Phase 2 makes DOOR ready without changing anything today: every read of DOOR's own files goes
// through doorReadKitchenFile (beside PublishAuth); a computer with a key reads through the Contents API; a public feed
// without a key is read from DOOR's Pages; a kitchen file without a key uses the raw address only while
// DOOR_PUBLIC_RAW_FALLBACK is on and the computer isn't rehearsing (Settings), and otherwise says it needs a viewing key.
//
// This gate pins:
//   (a) with a key: the Contents API at ref=main, Bearer, the raw media type; 404 → absent; 401 → error, recorded;
//       a public feed the key can't read comes from Pages;
//   (b) without a key: a public feed comes from the Pages address derived from the repository (relative on Pages);
//   (c) without a key: a kitchen file uses the raw address while the fallback is on, and returns noKey with no fetch
//       when rehearsing or with the fallback off;
//   (d) a source scan: no raw read of this repository outside the reader, and each of the eight read sites calls it;
//   (e) viewing keys: the kind from permissions.push === false; publish skips with viewing_key before any read or
//       write; a 403 on a write marks the key as viewing; the banner gives a viewing computer a quiet line;
//   (f) pullStateFromGitHub's three messages (no list in the kitchen / no key / an error);
//   (g) the P5 guard on computers with a key reads _meta through the Contents API, and a newer kitchen list is adopted;
//   (h) the plating notice for a computer with no key (with the list's date), Generate's question, the banner's reason,
//       the rehearsal switch and the first-run card's words.
//
// Every resident here is made up (rooms T01–T03). A failure message never prints a resident value.
// Authored red against origin/main 6fd8829 (v31-standard.48): all 15 fail. Also red on each of nine one-line mutants of
// the branch (no viewing skip, rehearsal ignored, noKey read as absent, the JSON media type, push:true read as viewing,
// a 403 not noted, the notice or Generate ignoring noKey, the P5 read back on the raw address).
// Env: KITCHEN_READER_HTML (another index.html, e.g. main's).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { twoComputers, out, R, intake } from './helpers/door_two_computers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(process.env.KITCHEN_READER_HTML || path.join(root, 'index.html'), 'utf8');
const REPO = 'kennedyjasondavid-eng/conc-kitchen-door';
const NO_GH = /token|github/i;

function between(a, b) {
  const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a.slice(0, 60));
  const e = html.indexOf(b, s + a.length); assert.ok(e > s, 'missing the end of ' + a.slice(0, 60));
  return html.slice(s, e);
}
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(m.index, i + 1);
}
function constLine(name) {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*\\n').exec(html);
  assert.ok(m, 'missing const ' + name);
  return m[0];
}
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing const ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(start, html.indexOf(';', i) + 1);
}
const readerSrc = () => between('const DOOR_PUBLIC_FEEDS = ', '// Settings: the rehearsal switch');
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'stub', json: async () => body });
const memStore = (init) => {
  const s = Object.assign({}, init || {});
  return { s, api: { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } } };
};

// The reader in a vm: a fake key (or none), the rehearsal switch, the fallback switch, and a fetch stub.
function readerBox({ key = '', expired = false, rehearsal = false, fallback = true, location, answer } = {}) {
  const st = memStore(rehearsal ? { concPrivateRehearsal: '1' } : {});
  const calls = [], failures = [];
  let prompts = 0;
  const ctx = {
    console, Date, setTimeout, clearTimeout, AbortController,
    localStorage: st.api,
    fetch: async (url, init) => { calls.push({ url: String(url), init: init || {} }); return answer(String(url), init || {}); },
    PublishAuth: { getRepo: () => REPO, getSavedToken: () => key, isExpired: () => expired,
      rememberFailure: (m) => failures.push(m), classifyGitHubError: (s, m) => 'GitHub API ' + s + ': ' + m },
    updateDailyImportPrompt: () => { prompts++; },
  };
  if (location) ctx.location = location;
  let src = readerSrc();
  if (!fallback) {
    assert.ok(src.includes('const DOOR_PUBLIC_RAW_FALLBACK = true;'), 'the fallback switch is a plain constant');
    src = src.replace('const DOOR_PUBLIC_RAW_FALLBACK = true;', 'const DOOR_PUBLIC_RAW_FALLBACK = false;');
  }
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'index.html#kitchen-reader' });
  const read = (file, opts) => vm.runInContext('doorReadKitchenFile', ctx)(file, opts);
  return { ctx, calls, failures, store: st.s, read, prompts: () => prompts };
}
const MADE_UP_STATE = { _meta: { registryModifiedAt: '2026-10-30T14:05:00.000Z' }, residents: [R('T01', ['Regular']), R('T02', ['No Pork'])], anaphRooms: [] };

// ── (a) with a key ──────────────────────────────────────────────────────────────────────────────────────────────────
test('(a) with a key: the Contents API at ref=main with Bearer and the raw media type; the result says how it was read', async () => {
  const b = readerBox({ key: 'TESTKEY', answer: (url) => (url.startsWith('https://api.github.com/') ? res(200, MADE_UP_STATE) : res(500, {})) });
  const r = await b.read('door_state.json');
  assert.equal(r.ok, true); assert.equal(r.via, 'key');
  assert.deepEqual(out(r.data.residents.map((x) => x.room)), ['T01', 'T02']);
  assert.equal(b.calls.length, 1, 'one request');
  const c = b.calls[0];
  assert.equal(c.url, 'https://api.github.com/repos/' + REPO + '/contents/door_state.json?ref=main');
  assert.equal(c.init.headers.Authorization, 'Bearer TESTKEY');
  assert.equal(c.init.headers.Accept, 'application/vnd.github.raw+json', 'the raw media type (the JSON type stops at 1 MB)');
  assert.equal(c.init.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(c.init.cache, 'no-store');
  assert.ok(c.init.signal, 'a timeout can abort it');
  // the resident list's last read is remembered for the status lines
  assert.equal(b.store.concKitchenListLastResult, 'ok');
  assert.equal(b.store.concKitchenListReadVia, 'key');
  assert.ok(!isNaN(Date.parse(b.store.concKitchenListReadAt)), 'when it was read');
  // a kitchen file other than the list leaves the list's bookkeeping alone
  const b2 = readerBox({ key: 'TESTKEY', answer: () => res(200, []) });
  await b2.read('recent_log.json');
  assert.equal(b2.store.concKitchenListLastResult, undefined);
});

test('(a) with a key: 404 → absent; 401 → error, recorded for Settings; no raw or Pages read of a kitchen file', async () => {
  const gone = readerBox({ key: 'TESTKEY', answer: () => res(404, { message: 'Not Found' }) });
  assert.deepEqual(out(await gone.read('door_state.json')), { absent: true });
  assert.equal(gone.calls.length, 1);
  const bad = readerBox({ key: 'TESTKEY', answer: () => res(401, { message: 'Bad credentials' }) });
  const r = await bad.read('door_state.json');
  assert.equal(r.status, 401); assert.ok(r.error, 'an error');
  assert.equal(bad.failures.length, 1, 'recorded with PublishAuth.rememberFailure');
  assert.equal(bad.calls.length, 1, 'no second read for a kitchen file');
  const down = readerBox({ key: 'TESTKEY', answer: () => { throw new Error('offline'); } });
  const d = await down.read('learned_nr.json');
  assert.equal(d.status, 0); assert.ok(d.error);
  assert.equal(down.calls.length, 1);
  // an expired key is no key: the raw address while the repository is public
  const old = readerBox({ key: 'TESTKEY', expired: true, answer: () => res(200, []) });
  assert.equal((await old.read('recent_log.json')).via, 'raw');
});

test('(a) with a key: a public feed the key can\'t read comes from Pages; a 404 is still a real absence', async () => {
  const b = readerBox({ key: 'TESTKEY', answer: (url) => (url.startsWith('https://api.github.com/') ? res(500, {}) : res(200, { menu: {} })) });
  const r = await b.read('menu_current.json');
  assert.equal(r.via, 'pages');
  assert.equal(b.calls.length, 2);
  assert.ok(b.calls[1].url.startsWith('https://kennedyjasondavid-eng.github.io/conc-kitchen-door/menu_current.json?_='));
  assert.ok(!b.calls[1].init.headers, 'no key sent to Pages');
  const g = readerBox({ key: 'TESTKEY', answer: () => res(404, {}) });
  assert.deepEqual(out(await g.read('meal_swaps.json')), { absent: true });
  assert.equal(g.calls.length, 1);
  const ok = readerBox({ key: 'TESTKEY', answer: () => res(200, {}) });
  assert.equal((await ok.read('special_meals.json')).via, 'key', 'with a key, a public feed is read with it');
});

// ── (b) public feeds without a key ──────────────────────────────────────────────────────────────────────────────────
test('(b) without a key: each public feed comes from DOOR\'s Pages, derived from the repository; relative on Pages', async () => {
  const feeds = vm.runInContext('DOOR_PUBLIC_FEEDS', readerBox({ answer: () => res(200, {}) }).ctx);
  // the seven JSON files Pages serves (.github/workflows/pages.yml)
  const yml = fs.readFileSync(path.join(root, '.github', 'workflows', 'pages.yml'), 'utf8').replace(/\r\n/g, '\n');
  const served = (yml.match(/^\s*for f in ([^;\n]+); do/m) || ['', ''])[1].trim().split(/\s+/).filter((f) => f.endsWith('.json'));
  assert.deepEqual([...feeds].sort(), served.sort(), 'the public feeds are exactly the JSON files Pages serves');
  for (const f of feeds) {
    const b = readerBox({ answer: () => res(200, {}) });
    const r = await b.read(f);
    assert.equal(r.via, 'pages', f);
    assert.equal(b.calls.length, 1, f);
    assert.ok(b.calls[0].url.startsWith('https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' + f + '?_='), f + ' from the Pages address');
    assert.equal(b.calls[0].init.cache, 'no-store');
  }
  const onPages = readerBox({ location: { protocol: 'https:', hostname: 'kennedyjasondavid-eng.github.io', pathname: '/conc-kitchen-door/' }, answer: () => res(200, {}) });
  await onPages.read('routing_by_meal.json');
  assert.ok(onPages.calls[0].url.startsWith('routing_by_meal.json?_='), 'relative when the page is served from that Pages site');
  const fileUrl = readerBox({ location: { protocol: 'file:', hostname: '', pathname: '/C:/door/index.html' }, answer: () => res(200, {}) });
  await fileUrl.read('routing_by_meal.json');
  assert.ok(fileUrl.calls[0].url.startsWith('https://kennedyjasondavid-eng.github.io/'), 'absolute from file://');
  const other = readerBox({ answer: () => res(200, {}) });
  await other.read('menu_current.json', { repo: 'Example-Org/door-copy' });
  assert.ok(other.calls[0].url.startsWith('https://example-org.github.io/door-copy/menu_current.json'), 'from the repository setting');
});

// ── (c) kitchen files without a key ─────────────────────────────────────────────────────────────────────────────────
test('(c) without a key: a kitchen file uses the raw address while the fallback is on; noKey with no fetch otherwise', async () => {
  const kitchenFiles = vm.runInContext('DOOR_KITCHEN_FILES', readerBox({ answer: () => res(200, {}) }).ctx);
  // Re-pinned 2026-11-10 (D2a, v31-standard.64): door_rules.json (the added allergen words and the leads list) is a
  // kitchen file, read like rex_week_answers.json and never served on Pages.
  assert.deepEqual([...kitchenFiles].sort(), ['change_log.json', 'custom_tag_rules.json', 'door_rules.json', 'door_state.json', 'learned_nr.json',
    'menu_overlay.json', 'recent_log.json', 'rex_week_answers.json'].sort());
  const raw = readerBox({ answer: () => res(200, MADE_UP_STATE) });
  const r = await raw.read('door_state.json');
  assert.equal(r.via, 'raw');
  assert.ok(raw.calls[0].url.startsWith('https://raw.githubusercontent.com/' + REPO + '/main/door_state.json?_='), 'the raw address, as before');
  assert.ok(!raw.calls[0].init.headers, 'no key');
  for (const f of kitchenFiles) {
    const rehearse = readerBox({ rehearsal: true, answer: () => res(200, {}) });
    assert.deepEqual(out(await rehearse.read(f)), { noKey: true }, f + ' when rehearsing');
    assert.equal(rehearse.calls.length, 0, f + ': no fetch when rehearsing');
    const off = readerBox({ fallback: false, answer: () => res(200, {}) });
    assert.deepEqual(out(await off.read(f)), { noKey: true }, f + ' with the fallback off');
    assert.equal(off.calls.length, 0, f + ': no fetch with the fallback off');
  }
  const rehearse = readerBox({ rehearsal: true, answer: () => res(200, {}) });
  await rehearse.read('door_state.json');
  assert.equal(rehearse.store.concKitchenListLastResult, 'noKey', 'remembered for the plating notice');
  assert.equal(rehearse.prompts(), 1, 'Enter Changes re-renders when the state changes');
  // rehearsing doesn't stop a computer with a key, or a public feed
  const keyed = readerBox({ key: 'TESTKEY', rehearsal: true, answer: () => res(200, {}) });
  assert.equal((await keyed.read('door_state.json')).via, 'key');
  const pub = readerBox({ rehearsal: true, answer: () => res(200, {}) });
  assert.equal((await pub.read('meal_swaps_reverted.json')).via, 'pages');
  assert.match(html, /\nconst DOOR_PUBLIC_RAW_FALLBACK = true; \/\/ until the repository is private; remove in phase 5\n/);
});

// ── (d) source scan ─────────────────────────────────────────────────────────────────────────────────────────────────
const SITES = {
  bootRemoteState: () => between('(function bootRemoteState()', '\n})();'),
  bootLearnedNR: () => between('(function bootLearnedNR()', '\n})();'),
  bootRegistry: () => between('(function bootRegistry()', '\n})();'),
  pullStateFromGitHub: () => fnBlock('pullStateFromGitHub'),
  pullSecondaryState: () => fnBlock('pullSecondaryState'),
  doorFetchRemoteRegistryMeta: () => fnBlock('doorFetchRemoteRegistryMeta'),
  doorMakeRevertList: () => fnBlock('doorMakeRevertList'),
  doorPullRexAnswers: () => fnBlock('doorPullRexAnswers'),
};

test('(d) no raw read of this repository outside the reader; each of the eight sites calls it and fetches nothing itself', () => {
  const reader = fnBlock('doorReadKitchenFile');
  const rs = html.indexOf(reader), re = rs + reader.length;
  const outside = [];
  let i = -1;
  while ((i = html.indexOf('raw.githubusercontent.com', i + 1)) >= 0) {
    if (i > rs && i < re) continue;
    const line = html.slice(html.lastIndexOf('\n', i) + 1, html.indexOf('\n', i));
    if (/CONC_Recipe_Data|conc-recipe-hub/.test(line)) continue;   // CODEX's own settings placeholder, not DOOR's repository
    outside.push(html.slice(0, i).split('\n').length);
  }
  assert.deepEqual(outside, [], 'raw reads outside doorReadKitchenFile, at lines: ' + outside.join(', '));
  assert.equal((reader.match(/raw\.githubusercontent\.com/g) || []).length, 1, 'one raw address, in the reader');
  for (const [name, src] of Object.entries(SITES)) {
    const body = src();
    if (name === 'doorMakeRevertList') {
      assert.match(body, /PublishAuth\.sidePublish\(/, 'removal timers request the coherent transaction');
      assert.doesNotMatch(body, /doorReadKitchenFile\(|\bfetch\(/, 'no independent unpinned removal read');
      continue;
    }
    if (name === 'preMergeOverlayWithCloud' || name === 'preMergeSwapsWithCloud') {
      assert.match(body, /doorPublishReadRevision\(/, 'compatibility merge delegates to immutable input reader');
      assert.doesNotMatch(body, /\bfetch\(/);
      continue;
    }
    assert.ok(/doorReadKitchenFile\(/.test(body), name + ' reads through doorReadKitchenFile');
    assert.ok(!/\bfetch\(/.test(body), name + ' fetches nothing itself');
  }
  // the boot sync reads all twelve of its files (menu_overlay.json twice), in the same apply chains as before
  const boot = SITES.bootRemoteState();
  for (const f of ['menu_overlay.json', 'menu_current.json', 'door_state.json', 'meal_swaps_reverted.json', 'meal_swaps.json',
    'rex_week_answers.json', 'special_meals_removed.json', 'special_meals.json', 'recent_log.json', 'change_log.json', 'custom_tag_rules.json']) {
    assert.ok(boot.includes("read('" + f + "')"), 'boot reads ' + f);
  }
  assert.equal((boot.match(/read\('menu_overlay\.json'\)/g) || []).length, 2, 'the overlay read and the hydration gate\'s');
  // the timeouts the sites had are kept
  assert.match(SITES.bootLearnedNR(), /timeoutMs: 3000/);
  assert.match(SITES.doorPullRexAnswers(), /timeoutMs: 6000/);
  // CODEX's own reads are untouched
  assert.ok(html.includes("const DOOR_SHARED_LIBRARY_URL = 'https://kennedyjasondavid-eng.github.io/conc-recipe-hub/library_public.json';"));
});

// ── (e) viewing keys ────────────────────────────────────────────────────────────────────────────────────────────────
function authBox({ answer, meta, token = '' } = {}) {
  const st = memStore({ 'conc-door-connection-v2': JSON.stringify({ schemaVersion: 2, token, repo: 'example-org/door-test', meta: meta || {} }) });
  const els = { 'gh-auth-status': { textContent: '', style: {} }, 'gh-status': { textContent: '', style: {} } };
  const calls = [], pushed = [], bars = [];
  const ctx = {
    console, Date, Promise, JSON,
    localStorage: st.api,
    document: { getElementById: (id) => els[id] || null, querySelector: () => null },
    fetch: async (url, init) => { calls.push({ url: String(url), init: init || {} }); return answer(String(url), init || {}); },
    appSettings: { 'gh-token': '', 'gh-repo': 'example-org/door-test' },
    DEFAULT_SETTINGS: { 'gh-repo': 'example-org/door-test' },
    updateSyncBar: (m) => bars.push(m), showToast: () => {}, setTimeout: (f) => f(),
    ghPushFile: async (creds, p) => { pushed.push(p); return {}; },
  };
  vm.createContext(ctx);
  vm.runInContext([fnBlock('doorSanitizeConnectionKey'), fnBlock('doorConnectFailureCopy'), constLine('GH_CONNECTION_KEY'),
    constLine('DOOR_VIEWING_KEY_COPY'), between('const PublishAuth = {', '\nwindow.PublishAuth'), 'this.PA = PublishAuth;'].join('\n'), ctx);
  return { PA: ctx.PA, ctx, calls, pushed, els, store: st.s, bars };
}
const repoAnswer = (perms, status = 200) => (url) => (url.includes('/contents/') ? res(200, { sha: 'x' })
  : url === 'https://api.github.com/repos/example-org/door-test' ? res(status, perms ? { permissions: perms } : {}) : res(404, {}));

test('(e) viewing key: the kind comes from permissions.push === false; anything else is a sending key, as today', async () => {
  const v = authBox({ answer: repoAnswer({ admin: false, push: false, pull: true }) });
  await v.PA.validateToken('VIEWKEY', 'example-org/door-test');
  v.PA.saveValidatedToken('VIEWKEY', 'example-org/door-test');
  assert.equal(v.PA.getMeta().keyKind, 'viewing');
  assert.equal(v.PA.isViewingKey(), true);
  const probe = v.calls.find((c) => c.url === 'https://api.github.com/repos/example-org/door-test');
  assert.ok(probe, 'GET /repos/<repo> with the key'); assert.equal(probe.init.headers.Authorization, 'Bearer VIEWKEY');
  v.PA.renderStatus();
  assert.equal(v.els['gh-auth-status'].textContent, 'Connected to view the kitchen’s lists (viewing key).');
  for (const [perms, status] of [[{ push: true, pull: true }, 200], [null, 200], [{ push: false }, 500]]) {
    const s = authBox({ answer: repoAnswer(perms, status) });
    await s.PA.validateToken('SENDKEY', 'example-org/door-test');
    s.PA.saveValidatedToken('SENDKEY', 'example-org/door-test');
    assert.equal(s.PA.getMeta().keyKind, 'sending', JSON.stringify(perms) + ' ' + status);
    assert.equal(s.PA.isViewingKey(), false);
    s.PA.renderStatus();
    assert.match(s.els['gh-auth-status'].textContent, /^This computer is connected to the kitchen/);
  }
  const down = authBox({ answer: (url) => (url.includes('/contents/') ? res(200, {}) : (() => { throw new Error('offline'); })()) });
  await down.PA.validateToken('SENDKEY', 'example-org/door-test');
  down.PA.saveValidatedToken('SENDKEY', 'example-org/door-test');
  assert.equal(down.PA.getMeta().keyKind, 'sending', 'a failed probe is a sending key');
  // a probe for another key is never applied to this one
  const mix = authBox({ answer: repoAnswer({ push: false }) });
  await mix.PA.validateToken('VIEWKEY', 'example-org/door-test');
  mix.PA.saveValidatedToken('OTHERKEY', 'example-org/door-test');
  assert.equal(mix.PA.getMeta().keyKind, 'sending');
});

test('(e) viewing key: publish skips with viewing_key before any read or write; side publishes skip too; the drain sends nothing', async () => {
  for (const manual of [true, false]) {
    const spy = { preflight: 0, premerge: 0, atomic: 0, fetch: 0, toasts: [] };
    const statusEl = { textContent: '', style: {} };
    const creds = { repo: 'example-org/door-test', token: 'VIEWKEY' };
    const ctx = {
      console, Promise, JSON,
      document: { getElementById: (id) => (id === 'gh-status' ? statusEl : null), querySelector: () => null },
      PublishAuth: { getCredentialsForManualPublish: () => creds, _getSavedCredentials: () => creds, isViewingKey: () => true, rememberFailure: () => {} },
      showToast: (m) => spy.toasts.push(m), updateSyncBar: () => {},
      doorRegistryPublishPreflight: async () => { spy.preflight++; return {}; },
      preMergeOverlayWithCloud: async () => { spy.premerge++; return {}; },
      preMergeSwapsWithCloud: async () => { spy.premerge++; },
      ghPushFilesAtomic: async () => { spy.atomic++; return { results: [] }; },
      fetch: async () => { spy.fetch++; return res(200, {}); },
      localStorage: memStore().api,
    };
    vm.createContext(ctx);
    vm.runInContext(constLine('DOOR_VIEWING_KEY_COPY') + fnBlock('_doPublishToGitHub'), ctx);
    const r = await ctx._doPublishToGitHub(manual);
    assert.equal(r.skipped, true); assert.equal(r.reason, 'viewing_key');
    assert.deepEqual([spy.preflight, spy.premerge, spy.atomic, spy.fetch], [0, 0, 0, 0], 'nothing read or written (manual ' + manual + ')');
    assert.match(statusEl.textContent, /can view the kitchen’s lists but not send changes \(viewing key\)/);
    if (manual) assert.equal(spy.toasts.length, 1);
  }
  // the reason has banner copy in kitchen words
  const sb = { console }; vm.createContext(sb);
  vm.runInContext(constBlock('DOOR_PUBLISH_SKIP_REASONS'), sb);
  const m = vm.runInContext('DOOR_PUBLISH_SKIP_REASONS.viewing_key', sb);
  assert.ok(m && m.label, 'viewing_key is in the reason map');
  assert.equal(m.label, 'this computer can view the kitchen’s lists but not send changes (viewing key)');
  assert.ok(!NO_GH.test(m.label));
  // a side publish (change log, revert lists, Rex's answers) skips before ghPushFile
  const v = authBox({ token: 'VIEWKEY', meta: { keyKind: 'viewing' }, answer: () => res(200, {}) });
  const side = await v.PA.sidePublish('change_log.json', '[]', 'Change log sync', false);
  assert.deepEqual(out(side), { skipped: true, reason: 'viewing_key' });
  assert.deepEqual(v.pushed, [], 'no write');
  const s = authBox({ token: 'SENDKEY', meta: { keyKind: 'sending' }, answer: () => res(200, {}) });
  await s.PA.sidePublish('change_log.json', '[]', 'Change log sync', false);
  assert.deepEqual(s.pushed, ['change_log.json'], 'a sending key still sends');
  // the outbox drain sends nothing from a viewing computer
  const calls = [];
  const dr = { console, localStorage: memStore({ concPublishOutbox: JSON.stringify([{ ts: '2026-11-01T10:00:00Z' }]) }).api,
    PublishAuth: { getSavedToken: () => 'VIEWKEY', isViewingKey: () => true }, publishAndSync: (c) => calls.push(c) };
  vm.createContext(dr);
  vm.runInContext('const DOOR_PUBLISH_OUTBOX_KEY = "concPublishOutbox";\n' + fnBlock('doorOutboxRead') + fnBlock('doorOutboxDrain'), dr);
  assert.equal(dr.doorOutboxDrain('boot'), 0); assert.equal(calls.length, 0);
});

function atomicBox({ failAt, failStatus = 403, failMessage = 'Resource not accessible by personal access token' }) {
  const noted = [], remembered = [];
  const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, statusText: 'stub' });
  const ctx = {
    console: { warn() {}, log() {}, error() {} }, Promise, Date, Math, JSON, Set, Error, TextEncoder,
    setTimeout: (f) => f(),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    unescape: (s) => decodeURIComponent(s.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')), encodeURIComponent,
    updateSyncBar() {},
    PublishAuth: { githubHeaders: (t) => ({ Authorization: 'Bearer ' + t }), classifyGitHubError: (s, m) => 'GitHub API ' + s + ': ' + m,
      rememberFailure: (m) => remembered.push(m), noteViewingKey: () => noted.push(1) },
    fetch: async (url, init = {}) => {
      const method = init.method || 'GET';
      const key = method + ' ' + String(url).replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, '');
      if (key === failAt) return json({ message: failMessage }, failStatus);
      if (method === 'GET' && key.includes('/contents/')) return json({ message: 'Not Found' }, 404);
      if (key === 'GET /git/ref/heads/main') return json({ object: { sha: 'tip' } });
      if (key.startsWith('GET /git/commits/')) return json({ tree: { sha: 'tree' } });
      if (key === 'POST /git/blobs') return json({ sha: 'blob' });
      if (key === 'POST /git/trees') return json({ sha: 'newtree' });
      if (key === 'POST /git/commits') return json({ sha: 'newcommit' });
      if (key === 'PATCH /git/refs/heads/main') return json({ object: { sha: 'newcommit' } });
      if (method === 'PUT') return json({ content: {} });
      return json({ message: 'unexpected ' + key }, 500);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(['let _ghHydrated = true;', 'let _ghForceOverwrite = false;', "const ALLOW_SHRINK_PATHS = new Set(['meal_swaps.json']);",
    between('/* DOOR_TESTABLE_CORE_START publish-transaction */', '/* DOOR_TESTABLE_CORE_END publish-transaction */'),
    'let _ghWriteQueue = Promise.resolve();', fnBlock('_ghEvaluateWriteGuards'), fnBlock('ghPushFilesAtomic'), fnBlock('_ghPushFilesAtomicNow'),
    fnBlock('ghPushFile'), fnBlock('_ghPushFileNow')].join('\n'), ctx);
  return { ctx, noted, remembered };
}
// Transport classification on an independent log; dependency-atomic behavior
// and pinned guard reads are covered by the applying F1 gates.
const FILES = [{ path: 'change_log.json', content: '{"a":1}' }];

test('(e) the second net: a write refused with 403 marks the key as viewing; a 403 on a read or a rate limit does not', async () => {
  const w = atomicBox({ failAt: 'POST /git/blobs' });
  await assert.rejects(() => w.ctx.ghPushFilesAtomic({ repo: 'o/r', token: 't' }, FILES, 'msg'));
  assert.deepEqual([w.noted.length, w.remembered.length], [1, 0], 'a write the key may not make: a viewing key');
  const g = atomicBox({ failAt: 'GET /git/ref/heads/main' });
  await assert.rejects(() => g.ctx.ghPushFilesAtomic({ repo: 'o/r', token: 't' }, FILES, 'msg'));
  assert.deepEqual([g.noted.length, g.remembered.length], [0, 1], 'a read refused is a failure, as before');
  const rl = atomicBox({ failAt: 'POST /git/blobs', failMessage: 'API rate limit exceeded for user' });
  await assert.rejects(() => rl.ctx.ghPushFilesAtomic({ repo: 'o/r', token: 't' }, FILES, 'msg'));
  assert.deepEqual([rl.noted.length, rl.remembered.length], [0, 1], 'a rate limit is not a viewing key');
  const u = atomicBox({ failAt: 'POST /git/blobs', failStatus: 401 });
  await assert.rejects(() => u.ctx.ghPushFilesAtomic({ repo: 'o/r', token: 't' }, FILES, 'msg'));
  assert.deepEqual([u.noted.length, u.remembered.length], [0, 1], 'a 401 is a failure, as before');
  const put = atomicBox({ failAt: 'PUT /contents/change_log.json' });
  await assert.rejects(() => put.ctx.ghPushFile({ repo: 'o/r', token: 't' }, 'change_log.json', '[]'));
  assert.deepEqual([put.noted.length, put.remembered.length], [1, 0], 'the single-file write too');
  // noteViewingKey itself: the kind is recorded and the refusal is not shown as an error
  const v = authBox({ token: 'KEY', meta: { keyKind: 'sending', lastError: 'GitHub refused access.', lastErrorAt: '2026-11-01T10:00:00Z' }, answer: () => res(200, {}) });
  v.PA.noteViewingKey();
  assert.equal(v.PA.getMeta().keyKind, 'viewing'); assert.equal(v.PA.getMeta().lastError, undefined);
  assert.equal(v.els['gh-auth-status'].textContent, 'Connected to view the kitchen’s lists (viewing key).');
  // the failed publish is recorded as viewing_key, not as an error to retry
  const st = memStore();
  const ps = { console, Date, localStorage: st.api, updateSyncBar() {}, showToast() {}, updateDailyImportPrompt() {}, getOperatorName: () => 'Test',
    publishToGitHub: () => Promise.reject(new Error('GitHub API 403')), doorOutboxAppend: () => 1,
    PublishAuth: { getSavedToken: () => 'KEY', isViewingKey: () => true } };
  vm.createContext(ps);
  vm.runInContext('let _doorPublishInFlight = false; let _doorConnectCardOpen = false;\n' + constLine('DOOR_VIEWING_KEY_COPY') + fnBlock('publishAndSync'), ps);
  await ps.publishAndSync('test');
  assert.equal(JSON.parse(st.s.concLastPublishSkip).reason, 'viewing_key');
});

function capBox() {
  const sb = { console }; vm.createContext(sb);
  vm.runInContext(constBlock('DOOR_PUBLISH_SKIP_REASONS') + '\n' + fnBlock('doorDeviceCapability'), sb);
  sb.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  sb._escAttr = (s) => String(s).replace(/"/g, '&quot;');
  vm.runInContext(fnBlock('_doorDeviceBannerHTML'), sb);
  return {
    cap: (o) => out(vm.runInContext('doorDeviceCapability(' + JSON.stringify(o) + ')', sb)),
    banner: (c) => vm.runInContext('_doorDeviceBannerHTML(' + JSON.stringify(c) + ')', sb),
  };
}
const GOOD = { hasToken: true, tokenExpired: false, operatorName: 'Test', autoPublishOn: true, tabStale: false, lastSkip: null,
  lastError: null, lastGeneratedAt: '2026-11-01T10:00:00Z', lastPublishOkAt: '2026-11-01T10:00:05Z', outbox: [] };

test('(e) the banner: a viewing computer gets one quiet line, not a nag; its owed work says why it never reaches the kitchen', () => {
  const { cap, banner } = capBox();
  const v = cap({ ...GOOD, keyKind: 'viewing', lastSkip: { reason: 'viewing_key', at: '2026-11-01T10:00:00Z' } });
  assert.equal(v.viewing, true); assert.equal(v.canPublish, false);
  assert.equal(v.level, 'none', 'no red or amber banner');
  assert.equal(v.reasons.length, 0, 'the last viewing_key skip is the quiet line itself');
  const h = banner(v);
  assert.match(h, /door-viewing-line/); assert.match(h, /can view the kitchen&rsquo;s lists but not send changes \(viewing key\)/);
  assert.ok(!/#fee2e2|#dc2626|#fef3c7|doorDeviceBannerFix/.test(h), 'quiet: no red, no amber, no button');
  const owed = cap({ ...GOOD, keyKind: 'viewing', lastPublishOkAt: null });
  assert.equal(owed.level, 'red');
  assert.equal(owed.reasons[0].code, 'viewing-key');
  assert.equal(cap({ ...GOOD, keyKind: 'sending' }).level, 'none');
  assert.equal(banner(cap({ ...GOOD, keyKind: 'sending' })), '', 'a sending computer that is up to date shows nothing');
});

// ── (f) pullStateFromGitHub ─────────────────────────────────────────────────────────────────────────────────────────
async function pullWith(result) {
  const toasts = [], bars = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Date, Object,
    PublishAuth: { getRepo: () => REPO }, pullSecondaryState: async () => {},
    doorReadKitchenFile: async () => result,
    showToast: (m) => toasts.push(m), updateSyncBar: (m) => bars.push(m),
    REGISTRY_LIST: [R('T01', ['Regular'])], REGISTRY_MAP: {}, anaphRooms: [],
    getRegistryProvenanceTs: () => 0, doorRegistrySyncShouldSkip: () => false, doorRegistryDataTs: () => 0,
    dedupeRegistryList() {}, doorRefreshBaseSections() {}, saveRegistryState() {}, setRegistryProvenance() {},
    renderRegistry() {}, updateDailyImportPrompt() {}, localStorage: memStore().api,
  };
  vm.createContext(ctx);
  vm.runInContext(constLine('DOOR_LIST_NEEDS_VIEWING_KEY') + fnBlock('pullStateFromGitHub'), ctx);
  await ctx.pullStateFromGitHub(true);
  return { toasts, bars, rooms: out(ctx.REGISTRY_LIST.map((r) => r.room)) };
}

test('(f) pullStateFromGitHub: "Nothing to get yet" only when the kitchen has no list; no key and an error say so', async () => {
  const absent = await pullWith({ absent: true });
  assert.equal(absent.toasts.length, 1); assert.match(absent.toasts[0], /^Nothing to get yet — the kitchen has no saved list/);
  const noKey = await pullWith({ noKey: true });
  assert.deepEqual(noKey.toasts, ['This computer can’t read the kitchen’s resident list — it needs a viewing key. Ask Jason.']);
  assert.ok(noKey.bars.some((b) => /needs a viewing key/.test(b)), 'and the sync bar says so');
  assert.deepEqual(noKey.rooms, ['T01'], 'this computer\'s list is left as it is');
  for (const err of [{ error: 'HTTP 500', status: 500 }, { error: 'offline', status: 0 }, { error: 'HTTP 401', status: 401 }]) {
    const e = await pullWith(err);
    assert.equal(e.toasts.length, 1, JSON.stringify(err)); assert.match(e.toasts[0], /^Couldn’t get the latest/, JSON.stringify(err));
  }
  const empty = await pullWith({ ok: true, via: 'key', data: { residents: [] } });
  assert.match(empty.toasts[0], /^Nothing to get yet/);
  const got = await pullWith({ ok: true, via: 'key', data: { residents: [R('T02', ['No Pork']), R('T03', ['Regular'])], _meta: {} } });
  assert.deepEqual(got.rooms, ['T02', 'T03'], 'a list read with the key is taken');
});

// ── (g) the P5 guard with a key ─────────────────────────────────────────────────────────────────────────────────────
test('(g) the P5 guard on computers with a key: reads _meta through the Contents API, and a newer kitchen list is adopted', async () => {
  const seen = [];
  const API = 'https://api.github.com/repos/' + REPO + '/contents/door_state.json?ref=main';
  let T = null;
  T = twoComputers(html, {
    ctx: () => ({
      PublishAuth: { getRepo: () => REPO, getSavedToken: () => 'TESTKEY', isExpired: () => false, rememberFailure() {} },
      fetch: async (url, init) => {
        url = String(url); init = init || {};
        seen.push({ url, auth: (init.headers || {}).Authorization || null, accept: (init.headers || {}).Accept || null });
        if (url !== API) throw new Error('only the Contents API is open here');
        return T.kitchen.state ? res(200, out(T.kitchen.state)) : res(404, {});
      },
    }),
  });
  const LIST = () => [R('T01', ['Regular']), R('T02', ['No Pork'])];
  const { a, b } = await T.morning(LIST(), []);
  assert.deepEqual(out(a.__state().reg.map((r) => r.room)).sort(), ['T01', 'T02'], 'the morning pull read the list with the key');
  b.__queue([intake('T03', { regular: true })]);
  await b.__generate();                               // the kitchen is now newer than A
  assert.ok(T.kitchen.state.residents.some((r) => r.room === 'T03'), 'B sent its list');
  const pre = await a.doorRegistryPublishPreflight(false);
  assert.equal(pre.adopted, true, 'A takes the kitchen\'s newer list before it publishes');
  assert.ok(out(a.__state().reg).some((r) => r.room === 'T03'), 'A now has B\'s intake');
  assert.ok(seen.length >= 4, 'reads happened');
  assert.ok(seen.every((s) => s.url === API && s.auth === 'Bearer TESTKEY' && s.accept === 'application/vnd.github.raw+json'),
    'every read of the list went to the Contents API with the key');
  // with no answer at all, the guard still says "unchecked" and the change stays on this computer's list
  const down = twoComputers(html, { ctx: () => ({ PublishAuth: { getRepo: () => REPO, getSavedToken: () => 'TESTKEY', isExpired: () => false, rememberFailure() {} },
    fetch: async () => { throw new Error('offline'); } }) });
  const c = down.computer('C');
  assert.equal(await c.doorTakeNewerKitchenList(), 'unchecked');
});

// ── (h) the plating notice, Generate's question, the banner, the rehearsal switch, the first-run card ──────────────
function noticeBox({ last, rehearsal = true, readAt, key = '', list }) {
  const init = {};
  if (last) init.concKitchenListLastResult = last;
  if (rehearsal) init.concPrivateRehearsal = '1';
  if (readAt) init.concKitchenListReadAt = readAt;
  const asked = [];
  const ctx = {
    console, Date, isNaN, localStorage: memStore(init).api,
    PublishAuth: { getSavedToken: () => key, isExpired: () => false },
    REGISTRY_LIST: list || [],
    escapeHtml: (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    doorAsk: async (o) => { asked.push(o); return ctx.__answer; }, __answer: false,
  };
  vm.createContext(ctx);
  vm.runInContext(readerSrc() + '\n' + fnBlock('doorNoResidentListNoticeHTML') + '\n' + fnBlock('doorAskGenerateWithoutKitchenList'), ctx);
  return { ctx, asked, notice: () => ctx.doorNoResidentListNoticeHTML() };
}
const T12 = () => [R('T01', ['Regular']), R('T02', ['No Pork'])];

test('(h) the plating notice: no key → the plain state with the list\'s date, red and in print; otherwise as before', () => {
  const n = noticeBox({ last: 'noKey', readAt: '2026-10-30T14:05:00.000Z', list: T12() }).notice();
  assert.match(n, /class="door-no-resident-list" role="alert"/);
  assert.match(n, /border:2px solid #dc2626/, 'still red');
  assert.match(n, /This computer can’t get the kitchen’s resident list — it needs a viewing key\. The list here is from Oct \d{1,2}, 2026/);
  assert.ok(!/show no residents/.test(n), 'a computer with a list says only that the list may be old');
  const unknown = noticeBox({ last: 'noKey', list: T12() }).notice();
  assert.match(unknown, /The list here is from an unknown date\./);
  const empty = noticeBox({ last: 'noKey' }).notice();
  assert.match(empty, /needs a viewing key[\s\S]*These sheets show no residents\./);
  assert.match(noticeBox({ last: 'ok' }).notice(), /No resident list on this computer — these sheets show no residents/, 'the empty-list text stays');
  assert.equal(noticeBox({ last: 'ok', list: T12() }).notice(), '', 'a key read that worked: no notice');
  assert.equal(noticeBox({ last: 'noKey', rehearsal: false, list: T12() }).notice(), '', 'not rehearsing: the raw address still reads it');
  assert.equal(noticeBox({ last: 'noKey', key: 'NEWKEY', list: T12() }).notice(), '', 'a key saved since');
  // printed: the notice rides on the preview, and print CSS doesn't hide it
  assert.match(html, /preview\.innerHTML = doorNoResidentListNoticeHTML\(\) \+ buildPlatingHtml\(pd, false\)/);
  assert.ok(!/@media print[^{]*\{[^}]*door-no-resident-list[^}]*display:\s*none/.test(html), 'not hidden in print');
});

test('(h) Generate asks first, with DOOR\'s own dialog; Go back is the default and stops; never a native confirm', async () => {
  const b = noticeBox({ last: 'noKey', readAt: '2026-10-30T14:05:00.000Z', list: T12() });
  assert.equal(await b.ctx.doorAskGenerateWithoutKitchenList(), false, 'Go back stops Generate');
  assert.equal(b.asked.length, 1);
  assert.match(b.asked[0].title, /^Generate from this computer’s list from Oct \d{1,2}, 2026.*\?$/);
  assert.equal(b.asked[0].cancelLabel, 'Go back'); assert.equal(b.asked[0].goLabel, 'Generate anyway');
  b.ctx.__answer = 'alt';
  assert.equal(await b.ctx.doorAskGenerateWithoutKitchenList(), false, 'only Generate anyway goes ahead');
  b.ctx.__answer = true;
  assert.equal(await b.ctx.doorAskGenerateWithoutKitchenList(), true);
  const ok = noticeBox({ last: 'ok', list: T12() });
  assert.equal(await ok.ctx.doorAskGenerateWithoutKitchenList(), true); assert.equal(ok.asked.length, 0, 'nothing asked when the list was read');
  const gen = fnBlock('generateFiles');
  const iAsk = gen.indexOf('if (!(await doorAskGenerateWithoutKitchenList())) return;'), iTake = gen.indexOf('await doorTakeNewerKitchenList()');
  assert.ok(iAsk > 0 && iTake > iAsk, 'Generate asks before anything else it awaits');
  assert.ok(!/\bconfirm\(/.test(gen + fnBlock('doorAskGenerateWithoutKitchenList')), 'no native confirm()');
  assert.ok(/doorAsk\(/.test(fnBlock('doorAskGenerateWithoutKitchenList')));
});

test('(h) the banner names the same reason, in red; the rehearsal switch; the first-run card\'s words', () => {
  const { cap, banner } = capBox();
  const c = cap({ ...GOOD, hasToken: false, readOnly: true, kitchenListUnreadable: true, kitchenListReadAt: '2026-10-30T14:05:00.000Z' });
  assert.equal(c.listUnreadable, true); assert.equal(c.level, 'red');
  const r = c.reasons.find((x) => x.code === 'no-viewing-key');
  assert.ok(r, 'the reason'); assert.equal(r.action, 'connect');
  assert.match(r.label, /can’t get the kitchen’s resident list — it needs a viewing key \(the list here is from Oct \d{1,2}, 2026/);
  assert.ok(!c.reasons.some((x) => x.code === 'read-only' || x.code === 'no-connection'), 'one connect line, not two');
  assert.ok(!NO_GH.test(c.reasons.map((x) => x.label).join(' ')));
  assert.match(banner(c), /This computer can’t get the kitchen’s resident list/);
  // the rehearsal switch: Settings, one line of explanation, stored per computer
  assert.match(html, /<input type="checkbox" id="door-private-rehearsal" onchange="doorSetPrivateRehearsal\(this\.checked\)"> Rehearse a private kitchen repository on this computer<\/label>/);
  const st = memStore();
  const sw = { console, Date, isNaN, localStorage: st.api, document: { getElementById: () => null }, PublishAuth: { getSavedToken: () => '' }, __pulls: 0 };
  sw.pullStateFromGitHub = () => { sw.__pulls++; };
  vm.createContext(sw);
  vm.runInContext(readerSrc() + '\n' + fnBlock('doorSetPrivateRehearsal') + fnBlock('doorRenderKitchenListReadLine'), sw);
  sw.doorSetPrivateRehearsal(true);
  assert.equal(st.s.concPrivateRehearsal, '1'); assert.equal(sw.__pulls, 1, 'reads again the way it now reads');
  sw.doorSetPrivateRehearsal(false);
  assert.equal(st.s.concPrivateRehearsal, undefined);
  // the first-run card: no key means menus only; residents need a viewing key; no provider words
  const fr = { console, escapeHtml: (s) => String(s), _escAttr: (s) => String(s), currentSite: { name: 'Rexdale' } };
  vm.createContext(fr);
  vm.runInContext(fnBlock('_doorFirstRunCardHTML'), fr);
  const card = fr._doorFirstRunCardHTML();
  assert.match(card, /Skip &mdash; this computer will only read menus/);
  assert.match(card, /Without a key, this computer sees menus only\. To see residents, it needs a viewing key from Jason/);
  assert.ok(!NO_GH.test(card.replace(/doorFirstRun\w+/g, '')), 'no provider words on a staff screen');
});
