# Rex's week sheet updates DOOR's menu — plan and receipt (2026-10-29)

Jason, 2026-10-29: "Want to add a feature to door where you can upload a week menu and have door slot on the meals and ask the user questions about the details that aren't clear (where are items prepared, what are restriction alts, etc." … "I am just trying to give a way for Rex (or me) to update DOOR with new menus without parsing the changes ourselves, and using docs that are already being generated to update." Then: "yes, go ahead and build it".

Example sheets: `tests/fixtures/rex_week/Week 4 18 Oct - 24 Oct.xlsx` and `Week 1 - Menu Oct 25 - Oct 31 -.xlsx` (with `.rows.json` copies for the node gate).

## The sheet

It's one sheet a week:

- **Header row:** "WEEK N", then SUNDAY…SATURDAY.
- **BREAKFAST:** regular, Vegetarian, unlabelled side rows (fruit & yoghurt, roll), Allergens.
- **LUNCH and DINNER:** regular, Vegetarian, Halal option, Allergens.
- **"Veg lunch" and "Veg dinner":** two rows each, the starch and veg Rex makes for each meal.

The sheet has no dates. They are only in the file name.

## Rulings

| # | Question | Ruling (Jason, 2026-10-29) |
|---|---|---|
| — | Which side is canon | "Rex menu will be canon, small changes get made." |
| — | Rex's allergen rows | "can be ignored or at least not treated as canon; DOOR should decide which ingredients cause restrictions issues using the info it has about recipes from CODEX." |
| — | Where items are made | "production provenance is EXPO, but DOOR should ask about any details that EXPO would use from DOOR to decide its scheduling." |
| — | Breakfast | "put breakfast in the DOOR menu but not EXPO's schedule." |
| 1 | Does a change stick | "Change the rotation, but a swap should usually be considered one-time - ask to confirm in any case." |
| 2 | Veg drift | Apply it, and tell Jason what it moves. |
| 3 | Older names | Same recipe: keep DOOR's words and link. A different dish: ask once and remember the answer. |
| 4 | An empty Halal row | Rex didn't write it: DOOR keeps its halal plate. "Non-pork meat tends to be halal." |
| 5 | The sheet disagrees with itself | "Meal row typically wins. In this case hash is a new item replacing salad … Ask to confirm with a lean." |
| 6 | Saving | Publish on confirm. |
| 7 | A dish with no CODEX recipe | Link the closest recipe, or tick its allergens by hand. |

## What was built (`v31-standard.46`)

### Menu Config → ↑ Rex's week sheet

