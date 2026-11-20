# Receipt: four vegan dishes link their own CODEX records (publication 42, 2026-11-20)

Jason, 2026-11-19, on the U1 walkthrough call ("Follow lean"): DOOR's vegan dishes that link a shared pot recipe (a
name that says pork, or one that lists several versions) keep that link until CODEX gives each pot its own vegan
record. CODEX #392 (edition `2026-11-20-vegan-pots`) and #394 (`2026-11-20-sausage-quantities`) added those records,
and both are live on CODEX Pages. This edition relinks the four dishes.

## How
- One publish through DOOR's own publisher against EXPO's in-memory fake GitHub (the W6 harness), with
  `DOOR_RECIPE_DATA.json` and `library_public.json` as served by CODEX Pages at 03:27Z.
- **Not through Edit Menu's Save.** A first run through the meal view showed Save also rebuilding text nobody chose:
  Wk2 SUN dinner's vegan line lost ", Pasta" ("Vegan Sausage and Vegetable Pasta, Pasta" → "… Pasta"), and Wk2 MON
  dinner's sides and vegan line were reordered ("Green Beans, Rice" → "Rice, Green Beans"). So each link was written to
  the stored meal's `veganalt` slot through DOOR's own overlay writer (`saveMenuBaseOverlay`, the four days stamped), with
  the flags DOOR's own link rule gives (`doorLinkFlags`). The editor finding is raised separately.

## What changed
| Meal | Vegan dish (menu words, unchanged) | Linked before (the pot) | Linked now | Slot allergens |
|---|---|---|---|---|
| Wk1 FRI dinner | Vegetarian Adobo | Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce) | Tofu Adobo (Adobo Marinade & Sauce) | same |
| Wk2 SUN dinner | Vegan Sausage and Vegetable Pasta | Sausage and Greens Pasta Sauce (Pork, Halal Chicken + Vegan) | Vegan Sausage and Greens Pasta Sauce | **Soy off; Sulphites, Nightshades on**; Beans kept |
| Wk2 MON dinner | Vegetarian Peanut Stew | African Peanut Chicken Stew | Vegan African Peanut Stew | same |
| Wk2 FRI dinner | Vegan Arroz con Pollo | Arroz Con Pollo (Regular + Vegan) | Vegan Arroz con Pollo | same |

- **Wk2 SUN's sausage:** Jason read the bought vegan sausage label on 2026-11-20 (avocado oil; no soy or wheat; oat bran
  and fibre, lemon juice concentrate, potato starch, paprika), and CODEX took Soy off the pot with his removal stamp.
  The slot follows CODEX. CODEX's Oats has no DOOR flag (as before).
- **The vegan plate as printed:** the same families on all four meals. Wk2 SUN's vegan plate still says SOY, from
  DOOR's name guess for the vegan line ("Vegan Sausage" reads CODEX's Vegan Sausage record, which lists Soy). That
  over-warns only; it changes when the line's words or that guess change. Only the order of two words moves
  (`BEANS, SULPHITES` → `SULPHITES, BEANS`).
- **Unchanged:** every meal's text, vegan line, sides and ticks; `routing_by_meal.json`'s counts and `_components`.
  Its flow recipe vector moves: it gains the five new CODEX records, carries the pot's allergen change, and reads
  `tumeric-quinoa` as a duplicate id (unknown) until CODEX's shared copy is saved again. EXPO and HUB read only its
  digests. `door_state.json` and `registry_summary.json` change in stamps and `lastModifiedBy` (which reads "Edit Menu: …"
  though the change went through the overlay writer).
- **DOOR's sheet and HUB's menu panel disagree on Wk2 SUN:** HUB builds the vegan line's allergens from the slot (no
  Soy; Sulphites, Nightshades), while DOOR's plating sheet still prints SOY and GLUTEN through its name guess, which reads
  CODEX's standalone "Vegan Sausage" record (Gluten, Oats, Soy, Nightshades). That record doesn't match the bought sausage
  Jason read; raised with CODEX. The one No Soy resident is Halal and eats the halal plate on this pork dinner.
- **Files:** `menu_current.json` and `menu_overlay.json` (the four slots: 12 fields each), `routing_by_meal.json`,
  `door_state.json`, `registry_summary.json` (stamps), `door_flow_publication.json` (sequence 41 → 42).
- **Not done here:**
  - **Beyond Sausage:** no DOOR slot serves it on its own; it is the sausage inside the Wk2 SUN pasta sauce, which the
    relinked record already reads.
  - **Wk4 SAT lunch's quinoa:** its slot still reads recipeName "Tumeric Quinoa" (same `tumeric-quinoa` id; the menu
    shows "Turmeric Quinoa"). CODEX's feed renamed it, but the shared Library still holds a "Tumeric Quinoa" record
    under that id, and DOOR lays that over the feed, so linking now would keep the old spelling. It reads right once
    CODEX's shared copy is saved again.
- **Celery:** the sausage label lists celery, and DOOR has no celery family; no DOOR resident's record mentions celery.

## Checks
- New gate `tests/vegan_pot_relink_gate.mjs` (5), red 4/5 on `main` `40418b4` (VR-4 locks the three unchanged sets).
- Node suite 1124 pass, 1 skipped (no re-pins).
- Independent review: SHIP (no P1/P2). Folded: the flow vector and `lastModifiedBy` wording (P3-1, P3-4), the Wk2 SUN
  sheet vs HUB note (P3-2), the gate also reads `menu_overlay.json` (P3-3). Checked against EXPO's real app: 301 of 301
  recipe ids mapped, its HUB payload identical (526 items), conflicts unchanged.
- `scripts/check_published_flow.mjs` passes.

## After merge
- **EXPO:** nothing to plan differently (EXPO keeps planning the pots; the vegan records carry `plannerDBKey: null`).
  HUB links cards by EXPO's recipe ids, not these slots.
