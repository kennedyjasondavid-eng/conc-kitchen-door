// tests/browser/w3e_slot_pick.mjs — W3e (2026-11-09): Jason's Wk3 SUN dinner edit, walked in real Chromium.
// Not run by `node --test tests/*.mjs` (it needs a browser). Run from the repo root: node tests/browser/w3e_slot_pick.mjs
// Offline (every request aborted), at 1280 and 390 px, on today's menu with Wk3 SUN dinner put back as it was before
// 2026-11-09 12:32Z (main typed as "Bolognese Pasta", ticks Gluten, Beef, Nightshades, Carb-swap). "Bolognese Sauce"
// (CODEX shared Library, Nightshades only) is added to the recipe list. Exits non-zero if a check fails.
import fs from 'node:fs';
const { chromium } = await import('playwright');
const ROOT = new URL('../../', import.meta.url);
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, ROOT), 'utf8'));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

const menu = J('menu_current.json').menu;
const sun = menu['3'].SUNDAY;
const BEFORE_FLAGS = { ...sun.dinner_flags, hasGluten: true, hasBeef: true, isCarb: true, hasNightshades: true, halalCertifiedMeat: false };
Object.assign(sun, {
  dinner: 'Bolognese Pasta, Peas & Carrots', dinner_veg: 'Vegan Bolognese Pasta, Peas & Carrots', dinner_mainItem: 'Bolognese Pasta',
  dinner_sides: 'Peas & Carrots', dinner_flags: BEFORE_FLAGS, allergens_dinner: 'gluten, beef',
  dinner_slots: { main: { manual: 'Bolognese Pasta', flags: { hasGluten: true, hasBeef: true, hasNightshades: true, isCarb: true } },
    veganalt: { manual: 'Vegan Bolognese Pasta', flags: { hasGluten: true } }, vegside: { manual: 'Peas & Carrots', flags: {} } },
});
const BOLO = { recipeName: 'Bolognese Sauce', category: 'stew_main', stream: 'regular', allergens: ['Nightshades (tomato)'], recipeId: 'bolognese-sauce' };

async function session(width) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https?:/, (r) => r.abort());
  await page.addInitScript(({ menu }) => {
    if (sessionStorage.getItem('_seeded')) return;
    localStorage.clear();
    localStorage.setItem('concUploadedMenu', JSON.stringify(menu));
    localStorage.setItem('concMenuBase', JSON.stringify({}));
    sessionStorage.setItem('_seeded', '1');
  }, { menu });
  await page.goto(new URL('index.html', ROOT).href);
  await page.waitForTimeout(2500);
  await page.evaluate((r) => { DOOR_RECIPE_DATA.push(r); showScreen('menu-config', document.querySelector('[data-screen=menu-config]')); }, BOLO);
  return { browser, page, errors };
}
const open = (page) => page.evaluate(() => openMenuEdit('3', 'SUNDAY', 'dinner'));
const main = (page) => page.evaluate(() => JSON.parse(JSON.stringify(MEAL_SLOT_STATE.main)));
async function typeInto(page, text) {
  const box = page.locator('#slot-search-main');
  await box.click();
  await box.press('ControlOrMeta+a');
  await box.pressSequentially(text);
}
const away = (page) => page.locator('#mc-menu-edit-context').click();
const dialogText = (page) => page.locator('.door-ask').innerText();
// Save, answering the run-on question ("Peas & Carrots" reads like two dishes) with "Save as it is", up to the next one.
async function saveUntilAsk(page) {
  page.evaluate(() => { saveMenuEdit(); });
  for (;;) {
    await page.locator('.door-ask').waitFor();
    const t = await dialogText(page);
    if (!/More than one dish in a slot\?/.test(t)) return t;
    await page.locator('.door-ask .door-ask-go').click();
    await page.locator('.door-ask').waitFor({ state: 'detached' }).catch(() => {});
  }
}

