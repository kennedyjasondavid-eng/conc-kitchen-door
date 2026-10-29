// tests/browser/rex_week_review.mjs — Rex's week sheet, uploaded through the real Menu Config screen (2026-10-29).
// Not run by `node --test tests/*.mjs`. Run from the repo root:
//   REX_XLSX_JS=/path/to/xlsx.bundle.min.js node tests/browser/rex_week_review.mjs
// Real Chromium, offline except the xlsx library (served from REX_XLSX_JS, else fetched from its CDN), with the
// published menu, overlay and residents, on Thu Oct 29 2026 in Toronto. It uploads both of Rex's sheets in
// tests/fixtures/rex_week/, answers the review, saves, and checks what DOOR stored; at 1280 and 390 px, with a
// screenshot of each review in docs/receipts/rex_week_2026-10-29/. Exits non-zero if a check fails.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const _pw = await import(process.env.DOOR_PW || '../../../conc-recipe-hub/tests/_pw.mjs').catch(() => import('playwright'));
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);
const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('docs/receipts/rex_week_2026-10-29/', ROOT);
fs.mkdirSync(OUT, { recursive: true });
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, ROOT), 'utf8'));
const state = J('door_state.json'), menu = J('menu_current.json').menu, overlay = J('menu_overlay.json');
const SHEET = (n) => fileURLToPath(new URL('tests/fixtures/rex_week/' + n, ROOT));
const W1 = SHEET('Week 1 - Menu Oct 25 - Oct 31 -.xlsx'), W4 = SHEET('Week 4 18 Oct - 24 Oct.xlsx');
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.min.js';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

let KITCHEN_ANSWERS = null;   // rex_week_answers.json as "the kitchen" holds it, for the two-computer check
async function session(width) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 860 : 900 }, timezoneId: 'America/Toronto' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.route(/^https?:/, (r) => {
    if (/\/main\/rex_week_answers\.json/.test(r.request().url())) return KITCHEN_ANSWERS ? r.fulfill({ contentType: 'application/json', body: KITCHEN_ANSWERS }) : r.fulfill({ status: 404, body: '' });
    if (r.request().url() !== XLSX_URL) return r.abort();
    if (process.env.REX_XLSX_JS) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.REX_XLSX_JS, 'utf8') });
    return r.continue();
  });
  await page.clock.install({ time: new Date('2026-10-29T09:00:00') });
  await page.addInitScript(({ menu, overlay, state }) => {
    if (sessionStorage.getItem('_seeded')) return;
    localStorage.clear();
    localStorage.setItem('concUploadedMenu', JSON.stringify(menu));
    localStorage.setItem('concMenuBase', JSON.stringify(overlay));
    localStorage.setItem('concMealSwaps', '{}');
    localStorage.setItem('concRegistryState', JSON.stringify({ residents: state.residents, anaphRooms: state.anaphRooms }));
    localStorage.setItem('concAltFlagSweepV1', '1');
    localStorage.setItem('concOperatorName', 'Jason');
    sessionStorage.setItem('_seeded', '1');
  }, { menu, overlay, state });
  await page.goto(new URL('index.html', ROOT).href);
  await page.clock.runFor(4000);
  await page.evaluate(() => showScreen('menu-config'));
  return { browser, page, errors };
}
async function upload(page, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#mc-rex-week-btn')]);
  await chooser.setFiles(file);
  await page.waitForSelector('.rex-week-review', { timeout: 10000 });
}
const meal = (page, w, d, p) => page.evaluate(([w, d, p]) => { const m = getMenuData()[w][d]; return { text: m[p], veg: m[p + '_veg'], halal: m[p + '_halal'], flags: m[p + '_flags'], original: (loadMenuBaseOverlay()[w] || {})[d] && loadMenuBaseOverlay()[w][d][p + '_original'], slots: m[p + '_slots'] }; }, [w, d, p]);
const pick = (page, key, v) => page.check(`.rex-week-review [data-rex-choice="${key}"][value="${v}"]`);

