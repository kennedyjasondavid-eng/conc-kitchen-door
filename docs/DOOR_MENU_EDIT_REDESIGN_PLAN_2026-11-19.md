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
- **The meal record keeps its shape.** `_slots`, `_flags`, menu text, line versions, kitchen alternatives and every
  published file keep their shape, and EXPO, HUB and the sheets read what they read today. A new field is additive and
  named in its slice (only S3 adds one). **Two slices are not editor-only:** S2a moves code inside plating (proved
  byte-identical), and S4a/D4 changes how a real edit writes the menu text EXPO reads.
- **One owner per fact stays, and it is plating's.** The editor's plate summary and What changes read one pure
  function lifted out of `computePlatingData` (S2a, `doorPlateFacts`), never the editor's own builders. Plating builds a
  plate's CONTAINS from more than the boxes: an operator statement, the vegan line's name match against CODEX, each
  linked recipe's current CODEX list, the regular ticks as a floor, the soy-free strip, ticks read from dish words, the
  pork-never-halal guard and opted-in kitchen plates. `buildVegAltFlags` / `buildHalalAltFlags` / `buildUnionFlags`
  stay what Save writes; they are not a preview.
- **Safety filters stay filters.** `recipeMatchesSlotDef` is a yes/no rule (the vegan line, CODEX's vegan-friendly
  flag, no animal family on a vegan alternative) and stays exactly as it is; the wider search ranks with a separate
  function and never offers a recipe a plate's rule refuses (D7).
- **The allergen facts rule holds** (`docs/DOOR_ALLERGEN_FACTS_RULE.md`): reading only adds; a removal needs a person
  and a confirmation; an unticked Spicy stays off; a linked dish keeps its ticks until relinked; refreshes only add.
  Anaphylactic conflicts are always red with an explicit acknowledgement.
- **Nothing commits on a click away**, and nothing changes on open (S0 made this true; every slice keeps it).
- **Kitchen words on screen.** The walkthrough's jargon table is the word list; "slot", "flag", "overlay", "stream",
  "publish" and "recipe ID" don't appear. CODEX is "the recipe book (CODEX)" the first time on a screen.
- **Shared code moves together or is pinned.** The Special Meal editor shares `renderSlotCard` and the slot searches;
  Rex's review shares `recipeMatchesSlotDef` and the save writers. Each slice either carries them along or pins them
  unchanged with a gate.
- **Delivery cadence.** One PR per slice part: a gate authored red on `main`, the full suite, the CI browser list, a
  before/after screenshot pair at 1280 and 390 px, a version bump. Parts marked **review** get an independent review
  before merge (they touch allergens, plates or saved data).
- **Keep what works:** close-with-changes question, put back the original, the "Saved on this computer only. Not sent:
  <reason>" line, "gets this / gets instead / doesn't get it", "Link to …? Its allergens come with it".

