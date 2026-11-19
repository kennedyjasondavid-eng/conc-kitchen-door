# DOOR menu edit redesign: build plan (2026-11-19)

**This file owns the status of the Edit Menu redesign line** (§8). The back-on-track plan
(`docs/DOOR_BACK_ON_TRACK_PLAN_2026-11-18.md`) points here. Evidence: the walkthrough report
(`docs/DOOR_EDIT_MENU_WALKTHROUGH_2026-11-19.md`, 42 findings) and the before/after page
(https://claude.ai/artifact/VCL1zPfPaP1eyUpytwRsev, private to Jason), both summarized in §2.

## 1. The goal (Jason, 2026-11-19)
- "Menu edit is a clean and unintimidating page that makes things clear and rises to meet the user who wants to make a
  change to a menu for their site. It should cleanly and quietly link up with CODEX and all other HOUSE links needed."
- "User should be assumed to be kitchen expert but tech novice."
- "Clean interface that still presents all necessary information is the desire."
- From Jason's own use: clicking a meal (not editing) gives little at a glance; Save is buried and should be prominent.

**What must stay in view at every step** (the walkthrough's list; nothing in this plan may hide it):
1. What each plate contains (regular, vegan, halal, and each other plate the kitchen makes), worked out from its dishes,
   with hand-added allergens marked.
2. Whose plates change: plates opened or closed, residents moved, new conflicts, above all anaphylactic ones.
3. Every week, or one date, and which week, day and date.
4. Whether each dish comes from the recipe book or is typed (so its allergens rest on a person).
5. A halal decision whenever the meat changes.
6. Whether the change reached the kitchen (EXPO and HUB), and if not, why.
7. "Label not checked" on a bought item.

## 2. What the walkthrough found (summary)
7 High, 25 Medium, 10 Low. Two Highs were live defects and are fixed (S0). The rest group into five themes:
- **T1** Ten system boxes instead of plates of dishes; focus jumps; jargon (H3, M4, M10, M11, M23, M24).
- **T2** No single true allergen summary; the "Meal Allergens & Flags" grid misleads (H5, H7, M6, M20).
- **T3** Search hides recipes by category and matches words in order only (H1, M7, M8, M9, M19).
- **T4** Save is a chain of up to five modal questions; the result is a toast; Save is 3,200 px down (M5, M12, M14–M18).
- **T5** Three ways to change a meal for good, a hidden Edit mode, seven equal buttons, a sideways grid on phones
  (M1–M3, M21, M22, H6).

End-to-end, splitting "Pork Adobo & Garlic Green Bean" took 13 steps and failed; the target is about 5.

## 3. Ground rules for every slice
- **Editor-only first.** The meal record (`_slots`, `_flags`, menu text, line versions, kitchen alternatives) and every
  published file keep their shape. EXPO, HUB and the sheets read exactly what they read today. A new field is additive,
  editor-internal and named in the slice (only S3 adds one).
- **One owner per fact stays.** The plate summary reads the same builders Save and plating read (`buildUnionFlags`,
  `buildVegAltFlags`, `buildHalalAltFlags`, `doorLinePieces`, `doorPlatesLabelUnchecked`, `computePlatingData`). No
  second allergen rule.
- **The allergen facts rule holds** (`docs/DOOR_ALLERGEN_FACTS_RULE.md`): reading only adds; a removal needs a person;
  an unticked Spicy stays off; a linked dish keeps its ticks until relinked; refreshes only add.
- **Nothing commits on a click away**, and nothing changes on open (S0 made this true; every slice keeps it).
- **Kitchen words on screen.** The jargon table in the walkthrough is the word list; "slot", "flag", "overlay",
  "stream", "publish" and "recipe ID" don't appear. CODEX is "the recipe book (CODEX)" the first time on a screen.
- **Delivery cadence.** Each slice is one PR: a gate authored red on `main`, the full suite, the CI browser list, a
  before/after screenshot pair at 1280 and 390 px, and a version bump. Slices marked **review** get an independent
  review before merge (they touch allergens, plates or saved data).
- **Keep what works:** close-with-changes question, put back the original, the "Saved on this computer only. Not sent:
  <reason>" line, "gets this / gets instead / doesn't get it", "Link to …? Its allergens come with it".

## 4. The slices, in order
Each builds on the one before; each ships usable on its own.

### S0 · Two live defects (done, #242)
An unchanged Save writes nothing (H2); opening focuses nothing and a click away links nothing (H4); the re-save step for
a label checked since still writes its ticks. Gate `tests/browser/menu_edit_no_silent_change.mjs` (35).

### S1 · A search that finds the recipe (T3) · review
- Search every recipe, any words in any order ("pork adobo" finds "Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)").
  Recipes that fit the box come first; the rest are listed under "Other recipes", never hidden (`recipeMatchesSlotDef`
  ranks instead of filtering).
- Each result shows its allergens and "label not checked" where it applies.
- Picking is the only way to link: Enter on a highlighted result, a tap, or "Link to …?". No exact-name link on blur.
- No match: "Use '<words>' as a typed dish. You say what it contains." (S3 asks the question.)
- Gate: the adobo case, word order, other-category recipes listed, blur never links, Enter on a highlight links.

### S2 · One true allergen summary per plate (T2) · review
- A summary per plate, worked out from its dishes with the plating builders: "Regular plate contains: …", vegan, halal
  and each other plate the kitchen makes. Hand-added ticks show "(added by you)"; label-not-checked items stay amber.
- The "Meal Allergens & Flags" grid becomes **Also contains** (hand ticks, clearly extra) and **About this meal**
  (spicy, halal-certified meat, processed meat, a starch to swap). Same stored fields, new grouping and words.
- Each dish row shows its ticked allergens as one line ("Soy · Tree nuts"), with **Allergens** to change them. The full
  21-pill row opens on demand (and always for a typed dish, S3).
- Gate: on every published meal the summary equals what plating prints (regular, vegan, halal CONTAINS), and a hand
  tick is labelled.

### S3 · A typed dish says what it contains (H7) · review
- Choosing a typed dish asks once, in place: "What does <dish> contain?" with large choices and **Nothing to declare**.
- **New field (additive, editor-internal):** `declared: true` on a typed slot when the person answered (with nothing
  or with ticks). A typed dish without it shows amber "Allergens not set" on its row and in the summary. Published
  `_slots` carry it verbatim; EXPO ignores `_slots`; HUB reads only `recipeId`. Call **D2**.
- Gate: a typed side saved without an answer shows the amber line; "Nothing to declare" stores `declared` and no ticks.

### S4 · Plates of dishes (T1)
- The meal opens on its title and next date, then plate cards: Regular (one row per dish), Vegan and Halal ("instead
  of …", "the rest is the same"), No pork when it exists, Other plates the kitchen makes.
- Rows map onto today's boxes: Main → `main`, sides → `starch` / `vegside` / `xtra`, extras → `extras`; vegan and
  halal differences → `veganalt` / `mainalt` and the line versions; "also gets" → `vegextras` / `halalextras`.
  **+ Add a dish** asks "Main, side or extra?". Empty boxes and "optional" tags go.
- Reading a meal from its menu text splits at commas (and " & " only where DOOR splits today), one row per dish, in
  the text's own order (H3). When it had to guess, one quiet line: "DOOR read these dishes from the menu text."
- Breakfast is a plain list of items (M24).
- Gate: every published meal opens with the same dishes it has today (row text = today's boxes), and an unchanged Save
  still writes nothing.

### S5 · What changes, and Save always in view (T4) · review
- A footer pinned to the bottom of the screen: the regular plate's summary line, **Close**, **Save** (greyed until
  something changes). On a phone it is a sheet.
- As soon as something differs, **What changes**: every week or one date; each plate before → after; new allergens;
  residents who move plates (counts, from `computePlatingData` on the draft against the stored meal); anaphylactic
  residents named as affected or not; "The kitchen schedule (EXPO) and the staff board (HUB) show it when you save."
- The five modal questions become inline lines in that panel, in kitchen words. Halal is asked only when the meat
  changed. The soft-plate choice is a saved setting on the plate card, asked only when the change affects soft
  residents (M12). At most one confirmation remains, for a food-safety decision. Call **D3**.
- **Menu words keep their wording** where the dishes didn't change: a real edit rebuilds only what changed and keeps
  the rest of the text as written (finishes H2). Call **D4**.
- After Save the page stays on the meal: "Saved and sent to the kitchen · 2:14 pm" or the steady not-sent reason; the
  meal card on the Menu page shows "Changed today by <name>".
- Gate: the questions appear inline; residents-moved counts equal plating before and after; words outside the changed
  dish are byte-identical; Save visible without scrolling at 1280×900 and 390×860.

### S6 · One way in (T5) · review
- The Menu page: week picker, meal cards (dishes, allergen count, spicy, "Changed today"). Tap a card to open the meal
  view (side panel on desktop, full screen on a phone). No Edit mode.
- The meal view's first choice is **Every week** or **Just on <date>**. "Just on <date>" saves through the existing
  dated-swap store (`meal_swaps.json`, whole meal, as Swap Slots already writes), so EXPO and HUB see it as they do
  today. Call **D1**.
- The cell panel's Routing / Swap Meal / Edit Flags tabs and **Make Permanent** retire into that one view. **Swap two
  meals**, Special meal, Rex's week sheet, Replace the whole menu from a file and Try a meal move under **More**.
  Call **D5**.
- Gate: one path changes a meal for good; "Just on <date>" writes the same swap record Swap Slots writes; the retired
  buttons are gone and their deep links (`#menu-config/edit/…`) still open the meal.

### S7 · Phones and tablets (H6, M21, M22)
- One column; the footer as a bottom sheet; a day picker then three meal cards instead of the sideways grid; touch
  targets at least 44 px; the ☰ button with its own header bar on this screen.
- Gate: the readable-themes census and a phone walkthrough at 390 and 320 px; no sideways scroll.

### S8 · Other plates the kitchen makes (M13)
- One line per plate that exists ("Gluten free: <dish> · 4 residents"), **+ Add a plate for…**, and one plain sentence
  on what happens to residents when a plate isn't made. "Restriction-specific plates", "requirement group" and
  "draft routing" go.
- Gate: the plate list equals the kitchen alternatives stored; resident counts equal plating.

### S9 · Use it (data)
Split the four combined meals (Wk1 FRI dinner, Wk4 SUN lunch, Wk4 MON lunch, Wk4 SAT lunch vegan) into their dishes,
linking each to its recipe where one exists, and fix "Tumeric" → "Turmeric", through the new editor, as one reviewed
data publish. Also raised for Jason by the walkthrough: Wk4 SUN's vegan line names Tzatziki (usually dairy); Wk1 FRI's
vegan plate is linked to a pork-named marinade recipe.

## 5. Decisions for Jason (brought one at a time, each with a lean)
- **D1** "Just on <date>": use the existing dated-swap store (lean) or something new.
- **D2** A typed dish records that its allergens were answered (`declared`, additive) (lean: yes).
- **D3** Save's questions move inline; only halal (when the meat changes) and a food-safety confirmation remain (lean).
- **D4** A real edit keeps the menu words it didn't change (lean: yes; EXPO and HUB read those words).
- **D5** Retire the cell panel's Edit Flags / Swap Meal / Make Permanent into the one meal view; keep Swap two meals,
  Special meal, Rex's sheet, Upload and Test Meal under More (lean).
- **D6** Order: S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 (lean: search and the allergen summary first, as they fix
  wrong-plate risks on today's screen before the layout changes).

## 6. Risks and how each is held
- **A cleaner screen hides something needed.** §1's list is a gate item in S2, S4 and S5; reviews check it.
- **The new reading of a meal changes its dishes.** S4's gate compares every published meal's rows to today's boxes.
- **Inline questions get skipped.** Halal and food-safety stay blocking; the rest are visible lines in What changes.
- **"Just on <date>" diverges from Swap Slots.** D1 reuses the same store and the whole-meal record.
- **Old tabs open on another computer.** The stale-tab reload (W3d) covers it; retired functions are removed, not hidden.
- **Gates that read retired code.** Re-pinned with dated notes in the slice that retires the code.

## 7. Out of scope
EXPO and HUB screens; the resident list; Rex's week sheet import (its review stays as it is); the plating sheet itself.

## 8. Status
| Slice | State | PR |
|---|---|---|
| S0 two defects | merged (`c470937`); review SHIP | #242 |
| S1–S9 | planned; decisions D1–D6 pending | |
