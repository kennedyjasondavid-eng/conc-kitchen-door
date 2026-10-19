// tests/helpers/routing_oracle.mjs — the reference model of DOOR's routing rules (2026-10-18, audit A2).
// Written from docs/DOOR_ROUTING_RULES_2026-10-18.md (the rules table, with Jason's rulings of 2026-10-18), NOT from
// computeSections. It answers one resident on one meal: their plate, the notes their line must carry, and whether
// their room is contained. The gates run it beside the real engine and list every disagreement.
// Not a test file: `node --test tests/*.mjs` does not read tests/helpers/.

// §2 — sections in priority order. `opens` is the meal flag(s) that open a section; `seats` the tags that sit there,
// each with the flags that open the section FOR THAT TAG (No Eggs on egg, No Mustard on mustard: F3).
export const SECTIONS = [
  { key: 'vegan', always: true, seats: { 'Vegan': null, 'Vegetarian': null } },
  { key: 'halal', halal: true, seats: { 'Halal': null, 'No Pork': null } },
  { key: 'no_processed', seats: { 'No Processed Food': ['hasProcessedMeat'] } },
  { key: 'no_fish', into: 'vegan', seats: { 'No Fish': ['hasFish', 'hasShellfish'], 'No Shellfish': ['hasFish', 'hasShellfish'], 'No Molluscs': ['hasFish', 'hasShellfish'] } },
  { key: 'gf', seats: { 'GF': ['hasGluten'] } },
  { key: 'no_dairy', into: 'vegan', seats: { 'No Dairy': ['hasDairy'], 'Lactose Intolerant': ['hasDairy'] } },
  { key: 'no_beef', into: 'vegan', seats: { 'No Beef': ['hasBeef'] } },
  // The plating review (2026-10-19, Jason: "Copy the kitchen's"): a diabetic plate only on a meal with the kitchen's
  // diabetic alternative; a bland plate only on a spicy meal with the kitchen's bland one; no soft plate on a meal the
  // kitchen marks "no soft alternative needed". The meal carries them as _diabeticAlt, _blandAlt and _altMealsNone.
  { key: 'diabetic', seats: { 'Diabetic': ['_diabeticAlt'], 'Low Carb': ['_diabeticAlt'] } },
  { key: 'bland', both: ['isSpicy', '_blandAlt'], seats: { 'No Spicy': ['isSpicy'], 'Bland Diet': ['isSpicy'] } },
  { key: 'soft', always: true, unless: '_altMealsNone', seats: { 'Soft Meals': null } },
  { key: 'no_egg', seats: { 'No Eggs': ['hasEgg'], 'No Mustard': ['hasMustard'] } },
];

const MEAT = ['hasBeef', 'hasChicken', 'hasTurkey'];
// CONC buys halal: beef, chicken or turkey with no pork is certified unless the meal says it isn't.
export function certified(f) {
  if (f.halalCertifiedMeat !== undefined) return !!f.halalCertifiedMeat;
  return !f.hasPork && MEAT.some((k) => f[k]);
}
function halalOpen(f) { return !!f.hasPork || (MEAT.some((k) => f[k]) && !certified(f)); }
function seatsTag(sec, tag, f) {
  if (!(tag in sec.seats)) return false;
  if (sec.unless && f[sec.unless]) return false;
  if (sec.always) return true;
  // No Pork sits on the halal plate only on a pork meal (2026-10-19, the plating review).
  if (sec.halal) return halalOpen(f) && (tag !== 'No Pork' || !!f.hasPork);
  if (sec.both && !sec.both.every((k) => f[k])) return false;
  return sec.seats[tag].some((k) => f[k]);
}
function sectionOpen(key, f) {
  const sec = SECTIONS.find((s) => s.key === key);
  if (sec.unless && f[sec.unless]) return false;
  if (sec.always) return true;
  if (sec.halal) return halalOpen(f);
  if (sec.both && !sec.both.every((k) => f[k])) return false;
  return Object.values(sec.seats).some((flags) => flags.some((k) => f[k]));
}
const hasAlts = (f) => !!(f._altMeals && f._altMeals.length);

// §3 — the plate one resident eats on one meal (the anaphylactic check is separate: anaphContained).
export function plateFor(tags, f) {
  const sec = SECTIONS.find((s) => Object.keys(s.seats).some((t) => tags.includes(t) && seatsTag(s, t, f)));
  let key = sec ? sec.key : 'regular';
  // No Dairy keeps its own plate on a meal with the kitchen's dairy-free version (_noDairyAlt), 2026-10-19.
  if (sec && sec.into && !(sec.key === 'no_dairy' && f._noDairyAlt)) key = sec.into;
  if (f.hasPork) {
    if (key === 'no_processed') key = 'halal';
    if (key === 'soft' && !hasAlts(f)) key = 'halal';
    if (key === 'bland' && sectionOpen('gf', f)) key = 'gf';
  }
  if (key === 'halal' && f.noPorkAlt && tags.includes('No Pork') && !tags.includes('Halal')) key = '_nopork';
  if (key === 'no_egg' && f._vegAltSafe) key = 'vegan';
  return key;
}

