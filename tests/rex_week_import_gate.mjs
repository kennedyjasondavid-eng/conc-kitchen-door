// tests/rex_week_import_gate.mjs — Rex's week sheet updates DOOR's menu (2026-10-29).
// Jason, 2026-10-29: "a way for Rex (or me) to update DOOR with new menus without parsing the changes ourselves, and
// using docs that are already being generated". Rex's menu is canon; DOOR reads the sheet, compares it with the
// rotation week and asks only about what it can't tell. Rulings (plan DOOR_REX_WEEK_IMPORT_PLAN_2026-10-29.md):
//   1 a change goes into the rotation; one that looks like two meals trading places defaults to those dates only;
//     every change is confirmed
//   2 steamed veg drift applies without a question, and the review says what it moves
//   3 the same dish written differently keeps DOOR's words; a different dish is asked once ("Keep DOOR's" remembered)
//   4 an empty Halal row means Rex didn't write it; non-pork meat is treated as halal; a pork meal with no halal plate
//     anywhere is asked
//   5 the meal row wins over the Veg rows; when the Veg row still names DOOR's dish the question says so
//   6 confirming publishes (the normal publish)
//   7 a dish with no CODEX recipe: link the closest one, or tick its allergens
// Rex's allergen rows are never used: allergens come from CODEX's recipes and the dish names, are added without
// asking, and come off only when ticked.
// Run on Rex's two sheets (tests/fixtures/rex_week/, as rows) against the published menu_current.json, with the baked
// recipe list (and CODEX's feed in test 11 when conc-recipe-hub is beside this repo). Authored to fail on 1ac3486.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rexWeekBox, rexCtx } from './helpers/rex_week_box.mjs';

const ROOT = process.env.REX_WEEK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const out = (v) => JSON.parse(JSON.stringify(v));
const api = rexWeekBox(ROOT);
const MENU = json('menu_current.json').menu;
const W4 = json('tests/fixtures/rex_week/Week 4 18 Oct - 24 Oct.rows.json');
const W1 = json('tests/fixtures/rex_week/Week 1 - Menu Oct 25 - Oct 31 -.rows.json');
const TODAY = '2026-10-29';   // Thu, Week 1
const plan = (rows, start, extra) => {
  const rex = api.doorReadRexWeekRows(rows);
  return out(api.doorPlanRexWeek(rex, MENU[String(rex.week)], rexCtx(api, Object.assign({ datesFrom: start, today: TODAY }, extra || {}))));
};
const byKey = (p) => Object.fromEntries(p.meals.map(m => [m.key, m]));
const changed = (m) => m.lines.reg.diffs.concat(m.lines.veg.diffs).filter(x => x.status !== 'same').map(x => (x.door || '∅') + ' → ' + (x.rex || '∅'));

test('1. the sheet is read: week, the three meals per line, halal rows, the Veg rows, breakfast sides', () => {
  const r4 = out(api.doorReadRexWeekRows(W4)), r1 = out(api.doorReadRexWeekRows(W1));
  assert.equal(r4.week, 4); assert.equal(r1.week, 1);
  assert.equal(r4.days.SUNDAY.lunch.reg, 'Pork Souvlaki, Naan, Seasonal Vegetables, Tzatziki');
  assert.equal(r4.days.SUNDAY.lunch.veg, 'Black bean patty, Naan, Seasonal Vegetables,Tzatziki');
  assert.equal(r4.days.SUNDAY.lunch.halal, 'Halal chicken Souvlaki');
  assert.deepEqual(r4.days.SUNDAY.lunch.vegRow, ['Naan', 'Carrot']);
  assert.deepEqual(r4.days.FRIDAY.lunch.vegRow, ['Lagsana', 'Zucchini & Carrot']);
  assert.deepEqual(r1.days.FRIDAY.lunch.vegRow, ['Potato Salad'], 'one Veg lunch cell on Friday');
  assert.equal(r4.days.WEDNESDAY.breakfast.reg, 'Vegetarian Frittata, fruit & yoghurt, roll', 'the unlabelled side rows join breakfast');
  assert.equal(r4.days.TUESDAY.dinner.allergens, '', 'Rex left Tuesday dinner’s allergen cell empty');
  assert.equal(r1.days.THURSDAY.dinner.allergens, 'Halal Chicken', 'and wrote meat in another: these rows are not used');
  assert.equal(api.doorReadRexWeekRows([['nothing here']]), null);
});

