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
      return { visible, cards: cards.length, counts: (text.match(/\d+ allergens?|No allergens/g) || []).length, spicy: /Spicy/.test(text),
        oldChips: [...document.querySelectorAll('#mc-grid-body td span')].some((s) => /^(Gluten|Dairy|Egg)$/.test(s.textContent.trim())),
        sub: document.querySelector('#screen-menu-config .topbar-sub').textContent, wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    check(width + ' no Edit mode: the toolbar shows More and Send, not Edit Menu, Swap Slots or Rex', page.visible.some((t) => /^More/.test(t)) && !page.visible.some((t) => /Edit Menu|Swap Slots|Swap two meals|Rex/.test(t)), page.visible);
    check(width + ' each meal card shows how many allergens it holds and whether it is spicy', page.cards >= 21 && page.counts === page.cards && page.spicy && !page.oldChips, page);
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
    await p.close();
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
