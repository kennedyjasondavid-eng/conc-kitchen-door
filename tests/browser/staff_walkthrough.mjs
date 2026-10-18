// tests/browser/staff_walkthrough.mjs — the routing audit's staff walkthrough (2026-10-18, audit A8).
// Not run by `node --test tests/*.mjs`. Run from the repo root with conc-recipe-hub beside it:
//   node tests/browser/staff_walkthrough.mjs
// Real Chromium, offline, the published residents / menu / overlay / swaps, at 1280 and 390 px, on Mon Oct 26
// (Wk1 MON) and the plating sheets for the meals the audit changed. It checks what staff would read on each screen
// and saves a screenshot of each to docs/receipts/walkthrough_2026-10-18/. Exits non-zero if a check fails.
import fs from 'node:fs';
const { chromium } = await import(process.env.DOOR_PW || '../../../conc-recipe-hub/tests/_pw.mjs').catch(() => import('playwright'));
const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('docs/receipts/walkthrough_2026-10-18/', ROOT);
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, ROOT), 'utf8'));
const state = J('door_state.json'), menu = J('menu_current.json').menu, overlay = J('menu_overlay.json'), swaps = J('meal_swaps.json');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

async function session(width) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 860 : 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https?:/, (r) => r.abort());
  await page.clock.install({ time: new Date('2026-10-26T09:00:00') });
  await page.addInitScript(({ menu, overlay, swaps, state }) => {
    if (sessionStorage.getItem('_seeded')) return;
    localStorage.clear();
    localStorage.setItem('concUploadedMenu', JSON.stringify(menu));
    localStorage.setItem('concMenuBase', JSON.stringify(overlay));
    localStorage.setItem('concMealSwaps', JSON.stringify(swaps));
    localStorage.setItem('concRegistryState', JSON.stringify({ residents: state.residents, anaphRooms: state.anaphRooms }));
    localStorage.setItem('conc-door-anaph', JSON.stringify(state.anaphRooms));
    localStorage.setItem('concAltFlagSweepV1', '1');
    sessionStorage.setItem('_seeded', '1');
  }, { menu, overlay, swaps, state });
  await page.goto(new URL('index.html', ROOT).href);
  await page.clock.runFor(4000);
  // the published residents, whatever the boot restored
  await page.evaluate(({ residents, rooms }) => {
    REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...residents.map((r) => ({ ...r })));
    Object.keys(REGISTRY_MAP).forEach((k) => delete REGISTRY_MAP[k]);
    REGISTRY_LIST.forEach((r) => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
    anaphRooms.splice(0, anaphRooms.length, ...rooms);
    BASE_SECTIONS.splice(0, BASE_SECTIONS.length, ...computeBaseSections());
  }, { residents: state.residents, rooms: state.anaphRooms });
  return { browser, page, errors };
}

async function shot(page, locator, name) {
  const el = page.locator(locator).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.screenshot({ path: new URL(name, OUT).pathname });
}

