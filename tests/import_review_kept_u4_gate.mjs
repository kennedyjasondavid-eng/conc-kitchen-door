// U4 (docs/DOOR_BACK_ON_TRACK_PLAN_2026-11-18.md §5, "Import review shows which dishes, links and allergens are kept and
// which are replaced"): Rex's week-sheet review names, per meal, the dishes kept (with the recipe link they keep), the
// dishes replaced (the link that goes and the one that comes), and the allergens kept, added and coming off.
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
const ctx = {
  escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  doorRexFlagsList: (keys) => keys.map((k) => k.replace(/^has/, '')).join(', '),
  getMenuData: () => ({ '2': { MONDAY: { lunch_slots: {
    main: { recipeName: 'Chicken Gyro', flags: {} },
    starch: { recipeName: 'Rice Pilaf', displayText: 'Rice', flags: {} },
    vegside: { manual: 'Green Beans', flags: {} },
  } } } }),
};
vm.createContext(ctx);
vm.runInContext(fn('doorRexDishLink') + fn('doorRexKeptReplacedHTML'), ctx);
const meal = (over) => Object.assign({ week: 2, day: 'MONDAY', period: 'lunch', newDishes: [], beforeFlags: [], addFlags: [], removeFlags: [], removeDefault: false,
  lines: { reg: { diffs: [] }, veg: { empty: true, diffs: [] } } }, over);

test('U4-1 a kept dish names the recipe link it keeps; a replaced dish names the link that goes and the one that comes', () => {
  const h = ctx.doorRexKeptReplacedHTML(meal({
    lines: { reg: { diffs: [
      { status: 'changed', door: 'Chicken Gyro', rex: 'Beef Gyro' },
      { status: 'same', door: 'Rice', rex: 'Rice' },
      { status: 'same', door: 'Green Beans', rex: 'Green beans' },
    ] }, veg: { empty: true, diffs: [] } },
    newDishes: [{ piece: 'Beef Gyro', lean: 'Beef Gyro Meat' }],
  }));
  assert.match(h, /Replaced:<\/strong> Chicken Gyro &rarr; Beef Gyro .*link to Chicken Gyro replaced; links Beef Gyro Meat/);
  assert.match(h, /Kept:<\/strong> Rice .*link to Rice Pilaf kept/);
  assert.match(h, /Green Beans(?! <span)/, 'a typed dish kept says no link');
});
test('U4-2 an added dish with no recipe and a removed linked dish are named', () => {
  const h = ctx.doorRexKeptReplacedHTML(meal({ lines: { reg: { diffs: [
    { status: 'added', rex: 'Coleslaw' }, { status: 'removed', door: 'Chicken Gyro' },
  ] }, veg: { empty: true, diffs: [] } } }));
  assert.match(h, /\+ Coleslaw .*no recipe link yet/);
  assert.match(h, /&minus; Chicken Gyro .*its link to Chicken Gyro goes/);
});
test('U4-3 the allergens line: kept, added, coming off by default, or kept unless ticked', () => {
  const on = ctx.doorRexKeptReplacedHTML(meal({ beforeFlags: ['hasGluten', 'hasPork'], removeFlags: ['hasPork'], removeDefault: true, addFlags: ['hasBeef'] }));
  assert.match(on, /kept: Gluten/);
  assert.match(on, /added: Beef/);
  assert.match(on, /coming off \(untick below to keep\): Pork/);
  assert.ok(!/kept: Gluten, Pork/.test(on));
  const off = ctx.doorRexKeptReplacedHTML(meal({ beforeFlags: ['hasGluten', 'hasPork'], removeFlags: ['hasPork'], removeDefault: false }));
  assert.match(off, /kept unless you tick them off: Pork/);
  assert.match(off, /kept: Gluten(?!, Pork)/);
});
test('U4-4 both review rows show it, before the notes; names are escaped', () => {
  assert.match(fn('doorRexQuestionHTML'), /<\/tbody><\/table><\/div>' \+ doorRexKeptReplacedHTML\(m\) \+ notes/);
  assert.match(fn('doorRexAutoHTML'), /doorRexKeptReplacedHTML\(m\) \+ doorRexAddsHTML\(m\)/);
  const h = ctx.doorRexKeptReplacedHTML(meal({ lines: { reg: { diffs: [{ status: 'added', rex: '<b>x</b>' }] }, veg: { empty: true, diffs: [] } } }));
  assert.ok(!h.includes('<b>x</b>') && h.includes('&lt;b&gt;'));
});
test('U4-5 a dish added on both the regular and vegan lines is listed once', () => {
  const h = ctx.doorRexKeptReplacedHTML(meal({ lines: { reg: { diffs: [{ status: 'added', rex: 'fruit & yoghurt' }] }, veg: { diffs: [{ status: 'added', rex: 'fruit & yoghurt' }] } } }));
  assert.equal(h.split('+ fruit &amp; yoghurt').length - 1, 1);
});
