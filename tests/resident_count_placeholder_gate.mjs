// 2026-11-07. Prevents: a computer with no resident list showing "181 residents" (a planning number written
// into the page) as if it were the kitchen's count. Until a list renders, the count reads "—".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function block(start) {
  const i = html.indexOf(start); assert.ok(i >= 0, start);
  let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; }
  return html.slice(i, j + 1);
}
function displays(liveCount) {
  const els = {}; const el = () => ({ textContent: '' });
  for (const id of ['site-sub-label', 'total-count', 'stat-total', 'preview-total-badge']) els[id] = el();
  const label = el();
  const c = { document: { getElementById: (id) => els[id] || null, querySelector: () => label } };
  vm.createContext(c);
  // Re-pinned 2026-11-10 (D1): SITE_CONFIGS keeps only DOOR details; the site name comes from the HOUSE site
  // registry, so the selected site is built the way selectSite builds it (key, registry name, DOOR details).
  const core = html.slice(html.indexOf('/* DOOR_TESTABLE_CORE_START house-sites */'), html.indexOf('/* DOOR_TESTABLE_CORE_END house-sites */'));
  vm.runInContext(core + '\n' + block('const SITE_CONFIGS = {') + ';\nvar _doorSiteShownCount;\nvar currentSite = doorSiteRecord(DOOR_BUILTIN_HOUSE_SITES, SITE_CONFIGS, "rexdale");\n' + block('function updateResidentCountDisplays(liveCount)') +
    '\nupdateResidentCountDisplays(' + JSON.stringify(liveCount) + ');', c);
  return els;
}

test('the page carries no built-in resident count', () => {
  for (const id of ['total-count', 'stat-total']) assert.match(html, new RegExp('id="' + id + '">—<'), id);
  assert.match(html, /id="preview-total-badge"[^>]*>— residents</);
  assert.doesNotMatch(html, /181 residents · 93 restricted/);
});

test('with no list the count reads "—"; a loaded list shows its real count', () => {
  const none = displays(undefined);
  assert.equal(none['total-count'].textContent, '—');
  assert.equal(none['stat-total'].textContent, '—');
  assert.equal(none['site-sub-label'].textContent, 'Rexdale Shelter · no resident list yet');
  const live = displays(173);
  assert.equal(live['total-count'].textContent, 173);
  assert.equal(live['preview-total-badge'].textContent, '173 residents');
  assert.equal(live['site-sub-label'].textContent, 'Rexdale Shelter · 173 residents');
});
