// A No Spicy resident always has a plate (2026-10-16).
//
// On a pork day DOOR seats Bland / No Spicy residents with Gluten Free ("same plain meal — Roast Chicken, Rice,
// Veg"). When nothing on the meal is gluten, the Gluten Free section isn't active, so computeSections moved them
// into a pool it never printed: on the published menu, resident 310b (No Spicy) had no plate at W3 THU dinner,
// W4 TUE lunch and W4 FRI dinner (pork, spicy, no gluten). Found while adding the menu ticks Jason confirmed
// (2026-10-16): the Spicy tick on W2 TUE's Pork Vindaloo would have dropped 310b there too.
// The fix: they join Gluten Free only when that section is active; otherwise they keep their own Bland section.
// Authored to fail on b380cc5.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const start = html.indexOf(a); assert.ok(start >= 0, a); const end = html.indexOf(b, start); assert.ok(end > start, b); return html.slice(start, end); }
const sb = vm.createContext({});
vm.runInContext(between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='), sb);
const run = (flags, residents) => vm.runInContext(`computeSections(${JSON.stringify(flags)}, ${JSON.stringify(residents)})`, sb);
const seatOf = (out, room) => { const s = out.find((x) => x.residents.some((r) => r.room === room)); return s ? s.rule.key : null; };

const ROSTER = [
  { room: '101', tags: ['Regular'] }, { room: '310b', tags: ['No Spicy'] }, { room: '213', tags: ['Soft Meals', 'No Tree Nuts'] },
  { room: '402', tags: ['GF'] }, { room: '505', tags: ['Halal'] }, { room: '606', tags: ['Vegan'] }, { room: '707', tags: ['No Pork'] },
  { room: '808', tags: ['No Dairy'] }, { room: '909', tags: ['Diabetic'] }, { room: '111', tags: ['No Eggs'] }, { room: '222', tags: ['Bland Diet'] },
];

test('a No Spicy resident on a spicy pork meal with no gluten has a plate (their own Bland section)', () => {
  const out = run({ hasPork: true, isSpicy: true, isCarb: true }, ROSTER);
  assert.equal(seatOf(out, '310b'), 'bland');
});

test('…and on a spicy pork meal with gluten they still join Gluten Free, as the plating practice says', () => {
  const out = run({ hasPork: true, isSpicy: true, hasGluten: true }, ROSTER);
  assert.equal(seatOf(out, '310b'), 'gf');
  const gf = out.find((x) => x.rule.key === 'gf');
  assert.ok(gf && (gf._mergedLabels || []).includes('Bland'));
});

test('every resident is seated on every combination of meal flags', () => {
  const keys = ['hasPork', 'isSpicy', 'hasGluten', 'hasDairy', 'hasEgg', 'isCarb', 'hasBeef', 'halalCertifiedMeat'];
  const lost = [];
  for (let m = 0; m < (1 << keys.length); m++) {
    const flags = {};
    keys.forEach((k, i) => { if (m & (1 << i)) flags[k] = true; });
    const out = run(flags, ROSTER);
    const seated = new Set(out.flatMap((x) => x.residents.map((r) => r.room)));
    ROSTER.forEach((r) => { if (!seated.has(r.room)) lost.push(r.room + ' @ ' + JSON.stringify(flags)); });
  }
  assert.deepEqual(lost.slice(0, 10), []);
});

test('the other pork-day seatings are unchanged: Soft Meals with Halal, a non-spicy meal seats No Spicy as Regular', () => {
  const pork = run({ hasPork: true }, ROSTER);
  assert.equal(seatOf(pork, '213'), 'halal');
  assert.equal(seatOf(pork, '310b'), 'regular');
  const notPork = run({ isSpicy: true }, ROSTER);
  assert.equal(seatOf(notPork, '310b'), 'bland');
});

test('on the published menu and resident list, every resident is seated at every meal', () => {
  const menu = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8')).menu;
  const residents = JSON.parse(fs.readFileSync(new URL('../door_state.json', import.meta.url), 'utf8')).residents;
  const lost = [];
  Object.keys(menu).forEach((wk) => Object.keys(menu[wk]).forEach((day) => ['breakfast', 'lunch', 'dinner'].forEach((p) => {
    const flags = menu[wk][day] && menu[wk][day][p + '_flags'];
    if (!flags) return;
    const out = run(flags, residents);
    const seated = new Set(out.flatMap((x) => x.residents.map((r) => r.room)));
    residents.forEach((r) => { if (!seated.has(r.room)) lost.push(`W${wk} ${day} ${p}: ${r.room}`); });
  })));
  assert.deepEqual(lost, []);
});
