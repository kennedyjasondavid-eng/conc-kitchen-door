// 2026-10-30, CODEX v34 (Jason: "I don't think there's any soy in the vegan meat"; the vegan cheddar, mozzarella and
// gravy mix "All contain soy"). The house Vegan Meat Replacement holds no soy, so "Soy (Vegan Meat)" comes off the six
// CODEX dishes whose only source it was, and the three with a bought soy item name that item instead. The five linked
// vegan-alt slots that captured Soy at link time take CODEX's families (Soy off four; Corn, and on the nachos Gluten,
// Sulphites and Spicy, added). The Corn manifest stays frozen; these functions apply or put back only this change.
export const SOY_REMOVED = ['Vegan CONC Salad Mix', 'Vegan Kebabs', 'Vegan Meatballs', 'Vegan Meatloaf', 'Vegan Nacho Mix', 'Vegan Sloppy Joe Mix'];
export const SOY_RELABELLED = { 'Vegan Baked Pasta': 'Soy (Vegan Shredded Cheddar Cheese)', 'Vegan Lasagna Sauce': 'Soy (Vegan Mozzarella Shreds)', 'Vegan Stew': 'Soy (Vegan Gravy Mix)' };
const OLD = 'Soy (Vegan Meat)';
export function soyList(name, list) {
  if (!Array.isArray(list)) return list;
  if (SOY_REMOVED.includes(name)) return list.filter((a) => a !== OLD);
  if (SOY_RELABELLED[name]) return list.map((a) => (a === OLD ? SOY_RELABELLED[name] : a));
  return list;
}
// The flags each slot gained (+) or lost (-), menu_current and menu_overlay alike.
export const SLOT_FLAG_CHANGES = [
  ['2', 'FRIDAY', 'lunch', 'Vegan CONC Salad Mix', { hasSoy: -1, hasCorn: 1 }],
  ['2', 'SATURDAY', 'dinner', 'Vegan Meatloaf', { hasSoy: -1, hasCorn: 1 }],
  ['3', 'SUNDAY', 'dinner', 'Vegan Meatballs', { hasSoy: -1, hasCorn: 1 }],
  ['3', 'WEDNESDAY', 'lunch', 'Vegan Nacho Mix', { hasSoy: -1, hasCorn: 1, hasGluten: 1, hasSulphites: 1, isSpicy: 1 }],
  ['4', 'FRIDAY', 'lunch', 'Vegan Lasagna Sauce', { hasCorn: 1 }],
];
export function withVeganMeatSoy(manifest) {
  const out = JSON.parse(JSON.stringify(manifest));
  for (const r of out.source) r.allergens = soyList(r.recipeName, r.allergens);
  for (const d of out.fallbackDeltas) if (d.after) d.after.allergens = soyList(d.recipeName, d.after.allergens);
  return out;
}
export function putBackVeganMeatSoySlots(weeks) {
  const out = JSON.parse(JSON.stringify(weeks));
  for (const [wk, day, period, , ch] of SLOT_FLAG_CHANGES) {
    const f = out[wk]?.[day]?.[period + '_slots']?.veganalt?.flags; if (!f) continue;
    for (const [k, v] of Object.entries(ch)) f[k] = v < 0;
  }
  return out;
}
