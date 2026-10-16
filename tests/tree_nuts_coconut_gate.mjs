// tests/tree_nuts_coconut_gate.mjs — a Tree Nuts label that names coconut ticks Coconut (2026-10-16, v31-standard.28).
// CODEX writes coconut on 12 recipes only as a Tree Nuts label ("Tree Nuts (Coconut, Coconut Milk)"). The resolver
// takes the text before "(" as the family, so linking one of those recipes set hasTreeNuts but never hasCoconut, and a
// No Coconut resident (RESIDENT_TO_MEAL_FLAG → hasCoconut) was not warned. Jason, 2026-10-16 ("Go ahead with both"):
// a Tree Nuts label whose detail names coconut also sets Coconut. It only ever adds a warning.
// Runs the REAL HUB_ALLERGEN_MAP … hubAllergenToFlags block and _allergenPreview from index.html in a vm.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const resolver = between('const HUB_ALLERGEN_MAP = {', '// ── Slot rendering');
const fallback = between('const DOOR_RECIPE_DATA_FALLBACK', 'let DOOR_RECIPE_DATA =') + '\nthis.__FB = DOOR_RECIPE_DATA_FALLBACK;';

const FLAG_KEYS = ['hasGluten','hasDairy','hasPeanuts','hasFish','hasEgg','hasSoy','hasSesame','hasMustard','hasTreeNuts','hasCoconut','hasCorn','hasSulphites','isSpicy','hasNightshades','hasShellfish'];
function freshCtx() {
  const ctx = { console: { warn() {} }, window: {}, FLAG_DEFS: FLAG_KEYS.map(key => ({ key })), DOOR_RECIPE_DATA: [] };
  vm.createContext(ctx);
  vm.runInContext(resolver + '\n' + fn('_allergenPreview') + '\n' + fallback, ctx, { filename: 'index.html#tree-nuts-coconut', timeout: 2000 });
  return ctx;
}
const on = (f) => Object.entries(f).filter(([, v]) => v).map(([k]) => k).sort();
const flags = (c, a) => on(c.hubAllergenToFlags(a));
const namesCoconut = (list) => (list || []).some(a => /coconut/i.test(String(a)));
const withoutDetail = (list) => (list || []).map(a => (a == null ? a : String(a).split('(')[0]));

test('a Tree Nuts label whose detail names coconut sets Tree Nuts AND Coconut', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['Tree Nuts (Coconut, Coconut Milk)']), ['hasCoconut', 'hasTreeNuts']);
  assert.deepEqual(flags(c, ['Tree Nuts (Coconut)']), ['hasCoconut', 'hasTreeNuts']);
  assert.deepEqual(flags(c, ['Tree Nuts (Coconut, Coconut Oil)']), ['hasCoconut', 'hasTreeNuts']);
  assert.deepEqual(flags(c, ['Tree Nuts (Coconut, Coconut Milk, Coconut Oil)']), ['hasCoconut', 'hasTreeNuts']);
  assert.deepEqual(flags(c, ['Tree Nuts (Shredded Coconut Flakes)']), ['hasCoconut', 'hasTreeNuts'], 'coconut anywhere in the detail');
  assert.deepEqual(flags(c, ['tree nuts (coconut milk)']), ['hasCoconut', 'hasTreeNuts'], 'without case');
});

test('a Tree Nuts label that names no coconut stays Tree Nuts only', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['Tree Nuts (Almonds)']), ['hasTreeNuts']);
  assert.deepEqual(flags(c, ['Tree Nuts (Cashews, Almonds)']), ['hasTreeNuts']);
  assert.deepEqual(flags(c, ['Tree Nuts']), ['hasTreeNuts']);
});

test('bare Coconut, None and empty behave as before', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['Coconut']), ['hasCoconut'], 'a bare Coconut label is Coconut only');
  assert.deepEqual(flags(c, ['coconut']), ['hasCoconut']);
  assert.deepEqual(flags(c, ['Coconut', 'Tree Nuts (Coconut)']), ['hasCoconut', 'hasTreeNuts'], 'both labels: no double, no loss');
  assert.deepEqual(flags(c, ['None']), [], '"None" sets nothing');
  assert.deepEqual(flags(c, []), []);
  assert.deepEqual(flags(c, null), []);
});