test('2. the week’s dates come from the file name', () => {
  const t = new Date(2026, 9, 29);
  assert.equal(api.doorRexWeekStartFromName('Week 4 18 Oct - 24 Oct.xlsx', t), '2026-10-18');
  assert.equal(api.doorRexWeekStartFromName('Week 1 - Menu Oct 25 - Oct 31 -.xlsx', t), '2026-10-25');
  assert.equal(api.doorRexWeekStartFromName('5d14c746-Week_4_18_Oct_-_24_Oct.xlsx', t), '2026-10-18', 'an upload prefix is not a date');
  assert.equal(api.doorRexWeekStartFromName('Week 2 Jan 3.xlsx', t), '2026-12-27', 'the nearest year; the week’s Sunday');
  assert.equal(api.doorRexWeekStartFromName('Week 1 menu.xlsx', t), '');
});

test('3. same dish or not (ruling 3)', () => {
  const same = [['Chicken Burger', 'Breaded Chicken Burgers'], ['Vegetarian Tacos', 'Vegan Tacos al Pastor'], ['Vegetarian Sandwich', 'Roasted Vegetable Sandwich'],
    ['Pork Tacos Al Pastor', 'Pork Al Pastor Taco'], ['Beef Strogonoff', 'Beef Stroganoff'], ['Gomen Besiga (with Vegetale)', 'Gomen Besiga with Vegetable'],
    ['Vegetarin Collard Stew', 'Vegetarian Collard Stew'], ['Teriyaki Chicken', 'Teriyaki Chicken Legs'], ['Vegetarian carnitas', 'Vegan Mushroom Carnitas']];
  const differ = [['Jerk Cauliflower', 'Jerk Tofu'], ['Roasted Tofu', 'Blackened Tofu'], ['Vegan Breakfast Patties Sandwich', 'Vegan Breakfast Sausage Sandwich'],
    ['Sweet Potato', 'Sweet Potato Biscuits'], ['Fish Curry', 'Fish Tacos']];
  same.forEach(([a, b]) => assert.ok(api.doorRexSameDish(a, b, false), a + ' = ' + b));
  differ.forEach(([a, b]) => assert.ok(!api.doorRexSameDish(a, b, false), a + ' ≠ ' + b));
  const sideSame = [['Broccoli', 'Steamed Broccoli'], ['Carrot', 'Steamed Carrots'], ['Green Bean', 'Green Beans'], ["Tortillas 7'", 'Tortillas'],
    ['Home Fries', 'Home Fry Potatoes'], ['Sweet Potato', 'Roasted Sweet Potatoes'], ['Pea & Carrots', 'Peas & Carrots']];
  const sideDiffer = [['Rice', 'Rice and Beans'], ['Potato', 'Potato Salad'], ['Noodles', 'Pasta'], ['Side Soup', 'Side Salad'], ['Potato Hash', 'Potato Salad']];
  sideSame.forEach(([a, b]) => assert.ok(api.doorRexSameDish(a, b, true), a + ' = ' + b));
  sideDiffer.forEach(([a, b]) => assert.ok(!api.doorRexSameDish(a, b, true), a + ' ≠ ' + b));
});

