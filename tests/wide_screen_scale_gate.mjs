// Jason, 2026-11-20: "can we make this the default scale?", then "Try 110% equiv". DOOR draws at 110% on a wide
// screen (from 1650 px, so the zoomed layout stays at least 1500 px and the side panel
// breakpoint at 1500 still holds); print and the plating sheets keep their size; viewport heights are divided by the
// scale so the sidebar, page and dialogs fit; the toast places itself in page pixels under the zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = html.slice(0, html.indexOf('</style>'));
const block = (() => {
  const i = css.indexOf('@media screen and (min-width: 1650px)');
  assert.ok(i >= 0, 'the wide-screen block exists');
  return css.slice(i, css.indexOf('\n  }\n', i) + 4);
})();

test('WS-1 screen only, from 1650 px, at 110%, and 1650 is 1500 times the zoom', () => {
  assert.match(block, /:root \{ --door-zoom: 1\.1; \}/);
  assert.match(block, /body \{ zoom: var\(--door-zoom\);/);
  assert.equal(Math.round(1500 * 1.1), 1650);
  const before = css.slice(0, css.indexOf('@media screen and (min-width: 1650px)'));
  assert.equal((before.match(/@media print \{/g) || []).length, (before.match(/@media print \{[\s\S]*?\n  \}\n/g) || []).length, 'not inside a print block');
  assert.ok(!/@media print[^{]*\{[^}]*zoom/.test(css), 'print never zooms');
});
test('WS-2 viewport heights are divided by the scale so the page fits the window', () => {
  assert.match(block, /\.sidebar \{ height: calc\(100vh \/ var\(--door-zoom\)\); \}/);
  assert.match(block, /#app-shell \{ min-height: calc\(100vh \/ var\(--door-zoom\)\) !important; \}/);
  assert.match(block, /\.main \{ min-height: calc\(100vh \/ var\(--door-zoom\)\); \}/);
  assert.match(block, /\.modal-box \{ max-height: calc\(80vh \/ var\(--door-zoom\)\); \}/);
});
test('WS-3 the toast reads the scale; the scale is 1 when not zoomed', () => {
  const i = html.indexOf('function doorScreenScale(');
  const f = html.slice(i, html.indexOf('\n}\n', i) + 2);
  assert.match(f, /getComputedStyle\(document\.body\)\.zoom/);
  assert.match(f, /return z > 0 \? z : 1;/);
  assert.match(html, /Math\.round\(\(window\.innerHeight - _fr\.top\) \/ _zs \+ 12\)/);
});
