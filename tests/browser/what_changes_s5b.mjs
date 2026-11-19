// S5b of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): What changes.
// Once a meal differs from how it opened, the editor shows each plate before and after (from doorPlateFacts on the
// stored meal, with no dated meal, against the draft), the residents who move plates (counts) and the anaphylactic
// residents affected or not. The counts must equal the plating sheet before and after (computePlatingData on the stored
// meal, then on the meal as Save would write it). A meal with a swap on its next date still shows the every-week moves,
// and names the swap the Save replaces. With no resident list it reads "counts not available", never "none".
// Real app in Chromium, the published menu, network blocked, made-up residents only.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 700) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
// Made-up residents: one per tag combination the routing reads, two anaphylactic rooms.
const TAGS = [['Regular'], ['Vegan'], ['Vegetarian'], ['Halal'], ['No Pork'], ['GF'], ['No Dairy'], ['Lactose Intolerant'], ['No Eggs'],
  ['No Mustard'], ['No Fish'], ['No Shellfish'], ['No Beef'], ['No Spicy'], ['Bland Diet'], ['Soft Meals'], ['Diabetic'], ['Low Carb'],
  ['No Peanuts'], ['No Tree Nuts'], ['No Sesame'], ['No Soy'], ['Halal', 'No Eggs'], ['GF', 'No Dairy'], ['Vegan', 'GF'], ['Halal', 'Soft Meals'],
  ['No Pork', 'GF'], ['Diabetic', 'No Spicy'], ['No Coconut'], ['No Mushroom'], ['No Beans'], ['No Brassicas'], ['No Nightshades']];
