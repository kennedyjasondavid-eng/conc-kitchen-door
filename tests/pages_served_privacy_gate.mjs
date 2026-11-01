// What DOOR's GitHub Pages site serves carries no resident (2026-10-31, v31-standard.48).
//
// Pages is public, and stays public when the repository is private. Until this slice it served the whole repository
// from main: door_state.json, recent_log.json, learned_nr.json, the routing-replay receipt, the docs — and the app
// page itself carried April's resident list (REGISTRY_LIST, 182 records) and one built-in anaphylactic room. Now
// .github/workflows/pages.yml serves an allowlist, and the page carries no resident.
//
// This gate pins:
//   1. the workflow serves exactly the app and the files other apps read (EXPO, HUB, PROOF), and deploys on a change
//      to any of them;
//   2. none of the served files is a resident or editor file, and each exists;
//   3. the page has no built-in resident list, anaphylactic room, `room:` literal or invented first-run log, and its
//      plating sheet says so when there is no list;
//   4. no line of the page that talks about residents names a room on today's list (a status code that happens to
//      equal a room number is not a resident line);
//   5. the served data files hold no resident field at any depth.
//
// Authored red against pre-slice main (50bf716): tests 1, 3 and 4 fail (no workflow, the built-in list, the comments);
// 2 and 5 pass (the files named were already there and resident-free; they keep it so).
// A failure message names a line number and what kind of thing it found, never a room or a restriction.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('index.html');
const workflowPath = path.join(root, '.github', 'workflows', 'pages.yml');

// DOOR's published contract (conc-kitchen-house/HOUSE_STATUS_LEDGER.md, DOOR rows) plus the app. Adding a file here
// is a decision: it becomes public.
const SERVED = [
  'index.html', 'favicon.ico',
  'menu_current.json', 'routing_by_meal.json', 'registry_summary.json',
  'meal_swaps.json', 'meal_swaps_reverted.json', 'special_meals.json', 'special_meals_removed.json',
];
const NEVER_SERVED = /^(door_state|recent_log|learned_nr|menu_overlay|change_log|rex_week_answers|custom_tag_rules)\.json$|\.(md|csv|png|mjs|hta|txt)$|^(docs|tests|snapshots)\//;
const RESIDENT_KEYS = new Set(['room', 'residents', 'rawRestriction', 'restrictions', 'anaphRooms', 'anaphTags', 'isAnaph',
  'serviceNote', 'moderateNote', 'allergenFlags', 'accommodations', 'preferences', 'avoidances', '_history', 'confirmBy']);

function servedByWorkflow(yml) {
  const files = new Set();
  for (const m of yml.matchAll(/^\s*cp\s+(\S+)\s+_site\//gm)) files.add(m[1]);
  const loop = yml.match(/^\s*for f in ([^;\n]+); do/m);
  if (loop) loop[1].trim().split(/\s+/).forEach((f) => files.add(f));
  return files;
}

function pathsFilter(yml) {
  const block = yml.match(/\n\s*paths:\n((?:\s+- .+\n)+)/);
  return block ? block[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').replace(/['"]/g, '').trim()).filter(Boolean) : [];
}

test('1. Pages serves exactly the app and the files other apps read, and deploys when any of them changes', () => {
  assert.ok(fs.existsSync(workflowPath), '.github/workflows/pages.yml is missing: Pages would serve the whole repository');
  const yml = fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n');
  assert.deepEqual([...servedByWorkflow(yml)].sort(), [...SERVED].sort(), 'the served list changed');
  assert.ok(!/\bcp\s+-[a-zA-Z]*r|\bcp\s+\S*\*|rsync|cp\s+\.\s/.test(yml), 'the workflow copies more than named files');
  assert.ok(/actions\/upload-pages-artifact@/.test(yml) && /actions\/deploy-pages@/.test(yml), 'the workflow must deploy the artifact');
  assert.deepEqual(pathsFilter(yml).sort(), [...SERVED, '.github/workflows/pages.yml'].sort(), 'the deploy must run on a change to each served file');
});

test('2. no served file is a resident or editor file, and every one exists', () => {
  for (const f of SERVED) {
    assert.ok(!NEVER_SERVED.test(f), f + ' must never be served');
    assert.ok(fs.existsSync(path.join(root, f)), f + ' is missing from the repository');
  }
});

test('3. the page has no built-in resident list, anaphylactic room or invented log, and its plating sheet says when it has no list', () => {
  // assert.ok, not assert.match: a failure must never print the page's text.
  assert.ok(/\nconst REGISTRY_LIST = \[\];\n/.test(html), 'REGISTRY_LIST must start empty');
  assert.ok(/\nlet anaphRooms = \[\];/.test(html), 'anaphRooms must start empty');
  const roomLiterals = (html.match(/["']?\broom["']?\s*:\s*["']\d{3,4}[a-z]?["']/gi) || []).length;
  assert.equal(roomLiterals, 0, 'the page holds ' + roomLiterals + ' room: literal(s)');
  const log = html.slice(html.indexOf('function buildRecentLog() {'), html.indexOf('function saveRecentLog() {'));
  assert.ok(/return \[\];\s*\}\s*$/.test(log), 'a new computer must start with an empty recent log');
  assert.ok(/function doorNoResidentListNoticeHTML\(\) \{\n\s*if \(REGISTRY_LIST\.length\) return '';/.test(html), 'the no-list notice is missing');
  assert.ok(/preview\.innerHTML = doorNoResidentListNoticeHTML\(\) \+ buildPlatingHtml\(pd, false\)/.test(html), 'the plating sheet must show the notice');
  assert.ok(!/Using the built-in resident list/.test(html), 'there is no built-in resident list to use');
});

test('4. no line of the page that talks about residents names a room on today\'s list', () => {
  const rooms = new Set(JSON.parse(read('door_state.json')).residents.map((r) => String(r.room).toLowerCase()));
  assert.ok(rooms.size > 0, 'door_state.json has no residents to check against');
  const residentTalk = /\b(No [A-Z][a-z]+|Regular|Halal|Vegan|Vegetarian|Gluten|GF|Dairy|Lactose|Diabetic|Soft|Bland|anaphylactic|Provisional|restriction|resident|room|allerg)/i;
  const found = [];
  html.split('\n').forEach((line, i) => {
    if (!residentTalk.test(line)) return;
    const n = (line.match(/\b\d{3,4}[a-z]?\b/gi) || []).filter((t) => rooms.has(t.toLowerCase())).length;
    if (n) found.push('line ' + (i + 1) + ' (' + n + ')');
  });
  assert.deepEqual(found, [], 'these lines name a room on today\'s list beside resident words: ' + found.join(', '));
});

test('5. the served data files hold no resident field', () => {
  for (const f of SERVED.filter((s) => s.endsWith('.json'))) {
    const hits = [];
    const walk = (v, at) => {
      if (!v || typeof v !== 'object') return;
      for (const [k, x] of Object.entries(v)) {
        if (RESIDENT_KEYS.has(k)) hits.push(at + '.' + k);
        walk(x, at + '.' + (Array.isArray(v) ? '[]' : k));
      }
    };
    walk(JSON.parse(read(f)), '$');
    assert.deepEqual([...new Set(hits)], [], f + ' holds resident fields');
  }
});
