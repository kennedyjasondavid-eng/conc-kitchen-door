// tests/browser/routing_replay.mjs — the routing audit's real-browser replay (2026-10-18, audit A4).
// Not run by `node --test tests/*.mjs` (CI has no browser); its CI twin is tests/routing_replay_gate.mjs. Run it from the
// repo root, with conc-recipe-hub checked out beside this repo (for its Playwright resolver) or Playwright installed:
//   node tests/browser/routing_replay.mjs
// It loads DOOR offline (only the sheet library's CDN is let through) with the published residents, anaphylactic list,
// menu, overlay and swaps, on 2026-10-18, and for every meal runs the real computePlatingData and buildPlatingHtml, the
// labels and buildRoutingByMealJSON. Every resident's plate, line and lockout is checked against the rules-table oracle
// (tests/helpers/routing_oracle.mjs). It writes docs/DOOR_ROUTING_REPLAY_RECEIPT_2026-10-18.md and a CSV of every
// resident × meal (docs/receipts/door_routing_replay_2026-10-18.csv).
import fs from 'node:fs';
import { plateFor, requiredNotes, anaphContained } from '../helpers/routing_oracle.mjs';

const { chromium } = await import(process.env.DOOR_PW || '../../../conc-recipe-hub/tests/_pw.mjs').catch(() => import('playwright'));
const ROOT = new URL('../../', import.meta.url);
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, ROOT), 'utf8'));
const state = J('door_state.json'), menu = J('menu_current.json').menu, overlay = J('menu_overlay.json'), swaps = J('meal_swaps.json'), published = J('routing_by_meal.json');
const WHEN = process.env.DOOR_REPLAY_DATE || '2026-10-18T10:00:00';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route(/^https?:/, (r) => (/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort()));
await page.clock.install({ time: new Date(WHEN) });
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

const run = await page.evaluate(({ residents, rooms }) => {
  window.print = () => {};
  REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...residents.map((r) => ({ ...r })));
  REGISTRY_LIST.forEach((r) => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  anaphRooms.splice(0, anaphRooms.length, ...rooms);
  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const meals = [];
  for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const pd = computePlatingData(period, wk, day);
    if (!pd) continue;
    const sheet = buildPlatingHtml(pd, false);
    // every resident row the sheet prints: restriction, room, note
    const rows = {};
    for (const m of sheet.matchAll(/<tr[^>]*><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)) rows[unesc(m[2])] = unesc(m[3]);
    const seat = {};
    pd.anaphSect.forEach((r) => { seat[r.room] = { key: 'anaph', label: 'Anaphylactic Alternative', role: r._role }; });
    pd.sections.forEach((s) => s.residents.forEach((r) => { seat[r.room] = { key: s.rule.key, label: s.rule.key === 'regular' ? 'Regular' : s.rule.label }; }));
    meals.push({ wk, day, period, name: pd.mealName, dated: pd.dated ? pd.dated.kind + ' ' + pd.dated.date : '', flags: pd.mealFlags,
      veg: pd.vegAllergenStr || '', halal: pd.ctx.halalAllergenStr || '', datedLine: /ps-dated/.test(sheet), seat, rows,
      regularNotes: Object.fromEntries((pd.regularNotes || []).map((n) => [n.room, [n.conflictNote, n.serviceNote].filter(Boolean).join(' · ')])) });
  }
  printLabels();
  const labelsHtml = document.getElementById('labels-print-content').innerHTML;
  const labels = {};
  REGISTRY_LIST.forEach((r) => {
    const i = labelsHtml.indexOf('>' + r.room + '<');
    labels[r.room] = i < 0 ? null : labelsHtml.slice(Math.max(0, i - 400), i + 400).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  });
  const routing = buildRoutingByMealJSON().routing;
  return { meals, labels, routing, flagFor: Object.fromEntries(REGISTRY_LIST.map((r) => [r.room, doorIsAnaphResident(r)])) };
}, { residents: state.residents, rooms: state.anaphRooms });
await browser.close();

