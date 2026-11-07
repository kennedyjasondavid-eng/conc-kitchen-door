# DOOR CI and menu flow audit

DOOR's checks create avoidable maintenance work around ordinary menu edits, while important DOOR-to-EXPO behavior remains untested. The main problem is what the checks assert: several preserve an old menu, roster, or application file instead of preserving the rules that make changes safe.

CI is not currently a technical barrier to menu delivery. Pages deploys independently, main has no required status checks, and the historical red test runs examined still had successful Pages deployments. Making more tests advisory alone would reduce noise but leave the two reproduced production-scheduling defects below.

Audit date: November 6, 2026. DOOR: `0996f8b78313882aca59981b11ac8d9399507a83`; EXPO: `7cd1fee4c50c767fbbe492a0def74451df8a68fb`; HUB: `f7a2b614e8e5d1f80f15392471c5596ca7145967`. These are refreshed remote heads. Existing working files were left intact. Tests and browser probes ran against temporary archives, with no live writes.

**What the recent swap exposed**

[PR 152](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/pull/152) fixed a real defect: swapping rotation meals carried their names, vegan lines and flags, but lost their halal lines, alternatives and recipe slots. It also repaired tests tied to particular weekdays, a discharged resident and an expired swap date.

The hosted history distinguishes the problems:

| Publish or change | DOOR tests | Evidence |
|---|---:|---|
| October 31 menu edit | 1 failure | The Corn whole-menu digest rejected an unrelated edit. [Run](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/actions/runs/41230335953) |
| November 4, 14:48 UTC | 4 failures | Roster and expired-date expectations failed before the later slot swap. [Run](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/actions/runs/41851337720) |
| November 4, 18:31 UTC | 10 failures | Additional failures appeared after the swap; the product also genuinely lost meal fields. [Run](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/actions/runs/41888079699) |
| Current main | 594 passed, 0 failed, 4 skipped | Reproduced locally; hosted CI agrees. [Run](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/actions/runs/41893017639) |

[PR 149](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/pull/149) had already documented the recurring Corn-gate problem. It added a dated reversal of an approved menu edit so an older digest could pass. That preserved the release's original scope check, but made later operational edits depend on developer maintenance.

**1. High priority: EXPO still loses the whole meal on a dated slot swap**

DOOR now writes the moved meal into `_meal`. EXPO's `_datedMealFor` reads only the name, vegan line and flags; `_applyDatedMealToDay` then deletes the halal line, soft alternative, parts and recipe slots.

The audit passed the same sausage meal through both readers, then booted EXPO in a headless browser with mocked feeds:

| Same intended dinner | EXPO planning input | Scheduled halal jobs |
|---|---|---|
| Whole meal in the rotation | Halal beef sausages; recipe slots retained | COOK Halal beef sausages |
| Dated swap carrying DOOR's `_meal` | Halal line and slots absent | COOK Halal Chicken Sausages; SEND AM BAG Halal Chicken Sausages |

Both browser runs completed without page errors. This reproduces a wrong production choice, not merely a source-code concern. It does not establish that a staff board has published that choice.

Fix the EXPO reader to honor DOOR's guarded whole-meal payload, while retaining the existing behavior for a newly typed replacement. Add a paired producer/consumer test that compares planned dishes, alternatives, recipe identities and routing for the same intended meal.

