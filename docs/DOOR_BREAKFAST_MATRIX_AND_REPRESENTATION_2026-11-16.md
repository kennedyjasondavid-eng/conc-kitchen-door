# Breakfast matrix and representation gate

## Scope and state

The current selected manual plating sheets are authority for intended meals. This matrix preserves their 28 breakfast services, 118 section variants, week differences and source cells. It covers 4,788 resident/services plus one retained duplicate row. It does not certify that every source plate satisfies every current requirement. Unlisted manual residents are inferred standard, not proven suitable-as-is.

The [review workbook](../outputs/door-breakfast-matrix-20261116/DOOR_breakfast_matrix_2026-11-16.xlsx) contains Breakfast matrix, Plate variants, Resident coverage, Decisions, B0 proof, Recipe bindings and Provenance. The [source receipt](receipts/door_breakfast_matrix_2026-11-16.json) records input hashes and CODEX provenance. The workbook is a local review artifact, excluded from Pages and from the Git change.

**B0 result: existing fields are insufficient for the authoritative matrix.** The controlled existing-field trials below demonstrate secondary requirements being lost through first-match routing. No operational breakfast fields or resident records have been migrated. The six dinner alternative definitions are an independent candidate.

## Confirmed user instructions

- 301a: **Oat milk only.** All four intended Tuesday Chex variants use oat milk. Original manual soy wording remains in the source column. GF, vegetarian, lactose and No Beans requirements remain; no new allergy classification is inferred.
- 1007: retain **Low Sodium, Low Carb, preference for protein, no rice/pasta**, with a **smaller breakfast starch portion plus extra protein**. Quantities were not supplied and are not invented. Placement in a manual GF group does not create a permanent GF tag.
- The W3 Wednesday 1007 duplicate is still visible: B18 ham frittata versus B68 vegetable frittata. The registry accommodation text and smaller-starch direction do not themselves identify one of those two rows. Resolve one compatible plate when the underlying recipes/products are checked.
- Week 4 Sunday follows the selected shared W2/W4 **chicken-deli sandwich**. DOOR's turkey description is a discrepancy to correct, not a renewed chicken/turkey choice request.

These confirmed instructions are recorded in the matrix and the owning action plan. They have not silently been applied as a whole-registry overwrite in this menu-binding slice.

## Interim breakfast output safeguard

The candidate refuses final breakfast XLSX/print output when an occupied GF alternative section has no named breakfast alternative. The preview marks the section unresolved and the sheet as DRAFT / NOT FOR SERVICE. This covers 14 current services in Weeks 1 and 3 and prevents the generic chicken/rice fallback reaching a final breakfast sheet. Individual, combined and ZIP outputs use the same check; resident saves and publication remain available.

This is a missing-definition check, not full ingredient compatibility validation. The underlying legacy routing calculation still contains its fallback pending the shared resolved-plate model. The workbook records that calculation separately from the actual guarded preview. Defined but incompatible combinations remain explicit B1/B2 work.

The user confirmed that the No Dairy yoghurt substitute **needs confirming**. The supplied Activia example is evidence about a possible lactose-free dairy product, not a selected dairy-free substitute. Those affected variants remain unresolved.

## What the model cannot yet express

The actual app was run with controlled manual definitions in its existing vegan, halal, GF, no-dairy and no-egg fields. The controlled trial was restored immediately afterward; it was not published.

| Case | Existing-field result | Authoritative intended result |
| --- | --- | --- |
| W1 Tue, 301a: GF + vegetarian + lactose + oat milk | Vegan section: ordinary cereal and oat milk; the GF cereal is lost | Chex, oat milk, whole fruit; verify the exact cereal and oat-milk products |
| W1 Tue, 1207: GF + lactose + nut avoidance + Soy Milk only | GF section: Chex with regular milk/yoghurt | Chex, soy milk, whole fruit, preserving the other requirements |
| W1 Sun, 304: Halal + No Eggs | Halal section: deli, cheese and egg sandwich | The manual egg-free veg-patty/vegan-cheese sandwich and DF yoghurt/fruit; verify ingredients |
| W1 Sun, 412: No Eggs + lactose | No-dairy section: deli and egg sandwich with DF yoghurt | The manual egg-free veg-patty/vegan-cheese plate with compatible products |

An individual appearing once in a section is not proof that their plate is correct. Filling `breakfast_gfAlt` removes the generic chicken/rice wording but cannot distinguish two GF milk variants or resolve a GF/vegetarian combination. Changing global section priority merely moves which requirement is lost. A printed generic note is not a substitute for identifying the actual components served.

