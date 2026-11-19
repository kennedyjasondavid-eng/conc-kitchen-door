// S2b of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): one true allergen summary per plate.
// The editor's summary is worked out by doorPlateFacts (the function the plating sheet reads, S2a) on the meal as Save
// would write it. On every published meal, opened and left as it is, the summary's regular, vegan and halal lines equal
// what plating works out for the every-week meal; an allergen tick no dish names reads "added by hand"; a halal dish
// named pork reads in red (D8, Jason 2026-11-19: "Follow lean"); opening and reading the summary changes nothing.
// Real app in Chromium, the published menu, network blocked, no resident data. Authored red on main 7d33af4.
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
  p.on('dialog', async (d) => { await d.accept(); });
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => { showScreen('menu-config'); });
  return p;
}
try {
  const p = await boot(1280);
  // 1. Every published meal: the summary equals plating for the every-week meal.
  const census = await p.evaluate(async () => {
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const out = { meals: 0, differ: [], noSummary: [], dirty: [], wrote: [] };
    const before = localStorage.getItem('concMenuBase');
    for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const per of ['breakfast', 'lunch', 'dinner']) {
      const want = typeof doorPlateFactsFor === 'function' ? doorPlateFactsFor(wk, day, per, { noDated: true }) : null;
      if (!want) continue;
      out.meals++;
      openMenuEdit(Number(wk), day, per);
      await new Promise((r) => setTimeout(r, 20));
      const got = window.__DOOR_PLATE_SUMMARY__;
      const tag = 'W' + wk + ' ' + day.slice(0, 3) + ' ' + per;
      if (!got || !document.querySelector('#mc-slot-name-preview .door-plate-summary')) out.noSummary.push(tag);
      else {
        const set = (x) => String(x || '').split(',').map((t) => t.trim()).filter(Boolean).sort().join(', ');
        const pick = (f) => [set(f.allergenStr), set(f.vegAllergenStr), set(f.halalAllergenStr), JSON.stringify(f.halalPorkDishes || [])];
        if (JSON.stringify(pick(got)) !== JSON.stringify(pick(want))) out.differ.push({ tag, got: pick(got), want: pick(want) });
      }
      if (typeof doorMenuDraftIsDirty === 'function' && doorMenuDraftIsDirty()) out.dirty.push(tag);
      closeMenuEdit(true);
    }
    if (localStorage.getItem('concMenuBase') !== before) out.wrote.push('overlay changed');
    return out;
  });
  check('every published meal opens with a plate summary (' + census.meals + ' meals)', census.meals >= 80 && census.noSummary.length === 0, census.noSummary);
  check('each summary equals what plating works out for the every-week meal', census.differ.length === 0, census.differ.slice(0, 4));
  check('opening a meal and reading its summary leaves the draft unchanged and writes nothing', census.dirty.length === 0 && census.wrote.length === 0, census);
  // 2. A hand tick reads "added by hand"; a dish that names the allergen is not.
  const hand = await p.evaluate(() => {
    openMenuEdit(1, 'MONDAY', 'lunch');
    const cb = document.getElementById('mc-edit-flag-hasSesame');
    const wasOn = cb.checked;
    cb.checked = true; updateSlotSummary();
    const txt = document.querySelector('#mc-slot-name-preview .door-plate-summary').innerText;
    const facts = window.__DOOR_PLATE_SUMMARY__;
    closeMenuEdit(true);
    return { wasOn, txt, regular: facts.allergenStr };
  });
  check('a tick no dish names reads "added by hand" and reaches the regular plate', !hand.wasOn && /Added by hand[^\n]*Sesame/.test(hand.txt) && /SESAME/.test(hand.regular), hand);
  // 3. D8: a halal dish named pork reads in red and the halal plate says PORK.
  const pork = await p.evaluate(() => {
    openMenuEdit(4, 'FRIDAY', 'dinner');
    MEAL_SLOT_STATE.mainalt = { manual: 'Ham Steak', flags: {} };
    updateSlotSummary();
    const el = document.querySelector('#mc-slot-name-preview .door-plate-summary');
    const txt = el ? el.innerText : '';
    const facts = window.__DOOR_PLATE_SUMMARY__;
    closeMenuEdit(true);
    return { txt, halal: facts && facts.halalAllergenStr, dishes: facts && facts.halalPorkDishes };
  });
  check('a halal dish named pork is named in red and the halal plate says PORK', /halal plate names pork: Ham Steak/i.test(pork.txt) && /PORK/.test(pork.halal || ''), pork);
  const tandoori = await p.evaluate(() => {
    const f = doorPlateFactsFor(4, 'FRIDAY', 'dinner', { noDated: true });
    return { halal: f && f.halalAllergenStr, dishes: f && f.halalPorkDishes };
  });
  check('a copied pork tick on a halal chicken dish stays stripped (Wk4 FRI Tandoori Chicken)', !/PORK/.test(tandoori.halal || '') && (tandoori.dishes || []).length === 0, tandoori);
  await p.close();
  // 4. The summary shows on a phone too.
  const q = await boot(390);
  const phone = await q.evaluate(() => { openMenuEdit(2, 'SUNDAY', 'dinner'); return !!document.querySelector('#mc-slot-name-preview .door-plate-summary'); });
  check('390 the summary shows', phone);
  await q.close();
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
