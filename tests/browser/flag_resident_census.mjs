// tests/browser/flag_resident_census.mjs — where meal flags come from, and what the resident data says (2026-10-18, audit A5 + A6).
// Not run by `node --test tests/*.mjs`. Run from the repo root with conc-recipe-hub beside it:
//   node tests/browser/flag_resident_census.mjs [path to CODEX's library_shared.json from its shared-library branch]
// Real Chromium, offline, with the published DOOR data and CODEX's feed (../conc-recipe-hub/DOOR_RECIPE_DATA.json) with the
// shared Library laid over it by DOOR's own doorOverlaySharedRecipes. It writes docs/DOOR_FLAG_RESIDENT_CENSUS_2026-10-18.md.
// It changes no data: every finding is a list for Jason.
import fs from 'node:fs';
const { chromium } = await import(process.env.DOOR_PW || '../../../conc-recipe-hub/tests/_pw.mjs').catch(() => import('playwright'));
const ROOT = new URL('../../', import.meta.url);
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, ROOT), 'utf8'));
const state = J('door_state.json'), menu = J('menu_current.json').menu, overlay = J('menu_overlay.json'), swaps = J('meal_swaps.json');
const feed = JSON.parse(fs.readFileSync(new URL('../conc-recipe-hub/DOOR_RECIPE_DATA.json', ROOT), 'utf8'));
const sharedPath = process.argv[2];
const shared = sharedPath && fs.existsSync(sharedPath) ? JSON.parse(fs.readFileSync(sharedPath, 'utf8')) : null;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route(/^https?:/, (r) => r.abort());
await page.clock.install({ time: new Date('2026-10-18T10:00:00') });
await page.addInitScript(({ menu, overlay, swaps }) => {
  if (sessionStorage.getItem('_seeded')) return;
  localStorage.clear();
  localStorage.setItem('concUploadedMenu', JSON.stringify(menu));
  localStorage.setItem('concMenuBase', JSON.stringify(overlay));
  localStorage.setItem('concMealSwaps', JSON.stringify(swaps));
  localStorage.setItem('concAltFlagSweepV1', '1');
  sessionStorage.setItem('_seeded', '1');
}, { menu, overlay, swaps });
await page.goto(new URL('index.html', ROOT).href);
await page.clock.runFor(4000);

