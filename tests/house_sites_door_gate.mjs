// D1, 2026-11-10 (Jason: "go ahead with D1"; EXPO in-app plan §4 Phase 4). DOOR reads the HOUSE site registry
// (conc-kitchen-house/sites.json, schema 1, contract SITES.md) for its sites and their names. Prevents: a site list
// and typed resident counts written into the page (SITE_CONFIGS carried 181 / 40 / 30 and "· 181 residents").
// Authored red on origin/main 6995443.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function core() {
  const a = html.indexOf('/* DOOR_TESTABLE_CORE_START house-sites */');
  const b = html.indexOf('/* DOOR_TESTABLE_CORE_END house-sites */');
  assert.ok(a >= 0 && b > a, 'the house-sites testable core is in the page');
  const i = html.indexOf('const SITE_CONFIGS = {');
  assert.ok(i > 0, 'SITE_CONFIGS is in the page');
  let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; }
  const c = {};
  vm.createContext(c);
  vm.runInContext(html.slice(a, b) + '\n' + html.slice(i, j + 1) +
    ';\nthis.R = { DOOR_HOUSE_SITES_URL, DOOR_BUILTIN_HOUSE_SITES, doorHouseSitesUsable, doorChooseHouseSites, doorHouseSiteFor,' +
    ' doorSitePickerOptions, doorSiteRecord, doorSiteStatusNote, SITE_CONFIGS };', c);
  return c.R;
}
function fnBody(name) {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name);
  let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; }
  return html.slice(i, j + 1);
}
const J = (x) => JSON.parse(JSON.stringify(x));
function reg(edit) { const r = J(core().DOOR_BUILTIN_HOUSE_SITES); r._meta.generated = 'test'; if (edit) edit(r); return r; }

