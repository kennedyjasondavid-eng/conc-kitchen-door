// Jason, 2026-11-19 ("Follow leans on all four"), from the U4 review: Rex's week sheet picked a wrong recipe by default
// for Week 4 THU lunch's "Side Salad" (Potato Salad (for Honey BBQ Drums)), and would pick a remembered link for words
// that were only near. Now a plain staple is never linked to a longer recipe by default, and a remembered link is picked
// only for the same words; both stay offered as suggestions.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rexWeekBox } from './helpers/rex_week_box.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = rexWeekBox(ROOT);
const out = (x) => JSON.parse(JSON.stringify(x));
const recipes = [
  { recipeName: 'Potato Salad (for Honey BBQ Drums)', category: 'starch_side', stream: 'regular', allergens: ['Eggs (Mayonnaise)'] },
  { recipeName: 'Teriyaki Chicken Legs', category: 'protein_main', stream: 'regular', allergens: ['Soy (Soy Sauce)'] },
  { recipeName: 'Garden a la King', category: 'stew_main', stream: 'regular', allergens: [] },
];

test('NG-1 a plain staple is not linked to a longer recipe by default; the recipe stays a suggestion', () => {
  const r = out(api.doorRexRecipeFor('Side Salad', recipes, null, null));
  assert.equal(r.exact, null);
  assert.equal(r.same, null, 'Side Salad is not read as Potato Salad');
  assert.ok(r.close.some((x) => x.recipeName === 'Potato Salad (for Honey BBQ Drums)'), 'still offered');
});
test('NG-2 a dish under a longer recipe name still links (not a staple)', () => {
  const r = out(api.doorRexRecipeFor('Teriyaki Chicken', recipes, null, null));
  assert.equal(r.same && r.same.recipeName, 'Teriyaki Chicken Legs');
});
test('NG-3 a remembered link: the same words pick it; a near spelling only suggests it', () => {
  const known = { 'chicken king la': { recipeName: 'Garden a la King', where: '2-MONDAY-lunch' } };
  const same = out(api.doorRexRecipeFor('chicken A LA king', recipes, null, known));
  assert.equal(same.exact && same.exact.recipeName, 'Garden a la King');
  assert.equal(same.linkedAt, '2-MONDAY-lunch');
  const near = out(api.doorRexRecipeFor('Chiken a la King', recipes, null, known));
  assert.equal(near.exact, null);
  assert.equal(near.same, null);
  assert.equal(near.close[0].recipeName, 'Garden a la King', 'offered first');
});
