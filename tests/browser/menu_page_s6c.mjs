// S6c of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): the Menu page and More.
// No Edit mode: a meal card opens the meal view. Cards show the dishes, how many allergens and whether the meal is
// spicy. Swap two meals, Special meal, Rex's week sheet and Replace the whole menu from a file are under More.
// Real app in Chromium, the published menu, network blocked, no resident data.
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
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate(() => showScreen('menu-config'));
  return p;
}
try {
  for (const width of [1280, 390]) {
    const p = await boot(width);
    const page = await p.evaluate(() => {
      const top = document.querySelector('#screen-menu-config .topbar');
      const shown = (b) => b.offsetParent !== null && !(b.closest('details') && !b.closest('details').open && b.tagName !== 'SUMMARY');
      const visible = [...top.querySelectorAll('button, summary')].filter(shown).map((b) => b.textContent.trim());
      const cards = [...document.querySelectorAll('#mc-grid-body td')].filter((td) => typeof td.onclick === 'function');
      const text = cards.map((td) => td.textContent).join(' | ');
      const marked = cards.filter((td) => td.querySelector('.mc-card-chip')).length;
      // Review fold (P2): the anaphylaxis families are named on the card; Pork shows; the rest are counted.
      const wk = getMenuData()[String(mcWeek)];
      const peanutMeal = cards.find((td, i) => { const t = td.textContent; return /Peanuts/.test(t); });
      const anyPeanuts = Object.values(wk).some((d) => ['breakfast', 'lunch', 'dinner'].some((p) => (d[p + '_flags'] || {}).hasPeanuts));
      const anyPork = Object.values(wk).some((d) => ['breakfast', 'lunch', 'dinner'].some((p) => (d[p + '_flags'] || {}).hasPork));
      return { visible, cards: cards.length, counts: marked, spicy: /Spicy/.test(text), peanuts: !anyPeanuts || !!peanutMeal, pork: !anyPork || /Pork/.test(text),

        sub: document.querySelector('#screen-menu-config .topbar-sub').textContent, wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    check(width + ' no Edit mode: the toolbar shows More and Send, not Edit Menu, Swap Slots or Rex', page.visible.some((t) => /^More/.test(t)) && !page.visible.some((t) => /Edit Menu|Swap Slots|Swap two meals|Rex/.test(t)), page.visible);
    check(width + ' each meal card shows its marks: the anaphylaxis families named, Pork, the rest counted, Spicy', page.cards >= 21 && page.counts === page.cards && page.spicy && page.peanuts && page.pork, page);
    check(width + ' the subtitle says to click a meal', /Click a meal/.test(page.sub), page.sub);
    const more = await p.evaluate(async () => {
      document.querySelector('details.mc-more > summary').click();
      await new Promise((r) => setTimeout(r, 20));
      const items = document.querySelector('details.mc-more').open ? [...document.querySelectorAll('.mc-more-menu .mc-more-item')].map((b) => b.textContent.trim()) : [];
      document.getElementById('mc-swap-slots-btn').click();
      await new Promise((r) => setTimeout(r, 20));
      const swapMode = typeof slotSwapMode !== 'undefined' && slotSwapMode;
      const closed = !document.querySelector('details.mc-more').open;
      exitSlotSwapMode();
      const cell = [...document.querySelectorAll('#mc-grid-body td')].find((td) => typeof td.onclick === 'function');
      cell.click();
      return { items, swapMode, closed, opened: !!mcMenuEditKey };
    });
    check(width + ' More holds Swap two meals, Special meal, Rex’s week sheet and Replace the whole menu from a file',
      ['Swap two meals', 'Special meal', 'Rex’s week sheet', 'Replace the whole menu from a file'].every((t) => more.items.includes(t)), more.items);
    check(width + ' a More item works and closes the menu', more.swapMode && more.closed, more);
    check(width + ' clicking a meal card opens the meal view', more.opened, more);
    check(width + ' no sideways scroll', !page.wide, page.wide);
    // Review fold (P1): the open menu sits inside the screen, each item is what a tap there reaches; Escape closes it.
    // Re-pinned 2026-11-19 (Edit Menu redesign S7): a phone meal view is full screen, so the meal opened above closes first.
    await p.evaluate(() => closeMenuEdit(true));
    await p.click('details.mc-more > summary');
    const place = await p.evaluate(() => {
      const m = document.querySelector('.mc-more-menu').getBoundingClientRect();
      const hits = [...document.querySelectorAll('.mc-more-menu .mc-more-item')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && (el === b || b.contains(el)); });
      return { left: m.left, right: m.right, w: window.innerWidth, hits };
    });
    check(width + ' the open More menu is inside the screen and every item can be tapped', place.left >= 0 && place.right <= place.w && place.hits.length >= 4 && place.hits.every(Boolean), place);
    await p.keyboard.press('Escape');
    check(width + ' Escape closes More', await p.evaluate(() => !document.querySelector('details.mc-more').open), null);
    await p.close();
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