const RES = TAGS.map((tags, i) => ({ room: String(100 + i) + 'z', tags, rawRestriction: tags.join(', '), section: '' }));
RES.push({ room: '900z', tags: ['No Peanuts'], rawRestriction: 'No Peanuts', isAnaph: true, anaphTags: ['noPeanuts'] });
RES.push({ room: '901z', tags: ['No Eggs'], rawRestriction: 'No Eggs', isAnaph: true, anaphTags: ['noEggs'] });
const browser = await chromium.launch();
async function boot(width, withResidents) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.route(/^https?:/, (r) => r.abort());
  await p.addInitScript(({ m, o }) => {
    localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
    localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
    window.Chart = function () { return { destroy() {}, update() {} }; };
  }, { m: menu, o: overlay });
  await p.goto(pathToFileURL(source).href);
  await p.waitForFunction(() => typeof openMenuEdit === 'function');
  await p.evaluate((res) => {
    REGISTRY_LIST.length = 0;
    res.forEach((r) => REGISTRY_LIST.push(r));
    anaphRooms = res.filter((r) => r.isAnaph).map((r) => r.room);
    showScreen('menu-config');
  }, withResidents ? RES : []);
  return p;
}
// In the page: the plating sheet seats of the stored meal and of the meal as Save would write it, and the tally.
const expectHelpers = () => {
  window.__seatsOf = (pd) => {
    const s = {};
    if (!pd) return s;
    (pd.anaphSect || []).forEach((r) => { s[r.room] = 'Anaphylactic Alternative'; });
    (pd.sections || []).forEach((sec) => sec.residents.forEach((r) => { s[r.room] = sec.rule.label; }));
    return s;
  };
  window.__expected = (wk, day, per) => {
    const swaps = localStorage.getItem('concMealSwaps');
    localStorage.removeItem('concMealSwaps');   // the every-week meal on both sides, as What changes compares
    let before;
    try { before = window.__seatsOf(computePlatingData(per, wk, day, REGISTRY_LIST)); } catch (e) { if (swaps !== null) localStorage.setItem('concMealSwaps', swaps); throw e; }
    const ov = JSON.parse(JSON.stringify(loadMenuBaseOverlay() || {}));
    if (!ov[wk]) ov[wk] = {};
    if (!ov[wk][day]) ov[wk][day] = {};
    const flags = {};
    FLAG_DEFS.forEach((f) => { const cb = document.getElementById('mc-edit-flag-' + f.key); if (cb && cb.checked) flags[f.key] = true; });
    doorWriteEditorMeal(ov[wk][day], per, doorEditedMealName(), buildVegAlt(), doorEditorDraftFlags(flags));
    const was = getDoorPublishMenuOverlayOverride();
    let after;
    try { setDoorPublishMenuOverlayOverride(ov); after = window.__seatsOf(computePlatingData(per, wk, day, REGISTRY_LIST)); }
    finally { setDoorPublishMenuOverlayOverride(was); if (swaps !== null) localStorage.setItem('concMealSwaps', swaps); }
    const tally = {};
    let moved = 0;
    REGISTRY_LIST.forEach((r) => { const a = before[r.room] || '', b = after[r.room] || ''; if (a !== b) { moved++; tally[a + ' → ' + b] = (tally[a + ' → ' + b] || 0) + 1; } });
    return { moved, tally };
  };
  window.__gotTally = (m) => { const t = {}; (m.moves || []).forEach((x) => { t[x.from + ' → ' + x.to] = x.count; }); return t; };
};
try {
  const p = await boot(1280, true);
  await p.evaluate(expectHelpers);
  // 1. Every lunch and dinner: tick or untick Egg and Peanuts; the counts equal plating before and after.
  const census = await p.evaluate(async () => {
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const out = { meals: 0, withMoves: 0, anaphHit: 0, differ: [], missing: [], hiddenBefore: [], wrote: [] };
    const base = localStorage.getItem('concMenuBase');
    for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const per of ['lunch', 'dinner']) {
      if (!doorPlateFactsFor(wk, day, per, { noDated: true })) continue;
      openMenuEdit(Number(wk), day, per);
      await new Promise((r) => setTimeout(r, 10));
      const tag = 'W' + wk + ' ' + day.slice(0, 3) + ' ' + per;
      const panel = document.getElementById('mc-what-changes');
      if (panel && panel.style.display !== 'none') out.hiddenBefore.push(tag);
      ['hasEgg', 'hasPeanuts'].forEach((k) => { const cb = document.getElementById('mc-edit-flag-' + k); if (cb) cb.click(); });
      updateSlotSummary();
      const m = window.__DOOR_WHAT_CHANGES__;
      out.meals++;
      if (!m || !document.querySelector('#mc-what-changes .door-what-changes')) { out.missing.push(tag); closeMenuEdit(true); continue; }
      const want = window.__expected(wk, day, per);
      const got = window.__gotTally(m);
      if (m.moved !== want.moved || JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(want.tally).sort())) out.differ.push({ tag, got, want: want.tally });
      if (m.moved) out.withMoves++;
      if (m.anaph.some((a) => a.before !== a.after)) out.anaphHit++;
      closeMenuEdit(true);
    }
    if (localStorage.getItem('concMenuBase') !== base) out.wrote.push('overlay changed');
    return out;
  });
  check('What changes is hidden until the meal differs from how it opened', census.hiddenBefore.length === 0, census.hiddenBefore.slice(0, 4));
  check('every lunch and dinner shows What changes once changed (' + census.meals + ' meals)', census.meals >= 50 && census.missing.length === 0, census.missing.slice(0, 4));
  check('the residents who move plates equal the plating sheet before and after, on every meal', census.differ.length === 0, census.differ.slice(0, 3));
  check('the change moves residents on most meals and names the anaphylactic rooms it affects', census.withMoves >= 40 && census.anaphHit >= 40, census);
  check('working out What changes writes nothing', census.wrote.length === 0, census.wrote);

  // 2. The words: plates before → after, the new allergen, the moves, and the anaphylactic room in red.
  const words = await p.evaluate(() => {
    openMenuEdit(1, 'MONDAY', 'lunch');
    const cb = document.getElementById('mc-edit-flag-hasPeanuts'); if (cb && !cb.checked) cb.click();
    updateSlotSummary();
    const t = document.getElementById('mc-what-changes').textContent;
    const red = [...document.querySelectorAll('#mc-what-changes .door-what-changes div')].some((d) => /Room 900z \(anaphylactic\)/.test(d.textContent) && /danger/.test(d.getAttribute('style') || ''));
    closeMenuEdit(true);
    return { t, red };
  });
  check('it reads the regular plate before → after and the new allergen in kitchen words', /Regular plate:.*→/.test(words.t) && /New: .*Peanuts/.test(words.t), words.t.slice(0, 400));
  check('it counts the residents who move and names the anaphylactic room it now affects, in red', /residents? moves? to another plate/.test(words.t) && words.red, words.t.slice(0, 600));

  // 3. A meal with a swap on its next date still shows the every-week moves, and names the swap the Save replaces.
  const swap = await p.evaluate(async () => {
    const next = nextDateForSlot(1, 'MONDAY');
    const key = doorDateKey(next) + '-lunch';
    const store = loadMealSwaps();
    store[key] = { specialName: 'Peanut Satay Test', veg: 'Tofu', allergens: 'peanuts', _flagsRaw: { hasPeanuts: true }, _rotationSlot: '1-MONDAY-lunch' };
    saveMealSwaps(store);
    openMenuEdit(1, 'MONDAY', 'lunch');
    const cb = document.getElementById('mc-edit-flag-hasPeanuts'); if (cb && !cb.checked) cb.click();
    updateSlotSummary();
    const m = window.__DOOR_WHAT_CHANGES__;
    const want = window.__expected('1', 'MONDAY', 'lunch');
    const t = document.getElementById('mc-what-changes').textContent;
    closeMenuEdit(true);
    const s2 = loadMealSwaps(); delete s2[key]; saveMealSwaps(s2);
    return { moved: m && m.moved, want: want.moved, some: !!(m && m.moved > 0), same: m && JSON.stringify(Object.entries(window.__gotTally(m)).sort()) === JSON.stringify(Object.entries(want.tally).sort()), t, swaps: m && m.swaps.length };
  });
  check('a meal with a swap on its next date still shows the every-week moves', swap.same && swap.some && swap.moved === swap.want, swap);
  check('it names the one-date change the Save replaces', swap.swaps === 1 && /one-date change for .*Peanut Satay Test.*is replaced/.test(swap.t), swap.t.slice(0, 500));
  await p.close();

  // 4. No resident list: counts not available, never none.
  const q = await boot(390, false);
  const none = await q.evaluate(() => {
    openMenuEdit(2, 'TUESDAY', 'dinner');
    const cb = document.getElementById('mc-edit-flag-hasEgg'); if (cb) cb.click();
    updateSlotSummary();
    const m = window.__DOOR_WHAT_CHANGES__;
    const t = document.getElementById('mc-what-changes').textContent;
    const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
    closeMenuEdit(true);
    return { counts: m && m.counts, t, wide };
  });
  check('with no resident list it reads counts not available, never none', none.counts === 'none' && /counts not available/.test(none.t) && !/No resident moves/.test(none.t) && !/not affected/.test(none.t), none);
  check('the panel fits a phone without sideways scroll', !none.wide, none);
  await q.close();
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally { await browser.close(); }
const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
if (passed !== results.length) process.exit(1);
