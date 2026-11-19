// S6a of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): "Just on <date>".
// D1, Jason 2026-11-19: "Go with lean". The meal view chooses Every week or Just on the next date. Just on writes a
// whole-meal entry to meal_swaps.json the way Swap Slots does, so EXPO, HUB, the plating sheet and the routing file read
// it as a swap; the every-week meal is untouched; revert takes it back. Breakfast is refused, and so is a date that
// already holds a swap or a special meal. Real app in Chromium, the published menu, network blocked, no resident data.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 700) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const browser = await chromium.launch();
async function boot(width) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => {
    window.publishAndSync = () => {};
    // Answer Save questions with their default (go) so a save runs through.
    window.doorAsk = async (q) => { (window.__asked = window.__asked || []).push(q.title); return true; };
    showScreen('menu-config');
  });
  return p;
}
// The edit both saves make: Steamed Kale as the vegetable side.
const EDIT = "slotAutoSave('vegside', 'Steamed Kale', 'enter'); updateSlotSummary();";
try {
  // 1. Just on writes a whole-meal swap for the next date; the every-week meal is untouched.
  const p = await boot(1280);
  const a = await p.evaluate(async (edit) => {
    openMenuEdit(2, 'TUESDAY', 'lunch');
    const choice = document.getElementById('mc-when-choice').textContent;
    eval(edit);
    const baseBefore = localStorage.getItem('concMenuBase');
    doorSetSaveWhen('date');
    const panel = document.getElementById('mc-what-changes').textContent;
    const t = doorJustOnTarget('2-TUESDAY-lunch');
    const ok = await saveMenuEdit();
    const entry = loadMealSwaps()[t.key] || null;
    const plating = computePlatingData('lunch', 2, 'TUESDAY');
    return { choice, panel, ok, key: t.key, entry, baseSame: localStorage.getItem('concMenuBase') === baseBefore,
      platingName: plating && plating.mealName, dated: plating && plating.dated && plating.dated.kind, status: document.getElementById('mc-footer-status').textContent };
  }, EDIT);
  check('the meal view offers Every week and Just on the next date', /Every week/.test(a.choice) && /Just on /.test(a.choice), a.choice);
  check('What changes says it is for that date only', /What changes \(just on /.test(a.panel), a.panel.slice(0, 200));
  check('Just on writes a one-date entry with the whole meal, and the every-week meal is untouched',
    a.ok === true && a.entry && a.entry._rotationSlot === '2-TUESDAY-lunch' && a.entry._meal && a.entry._meal[''] === a.entry.specialName && /Steamed Kale/.test(a.entry.specialName) && a.baseSame, a);
  // EXPO reader rules (conc-kitchen-expo index.html, _setDoorDatedMeals and _datedMealFor): a date-meal key, a
  // non-empty specialName, and the whole meal read only while _meal[''] equals that name.
  check('EXPO reads the entry as a whole moved meal', /^\d{4}-\d{2}-\d{2}-(lunch|dinner)$/.test(a.key) && String(a.entry.specialName).trim() && a.entry._meal[''] === a.entry.specialName && a.entry.createdAt, a.entry && Object.keys(a.entry));
  check('the plating sheet serves it on that date, marked as a swap', a.dated === 'swap' && /Steamed Kale/.test(a.platingName || ''), a);
  check('the saved line says it is for that date only and how to take it back', /only/.test(a.status) && /Active Swaps/.test(a.status), a.status);

  // 2. The same edit saved every week gives the same whole meal Swap Slots and Just on carry.
  const same = await p.evaluate(async (args) => {
    const [edit, entry] = args;
    revertSwapFromBanner(Object.keys(loadMealSwaps()).find((k) => loadMealSwaps()[k]._rotationSlot === '2-TUESDAY-lunch'));
    openMenuEdit(2, 'TUESDAY', 'lunch');
    eval(edit);
    await saveMenuEdit();
    const stored = doorMealCopy(getMenuData()['2'].TUESDAY, 'lunch');
    const norm = (m) => { const c = JSON.parse(JSON.stringify(m)); delete c._original; return JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]])); };
    return { same: norm(stored) === norm(entry._meal), stored: norm(stored).slice(0, 300), entry: norm(entry._meal).slice(0, 300), swapsLeft: Object.keys(loadMealSwaps()).length };
  }, [EDIT, a.entry]);
  check('the entry carries the same whole meal an every-week save of the same change writes', same.same, same);
  check('revert takes the one-date change back', same.swapsLeft === 0, same);

  // 2b. Review fold: a one-date change that keeps the meal name (ticks only) is listed in Active Swaps with its Revert,
  // with no unpaired-swap warning; Undo Last points to Revert; the change log names it; the saved line is not amber.
  const tick = await p.evaluate(async () => {
    openMenuEdit(3, 'MONDAY', 'dinner');
    const cb = document.getElementById('mc-edit-flag-hasSesame'); if (cb && !cb.checked) cb.click();
    updateSlotSummary();
    doorSetSaveWhen('date');
    await saveMenuEdit();
    const status = document.getElementById('mc-footer-status');
    const amber = /warn/.test(status.getAttribute('style') || '');
    const key = Object.keys(loadMealSwaps()).find((k) => loadMealSwaps()[k]._rotationSlot === '3-MONDAY-dinner');
    const entry = loadMealSwaps()[key];
    closeMenuEdit(true);
    renderMenuConfig();
    if (typeof renderSwapsBanner === 'function') renderSwapsBanner();
    const list = (document.getElementById('mc-swaps-list') || {}).innerHTML || '';
    let alerted = '';
    const was = window.alert; window.alert = (m) => { alerted = m; };
    await revertLastChange();
    window.alert = was;
    renderChangeLog();
    const log = (document.getElementById('mc-log-entries') || {}).textContent || '';
    return { oneDate: entry && entry._oneDate, sameName: entry && entry.specialName === getMenuData()['3'].MONDAY.dinner,
      listed: !!key && list.includes(key), unpaired: /unpaired/.test(list), alerted, log: log.slice(0, 300), amber };
  });
  check('a one-date change that keeps the meal name is listed in Active Swaps with its Revert', tick.oneDate === true && tick.sameName && tick.listed, tick);
  check('a one-date change is never reported as an unpaired swap', !tick.unpaired, tick);
  check('Undo Last points to Revert for a one-date change, and the change log names it', /Revert on the Active Swaps banner/.test(tick.alerted) && /One-date change/.test(tick.log), tick);
  check('the saved line for a one-date change is not shown as a warning', !tick.amber, tick);

  // 3. Refused: breakfast; a date with a special meal; a date with a swap.
  const refused = await p.evaluate(async () => {
    openMenuEdit(1, 'MONDAY', 'breakfast');
    const bk = { text: document.getElementById('mc-when-choice').textContent, disabled: [...document.querySelectorAll('#mc-when-choice button')].some((b) => b.disabled && /Just on/.test(b.textContent)) };
    doorSetSaveWhen('date');
    bk.when = _doorSaveWhen;
    closeMenuEdit(true);
    const key = doorDateKey(nextDateForSlot(3, 'FRIDAY')) + '-dinner';
    const sm = loadSpecialMeals(); sm[key] = { specialName: 'Holiday Test Dinner', _flagsRaw: {} }; saveSpecialMeals(sm);
    openMenuEdit(3, 'FRIDAY', 'dinner');
    const special = { text: document.getElementById('mc-when-choice').textContent };
    doorSetSaveWhen('date'); special.when = _doorSaveWhen;
    closeMenuEdit(true);
    const key2 = doorDateKey(nextDateForSlot(4, 'WEDNESDAY')) + '-lunch';
    const sw = loadMealSwaps(); sw[key2] = { specialName: 'Swap Test Lunch', _flagsRaw: {}, _rotationSlot: '4-WEDNESDAY-lunch', createdAt: new Date().toISOString() }; saveMealSwaps(sw);
    openMenuEdit(4, 'WEDNESDAY', 'lunch');
    const swap = { text: document.getElementById('mc-when-choice').textContent };
    doorSetSaveWhen('date'); swap.when = _doorSaveWhen;
    closeMenuEdit(true);
    return { bk, special, swap };
  });
  check('Just on is refused for breakfast', refused.bk.disabled && refused.bk.when === 'week' && /not available for breakfast/.test(refused.bk.text), refused.bk);
  check('Just on is refused on a date with a special meal', refused.special.when === 'week' && /special meal \(Holiday Test Dinner\)/.test(refused.special.text), refused.special);
  check('Just on is refused on a date that already holds a one-date change', refused.swap.when === 'week' && /Swap Test Lunch/.test(refused.swap.text), refused.swap);
  await p.close();

  // 4. A phone: the choice fits.
  const q = await boot(390);
  const phone = await q.evaluate(() => { openMenuEdit(2, 'TUESDAY', 'lunch'); return document.documentElement.scrollWidth > window.innerWidth + 1; });
  check('the choice fits a phone without sideways scroll', !phone, phone);
  await q.close();
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
