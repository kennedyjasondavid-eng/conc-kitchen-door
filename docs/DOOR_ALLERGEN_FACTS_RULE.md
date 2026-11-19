# DOOR allergen facts: the rule DOOR follows

Written 2026-11-19 for the back-on-track plan's U2 (`docs/DOOR_BACK_ON_TRACK_PLAN_2026-11-18.md`). This page describes what DOOR already does. It adds no new rule and no new precedence. The code is the owner; each line names where.

## Where an allergen fact comes from
- **CODEX owns recipe allergens.** DOOR reads `DOOR_RECIPE_DATA.json` from CODEX, then lays the shared Library over it (`doorOverlaySharedRecipes`). Fix a recipe's allergens in CODEX, never in DOOR.
- **A meal's ticks decide its regular plate.** Plating, routing and the published allergen line read each meal's own ticks (`<period>_flags`). The main slot carries the whole meal's ticks (bread, sides, breading), so it can list more than its recipe.
- **The vegan plate reads its recipes from CODEX's current list.** The plate is built from each linked slot's recipe plus its saved ticks (`getVegAltSlotAllergenStr`), and from the vegan line by name (`getVegAltAllergenStr`). The main meal's ticks act as a floor (`mergeVegAltAllergenFloor`).

## The four rules
1. **Warnings are only ever added by reading.** Nothing DOOR reads (a recipe, a linked slot, a dish name, a workbook row, an added word) takes a warning off.
2. **A removal needs its confirmation.** A recipe's allergen comes off only when someone confirmed it in CODEX (Option C: `removedAllergens` / `allergenRemovalsConfirmed`). In DOOR, a removal is a person unticking it in Edit Menu, or answering Save's "take off the old dish's warnings" question.
3. **An unticked Spicy stays off.** Whether a dish is served spicy is the kitchen's call. CODEX's Spicy label does not tick a meal by itself (Wk3 WED lunch's beef nachos, 2026-11-19).
4. **A linked dish keeps the ticks it captured until it is linked again.** A slot's saved ticks are a snapshot from when it was linked. When CODEX later names more, the vegan plate already reads CODEX. A refresh adds the new ticks to the snapshot, and never removes any.

## A label not checked
A bought item whose package has not been read has `allergens: null`. That means unknown, never safe (`doorRecipeLabelUnchecked`). Every plate holding it says "check label" for residents with an allergen restriction (C2, call 3). CODEX's package panel is where a supervisor fills it in (CODEX #385).

## The 2026-11-19 sitting (C4)
All 42 linked slots whose saved ticks differ from CODEX's current list were compared (Jason: "Follow lean").
- **None left a resident unwarned.**
- **Refreshed (add only), publication 36:** 23 slots on 21 recipes took CODEX's newer families: mostly Beans and Mushroom, plus Corn and Sulphites, and Gluten on the vegan nacho mix. Excluded:
  - Spicy, by rule 3;
  - Butter Chickpeas' Milk, which waits on its CODEX "It's gone".

  Plates, meal ticks and routing counts didn't move online. A computer without internet now shows the same families from the saved ticks.
- **Kept, by design:** 16 regular main slots that carry the whole meal's ticks, and 9 vegan slots with a tick for the dish as served (bread, gravy).
