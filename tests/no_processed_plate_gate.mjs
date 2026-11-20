// tests/no_processed_plate_gate.mjs — the kitchen can name a No Processed Food plate (2026-11-20, `v31-standard.126`).
// Jason, 2026-11-20: plating sheets line up with the kitchen's manuals, made easy to add as we go. Edit Menu's
// "+ Add a plate for…" lists No processed food beside the other kitchen plates; the meal stores `<period>_noProcessedAlt`;
// the No Processed Food section prints it (it printed the soft plate, else a generic plain plate); on a pork meal a named
// plate keeps them on it instead of the halal plate; a swap or a permanent change clears it with the other plates; the
// editor's counts give it its own row. A meal with no such plate prints and seats exactly as before.
// Authored to fail on main e82e0f6. Every resident here is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.NO_PROCESSED_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const oneLine = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s) + 1); };
const block = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n};\n', s) + 4); };
const out = (v) => JSON.parse(JSON.stringify(v));

const c = vm.createContext({ console });
vm.runInContext([
  between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
  between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers(') + fn('migrateResidentTiers'),
  fn('getAltMeal'), oneLine('const DOOR_KITCHEN_ALT_FIELDS = '),
  between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts('),
  fn('doorKitchenAlternatives'), fn('doorAddKitchenPlateFlags'),
  oneLine('const DOOR_KITCHEN_ALT_LABELS = '), block('const DOOR_KITCHEN_ALT_NOT_MADE = {'),
  'this.FIELDS = DOOR_KITCHEN_ALT_FIELDS; this.LABELS = DOOR_KITCHEN_ALT_LABELS; this.NOT_MADE = DOOR_KITCHEN_ALT_NOT_MADE; this.EMPTY = DOOR_DISH_PART_EMPTY;',
].join('\n'), c, { filename: 'index.html#no-processed', timeout: 10000 });

const resident = (room, tags) => { const r = { room, tags: tags.slice() }; c.migrateResidentTiers(r); return r; };
const seatOf = (meal, r) => (out(c.computeSections({ ...meal }, [r])).find((s) => s.residents.length) || { rule: { key: 'none' } }).rule.key;
const PLATE = 'Plain roast chicken, toast, fruit';

test('NP-1 No processed food is one of the kitchen plates: listed, labelled, and said when not made', () => {
  assert.ok(c.FIELDS.includes('noProcessedAlt'), 'DOOR_KITCHEN_ALT_FIELDS');
  assert.equal(c.LABELS.noProcessedAlt, 'No processed food', 'the "+ Add a plate for" list and its row');
  assert.match(c.NOT_MADE.noProcessedAlt || '', /^Not made: No Processed Food residents get /, 'the row says where they eat when it is not made');
});

test('NP-2 the No Processed Food section prints the named plate; without one it prints as before', () => {
  const ctx = { mealName: 'Roll, Pork Sausage, Eggs', softAlt: 'Soft scrambled eggs' };
  assert.equal(c.getAltMeal('noproc_alt', { ...ctx, noProcessedAlt: PLATE }), PLATE, 'the named plate wins');
  assert.equal(c.getAltMeal('noproc_alt', ctx), 'Soft scrambled eggs', 'no named plate: the soft plate, as before');
  assert.match(c.getAltMeal('noproc_alt', { mealName: 'x' }), /^Non-processed alternative/, 'neither: the generic plate, as before');
  const day = { breakfast_noProcessedAlt: '  ' + PLATE + ' ' };
  assert.equal(c.doorKitchenAlternatives(day, 'breakfast').noProcessedAlt, PLATE, 'read from the meal, trimmed (the plating context spreads these)');
});

test('NP-3 on a pork meal a named plate keeps No Processed Food residents on it; without one they join the halal plate', () => {
  const r = resident('SYN-NP', ['No Processed Food']);
  const pork = { hasPork: true, hasProcessedMeat: true };
  assert.equal(seatOf(pork, r), 'halal', 'no named plate: the halal plate, as before');
  const named = c.doorAddKitchenPlateFlags({ ...pork }, { breakfast_noProcessedAlt: PLATE }, 'breakfast');
  assert.equal(named._noProcessedAlt, PLATE, 'the plate reaches the routing flags');
  assert.equal(seatOf(named, r), 'no_processed', 'named: they get the plate the kitchen names');
  assert.equal(seatOf({ hasProcessedMeat: true }, r), 'no_processed', 'a non-pork meal is unchanged');
});

test('NP-4 a swap or a permanent change clears it with the meal’s other plates', () => {
  assert.equal(c.EMPTY._noProcessedAlt, '', 'DOOR_DISH_PART_EMPTY (so DOOR_MEAL_FIELDS, the kept original and Put back carry it)');
});

test('NP-5 the editor counts: a named plate has its own row; the soft row stops supplying it', () => {
  const src = fn(findOutcomes());
  assert.match(src, /noProcessedAlt:'no_processed'/, 'its own row, counting the No Processed Food section');
  assert.match(src, /const nonProcessed = values\.noProcessedAlt \? \[\] :/, 'the soft row supplies them only when no plate is named');
});
function findOutcomes() {
  const i = html.indexOf("const keys = {gfAlt:'gf'");
  assert.ok(i >= 0, 'the outcomes key map');
  const start = html.lastIndexOf('\nfunction ', i) + 10;
  return html.slice(start, html.indexOf('(', start));
}
