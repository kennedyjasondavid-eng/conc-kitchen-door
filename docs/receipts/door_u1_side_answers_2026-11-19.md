# Receipt: the U1 side boxes answered (publication 40, 2026-11-19)

Jason, 2026-11-19: "Follow leans, you make them; buns have no soy or sesame". U1 (publication 39,
`door_u1_split_boxes_2026-11-19.md`) split four combined boxes and left five typed side boxes with no allergen answer
(their meals' ticks still covered them). Made through DOOR's own meal view and Save (`slotSelect`,
`slotDeclareNothing`, the allergen pills, `saveMenuEdit`), then one publish through DOOR's publisher against EXPO's
in-memory fake GitHub (W6 harness), with today's CODEX feed (`main`) and `library_public.json` from Pages.

## What changed
| Meal | Box | Answer |
|---|---|---|
| Wk1 FRI dinner | Garlic Green Bean (vegetable side) | linked to the Library's Garlic Green Beans (Beans); the meal gains **Beans** |
| Wk4 SUN lunch | Steamed Carrots (vegetable side) | Nothing to declare |
| Wk4 MON lunch | Fruit and Chips (also served) | Nothing to declare (CODEX's Cut Fruit and Chips list none) |
| Wk4 MON lunch | Sub Bun (vegan plate only) | Gluten (a bought bun; Jason: no soy or sesame) |
| Wk4 SAT lunch | Turmeric Quinoa (vegan plate only) | linked to CODEX's "Tumeric Quinoa" (none); the menu still reads "Turmeric Quinoa" |

- **Menu words:** unchanged on every meal (each linked box keeps its words as what the menu shows).
- **Beans on Wk1 FRI dinner:** the one real gap. A No Beans resident on another plate (today one on the halal plate;
  offline, one on the vegan plate, which also gains BEANS) now gets a "no beans" note on this dinner. A No Beans
  resident on the regular plate gets "No Beans" in the regular plate's notes (corrected 2026-11-19: the regular-plate
  check reads each resident's accommodations, and both No Beans residents carry it there). No resident moves plate on any of the 84 meals.
- **Routing (`routing_by_meal.json`):** section and dish counts unchanged; only its stamps move.
- **Save asked nothing** on any of the four meals. The soft-plate question was held off, as in U1: no dish changed.
- **Other files:** `door_state.json`, `registry_summary.json` (stamps), `change_log.json`, `recent_log.json`,
  `menu_overlay.json` (each meal's original kept), `door_flow_publication.json` (sequence 39 → 40).
- Menu Config's "Typed dishes with allergens not answered yet" no longer lists any of the five (46 meals still list
  older typed dishes, unchanged).

## Checks
- Independent review: SHIP (no P1/P2). Folded: the Turmeric check scans the whole menu again (P3-1); the Beans
  wording above (P3-2). Noted: Garlic Green Beans is in the shared Library only, not CODEX's feed (offline the box keeps
  its Beans tick); the overlay's allergen line leaves out beans, as it does coconut and corn (the export rebuilds it).
- Node suite 1089 pass, 1 skipped. New gate `tests/u1_side_answers_gate.mjs` (4), red 4/4 on `main` `5004feb`.
  Re-pinned with a dated note: `u1_split_boxes_gate` U1-3 (the linked recipe's record name is still "Tumeric" until
  CODEX renames it; the menu's words are what must be spelled right).
- `scripts/check_published_flow.mjs` passes.

## After merge
- **EXPO:** republish once (Menu & Board → Review DOOR menu → Apply) so the board carries the new Beans tick; no
  dish or card changes are expected.
- **CODEX rename:** once CODEX renames Tumeric Quinoa (queued, with an alias for the old name), relink Wk4 SAT lunch's
  quinoa box to the new record.
