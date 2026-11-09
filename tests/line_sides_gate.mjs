// W3b, 2026-11-08 (Week 3 post-mortem log 5; Jason: per-side line versions, vegan and halal together, existing lines
// read in on open). Prevents: saving a meal in Edit Menu rewriting its vegan line to the regular sides. Before this,
// 9 of the 55 published lunches and dinners (Vegan Cornbread, buns, Turmeric Quinoa…) would have lost their vegan
// sides on their next save, and the vegan plate's allergens followed the regular sides.
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
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}
const CONSTS = "const DOOR_LINE_SIDE_IDS = ['starch', 'vegside', 'xtra']; const DOOR_LINE_EXTRAS = { vegan: 'vegextras', halal: 'halalextras' };";
function box(extra) {
  const c = Object.assign({}, extra || {});
  vm.createContext(c);
  vm.runInContext(CONSTS + '\n' + ['doorDeriveLineVersions', 'doorLinePieces', 'doorLineHasOwnSides', '_slotText', 'doorJoinLine'].map(fnBlock).join('\n') +
    '\nthis.f = { doorDeriveLineVersions, doorLinePieces, doorLineHasOwnSides, _slotText, doorJoinLine };', c);
  return c.f;
}
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const same = (a, b) => norm(a) === norm(b);
const pieces = (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean);

test('every published meal\'s vegan line survives being read in and saved again', () => {
  const F = box();
  const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'menu_current.json'), 'utf8')).menu;
  let checked = 0, differing = 0;
  for (const [w, days] of Object.entries(menu)) for (const [day, d] of Object.entries(days)) for (const p of ['lunch', 'dinner']) {
    const reg = pieces(d[p]), veg = pieces(d[p + '_veg']);
    if (!veg.length) continue;
    checked++;
    const sideIds = ['starch', 'vegside', 'xtra'];
    const sides = reg.slice(1, 4).map((text, i) => ({ id: sideIds[i], text }));
    const vegSides = veg.slice(1);
    if (!vegSides.length) continue;   // a vegan line naming no sides keeps the shared ones
    const dv = out(F.doorDeriveLineVersions(sides, vegSides, same));
    const rebuilt = [veg[0]];
    sides.forEach((sd) => { const v = dv.versions[sd.id]; if (!v) rebuilt.push(sd.text); else if (v.mode === 'swap') rebuilt.push(v.text); });
    rebuilt.push(...dv.extras);
    if (Object.keys(dv.versions).length || dv.extras.length) differing++;
    assert.deepEqual(rebuilt.map(norm).sort(), veg.map(norm).sort(), `Wk${w} ${day} ${p}: the vegan line comes back as it was`);
  }
  assert.ok(checked >= 50, 'the whole menu was read (' + checked + ')');
  assert.ok(differing >= 6, 'the meals whose vegan line differs were exercised (' + differing + ')');
});

test('the read-in pairs a vegan swap by its words, and leaves extras as extras', () => {
  const F = box();
  const cornbread = out(F.doorDeriveLineVersions([{ id: 'starch', text: 'Cornbread' }, { id: 'vegside', text: 'Sautéed Cabbage' }],
    ['Vegan Cornbread', 'Sautéed Cabbage (no butter)'], same));
  assert.deepEqual(cornbread.versions.starch, { mode: 'swap', text: 'Vegan Cornbread' });
  assert.deepEqual(cornbread.versions.vegside, { mode: 'swap', text: 'Sautéed Cabbage (no butter)' });
  const quinoa = out(F.doorDeriveLineVersions([{ id: 'starch', text: 'Garlic Bread' }], ['Tumeric Quinoa', 'Garlic Bread'], same));
  assert.deepEqual(quinoa.versions, {});
  assert.deepEqual(quinoa.extras, ['Tumeric Quinoa']);
  const dropped = out(F.doorDeriveLineVersions([{ id: 'xtra', text: 'Tzatziki' }], ['Rice'], same));
  assert.deepEqual(dropped.versions.xtra, { mode: 'none' }, 'a side the line leaves out, with nothing like it, is not served');
});

test('a line gets each side\'s version, skips a side it doesn\'t get, then its extras; the other line is untouched', () => {
  const F = box();
  const slots = {
    veganalt: { manual: 'Vegan Chili' },
    starch: { manual: 'Cornbread', flags: { hasDairy: true, hasGluten: true }, lines: { vegan: { mode: 'swap', manual: 'Vegan Cornbread', flags: { hasGluten: true } } } },
    vegside: { manual: 'Sautéed Cabbage', flags: {}, lines: { halal: { mode: 'none' } } },
    vegextras: { manual: 'Burger bun', flags: { hasGluten: true } }
  };
  assert.deepEqual(out(F.doorLinePieces(slots, 'vegan')).map(F._slotText), ['Vegan Chili', 'Vegan Cornbread', 'Sautéed Cabbage', 'Burger bun']);
  assert.deepEqual(out(F.doorLinePieces(slots, 'halal', ['starch', 'vegside', 'xtra'])).map(F._slotText), ['Cornbread'], 'halal: the shared cornbread, no cabbage');
  assert.equal(F.doorLineHasOwnSides(slots, 'vegan'), true);
  assert.equal(F.doorLineHasOwnSides({ starch: { manual: 'Rice' } }, 'vegan'), false);
});