// §4 — the line notes, and the flag that calls for each (CONFLICT_MAP's rows as the table rules them; F8 adds the five).
export const NOTES = [
  ['hasFish', 'No Fish', 'no fish'], ['hasFish', 'No Shellfish', 'no shellfish'], ['hasShellfish', 'No Shellfish', 'no shellfish'],
  ['hasShellfish', 'No Molluscs', 'no molluscs'], ['hasPeanuts', 'No Peanuts', 'NO PEANUTS'], ['hasSoy', 'No Soy', 'no soy'],
  ['hasTreeNuts', 'No Tree Nuts', 'no tree nuts'], ['hasCoconut', 'No Coconut', 'no coconut'], ['hasSesame', 'No Sesame', 'no sesame'],
  ['hasMustard', 'No Mustard', 'no mustard'], ['hasSulphites', 'No Sulphites', 'no sulphites'], ['hasBeans', 'No Beans', 'no beans'],
  ['hasMushroom', 'No Mushroom', 'no mushroom'], ['hasNightshades', 'No Nightshades', 'no tomato/potato/pepper'],
  ['hasBrassicas', 'No Brassicas', 'no broccoli/cauliflower/cabbage'], ['hasCorn', 'No Corn', 'no corn'], ['hasEgg', 'No Eggs', 'no egg'],
  ['hasGluten', 'GF', 'gluten-free'], ['hasDairy', 'No Dairy', 'dairy-free'], ['hasDairy', 'Lactose Intolerant', 'dairy-free'],
  // F8 (Jason, 2026-10-18: "Yes, both"): a restriction only the routing engine knew is named on the line too.
  ['isSpicy', 'No Spicy', 'not spicy'], ['isSpicy', 'Bland Diet', 'not spicy'], ['hasBeef', 'No Beef', 'no beef'],
  ['hasTurkey', 'No Turkey', 'no turkey'], ['hasProcessedMeat', 'No Processed Food', 'no processed meat'],
];

// The notes a resident seated in a non-Regular section must carry (R0). `plateFlags` are the allergens DOOR knows for
// the plate they eat (the vegan line), read with the main meal's (F9). "soft" when a Soft Meals resident eats another
// plate, except a pork-day Halal plate with no alternative meals, which the kitchen serves soft (F10).
export function requiredNotes(tags, f, plate, plateFlags = {}) {
  const on = (k) => !!(f[k] || plateFlags[k]);
  const out = new Set(NOTES.filter(([k, tag]) => tags.includes(tag) && on(k)).map(([, , note]) => note));
  if (tags.includes('Soft Meals') && plate !== 'soft' && !(plate === 'halal' && f.hasPork && !hasAlts(f)) && plate !== 'anaph') out.add('soft');
  if (tags.includes('Diabetic') || tags.includes('Low Carb')) out.add('extra veg less starch');
  return out;
}

// The notes a Regular-plate resident's line carries beside the conflict tags (2026-10-19, the plating review): "extra
// veg less starch" for Low Carb, and for a diabetic on a starchy meal (diabetics eat the regular plate where the kitchen
// makes no diabetic one); "soft" for a soft resident on a meal the kitchen marks "no soft alternative needed".
export function regularServiceNotes(tags, f) {
  const out = new Set();
  if (tags.includes('Low Carb') || (tags.includes('Diabetic') && f.isCarb)) out.add('extra veg less starch');
  if (tags.includes('Soft Meals') && f._altMealsNone) out.add('soft');
  return out;
}

// §5 — anaphylaxis. Who: the resident's flag or their room on the list. Which tags: anaphTags (keys) when set, else
// every tag. Which flags: per tag. Scope: this one meal (F1, Jason: "Per meal everywhere"). Roommates share a base room.
export const ANAPH_FLAGS = {
  'No Peanuts': ['hasPeanuts'], 'No Fish': ['hasFish'], 'No Shellfish': ['hasFish', 'hasShellfish'], 'No Molluscs': ['hasFish', 'hasShellfish'],
  'No Dairy': ['hasDairy'], 'GF': ['hasGluten'], 'No Tree Nuts': ['hasTreeNuts'], 'No Soy': ['hasSoy'], 'No Sesame': ['hasSesame'],
  'No Mustard': ['hasMustard'], 'No Sulphites': ['hasSulphites'], 'No Eggs': ['hasEgg'], 'No Coconut': ['hasCoconut'],
  'No Nightshades': ['hasNightshades'], 'No Beef': ['hasBeef'],
};
export const baseRoom = (room) => String(room).toLowerCase().replace(/[a-d]$/i, '');
export function isAnaph(r, rooms) { return !!r.isAnaph || (rooms || []).includes(r.room); }
export function anaphLabels(r, labelOfKey) {
  if (r.anaphTags && r.anaphTags.length) return r.anaphTags.map((k) => labelOfKey[k]).filter(Boolean);
  return [...(r.tags || [])];
}
export function anaphSetOff(r, f, labelOfKey) { return anaphLabels(r, labelOfKey).filter((t) => (ANAPH_FLAGS[t] || []).some((k) => f[k])); }
export function anaphContained(room, residents, rooms, f, labelOfKey) {
  return residents.some((a) => isAnaph(a, rooms) && baseRoom(a.room) === baseRoom(room) && anaphSetOff(a, f, labelOfKey).length > 0);
}
