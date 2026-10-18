// tests/shellfish_families_gate.mjs — CODEX's Crustaceans and Molluscs labels tick Shellfish (2026-10-18, v31-standard.30).
// CODEX's ALLERGEN_DB files shrimp/prawn/crab/lobster/krill under 'Crustaceans' and clams/mussels/oysters/scallops/squid
// under 'Molluscs', so Check & save writes "Crustaceans (Shellfish)" / "Molluscs (Molluscs)", and two CODEX templates
// (Thai Basil Chicken, Bò Lúc Lắc) already carry "Molluscs (Oyster Sauce)". Since 2026-10-14 a Save on a connected tablet
// is canon and its `door` block brings those labels here. HUB_ALLERGEN_MAP had 'Shellfish' only, so linking such a recipe
// set no hasShellfish — only an "unmapped label" warning — and a No Shellfish or No Molluscs resident
// (RESIDENT_TO_MEAL_FLAG → hasShellfish) was not warned. Both families now read as Shellfish. It only ever adds a warning.
// Runs the REAL HUB_ALLERGEN_MAP … hubAllergenToFlags block, _allergenPreview and checkResidentMealConflicts from
// index.html in a vm. Authored to fail on main 910fb7c and 0aedaf0 (v31-standard.29).
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
// The resolver as it was before this change: the same block without the two family entries.
const resolverBefore = resolver.replace(/'(Crustaceans|Molluscs)':'hasShellfish',?/g, '');
const residents = between('const RESIDENT_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n'
  + between('const ROUTING_TAGS = new Set([', ']);') + ']);\n' + fn('checkResidentMealConflicts');
const fallback = between('const DOOR_RECIPE_DATA_FALLBACK', 'let DOOR_RECIPE_DATA =') + '\nthis.__FB = DOOR_RECIPE_DATA_FALLBACK;';

const FLAG_KEYS = ['hasGluten','hasDairy','hasPeanuts','hasFish','hasEgg','hasSoy','hasSesame','hasMustard','hasTreeNuts','hasCoconut','hasCorn','hasSulphites','isSpicy','hasNightshades','hasShellfish'];
function freshCtx(block) {
  const ctx = { console: { warn() {} }, window: {}, FLAG_DEFS: FLAG_KEYS.map(key => ({ key })), DOOR_RECIPE_DATA: [] };
  vm.createContext(ctx);
  vm.runInContext((block || resolver) + '\n' + fn('_allergenPreview') + '\n' + residents + '\n' + fallback
    + '\nthis.__R2M = RESIDENT_TO_MEAL_FLAG;', ctx, { filename: 'index.html#shellfish-families', timeout: 2000 });
  return ctx;
}
const on = (f) => Object.entries(f).filter(([, v]) => v).map(([k]) => k).sort();
const flags = (c, a) => on(c.hubAllergenToFlags(a));
const namesShellfishFamily = (list) => (list || []).some(a => /^\s*(crustaceans?|molluscs?)\b/i.test(String(a).split('(')[0]));

test('CODEX\'s Crustaceans and Molluscs labels set Shellfish, and only Shellfish', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['Crustaceans (Shrimp)']), ['hasShellfish']);
  assert.deepEqual(flags(c, ['Molluscs (Mussels)']), ['hasShellfish']);
  assert.deepEqual(flags(c, ['Crustaceans (Shellfish)']), ['hasShellfish'], 'what Check & save writes for shrimp');
  assert.deepEqual(flags(c, ['Molluscs (Molluscs)']), ['hasShellfish'], 'what Check & save writes for mussels');
  assert.deepEqual(flags(c, ['Molluscs (Oyster Sauce)']), ['hasShellfish'], 'the two CODEX templates');
  assert.deepEqual(flags(c, ['Crustaceans']), ['hasShellfish'], 'no detail');
  assert.deepEqual(flags(c, ['Molluscs']), ['hasShellfish'], 'no detail');
  assert.deepEqual(flags(c, ['Crustaceans (Shrimp)', 'Molluscs (Mussels)']), ['hasShellfish'], 'both families: one flag');
});