test('the vegan plate\'s allergens follow what the vegan line gets', () => {
  const flagsAt = html.indexOf('function flagsToAllergenStr(');
  assert.ok(flagsAt > 0);
  const F = box();
  const c = { doorLinePieces: F.doorLinePieces, DOOR_RECIPE_DATA: [], flagsToAllergenStr: (f) => Object.keys(f || {}).filter((k) => f[k]).map((k) => k.replace(/^has/, '')).join(', ') };
  vm.createContext(c);
  vm.runInContext(fnBlock('getVegAltSlotAllergenStr') + '\nthis.g = getVegAltSlotAllergenStr;', c);
  const s = c.g({ veganalt: { manual: 'Vegan Chili', flags: {} },
    starch: { manual: 'Cornbread', flags: { hasDairy: true, hasGluten: true }, lines: { vegan: { mode: 'swap', manual: 'Vegan Cornbread', flags: { hasGluten: true } } } },
    vegextras: { manual: 'Turmeric Quinoa', flags: { hasSesame: true } } });
  assert.ok(/GLUTEN/.test(s) && /SESAME/.test(s), s);
  assert.ok(!/DAIRY/.test(s), 'the regular cornbread\'s Dairy doesn\'t reach the vegan plate: ' + s);
});

test('Edit Menu keeps the versions: snapshot, open, Save (vegan and halal), the list slots, the side controls', () => {
  assert.match(fnBlock('_buildSlotSnapshot'), /snap\[d\.id\]\.lines = JSON\.parse\(JSON\.stringify\(s\.lines\)\)/);
  assert.match(fnBlock('openMenuEdit'), /doorReadInLineVersions\(dayData, period\)/);
  assert.match(fnBlock('_finishMenuSave'), /buildHalalLine\(\)[\s\S]{0,160}\[period \+ '_halal'\] = _halalLine/);
  assert.match(fnBlock('buildVegAltFlags'), /doorLinePieces\(MEAL_SLOT_STATE, 'vegan'\)/);
  assert.match(fnBlock('buildHalalAltFlags'), /doorLinePieces\(MEAL_SLOT_STATE, 'halal'/);
  assert.match(fnBlock('doorRunOnSlots'), /def\.list/, 'an "also gets" list is not asked about as several dishes');
  assert.match(html, /id:'vegextras',\s+label:'Vegan line also gets'/);
  assert.match(html, /id:'halalextras', label:'Halal line also gets'/);
  assert.match(fnBlock('renderSlotCard'), /_slotLinesHTML\(def\.id\)/);
});

test('Rex\'s import turns a vegan line\'s own sides into versions and extras', () => {
  const api = rexWeekBox(ROOT);
  const W1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/rex_week/Week 1 - Menu Oct 25 - Oct 31 -.rows.json'), 'utf8'));
  const rex = api.doorReadRexWeekRows(W1);
  const week = out(historical.menu['1']);
  const plan = out(api.doorPlanRexWeek(rex, week, rexCtx(api, { datesFrom: '2026-10-25', today: '2026-10-29' })));
  const F = box();
  let checked = 0;
  plan.meals.filter((m) => m.period !== 'breakfast').forEach((m) => {
    const built = out(api.doorRexBuildMeal(m, week[m.day], {}, rexCtx(api)));
    const vegSides = m.lines.veg.merged.slice(1).map(norm).sort();
    if (!vegSides.length || !m.lines.veg.merged[0]) return;
    const own = ['starch', 'vegside', 'xtra'].some((id) => built.slots[id] && built.slots[id].lines) || !!built.slots.vegextras;
    const regSides = m.lines.reg.merged.slice(1).map(norm).sort();
    if (JSON.stringify(regSides) === JSON.stringify(vegSides)) assert.ok(!own, m.key + ': same sides, no versions');
    // The vegan line rebuilt from the saved slots is Rex's vegan line.
    const rebuilt = pieces(F.doorJoinLine(out(F.doorLinePieces(built.slots, 'vegan').map(F._slotText)))).map(norm).sort();   // the line as written
    assert.deepEqual(rebuilt, m.lines.veg.merged.map(norm).sort(), m.key + ': the slots give back Rex\'s vegan line');
    checked++;
  });
  assert.ok(checked > 5, 'meals checked: ' + checked);
});