const out = await page.evaluate(({ residents, rooms, feed, shared, swaps }) => {
  const list = Array.isArray(feed) ? feed : (feed.recipes || feed);
  // DOOR's own list, as it builds it live: the CODEX feed with the shared Library laid over it (a lexical let in the page)
  DOOR_RECIPE_DATA = shared ? doorOverlaySharedRecipes(list, shared).list : list;
  REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...residents.map((r) => ({ ...r })));
  anaphRooms.splice(0, anaphRooms.length, ...rooms);
  const data = getMenuData();
  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const FL = (f) => Object.keys(f || {}).filter((k) => f[k] === true && /^(has|is)/.test(k));
  const find = (slot) => (slot.recipeId && DOOR_RECIPE_DATA.find((x) => x && String(x.recipeId) === String(slot.recipeId)))
    || DOOR_RECIPE_DATA.find((x) => x && x.recipeName === slot.recipeName);
  const res = { behindTicks: [], halalPlate: [], nameWords: [], unmapped: [], swaps: [], sweep: null, mealCount: 0 };
  for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const d = data[wk] && data[wk][day];
    if (!d || !d[period]) continue;
    res.mealCount++;
    const flags = d[period + '_flags'] || {};
    const where = 'W' + wk + ' ' + day.slice(0, 3) + ' ' + period;
    const slots = d[period + '_slots'] || {};
    // (1) a recipe linked on the main plate or a shared side names a flag the meal doesn't tick
    ['main', 'starch', 'vegside', 'xtra'].forEach((id) => {
      const s = slots[id];
      if (!s || !s.recipeName) return;
      const r = find(s);
      if (!r) { res.behindTicks.push({ where, slot: id, recipe: s.recipeName, missing: ['(recipe not in the list)'] }); return; }
      const want = FL(hubAllergenToFlags(r.allergens || []));
      const missing = want.filter((k) => !flags[k]);
      if (missing.length) res.behindTicks.push({ where, slot: id, recipe: r.recipeName, missing });
    });
    // the halal plate's own dish, when linked: what it carries that the main doesn't
    if (slots.mainalt && slots.mainalt.recipeName) {
      const r = find(slots.mainalt);
      const extra = r ? FL(hubAllergenToFlags(r.allergens || [])).filter((k) => !flags[k]) : ['(recipe not in the list)'];
      if (extra.length) res.halalPlate.push({ where, recipe: slots.mainalt.recipeName, extra });
    }
    // (2) the dish's own words name a flag the meal doesn't tick
    const named = FL(nameDetectFlags(d[period], emptyMealFlags()));
    const notTicked = named.filter((k) => !flags[k]);
    if (notTicked.length) res.nameWords.push({ where, dish: d[period], notTicked });
  }
  // (4) swaps and special meals: the flags they carry against their own words
  Object.entries(swaps).forEach(([key, e]) => {
    const f = doorDatedMealFlags(e);
    const named = FL(nameDetectFlags(e.specialName + ', ' + (e.veg || ''), emptyMealFlags()));
    res.swaps.push({ key, name: e.specialName, veg: e.veg, flags: FL(f), namedNotTicked: named.filter((k) => !f[k]) });
  });
  // (5) the one-time sweep a fresh tablet runs on the published overlay, as a dry run
  try { const rep = sweepAltFlagPollution({ dryRun: true }); res.sweep = { cleaned: rep.mealsCleaned, dropped: rep.flagsDropped, details: rep.details }; } catch (e) { res.sweep = { error: String(e) }; }
  // (6) every CODEX label DOOR now reads: the ones that reach no flag
  _hubUnmappedLabels.clear();
  DOOR_RECIPE_DATA.forEach((r) => _hubAllergenResolve(r.allergens || []));
  res.unmapped = [..._hubUnmappedLabels].sort();
  res.recipeCount = DOOR_RECIPE_DATA.length;
  // A6 — the resident data
  const drift = { reparse: [], anaph: [], tier: [], dupes: [] };
  const seen = {};
  REGISTRY_LIST.forEach((r) => {
    seen[r.room.toLowerCase()] = (seen[r.room.toLowerCase()] || 0) + 1;
    if (r.rawRestriction && r.rawRestriction !== 'Regular') {
      const p = normalizeRestriction(r.rawRestriction);
      const parsed = Object.keys(p.tags).filter((k) => p.tags[k]).map((k) => TAG_LABELS_MAP[k]).filter(Boolean).sort();
      const stored = (r.tags || []).filter((t) => t !== 'Regular').sort();
      const missing = parsed.filter((t) => !stored.includes(t)), extra = stored.filter((t) => !parsed.includes(t));
      if (missing.length || extra.length || p.unmatched.length) drift.reparse.push({ room: r.room, raw: r.rawRestriction, missing, extra, unmatched: p.unmatched });
    }
    const onList = anaphRooms.includes(r.room), flag = !!r.isAnaph, picked = (r.anaphTags || []).map((k) => TAG_LABELS_MAP[k]).filter(Boolean);
    const anaphLabels = picked.length ? picked : (r.tags || []);
    const containable = anaphLabels.filter((t) => anaphTagMealFlags(t).length);
    if (onList !== flag || ((onList || flag) && !containable.length) || picked.some((t) => !(r.tags || []).includes(t)) || (!onList && !flag && picked.length)) {
      drift.anaph.push({ room: r.room, onList, flag, picked, tags: r.tags, containable });
    }
    const needs = requiresDocumentation(r.tags || []);
    const want = needs ? 'Provisional or confirmed by someone' : ((r.tags || []).some((t) => t !== 'Regular') ? 'Confirmed' : 'N/A');
    if (needs && r.confirm === 'Confirmed' && /^auto$/i.test(r.confirmBy || '')) drift.tier.push({ room: r.room, tags: r.tags, confirm: r.confirm, confirmBy: r.confirmBy, why: 'doc-tier tag, confirmed automatically' });
    if (!needs && r.confirm === 'Provisional') drift.tier.push({ room: r.room, tags: r.tags, confirm: r.confirm, confirmBy: r.confirmBy, why: 'no doc-tier tag, still provisional' });
  });
  anaphRooms.forEach((room) => { if (!REGISTRY_LIST.some((r) => r.room === room)) drift.anaph.push({ room, onList: true, flag: false, picked: [], tags: null, containable: [], why: 'on the list, nobody lives there' }); });
  drift.dupes = Object.keys(seen).filter((k) => seen[k] > 1);
  res.drift = drift;
  return res;
}, { residents: state.residents, rooms: state.anaphRooms, feed, shared, swaps });
await browser.close();

