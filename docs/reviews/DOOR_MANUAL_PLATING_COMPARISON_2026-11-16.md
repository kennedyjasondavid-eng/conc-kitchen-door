# DOOR registry and manual plating comparison

Comparison dated November 16, 2026, using the manual November 17 workbooks and DOOR's published registry. The **room roster agrees at 171 across all ten manual masters and DOOR**, but the sources do not yet agree on all resident instructions, meal components or alternative plates. The largest gaps are in breakfast and in meals that open an alternative section without a named dish.

The accompanying [review workbook](../../outputs/door-manual-plating-20261116/DOOR_manual_plating_comparison_2026-11-16.xlsx) contains 16 findings, all 171 registry comparisons, 84 meal plans, 537 manual/DOOR alternative-section entries and 14,366 room/meal comparison rows. The two extra room rows retain the two manual duplicate assignments rather than hiding them.

## Scope and interpretation

- Source archive: `C:\Users\Jason\Downloads\OneDrive_1_11-16-2026.zip`, ten XLSX workbooks.
- Selection follows Jason's answer: visible tabs matching the current rotation; ambiguous duplicates flagged. There are 111 visible sheets including ten Vlookup masters, and 24 hidden sheets. The comparison uses 71 distinct visible meal tabs for 84 rotation slots, with 54 alternate/hidden recipe tabs excluded. Shared breakfast tabs supply more than one week.
- Week 4 Sunday breakfast remains provisional: the visible W2/W4 Sunday tab says chicken, while DOOR says turkey. It is not silently treated as a matching protein.
- DOOR was run in isolated Chromium using the actual `computePlatingData`, `getAltMeal` and `buildDaySheet` functions. The captured current CODEX base feed and shared Library were supplied through their usual URLs. No routing algorithm was substituted. The XLSX utility stand-in only encoded cell addresses; the production builder supplied all cell values, meal descriptions and styles.
- An unlisted manual resident is marked as **standard meal inferred**; absence from a special list does not prove what staff actually served. Assignment differences are review evidence, not automatic corrections or a claim that one source is always right. Clinical appropriateness and actual ingredient batches were not established by this document.
- Workbooks, registry, menu and learned answers were not changed. The separate glyph/default-selection fix was merged in DOOR PR #202 and successfully deployed.

## Fix the completed meal plan before relying on section labels

| Finding | Scope | Evidence and implication |
| --- | --- | --- |
| Named anaphylactic alternative missing | Six slots, room 213 | W1 Mon/Wed/Fri dinner; W2 Wed dinner; W3 Thu dinner; W4 Mon dinner. DOOR correctly opens its anaphylactic section, but `anaphAlt` is empty. `buildDaySheet()` falls back to the main meal name plus prepared separately, which does not name a replacement dish. The manual sheets also omit 213 from explicit alternatives on these six slots, so copying their lists would not resolve the gap. |
| GF breakfast falls back to chicken and rice | All 28 breakfast sheets | Actual generated GF lines say Plain Roasted Chicken, Plain Rice & Stir-fried Veg. The explicit breakfast GF fields are blank. The manuals name GF cereal, bread, pancakes or other breakfast food. |
| Vegan breakfast repeats the standard description | Eleven breakfast slots | Four cereal, three vegetarian-frittata and four bagel slots repeat the same milk/egg/cream-cheese description on the vegan line. The manuals name replacements such as oat milk and tofu scramble. This is a confirmed description/plan gap, not evidence that a resident was served those ingredients. |
| Soft/plain alternative unresolved | Nineteen slots | Sixteen breakfasts, W2 Thu lunch, W3 Tue lunch and W4 Fri dinner still print `[Supervisor: specify alternative meal]`. Some manual slots name a different dish; others appear to need no separate plate. These require separate decisions. |

Four other triggered anaphylactic services do have named alternatives in DOOR: W2 Mon dinner, W3 Tue dinner, W3 Fri lunch and W4 Sat dinner. Those names broadly match the corresponding manual separate dishes. This is why the missing six should be addressed individually rather than replacing the entire anaphylactic system.

The generic GF chicken/rice/vegetable fallback also appears on nine lunches and seven dinners. That may be the intended kitchen default on some slots; the workbook exposes every use so it can be distinguished from an explicitly chosen dish. Six non-processed sections also use a generic plain-protein/rice/veg description, five at breakfast and one at lunch.

## Plain and alternative meals differ in both dish and recipients

