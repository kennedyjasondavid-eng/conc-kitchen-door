// W3a, 2026-11-08 (Week 3 post-mortem rec. 4, log 3–4; Jason: "ticks follow the dish"). Prevents: a meal keeping the
// old main's allergen ticks after the main changes. On Week 3, leftover Pork ticks (Glazed Ham, hotdogs, pizza) made
// EXPO invent "Halal Chicken" dishes. Also prevents: linking a slot to a recipe dropping a Mushroom tick, which CODEX
// has no family for.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { historical } from './helpers/historical_menu.mjs';
import { rexWeekBox, rexCtx } from './helpers/rex_week_box.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));
const api = rexWeekBox(ROOT);
const W1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/rex_week/Week 1 - Menu Oct 25 - Oct 31 -.rows.json'), 'utf8'));
const CTX = () => rexCtx(api, { datesFrom: '2026-10-25', today: '2026-10-29' });
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}

// DOOR's Week 1 with one lunch whose main was Glazed Ham; Rex's sheet has the rotation's dish there.
function withHamLunch() {
  const rex = api.doorReadRexWeekRows(W1);
  const week = out(historical.menu['1']);
  const plain = out(api.doorPlanRexWeek(rex, week, CTX()));
  // A lunch whose rotation main names no pork or processed meat (deli meat really is processed, so that tick would stay).
  const target = plain.meals.find(m => m.period === 'lunch' && m.status === 'same' && !/pork|ham|bacon|sausage|deli|hot ?dog|salami|pepperoni/i.test(m.regText));
  assert.ok(target, 'a plain lunch to change');
  const D = week[target.day];
  const sides = String(D.lunch).split(',').slice(1).map(s => s.trim()).filter(Boolean);
  D.lunch = ['Glazed Ham'].concat(sides).join(', ');
  D.lunch_mainItem = 'Glazed Ham';
  D.lunch_flags = Object.assign({}, D.lunch_flags, { hasPork: true, hasProcessedMeat: true });
  D.lunch_slots = Object.assign({}, D.lunch_slots || {}, { main: { manual: 'Glazed Ham', flags: { hasPork: true, hasProcessedMeat: true } } });
  const p = out(api.doorPlanRexWeek(rex, week, CTX()));
  return { m: p.meals.find(x => x.key === target.key), D };
}

test('import: when the main changes, the old main\'s warnings are offered ticked, with before and after', () => {
  const { m } = withHamLunch();
  assert.equal(m.mainChanged, true);
  assert.equal(m.removeDefault, true, 'the old dish\'s ticks come off by default');
  for (const k of ['hasPork', 'hasProcessedMeat']) assert.ok(m.removeFlags.includes(k), k + ' offered to come off');
  assert.ok(m.beforeFlags.includes('hasPork'), 'before lists what the meal had');
  const ui = fnBlock('doorRexRemovalsHTML');
  assert.ok(ui.includes("(on ? ' checked' : '')"), 'the boxes start ticked when the main changed');
  assert.match(ui, /Before: [\s\S]{0,160}After: /, 'the review shows before and after');
});

test('import: saving with the review\'s default takes the Pork tick off; unticking keeps it', () => {
  const { m, D } = withHamLunch();
  const off = out(api.doorRexBuildMeal(m, D, { removeFlags: m.removeFlags }, rexCtx(api)));
  assert.equal(off.flags.hasPork, false);
  assert.equal(off.flags.hasProcessedMeat, false);
  const kept = out(api.doorRexBuildMeal(m, D, { removeFlags: [] }, rexCtx(api)));
  assert.equal(kept.flags.hasPork, true, 'an unticked box keeps the warning');
});

test('import: a meal whose main is the same keeps removals unticked (only a changed side\'s)', () => {
  const rex = api.doorReadRexWeekRows(W1);
  const p = out(api.doorPlanRexWeek(rex, out(historical.menu['1']), CTX()));
  p.meals.filter(x => !x.mainChanged).forEach(x => assert.ok(!x.removeDefault, x.key));
});

