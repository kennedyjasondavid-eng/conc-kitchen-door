// P6 — ambiguous bare tokens: ask the person, don't guess. (Jason ruling 2026-09-11)
//
// A slash-list on the intake sheet like "Diabetic / No Red Meat / White Rice / Bread"
// gets an implied "No" on the bare nouns. When the implied "No X" matches a known rule
// (pork, red meat, gluten, coconut, the allergens…) it is a restriction and is inferred
// silently. When it matches NOTHING it is ambiguous — "no white rice" or "prefers white
// rice" is a human judgment — so DOOR carries the bare noun to Review & Generate and asks
// "Which did intake mean?" with three answers: No X / Prefers X / Not applicable.
// And Needs Review must fire even when the room's tag set did not change; otherwise the
// ambiguity is silent forever (1106 today).
//
// Authored-to-fail: parser returns no `ambiguous`; NR is gated on isNewOrChanged; no
// which-did-intake-mean UI; note resolutions ignore their value.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(m.index, i + 1);
}
function blockBetween(startMarker, endMarker) {
  const a = html.indexOf(startMarker), b = html.indexOf(endMarker, a);
  assert.ok(a >= 0 && b > a, 'import module block not found');
  return html.slice(a, b);
}
function bracedConst(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(start, html.indexOf(';', i) + 1);
}

// The import module: IMPORT_TAG_RULES … up to handleImportFile (normalizeRestriction,
// expanders, diffImportAgainstRegistry all live here).
function importSandbox(registry, learned) {
  const store = { concLearnedNR: JSON.stringify(learned || {}), concDismissedDiffs: '{}', concCustomTagRules: '[]' };
  const REGISTRY_LIST = registry.map(r => ({ ...r })); const REGISTRY_MAP = {};
  REGISTRY_LIST.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const sb = { console, REGISTRY_LIST, REGISTRY_MAP, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: s => String(s), _escAttr: s => String(s) };
  vm.createContext(sb);
  vm.runInContext([bracedConst('TAG_LABELS_MAP'), fnBlock('getRoomBase'), blockBetween('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile(')].join('\n'), sb);
  return sb;
}
const norm = (sb, txt) => vm.runInContext('normalizeRestriction(' + JSON.stringify(txt) + ')', sb);

test('parser: implied-No nouns that match a rule are INFERRED restrictions; unmatched bare nouns are AMBIGUOUS', () => {
  const sb = importSandbox([]);
  const a = norm(sb, 'Diabetic /No Red Meat /White Rice /Bread');
  assert.equal(a.tags.diabetic, true); assert.equal(a.tags.noBeef, true);
  assert.deepEqual([...(a.ambiguous || [])], ['White Rice', 'Bread']);
  const b = norm(sb, 'Halal / Coconut');            // bare allergen → inferred, not a question
  assert.equal(b.tags.noCoconut, true); assert.equal((b.ambiguous || []).length, 0);
  const c = norm(sb, 'No Pork / Sausage');           // bare noun with no rule → ask
  assert.equal(c.tags.noPork, true); assert.deepEqual([...(c.ambiguous || [])], ['Sausage']);
  const d = norm(sb, 'No White Rice');               // EXPLICIT No → a restriction the parser can't tag: ordinary unmatched, NOT ambiguous
  assert.equal((d.ambiguous || []).length, 0); assert.ok(d.unmatched.length === 1);
  const e = norm(sb, 'No Popcorn, Corn, Nuts, Coconuts'); // comma-implied allergens → all inferred
  assert.equal((e.ambiguous || []).length, 0); assert.equal(e.tags.noCorn, true); assert.equal(e.tags.noTreeNuts, true);
  const f = norm(sb, 'Regular'); assert.equal((f.ambiguous || []).length, 0);
  // leftover fragments are noise, never a question (found by the live e2e)
  const g = norm(sb, 'Halal /Diabetic/No potassium foods'); assert.equal((g.ambiguous || []).length, 0, 'foods'); assert.equal(g.tags.lowPotassium, true);
  const h = norm(sb, 'No Pork / No Salt/ Diabetic Diet'); assert.equal((h.ambiguous || []).length, 0, 'Diet');
  const i = norm(sb, 'No Sauce -Vegetables with Chicken or Fish for dinner / lunch'); assert.equal((i.ambiguous || []).length, 0, 'lunch');
  // a bare list after an explicit No: vegetables without a rule are asked, one per noun
  const j = norm(sb, 'No Caulilower/ Tomatoes / Cucumber / Broccoli'); assert.deepEqual([...j.ambiguous], ['Tomatoes', 'Cucumber', 'Broccoli']);
});

