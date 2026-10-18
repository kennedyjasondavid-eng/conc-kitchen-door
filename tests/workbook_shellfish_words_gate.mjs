// tests/workbook_shellfish_words_gate.mjs — the menu workbook import reads shellfish (2026-10-18, v31-standard.31).
// Importing the menu workbook sets each meal's flags from its Intake allergen row (allergenStrToFlags) and the dish
// name (nameDetectFlags). The row knew only "shellfish", "shrimp" and "crab", so "prawns", "mussels", "molluscs" or
// "crustaceans" set nothing; the dish name read no shellfish at all, so "Shrimp Fried Rice" imported with no
// Shellfish tick. Both now read CODEX's two families and their foods. Only ever adds a flag; not an oyster mushroom;
// "seafood" in a dish name is read as fish and shellfish. No published dish names shellfish (checked below).
// Authored to fail on main 9cf22d9 (v31-standard.30).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));

const block = between('const ALLERGEN_FLAG_MAP = {', 'const DAYS_UPLOAD') + fn('emptyMealFlags') + fn('allergenStrToFlags') + fn('nameDetectFlags')
  + between('const DOOR_BRASSICA_RE', '\n') + '\n';
// The import as it was before this change. On main the replacements find nothing.
const before = (s) => s
  .replace(/\n[ \t]*\/\/ the two shellfish families and their foods[^\n]*(\n[ \t]*'[^\n]*'hasShellfish',?)+/, '')
  .replace('|blackened|\\bseafood\\b/', '|blackened/')
  .replace(/\n[ \t]*\/\/ Shellfish named in the dish[^\n]*\n[^\n]*\n[^\n]*flags\.hasShellfish = true;/, '');
function ctxFor(transform = (s) => s) {
  const c = {};
  vm.createContext(c);
  vm.runInContext(transform(block), c, { filename: 'index.html#workbook-shellfish', timeout: 2000 });
  return c;
}
const on = (f) => Object.keys(f).filter(k => f[k]).sort();
const row = (c, s) => on(c.allergenStrToFlags(s, c.emptyMealFlags()));
const dish = (c, s) => on(c.nameDetectFlags(s, c.emptyMealFlags()));

test('the Intake allergen row reads every shellfish word as Shellfish, and only Shellfish', () => {
  const c = ctxFor();
  for (const w of ['shellfish', 'shrimp', 'shrimps', 'prawn', 'prawns', 'crab', 'crabs', 'lobster', 'crayfish', 'krill',
    'crustacean', 'crustaceans', 'mollusc', 'molluscs', 'mollusk', 'mollusks', 'clams', 'mussels', 'oysters', 'scallops',
    'squid', 'calamari', 'octopus']) {
    assert.deepEqual(row(c, w), ['hasShellfish'], w);
  }
  assert.deepEqual(row(c, 'Shellfish & Molluscs, Gluten'), ['hasGluten', 'hasShellfish'], 'a real row');
  assert.deepEqual(row(c, 'Mussels / Fish'), ['hasFish', 'hasShellfish']);
});

test('fish words stay fish, and the rest of the row as before', () => {
  const c = ctxFor(), was = ctxFor(before);
  for (const s of ['fish', 'tuna, salmon', 'gluten, dairy, halal chicken', 'tree nuts', 'soy; sesame', 'none', '']) {
    assert.deepEqual(row(c, s), row(was, s), s);
  }
  assert.deepEqual(row(c, 'fish'), ['hasFish']);
});

test('the dish name reads shellfish; not an oyster mushroom; seafood is both', () => {
  const c = ctxFor();
  for (const d of ['Shrimp Fried Rice', 'Garlic Butter Prawns', 'Mussels in White Wine', 'Crab Cakes', 'Lobster Bisque',
    'Fried Calamari', 'Grilled Octopus', 'Seared Scallops', 'Clam Chowder', 'Beef in Oyster Sauce']) {
    assert.ok(dish(c, d).includes('hasShellfish'), d);
  }
  assert.ok(!dish(c, 'Oyster Mushroom Stir Fry').includes('hasShellfish'), 'an oyster mushroom');
  assert.ok(!dish(c, 'Oyster Mushrooms with Rice').includes('hasShellfish'), 'oyster mushrooms');
  assert.deepEqual(dish(c, 'Seafood Paella').filter(k => k === 'hasFish' || k === 'hasShellfish'), ['hasFish', 'hasShellfish']);
  assert.ok(!dish(c, 'Baked Basa').includes('hasShellfish'), 'fish is not shellfish');
});

test('every published dish imports as before (none names shellfish)', () => {
  const now = ctxFor(), was = ctxFor(before);
  let n = 0;
  for (const data of [json('menu_current.json').menu, json('menu_overlay.json'), json('menu_reno.json').menu || json('menu_reno.json')]) {
    for (const wk of Object.keys(data || {})) {
      if (wk === '_meta' || !data[wk] || typeof data[wk] !== 'object') continue;
      for (const day of Object.keys(data[wk])) {
        const d = data[wk][day] || {};
        for (const p of ['breakfast', 'lunch', 'dinner']) {
          const text = [d[p], d[p + '_veg'], d[p + '_sides']].filter(x => typeof x === 'string').join(' , ');
          if (!text) continue;
          n++;
          assert.deepEqual(dish(now, text), dish(was, text), text);
          const allergens = d[p + '_allergens'];
          if (typeof allergens === 'string') assert.deepEqual(row(now, allergens), row(was, allergens), allergens);
        }
      }
    }
  }
  assert.ok(n > 100, 'published dishes read: ' + n);
});

test('the Shellfish tick says what it covers', () => {
  const tip = (between("{key:'hasShellfish'", '},').match(/tip:'([^']*)'/) || [])[1] || '';
  assert.match(tip, /crustaceans/i);
  assert.match(tip, /molluscs/i);
});