for (const width of [1280, 390]) {
  const { browser, page, errors } = await session(width);
  const w = width + 'px ';
  // 1. type "Bolo", press the list row: the recipe is linked, and stays linked when another box redraws the cards
  await open(page);
  await typeInto(page, 'Bolo');
  await page.locator('#slot-dd-main > div', { hasText: 'Bolognese Sauce' }).first().dispatchEvent('mousedown');
  let s = await main(page);
  check(w + '1 a pick after "Bolo" links Bolognese Sauce', s.recipeName === 'Bolognese Sauce' && !s.manual, JSON.stringify(s));
  check(w + '1 the menu words stay "Bolognese Pasta"', s.displayText === 'Bolognese Pasta', s.displayText);
  await page.locator('#slot-search-veganalt').click();
  await away(page);
  s = await main(page);
  check(w + '1 still linked after another box redraws', s.recipeName === 'Bolognese Sauce' && !s.manual, JSON.stringify(s));
  check(w + '1 the box shows the recipe', (await page.locator('#slot-search-main').inputValue()) === 'Bolognese Sauce');

  // 2. a new name typed in the top box of the linked slot: the list says where it goes first; a blur keeps the link
  await typeInto(page, 'Beef Bolognese');
  const hint = page.locator('#slot-dd-main .slot-rename-hint');
  check(w + '2 the list leads with "Renaming the dish?"', (await hint.count()) === 1 && /Shown on menu as/.test(await hint.innerText()));
  await away(page);
  s = await main(page);
  check(w + '2 a blur does not unlink the recipe', s.recipeName === 'Bolognese Sauce' && !s.manual, JSON.stringify(s));
  const note = page.locator('.slot-held-note');
  check(w + '2 the card says the words were not saved and points to "Shown on menu as"',
    (await note.count()) === 1 && /“Beef Bolognese” is not saved[\s\S]*Shown on menu as/.test(await note.innerText()), await note.innerText().catch(() => ''));
  check(w + '2 the box keeps the words', (await page.locator('#slot-search-main').inputValue()) === 'Beef Bolognese');
  await note.locator('button').click();
  s = await main(page);
  check(w + '2 "Show on the menu" sets the shown name, the recipe stays', s.displayText === 'Beef Bolognese' && s.recipeId === 'bolognese-sauce', JSON.stringify(s));
  check(w + '2 "Shown on menu as" reads it', (await page.locator('#slot-showas-main').inputValue()) === 'Beef Bolognese');
  check(w + '2 the note is gone', (await page.locator('.slot-held-note').count()) === 0);

  // 3. Save: the warnings question names each tick Save would take off and keeps them by default; Go back saves nothing
  const savedBefore = await page.evaluate(() => JSON.stringify(getMenuData()['3'].SUNDAY.dinner_flags));
  let t = await saveUntilAsk(page);
  check(w + '3 Save asks "Keep the meal’s warnings?"', /Keep the meal’s warnings\?/.test(t), t.replace(/\s+/g, ' ').slice(0, 300));
  check(w + '3 it names Gluten (Beef stays: the shown name says beef)', /\nGluten\n/.test(t) && !/\nBeef\n/.test(t), t.replace(/\s+/g, ' ').slice(0, 300));
  check(w + '3 Keep them is the main button', (await page.locator('.door-ask .door-ask-go').innerText()) === 'Keep them');
  await page.locator('.door-ask .door-ask-cancel').click();
  check(w + '3 Go back saves nothing', savedBefore === await page.evaluate(() => JSON.stringify(getMenuData()['3'].SUNDAY.dinner_flags)));
  // Keep them: the meal keeps Gluten, Beef, Carb-swap (then the halal question, about the beef)
  await saveUntilAsk(page);
  await page.locator('.door-ask .door-ask-go').click();
  await page.locator('#_halal-yes').waitFor({ timeout: 5000 });
  check(w + '3 the halal question follows, about Beef Bolognese', /Beef Bolognese/.test(await page.locator('.halal-about').innerText()));
  await page.locator('#_halal-yes').click();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => getMenuData()['3'].SUNDAY);
  check(w + '3 saved linked, shown as Beef Bolognese', after.dinner_slots.main.recipeName === 'Bolognese Sauce' && after.dinner_slots.main.displayText === 'Beef Bolognese' && /^Beef Bolognese/.test(after.dinner), after.dinner);
  check(w + '3 saved with Gluten, Beef, Carb-swap still ticked', after.dinner_flags.hasGluten && after.dinner_flags.hasBeef && after.dinner_flags.isCarb, JSON.stringify(after.dinner_flags));

  // 4. half-typed words with no pick: the last saved value stays, the card says so, Save asks, Go back saves nothing
  await page.evaluate(() => { closeMenuEdit && closeMenuEdit(); });
  await open(page);
  await typeInto(page, 'Bolognese S');   // the start of the linked recipe
  await away(page);
  s = await main(page);
  check(w + '4 "Bolognese S" is not saved', s.recipeName === 'Bolognese Sauce' && !s.manual, JSON.stringify(s));
  check(w + '4 the card says it is the start of the recipe', /“Bolognese S” is not saved: it is the start of “Bolognese Sauce”/.test(await page.locator('.slot-held-note').innerText()));
  t = await saveUntilAsk(page);
  check(w + '4 Save asks "Finish the dish name?"', /Finish the dish name\?[\s\S]*The Main box says “Bolognese S”/.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
  await page.locator('.door-ask .door-ask-cancel').click();
  check(w + '4 no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

const bad = results.filter((r) => !r.ok);
results.forEach((r) => console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '  — ' + r.detail)));
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
