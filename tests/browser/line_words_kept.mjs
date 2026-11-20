// 2026-11-20 (found relinking the vegan dishes, DOOR #269): a one-dish edit in Edit Menu rewrote the vegan line, the halal
// line and the sides text from the boxes, in box order. Relinking only the vegan dish (its words kept) dropped Wk2 SUN
// dinner's vegan "Pasta" and turned Wk2 MON dinner's "Green Beans, Rice" into "Rice, Green Beans". EXPO and HUB read
// those words (HUB compares them with the board). Now each line keeps its words unless a dish in it changed, as D4 does
// for the regular line. On every published meal in the real page: change the main (no line moves), then the vegan main
// (only that dish moves in the vegan line), and the two cases above. Published menu and overlay, network blocked.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 1200) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
try {
  // The two cases found on #269: only the vegan dish is relinked (its words kept); nothing else in any text moves.
  const named = await p.evaluate(async () => {
    window.doorAsk = async () => true; window.publishAndSync = () => {}; window.showToast = () => {};
    new MutationObserver(() => { const y = document.getElementById('_halal-yes'); if (y) y.click(); }).observe(document.body, { childList: true, subtree: true });
    const out = [];
    for (const [wk, day, per] of [['2', 'SUNDAY', 'dinner'], ['2', 'MONDAY', 'dinner']]) {
      const before = JSON.parse(JSON.stringify(getMenuData()[wk][day]));
      openMenuEdit(Number(wk), day, per);
      const cur = MEAL_SLOT_STATE.veganalt;
      const shown = _slotText(cur);
      const def = MEAL_SLOT_DEFS.find(d => d.id === 'veganalt');
      const other = DOOR_RECIPE_DATA.find(r => r && r.recipeName && r.recipeName !== cur.recipeName && !doorSlotRefusal(def, r)
        && DOOR_RECIPE_DATA.filter(x => x.recipeName === r.recipeName).length === 1 && recipeMatchesSlotDef(r, def));
      slotSelect('veganalt', other.recipeName);
      MEAL_SLOT_STATE.veganalt.displayText = shown;   // the relink keeps the menu's words
      renderSlots(); updateSlotSummary();
      const r = await Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('timeout'), 4000))]);
      if (mcMenuEditKey) closeMenuEdit(true);
      const after = getMenuData()[wk][day];
      out.push({ meal: wk + ' ' + day + ' ' + per, saved: r, relinked: (after[per + '_slots'] || {}).veganalt && after[per + '_slots'].veganalt.recipeName === other.recipeName,
        fields: ['', '_veg', '_sides', '_halal', '_mainItem'].map(f => ({ f: per + f, before: before[per + f], after: after[per + f] })) });
    }
    return out;
  });
  for (const n of named) {
    check(n.meal + ': the relink saved', n.saved === true && n.relinked, n);
    const moved = n.fields.filter(x => typeof x.before === 'string' && x.after !== x.before);
    check(n.meal + ': the menu, vegan line, sides and halal line are word for word as they were', moved.length === 0, moved);
  }

  const census = await p.evaluate(async () => {
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const out = { meals: 0, mainEdits: 0, vegEdits: 0, vegReplaced: 0, vegRebuilt: [], wrong: [], notSaved: [] };
    const pieceRun = (text, w) => {   // the one run of whole pieces reading as w, as D4 finds it
      const parts = String(text).split(/(\s*(?:,|&|—|;|\+)\s*)/); const runs = [];
      const n = (x) => String(x).trim().replace(/\s+/g, ' ').toLowerCase();
      for (let a = 0; a < parts.length; a += 2) { let run = ''; for (let b = a; b < parts.length; b += 2) { run += (b > a ? parts[b - 1] : '') + parts[b];
        if (n(run) === n(w)) { runs.push([a, b]); break; } if (n(run).length > n(w).length) break; } }
      return runs.length === 1 ? { parts, run: runs[0] } : null;
    };
    const save = async () => Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('timeout'), 4000))]);
    for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const per of ['breakfast', 'lunch', 'dinner']) {
      const meal = wk + ' ' + day + ' ' + per;
      const read = () => JSON.parse(JSON.stringify(((getMenuData()[wk] || {})[day]) || {}));
      if (!String(read()[per] || '')) continue;
      out.meals++;
      // 1. A new main dish: the vegan line, the sides and the halal line hold no dish that changed.
      let before = read();
      openMenuEdit(Number(wk), day, per);
      MEAL_SLOT_STATE.main = { manual: 'Audit Main Dish', flags: {}, declared: true };
      renderSlots(); updateSlotSummary();
      let r = await save();
      if (r !== true) { out.notSaved.push(meal + ' (main): ' + r); if (mcMenuEditKey) closeMenuEdit(true); continue; }
      out.mainEdits++;
      let after = read();
      ['_veg', '_sides', '_halal'].forEach(f => { if (typeof before[per + f] === 'string' && after[per + f] !== before[per + f]) out.wrong.push({ meal, edit: 'main', field: per + f, before: before[per + f], after: after[per + f] }); });
      // 2. A new vegan main: the sides and the halal line stay; the vegan line changes only where that dish stood.
      before = read();
      openMenuEdit(Number(wk), day, per);
      const was = MEAL_SLOT_STATE.veganalt ? _slotText(MEAL_SLOT_STATE.veganalt).trim() : '';
      const vegText = String(before[per + '_veg'] || '');
      if (!was || !vegText) { closeMenuEdit(true); continue; }
      const found = pieceRun(vegText, was);
      MEAL_SLOT_STATE.veganalt = { manual: 'Audit Vegan Dish', flags: {}, declared: true };
      renderSlots(); updateSlotSummary();
      r = await save();
      if (r !== true) { out.notSaved.push(meal + ' (vegan): ' + r); if (mcMenuEditKey) closeMenuEdit(true); continue; }
      out.vegEdits++;
      after = read();
      ['_sides', '_halal'].forEach(f => { if (typeof before[per + f] === 'string' && after[per + f] !== before[per + f]) out.wrong.push({ meal, edit: 'vegan', field: per + f, before: before[per + f], after: after[per + f] }); });
      if (found) {
        const parts = found.parts.slice(); parts.splice(found.run[0], found.run[1] - found.run[0] + 1, 'Audit Vegan Dish');
        const expected = parts.join('');
        if (after[per + '_veg'] === expected) out.vegReplaced++;
        else out.wrong.push({ meal, edit: 'vegan', field: per + '_veg', before: vegText, expected, after: after[per + '_veg'] });
      } else out.vegRebuilt.push(meal + ': "' + was + '" is not one piece of "' + vegText + '"');
    }
    return out;
  });
  check('every published meal saved both one-dish edits (' + census.meals + ' meals, ' + census.mainEdits + ' main, ' + census.vegEdits + ' vegan)', census.notSaved.length === 0 && census.meals >= 84, census.notSaved);
  check('a one-dish edit leaves every vegan line, sides text and halal line word for word, but where that dish stood (' + census.vegReplaced + ' vegan lines placed)', census.wrong.length === 0 && census.vegReplaced >= 80, { n: census.wrong.length, first: census.wrong.slice(0, 5) });
  console.log('vegan lines rebuilt from the boxes (the dish is not one piece of the words): ' + census.vegRebuilt.length + (census.vegRebuilt.length ? ' — ' + census.vegRebuilt.slice(0, 3).join(' | ') : ''));
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
