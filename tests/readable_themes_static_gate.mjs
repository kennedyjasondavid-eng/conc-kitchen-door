// tests/readable_themes_static_gate.mjs — the palette half of "readable in both themes" (2026-11-13).
//
// Jason, 2026-11-13: "please run a full review of dark mode colors. Align with other HOUSE apps", then "OK, please
// implement these changes". The browser half (tests/browser/readable_themes_gate.mjs) measures every visible text piece
// on DOOR's screens; this half runs in the node lane and holds the rules that make that pass:
//   1  the dark palette is CODEX's ruled one (conc-recipe-hub C7: K14 greys #a3aab2 / #8b939c, K15 text green #52a877),
//      and no mint is drawn in dark (CODEX: "forest green, never mint");
//   2  every dark ink reads at 4.5:1 on every dark panel and on its own pale panel; white reads on the green fills;
//   3  every var(--name) names a colour DOOR defines (EXPO defined_colours_gate's rule); a name used with a fallback
//      is one the dark palette defines;
//   4  a dark-mode print gets the paper palette: the print block puts back every light value, and the dark plating
//      sheet colours are for the screen only (CODEX call 12: "a white page in any theme");
//   5  the saved theme is applied in <head>, before the page draws;
//   6  the one owner for allergen and section colours (doorColourChip, doorFill) gives a readable chip and badge for
//      every colour in FLAG_DEFS and SECTION_COLOR_MAP, in both themes.
// Authored to fail on main 4a9c337 (no text green, the old greys, mint in dark, no print reset, theme set at the end
// of <body>, no chip owner).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const CSS = (SRC.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const block = (re) => { const m = CSS.match(re); return m ? m[1] : ''; };
const ROOT = block(/:root\s*\{([\s\S]*?)\n\s*\}/);
const DARK = block(/\n\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\s*\}/);
const PRINT = block(/@media print\s*\{\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\s*\}/);
const tokens = (css) => Object.fromEntries([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const T = { root: tokens(ROOT), dark: tokens(DARK), print: tokens(PRINT) };
const resolve = (theme, name) => { let v = T[theme][name] ?? T.root[name]; for (let i = 0; v && v.startsWith('var(') && i < 5; i++) { const k = v.slice(4, -1).split(',')[0].trim(); v = T[theme][k] ?? T.root[k]; } return v; };
const rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const cr = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };

test('1 the dark palette is CODEX C7 ruled one, with no mint drawn in dark', () => {
  assert.ok(ROOT && DARK, 'the :root and dark blocks are found');
  assert.equal(T.dark['--ink'], '#b8bfc7');
  assert.equal(T.dark['--ink-mid'], '#a3aab2', 'K14 secondary grey');
  assert.equal(T.dark['--muted'], '#8b939c', 'K14 muted grey');
  for (const n of ['--forest-text', '--forest-mid-text', '--mint', '--forest-light']) assert.equal(T.dark[n], '#52a877', `K15 text green: ${n}`);
  assert.equal(T.root['--forest-text'], '#1b4332', 'light text greens keep the brand values');
  assert.equal(T.root['--forest-mid-text'], '#2d6a4f');
  const mint = Object.entries(T.dark).filter(([, v]) => /#(52b788|74c69d)\b/i.test(v));
  assert.deepEqual(mint, [], 'no mint value in the dark palette');
  // the print block puts the light mint back on purpose (paper), so it is left out of this check
  assert.ok(!/\[data-theme="dark"\][^{]*\{[^}]*#(52b788|74c69d)/i.test(CSS.replace(PRINT, '')), 'no dark rule draws mint');
  assert.match(CSS, /\[data-theme="dark"\] \.btn-mint \{ background: #337a52; color: #fff; \}/, 'the mint button is a forest fill with white text in dark');
});

test('2 every dark ink reads at 4.5:1 on the dark panels and its own pale panel; white reads on the green fills', () => {
  const panels = ['--paper', '--cream', '--bg-soft', '--neutral-faint'];
  const inks = ['--ink', '--ink-mid', '--muted', '--forest-text', '--amber-text', '--red-text', '--blue-text',
    '--warn-ink', '--danger-ink', '--ok-ink', '--info-ink', '--violet-ink', '--cyan-ink', '--text-1', '--text-2', '--text-3'];
  const own = { '--warn-ink': '--warn-faint', '--amber-text': '--amber-pale', '--danger-ink': '--danger-faint', '--red-text': '--red-pale',
    '--ok-ink': '--ok-faint', '--forest-text': '--green-pale', '--info-ink': '--info-faint', '--blue-text': '--blue-pale', '--violet-ink': '--violet-faint' };
  const low = [];
  for (const ink of inks) {
    const iv = resolve('dark', ink); assert.ok(iv && iv.startsWith('#'), `${ink} resolves in dark (${iv})`);
    for (const p of panels.concat(own[ink] ? [own[ink]] : [])) { const pv = resolve('dark', p); const r = cr(iv, pv); if (r < 4.5) low.push({ ink, iv, p, pv, r }); }
  }
  assert.deepEqual(low, [], 'every ink clears 4.5:1');
  assert.ok(cr('#ffffff', '#337a52') >= 4.5 && cr('#ffffff', resolve('dark', '--forest')) >= 4.5, 'white on the forest fills');
  for (const n of ['--ink', '--ink-mid', '--muted', '--forest-text', '--amber-text', '--red-text', '--blue-text'])
    assert.ok(cr(resolve('root', n), '#ffffff') >= 4.5, `light ${n} reads on white`);
});

test('3 every colour name is defined; a name used with a fallback is one the dark palette defines', () => {
  const defined = new Set([...SRC.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const m of SRC.matchAll(/setProperty\(\s*['"](--[\w-]+)/g)) defined.add(m[1]);
  const bare = [...new Set([...SRC.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]))].filter((n) => !defined.has(n));
  assert.deepEqual(bare, [], 'var(--name) with no fallback names a defined colour');
  const withFallback = [...new Set([...SRC.matchAll(/var\(\s*(--[\w-]+)\s*,/g)].map((m) => m[1]))].filter((n) => !(n in T.dark) && !(n in T.root));
  assert.deepEqual(withFallback, [], 'a var(--name, fallback) names a colour the palette defines');
});

test('4 a dark-mode print gets the paper palette', () => {
  assert.ok(PRINT, 'an @media print block resets the dark palette');
  const missing = [];
  for (const [name, dv] of Object.entries(T.dark)) {
    if (name in T.root) { if (T.print[name] !== T.root[name] && !(T.root[name].startsWith('var(') && T.print[name] === undefined)) missing.push({ name, print: T.print[name], light: T.root[name] }); }
    else if (T.print[name] !== 'initial') missing.push({ name, print: T.print[name], want: 'initial' });
    void dv;
  }
  assert.deepEqual(missing, [], 'every dark colour prints as its light value (dark-only partners fall back)');
  const screen = block(/@media screen\s*\{([\s\S]*?)\n\s*\}\n/);
  for (const cls of ['.ps-title', '.ps-meal', '.ps-allergen', '.ps-sect-hdr', '.ps-total-val', '.ps-anaph-row', '.ps-notes-row'])
    assert.ok(screen.includes(`[data-theme="dark"] ${cls}`), `the dark ${cls} colour is screen-only`);
  const outside = CSS.replace(screen, '');
  assert.ok(!/\[data-theme="dark"\] \.ps-(title|meal|allergen|sect-hdr|total-val)/.test(outside), 'no dark sheet colour outside the screen block');
});

test('5 the saved theme is applied in <head>, before the page draws', () => {
  const head = SRC.slice(0, SRC.indexOf('</head>'));
  assert.match(head, /<script>[\s\S]*localStorage\.getItem\('kdo-dark'\)[\s\S]*setAttribute\('data-theme', 'dark'\)[\s\S]*<\/script>/);
  assert.ok(head.indexOf("getItem('kdo-dark')") < head.indexOf('<style>'), 'before the stylesheet');
});

test('6 every allergen and section colour gets a readable chip and badge in both themes', () => {
  const start = SRC.indexOf('function doorThemeDark()'), end = SRC.indexOf('const FLAG_DEFS = [');
  assert.ok(start > 0 && end > start, 'the chip owner sits above FLAG_DEFS');
  const flagsSrc = SRC.slice(end, SRC.indexOf('];', end) + 2);
  const secStart = SRC.indexOf('const SECTION_COLOR_MAP = {');
  const secSrc = SRC.slice(secStart, SRC.indexOf('};', secStart) + 2);
  const ctx = { document: { documentElement: { getAttribute: () => null } } };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(start, end) + flagsSrc.replace('const FLAG_DEFS', 'var FLAG_DEFS') + '\n' + secSrc.replace('const SECTION_COLOR_MAP', 'var SECTION_COLOR_MAP'), ctx);
  const colours = [...new Set(ctx.FLAG_DEFS.map((f) => f.color).concat(Object.values(ctx.SECTION_COLOR_MAP), ['#d97706', '#0891b2', '#059669', '#9ca3af']))];
  assert.ok(colours.length >= 20, `${colours.length} colours`);
  const low = [];
  for (const dark of [false, true]) for (const c of colours) {
    const chip = ctx.doorColourChip(c, dark);
    const r = cr(chip.ink, chip.bg); if (r < 4.5) low.push({ c, dark, ink: chip.ink, bg: chip.bg, r });
    const f = ctx.doorFill(c); const w = cr('#ffffff', f); if (w < 4.5) low.push({ c, fill: f, white: w });
  }
  assert.deepEqual(low, []);
  assert.equal(ctx.doorTextOnFill('#eab308'), '#1a1a1a', 'dark text on a light fill');
  assert.equal(ctx.doorTextOnFill('#1b4332'), '#fff', 'white text on a dark fill');
});

test('7 the connection box still turns its border red for an error colour', () => {
  assert.match(SRC, /const _isError = \['#dc2626', 'var\(--danger-ink, #b91c1c\)'\]\.includes\(color \|\| stateColor\);/);
});