test('diff: Needs Review fires for an UNCHANGED room that carries unresolved/ambiguous tokens, and is silenced only by a learned resolution', () => {
  const reg = [{ room: '1106', tags: ['Diabetic', 'No Beef'], section: 'Diabetic', rawRestriction: 'Diabetic, No Beef' }];
  const entries = (sb) => vm.runInContext("[{ room: '1106', parsed: normalizeRestriction('Diabetic /No Red Meat /White Rice /Bread') }]", sb);
  const sb = importSandbox(reg);
  const d = vm.runInContext('diffImportAgainstRegistry(' + JSON.stringify(entries(sb)) + ')', sb);
  assert.equal(d.updates.length, 0, 'tag set unchanged → not an update');
  const nr = d.needsReview.find(x => x.room === '1106');
  assert.ok(nr, 'ambiguity on an unchanged room must still reach Needs Review');
  assert.deepEqual([...nr.ambiguous], ['White Rice', 'Bread']);
  const sb2 = importSandbox(reg, { '1106': { _resolved_text: 'diabetic /no red meat /white rice /bread' } });
  const d2 = vm.runInContext('diffImportAgainstRegistry(' + JSON.stringify(entries(sb2)) + ')', sb2);
  assert.equal(d2.needsReview.length, 0, 'a learned resolution for the same text silences it');
});

test('commit carries the ambiguous nouns into the Review & Generate hand-off (concUnresolvedNR)', () => {
  const commit = fnBlock('commitImportToQueue');
  assert.match(commit, /concUnresolvedNR[\s\S]{0,400}ambiguous/, 'concUnresolvedNR items must carry `ambiguous`');
});

test('Review card asks "Which did intake mean?" per bare noun with No / Prefers / Not applicable, only for ambiguous items', () => {
  const build = fnBlock('buildReview');
  assert.match(build, /Which did intake mean/i);
  assert.ok((build.match(/nrAddAmbiguous/g) || []).length >= 3, 'three answers per noun');
  assert.match(build, /\.ambiguous/, 'driven by the item’s ambiguous list');
});

function nrSandbox(registry, unresolved) {
  const store = { concUnresolvedNR: JSON.stringify(unresolved), concNRResolutions: '{}', concLearnedNR: '{}' };
  const REGISTRY_MAP = {}; registry.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const sb = { console, REGISTRY_MAP, RECENT_LOG: [], TAG_LABELS_MAP: { noBeef: 'No Beef' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, _store: store },
    dedupeServiceNote: (a, b) => (a ? a + ' · ' : '') + b, saveRecentLog() {}, renderRecentLog() {}, buildReview() {}, showToast() {},
    PublishAuth: { sidePublish: async () => ({}) }, document: { getElementById: () => null } };
  vm.createContext(sb);
  vm.runInContext([fnBlock('nrAddAmbiguous'), fnBlock('nrDoneReview')].join('\n'), sb);
  return sb;
}

test('nrAddAmbiguous: No X → note "No X"; Prefers X → note "Prefers X"; Not applicable → skip; then Done applies the SPECIFIC note, not the whole raw line', () => {
  const r = { room: '1106', tags: ['Diabetic', 'No Beef'], rawRestriction: 'Diabetic, No Beef', serviceNote: '' };
  const sb = nrSandbox([r], [{ room: '1106', text: 'Diabetic /No Red Meat /White Rice /Bread', isAnaphCandidate: false, ambiguous: ['White Rice', 'Bread'] }]);
  vm.runInContext("nrAddAmbiguous('1106', 'sid1', 'White Rice', 'prefers'); nrAddAmbiguous('1106', 'sid1', 'Bread', 'no'); nrAddAmbiguous('1106', 'sid1', 'Bread', 'skip')", sb);
  const pending = JSON.parse(sb.localStorage._store.concNRResolutions)['_pending_1106'];
  assert.deepEqual(pending.map(p => [p.action, p.value, p.noun]), [['note', 'Prefers White Rice', 'White Rice'], ['skip', '', 'Bread']], 'a second answer for the same noun REPLACES the first');
  vm.runInContext("nrDoneReview('1106')", sb);
  assert.equal(r.serviceNote, 'Prefers White Rice', 'the specific answer becomes the service note — never the whole raw line');
  assert.ok(!r.tags.includes('No White Rice'));
  const learned = JSON.parse(sb.localStorage._store.concLearnedNR)['1106'];
  assert.equal(learned._resolved_text, 'diabetic /no red meat /white rice /bread', 'learned so the room is not asked again for the same text');
});

test('the new inline handler is on the _escJsAttrCall allowlist (the real page throws otherwise — found by the e2e)', () => {
  const start = html.indexOf('const DOOR_INLINE_HANDLER_ALLOWLIST');
  const block = html.slice(start, html.indexOf('};', start));
  assert.match(block, /nrAddAmbiguous:\s*true/);
});

test('pending chip shows the specific note text; version stamp bumped', () => {
  assert.match(fnBlock('buildReview'), /d\.action==='note'\s*\?\s*\(d\.value\s*\|\|\s*'Service note'\)/, 'chip label uses the note value when present');
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.(9|[1-9]\d)'/);
});
