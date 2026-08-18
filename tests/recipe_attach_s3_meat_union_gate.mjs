// Recipe-attach S3 — meat/halal two-site union + allergen-coverage + guard-#3 banner.
// Food-safety slice: a bound + renamed dish must never UNDER-flag. Extracts the REAL
// save-time meat detector, the S0.5 allergen resolver, and the baked feed from index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function braceBlock(startIdx) {
  let depth = 0, i = html.indexOf('{', startIdx);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return html.length;
}
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  return html.slice(start, braceBlock(start));
}
function assertContains(hay, needle, msg) { assert.ok(hay.includes(needle), msg + ' — missing: ' + needle); }

// ---- the save-time meat detector (MEAT_DETECT const + the nested _detectInSlot) ----
const meatStart = html.indexOf('const MEAT_DETECT = [');
const detectStart = html.indexOf('function _detectInSlot(', meatStart);
const meatBlock = html.slice(meatStart, html.indexOf(';', meatStart) + 1) + '\n' + html.slice(detectStart, braceBlock(detectStart));

function meatCtx(state) {
  const ctx = { MEAL_SLOT_STATE: state };
  vm.createContext(ctx);
  vm.runInContext(meatBlock, ctx, { filename: 'index.html#meat-detect', timeout: 1000 });
  return ctx;
}
// spread the vm-realm result into a test-realm array before map/sort/deepEqual
const flagsOf = (ctx, slotId) => [...ctx._detectInSlot(slotId)].map(m => m.flag).sort();

test('two-site meat union: a meat word in the DISPLAY (not the recipe name) is still detected at save', () => {
  // recipe name has no meat word; the operator-typed display does → must flag (additive)
  const c = meatCtx({ main: { recipeName: 'Meatloaf', displayText: 'Pork & Beef Meatloaf', flags: {} } });
  // "meatloaf" already implies beef via MEAT_DETECT; the DISPLAY adds pork
  assert.ok(flagsOf(c, 'main').includes('hasPork'), 'pork named only in the display is caught at save');
  assert.ok(flagsOf(c, 'main').includes('hasBeef'), 'beef (from "meatloaf") still caught');
});

test('two-site meat union: a meat word in the RECIPE NAME survives a display that drops it', () => {
  // the motivating case inverted: recipe carries the protein, display renames it away
  const c = meatCtx({ main: { recipeName: 'Pork Al Pastor', displayText: 'Al Pastor Tacos', flags: {} } });
  assert.deepEqual(flagsOf(c, 'main'), ['hasPork'], 'pork from the recipe name is caught even when the display omits it');
});

test('detection is additive/name-only: no meat word anywhere → no meat flag', () => {
  const c = meatCtx({ main: { recipeName: 'Chickpea Curry', displayText: 'Chana Masala', flags: {} } });
  assert.deepEqual(flagsOf(c, 'main'), [], 'a vegan dish + vegan rename flags no meat');
  // a manual (unbound) slot: still reads manual text
  const c2 = meatCtx({ main: { manual: 'Turkey Club', flags: {} } });
  assert.deepEqual(flagsOf(c2, 'main'), ['hasTurkey'], 'manual text is still scanned');
});

test('guard #3 coverage: every allergen label in the BAKED feed maps to a flag (no silent drop)', () => {
  // extract the S0.5 resolver
  const rs = html.indexOf('const HUB_ALLERGEN_MAP = {');
  const re = html.indexOf('// ── Slot rendering', rs);
  const resolver = html.slice(rs, re);
  // extract the baked fallback (const → attach to context via `this`)
  const fs2 = html.indexOf('const DOOR_RECIPE_DATA_FALLBACK');
  const fe2 = html.indexOf('let DOOR_RECIPE_DATA =', fs2);
  const fallback = html.slice(fs2, fe2) + '\nthis.__FB = DOOR_RECIPE_DATA_FALLBACK;';
  const FLAG_KEYS = ['hasGluten','hasDairy','hasPeanuts','hasFish','hasEgg','hasSoy','hasSesame','hasMustard','hasTreeNuts','hasCoconut','hasCorn','hasSulphites','isSpicy','hasNightshades','hasShellfish'];
  const ctx = { console: { warn() {} }, window: {}, FLAG_DEFS: FLAG_KEYS.map(k => ({ key: k })), DOOR_RECIPE_DATA: [] };
  vm.createContext(ctx);
  vm.runInContext(resolver + '\n' + fallback, ctx, { filename: 'index.html#s3-coverage', timeout: 2000 });
  ctx.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__.clear();
  for (const r of ctx.__FB) ctx.hubAllergenToFlags(r.allergens || []);
  const surfaced = [...ctx.window.__DOOR_UNMAPPED_ALLERGEN_LABELS__];
  assert.deepEqual(surfaced, [], 'no baked allergen label is unmapped/silently dropped: ' + JSON.stringify(surfaced));
});

test('guard #3 banner renders the unmapped labels and hides when none', () => {
  const el = { style: {}, innerHTML: '' };
  const ctx = {
    document: { getElementById: (id) => (id === 'mc-unmapped-allergen-banner' ? el : null) },
    escapeHtml: (s) => String(s),
    _hubUnmappedLabels: new Set(),
  };
  vm.createContext(ctx);
  vm.runInContext(fnBlock('renderUnmappedAllergenBanner'), ctx, { timeout: 1000 });
  ctx.renderUnmappedAllergenBanner();
  assert.equal(el.style.display, 'none', 'no unmapped labels → banner hidden');
  ctx._hubUnmappedLabels.add('lupin');
  ctx.renderUnmappedAllergenBanner();
  assert.equal(el.style.display, 'block', 'an unmapped label → banner shown');
  assertContains(el.innerHTML, 'lupin', 'the offending label is named');
  assertContains(el.innerHTML, 'under-flag', 'the banner states the risk');
});

test('source locks: _detectInSlot reads displayText; the banner is wired', () => {
  assertContains(fnBlock('_detectInSlot'), 's.displayText', '_detectInSlot scans the display rename (two-site union)');
  // banner reads the S0.5 surface and is called in the menu render flow
  assertContains(fnBlock('renderUnmappedAllergenBanner'), '_hubUnmappedLabels', 'banner reads the unmapped-label surface');
  assertContains(html, 'renderUnmappedAllergenBanner();', 'banner is invoked in the render flow');
});
