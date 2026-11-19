// S4b of the Edit Menu redesign: the dish boxes are grouped into the plates they make (Regular, Vegan, Halal), in kitchen
// words, with no "optional" tags; the vegan and halal choices under a side fold into one line, open when one differs; the
// "Seasonal Veg" quick pick is gone (the house rule names the vegetable). Every box keeps its id; the saved meal is
// unchanged. Browser half: tests/browser/plate_cards_s4b.mjs, in CI. Authored-to-fail against main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' = ');
  assert.ok(start >= 0, 'could not find const ' + name);
  return html.slice(start, html.indexOf('];\n', start) + 2);
}
function objBlock(name) {
  const start = html.indexOf('const ' + name + ' = ');
  assert.ok(start >= 0, 'could not find const ' + name);
  return html.slice(start, html.indexOf('};\n', start) + 2);
}
const c = {};
vm.createContext(c);
vm.runInContext([constBlock('MEAL_SLOT_DEFS'), constBlock('DOOR_PLATE_CARDS'), objBlock('DOOR_SLOT_KITCHEN_LABEL'),
  'this.D = MEAL_SLOT_DEFS; this.P = DOOR_PLATE_CARDS; this.L = DOOR_SLOT_KITCHEN_LABEL;'].join('\n'), c);

test('S4b-1 every box sits on exactly one plate card', () => {
  const placed = c.P.flatMap((p) => p.ids);
  assert.equal(JSON.stringify([...placed].sort()), JSON.stringify(c.D.map((d) => d.id).sort()));
  assert.equal(new Set(placed).size, placed.length);
  assert.equal(JSON.stringify(c.P.map((p) => p.key)), JSON.stringify(['regular', 'vegan', 'halal']));
  assert.ok(c.P.find((p) => p.key === 'vegan').ids.includes('veganalt') && c.P.find((p) => p.key === 'halal').ids.includes('mainalt'));
});

test('S4b-2 kitchen words on every box; no "optional" tags; no "Seasonal Veg" quick pick', () => {
  for (const d of c.D) assert.ok(c.L[d.id], 'a kitchen label for ' + d.id);
  assert.ok(!/\b(slot|Alt)\b/.test(Object.values(c.L).join(' ')), 'no system words');
  assert.match(html, /const optLabel = '';   \/\/ S4b/);
  assert.ok(!c.D.some((d) => (d.qp || []).includes('Seasonal Veg')));
});

test('S4b-3 the vegan and halal choices under a side fold into one line, open when one differs', () => {
  const start = html.indexOf('function _slotLinesHTML(');
  const body = html.slice(start, html.indexOf('\n}\n', start));
  assert.match(body, /const _open = !_same \|\| DOOR_LINES_FOLD_OPEN\.has\(id\)/);
  assert.match(body, /Same on the vegan and halal plates/);
  assert.match(body, /data-slot-line="' \+ id \+ '-' \+ line \+ '"/, 'the choices keep their names');
});