1. DOOR reads the .xlsx. It takes the first sheet with a "WEEK N" over SUNDAY header.
2. It works out the week's dates from the file name, and checks them against DOOR's cycle (`doorRotationWeekOf`). The "Week of" picker offers only the Sundays that fall on that rotation week. If the file name's date isn't one of them, the picker defaults to the nearest one and says so.
3. It compares every meal (21) with the rotation week from `getMenuData()`, and shows a review:
   - **To look at:** a card for each changed meal. It shows Rex's sheet beside DOOR's, with the dishes that differ marked. The card has:
     - the notes that apply (a swap, the sheet disagreeing with itself, a new dish, the halal question, the kitchen's alternatives);
     - the allergens it adds;
     - the allergens it offers to take off;
     - the choice: **Every cycle**, **This week only** (lunch and dinner on today or later only), or **Keep DOOR's**.
   - **Steamed veg, applied without asking:** each change, with what it adds and offers to take off, and a "keep DOOR's" tick.
   - **Kept DOOR's, as answered before.**
   - **N meals match DOOR** (folded).
4. **Save and send to the kitchen** writes the answers:
   - **Every cycle** goes through the overlay, as Edit Menu's save does:
     - `doorMealCopy`, then `doorNoteMealChange`, so the meal's original is kept and Restore still works;
     - `doorSetMealFlags`, which writes the allergen line with the ticks;
     - an upcoming swap of the slot is cleared (`doorSwapKeysForSlot`);
     - a change-log entry with `via: 'rex-week'`.
   - **This week only** is a dated swap (`concMealSwaps`) on that day, with `_rotationSlot`.
   - **Keep DOOR's** is remembered in `concRexWeekAnswers` by meal and Rex's words. It is asked again when the sheet changes that meal.
   - Then `publishAndSync`. Without the connection key, that says "Saved on this computer — not sent to the kitchen yet".

### How DOOR matches dishes

This is the `rex-week` testable core: `doorRexSameDish`, `doorRexAlignLine`.

- **Same dish:** the same words, or one name inside the other.
  - Case, punctuation, "&"/"and", plurals and one-letter typos don't count ("Strogonoff", "Vegetarin").
  - Vegetarian, vegan, vegetable, veggie and veg are one word.
  - **A main:** the shorter name needs two words, and the longer one may not add a kind of dish. So "Chicken Burger" = Breaded Chicken Burgers, but "Jerk Tofu" ≠ "Jerk Cauliflower" and "Sweet Potato" ≠ Sweet Potato Biscuits.
  - **A side:** the extra words may only say how it is made. So "Broccoli" = Steamed Broccoli, but "Rice" ≠ Rice and Beans and "Potato" ≠ Potato Salad.
- **"Seasonal Vegetables" / "Seasonal Side" / "Vegetables":** the Veg row's veg that isn't already on the line. With none, it stands for DOOR's veg.
- **A DOOR side Rex's line leaves out:** it stays when the Veg row still names it, unless Rex's line has a new dish in its place. In that case the question says the Veg row still names DOOR's dish (ruling 5).
- **What is left:** pairs by kind (starch, plain veg, or something a kitchen makes). Two kitchen-made dishes of different kinds also pair, like Potato Hash for Potato Salad. Anything still left over is added or removed.
- **Steamed veg only:** a meal whose only changes are plain veg sides is applied without a question (ruling 2).
- **Breakfast:** a breakfast whose only changes are sides is applied too, and breakfast is never a dated swap.
- **The saved meal:** DOOR's order and words for the dishes that are the same, and Rex's words for those that changed. DOOR's slot, with its recipe link, is kept for a dish that is the same. A changed dish gets a new slot, linked to its recipe when the recipe's words are the dish's.

### Allergens

- Rex's allergen rows are read and never used. Gate test 8 replaces every one of them with nonsense, and the plan is identical.
- **A new dish brings:** its CODEX recipe's allergens (`hubAllergenToFlags`), plus what its name says (`nameDetectFlags`, plus corn, mushroom, nightshades and beans; green beans are not Beans, as DOOR reads them today).
- **Added without asking:** the allergens a new dish brings are added.
- **Offered, never taken off unticked:** a warning DOOR had that nothing left on the plate names. When the main changes, that is any warning nothing left names, since it likely came from the old main's recipe. When only a side changes, it is only what the side that left named.
- **A main that changes:** `halalCertifiedMeat` is recomputed. It is true for non-pork meat (ruling 4) and false for pork.
- **A pork meal** with no halal dish in either the sheet or DOOR asks what Halal residents get.
- **The kitchen's alternatives:** when the main changes, the review shows them (gluten free, soft, diabetic, no dairy, no egg/mustard, bland, anaphylactic), filled in, and says they were written for the old dish. That covers the original ask's "what are restriction alts".

### A new dish (ruling 7)

- A changed or added dish that isn't a CODEX recipe gets a recipe picker. The closest recipes are offered, and the same dish under a longer name is picked by default ("Jerk Cauliflower" → Jerk Cauliflower Steaks).
- The other choice is **no recipe yet: tick its allergens**, pre-ticked from the name, with a note to add the recipe to CODEX. EXPO's "Set it up" then asks where it's made.
- Not asked: plain staples (noodles, a roll, naan…), plain veg, and breakfasts (they carry no recipe links).

## What the two sheets give (published menu, `1ac3486`)

**Week 4 (Oct 18–24):** 18 meals match. All its dates have passed, so there is no "this week only".

| Meal | Result |
|---|---|
| Wk4 FRI lunch | Applied: Cauliflower & Carrot → Zucchini & Carrot. Brassicas is offered to take off. |
| Wk4 SUN breakfast | Asked: Vegan Breakfast Sausage Sandwich → Vegan Breakfast Patties Sandwich (+ fruit & yoghurt). |
| Wk4 TUE dinner | Asked: Roasted Yam → Roasted Sweet Potatoes, Peas & Carrots → Green Beans. |

**Week 1 (Oct 25–31):** 15 meals match.

| Meal | Result |
|---|---|
| Wk1 SUN dinner | Pasta → Noodles. The Veg row still says Pasta. |
| Wk1 MON dinner | Jerk Tofu → Jerk Cauliflower, offered as Jerk Cauliflower Steaks with CODEX's feed. |
| Wk1 TUE lunch | Blackened Tofu → Roasted Tofu (the Roast Tofu recipe), Parsnip and Carrot → Parsnip. |
| Wk1 THU lunch | Side Salad → Side Soup, and a pork meal with no halal dish anywhere: asked. "This week only" is offered. |
| Wk1 FRI breakfast | Turkey & Cheese and Eggs, Yogurt → Turkey, Cheese and Eggs yoghurt, fruit & yoghurt, roll. |
| Wk1 FRI lunch | Potato Salad → Potato Hash. The Veg row still says Potato Salad; lean: the hash replaces it. "This week only" is offered. |

Matched without a question: the July names (Chicken Burger, Vegetarian Sandwich, Vegetarian Tacos, Home Fries, the "Seasonal" veg) and the halal rows that agree.

## Gates

- **`tests/rex_week_import_gate.mjs` (11):**
  - the reader and the file-name dates;
  - the same-dish table;
  - both weeks' results above;
  - a swap defaults to those dates;
  - "Keep DOOR's" is remembered;
  - Rex's allergen rows decide nothing, and a removal happens only when ticked;
  - the saved meal;
  - the app's save goes through DOOR's own writers;
  - with CODEX's feed beside the repo, the recipe links.

  It is authored to fail on `1ac3486`, which has none of it. Helper: `tests/helpers/rex_week_box.mjs`.
- **`tests/browser/rex_week_review.mjs`** (not in CI): real Chromium at 1280 and 390 px on Thu Oct 29 in Toronto. It uploads both sheets through the button, answers, saves, and checks the overlay, the original copy, the remembered answers, the change log, a dated swap and today's meal. 56/56. Screenshots are in `docs/receipts/rex_week_2026-10-29/`.
- **Re-pinned with a dated note:** `corn_recipe_alignment_gate` (its whole-file digest). The new block, its button and the build date are taken out, byte for byte, as was done for the Oct 24 logo.
- Full suite: 561/561.

## Not built / open

- **"Keep DOOR's" answers stay on the computer where they were given** (localStorage). Another computer asks again.
- **↩ Undo Last undoes the import's last meal only:** it undoes one change-log entry. Restore the original works per meal.
- **EXPO** reads the saved menu as it does an Edit Menu save. Nothing new is sent to EXPO. A new dish reaches EXPO's "Set it up" by its name.
- **Breakfast** is written to DOOR's menu, and EXPO doesn't schedule breakfast (ruled).
