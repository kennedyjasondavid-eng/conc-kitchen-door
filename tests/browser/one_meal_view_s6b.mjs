// S6b of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): one meal view.
// D5, Jason 2026-11-19: "Follow lean". A meal cell opens the meal view (no Edit mode needed); the old panel (Routing,
// Swap Meal, Edit Flags, Make Permanent) and Test Meal are gone; the deep link still opens the meal; and changing the
// halal main updates the halal line the plating sheet prints (it printed the stored old dish first).
// Real app in Chromium, the published menu, network blocked, no resident data.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 600) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const browser = await chromium.launch();
async function boot(width) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => { window.publishAndSync = () => {}; window.doorAsk = async () => true; showScreen('menu-config'); });
  return p;
}
try {
  for (const width of [1280, 390]) {
    const p = await boot(width);
    // 1. A meal cell opens the meal view, without Edit mode.
    const open = await p.evaluate(() => {
      const cell = [...document.querySelectorAll('#mc-grid-body td')].find((td) => typeof td.onclick === 'function');
      cell.click();
      const panel = document.getElementById('mc-menu-edit-panel');
      return { shown: panel && panel.style.display !== 'none', key: mcMenuEditKey, old: !!document.getElementById('mc-edit-panel'), test: !!document.getElementById('mc-test-meal-panel'),
        buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /Test Meal|Make Permanent|Edit Flags|Swap Meal/.test(t)) };
    });
    check(width + ' a meal cell opens the meal view, without Edit mode', open.shown && /^\d-[A-Z]+-(breakfast|lunch|dinner)$/.test(open.key || ''), open);
    check(width + ' the old panel and Test Meal are gone, with their buttons', !open.old && !open.test && open.buttons.length === 0, open);
    await p.close();
  }
  // 2. The deep link still opens the meal.
  const q = await boot(1280);
  await q.evaluate(() => { location.hash = '#menu-config/edit/2/TUESDAY/lunch'; });
  await q.waitForFunction(() => mcMenuEditKey === '2-TUESDAY-lunch', null, { timeout: 12000 }).catch(() => {});
  check('the deep link #menu-config/edit/… still opens the meal', await q.evaluate(() => mcMenuEditKey === '2-TUESDAY-lunch'), await q.evaluate(() => mcMenuEditKey));
  // 3. Changing the halal main updates the halal line the sheet prints.
  const halal = await q.evaluate(async () => {
    closeMenuEdit(true);
    openMenuEdit(1, 'TUESDAY', 'dinner');
    const was = getMenuData()['1'].TUESDAY.dinner_halal;
    slotAutoSave('mainalt', 'Halal Lamb Kofta', 'enter');
    updateSlotSummary();
    await saveMenuEdit();
    const now = getMenuData()['1'].TUESDAY.dinner_halal;
    const pd = computePlatingData('dinner', 1, 'TUESDAY', []);
    const sheet = pd && typeof pd.ctx === 'object' ? JSON.stringify(pd.ctx.mealHalal) : '';
    closeMenuEdit(true);
    // Unchanged halal main: the stored line is kept.
    openMenuEdit(1, 'FRIDAY', 'dinner');
    const keepWas = getMenuData()['1'].FRIDAY.dinner_halal;
    slotAutoSave('vegside', 'Steamed Kale', 'enter');
    updateSlotSummary();
    await saveMenuEdit();
    const keepNow = getMenuData()['1'].FRIDAY.dinner_halal;
    closeMenuEdit(true);
    return { was, now, sheet, keepWas, keepNow };
  });
  check('changing the halal main updates the halal line the sheet prints', /Halal Chicken carnitas/.test(halal.was) && /Halal Lamb Kofta/.test(halal.now) && /Halal Lamb Kofta/.test(halal.sheet), halal);
  check('an unchanged halal main keeps the stored halal line', halal.keepNow === halal.keepWas && !!halal.keepWas, halal);
  await q.close();
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