| Slot | Manual plan | DOOR plan | Decision needed |
| --- | --- | --- | --- |
| W4 Tue lunch | `08 Lunch Week four November 17.xlsx`, TUE Ginger Beef, A28: roast chicken, vegetable stirfry, plain rice for 213, 304, 412, 709, 905 and 1007. The main at A2 names a marinated egg. | Marks no separate alternative needed; these six receive the standard beef meal. DOOR's main does not name the egg. | Confirm current main components and whether this six-person plain plate still exists. |
| W4 Tue dinner | `12 Dinner Week Four November 17.xlsx`, TUE Tandoori Pork, Briyani, A88: roast chicken and biryani for 412, 1112, 1207. | 412 and 1207 get the tofu plate; 1112 gets the halal tandoori chicken plate. The manual also lists 1112 in two groups. | Resolve the manual duplicate and choose the intended separate dish before reconciling portions. |
| W4 Fri dinner | Manual FRI Chicken Fried Rice A10 includes four GF rooms on vegan kimchi rice with the other vegan recipients. | The four GF rooms get generic chicken/rice/veg, and the soft group has a supervisor placeholder. | Confirm the vegan recipe's current allergens and the intended GF/soft meals; do not infer GF safety just from the manual name. |
| W2 Thu lunch | `06 Lunch Week Two November 17.xlsx`, THU Beef Burger A55 names a rice/chicken/veg plain plate for eight rooms. | Some get that GF plate, some get other groups, and the three soft residents have a placeholder. | Review recipients across all reasons for the plain plate; it is broader than the GF group alone. |
| W3 Tue lunch | `07 Lunch Week Three November 17.xlsx`, TUE Ginger Beef A28 names roast chicken/veg/plain rice for four rooms. | Soft residents get a placeholder; 905/1007 remain on the main with notes. | Confirm whether the manual plain plate is still the kitchen's plan. |
| W4 Mon lunch | Manual Regular Diabetics A10 specifies a whole-wheat tortilla; GF/plain group A57 also includes 711 and 1007. | No diabetic alternative is set. The four GF residents get roast chicken/yams/veg; 711/1007 remain on the main with notes. | Decide which grain substitution and plain plate should be generated, rather than comparing only group totals. |

The Alternatives sheet lists both sources' actual descriptions, groups and recipients for every selected slot. The Room comparison sheet also includes the DOOR line notes and manual footer instructions, so a retained modification is not mistaken for a missing restriction.

## Registry instructions need reconciliation even though the roster matches

| Room | Manual master says | Current DOOR fields | Assessment |
| --- | --- | --- | --- |
| 305 | No Olives, Vlookup C56 | Regular; no service note | Request is absent. Check whether its removal was intentional. |
| 301a | No tomatoes / broccoli; oat milk only, C145 | GF, lactose intolerance, vegetarian and No Beans; no service note | Those extra requests are absent. Both the printed dish and modification notes need review. |
| 405 | No Pepper / No Spicy / No Sauce; chicken/fish wording, C59 | Vegetarian, Soft Meals, No Pork, No Spicy; no service note | No Sauce is absent. Vegetarian agrees with most manual plate assignments even though it is not explicit in the raw master text. The remembered Halal answer is a separate known issue. |
| 502 | Halal / No Sodium, C65 | Halal; no service note | Sodium request is absent. |
| 710 | Halal / Low / No Sodium / Low Fat, C77 | Halal / Low Fat; no service note | Sodium request is absent. |
| 912 | No Pork / No Sausage / No Wheat, C92 | No Pork / GF; no service note | No Sausage is not preserved as a separate instruction; No Pork does not mean no chicken/turkey sausage. |
| 1211 | Halal / No Pork / Daiabetic, C109 | Halal / No Pork; no Diabetic tag | Eleven lunch/dinner manual assignment rows put this room in a diabetic group. Clarify the intended status and correct the typo and record together. |
| 701a | High Protein / Low Sugar as well as Halal / No Tofu / Soy, C165 | Halal / No Soy; no service note | High-protein/low-sugar wording is absent. |
| 1207 | Wheat allergy / No shellfish / Almond/Soy milk only, C108 | GF / No Shellfish / No Tree Nuts / Lactose Intolerant; Soy Milk only note | Source wording is ambiguous about almond milk versus avoidance. Preserve the existing restriction while clarifying it. |

Conversely, **1215b's food exclusions, 1007's rice/pasta/protein wording and 709's sauce/pepper wording are retained as service notes**. Their assigned dishes may still differ from the manuals, but those notes must not be reported as lost.

The raw master data is identical across all ten workbooks. Consequently these discrepancies are between the manual source and the current DOOR record, not ten independent inconsistent resident lists. Some may represent later deliberate staff changes; the comparison does not authorize restoring them automatically.

## The manual sheets also contain confirmed defects

