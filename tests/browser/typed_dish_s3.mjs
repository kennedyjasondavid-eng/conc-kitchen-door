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
    const opened = await p.evaluate(() => {
      openMenuEdit(1, 'SUNDAY', 'dinner');
      const note = document.querySelector('.slot-typed-note');
      return { cls: note ? note.className : '', text: note ? note.innerText : '', dirty: doorMenuDraftIsDirty(),
        summary: (document.querySelector('#mc-slot-name-preview .door-plate-summary') || {}).innerText || '' };
    });
    check(width + ' a typed dish saved before reads quietly ("not answered yet")', /slot-typed-old/.test(opened.cls) && /Pasta/.test(opened.text), opened);
    check(width + ' the summary lists it quietly, and opening leaves the draft unchanged', /Allergens not answered yet: Pasta/.test(opened.summary) && !opened.dirty, opened);
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
