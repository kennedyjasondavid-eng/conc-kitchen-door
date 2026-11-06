// F1 gate harness. Production publishers/stores run in a VM; only browser UI,
// transport, guards and artifact builders are replaced. No live files or network.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createSingleContextLockManager } from './single_context_lock_manager.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const html = fs.readFileSync(process.env.DOOR_GATE_HTML || path.join(root, 'index.html'), 'utf8');
export const plain = value => JSON.parse(JSON.stringify(value));
export const DAY_KEY = '2026-11-06-dinner';
export const CREATED = '2026-11-04T09:00:00.000Z';
export const REMOVED = '2026-11-04T11:00:00.000Z';
export const SWAP = { specialName: 'Fixture Sausage', createdAt: CREATED, _flagsRaw: { hasPork: true } };
export const CONSISTENCY_PATHS = [
  'menu_current.json', 'menu_overlay.json', 'meal_swaps.json', 'meal_swaps_reverted.json',
  'special_meals.json', 'special_meals_removed.json', 'routing_by_meal.json',
  'registry_summary.json', 'door_state.json'
];
const cutover = Number(/const DOOR_STANDARD_MENU_CUTOVER\s*=\s*(\d+)/.exec(html)[1]);
const schema = { menu: 32, routing: 31, registry: 30, state: 30 };
const stamp = version => ({ version, exported: '2026-11-04T12:00:00.000Z', site: 'fixture' });
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MEALS = ['breakfast', 'lunch', 'dinner'];
export const emptyOverlay = () => ({ _meta: { standardCutover: cutover } });
export const editedOverlay = (name, at = 1793793600000) => ({
  _meta: { standardCutover: cutover, dayEditedAt: { '2|FRIDAY': at } },
  '2': { FRIDAY: { dinner: name } }
});
const matrix = make => Object.fromEntries([1, 2, 3, 4].map(w => [w,
  Object.fromEntries(DAYS.map(d => [d, Object.fromEntries(MEALS.map(m => [m, make(w, d, m)]))]))
]));
const menuFixture = overlay => {
  const menu = matrix(() => 'Fixture Rice');
  menu['2'].THURSDAY.dinner = 'Fixture Lentils';
  for (const [w, days] of Object.entries(overlay || {})) if (w !== '_meta') {
    for (const [d, edits] of Object.entries(days)) Object.assign(menu[w][d], plain(edits));
  }
  return { _meta: stamp(schema.menu), menu };
};
const stateFixture = () => ({
  _meta: { ...stamp(schema.state), count: 3 },
  residents: [{ room: 'TEST-R', tags: [] }, { room: 'TEST-V', tags: ['vegetarian'] }, { room: 'TEST-A', tags: ['anaphylactic'] }],
  anaphRooms: ['TEST-A']
});
const summaryFixture = () => ({ _meta: stamp(schema.registry), headcounts: { total: 3 }, flags: {} });
const routingFixture = meal => ({
  _meta: stamp(schema.routing),
  routing: matrix((w, d, m) => ({
    Regular: 1, Vegetarian: 1,
    // Deliberately not the section total: the synthetic anaphylactic plate is separate.
    _components: { [w === 2 && d === 'FRIDAY' && m === 'dinner' ? meal : 'Fixture Rice']: 1 }
  }))
});
export function initialRemote(overrides = {}) {
  return {
    'menu_current.json': menuFixture(emptyOverlay()), 'menu_overlay.json': emptyOverlay(),
    'routing_by_meal.json': routingFixture('Fixture Rice'),
    'registry_summary.json': summaryFixture(), 'door_state.json': stateFixture(),
    'meal_swaps.json': {}, 'meal_swaps_reverted.json': {},
    'special_meals.json': {}, 'special_meals_removed.json': {}, ...plain(overrides)
  };
}

// Reuse the existing repository extractor, without registering/running its tests.
const smokeFile = path.join(root, 'tests/door-smoke.mjs');
const smoke = fs.readFileSync(smokeFile, 'utf8');
const extractor = vm.createContext({ fs, path, vm, assert, fileURLToPath });
vm.runInContext(smoke.slice(smoke.indexOf('function extractTestableCoreBlock'), smoke.indexOf('function loadComplianceConflictCore')), extractor);
export const fn = name => extractor.extractFunctionBlock(html, name);
const core = name => extractor.extractTestableCoreBlock(html, name);
const method = name => extractor.extractFunctionBlock(html.replace(new RegExp('  ' + name + '\\('), '  function ' + name + '('), name);

