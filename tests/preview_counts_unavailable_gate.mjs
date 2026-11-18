// preview_counts_unavailable_gate (2026-11-18, back-on-track plan U4). The Edit Menu plate preview counts residents
// per plate. With no resident list on this computer those counts are unknown: it shows a dash and says why, never 0.
// Authored red on main 45dc5a5.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) { i++; break; } }
  return html.slice(start, i);
}
function render(list) {
  const c = {
    REGISTRY_LIST: list, SECTION_COLOR_MAP: {},
    doorColourChip: () => ({ bg: '#fff', ink: '#000' }), doorFill: () => '#000',
    computeSections: (_f, l) => [{ rule: { key: 'regular', label: 'Regular' }, residents: l.slice() }, { rule: { key: 'vegan', label: 'Vegan', p: 2 }, residents: [] }],
  };
  vm.createContext(c); vm.runInContext(fnBlock('renderSectionPreviewInto'), c);
  const el = { innerHTML: '' }; c.renderSectionPreviewInto({}, el); return el.innerHTML;
}

test('no resident list: a dash, a reason, and no 0 count', () => {
  const h = render([]);
  assert.match(h, /counts are unavailable/);
  assert.ok(!/>0<\/span>/.test(h), 'no plate reads 0');
});
test('with a list: real counts, including a real 0, and no unavailable note', () => {
  const h = render([{ room: '101a' }, { room: '102' }]);
  assert.match(h, />2<\/span>/);
  assert.match(h, />0<\/span>/);
  assert.ok(!/unavailable/.test(h));
});
