// 2026-11-20 (found relinking the vegan dishes, DOOR #269): Save rebuilt the vegan line, the halal line and the sides text
// from the boxes in box order, so a one-dish edit reworded them. Relinking only the vegan dish dropped Wk2 SUN dinner's
// vegan "Pasta" and turned Wk2 MON dinner's "Green Beans, Rice" into "Rice, Green Beans". Each line now keeps the words it
// opened with unless a dish in it changed, and a changed dish is placed with D4's rule (doorKeepMenuWords). The browser
// half (every published meal, a one-dish edit) is tests/browser/line_words_kept.mjs, in CI. Authored-to-fail against main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function fnBlock(name) {
  const start = html.search(new RegExp('\\n(?:async )?function ' + name + '\\('));
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start + 1, i);
}
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' = ');
  assert.ok(start >= 0, 'could not find ' + name);
  const end = html.indexOf(';\n', start);
  return html.slice(start, end + 1);
}
function ctx() {
  const c = {};
  vm.createContext(c);
  vm.runInContext(['DOOR_WORD_SLOT_IDS', 'DOOR_WORD_SEP_RE', 'DOOR_LINE_WORD_IDS', 'DOOR_LINE_SIDE_IDS'].map(constBlock).concat(
    ['_slotText', 'doorWordPieces', 'doorFindDishRun', 'doorKeepMenuWords', 'doorKeepLineWords', 'doorLineWordMap', 'doorKeptLineWords'].map(fnBlock)).concat(['globalThis.DOOR_LINE_WORD_IDS = DOOR_LINE_WORD_IDS;']).join('\n'), c);
  return c;
}

test('LW-1 the two #269 cases: a vegan relink that keeps its words leaves the vegan line and the sides as written', () => {
  const c = ctx();
  const ids = c.DOOR_LINE_WORD_IDS;
  // Wk2 SUN dinner: the vegan line names a Pasta no box holds
  const sun = { veganalt: { recipeName: 'Vegan Sausage and Greens Pasta Sauce', displayText: 'Vegan Sausage and Vegetable Pasta' } };
  const sunAt = c.doorLineWordMap('veg', sun);
  const sunNow = c.doorLineWordMap('veg', { veganalt: { recipeName: 'Another Vegan Sauce', displayText: 'Vegan Sausage and Vegetable Pasta' } });
  assert.equal(c.doorKeptLineWords('Vegan Sausage and Vegetable Pasta, Pasta', sunAt, sunNow, ids.veg), 'Vegan Sausage and Vegetable Pasta, Pasta');
  // Wk2 MON dinner: the boxes are Rice then Green Beans; the words say Green Beans, Rice
  const mon = { veganalt: { recipeName: 'Vegan African Peanut Stew', displayText: 'Vegetarian Peanut Stew' }, starch: { manual: 'Rice' }, vegside: { manual: 'Green Beans' } };
  const at = c.doorLineWordMap('sides', mon), atVeg = c.doorLineWordMap('veg', mon);
  assert.equal(c.doorKeptLineWords('Green Beans, Rice', at, c.doorLineWordMap('sides', mon), ids.sides), 'Green Beans, Rice');
  assert.equal(c.doorKeptLineWords('Vegetarian Peanut Stew, Green Beans, Rice', atVeg, c.doorLineWordMap('veg', mon), ids.veg), 'Vegetarian Peanut Stew, Green Beans, Rice');
});

test('LW-2 a dish that changed is replaced where it stood; the rest of the line stays as written', () => {
  const c = ctx();
  const ids = c.DOOR_LINE_WORD_IDS;
  const s = { veganalt: { manual: 'Vegetarian Peanut Stew' }, starch: { manual: 'Rice' }, vegside: { manual: 'Green Beans' } };
  const at = c.doorLineWordMap('veg', s), atSides = c.doorLineWordMap('sides', s);
  const now = { ...s, starch: { manual: 'Quinoa' } };
  assert.equal(c.doorKeptLineWords('Vegetarian Peanut Stew, Green Beans, Rice', at, c.doorLineWordMap('veg', now), ids.veg), 'Vegetarian Peanut Stew, Green Beans, Quinoa');
  assert.equal(c.doorKeptLineWords('Green Beans, Rice', atSides, c.doorLineWordMap('sides', now), ids.sides), 'Green Beans, Quinoa');
  // a side the vegan line no longer gets loses its words; one it gets instead takes its place
  const none = { ...s, starch: { manual: 'Rice', lines: { vegan: { mode: 'none' } } } };
  assert.equal(c.doorKeptLineWords('Vegetarian Peanut Stew, Green Beans, Rice', at, c.doorLineWordMap('veg', none), ids.veg), 'Vegetarian Peanut Stew, Green Beans');
  const swap = { ...s, vegside: { manual: 'Green Beans', lines: { vegan: { mode: 'swap', manual: 'Callaloo' } } } };
  assert.equal(c.doorKeptLineWords('Vegetarian Peanut Stew, Green Beans, Rice', at, c.doorLineWordMap('veg', swap), ids.veg), 'Vegetarian Peanut Stew, Callaloo, Rice');
  // a new vegan-only extra goes at the end
  const extra = { ...s, vegextras: { manual: 'Vegan Cornbread' } };
  assert.equal(c.doorKeptLineWords('Vegetarian Peanut Stew, Green Beans, Rice', at, c.doorLineWordMap('veg', extra), ids.veg), 'Vegetarian Peanut Stew, Green Beans, Rice, Vegan Cornbread');
  // the halal line reads its own side versions
  const h = { mainalt: { manual: 'Halal Chicken' }, starch: { manual: 'Rice', lines: { halal: { mode: 'swap', manual: 'Naan' } } } };
  const hNow = { ...h, mainalt: { manual: 'Halal Beef' } };
  assert.equal(c.doorKeptLineWords('Halal Chicken, Naan', c.doorLineWordMap('halal', h), c.doorLineWordMap('halal', hNow), ids.halal), 'Halal Beef, Naan');
});

