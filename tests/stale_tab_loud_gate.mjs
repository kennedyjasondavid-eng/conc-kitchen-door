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

// 2026-11-12: a redeploy is not a new version. GitHub Pages gives the same page a new ETag on every deploy, and each DOOR
// publish commits to this repository, which redeploys it — so the ETag check called the tab out of date after its own
// publish and held its sends (twice on 2026-11-11, v31-standard.66 on both sides). The stamp is now the page's content.
test('the page stamp is its content: the same page is the same stamp, CRLF counts as LF, no text is no stamp', () => {
  const { doorPageStamp: ps, doorTabStaleVerdict: v } = load('doorPageStamp', 'doorTabStaleVerdict');
  assert.match(ps('<html>a</html>'), /^c:[0-9a-f]{8}-\d+$/);
  assert.equal(ps('<html>a</html>'), ps('<html>a</html>'));
  assert.notEqual(ps('<html>a</html>'), ps('<html>b</html>'));
  assert.equal(ps('x\r\ny'), ps('x\ny'));
  assert.equal(ps(''), ''); assert.equal(ps(null), '');
  assert.equal(v(ps('a'), ps('a')).stale, false);
  assert.equal(v(ps('a'), ps('b')).stale, true);
});

test('a redeploy of the same page (new ETag, same content) is not stale; new content is', async () => {
  const check = fnBlock('checkForFreshDoorVersion');
  assert.doesNotMatch(check, /const stamp = r\.headers\.get\('etag'\)/, 'the ETag is never the stamp');
  let etag = '"E1"', page = '<html>door v1</html>', heads = 0, gets = 0, banners = 0;
  const c = {
    sessionStorage: { getItem: () => null, removeItem() {} }, localStorage: { setItem() {} },
    location: { protocol: 'https:', pathname: '/conc-kitchen-door/' }, console: { log() {} }, Date,
    fetch: (url, o) => { const head = o && o.method === 'HEAD'; head ? heads++ : gets++;
      return Promise.resolve({ ok: true, headers: { get: k => (k === 'etag' ? etag : null) }, text: () => Promise.resolve(page) }); },
    showStaleVersionBanner: () => { banners++; }, doorStaleAutoReloadWatch() {},
  };
  vm.createContext(c);
  vm.runInContext("var _doorTabStale = false, _doorStaleStamp = '', _doorBootHtmlStamp = null, _doorFreshLastEtag = '', _doorFreshLastStamp = '';\n" +
    fnBlock('doorPageStamp') + '\n' + fnBlock('doorTabStaleVerdict') + '\n' + check +
    '\nthis.run = () => checkForFreshDoorVersion(); this.st = () => ({ stale: _doorTabStale, anchor: _doorBootHtmlStamp });', c);
  const tick = () => new Promise(r => setTimeout(r, 20));
  c.run(); await tick();
  assert.equal(c.st().stale, false); assert.match(c.st().anchor, /^c:/, 'the tab anchors to the content stamp');
  c.run(); await tick();
  assert.equal(gets, 1, 'the same ETag again: no second read of the page');
  etag = '"E2-redeployed"'; c.run(); await tick();
  assert.equal(c.st().stale, false, 'a redeploy of the same page is not a new version');
  assert.equal(banners, 0, 'no bar for a redeploy');
  etag = '"E3"'; page = '<html>door v2</html>'; c.run(); await tick();
  assert.equal(c.st().stale, true, 'new content is a new version');
  assert.equal(banners, 1, 'the bar shows for a new version');
});
