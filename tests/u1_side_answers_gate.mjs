// The five typed side boxes U1 left are answered (Jason 2026-11-19: "Follow leans, you make them; buns have no soy or
// sesame"), as published (publication 40), through DOOR's own meal view and Save. Reads the published menu_current.json;
// a later reviewed menu change that touches these boxes re-pins this with a dated note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const slot = (w, d, p, id) => (menu[w][d][p + '_slots'] || {})[id] || {};

test('U1A-1 Wk1 FRI dinner: the green beans link the Library recipe and the meal carries Beans', () => {
  const s = slot('1', 'FRIDAY', 'dinner', 'vegside');
  assert.equal(s.recipeName, 'Garlic Green Beans');
  assert.equal(s.displayText, 'Garlic Green Bean', 'the menu words stay');
  assert.equal(s.flags.hasBeans, true);
  assert.equal(menu['1'].FRIDAY.dinner_flags.hasBeans, true, 'No Beans residents are warned on this dinner');
});
test('U1A-2 Wk4 SUN and MON lunch: carrots and fruit and chips have nothing to declare', () => {
  assert.equal(slot('4', 'SUNDAY', 'lunch', 'vegside').declared, true);
  assert.equal(slot('4', 'MONDAY', 'lunch', 'xtra').declared, true);
});
test('U1A-3 Wk4 MON lunch: the sub bun carries Gluten only (no soy, no sesame)', () => {
  const f = slot('4', 'MONDAY', 'lunch', 'vegextras').flags || {};
  assert.equal(f.hasGluten, true);
  assert.ok(!f.hasSoy && !f.hasSesame);
});
test('U1A-4 Wk4 SAT lunch: the quinoa links CODEX and still reads Turmeric on the menu', () => {
  const s = slot('4', 'SATURDAY', 'lunch', 'vegextras');
  assert.equal(s.recipeId, 'tumeric-quinoa');
  assert.equal(s.displayText, 'Turmeric Quinoa');
});