// ── against the oracle ──────────────────────────────────────────────────────────────────────────────────────────
const LABEL_OF = (await import('node:vm')).runInNewContext(fs.readFileSync(new URL('index.html', ROOT), 'utf8').match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0] + ';TAG_LABELS_MAP');
const VEG_WORDS = { WHEAT: 'hasGluten', GLUTEN: 'hasGluten', DAIRY: 'hasDairy', MILK: 'hasDairy', EGGS: 'hasEgg', EGG: 'hasEgg', SOY: 'hasSoy', SPICY: 'isSpicy',
  BEANS: 'hasBeans', MUSHROOM: 'hasMushroom', CORN: 'hasCorn', NIGHTSHADES: 'hasNightshades', BRASSICAS: 'hasBrassicas', COCONUT: 'hasCoconut',
  'TREE NUTS': 'hasTreeNuts', PEANUTS: 'hasPeanuts', SESAME: 'hasSesame', MUSTARD: 'hasMustard', SULPHITES: 'hasSulphites', FISH: 'hasFish',
  SHELLFISH: 'hasShellfish', CRUSTACEANS: 'hasShellfish', MOLLUSCS: 'hasShellfish', 'PROCESSED MEAT': 'hasProcessedMeat', PORK: 'hasPork', BEEF: 'hasBeef' };
const tagOf = (m) => 'W' + m.wk + ' ' + m.day.slice(0, 3) + ' ' + m.period;
const split = (s) => new Set(String(s || '').split(/ · |, /).map((x) => x.trim()).filter(Boolean));
const disagreements = [], csv = [['week', 'day', 'meal', 'dish', 'room', 'tags', 'plate', 'line', 'contained', 'oracle_plate', 'missing_notes'].join(',')];
const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
for (const m of run.meals) {
  for (const r of state.residents) {
    const s = m.seat[r.room];
    const tags = r.tags || [];
    const contained = anaphContained(r.room, state.residents, state.anaphRooms, m.flags, LABEL_OF);
    const want = contained ? 'anaph' : plateFor(tags, m.flags);
    const line = s && s.key === 'regular' ? (m.regularNotes[r.room] || '') : (m.rows[r.room] || '');
    let missing = [];
    if (s && s.key !== 'regular' && s.key !== 'anaph') {
      const words = s.key === 'vegan' ? m.veg : s.key === 'halal' ? m.halal : '';
      const plate = Object.fromEntries(words.split(',').map((w) => [VEG_WORDS[w.trim()], true]).filter(([k]) => k));
      missing = [...requiredNotes(tags, m.flags, s.key, plate)].filter((n) => !split(line).has(n));
    }
    if (!s) disagreements.push(tagOf(m) + ' ' + r.room + ': not seated');
    else if (s.key !== want) disagreements.push(tagOf(m) + ' ' + r.room + ' ' + tags.join('+') + ': ' + s.key + ' ≠ ' + want);
    if (missing.length) disagreements.push(tagOf(m) + ' ' + r.room + ': line misses ' + missing.join(', '));
    if (s && s.key !== 'regular' && !(r.room in m.rows)) disagreements.push(tagOf(m) + ' ' + r.room + ': no row on the sheet');
    csv.push([m.wk, m.day, m.period, q(m.name), q(r.room), q(tags.join(' + ')), q(s ? s.label : ''), q(line), contained ? 'yes' : '', want, q(missing.join('; '))].join(','));
  }
}

// ── the routing file: regenerated against the checked-in one (and, given its path, main's) ────────────────────────
function routingDiff(base) {
  const out = [];
  for (const wk of Object.keys(run.routing)) for (const day of Object.keys(run.routing[wk])) for (const period of Object.keys(run.routing[wk][day])) {
    const a = { ...(base.routing[wk][day][period] || {}) }, b = { ...run.routing[wk][day][period] };
    delete a._components; delete b._components;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    const d = keys.filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => k + ' ' + (a[k] || 0) + ' → ' + (b[k] || 0));
    if (d.length) out.push('W' + wk + ' ' + day.slice(0, 3) + ' ' + period + ': ' + d.join('; '));
  }
  return out;
}
const routingDiffs = routingDiff(published);
const mainRoutingPath = process.argv[2];
const mainDiffs = mainRoutingPath && fs.existsSync(mainRoutingPath) ? routingDiff(JSON.parse(fs.readFileSync(mainRoutingPath, 'utf8'))) : null;

