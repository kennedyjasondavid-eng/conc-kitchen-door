// tests/browser/compliance_docs_c1.mjs — compliance C1 in the real page (offline Chromium, 1280 and 390 px, made-up
// residents). The screen lists a documented room again after a new intake; an anaphylactic room is marked and first; the
// Resolve dialog has no status to pick and no revert box, and records a note per restriction; Mark documented does the
// same for a batch; Re-open takes the answers back; no page errors. In CI (door-tests.yml).
import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve(process.env.DOOR_PLAYWRIGHT_PACKAGE || '../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.COMPLIANCE_C1_HTML || 'index.html');
const shots = process.env.COMPLIANCE_SHOTS || '';
const residents = [
  { room: 'SYN-1', tags: ['GF', 'No Pork'], rawRestriction: 'GF, No Pork', section: 'Gluten Free', confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-2', tags: ['Halal', 'No Eggs'], rawRestriction: 'Halal, No Eggs', section: 'Halal', confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-3', tags: ['Soft Meals', 'No Tree Nuts'], rawRestriction: 'Soft Meals, No Tree Nuts', section: 'Soft Meals', isAnaph: true, anaphTags: ['noTreeNuts'], confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-4', tags: ['Diabetic'], rawRestriction: 'Diabetic', section: 'Diabetic', confirm: 'Confirmed', confirmBy: 'Fiona',
    docs: { Diabetic: { how: 'note', by: 'Fiona', at: '2026-11-20', ts: '2026-11-20T15:00:00.000Z' } } },
  { room: 'SYN-5', tags: ['Regular'], rawRestriction: 'Regular', section: 'Regular', confirm: 'N/A', confirmBy: 'Auto' },
];
const results = []; const check = (name, pass, detail) => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail) : '')); };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    await page.addInitScript(([residents]) => {
      localStorage.clear(); localStorage.setItem('concAltFlagSweepV1', 'done');
      localStorage.setItem('concRegistryState', JSON.stringify({ residents, anaphRooms: ['SYN-3'] }));
      localStorage.setItem('concOperatorName', 'Fiona');
      window.Chart = function () { return { destroy() {}, update() {} }; };
    }, [residents]);
    await page.goto(pathToFileURL(source).href);
    await page.waitForFunction(() => typeof renderComplianceView === 'function' && REGISTRY_MAP['syn-1']);
    await page.evaluate(() => { publishAndSync = () => {}; doorTakeNewerKitchenList = async () => 'current'; doorAsk = async () => true; });
    await page.evaluate(() => { showScreen('compliance', document.querySelector('[data-screen=compliance]')); renderComplianceView(); });
    const rows = await page.$$eval('#compliance-body tr', (trs) => trs.map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
    check(width + ' outstanding: SYN-3 first (anaphylactic), then SYN-1 and SYN-2; SYN-4 documented is not listed', rows.length === 3 && rows[0].includes('SYN-3'), rows);
    check(width + ' the anaphylactic room is marked', rows[0].includes('Anaphylactic'), rows[0]);
    const amber = await page.$$eval('#compliance-body tr', (trs) => trs.map((t) => [...t.querySelectorAll('.tag[title="Needs a note"]')].map((x) => x.textContent)));
    check(width + ' only the restrictions needing a note are amber (No Eggs, not Halal)', JSON.stringify(amber.flat().sort()) === JSON.stringify(['GF', 'No Eggs', 'No Pork', 'No Tree Nuts', 'Soft Meals'].sort()), amber);
    if (shots) await page.screenshot({ path: path.join(shots, 'compliance-c1-' + width + '.png'), fullPage: true });

    // Resolve dialog: no status, no revert box; records a note per restriction
    await page.evaluate(() => openResolveModal('SYN-2'));
    const dlg = await page.evaluate(() => ({ status: !!document.getElementById('settle-status-select'), revert: !!document.getElementById('settle-revert-check'),
      what: document.getElementById('settle-what').innerText, open: document.getElementById('settle-compliance-modal').classList.contains('open') }));
    check(width + ' the dialog asks nothing it can get wrong', dlg.open && !dlg.status && !dlg.revert && /No Eggs/.test(dlg.what) && !/Halal/.test(dlg.what), dlg);
    if (shots) await page.screenshot({ path: path.join(shots, 'compliance-c1-dialog-' + width + '.png') });
    await page.fill('#settle-resolution-note', 'H&W letter on file');
    await page.evaluate(() => submitResolve());
    await page.waitForFunction(() => REGISTRY_MAP['syn-2'].confirm === 'Confirmed');
    const r2 = await page.evaluate(() => ({ docs: REGISTRY_MAP['syn-2'].docs, tags: REGISTRY_MAP['syn-2'].tags, section: REGISTRY_MAP['syn-2'].section }));
    check(width + ' SYN-2: No Eggs documented, restrictions and section untouched', r2.docs['No Eggs'] && r2.docs['No Eggs'].line === 'H&W letter on file' && r2.docs['No Eggs'].by === 'Fiona' && r2.tags.join() === 'Halal,No Eggs' && r2.section === 'Halal', r2);

    // Mark documented on a batch
    await page.evaluate(() => { _complianceSelected.add('SYN-1'); updateComplianceBatchBar(); });
    const label = await page.locator('#compliance-batch-confirm').innerText();
    check(width + ' one batch action', label.trim() === 'Mark documented' && !(await page.locator('#compliance-batch-resolve').count()), label);
    await page.evaluate(() => batchConfirmCompliance());
    await page.waitForFunction(() => REGISTRY_MAP['syn-1'].confirm === 'Confirmed');
    const docsShown = await page.$$eval('#compliance-resolved-body tr', (trs) => trs.map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
    check(width + ' Documented lists SYN-1, SYN-2 and SYN-4', docsShown.length === 3 && ['SYN-1', 'SYN-2', 'SYN-4'].every((r) => docsShown.some((x) => x.includes(r))), docsShown);

    // Re-open
    await page.evaluate(() => reopenComplianceItem('SYN-4'));
    await page.waitForFunction(() => REGISTRY_MAP['syn-4'].confirm === 'Provisional');
    check(width + ' Re-open takes the answers back', await page.evaluate(() => Object.keys(REGISTRY_MAP['syn-4'].docs).length === 0));

    // A new intake over a documented room
    await page.evaluate(() => { changesQueue = [{ room: 'SYN-2', type: 'intake', tags: { halal: true, noEggs: true }, route: 'Halal', notes: '' }]; applyQueueToRegistry([]); changesQueue = []; renderComplianceView(); });
    const after = await page.$$eval('#compliance-body tr', (trs) => trs.map((t) => t.innerText));
    check(width + ' a new person in SYN-2 is back on the list', after.some((t) => t.includes('SYN-2')), after);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(width + ' no sideways page scroll', overflow <= 1, overflow);
    check(width + ' no page errors', errors.length === 0, errors);
    await page.close();
  }
} finally { await browser.close(); }
const failed = results.filter((x) => !x).length;
console.log(failed ? failed + ' FAILED of ' + results.length : 'all ' + results.length + ' passed');
process.exit(failed ? 1 : 0);