## 4. The slices, in order
Each part ships usable on its own. Order: S0 → S1 → S2a → S2b → S3 → ST → S4a → S5a → S4b → S5b → S5c → S6a → S6b →
S6c → S7 → S8 → U1 (S1 and S2a don't depend on each other; S2a comes before anything that previews a plate).

### S0 · Two live defects (done, #242)
An unchanged Save writes nothing (H2); opening focuses nothing and a click away links nothing (H4); the re-save step for
a label checked since still writes its ticks. Gate `tests/browser/menu_edit_no_silent_change.mjs` (35).

### S1 · A search that finds the recipe (T3) · review
- Search every recipe, any words in any order ("pork adobo" finds "Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)").
  A new ranking function orders the list; `recipeMatchesSlotDef` is untouched.
- **Regular boxes:** only the category check relaxes. Recipes that fit the box come first; the rest are listed under
  "Other recipes".
- **Vegan and halal boxes:** the vegan-line, animal-family and pork rules stay hard. A refused recipe may be listed
  greyed out with its reason ("lists Milk", "pork"), never pickable (D7). The vegan and halal "gets instead…" boxes go
  through the same rule (today they offer and link any recipe).
- Each result shows its allergens and "label not checked" where it applies.
- Picking is the only way to link: Enter on a highlighted result, a tap, or "Link to …?".
- **A blur on words that match, or start, a listed recipe goes into the W3e hold** (`SLOT_HELD`), and Save asks about
  it; it is never saved as a typed dish with no ticks. Words that match nothing save as typed, as today, until S3 asks
  what they contain.
- No match: "Use '<words>' as a typed dish. You say what it contains."
- Rex's week import and `doorRecipeSuggestionFor` keep today's rule (pinned).
- Gate: the adobo case, word order, other-category recipes listed on a regular box; on Vegan Alt a pork recipe and a
  Milk-listing recipe can't be chosen; on the halal main a pork recipe can't be chosen; a blur on a recipe's name is
  held, never linked or saved bare; Enter on a highlight links.
- Re-pins expected: `recipe_binding_v7`, `recipe_attach_p2`/`s2`, `menu_field_freetext`, `slot_editor_live_commit`,
  `w3e_slot_commit_ticks`, `vegan_friendly`, `stew_side_slot`, `label_unchecked`, `door-smoke`.

### S2a · One function for a plate's facts (plating) · review
- Lift the plate part of `computePlatingData` into one pure function, `doorPlateFacts(dayData, period, opts)`: each
  plate's dishes, CONTAINS, label-not-checked dishes and whether the vegan plate is egg- and mustard-free. The sheet and
  `routing_by_meal.json` then call it.
- It takes the day directly, with "no dated meal" as an explicit option, so a preview can plate the every-week meal on
  a date that has a swap. Sections still come from `computeSections`; anaphylactic residents are still set apart with
  `getAnaphConflictRooms`.
- The editor's own `_vegAltSafe` and its unused `vegAllergens` (they disagree with plating) go in S2b, with the preview
  that replaces them (S2a stays a pure move).
- Gate and proof: every plating sheet (84 HTML, 56 XLSX) and `routing_by_meal.json` byte-identical before and after on
  today's data; a meal with a swap on its next date plates the every-week meal when asked.

### S2b · One true allergen summary per plate (T2) · review
- A summary per plate from `doorPlateFacts` on the draft day: "Regular plate contains: …", vegan, halal and each other
  plate the kitchen makes. Label-not-checked items stay amber.
- **"Added by hand"** marks a tick that is on the meal but named by no dish's recipe, typed tags or words (not "by
  you": the tick may be months old).
- **A halal dish carrying Pork** shows it in red on the summary (and the sheet, D8) instead of the guard hiding it.
- The "Meal Allergens & Flags" grid becomes **Also contains** (hand ticks, clearly extra) and **About this meal**
  (spicy, halal-certified meat, processed meat, a starch to swap). Same stored fields, new grouping and words.
- Each dish row shows its ticked allergens as one line ("Soy · Tree nuts") with **Allergens** to change them; the full
  pill row opens on demand (always for a typed dish, S3).
- Gate: on every published meal the summary equals what plating prints (regular, vegan, halal CONTAINS); a meal with a
  known hand tick shows it as added by hand.

### S3 · A typed dish says what it contains (H7) · review
- Choosing a typed dish asks once, in place: "What does <dish> contain?" with large choices and **Nothing to declare**.
- **New field (additive):** `declared: true` on a typed slot once answered (with nothing or with ticks). Published
  `_slots` carry it verbatim; EXPO ignores `_slots`; HUB reads only `recipeId`. It changes `doorMealSig` and the F4
  publication content, both checked by the gate.
- **The 55 typed dishes saved without ticks** (of 122 typed boxes on the published menu) and what Rex's import and the
  Special Meal editor write are D2's call; the code already refused a nudge that would fire on all of them (cry-wolf).
- Gate: a new typed side saved without an answer shows the amber line; "Nothing to declare" stores `declared` and no
  ticks; legacy typed dishes show what D2 rules.

### ST · Test harness before the layout changes (tests only)
- Move the 32 source-slicing checks of `openMenuEdit`, `saveMenuEdit`, `updateSlotSummary`, `renderSlotCard` and
  `slotAutoSave` onto one behaviour harness (open, edit, save through the real functions in a page).
- Contract gate: for each published meal, a scripted one-dish edit leaves every `menu_current.json` field outside that
  dish unchanged, and every published meal keeps its `_slots` shape.
- No app change.

### S4a · Read the meal into rows; keep the words (T1, D4) · review
- Reading a meal from its menu text splits at commas (and " & " only where DOOR splits today), one row per dish, in the
  text's own order (H3). When it had to guess, one quiet line: "DOOR read these dishes from the menu text."
- **A real edit keeps the menu words it didn't change** (D4): only the changed dish's words are rebuilt, in place, so
  EXPO's text doesn't reorder on the next edit of a meal read from text (`buildMealName` orders main, starch, veg side,
  extra today). The vegan line read-in (`doorReadInLineVersions`) is checked against the new reading.
- The four regular boxes hold at most four dishes; "+ Add a dish" says so when they are full (today's menu fits).
- Gate: rows equal today's boxes where saved boxes are restored, and the comma pieces of the text where it is read from
  text; words outside the changed dish byte-identical; an unchanged Save still writes nothing.

### S5a · Save always in view
- A footer pinned to the bottom: the regular plate's summary line, **Close**, **Save** (greyed until something
  changes); a sheet on a phone. After Save the page stays on the meal: "Saved and sent to the kitchen · 2:14 pm" or the
  steady not-sent reason.
- "Changed today by <name>" on the meal card reads the synced change log.
- Gate: Save visible without scrolling at 1280×900 and 390×860; the after-Save line.

### S4b · Plates of dishes (T1)
- The meal opens on its title and next date, then plate cards over the same state: Regular (one row per dish), Vegan
  and Halal ("instead of …", "the rest is the same"), No pork when it exists, Other plates. Rows map onto today's boxes
  (Main → `main`, sides → `starch` / `vegside` / `xtra`, extras → `extras`; vegan and halal differences → `veganalt` /
  `mainalt` and the line versions; "also gets" → `vegextras` / `halalextras`). Line dropdowns collapse to one line each
  (M11). Empty boxes and "optional" tags go. Put back the original sits by the title (M25).
- Breakfast becomes a plain list only after U3/C1's ruled breakfast design is built; until then it keeps today's form.
- Gate: every published meal opens with the same dishes (ST harness); the §1 always-visible list.

### S5b · What changes (T4) · review
- As soon as something differs: each plate before → after (from `doorPlateFacts` on the draft against the stored meal,
  with no dated meal); new allergens; residents who move plates (counts); anaphylactic residents named as affected or
  not. With no resident list on this computer: "counts not available", never "none".
- **An every-week Save on a meal with an upcoming one-date change** names it ("Your change for Nov 3 is replaced") or
  asks (D1).
- Gate: counts equal plating before and after; a meal with a swap on its next date still shows the every-week moves;
  no resident list reads "not available".

### S5c · Save's questions (D3) · review
- **Still blocking:** halal when the meat changed; any allergen removal (default keep; this is the removal's
  confirmation); a new anaphylactic conflict (red, acknowledged).
- **Become inline lines in What changes:** the run-on line, the soft-plate choice (a saved setting on the plate card,
  asked only when the change affects soft residents; still asked when there is no resident list) and held words.
- Re-pins expected: `save_dialog_styled`, `ticks_follow_dish`, `w3e`, `daily_entry_ask`, browser
  `halal_context_race` / `editor_dirty_draft` / `menu_edit_no_silent_change`.

### S6a · "Just on <date>" (data path) · review
- The meal view's first choice is **Every week** or **Just on <date>**. "Just on" writes a whole-meal entry to
  `meal_swaps.json` as Swap Slots does (`{specialName, veg, allergens, _flagsRaw, _rotationSlot, _meal}`), so EXPO and
  HUB show it as they do today ("Swap for Nov 3"; D1 rules the wording and `notes`; no new `kind` without EXPO in the
  same change set). The pork-never-halal guard runs as for every swap.
- **Refused or asked:** breakfast (the dated readers read only lunch and dinner); a date that already holds a swap or a
  special meal (a special meal wins, and half a Swap Slots pair would be left behind).
- **Undo:** a one-date change is taken back by its revert (the swap's), named in D1.
- Gate: a Swap Slots half and a "Just on" entry for the same meal give the same `_meal`; "Just on" on a breakfast is
  refused; a date with a special meal is refused; EXPO reads the entry (checked on its swap reader, including a change
  whose name equals the rotation meal's).

### S6b · One view; retire the cell-panel tabs (T5) · review
- The cell panel's Routing / Swap Meal / Edit Flags tabs and **Make Permanent** retire into the one meal view. Their
  checks move to the new path, not deleted: `make_permanent_whole_dish_gate`, `restore_original_gate`,
  `kitchen_alternatives_gate` 9, `slot_swap_whole_meal_gate`, `swap_revert_reaches_gate`, `anaph_matrix_gate`,
  `publish_menu_ask_gate`.
- What Change Log and ↩ Undo Last cover afterwards, and Test Meal's place, are D5's call.
- Gate: one path changes a meal for good; the carried checks pass; `#menu-config/edit/…` still opens the meal.

### S6c · The Menu page and More
- Week picker, meal cards (dishes, allergen count, spicy, "Changed today"); tap a card to open the meal view (side panel
  on desktop, full screen on a phone). No Edit mode. **Swap two meals**, Special meal, Rex's week sheet, Replace the
  whole menu from a file and Test Meal (if kept) under **More**.
- Gate: the retired buttons are gone; deep links open the meal; re-pins `phone_hidden_panels`, `readable_themes_gate`,
  `menu_edit_deeplink`, `staff_walkthrough`.

### S7 · Phones and tablets (H6, M21, M22)
- One column; the footer as a bottom sheet; a day picker then three meal cards instead of the sideways grid; touch
  targets at least 44 px, including the allergen pills and × buttons (about 17 px today); the ☰ button with its own
  header bar on this screen.
- Gate: the readable-themes census and a phone walkthrough at 390 and 320 px; no sideways scroll.

### S8 · Other plates the kitchen makes (M13)
- One line per plate that exists ("Gluten free: <dish> · 4 residents"), **+ Add a plate for…**, and one plain sentence
  on what happens to residents when a plate isn't made. "Restriction-specific plates", "requirement group" and "draft
  routing" go. Must fit U3/C1's breakfast plates.
- Gate: the plate list equals the kitchen alternatives stored; resident counts equal plating.

### Then · U1 through the new editor (data)
Back-on-track U1 owns splitting the combined meals (Wk1 FRI dinner, Wk4 SUN lunch, Wk4 MON lunch, Wk4 SAT lunch vegan)
and "Tumeric" → "Turmeric"; it is done through the new editor as one reviewed data publish (D9). Also raised by the
walkthrough: Wk4 SUN's vegan line names Tzatziki (usually dairy); Wk1 FRI's vegan plate is linked to a pork-named
marinade recipe.

### Small items, folded into the slice that touches them
M7 badge wording and colours, M8 "Shown on menu as", L4 truncated Event Name (S1/S4b); M9 the routing warning wording,
L10 the empty preview (S2b); L2 small uppercase labels, L3 the "Seasonal Veg" quick-pick, L9 the stale "(edited)",
M19 before → after on the row (S4b); L5 three Save names (S5a); L8 Test Meal jargon (S6c).

## 5. Decisions for Jason (brought one at a time, each with a lean)
Names here are this plan's (the back-on-track plan has its own D-numbers).
- **D1** "Just on <date>": the dated-swap store (lean), with breakfast refused, a date already holding a swap or special
  meal refused, an every-week Save naming the one-date change it replaces, EXPO/HUB's "Swap for" wording kept, and the
  swap's revert as its undo.
- **D2** A typed dish records that its allergens were answered (`declared`); what the 55 legacy typed dishes show; and
  whether Rex's import and Special Meal write it. **Ruled 2026-11-19 (Jason: "Follow lean"):** legacy ones quiet grey
  and listed in Menu Config for one sitting; a new one amber; Rex's import marks a dish its review ticked; Special Meal
  keeps no per-dish allergens (its meal grid is the answer).
- **D3** Halal (meat changed), allergen removals and new anaphylactic conflicts stay blocking; run-on, soft and held
  words go inline.
- **D4** A real edit keeps the menu words it didn't change (in S4a; EXPO reads those words).
- **D5** Retire Edit Flags / Swap Meal / Make Permanent into one view; what Change Log and ↩ Undo Last cover afterwards;
  keep or retire Test Meal; Special Meal and Rex's review follow each slice or are pinned.
- **D6** The order in §4.
- **D7** The wider search never offers a recipe a plate's rule refuses (listed greyed with the reason, never pickable).
  **Ruled 2026-11-19 (Jason: "Follow lean").**
- **D8** A halal dish carrying Pork: show it in red on the summary and the sheet instead of hiding it.
  **Ruled 2026-11-19 (Jason: "Follow lean").**
- **D9** U1 owns the combined-meal split and Turmeric; this plan does it through the new editor.

## 5b. Carried from the S2b review (P3, for the slice that touches them)
- S5b: `doorCheckNewPlainChoices` still reads the editor's own egg and mustard check; feed it the draft's value.
- S5a: the summary runs the menu read twice per keystroke (about 7 ms of parsing on desktop); share one draft or debounce.
- D8 reads pork words only (pork, ham, bacon, pepperoni, prosciutto, chorizo, pancetta). Bare "sausages", "carnitas",
  "griot" and "salami" are not read as pork, because chicken, beef and vegan versions use those words.
- Save's meat reader still reads "sausage" as pork ("Halal beef sausages" on a halal main sets Pork at Save; those are
  pork days today, so nothing moves). For S3 or the U1 data pass.

## 6. Risks and how each is held
- **A preview disagrees with the sheet.** S2a makes one function; S2b and S5b gates compare with real plating output.
- **A wider search puts the wrong recipe on a plate.** `recipeMatchesSlotDef` unchanged; D7; gate cases on Vegan Alt and
  the halal main.
- **A blur saves a recipe's name with no allergens.** S1 holds it (W3e) until S3 asks.
- **A swap hides a change's effect.** `doorPlateFacts` plates with no dated meal; gate case.
- **A cleaner screen hides something needed.** §1's list is a gate item in S2b, S4b and S5a; reviews check it.
- **The new reading changes a meal's dishes or EXPO's words.** ST's contract gate and S4a's gate; D4 in S4a.
- **Inline questions get skipped.** Removals, halal and anaphylactic conflicts stay blocking (D3).
- **"Just on <date>" diverges from Swap Slots.** Same store, same whole-meal record, same gate.
- **Old tabs open on another computer.** The stale-tab reload (W3d) covers it; retired functions are removed, not hidden.
- **Mass re-pins.** ST first; each slice lists its expected re-pins; retired checks carry their cases forward.

## 7. Out of scope
EXPO and HUB screens; the resident list; Rex's week sheet import (pinned unchanged); the plating sheet's layout (S2a
moves its code without changing a byte).

## 8. Status
| Slice | State | PR |
|---|---|---|
| S0 two defects | merged (`c470937`); review SHIP | #242 |
| Plan | independent review READY WITH CHANGES (4 P1, 8 P2, 4 P3), all folded 2026-11-19 | #243 |
| S1 search | merged (`f246523`, `v31-standard.104`); reviews FIX FIRST ×2, folded; SHIP | #244 |
| S2a plate facts | merged (`7d33af4`, `v31-standard.105`); review SHIP | #245 |
| S2b plate summary | merged (`14d6198`, `v31-standard.106`); review SHIP | #246 |
| S3 typed dishes | built (`v31-standard.107`); D2 ruled; review SHIP, P2s folded | #247 |
| ST–S8, U1 | planned; D2, D7, D8 ruled; D1, D3–D6, D9 pending | |