test('compounds, qualifiers and the unmapped surface are unchanged', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['Gluten (Soy Sauce)', 'Soy (Soy Sauce)', 'Sulphites (Corn Syrup)', 'Tree Nuts (Coconut, Coconut Milk)']),
    ['hasCoconut', 'hasGluten', 'hasSoy', 'hasSulphites', 'hasTreeNuts'], 'the Adobo record');
  assert.deepEqual(flags(c, ['Spicy and Tree Nuts (Coconut)']), ['hasCoconut', 'hasTreeNuts', 'isSpicy'], 'compound split, then the detail');
  assert.deepEqual(flags(c, ['Gluten (Soy Sauce)']), ['hasGluten'], 'another family\'s detail is still dropped');
  c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__.clear();
  flags(c, ['Tree Nuts (Coconut, Coconut Milk)', 'Tree Nuts (Almonds)']);
  assert.deepEqual([...c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__], [], 'the detail never cries wolf on the unmapped surface');
  flags(c, ['Lupin']);
  assert.ok(c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__.has('lupin'), 'a genuinely new allergen is still surfaced');
});

test('the editor preview shows coconut, because it reads the same resolver', () => {
  const c = freshCtx();
  assert.ok(c._hubAllergenResolve(['Tree Nuts (Coconut, Coconut Milk)']).labels.has('coconut'), 'labels carry coconut');
  const preview = c._allergenPreview(['Tree Nuts (Coconut, Coconut Milk)']);
  assert.match(preview, />coconut</, 'preview chip for coconut');
  assert.match(preview, />tree nuts</, 'preview chip for tree nuts');
  assert.doesNotMatch(c._allergenPreview(['Tree Nuts (Almonds)']), /coconut/, 'no coconut chip without coconut');
});

function coverage(c, recipes, where) {
  const named = recipes.filter(r => namesCoconut(r.allergens));
  for (const r of named) assert.equal(c.hubAllergenToFlags(r.allergens || []).hasCoconut, true, where + ': ' + r.recipeName + ' ' + JSON.stringify(r.allergens));
  // Only adds: with every "(…)" detail removed the flags are the family parse alone (the old rule); the new flags
  // are exactly those plus Coconut where a Tree Nuts detail names it.
  for (const r of recipes) {
    const now = c.hubAllergenToFlags(r.allergens || []);
    const base = c.hubAllergenToFlags(withoutDetail(r.allergens));
    for (const k of FLAG_KEYS) if (k !== 'hasCoconut') assert.equal(now[k], base[k], where + ': ' + r.recipeName + ' ' + k + ' unchanged');
    if (base.hasCoconut) assert.equal(now.hasCoconut, true, where + ': ' + r.recipeName + ' keeps Coconut');
    if (!namesCoconut(r.allergens)) assert.equal(now.hasCoconut, base.hasCoconut, where + ': ' + r.recipeName + ' gains no Coconut it does not name');
  }
  return named.length;
}

test('every recipe in the baked fallback that names coconut sets Coconut, and nothing else moves', () => {
  const c = freshCtx();
  const n = coverage(c, c.__FB, 'baked');
  assert.ok(n >= 10, 'the baked list names coconut on at least 10 recipes: ' + n);
});

test('every recipe in the CODEX feed that names coconut sets Coconut, and nothing else moves', () => {
  const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
  if (!fs.existsSync(feedPath)) { console.log('SKIP: sibling recipe-hub feed not checked out'); return; }
  const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  const feed = Array.isArray(raw) ? raw : (raw.recipes || []);
  const n = coverage(freshCtx(), feed, 'feed');
  assert.ok(n >= 12, 'the feed names coconut on at least 12 recipes: ' + n);
});

test('the resolver carries the dated ruling', () => {
  assert.match(fn('_hubAllergenResolve'), /2026-10-16/, 'dated comment in _hubAllergenResolve');
});