test('LW-3 anything that cannot be placed exactly rebuilds (null)', () => {
  const c = ctx();
  const ids = c.DOOR_LINE_WORD_IDS;
  const s = { veganalt: { manual: 'BBQ Vegan Meatloaf, Roasted Zucchini' }, starch: { manual: 'Mashed Potato' } };
  const at = c.doorLineWordMap('veg', s);
  // a dish at open is not one run of the words
  assert.equal(c.doorKeptLineWords('BBQ Vegan Meatloaf, Mashed Potato, Roasted Zucchini', at, c.doorLineWordMap('veg', { ...s, starch: { manual: 'Rice' } }), ids.veg), null);
  // two boxes on the same words
  const d = { veganalt: { manual: 'Adobo, Garlic Green Bean' }, vegside: { manual: 'Garlic Green Bean' } };
  assert.equal(c.doorKeptLineWords('Adobo, Garlic Green Bean', c.doorLineWordMap('veg', d), c.doorLineWordMap('veg', { ...d, vegside: { manual: 'Peas' } }), ids.veg), null);
  // no stored words, or no box held a dish of the line at open
  assert.equal(c.doorKeptLineWords('', at, c.doorLineWordMap('veg', { ...s, starch: { manual: 'Rice' } }), ids.veg), null);
  assert.equal(c.doorKeptLineWords('fruit & yoghurt', c.doorLineWordMap('sides', {}), c.doorLineWordMap('sides', { starch: { manual: 'Toast' } }), ids.sides), null);
  // ...but with nothing changed the stored words stand, even when no box holds them
  assert.equal(c.doorKeptLineWords('fruit & yoghurt', c.doorLineWordMap('sides', {}), c.doorLineWordMap('sides', {}), ids.sides), 'fruit & yoghurt');
  // D4 itself is unchanged
  assert.equal(c.doorKeepMenuWords('Pancakes, turkey bacon, fruit & yoghurt', { main: 'Pancakes', starch: 'turkey bacon' }, { main: 'Pancakes', starch: 'pork sausage' }), 'Pancakes, pork sausage, fruit & yoghurt');
});

test('LW-4 Save, the draft summary and the preview write the kept lines; the lines are taken at open, before the baseline', () => {
  assert.match(fnBlock('saveMenuEdit'), /const veg {2}= doorEditedVegLine\(\);/);
  assert.match(fnBlock('doorDraftPlateFacts'), /doorWriteEditorMeal\(overlay\[week\]\[day\], period, doorEditedMealName\(\), doorEditedVegLine\(\), flags\);/);
  const w = fnBlock('doorWriteEditorMeal');
  assert.match(w, /const _halalLine = \(typeof doorEditedHalalLine === 'function'\) \? doorEditedHalalLine\(\) : null;/);
  assert.match(w, /target\[period \+ '_sides'\] {3}= \(typeof doorEditedSides === 'function'\) \? doorEditedSides\(\) : buildSides\(\);/);
  const u = fnBlock('updateSlotSummary');
  assert.match(u, /const veg = \(typeof doorEditedVegLine === 'function'\) \? doorEditedVegLine\(\) : buildVegAlt\(\);/);
  assert.match(u, /const halalLine = \(typeof doorEditedHalalLine === 'function'\) \? doorEditedHalalLine\(\) : null;/);
  assert.match(fnBlock('openMenuEdit'), /_doorWordsAtOpen\.lines = \{[\s\S]*halal: doorLineHasOwnSides\(MEAL_SLOT_STATE, 'halal'\)[\s\S]*_doorMenuDraftBaseline = \{key:mcMenuEditKey/);
});
