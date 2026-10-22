// tests/shared_library_overlay_gate.mjs — DOOR reads CODEX's shared Library (2026-10-14).
// Jason: "I want a new recipe I make or an edit to an existing one to change what anyone that visits DOOR sees
// as the canon recipe." A recipe saved in CODEX on a connected tablet lands in library_shared.json on the
// conc-recipe-hub `shared-library` branch. DOOR lays that file over the CODEX recipe list: new recipes are
// added, edits replace. A removal never takes a recipe off the CODEX list (CODEX tablets keep their built-in
// recipes on a removal too). DOOR reads only each record's `door` block; a record without one (written
// before this change) is left out so the CODEX list's version stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
const core = between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */');
const sb = vm.createContext({});
vm.runInContext(core + '\nglobalThis.overlay = doorOverlaySharedRecipes; globalThis.one = doorSharedDoorRecord;', sb);
const J = v => JSON.parse(JSON.stringify(v));

const BASE = [
  { recipeName: 'Couscous', allergens: ['Gluten'], category: 'veg_side', stream: 'vegan', recipeId: 'couscous' },
  { recipeName: 'Garlic Bread', allergens: ['Gluten (Bread)'], category: 'starch_side', stream: 'vegan', recipeId: 'garlic-bread' },
  { recipeName: 'Beef Stew', allergens: ['Gluten (Flour)'], category: 'stew_main', stream: 'regular', recipeId: 'beef-stew' }
];
const door = (recipeName, extra) => Object.assign({ recipeName, allergens: [], category: 'spice', stream: 'regular' }, extra || {});

test('a new recipe is added, an edit replaces, a removal keeps the CODEX list recipe', () => {
  const shared = { _meta: { generated: '2026-10-14T12:00:00.000Z' }, recipes: [
    { recipeName: 'Couscous', door: door('Couscous', { allergens: ['Gluten', 'Nightshades (Peppers)'], category: 'veg_side', stream: 'vegan' }) },
    { recipeName: 'Beef Stew', removed: true, savedAt: '2026-10-14T12:00:00.000Z' },
    { recipeName: 'Southeast Asian Spice Mix', door: door('Southeast Asian Spice Mix', { allergens: ['Spicy (Chili)'] }) }
  ] };
  const out = J(sb.overlay(BASE, shared));
  assert.deepEqual(out.list.map(r => r.recipeName), ['Couscous', 'Garlic Bread', 'Beef Stew', 'Southeast Asian Spice Mix']);
  assert.deepEqual(out.list[0].allergens, ['Gluten', 'Nightshades (Peppers)']);
  assert.deepEqual(out.receipt.added, ['Southeast Asian Spice Mix']);
  assert.deepEqual(out.receipt.replaced, ['Couscous']);
  assert.equal(out.receipt.generated, '2026-10-14T12:00:00.000Z');
});

// Option C (Jason, 2026-10-14: "go with C"): an allergen comes off DOOR's list only when its removal was
// confirmed where the recipe was saved (door.removedAllergens). A shorter list without that confirmation —
// an old copy shared from a forgotten tablet — never strips a warning.
test('an unconfirmed shorter allergen list keeps the warning; a confirmed removal drops it', () => {
  const base = [{ recipeName: 'Garlic Bread', allergens: ['Gluten (Bread)', 'Milk (Butter)'], category: 'starch_side', stream: 'regular', recipeId: 'garlic-bread' }];
  const plain = J(sb.overlay(base, { recipes: [{ recipeName: 'Garlic Bread', door: door('Garlic Bread', { allergens: ['Gluten (Bread)'], category: 'starch_side' }) }] }));
  assert.deepEqual(plain.list[0].allergens, ['Gluten (Bread)', 'Milk (Butter)'], 'no confirmation: Milk stays');
  assert.deepEqual(plain.receipt.keptAllergens, [{ recipe: 'Garlic Bread', allergens: ['Milk (Butter)'] }]);
  assert.deepEqual(plain.receipt.unchanged, ['Garlic Bread'], 'keeping Milk leaves the recipe as it was');
  const confirmed = J(sb.overlay(base, { recipes: [{ recipeName: 'Garlic Bread', door: door('Garlic Bread', { allergens: ['Gluten (Bread)'], category: 'starch_side', removedAllergens: ['milk'] }) }] }));
  assert.deepEqual(confirmed.list[0].allergens, ['Gluten (Bread)'], 'confirmed (any case): Milk drops');
  assert.deepEqual(confirmed.receipt.keptAllergens, []);
  assert.deepEqual(confirmed.receipt.replaced, ['Garlic Bread']);
});

test('families compare by the name before " ("; a kept allergen replaces a shared None; a new recipe takes its list', () => {
  const base = [
    { recipeName: 'Couscous', allergens: ['Gluten'], category: 'veg_side', stream: 'vegan' },
    { recipeName: 'Yams', allergens: ['Sesame (Seeds)'], category: 'veg_side', stream: 'vegan' },
    { recipeName: 'Rice', allergens: ['None'], category: 'starch_side', stream: 'vegan' }
  ];
  const out = J(sb.overlay(base, { recipes: [
    { recipeName: 'Couscous', door: door('Couscous', { allergens: ['Gluten (Wheat)'], category: 'veg_side', stream: 'vegan' }) },
    { recipeName: 'Yams', door: door('Yams', { allergens: ['None'], category: 'veg_side', stream: 'vegan' }) },
    { recipeName: 'Rice', door: door('Rice', { allergens: [], category: 'starch_side', stream: 'vegan' }) },
    { recipeName: 'New Mix', door: door('New Mix', { allergens: ['Spicy (Chili)'], removedAllergens: ['Milk'] }) }
  ] }));
  const by = Object.fromEntries(out.list.map(r => [r.recipeName, r.allergens]));
  assert.deepEqual(by['Couscous'], ['Gluten (Wheat)'], 'the same family named another way is not a removal');
  assert.deepEqual(by['Yams'], ['Sesame (Seeds)'], 'a kept allergen replaces None');
  assert.deepEqual(by['Rice'], [], 'None is not an allergen to keep');
  assert.deepEqual(by['New Mix'], ['Spicy (Chili)']);
});

