# Receipt: the Tuesday vegan breakfast names oat milk (data, publication 43, 2026-11-20)

Jason, 2026-11-20: "yes, make the Tuesday vegan breakfast oat milk". Raised by the U3 S1 data (publication 41): 301a
("oat milk only") eats from the vegan section, and the vegan line on the four Tuesdays read "Cereal and milk, fruit", so
301a's row read "CHECK: the plate names milk, not oat milk".

Written the way Edit Menu's writer writes a permanent change, without its box rebuild: for each Tuesday breakfast,
the meal as it was (`doorMealCopy`), only `breakfast_veg` set in the overlay day, `doorNoteMealChange` keeping the
original, the change-log entry Edit Menu appends (↩ Undo Last), and `saveMenuBaseOverlay`; then one publish through DOOR's
publisher against EXPO's in-memory fake GitHub (W6 harness), with today's CODEX feed (`main`) and `library_public.json`
from Pages. Branched from `main` `82501c9` (publication 42).

**Why not Edit Menu's Save:** a first run through the meal view and Save (this PR's first commit) also re-split the four
meals' `_mainItem` and `_sides` ("Cereal and milk" + "fruit" became "Cereal and milk & fruit" + nothing), added dish
slots and wrote the empty kitchen-alternative fields, and Save asked the soft-plate question, whose only Save answer
marks the meal "no soft plate needed". The review session raised the same Save behaviour from #269 (it rebuilds words
nobody changed; fixed in its own session). The writer used here changes only the vegan line, so Save's questions never
come up.

## What changed
| Meal | Vegan line before | Vegan line after |
|---|---|---|
| Wk1–Wk4 TUE breakfast | Cereal and milk, fruit | Cereal and oat milk, fruit |

- **The regular line** stays "Cereal and milk, fruit" on all four (only the vegan line is written).
- **What the breakfast sheets print** (DOOR's plating engine, all four Tuesdays): the vegan plate reads "Cereal and oat
  milk, fruit"; its CONTAINS gains OATS (CODEX's Oat milk record, matched by name); 301a's note prints with no CHECK.
  Nothing else on any sheet moves. The vegan plate's CONTAINS still says DAIRY: DOOR copies the regular meal's ticks onto
  the vegan plate (#63's floor), an over-warning that predates this change.
- **Routing (`routing_by_meal.json`):** section counts unchanged. Each Tuesday's `_components` splits the cereal: 147
  "Cereal and milk" and 13 "Cereal and oat milk" (the vegan plate), where it read 160 "Cereal and milk". HUB reads these
  for portion links.
- **`menu_current.json`:** only the four Tuesday `breakfast_veg` values change. No tick, part, slot or other meal moves.
- **`menu_overlay.json`:** the four days' `breakfast_veg`, each with its kept original (`breakfast_original`, so Put
  back the original works).
- **Other files:** `change_log.json` (four entries added, none dropped; four older entries lose their before-copies under
  the newest-10 rule), `recent_log.json`, `door_state.json` and `registry_summary.json` (stamps only),
  `door_flow_publication.json` (sequence 42 → 43).

## The soft-plate state
Untouched: no soft plate set and none marked "not needed" on these mornings, so the sheet keeps asking for one as before
(gate TO-2).

## Checks
- New gate `tests/tue_vegan_oat_milk_gate.mjs` (5), red 4/5 on `main` `82501c9` (TO-2 locks the soft-plate state).
