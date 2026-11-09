// tests/bare_side_word_gate.mjs: a bare side word on the vegan line names that side only (2026-11-09, v31-standard.61).
// getVegAltAllergenStr guesses each vegan-line piece's recipe by name. A piece that is one significant word ("Pasta",
// "Rice") matched any longer vegan recipe containing it, and the longest won: "Pasta" read as Vegan Baked Pasta, so the
// Wk1, Wk2 and Wk3 SUN dinner vegan plates took its Soy, Corn, Mushroom, Beans and Sulphites; "Rice" read as Soy-Free
// Mushroom Fried Rice. Jason, 2026-11-09: "spin up a session for #2" (the veg pasta audit).
// Rule: a one-word piece matches a recipe of that name or its plural, never a longer dish. The lookup is still a floor:
// the slot reader and the meal ticks are untouched, so no plate loses a warning its linked dishes or ticks give.
// Runs the REAL functions from index.html in a vm, on the frozen CODEX feed. Authored to fail on d6d4cab (v31-standard.60).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const feed = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'codex_door_recipe_data_2026-11-06_096ee08.json'), 'utf8'));
// Vegan Bolognese reached CODEX on 2026-11-09, after the frozen feed; its door block as published then.
const VEGAN_BOLOGNESE = { recipeName: 'Vegan Bolognese', stream: 'vegan', allergens: ['Gluten (Vegan Meat Replacement — Panko)', 'Sulphites (Vegan Meat Replacement — Liquid Smoke)', 'Corn (Vegan Meat Replacement — Cornmeal)', 'Nightshades (Crushed Tomatoes, Tomato Paste, Vegan Meat Replacement — Paprika)', 'Mushroom (Vegan Meat Replacement — Button Mushrooms)', 'Beans (Vegan Meat Replacement — Chickpeas)'] };

function ctx(data) {
  const c = { DOOR_RECIPE_DATA: data, DOOR_RECIPE_DATA_FALLBACK: [] };
  vm.createContext(c);
  vm.runInContext(fn('getVegAltAllergenStr'), c, { filename: 'index.html#bare-side', timeout: 4000 });
  return c;
}
const c = ctx([...feed, VEGAN_BOLOGNESE]);
const guess = (line) => { c.__V = line; return new Set(vm.runInContext('getVegAltAllergenStr(__V)', c).split(', ').filter(Boolean)); };
const byName = (n) => feed.find((r) => r.recipeName === n);
const fams = (r) => new Set((r.allergens || []).filter((a) => a && a !== 'None').map((a) => a.split('(')[0].trim().toUpperCase()));

test('1. "Pasta" alone is not Vegan Baked Pasta', () => {
  assert.ok(byName('Vegan Baked Pasta'), 'the frozen feed carries Vegan Baked Pasta');
  assert.equal(guess('Pasta').size, 0, 'a bare Pasta borrows no dish');
  assert.equal(guess('Rice').size, 0, 'a bare Rice borrows no dish');
});

test('2. the three Sunday pasta dinners read their own dishes only', () => {
  const stroganoff = fams(byName('Mushroom Stroganoff'));
  assert.deepEqual([...guess('Mushroom Stroganoff, Pasta')].sort(), [...stroganoff].sort(), 'Wk1 SUN: Mushroom Stroganoff only');
  const bolo = guess('Vegan Bolognese, Pasta, Peas & Carrots');
  assert.deepEqual([...bolo].sort(), [...fams(VEGAN_BOLOGNESE)].sort(), 'Wk3 SUN: Vegan Bolognese only, no Soy from vegan cheddar');
  const sausage = guess('Vegan Sausage and Vegetable Pasta, Pasta');
  for (const f of ['CORN', 'MUSHROOM', 'SULPHITES']) assert.ok(!sausage.has(f), 'Wk2 SUN: no ' + f + ' from Vegan Baked Pasta');
});

test('3. a one-word piece still matches its own recipe, plural or not', () => {
  const data = [{ recipeName: 'Falafel', stream: 'vegan', allergens: ['Sesame'] }, { recipeName: 'Roasted Yams', stream: 'vegan', allergens: ['Nightshades (Paprika)'] }];
  const k = ctx(data);
  k.__V = 'Falafel, Roasted Yam';
  assert.equal(vm.runInContext('getVegAltAllergenStr(__V)', k), 'SESAME, NIGHTSHADES');
});

test('4. a piece of two or more words keeps the old match', () => {
  const s = guess('Vegan Baked Pasta');
  assert.deepEqual([...s].sort(), [...fams(byName('Vegan Baked Pasta'))].sort(), 'a named dish still reads its recipe');
  assert.ok(guess('Vegan Bolognese Pasta').has('MUSHROOM'), 'the longer shown name still finds Vegan Bolognese');
});