test('a shared copy identical to the list counts as unchanged, not updated', () => {
  const shared = { recipes: [{ recipeName: 'Garlic Bread', door: door('Garlic Bread', { allergens: ['Gluten (Bread)'], category: 'starch_side', stream: 'vegan' }) }] };
  const out = J(sb.overlay(BASE, shared));
  assert.deepEqual(out.receipt.unchanged, ['Garlic Bread']);
  assert.deepEqual(out.receipt.replaced, []);
  assert.deepEqual(out.list, BASE);
});

test('a record without a door block is left out and the CODEX version stands', () => {
  const shared = { recipes: [{ recipeName: 'Garlic Bread', allergens: ['Gluten (Bread)', 'Milk (Butter)'], tags: { stream: 'regular' } }] };
  const out = J(sb.overlay(BASE, shared));
  assert.deepEqual(out.list, BASE);
  assert.deepEqual(out.receipt.skipped, ['Garlic Bread']);
});

test('a malformed door block is refused, never half-applied', () => {
  for (const bad of [
    { recipeName: '', allergens: [], category: 'spice', stream: 'regular' },
    { recipeName: 'X', allergens: 'Gluten', category: 'spice', stream: 'regular' },
    { recipeName: 'X', allergens: [1], category: 'spice', stream: 'regular' },
    { recipeName: 'X', allergens: [], category: '', stream: 'regular' },
    ['X']
  ]) assert.equal(sb.one({ recipeName: 'X', door: bad }), null, JSON.stringify(bad));
  assert.equal(sb.one({ recipeName: 'X', removed: true, door: door('X') }), null, 'a tombstone is never a recipe');
});

test('only an explicit vegan stream is vegan', () => {
  assert.equal(sb.one({ recipeName: 'X', door: door('X', { stream: 'vegan' }) }).stream, 'vegan');
  for (const s of ['halal', 'all', '', undefined, 'VEGAN ']) assert.equal(sb.one({ recipeName: 'X', door: door('X', { stream: s }) }).stream, 'regular', String(s));
});

test('a recipe keeps its recipeId; a rename adds the new name and leaves the old one', () => {
  const shared = { recipes: [
    { recipeName: 'couscous', door: door('Couscous', { category: 'veg_side', stream: 'vegan', recipeId: 'other-id' }) },
    { recipeName: 'Garlic Bread', removed: true },
    { recipeName: 'Garlic Toast', previousNames: ['Garlic Bread'], door: door('Garlic Toast', { category: 'starch_side' }) },
    { recipeName: 'Brand New', door: door('Brand New', { recipeId: 'brand-new' }) }
  ] };
  const out = J(sb.overlay(BASE, shared));
  const by = Object.fromEntries(out.list.map(r => [r.recipeName, r]));
  assert.equal(by['Couscous'].recipeId, 'couscous', 'names match without case and the existing id wins');
  assert.equal(by['Garlic Toast'].recipeId, undefined, 'the new name never takes an id the old name still holds');
  assert.equal(by['Garlic Bread'].recipeId, 'garlic-bread', 'menu slots that name the old recipe still find it');
  assert.equal(by['Brand New'].recipeId, 'brand-new');
});

test('the inputs are never mutated and junk inputs give the base back', () => {
  const base = J(BASE);
  const shared = { recipes: [{ recipeName: 'Couscous', door: door('Couscous', { allergens: ['Gluten', 'Milk'] }) }] };
  const sharedCopy = J(shared);
  const out = sb.overlay(base, shared);
  out.list[0].allergens.push('Eggs');
  assert.deepEqual(base, BASE);
  assert.deepEqual(shared, sharedCopy);
  for (const junk of [null, undefined, {}, { recipes: 'x' }, { recipes: [null, 5, 'x', { removed: true }] }]) {
    assert.deepEqual(J(sb.overlay(BASE, junk)).list, BASE, JSON.stringify(junk));
  }
  assert.deepEqual(J(sb.overlay(null, null)).list, []);
});

test('the loader reads the public projection, rebuilds from both inputs, and keeps an offline copy', () => {
  assert.match(html, /const DOOR_SHARED_LIBRARY_URL = 'https:\/\/kennedyjasondavid-eng\.github\.io\/conc-recipe-hub\/library_public\.json';/);
  const loader = between('(async function loadSharedLibrary() {', '\n})();');
  assert.match(loader, /\?_=' \+ Date\.now\(\)/, 'cache-busted');
  assert.match(loader, /cache: 'no-store'/, 'no-store');
  assert.match(loader, /door_shared_library_cache/, 'offline copy');
  assert.match(loader, /_doorApplySharedRecipes\(\)/);
  const recipes = between('(async function loadRecipeData() {', '\n})();');
  assert.ok(!/DOOR_RECIPE_DATA = /.test(recipes), 'the CODEX list is kept as the base, never assigned straight to DOOR_RECIPE_DATA');
  assert.equal((recipes.match(/_doorApplySharedRecipes\(\)/g) || []).length, 3, 'live, cached and offline paths all rebuild');
  const apply = between('function _doorApplySharedRecipes() {', '\n}\n');
  assert.match(apply, /DOOR_RECIPE_DATA = out\.list/);
});