The manual workbook count issue is reproducible without recalculating or modifying the originals. On every Vlookup sheet:

- The listed regular rooms total **81**, but B179 is fixed at **80**.
- There are **33** shared dietary rows through row 177, but B180 uses `COUNT(B144:B176)` and returns **32**, omitting room 1215b at row 177.
- Single dietary count is **57**. The displayed total therefore uses **80 + 32 + 57 = 169**, although the listed residents total **81 + 33 + 57 = 171**.

Across the 84 selected meal slots, 82 display 169. W1 Wed lunch displays 175; W3 Fri lunch displays 180. These are not extra people found in the manual roster.

Further concrete corrections:

- W1 Mon lunch, MON Hal Chick Burger: header C6 says 131 regular meals; footer C67 says 155 using `170-C55`. Those are conflicting calculations.
- W3 Wed breakfast, W3 WED Ham Frittata: 1007 appears at B18 and B68 in different sections.
- W4 Tue dinner, TUE Tandoori Pork, Briyani: 1112 appears at B62 and B91 in different sections.
- W3 Wed lunch, WED Nachos: B31 lists 602, while both current rosters use 602a and 602b. Do not choose the suffix automatically.
- W3 Sat dinner's SAT Pineapple Rice tab says Saturday Lunch at A1.
- The vegetarian-frittata tab retains a CONTAINS PORK label. CODEX remains the allergen authority; manual labels should not overwrite it.
- The shared W2/W4 Sunday breakfast tab names chicken while DOOR W4 names turkey; the mapping is provisional until that choice is resolved.
- Room 405's malformed `sp+B4:B23icy` text remains in the manual master and many meal rows. The earlier Halal review answer also remains in DOOR's learned data; fixing the form's default prevents a repeat but does not rewrite that answer. See the [separate diagnosis](DOOR_IMPORT_TEXT_DIAGNOSIS_2026-11-16.md).

## Main menu differences also affect the comparison

These are menu-owner decisions, not spelling-only changes:

- W4 Wed lunch: manual herb/garlic potatoes and green beans; DOOR roasted yam and broccoli.
- W4 Mon lunch: manual sub bun and soup/salad; DOOR fruit/chips on its main and vegan descriptions, while dairy-free alternative text still uses soup/salad.
- W4 Tue lunch: manual main explicitly includes marinated egg; DOOR does not name it.
- W4 Fri dinner: manual explicitly includes Bok Choy; DOOR does not name it.
- W1 Wed dinner: manual cauliflower/carrot; DOOR green beans.
- W1 Thu lunch: manual side soup; DOOR side salad.
- W2 Sat dinner: manual squash/gravy; DOOR roasted zucchini.
- W1 Mon dinner vegan plate: manual jerk cauliflower; DOOR jerk tofu.

The full main-meal descriptions for all 84 slots are in Meal plans. Many remaining differences are wording, component detail or synonyms; an exact text mismatch is not counted as an error.

## Suggested correction order

1. Complete the six triggered anaphylactic alternatives and the breakfast GF/vegan/plain definitions. Resolve placeholders by choosing a named plate or explicitly confirming no separate plate is needed.
2. Reconcile the resident instructions and the ambiguous 1211/1207/405 records with the intended current instructions.
3. Confirm current main meals and the named plain/alt dishes together with their recipient lists, starting with the Week 4 differences above.
4. Repair manual count formulas, duplicate rows, room codes and labels. Recompare from the same roster/menu snapshot, rather than forcing DOOR to match stale manual totals.

No changes to these data were made during the evaluation.

## Provenance

DOOR source commit: `eb13cd078e5fa8b949ab887f39125348308f213d` (PR #202). Registry exported `2026-11-16T17:50:05.800Z`; registry last modified `2026-11-16T17:19:24.564Z`. CODEX Pages as of `2026-11-16T22:11:45.000Z`; producer main `bb540c0d7e1a1aa7fa9640cff846b9a806e49c3f`, shared Library `709da7d75b4435c562df643ab741019e9b636af8`. The browser identified the recipe source as live and loaded 266 merged recipe records.

Archive SHA-256: `61525ac82e24832d305c4a68301ab4ec448eac8c10832ed6eefc0d08db84f13f`. The review workbook's Sources sheet records individual workbook and DOOR-input hashes. The comparison uses cached Excel cell results as printed-source values and reads the formula text to diagnose arithmetic; it does not recalculate or alter the source workbooks.

[Machine-readable provenance and source mapping](../receipts/door_manual_plating_comparison_2026-11-16.json). All six exported worksheets were rendered and visually inspected; the saved XLSX was checked for expected row counts and formula-error cells.
