// Public transport gate: exercise the actual boot loader without credentials/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const declaration = html.match(/^const DOOR_SHARED_LIBRARY_URL = .+;$/m)[0];
const start = html.indexOf('(async function loadSharedLibrary()');
assert.ok(start >= 0);
const loader = html.slice(start, html.indexOf('})();', start) + 5);
const expected = 'https://kennedyjasondavid-eng.github.io/conc-recipe-hub/library_public.json';
const sample = { _meta: { version: 1 }, recipes: [{ recipeName: 'Corn rice', door: { recipeName: 'Corn rice', category: 'starch_side', stream: 'vegan', allergens: ['Corn'], veganFriendly: null, removedAllergens: ['Milk'] } }, { recipeName: 'Old mix', removed: true }] };
const plain = x => JSON.parse(JSON.stringify(x));
async function boot(fetch, cached = null) {
  const saved = new Map(cached ? [['door_shared_library_cache', JSON.stringify(cached)]] : []);
  const c = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout, console: { info() {} },
    localStorage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) },
    _doorSharedLibrary: null, _doorSharedLibrarySource: 'none', _doorApplySharedRecipes() { c.applied++; }, applied: 0 });
  await vm.runInContext(declaration + '\n' + loader, c);
  return { c, saved };
}
test('DOOR points to the public recipe projection on existing Pages', () => {
  assert.equal(vm.runInNewContext(declaration + '\nDOOR_SHARED_LIBRARY_URL'), expected);
});
test('anonymous boot reads and caches all projected safety fields, without a key', async () => {
  const calls = [];
  const { c, saved } = await boot(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => sample }; });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname.split('/').pop(), 'library_public.json');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.headers, undefined);
  assert.deepEqual(plain(c._doorSharedLibrary), sample);
  assert.deepEqual(JSON.parse(saved.get('door_shared_library_cache')), sample);
  assert.equal(c._doorSharedLibrarySource, 'live');
  assert.equal(c.applied, 1);
});
test('an unavailable public file keeps the last shared copy and reapplies it', async () => {
  const { c } = await boot(async () => ({ ok: false, status: 503 }), sample);
  assert.deepEqual(plain(c._doorSharedLibrary), sample);
  assert.equal(c._doorSharedLibrarySource, 'cached');
  assert.equal(c.applied, 1);
});