test('4. Week 4 (Oct 18–24): 18 meals match, one steamed veg change applied, two questions; no dates left for "this week only"', () => {
  const p = plan(W4, '2026-10-18');
  const m = byKey(p);
  const notSame = p.meals.filter(x => x.status !== 'same').map(x => x.key + ':' + x.status);
  assert.deepEqual(notSame, ['4-SUNDAY-breakfast:ask', '4-TUESDAY-dinner:ask', '4-FRIDAY-lunch:auto']);
  assert.equal(p.meals.filter(x => x.status === 'same').length, 18);
  // "Seasonal" reads the Veg row and matches DOOR's words
  assert.deepEqual(m['4-SUNDAY-lunch'].lines.reg.merged, ['Pork Souvlaki', 'Naan', 'Steamed Carrots', 'Tzatziki']);
  assert.equal(m['4-SATURDAY-lunch'].status, 'same', 'Seasonal Veg = the Veg row’s Broccoli = Steamed Broccoli');
  assert.equal(m['4-WEDNESDAY-dinner'].status, 'same', 'a DOOR side the Veg row still names stays (Potatoes on the vegan line)');
  // the steamed veg: applied, Brassicas offered to take off, never taken off unasked
  assert.deepEqual(changed(m['4-FRIDAY-lunch']), ['Cauliflower & Carrot → Zucchini & Carrot', 'Cauliflower & Carrot → Zucchini & Carrot']);
  assert.deepEqual(m['4-FRIDAY-lunch'].removeFlags, ['hasBrassicas']);
  assert.deepEqual(changed(m['4-TUESDAY-dinner']), ['Roasted Yam → Roasted Sweet Potatoes', 'Peas & Carrots → Green Beans', 'Roasted Yam → Roasted Sweet Potatoes', 'Peas & Carrots → Green Beans']);
  assert.deepEqual(changed(m['4-SUNDAY-breakfast']), ['∅ → fruit & yoghurt', 'Vegan Breakfast Sausage Sandwich → Vegan Breakfast Patties Sandwich', '∅ → fruit & yoghurt']);
  p.meals.forEach(x => assert.ok(!x.choices.includes('week'), x.key + ': its date has passed'));
  assert.equal(m['4-SUNDAY-breakfast'].choices.includes('week'), false, 'breakfast is never a dated swap');
});

test('5. Week 1 (Oct 25–31): the six questions, the sheet against itself, the halal question, dates from today on', () => {
  const p = plan(W1, '2026-10-25');
  const m = byKey(p);
  assert.deepEqual(p.meals.filter(x => x.status !== 'same').map(x => x.key + ':' + x.status),
    ['1-SUNDAY-dinner:ask', '1-MONDAY-dinner:ask', '1-TUESDAY-lunch:ask', '1-THURSDAY-lunch:ask', '1-FRIDAY-breakfast:ask', '1-FRIDAY-lunch:ask']);
  assert.deepEqual(changed(m['1-FRIDAY-lunch']), ['Potato Salad → Potato Hash', 'Potato Salad → Potato Hash']);
  assert.deepEqual(m['1-FRIDAY-lunch'].conflicts, [{ rex: 'Potato Hash', door: 'Potato Salad', vegRow: 'Potato Salad' }], 'ruling 5: the Veg row still says Potato Salad');
  assert.deepEqual(m['1-SUNDAY-dinner'].conflicts, [{ rex: 'Noodles', door: 'Pasta', vegRow: 'Pasta' }]);
  assert.equal(m['1-FRIDAY-lunch'].defaultChoice, 'rotation', 'the meal row wins');
  assert.deepEqual(changed(m['1-MONDAY-dinner']), ['Jerk Tofu → Jerk Cauliflower']);
  assert.deepEqual(changed(m['1-TUESDAY-lunch']), ['Parsnip and Carrot → Parsnip', 'Blackened Tofu → Roasted Tofu', 'Parsnip and Carrot → Parsnip']);
  assert.deepEqual(changed(m['1-THURSDAY-lunch']), ['Side Salad → Side Soup', 'Side Salad → Side Soup']);
  assert.equal(m['1-THURSDAY-lunch'].halal.ask, true, 'ruling 4: a pork meal with no halal dish anywhere is asked');
  assert.equal(m['1-TUESDAY-dinner'].status, 'same', 'Halal Chicken carnitas = DOOR’s');
  assert.equal(m['1-FRIDAY-dinner'].status, 'same');
  assert.equal(m['1-MONDAY-lunch'].status, 'same', 'Chicken Burger, Home Fries = Breaded Chicken Burgers, Home Fry Potatoes');
  assert.deepEqual(m['1-THURSDAY-lunch'].choices, ['rotation', 'week', 'keep'], 'Thu Oct 29 is today');
  assert.deepEqual(m['1-SUNDAY-dinner'].choices, ['rotation', 'keep'], 'Sun Oct 25 has passed');
  assert.ok(m['1-FRIDAY-lunch'].newDishes.some(n => n.piece === 'Potato Hash'), 'ruling 7: Potato Hash is no CODEX recipe');
  assert.ok(!m['1-SUNDAY-dinner'].newDishes.length, 'a plain staple (Noodles) needs no recipe');
  assert.ok(!m['1-FRIDAY-breakfast'].newDishes.length, 'breakfasts carry no recipe links');
});