for (const width of [1280, 390]) {
  const { browser, page, errors } = await session(width);
  const w = width + 'px';
  // 1. Daily Entry: look up room 213 for an update — the card says where they eat today, meal by meal.
  await page.evaluate(() => { showScreen('enter', document.querySelector('[data-screen=enter]')); });
  await page.evaluate(() => { document.getElementById('change-type').value = 'update'; document.getElementById('room-number').value = '213'; lookupRoom('213'); });
  const card213 = await page.locator('#room-lookup').innerText();
  check(w + ' room lookup 213: Lunch → Soft Meals · Dinner → Anaphylactic Alternative', /Lunch → Soft Meals · Dinner → Anaphylactic Alternative/.test(card213), card213.replace(/\s+/g, ' ').slice(0, 200));
  check(w + ' room lookup 213: red anaphylactic line', /ANAPHYLACTIC/.test(card213));
  check(w + ' the anaphylactic toggle starts on for 213', await page.evaluate(() => document.getElementById('anaph-toggle').classList.contains('on')));
  await shot(page, '#room-lookup', `${width}_1_room_lookup_213.png`);
  // 2. the same for 504 (Halal + No Fish + No Shellfish + No Molluscs)
  await page.evaluate(() => { document.getElementById('room-number').value = '504'; lookupRoom('504'); });
  const card504 = await page.locator('#room-lookup').innerText();
  check(w + ' room lookup 504: today\'s seats shown', /Today: Lunch → .* · Dinner → /.test(card504), card504.replace(/\s+/g, ' ').slice(0, 200));
  check(w + ' the anaphylactic toggle starts off for 504', !(await page.evaluate(() => document.getElementById('anaph-toggle').classList.contains('on'))));

  // 3. Plating sheets
  const plate = async (week, day, period, file) => {
    await page.evaluate(({ week, day, period }) => {
      showScreen('plating', document.querySelector('[data-screen=plating]'));
      psWhen = 'browse'; psWeek = week; psDay = day; psPeriod = period; initPlatingPreview();
    }, { week, day, period });
    await page.waitForTimeout(150);
    const html = await page.locator('#ps-preview').innerHTML();
    if (width === 390) await shot(page, '#ps-preview', file);   // the sheets once, at phone width (1280 repeats them)
    return html;
  };
  const rowNote = (html, room) => { const m = html.match(new RegExp('<td>[^<]*</td><td>' + room + '</td><td>([^<]*)</td>')); return m ? m[1] : null; };
  let h = await plate(1, 'MONDAY', 'dinner', `${width}_2_plating_wk1_mon_dinner.png`);
  check(w + ' Wk1 MON dinner: the anaphylactic alert names 213', /ANAPHYLACTIC ALERT[^<]*213/.test(h));
  check(w + ' Wk1 MON dinner: 213 on the Anaphylactic Alternative, marked', /<td>213<\/td><td>⚠ ANAPHYLACTIC<\/td>/.test(h));
  check(w + ' Wk1 MON dinner: 709 (Soft Meals) on another plate says "soft"', /\bsoft\b/.test(rowNote(h, '709') || ''), rowNote(h, '709'));
  h = await plate(1, 'TUESDAY', 'dinner', `${width}_3_plating_wk1_tue_dinner.png`);
  check(w + ' Wk1 TUE dinner (Pork Carnitas, now Spicy): 310b on Bland', /Bland[\s\S]*?<td>310b<\/td>/.test(h));
  check(w + ' Wk1 TUE dinner: 711 on the soft alternative', /Alternative Meals[\s\S]*?<td>711<\/td>/.test(h));
  check(w + ' Wk1 TUE dinner: 709 on Halal says soft and not spicy', /soft/.test(rowNote(h, '709') || '') && /not spicy/.test(rowNote(h, '709') || ''), rowNote(h, '709'));
  check(w + ' Wk1 TUE dinner: 910 on Halal says not spicy', /not spicy/.test(rowNote(h, '910') || ''), rowNote(h, '910'));
  h = await plate(2, 'TUESDAY', 'dinner', `${width}_4_plating_wk2_tue_dinner.png`);
  check(w + ' Wk2 TUE dinner (Pork Vindaloo): 801 on the vegan plate says not spicy', /not spicy/.test(rowNote(h, '801') || ''), rowNote(h, '801'));
  h = await plate(2, 'THURSDAY', 'dinner', `${width}_5_plating_wk2_thu_dinner.png`);
  check(w + ' Wk2 THU dinner (vegan sausages, wheat): 301a says gluten-free', /gluten-free/.test(rowNote(h, '301a') || ''), rowNote(h, '301a'));
  h = await plate(2, 'TUESDAY', 'lunch', `${width}_6_plating_wk2_tue_lunch_swap.png`);
  check(w + ' Wk2 TUE lunch: the Nov 3 swap routes, and the sheet says so', /Halal Beef Burger/.test(h) && /Swap for Nov 3/.test(h));
  check(w + ' Wk2 TUE lunch: 704 (No Beef) on the vegan plate', /Vegan \/ Vegetarian[\s\S]*?<td>704<\/td>/.test(h));
  h = await plate(2, 'SATURDAY', 'lunch', `${width}_7_plating_wk2_sat_lunch_halal.png`);
  check(w + ' Wk2 SAT lunch: the halal plate says what it contains', /Halal[^<]*\|\s*CONTAINS:[^<]*EGG/i.test(h));
  check(w + ' Wk2 SAT lunch: 304 (Halal + No Eggs) says no egg', /no egg/.test(rowNote(h, '304') || ''), rowNote(h, '304'));
  // 4. Labels: 213 and 813 red
  await page.evaluate(() => { window.print = () => {}; printLabels(); });
  const labels = await page.locator('#labels-print-content').innerHTML();
  const near = (room) => { const i = labels.indexOf('>' + room + '<'); return i < 0 ? '' : labels.slice(Math.max(0, i - 500), i + 500); };
  check(w + ' labels: 213 is marked anaphylactic', /ANAPHYLACTIC/.test(near('213')));
  check(w + ' labels: 813 has a label, marked anaphylactic', /ANAPHYLACTIC/.test(near('813')));
  check(w + ' no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
const md = `# DOOR staff walkthrough — receipt (2026-10-18, audit A8)

Generated by \`tests/browser/staff_walkthrough.mjs\`: real Chromium, offline, the published residents, menu, overlay and swaps, on Mon Oct 26 (Wk1 MON), at 1280 and 390 px.
Screenshots are beside this file: the room lookup at both widths, the plating sheets at 390 px (\`<width>_<step>_….png\`).

**${results.length - failed.length} / ${results.length} checks pass.**

| | Check | Seen |
|---|---|---|
${results.map((r) => '| ' + (r.ok ? '✓' : '✗') + ' | ' + r.name + ' | ' + String(r.detail == null ? '' : r.detail).replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 140) + ' |').join('\n')}
`;
fs.writeFileSync(new URL('README.md', OUT), md);
console.log(md);
if (failed.length) process.exit(1);