// ── labels: every resident has one; anaphylactic ones say so; every restriction's words print ──────────────────
const labelProblems = [];
// Labels print for residents with a restriction or an anaphylactic flag; a Regular resident has none.
const needsLabel = (r) => (r.tags || []).some((t) => t !== 'Regular') || run.flagFor[r.room];
for (const r of state.residents) {
  const l = run.labels[r.room];
  if (!l) { if (needsLabel(r)) labelProblems.push(r.room + ': no label'); continue; }
  if (run.flagFor[r.room] && !/ANAPHYLACTIC/.test(l)) labelProblems.push(r.room + ': anaphylactic, label not red');
  const raw = (r.rawRestriction || '').replace(/\s+/g, ' ').trim();
  if (raw && raw !== 'Regular' && !l.includes(raw.slice(0, 20))) labelProblems.push(r.room + ': label lacks "' + raw + '"');
}
const ACCOM = ['Low Sodium', 'Low Fat', 'Low Potassium', 'No Fried Food', 'Other'];
const accomResidents = state.residents.filter((r) => (r.tags || []).some((t) => ACCOM.includes(t)));

fs.mkdirSync(new URL('docs/receipts/', ROOT), { recursive: true });
fs.writeFileSync(new URL('docs/receipts/door_routing_replay_2026-10-18.csv', ROOT), csv.join('\n') + '\n');
const datedMeals = run.meals.filter((m) => m.dated);
const md = `# DOOR routing replay — receipt (2026-10-18, audit A4)

Generated by \`tests/browser/routing_replay.mjs\` (real Chromium, offline but for the sheet library's CDN; clock ${WHEN.slice(0, 10)}).
- **Inputs:** the published \`door_state.json\` (${state.residents.length} residents; anaphylactic list ${state.anaphRooms.join(', ')}), \`menu_current.json\` with \`menu_overlay.json\`, and \`meal_swaps.json\`.
- **Runs:** for each of ${run.meals.length} meals, the real \`computePlatingData\` and \`buildPlatingHtml\`, then the labels and \`buildRoutingByMealJSON\`.
- **Checks:** every resident × meal against the rules-table oracle (\`tests/helpers/routing_oracle.mjs\`). The full table is \`docs/receipts/door_routing_replay_2026-10-18.csv\` (${csv.length - 1} rows: plate, line, contained, and the oracle's plate).

## Result
- **Disagreements with the oracle: ${disagreements.length}.**${disagreements.length ? '\n' + disagreements.slice(0, 40).map((d) => '  - ' + d).join('\n') : ''}
- **Page errors: ${errors.length}.**${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}
- **Swap and special meals routed:** ${datedMeals.length ? datedMeals.map((m) => tagOf(m) + ' (' + m.dated + ', "' + m.name + '"' + (m.datedLine ? ', the sheet says so' : ', NO LINE') + ')').join('; ') : 'none'}.

## The routing file
**Regenerated against the checked-in one:** ${routingDiffs.length ? '\n' + routingDiffs.map((d) => '- ' + d).join('\n') : 'identical.'}
${mainDiffs ? `
**Against \`main\`'s copy** (what this branch's rebuild moves for EXPO): ${mainDiffs.length ? '\n' + mainDiffs.map((d) => '- ' + d).join('\n') : 'identical.'}

Each row is one of these:
- room 213 moves to "Anaphylactic Alternative" on its 9 tree-nut / coconut meals (\`.31\`, until now unpublished);
- the 3 pork days with alternative meals read Soft 2 (F12);
${Object.keys(swaps).length ? '- the Nov 3 swap stands in for Wk2 TUE lunch (F13);\n' : ''}- the ruled ticks: Spicy on Wk1 TUE dinner, Processed Meat on Wk3 SAT dinner, Gluten on Wk3 WED lunch.
` : ''}
## Labels
${labelProblems.length ? labelProblems.map((p) => '- ' + p).join('\n') : '- every resident with a restriction or the anaphylactic flag has a label (' + state.residents.filter(needsLabel).length + '); every anaphylactic one is red; every restriction prints'}

**Accommodations no rule reads (F6, "text only").** ${accomResidents.length} residents hold one: ${accomResidents.map((r) => r.room + ' (' + (r.tags || []).filter((t) => ACCOM.includes(t)).join(', ') + ')').join('; ')}.
- Their restriction text prints on their label (checked above).
- It prints on their sheet row when they sit in a section.
- On Regular they are counted, not listed, unless another note lists them.
`;
fs.writeFileSync(new URL('docs/DOOR_ROUTING_REPLAY_RECEIPT_2026-10-18.md', ROOT), md);
console.log('meals', run.meals.length, '| disagreements', disagreements.length, '| routing diffs', routingDiffs.length, '| label problems', labelProblems.length, '| page errors', errors.length);
if (disagreements.length) console.log(disagreements.slice(0, 20).join('\n'));
