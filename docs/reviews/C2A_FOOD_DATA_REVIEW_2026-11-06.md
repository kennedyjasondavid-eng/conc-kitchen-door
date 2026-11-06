# C2a independent food/data review

Verdict: changes required before fold. This review found a test-coverage regression, **not an incorrect current production Corn flag**. Current published Oven Fried Chicken has the correct meal and main-slot Corn warnings.

## Material finding

**P1 — Retain live known-recipe allergen coverage when moving historical cases into fixtures.** In `tests/corn_recipe_alignment_gate.mjs`, the former `nine published meal ticks and their main-slot copies name Corn` assertion read the active menu/overlay. Its replacement `the fixed Corn meals export their meal ticks and main-slot copies` obtains its inputs from `publishMenu(..., F.ticks)`, which supplies the correct flags itself. The related `tests/menu_recipe_ticks_gate.mjs` assertions now read only the historical menu. Live structural/routing coherence checks cannot substitute for this warning check because they calculate from the supplied flags.

The independent probe follows an exact bound recipe with source Corn, clears **both** current meal and main-slot `hasCorn` in menu and overlay, leaves recipe binding and CODEX-derived source unchanged, and rebuilds published allergen text, routing, summary and menu provenance using the real exporter/plating functions. On the reviewed data this is W2 Wednesday lunch, Oven Fried Chicken, whose source records `Corn (Corn Starch)`. The coherent wrong warning reaches all relevant current checks without rejection. A resident avoiding Corn could consequently receive an incorrect ordinary-route result without CI detecting the lost warning.

Required correction: retain a current-data warning check based on supported exact recipe identity and known source facts, independently of the stored flag being checked. It must follow legitimate moves/replacements and preserve the separation of regular/main and vegan-only facts. Do not convert unresolved/ambiguous source identity into a claim of no allergens, invent classifications, restore day/dish/population pins, or drop the fixed historical regressions. The frozen fault preloader `tests/checks/c2a_current_corn_loss.mjs` must cause a meaningful allergen assertion failure after the correction; baseline, valid swap and valid replacement must remain green. Builder ownership was handed to `review_flow_ci`.

## Evidence and limits

- Read the coverage map and 33-file verification receipt; initially verified every owned hash. Inspected the changed synthetic/fixed-fixture coverage, current routing oracle, current brassica checks, privacy checks, anaphylactic membership, lactose handling, and optional source skips.
- Existing new skip reporting is legitimate: missing optional CODEX data is now reported as skipped rather than passed. No additional safety finding was identified in the zero-cohort or anaphylactic changes.
- First independent coherent-Corn-loss run against product `8066a1f`: 596 checks, 568 passed, 17 unrelated smoke harness failures, 11 skips. All failures were the concurrently migrated smoke harness seeking the newer `publish-transaction` core in the pre-F1 product. None rejected the injected Corn loss.
- Clean isolation excluding the three concurrently migrated F1 smoke/outbox/revert files: **451 checks, 440 passed, zero failed, 11 skips**, despite the injected loss. This includes the relevant current-data and historical safety gates. The log is `%TEMP%/door-c2a-review-current-corn-scoped.log`.
- The probe changes file reads only in its test process. It writes no product or operational JSON, makes no network request and prints no resident records. Its target starts with correct flags; the loss is deliberately injected.
- No live device/recipe feed, hosted CI, production publication or staff trial was claimed. Revalidate the repair on the pinned C2a matrix, then the combined current F1/C2a suite before fold. Do not change the new product/gate interfaces merely to run a pre-F1 source snapshot.

## Closure review — repaired Corn coverage

Verdict: the identified C2a food/data finding is closed; no remaining material food/data finding in this slice. This is an acceptance of the reviewed test change, not a deployment or complete cross-app release claim. The original pre-repair evidence above remains intact.

Reviewed `tests/corn_recipe_alignment_gate.mjs` SHA-256 `77bc09a4128292594c7e58d6ee4a1399b35db97310d2c3d62bfae18620fcb1cf` and all four hashes in `docs/receipts/door_c2a_corn_repair_2026-11-06.json`. The new independent current-data resolver uses explicit ID first and exact unique name only when no ID exists; it diagnoses unresolved, ambiguous and unknown source facts. Known Corn on regular/shared bindings must retain slot and meal flags; vegan/halal checks use their own actual warning paths. It does not move vegan-only Corn into the regular meal. Fixed incident cases remain.

Independently reran the focused gate against pinned product `8066a1f`: baseline, dynamic Corn-meal swap and dynamic replacement each **16 total, 15 passed, zero failed, one optional-source skip**. The unchanged frozen loss preloader now produces the expected current warning-floor failure (`exact source Corn must remain on its slot`). Its hash remains `6919f49fad9528f317968fa1a3bd7735d258a84ecd93930d2e847b2fd03169d8`. Builder's broader eight-variant scoped matrix reports 453 total, 442 passed, zero failed, 11 skips each; the injected loss reports 441 passed, one failed, 11 skips. Those full repair runs were receipt-reviewed rather than all repeated independently.

The ordinary current combined F1/C2a suite and hosted CI remain parent/release validation obligations. Existing optional source skips are explicit; unknown binding diagnostics are not a claim that every arbitrary future recipe has been independently certified. F3a/F4/C2b prerequisites remain in force.
