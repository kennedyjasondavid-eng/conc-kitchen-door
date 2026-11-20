// tests/theme_menu_redraw_gate.mjs — 2026-11-20 (Jason: the Menu Config badges were harsh in dark mode). The meal cards
// draw their badge colours for the theme they were drawn in (doorColourChip), so switching to dark left the light
// badges on a dark page until something redrew the week. toggleDarkMode now redraws Menu Config when it is showing.
// Authored red on main bd6f1d1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const s = html.indexOf('function toggleDarkMode(');
const body = html.slice(s, html.indexOf('\n}\n', s)) + '\n}\n';

function run(menuActive) {
  let renders = 0;
  const attrs = {};
  const screen = { classList: { contains: (c) => c === 'active' && menuActive } };
  const c = {
    document: {
      documentElement: { getAttribute: (k) => attrs[k] || null, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } },
      querySelector: () => ({ innerHTML: '' }),
      getElementById: (id) => (id === 'screen-menu-config' ? screen : null),
    },
    localStorage: { setItem() {}, removeItem() {} },
    doorIcon: () => '', renderMenuConfig: () => { renders++; }, console,
  };
  vm.createContext(c);
  vm.runInContext(body, c);
  c.toggleDarkMode();
  const afterDark = attrs['data-theme'];
  c.toggleDarkMode();
  return { renders, afterDark, afterLight: attrs['data-theme'] };
}

test('TM-1 switching the theme on Menu Config redraws the week, both ways', () => {
  const r = run(true);
  assert.equal(r.afterDark, 'dark');
  assert.equal(r.afterLight, undefined);
  assert.equal(r.renders, 2, 'the cards keep the old theme badge colours until redrawn');
});
test('TM-2 another screen is not redrawn by a theme switch', () => {
  assert.equal(run(false).renders, 0);
});
