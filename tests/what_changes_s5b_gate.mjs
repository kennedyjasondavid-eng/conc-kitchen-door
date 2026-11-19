// S5b of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): What changes.
// Node half: the model is worked out on the every-week meal (no dated meal), the plates before and after, the moves
// counted by plate, the anaphylactic rooms, the replaced one-date change, and "counts not available" with no resident
// list. The browser half (tests/browser/what_changes_s5b.mjs) proves the counts equal the plating sheet on every meal.
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

test('S5b-1 the editor has a What changes panel, rendered on every draft update outside the test meal', () => {
  assert.match(html, /<div id="mc-what-changes" role="status" aria-live="polite" style="display:none;"><\/div>/);
  assert.match(html, /if \(!testMealActive && typeof doorRenderWhatChanges === 'function'\) doorRenderWhatChanges\(draftFacts, flags\);/);
  const r = fn('doorRenderWhatChanges');
  assert.match(r, /doorMenuDraftIsDirty\(\)/, 'shown only once the meal differs');
  assert.match(r, /doorPlateFactsFor\(week, day, period, \{ noDated: true \}\)/, 'before is the every-week meal');
  assert.match(r, /doorSwapKeysForSlot\(week, day, period, store\)/, 'the one-date changes Save replaces');
});

test('S5b-2 the model: plates before and after, moves by plate, anaphylactic rooms, no list reads not available', () => {
  const ctx = {
    doorIsAnaphResident: (r) => !!r.isAnaph,
    getAnaphConflictRooms: (f, _e, reg) => new Set(reg.filter((r) => r.isAnaph && f.hasPeanuts).map((r) => r.room)),
    computeSections: (f, reg) => [
      { rule: { label: 'Regular' }, residents: reg.filter((r) => !(f.hasEgg && r.tags.includes('No Eggs'))) },
      { rule: { label: 'No Egg / Mustard' }, residents: reg.filter((r) => f.hasEgg && r.tags.includes('No Eggs')) },
    ],
  };
  vm.createContext(ctx);
  vm.runInContext(fn('doorSeatsForFacts') + fn('doorWhatChanges'), ctx);
  const before = { allergenStr: 'GLUTEN', vegAllergenStr: '', halalAllergenStr: '', mealFlags: {} };
  const after = { allergenStr: 'GLUTEN, EGGS, PEANUTS', vegAllergenStr: 'PEANUTS', halalAllergenStr: '', mealFlags: { hasEgg: true, hasPeanuts: true } };
  const reg = [{ room: '1a', tags: ['No Eggs'] }, { room: '2a', tags: ['No Eggs'] }, { room: '3a', tags: [] }, { room: '9a', tags: [], isAnaph: true }];
  const m = JSON.parse(JSON.stringify(ctx.doorWhatChanges(before, after, reg, undefined, [{ key: '2026-11-23-lunch', name: 'Satay' }])));
  assert.deepEqual(m.plates.map((p) => [p.plate, p.added]), [['Regular', ['EGGS', 'PEANUTS']], ['Vegan', ['PEANUTS']]]);
  assert.equal(m.moved, 3);
  assert.deepEqual(m.moves.map((x) => [x.from, x.to, x.count]), [['Regular', 'No Egg / Mustard', 2], ['Regular', 'Anaphylactic Alternative', 1]]);
  assert.deepEqual(m.anaph, [{ room: '9a', before: 'Regular', after: 'Anaphylactic Alternative' }]);
  assert.equal(m.swaps.length, 1);
  const none = ctx.doorWhatChanges(before, after, [], undefined, []);
  assert.equal(none.counts, 'none');
  assert.equal(none.moved, 0);
});

test('S5b-3 the words: counts not available with no list, the anaphylactic room in red, the replaced date named', () => {
  const h = fn('doorWhatChangesHTML');
  assert.match(h, /counts not available \(no resident list on this computer\)/);
  assert.match(h, /This meal now holds an allergen they are anaphylactic to\./);
  assert.match(h, /var\(--danger-ink, #991b1b\)/);
  assert.match(h, /is replaced: Save puts this every-week meal on that date too\./);
  assert.match(h, /escapeHtml\(/, 'every name is escaped');
  // Review fold: a dish whose label is not checked, a special meal on the date, Save questions still to come.
  assert.match(h, /Label not checked: /);
  assert.match(h, /check the label of /);
  assert.match(h, /!hit\.length && !\(m\.unchecked \|\| \[\]\)\.length/, 'never "not affected" while a label is unread');
  assert.match(h, /stays: that date serves the special meal, not this change\./);
  assert.match(h, /Save may still ask about old allergen ticks or halal meat/);
});