## Minimum representation change before B1/B2 migration

The next implementation needs one shared resolved-plate model, used by preview, XLSX, routing portions and F4 flow projection. Existing reporting section labels/priority can remain, with multiple resolved plate variants within a section.

1. Each meal defines named complete plate variants with exact component recipe/product references, substitutions/omissions, source cells, and distinct `standard-suitable`, `replacement` or `unresolved` states. A section heading is not ingredient evidence.
2. Variant eligibility reads all applicable current requirements and confirmed preparation requests. It never copies manual room lists into global routing rules. A manual recipient without an explanatory existing requirement needs a confirmed service instruction or preference, not an invented diet diagnosis.
3. Component choices preserve secondary requirements: cereal/bread identity, milk, yoghurt, eggs/protein, portions and preparation notes. Missing product facts remain unresolved; a GF product is not automatically vegan, dairy-free or egg-free.
4. Resolution yields exactly one complete plate per resident/service. Equally eligible but different plates need an explicit deterministic choice. An ambiguity is not resolved by silently picking the first row.
5. Aggregate the same resolved components into exports. Update both `buildRoutingByMealJSON` and `doorFlowRoutingSlot` together; keep anaphylactic separation and the existing component-count policy. Recipe names/IDs must resolve through CODEX without appending shared sides a second time.
6. Preserve original source plate text and confirmed overrides as evidence. Store authoritative instructions once in DOOR; preserve them through intake/update, another-device merge, publish, restore and rollback. New 301a/1007 instructions must not be lost during that migration.

**Contract boundary:** no new public variant field is introduced by this candidate. Before persisting variants or typed preparation requests, specify their exact producer-owned representation, normalization, invalidation and legacy behavior in the appropriate schema owner; review the EXPO/HUB/CODEX consumer effects in the same change set. A new private instruction field also needs registry writer/merge and flow-fingerprint coverage. The receipt/workbook is not a runtime database.

## Remaining facts and decisions

The manual dishes themselves do not need approval again. The outstanding work is narrower:

- Preserve explicit No Pork/Halal requirements when the source plate names pork/ham. For example, W2/W4 Thursday places 912 in a GF pork-sausage plate despite the current No Pork instruction; this needs a compatible component substitution, not removal of the restriction.
- Exact recipes/products for cereal/Chex, GF/regular/vegan pancakes, breads/muffins/rolls, deli/turkey bacon, patties, vegan cheese, granola, yoghurt and plant milks. CODEX currently identifies ordinary Pancakes and Vegetarian Frittata as containing milk/eggs; labels such as LF or Vegan on a manual group do not change those facts.
- **No Dairy yoghurt remains unconfirmed (Jason).** The supplied Activia LF-style example is not an exact selected SKU. The linked assortment lists milk, modified corn starch and gelatin; it is lactose-free dairy, not a milk-free product. Formulas differ by flavour/product. Do not use that example as proof of No Dairy, No Corn or vegetarian suitability. Preserve 607a's No Dairy/No Peanuts and the distinct nut/coconut requirements elsewhere. Sources: [linked Costco assortment](https://www.costcobusinesscentre.ca/p/-/activia-lactose-free-yogurt-24--100-g/2001134688), [Activia plain lactose-free ingredients](https://www.activia.com/en-ca/all-products/lactose-free/product/plain-650g/). This is product-investigation evidence, not a new operational food-fact record; CODEX remains the canonical recipe owner.
- Preserve 1207's Soy Milk only/nut avoidance; do not introduce almond milk from conflicting older wording.
- Resolve 1007's W3 Wednesday duplicate. Keep smaller starch/extra protein qualitative until actual amounts are specified; do not assign rice porridge to a no-rice instruction.
- Carry 213/709/711's different soft/plain instructions through the actual plate. Resolve 709's No Pepper note against the tofu-pepper recipe ingredients/scope. No clinical texture level is assigned by this matrix.
- Verify commercial patty/deli and portion suitability for 614b's No Processed Food/Low Sodium/Diabetic instructions. Preserve one versus two plain muffins on the actual week variants.

## Review and next gate

Independent food/data and release review must verify source coverage, confirmed overrides and the four counterexamples. B1/B2 migration starts only after a concrete representation design passes review and applicable product/recipient facts are available. Test all current resident/services plus synthetic combinations; absence of placeholders or an exact roster count alone is insufficient.

