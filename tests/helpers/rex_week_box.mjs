// tests/helpers/rex_week_box.mjs — the Rex week import's pure core (index.html, DOOR_TESTABLE_CORE rex-week) with the
// real pieces it reads: the menu-parse core (emptyMealFlags, nameDetectFlags), DOOR's CODEX allergen reader
// (hubAllergenToFlags), the slot rules (MEAL_SLOT_DEFS, recipeMatchesSlotDef) and the baked recipe list. Used by
// tests/rex_week_import_gate.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function rexWeekBox(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const between = (a, b) => { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e + b.length); };
  const fn = (name) => { const m = html.match(new RegExp('\\nfunction ' + name + '\\(')); assert.ok(m, 'missing ' + name); const s = m.index + 1; return html.slice(s, html.indexOf('\n}\n', s)) + '\n}\n'; };
  const line = (prefix) => { const s = html.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return html.slice(s, html.indexOf('\n', s)) + '\n'; };
  const SRC = [
    line('const DOOR_RECIPE_DATA_FALLBACK = '),
    between('/* DOOR_TESTABLE_CORE_START shared-recipes */', '/* DOOR_TESTABLE_CORE_END shared-recipes */'),
    line('const DOOR_BRASSICA_RE = '),
    between('/* DOOR_TESTABLE_CORE_START menu-parse */', '/* DOOR_TESTABLE_CORE_END menu-parse */'),
    between('/* DOOR_TESTABLE_CORE_START rex-week */', '/* DOOR_TESTABLE_CORE_END rex-week */'),
    between('const FLAG_DEFS = [', '\n];'),
    between('const HUB_ALLERGEN_MAP = {', '\n};'),
    between('const MEAL_SLOT_DEFS = [', '\n];'),
    fn('_hubAllergenResolve'), fn('hubAllergenToFlags'), fn('recipeMatchesSlotDef'),
    'const _hubUnmappedLabels = new Set();',
    fn('doorRexAccept'),
    'this.api = { doorReadRexWeekRows, doorRexWeekStartFromName, doorRexSameDish, doorRexAlignLine, doorRexRecipeFor, doorRexPieceFlags, doorPlanRexWeek, doorRexBuildMeal, doorRexKind, doorRexWildcard, hubAllergenToFlags, rexAccept: doorRexAccept, recipes: DOOR_RECIPE_DATA_FALLBACK, emptyMealFlags };',
  ].join('\n');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx.api;
}

export function rexCtx(api, extra) {
  return Object.assign({ recipes: api.recipes, accept: api.rexAccept, toFlags: api.hubAllergenToFlags, remembered: {} }, extra || {});
}
