# DOOR — tags, anaphylaxis and routing: full audit plan (2026-10-18)

**Ask.** Jason, 2026-10-18: "Plan a full audit to test all tags and anaphs especially to ensure routing behaviour is accurate with no bugs." **Plan only.** The one code change in this branch is the `v31-standard.31` work already in PR #125.

**Why now.** The shellfish thread (`v31-standard.30` / `.31`) found several bugs of one shape in a single afternoon: a rule existed, and another table quietly didn't read it.
- CODEX's Crustaceans and Molluscs labels set no flag.
- A shrimp meal opened no section and contained no anaphylactic resident.
- Nine anaphylactic tags did nothing when ticked.
- Room 213 was contained but never shown red.
- The gluten note matched a tag no resident has.
- Special meals dropped most of their flags.

Each was found by tracing one path by hand. This audit traces every path on purpose, against rules written down first.

---

## 1. What "accurate" means — an oracle, not the code

The audit never checks DOOR against itself. **A0** writes the intended rules as one table. That table becomes a small **reference model** (`tests/helpers/routing_oracle.mjs`), written from the table and *not* by reading `computeSections`. The audit then runs both on the same inputs and lists every disagreement. Each disagreement is either:
- a bug: DOOR is wrong, and it gets a fix PR;
- a rule gap: the table didn't say, so it goes to Jason for a ruling;
- an oracle error: fix the oracle and note it.

For one resident and one meal, the oracle answers:
1. **Plate:** which section they eat from (or the Anaphylactic Alternative), and that it is exactly one section that prints.
2. **Notes:** what their plating-sheet line and label say ("no shellfish", "gluten-free", "⚠ ANAPHYLACTIC").
3. **Alerts:** whether they appear in the Generate conflict check, the Today alerts, the week-ahead list and the anaphylactic alert.
4. **Lockout:** whether their room and roommates are contained, per meal and per day.
5. **Counts:** what `routing_by_meal.json` and `registry_summary.json` count for them.

## 2. Inventory — what is under test

### 2.1 Resident tags (census of the published list, 167 residents)
Columns:
- **section:** the `ROUTING_RULES` section it routes to, and the flags that open it;
- **conflict:** `RESIDENT_TO_MEAL_FLAG`;
- **note:** `CONFLICT_MAP`;
- **lockout:** `ANAPH_TAG_TO_MEAL_FLAG`;
- **tier:** `COMPLIANCE_TIERS`, where "doc*" means not listed, so documentation is required by default.

