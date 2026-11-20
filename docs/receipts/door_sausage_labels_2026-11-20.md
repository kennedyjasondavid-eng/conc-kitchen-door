# Receipt: Wk2 SUN dinner carries the meat sausage labels (publication 46, 2026-11-20)

Jason read the two meat sausage labels for the Sausage and Greens Pasta Sauce pot on 2026-11-20:
- **Pork sausage (Sysco):** corn syrup solids, lemon juice solids.
- **Halal sausage (Costco, Solmaz):** turkey, with modified corn starch and corn syrup solids.

CODEX #396 (edition 2026-11-20-sausage-labels-b) recorded both on the pot record: Corn, and Sulphites now naming the
pork sausage's lemon juice solids. It also renamed the pot "Sausage and Greens Pasta Sauce (Pork, Halal Turkey + Vegan)".
DOOR checks residents against each meal's own ticks, so Wk2 SUN dinner needed both. **Beans** comes with them (review
fold, C4 "saved ticks follow CODEX"): CODEX lists Beans on the pot for the bean puree in the greens base all three
versions share, and one No Beans resident eats the halal turkey version with no note before this.

- **How:** Corn and Sulphites were set on the meal's ticks with `doorSetMealFlags`, which also writes the allergen line,
  and on its main dish slot. The meal carries its ticks there, so a fresh tablet's sweep keeps them. The change was
  written to the overlay with the meal's original kept (`doorNoteMealChange`) through `saveMenuBaseOverlay`, then
  published once through DOOR's own publisher against EXPO's in-memory fake GitHub (W6 harness). CODEX's Pages feed and
  Library were read just before the publish.
- **What changed:** in `menu_current.json`, `menu.2.SUNDAY.dinner_flags` gained `hasCorn`, `hasSulphites` and `hasBeans`,
  `dinner_slots.main.flags` gained the same three, and `allergens_dinner` now reads "gluten, sulphites, pork". The export
  leaves Corn and Beans out of the allergen line, as it does on every meal. In `menu_overlay.json` the day takes
  the same flags and keeps `dinner_original`. Meal text, vegan line, sides and every other meal are unchanged.
- **Plates:**
  - **Regular:** "SULPHITES, WHEAT, PORK, BEANS, CORN, PROCESSED MEAT".
  - **Vegan:** also gains CORN, through the copied floor (#63). The vegan sauce record has no corn, so on that plate it
    only over-warns.
  - **Routing counts:** unchanged. No resident moves plate. The one No Corn resident (filed as "doc", in their
    accommodations) and the No Beans resident on the halal plate now get a note on this dinner; no resident is No
    Sulphites. `routing_by_meal.json`'s `flow.recipes` pot record also takes CODEX's new name and Corn. `door_state.json` and `registry_summary.json` change only their stamps;
    `door_flow_publication.json` sequence goes from 45 to 46.
- **Turkey:** not ticked. CODEX records no Turkey family on the pot, and Jason ruled No Turkey a preference (2026-11-20).
- **Code in the same PR (`v31-standard.128`):** before staging `recent_log.json`, a full publish now merges in the
  kitchen copy read at its revision (`doorPublishReadRecentLog`, `doorMergeRecentLogs`), keeping what it read for the
  unchanged check (no second read). A copy that can't be read sends no recent log at all.
- **Independent review: SHIP.** Folded: the Beans tick (P2-1), the single read (P3-2), this receipt (P3-5). Raised with
  Jason: the No Turkey resident on the halal plate gets no note (P2-2). Noted, not changed: a skipped log only warns on
  the console (P3-1); the two sync merges still have their own copy of the merge (P3-3).
- **Checks:**
  - `tests/sausage_labels_ticks_gate.mjs` (3), red 2/3 on `main`.
  - `tests/recent_log_publish_merge_gate.mjs` (4), red 4/4 on `main` `548e402`.
  - Re-pinned with dated notes: the publish harnesses (`door-smoke`, `door_publish_transaction_box`) load the new
    functions.
  - Node suite: see the PR.
