# Receipt: the Tuesday vegan breakfast names oat milk (data, publication 43, 2026-11-20)

Jason, 2026-11-20: "yes, make the Tuesday vegan breakfast oat milk". Raised by the U3 S1 data (publication 41): 301a
("oat milk only") eats from the vegan section, and the vegan line on the four Tuesdays read "Cereal and milk, fruit", so
301a's row read "CHECK: the plate names milk, not oat milk".

Made through DOOR's own meal view and Save (`openMenuEdit`, the vegan main box, `slotAutoSave`, `saveMenuEdit`) on each
Tuesday breakfast, then one publish through DOOR's publisher against EXPO's in-memory fake GitHub (W6 harness), with
today's CODEX feed (`main`) and `library_public.json` from Pages. Branched from `main` `82501c9` (publication 42).

## What changed
| Meal | Vegan line before | Vegan line after |
|---|---|---|
| Wk1–Wk4 TUE breakfast | Cereal and milk, fruit | Cereal and oat milk, fruit |

- **The regular line** stays "Cereal and milk, fruit" on all four (D4 keeps the words the meal opened with).
- **What the breakfast sheets print** (DOOR's plating engine, all four Tuesdays): the vegan plate reads "Cereal and oat
  milk, fruit"; its CONTAINS gains OATS (CODEX's Oat milk record, matched by name); 301a's note prints with no CHECK.
  Nothing else on any sheet moves. The vegan plate's CONTAINS still says DAIRY: DOOR copies the regular meal's ticks onto
  the vegan plate (#63's floor), an over-warning that predates this change.
- **Routing (`routing_by_meal.json`):** section counts unchanged. Each Tuesday's `_components` splits the cereal: 147
  "Cereal and milk" and 13 "Cereal and oat milk" (the vegan plate), where it read 160 "Cereal and milk". HUB reads these
  for portion links.
- **`menu_current.json`:** the four Tuesday breakfasts only. The editor writes each meal's parts from its boxes, as any
  Edit Menu save does: `breakfast_slots` (none before), `breakfast_mainItem` "Cereal and milk & fruit" with
  `breakfast_sides` emptied, and the kitchen-alternative fields written empty (`''`, `[]`, `false`, meaning none, as
  before). The plating sheet prints the regular line as before ("Cereal and milk, fruit"). No allergen tick changes.
- **`menu_overlay.json`:** the four days, each with its kept original (`breakfast_original`, so Put back the original
  works) and Wk1's allergen line ("gluten, dairy", written from the unchanged ticks).
- **Other files:** `change_log.json` (four entries added, none dropped; four older entries lose their before-copies under
  the newest-10 rule), `recent_log.json`, `door_state.json` and `registry_summary.json` (stamps only),
  `door_flow_publication.json` (sequence 42 → 43).

## The soft-plate question, held off
Save asks "No soft or plain alternative?" when a soft resident is on the list and a dish changed. Its only Save answer
marks the meal "no soft plate needed", which would change where the four soft residents eat on these mornings, and
nobody ruled that. The harness switched off `doorSoftQuestionNeeded` for these four saves only, so the soft-plate state
stays exactly as it was: no soft plate set and none marked "not needed", so the sheet keeps asking for one as before
(gate TO-2). No other question was asked.

## Checks
- New gate `tests/tue_vegan_oat_milk_gate.mjs` (5), red 4/5 on `main` `82501c9` (TO-2 locks the soft-plate state).
