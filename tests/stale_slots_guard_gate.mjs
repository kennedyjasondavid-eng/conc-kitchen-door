// 2026-11-08 (Jason: "Fix the 3 and add a guard"). Prevents: Edit Menu opening a meal from saved slots that are
// behind its menu text (a text edit made outside Edit Menu), so that Save rewrites the regular line. Six meals were
// like that on 2026-11-08 (fixed in #174); e.g. Wk2 FRI lunch's slots held only "Beef Chili", and a save would have
// dropped Cornbread and Sautéed Cabbage. Fixed examples only (the six as they were), never the live menu.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}
const c = {};
vm.createContext(c);
vm.runInContext(fnBlock('doorSlotsMatchText') + '\nthis.f = doorSlotsMatchText;', c);
const match = (slots, text) => c.f(slots, text);
const m = (t) => ({ manual: t });

test('slots behind the text are caught (the six meals as they were on 2026-11-08)', () => {
  assert.equal(match({ main: m('Beef Chili') }, 'Beef Chili, Cornbread, Sautéed Cabbage'), false, 'two sides missing');
  assert.equal(match({ main: m('Chicken Tenders'), starch: m('Sweet Potato'), vegside: m('Green Beans') },
    'Chicken Tenders, Sweet Potato, Buttered Green Beans'), false, 'a side renamed in the text');
  assert.equal(match({ main: m('BBQ Beef Meatloaf'), starch: m('Mashed Potato') }, 'BBQ Beef Meatloaf, Mashed Potato, Roasted Zucchini'), false);
  assert.equal(match({ main: m('Sausages'), starch: m('Roasted Potatoes'), vegside: m('Peas') },
    'Sausages, Roasted Potatoes, Gravy, Peas & Carrots'), false);
  assert.equal(match({ main: { recipeName: 'Ginger Beef' }, starch: { recipeName: 'Biryani Rice', displayText: 'Rice' }, vegside: m('Garlic corn') },
    'Ginger Beef, Rice, Garlic corn & Bean'), false);
  assert.equal(match({ main: m('Sausage and Vegetable Pasta'), starch: m('Pasta') }, 'Sausage and Vegetable Pasta'), false, 'a slot the text doesn\'t have');
});

test('slots that name the same dishes pass, however they are written', () => {
  assert.equal(match({ main: m('Pork Adobo & Garlic Green Bean'), starch: m('Rice') }, 'Pork Adobo, Rice, Garlic Green Bean'), true, '"&" in one slot');
  assert.equal(match({ main: m('Honey BBQ Halal Chicken Drumsticks'), vegside: m('Potato Salad'), xtra: m('Potato Salad') },
    'Honey BBQ Halal Chicken Drumsticks, Potato Salad'), true, 'a side listed twice');
  assert.equal(match({ main: { recipeName: 'Biryani Rice', displayText: 'Ginger Beef' }, starch: m('rice') }, 'Ginger Beef, Rice'), true, 'case and the shown words');
  assert.equal(match({ extras: m('Jerk Night'), main: m('Jerk Chicken'), starch: m('Rice') }, 'Jerk Night — Jerk Chicken, Rice'), true, 'an event name');
  assert.equal(match({ main: m('Vegan Chili'), veganalt: m('Something else') }, 'Vegan Chili'), true, 'only the regular slots count');
});

test('Edit Menu reads the text, with its "read from the menu text" notice, when the slots are behind', () => {
  const open = fnBlock('openMenuEdit');
  assert.match(open, /const _slotsBehind = !!\(savedSlots && !doorSlotsMatchText\(savedSlots, dayData\[period\]\)\);/);
  assert.match(open, /if \(savedSlots && !_slotsBehind && _restoreSlotSnapshot\(savedSlots\)\) \{\s*_mcSlotsBlockPresent = true;/,
    'behind slots are not restored, so the notice shows and the text is parsed');
  assert.match(open, /\} else if \(dayData\[period\]\) \{\s*parseMealNameIntoSlots\(dayData\[period\]\);/, 'the text path is still there');
});