test('6. two meals trading places default to those dates only (ruling 1)', () => {
  const rows = out(W1);
  const lunchRow = rows.findIndex(r => String(r[0]).trim().toUpperCase() === 'LUNCH');
  const vegRow = lunchRow + 1;
  // Rex swaps Thursday's and Friday's lunches (both still ahead on Oct 29)
  [lunchRow, vegRow].forEach(r => { const t = rows[r][5]; rows[r][5] = rows[r][6]; rows[r][6] = t; });
  const m = byKey(plan(rows, '2026-10-25'));
  assert.equal(m['1-THURSDAY-lunch'].swapWith, '1-FRIDAY-lunch');
  assert.equal(m['1-FRIDAY-lunch'].swapWith, '1-THURSDAY-lunch');
  assert.equal(m['1-THURSDAY-lunch'].defaultChoice, 'week');
  assert.equal(m['1-FRIDAY-lunch'].defaultChoice, 'week');
  // the same swap a week too late (its dates passed): every cycle, still asked
  const late = byKey(plan(rows, '2026-10-18'));
  assert.equal(late['1-THURSDAY-lunch'].defaultChoice, 'rotation');
});

test('7. "Keep DOOR’s" is remembered until the sheet changes that meal (ruling 3)', () => {
  const first = byKey(plan(W1, '2026-10-25'));
  const remembered = { '1-MONDAY-dinner': { rexSig: first['1-MONDAY-dinner'].rexSig, answer: 'keep', at: '2026-10-29T13:00:00Z', by: 'Jason' } };
  const again = byKey(plan(W1, '2026-10-25', { remembered }));
  assert.equal(again['1-MONDAY-dinner'].status, 'kept');
  assert.equal(again['1-MONDAY-dinner'].keptBy, 'Jason');
  const rows = out(W1);
  const r = rows.findIndex(x => String(x[0]).trim().toUpperCase() === 'DINNER') + 1;
  rows[r][2] = 'Jerk Jackfruit, Cabbage stirfry, Rice and Beans';
  assert.equal(byKey(plan(rows, '2026-10-25', { remembered }))['1-MONDAY-dinner'].status, 'ask', 'a different dish on the sheet is asked again');
});

