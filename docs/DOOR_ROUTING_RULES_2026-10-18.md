# DOOR routing rules — the table the audit tests against (2026-10-18)

Audit phase **A0** of `DOOR_TAGS_ANAPH_ROUTING_AUDIT_PLAN_2026-10-18.md`. Jason, 2026-10-18: "start the rules table for the audit; complete audit as autonomously as possible".

**How to read it.**
- **Code** is what `index.html` does at `a9d65f8` (`v31-standard.32`).
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
| 3 | No Fish / Shellfish → Vegan | No Fish, No Shellfish | `hasFish`, `hasShellfish` | the vegan line | as Vegan |
| 4 | Gluten Free | GF | `hasGluten` | `gfAlt` | gluten |
| 5 | No Dairy → Vegan | No Dairy, Lactose Intolerant | `hasDairy` | the vegan line | as Vegan |
| 6 | No Beef → Vegan | No Beef | `hasBeef` | the vegan line | as Vegan |
| 7 | Diabetic / Low Carb | Diabetic, Low Carb | `isCarb` | the main, less starch | nothing more |
| 8 | Bland | No Spicy | `isSpicy` | the main, plain | spice |
| 9 | Soft Meals ("Alternative Meals") | Soft Meals | always | `softAlt` / `altMeals` | — (texture) |
| 10 | No Egg / Mustard | No Eggs | `hasEgg` | the main without egg or mustard | egg, mustard |
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
| GF | 5 | routing | gf (hasGluten) | hasGluten | "gluten-free" | hasGluten | doc* | F5, F9 |
| Lactose Intolerant | 4 | routing | no_dairy → vegan (hasDairy) | hasDairy | "dairy-free" | not offered | auto | |
| No Dairy | 4 | routing | no_dairy → vegan (hasDairy) | hasDairy | "dairy-free" | hasDairy | doc | |
| No Fish | 4 | routing | no_fish → vegan (fish, shellfish) | hasFish | "no fish" | hasFish | auto | |
| No Spicy | 4 | routing | bland (isSpicy) | isSpicy | **–** | not offered | doc | **F8** |
| Vegan | 4 | routing | vegan (always) | – | – | not offered | auto | |
| Soft Meals | 3 | routing | soft (always) | – | **–** | not offered | doc | **F8, F10** |
| No Beans | 2 | accom | – | hasBeans | "no beans" | not offered | auto | F9 |
| No Beef | 2 | routing | no_beef → vegan (hasBeef) | hasBeef | **–** | hasBeef | auto | **F8** |
| No Eggs | 2 | routing | no_egg (hasEgg) | hasEgg | "no egg" | hasEgg | doc | |
| No Peanuts | 2 | allergen | – | hasPeanuts | "NO PEANUTS" | hasPeanuts | doc | |
| No Shellfish | 2 | routing | no_fish → vegan | hasShellfish | "no shellfish" (fish or shellfish) | hasFish, hasShellfish | doc | |
| Low Carb | 1 | accom | diabetic (isCarb) | – | "extra veg less starch" | not offered | doc | |
| Low Fat, Low Potassium | 1 each | accom | – | – | – | not offered | doc | F6 |
| No Coconut | 1 | allergen | – | hasCoconut | "no coconut" | hasCoconut | doc | |
| No Corn | 1 | accom | – | hasCorn | "no corn" | not offered | doc | |
| No Molluscs | 1 | allergen | **– (not routed)** | hasShellfish | "no molluscs" | hasFish, hasShellfish | doc* | **F4** |
| No Mushroom | 1 | accom | – | hasMushroom | "no mushroom" | not offered | auto | |
| No Processed Food | 1 | routing | no_processed (hasProcessedMeat) | **–** | **–** | not offered | doc | **F8, F11** |
| No Soy | 1 | allergen | – | hasSoy | "no soy" | hasSoy | doc | |
| No Tree Nuts | 1 | allergen | – | hasTreeNuts | "no tree nuts" | hasTreeNuts | doc | |
| No Turkey | 1 | accom | – | hasTurkey | **–** | not offered | auto | **F8** |
| Bland Diet | 0 | **routing** | **– (no rule lists it)** | – | – | not offered | doc* | **F2** |
| No Brassicas | 0 | accom | – | hasBrassicas | "no broccoli/cauliflower/cabbage" | not offered | auto | |
| No Fried Food | 0 | accom | – | – | – | not offered | doc | F6 |
| No Mustard | 0 | allergen | **– (not in "No Egg / Mustard")** | hasMustard | "no mustard" | hasMustard | doc | **F3** |
| No Nightshades | 0 | allergen | – | hasNightshades | "no tomato/potato/pepper" | hasNightshades | auto | |
| No Oats | 0 | allergen | – | **–** | **–** | offered, **no flag** | doc* | L11 |
| No Sesame, No Sulphites | 0 | allergen | – | own flag | own note | own flag | doc | |
| Other | 0 | accom | – | – | – | not offered | doc* | F6 |

**Read with §8.** A bold dash is a restriction DOOR can't name on a line. When a higher section wins, the restriction goes unserved and nobody is told.

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

| Reader | Scope today |
|---|---|
| Plating sheets, labels, `routing_by_meal.json` | per meal |
| `routeResident` (Daily Entry preview, room lookup), `computeBaseSections` (home headcount) | per day (lunch or dinner) |

  On a day with a dinner-only allergen, 213's lunch shows "Anaphylactic Alternative" in the lookup, the preview and the home count, while the lunch plating sheet seats 213 in Soft Meals. The live days: the 9 meals in `.31`'s receipt.
- **Rule** ("anaphylactic flags are sacred"): no path takes a room off the list without a deliberate act, and every surface shows the same answer for the same meal.

## 6. Outputs and the flags each reads

| Output | Engine | Flags it reads |
|---|---|---|
| Plating sheet, labels, Regular-with-notes | `computePlatingData` → `computeSections` | meal flags + smart defaults + `_vegAltSafe` + `noPorkAlt` + `_altMeals` |
| `routing_by_meal.json` section counts | `buildRoutingByMealJSON` → `computeSections` | **raw meal flags only** |
| `routing_by_meal.json` `_components` | `computePlatingData` | as the plating sheet |
| Daily Entry preview, room lookup | `routeResident` → `computeSections` | today's `MEAL_DATA` (raw), per day for anaphylaxis |
| Home headcount | `computeBaseSections` | lunch only, per day for anaphylaxis |
| Generate conflict check | `checkResidentMealConflicts` | `RESIDENT_TO_MEAL_FLAG` |

**Measured (F12):** the routing file's section counts disagree with the plating sheets on 3 meals:
- Wk1 TUE dinner (Pork Carnitas);
- Wk3 THU dinner (Pork Griot);
- Wk4 FRI dinner (Tandoori Pork).

They are pork days with alternative meals. The plating engine keeps two Soft Meals residents, 213 and 711, on their alternative. The file merges them into Halal, because it doesn't read `_altMeals`. (709 holds No Pork, so it sits in Halal either way; see §8 #4.) The file says Halal 56 / Soft 0; the sheet says Halal 54 / Soft 2. EXPO's board reads the file.

## 7. Compliance tiers

`requiresDocumentation`: a resident needs documentation when any of their tags is doc-tier, or not listed (doc*).
- GF is not listed: `COMPLIANCE_TIERS` lists "Gluten Free", so GF counts as doc (F5).
- Lactose Intolerant is auto (ruled 2026-10-18).

## 8. Findings so far (published data, real page)

Each is a resident × meal where a restriction the meal sets off is neither served by the plate nor named on the line.

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