Independent food/data review: PASS, including all original plates and source cells, the retained duplicate and confirmed overrides. Independent release/design review: PASS for the six naming assignments and B0 source/representation evidence, not B1/B2 migration. The later yoghurt reply confirms that the product remains unresolved.

## Authoritative 28-service index

The full variant and resident tables are in the workbook. The index below retains the selected source tab, main description and number of manual variants.

| Slot | Manual main | Source tab | Variants |
| --- | --- | --- | --- |
| W1-SUN | WW English muffin, Pork Patty, Sliced Cheese, Egg  + Yogurt & Fruit | SUN Pork Chick | 5 |
| W1-MON | Pancakes, Turkey Bacon, Yoghurt, Fruit | MON Pancake Halal | 6 |
| W1-TUE | Cereal & Milk, Fresh Fruit, | TUE Cereal | 3 |
| W1-WED | Vegetable Frittata,Bread roll,Yoghurt, Fresh fruit | WED Veg Frittata | 4 |
| W1-THU | Roll, Scrambled Eggs, Pork Sausage, Fresh Fruit, Yogurt | THURS Scrambled Egg Sausage | 4 |
| W1-FRI | Roll, Halal Deli, Hardboiled Egg, Cheese, fresh fruit, yoghurt | FRI Turkey Oat | 4 |
| W1-SAT | Whole wheat bagel, Cream cheese, Granola and Yoghurt, Fresh fruit | SAT Bagel | 3 |
| W2-SUN | Halal Deli Chicken, Egg, Cheese Sandwich, English Muffin,Yogurt, Fruit | SUN Turkey Chick | 5 |
| W2-MON | Pancakes, Turkey Bacon, Yoghurt, Fruit | MON Pancake Halal | 6 |
| W2-TUE | Cereal & Milk, Fresh Fruit | TUE Cereal | 3 |
| W2-WED | Vegetable Frittata,Bread roll,Yoghurt, Fresh fruit | WED Frittata | 4 |
| W2-THU | Roll, Scrambled Eggs, Pork Sausage, Fresh Fruit, Yogurt | THU Scrambled Eggs Sausage | 4 |
| W2-FRI | Roll, Shaved Ham, Egg, Cheese, fresh fruit, yoghurt | FRI Ham Chick Oat | 5 |
| W2-SAT | Whole Wheat Bagel, Cream Cheese, Granola and Yoghurt, Fresh fruit | SAT Bagel | 3 |
| W3-SUN | WW English muffin, Pork Patty, Sliced Cheese, Egg  + Yogurt & Fruit | SUN Pork Chick | 5 |
| W3-MON | Pancakes, Turkey Bacon, Yoghurt, Fruit | MON Pancake Halal | 6 |
| W3-TUE | Cereal & Milk, Fresh Fruit, | TUE Cereal | 3 |
| W3-WED | Ham Frittata,Bread roll,Yoghurt, Fresh fruit | W3 WED Ham Frittata | 4 |
| W3-THU | Roll, Scrambled Eggs, Pork Sausage, Fresh Fruit, Yogurt | THURS Scrambled Egg Sausage | 4 |
| W3-FRI | Roll, Halal Deli, Hardboiled Egg, Cheese, fresh fruit, yoghurt | FRI Turkey Oat | 4 |
| W3-SAT | Whole wheat bagel, Cream cheese, Granola and Yoghurt, Fresh fruit | SAT Bagel | 3 |
| W4-SUN | Halal Deli Chicken, Egg, Cheese Sandwich, English Muffin,Yogurt, Fruit | SUN Turkey Chick | 5 |
| W4-MON | Pancakes, Turkey Bacon, Yoghurt, Fruit | MON Pancake Halal | 6 |
| W4-TUE | Cereal & Milk, Fresh Fruit | TUE Cereal | 3 |
| W4-WED | Vegetable Frittata,Bread roll,Yoghurt, Fresh fruit | WED Frittata | 4 |
| W4-THU | Roll, Scrambled Eggs, Pork Sausage, Fresh Fruit, Yogurt | THU Scrambled Eggs Sausage | 4 |
| W4-FRI | Roll, Shaved Ham, Egg, Cheese, fresh fruit, yoghurt | FRI Ham Chick Oat | 5 |
| W4-SAT | Whole Wheat Bagel, Cream Cheese, Granola and Yoghurt, Fresh fruit | SAT Bagel | 3 |
