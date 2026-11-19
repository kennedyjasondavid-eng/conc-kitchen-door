// Storage headroom — HOUSE storage plan 2026-11-19 §2, slice S1-D (DOOR).
// (conc-kitchen-house docs/HOUSE_STORAGE_PLAN_2026-11-19.md; HOUSE_PROVEN_SEAMS row 1)
//
// DOOR, EXPO, HUB and CODEX share one browser origin and one localStorage allowance.
// When a DOOR write fails for quota, doorSetItemSafe frees DOOR's own re-fetchable
// caches in order, retrying after each, and stops as soon as the write lands: the
// CODEX recipe list copy, the HOUSE site registry copy, the pre-Generate undo
// snapshot, and LAST the shared Library copy. Working data and other apps' keys are
// never removed. Still full: loud on the console, false, nothing else removed.
// The retired door_menu_reno_cache (HUB's old kept copy of menu_reno.json, read by
// nothing) is removed once at boot.
//
// Authored-to-fail on main 5e2d7a3: the list held only the undo snapshot, the two
// CODEX copies were bare setItem writes, and the reno copy was never removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function fnBlock(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(m.index, i + 1);
}
function arrayConst(name) {
  const m = new RegExp('const ' + name + '\\s*=\\s*\\[[\\s\\S]*?\\];').exec(html);
  assert.ok(m, 'missing const ' + name);
  return m[0];
}
function listOf(name) {
  const sb = {}; vm.createContext(sb);
  return Array.from(vm.runInContext(arrayConst(name) + '\n' + name, sb));
}

const EXPECTED = ['door_recipe_data_cache', 'door_house_sites_cache', 'concRegistrySnapshot', 'door_shared_library_cache'];
// Working data (DOOR) and other apps' keys on the shared origin.
const NEVER = [
  'concPublishOutbox', 'concMenuChangeLog', 'concRegistryState', 'concMenuBase', 'concUploadedMenu',
  'concMenuBaseOverlay', 'concMenuEdits', 'concMealSwaps', 'concSpecialMeals', 'conc-door-settings',
  'concLearnedNR', 'concDoorRules', 'concPublishTransaction', 'door_publish_auth',
  // HUB writes these (door_ prefix notwithstanding): HUB frees its own (S1-U).
  'door_routing_cache', 'door_menu_rexdale_current_cache', 'door_recipe_prod_records_cache',
  'pp_autosave', 'pp_canonical_save', 'pp_ledger', 'concRecipeLibrary', 'hub_schedule_cache', 'hub_frozen_onhand_cache'
];

// A stand-in localStorage with a fixed allowance in characters, like a browser origin.
function fullStorage(seed, cap) {
  const store = { ...seed };
  const size = () => Object.keys(store).reduce((n, k) => n + k.length + store[k].length, 0);
  const ls = {
    _store: store, _removed: [],
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      const before = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : undefined;
      store[k] = String(v);
      if (size() > cap) {
        if (before === undefined) delete store[k]; else store[k] = before;
        const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e;
      }
    },
    removeItem: k => { ls._removed.push(k); delete store[k]; }
  };
  return ls;
}
function seed() {
  const s = {};
  NEVER.forEach(k => { s[k] = 'w'.repeat(1000); });
  s.door_recipe_data_cache = 'r'.repeat(5000);
  s.door_house_sites_cache = 's'.repeat(500);
  s.concRegistrySnapshot = 'u'.repeat(3000);
  s.door_shared_library_cache = 'L'.repeat(8000);
  return s;
}
function sandbox(storage) {
  const logs = [];
  const say = (...a) => logs.push(a.join(' '));
  const sb = { localStorage: storage, console: { warn: say, info: say, log: say, error: say } };
  vm.createContext(sb);
  vm.runInContext(arrayConst('DOOR_EXPENDABLE_KEYS') + '\n' + fnBlock('doorSetItemSafe'), sb);
  return { sb, logs };
}
const used = s => Object.keys(s).reduce((n, k) => n + k.length + s[k].length, 0);

test('the expendable list is DOOR\'s own re-fetchable copies, in order, the shared Library copy last', () => {
  const list = listOf('DOOR_EXPENDABLE_KEYS');
  assert.deepEqual(list, EXPECTED);
  assert.equal(list[list.length - 1], 'door_shared_library_cache', 'the shared Library copy is freed last');
  NEVER.forEach(k => assert.ok(!list.includes(k), k + ' must never be expendable'));
});

test('a full origin: the first cache is freed, the write lands, nothing else is touched', () => {
  const s = seed(); const cap = used(s) + 100;
  const ls = fullStorage(s, cap); const { sb, logs } = sandbox(ls);
  assert.equal(vm.runInContext("doorSetItemSafe('concMenuChangeLog', 'n'.repeat(3000))", sb), true);
  assert.deepEqual(ls._removed, ['door_recipe_data_cache']);
  assert.equal(ls._store.concMenuChangeLog.length, 3000);
  assert.ok(logs.some(l => /freed "door_recipe_data_cache"/.test(l)), 'the console names the freed key');
  ['door_house_sites_cache', 'concRegistrySnapshot', 'door_shared_library_cache'].forEach(k => assert.ok(k in ls._store, k + ' kept'));
});

