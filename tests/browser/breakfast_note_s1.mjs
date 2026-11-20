// tests/browser/breakfast_note_s1.mjs — U3 S1, the resident breakfast note, in the real page (offline Chromium, 1280 and
// 390 px, made-up residents and a made-up menu). The resident editor saves it; Enter Changes fills it for the room typed,
// never for the next room, and the Daily Entry queue carries it to the registry; the resident card shows it; the breakfast
// plating sheet prints it beside the resident with the CHECK in amber, never at lunch; an update from an import keeps it.
import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; import assert from 'node:assert/strict';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve(process.env.DOOR_PLAYWRIGHT_PACKAGE || '../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.BREAKFAST_NOTE_HTML || 'index.html');
const menu = {};
for (const w of [1, 2, 3, 4]) { menu[w] = {}; for (const d of ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']) menu[w][d] = {
  breakfast: 'Cereal & Milk, Fresh Fruit', breakfast_veg: 'Cereal & oat milk, Fresh Fruit', breakfast_flags: { hasDairy: true }, breakfast_altMeals: [], breakfast_altMealsNone: true,
  lunch: 'Synthetic Rice', lunch_veg: 'Synthetic Rice', lunch_flags: {}, lunch_altMeals: [], lunch_altMealsNone: true,
  dinner: 'Synthetic Rice', dinner_veg: 'Synthetic Rice', dinner_flags: {}, dinner_altMeals: [], dinner_altMealsNone: true } };
const residents = [
  { room: 'SYN-1', tags: ['Regular'], rawRestriction: 'Regular', section: 'Regular' },
  { room: 'SYN-2', tags: ['Vegetarian'], restrictions: ['Vegetarian'], rawRestriction: 'Vegetarian', section: 'Vegan / Vegetarian' },
  { room: 'SYN-3', tags: ['Regular'], rawRestriction: 'Regular', section: 'Regular' },
];
const results = []; const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail) : '')); };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept());
    await page.route(/^https?:/, (r) => r.abort());
    await page.addInitScript(([menu, residents]) => {
      localStorage.clear(); localStorage.setItem('concUploadedMenu', JSON.stringify(menu)); localStorage.setItem('concMenuBase', '{}');
      localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concRegistryState', JSON.stringify({ residents, anaphRooms: [] }));
      localStorage.setItem('conc-door-anaph', '[]'); localStorage.setItem('concOperatorName', 'Tester');
      window.Chart = function () { return { destroy() {}, update() {} }; };
    }, [menu, residents]);
    await page.goto(pathToFileURL(source).href);
    await page.waitForFunction(() => typeof openRegistryEditor === 'function' && typeof REGISTRY_MAP === 'object' && REGISTRY_MAP['syn-1']);
    await page.evaluate(() => { publishAndSync = () => {}; doorTakeNewerKitchenList = async () => {}; window.__toasts = []; showToast = (m) => __toasts.push(m); });

    // The resident editor
    await page.evaluate(() => { showScreen('registry'); openRegistryEditor('SYN-1'); });
    const field = page.locator('#ce-breakfast-note');
    check(width + ' the editor has the breakfast note, empty for a resident without one', await field.isVisible() && (await field.inputValue()) === '');
    await field.fill('oat milk only');
    await page.evaluate(() => saveChangeEdit());
    await page.waitForFunction(() => REGISTRY_MAP['syn-1'].breakfastNote === 'oat milk only');
    const saved = await page.evaluate(() => ({ note: REGISTRY_MAP['syn-1'].breakfastNote, stored: JSON.parse(localStorage.getItem('concRegistryState')).residents.find((r) => r.room === 'SYN-1').breakfastNote }));
    check(width + ' saved on the record and on this computer', saved.note === 'oat milk only' && saved.stored === 'oat milk only', saved);
    await page.evaluate(() => openRegistryEditor('SYN-1'));
    check(width + ' reopened, the editor shows it', (await field.inputValue()) === 'oat milk only');
    await page.evaluate(() => closeChangeEditor());
    const card = await page.evaluate(() => buildResidentDetailHTML(REGISTRY_MAP['syn-1']));
    check(width + ' the resident card shows it', card.includes('Breakfast note: oat milk only'), card.slice(-200));

    // Enter Changes: filled for the room typed, cleared when another room is typed, carried by the queue
    await page.evaluate(() => { showScreen('enter'); clearForm(); document.getElementById('change-type').value = 'update'; onTypeChange(); lookupRoom('SYN-1'); });
    const form = page.locator('#change-breakfast-note');
    check(width + ' Enter Changes fills it for the room typed', await form.isVisible() && (await form.inputValue()) === 'oat milk only');
    await page.evaluate(() => lookupRoom('SYN-3'));
    check(width + ' typing another room never carries it', (await form.inputValue()) === '');
    await page.evaluate(() => lookupRoom('SYN-2'));
    await form.fill('soy milk only');
    await page.evaluate(() => { document.getElementById('room-number').value = 'SYN-2'; return addChange(); });
    const q = await page.evaluate(() => changesQueue.find((c) => c.room === 'SYN-2'));
    check(width + ' the Daily Entry queue carries it', q && q.breakfastNote === 'soy milk only', q);
    await page.evaluate(() => { applyQueueToRegistry([]); changesQueue = []; });
    check(width + ' applied to the record', (await page.evaluate(() => REGISTRY_MAP['syn-2'].breakfastNote)) === 'soy milk only');
    // An update from an import carries no note: it is kept.
    await page.evaluate(() => { changesQueue = [{ room: 'SYN-1', type: 'update', tags: { regular: true }, route: 'Regular', notes: 'From daily list import', isAnaph: false }]; applyQueueToRegistry([]); changesQueue = []; });
    check(width + ' an import update keeps it', (await page.evaluate(() => REGISTRY_MAP['syn-1'].breakfastNote)) === 'oat milk only');

    // The breakfast plating sheet
    const sheet = await page.evaluate(() => {
      const pd = computePlatingData('breakfast', 1, 'TUESDAY');
      const host = document.createElement('div'); host.innerHTML = buildPlatingHtml(pd, false); document.body.appendChild(host);
      const row = (room) => [...host.querySelectorAll('tr')].find((tr) => tr.children[1] && tr.children[1].textContent === room);
      const r1 = row('SYN-1'), r2 = row('SYN-2'), r3 = row('SYN-3');
      const chk = r1 && r1.querySelector('.ps-bf-check');
      const amber = chk ? getComputedStyle(chk).backgroundColor : '';
      const lunch = buildPlatingHtml(computePlatingData('lunch', 1, 'TUESDAY'), false);
      host.remove();
      return { r1: r1 && r1.textContent, r2: r2 && r2.textContent, r3: !!r3, amber, lunch: lunch.includes('Breakfast note') };
    });
    check(width + ' a regular resident with only a note gets a row; the CHECK names the plain milk', /Breakfast note: oat milk only/.test(sheet.r1 || '') && /CHECK: the plate names milk, not oat milk/.test(sheet.r1 || ''), sheet);
    check(width + ' the CHECK is amber', sheet.amber === 'rgb(255, 230, 153)', sheet.amber);
    check(width + ' the vegan plate names oat milk: a soy-only note is checked against it', /CHECK: the plate names oat milk, not soy milk/.test(sheet.r2 || ''), sheet.r2);
    check(width + ' a regular resident without a note gets no row', !sheet.r3);
    check(width + ' lunch prints no breakfast note', !sheet.lunch);
    check(width + ' no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(width + ' no page errors', errors.length === 0, errors);
    await page.close();
  }
} finally { await browser.close(); }
const failed = results.filter((x) => !x.pass); console.log(results.length + ' checks; ' + failed.length + ' failed'); assert.equal(failed.length, 0);
