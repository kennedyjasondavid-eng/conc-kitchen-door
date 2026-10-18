# DOOR routing rules — the table the audit tests against (2026-10-18)

Audit phase **A0** of `DOOR_TAGS_ANAPH_ROUTING_AUDIT_PLAN_2026-10-18.md`. Jason, 2026-10-18: "start the rules table for the audit; complete audit as autonomously as possible".

**Status (2026-10-18, end of the audit):** every fork is ruled and built (merged via PR #126, `a1849d2`, `v31-standard.32`; the independent review's fixes below follow in `v31-standard.33`); the code now matches the Rule column. §2–§7 describe the code as it is now (each row that changed says "was"). §8 lists what the audit found on the published data, and §10 is the audit's result: the gates, the receipts, what else was found and fixed, and what is still open.

**How to read it.**
- **Code** was what `index.html` did at `a9d65f8` (`v31-standard.32`, before the audit's fixes).
- **Rule** is what it should do. The A2 oracle (`tests/helpers/routing_oracle.mjs`) is written from the Rule column, never from `computeSections`.
- Where the two differ, or the Rule is unknown, the cell names a fork (**F1–F12**, §9) for Jason.
- Counts are measured on the published data: `door_state.json` (167 residents; anaphylactic list 213, 813, 607a, 1213) and `menu_current.json` with `menu_overlay.json` laid over it (84 meals). They come from the real page, offline, with `concAltFlagSweepV1` done, as the published menu was written.

---

## 1. One resident, one meal

For each resident and meal, DOOR answers five things.

1. **Plate:** exactly one section that prints, or the Anaphylactic Alternative.
2. **Line:** what their row on the plating sheet says (the note column), and their label.
3. **Alerts:** the Generate conflict check, the Today alerts, the week-ahead list, the anaphylactic alert.
4. **Lockout:** whether their room and roommates are contained.
5. **Counts:** `routing_by_meal.json` and `registry_summary.json`.

**R0 — the line rule (proposed; F8).** Every restriction of the resident that the meal sets off is either served by their plate, or named on their line. A resident eats one plate. When two of their sections open, the higher one wins, and the other restriction must reach the cook as a note.

Today the line names only tags that have a `CONFLICT_MAP` row, read against the main meal's flags. §8 shows where that leaves a restriction unserved and unnamed.

## 2. Sections, in priority order (`ROUTING_RULES`)

A resident sits in the first open section whose tags they hold. Regular is last and always open.

| p | Section | Tags | Opens on | Plate (`altType`) | The plate is free of |
|---|---|---|---|---|---|
| 1 | Vegan / Vegetarian | Vegan, Vegetarian | always | the vegan line | meat, fish, shellfish, dairy; egg and mustard only when `_vegAltSafe` |
| 2 | Halal | Halal, No Pork | pork; or beef / chicken / turkey that isn't halal-certified | the halal line, `mainAlt`, else "Halal alternative — …" | pork, non-halal meat |
| 2.1 | No Pork | No Pork without Halal | when the meal sets `noPorkAlt` (split out of Halal) | `noPorkAlt` | pork |
| 2.5 | No Processed Food | No Processed Food | `hasProcessedMeat` | `noproc_alt` | processed meat |
| 3 | No Fish / Shellfish → Vegan | No Fish, No Shellfish, No Molluscs (was not routed; F4) | `hasFish`, `hasShellfish` | the vegan line | as Vegan |
| 4 | Gluten Free | GF | `hasGluten` | `gfAlt` | gluten |
| 5 | No Dairy → Vegan | No Dairy, Lactose Intolerant | `hasDairy` | the vegan line | as Vegan |
| 6 | No Beef → Vegan | No Beef | `hasBeef` | the vegan line | as Vegan |
| 7 | Diabetic / Low Carb | Diabetic, Low Carb | `isCarb` | the main, less starch | nothing more |
| 8 | Bland | No Spicy, Bland Diet (was in no section; F2) | `isSpicy` | the main, plain | spice |
| 9 | Soft Meals ("Alternative Meals") | Soft Meals | always | `softAlt` / `altMeals` | — (texture) |
| 10 | No Egg / Mustard | No Eggs on `hasEgg`; No Mustard on `hasMustard` (was egg only; F3, `tagTriggers`) | `hasEgg`, `hasMustard` | the main without egg or mustard | egg, mustard |
| 99 | Regular | — | always | the main | — |

`halalCertifiedMeat` defaults to true on a meal with beef, chicken or turkey and no pork (CONC buys halal). An explicit false opens Halal. The plating engine also sets chicken / turkey from the meal's name and reads a "Halal …" main as certified (`computePlatingData`); the routing file's counts do not (§6).

## 3. Merges, in the order the code applies them

1. **Into Vegan:** No Fish / Shellfish, No Dairy and No Beef residents join Vegan whenever their section opens. (No "incl." label is printed for these.)
2. **Pork day** (`hasPork`):
   - No Processed Food → Halal (label "incl. No Processed");
   - Soft Meals → Halal, unless the meal has alternative meals (`_altMeals`);
   - Bland → Gluten Free, only while Gluten Free is open (2026-10-16).
3. **No Pork split:** with `noPorkAlt`, No Pork residents without Halal leave Halal for their own section. No published meal sets it.
4. **No Egg → Vegan** when the vegan line names no egg or mustard (`_vegAltSafe`).
5. A section with no residents doesn't print; Regular always does.

**Rule:** each merge is a plate the kitchen says serves both groups. Where the merged plate doesn't serve the restriction (a pork-day halal sausage for No Processed Food), R0 applies: the line names it (F8, F11).

## 4. Per tag

Generated from the code (`ROUTING_TAGS` / `ALLERGEN_TAGS` / `ACCOMMODATION_TAGS`, `ROUTING_RULES`, `RESIDENT_TO_MEAL_FLAG`, `CONFLICT_MAP`, `ANAPH_TAG_TO_MEAL_FLAG`, `COMPLIANCE_TIERS`). A1 regenerates it, so a new tag fails by name.

Column meanings:
- **Conflict:** the Generate conflict check and the Regular-with-notes line.
- **Line note:** the note any section's row prints, read against the main meal's flags.
- **Lockout:** the flags an anaphylactic resident is contained on. "Not offered" means the anaphylactic picker doesn't offer the tag.
- **Compliance:** "doc*" means the tag is not in `COMPLIANCE_TIERS`, so documentation is required by default.

| Tag | Residents | Set | Section (opens on) | Conflict | Line note | Lockout | Compliance | Gap |
|---|---|---|---|---|---|---|---|---|
| Halal | 37 | routing | halal (pork; non-halal meat) | – | – | not offered | auto | |
| No Pork | 18 | routing | halal | hasPork | – | not offered | doc | |
| Diabetic | 16 | routing | diabetic (isCarb) | – | "extra veg less starch" on every row | not offered | doc | |
| Vegetarian | 7 | routing | vegan (always) | – | – | not offered | auto | |
| Low Sodium | 6 | accom | – | – | – | not offered | doc | F6 |
| GF | 5 | routing | gf (hasGluten) | hasGluten | "gluten-free" | hasGluten | doc (listed now; F5) | F9 fixed |
| Lactose Intolerant | 4 | routing | no_dairy → vegan (hasDairy) | hasDairy | "dairy-free" | not offered | auto | |
| No Dairy | 4 | routing | no_dairy → vegan (hasDairy) | hasDairy | "dairy-free" | hasDairy | doc | |
| No Fish | 4 | routing | no_fish → vegan (fish, shellfish) | hasFish | "no fish" | hasFish | auto | |
| No Spicy | 4 | routing | bland (isSpicy) | isSpicy | "not spicy" (was –) | not offered | doc | F8 fixed |
| Vegan | 4 | routing | vegan (always) | – | – | not offered | auto | |
| Soft Meals | 3 | routing | soft (always) | – | "soft" off the soft plate (was –) | not offered | doc | F8, F10 fixed |
| No Beans | 2 | accom | – | hasBeans | "no beans" | not offered | auto | F9 |
| No Beef | 2 | routing | no_beef → vegan (hasBeef) | hasBeef | "no beef" (was –) | hasBeef | auto | F8 fixed |
| No Eggs | 2 | routing | no_egg (hasEgg) | hasEgg | "no egg" | hasEgg | doc | |
| No Peanuts | 2 | allergen | – | hasPeanuts | "NO PEANUTS" | hasPeanuts | doc | |
| No Shellfish | 2 | routing | no_fish → vegan | hasShellfish | "no shellfish" (fish or shellfish) | hasFish, hasShellfish | doc | |
| Low Carb | 1 | accom | diabetic (isCarb) | – | "extra veg less starch" | not offered | doc | |
| Low Fat, Low Potassium | 1 each | accom | – | – | – | not offered | doc | F6 |
| No Coconut | 1 | allergen | – | hasCoconut | "no coconut" | hasCoconut | doc | |
| No Corn | 1 | accom | – | hasCorn | "no corn" | not offered | doc | |
| No Molluscs | 1 | allergen | no_fish → vegan (was not routed) | hasShellfish | "no molluscs" | hasFish, hasShellfish | doc* | F4 fixed |
| No Mushroom | 1 | accom | – | hasMushroom | "no mushroom" | not offered | auto | |
| No Processed Food | 1 | routing | no_processed (hasProcessedMeat) | hasProcessedMeat (was –) | "no processed meat" (was –) | not offered | doc | F8, F11 fixed |
| No Soy | 1 | allergen | – | hasSoy | "no soy" | hasSoy | doc | |
| No Tree Nuts | 1 | allergen | – | hasTreeNuts | "no tree nuts" | hasTreeNuts | doc | |
| No Turkey | 1 | accom | – | hasTurkey | "no turkey" (was –) | not offered | auto | F8 fixed |
| Bland Diet | 0 | routing | bland (was in no section) | isSpicy (was –) | "not spicy" (was –) | not offered | doc* | F2 fixed |
| No Brassicas | 0 | accom | – | hasBrassicas | "no broccoli/cauliflower/cabbage" | not offered | auto | |
| No Fried Food | 0 | accom | – | – | – | not offered | doc | F6 |
| No Mustard | 0 | allergen | no_egg on a mustard meal (was –) | hasMustard | "no mustard" | hasMustard | doc | F3 fixed |
| No Nightshades | 0 | allergen | – | hasNightshades | "no tomato/potato/pepper" | hasNightshades | auto | |
| No Oats | 0 | allergen | – | **–** | **–** | offered, **no flag** | doc* | L11 |
| No Sesame, No Sulphites | 0 | allergen | – | own flag | own note | own flag | doc | |
| Other | 0 | accom | – | – | – | not offered | doc* | F6 |

**Read with §8.** Before the fixes, these rows had a dash where DOOR couldn't name the restriction on a line. When a higher section won, the restriction went unserved and nobody was told. The census is pinned as code in `tests/tag_table_consistency_gate.mjs`, so a new tag, or a tag whose rules change, fails there by name.

## 5. Anaphylaxis

- **Who:** `doorIsAnaphResident(r)`: the resident's flag, or their room on the anaphylactic list (`anaphRooms`). Every reader goes through it since `.31`.
- **Which tags:** `anaphTags` when set (keys, e.g. `noTreeNuts`), else every tag the resident holds.
  - 213: `noCoconut`, `noTreeNuts`.
  - 607a: `noPeanuts`.
  - 1213: none, so every tag (No Peanuts).
  - 813: none, and Regular, so nothing can be contained.
- **Which flags:** `ANAPH_TAG_TO_MEAL_FLAG` through `anaphTagMealFlags` (§4, Lockout column).
- **Contained:** the room and every roommate (same base room, a/b/c/d).
- **Scope (F1):**

| Reader | Scope |
|---|---|
| Plating sheets, labels, `routing_by_meal.json` | per meal |
| `routeResident` (Daily Entry preview, stored routes), `computeBaseSections` (home headcount), the room lookup's "Today:" line | per meal, read as the plating sheet reads the meal (was per day: lunch or dinner; F1 fixed) |

  Before F1, on a day with a dinner-only allergen, 213's lunch showed "Anaphylactic Alternative" in the preview and the home count, while the lunch plating sheet seated 213 in Soft Meals. Now the lookup reads "Today: Lunch → Soft Meals · Dinner → Anaphylactic Alternative".
- **Rule** ("anaphylactic flags are sacred"): no path takes a room off the list without a deliberate act, and every surface shows the same answer for the same meal.

## 6. Outputs and the flags each reads

| Output | Engine | Flags it reads |
|---|---|---|
| Plating sheet, labels, Regular-with-notes | `computePlatingData` → `computeSections` | meal flags + smart defaults + `_vegAltSafe` + `noPorkAlt` + `_altMeals` |
| `routing_by_meal.json` section counts | `computePlatingData`, as the sheets (was raw meal flags only; F12 fixed) | as the plating sheet, swaps and special meals included (F13) |
| `routing_by_meal.json` `_components` | `computePlatingData` | as the plating sheet |
| Daily Entry preview, stored routes | `routeResident` → `computeSections` | today's meal as the sheet reads it (`doorTodayMealFlags`), per meal |
| Home headcount, room lookup | `computeBaseSections`, `doorTodaySeatsLine` → `computePlatingData` | today's lunch (and dinner, in the lookup), per meal |
| Generate conflict check | `checkResidentMealConflicts` | `RESIDENT_TO_MEAL_FLAG` |

**Measured before F12:** the routing file's section counts disagreed with the plating sheets on 3 meals:
- Wk1 TUE dinner (Pork Carnitas);
- Wk3 THU dinner (Pork Griot);
- Wk4 FRI dinner (Tandoori Pork).

They are pork days with alternative meals. The plating engine keeps two Soft Meals residents, 213 and 711, on their alternative. The file merges them into Halal, because it doesn't read `_altMeals`. (709 holds No Pork, so it sits in Halal either way; see §8 #4.) The file says Halal 56 / Soft 0; the sheet says Halal 54 / Soft 2. EXPO's board reads the file.

## 7. Compliance tiers

`requiresDocumentation`: a resident needs documentation when any of their tags is doc-tier, or not listed (doc*).
- GF is listed as doc now (F5: "keep doc"). The table listed "Gluten Free", the section's name, which no resident has.
- Lactose Intolerant is auto (ruled 2026-10-18).

## 8. Findings on the published data (real page) — all named now

Each was a resident × meal where a restriction the meal set off was neither served by the plate nor named on the line. `tests/routing_replay_gate.mjs` pins each one named.

| # | Restriction | Seated in | Residents × meals | Example |
|---|---|---|---|---|
| 1 | No Spicy | Halal | 709, 910 × 4 pork + spicy meals | Wk2 TUE dinner: the halal plate is Chicken Vindaloo, no note |
| 2 | No Spicy | Vegan | 801 × 19 meals whose vegan line says SPICY | Wk2 TUE dinner: Vegetarian Vindaloo, no note |
| 3 | Soft Meals | Bland | 709 × 11 spicy meals | never the soft alternative; no note |
| 4 | Soft Meals | Halal | 709 × 5: 3 pork days with alternative meals, 2 non-halal chicken | Wk2 FRI dinner: the soft plate is "Plain Chicken Leg, Plain Rice…"; 709 gets Halal |
| 5 | No Processed Food | Halal (pork-day merge) | 614b × 11 processed-pork meals | Wk1 THU lunch: the halal alternative of a sausage |
| 6 | No Beef | Halal | 704, 901 × Wk1 THU lunch (pork + halal beef sausage) | the halal plate is the halal beef sausage |
| 7 | No Turkey | Halal | 1006 × Wk3 FRI breakfast | the meal ticks pork and turkey |
| 8 | GF | Vegan, note from the main meal | 301a × 5 meals whose vegan line has wheat or gluten and the main doesn't | Wk2 THU dinner: vegan sausages (wheat), no "gluten-free" |
| 9 | No Beans | Vegan, as #8 | 301a × Wk3 SUN dinner | the vegan line has beans; the main doesn't |

#1–7 are the missing note rows (F8). #8–9 are notes read from the main meal instead of the plate eaten (F9). #3–4 are also the Soft Meals priority question (F10), and #5 the pork-day merge (F11).

**Not findings:**
- No Turkey on Regular: 7 meals, named by Regular-with-notes.
- Diabetic and Low Carb: every row carries "extra veg less starch".
- Every resident is seated exactly once on all 84 meals, and no printed section is empty.

**For A5, not routing:** Wk3 FRI breakfast "Turkey, Cheese and Eggs…" ticks pork. The menu text names none.

## 9. Forks — ruled 2026-10-18

**Jason ruled every lean** (2026-10-18, two rounds of questions):
- line notes: "Yes, both";
- Soft Meals: "Keep order, note soft";
- lockout: "Per meal everywhere";
- routing file: "Follow plating";
- the four small gaps: all four;
- the three keep-as-is leans: "Yes, keep all three".

So each fork's lean below is now the Rule, and the oracle is written from it. Each fork was:

From the plan (§6):
- **F1 — Lockout scope** (L6): per meal everywhere, or per day everywhere? [per meal everywhere; the plating sheet is the authority, and the lookup and preview say "Lunch: … · Dinner: …"]
- **F2 — Bland Diet** (L3): route with No Spicy, or retire it into No Spicy? [route with No Spicy]
- **F3 — No Mustard** (L4): join "No Egg / Mustard" on a mustard meal? [yes]
- **F4 — No Molluscs:** route like No Shellfish on a shellfish meal? [yes]
- **F5 — GF tier** (L10): auto, as its note says, or doc, as today? [keep doc]
- **F6 — Accommodations no rule reads** (Low Sodium, Low Fat, Low Potassium, No Fried Food, Other): text only, or a flag and a note? [text only; A4 confirms they print]
- **F7 — Taking a room off the anaphylactic list** (L7): also clear the resident's flag? [yes, with the one confirm DOOR already asks]

New in A0:
- **F8 — The line rule (R0).** Add the missing line notes, so a restriction the winning plate doesn't serve is named:
  - No Spicy "not spicy";
  - No Beef "no beef";
  - No Turkey "no turkey";
  - No Processed Food "no processed meat";
  - Soft Meals "soft", when seated outside the soft plate and outside a pork-day Halal merge.

  [yes; it only adds notes, and covers §8 #1–7]
- **F9 — Notes read the plate eaten.** A Vegan-section row's notes read the vegan line's allergens as well as the main meal's. [yes, the union; it only adds notes; §8 #8–9, and #2 once F8 exists]
- **F10 — Soft Meals priority.** Soft is p9, so any other open section wins over it. [keep the order, and name "soft" on the line (F8): Halal, Vegan, GF and No Dairy plates can't be dropped for texture]
- **F11 — Pork-day No Processed → Halal.** [keep the merge; F8 names "no processed meat"]
- **F12 — The routing file follows the plating engine.** Its section counts read the same flags as the sheets (`_altMeals`, `noPorkAlt`, `_vegAltSafe`, smart defaults). [yes; today only the 3 meals in §6 change, Soft 0 → 2]

## 10. Result (2026-10-18)

### Gates (all in `tests/`, run by CI; each red on `main` `66e0bec`)
- **`tests/helpers/routing_oracle.mjs`** — the rules above as a small reference model (plate, required notes, lockout). It is written from this table, not from `computeSections`.
- **A1 `tag_table_consistency_gate`** (7, red 5): every name a table uses is a real tag and every flag a real flag; one tier set per tag; every routing tag sits in a section; no doubled rows; every tag the anaphylactic picker offers is contained (No Oats the one exception); every line-noted tag is conflict-checked; and the per-tag census.
- **A2 `routing_oracle_gate`** (8, red 5): every single tag, every pair of the 19 tags that route and the published tag sets (about 240 residents) × 792 meals, through the real `computeSections` and line notes against the oracle, plus a mutation check (a dropped trigger, Soft moved up, the 2026-10-16 Bland → GF guard removed: each is caught).
- **A3 `anaph_matrix_gate`** (12, red 11): every lockout tag × every flag × 4 ways of being anaphylactic, with roommates, for lockout, the alert, the display and `routeResident`; per-meal scope; the list's Remove; the Daily Entry queue, the Intake Portal and a room switch; the toggle; 813's label; the Regular tidy.
- **A4 `routing_replay_gate`** (6, red 3): the published residents through the published menu with the real `computePlatingData`, seat and line against the oracle, and the §8 receipt.

### Receipts (`tests/browser/`, real Chromium, not in CI)
- **A4** `routing_replay.mjs` → `DOOR_ROUTING_REPLAY_RECEIPT_2026-10-18.md` and a CSV of all 14,028 resident × meal rows: **0 disagreements with the oracle**. The routing file it regenerates equals the checked-in one, and it lists what the rebuild moves against `main`'s copy.
- **A5 + A6** `flag_resident_census.mjs` → `DOOR_FLAG_RESIDENT_CENSUS_2026-10-18.md`: where meal flags come from, and the resident data.
- **A8** `staff_walkthrough.mjs` → `docs/receipts/walkthrough_2026-10-18/` (51 checks at 1280 and 390 px in Toronto time, with screenshots): room 213's lookup, the sheets the audit changed, the swap day (also at 8:30 pm), the halal plate, the labels, and the review's fixes.

### Found during the audit, beyond §8, and fixed (each ruled or inside a ruling)
- **Swap and special-meal days** (F13, Jason: "Yes, and the routing file too"). Plating sheets and `routing_by_meal.json` routed the rotation meal. The Nov 3 swap (Halal Beef Burger for Wk2 TUE's tuna sandwich) would have seated No Beef residents 704 and 901 on Regular. The sheet now routes the swap and says "Swap for Nov 3 — replaces the rotation meal". `getMealForDate` read swaps by the UTC date, so after 8 pm in Toronto today took tomorrow's; it reads the local date now.
- **The Enter Changes anaphylactic toggle** read a class it never has, and on an update it started off. Every Intake Portal update took the room off the anaphylactic list and cleared its flag, even with the toggle switched on. Now the toggle reads its class and starts from the resident. Switching it off asks once (`doorAskTakeOffAnaphList`), and the answer travels with the queued change. A Daily Entry update no longer resets the flag, and a room switch takes the list entry along. (Rule: "no path takes a room off the list without a deliberate act".)
- **The list's Remove** asks once and clears the flag (F7).
- **The halal plate's own dish** reaches its line: its CONTAINS and its rows' notes read the linked halal dish over the main meal (F9's principle). 304 (Halal + No Eggs) gets "no egg" on Wk2 SAT's halal breaded chicken burger.
- **Menu ticks** (Jason, on the census):
  - Spicy on Wk1 TUE dinner;
  - Processed Meat on Wk3 SAT dinner (614b would have eaten pepperoni pizza on Regular);
  - Gluten on Wk3 WED lunch ("Flour" tortillas);
  - Beans on the Nov 3 swap's chickpea salad.

  No Spicy on the Beef Nachos.
- **813** (anaphylactic, no restriction recorded) gets a red label and a restriction-sheet row.
- **56 Regular residents left Provisional** read N/A at load ("Tidy to N/A"). 813 stays Provisional.
- **Smaller fixes:**
  - the April 27 registry patch (tags by room number for April's residents) is retired;
  - a bare "and" on import is no longer a question;
  - the diagnostics core reads the list;
  - No Processed Food is conflict-checked;
  - the two copies of each plating renderer's chains are one function each (`doorSectionLineNotes`, `doorSectionAllergenStr`).

### Independent review: FIX-BEFORE-SHIP, folded (`v31-standard.33`)
PR #126 merged before these fixes reached it, so they ship as their own build.

A second reader checked the whole `index.html` diff in the real page, in Toronto time, against `main`. Confirmed sound:
- the week arithmetic, the date keys and breakfast;
- every field a swap drops;
- the routing counts (only the expected meals move);
- no plating note dropped across all 84 meals; the only additions are the ruled ones;
- the memo can't keep a load-time fallback.

Found and fixed:
- **P1, editing a queued Intake Portal item.** The room lookup, 250 ms later, put the resident's toggle back over the item's, so a queued anaphylactic update was re-added as not anaphylactic. Its tags were never put back either: the reader looked for markup the form doesn't have. Now `editQueueItem` looks the room up first, then puts back the item's own tags and toggle.
- **P1, a new intake over an occupied room.** The record kept the last resident's picked anaphylactic tags, so a new resident switched on for peanuts was contained on coconut instead. Both the direct save and the Intake Portal now start the new resident's anaphylactic state, moderate allergy and note fresh, as the Daily Entry queue already did.
- **P2, the Daily Entry queue editor.** Unchecking anaphylactic was ignored when the queue was applied. It now asks once, the answer travels with the change, and ticking it again undoes it.
- **P2, the halal plate.** Wk4 FRI's said PORK: the "Tandoori Chicken" slot carries a copied pork tick. A halal plate never lists pork now.
- **P2, the evening date.** After 8 pm, today's swap was pruned by the UTC date, and the prune was published. Every swap and special-meal "today" and key is now the local day (`doorDateKey`), including the boot sync.
- **P2, today's sections** were worked out from the built-in list before the saved one was read. They now follow every load and save of the resident list (`doorRefreshBaseSections`).
- **P3s:**
  - a pre-filled toggle no longer rides to the next room;
  - "Keep it anaphylactic" in Add Change keeps the Anaphylactic label;
  - the file previews list 813;
  - the diagnostics core decides Stop / Review from the flag or the list;
  - the import waits for review before adding No Eggs, No Mustard or No Molluscs, which route.

Each fix is pinned: `anaph_matrix_gate` (behaviour where a vm can run it, the source where it is DOM-bound), `routing_replay_gate` (no halal PORK), and the walkthrough (the editor, the toggle, the evening swap and today's sections in the real page).

### Downstream (A7)
- **EXPO and HUB** read only the Regular, Halal and Vegan counts (frozen-stock pulls) and `_components` (portion links). The new section labels (Bland, Soft, No Pork, Anaphylactic Alternative) are ignored safely.
- Neither reads `isAnaph` or the anaphylactic list from `door_state.json`, so 213's flag-vs-list drift doesn't reach them. `_components` leave anaphylactic residents out, as before.
- **Neither reads `meal_swaps.json`.** The routing file now carries the Nov 3 swap's counts for Wk2 TUE lunch, but EXPO's board (and so HUB's) still plans the rotation's tuna sandwich. HUB's portion link for the tuna sandwich finds no match and opens unscaled, so nothing goes wrong. EXPO doesn't know about a swap at all — an EXPO question, open below.

### Open (for Jason)
- ~~**Room 813** is on the anaphylactic list with no allergen recorded, so DOOR can't contain anything for it.~~ Found (2026-10-18, Jason: "what is up with 813"): the listing was the last resident's. They were lactose-free, no wheat, no shellfish, marked anaphylactic on Apr 30 with shellfish contained; the Sep 11 import discharged them, and an import's discharge left the room on the list. A Regular resident moved in on Sep 17 (the Oct 19 meal list still says Regular). Fixed in `v31-standard.37`: a queued discharge of a room on the list asks once at Generate; list and resident changes take the kitchen's newer list first and mark themselves newest, so a room added or taken off on one computer reaches the other. Ruled: 813 comes off by hand, in DOOR, after the fix. Gate `tests/anaph_list_reaches_gate.mjs`. Notes, the compliance actions and Undo Generate follow the same rule in `v31-standard.38` (`tests/resident_changes_reach_gate.mjs`). From `v31-standard.39`, Generate also asks about a room on the list whose restriction names none of its allergens (813 today, or a resident replaced between two imports); Jason left 813 on the list to try it (`tests/anaph_names_no_allergen_gate.mjs`).
- **213's flag** is off while its room is on the list. Harmless, since every reader uses both; the next edit sets the flag.
- ~~**EXPO and swaps:** EXPO plans the rotation meal on a swap day. Teaching EXPO to read DOOR's swaps would be its own EXPO line.~~ Being built (Jason, 2026-10-18: "Do the EXPO swap work here"): EXPO plans a slot's next service as DOOR's swap or special meal, by the same rule as the plating sheet, and HUB shows it.
- **The Nov 3 swap was left over, and is removed** (Jason, 2026-10-18: "Remove it"; `v31-standard.34`). On Oct 7 someone swapped Wk2 TUE ⇄ THU lunch on a Wednesday, then set the rotation back to the workbook order. The slot swap gave each half its own next date (Thursday's on Oct 8, Tuesday's on Nov 3), and that tablet's Make Permanent was the old one, which didn't clear swaps. A revert never reached the other DOOR computers either. Both are fixed: a revert is published (`meal_swaps_reverted.json`), and a slot swap's halves land as far apart as the meals are on the menu. Gate `tests/swap_revert_reaches_gate.mjs`. The routing file's Wk2 TUE lunch is the rotation's again.
- **No Oats, Lupin, Buckwheat** have no flag. CODEX has no Mushroom or Beans family (L11).
- **Butter Chicken:** DOOR's dish-name reader says dairy; CODEX's recipe has none. Left; CODEX owns allergens.