for (const width of [1280, 390]) {
  const w = width + 'px';
  // ── Week 1 (Oct 25–31): six questions, answered and saved ──
  {
    const { browser, page, errors } = await session(width);
    await upload(page, W1);
    const review = page.locator('.rex-week-review');
    const txt = await review.innerText();
    check(w + ' W1 review names the week and its dates', /Week 1/.test(txt) && /Oct 25/.test(txt) && /from the file name/.test(txt), txt.slice(0, 200));
    check(w + ' W1 summary: 15 match, 6 to look at', /15\s*meals match DOOR/.test(txt) && /6\s*to look at/.test(txt), txt.match(/\d+\s*meals match[^\n]*/)?.[0]);
    const qs = await review.locator('.rex-q').evaluateAll(n => n.map(x => x.dataset.rexMeal));
    check(w + ' W1 the six meals asked', JSON.stringify(qs) === JSON.stringify(['1-SUNDAY-dinner', '1-MONDAY-dinner', '1-TUESDAY-lunch', '1-THURSDAY-lunch', '1-FRIDAY-breakfast', '1-FRIDAY-lunch']), qs);
    check(w + ' W1 Fri lunch says the sheet disagrees with itself', /meal row says “Potato Hash”, but its Veg lunch row still says “Potato Salad”/.test(txt));
    check(w + ' W1 Thu lunch asks what Halal residents get', await review.locator('[data-rex-halal="1-THURSDAY-lunch"]').count() === 1);
    check(w + ' W1 this week only offered from today on (Thu, Fri), not on past days',
      await review.locator('[data-rex-choice="1-THURSDAY-lunch"][value="week"]').count() === 1 && await review.locator('[data-rex-choice="1-SUNDAY-dinner"][value="week"]').count() === 0);
    check(w + ' W1 Mon dinner offers Jerk Cauliflower Steaks, or none', /Jerk Cauliflower Steaks recipe/.test(txt) || (await review.locator('select[data-rex-link="1-MONDAY-dinner"] option').count()) >= 1);
    check(w + ' W1 Rex’s allergen rows are said not to be used', /allergen rows aren’t used/.test(txt));
    await review.screenshot({ path: new URL('week1_review_' + width + '.png', OUT).pathname });
    await pick(page, '1-MONDAY-dinner', 'keep');
    await pick(page, '1-THURSDAY-lunch', 'keep');
    await page.click('#rex-week-save');
    await page.clock.runFor(1500);
    check(w + ' W1 the review closes on save', await page.locator('.rex-week-review').count() === 0);
    const fri = await meal(page, '1', 'FRIDAY', 'lunch');
    check(w + ' W1 Fri lunch: Potato Hash replaces Potato Salad, the original kept', fri.text === 'Honey BBQ Halal Chicken Drumsticks, Potato Hash' && fri.veg === 'Vegan Drumsticks, Potato Hash' && fri.original && /Potato Salad/.test(fri.original.meal['']), fri);
    const sun = await meal(page, '1', 'SUNDAY', 'dinner');
    check(w + ' W1 Sun dinner: Noodles for Pasta, still Beef Stroganoff', sun.text === 'Beef Stroganoff, Noodles' && sun.flags.hasBeef && sun.flags.hasGluten, sun.text);
    const tue = await meal(page, '1', 'TUESDAY', 'lunch');
    check(w + ' W1 Tue lunch: Roasted Tofu on the vegan line', /^Roasted Tofu/.test(tue.veg) && tue.slots && tue.slots.veganalt && (tue.slots.veganalt.recipeName || tue.slots.veganalt.manual), tue.veg);
    const mon = await meal(page, '1', 'MONDAY', 'dinner');
    check(w + ' W1 Mon dinner kept: Jerk Tofu stays', /^Jerk Tofu/.test(mon.veg), mon.veg);
    const thu = await meal(page, '1', 'THURSDAY', 'lunch');
    check(w + ' W1 Thu lunch kept: Side Salad stays', /Side Salad/.test(thu.text), thu.text);
    const answers = await page.evaluate(() => loadRexWeekAnswers());
    check(w + ' W1 the two Keep DOOR’s answers are remembered', answers['1-MONDAY-dinner'] && answers['1-THURSDAY-lunch'] && answers['1-THURSDAY-lunch'].by === 'Jason', Object.keys(answers));
    const log = await page.evaluate(() => loadChangeLog().filter(e => e.via === 'rex-week').length);
    check(w + ' W1 four rotation changes in the change log', log === 4, log);
    // The same sheet again: nothing left to ask; the two kept are listed.
    await upload(page, W1);
    const txt2 = await page.locator('.rex-week-review').innerText();
    check(w + ' W1 again: nothing to look at, two kept', /0\s*to look at/.test(txt2) && /2\s*kept as answered before/.test(txt2) && await page.locator('.rex-week-review .rex-q').count() === 0, txt2.match(/\d+\s*meals match[^\n]*/)?.[0]);
    await page.click('#rex-week-cancel');
    check(w + ' W1 no page errors', errors.length === 0, errors);
    await browser.close();
  }
  // ── Two computers: Keep DOOR's on one, not asked again on the other; taken back on the other, asked again here ──
  {
    KITCHEN_ANSWERS = null;
    const A = await session(width);
    await A.page.evaluate(() => { window.__sent = []; PublishAuth.sidePublish = (path, content) => { window.__sent.push({ path, content }); return Promise.resolve({ ok: true }); }; });
    await upload(A.page, W1);
    await pick(A.page, '1-MONDAY-dinner', 'keep');
    await A.page.click('#rex-week-save');
    await A.page.waitForFunction(() => window.__sent.some(x => x.path === 'rex_week_answers.json'), null, { timeout: 10000 }).catch(() => {});
    const sent = await A.page.evaluate(() => window.__sent.filter(x => x.path === 'rex_week_answers.json').pop());
    check(w + ' 2pc computer A sends its answer to the kitchen', sent && JSON.parse(sent.content)['1-MONDAY-dinner'].answer === 'keep', sent);
    KITCHEN_ANSWERS = sent && sent.content;
    const B = await session(width);
    await B.page.evaluate(() => { window.__sent = []; PublishAuth.sidePublish = (path, content) => { window.__sent.push({ path, content }); return Promise.resolve({ ok: true }); }; });
    await upload(B.page, W1);
    const txtB = await B.page.locator('.rex-week-review').innerText();
    check(w + ' 2pc computer B: Mon dinner kept, not asked', await B.page.locator('.rex-week-review .rex-q[data-rex-meal="1-MONDAY-dinner"]').count() === 0 && /1\s*kept as answered before/.test(txtB), txtB.match(/\d+\s*meals match[^\n]*/)?.[0]);
    await B.page.click('#rex-week-cancel');
    // B takes it back by saving Rex's dish from the sheet: the next review on B asks; the kitchen's copy says cleared
    await B.page.evaluate(() => { const a = loadRexWeekAnswers(); a['1-MONDAY-dinner'] = { answer: 'cleared', at: new Date(Date.now() + 1000).toISOString(), by: 'Rex' }; saveRexWeekAnswers(a); });
    await B.page.waitForFunction(() => window.__sent.some(x => x.path === 'rex_week_answers.json' && /cleared/.test(x.content)), null, { timeout: 10000 }).catch(() => {});
    const sentB = await B.page.evaluate(() => window.__sent.filter(x => x.path === 'rex_week_answers.json').pop());
    check(w + ' 2pc computer B sends the take-back', sentB && JSON.parse(sentB.content)['1-MONDAY-dinner'].answer === 'cleared', sentB);
    KITCHEN_ANSWERS = sentB && sentB.content;
    await upload(A.page, W1);
    check(w + ' 2pc computer A asks again after the take-back', await A.page.locator('.rex-week-review .rex-q[data-rex-meal="1-MONDAY-dinner"]').count() === 1);
    check(w + ' 2pc no page errors', A.errors.length === 0 && B.errors.length === 0, A.errors.concat(B.errors));
    await A.browser.close(); await B.browser.close();
    KITCHEN_ANSWERS = null;
  }
  // ── Week 1, Thu lunch this week only: a dated swap on Oct 29 ──
  {
    const { browser, page, errors } = await session(width);
    await upload(page, W1);
    await pick(page, '1-THURSDAY-lunch', 'week');
    await page.fill('[data-rex-halal="1-THURSDAY-lunch"]', 'Halal Beef Sausage');
    for (const k of ['1-SUNDAY-dinner', '1-MONDAY-dinner', '1-TUESDAY-lunch', '1-FRIDAY-breakfast', '1-FRIDAY-lunch']) await pick(page, k, 'keep');
    await page.click('#rex-week-save');
    await page.clock.runFor(1500);
    const sw = await page.evaluate(() => loadMealSwaps()['2026-10-29-lunch']);
    check(w + ' W1 Thu lunch this week only: a swap for Oct 29', sw && sw.specialName === 'Fully Loaded Sausage, Side Soup' && sw._rotationSlot === '1-THURSDAY-lunch' && sw._flagsRaw.hasPork, sw);
    const thu = await meal(page, '1', 'THURSDAY', 'lunch');
    check(w + ' W1 the rotation stays Side Salad', /Side Salad/.test(thu.text), thu.text);
    const today = await page.evaluate(() => getMealForDate(new Date()).lunch);
    check(w + ' W1 today’s lunch is the swap', today && /Side Soup/.test(today.name || today.meal || JSON.stringify(today)), today);
    check(w + ' W1 swap: no page errors', errors.length === 0, errors);
    await browser.close();
  }
  // ── Week 4 (Oct 18–24): the steamed veg applied without asking; Brassicas kept unless ticked ──
  {
    const { browser, page, errors } = await session(width);
    await upload(page, W4);
    const txt = await page.locator('.rex-week-review').innerText();
    check(w + ' W4 summary: 18 match, 1 veg change, 2 to look at', /18\s*meals match DOOR/.test(txt) && /1\s*veg change applied/.test(txt) && /2\s*to look at/.test(txt), txt.match(/\d+\s*meals match[^\n]*/)?.[0]);
    check(w + ' W4 past dates: no this week only', await page.locator('.rex-week-review [data-rex-choice][value="week"]').count() === 0);
    check(w + ' W4 Fri lunch veg listed, with Brassicas offered to take off', /Cauliflower & Carrot → Zucchini & Carrot/.test(txt) && await page.locator('[data-rex-remove="4-FRIDAY-lunch"][value="hasBrassicas"]').count() === 1);
    await page.locator('.rex-week-review').screenshot({ path: new URL('week4_review_' + width + '.png', OUT).pathname });
    for (const k of ['4-SUNDAY-breakfast', '4-TUESDAY-dinner']) await pick(page, k, 'keep');
    await page.click('#rex-week-save');
    await page.clock.runFor(1500);
    const fri = await meal(page, '4', 'FRIDAY', 'lunch');
    check(w + ' W4 Fri lunch now Zucchini & Carrot; Brassicas kept (not ticked)', fri.text === 'Beef lasagna, Zucchini & Carrot' && fri.flags.hasBrassicas === true, fri);
    const tue = await meal(page, '4', 'TUESDAY', 'dinner');
    check(w + ' W4 Tue dinner kept', /Roasted Yam/.test(tue.text), tue.text);
    check(w + ' W4 no page errors', errors.length === 0, errors);
    await browser.close();
  }
}

const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))));
console.log(results.length - bad.length + '/' + results.length);
process.exit(bad.length ? 1 : 0);
