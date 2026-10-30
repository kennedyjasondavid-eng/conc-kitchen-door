// tests/vegan_meat_soy_slots_gate.mjs — the vegan meat holds no soy (2026-10-30, menu data and the offline list).
// Jason, 2026-10-30: "I don't think there's any soy in the vegan meat"; the vegan cheddar, mozzarella and gravy mix "All
// contain soy". CODEX v34 (conc-recipe-hub, same branch name) takes "Soy (Vegan Meat)" off the six dishes whose only Soy
// it was, stamped, and relabels the three with a bought soy item. Five vegan-alt slots linked to those dishes captured
// their flags at link time, so their plates would go on saying SOY. Each now carries its CODEX dish's families: Soy off
// four (Vegan Lasagna Sauce keeps it, from the mozzarella), Corn on all five, and the nachos' missing Gluten, Sulphites
// and Spicy. Flags DOOR keeps that CODEX has no family for (Beans, Mushroom on the meatballs) stay.
// Authored to fail on f4ca9a3 (v31-standard.47).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { SOY_REMOVED, SOY_RELABELLED } from './helpers/vegan_meat_soy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const menu = JSON.parse(fs.readFileSync(path.join(root, 'menu_current.json'), 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync(path.join(root, 'menu_overlay.json'), 'utf8'));
const on = (f) => Object.keys(f || {}).filter((k) => f[k] === true).sort();
const slotIn = (src, wk, day, period) => (((src[wk] || {})[day] || {})[period + '_slots'] || {}).veganalt || null;

const SLOTS = [
  ['2', 'FRIDAY', 'lunch', 'Vegan CONC Salad Mix', ['hasCorn', 'hasGluten', 'hasNightshades', 'hasSulphites']],
  ['2', 'SATURDAY', 'dinner', 'Vegan Meatloaf', ['hasCorn', 'hasGluten', 'hasMustard', 'hasNightshades', 'hasSulphites']],
  ['3', 'SUNDAY', 'dinner', 'Vegan Meatballs', ['hasBeans', 'hasCorn', 'hasGluten', 'hasMushroom', 'hasMustard', 'hasNightshades', 'hasSulphites']],
  ['3', 'WEDNESDAY', 'lunch', 'Vegan Nacho Mix', ['hasCorn', 'hasGluten', 'hasNightshades', 'hasSulphites', 'isSpicy']],
  ['4', 'FRIDAY', 'lunch', 'Vegan Lasagna Sauce', ['hasCorn', 'hasGluten', 'hasNightshades', 'hasSoy', 'hasSulphites']],
];

test('the five linked vegan-alt slots carry their CODEX dish\'s families, in the menu and the overlay', () => {
  for (const [label, src] of [['menu_current.json', menu], ['menu_overlay.json', overlay]]) {
    for (const [wk, day, period, recipe, flags] of SLOTS) {
      const va = slotIn(src, wk, day, period);
      assert.ok(va && va.recipeName === recipe, `${label} Wk${wk} ${day} ${period}: linked to ${recipe}`);
      assert.deepEqual(on(va.flags), flags, `${label} Wk${wk} ${day} ${period}: flags`);
      assert.equal(va.flags.hasSoy, recipe === 'Vegan Lasagna Sauce', `${label} Wk${wk} ${day} ${period}: hasSoy is set explicitly`);
    }
  }
});

test('the offline list names no vegan-meat Soy: six dishes list none, three name their bought item', () => {
  const s = html.indexOf('const DOOR_RECIPE_DATA_FALLBACK = ');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(html.slice(s, html.indexOf('\n', s)) + '\nthis.fb = DOOR_RECIPE_DATA_FALLBACK;', ctx);
  assert.ok(!JSON.stringify(ctx.fb).includes('Soy (Vegan Meat)'));
  for (const n of SOY_REMOVED) {
    const r = ctx.fb.find((x) => x.recipeName === n);
    assert.ok(r && !r.allergens.some((a) => /^soy/i.test(a)), n);
  }
  for (const [n, label] of Object.entries(SOY_RELABELLED)) {
    const r = ctx.fb.find((x) => x.recipeName === n);
    assert.ok(r && r.allergens.includes(label), n + ' lists ' + label);
  }
});

test('with the v34 CODEX feed, the four slots read no SOY and the lasagna keeps it; all five read CORN', (t) => {
  const feedPath = path.resolve(root, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
  if (!fs.existsSync(feedPath)) { t.skip('no sibling CODEX checkout'); return; }
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  if (JSON.stringify(feed).includes('Soy (Vegan Meat)')) { t.skip('the sibling CODEX feed is older than v34'); return; }
  const between = (a, b) => { const i = html.indexOf(a); return html.slice(i, html.indexOf(b, i)); };
  const fn = (name) => between('function ' + name + '(', '\n}\n') + '\n}\n';
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(between('const DOOR_RECIPE_DATA_FALLBACK', 'let DOOR_RECIPE_DATA =') + '\n' + fn('flagsToAllergenStr')
    + fn('getVegAltSlotAllergenStr'), ctx, { timeout: 4000 });
  ctx.DOOR_RECIPE_DATA = feed;
  for (const [wk, day, period, recipe] of SLOTS) {
    ctx.__S = menu[wk][day][period + '_slots'];
    const s = String(vm.runInContext('getVegAltSlotAllergenStr(__S)', ctx)).toUpperCase();
    assert.equal(/\bSOY\b/.test(s), recipe === 'Vegan Lasagna Sauce', `Wk${wk} ${day} ${period}: ${s}`);
    assert.ok(/\bCORN\b/.test(s), `Wk${wk} ${day} ${period}: ${s}`);
  }
});
