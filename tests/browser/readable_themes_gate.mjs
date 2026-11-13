// tests/browser/readable_themes_gate.mjs — DOOR is readable in both themes (2026-11-13).
//
// Jason, 2026-11-13: "please run a full review of dark mode colors. Align with other HOUSE apps that have had similar
// reviews based on current standards", then "OK, please implement these changes" on the review's three leans:
//   1. CODEX's ruled dark palette (conc-recipe-hub C7, K14 and K15): greys #a3aab2 / #8b939c, one text green #52a877,
//      white text on forest fills, no mint drawn in dark;
//   2. a plating sheet printed from a dark-mode computer prints the paper palette (CODEX call 12: "a white page in any theme");
//   3. both themes in one pass, as C7 did.
//
// The measure (C7's): every visible text piece on DOOR's screens and states below, in light and dark, at 1280 and 390 px,
// against WCAG AA (4.5:1; 3:1 for text 24px, or 18.66px bold). Real Chromium, offline, the published menu, overlay and
// residents, on Monday Nov 16 2026. A screen that does not open fails rather than passing with nothing measured.
// Then the print check: the plating sheet under print media, from a dark-mode page, has the light sheet colours.
//
// Authored to fail on main 4a9c337: dark 878 misses and light 845 at 1280 px (the review census, 3,900 text pieces).
//
//   node tests/browser/readable_themes_gate.mjs           (Playwright and Chromium installed)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = new URL('../../', import.meta.url);
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, ROOT), 'utf8'));
const state = J('door_state.json'), menu = J('menu_current.json').menu, overlay = J('menu_overlay.json');

let PASS = 0; const FAILS = [];
const ok = (label, cond, detail) => { if (cond) PASS++; else FAILS.push(label + (detail === undefined ? '' : '  -> ' + JSON.stringify(detail).slice(0, 1400))); };

// Every visible text piece: its colour (with every ancestor opacity) over the composited background behind it.
const MEASURE = () => {
  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
  const bgOf = (el) => { const st = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let b = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return b; };
  const out = []; const seen = new Set(); let measured = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || seen.has(el) || el.closest('script,style,noscript')) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    let op = 1, hidden = false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none') { hidden = true; break; } op *= Number(s.opacity); }
    if (hidden || op < 0.05) continue;
    // WCAG 1.4.3 exempts inactive controls: a disabled button (Save Entry before anything is entered) is not measured.
    if (el.closest('button:disabled, input:disabled, select:disabled, [aria-disabled="true"]')) continue;
    let fg = parse(cs.color); if (!fg) continue; measured++;
    const bg = bgOf(el); fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight, 10);
    const need = (px >= 24 || (px >= 18.66 && wt >= 700)) ? 3 : 4.5;
    if (ratio < need) out.push({ t: t.slice(0, 40), el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''), fg: fg.slice(0, 3).map(Math.round).join(','), bg: bg.slice(0, 3).map(Math.round).join(','), r: Math.round(ratio * 100) / 100 });
  }
  return { total: measured, miss: out };
};

const show = (s) => async (p) => p.evaluate((s) => showScreen(s), s);
// Each state names the element that proves it opened.
const STATES = [
  ['enter (with the not-connected banner)', show('enter'), '#screen-enter'],
  ['review (allergen conflicts)', show('review'), '#screen-review'],
  ['plating sheet', show('plating'), '#screen-plating .ps-table'],
  ['registry', show('registry'), '#screen-registry'],
  ['compliance', show('compliance'), '#screen-compliance'],
  ['leftover', show('leftover'), '#screen-leftover'],
  ['reports', show('reports'), '#screen-reports'],
  ['custom reports', show('custom-reports'), '#screen-custom-reports'],
  ['settings', show('settings'), '#screen-settings'],
  ['menu config', show('menu-config'), '#screen-menu-config'],
  ['edit menu (Wk2 TUE lunch)', async (p) => p.evaluate(() => { showScreen('menu-config'); location.hash = '#menu-config/edit/2/TUESDAY/lunch'; window.dispatchEvent(new HashChangeEvent('hashchange')); }), '#mc-menu-edit-panel', 10000],
  ['DOOR question dialog', async (p) => p.evaluate(() => { showScreen('enter'); doorAsk({ title: 'Undo Generate?', lines: ['This puts the resident list back as it was before this Generate.'], items: ['Room 101a: Regular'], goLabel: 'Undo Generate', cancelLabel: 'Go back', altLabel: 'Send older list' }); }), '.door-ask .modal-box', 500],
];

