// U4 (2026-11-18, back-on-track plan; Jason: "download all button ... just takes me to the top of the page"). When the
// ZIP is refused because meals still need a definition, Download All says so beside each of its buttons, names the
// reason and the count, offers "Show the list", and leaves focus where the person is. The list itself still goes at the
// top of the screen, unfocused. The next attempt clears the note. Authored red on main 37499e3.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  const m = new RegExp('\\n(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(m, 'Missing ' + name);
  const start = m.index + 1, end = html.indexOf('\n}\n', start);
  return html.slice(start, end + 3);
}
function core() {
  const a = html.indexOf('/* DOOR_TESTABLE_CORE_START plating-readiness-feedback-v1 */');
  const b = html.indexOf('/* DOOR_TESTABLE_CORE_END plating-readiness-feedback-v1 */');
  assert.ok(a >= 0 && b > a, 'feedback core');
  return html.slice(a, b);
}

// A small fake page: elements with ids, children, focus and insertAdjacentElement.
function page() {
  const byId = new Map();
  let focused = null;
  function el(tag, id) {
    const e = { tagName: tag, id: id || '', children: [], style: {}, attrs: {}, parent: null, innerHTML: '', _text: '',
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this._text + this.children.map(c => c.textContent).join(''); },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      appendChild(c) { c.parent = this; this.children.push(c); if (c.id) byId.set(c.id, c); return c; },
      prepend(c) { c.parent = this; this.children.unshift(c); if (c.id) byId.set(c.id, c); },
      insertAdjacentElement(where, c) { c.parent = this.parent; this.after = c; if (c.id) byId.set(c.id, c); return c; },
      remove() { byId.delete(this.id); }, focus() { focused = this; },
      querySelector(sel) { return /readiness-title/.test(sel) ? (this._title || null) : null; } };
    Object.defineProperty(e, 'id', { get() { return this._id; }, set(v) { this._id = v; if (v) byId.set(v, this); } });
    e.id = id || '';
    return e;
  }
  const screen = el('div', 'screen');
  const btnTop = el('button', 'ps-dl-all-btn'), btnReview = el('button', 'dl-all-btn');
  btnReview.focus();
  const document = {
    getElementById: id => byId.get(id) || null,
    createElement: tag => el(tag),
    querySelector: sel => sel === '.screen.active' ? screen : (/readiness-title/.test(sel) ? (byId.get('door-plating-readiness-feedback') || {})._title || null : null),
  };
  return { document, btnTop, btnReview, screen, focused: () => focused, el };
}

function box(p, readinessIssues) {
  const toasts = [], alerts = [];
  const ctx = { console: { error() {}, log() {} }, document: p.document, toasts, alerts, Set, Map, WeakMap,
    escapeHtml: s => String(s), doorIcon: () => '', alert: m => alerts.push(m), showToast: (m, k) => toasts.push(m),
    doorRotationServices: () => [], JSZip: class { file() {} async generateAsync() { throw Error('must not build'); } },
    buildAllFileList: () => [] };
  vm.createContext(ctx);
  vm.runInContext(core() + '\n' + ['doorPlatingReadinessText', 'doorPlatingReadinessHTML', 'doorReportPlatingError',
    'doorDownloadAllStopText', 'doorDownloadAllNote', 'downloadAllFiles'].filter(n => n !== 'doorDownloadAllStopText' || html.includes('function doorDownloadAllStopText(')).filter(n => n !== 'doorDownloadAllNote' || html.includes('function doorDownloadAllNote(')).map(fn).join('\n')
    + '\nfunction doorRequirePlatingReady(){ const r = {ready:false, issues:__issues}; throw doorCreatePlatingReadinessError(r, "Plating NOT READY."); }', ctx);
  ctx.__issues = readinessIssues;
  // The real HTML builder renders a title element the fake page can find.
  const realPresent = ctx.doorPresentPlatingReadiness;
  ctx.doorPresentPlatingReadiness = (r, o) => { const ok = realPresent(r, o); const h = p.document.getElementById('door-plating-readiness-feedback'); if (h) { h._title = p.el('strong'); if (!(o && o.focus === false)) h._title.focus(); } return ok; };
  return ctx;
}
const GAPS = [
  { kind: 'definition-gap', label: 'W1 SUNDAY breakfast', rooms: ['SYN-1'], reason: 'Gluten-free breakfast meal is not defined' },
  { kind: 'definition-gap', label: 'W1 MONDAY breakfast', rooms: ['SYN-2'], reason: 'Gluten-free breakfast meal is not defined' },
];

test('a refused ZIP says why beside each Download All button, with the count and the reason', async () => {
  const p = page(); const c = box(p, GAPS);
  await c.downloadAllFiles();
  for (const b of [p.btnTop, p.btnReview]) {
    const note = p.document.getElementById(b.id + '-stop');
    assert.ok(note, 'note beside ' + b.id);
    assert.equal(b.after, note, 'placed right after the button');
    assert.match(note.textContent, /No ZIP downloaded: 2 meals need attention first \(Gluten-free breakfast meal is not defined\)/);
    assert.match(note.textContent, /Show the list/);
    assert.equal(note.getAttribute('role'), 'status');
  }
  assert.equal(c.toasts.length, 0, 'no second toast');
  assert.equal(c.alerts.length, 0, 'no native alert');
});

test('the list goes at the top unfocused; focus stays on the button the person pressed; Show the list moves it', async () => {
  const p = page(); const c = box(p, GAPS);
  await c.downloadAllFiles();
  const host = p.document.getElementById('door-plating-readiness-feedback');
  assert.ok(host && p.screen.children.includes(host), 'list presented at the top');
  assert.equal(p.focused(), p.btnReview, 'focus not moved to the top');
  const note = p.document.getElementById('dl-all-btn-stop');
  note.children[0].onclick();
  assert.equal(p.focused(), host._title, 'Show the list focuses the list');
});

test('the next attempt clears the note', async () => {
  const p = page(); const c = box(p, GAPS);
  await c.downloadAllFiles();
  assert.ok(p.document.getElementById('dl-all-btn-stop'));
  c.__issues = [];
  c.doorRequirePlatingReady = () => [];
  c.buildAllFileList = () => { throw Error('stop after clearing'); };
  await c.downloadAllFiles();
  assert.match(p.document.getElementById('dl-all-btn-stop').textContent, /No ZIP downloaded: stop after clearing/, 'replaced, not stacked');
});
