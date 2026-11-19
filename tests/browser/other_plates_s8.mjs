// S8 of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): "Other plates the kitchen makes" (M13).
// One row per plate the meal has, "+ Add a plate for..." for the rest, one plain sentence on a plate not made, and per
// plate how many residents get it. The rows equal the alternatives stored; each count equals the plating sheet.
// Real app in Chromium, the published menu, network blocked, made-up residents only.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 600) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const TAGS = [['Regular'], ['GF'], ['GF'], ['Diabetic'], ['Low Carb'], ['No Dairy'], ['Lactose Intolerant'], ['No Eggs'], ['No Spicy'], ['Vegan'], ['Halal'], ['GF', 'No Dairy']];
const RES = TAGS.map((tags, i) => ({ room: String(200 + i) + 'z', tags, rawRestriction: tags.join(', ') }));
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => errors.push(e.message));
await p.route(/^https?:/, (r) => r.abort());
await p.addInitScript(({ m, o }) => {
  localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
  localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
  window.Chart = function () { return { destroy() {}, update() {} }; };
}, { m: menu, o: overlay });
await p.goto(pathToFileURL(source).href);
await p.waitForFunction(() => typeof openMenuEdit === 'function');
try {
  const r = await p.evaluate((res) => {
    REGISTRY_LIST.length = 0; res.forEach((x) => REGISTRY_LIST.push(x));
    showScreen('menu-config');
    const out = { meals: [] };
    const KEYS = { gfAlt: 'gf', diabeticAlt: 'diabetic', noDairyAlt: 'no_dairy', noEggAlt: 'no_egg', blandAlt: 'bland' };
    for (const [wk, day] of [[2, 'SUNDAY'], [2, 'FRIDAY'], [4, 'MONDAY']]) {
      openMenuEdit(wk, day, 'lunch');
      updateSlotSummary();
      const d = getMenuData()[String(wk)][day];
      const stored = Object.keys(DOOR_KITCHEN_ALT_LABELS).filter((k) => String(d['lunch_' + k] || '').trim());
      const shown = [...document.querySelectorAll('.mc-kalt-row')].filter((row) => row.style.display !== 'none').map((row) => row.dataset.kalt);
      const pd = computePlatingData('lunch', wk, day, REGISTRY_LIST);
      const counts = shown.filter((k) => KEYS[k]).map((k) => {
        const fb = (document.getElementById('door-alt-feedback-' + k) || {}).textContent || '';
        const m = fb.match(/(\d+) residents?/);
        const sec = (pd.sections.find((s) => s.rule.key === KEYS[k]) || { residents: [] }).residents.length;
        return { k, shown: m ? Number(m[1]) : null, plating: sec };
      });
      const select = [...document.querySelectorAll('#mc-kalt-add-select option')].map((o) => o.value).filter(Boolean);
      out.meals.push({ meal: wk + ' ' + day, stored, shown, counts, select, dirty: doorMenuDraftIsDirty(),
        title: document.getElementById('mc-kitchen-alts-title').textContent, text: document.getElementById('mc-menu-edit-panel').textContent });
      closeMenuEdit(true);
    }
    openMenuEdit(2, 'SUNDAY', 'lunch');
    const hidden = [...document.querySelectorAll('.mc-kalt-row')].find((row) => row.style.display === 'none');
    doorAddPlateRow(hidden.dataset.kalt);
    out.added = { key: hidden.dataset.kalt, nowShown: hidden.style.display !== 'none', focused: document.activeElement && document.activeElement.id === 'mc-kalt-' + hidden.dataset.kalt,
      stillOffered: [...document.querySelectorAll('#mc-kalt-add-select option')].some((o) => o.value === hidden.dataset.kalt) };
    closeMenuEdit(true);
    openMenuEdit(1, 'MONDAY', 'breakfast');
    out.bk = document.getElementById('mc-kitchen-alts-title').textContent;
    closeMenuEdit(true);
    return out;
  }, RES);
  for (const m of r.meals) {
    check(m.meal + ': one row per plate the meal has, and the others offered under + Add a plate for…', JSON.stringify(m.shown.sort()) === JSON.stringify(m.stored.sort()) && m.select.length === 6 - m.stored.length, m);
    check(m.meal + ': each plate’s resident count equals the plating sheet', m.counts.length > 0 && m.counts.every((c) => c.shown === c.plating), m.counts);
    check(m.meal + ': plain words, no routing jargon', m.title === 'Other plates the kitchen makes' && !/Draft routing|requirement group|existing fallback|Restriction-specific|CODEX declarations/.test(m.text), m.title);
    check(m.meal + ': opening the meal changes nothing', !m.dirty, m);
  }
  check('+ Add a plate for… shows that plate’s box, focused, and no longer offers it', r.added.nowShown && r.added.focused && !r.added.stillOffered, r.added);
  check('breakfast uses the same name', r.bk === 'Other plates the kitchen makes', r.bk);
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((x) => x.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
