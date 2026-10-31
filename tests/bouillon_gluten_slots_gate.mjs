// tests/bouillon_gluten_slots_gate.mjs — bouillon carries no Gluten (2026-10-18, menu data only).
// Jason, 2026-10-17: "no gluten in boullion we use currently". CODEX v22 (conc-recipe-hub PR #155) takes "Gluten
// (Bouillon)" off its recipes. Three vegan dishes linked in v31-standard.29 captured Gluten from that label at link time,
// and a linked dish keeps what it captured, so their plates would go on saying GLUTEN after CODEX changes:
// Vegetarian Peanut Stew (Wk2 MON dinner, African Peanut Chicken Stew), Vegetarian Vindaloo (Wk2 TUE dinner, Vegan
// Vindaloo) and Caribbean Chickpea Curry (Wk3 TUE dinner, Caribbean Stew). Their captured Gluten flag comes off; every
// other flag stays. Dishes whose Gluten has another source keep it: the falafel sandwiches (bread), White Chilli Pasta
// Casserole (pasta) and Vegan Arroz con Pollo (an Edit Menu tag set before it was linked).
// Authored to fail on 910fb7c (v31-standard.29).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const menu = JSON.parse(fs.readFileSync(path.join(root, 'menu_current.json'), 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync(path.join(root, 'menu_overlay.json'), 'utf8'));
const on = (f) => Object.keys(f || {}).filter((k) => f[k]).sort();

const DROPPED = [
  ['2', 'MONDAY', 'dinner', 'African Peanut Chicken Stew', ['hasCoconut', 'hasNightshades', 'hasPeanuts', 'hasSulphites', 'hasTreeNuts', 'isSpicy']],
  ['2', 'TUESDAY', 'dinner', 'Vegan Vindaloo', ['hasMustard', 'hasNightshades', 'isSpicy']],
  ['3', 'TUESDAY', 'dinner', 'Caribbean Stew with Sweet Potato and Collard Greens', ['hasBeans', 'hasCoconut', 'hasNightshades', 'hasSulphites', 'hasTreeNuts', 'isSpicy']],
];
const KEPT = [
  ['2', 'TUESDAY', 'lunch', 'Rexdale Falafel'],
  ['4', 'MONDAY', 'lunch', 'Rexdale Falafel'],
  ['4', 'SUNDAY', 'dinner', 'White Chicken & Chickpea Chili'],
  // Re-pinned 2026-10-30 (Rex's sheet is canon for placement): Arroz con Pollo is Wk2 THU dinner now.
  ['2', 'THURSDAY', 'dinner', 'Arroz Con Pollo (Regular + Vegan)'],
];
const slotIn = (src, wk, day, period) => (((src[wk] || {})[day] || {})[period + '_slots'] || {}).veganalt || null;

test('the three dishes linked to a bouillon recipe no longer carry its Gluten, and keep every other flag', () => {
  for (const [label, src] of [['menu_current.json', menu], ['menu_overlay.json', overlay]]) {
    for (const [wk, day, period, recipe, rest] of DROPPED) {
      const va = slotIn(src, wk, day, period);
      assert.ok(va && va.recipeName === recipe, `${label} Wk${wk} ${day} ${period}: linked to ${recipe}`);
      assert.deepEqual(on(va.flags), rest, `${label} Wk${wk} ${day} ${period}: flags`);
    }
  }
});

test('dishes whose Gluten has another source keep it (bread, pasta, an Edit Menu tag)', () => {
  for (const [wk, day, period, recipe] of KEPT) {
    const va = slotIn(menu, wk, day, period);
    assert.ok(va && va.recipeName === recipe, `Wk${wk} ${day} ${period}: linked to ${recipe}`);
    assert.equal(!!(va.flags || {}).hasGluten, true, `Wk${wk} ${day} ${period}: keeps Gluten`);
  }
});

test('with a CODEX feed that lists no bouillon Gluten, the three plates\' slots read no Gluten', (t) => {
  const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
  if (!fs.existsSync(feedPath)) { t.skip('no sibling CODEX checkout'); return; }
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  const gl = (n) => ((feed.find((r) => r.recipeName === n) || {}).allergens || []).some((a) => /^gluten/i.test(String(a)));
  if (DROPPED.some(([, , , n]) => gl(n))) { t.skip('the sibling CODEX feed is older than v22 (still lists bouillon Gluten)'); return; }
  const between = (a, b) => { const s = html.indexOf(a); const e = html.indexOf(b, s); return html.slice(s, e); };
  const fn = (name) => between('function ' + name + '(', '\n}\n') + '\n}\n';
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(between('const DOOR_RECIPE_DATA_FALLBACK', 'let DOOR_RECIPE_DATA =') + '\n' + fn('flagsToAllergenStr')
    + fn('getVegAltSlotAllergenStr'), ctx, { timeout: 4000 });
  ctx.DOOR_RECIPE_DATA = feed;
  for (const [wk, day, period] of DROPPED) {
    ctx.__S = menu[wk][day][period + '_slots'];
    const s = String(vm.runInContext('getVegAltSlotAllergenStr(__S)', ctx)).toUpperCase();
    assert.ok(!/\b(GLUTEN|WHEAT)\b/.test(s), `Wk${wk} ${day} ${period}: ${s}`);
  }
});
