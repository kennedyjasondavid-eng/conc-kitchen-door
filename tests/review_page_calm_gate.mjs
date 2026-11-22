// tests/review_page_calm_gate.mjs — 2026-11-22 (Jason: the Review & Generate page showed a wall of meal warnings before
// today's changes; the person updating the list needs what changes now and what looks wrong, and the plating sheets
// carry the meal detail). Order: the numbers, Today's changes, Needs a look, the previews, then one short meals card.
// Residents here are made up. Authored red on main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function fn(name) {
  const s = html.indexOf('function ' + name + '('); assert.ok(s >= 0, 'missing ' + name);
  return html.slice(s, html.indexOf('\n}\n', s)) + '\n}\n';
}
const screen = html.slice(html.indexOf('<div class="screen" id="screen-review">'), html.indexOf('<!-- ===== CONFIRM ===== -->'));

test('RP-1 the page order: numbers, Today’s changes, Needs a look, the previews, the meals in brief', () => {
  const at = (s) => { const i = screen.indexOf(s); assert.ok(i >= 0, 'missing ' + s); return i; };
  const order = [at('class="stats-row"'), at('review-changes-body'), at('id="review-flags-area"'), at('id="routing-preview"'), at('id="review-meals-summary"')];
  assert.deepEqual(order, order.slice().sort((a, b) => a - b));
});

test('RP-2 the meal warnings are not drawn as a card each, and contained rooms do not count as needing review', () => {
  const b = fn('buildReview');
  assert.doesNotMatch(b, /residents? affected/, 'no per-allergen warning cards');
  assert.doesNotMatch(b, /Anaphylactic routing active/, 'no per-room red boxes');
  assert.match(b, /const totalFlags = flags \+ anaphNamingNone\.length;/);
  assert.match(b, /doorReviewMealsSummaryHTML\(todayConflicts, anaphAlerts\)/);
  assert.match(b, /<details id="review-ready-fold"[\s\S]{0,400}\+ readyHtml \+ '<\/details>'/, 'plates not named: one folded line');
});

test('RP-3 the meals card: one count, the anaphylactic rooms by name, the detail folded, escaped', () => {
  const c = { doorIcon: () => '', escapeHtml: (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
  vm.createContext(c);
  vm.runInContext(fn('doorReviewMealsSummaryHTML'), c);
  assert.equal(c.doorReviewMealsSummaryHTML([], []), '', 'nothing to say, no card');
  const conflicts = [
    { period: 'Lunch', mealFlag: 'hasGluten', label: 'Gluten', residents: [{ room: '101a' }, { room: '102' }] },
    { period: 'Dinner', mealFlag: 'hasGluten', label: 'Gluten', residents: [{ room: '101a' }] },
    { period: 'Dinner', mealFlag: 'hasSoy', label: 'Soy', residents: [{ room: '<b>9' }] },
  ];
  const anaph = [{ anaphRoom: '201', allergen: 'No Coconut', mealsAffected: 'Dinner', roommateRooms: [] }, { anaphRoom: '201', allergen: 'No Tree Nuts', mealsAffected: 'Dinner', roommateRooms: [] }];
  const out = c.doorReviewMealsSummaryHTML(conflicts, anaph);
  assert.match(out, /change the plate for <strong>3 residents<\/strong>/, 'counted once per resident');
  assert.match(out, /Anaphylactic: room 201 gets the separate meal at dinner\./, 'one line per room, not per allergen');
  assert.match(out, /<details[\s\S]*Show by allergen/, 'the detail is folded');
  assert.doesNotMatch(out, /<b>9/, 'escaped');
  assert.match(out, /Open plating sheets/);
});