Source: [DOOR whole-meal writer](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L13229), [EXPO dated reader](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/index.html#L59847).

**2. High priority: an EXPO menu refresh keeps old routing counts**

EXPO's pre-publish refresh pulls the menu and dated meals, then rebuilds the board. It does not refresh routing or registry data. The routing reader also discards the producer's `builtFromMenu` stamp.

In a browser probe, DOOR's two Week 1 breakfasts and their corresponding routing were moved together. EXPO reported `rebuilt` and adopted the new menu, but routing requests remained at one: the startup request. Its routing still matched the old file and did not match the new one.

Refresh the menu, routing and relevant registry data as one coherent set. Use DOOR's existing content stamp to verify the set. Keep a complete last-good set during a transient failure and surface a meaningful freshness problem; avoid mixing a new menu with old portion data.

Source: [pre-publish refresh](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/index.html#L55126), [routing reader](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/index.html#L60810).

**3. The safety suite still rejects harmless changes**

Two controlled probes reproduced false failures:

- Appending an inert HTML comment failed the Corn whole-app digest: 15 passed, 1 failed.
- Moving two complete breakfasts, with DOOR's meal-copy, stamping and export helpers, passed publish validation with **0 Stop / 0 Review / 0 Info**. The plating engine's results moved with the meals unchanged. The full suite nevertheless failed two tests: the Corn whole-menu digest and a workbook-import test expecting the exact question list produced by the old menu. Result: **592 passed, 2 failed, 4 skipped**.

The Corn check has accumulated reversals for logos, privacy changes, connection readers, menu imports and swaps. It is effectively a standing restriction on unrelated edits.

Keep the Corn safety assertions, using explicit recipe/menu fixtures and behavior checks. Move whole-file and whole-menu scope comparisons to the review of the change they were written for. Give the workbook test a fixed comparison menu, so its expected questions test the importer rather than today's kitchen choices.

Source: [Corn menu digest](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/corn_recipe_alignment_gate.mjs#L75), [app digest](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/corn_recipe_alignment_gate.mjs#L105), [workbook test](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/rex_week_import_gate.mjs#L99).

**4. Ordinary roster and menu changes can still invalidate regression examples**

The lactose test now follows whoever has the restriction, which improves on a fixed room. It still requires at least one such resident to exist. Removing that cohort in an isolated targeted test produced 7 passes and 1 failure solely because there was nobody left to test.

The routing replay similarly requires particular restriction/plate combinations and minimum occurrence counts. Other assertions still name a particular resident and a fixed set of meals. The new meal-location helper searches only within the original week and meal period and throws if the meal is absent. A normal replacement or cross-week move can therefore require a gate edit.

Use synthetic residents and fixed examples to guarantee regression coverage. Separately check every actual resident and meal for invariants, without requiring yesterday's population or dishes to remain present. Keep the anaphylactic containment assertions strict.

Source: [cohort requirement](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/lactose_no_dairy_gate.mjs#L129), [routing receipt](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/routing_replay_gate.mjs#L129), [meal locator](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/helpers/meal_where.mjs#L9).

**5. A green suite does not establish delivery or cross-app compatibility**

DOOR CI checks out DOOR alone and runs the top-level Node tests. Four tests are formally skipped without CODEX; some additional feed checks print SKIP and return as successful tests. EXPO has useful browser checks, but its dated-meal fixture predates the new whole-meal payload.

Use explicit, versioned source fixtures for deterministic safety tests, and a separate contract test that exercises the current DOOR producer against the EXPO consumer. Report missing coverage honestly. Do not make normal menu delivery wait for historical menu approvals or unrelated code checks.

There is already a separate advisory menu-decisions job. The split is incomplete because historical menu assertions remain in the safety job.

Source: [DOOR workflow](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/.github/workflows/door-tests.yml#L44), [unreported skip](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/tests/recipe_attach_allergen_norm_gate.mjs#L107), [EXPO dated fixture](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/tests/door_dated_meals_gate.mjs#L21).

**6. Published to GitHub is treated as delivered to the kitchen**

DOOR clears its outbox and reports success after the Git commit. Pages delivery happens later, without a receipt returning to DOOR.

The latest [Pages run](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/actions/runs/41893017538) timed out while `updating_pages`. Public menu and routing reads still carry the preceding export stamp. Their non-metadata content is identical to current main, so this failure has not left different meal or routing content live. The repaired permanent swap is available publicly.

Add asynchronous delivery verification and bounded recovery. Normal successful saves should remain quiet; expose a problem only when a saved change has not become available to EXPO. Preserve the existing Pages allowlist.

Source: [success and outbox handling](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L11724), [independent Pages workflow](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/.github/workflows/pages.yml#L15).

**7. Actions usage during normal operations**

DOOR is currently a **public** repository, verified through GitHub on November 6, and both workflows use standard `ubuntu-latest` runners. This compute is free under [GitHub's current billing rules](https://docs.github.com/en/actions/concepts/billing-and-usage). The improvements below reduce runner work and deployment noise now; they would also reduce chargeable usage if DOOR becomes private. They are not a reason to change repository visibility.

The audit collected job timings for all 26 push workflows on November 2–4 in the recent-run sample. Twenty-four came from operational Publish/Update commits; those started 36 jobs and consumed **21.9 actual runner minutes**. Their separately rounded job durations total **48 minutes as a private-repository planning proxy**, not a bill. GitHub rounds private hosted-runner job minutes individually. [Timing rules](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time)

Three ordinary publishes, on November 2, November 3 and the morning of November 4, illustrate the recurring overhead:

| Job per publish | Observed duration | Private-repository rounded proxy |
|---|---:|---:|
| DOOR safety checks | 21–28 seconds | 1 minute |
| Menu decisions advisory | 6–9 seconds; test step under one second | 1 minute |
| Pages artifact build | 8–13 seconds | 1 minute |
| Pages deployment | 12–33 seconds | 1 minute |

Together these three publishes started 12 jobs, used 191 runner seconds, and represent 12 separately rounded minutes. The safety test bodies took only 15–22 seconds. Job count and publish count are therefore better initial targets than micro-optimizing individual tests.

**First, consolidate small jobs without reducing coverage.** Run the advisory tests and their summary as steps in the safety job, keeping advisory failures non-blocking and safety failures red. Combine Pages preparation, upload and deployment in one job, while keeping that workflow independent of test success. EXPO already uses this one-job Pages pattern; retain DOOR's exact served-file allowlist and deployment concurrency. This gives a target of **four jobs down to two per ordinary publish**. At the observed durations, the estimated rounded private-repository usage falls from four minutes to two, about **50%**, with smaller savings in actual execution time. This is an estimate, not a benchmark of a deployed change. [EXPO Pages workflow](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/.github/workflows/pages.yml#L40)

**Second, finish batching at the source.** During the November 4 swap sequence, eight commits triggered **14 workflows**: eight test runs and six deployment runs. Ten workflows were cancelled, but 16 jobs still started, using 370 runner seconds; 94 seconds belonged to workflows ultimately cancelled. Cancellation already exists and cannot recover time already spent.

The core publish is atomic, but overlay, swap, revert and log writers still make separate side publishes. Extend the existing atomic-publish seam (HOUSE proven seams, row 5) to collect the files belonging to one logical staff operation, including its derived menu/routing. Persist locally immediately, preserve merge/revert ordering, and flush the coherent operation promptly. Use transaction boundaries or a short bounded application-side coalescing interval; do not make an Actions runner wait through a debounce or hold an urgent change for a long batch window. This both reduces workflow starts and removes intermediate states from the delivery path. [Atomic publisher](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L11278), [separate swap writes](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L15072)

**Third, avoid commits whose only change is a new export time.** The latest publish changed only export timestamps and matching `builtFromMenu.exported` values. It nevertheless started four jobs. One deployment job then spent 616 seconds waiting before timing out. Recognizing unchanged content before committing can avoid this entire class of run. Implement it only with coherent revision stamps and checked downstream freshness semantics: a check-in time is different from a content revision, real resident/menu/revert changes must still publish, and an undelivered revision must still be retried. Do not simply strip metadata or suppress deployment because a previous attempt wrote GitHub successfully.

**Fourth, select checks by the change after repairing their boundaries.** A data-only publish should exercise structure, menu/routing agreement, actual routing/allergen invariants and a compact DOOR-to-EXPO contract. Code, test or workflow changes should run the full regression suite. Classify inside the existing test job; a new classifier job adds another runner allocation. Keep fixed source fixtures available in CI. Do not run EXPO's entire browser suite for every DOOR edit. This saves execution time, but replacing a 20-second suite with a 5-second suite alone does not lower a one-minute rounded job.

Keep the existing docs/log path filters and cancellation. Avoid broad JSON exclusions and commit-message `[skip ci]`: GitHub applies that instruction to push-triggered workflows, so it can also suppress DOOR's Pages delivery. Avoid adding a new frequent scheduled workflow just to monitor these savings. Delivery receipts and bounded recovery should use the existing delivery process where practical. [Skip behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)

The [Actions usage receipt](receipts/door_actions_usage_2026-11-06.json) contains the sampled run IDs, job/step timings, assumptions and calculations. Workflow configuration remains unchanged.

**8. Follow-through into HUB: two additional gaps, and the next focused checks**

The current committed HUB schedule agrees with current DOOR rotation text on **123 compared slots, with zero mismatches**. The additional findings concern what can happen after the next change and what HUB can establish about its data. They do not establish that today's published kitchen board has incorrect meals.

**HUB can refresh its board and menu while retaining old portion counts.** `loadDOORData()` loads routing once at startup. Returning to the tab refreshes the schedule and overrides, and the schedule refresh in turn refreshes DOOR's menu. Neither path reloads routing. The seven-day cache limit is evaluated when routing loads; the portion reader subsequently consults the stored `ROUTING_STALE` boolean, without recalculating age or checking the routing's menu receipt.

An isolated probe executed the current routing loader, menu refresher and portion reader with mocked feeds. It loaded 120 portions, then made 80 available upstream. Eight simulated days later, menu refresh still returned **120**, with `ROUTING_STALE === false` and no second routing request. Explicitly rerunning the routing loader returned 80. This is a helper-level reproduction, not a staff-browser observation. The same routing state also supplies resident-based frozen-stock quantities.

Refresh routing alongside the schedule/menu on the existing cadence, retain its source receipt, and evaluate age when counts are used. Use matching source revisions to distinguish a current meal with old counts. When counts cannot be verified, keep the useful board available and use the existing unscaled/count-unavailable behavior for the affected output. A fresh HTTP response alone does not establish that independently fetched files belong together.

Source: [routing loader](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L5054), [portion reader](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L1618), [menu refresher](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L5310), [focus handler](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L5809).

**HUB's current-menu receipt verifies rotation names, not the full planning input.** The comparison checks lunch/dinner names and their vegetarian/halal lines. It does not compare dietary flags, recipe attachments, routing, or the dated-meal/revert state. That is intentional for comparing rotation with rotation, but it cannot certify the complete meal currently displayed or planned.

Three isolated probes retained the same rotation text while changing a dietary flag, changing an existing dinner recipe attachment, or supplying a separate dated meal that HUB displays instead of the rotation. Each still returned `code: current`. The third probe demonstrates a comparison boundary: HUB cannot establish from this receipt whether that dated meal remains authorized or has been revoked. It does not show a real revoked swap on today's board. The current schedule-freshness, recipe-link and dated-meal contract tests all passed, so these gaps are outside their present assertions.

Give EXPO's output a compact receipt for the effective input it consumed: menu content, dated changes/reverts, routing and the relevant CODEX recipe revision. HUB should compare those receipts and keep diagnostics precise about what is verified. Keep schema version, content revision and last-contact time separate. Do not turn routine republishing into a warning merely because an export timestamp changed.

Source: [rotation comparator](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L1934), [receipt semantics](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L2011), [dated meal display](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L1394).

The following operations defined the follow-up examination scope. Section 9 records the completed runs and distinguishes confirmed failures from passing behavior:

| Operation to replay | What must hold throughout DOOR → EXPO → HUB → CODEX |
|---|---|
| Dated swap, then revert; cross a day, week and rotation boundary | Only the intended service date changes. Prep, cook, packing, van and reheat tasks follow the same meal. A revert removes obsolete work, and a delayed tab cannot resurrect it. Existing EXPO dated tests cover several lifecycle cases; extend them using the current DOOR whole-meal producer. |
| Same displayed name, changed recipe attachment or dietary flags | Preserve canonical recipe identity and the intended dietary variant through each adapter. CODEX remains the allergen authority. Unknown or ambiguous dishes retain the existing visible “Needs a plan”/unresolved behavior. |
| Resident-only change, or cooking days before service | Route counts and recipe quantities refer to the correct service meal, date and cohort, including cross-week preparation. Preserve the intentional distinction between section totals and component portions; do not reconcile them by assumption. HUB's recipe-link test currently substitutes a constant portion reader, so it does not establish this join. |
| One edit viewed as board, menu, print, order and frozen-stock requirement | All outputs represent the same accepted input. Check stale cached views and prints, while preserving intentional supervisor overrides, notes, completed work and stock on hand. |
| Two devices, offline edit, reconnect and interrupted publish | One coherent operation wins according to the existing merge rules. Its revert and derived files arrive together, and saved, served and consumed states are distinguishable. Recovery converges without staff republishing repeatedly. |

Run a compact paired contract for operational changes, with the broader browser scenarios on changes to the relevant producer/consumer code. Reuse existing jobs and fixtures. This should improve confidence while preserving the Actions reductions in section 7; it does not require a new approval stage, a new scheduled workflow or a full three-app suite on every save.

Current-source check also avoids a stale-document trap: EXPO's active readers now explicitly use `menu_current.json` after reno-profile teardown. The older reno footgun in orientation notes should not be treated as evidence about today's active path without checking the code. [Active EXPO reader](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/index.html#L60526)

The [downstream probe receipt](receipts/door_downstream_flow_2026-11-06.json) records these results. Reproduction: `hub-flow-probes.mjs` in the audit's temporary archive directory. No HUB product files were changed.

**9. Executed menu-flow examinations — November 6 follow-up**

The four requested journeys were run against the same remote heads, refreshed again before testing. DOOR's own swap writer supplied the new whole-meal entries; its plating/routing code supplied the count fixtures. EXPO and HUB ran in fresh headless Chromium contexts with intercepted feeds and fixed service dates. A separate publisher probe executed DOOR's current staging and cloud-merge functions with mocked HTTP responses and an atomic-writer recorder. No staff browser state, live data, production code or workflows were changed, and no Actions runs were started.

**Result by journey**

| Journey | Passed | Reproduced failure |
|---|---|---|
| Swap → revert → next service/rotation | Both dated entries arrived. Revert restored all 14 baseline production tasks and their placements. After expiry, rotation tasks returned. Week 4→1, the daylight-saving weekend, and a pair whose earlier day had passed all selected the expected dates. | The dated whole-meal reader lost halal/recipe fields. Revert and expiry left old routing usable. The wrong halal fallback reached HUB's task print. |
| Recipe identity and quantities | Changing a binding while retaining the label “Rice” rebuilt EXPO: Plain Rice's 30-minute cook became Lime and Coconut Rice's 40-minute cook. DOOR correctly recalculated a six-resident discharge. | HUB's recipe link still selected Plain Rice; the EXPO row retained 60 oven minutes. Open consumers kept 148 portions instead of 142. Make-ahead recipe links omitted service-meal scaling. |
| Board, menu, print and order agreement | HUB's day card, popup and task-print heading agreed on the swap. The existing paired frozen-order browser test passed all ten checks, including demand/order/date parity. | HUB's dated menu table displayed the rotation meal for the same date. Matching board/print headings did not prevent incorrect halal task content. |
| Two devices, offline/reconnect and interrupted publish | Existing swap-revert merging, original restoration, outbox, atomic-write conflict, notes-conflict and EXPO partial-publish tests passed. | A successful DOOR publish could combine a newly merged revert with routing built before that merge. An unreadable remote revert list allowed a stale swap and an empty revert list to be staged for publication. |

**P1 — DOOR builds derived files before it merges dated changes from the other device**

In the two-device scenario, device A had reverted the November 6 dinner swap; device B still held it. All four cloud reads succeeded. Device B's actual publish path staged an empty swap file and the correct revert record, but routing still described the sausage meal. For the restored Arroz meal, the expected routing was Regular 159 / Vegan–Vegetarian 11; the staged routing was Regular 100 / Halal 57 / Soft Meals 2 / Vegan–Vegetarian 11, with sausage components. The publisher returned `{ok:true}` and “Sent to the kitchen”, without a validation warning.

The cause is sequencing: artifact construction and validation happen first; `preMergeSwapsWithCloud` runs afterward, just before the dated files enter the atomic batch. One commit prevents partially delivered files, but cannot make files built from different inputs coherent. `builtFromMenu` still matched because the rotation menu had not changed.

Merge the effective menu, dated entries and removal/revert records before building and validating routing/state. Freeze that input for the transaction. The receipt must cover the dated inputs as well as the rotation menu. This is a producer repair, not a reason to make staff approve ordinary edits.

Source: [artifact build](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L11630), [later dated merge and staging](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L11696).

**P1 — an unreadable revert list can allow an old swap to be republished**

With the same stale device, returning HTTP 503 for `meal_swaps_reverted.json` while the other reads succeeded caused the publisher to stage the old swap and an empty revert list. It again returned success through the mocked writer. `preMergeSwapsWithCloud` converts failed reads to null and continues with the local copy; it does not distinguish “not present” from “not safely merged” in the publish outcome.

This is a concrete unsafe write candidate, not evidence that a real repository was overwritten during the audit. The atomic writer was a recorder. Existing revert tests prove correct behavior when the removal record is available; they do not prove safety when the authoritative removal record cannot be read.

Keep the local edit durable, retry the affected merge with a bounded policy, and leave that transaction visibly pending if its authoritative removal state cannot be established. Do not publish a shorter revert list as a substitute for a failed read. Other safe operations need not acquire an unrelated approval gate.

With the authoritative remote revert made available again in the mock, the all-success scenario needed a second publish to rebuild correct routing. The failed-read scenario needed a subsequent successful merge and then another build. These retry counts assume the remote revert remained available: the recorder did not apply the destructive candidate back to the mock remote, so they do **not** establish automatic recovery after an actual overwritten tombstone.

Source: [failed-read handling](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L11514), [swap merge](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L18879).

**P1 — production identity is not carried all the way into HUB's recipe link**

The controlled slot used the supported binding shape: menu label/display text “Rice”, `recipeId: lime-and-coconut-rice`, recipe name “Lime and Coconut Rice”. Both recipe records exist in EXPO's pinned CODEX production fixture. EXPO honored the binding sufficiently to change `cookMin` from 30 to 40 when the attachment changed under identical menu wording. But its generated row retained `ovenMin:60` from the text-resolved Rice item, and HUB received a card reading “Rice”, “4 hotels”, `🔥60`. Its Recipe link selected `Plain Rice&portions=148`.

Thus both recipe choice and production facts can disagree with the accepted attachment. The 122-check structured-identity regression suite passed; the failing journey crosses from that behavior into the published card and HUB link. Carry canonical recipe identity and the intended service occurrence through the generated card, and use the same bound production record for cooking/equipment facts. Display text should remain editable without becoming recipe authority. CODEX remains the owner of allergen data.

Source: [EXPO HUB payload projection](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/index.html#L32794), [HUB recipe selection and portion link](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L1658).

**P2 — routing needs both refresh and date validity**

The current-browser revert probe confirmed section 8's helper finding: HUB adopted the reverted schedule (`dinner_dated` disappeared) but made no second routing request. EXPO's publish mirror also rebuilt the rotation tasks without refreshing routing.

In a separate roster-only probe, removing six residents from the temporary input made DOOR's real builder change the Rice component from 148 to 142 portions. EXPO's mirror returned `same`; both EXPO and HUB still returned 148, and HUB's stale flag was false. Explicitly invoking HUB's data reload returned 142.

A fresh EXPO tab after the dated service also restored rotation tasks while trusting the unchanged routing file from the last swap publish. This establishes a separate boundary: re-fetching alone cannot fix a date-sensitive routing file that has not been rebuilt. Publish an effective-service/date receipt or validity interval with those counts, and check it at consumption. On an unverifiable count, use the existing unavailable/unscaled behavior rather than silently treating it as current. This should use the existing refresh/delivery cadence, not a new frequent Actions cron.

The make-ahead examination found **16 canonical recipe links without portions**, even where the service-meal component count was available. For example, a W1 Friday Okra and Cassava Stew cook served W2 Wednesday dinner, whose component count was 170; the link opened the canonical recipe without scaling. HUB calls its portion reader with the card's `production` section and work day; that reader only accepts lunch/dinner. This is an incomplete convenience handoff, not a guessed wrong quantity. Carry structured service keys through the card and resolve quantities there. Preserve the intentional difference between section totals and component portions.

Source: [DOOR next-service routing input](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/blob/0996f8b78313882aca59981b11ac8d9399507a83/index.html#L13929), [EXPO prepublish mirror](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo/blob/7cd1fee4c50c767fbbe492a0def74451df8a68fb/index.html#L55126), [HUB portion lookup](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L1618), [card caller](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L2327).

**P2 — HUB's dated menu table disagrees with its board**

On Friday November 6 in the controlled swap, the board/popup/task-print meal heading read “Sausages, Roasted Potatoes, Gravy, Peas & Carrots”. The Menu table column explicitly headed “Fri Nov 6” read “Arroz Con Pollo, Refried Beans”, with the rotation's vegan and allergen lines. The table reads the base DOOR menu rather than the dated meal carried by EXPO. Its heading still says “Temporary Renovation Menu”, despite the active standard-menu source.

Use the same effective meal for a date-specific menu and operational board, or make a deliberate rotation-reference view unmistakable and separate from dated service output. Check its print/export path as part of that repair. The present probe inspected the rendered table and generated task-print HTML; it did not print paper or open an exported workbook.

The whole-meal loss from section 1 was also carried through the actual HUB consumer: the intended Halal beef sausages did not appear in the task print; Halal Chicken Sausages did. Agreement of meal headings alone is therefore insufficient.

Source: [HUB dated menu renderer](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L3312), [dated task-print heading](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub/blob/f7a2b614e8e5d1f80f15392471c5596ca7145967/CONC_Production_Hub.html#L2725).

**Regression and reproduction record**

Fifteen selected regression programs ran: **14 passed; one failed a single source-text assertion**. EXPO's board/print test was 93/94; its browser assertions and page-error check passed. Its function extractor searched for LF-only closing braces in the CRLF archive, returned an empty function body, and failed. Applying newline normalization in an isolated parser probe recovered the 1,256-character body and satisfied the assertion. Product/test files were not edited. This is a local portability finding; this follow-up did not inspect that test's hosted run.

Passing coverage included DOOR's 10 swap/revert, 7 whole-meal, 6 original-restoration, 7 outbox and 34 selected publish/merge checks; EXPO's 39 dated-meal, 10 paired dated-HUB, 10 paired frozen-order, 122 structured-identity and 28 partial-publish checks; and HUB's notes, recipe-link, frozen-stock and pinned-print checks. All six browser contexts in the new current-data journey stayed free of script errors.

The [examination receipt](receipts/door_menu_flow_examinations_2026-11-06.json) includes the 17 new journey assertions, three date-boundary probes, two adversarial publisher scenarios, regression results, source hashes and limitations. A failing journey assertion is evidence of a specific handoff gap, not an independent failure of every feature in that journey. The current-data browser cases used EXPO's pinned CODEX production fixture; recipe selection was verified at the resulting URL, not through a live CODEX/Office staff trial.

Temporary reproduction tools: `flow-journeys.mjs`, `publish-adversarial.mjs`, `makeahead-canonical.mjs`, `run-flow-regressions.mjs`, and `audit-loader.mjs` under `C:\Users\JasonKennedy\AppData\Local\Temp\door-ci-audit-20261106`. Full logs are in `flow-logs`; generated consumer payloads and inspected views are in `flow-artifacts`. Early launcher/harness errors were corrected before the recorded runs and are not product failures.

**Recommended repair order**

1. Merge dated state before building DOOR's artifacts, and prevent an unreadable revert/removal list from becoming a destructive publish candidate. Preserve local changes and bounded recovery.
2. Fix EXPO's whole-meal reader and carry bound recipe identity/production facts through the HUB payload and recipe link. Retain dietary distinctions and paired behavior tests.
3. Refresh and verify routing with its effective service date, including roster-only changes. Make dated menu, board and print projections agree; carry service keys for make-ahead scaling.
4. Consolidate advisory into the safety job and Pages build into deploy, keeping their existing failure semantics and delivery independence. Replace historical scope locks with fixed examples and general invariants.
5. Batch logical operations through the corrected atomic publisher, add delivery receipts, and then suppress proven unchanged publishes. Reuse a compact operational contract inside the existing jobs; keep broad browser regressions for relevant code changes.

The acceptance test should be operational: an authorized edit, swap, replacement or discharge requires no test-file maintenance; EXPO schedules the intended dishes with matching portions; genuine safety or delivery failures remain visible.

**Validation record**

The [machine-readable receipt](receipts/door_ci_audit_2026-11-06.json) records results and run links. Local Node was 24.19.0; hosted CI used Node 22 and independently produced the same baseline totals. Browser probes used fresh contexts, mocked feeds, a fixed service date and EXPO's pinned CODEX fixture. They did not use staff browser state or publish anything.

Reproduction scripts and full logs remain in `C:\Users\JasonKennedy\AppData\Local\Temp\door-ci-audit-20261106`: `probes.mjs`, `expo-swap-browser.mjs`, `baseline-tests.log`, and the named probe logs. No product code, tests, menu data or workflow settings were changed by this audit.
