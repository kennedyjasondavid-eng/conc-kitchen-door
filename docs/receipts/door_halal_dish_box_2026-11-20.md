# Receipt: Wk2 SUN dinner's halal plate names its dish (publication 47, `v31-standard.129`, 2026-11-20)

The #274 review (P2-2) found that the one No Turkey resident on Wk2 SUN dinner's halal plate got no note. The halal plate
serves the Solmaz halal turkey sausage, but the meal had no halal dish box: its halal section printed no CONTAINS line, and
the meal's own ticks (a pork meal) carry no Turkey. Jason, 2026-11-20, on giving the halal plate its own box: "Follow lean".

- **Data:** `menu.2.SUNDAY.dinner_slots.mainalt` is new: `{ manual: "Halal Turkey Sausage", flags }`, ticked Turkey, Corn,
  Gluten, Beans and Processed Meat. Pork, Chicken and Beef are off. It was written to the overlay with the meal's
  original kept (`doorNoteMealChange`, the first copy from publication 46 stays) through `saveMenuBaseOverlay`. Then one
  publish went through DOOR's own publisher against EXPO's in-memory fake GitHub (W6 harness).
- **Not moved:**
  - The meal's ticks. Turkey stays off the meal: on a pork meal it would open the halal triggers for the regular plate.
  - Its words: the meal name, the vegan line and `dinner_halal` ("Halal Turkey Sausage").
  - Every other meal.
  - `routing_by_meal.json` counts and `registry_summary.json` (only stamps). `door_state.json` changes only its stamps
    and `lastModifiedBy`.
  - `door_flow_publication.json` goes from sequence 46 to 47.
- **Plates:** the halal section now prints "WHEAT, BEANS, CORN, PROCESSED MEAT, SULPHITES". That is the box's ticks over
  the meal's ticks without pork, the floor the vegan line uses. Sulphites comes from that floor (the pork sausage's lemon
  juice solids), so on the halal plate it only over-warns. No resident changes plate (Vegan 10, Halal 59, Gluten Free 3,
  Regular 96 before and after).
- **Code (`v31-standard.129`):** the allergen line has no word for Turkey or Chicken (only Pork and Beef), so the halal
  plate's CONTAINS line alone could not carry the note.
  - `doorPlateFacts` hands the halal box's ticks to the notes as `mealFlags._halalDishFlags`. It is not enumerable (as
    `_yoghurtPlates` is), so no copy, count or published file reads it. Pork is always off.
  - `doorSectionLineNotes` reads them for the halal section only. The No Turkey resident's halal row now reads
    "no turkey".
  - Adding Turkey to the allergen line was not chosen: it would change CONTAINS on every turkey meal.
- **Check:** `tests/halal_dish_box_gate.mjs` (4), red 3/4 on `main` `4da2c52`. HD-2 locks what must not move.
- **Independent review: SHIP** (no P1 or P2). Noted, not changed:
  - P3-1: Edit Menu's Save adds every meat named in the main and halal boxes to the meal's ticks
    (`doorEditorDetectMeat`). So the next real Save of this meal turns on Turkey for the whole meal. No Turkey residents
    on the regular plate would then get a "no turkey" note too. That only over-warns, and routing doesn't move. HD-2
    goes red at that point; re-pin it with a dated note.
  - P3-2: the same Save also writes `dinner_mainAlt` ("Halal Turkey Sausage"), which is empty today. Harmless.
  - P3-3: HD-3 and HD-4 test the note and the source, not `doorPlateFacts` running on the published meal.
