// S4b of the Edit Menu redesign, on every published meal in the real page: each dish box sits in the plate card it makes,
// labelled in kitchen words, no "optional" tag shows, a side whose vegan or halal plate gets something else opens its
// choices, and opening a meal still changes nothing. Published menu and overlay, network blocked.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 700) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const browser = await chromium.launch();
try {
  for (const width of [1280, 390]) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route(/^https?:/, (r) => r.abort());
    await p.addInitScript(({ m, o }) => {
      localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
      localStorage.setItem('concAltFlagSweepV1', 'done'); window.Chart = function () { return { destroy() {}, update() {} }; };
    }, { m: menu, o: overlay });
    await p.goto(pathToFileURL(source).href);
    await p.waitForFunction(() => typeof openMenuEdit === 'function');
    const r = await p.evaluate(() => {
      showScreen('menu-config');
      const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const out = { meals: 0, misplaced: [], optional: [], folds: [], dirty: [] };
      const plateOf = {}; DOOR_PLATE_CARDS.forEach((pc) => pc.ids.forEach((id) => { plateOf[id] = pc.key; }));
      for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const per of ['breakfast', 'lunch', 'dinner']) {
        if (!((getMenuData()[wk] || {})[day] || {})[per]) continue;
        out.meals++;
        openMenuEdit(Number(wk), day, per);
        const tag = wk + ' ' + day.slice(0, 3) + ' ' + per;
        Object.keys(MEAL_SLOT_STATE).forEach((id) => {
          const el = document.getElementById('slot-search-' + id) || document.getElementById('slot-manual-' + id);
          if (!el) return;
          const card = el.closest('.door-plate-card');
          if (!card || card.dataset.plate !== plateOf[id]) out.misplaced.push(tag + ' ' + id);
          const s = MEAL_SLOT_STATE[id];
          if (s && s.lines && (s.lines.vegan || s.lines.halal)) { const f = el.closest('div[style]').parentElement.querySelector('.slot-lines-fold'); if (f && !f.open) out.folds.push(tag + ' ' + id); }
        });
        if (/\boptional\b/i.test(document.getElementById('mc-slot-panel').innerText)) out.optional.push(tag);
        if (doorMenuDraftIsDirty()) out.dirty.push(tag);
        closeMenuEdit(true);
      }
      return out;
    });
    check(width + ' every box sits in the plate card it makes (' + r.meals + ' meals)', r.meals >= 80 && r.misplaced.length === 0, r.misplaced.slice(0, 5));
    check(width + ' no "optional" tag shows', r.optional.length === 0, r.optional.slice(0, 5));
    check(width + ' a side whose vegan or halal plate differs shows its choices open', r.folds.length === 0, r.folds.slice(0, 5));
    check(width + ' opening a meal still changes nothing', r.dirty.length === 0, r.dirty.slice(0, 5));
    await p.close();
  }
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((x) => !x.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
