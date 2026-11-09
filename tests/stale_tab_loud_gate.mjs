// W3d, 2026-11-08 (Week 3 post-mortem log 8; Jason: "follow your leans" — keep the stop, make it loud). Prevents: an
// out-of-date DOOR page silently holding saves (4 sat in the outbox until a reload on Week 3), and, the other way, an
// out-of-date page sending with old code (F1: old code must not write).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}
const load = (...names) => { const c = {}; vm.createContext(c); vm.runInContext(names.map(fnBlock).join('\n') + '\nthis.c = { ' + names.join(', ') + ' };', c); return c.c; };

test('the page reloads by itself only when nothing is open, once per new version', () => {
  const { doorStaleReloadDecision: d } = load('doorStaleReloadDecision');
  const idle = { stale: true, stamp: 'v2', reloadedFor: '', editOpen: false, dialogOpen: false, typing: false, reviewOpen: false, unsaved: false };
  assert.equal(d({ ...idle, stale: false }).action, 'none');
  assert.equal(d(idle).action, 'reload');
  for (const k of ['editOpen', 'dialogOpen', 'typing', 'reviewOpen', 'unsaved']) assert.equal(d({ ...idle, [k]: true }).action, 'wait', k + ' holds the reload');
  assert.equal(d({ ...idle, reloadedFor: 'v2' }).action, 'none', 'never twice for the same version: no reload loop');
  assert.equal(d({ ...idle, reloadedFor: 'v1' }).action, 'reload', 'a later version reloads again');
});

test('while changes wait, the bar is red and counts them; otherwise the quiet amber notice', () => {
  const { doorStaleBannerText: t } = load('doorStaleBannerText');
  const three = t(3);
  assert.equal(three.red, true);
  assert.match(three.text, /3 changes are waiting to send to the kitchen\. Reload to send them; your work is kept\./);
  assert.match(t(1).text, /1 change is waiting/);
  assert.equal(t(0).red, false);
  const bar = fnBlock('showStaleVersionBanner');
  assert.match(bar, /\(red \? '' : '<button id="door-stale-dismiss"/, 'no Hide button while changes wait');
  assert.match(bar, /textContent = text/, 'the words are set as text');
  assert.match(bar, /onclick = doorStaleReloadNow/, 'Reload now reloads');
});

test('the stop stays: an out-of-date page\'s automatic sends are still held, and kept in the outbox', () => {
  assert.match(html, /if \(!manual\) \{\s*return \{ skipped:true, reason:'stale-tab'/);
  const append = fnBlock('doorOutboxAppend');
  assert.match(append, /_doorTabStale[\s\S]{0,120}showStaleVersionBanner\(\)/, 'a held send refreshes the red count');
});

test('detection starts the watch; a reload is marked so it can\'t loop, and the outbox drains at boot', () => {
  assert.match(fnBlock('checkForFreshDoorVersion'), /_doorStaleStamp = stamp;[\s\S]{0,80}doorStaleAutoReloadWatch\(\)/);
  assert.match(fnBlock('doorStaleReloadNow'), /sessionStorage\.setItem\('door_auto_reload_for', _doorStaleStamp/);
  assert.match(html, /doorOutboxDrain\('boot'\)/, 'what waited is sent after the reload');
});
