// Sidebar count kept (2026-11-22, v31-standard.134). Jason's Review page showed 169 residents while the sidebar said
// "Rexdale Shelter · no resident list yet" and "—": the list was drawn before the site was set (the count was dropped at
// the site check), then selecting the site at start-up wrote the dash over it. Red on main 4a95bcb (SC-1, SC-2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fnSrc(name) {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name);
  const j = html.indexOf('\n}\n', i);
  return html.slice(i, j + 2);
}

function sandbox() {
  const els = {};
  const el = (id) => (els[id] = els[id] || { textContent: '' });
  const c = { currentSite: null, _doorSiteShownCount: undefined,
    document: { getElementById: el, querySelector: () => el('.total-label') } };
  vm.createContext(c);
  vm.runInContext('var currentSite = null; var _doorSiteShownCount;' + fnSrc('updateResidentCountDisplays'), c);
  return { c, els };
}

test('SC-1 a list drawn before the site is set keeps its count', () => {
  const { c, els } = sandbox();
  vm.runInContext('updateResidentCountDisplays(169)', c);
  vm.runInContext("currentSite = { key: 'rexdale', name: 'Rexdale' }; updateResidentCountDisplays(_doorSiteShownCount)", c);
  assert.equal(els['site-sub-label'].textContent, 'Rexdale Shelter · 169 residents');
  assert.equal(els['total-count'].textContent, 169);
});

test('SC-2 selecting the site passes the count already shown', () => {
  const sel = fnSrc('selectSite');
  assert.match(sel, /updateResidentCountDisplays\(_doorSiteShownCount\)/);
  assert.doesNotMatch(sel, /updateResidentCountDisplays\(\)/);
});

test('SC-3 no list, an empty list and another site still read as a dash', () => {
  const { c, els } = sandbox();
  vm.runInContext("currentSite = { key: 'rexdale', name: 'Rexdale' }; updateResidentCountDisplays(undefined)", c);
  assert.equal(els['site-sub-label'].textContent, 'Rexdale Shelter · no resident list yet');
  vm.runInContext('updateResidentCountDisplays(0)', c);
  assert.equal(els['total-count'].textContent, '—');
  vm.runInContext("currentSite = { key: 'lansdowne', name: 'Lansdowne' }; updateResidentCountDisplays(40)", c);
  assert.equal(els['total-count'].textContent, '—');
});
