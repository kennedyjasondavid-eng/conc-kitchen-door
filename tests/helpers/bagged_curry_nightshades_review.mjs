// 2026-10-22 safety-review extension. The original Corn manifest stays frozen.
// The preserved source card explicitly names jalapeno in Green Curry Paste.
export const BAGGED_CURRY = 'Thai Green Curry Sauce – Bagged (Fish & Tofu)';
export const BAGGED_NIGHTSHADES = 'Nightshades (Green Curry Paste — Jalapeño)';
export const CORN_MANIFEST_SHA256 = 'f2ab8da3487c739d6ea25ddfc06b55bf427cabac701f50901a475668ea7f190a';
export function withBaggedNightshadesReview(manifest) {
  const out = JSON.parse(JSON.stringify(manifest));
  out.shared.find(s => s.record.recipeName === BAGGED_CURRY).after.push(BAGGED_NIGHTSHADES);
  out.source.find(r => r.recipeName === BAGGED_CURRY).allergens.push(BAGGED_NIGHTSHADES);
  out.fallbackDeltas.find(d => d.recipeName === BAGGED_CURRY).after.allergens.push(BAGGED_NIGHTSHADES);
  return out;
}
