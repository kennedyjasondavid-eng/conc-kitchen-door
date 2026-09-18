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

test('W1 Tuesday lunch still matches the architect-set menu decision', () => {
  const slot = readJson('menu_current.json').menu['1']?.TUESDAY;
  assert.ok(slot, 'W1 TUESDAY node must exist');
  const slotName = (entry) => entry?.recipeName || entry?.manual || '';

  assert.equal(slotName(slot.lunch_slots?.main), 'Blackened Fish', 'regular main remains Blackened Fish');
  assert.equal(slotName(slot.lunch_slots?.starch), 'Sweet potatoes', 'starch remains Sweet potatoes');
  assert.equal(slotName(slot.lunch_slots?.vegside), 'Parsnip and Carrot', 'veg side remains Parsnip and Carrot');
  assert.equal(slotName(slot.lunch_slots?.veganalt), 'Blackened Tofu', 'vegan counterpart remains Blackened Tofu');
  assert.equal(slot.lunch, 'Blackened Fish, Sweet potatoes, Parsnip and Carrot');
  assert.equal(slot.lunch_veg, 'Blackened Tofu, Sweet potatoes, Parsnip and Carrot');
  assert.equal(slot.lunch_sides, 'Sweet potatoes, Parsnip and Carrot');
});

test('W1 Tuesday lunch still matches the confirmed stream-specific allergen decision', () => {
  const slot = readJson('menu_current.json').menu['1']?.TUESDAY;
  assert.ok(slot, 'W1 TUESDAY node must exist');
  const regular = slot.lunch_flags || {};
  const vegan = slot.lunch_slots?.veganalt?.flags || {};

  assert.equal(regular.hasFish, true, 'regular Blackened Fish retains its fish flag');
  assert.equal(regular.hasSoy, false, 'regular meal does not inherit vegan-alt soy');
  assert.equal(regular.isSpicy, true, 'regular Blackened Fish retains its spicy flag');
  assert.equal(regular.hasNightshades, false, 'blackening spice is spicy, not Nightshades');
  assert.equal(vegan.hasFish, false, 'vegan Blackened Tofu does not inherit regular-stream fish');
  assert.equal(vegan.hasSoy, true, 'vegan Blackened Tofu retains its soy flag');
  assert.equal(vegan.isSpicy, true, 'vegan Blackened Tofu retains its spicy flag');
  assert.equal(vegan.hasNightshades, false, 'vegan blackening spice is spicy, not Nightshades');
  assert.equal(slot.allergens_lunch, 'fish', 'regular allergen line stays fish-only');
});

test('W1 Tuesday routing still matches the architect-set components', () => {
  const components = readJson('routing_by_meal.json').routing['1']?.TUESDAY?.lunch?._components || {};
  for (const component of ['Blackened Fish', 'Blackened Tofu', 'Sweet potatoes', 'Parsnip and Carrot']) {
    assert.ok(Number.isInteger(components[component]) && components[component] > 0,
      `routing includes a positive portion count for ${component}`);
  }
  assert.equal(
    Object.keys(components).some((component) => /^(?:Seasonal Vegetables|Roasted Tofu)(?:\s|\(|$)/i.test(component)),
    false,
    'retired Seasonal Vegetables and Roasted Tofu do not survive in W1 Tuesday routing'
  );
});

test('plain vegetable stir-fry component wording is unchanged', () => {
  const overlay = readJson('menu_overlay.json');
  assert.equal(overlay._meta?.plainVegStirfryComponents, 'Carrot, Onion, Peppers, Zucchini, Green Beans');
});