| Tag | Residents | Tier set | Section (opens on) | Conflict | Note | Lockout | Compliance |
|---|---|---|---|---|---|---|---|
| Halal | 37 | routing | halal (pork, or non-certified meat) | – | – | – | auto |
| No Pork | 18 | routing | halal | hasPork | – | – | doc |
| Diabetic | 16 | routing | diabetic (isCarb) | – | – | – | doc |
| Vegetarian | 7 | routing | vegan (always) | – | – | – | auto |
| **Low Sodium** | **6** | accom | – | – | – | – | doc |
| GF | 5 | routing | gf (hasGluten) | hasGluten | hasGluten | hasGluten | doc* |
| Lactose Intolerant | 4 | routing | no_dairy → vegan | – | hasDairy | – | auto |
| No Dairy | 4 | routing | no_dairy → vegan | hasDairy | hasDairy | hasDairy | doc |
| No Fish | 4 | routing | no_fish → vegan (fish, shellfish) | hasFish | hasFish | hasFish | auto |
| No Spicy | 4 | routing | bland (isSpicy) | isSpicy | – | – | doc |
| Vegan | 4 | routing | vegan (always) | – | – | – | auto |
| Soft Meals | 3 | routing | soft (always) | – | – | – | doc |
| No Beans | 2 | accom | – | hasBeans | hasBeans | – | auto |
| No Beef | 2 | routing | no_beef → vegan | hasBeef | – | hasBeef | auto |
| No Eggs | 2 | routing | no_egg (hasEgg) | hasEgg | hasEgg | hasEgg | doc |
| No Peanuts | 2 | allergen | – | hasPeanuts | hasPeanuts | hasPeanuts | doc |
| No Shellfish | 2 | routing | no_fish → vegan | hasShellfish | hasFish, hasShellfish | hasFish, hasShellfish | doc |
| Low Carb | 1 | accom | diabetic (isCarb) | – | – | – | doc |
| **Low Fat**, **Low Potassium** | 1 each | accom | – | – | – | – | doc |
| No Coconut | 1 | allergen | – | hasCoconut | hasCoconut | hasCoconut | doc |
| No Corn | 1 | accom | – | hasCorn | hasCorn | – | doc |
| No Molluscs | 1 | allergen | – (not routed) | hasShellfish | hasShellfish | hasFish, hasShellfish | doc* |
| No Mushroom | 1 | accom | – | hasMushroom | hasMushroom | – | auto |
| No Processed Food | 1 | routing | no_processed | – | – | – | doc |
| No Soy | 1 | allergen | – | hasSoy | hasSoy | hasSoy | doc |
| No Tree Nuts | 1 | allergen | – | hasTreeNuts | hasTreeNuts | hasTreeNuts | doc |
| **No Turkey** | 1 | accom | – | hasTurkey | **–** | – | auto |
| **Bland Diet** | 0 | **routing** | **– (no rule lists it)** | – | – | – | doc* |
| No Brassicas | 0 | accom | – | hasBrassicas | hasBrassicas | – | auto |
| **No Mustard** | 0 | allergen | **– (not in "No Egg / Mustard")** | hasMustard | hasMustard | hasMustard | doc |
| No Nightshades | 0 | allergen | – | hasNightshades | hasNightshades | hasNightshades | auto |
| **No Oats** | 0 | allergen | – | **–** | **–** | **–** | doc* |
| No Sesame, No Sulphites | 0 | allergen | – | own flag | own flag | own flag | doc |
| No Fried Food, Other | 0 | accom | – | – | – | – | doc / doc* |

The table is reproduced by `tag_census` (A1). The audit re-runs it on every phase's branch.

### 2.2 Meal flags and where they come from
There are 25 flags (`FLAG_DEFS`). For each source, the audit asks: **does it set every flag its content implies?** The sources:
- **Menu workbook import:** the Intake allergen row (`allergenStrToFlags`) and the dish name (`nameDetectFlags`).
- **Load-time text detection:** brassicas (`doorApplyTextDetectedFlags`).
- **Edit Menu:** ticks, slot pills, linked CODEX recipes (`hubAllergenToFlags`, with meat union), and a dish linked by default (V7).
- **The CODEX feed plus the shared Library overlay** (Option C).
- **The vegan plate's floor and lookups** (`mergeVegAltAllergenFloor`, `getVegAltSlotAllergenStr`, declared-free).
- **Special meals** (`smMealFlagsRaw`, `resolveFlags`), **swaps** (`_flagsRaw`), and **menu edits and the overlay** (newest-edit-wins, cutover pruning, the one-time `sweepAltFlagPollution`).
- **Defaults:** `halalCertifiedMeat` for non-pork meat, and `_vegAltSafe`.

### 2.3 Anaphylaxis — two fields, many readers
- **Two sources:** `r.isAnaph` and the anaphylactic room list (`anaphRooms`). Since `.31`, every reader goes through `doorIsAnaphResident`.
- **Scope:** `anaphTags`, or every tag when no anaphylactic tags are picked.
- **Readers:**
  - lockout: `getAnaphConflictRooms`, both per day and per meal;
  - `routeResident`;
  - the alert (`getAnaphAlertInfo`) and the plating ALERT;
  - the Anaphylactic List, labels, the restriction sheet, the week-ahead lines, and the counts.

