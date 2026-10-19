// tests/phone_hidden_panels_gate.mjs — a panel hidden by its inline style stays hidden on a phone (2026-10-19).
// Jason, 2026-10-19: "Fix the phone width bug". The phone layout (@media (max-width: 768px)) stacks the hand-written
// grid layouts of six screens with `#screen-X .content > div[style] { display: block !important; }`. The rule also
// matched every panel and banner hidden by an inline display:none, so on a phone they all showed, and the meal
// panel's Close did nothing there. A real-browser scan of the six screens at 390 and 1280 px found 12: Menu Config's
// meal panel, Edit Menu panel, test-meal panel, day preview and seven banners, and Review's recent-files card. The
// Special Meal panel was the one already fixed, by its own exception class (.mc-special-noauto).
// Checks, on the phone rules as written:
//   1. each of the 12, hidden as written and hidden again by a script (style.display = 'none', which a browser
//      writes as "display: none"), is matched by no rule that forces a display
//   2. the grid layouts the rule was written for still stack on all six screens; the Special Meal panel keeps its
//      exception
//   3. one rule per screen, no duplicate (Menu Config had the rule twice), and every phone rule of this kind is one
//      the check can read
// Authored to fail on 1fc6509 (1, 3). Env: PHONE_HIDDEN_ROOT (another checkout's directory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.PHONE_HIDDEN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCREENS = ['reports', 'custom-reports', 'settings', 'review', 'leftover', 'menu-config'];
// The direct children of a screen's .content that start hidden by their inline style (the 2026-10-19 browser scan).
const HIDDEN = { 'menu-config': ['mc-swaps-banner', 'mc-menu-source-banner', 'mc-overlay-diff-banner', 'mc-unmapped-allergen-banner',
  'mc-edit-menu-banner', 'mc-specials-banner', 'mc-slot-swap-banner', 'mc-edit-panel', 'mc-day-preview', 'mc-menu-edit-panel',
  'mc-test-meal-panel'], review: ['recent-generated'] };

// The phone block: from its @media line to its matching brace, comments dropped.
function phoneBlock() {
  const start = html.indexOf('@media (max-width: 768px) {');
  assert.ok(start >= 0, 'the phone layout block');
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(html.indexOf('{', start) + 1, i).replace(/\/\*[\s\S]*?\*\//g, '');
}
// Its rules: { selectors, body }.
function rules() {
  const block = phoneBlock(), out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(block))) out.push({ selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean), body: m[2] });
  return out;
}
const forcesDisplay = (body) => /display\s*:\s*[a-z-]+\s*!important/.test(body);
// A selector of the form "#screen-X .content > div[style]" with :not(.class) and :not([style*="…"]) conditions.
function parse(sel) {
  const m = sel.match(/^#screen-([\w-]+) \.content > div\[style\]((?::not\([^()]*\))*)$/);
  if (!m) return null;
  return { screen: m[1], nots: [...m[2].matchAll(/:not\(([^()]*)\)/g)].map((x) => x[1]) };
}
function matches(p, el) {
  if (p.screen !== el.screen) return false;
  for (const n of p.nots) {
    if (n[0] === '.') { if (el.classes.includes(n.slice(1))) return false; continue; }
    const a = n.match(/^\[style\*="([^"]*)"\]$/);
    assert.ok(a, 'a condition the check can read: ' + n);
    if (el.style.includes(a[1])) return false;
  }
  return true;
}
// The rules that force a display on one of these screens' .content > div[style].
function displayRules() {
  return rules().filter((r) => forcesDisplay(r.body)).flatMap((r) => r.selectors.filter((s) => s.includes('div[style]')).map((s) => ({ sel: s, p: parse(s) })));
}
const forced = (el) => displayRules().filter((d) => d.p && matches(d.p, el)).map((d) => d.sel);
// An element's tag as written: its class list and inline style.
function tagOf(id) {
  const m = html.match(new RegExp('<div id="' + id + '"[^>]*>'));
  assert.ok(m, 'the element ' + id);
  const attr = (name) => { const a = m[0].match(new RegExp('\\s' + name + '="([^"]*)"')); return a ? a[1] : null; };
  return { classes: (attr('class') || '').split(/\s+/).filter(Boolean), style: attr('style') };
}

test('1. a panel or banner hidden by its inline style stays hidden on a phone, as written and when a script hides it again', () => {
  for (const [screen, ids] of Object.entries(HIDDEN)) {
    for (const id of ids) {
      const t = tagOf(id);
      assert.match(t.style || '', /display:\s*none/, id + ' starts hidden by its inline style');
      const asWritten = { screen, classes: t.classes, style: t.style };
      assert.deepEqual(forced(asWritten), [], id + ' stays hidden on a phone');
      // A script's style.display = 'none' (Close, the banners' renders): the browser writes the style back as "display: none; …".
      const rest = t.style.split(';').map((x) => x.trim()).filter((x) => x && !/^display\s*:/.test(x)).map((x) => x.replace(/\s*:\s*/, ': ')).join('; ');
      const hiddenAgain = { screen, classes: t.classes, style: 'display: none;' + (rest ? ' ' + rest + ';' : '') };
      assert.deepEqual(forced(hiddenAgain), [], id + ' stays hidden after a script hides it again');
    }
  }
});

test('2. the grid layouts the rule was written for still stack on all six screens; the Special Meal panel keeps its exception', () => {
  for (const screen of SCREENS) {
    const grid = { screen, classes: [], style: 'display:grid;grid-template-columns:1fr 340px;gap:16px;' };
    assert.ok(forced(grid).length > 0, screen + ': a hand-written grid still stacks on a phone');
    const shown = { screen, classes: [], style: 'display: block; margin-top: 16px;' };
    assert.ok(forced(shown).length > 0, screen + ': a panel a script has shown still takes the phone layout');
  }
  const special = tagOf('mc-special-panel');
  assert.ok(special.classes.includes('mc-special-noauto'));
  assert.deepEqual(forced({ screen: 'menu-config', classes: special.classes, style: 'display: block; margin-top: 20px;' }), [],
    'the Special Meal panel, once open, keeps its own layout');
});

test('3. one rule per screen and no duplicate; every phone rule of this kind is one the check can read', () => {
  const found = displayRules();
  for (const d of found) assert.ok(d.p, 'a selector the check can read: ' + d.sel);
  for (const screen of SCREENS) {
    assert.equal(found.filter((d) => d.p && d.p.screen === screen).length, 1, screen + ' has one such rule');
  }
});
