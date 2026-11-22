// tests/browser/compliance_worklist.mjs — Compliance Review C1 + C2/C3 in the real page (offline Chromium, 1280 and 390 px,
// made-up residents). Replaced tests/browser/compliance_docs_c1.mjs (2026-11-22), whose table the worklist replaced; every
// check it made is kept below, on the worklist.
//   C1: anaphylactic first and marked; only the restrictions needing a note are amber; the dialog has no status to pick and
//       no revert box and leaves restrictions alone; one batch action; Re-open; a new person in a documented room is back.
//   C2: groups in order (anaphylactic, allergies, medical diets, usually a preference); one main action per row; the
//       progress line; the selection bar rises only with a selection; no sideways scroll; quiet "Saved" for a note.
//   C3: the one question: Confirmed / It's a preference / Not needed any more / Still waiting; no preference for an
//       anaphylactic room; Still waiting sets a reminder; Undo takes the answer back; no browser prompt anywhere.
import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve(process.env.DOOR_PLAYWRIGHT_PACKAGE || '../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.COMPLIANCE_HTML || 'index.html');
const shots = process.env.COMPLIANCE_SHOTS || '';
const residents = [
  { room: 'SYN-1', tags: ['GF', 'No Pork'], rawRestriction: 'GF, No Pork', section: 'Gluten Free', confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-2', tags: ['Halal', 'No Eggs'], rawRestriction: 'Halal, No Eggs', section: 'Halal', confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-3', tags: ['Soft Meals', 'No Tree Nuts'], rawRestriction: 'Soft Meals, No Tree Nuts', section: 'Soft Meals', isAnaph: true, anaphTags: ['noTreeNuts'], confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-4', tags: ['Diabetic'], rawRestriction: 'Diabetic', section: 'Diabetic', confirm: 'Confirmed', confirmBy: 'Fiona',
    docs: { Diabetic: { how: 'note', by: 'Fiona', at: '2026-11-20', ts: '2026-11-20T15:00:00.000Z' } } },
  { room: 'SYN-5', tags: ['Regular'], rawRestriction: 'Regular', section: 'Regular', confirm: 'N/A', confirmBy: 'Auto' },
  { room: 'SYN-6', tags: ['No Pork', 'Halal'], rawRestriction: 'No Pork, Halal', section: 'Halal', confirm: 'Provisional', confirmBy: '—' },
  { room: 'SYN-7', tags: ['Low Sodium'], rawRestriction: 'Low Sodium', section: 'Regular', confirm: 'Provisional', confirmBy: '—' },
];
const results = []; const check = (name, pass, detail) => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail) : '')); };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors = []; let dialogs = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => { dialogs++; d.dismiss(); });
    await page.route(/^https?:/, (r) => r.abort());
    await page.addInitScript(([residents]) => {
      localStorage.clear(); localStorage.setItem('concAltFlagSweepV1', 'done');
      localStorage.setItem('concRegistryState', JSON.stringify({ residents, anaphRooms: ['SYN-3'] }));
      localStorage.setItem('concOperatorName', 'Fiona');
      window.Chart = function () { return { destroy() {}, update() {} }; };
    }, [residents]);
    await page.goto(pathToFileURL(source).href);
    await page.waitForFunction(() => typeof renderComplianceView === 'function' && REGISTRY_MAP['syn-1']);
    await page.evaluate(() => { window.__sent = 0; publishAndSync = () => { window.__sent++; }; doorTakeNewerKitchenList = async () => 'current'; doorAsk = async () => true; });
    await page.evaluate(() => { showScreen('compliance', document.querySelector('[data-screen=compliance]')); renderComplianceView(); });
    const view = () => page.evaluate(() => [...document.querySelectorAll('#cx-groups .cx-group')].map(g => ({
      title: g.querySelector('h3').textContent,
      rows: [...g.querySelectorAll('.cx-item')].map(i => ({ room: i.querySelector('.cx-room').textContent, need: [...i.querySelectorAll('.cx-chip-need')].map(x => x.textContent), anaph: !!i.querySelector('.cx-chip-anaph'), go: i.querySelector('.cx-go').textContent.trim() })),
    })));
    let v = await view();
    check(width + ' C2 groups in order: anaphylactic, allergies, medical diets, usually a preference', JSON.stringify(v.map(g => g.title)) === JSON.stringify(['Anaphylactic · ask first', 'Allergies', 'Medical diets', 'Usually a preference']), v.map(g => g.title));
    check(width + ' C1 the anaphylactic room first and marked', v[0].rows.length === 1 && v[0].rows[0].room === 'SYN-3' && v[0].rows[0].anaph, v[0]);
    const flat = v.flatMap(g => g.rows);
    check(width + ' C1 only the restrictions needing a note are amber (No Eggs, not Halal)', JSON.stringify(flat.flatMap(r => r.need).sort()) === JSON.stringify(['GF', 'Low Sodium', 'No Eggs', 'No Pork', 'No Pork', 'No Tree Nuts', 'Soft Meals'].sort()), flat);
    check(width + ' C1 documented SYN-4 is not listed', !flat.some(r => r.room === 'SYN-4'));
    check(width + ' C2 one main action per row ("Got the note…", "Answer…" for a preference)', flat.every(r => r.go === (r.room === 'SYN-6' ? 'Answer…' : 'Got the note…')), flat.map(r => r.go));
    const prog = await page.locator('#cx-progress').innerText();
    check(width + ' C2 progress: 1 of 6 documented', /1 of 6 documented/.test(prog) && /5 to go/.test(prog), prog);
    check(width + ' C2 no table, filter, sort or banner left', await page.evaluate(() => !document.getElementById('compliance-body') && !document.getElementById('compliance-filter') && !document.getElementById('compliance-pending-banner')));
    check(width + ' C2 the selection bar is hidden with nothing selected', await page.locator('#cx-selbar').isHidden());
    if (shots) await page.screenshot({ path: path.join(shots, 'worklist-' + width + '.png'), fullPage: true });

    // C3 the one question
    await page.evaluate(() => openResolveModal('SYN-3'));
    check(width + ' C3 no preference offered for an anaphylactic room', await page.locator('#settle-opt-preference').isHidden());
    await page.evaluate(() => closeResolveModal());
    await page.evaluate(() => openResolveModal('SYN-2'));
    const dlg = await page.evaluate(() => ({ status: !!document.getElementById('settle-status-select'), revert: !!document.getElementById('settle-revert-check'),
      q: document.getElementById('settle-question').textContent, opts: [...document.querySelectorAll('input[name=settle-how]')].map(i => i.value), checked: document.querySelector('input[name=settle-how]:checked').value,
      submit: document.getElementById('settle-submit').textContent }));
    check(width + ' C3 one question, four answers, Confirmed first, no status or revert box', !dlg.status && !dlg.revert && /No Eggs/.test(dlg.q) && dlg.opts.join() === 'note,preference,notneeded,waiting' && dlg.checked === 'note' && dlg.submit === 'Save · by Fiona', dlg);
    if (shots) await page.screenshot({ path: path.join(shots, 'answer-' + width + '.png') });
    await page.fill('#settle-resolution-note', 'H&W letter on file');
    await page.click('#settle-submit');
    await page.waitForFunction(() => REGISTRY_MAP['syn-2'].confirm === 'Confirmed');
    const r2 = await page.evaluate(() => ({ docs: REGISTRY_MAP['syn-2'].docs, tags: REGISTRY_MAP['syn-2'].tags, section: REGISTRY_MAP['syn-2'].section, toast: document.getElementById('cx-toast').innerText }));
    check(width + ' C1 SYN-2: No Eggs documented, restrictions and section untouched', r2.docs['No Eggs'] && r2.docs['No Eggs'].line === 'H&W letter on file' && r2.docs['No Eggs'].by === 'Fiona' && r2.tags.join() === 'Halal,No Eggs' && r2.section === 'Halal', r2);
    check(width + ' C3 the toast says what happened, what is left and offers Undo', /Room SYN-2 documented\. 4 to go, 1 anaphylactic\./.test(r2.toast) && /Undo/.test(r2.toast), r2.toast);
    await page.click('#cx-toast .cx-undo');
    await page.waitForFunction(() => REGISTRY_MAP['syn-2'].confirm === 'Provisional');
    check(width + ' C3 Undo takes the answer back', await page.evaluate(() => !REGISTRY_MAP['syn-2'].docs));

    // C3 It's a preference, and Still waiting
    await page.evaluate(() => openResolveModal('SYN-6'));
    check(width + ' C3 a preference room opens on "It\'s a preference"', await page.evaluate(() => document.querySelector('input[name=settle-how]:checked').value === 'preference'));
    await page.click('#settle-submit');
    await page.waitForFunction(() => REGISTRY_MAP['syn-6'].confirm === 'Confirmed');
    check(width + ' C3 recorded as a preference', await page.evaluate(() => REGISTRY_MAP['syn-6'].docs['No Pork'].how === 'preference'));
    await page.evaluate(() => openResolveModal('SYN-7'));
    await page.check('input[name=settle-how][value=waiting]');
    await page.selectOption('#settle-wait-days', '14');
    check(width + ' C3 Still waiting says "Set the reminder"', (await page.locator('#settle-submit').innerText()).trim() === 'Set the reminder');
    await page.click('#settle-submit');
    await page.waitForFunction(() => !!REGISTRY_MAP['syn-7'].complianceDeadline);
    const w = await page.evaluate(() => ({ d: REGISTRY_MAP['syn-7'].complianceDeadline, c: REGISTRY_MAP['syn-7'].confirm, want: cxDayPlus(14), sub: document.querySelector('#cx-row-SYN-7 .cx-subline').innerText }));
    check(width + ' C3 a reminder in two weeks, still Provisional, shown on the row', w.d === w.want && w.c === 'Provisional' && /Reminder/.test(w.sub), w);

    // C2 the selection bar; C1 one batch action; C3 batch preference never for an anaphylactic room
    await page.click('#cx-row-SYN-1 .cx-pick');
    check(width + ' C2 the selection bar rises with a selection', await page.locator('#cx-selbar').isVisible() && (await page.locator('#compliance-selected-count').innerText()) === '1 selected');
    await page.click('#cx-row-SYN-3 .cx-pick');
    check(width + ' C3 "It\'s a preference" hides while an anaphylactic room is selected', await page.locator('#compliance-batch-preference').isHidden());
    await page.click('#cx-row-SYN-3 .cx-pick');
    await page.click('#compliance-batch-confirm');
    await page.waitForFunction(() => REGISTRY_MAP['syn-1'].confirm === 'Confirmed');
    const docsShown = await page.$$eval('#compliance-resolved-body tr', (trs) => trs.map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
    check(width + ' C1 Documented lists SYN-1, SYN-4 and SYN-6', docsShown.length === 3 && ['SYN-1', 'SYN-4', 'SYN-6'].every((r) => docsShown.some((x) => x.includes(r))), docsShown);

    // C2 quiet saving for a note
    await page.evaluate(() => { document.querySelector('#cx-row-SYN-7 details.cx-more').open = true; });
    await page.fill('#cx-row-SYN-7 .cx-note-field input', 'asked Nov 22');
    await page.waitForFunction(() => document.getElementById('cx-saved-SYN-7').textContent === 'Saved ✓', null, { timeout: 5000 });
    check(width + ' C2 a note saves quietly beside its row', await page.evaluate(() => REGISTRY_MAP['syn-7'].moderateNote === 'asked Nov 22'));

    // C1 Re-open, and a new person in a documented room
    await page.evaluate(() => reopenComplianceItem('SYN-4'));
    await page.waitForFunction(() => REGISTRY_MAP['syn-4'].confirm === 'Provisional');
    check(width + ' C1 Re-open takes the answers back', await page.evaluate(() => Object.keys(REGISTRY_MAP['syn-4'].docs || {}).length === 0));
    await page.evaluate(() => { changesQueue = [{ room: 'SYN-1', type: 'intake', tags: { glutenFree: true, noPork: true }, route: 'Gluten Free', notes: '' }]; applyQueueToRegistry([]); changesQueue = []; renderComplianceView(); });
    v = await view();
    check(width + ' C1 a new person in SYN-1 is back on the list', v.flatMap(g => g.rows).some(r => r.room === 'SYN-1'), v);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(width + ' no sideways page scroll', overflow <= 1, overflow);
    check(width + ' C3 no browser prompt or confirm was opened', dialogs === 0, dialogs);
    check(width + ' no page errors', errors.length === 0, errors);
    await page.close();
  }
} finally { await browser.close(); }
const failed = results.filter((x) => !x).length;
console.log(failed ? failed + ' FAILED of ' + results.length : 'all ' + results.length + ' passed');
process.exit(failed ? 1 : 0);