// Contents GETs may be pinned to any existing immutable revision. Trees/blobs do
// not change visible files; only an accepted ref update (or Contents PUT) does.
export class ApplyingRemote {
  constructor(files = initialRemote()) {
    this.serial = 0;
    this.head = this.id();
    this.revisions = new Map([[this.head, plain(files)]]);
    this.trees = new Map([[this.head + '-tree', plain(files)]]);
    this.commits = new Map([[this.head, { tree: this.head + '-tree', parents: [] }]]);
    this.blobs = new Map();
    this.requests = [];
    this.visibleWrites = [];
    this.failures = new Map();
    this.beforePatch = null;
    this.afterPatch = null;
  }
  id() { return (++this.serial).toString(16).padStart(40, '0'); }
  get files() { return plain(this.revisions.get(this.head)); }
  externalUpdate(changes) {
    const parent = this.head, files = { ...this.files, ...plain(changes) }, sha = this.id();
    this.trees.set(sha + '-tree', files);
    this.commits.set(sha, { tree: sha + '-tree', parents: [parent] });
    this.revisions.set(sha, files); this.head = sha;
    return sha;
  }
  async fetch(url, opts = {}) {
    const u = new URL(url), method = opts.method || 'GET';
    assert.equal(u.origin, 'https://api.github.com', 'harness never permits real network');
    const route = u.pathname.replace(/^\/repos\/fixture\/door/, '');
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    this.requests.push({ method, route, ref: u.searchParams.get('ref'), body: plain(body || null) });
    const response = (status, data) => ({ ok: status >= 200 && status < 300, status,
      statusText: 'fixture ' + status, json: async () => plain(data), text: async () => JSON.stringify(data) });
    if (method === 'GET' && route.startsWith('/contents/')) {
      const file = decodeURIComponent(route.slice('/contents/'.length));
      const failure = this.failures.get(file);
      if (failure === 'malformed') return response(200, { content: Buffer.from('{bad-json').toString('base64') });
      if (failure) return response(Number(failure), { message: 'fixture authoritative read failed' });
      const ref = u.searchParams.get('ref') || this.head;
      const files = this.revisions.get(ref === 'main' ? this.head : ref);
      if (!files || !(file in files)) return response(404, { message: 'Not Found' });
      const text = JSON.stringify(files[file]);
      return response(200, { content: Buffer.from(text).toString('base64'),
        sha: createHash('sha1').update(text).digest('hex'), encoding: 'base64' });
    }
    if (method === 'GET' && route === '/git/ref/heads/main') return response(200, { object: { sha: this.head } });
    if (method === 'GET' && route.startsWith('/git/commits/')) {
      const sha = route.split('/').pop(), commit = this.commits.get(sha);
      assert.ok(commit, 'unknown commit ' + sha);
      return response(200, { sha, tree: { sha: commit.tree }, parents: commit.parents.map(sha => ({ sha })) });
    }
    if (method === 'GET' && route.startsWith('/git/trees/')) {
      const files = this.trees.get(route.split('/').pop());
      assert.ok(files, 'unknown tree');
      return response(200, { truncated: false, tree: Object.keys(files).map(path => ({ path, type: 'blob', mode: '100644', sha: createHash('sha1').update(JSON.stringify(files[path])).digest('hex') })) });
    }
    if (method === 'POST' && route === '/git/blobs') {
      const sha = this.id(); this.blobs.set(sha, JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')));
      return response(201, { sha });
    }
    if (method === 'POST' && route === '/git/trees') {
      const sha = this.id(), base = this.trees.get(body.base_tree);
      assert.ok(base, 'tree must extend a known base');
      const files = plain(base);
      for (const entry of body.tree) {
        if (entry.sha === null) delete files[entry.path];
        else { assert.ok(this.blobs.has(entry.sha), 'tree references an uploaded blob'); files[entry.path] = plain(this.blobs.get(entry.sha)); }
      }
      this.trees.set(sha, files); return response(201, { sha });
    }
    if (method === 'POST' && route === '/git/commits') {
      const sha = this.id(); this.commits.set(sha, { tree: body.tree, parents: body.parents });
      return response(201, { sha });
    }
    if (method === 'PATCH' && route === '/git/refs/heads/main') {
      if (this.beforePatch) { const hook = this.beforePatch; this.beforePatch = null; await hook(this); }
      const commit = this.commits.get(body.sha);
      assert.equal(body.force, false, 'never force the shared ref');
      if (commit.parents[0] !== this.head) return response(422, { message: 'Update is not a fast forward' });
      const before = this.files, files = plain(this.trees.get(commit.tree));
      this.head = body.sha; this.revisions.set(this.head, files);
      this.visibleWrites.push({ kind: 'atomic', sha: this.head, before, files: this.files });
      if (this.afterPatch) { const hook = this.afterPatch; this.afterPatch = null; await hook(this); }
      return response(200, { object: { sha: this.head } });
    }
    if (method === 'PUT' && route.startsWith('/contents/')) {
      const file = route.slice('/contents/'.length), before = this.files;
      const value = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      this.externalUpdate({ [file]: value });
      this.visibleWrites.push({ kind: 'single', path: file, sha: this.head, before, files: this.files });
      return response(200, { commit: { sha: this.head } });
    }
    throw new Error('Unmodelled request: ' + method + ' ' + route);
  }
}

class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00.000Z'])); }
  static now() { return Date.parse('2026-11-04T12:00:00.000Z'); }
}

