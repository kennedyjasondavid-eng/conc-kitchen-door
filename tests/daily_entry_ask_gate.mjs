// 2026-10-08 (Jason: "follow your leans, go ahead with 1, 2 and 3"): the Daily Entry, registry and compliance
// questions ask in DOOR's own dialog (doorAsk), not a browser confirm(). Same reasons as the Save dialog
// (save_dialog_styled_gate): a browser confirm() blocks the page, looks unlike the rest of DOOR, and an automated
// browser can silently dismiss it. Thirteen questions across twelve functions move: revert a resident, clear the
// queue, remove a queued change, reset the registry, undo the last Generate, confirm / resolve / re-open
// compliance, leave Edit Menu / go home, undo the last menu change, save the intake queue, and the two questions
// on a direct save (discharge, room already here).
//
// The menu-screen and publish confirms are not in this pass.
//
// Authored-to-fail against pre-slice origin/main: every one of these functions calls confirm().
// DOOR_GATE_HTML=<path> runs the gate against another copy of index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(process.env.DOOR_GATE_HTML || path.join(root, 'index.html'), 'utf8');

function fnBlock(name) {
  const m = new RegExp('(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(m, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(m.index, i);
}
const code = (src) => src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const nativeConfirm = /(^|[^.\w$])confirm\s*\(/;

const ASKS = {
  confirmRevertResidentFromEditor: 1,
  clearQueue: 1,
  removeFromEditor: 1,
  clearAndReseed: 1,
  revertLastGenerate: 1,
  batchConfirmCompliance: 1,
  batchResolveCompliance: 1,
  reopenComplianceItem: 1,
  goHome: 2,
  revertLastChange: 1,
  commitIntakeQueue: 1,
  saveDirectFromForm: 2,
};

test('1. each question asks through doorAsk, and the function waits for the answer', () => {
  for (const [name, n] of Object.entries(ASKS)) {
    const fn = fnBlock(name);
    assert.match(fn, new RegExp('^async function ' + name + '\\('), name + ' waits for the answer');
    assert.equal((fn.match(/await doorAsk\(/g) || []).length, n, name + ' asks ' + n + ' question(s) through doorAsk');
  }
});

test('2. no browser confirm() is left in these functions', () => {
  for (const name of Object.keys(ASKS)) {
    assert.ok(!nativeConfirm.test(code(fnBlock(name))), 'no confirm() in ' + name);
  }
});

test('3. every doorAsk here names its title and both buttons', () => {
  for (const name of Object.keys(ASKS)) {
    const calls = fnBlock(name).match(/await doorAsk\(\{[\s\S]*?\}\)/g) || [];
    for (const c of calls) {
      assert.match(c, /title:/, name + ': a title');
      assert.match(c, /goLabel:/, name + ': a go button');
      assert.match(c, /cancelLabel:/, name + ': a go-back button');
    }
  }
});

// Runtime: the real function bodies, with doorAsk answering one way or the other.
function runClearQueue(answer) {
  const ctx = vm.createContext({ toasts: [], answer });
  vm.runInContext(
    'let changesQueue = [{ room: "101" }, { room: "102" }];' +
    'function renderQueue() {} function updateBadge() {}' +
    'function showToast(m) { toasts.push(m); }' +
    'async function doorAsk() { return answer; }' +
    fnBlock('clearQueue') +
    ';globalThis.getQueue = () => changesQueue; globalThis.run = clearQueue;', ctx);
  return ctx;
}

test('4. Clear the queue: Go back keeps the queue, Clear queue empties it', async () => {
  const keep = runClearQueue(false);
  await keep.run();
  assert.equal(keep.getQueue().length, 2, 'Keep them leaves the queue alone');
  assert.equal(keep.toasts.length, 0);
  const clear = runClearQueue(true);
  await clear.run();
  assert.equal(clear.getQueue().length, 0, 'Clear queue empties it');
});

function runRevertGenerate(answer) {
  const store = { concRegistrySnapshot: JSON.stringify({ residents: [{ room: '201' }], _meta: {} }) };
  const ctx = vm.createContext({ answer, store, published: [] });
  vm.runInContext(
    'const localStorage = { getItem: k => (k in store ? store[k] : null), removeItem: k => { delete store[k]; } };' +
    'const REGISTRY_LIST = [{ room: "201" }, { room: "202" }]; const REGISTRY_MAP = {}; const anaphRooms = [];' +
    'function saveRegistryState() {} function renderRegistry() {} function updateRevertButton() {}' +
    'function publishAndSync(r) { published.push(r); } function showToast() {}' +
    'async function doorAsk() { return answer; }' +
    fnBlock('revertLastGenerate') +
    ';globalThis.list = () => REGISTRY_LIST; globalThis.run = revertLastGenerate;', ctx);
  return ctx;
}

test('5. Undo the last Generate: Go back changes nothing, Undo Generate restores the snapshot', async () => {
  const back = runRevertGenerate(false);
  await back.run();
  assert.equal(back.list().length, 2, 'the resident list is untouched');
  assert.ok('concRegistrySnapshot' in back.store, 'the snapshot is kept for later');
  assert.equal(back.published.length, 0, 'nothing is published');
  const undo = runRevertGenerate(true);
  await undo.run();
  assert.equal(undo.list().length, 1, 'the list goes back to the snapshot');
  assert.ok(!('concRegistrySnapshot' in undo.store), 'the snapshot is used up');
  assert.equal(undo.published.length, 1);
});
