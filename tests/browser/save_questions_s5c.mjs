// S5c of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): Save asks only what it must.
// D3, Jason 2026-11-19: "Follow lean". Still asked: halal when the meat changed; an allergen removal (keep is the
// default); a new anaphylactic conflict (red, acknowledged). Lines in What changes instead: a box that reads like more
// than one dish, held words, and the soft plate (asked only when the change can affect soft residents, and always with
// no resident list). Real app in Chromium, the published menu, network blocked, made-up residents only.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 700) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const RES = [
  { room: '101z', tags: ['Regular'] }, { room: '102z', tags: ['Halal'] }, { room: '103z', tags: ['Vegan'] }, { room: '104z', tags: ['No Eggs'] },
  { room: '900z', tags: ['No Peanuts'], isAnaph: true, anaphTags: ['noPeanuts'] },
];
const SOFT = { room: '105z', tags: ['Soft Meals'] };
const browser = await chromium.launch();
async function boot(res) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate((list) => {
    REGISTRY_LIST.length = 0; list.forEach((r) => REGISTRY_LIST.push(r));
    anaphRooms = list.filter((r) => r.isAnaph).map((r) => r.room);
    window.publishAndSync = () => {};
    showScreen('menu-config');
    // In the page: start Save, wait for the first question (or the end), report it, and answer it.
    // through: answer the old-ticks question with its default (Keep them) and report the next question instead.
    window.__saveAndSee = async (answer, through) => {
      const before = localStorage.getItem('concMenuBase');
      const done = saveMenuEdit();
      let fin = false; done.then(() => { fin = true; });
      const seen = [];
      for (let i = 0; i < 60 && !fin; i++) {
        await new Promise((r) => setTimeout(r, 25));
        const ask = document.querySelector('.door-ask');
        const halal = [...document.querySelectorAll('.modal-overlay.open')].find((o) => !o.classList.contains('door-ask') && /halal/i.test(o.textContent));
        if (ask || halal) {
          const title = ask ? ask.querySelector('h2').textContent : 'HALAL';
          const red = ask ? /danger/.test(ask.querySelector('h2').getAttribute('style') || '') : false;
          const go = ask ? ask.querySelector('.door-ask-go').textContent : '';
          const alt = ask && ask.querySelector('.door-ask-alt') ? ask.querySelector('.door-ask-alt').textContent : '';
          seen.push(title);
          if (through && /^(Take off the old dish’s warnings|Keep the meal’s warnings)\?$/.test(title)) { ask.querySelector('.door-ask-go').click(); await new Promise((r) => setTimeout(r, 30)); continue; }
          if (ask) ask.querySelector(answer === 'go' ? '.door-ask-go' : '.door-ask-cancel').click();
          else halal.remove();
          await new Promise((r) => setTimeout(r, 30));
          return { asked: title, seen, red, go, alt, wrote: localStorage.getItem('concMenuBase') !== before };
        }
      }
      await done;
      return { asked: null, seen, wrote: localStorage.getItem('concMenuBase') !== before };
    };
  }, res);
  return p;
}
try {
  const p = await boot(RES);
  // 1. A new anaphylactic conflict: red, named, acknowledged; going back writes nothing.
  const anaph = await p.evaluate(async () => {
    openMenuEdit(1, 'MONDAY', 'lunch');
    const cb = document.getElementById('mc-edit-flag-hasPeanuts'); if (cb && !cb.checked) cb.click();
    updateSlotSummary();
    const back = await window.__saveAndSee('back');
    const text = '';
    closeMenuEdit(true);
    openMenuEdit(1, 'MONDAY', 'lunch');
    const cb2 = document.getElementById('mc-edit-flag-hasPeanuts'); if (cb2 && !cb2.checked) cb2.click();
    updateSlotSummary();
    const go = await window.__saveAndSee('go');
    closeMenuEdit(true);
    return { back, go };
  });
  check('a new anaphylactic conflict is asked about in red before anything is written', anaph.back.asked === 'Anaphylactic residents affected' && anaph.back.red && !anaph.back.wrote, anaph);
  check('acknowledging it saves', anaph.go.asked === 'Anaphylactic residents affected' && anaph.go.go === 'I understand, save' && anaph.go.wrote, anaph);

  // 2. A box that reads like more than one dish is a line in What changes, not a question.
  const runOn = await p.evaluate(async () => {
    openMenuEdit(3, 'TUESDAY', 'lunch');
    slotAutoSave('vegside', 'Kale & Chard', 'enter');
    updateSlotSummary();
    const line = document.getElementById('mc-what-changes').textContent;
    const r = await window.__saveAndSee('back');
    closeMenuEdit(true);
    return { line, r };
  });
  check('a box that reads like more than one dish is a line in What changes and Save does not ask about it',
    /reads like more than one dish/.test(runOn.line) && runOn.r.asked !== 'More than one dish in a slot?', runOn);

  // 3. Halal: not asked when the meat did not change; asked when it did.
  const halal = await p.evaluate(async () => {
    const pick = () => { const cb = document.getElementById('mc-edit-flag-halalCertifiedMeat'); if (cb && cb.checked) cb.click(); };
    openMenuEdit(2, 'WEDNESDAY', 'lunch');
    pick();
    slotAutoSave('vegside', 'Steamed Kale', 'enter');
    updateSlotSummary();
    const same = await window.__saveAndSee('back', true);
    closeMenuEdit(true);
    openMenuEdit(2, 'WEDNESDAY', 'lunch');
    pick();
    slotAutoSave('main', 'Beef Stew', 'enter');
    updateSlotSummary();
    const changed = await window.__saveAndSee('back', true);
    document.querySelectorAll('.door-ask .door-ask-cancel').forEach((b) => b.click());
    closeMenuEdit(true);
    return { same, changed };
  });
  check('halal is not asked when the meat did not change', !halal.same.seen.includes('HALAL'), halal);
  check('halal is asked when the main meat changed (chicken to beef)', halal.changed.asked === 'HALAL' && !halal.changed.wrote, halal);

  // 4. The old dish's warnings: keeping them is the default for a different dish.
  const ticks = await p.evaluate(async () => {
    openMenuEdit(1, 'THURSDAY', 'lunch');
    // Link a main recipe with none of these allergens: the sausage dish's Gluten, Pork, Beef and Processed Meat look carried.
    const rec = DOOR_RECIPE_DATA.find((r) => Array.isArray(r.allergens) && r.allergens.every((a) => !/gluten|wheat|pork|beef|processed/i.test(a)) && r.stream !== 'vegan' && /main|entree|protein/i.test(r.category || '') && !/pork|sausage|beef|ham|chicken/i.test(r.recipeName));
    slotSelect('main', rec.recipeName);
    updateSlotSummary();
    const r = await window.__saveAndSee('back');
    closeMenuEdit(true);
    return r;
  });
  check('taking off the old dish warnings is a choice; keeping them is the default', /^(Take off the old dish’s warnings|Keep the meal’s warnings)\?$/.test(ticks.asked) && ticks.go === 'Keep them' && ticks.alt === 'Take them off' && !ticks.wrote, ticks);

  // 5. The soft plate: not asked when no one on the list eats soft.
  const soft = await p.evaluate(async () => {
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    for (const wk of [1, 2, 3, 4]) for (const day of DAYS) {
      openMenuEdit(wk, day, 'dinner');
      if (!buildAltMeals().length && !ALT_MEALS_NONE) {
        slotAutoSave('vegside', 'Steamed Kale', 'enter');
        updateSlotSummary();
        const line = document.getElementById('mc-what-changes').textContent;
        const r = await window.__saveAndSee('back');
        document.querySelectorAll('.door-ask .door-ask-cancel').forEach((b) => b.click());
        closeMenuEdit(true);
        return { meal: wk + ' ' + day, line, r };
      }
      closeMenuEdit(true);
    }
    return null;
  });
  check('with no soft resident on the list, the soft plate is a line, not a question', soft && soft.r.asked !== 'No soft or plain alternative?' && /No soft plate is set/.test(soft.line), soft);
  await p.close();

  // 6. The soft plate is asked when a soft resident is on the list and a dish changed, and always with no list.
  for (const [label, list] of [['a soft resident on the list', RES.concat([SOFT])], ['no resident list', []]]) {
    const q = await boot(list);
    const r = await q.evaluate(async (meal) => {
      openMenuEdit(Number(meal[0]), meal[1], 'dinner');
      slotAutoSave('vegside', 'Steamed Kale', 'enter');
      updateSlotSummary();
      const r = await window.__saveAndSee('back');
      closeMenuEdit(true);
      return r;
    }, soft ? soft.meal.split(' ') : ['1', 'SUNDAY']);
    check('the soft plate is asked with ' + label, r.asked === 'No soft or plain alternative?' && !r.wrote, r);
    await q.close();
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