test('1. reader order: live, then the kept copy, then the built-in copy; another schema version is refused on screen', () => {
  const R = core();
  const live = reg(r => { r.sites.find(s => s.key === 'rexdale').name = 'Rexdale (live)'; });
  const kept = reg(r => { r.sites.find(s => s.key === 'rexdale').name = 'Rexdale (kept)'; });
  let p = R.doorChooseHouseSites(live, kept);
  assert.equal(p.source, 'live'); assert.equal(p.reg, live); assert.equal(p.note, '');
  p = R.doorChooseHouseSites(undefined, kept);
  assert.equal(p.source, 'kept'); assert.equal(p.reg, kept);
  p = R.doorChooseHouseSites(undefined, null);
  assert.equal(p.source, 'built-in'); assert.equal(p.reg, R.DOOR_BUILTIN_HOUSE_SITES); assert.equal(p.note, '');
  const v2 = reg(r => { r._meta.schemaVersion = 2; });
  p = R.doorChooseHouseSites(v2, kept);
  assert.equal(p.source, 'built-in', 'a version 2 file is refused, and the built-in copy is used');
  assert.equal(p.reg, R.DOOR_BUILTIN_HOUSE_SITES);
  assert.match(p.note, /version 2; DOOR reads version 1/);
  p = R.doorChooseHouseSites(reg(r => { delete r._meta.schemaVersion; }), kept);
  assert.equal(p.source, 'built-in'); assert.match(p.note, /names no version/);
  p = R.doorChooseHouseSites(null, kept); // a live answer that was not JSON
  assert.equal(p.source, 'built-in'); assert.ok(p.note);
  assert.equal(R.doorChooseHouseSites(undefined, v2).source, 'built-in', 'a kept copy of another version is not used');
  // The loader: cache-busted, no-store, kept through the quota-safe writer, and run at start-up.
  const load = fnBody('loadHouseSites');
  assert.match(load, /fetch\(DOOR_HOUSE_SITES_URL \+ '\?_=' \+ Date\.now\(\), \{ cache: 'no-store'/);
  assert.match(load, /doorSetItemSafe\(DOOR_HOUSE_SITES_CACHE_KEY/);
  assert.match(load, /doorChooseHouseSites\(live, kept\)/);
  assert.match(fnBody('initSiteSelector'), /loadHouseSites\(\)/);
  assert.equal(R.DOOR_HOUSE_SITES_URL, 'https://kennedyjasondavid-eng.github.io/conc-kitchen-house/sites.json');
  // The note is shown quietly beside the site, in the sidebar and in Settings.
  assert.match(fnBody('doorShowSiteNotes'), /_doorHouseSitesNote/);
  assert.match(html, /id="site-registry-note" style="display:none;/);
  assert.match(html, /id="settings-site-note" style="display:none;/);
});

test('2. names come from the registry, matched by key or alias without case', () => {
  const R = core();
  for (const [key, d] of Object.entries(R.SITE_CONFIGS)) {
    for (const f of ['name', 'label', 'sub']) assert.equal(d[f], undefined, key + ' carries no ' + f);
    assert.ok(d.spRegistry, key + ' keeps its SharePoint paths');
  }
  const renamed = reg(r => { r.sites.find(s => s.key === 'rexdale').name = 'Rexdale Shelter North'; });
  const rec = R.doorSiteRecord(renamed, R.SITE_CONFIGS, 'rexdale');
  assert.equal(rec.name, 'Rexdale Shelter North');
  assert.equal(rec.label, 'CONC Rexdale Shelter North');
  assert.equal(rec.spRegistry, R.SITE_CONFIGS.rexdale.spRegistry);
  const b = R.DOOR_BUILTIN_HOUSE_SITES;
  assert.equal(R.doorHouseSiteFor(b, 'REX').key, 'rexdale');
  assert.equal(R.doorHouseSiteFor(b, 'Lan').key, 'lansdowne');
  assert.equal(R.doorHouseSiteFor(b, 'bloor_shelter').key, 'bloor');
  assert.equal(R.doorHouseSiteFor(b, 'nowhere'), null);
  // The built-in copy follows the registry (when the HOUSE repo is beside this one).
  const house = new URL('../../conc-kitchen-house/sites.json', import.meta.url);
  if (fs.existsSync(house)) {
    const live = JSON.parse(fs.readFileSync(house, 'utf8'));
    assert.equal(live._meta.schemaVersion, 1);
    const pick = (s) => ({ key: s.key, name: s.name, aliases: s.aliases, kitchen: s.kitchen, served: s.served, status: s.status });
    assert.deepEqual(J(b.sites.map(pick)), live.sites.map(pick), 'the built-in copy matches sites.json');
  }
});

test('3. no resident count is typed in the page', () => {
  const R = core();
  for (const [key, d] of Object.entries(R.SITE_CONFIGS)) assert.equal(d.residentCount, undefined, key);
  assert.doesNotMatch(html, /residentCount/);
  assert.doesNotMatch(html, /'[^'\n]*\b\d+ residents/, 'no quoted text types a resident count');
  const upd = fnBody('updateResidentCountDisplays');
  assert.match(upd, /currentSite\.key === 'rexdale'/);
});

test('4. the site picker is the registry: served and active sites DOOR has details for', () => {
  const R = core();
  const b = R.DOOR_BUILTIN_HOUSE_SITES;
  const keys = (o) => J(o.map(x => x.key + ':' + x.status));
  assert.deepEqual(keys(R.doorSitePickerOptions(b, R.SITE_CONFIGS, 'rexdale')),
    ['rexdale:active', 'lansdowne:active', 'bloor:active'], 'today: the same three, in the same order');
  assert.deepEqual(J(R.doorSitePickerOptions(b, R.SITE_CONFIGS, 'rexdale').map(o => o.name)), ['Rexdale', 'Lansdowne', 'Bloor']);
  const paused = reg(r => { r.sites.find(s => s.key === 'lansdowne').status = 'paused'; });
  assert.deepEqual(keys(R.doorSitePickerOptions(paused, R.SITE_CONFIGS, 'rexdale')), ['rexdale:active', 'bloor:active'], 'a paused site is not offered');
  assert.deepEqual(keys(R.doorSitePickerOptions(paused, R.SITE_CONFIGS, 'lansdowne')),
    ['rexdale:active', 'lansdowne:paused', 'bloor:active'], 'unless it is the selected one');
  const lan = R.doorSiteRecord(paused, R.SITE_CONFIGS, 'lansdowne');
  assert.equal(R.doorSiteStatusNote(lan), 'Lansdowne is paused in the HOUSE site registry.');
  assert.equal(R.doorSiteStatusNote(R.doorSiteRecord(b, R.SITE_CONFIGS, 'rexdale')), '');
  const retired = reg(r => { r.sites.find(s => s.key === 'bloor').status = 'retired'; });
  assert.deepEqual(keys(R.doorSitePickerOptions(retired, R.SITE_CONFIGS, 'rexdale')), ['rexdale:active', 'lansdowne:active']);
  const unserved = reg(r => { r.sites.find(s => s.key === 'bloor').served = false; });
  assert.ok(!R.doorSitePickerOptions(unserved, R.SITE_CONFIGS, 'rexdale').some(o => o.key === 'bloor'));
  const added = reg(r => { r.sites.push({ key: 'new-site', name: 'New', aliases: [], kitchen: false, served: true, status: 'active', cookedBy: ['bloor'] }); });
  assert.ok(!R.doorSitePickerOptions(added, R.SITE_CONFIGS, 'rexdale').some(o => o.key === 'new-site'), 'a site DOOR has no details for is not offered');
  assert.equal(R.doorSiteRecord(added, R.SITE_CONFIGS, 'new-site'), null);
  // The markup lists no site; the page builds the list from the registry.
  const sel = html.slice(html.indexOf('<select id="site-dropdown"'), html.indexOf('</select>', html.indexOf('<select id="site-dropdown"')));
  assert.doesNotMatch(sel, /<option/);
  assert.match(fnBody('doorRenderSitePicker'), /doorSitePickerOptions\(doorHouseSitesNow\(\), SITE_CONFIGS/);
  assert.match(fnBody('selectSite'), /doorSiteRecord\(doorHouseSitesNow\(\), SITE_CONFIGS, siteKey\)/);
});

test('5. published files do not move: the site record carries no id, so every file still says rexdale', () => {
  const R = core();
  for (const key of Object.keys(R.SITE_CONFIGS)) {
    const currentSite = R.doorSiteRecord(R.DOOR_BUILTIN_HOUSE_SITES, R.SITE_CONFIGS, key);
    assert.equal(currentSite.id, undefined, key);
    assert.equal((currentSite && currentSite.id) || 'rexdale', 'rexdale');
  }
  // The builders read the site this way, and only this way.
  const reads = html.match(/currentSite\.id\)\|\|'rexdale'|currentSite&&currentSite\.id\)\|\|'rexdale'/g) || [];
  assert.equal(reads.length, 7, 'the seven published-file site reads are unchanged');
  for (const f of ['buildMenuJSON', 'buildRoutingByMealJSON']) assert.doesNotMatch(fnBody(f), /DOOR_HOUSE_SITES|doorHouseSites|_doorHouseSites/, f);
});