test('8. Rex’s allergen rows decide nothing; allergens come off only when ticked', () => {
  const rows = out(W1);
  rows.forEach((r, i) => { if (/^ALLERGEN/i.test(String(r[0]).trim())) rows[i] = [r[0], 'peanuts', 'peanuts', 'none', '', 'fish', 'shellfish', 'sesame']; });
  assert.deepEqual(plan(rows, '2026-10-25'), plan(W1, '2026-10-25'));
  const p = byKey(plan(W4, '2026-10-18'));
  const fri = p['4-FRIDAY-lunch'];
  const kept = out(api.doorRexBuildMeal(fri, MENU['4'].FRIDAY, {}, rexCtx(api)));
  assert.equal(kept.text, 'Beef lasagna, Zucchini & Carrot');
  assert.equal(kept.flags.hasBrassicas, true, 'unticked: DOOR keeps the warning');
  const off = out(api.doorRexBuildMeal(fri, MENU['4'].FRIDAY, { removeFlags: ['hasBrassicas', 'hasGluten'] }, rexCtx(api)));
  assert.equal(off.flags.hasBrassicas, false, 'ticked: taken off');
  assert.equal(off.flags.hasGluten, true, 'only a flag the review offered can come off');
  // a new dish's allergens are added without asking
  const m1 = byKey(plan(W1, '2026-10-25'));
  const hash = out(api.doorRexBuildMeal(m1['1-FRIDAY-lunch'], MENU['1'].FRIDAY, { ticks: { 'reg|Potato Hash': ['hasDairy'] }, links: { 'reg|Potato Hash': '' } }, rexCtx(api)));
  assert.equal(hash.flags.hasDairy, true, 'a ticked allergen on a dish with no recipe');
  assert.equal(hash.flags.hasNightshades, true, 'potato, read from the name');
});

test('9. the saved meal: DOOR’s words and slots for what is the same, Rex’s for what changed (rulings 1, 3, 4)', () => {
  const m1 = byKey(plan(W1, '2026-10-25'));
  const fri = out(api.doorRexBuildMeal(m1['1-FRIDAY-lunch'], MENU['1'].FRIDAY, {}, rexCtx(api)));
  assert.equal(fri.fields.lunch, 'Honey BBQ Halal Chicken Drumsticks, Potato Hash');
  assert.equal(fri.fields.lunch_veg, 'Vegan Drumsticks, Potato Hash');
  assert.equal(fri.fields.lunch_mainItem, 'Honey BBQ Halal Chicken Drumsticks');
  assert.equal(fri.fields.lunch_sides, 'Potato Hash');
  assert.deepEqual(fri.slots.main, MENU['1'].FRIDAY.lunch_slots.main, 'the main is the same: DOOR’s slot (and its recipe link) stays');
  assert.ok(!('lunch_noPorkAlt' in fri.fields), 'the main is the same: its alternatives are untouched');
  const tue = out(api.doorRexBuildMeal(m1['1-TUESDAY-lunch'], MENU['1'].TUESDAY, {}, rexCtx(api)));
  assert.equal(tue.fields.lunch, 'Blackened Fish, Sweet potatoes, Parsnip');
  assert.equal(tue.fields.lunch_veg, 'Roasted Tofu, Sweet potatoes, Parsnip');
  assert.equal(tue.slots.veganalt.flags.hasSoy, true, 'the new vegan dish brings its soy');
  const thu = out(api.doorRexBuildMeal(m1['1-THURSDAY-lunch'], MENU['1'].THURSDAY, { halal: 'Halal Beef Sausage' }, rexCtx(api)));
  assert.equal(thu.fields.lunch_halal, 'Halal Beef Sausage');
  assert.equal(thu.flags.hasPork, true);
  // a main that changes from pork to chicken: non-pork meat is halal, the old halal line goes
  const rows = out(W1);
  const lunchRow = rows.findIndex(r => String(r[0]).trim().toUpperCase() === 'LUNCH');
  rows[lunchRow][5] = 'Chicken Shawarma Wrap, Seasonal Side';
  const thu2 = byKey(plan(rows, '2026-10-25'))['1-THURSDAY-lunch'];
  assert.equal(thu2.halal.ask, false);
  const b2 = out(api.doorRexBuildMeal(thu2, MENU['1'].THURSDAY, {}, rexCtx(api)));
  assert.equal(b2.flags.halalCertifiedMeat, true, 'non-pork meat is treated as halal');
  assert.equal(b2.fields.lunch_noPorkAlt, '', 'the old dish’s no-pork plate goes');
  assert.ok(thu2.removeFlags.includes('hasPork'), 'pork is offered to take off, not taken off unasked');
  assert.equal(b2.flags.hasPork, true);
  // a main that changes to pork: never halal-certified
  const rows3 = out(W1);
  rows3[lunchRow][2] = 'Pork Burger, Home Fries';
  const mon = byKey(plan(rows3, '2026-10-25'))['1-MONDAY-lunch'];
  assert.equal(mon.halal.ask, true);
  const b3 = out(api.doorRexBuildMeal(mon, MENU['1'].MONDAY, { halal: 'Halal Chicken Burger' }, rexCtx(api)));
  assert.equal(b3.flags.hasPork, true);
  assert.equal(b3.flags.halalCertifiedMeat, false);
  assert.equal(b3.fields.lunch_halal, 'Halal Chicken Burger');
});

