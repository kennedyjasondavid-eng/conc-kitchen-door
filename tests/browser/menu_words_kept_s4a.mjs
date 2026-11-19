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
    const letter = (c) => /[A-Za-z0-9]/.test(c || '');
    const whole = (t, w) => { for (const [h, n] of [[t, w], [t.toLowerCase(), w.toLowerCase()]]) { let i = h.indexOf(n); while (i >= 0) { if (!letter(h[i - 1]) && !letter(h[i + n.length])) return i; i = h.indexOf(n, i + 1); } } return -1; };
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
      if (veg && whole(text, veg) >= 0) { const at = whole(text, veg); expected = text.slice(0, at) + 'Audit Greens' + text.slice(at + veg.length); MEAL_SLOT_STATE.vegside = { manual: 'Audit Greens', flags: {}, declared: true }; }
      else if (!veg) { expected = text.replace(/\s+$/, '') + ', Audit Greens'; MEAL_SLOT_STATE.vegside = { manual: 'Audit Greens', flags: {}, declared: true }; }
      else { out.rebuilt.push(wk + ' ' + day + ' ' + per + ': box "' + veg + '" not in "' + text + '"'); closeMenuEdit(true); continue; }
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
