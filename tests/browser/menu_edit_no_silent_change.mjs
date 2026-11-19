// Edit Menu changes nothing nobody chose (2026-11-19, the Edit Menu walkthrough H2 and H4; Jason: "fix the two defects
// first"). Opening a meal focuses nothing; clicking away from a typed dish that was not changed leaves it as it is (it
// used to link a recipe of the same name and swap the dish's allergens); saving a meal with nothing changed writes
// nothing (it used to reword the menu text EXPO, HUB and the sheets read). Real app in Chromium, the published menu,
// network blocked, no resident data. Authored red on main a1059f4.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
// Wk4 SAT lunch as published: its main opens as the typed dish "Lime-Spiced Chicken Legs", read from the menu words,
// carrying the meal's ticks; CODEX has a recipe of exactly that name (the walkthrough's H4 case).
// Review fold (2026-11-19, P1): Wk3 SUN dinner made a meal whose one dish was linked while its label was not checked;
// CODEX now lists Peanuts for it. Opening and saving it must write the Peanuts tick (the "re-save the meal" step).
const sun = menu['3'].SUNDAY;
Object.assign(sun, { dinner: 'Audit Stew', dinner_veg: 'Audit Stew', dinner_mainItem: '', dinner_mainAlt: '', dinner_sides: '', dinner_halal: '',
  dinner_flags: {}, dinner_slots: { main: { recipeName: 'Audit Stew', recipeId: 'audit-stew', flags: {}, labelUnchecked: true } },
  dinner_altMeals: [], dinner_altMealsNone: true, dinner_softAlt: '', dinner_noPorkAlt: '' });
delete sun.dinner_original;
const browser = await chromium.launch();
async function boot(width) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript((m) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', '{}');
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, menu);
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => {
    DOOR_RECIPE_DATA = DOOR_RECIPE_DATA.concat([{ recipeName: 'Audit Lime Chicken', recipeId: 'audit-lime-chicken', allergens: ['Sulphites (Lime)'], category: 'protein', stream: 'regular' },
      { recipeName: 'Audit Stew', recipeId: 'audit-stew', allergens: ['Peanuts (Sauce)'], category: 'stew_main', stream: 'regular' }]);
    showScreen('menu-config');
  });
  return p;
}
const state = (p) => p.evaluate(() => ({ overlay: localStorage.getItem('concMenuBase'), bk: getMenuData()['1'].MONDAY.breakfast, open: !!mcMenuEditKey }));
try {
  for (const width of [1280, 390]) {
    // 1. Opening a meal focuses nothing.
    let p = await boot(width);
    await p.evaluate(() => openMenuEdit(1, 'MONDAY', 'breakfast'));
    await p.waitForTimeout(300);
    const focused = await p.evaluate(() => (document.activeElement && document.activeElement.id) || '');
    check(width + ' opening a meal focuses no dish box', !/^slot-search-/.test(focused), focused);
    // 2. Saving it with nothing changed writes nothing and keeps the menu words.
    const before = await state(p);
    const r = await p.evaluate(() => Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('asked a question'), 3000))]));
    await p.waitForTimeout(300);
    const after = await state(p);
    check(width + ' saving an unchanged meal writes nothing', after.overlay === before.overlay, { before: before.overlay.slice(0, 80), after: after.overlay.slice(0, 200) });
    check(width + ' the menu words stay as they were', after.bk === 'Pancakes, turkey bacon, fruit & yoghurt' && after.bk === before.bk, after.bk);
    check(width + ' the editor closes and says nothing changed (no question asked)', r === true && !after.open, r);
    await p.evaluate(() => { document.querySelectorAll('.door-ask').forEach((e) => e.remove()); });
    await p.close();
    // 3. Clicking away from a typed dish that was not changed leaves it, ticks and all.
    p = await boot(width);
    await p.evaluate(() => openMenuEdit(4, 'SATURDAY', 'lunch'));
    await p.waitForTimeout(300);
    const opened = await p.evaluate(() => JSON.parse(JSON.stringify(MEAL_SLOT_STATE.main)));
    await p.locator('#slot-search-main').focus();
    await p.locator('#mc-menu-edit-context').click();
    await p.waitForTimeout(200);
    const main = await p.evaluate(() => JSON.parse(JSON.stringify(MEAL_SLOT_STATE.main)));
    check(width + ' the main opens as a typed dish (the published case)', main && !!main.manual, main);
    check(width + ' an unchanged typed dish stays typed after a click away', main && main.manual === 'Lime-Spiced Chicken Legs' && !main.recipeName, main);
    check(width + ' its ticks stay as they opened', JSON.stringify(main && main.flags) === JSON.stringify(opened && opened.flags), [main && main.flags, opened && opened.flags]);
    check(width + ' the draft still reads unchanged', await p.evaluate(() => !doorMenuDraftIsDirty()));
    // 4. Typing the recipe name on purpose still links it (the change is the person's).
    await p.evaluate(() => slotAutoSave('main', 'audit lime chicken'));
    const linked = await p.evaluate(() => JSON.parse(JSON.stringify(MEAL_SLOT_STATE.main)));
    check(width + ' typing a recipe name on purpose still links it', linked && linked.recipeName === 'Audit Lime Chicken', linked);
    await p.close();
    // 5. Review fold P1: a label checked since the dish was linked still reaches the meal on an unchanged Save.
    p = await boot(width);
    await p.evaluate(() => openMenuEdit(3, 'SUNDAY', 'dinner'));
    await p.waitForTimeout(300);
    const r5 = await p.evaluate(() => Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('asked a question'), 3000))]));
    await p.waitForTimeout(300);
    const after5 = await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('concMenuBase') || '{}'); const d = (o['3'] || {}).SUNDAY || {};
      return { flags: d.dinner_flags || {}, slot: (d.dinner_slots || {}).main || null, text: getMenuData()['3'].SUNDAY.dinner }; });
    check(width + ' a label checked since: Save writes its new allergen', r5 === true && after5.flags.hasPeanuts === true, [r5, after5.flags]);
    check(width + ' the dish no longer waits for its label', after5.slot && after5.slot.labelUnchecked !== true, after5.slot);
    check(width + ' its menu words stay as they were', after5.text === 'Audit Stew', after5.text);
    await p.evaluate(() => { document.querySelectorAll('.door-ask').forEach((e) => e.remove()); });
    await p.close();
    // 6. A real one-field change still saves (a tick added on the meal grid).
    p = await boot(width);
    await p.evaluate(() => openMenuEdit(3, 'SUNDAY', 'dinner'));
    await p.waitForTimeout(300);
    await p.evaluate(() => { const cb = document.getElementById('mc-edit-flag-hasSesame'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
    const r6 = await p.evaluate(() => Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('asked a question'), 3000))]));
    await p.waitForTimeout(300);
    const f6 = await p.evaluate(() => ((((JSON.parse(localStorage.getItem('concMenuBase') || '{}'))['3'] || {}).SUNDAY || {}).dinner_flags) || {});
    check(width + ' a real change still saves', r6 === true && f6.hasSesame === true, [r6, f6]);
    await p.evaluate(() => { document.querySelectorAll('.door-ask').forEach((e) => e.remove()); });
    await p.close();
  }
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