test('case, compounds and the rest of a CODEX list', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['crustaceans (prawns)']), ['hasShellfish'], 'without case');
  assert.deepEqual(flags(c, ['MOLLUSCS (SCALLOPS)']), ['hasShellfish'], 'without case');
  assert.deepEqual(flags(c, ['Fish and Crustaceans']), ['hasFish', 'hasShellfish'], 'a compound splits');
  assert.deepEqual(flags(c, ['Soy (Soy Sauce)', 'Gluten (Soy Sauce, Oyster Sauce)', 'Fish (Fish Sauce, Oyster Sauce)',
    'Molluscs (Oyster Sauce)', 'Nightshades (Thai Chilies)', 'Spicy (Thai Chilies)']),
    ['hasFish', 'hasGluten', 'hasNightshades', 'hasShellfish', 'hasSoy', 'isSpicy'], 'the Thai Basil Chicken template\'s list');
});

test('Shellfish, Fish, None and empty behave as before', () => {
  const c = freshCtx();
  assert.deepEqual(flags(c, ['Shellfish']), ['hasShellfish']);
  assert.deepEqual(flags(c, ['Shellfish (Shrimp)']), ['hasShellfish']);
  assert.deepEqual(flags(c, ['Fish (Fish Sauce)']), ['hasFish'], 'fish is its own flag');
  assert.deepEqual(flags(c, ['Gluten (Shrimp Chips)']), ['hasGluten'], 'another family\'s detail is still dropped');
  assert.deepEqual(flags(c, ['None']), []);
  assert.deepEqual(flags(c, []), []);
  assert.deepEqual(flags(c, null), []);
});

test('the unmapped-label surface stays quiet for both families, and still names a label DOOR has no flag for', () => {
  const c = freshCtx();
  const surface = c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__;
  surface.clear();
  flags(c, ['Crustaceans (Shrimp)', 'Molluscs (Mussels)', 'crustaceans', 'MOLLUSCS (Oyster Sauce)']);
  assert.deepEqual([...surface], [], 'mapped, so never on the banner');
  flags(c, ['Lupin (Lupin)', 'Buckwheat (Buckwheat)']);
  assert.deepEqual([...surface].sort(), ['buckwheat', 'lupin'], 'families DOOR has no flag for are still surfaced');
});

test('the editor preview shows a chip for each family, because it reads the same resolver', () => {
  const c = freshCtx();
  const shrimp = c._allergenPreview(['Crustaceans (Shrimp)']);
  assert.match(shrimp, />crustaceans</, 'chip for crustaceans');
  assert.doesNotMatch(shrimp, /no priority allergens/, 'a shrimp recipe never previews as allergen-free');
  const mussels = c._allergenPreview(['Molluscs (Mussels)']);
  assert.match(mussels, />molluscs</, 'chip for molluscs');
  assert.doesNotMatch(mussels, /no priority allergens/);
});

test('a No Shellfish and a No Molluscs resident are warned on a meal flagged from a CODEX shrimp or mussel recipe', () => {
  const c = freshCtx();
  assert.equal(c.__R2M['No Shellfish'], 'hasShellfish', 'the resident side already reads hasShellfish');
  assert.equal(c.__R2M['No Molluscs'], 'hasShellfish', 'molluscs share the flag');
  // The vm's arrays have their own prototype: copy them out before a deep compare.
  const conflicts = (meal, resident) => [...c.checkResidentMealConflicts(meal, resident)].map(x => [x.tag, x.mealFlag]);
  for (const label of ['Crustaceans (Shrimp)', 'Molluscs (Mussels)']) {
    const meal = c.hubAllergenToFlags([label]);
    assert.deepEqual(conflicts(meal, { tags: ['No Shellfish'] }), [['No Shellfish', 'hasShellfish']], label + ': No Shellfish (a routing tag)');
    assert.deepEqual(conflicts(meal, { allergenFlags: ['No Molluscs'] }), [['No Molluscs', 'hasShellfish']], label + ': No Molluscs (an allergen flag)');
    assert.deepEqual(conflicts(meal, { tags: ['No Fish'] }), [], label + ': fish is a separate allergen');
  }
});

function onlyShellfishMoves(recipes, where) {
  const now = freshCtx(), before = freshCtx(resolverBefore);
  let named = 0;
  for (const r of recipes) {
    const a = now.hubAllergenToFlags(r.allergens || []), b = before.hubAllergenToFlags(r.allergens || []);
    for (const k of FLAG_KEYS) if (k !== 'hasShellfish') assert.equal(a[k], b[k], where + ': ' + r.recipeName + ' ' + k + ' unchanged');
    if (b.hasShellfish) assert.equal(a.hasShellfish, true, where + ': ' + r.recipeName + ' keeps Shellfish');
    if (namesShellfishFamily(r.allergens)) { named++; assert.equal(a.hasShellfish, true, where + ': ' + r.recipeName + ' ' + JSON.stringify(r.allergens)); }
    else assert.equal(a.hasShellfish, b.hasShellfish, where + ': ' + r.recipeName + ' gains no Shellfish it does not name');
  }
  return named;
}

