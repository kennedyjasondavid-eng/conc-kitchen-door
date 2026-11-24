# Receipt: Wk1 THU lunch's halal plate names its dish (publication 58, 2026-11-24)

Jason, 2026-11-24, on EXPO's dish-parts plan (`conc-kitchen-expo` `EXPO_DISH_PARTS_ACTION_PLAN_2026-11-24.md`):
- R10: the regular dog follows DOOR's ticks as they stand now (Pork + Beef, not halal-certified).
- C3: "C3 follow lean, you make the DOOR change". The halal plate's dish is "Halal Beef Hot Dog", as June's halal line for
  this lunch ("Halal Beef Sausages"). Until now DOOR plated 57 halal residents a made-up "Halal Chili Cheese Hot Dog"
  (its fallback when no halal dish is named).

**How:** the W6 method (EXPO's walkthrough, "DOOR's builders"). DOOR's own `index.html` in headless Chromium, seeded as a
computer that took publication 57 (2026-11-24 16:10), auto-send off. Edit Menu: Wk1 THU lunch, the halal plate's main box
(`mainalt`) typed "Halal Beef Hot Dog" (Enter), ticked Beef and Processed Meat, Save (no question asked). Then one
`publishToGitHub(true)` through DOOR's publisher against DOOR's own test transport (`tests/helpers/door_publish_recovery_box.mjs`
`RecoveryRemote`). The files DOOR committed are this change; nothing is hand-edited.

**What moved:**
- `menu_current.json` / `menu_overlay.json` Wk1 THU: `lunch_halal` and `lunch_mainAlt` "Halal Beef Hot Dog"; new
  `lunch_slots.mainalt` (Beef, Processed Meat, answered). Save also copied the meal's ticks onto the main box (Gluten,
  Pork, Beef), as Edit Menu does on every save; the meal's own ticks are unchanged.
- `routing_by_meal.json`: the halal component reads "Halal Beef Hot Dog" 57 (was "Halal Chili Cheese Hot Dog" 57).
- Stamps: publication 57 → 58 on every stamped file; `change_log.json` and `recent_log.json` gain one entry each
  (`change_log.json`'s 11th entry drops its kept copy, the newest-10 rule).

**Not moved:** every count (Regular 93, Halal 57, Vegan 13, Gluten Free 3, Soft 2), the meal words, the vegan line, the
meal's ticks (Pork + Beef, not halal-certified), every other meal.

**Check:** `tests/wk1_thu_halal_dog_gate.mjs` (3), red 2/3 on `main` `aa93931` (HD2 locks what must not move). Node suite
1218 pass, 1 skipped; browser `typed_dish_s3`, `anaph_recipe_binding`, `library_recipe_lookup_boundary`,
`plain_plate_options`, `plate_summary_s2b`, `menu_words_kept_s4a`, `line_words_kept`, `other_plates_s8` pass.

**After merge:** EXPO picks it up at its next DOOR review (Menu & Board → Review DOOR menu → Apply).
