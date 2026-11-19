# DOOR U1 through the new editor — 2026-11-19 (publication 39)

D9 (Jason, 2026-11-19: "Follow lean on D9"): the back-on-track U1 menu fixes made through the Edit Menu meal view, as one
reviewed data publish. Walkthrough calls: Wk4 SUN lunch's vegan plate does not get the tzatziki ("Follow lean"); the
vegan links that name a shared pot stay until CODEX gives each pot its own vegan record ("Follow lean").

## How
- DOOR's own meal view and Save (`openMenuEdit`, the dish boxes, `saveMenuEdit`), Save's questions answered with their
  defaults, then one publish through DOOR's own publisher against an in-memory GitHub (EXPO's W6 harness, with today's
  CODEX feed from CODEX `main` and today's `library_public.json` from Pages, so no recipe fact moves).
- Splitting a box changes no dish, so the soft-plate question (asked when a dish changed) was not asked: answering it
  would have marked Wk1 FRI dinner "no soft plate needed", a routing change nobody ruled.

## What changed
| Meal | Before | After |
|---|---|---|
| Wk1 FRI dinner | main box "Pork Adobo & Garlic Green Bean"; vegan box "Vegetarian Adobo, Garlic Green Bean" | main "Pork Adobo", vegetable side "Garlic Green Bean", vegan main "Vegetarian Adobo" |
| Wk4 SUN lunch | main box "Pork Souvlaki & Steamed Carrots & Tzatziki"; vegan line "Black bean patty, Naan, Steamed Carrots, Tzatziki" | main "Pork Souvlaki", vegetable side "Steamed Carrots", also served "Tzatziki" (Dairy, Sulphites; the vegan plate does not get it); vegan line "Black bean patty, Naan, Steamed Carrots" |
| Wk4 MON lunch | main box "Chicken Ranch Salad Sandwich & Fruit and Chips"; vegan "Falafel  Sandwich, Fruit and Chips, Sub Bun" | main "Chicken Ranch Salad Sandwich", also served "Fruit and Chips", vegan main "Falafel Sandwich", only on the vegan plate "Sub Bun" |
| Wk4 SAT lunch | vegan box "Roasted Veg and Tofu Medley, Tumeric Quinoa"; diabetic plate "…, Tumeric Quinoa, Broccoli" | vegan main "Roasted Veg and Tofu Medley", only on the vegan plate "Turmeric Quinoa" (now last on the vegan line); diabetic plate "…, Turmeric Quinoa, Broccoli" |

- **Regular menu words:** unchanged on all four meals (what EXPO, HUB and the sheets read).
- **Routing (`routing_by_meal.json`):** section counts unchanged; dish counts: Tzatziki 160 → 150 on Wk4 SUN lunch (the
  vegan plate no longer gets it); "Falafel  Sandwich" → "Falafel Sandwich", "Tumeric Quinoa" → "Turmeric Quinoa".
- **Recipe facts in the publication:** unchanged (same recipe component hash).
- **Other files:** `door_state.json` (last modified by), `change_log.json`, `recent_log.json`, `menu_overlay.json` (each
  meal's original kept; empty kitchen-alternative boxes written as "" as the editor does), `door_flow_publication.json`
  (sequence 38 → 39).
- New typed boxes (Garlic Green Bean, Steamed Carrots, Fruit and Chips, Sub Bun, Turmeric Quinoa) carry no allergen
  answer yet: the meal's ticks still cover them (they were part of the main box), and Menu Config lists them under
  "Typed dishes with allergens not answered yet".

## Open (CODEX)
Four vegan dishes link to a shared pot recipe whose name says pork or lists several versions (Wk1 FRI dinner's "Adobo
Pork/Chicken/Tofu (Adobo Marinade & Sauce)", and the Vegan Alt links on Wk2 SUN, MON and FRI dinner). Their allergens
are right. CODEX gives each pot its own vegan record (a CODEX data edition); DOOR relinks them then.