function carried(saved, slotMain, flags, slotFlags, detected) {
  const c = { getMenuData: () => ({ '3': { TUESDAY: saved } }), MEAL_SLOT_STATE: { main: slotMain } };
  vm.createContext(c);
  vm.runInContext(fnBlock('doorCarriedTicks') + '\nthis.f = doorCarriedTicks;', c);
  return out(c.f('3-TUESDAY-lunch', flags, slotFlags, detected));
}

test('Edit Menu: a new main finds the warnings only the old one gave', () => {
  const saved = { lunch: 'Glazed Ham, Rice', lunch_flags: { hasPork: true, hasProcessedMeat: true, hasGluten: true, isCarb: true },
    lunch_slots: { main: { manual: 'Glazed Ham' } } };
  const r = carried(saved, { recipeName: 'Ginger Tofu' }, { hasPork: true, hasProcessedMeat: true, hasGluten: true, hasSoy: true, isCarb: true },
    { hasGluten: true, hasSoy: true }, []);
  assert.deepEqual(r.list, ['hasPork', 'hasProcessedMeat']);
  assert.equal(r.oldMain, 'Glazed Ham');
  assert.equal(r.newMain, 'Ginger Tofu');
  assert.deepEqual(carried(saved, { manual: 'glazed ham' }, { hasPork: true }, {}, []).list, [], 'same dish: nothing asked');
  const meat = carried(saved, { manual: 'Ham & Pea Soup' }, { hasPork: true, hasProcessedMeat: true }, {}, ['hasPork']);
  assert.deepEqual(meat.list, ['hasProcessedMeat'], 'a meat the new name names stays');
});

test('Edit Menu: Save asks once, defaulting to take them off, then re-checks the open meal', () => {
  const save = fnBlock('saveMenuEdit');
  const at = save.indexOf('doorCarriedTicks(editKey');
  assert.ok(at > 0, 'Save looks for carried ticks');
  // 2026-11-09 (W3e): the question moved to doorTicksQuestion and names every tick Save would take off; a different
  // dish still defaults to Take them off (the same dish defaults to Keep them: w3e_slot_commit_ticks_gate 5).
  assert.match(save.slice(at, at + 1200), /await doorAsk\(ask\);\s*if \(mcMenuEditKey !== editKey\) return;[\s\S]{0,120}const takeOff = _carried\.sameDish \? ans === 'alt' : ans === true;/);
  assert.match(fnBlock('doorTicksQuestion'), /title: 'Take off the old dish’s warnings\?'[\s\S]{0,250}cancelLabel: 'Go back', altLabel: 'Keep them', goLabel: 'Take them off'/);
});

test('linking a slot keeps the Mushroom and Beans ticks CODEX has no family for', () => {
  const c = {};
  vm.createContext(c);
  const mapAt = html.indexOf('const HUB_ALLERGEN_MAP = {');
  const map = html.slice(mapAt, html.indexOf('\n};', mapAt) + 3);
  const defsAt = html.indexOf('const FLAG_DEFS = [');
  const defs = html.slice(defsAt, html.indexOf('\n];', defsAt) + 3);
  vm.runInContext(defs + '\n' + map +'\nconst _hubUnmappedLabels = new Set();\n' + fnBlock('_hubAllergenResolve') + '\n' + fnBlock('hubAllergenToFlags') +
    "\nconst DOOR_NON_CODEX_TICKS = ['hasMushroom', 'hasBeans'];\n" + fnBlock('doorLinkFlags') + '\nthis.f = doorLinkFlags;', c);
  const kept = out(c.f({ recipeName: 'Garden a la King', allergens: ['Milk (Cream)'] }, { manual: 'Garden a la King', flags: { hasMushroom: true } }));
  assert.equal(kept.hasMushroom, true, 'a hand Mushroom tick survives');
  assert.equal(kept.hasDairy, true);
  assert.equal(out(c.f({ recipeName: 'Soy-Free Mushroom Fried Rice', allergens: [] }, null)).hasMushroom, true, 'the recipe name says mushroom');
  assert.ok(!out(c.f({ recipeName: 'Rice', allergens: [] }, { manual: 'Rice', flags: { hasPork: true } })).hasPork, 'other old ticks don\'t carry over');
  for (const fn of ['slotSelect', 'slotAutoSave']) assert.match(fnBlock(fn), /doorLinkFlags\(/, fn + ' links through doorLinkFlags');
});