async function open(browser, theme, width) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 860 : 900 }, timezoneId: 'America/Toronto' });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https?:/, (r) => r.abort());
  await page.clock.install({ time: new Date('2026-11-16T09:00:00') });
  await page.addInitScript(({ menu, overlay, state, theme }) => {
    localStorage.clear();
    localStorage.setItem('concUploadedMenu', JSON.stringify(menu));
    localStorage.setItem('concMenuBase', JSON.stringify(overlay));
    localStorage.setItem('concRegistryState', JSON.stringify({ residents: state.residents, anaphRooms: state.anaphRooms }));
    localStorage.setItem('conc-door-anaph', JSON.stringify(state.anaphRooms));
    localStorage.setItem('concAltFlagSweepV1', '1');
    if (theme === 'dark') localStorage.setItem('kdo-dark', '1');
    // Reports draws charts from a CDN script; offline, a stand-in lets the rest of the screen draw (canvas text is not measured).
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { menu, overlay, state, theme });
  await page.goto(new URL('index.html', ROOT).href);
  await page.clock.runFor(5000);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  return { page, errors };
}

const browser = await chromium.launch();
const totals = {}; const DUMP = process.env.READABLE_DUMP ? [] : null;  // READABLE_DUMP=<file>: every miss, for fixing
for (const width of [1280, 390]) {
  for (const theme of ['light', 'dark']) {
    const { page, errors } = await open(browser, theme, width);
    ok(`theme ${theme} applied (${width}px)`,
      (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === (theme === 'dark' ? 'dark' : null));
    let misses = 0, measured = 0;
    for (const [name, go, proof, wait] of STATES) {
      await go(page); await page.clock.runFor(wait || 2500);
      const opened = await page.locator(proof).first().isVisible().catch(() => false);
      ok(`${name} opens (${theme}, ${width}px)`, opened);
      const { total, miss } = await page.evaluate(MEASURE);
      measured += total; misses += miss.length;
      if (DUMP) miss.forEach((m) => DUMP.push({ state: name, theme, width, ...m }));
      ok(`${name}: every text piece reads at AA (${theme}, ${width}px; ${total} measured)`, miss.length === 0,
        { misses: miss.length, first: miss.slice(0, 8) });
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => { m.style.display = 'none'; })).catch(() => {});
    }
    totals[`${theme} ${width}`] = `${misses} of ${measured}`;
    ok(`no page errors (${theme}, ${width}px)`, errors.length === 0, errors.slice(0, 3));
    await page.close();
  }
}

// The print check: from a dark-mode page, the plating sheet prints the light sheet.
{
  const sheet = async (theme) => {
    const { page } = await open(browser, theme, 1280);
    await page.evaluate(() => showScreen('plating')); await page.clock.runFor(2500);
    await page.emulateMedia({ media: 'print' });
    const s = await page.evaluate(() => {
      const q = (sel) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); return c.backgroundColor + ' / ' + c.color; };
      return { title: q('.ps-title'), meal: q('.ps-meal'), allergen: q('.ps-allergen'), hdr: q('.ps-sect-hdr'), total: q('.ps-total-val'), cell: q('.ps-table td:not([class])'), body: getComputedStyle(document.body).backgroundColor };
    });
    await page.close(); return s;
  };
  const light = await sheet('light'), dark = await sheet('dark');
  ok('P1 the plating sheet is found under print media', light.title && light.meal && light.allergen && light.cell, light);
  for (const k of Object.keys(light)) ok(`P2 printed from dark mode, the sheet's ${k} is the light sheet's (${light[k]})`, dark[k] === light[k], { dark: dark[k], light: light[k] });
}
await browser.close();
if (DUMP) fs.writeFileSync(process.env.READABLE_DUMP, JSON.stringify(DUMP));

console.log('census (misses of text pieces):', JSON.stringify(totals));
const total = PASS + FAILS.length;
if (FAILS.length) { console.log(`readable_themes_gate: ${PASS}/${total} passed — ${FAILS.length} FAILED`); FAILS.forEach((f) => console.log('  x ' + f)); process.exit(1); }
console.log(`readable_themes_gate: ${total}/${total} passed`);