const lines = (arr, f) => (arr.length ? arr.map((x) => '- ' + f(x)).join('\n') : '- none');
const md = `# DOOR flag sources and resident data — census (2026-10-18, audit A5 + A6)

Generated by \`tests/browser/flag_resident_census.mjs\` (real Chromium, offline).
- **Inputs:** the published DOOR data (${out.mealCount} meals, ${state.residents.length} residents) and CODEX's feed (${out.recipeCount} recipes${shared ? ', with the shared Library laid over it' : ''}).
- **Writes nothing.** Every row is a finding for Jason; the audit changes no menu or resident data.
- **Page errors:** ${errors.length}.

## A5 — where meal flags come from

**1. A recipe linked on the main plate or a shared side names a flag the meal doesn't tick** (${out.behindTicks.length}):
${lines(out.behindTicks, (x) => x.where + ' · ' + x.slot + ' → ' + x.recipe + ': ' + x.missing.join(', '))}

**The halal plate's linked dish carries a flag the main doesn't** (${out.halalPlate.length}). Its section's CONTAINS line and rows read it now (see Ruled):
${lines(out.halalPlate, (x) => x.where + ' · ' + x.recipe + ': ' + x.extra.join(', '))}

**2. The dish's own words name a flag the meal doesn't tick** (${out.nameWords.length}; the workbook reader's words, \`nameDetectFlags\`):
${lines(out.nameWords, (x) => x.where + ' · "' + x.dish + '": ' + x.notTicked.join(', '))}

**4. Swaps and special meals** (${out.swaps.length}):
${lines(out.swaps, (x) => x.key + ' · "' + x.name + '" (vegan: "' + (x.veg || '') + '"): carries ' + (x.flags.join(', ') || 'nothing') + (x.namedNotTicked.length ? '; its words also name ' + x.namedNotTicked.join(', ') : ''))}

**5. A fresh tablet's one-time sweep** (\`sweepAltFlagPollution\`, dry run on the published overlay):
${out.sweep && out.sweep.error ? '- error: ' + out.sweep.error : '- ' + out.sweep.cleaned + ' meals cleaned, ' + out.sweep.dropped + ' flags dropped' + (out.sweep.details && out.sweep.details.length ? '\n' + out.sweep.details.slice(0, 20).map((d) => '  - ' + JSON.stringify(d)).join('\n') : '')}

**6. CODEX labels that reach no DOOR flag** (${out.unmapped.length}): ${out.unmapped.join(', ') || 'none'}.

## A6 — the resident data

**Raw restriction re-parsed against the stored tags** (${out.drift.reparse.length}):
${lines(out.drift.reparse, (x) => x.room + ' "' + x.raw + '": ' + JSON.stringify({ missing: x.missing, extra: x.extra, unmatched: x.unmatched }))}

**Anaphylactic: flag, list and picked tags** (${out.drift.anaph.length}). Each row is a resident whose flag and list disagree, who holds no tag DOOR can contain, or whose picked tags aren't theirs:
${lines(out.drift.anaph, (x) => x.room + ': ' + (x.why || JSON.stringify({ onList: x.onList, flag: x.flag, picked: x.picked, tags: x.tags, containable: x.containable })))}

**Compliance tier against the confirm state** (${out.drift.tier.length}):
${lines(out.drift.tier, (x) => x.room + ' ' + JSON.stringify(x.tags) + ': ' + x.confirm + ' by ' + (x.confirmBy || '—') + ' — ' + x.why)}

**Rooms listed twice** (${out.drift.dupes.length}): ${out.drift.dupes.join(', ') || 'none'}.

## Ruled (Jason, 2026-10-18), on the first run of this census
- **Ticked** (through Edit Menu's own overlay write; the main dish carries each; \`menu_recipe_ticks_gate\`):
  - Spicy on Wk1 TUE dinner (Pork Carnitas);
  - Processed Meat on Wk3 SAT dinner (Pepperoni Pizza);
  - Gluten on Wk3 WED lunch ("Flour" tortillas);
  - Beans on the Nov 3 swap's Chickpea Salad.
- **Not ticked:** Spicy on Wk3 WED lunch, though the linked Beef Nacho Mix lists it. It stays in row 1 above.
- **Butter Chicken's "butter"** (row 2): CODEX's recipe lists no Milk (coconut), and CODEX owns allergens. Left; DOOR's dish-name reader over-reads it.
- **The halal plate's own dish** (row 1b) now reaches its sheet line: the halal section's CONTAINS line, and its rows' notes, read the linked dish over the main meal (\`computePlatingData\`'s halalAllergenStr). 304 (Halal + No Eggs) gets "no egg" on Wk2 SAT lunch.
- **A6 Regular residents left Provisional:** "Tidy to N/A". The load-time tidy (\`autoPromoteAutoTier\`) does it on every device; 813 (anaphylactic) stays Provisional.
- **Still open:**
  - 813 is on the anaphylactic list with no allergen recorded.
  - 213's flag is off while its room is on the list. Every reader goes through \`doorIsAnaphResident\`, so this is harmless; the next edit sets the flag.
`;
fs.writeFileSync(new URL('docs/DOOR_FLAG_RESIDENT_CENSUS_2026-10-18.md', ROOT), md);
console.log(md);