### 2.4 Outputs that must agree
1. `computeSections`: sections and seating.
2. `computePlatingData`: the plating sheets, Regular-with-notes, ingredient notes and the ALERT.
3. `buildRoutingByMealJSON`: counts and `_components`.
4. Labels: the xlsx and the print.
5. The restriction sheet and the Anaphylactic List.
6. The Today alerts and the week-ahead conflict list.
7. The room lookup and the Daily Entry route preview (`routeResident`).
8. The Generate conflict check (`checkResidentMealConflicts`).
9. Compliance tier and Confirmed / Provisional (`requiresDocumentation`).
10. Downstream: EXPO's board (section counts) and HUB (routing, `_components`, door_state).

## 3. Leads found while scoping (verify first; none changed here)

**Confirmed (seen in the real page):**
- **L1 — "GF" in a raw restriction parses to nothing, silently. FIXED in `v31-standard.31`** (PR #125, with DF as No Dairy, Jason 2026-10-18; gate `restriction_short_codes_gate`). `normalizeRestriction('GF')` returns no tag, with nothing unmatched and nothing ambiguous. "GF, No Pork" gives only No Pork. GF is DOOR's own label for gluten-free. A re-import of a resident list that writes "GF" would drop the tag with no question asked.
  - Today's five GF residents keep their stored tag.
  - Compare "No Gluten", which is at least flagged as unmatched for review.
  - **Lean: fix first,** as its own PR: "GF" → `glutenFree`, plus "No Gluten" and "Celiac" asked about as today.
- **L2 — RULED and DONE in `v31-standard.31`** (Jason, 2026-10-18: "Lactose intolerant should be no dairy too"; gate `lactose_no_dairy_gate`). **"Lactose Intolerant" re-parses to also add No Dairy**, but two stored records (1207, 301a) lack No Dairy. The data and the parser disagree. Routing is the same either way (both route to no_dairy), but the conflict check differs: Lactose Intolerant has no `RESIDENT_TO_MEAL_FLAG` entry.

**To verify (from the census table):**
- **L3 — Bland Diet is a routing tag that no section lists.** The Bland section reads No Spicy only. A Bland Diet resident would eat the regular plate. Nobody has the tag today.
- **L4 — No Mustard isn't in the "No Egg / Mustard" section,** which opens on hasEgg only. A mustard meal with no egg seats No Mustard residents on Regular, with a note. `_vegAltSafe` does read mustard.
- **L5 — No Turkey has a conflict check but no plating-sheet note.** Low Sodium (6 residents), Low Fat, Low Potassium, No Fried Food and Other are read by no rule; check they at least print as text.
- **L6 — Lockout is per meal on plating sheets, labels and the routing file, but per day in the room lookup, the Daily Entry preview and the home headcount** (`getAnaphConflictRooms(lunch, dinner)`). A dinner-only allergen moves a resident's lunch in some views and not others. This needs a ruling.
- **L7 — The isAnaph drift sources.**
  - The queue apply (`r.isAnaph = c.isAnaph || false`) and the import queue entries (`isAnaph: false`) reset the flag. Since `.31` that is harmless to display, but it is still data drift.
  - `removeAnaphRoom` leaves `r.isAnaph` set, so a room taken off the list stays contained.
- **L8 — The "& Mollusks" slash form.** Room 504's raw "Halal/No Fish/No Shellfish & Mollusks)" re-parses without No Molluscs, while "No Shellfish & Mollusks" alone gives both.
- **L9 — `checkResidentMealConflicts`' comment says routed residents aren't re-flagged; the code re-flags them.** Check for duplicate notes.
- **L10 — The compliance tiers name "Gluten Free", not GF,** so GF is doc-tier. That is the safe default; it needs a ruling.
- **L11 — No Oats has no flag,** and CODEX's Oats label is ignored. CODEX has no Mushroom or Beans family. DOOR has no flag for Lupin or Buckwheat.
- **L12 — The unwired diagnostics core** (`computeDoorComplianceDiagnostics`) still reads `resident.isAnaph` alone.

## 4. Phases

Each phase is its own PR. **The first PR adds tests and receipts only, with no behaviour change.** Fixes follow per finding class, after rulings. All gates are node tests in `tests/`, like `pork_day_bland_gate`, plus one real-browser replay.

### A0 — Write the rules down (doc + rulings; ~½ day)
**Deliverable:** `docs/DOOR_ROUTING_RULES_2026-10-18.md`, one table:
- per tag: its section, the flags that open it, its conflict, note, lockout and tier;
- the section priority and every merge: `mergeInto`, pork-day Soft → Halal, Bland → GF only while GF is active, the No Pork split, No Egg → vegan when `_vegAltSafe`;
- day vs meal scope.

Every cell the code disagrees with, or the table can't fill, becomes a fork for Jason (§6).

### A1 — Static consistency gate (~½ day)
`tests/tag_table_consistency_gate.mjs`:
- **Real names:** every key in `RESIDENT_TO_MEAL_FLAG`, `ANAPH_TAG_TO_MEAL_FLAG`, `CONFLICT_MAP`, `COMPLIANCE_TIERS` and the `ROUTING_RULES` tags is a real tag label. Every flag they name is a `FLAG_DEFS` key.
- **Tier sets:** every tag in a tier set has the behaviour A0 gives it; for example, every routing tag is in some rule's tags (catches L3).
- **No duplicates:** no row twice.
- **Lockout coverage:** every tag the anaphylactic picker offers is either in the lockout map or listed as unflaggable.
- **The census:** the table in §2.1 is generated and diffed, so a new tag fails here by name.

### A2 — Routing matrix against the oracle (~1–2 days)
`tests/routing_oracle_gate.mjs`, using the oracle from A0.
- **Residents:**
  - every single tag;
  - every pair of routing tags (16 tags, 120 pairs; Low Carb also routes);
  - the real published tag sets, de-duplicated;
  - with and without Soft Meals or Halal.
- **Meals:**
  - every single flag;
  - every pair of the flags that open a section (pork, beef, chicken, turkey, processed, fish, shellfish, gluten, dairy, carb, spicy, egg);
  - the `halalCertifiedMeat` default and explicit false;
  - `_vegAltSafe` true and false;
  - `noPorkAlt`;
  - every published meal (84, plus the overlay days).
- **Checks:**
  - each resident is seated exactly once, in a section that prints;
  - the section matches the oracle;
  - merges are reported (`_mergedLabels`);
  - no section prints empty.

  The 2026-10-16 "No Spicy had no plate" bug is this class.
- **Mutation check:** flip one rule (drop a trigger, swap a priority) and confirm the gate goes red.

### A3 — Anaphylaxis matrix (~1 day)
`tests/anaph_matrix_gate.mjs`. Every lockout tag × every flag × lunch / dinner / both × anaphylactic tags picked or not × flag set or only on the room list × roommates (a/b rooms, case) × Settings remove versus editor uncheck. For each case, check every reader in §2.3 agrees with the oracle:
- lockout, per meal and per day;
- the Anaphylactic Alternative from `routeResident` and the room lookup;
- the alert;
- the plating ALERT allergens;
- the labels and the restriction sheet shown red;
- the Anaphylactic List;
- the week-ahead line;
- the counts in `routing_by_meal.json` and `registry_summary.json`.

It also covers L6 and L7, and the "never silently overridden" rule: no path takes a room off the list without a deliberate act.

### A4 — Published-data replay, in a real browser (~1 day)
`tests/routing_replay_browser.mjs` loads DOOR with the published `menu_current` + `menu_overlay` + `door_state` (residents and anaphylactic list). For every meal it runs the real `computePlatingData`, `buildRoutingByMealJSON`, labels and alerts.
- **Receipt:** `docs/DOOR_ROUTING_REPLAY_RECEIPT_2026-10-18.md`, plus a CSV of every resident × meal: their plate, notes, alerts and lockout.
- **Diff:** against the oracle.
- **Freshness:** regenerated routing must equal the checked-in `routing_by_meal.json`, or the difference is explained, such as the published file being older.
- **Review:** every disagreement is listed for review, meal by meal.

### A5 — Flag-source audit (~1 day)
For each source in §2.2, a census of the published data:
- **Recipes behind ticks:** meals whose ticks are behind their linked recipes' allergens, as in the 57 ticks of 2026-10-16. Uses CODEX's 240 recipes, the templates and the shared Library.
- **Dish-name words:** dish names that name an allergen the meal doesn't tick.
- **Vegan plates:** vegan plates whose floor misses a slot's recipe.
- **Special meals and swaps:** they carry the flags of their dishes.
- **Fresh tablet:** a fresh tablet's one-time sweep and the cutover don't drop a flag, replayed on a clean profile.
- **CODEX labels:** every CODEX label reaches a flag (`shellfish_families_gate` covers this today; extend it to the shared Library).

### A6 — Resident data drift (~½ day)
- **Re-parse:** every resident's raw restriction, diffed against their stored tags (L1, L2, L8).
- **Anaphylactic fields:** `isAnaph` against the room list against `anaphTags` (L7).
- **Tiers:** tier and confirm state against `requiresDocumentation`.

Output: a list for Jason of residents whose stored tags differ from what their restriction says. **No resident data is changed by the audit**; corrections are made in DOOR by staff, or by a ruled migration.

### A7 — Downstream: EXPO and HUB (~½ day; needs those repos)
- EXPO's board takes the replay's section counts and "Anaphylactic Alternative", including the 9 room-213 meals from `.31`.
- HUB's portions read `_components`, which excludes anaphylactic residents.
- Neither app reads `isAnaph` from `door_state.json` in a way that misses the room list.

### A8 — Staff walkthrough, real browser at 1280 and 390 (~½ day)
Walk five representative residents through Daily Entry → Generate → plating sheet → labels → Today alerts:
- room 213 (anaphylactic, tree nuts and coconut);
- a Halal + No Shellfish resident;
- a GF + Vegetarian resident;
- a No Spicy resident on a pork day;
- a Soft Meals resident on a pork day with alternatives.

Screenshots go in the receipt.

## 5. Order, effort, cut

1. ~~**L1 fix first** (GF parsing)~~ done in `v31-standard.31`.
2. **A0** plus Jason's rulings.
3. **A1–A3 gates**, as one tests-only PR. Expect red rows: they *are* the findings list.
4. **A4 replay receipt**, then **A5 / A6 censuses**, as a tests-and-receipts PR.
5. **Fix PRs**, one per finding class, each with its row of the gate turning green.
6. **A7 / A8** before closing.

The total is about 6–8 working days. No published artifact changes until a fix PR says so and gives its receipt.

**Not in scope:** CODEX's own allergen reading (the CODEX audit line owns it), the menu content itself, EXPO's scheduling logic, and anything reno-menu (`menu_reno.json` is generated in EXPO).

## 6. Rulings this plan already needs (forks; leans in brackets)

1. **Lockout scope** (L6): per meal everywhere, or per day everywhere? [per meal everywhere, since the plating sheet is the authority; the room lookup says "lunch: …, dinner: …"]
2. **Bland Diet** (L3): route to Bland with No Spicy, or retire the tag into No Spicy? [route with No Spicy]
3. **No Mustard** (L4): join "No Egg / Mustard" on a mustard meal? [yes, the section's own name says so]
4. **No Molluscs routing:** route to No Fish / Shellfish like No Shellfish? [yes on a shellfish meal; it is a note-and-lockout tag today]
5. ~~**Lactose Intolerant** (L2)~~ ruled 2026-10-18: it is No Dairy too, and it needs no documentation of its own. Done: the conflict check, one note, and the import no longer adds a doc-tier No Dairy for it; today's re-import proposes nothing.
6. **GF tier** (L10): auto, as its note says, or doc, as it does today? [keep doc until Jason says]
7. **Accommodations no rule reads** (L5: Low Sodium, Low Fat, Low Potassium, No Fried Food, Other): text only, or a flag and a note? [text only; A4 confirms they print]
8. **Taking a room off the anaphylactic list** (L7): should it also clear the resident's flag? [yes, with the one confirm DOOR already asks]
