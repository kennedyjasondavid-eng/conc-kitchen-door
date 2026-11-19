// S4a of the Edit Menu redesign (D4, Jason 2026-11-19: "Follow lean"), on every published meal in the real page: change
// one side (or add one), save, and the menu words outside that dish are exactly as they were, in their order. Before S4a a
// real edit rebuilt the whole line from the boxes ("Pancakes, turkey bacon, fruit & yoghurt" became "Pancakes & turkey
// bacon & fruit & yoghurt"), and EXPO, HUB and the sheets read that line. Published menu and overlay, network blocked.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 900) : '')); };
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
  const census = await p.evaluate(async () => {
    window.doorAsk = async () => true; window.publishAndSync = () => {}; window.showToast = () => {};
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    // the halal question answers itself (yes: the meat is halal-certified, as stored)
    new MutationObserver(() => { const y = document.getElementById('_halal-yes'); if (y) y.click(); }).observe(document.body, { childList: true, subtree: true });
    const out = { meals: 0, kept: 0, rebuilt: [], wrong: [], notSaved: [] };
    for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const per of ['breakfast', 'lunch', 'dinner']) {
      const before = (getMenuData()[wk] || {})[day] || {};
      const text = String(before[per] || '');
      if (!text) continue;
      out.meals++;
      openMenuEdit(Number(wk), day, per);
      const veg = MEAL_SLOT_STATE.vegside && (MEAL_SLOT_STATE.vegside.recipeName || MEAL_SLOT_STATE.vegside.manual) ? _slotText(MEAL_SLOT_STATE.vegside) : '';
      let expected;
      // the side as a whole piece between separators (review fold): exactly one, else the line is rebuilt
      const parts = text.split(/(\s*(?:,|&|\u2014|;|\+)\s*)/);
      // runs of whole pieces that read as the side (a box can hold "Peas & Carrots")
      const runs = [];
      if (veg) for (let a = 0; a < parts.length; a += 2) { let run = ''; for (let b = a; b < parts.length; b += 2) { run += (b > a ? parts[b - 1] : '') + parts[b];
        const r = run.trim().replace(/\s+/g, ' ').toLowerCase(), w = veg.trim().replace(/\s+/g, ' ').toLowerCase(); if (r === w) { runs.push([a, b]); break; } if (r.length > w.length) break; } }
      if (veg && runs.length === 1) { const [a, b] = runs[0]; parts.splice(a, b - a + 1, 'Audit Greens'); expected = parts.join(''); MEAL_SLOT_STATE.vegside = { manual: 'Audit Greens', flags: {}, declared: true }; }
      else if (!veg) { expected = text.replace(/\s+$/, '') + ', Audit Greens'; MEAL_SLOT_STATE.vegside = { manual: 'Audit Greens', flags: {}, declared: true }; }
      else { out.rebuilt.push(wk + ' ' + day + ' ' + per + ': box "' + veg + '" is not one piece of "' + text + '"'); closeMenuEdit(true); continue; }
      renderSlots(); updateSlotSummary();
      const r = await Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('timeout'), 4000))]);
      const after = String(((getMenuData()[wk] || {})[day] || {})[per] || '');
      if (r !== true) { out.notSaved.push(wk + ' ' + day + ' ' + per + ': ' + r); if (mcMenuEditKey) closeMenuEdit(true); continue; }
      if (after === expected) out.kept++; else out.wrong.push({ meal: wk + ' ' + day + ' ' + per, text, expected, after });
    }
    return out;
  });
  check('every published meal saved its one-dish edit (' + census.meals + ' meals)', census.notSaved.length === 0, census.notSaved);
  check('the words outside the changed dish stay exactly as written, in their order (' + census.kept + ' meals)', census.wrong.length === 0 && census.kept >= 60, census.wrong.slice(0, 4));
  console.log('rebuilt from the boxes (the box is not in the words): ' + census.rebuilt.length + (census.rebuilt.length ? ' — ' + census.rebuilt.slice(0, 3).join(' | ') : ''));
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
