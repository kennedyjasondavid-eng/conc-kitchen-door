import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

// 2026-11-24 (Jason: "Rex's version is right, update the check"; set and reviewed in DOOR through Rex's week-sheet
// import): Wk1 TUE lunch's vegan dish is Roasted Tofu (linked to Roast Tofu), not Blackened Tofu, and the vegetable
// side is Parsnip (linked to Plain Parsnips), not Parsnip and Carrot. The regular Blackened Fish is unchanged.
// Before this, the 2026-10-05 ruling kept Blackened Tofu and retired Roasted Tofu.
test('W1 Tuesday lunch still matches the architect-set menu decision', () => {
  const slot = readJson('menu_current.json').menu['1']?.TUESDAY;
  assert.ok(slot, 'W1 TUESDAY node must exist');
  const slotName = (entry) => entry?.recipeName || entry?.manual || '';

  assert.equal(slotName(slot.lunch_slots?.main), 'Blackened Fish', 'regular main remains Blackened Fish');
  assert.equal(slotName(slot.lunch_slots?.starch), 'Sweet potatoes', 'starch remains Sweet potatoes');
  assert.equal(slotName(slot.lunch_slots?.vegside), 'Plain Parsnips', 'veg side is Parsnip (Plain Parsnips)');
  assert.equal(slotName(slot.lunch_slots?.veganalt), 'Roast Tofu', 'vegan counterpart is Roasted Tofu (Roast Tofu)');
  assert.equal(slot.lunch, 'Blackened Fish, Sweet potatoes, Parsnip');
  assert.equal(slot.lunch_veg, 'Roasted Tofu, Sweet potatoes, Parsnip');
  assert.equal(slot.lunch_sides, 'Sweet potatoes, Parsnip');
});

test('W1 Tuesday lunch still matches the confirmed stream-specific allergen decision', () => {
  const slot = readJson('menu_current.json').menu['1']?.TUESDAY;
  assert.ok(slot, 'W1 TUESDAY node must exist');
  const regular = slot.lunch_flags || {};
  const vegan = slot.lunch_slots?.veganalt?.flags || {};

  assert.equal(regular.hasFish, true, 'regular Blackened Fish retains its fish flag');
  assert.equal(regular.hasSoy, false, 'regular meal does not inherit vegan-alt soy');
  assert.equal(regular.isSpicy, true, 'regular Blackened Fish retains its spicy flag');
  // 2026-11-09 (Jason: "Blackened has paprika"): the blackening spice is spicy AND Nightshades.
  assert.equal(regular.hasNightshades, true, 'blackening spice has paprika: Nightshades');
  assert.equal(slot.lunch_slots?.main?.flags?.hasNightshades, true, 'the Blackened Fish slot carries Nightshades');
  assert.equal(vegan.hasFish, false, 'vegan Roasted Tofu does not inherit regular-stream fish');
  assert.equal(vegan.hasSoy, true, 'vegan Roasted Tofu retains its soy flag');
  // 2026-11-24: Roasted Tofu is not blackened, so it carries neither the spice nor its paprika.
  assert.notEqual(vegan.isSpicy, true, 'vegan Roasted Tofu is not spicy (not blackened)');
  assert.notEqual(vegan.hasNightshades, true, 'vegan Roasted Tofu has no blackening paprika');
  assert.equal(slot.allergens_lunch, 'fish', 'regular allergen line stays fish-only');
});

test('W1 Tuesday routing still matches the architect-set components', () => {
  const components = readJson('routing_by_meal.json').routing['1']?.TUESDAY?.lunch?._components || {};
  for (const component of ['Blackened Fish', 'Roasted Tofu', 'Sweet potatoes', 'Parsnip']) {
    assert.ok(Number.isInteger(components[component]) && components[component] > 0,
      `routing includes a positive portion count for ${component}`);
  }
  assert.equal(
    Object.keys(components).some((component) => /^(?:Seasonal Vegetables|Blackened Tofu|Parsnip and Carrot)(?:\s|\(|$)/i.test(component)),
    false,
    'retired Seasonal Vegetables, Blackened Tofu and Parsnip and Carrot do not survive in W1 Tuesday routing'
  );
});

test('plain vegetable stir-fry component wording is unchanged', () => {
  const overlay = readJson('menu_overlay.json');
  assert.equal(overlay._meta?.plainVegStirfryComponents, 'Carrot, Onion, Peppers, Zucchini, Green Beans');
});
