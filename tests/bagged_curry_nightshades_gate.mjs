// Authored red after independent safety review, before the extra source correction.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { liftCornDoor } from './helpers/corn_gate_runtime.mjs';
import { BAGGED_CURRY, BAGGED_NIGHTSHADES, CORN_MANIFEST_SHA256, withBaggedNightshadesReview } from './helpers/bagged_curry_nightshades_review.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const J = x => JSON.parse(JSON.stringify(x));
const raw = fs.readFileSync(new URL('./fixtures/corn_recipe_alignment_2026-10-22.json', import.meta.url), 'utf8');
const original = JSON.parse(raw), F = withBaggedNightshadesReview(original);
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), R = liftCornDoor(html);
const priorShared = original.shared.find(s => s.record.recipeName === BAGGED_CURRY);
const corrected = { ...J(priorShared.record), allergens: [...priorShared.after, BAGGED_NIGHTSHADES], door: { ...J(priorShared.record.door), allergens: [...priorShared.after, BAGGED_NIGHTSHADES] } };
const expected = F.source.find(r => r.recipeName === BAGGED_CURRY);

test('the Corn manifest remains frozen and the extension changes exactly three allergen lists', () => {
  assert.equal(crypto.createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('hex'), CORN_MANIFEST_SHA256);
  const restored = J(F);
  assert.equal(restored.shared.find(s => s.record.recipeName === BAGGED_CURRY).after.pop(), BAGGED_NIGHTSHADES);
  assert.equal(restored.source.find(r => r.recipeName === BAGGED_CURRY).allergens.pop(), BAGGED_NIGHTSHADES);
  assert.equal(restored.fallbackDeltas.find(d => d.recipeName === BAGGED_CURRY).after.allergens.pop(), BAGGED_NIGHTSHADES);
  assert.deepEqual(restored, original);
});
test('the preserved source and intake receipt explicitly support the added family', () => {
  for (const list of [priorShared.record.sourceAllergens, priorShared.record.authoringEvidence.intakeReceipt.sourceAllergens])
    assert.ok(list.includes('Nightshades + Spicy (Jalapeño in paste)'));
  assert.ok(priorShared.record.authoringEvidence.source.text.includes('Green Curry Paste (Vegan)'));
});
test('offline fallback adds the sourced Nightshades label and preserves every other sauce field', () => {
  assert.deepEqual(J(R.fallback.find(r => r.recipeName === BAGGED_CURRY)), expected);
});
test('shared overlay carries all nine source warnings and the existing identity without mutation', () => {
  const before = J(corrected), result = J(R.core.doorOverlaySharedRecipes([], { recipes: [corrected] }));
  assert.deepEqual(result.list, [expected]);
  assert.deepEqual(corrected, before);
  assert.equal(expected.allergens.length, 9);
  for (const family of ['Nightshades', 'Corn', 'Sulphites', 'Milk']) assert.ok(expected.allergens.some(a => a.startsWith(family + ' (')));
});
test('a paired shared candidate contains the exact labels, evidence and legacy door fields', () => {
  const url = new URL('../../shared-library/library_shared.json', import.meta.url);
  // A standalone checkout still checks the frozen source, actual fallback and overlay above.
  if (!fs.existsSync(url)) return;
  const actual = JSON.parse(fs.readFileSync(url, 'utf8')).recipes.find(r => r.recipeName === BAGGED_CURRY);
  assert.deepEqual(actual.allergens, corrected.allergens);
  assert.deepEqual(actual.door, corrected.door);
  assert.deepEqual(actual.sourceAllergens, corrected.sourceAllergens);
  assert.deepEqual(actual.authoringEvidence, corrected.authoringEvidence);
});
test('the complete 84-meal menu keeps its online and offline outputs after the added source warning', () => {
  const menu = read('../menu_current.json').menu;
  const oldFallback = J(R.fallback).map(r => r.recipeName === BAGGED_CURRY ? { ...r, allergens: priorShared.after } : r);
  const beforeHtml = html.replace(/const DOOR_RECIPE_DATA_FALLBACK = [^\n]+/, 'const DOOR_RECIPE_DATA_FALLBACK = ' + JSON.stringify(oldFallback) + ';');
  const prior = liftCornDoor(beforeHtml);
  const reg = ['Regular', 'Vegan', 'Halal', 'Soft Meals'].map((stream, i) => ({room:'nightshade_gate_'+i, section:'Regular', tags:[...(stream === 'Regular' ? [] : [stream]), 'No Nightshades'], restrictions:[],allergenFlags:[],accommodations:[],preferences:[],avoidances:[],isAnaph:false,_tierMigrated:true}));
  const pairedFeed = new URL('../../conc-recipe-hub/DOOR_RECIPE_DATA.json', import.meta.url);
  const base = fs.existsSync(pairedFeed) ? JSON.parse(fs.readFileSync(pairedFeed, 'utf8')) : F.source;
  const oldRecord = { ...J(corrected), allergens:priorShared.after, door:{...J(corrected.door),allergens:priorShared.after} };
  const oldFeed = J(R.core.doorOverlaySharedRecipes(base.filter(r => r.recipeName !== BAGGED_CURRY), { recipes:[oldRecord] })).list;
  const newFeed = J(R.core.doorOverlaySharedRecipes(base.filter(r => r.recipeName !== BAGGED_CURRY), { recipes:[corrected] })).list;
  const oldOnline = J(prior.engine(menu, oldFeed, reg).out), newOnline = J(R.engine(menu, newFeed, reg).out);
  const oldOffline = J(prior.engine(menu, null, reg).out), newOffline = J(R.engine(menu, null, reg).out);
  assert.equal(Object.keys(newOnline).length, 84);
  assert.equal(Object.keys(newOffline).length, 84);
  assert.deepEqual(newOnline, oldOnline);
  assert.deepEqual(newOffline, oldOffline);
});
