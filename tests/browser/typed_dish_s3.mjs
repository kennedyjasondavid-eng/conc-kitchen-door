// S3 of the Edit Menu redesign (D2, Jason 2026-11-19: "Follow lean"), in the real page: a typed dish the meal opened with
// reads quietly and changes nothing on open; a dish typed now asks "What does … contain?" in amber and the summary says
// "Allergens not set"; Nothing to declare answers it and Save writes the marker; Menu Config lists the typed dishes not
// answered. The published menu and overlay, network blocked, no resident data. Authored red on main 14d6198.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 500) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const browser = await chromium.launch();
async function boot(width) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    if (sessionStorage.getItem('_s')) return; sessionStorage.setItem('_s', '1');
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => { showScreen('menu-config'); window.doorAsk = async () => true; window.publishAndSync = () => {}; });
  return p;
}
try {
  for (const width of [1280, 390]) {
    const p = await boot(width);
    // 1. A typed dish the meal opened with reads quietly; opening changes nothing.
    // Re-pinned 2026-11-24: this opened Wk1 SUN dinner and expected its typed "Pasta". Rex's Week 1 sheet (publish
    // 2026-11-24 13:45) made it "Noodles" with a Gluten tick, and a tick answers a typed dish, so that meal has nothing
    // left to ask. The check now opens the first published lunch or dinner with a typed side (not the main box, which
    // carries the meal's ticks) still not answered, found by DOOR's own list, and expects that dish's name.
    const opened = await p.evaluate(() => {
      const pick = doorMealsTypedUnanswered().filter(x => x.period !== 'breakfast').map(x => {
        const slots = getMenuData()[x.week][x.day][x.period + '_slots'] || {};
        const id = DOOR_TYPED_DISH_IDS.find(k => k !== 'main' && doorTypedDishUnanswered(slots[k], k));
        return id ? { ...x, dish: String(slots[id].manual).trim() } : null;
      }).find(Boolean);
      if (!pick) return { pick: null };
      openMenuEdit(Number(pick.week), pick.day, pick.period);
      const note = [...document.querySelectorAll('.slot-typed-note')].find(n => n.innerText.includes(pick.dish));
      return { pick, cls: note ? note.className : '', text: note ? note.innerText : '', dirty: doorMenuDraftIsDirty(),
        summary: (document.querySelector('#mc-slot-name-preview .door-plate-summary') || {}).innerText || '' };
    });
    // Back to Wk1 SUN dinner for the steps below (they type on it and save it).
    await p.evaluate(() => { try { closeMenuEdit(); } catch (e) {} openMenuEdit(1, 'SUNDAY', 'dinner'); });
    check(width + ' a typed dish saved before reads quietly ("not answered yet")', opened.pick && /slot-typed-old/.test(opened.cls) && opened.text.includes(opened.pick.dish), opened);
    check(width + ' the summary lists it quietly, and opening leaves the draft unchanged', opened.pick && opened.summary.includes('Allergens not answered yet: ') && opened.summary.includes(opened.pick.dish) && !opened.dirty, opened);
    // 2. A dish typed now asks in amber.
    const typed = await p.evaluate(() => {
      slotSaveManual('xtra', 'Audit Peanut Noodles');
      const note = [...document.querySelectorAll('.slot-typed-note')].find((n) => /Audit Peanut Noodles/.test(n.innerText));
      return { cls: note ? note.className : '', text: note ? note.innerText : '',
        summary: (document.querySelector('#mc-slot-name-preview .door-plate-summary') || {}).innerText || '' };
    });
    check(width + ' a dish typed now asks what it contains, in amber', /slot-typed-new/.test(typed.cls) && /What does “Audit Peanut Noodles” contain\?/.test(typed.text), typed);
    check(width + ' the summary says "Allergens not set"', /Allergens not set: Audit Peanut Noodles/.test(typed.summary), typed.summary);
    // 3. Nothing to declare answers it; Save writes the marker.
    const saved = await p.evaluate(async () => {
      slotDeclareNothing('xtra');
      const gone = ![...document.querySelectorAll('.slot-typed-note')].some((n) => /Audit Peanut Noodles/.test(n.innerText));
      slotDeclareNothing('starch');
      const r = await Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('timeout'), 4000))]);
      const o = JSON.parse(localStorage.getItem('concMenuBase') || '{}');
      const slots = (((o['1'] || {}).SUNDAY || {}).dinner_slots) || {};
      return { gone, r, xtra: slots.xtra || null, starch: slots.starch || null };
    });
    check(width + ' Nothing to declare answers it', saved.gone, saved);
    check(width + ' Save writes the marker on both answered dishes', saved.r === true && saved.xtra && saved.xtra.declared === true && saved.starch && saved.starch.declared === true, saved);
    // 4. A tick on a typed dish answers it too.
    const ticked = await p.evaluate(() => {
      openMenuEdit(1, 'TUESDAY', 'lunch');
      slotToggleFlag('starch', 'hasDairy');
      return { declared: MEAL_SLOT_STATE.starch && MEAL_SLOT_STATE.starch.declared, note: !!document.querySelector('.slot-typed-note.slot-typed-old') && /Sweet potatoes/.test(document.querySelector('.slot-typed-note.slot-typed-old').innerText) };
    });
    check(width + ' a tick on a typed dish answers it', ticked.declared === true && !ticked.note, ticked);
    await p.evaluate(() => closeMenuEdit(true));
    // 4b. Review fold: answering a dish the meal opened with writes only the answer; the menu words stay as stored.
    const only = await p.evaluate(async () => {
      const before = JSON.parse(JSON.stringify(getMenuData()['1'].WEDNESDAY));
      openMenuEdit(1, 'WEDNESDAY', 'lunch');
      slotDeclareNothing('vegside');
      const r = await Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('timeout'), 4000))]);
      const after = getMenuData()['1'].WEDNESDAY;
      const changed = Object.keys(Object.assign({}, before, after)).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      return { r, changed, declared: after.lunch_slots && after.lunch_slots.vegside && after.lunch_slots.vegside.declared, words: after.lunch === before.lunch };
    });
    check(width + ' answering only writes the answer (and the meal kept as it was, editor-only): the menu words and every other field stay as stored', only.r === true && only.declared === true && only.words && only.changed.every((k) => k === 'lunch_slots' || k === 'lunch_original') && only.changed.includes('lunch_slots'), only);
    // 4c. Review fold: a typed main reads unanswered though it carries the meal ticks; a renamed dish keeps its ticks but asks.
    const main = await p.evaluate(() => {
      openMenuEdit(1, 'MONDAY', 'dinner');
      const note = [...document.querySelectorAll('.slot-typed-note')].find((n) => /Jerk Chicken/.test(n.innerText));
      MEAL_SLOT_STATE.vegside = { manual: 'Garlic Bread', flags: { hasGluten: true }, declared: true };
      slotAutoSave('vegside', 'Audit Slaw', 'enter');
      const s = MEAL_SLOT_STATE.vegside;
      const renamed = [...document.querySelectorAll('.slot-typed-note.slot-typed-new')].some((n) => /Audit Slaw/.test(n.innerText));
      closeMenuEdit(true);
      return { main: note ? note.className : '', keptGluten: !!(s && s.flags && s.flags.hasGluten), declared: s && s.declared, renamed };
    });
    check(width + ' a typed main reads unanswered though the meal ticks sit on it', /slot-typed-old/.test(main.main), main);
    check(width + ' a renamed dish keeps the old ticks but asks again', main.keptGluten && main.declared !== true && main.renamed, main);
    // 5. Menu Config lists the typed dishes not answered, with links.
    const list = await p.evaluate(() => { renderTypedUnansweredList(); const el = document.getElementById('mc-typed-unanswered');
      return { shown: el && el.style.display !== 'none', text: el ? el.innerText : '', links: el ? el.querySelectorAll('a[href^="#menu-config/edit/"]').length : 0 }; });
    check(width + ' Menu Config lists the typed dishes not answered, each meal linked', list.shown && /Typed dishes with allergens not answered yet/.test(list.text) && list.links > 10, list);
    await p.close();
  }
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