test('freed in order, stopping as soon as the write lands; the shared Library copy only when nothing else is left', () => {
  const s = seed(); const cap = used(s) + 100;
  const ls = fullStorage(s, cap); const { sb } = sandbox(ls);
  // Needs the recipe copy, the site copy and the snapshot, not the Library copy.
  assert.equal(vm.runInContext("doorSetItemSafe('concRegistryState', 'n'.repeat(1000 + 8400))", sb), true);
  assert.deepEqual(ls._removed, ['door_recipe_data_cache', 'door_house_sites_cache', 'concRegistrySnapshot']);
  assert.ok('door_shared_library_cache' in ls._store, 'the Library copy stays while the write fits without it');

  const s2 = seed(); const ls2 = fullStorage(s2, used(s2) + 100); const r2 = sandbox(ls2);
  assert.equal(vm.runInContext("doorSetItemSafe('concRegistryState', 'n'.repeat(1000 + 12000))", r2.sb), true);
  assert.deepEqual(ls2._removed, EXPECTED, 'the Library copy freed last, only when needed');
  assert.ok(r2.logs.filter(l => /\[DOOR\] storage full: freed/.test(l)).length === 4, 'each freed key named');
  NEVER.forEach(k => assert.ok(k in ls2._store, k + ' never removed'));
});

test('still full: loud failure, false, no throw, nothing but the expendable copies removed', () => {
  const s = seed(); const ls = fullStorage(s, used(s) + 100); const { sb, logs } = sandbox(ls);
  assert.equal(vm.runInContext("doorSetItemSafe('concMenuBase', 'n'.repeat(500000))", sb), false);
  assert.ok(logs.some(l => /doorSetItemSafe: write to "concMenuBase" failed/.test(l)), 'loud on the console');
  assert.ok(ls._removed.every(k => EXPECTED.includes(k)), 'only expendable keys removed: ' + ls._removed);
  NEVER.forEach(k => assert.ok(k in ls._store, k + ' never removed'));
  assert.equal(ls._store.concMenuBase.length, 1000, 'the old value of the failed key is kept');
});

// Re-pinned 2026-11-19 (review fold P2): a kept-copy write frees nothing, so a cache refresh can never take
// the Undo Generate snapshot or push the other big copy out; its own write just fails quietly.
test('a kept copy never frees another key (not the undo snapshot, not the other copy)', () => {
  for (const k of EXPECTED.filter(x => x !== 'concRegistrySnapshot')) {
    const s = seed(); const ls = fullStorage(s, used(s) + 100); const { sb } = sandbox(ls);
    assert.equal(vm.runInContext("doorSetItemSafe('" + k + "', 'r'.repeat(20000))", sb), false, k + ' write fails quietly');
    assert.deepEqual(ls._removed, [], k + ': nothing freed');
    assert.ok('concRegistrySnapshot' in ls._store, k + ': the undo snapshot stays');
  }
});

test('DOOR writes its CODEX copies through doorSetItemSafe, and their readers fall back when the copy is gone', () => {
  ['door_recipe_data_cache', 'door_shared_library_cache'].forEach(k => {
    assert.ok(html.includes("doorSetItemSafe('" + k + "'"), k + ' written through doorSetItemSafe');
    assert.ok(!new RegExp("localStorage\\.setItem\\('" + k + "', JSON").test(html), k + ': no bare write left');
  });
  assert.match(html, /localStorage\.getItem\('door_recipe_data_cache'\) \|\| '\[\]'/);
  assert.match(html, /_recipeDataSource = 'fallback'/);
  assert.match(html, /localStorage\.getItem\('door_shared_library_cache'\) \|\| 'null'/);
  assert.match(html, /doorSetItemSafe\(DOOR_HOUSE_SITES_CACHE_KEY/);
});

test('door_menu_reno_cache: read by nothing, removed once at boot and named', () => {
  const uses = html.split('\n').filter(l => l.includes('door_menu_reno_cache'));
  assert.equal(uses.length, 2, 'only the retired list and its comment: ' + uses.join(' | '));
  assert.deepEqual(listOf('DOOR_RETIRED_KEYS'), ['door_menu_reno_cache']);
  assert.match(html, /\ntry \{ doorDropRetiredKeys\(\); \} catch \(e\) \{\}\n/, 'run at boot');
  const s = seed(); s.door_menu_reno_cache = 'R'.repeat(61000);
  const ls = fullStorage(s, 10e6); const logs = [];
  const sb = { localStorage: ls, console: { info: (...a) => logs.push(a.join(' ')), warn() {}, log() {} } };
  vm.createContext(sb);
  vm.runInContext(arrayConst('DOOR_RETIRED_KEYS') + '\n' + fnBlock('doorDropRetiredKeys'), sb);
  assert.deepEqual(Array.from(vm.runInContext('doorDropRetiredKeys()', sb)), ['door_menu_reno_cache']);
  assert.deepEqual(ls._removed, ['door_menu_reno_cache']);
  assert.ok(logs.some(l => /door_menu_reno_cache/.test(l)));
  assert.equal(vm.runInContext('doorDropRetiredKeys().length', sb), 0, 'a second boot removes nothing');
  NEVER.concat(EXPECTED).forEach(k => assert.ok(k in ls._store, k + ' kept'));
});
