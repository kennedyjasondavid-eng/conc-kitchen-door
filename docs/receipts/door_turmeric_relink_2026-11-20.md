# Receipt: the quinoa link reads Turmeric (publication 45, 2026-11-20)

CODEX renamed "Tumeric Quinoa" to "Turmeric Quinoa", in its feed (#394) and in the shared Library (shared-library
9ac5a8d). The id `tumeric-quinoa` did not change. DOOR's Wk4 SAT lunch vegan quinoa slot still stored the old recipe name.

- **How:** the slot's recipeName was set from DOOR's recipe list (`doorLinkFlags` for its flags, which stay empty, "None")
  and written through `saveMenuBaseOverlay` (the day stamped). Then one publish went through DOOR's own publisher against
  EXPO's in-memory fake GitHub (W6 harness), with CODEX's Pages feed and Library as served at 13:2xZ.
- **What changed:** `menu_current.json` and `menu_overlay.json` change one field each,
  `menu.4.SATURDAY.lunch_slots.vegextras.recipeName`, from "Tumeric Quinoa" to "Turmeric Quinoa". The menu words
  (`displayText` "Turmeric Quinoa"), the id, the ticks, every plate's allergens and the routing counts are unchanged.
  `door_state.json` and `registry_summary.json` change only their stamps. `door_flow_publication.json` sequence goes
  from 44 to 45.
- **Not in this edition:** the Wk2 SUN dinner Corn and Sulphites ticks. They wait for CODEX to record the pork and halal
  turkey sausage labels in the pot record.
- **Checks:** `u1_side_answers_gate` U1A-4 now also checks the recipeName (dated). Node suite 1146 pass, 1 skipped.
