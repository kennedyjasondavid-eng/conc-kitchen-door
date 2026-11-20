// Four vegan dishes link CODEX's own vegan records instead of the shared pot (CODEX #392, edition 2026-11-20-vegan-pots;
// Jason 2026-11-19 "Follow lean" on the U1 walkthrough call: the pot links stay until CODEX gives each pot its own vegan
// record). Publication 42. Reads the published menu_current.json; a later reviewed menu change that touches these four
// slots re-pins this with a dated note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const ROWS = [
  ['1', 'FRIDAY', 'Vegetarian Adobo', 'tofu-adobo-adobo-marinade-and-sauce', 'Tofu Adobo (Adobo Marinade & Sauce)'],
  ['2', 'SUNDAY', 'Vegan Sausage and Vegetable Pasta', 'vegan-sausage-and-greens-pasta-sauce', 'Vegan Sausage and Greens Pasta Sauce'],
  ['2', 'MONDAY', 'Vegetarian Peanut Stew', 'vegan-african-peanut-stew', 'Vegan African Peanut Stew'],
  ['2', 'FRIDAY', 'Vegan Arroz con Pollo', 'vegan-arroz-con-pollo', 'Vegan Arroz con Pollo'],
];
const slot = (w, d) => ((menu[w][d].dinner_slots || {}).veganalt) || {};

test('VR-1 each vegan dish links its own CODEX vegan record and keeps the words the menu shows', () => {
  for (const [w, d, words, id, name] of ROWS) {
    const s = slot(w, d);
    assert.equal(s.recipeId, id, 'Wk' + w + ' ' + d + ' dinner');
    assert.equal(s.recipeName, name);
    assert.equal(s.displayText, words, 'the menu words stay');
    assert.ok(menu[w][d].dinner_veg.startsWith(words), 'the vegan line still names the dish');
  }
});
test('VR-2 no vegan slot still links a shared pot', () => {
  const pots = ['adobo-pork-chicken-tofu-adobo-marinade-and-sauce', 'sausage-and-greens-pasta-sauce-pork-halal-chicken-vegan',
    'african-peanut-chicken-stew', 'arroz-con-pollo-regular-vegan'];
  for (const w of Object.keys(menu)) for (const d of Object.keys(menu[w])) for (const p of ['breakfast', 'lunch', 'dinner']) {
    const v = ((menu[w][d][p + '_slots'] || {}).veganalt) || {};
    assert.ok(!pots.includes(v.recipeId), 'Wk' + w + ' ' + d + ' ' + p + ' vegan dish links ' + v.recipeId);
  }
});
test('VR-3 Wk2 SUN: the vegan sausage carries the label Jason read (no Soy; Sulphites, Nightshades; Beans kept)', () => {
  const f = slot('2', 'SUNDAY').flags || {};
  assert.equal(f.hasSoy, false);
  assert.equal(f.hasSulphites, true);
  assert.equal(f.hasNightshades, true);
  assert.equal(f.hasBeans, true);
});
test('VR-4 the other three keep the allergens they had (same families as the pot)', () => {
  const on = f => Object.keys(f || {}).filter(k => f[k]).sort().join(',');
  assert.equal(on(slot('1', 'FRIDAY').flags), 'hasCoconut,hasCorn,hasSoy,hasSulphites,hasTreeNuts');
  assert.equal(on(slot('2', 'MONDAY').flags), 'hasBeans,hasCoconut,hasNightshades,hasPeanuts,hasSulphites,hasTreeNuts,isSpicy');
  assert.equal(on(slot('2', 'FRIDAY').flags), 'hasCorn,hasGluten,hasSoy');
});
