// S5a of the Edit Menu redesign: Save always in view. The walkthrough found Save 3,200 px down the page and the result
// only a toast. Now a footer is pinned to the bottom of the screen while a meal is open (the regular plate line, Put back
// the original, Save); Save is grey until something changes; after Save the meal stays open and the line says when it was
// saved and whether it was sent; the meal card says "Changed today by <name>". Real page, published menu, network blocked.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 600) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const browser = await chromium.launch();
async function boot(width, height) {
  const p = await browser.newPage({ viewport: { width, height } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    if (sessionStorage.getItem('_s')) return; sessionStorage.setItem('_s', '1');
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA Lead');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => { showScreen('menu-config'); window.doorAsk = async () => true; window.publishAndSync = () => {}; });
  return p;
}
try {
  for (const [w, h] of [[1280, 900], [390, 860]]) {
    const p = await boot(w, h);
    await p.evaluate(() => openMenuEdit(2, 'TUESDAY', 'dinner'));
    await p.waitForTimeout(300);
    // scroll to the middle of the meal: the footer stays on screen
    await p.evaluate(() => { const g = document.getElementById('mc-slot-panel'); if (g) g.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(200);
    const box = await p.locator('#mc-menu-save-btn').boundingBox();
    check(w + ' Save is on screen while the meal is open (no scrolling to find it)', box && box.y >= 0 && box.y + box.height <= h, box);
    const grey = await p.evaluate(() => ({ disabled: document.getElementById('mc-menu-save-btn').disabled, sum: document.getElementById('mc-footer-summary').textContent }));
    check(w + ' Save is grey until something changes, and the regular plate line shows', grey.disabled && /Regular plate contains/.test(grey.sum), grey);
    await p.evaluate(() => { slotSaveManual('xtra', 'Audit Fruit Cup'); });
    await p.waitForTimeout(50);
    check(w + ' Save is ready once something changes', await p.evaluate(() => !document.getElementById('mc-menu-save-btn').disabled));
    const after = await p.evaluate(async () => {
      new MutationObserver(() => { const y = document.getElementById('_halal-yes'); if (y) y.click(); }).observe(document.body, { childList: true, subtree: true });
      MEAL_SLOT_STATE.xtra.declared = true;
      const r = await Promise.race([saveMenuEdit(), new Promise((res) => setTimeout(() => res('timeout'), 4000))]);
      return { r, open: mcMenuEditKey, status: document.getElementById('mc-footer-status').textContent, disabled: document.getElementById('mc-menu-save-btn').disabled };
    });
    check(w + ' after Save the meal stays open, and the line says it was saved, with the time', after.r === true && after.open === '2-TUESDAY-dinner' && /Saved/.test(after.status) && /\d:\d\d/.test(after.status) && after.disabled, after);
    const card = await p.evaluate(() => { closeMenuEdit(true); mcWeek = 2; renderMenuConfig(); return [...document.querySelectorAll('.mc-changed-today')].map((e) => e.textContent); });
    check(w + ' the meal card says "Changed today by QA Lead"', card.includes('Changed today by QA Lead'), card);
    await p.close();
  }
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
