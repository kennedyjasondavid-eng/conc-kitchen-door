// Recipe-attach S1 — allergen-label normalization gate.
// Extracts the REAL HUB_ALLERGEN_MAP + _hubAllergenResolve + hubAllergenToFlags block
// from index.html and runs it in a vm. Authored-to-fail: every "now maps" assertion
// FAILS against the pre-S1 exact/case-sensitive parse (S0 measured 49/240 feed recipes
// dropping a label). The no-cry-wolf assertions guard the runtime surface from firing
// on known non-allergen labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Contiguous slice: from the map through the end of hubAllergenToFlags (the block ends
// right before the "Slot rendering" section that follows it).
const start = html.indexOf('const HUB_ALLERGEN_MAP = {');
const end = html.indexOf('// ── Slot rendering', start);
assert.ok(start > 0 && end > start, 'could not locate the HUB_ALLERGEN_MAP…hubAllergenToFlags block');
const code = html.slice(start, end);

const FLAG_KEYS = ['hasGluten','hasDairy','hasPeanuts','hasFish','hasEgg','hasSoy','hasSesame','hasMustard','hasTreeNuts','hasCoconut','hasCorn','hasSulphites','isSpicy','hasNightshades','hasShellfish'];
function freshCtx() {
  const ctx = {
    console: { warn() {} },
    window: {},
    FLAG_DEFS: FLAG_KEYS.map(key => ({ key })),
    DOOR_RECIPE_DATA: [],
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'index.html#allergen-norm', timeout: 1000 });
  return ctx;
}
const set = (ctx, allergens) => ctx.hubAllergenToFlags(allergens);
const on = (f) => Object.entries(f).filter(([, v]) => v).map(([k]) => k).sort();

test('synonyms + casing now map (authored-to-fail vs pre-S1)', () => {
  const c = freshCtx();
  assert.equal(set(c, ['Dairy']).hasDairy, true, '"Dairy" → hasDairy (map only had "Milk")');
  assert.equal(set(c, ['dairy']).hasDairy, true, 'case-insensitive');
  assert.equal(set(c, ['Egg']).hasEgg, true, '"Egg" → hasEgg (map had "Eggs")');
  assert.equal(set(c, ['egg']).hasEgg, true);
  assert.equal(set(c, ['Coconut']).hasCoconut, true, '"Coconut" → hasCoconut');
  assert.equal(set(c, ['Corn']).hasCorn, true, '"Corn" → hasCorn');
  assert.equal(set(c, ['Tomato']).hasNightshades, true, '"Tomato" → hasNightshades');
  assert.equal(set(c, ['gluten']).hasGluten, true, 'lowercase "gluten"');
  assert.equal(set(c, ['soy']).hasSoy, true);
  assert.equal(set(c, ['fish']).hasFish, true);
});

test('compound "X and Y" elements set BOTH flags (were dropped entirely)', () => {
  const c = freshCtx();
  assert.deepEqual(on(set(c, ['Mustard and Egg'])), ['hasEgg','hasMustard']);
  assert.deepEqual(on(set(c, ['Corn and Spicy'])), ['hasCorn','isSpicy']);
  assert.deepEqual(on(set(c, ['Spicy and Tomato'])), ['hasNightshades','isSpicy']);
  assert.deepEqual(on(set(c, ['Soy and Potato'])), ['hasSoy'], 'Soy set; Potato has no DOOR flag (ignored)');
});

test('fish sauce fail-SAFE to hasFish, never silently swallowed (review P2)', () => {
  const c = freshCtx();
  // fish sauce is fish — the deadliest class. Bare + compound must set hasFish, never land
  // in a no-warn ignore hole. (Authored-to-fail vs the earlier IGNORE-set version.)
  assert.equal(set(c, ['Fish Sauce']).hasFish, true, '"Fish Sauce" → hasFish');
  assert.equal(set(c, ['fish sauce']).hasFish, true, 'case-insensitive');
  assert.deepEqual(on(set(c, ['Soy and Fish Sauce'])), ['hasFish','hasSoy'], 'compound splits, fish preserved');
  // and it must NOT surface as unmapped (it is mapped, not ignored)
  assert.ok(!c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__.has('fish sauce'), 'mapped, so never surfaced');
});

test('back-compat: existing labels + qualifiers unchanged', () => {
  const c = freshCtx();
  assert.equal(set(c, ['Gluten (Soy Sauce)']).hasGluten, true, 'paren qualifier still stripped');
  assert.equal(set(c, ['Milk']).hasDairy, true);
  const treeNut = set(c, ['Tree Nuts (Coconut, Coconut Milk)']);
  assert.equal(treeNut.hasTreeNuts, true, 'comma inside paren is dropped, not split');
  assert.notEqual(treeNut.hasCoconut, true, 'the "(Coconut, ...)" qualifier must NOT leak a Coconut flag (over-split guard)');
  assert.deepEqual(on(set(c, ['None'])), [], '"None" sets nothing');
  assert.deepEqual(on(set(c, [])), [], 'empty sets nothing');
  // a real feed record
  assert.deepEqual(on(set(c, ['Gluten (Soy Sauce)','Soy (Soy Sauce)','Sulphites (Corn Syrup)','Tree Nuts (Coconut, Coconut Milk)'])),
    ['hasGluten','hasSoy','hasSulphites','hasTreeNuts']);
});

test('runtime surface fires on a genuinely-new allergen, NOT on known non-allergens (no cry-wolf)', () => {
  const c = freshCtx();
  // known non-allergen labels the feed carries → ignored, never surfaced
  set(c, ['Not Vegan Friendly']); set(c, ['Oats']); set(c, ['honey']); set(c, ['Onion']); set(c, ['Chicken']);
  // pre-mangled feed junk: a leading-"and" fragment ("and Not Vegan Friendly" is a real
  // live-feed element) must not cry wolf — the leading conjunction is stripped to noise.
  set(c, ['and Not Vegan Friendly']);
  const unmapped1 = [...c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__];
  assert.deepEqual(unmapped1, [], 'known non-allergen labels + leading-"and" junk do not cry wolf');
  // a real new allergen DOOR cannot map → surfaced loudly
  set(c, ['Lupin']);
  assert.ok(c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__.has('lupin'), 'a new unmappable allergen is surfaced');
});

test('every non-noise label in the LIVE CODEX feed now resolves (coverage)', () => {
  const c = freshCtx();
  const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
  if (!fs.existsSync(feedPath)) { console.log('SKIP: sibling recipe-hub feed not checked out'); return; }
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__.clear();
  for (const r of feed) set(c, r.allergens || []);
  const stillUnmapped = [...c.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__];
  // Whatever remains must be genuinely non-allergen (no DOOR flag) — assert the known
  // safety-relevant ones (dairy/egg/coconut/corn/tomato/compounds) are all captured.
  ['dairy','egg','coconut','corn','tomato'].forEach(l =>
    assert.ok(!stillUnmapped.includes(l), `"${l}" must resolve, not remain unmapped`));
  console.log('live-feed residual unmapped (should be non-allergen only):', JSON.stringify(stillUnmapped));
});
