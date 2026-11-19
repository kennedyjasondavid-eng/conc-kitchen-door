// S2a of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): one function for a plate's facts.
// The plate part of computePlatingData moves, unchanged, into doorPlateFacts(dayData, period, opts); the sheet, the
// workbook and the routing file read it through computePlatingData, and the editor (S2b, S5b) will read the same
// function on a draft day. doorPlateFactsFor(week, day, period, { noDated: true }) plates the every-week meal even when
// its next service is a swap or a special meal, so a preview never compares a swap with itself (review P1-4).
//
// The proof that nothing moved (every meal's plating data, sheet HTML, workbook sheet and routing file byte-identical
// before and after, on the published menu and residents) is in the receipt, docs/receipts/, not in this gate.
//
// Authored-to-fail against main: doorPlateFacts and doorPlateFactsFor do not exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

test('S2a-1 computePlatingData reads its plate facts from doorPlateFacts, and doorPlateFacts reads no resident', () => {
  const cpd = fnBlock('computePlatingData');
  assert.match(cpd, /const facts = doorPlateFacts\(dayData, period, \{ dated, menuEdit: menuEditForSlot \}\);/);
  for (const moved of ['getVegAltAllergenStr(', 'doorPlatesLabelUnchecked(', 'doorAddKitchenPlateFlags(', 'mealFlags._vegAltSafe =', 'getVegAltSlotAllergenStr(halalSlots'])
    assert.ok(!cpd.includes(moved), 'computePlatingData no longer computes ' + moved);
  const f = fnBlock('doorPlateFacts');
  for (const owned of ['getVegAltAllergenStr(', 'doorPlatesLabelUnchecked(', 'doorAddKitchenPlateFlags(', 'mealFlags._vegAltSafe =', 'mergeVegAltAllergenFloor('])
    assert.ok(f.includes(owned), 'doorPlateFacts owns ' + owned);
  const code = f.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  for (const resident of ['REGISTRY_LIST', 'registry', 'getAnaphConflictRooms', 'computeSections', 'anaphRooms'])
    assert.ok(!new RegExp('\\b' + resident + '\\b').test(code), 'doorPlateFacts reads no resident: ' + resident);
});

test('S2a-2 doorPlateFactsFor plates the every-week meal on a date with a swap when asked (noDated)', () => {
  const seen = [];
  const c = {
    getMenuData: () => ({ 1: { MONDAY: { lunch: 'Every-week Chili' } } }),
    doorDatedMealFor: () => ({ kind: 'swap', date: '2026-11-23' }),
    doorApplyDatedMeal: (day, period) => ({ ...day, [period]: 'Swapped Burger' }),
    getMenuEdit: () => ({ vegAllergens: 'SOY' }),
    doorPlateFacts: (day, period, opts) => { seen.push({ meal: day[period], dated: opts.dated, menuEdit: opts.menuEdit }); return {}; },
  };
  vm.createContext(c);
  vm.runInContext(fnBlock('doorPlateFactsFor'), c);
  c.doorPlateFactsFor(1, 'MONDAY', 'lunch');
  c.doorPlateFactsFor(1, 'MONDAY', 'lunch', { noDated: true });
  assert.equal(JSON.stringify(seen), JSON.stringify([
    { meal: 'Swapped Burger', dated: { kind: 'swap', date: '2026-11-23' }, menuEdit: null },
    { meal: 'Every-week Chili', dated: null, menuEdit: { vegAllergens: 'SOY' } },
  ]), 'the served meal by default; the every-week meal (with its operator statement) when asked');
});

test('S2a-3 doorPlateFacts returns the facts every reader needs, and nothing for an empty meal', () => {
  const f = fnBlock('doorPlateFacts');
  assert.match(f, /if \(!dayData \|\| !dayData\[period\]\) return null;/);
  const ret = f.slice(f.lastIndexOf('return {'));
  for (const k of ['mealName', 'mealVeg', 'mealHalal', 'mealFlags', 'plateLabels', 'allergenStr', 'vegAllergenStr', 'halalAllergenStr', 'mealKitchenAlts'])
    assert.ok(new RegExp('\\b' + k + '\\b').test(ret), 'returns ' + k);
});
