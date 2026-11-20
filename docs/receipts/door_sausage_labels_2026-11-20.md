# Receipt: Wk2 SUN dinner carries the meat sausage labels (publication 46, 2026-11-20)

Jason read the two meat sausage labels for the Sausage and Greens Pasta Sauce pot on 2026-11-20:
- **Pork sausage (Sysco):** corn syrup solids, lemon juice solids.
- **Halal sausage (Costco, Solmaz):** turkey, with modified corn starch and corn syrup solids.

CODEX #396 (edition 2026-11-20-sausage-labels-b) recorded both on the pot record: Corn, and Sulphites now naming the
pork sausage's lemon juice solids. It also renamed the pot "Sausage and Greens Pasta Sauce (Pork, Halal Turkey + Vegan)".
DOOR checks residents against each meal's own ticks, so Wk2 SUN dinner needed both.

- **How:** Corn and Sulphites were set on the meal's ticks with `doorSetMealFlags`, which also writes the allergen line,
  and on its main dish slot. The meal carries its ticks there, so a fresh tablet's sweep keeps them. The change was
  written to the overlay with the meal's original kept (`doorNoteMealChange`) through `saveMenuBaseOverlay`, then
  published once through DOOR's own publisher against EXPO's in-memory fake GitHub (W6 harness). CODEX's Pages feed and
  Library were read at 13:2xZ.
- **What changed:** in `menu_current.json`, `menu.2.SUNDAY.dinner_flags` gained `hasCorn` and `hasSulphites`,
  `dinner_slots.main.flags` gained the same two, and `allergens_dinner` now reads "gluten, sulphites, pork". The export
  leaves Corn out of the allergen line, as it already does for corn and coconut. In `menu_overlay.json` the day takes
  the same flags and keeps `dinner_original`. Meal text, vegan line, sides and every other meal are unchanged.
- **Plates:**
  - **Regular:** "SULPHITES, WHEAT, PORK, CORN, PROCESSED MEAT".
  - **Vegan:** also gains CORN, through the copied floor (#63). The vegan sauce record has no corn, so on that plate it
    only over-warns.
  - **Routing counts:** unchanged. No resident moves plate: the one No Corn resident's No Corn is a preference, and no
    resident is No Sulphites. `door_state.json` and `registry_summary.json` change only their stamps;
    `door_flow_publication.json` sequence goes from 45 to 46.
- **Turkey:** not ticked. CODEX records no Turkey family on the pot, and Jason ruled No Turkey a preference (2026-11-20).
- **Code in the same PR (`v31-standard.128`):** before staging `recent_log.json`, a full publish now merges in the
  kitchen copy read at its revision (`doorPublishReadRecentLog`, `doorMergeRecentLogs`). A copy that can't be read
  sends no recent log at all.
- **Checks:**
  - `tests/sausage_labels_ticks_gate.mjs` (3), red 2/3 on `main`.
  - `tests/recent_log_publish_merge_gate.mjs` (4), red 4/4 on `main` `548e402`.
  - Re-pinned with dated notes: the publish harnesses (`door-smoke`, `door_publish_transaction_box`) load the new
    functions.
  - Node suite 1151 pass, 1 skipped.
