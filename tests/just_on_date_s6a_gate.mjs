// S6a of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): "Just on <date>".
// D1, Jason 2026-11-19: "Go with lean". Node half; the browser half is tests/browser/just_on_date_s6a.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const fn = (name) => {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' is defined');
  return html.slice(i, html.indexOf('\n}\n', i) + 2);
};

test('S6a-1 the meal view opens on Every week; Save branches to the one-date writer only when Just on is chosen', () => {
  assert.match(html, /<div id="mc-when-choice" style="margin-top:8px;"><\/div>/);
  assert.match(fn('openMenuEdit'), /_doorSaveWhen = 'week';/);
  assert.match(fn('_finishMenuSave'), /if \(typeof _doorSaveWhen !== 'undefined' && _doorSaveWhen === 'date'\) return doorSaveJustOn\(name, veg, flags\);/);
  const f = fn('_finishMenuSave');
  assert.ok(f.indexOf('doorSaveJustOn(') < f.indexOf('saveMenuBaseOverlay('), 'before the every-week meal is written');
});

test('S6a-2 refused: breakfast, a date with a special meal, a date with a one-date change', () => {
  const specials = {}, swaps = {};
  const c = {
    nextDateForSlot: () => new Date(2026, 10, 23, 12),
    doorDateKey: (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    loadSpecialMeals: () => specials, loadMealSwaps: () => swaps,
  };
  vm.createContext(c);
  vm.runInContext(fn('doorJustOnTarget'), c);
  assert.match(c.doorJustOnTarget('1-MONDAY-breakfast').refused, /not available for breakfast/);
  const ok = c.doorJustOnTarget('1-MONDAY-lunch');
  assert.equal(ok.key, '2026-11-23-lunch');
  assert.ok(!ok.refused);
  specials['2026-11-23-lunch'] = { specialName: 'Feast' };
  assert.match(c.doorJustOnTarget('1-MONDAY-lunch').refused, /special meal \(Feast\)/);
  delete specials['2026-11-23-lunch'];
  swaps['2026-11-23-lunch'] = { specialName: 'Other' };
  assert.match(c.doorJustOnTarget('1-MONDAY-lunch').refused, /one-date change \(Other\)/);
});

test('S6a-3 the entry is a whole moved meal, as Swap Slots writes it, with pork never halal', () => {
  const w = fn('doorSaveJustOn');
  assert.match(w, /specialName: name/);
  assert.match(w, /_rotationSlot: mcMenuEditKey, _meal: meal/);
  assert.match(w, /meal\[''\] = name;/, 'EXPO and DOOR read the whole meal only while its name is the entry name');
  assert.match(w, /_flagsRaw: pnh\(\{ \.\.\.flags \}\)/);
  assert.match(w, /if \(meal\._flags\) meal\._flags = pnh\(meal\._flags\);/);
  assert.match(w, /doorWriteEditorMeal\(overlay\[week\]\[day\], period, name, veg, flags\);/, 'built by the every-week writer');
  assert.ok(!/saveMenuBaseOverlay\(/.test(w), 'the every-week meal is never written');
  assert.match(w, /saveMealSwaps\(swaps\);/);
});