test('10. the app: the Menu Config button, the review, and a save that goes through DOOR’s own writers', () => {
  assert.match(html, /id="mc-rex-week-btn" onclick="triggerRexWeekUpload\(\)"/);
  const save = html.slice(html.indexOf('async function doorSaveRexWeek('), html.indexOf('\n}\n', html.indexOf('async function doorSaveRexWeek(')));
  ['guardStandardMenuWrite(', 'doorMealCopy(doorStoredMenuDay(', 'doorSetMealFlags(', 'doorNoteMealChange(', 'doorSwapKeysForSlot(', 'saveMenuBaseOverlay(overlay)',
    'saveMealSwaps(swaps)', 'REVERTED_SWAP_KEYS.delete(', 'appendChangeLog(', "publishAndSync('Rex’s week sheet')", 'saveRexWeekAnswers('].forEach(s => assert.ok(save.includes(s), 'save uses ' + s));
  const review = html.slice(html.indexOf('function doorRenderRexWeekReview('), html.indexOf('function doorRexReadAnswers('));
  assert.ok(!/\bconfirm\(/.test(review + save), 'no browser confirm()');
  assert.ok(/allergen rows aren’t used/.test(html));
});

const FEED = path.join(ROOT, '..', 'conc-recipe-hub', 'DOOR_RECIPE_DATA.json');
test('11. with CODEX’s feed: new names find their recipes', { skip: !fs.existsSync(FEED) && 'conc-recipe-hub not beside this repo' }, () => {
  const recipes = JSON.parse(fs.readFileSync(FEED, 'utf8'));
  const m = byKey(plan(W1, '2026-10-25', { recipes }));
  const jerk = m['1-MONDAY-dinner'].newDishes.find(n => n.piece === 'Jerk Cauliflower');
  assert.equal(jerk && jerk.lean, 'Jerk Cauliflower Steaks', 'Jerk Cauliflower → the Jerk Cauliflower Steaks recipe, offered');
  assert.ok(!m['1-TUESDAY-lunch'].newDishes.length, 'Roasted Tofu is the Roast Tofu recipe');
  const w4 = byKey(plan(W4, '2026-10-18', { recipes }));
  assert.ok(!w4['4-TUESDAY-dinner'].newDishes.length, 'Roasted Sweet Potatoes is the Roasted Sweet Potato recipe');
  const tue = out(api.doorRexBuildMeal(m['1-TUESDAY-lunch'], MENU['1'].TUESDAY, {}, rexCtx(api, { recipes })));
  assert.equal(tue.slots.veganalt.recipeName, 'Roast Tofu');
  assert.equal(tue.slots.veganalt.displayText, 'Roasted Tofu', 'Rex’s words on the menu, the recipe’s allergens');
});
