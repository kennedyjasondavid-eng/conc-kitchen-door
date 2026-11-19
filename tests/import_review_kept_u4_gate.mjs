// U4 (docs/DOOR_BACK_ON_TRACK_PLAN_2026-11-18.md §5, "Import review shows which dishes, links and allergens are kept and
// which are replaced"): Rex's week-sheet review shows, per meal and plate, the dishes kept (with the recipe link they keep)
// and the dishes replaced (the link that goes and the one that comes), and the regular plate's allergens added, coming off
// and kept. Review fold (FIX FIRST): it reads what doorRexBuildMeal builds from the answers on screen (what Save writes),
// never a guess of its own, and it is drawn again whenever an answer changes.
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
const lines = html.slice(html.indexOf('const DOOR_REX_KEPT_LINES'), html.indexOf('];', html.indexOf('const DOOR_REX_KEPT_LINES')) + 2);
const ctx = {
  escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  doorRexFlagsList: (keys) => keys.map((k) => k.replace(/^(has|is)/, '')).join(', '),
};
vm.createContext(ctx);
vm.runInContext(lines + fn('doorRexSlotWords') + fn('doorRexKeptModel') + fn('doorRexKeptReplacedHTML'), ctx);
const before = { main: { recipeName: 'Tandoori Pork', manual: 'Tandoori Pork' }, starch: { recipeName: 'Rice Pilaf', displayText: 'Rice' },
  vegside: { manual: 'Green Beans' }, veganalt: { recipeName: 'Blackened Tofu', displayText: 'Blackened Tofu' } };
const after = { main: { recipeName: 'BBQ Chicken Legs', displayText: 'BBQ Chicken Leg' }, starch: { recipeName: 'Rice Pilaf', displayText: 'Rice' },
  xtra: { manual: 'Coleslaw' }, veganalt: { recipeName: 'Blackened Tofu', displayText: 'Roasted Tofu' } };

test('U4-1 the model compares the meal as stored with what Save builds, plate by plate', () => {
  const m = JSON.parse(JSON.stringify(ctx.doorRexKeptModel(before, after, { hasPork: true, hasDairy: true }, { hasDairy: true, hasChicken: true })));
  const reg = m.lines.find((l) => l.label === 'Regular plate').rows;
  assert.deepEqual(reg.map((r) => r.kind), ['replaced', 'kept', 'removed', 'added']);
  assert.equal(reg[0].nowLink, 'BBQ Chicken Legs', 'the link Save writes, not a guess');
  assert.equal(m.lines.find((l) => l.label === 'Vegan plate').rows[0].kind, 'replaced');
  assert.deepEqual([m.flagsAdded, m.flagsOff, m.flagsKept], [['hasChicken'], ['hasPork'], ['hasDairy']]);
});
test('U4-2 the words: each plate named, links shown, a same recipe under new words said so, no link said so', () => {
  const h = ctx.doorRexKeptReplacedHTML(ctx.doorRexKeptModel(before, after, { hasPork: true }, { hasChicken: true }), 'rotation');
  assert.match(h, /Regular plate:<\/strong> changes Tandoori Pork .*\(Tandoori Pork\).* &rarr; BBQ Chicken Leg .*\(BBQ Chicken Legs\)/);
  assert.match(h, /&minus; Green Beans/);
  assert.match(h, /\+ Coleslaw .*\(no recipe link\)/);
  assert.match(h, /keeps Rice .*\(Rice Pilaf\)/);
  assert.match(h, /Vegan plate:<\/strong> changes Blackened Tofu &rarr; Roasted Tofu .*same recipe, Blackened Tofu, new words/);
  assert.match(h, /added: Chicken · coming off: Pork/);
  assert.match(h, /As Save will write it with the answers below/);
});
test('U4-3 Keep DOOR’s says nothing changes; names are escaped', () => {
  assert.match(ctx.doorRexKeptReplacedHTML(ctx.doorRexKeptModel(before, after, {}, {}), 'keep'), /Keeping DOOR’s meal: nothing changes/);
  const h = ctx.doorRexKeptReplacedHTML(ctx.doorRexKeptModel({}, { xtra: { manual: '<b>x</b>' } }, {}, {}), 'rotation');
  assert.ok(!h.includes('<b>x</b>') && h.includes('&lt;b&gt;'));
});
test('U4-4 it reads doorRexBuildMeal with the answers on screen, and redraws on every change', () => {
  const f = fn('doorRexKeptFor');
  assert.match(f, /doorRexBuildMeal\(m, door, ans, ctx\)/);
  assert.match(fn('doorRexKeptAnswers'), /doorRexReadAnswers\(root\)/);
  assert.match(fn('doorRexKeptAnswers'), /m\.removeDefault \? \(m\.removeFlags \|\| \[\]\)\.slice\(\) : \[\]/, 'before the screen exists, the default ticks');
  const r = fn('doorRenderRexWeekReview');
  assert.match(r, /overlay\.addEventListener\('change', \(\) => doorRexRefreshKept\(overlay\)\);/);
  assert.match(r, /overlay\.addEventListener\('input', \(\) => doorRexRefreshKept\(overlay\)\);/);
  assert.match(fn('doorRexQuestionHTML'), /<\/tbody><\/table><\/div>' \+ doorRexKeptSlot\(m\) \+ notes/);
  assert.match(fn('doorRexAutoHTML'), /doorRexKeptSlot\(m\) \+ doorRexAddsHTML\(m\)/);
});