test('only Shellfish moves: every recipe in the baked fallback and the CODEX feed', () => {
  const n = onlyShellfishMoves(freshCtx().__FB, 'baked');
  assert.equal(n, 0, 'no baked recipe names Crustaceans or Molluscs today');
  const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
  if (!fs.existsSync(feedPath)) { console.log('SKIP feed: sibling recipe-hub not checked out'); return; }
  const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  assert.equal(onlyShellfishMoves(Array.isArray(raw) ? raw : (raw.recipes || []), 'feed'), 0, 'no published recipe names them today');
});

// The families CODEX's reader (ALLERGEN_DB) writes, and what DOOR does with each. A family added to CODEX fails here by
// name until DOOR reads it (the HOUSE cross-repo rule); CODEX's one_allergen_source_gate P3c checks the same table.
const CODEX_FAMILY_FLAG = {
  'peanuts':'hasPeanuts', 'tree nuts':'hasTreeNuts', 'milk':'hasDairy', 'eggs':'hasEgg', 'fish':'hasFish',
  'crustaceans':'hasShellfish', 'molluscs':'hasShellfish', 'soy':'hasSoy', 'gluten':'hasGluten', 'sulphites':'hasSulphites',
  'mustard':'hasMustard', 'sesame':'hasSesame', 'nightshades':'hasNightshades', 'spicy':'isSpicy',
};
const CODEX_FAMILY_IGNORED = ['oats'];                 // a separate CODEX flag; DOOR ignores it on purpose
const CODEX_FAMILY_NO_DOOR_FLAG = ['lupin', 'buckwheat']; // DOOR has no flag: they stay on the unmapped banner

test('every family CODEX\'s reader writes reaches a DOOR flag; every CODEX label naming Crustaceans or Molluscs sets Shellfish', () => {
  const dataPath = path.resolve(root, '..', 'conc-recipe-hub', 'CONC_Recipe_Data.js');
  if (!fs.existsSync(dataPath)) { console.log('SKIP CODEX data layer: sibling recipe-hub not checked out'); return; }
  const data = {};
  vm.createContext(data);
  vm.runInContext(fs.readFileSync(dataPath, 'utf8') + '\nthis.DB = ALLERGEN_DB; this.PT = PROMPT_TEMPLATES; this.SEED = CONC_PRODUCTION_SEED;',
    data, { filename: 'CONC_Recipe_Data.js', timeout: 10000 });
  const families = [...new Set(data.DB.map(e => String(e.category).toLowerCase()))].sort();
  const known = Object.keys(CODEX_FAMILY_FLAG).concat(CODEX_FAMILY_IGNORED, CODEX_FAMILY_NO_DOOR_FLAG).sort();
  assert.deepEqual(families, known, 'CODEX\'s families are the ones this gate names');
  const c = freshCtx();
  const surface = c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__;
  for (const [f, key] of Object.entries(CODEX_FAMILY_FLAG)) {
    const label = data.DB.find(e => String(e.category).toLowerCase() === f);
    const written = label.category + ' (' + label.source + ')';
    assert.deepEqual(flags(c, [written]), [key], written);
  }
  surface.clear();
  for (const f of CODEX_FAMILY_IGNORED) assert.deepEqual(flags(c, [f]), [], f + ' sets nothing');
  assert.deepEqual([...surface], [], 'an ignored family never cries wolf');
  for (const f of CODEX_FAMILY_NO_DOOR_FLAG) { assert.deepEqual(flags(c, [f]), [], f); assert.ok(surface.has(f), f + ' is surfaced'); }

  // Every allergen list CODEX holds (seed + templates): one naming either family sets Shellfish, and nothing else moves.
  const lists = [];
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.allergens)) lists.push({ recipeName: o.recipeName || o.name || '?', allergens: o.allergens });
    for (const k in o) if (k !== 'allergens') walk(o[k]);
  };
  walk(data.SEED); walk(data.PT);
  assert.ok(lists.length > 500, 'CODEX holds the seed and its templates: ' + lists.length);
  const named = onlyShellfishMoves(lists, 'CODEX');
  assert.ok(named >= 2, 'at least the two oyster-sauce templates name Molluscs: ' + named);
});

test('the map carries the dated ruling', () => {
  assert.match(between('const HUB_ALLERGEN_MAP = {', '};'), /2026-10-18/, 'dated comment in HUB_ALLERGEN_MAP');
});
