// S7 of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): phones and tablets (H6, M21, M22),
// plus the meal view layout moved from S6c. On a phone the Menu page shows a day picker and that day's three meals
// (no sideways week), the meal view is full screen, and its pills, clear and other buttons are at least 44 px; on a
// touch tablet the same touch sizes; on a wide screen the meal view is a side panel with the week still in view.
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
async function boot(width, height, touch) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: !!touch, isMobile: !!touch });
  const p = await ctx.newPage();
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
  return { p, ctx };
}
const small = () => [...document.querySelectorAll('#mc-menu-edit-panel .slot-pill, #mc-menu-edit-panel .slot-clear, #mc-menu-edit-panel button')]
  .filter((b) => b.offsetParent !== null && !(b.closest('details') && !b.closest('details').open && b.tagName !== 'SUMMARY'))
  .filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => b.textContent.trim().slice(0, 20));
try {
  for (const [w, h] of [[390, 860], [320, 700]]) {
    const { p, ctx } = await boot(w, h, true);
    const page = await p.evaluate(() => {
      const pick = [...document.querySelectorAll('#mc-day-picker button')];
      const cols = [...document.querySelectorAll('#mc-grid-head th.mc-day-col')].filter((th) => getComputedStyle(th).display !== 'none');
      const cards = [...document.querySelectorAll('#mc-grid-body td.mc-day-col')].filter((td) => getComputedStyle(td).display !== 'none');
      return { pick: pick.length, pickH: Math.min(...pick.map((b) => b.getBoundingClientRect().height)), cols: cols.length, cards: cards.length, wide: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(w + ' a day picker and that day’s three meals, no sideways scroll', page.pick === 7 && page.pickH >= 43.5 && page.cols === 1 && page.cards === 3 && !page.wide, page);
    const pickWed = await p.evaluate(() => { document.querySelectorAll('#mc-day-picker button')[3].click(); const th = [...document.querySelectorAll('#mc-grid-head th.mc-day-col')].find((t) => getComputedStyle(t).display !== 'none'); return th && th.textContent; });
    check(w + ' picking a day shows that day', /Wed/.test(pickWed || ''), pickWed);
    const meal = await p.evaluate(() => {
      const td = [...document.querySelectorAll('#mc-grid-body td.mc-day-col')].find((t) => getComputedStyle(t).display !== 'none');
      td.click();
      const r = document.getElementById('mc-menu-edit-panel').getBoundingClientRect();
      return { full: Math.abs(r.left) < 1 && Math.abs(r.top) < 1 && Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1, key: mcMenuEditKey };
    });
    check(w + ' the meal view opens full screen', meal.full && !!meal.key, meal);
    const tiny = await p.evaluate(small);
    check(w + ' every pill, clear and button in the meal view is at least 44 px', tiny.length === 0, tiny.slice(0, 8));
    // Review fold: the end of the meal is clear of the footer; a question opened over the meal can be tapped;
    // the out-of-date bar never covers Close.
    const bottom = await p.evaluate(() => {
      const panel = document.getElementById('mc-menu-edit-panel');
      panel.scrollTop = panel.scrollHeight;
      const kids = [...panel.children].filter((c) => c.id !== 'mc-menu-edit-footer' && c.offsetParent !== null);
      const lastBottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
      return { lastBottom, footerTop: document.getElementById('mc-menu-edit-footer').getBoundingClientRect().top };
    });
    check(w + ' the end of the meal scrolls clear of the footer', bottom.lastBottom <= bottom.footerTop + 1, bottom);
    const asks = await p.evaluate(async () => {
      const hit = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!at && (at === el || el.contains(at)); };
      const pa = doorAsk({ title: 'Test question', lines: ['x'], goLabel: 'Go', cancelLabel: 'Back' });
      await new Promise((r) => setTimeout(r, 20));
      const askOk = hit(document.querySelector('.door-ask .door-ask-go')) && hit(document.querySelector('.door-ask .door-ask-cancel'));
      document.querySelector('.door-ask .door-ask-cancel').click(); await pa;
      _showHalalCertDialog('beef', false, { main: ['beef'], mainalt: [], noporkalt: [], about: { slot: 'Main', dish: 'Beef Stew', from: 'the menu’s words' } }, () => {}, () => {});
      await new Promise((r) => setTimeout(r, 20));
      const halalOk = hit(document.getElementById('_halal-yes'));
      document.querySelectorAll('.modal-overlay.open').forEach((o) => o.remove());
      document.getElementById('mc-menu-edit-panel').scrollTop = 0;
      showStaleVersionBanner({ fileVersion: 'v99', note: 'test' });
      await new Promise((r) => setTimeout(r, 20));
      const closeBtn = [...document.querySelectorAll('#mc-menu-edit-panel button')].find((b) => b.textContent.trim() === 'Close');
      const closeOk = hit(closeBtn);
      const bar = document.getElementById('door-stale-banner'); if (bar) bar.remove(); document.documentElement.style.removeProperty('--door-stale-h');
      return { askOk, halalOk, closeOk };
    });
    check(w + ' Save questions and the halal question can be tapped over the full-screen meal', asks.askOk && asks.halalOk, asks);
    check(w + ' the out-of-date bar never covers Close', asks.closeOk, asks);
    const closed = await p.evaluate(() => { closeMenuEdit(true); return !document.body.classList.contains('mc-meal-open') && !document.getElementById('mc-menu-edit-panel').classList.contains('mc-open'); });
    check(w + ' closing it gives the page back', closed, closed);
    await ctx.close();
  }
  // A touch tablet: the touch sizes.
  {
    const { p, ctx } = await boot(820, 1100, true);
    await p.evaluate(() => openMenuEdit(2, 'TUESDAY', 'lunch'));
    const tiny = await p.evaluate(small);
    check('820 touch: every pill, clear and button in the meal view is at least 44 px', tiny.length === 0, tiny.slice(0, 8));
    await ctx.close();
  }
  // Review fold: at 1280 the meal view stays in the page (a side panel there left only Sunday in view).
  {
    const { p, ctx } = await boot(1280, 900, false);
    const pos = await p.evaluate(() => { openMenuEdit(2, 'TUESDAY', 'lunch'); return getComputedStyle(document.getElementById('mc-menu-edit-panel')).position; });
    check('1280 the meal view stays in the page, not a side panel', pos !== 'fixed', pos);
    await ctx.close();
  }
  // A wide screen: a side panel with the week still usable, the header actions in reach, Save in view.
  {
    const { p, ctx } = await boot(1600, 900, false);
    const side = await p.evaluate(() => {
      openMenuEdit(2, 'TUESDAY', 'lunch');
      const r = document.getElementById('mc-menu-edit-panel').getBoundingClientRect();
      const grid = document.getElementById('mc-grid').getBoundingClientRect();
      const save = document.getElementById('mc-menu-save-btn').getBoundingClientRect();
      const hit = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); const at = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 20)); return !!at && (at === el || el.contains(at)); };
      const days = [...document.querySelectorAll('#mc-grid-body tr:nth-child(2) td.mc-day-col')].filter(hit).length;
      return { left: r.left, right: r.right, w: innerWidth, top: r.top, saveIn: save.bottom <= innerHeight && save.top >= 0, days, more: hit(document.querySelector('details.mc-more > summary')), send: hit(document.getElementById('mc-publish-btn')) };
    });
    check('1600 the meal view is a side panel under the header', side.right >= side.w - 1 && side.top > 20, side);
    check('1600 at least four days of the week can still be clicked beside it, and More and Send are in reach', side.days >= 4 && side.more && side.send, side);
    check('1600 Save is in view in the side panel', side.saveIn, side);
    await ctx.close();
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
