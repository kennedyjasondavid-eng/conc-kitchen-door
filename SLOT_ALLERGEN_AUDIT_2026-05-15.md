# Per-Slot Allergen Audit — 2026-05-15

Walks every meal slot in `menu_current.json`, identifies **unlinked slots** (`recipeName: ''`, free-text only), and surfaces where linking to a CODEX recipe (or recognizing a common allergen-bearing side) would add an allergen flag the meal currently lacks.

**Scope:** 122 slots across 4 weeks × 7 days × 3 meals. 9 currently linked to CODEX. **20 unlinked slots have suggested allergen additions.**

These are **suggestions**, not auto-fixes. The DOOR workflow is "manual inputs with CODEX suggestions" — staff reviews each in Menu Config, picks the CODEX link if appropriate (auto-fills flags) or manually toggles the flag and stays free-text.

---

## Tier 1 — Strong CODEX matches (10)

Manual text in the slot has an exact or word-boundary match against a CODEX recipe. CODEX has allergens the meal currently doesn't flag.

| Week | Day | Meal | Slot | Slot text | Suggested CODEX link | Adds flags |
|---|---|---|---|---|---|---|
| W1 | Mon | dinner | main | Jerk Chicken | **Jerk Chicken Legs** | gluten, soy, sulphites |
| W1 | Mon | dinner | veganalt | Jerk Cauliflower | **Jerk Cauliflower Steaks** | sulphites |
| W1 | Tue | dinner | main | Pork Carnitas | **Pork Carnitas** | sulphites |
| W1 | Thu | dinner | starch | Couscous | **Herbed Couscous** | gluten |
| W2 | Fri | dinner | main | Arroz Con Pollo | **Arroz Con Pollo (Regular + Vegan)** | soy |
| W3 | Sun | dinner | main | Halal Beef Meatballs | **Meatballs** ¹ | egg, sulphites |
| W3 | Sun | dinner | veganalt | Vegan Meatballs Pasta | **Vegan Meatballs** | soy, sulphites |
| W3 | Mon | dinner | starch | Moroccan Rice | **Moroccan Rice** | sulphites |
| W3 | Wed | dinner | veganalt | Baked Tomato Tofu | **Baked Tomato Tofu** | soy, sulphites |
| W3 | Fri | dinner | main | Chicken and Mushroom Fried Rice | **Chicken and Mushroom Fried Rice (+ vegan)** | gluten |

¹ Per Jason: halal beef meatballs are made in-house and need a dedicated CODEX recipe for the meatball mix (separate from the existing generic "Meatballs"). Until then, linking to "Meatballs" gets close on egg+sulphites but may be inaccurate on other tags.

---

## Tier 2 — Fuzzy CODEX matches (3)

3+ significant word overlap, but not a substring. Review whether the link is right.

| Week | Day | Meal | Slot | Slot text | Suggested CODEX link | Adds flags |
|---|---|---|---|---|---|---|
| W2 | Fri | dinner | veganalt | Vegan Arroz con Pollo | Arroz Con Pollo (Regular + Vegan) | soy |
| W3 | Fri | dinner | veganalt | Soy-Free Mushroom Fried Rice | Chicken and Mushroom Fried Rice (+ vegan) | gluten ² |
| W4 | Sat | dinner | main | Beef Massaman Curry | Massaman Beef Curry with Baby Corn and Vegetables | gluten, soy |

² "Soy-Free Mushroom Fried Rice" suggests by name that the soy has been removed — but if it still uses regular soy sauce or fried rice base, gluten may still apply. Worth reviewing whether this is a distinct recipe (no soy/gluten) or just a label variant.

---

## Tier 3 — Heuristic matches (7)

No CODEX recipe matches but the slot text contains a common allergen-bearing ingredient. These are the cases that disproportionately slip through (sides typed as free text).

| Week | Day | Meal | Slot | Slot text | Keyword hit | Adds flags | Notes |
|---|---|---|---|---|---|---|---|
| W1 | Wed | dinner | starch | Naan | naan | gluten | Plain naan = wheat flour |
| W1 | Thu | dinner | veganalt | Roast Tofu | tofu | soy | |
| W3 | Thu | dinner | veganalt | Citrus Tofu | tofu | soy | |
| W4 | Mon | dinner | veganalt | Tofu Curry | tofu | soy | |
| W4 | Fri | dinner | veganalt | Tandoori Tofu, Vegetable Briyani | tofu | soy | |
| W2 | Tue | lunch | veganalt | Quinoa Cake Wrap, Hot Dog Bun | wrap, cake, bun | dairy, egg | ³ |
| W4 | Tue | lunch | veganalt | Quinoa Cake Wrap, Hot Dog Bun | wrap, cake, bun | dairy, egg | ³ |

³ My heuristic flags "cake" → eggs+dairy because that holds for desserts. **Quinoa Cake is a fried patty, not a baked cake.** Confirm whether the wrap/bun bring egg or dairy — likely yes for the bun (commercial buns often have egg wash, sometimes milk powder), but not certain. Worth checking the Quinoa Burger / Quinoa Cake CODEX entry once it exists.

---

## Side-finding — embedded `DOOR_RECIPE_DATA_FALLBACK` is stale relative to MISE

Discovered while debugging: the embedded fallback in `index.html` line 686 has Butter Chicken tagged with `"Milk (Coconut Milk)"` (would set `hasDairy=true`). The live `DOOR_RECIPE_DATA.json` fetched from MISE no longer has that tag — only `"Tree Nuts (Coconut, Coconut Milk)"` (correct per Health Canada).

So:
- **Online DOOR boot** — auto-fill is correct (no false dairy flag on coconut-milk dishes).
- **Offline DOOR boot** — uses the embedded fallback → would auto-fill `hasDairy=true` on Butter Chicken, Butter Chickpeas, Adobo, Caribbean Stew, African Peanut Stew, Massaman, Thai Green Curry Sauce, Vegan Thai Green Paste — any coconut-milk recipe.

**Fix:** regenerate the embedded fallback by copying the current live `DOOR_RECIPE_DATA.json` into the `DOOR_RECIPE_DATA_FALLBACK = [...]` literal in `index.html`. That's task F on the audit list — needs to happen anyway.

---

## What I did NOT modify

Per the design principle (manual is primary, CODEX is advisory), I did not write any of these suggestions into `menu_current.json`. The audit is a checklist for Jason to walk in Menu Config UI.

## What's next (the UX layer)

Once these are reviewed, the structural changes that prevent this recurring:

1. **CODEX typeahead in Menu Config.** When staff types into a slot, show top 3 fuzzy matches with allergens preview — one click links it. Staff stays in control; suggestion is one keystroke away.
2. **Unlinked-slot indicator.** Tiny "(unlinked)" tag on every slot without a CODEX recipe, visible at a glance so staff knows which slots are unmonitored.
3. **Auto-gen `allergens_X` text from flags on save.** Kills the parallel-input drift problem (the 19 safety-issue cases I found earlier).
4. **Regen `DOOR_RECIPE_DATA_FALLBACK`** so offline boot uses fresh allergen data.

Each is a self-contained patch; I can implement them in order once you've walked Tier 1.
