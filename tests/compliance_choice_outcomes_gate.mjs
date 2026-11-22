// Every Compliance Review choice says what it does to meals (2026-11-22, v31-standard.141). Jason: "All choices should be
// clear about outcomes. If clicking just a preference means the plating sheet won't take it seriously then that needs to
// be clear." It does not: an answer is paperwork (r.docs), which no plate, label or warning reads; only taking a
// restriction off the resident record changes meals. The browser half (tests/browser/compliance_worklist.mjs) checks that
// the plating sheet is the same before and after It's a preference.
//   1. one line above the choices says meals already follow every restriction, and only Not needed any more changes them
//   2. each of the four choices names its effect on meals
//   3. the batch question and the preference nudge say meals don't change
//   4. no plate, label or warning builder reads the answers
// Authored to fail on main 396f0ef.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { doorSource } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.COMPLIANCE_OUTCOMES_HTML || new URL('../index.html', import.meta.url), 'utf8');
const { fn } = doorSource(html);
const modal = html.slice(html.indexOf('id="settle-compliance-modal"'), html.indexOf('<!-- ===== ASK H&W'));
const opt = (value) => { const i = modal.indexOf('value="' + value + '"'); return modal.slice(i, modal.indexOf('</label>', i)); };

test('1. one line above the choices: meals already follow every restriction; only Not needed any more changes them', () => {
  assert.match(modal, /Meals already follow every restriction listed here\. Only <b>Not needed any more<\/b> changes them\./);
});

test('2. each choice names its effect on meals', () => {
  assert.match(opt('note'), /Meals don’t change/);
  assert.match(opt('preference'), /Meals don’t change: the plating sheet, labels and warnings follow it exactly as they follow a documented restriction/);
  assert.match(opt('notneeded'), /Changes meals:.*stop following it/);
  assert.match(opt('waiting'), /Records nothing; meals don’t change/);
});

test('3. the batch preference question and the nudge say meals don\'t change', () => {
  assert.match(fn('batchPreferenceCompliance'), /Their meals don’t change: the plating sheet, labels and warnings follow each restriction exactly as now/);
  assert.doesNotMatch(fn('batchPreferenceCompliance'), /stay on the plate/);
  assert.match(fn('cxRenderNudge'), /choose It’s a preference\. Their meals don’t change\./);
});

test('4. no plate, label or warning builder reads the answers', () => {
  for (const name of ['computePlatingData', 'computeSections', 'routeResident', 'doorSectionLineNotes', 'buildPlatingHtml',
    'buildRoutingByMealJSON', 'checkResidentMealConflicts', 'getAnaphConflictRooms']) {
    const body = fn(name);
    assert.doesNotMatch(body, /\.docs\b|doorDocState|doorComplianceStateOf|\.how\b/, name + ' reads no compliance answer');
  }
});
