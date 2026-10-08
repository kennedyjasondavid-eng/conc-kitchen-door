// 2026-10-08 (Jason: "go with your leans, 1 and 2"): Edit Menu's Save asks its two questions — a slot that reads
// like several dishes, and "no soft/plain alternative" — in DOOR's own dialog (doorAsk), not a browser confirm().
// A browser confirm() blocks the page, looks unlike the rest of DOOR, and an automated browser can silently
// dismiss it. The dialog sets its text as text (never HTML), Escape / a click outside / "Go back" all mean go back,
// and Save re-checks that the same meal is still open after the answer arrives.
//
// Authored-to-fail against pre-slice origin/main: doorAsk does not exist and saveMenuEdit calls confirm() twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

// A minimal DOM: enough for doorAsk to build its dialog and for the test to click its buttons.
function fakeDom() {
  const listeners = {};
  function el(tag) {
    const e = { tagName: tag, children: [], style: {}, attrs: {}, className: '', _text: '', _html: null, parent: null,
      _l: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(c) { c.parent = this; this.children.push(c); return c; },
      insertBefore(c, ref) { c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; },
      remove() { if (this.parent) { this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } },
      addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); },
      focus() {},
      set textContent(v) { this._text = String(v); }, get textContent() { return this._text + this.children.map(c => c.textContent).join(' '); },
      set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    };
    return e;
  }
  const body = el('body');
  const document = {
    body,
    createElement: el,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener(t, f) { listeners[t] = (listeners[t] || []).filter(x => x !== f); },
    _key(key) { (listeners.keydown || []).slice().forEach(f => f({ key, preventDefault() {} })); },
    _listeners: listeners,
  };
  return document;
}
function find(node, pred) {
  if (pred(node)) return node;
  for (const c of node.children || []) { const r = find(c, pred); if (r) return r; }
  return null;
}
function loadDoorAsk(document) {
  const ctx = vm.createContext({ document, Promise });
  vm.runInContext(fnBlock('doorAsk'), ctx);
  return ctx.doorAsk;
}

test('1. saveMenuEdit asks through doorAsk — no browser confirm() left in Save', () => {
  const save = fnBlock('saveMenuEdit');
  assert.match(save, /^async function saveMenuEdit\(/, 'Save waits for the answer');
  assert.ok(!/(^|[^.\w$])confirm\s*\(/.test(code(save)), 'no confirm() in saveMenuEdit');
  assert.equal((save.match(/await doorAsk\(/g) || []).length, 2, 'both questions use doorAsk');
  const runOn = save.indexOf('doorRunOnSlots(MEAL_SLOT_STATE, MEAL_SLOT_DEFS)');
  assert.ok(runOn > 0 && runOn < save.indexOf('buildAltMeals()'), 'the run-on question still comes first');
});

test('2. after the answer, Save stops if a different meal is open', () => {
  const save = fnBlock('saveMenuEdit');
  assert.match(save, /const editKey = mcMenuEditKey;/);
  const recheck = save.indexOf('if (mcMenuEditKey !== editKey) return;');
  assert.ok(recheck > save.lastIndexOf('await doorAsk('), 'the re-check comes after the last question');
  assert.ok(recheck < save.indexOf('buildVegAlt()'), 'and before anything is built or written');
});

test('3. the dialog writes its text as text, never as HTML', () => {
  const ask = code(fnBlock('doorAsk'));
  assert.ok(!/innerHTML/.test(ask), 'doorAsk never sets innerHTML');
  assert.match(ask, /textContent = /);
});

test('4. "Save as it is" answers yes; the dialog closes', async () => {
  const document = fakeDom();
  const doorAsk = loadDoorAsk(document);
  const p = doorAsk({ title: 'More than one dish in a slot?', lines: ['a', 'b'], items: ['Main: "<img src=x onerror=alert(1)>"'], cancelLabel: 'Go back and split them', goLabel: 'Save as it is' });
  const ov = find(document.body, n => /door-ask/.test(n.className));
  assert.ok(ov, 'the dialog is on the page');
  assert.ok(ov.textContent.includes('<img src=x onerror=alert(1)>'), 'the slot text is shown as typed');
  const go = find(ov, n => /door-ask-go/.test(n.className));
  assert.equal(go.textContent.trim(), 'Save as it is');
  go.onclick();
  assert.equal(await p, true);
  assert.equal(document.body.children.length, 0, 'the dialog is gone');
  assert.equal((document._listeners.keydown || []).length, 0, 'its Escape listener is gone');
});

test('5. Go back, Escape and a click outside all answer no', async () => {
  for (const how of ['back', 'escape', 'outside']) {
    const document = fakeDom();
    const doorAsk = loadDoorAsk(document);
    const p = doorAsk({ lines: ['x'] });
    const ov = find(document.body, n => /door-ask/.test(n.className));
    if (how === 'back') find(ov, n => /door-ask-cancel/.test(n.className)).onclick();
    if (how === 'escape') document._key('Escape');
    if (how === 'outside') ov._l.click.forEach(f => f({ target: ov }));
    assert.equal(await p, false, how + ' answers no');
    assert.equal(document.body.children.length, 0, how + ' closes the dialog');
  }
});