export function publishBox(options = {}) {
  const remote = options.remote || new ApplyingRemote();
  const storage = options.storage || {};
  const seed = { concMenuBase: emptyOverlay(), concMealSwaps: options.swaps || {}, concSpecialMeals: options.specials || {},
    concRevertedSwapKeys: {}, concRemovedSpecialKeys: {}, concCustomTagRules: [], concLearnedNR: {} };
  for (const [key, value] of Object.entries(seed)) if (!(key in storage)) storage[key] = JSON.stringify(value);
  const timers = [], pending = [], events = [], messages = [];
  let timerId = 0;
  let fixtureNow = FixtureDate.now();
  class BoxDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixtureNow])); }
    static now() { return fixtureNow; }
  }
  const c = {
    Array, Object, JSON, Promise, Set, String, Number, Math, Date: BoxDate, URL,
    crypto: webcrypto, TextEncoder, AbortController,
    navigator: { locks: createSingleContextLockManager() },
    console: { log(...x) { messages.push(x); }, warn(...x) { messages.push(x); }, error(...x) { messages.push(x); } },
    localStorage: { getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = String(value); }, removeItem: key => { delete storage[key]; } },
    document: { getElementById: () => null, querySelector: () => null },
    setTimeout(cb, delay = 0) { const id = ++timerId; timers.push({ id, cb, due:fixtureNow+Math.max(0,Number(delay)||0) }); return id; },
    clearTimeout(id) { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); },
    fetch: remote.fetch.bind(remote),
    atob: x => Buffer.from(x, 'base64').toString('binary'), btoa: x => Buffer.from(x, 'binary').toString('base64'),
    escape, unescape, encodeURIComponent, decodeURIComponent, isFinite,
    updateSyncBar(...x) { messages.push(x); }, showToast(...x) { messages.push(x); },
    doorAsk: async () => false,
    getRegistryProvenanceTs: () => 0,
    RECENT_LOG: [], REGISTRY_LIST: stateFixture().residents,
    getOperatorName: () => 'Fixture Operator', updateDailyImportPrompt() {},
    _ghEvaluateWriteGuards: async (_creds, file) => ({ block: options.blockedPath === file ? { skipped: true, reason: 'fixture-guard' } : null }),
    doorPullRexAnswers: async () => ({}),
    PublishAuth: {
      getCredentialsForManualPublish: () => ({ repo: 'fixture/door', token: 'fixture-token' }),
      _getSavedCredentials: () => ({ repo: 'fixture/door', token: 'fixture-token' }),
      getSavedToken: () => 'fixture-token', getRepo: () => 'fixture/door', isViewingKey: () => false,
      githubHeaders: () => ({}), classifyGitHubError: (status, message) => 'GitHub ' + status + ': ' + message,
      rememberFailure(...x) { messages.push(x); }, showSidePublishResult() {}, renderStatus() {}
    }
  };
  c.setDoorPublishMenuOverlayOverride = value => { c._doorPublishMenuOverlayOverride = value; };
  c.buildMenuJSON = () => { events.push('build-menu'); return menuFixture(c._doorPublishMenuOverlayOverride || JSON.parse(storage.concMenuBase)); };
  c.buildRegistrySummaryJSON = summaryFixture;
  c.buildStateJSON = stateFixture;
  c.buildRoutingByMealJSON = () => {
    const meals = c.loadMealSwaps(), specials = c.loadSpecialMeals();
    const menu = c.buildMenuJSON();
    const name = specials[DAY_KEY]?.specialName || meals[DAY_KEY]?.specialName || menu.menu['2'].FRIDAY.dinner;
    events.push({ buildRoutingFor: name });
    return routingFixture(name);
  };
  c.doorReadKitchenFile = async file => {
    const res = await c.fetch('https://api.github.com/repos/fixture/door/contents/' + file);
    if (!res.ok) return { error: 'fixture read', status: res.status };
    return { ok: true, data: JSON.parse(Buffer.from((await res.json()).content, 'base64').toString('utf8')) };
  };
  vm.createContext(c);
  const functions = [
    'doorDateKey', 'doorPagesUrl', 'doorMakeRevertList', 'loadMealSwaps', 'saveMealSwaps', 'loadSpecialMeals', 'saveSpecialMeals',
    'loadSwapReverts', 'loadSpecialRemovals', 'doorApplyRemoteSwaps', 'doorApplyRemoteSpecials',
    'loadMenuBaseOverlay', 'saveMenuBaseOverlay',
    'preMergeOverlayWithCloud', 'preMergeSwapsWithCloud', 'reportDoorPublishValidation', 'reportDoorOverlayMergeAdvisory',
    'ghPushFile', '_ghPushFileNow', 'ghPushFilesAtomic', '_ghPushFilesAtomicNow',
    'doorSetItemSafe', 'doorOutboxRead', 'doorOutboxAppend', 'doorOutboxClear', 'doorOutboxDrain',
    '_doPublishToGitHub', 'publishToGitHub', 'publishAndSync'
  ];
  const optional = html.includes('/* DOOR_TESTABLE_CORE_START publish-transaction */') ? core('publish-transaction') : '';
  vm.runInContext([
    core('publish-validation'), core('swap-store'),
    "var _ghWriteQueue = Promise.resolve(), _publishQueue = Promise.resolve(), _doorPublishInFlight = false, _doorConnectCardOpen = false;",
    "const DOOR_PUBLISH_OUTBOX_KEY='concPublishOutbox', DOOR_OUTBOX_MAX=50, DOOR_EXPENDABLE_KEYS=['concRegistrySnapshot'];",
    ...functions.map(fn), optional,
    "var REVERTED_SWAP_KEYS = doorMakeRevertList('concRevertedSwapKeys','meal_swaps_reverted.json','Swap reverts');",
    "var REMOVED_SPECIAL_KEYS = doorMakeRevertList('concRemovedSpecialKeys','special_meals_removed.json','Special meal removals');",
    'PublishAuth.sidePublish = ' + method('sidePublish') + ';'
  ].join('\n'), c, { filename: 'index.html#F1-publish-box', timeout: 1500 });
  const actualSidePublish = c.PublishAuth.sidePublish;
  c.PublishAuth.sidePublish = function(...args) {
    events.push({ sidePublish: args[0] });
    const result = actualSidePublish.apply(this, args); pending.push(Promise.resolve(result)); return result;
  };
  const originalPublishAndSync = c.publishAndSync;
  c.publishAndSync = (...args) => { const result = originalPublishAndSync(...args); pending.push(Promise.resolve(result)); return result; };
  const flush = async () => {
    let callbacks=0;
    for (let i = 0; i < 20; i++) {
      while (timers.length) {
        if (++callbacks>1000) throw new Error('fixture timer callback bound exceeded');
        timers.sort((a,b)=>a.due-b.due||a.id-b.id);
        const timer=timers.shift();fixtureNow=Math.max(fixtureNow,timer.due);
        await timer.cb();
      }
      if (!pending.length) { await Promise.resolve(); if (!timers.length && !pending.length) return; }
      await Promise.all(pending.splice(0));
    }
    throw new Error('fixture timers/publish queue did not settle');
  };
  return { c, storage, remote, events, messages, flush,
    load(...names) { vm.runInContext(names.map(fn).join('\n'), c); },
    async publish() { try { return await c.publishToGitHub(false); } catch (error) { return { error }; } }
  };
}
