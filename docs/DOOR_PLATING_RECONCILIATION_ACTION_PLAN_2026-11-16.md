# DOOR plating reconciliation action plan

**Status:** Independently reviewed: food/data PASS; release/feed PASS. A1 merged in PR #203. PR #204 merged the six A2 naming assignments, interim breakfast definition safeguard and B0 evidence. The inactive B1 resolver foundation is independently reviewed; operational B1/B2 migration and remaining gates are tracked below. **Owner:** this file owns this DOOR workstream's actions, decisions and completion state. Jason owns meal choices and resident instructions; the implementing agent owns code, reproducible verification and release evidence. Cross-app release/status facts remain in HOUSE_STATUS_LEDGER.md; producer contracts remain with their existing owners.

Requested November 16, 2026: prioritize the manual-plating comparison findings, starting with anaphylactic alternatives and breakfast, identify decisions needed from Jason, and submit the plan for agentic review. The current manual plating sheets are authority for what staff serve (Jason, November 16). Their absent separate-plate definitions remain gaps; the agent must not infer a missing dish from a recipient list. Planning and review do not alter the registry, menu, learned answers or manual workbooks.

## Evidence and boundaries

Baseline: [comparison report](reviews/DOOR_MANUAL_PLATING_COMPARISON_2026-11-16.md), [source mapping and hashes](receipts/door_manual_plating_comparison_2026-11-16.json), and [comparison workbook](../outputs/door-manual-plating-20261116/DOOR_manual_plating_comparison_2026-11-16.xlsx). Audit code baseline: `eb13cd078e5fa8b949ab887f39125348308f213d`. Counts below are frozen audit findings, not permanent test constants. Re-fetch main and compare all input hashes before implementing a slice; refresh only affected evidence when a source changes.

The 171 room identities match all ten manual masters. The evidence covers 84 rotation slots from 71 visible meal tabs. Jason chose visible tabs matching the current rotation, with ambiguous duplicates flagged; 54 alternate/hidden tabs were excluded. The selected shared Week 2/4 Sunday tab specifies chicken deli; the earlier protein ambiguity is resolved by the manual authority rule. Unlisted manual residents were inferred standard, which does not prove what staff served. Recipe/allergen facts come from CODEX, not copied manual CONTAINS rows.

**Authority clarification during implementation:** Jason confirmed that the current manual plating sheets are what is served and are an authority. Use an unambiguous selected current manual meal/plate as the intended operation when DOOR disagrees. The B/M identifiers below remain traceability references; do not ask Jason to choose the same manual plate again merely because DOOR differs. Ask only about missing definitions, ambiguous duplicates, product/ingredient facts and recipient requirements that the evidence cannot establish. Authority over the served plate does not clear anaphylactic flags, waive ingredient checks, prove a clinical texture level, or turn excluded/older tabs into current instructions.

There are two distinct problems: incomplete or misleading generated meal definitions, and disagreements about what the intended meals/resident instructions should be. Code can expose the first without guessing answers to the second. A named dish alone does not establish ingredient compatibility or separate preparation.

## Priority and release sequence

| Priority | Slice | Deliverable | Jason input required | Completion condition |
| --- | --- | --- | --- | --- |
| P0 | A0 Assessment and approval design | Surface policy and approval/legacy-state design receipt | No meal answers needed to prepare the design; any new contract requires paired review | Ownership, persistence, binding and invalidation are specified before runtime approval semantics are implemented |
| P0 | A1 Anaphylactic output integrity | Missing named alternatives cannot masquerade as a completed separate meal | None to prepare the code and failing examples | Preview, XLSX and generation readiness agree that an affected unnamed meal is unresolved; flags and containment remain intact |
| P0 | A2 Six anaphylactic definitions | Approved replacement dishes, preparation instructions and actual recipients | A01–A06 and confirmation of the recorded resident scope | All triggered slots have a compatible, named, approved plan, including the four previously named slots retained under regression |
| P1 | B0 Breakfast representation gate | Combination-to-fields/routing/printed-output design receipt | Candidate structure can be prepared before answers; approved entries bind to B/R decisions | Existing fields are proved sufficient or the minimum model/consumer change is explicitly scoped before migration |
| P1 | B1 Breakfast definitions and representation | Complete main/vegan/GF/other breakfast definitions for all 28 slots | B01–B07, including combined requirements and week variants | No lunch-style fallback or standard egg/dairy description passes as a completed breakfast replacement |
| P1 | B2 Breakfast routing and printed detail | Correct recipients, components and notes for approved breakfast definitions | Any unresolved resident decisions affecting a slice | Approved combined requirements survive routing; no duplicate or missing resident; no unresolved placeholder in a final sheet |
| P2 | C Plain alternatives and menu reconciliation | Reviewed lunch/dinner plain, GF, diabetic and side choices | M01–M08 plus R decisions where relevant | Each approved dish and recipient policy agrees across menu, preview, XLSX and routing export |
| P2 | D Registry and learned-answer reconciliation | Explicitly confirmed corrections to resident instructions and the old learned answer | R01–R12 | One authoritative correction per instruction, with attribution; repeat import does not restore a rejected answer |
| P3 | E Manual fallback and closeout | Correct temporary manual calculations/labels and rerun the comparison | M09, and duplicate/room decisions R10–R11 | No contradictory counts, unresolved duplicates or unknown room codes; disposition recorded for every finding |

A1 and breakfast code/design preparation can proceed while dish decisions are pending. No data slice is released on the assumption that silence approves a proposed meal. Do not wait for every later registry/menu question to prepare an independent early slice; block only the slices whose recipient or ingredient decisions depend on it.

## A Anaphylactic alternatives first

### A0 Define naming integrity and approval separately

A missing-name check is implementable against the existing trimmed alternative strings. A nonempty string does not establish approval, ingredient compatibility or preparation instructions. A1 may deliver naming-integrity protection without inventing a new approval contract; it must not describe the four legacy named alternatives as verified merely because text exists.

Before runtime approval is used to mark a meal ready, produce a reviewed design receipt specifying: Jason as decision authority; the authoritative approval record and its storage/publish owner; exact meal/components and relevant resident-requirement/exclusion scope; recipe/product provenance and separate-preparation instructions; approval actor/date and decision ID; and binding to the exact input revision. Specify invalidation when meal/components, recipe facts or recipient requirement scope changes. A changed recipient identity that has the same approved requirements needs explicit treatment in that design; do not infer that an old approval fits a changed exclusion scope.

Define the four legacy named alternatives as named but unverified until checked and bound to the approved evidence; do not backfill fictitious approvals. A1 alone preserves their existing named-dish behavior while clearly avoiding any new verification claim. If the approval meaning needs persisted menu metadata or affects a consumer's interpretation, the producer/schema/consumer gate is a prerequisite, not a follow-up after migration. The plan/decision log records Jason's answers but is not silently treated as a runtime approval database.

### A1 Remove misleading completion behavior

1. Add one DOOR-owned assessment of a triggered meal's alternative: the trigger, affected residents/roommates and named dish/components. Its first stage distinguishes missing from named; the A0-approved stage may additionally assess bound approval information. Use the existing resident authority (`isAnaph` OR the anaphylactic room list) and per-resident allergen scope. Never infer that a false `isAnaph` clears room 213's list membership.
2. Replace the current main-name fallback with explicit unresolved wording when an alternative is missing. Do not relabel the standard dish prepared separately, or replace the word peanut, as if that defines a compatible meal. Share the assessment across review, preview and XLSX so the surfaces cannot disagree.
3. Apply the outcome table below. A1's missing-name protection and any later A0-approved verification state share a consistent assessment rather than different ad hoc guards. Preserve red warnings and existing acknowledgement; acknowledgement cannot manufacture a named dish, ingredient facts or an approval record.
4. Preserve atomic publication, transaction/outbox recovery and the existing menu/routing coherence rules. No selective publication of a partial or contradictory feed set, no new whole-HOUSE block and no silent reduction of existing flags. At implementation review, prove the exact effect on Generate, individual download, zip, preview/print and Publish rather than adding a second incompatible publish gate.
5. Initially use the existing meal fields and CODEX references. If representing assessment/approval requires a new published field or a changed consumer meaning, stop that contract change at a defined boundary and include its producer schema and affected consumers in the same release. Do not invent a schema extension inside a UI patch.

### A1 surface outcomes

Assess a side-effect-free projection of the post-queue registry after existing kitchen-list reconciliation and anaphylactic questions, before recent-log writes, snapshot creation, `applyQueueToRegistry` or queue clearing. Use one shared transition model, not calls to live save/apply functions disguised as a dry run. Recheck against the actual committed/pinned inputs when a menu, recipe or resident change invalidates that projection.

| Surface | Missing named alternative, or later an unresolved A0 verification state | Named/verified state and invariants |
| --- | --- | --- |
| Generate | If preflight is cancelled or fails, keep the queue and stored registry untouched. When the user proceeds with resident saving, preserve the save and normal coherent publication; report the affected plating outputs as NOT READY. Do not claim that the whole planned file set is updated/ready. | Distinguish resident save/delivery, file readiness and actual files produced. Existing safety questions still apply; no sheet status rewrites the saved resident outcome. A1 named-only results are not represented as proof of approval. |
| Individual workbook download, including breakfast combined books | Preflight all services requested by that workbook. Refuse the whole requested final workbook and list unresolved slots; no silent omission of a day. | Serialize only the complete, current requested manifest after readiness passes. |
| Download All ZIP | Preflight the entire requested manifest before serialization. Refuse the entire final ZIP on an unresolved included service. | A build error also aborts that final ZIP rather than catching/skipping and announcing the planned count. Report actual success only; preserve the user's data. |
| Preview | Remains available, prominently DRAFT / NOT FOR SERVICE with slot, affected scope and missing facts. | Show actual named components, red warnings and the applicable state without claiming more verification than A0 establishes. |
| Ordinary service print and print-triggering preview paths | Refuse ordinary final print and identify the unresolved slots. If a dedicated draft print is offered, its print-visible DRAFT / NOT FOR SERVICE warning is unavoidable. | Service print uses the same current assessment. A hidden browser banner is not sufficient print protection. |
| Publish, outbox, retry and another-device replay | Continue the existing complete, coherent transaction for resident/menu/routing updates. Check the pinned candidate for warnings/provenance, but do not add a global readiness stop or omit selected feed members. | Publication/delivery is not a claim that a meal has passed approval. Recompute readiness on the other device and after input changes; preserve transaction and recovery guarantees. |

The current per-day and per-file catch-and-continue paths must be exercised explicitly. Throwing in `buildDaySheet` alone is insufficient because callers can return a partial workbook/zip. The resident save must neither be lost nor misreported as rejected because a later document is not ready.

**A1 proof:** current blank-alt cases fail an independently specified output/readiness check; approved synthetic alternatives pass. Non-triggered meals stay unchanged. Retain positive conflicts, room/roommate containment, per-allergen scope and the four existing named alternatives. Exercise individual and batch generation, printing and recovery. Do not silently skip an affected day and call the remaining zip a complete week.

### A2 Decisions needed from Jason

All six audited gaps affect room 213. Trigger labels below reflect the captured CODEX/menu facts and must be refreshed if those inputs change. Do not clear a trigger to make a replacement pass.

| Decision | Meal | Captured triggers | Jason must supply or approve |
| --- | --- | --- | --- |
| A01 | W1 Monday dinner — Jerk Chicken, rice/beans, cabbage | Coconut, Tree Nuts | Exact separate protein and sides; recipe/product references; preparation instructions; recipient scope |
| A02 | W1 Wednesday dinner — Butter Chicken, naan, green beans | Coconut, Tree Nuts | Same details for this service; do not assume the Jerk replacement fits |
| A03 | W1 Friday dinner — Pork Adobo, rice, green beans | Coconut, Tree Nuts | Same details, including the replacement protein and pork-related requirements |
| A04 | W2 Wednesday dinner — Yetisse Fish, okra/cassava stew, coconut rice/peas | Coconut | Exact coconut-free separate dish/components and preparation instructions |
| A05 | W3 Thursday dinner — Pork Griot, rice, chakalaka | Coconut | Exact separate dish, including the rice choice and replacement protein if applicable |
| A06 | W4 Monday dinner — Fish Curry, rice, zucchini | Coconut, Tree Nuts | Exact separate dish/components and preparation instructions |

For each answer record: decision ID, week/day/meal, complete dish/components, recipe/product evidence, scope of exclusions, affected residents/roommates, separate-preparation instructions, approved by and date. The trigger labels are not the complete list of that resident's requirements: retain room 213's recorded soft/corn/popcorn requirements and all other applicable notes, without silently promoting an avoidance into a new anaphylactic trigger. Record current approved recipient reasoning; do not hardcode a manual room list as a replacement for the routing engine.

The four already named alternatives — W2 Mon dinner, W3 Tue dinner, W3 Fri lunch, W4 Sat dinner — are regression references, not fresh assertions of allergen compatibility. Recheck them against current CODEX facts and the relevant resident scope. Flag conflicts or missing facts for resolution; never silently clear a warning.

## B Breakfast next

### B0 Representation gate before breakfast migration

Prepare a concrete design receipt for each approved family/variant and applicable combination: chosen dish/components; secondary substitutions and printed notes; source fields and recipe/product references; routing result; and expected preview/XLSX output. Use controlled candidate recipes to explore the design before Jason's answers, then bind accepted entries to the exact B/R decisions. Verify every current resident's approved plate, not just representative cases or appearing once.

The receipt must demonstrate that existing fields and first-match routing express the approved combinations, or identify the smallest necessary model/routing change, owner and affected consumers. It is a named prerequisite to B1/B2 data migration. It must not solve vegetarian/GF/dairy-free collisions by changing global precedence or by creating fixed room lists. Any public contract change follows A0's paired producer/consumer boundary.

### B1 Establish a complete breakfast matrix

Use seven breakfast families, retaining their week variants. Confirm what the kitchen actually makes before filling fields. Manual dishes below are candidate evidence, not pre-approved replacements.

| Decision | Family and variants | Manual evidence to review | Jason's decision |
| --- | --- | --- | --- |
| B01 | Sunday sandwiches: W1/W3 pork; W2 chicken; W4 turkey versus chicken unresolved | GF buns; a vegan patty/cheese sandwich; a halal deli version; separate bland descriptions | Confirm the W4 protein, complete standard meal and approved GF/vegan/halal/dairy-free/egg-free/soft variants actually required |
| B02 | Monday pancakes, all weeks | GF pancakes versus GF/DF oatmeal; vegan pancakes; turkey bacon versus halal deli | Confirm the products/recipes, which distinct plates remain, and combined-requirement substitutions |
| B03 | Tuesday cereal, all weeks | Chex with regular or soy milk; cereal with oat milk | Confirm cereal and milk variants, per-resident milk instructions, and whether the standard meal needs no separate soft plate |
| B04 | Wednesday frittata: W1/W2/W4 vegetable; W3 ham | GF bread; LF/DF variants; oatmeal for soft/vegan groups | Confirm the true vegan/egg-free and GF combinations, yoghurt/milk products, and soft alternative versus suitable-as-is |
| B05 | Thursday scrambled eggs/sausage, all weeks | GF roll; halal deli; a no-eggs potato/vegan-patty plate | Confirm non-pork protein, egg-free/vegan components, GF combinations and any non-processed alternative |
| B06 | Friday deli/egg/cheese: W1/W3 turkey; W2/W4 ham | GF oatmeal; other oatmeal/DF-yoghurt variants; halal deli | Confirm retained components and the correct GF, vegan, dairy-free, egg-free, soft and non-processed plates |
| B07 | Saturday bagels, all weeks | GF bread; jam/DF yoghurt; tofu scramble | Confirm actual vegan/dairy-free/GF combinations and the intended soft/plain plate |

For each family/variant, mark each applicable route with **a named approved dish**, **standard meal explicitly suitable for that requirement**, or **still unresolved**. Include component-level substitutions, milk/yoghurt/product identities, portion/grain instructions where required and recipe/allergen provenance. A generic no-alternatives-needed answer must not suppress a distinct GF, egg-free or other required plate.

Refresh CODEX facts for chosen recipes/products. Resolve ambiguous LF/DF/vegan wording from actual facts and approvals, not the manual section heading. Do not treat a GF dish as automatically vegetarian, dairy-free or egg-free. No automatic almond-milk choice for room 1207 while its instruction conflicts with the existing nut avoidance.

### B2 Fit the approved matrix into DOOR without losing combined requirements

- Fill the existing breakfast main/vegan/GF/halal and kitchen-alt fields where they can express the approved dishes. Review `_altMealsNone`, `_softAlt`, `_altMeals`, `_diabeticAlt`, `_noDairyAlt` and `_noEggAlt` together; do not set a blanket flag to hide missing definitions.
- First prove that the present representation/routing can express the matrix. If a vegetarian/GF/dairy-free combination cannot survive existing precedence or one generic GF field, specify the smallest necessary model/routing change, its owner and consumer effect before migrating data. Do not duplicate the registry into per-meal fixed room lists or change global precedence merely to make a manual count match.
- Cover representative combined cases from the actual current registry: 301a (GF/vegetarian/lactose/No Beans, with additional requests pending); 304 (Halal/No Eggs); 412 (No Eggs/lactose, mayonnaise note); 607a (No Dairy/No Peanuts, anaphylactic); 1207 (GF/lactose/shellfish/nut avoidance, milk ambiguity); 213/709/711 (different soft/plain requirements); 614b (Diabetic/Low Sodium/No Processed Food); 1007 (Low Carb/Low Sodium and the retained rice/pasta/protein note). Also cover 801's vegetarian/No Spicy combination. Keep unresolved resident instructions visible rather than assuming a value for these tests.
- Make the readable sheet describe the plate that resident actually receives, including specific notes and ingredient substitutions. Distinguish ingredient evidence, a kitchen-approved modification and an unresolved request.

**B exit proof:** every one of the 28 breakfast slots is reviewed; all 28 audited lunch-style GF fallbacks are replaced by approved breakfast definitions or remain visibly unresolved; the eleven repeated standard descriptions are resolved; each of the sixteen breakfast placeholders has a named plate or a justified suitable-as-is decision. Approved non-processed, diabetic, dairy-free and egg-free requirements are also covered, not only GF and vegan. Validate combined cases and both breakfast workbook outputs. A zero-placeholder count alone is not proof of a correct breakfast.

## C Lunch and dinner plain plates and menu decisions

| Decision | Difference requiring Jason's choice |
| --- | --- |
| M01 | W4 Tue lunch: retain the six-person roast-chicken/veg/plain-rice plate for 213, 304, 412, 709, 905, 1007, or approve a different recipient policy? Confirm whether the standard Donburi includes the manual marinated egg. Coordinate with 1007's rice instruction. |
| M02 | W4 Tue dinner: confirm the roast-chicken/biryani alternative versus tofu or halal tandoori chicken for 412, 1112 and 1207. Resolve 1112's duplicate assignment first. |
| M03 | W4 Fri dinner: confirm GF kimchi-rice suitability from current recipe facts or choose a different GF dish; name/approve the soft plate. Confirm Bok Choy. |
| M04 | W2 Thu and W3 Tue lunch: confirm the manual plain plates and the intended eligibility for residents outside the GF group, including 905/1007. Do not assume that GF routing alone represents those plates. |
| M05 | W4 Mon lunch: choose sub bun/soup/salad versus fruit/chips, the whole-wheat tortilla instruction for diabetics, and whether 711/1007 need the manual plain plate. |
| M06 | W4 Wed lunch: potatoes/green beans versus yam/broccoli; confirm the complete main and relevant alternatives together. |
| M07 | W1 Wed dinner sides; W1 Thu lunch soup/salad; W2 Sat dinner squash/gravy versus zucchini: choose the intended components. |
| M08 | W1 Mon dinner vegan plate: cauliflower versus tofu. Confirm recipe identity and sides, not just the name. Review all sixteen audited lunch/dinner generic GF fallbacks, including the cases already addressed above, and the single lunch non-processed fallback as approved defaults or missing definitions. |
| M09 | Are the manual workbooks needed as a maintained temporary fallback, or should they become frozen references replaced by approved DOOR-generated sheets? Recommended: one-time corrections only where staff still need the fallback, then end the duplicate registry/meal maintenance after acceptance. |

Implementation uses approved choices to update the authoritative menu once and regenerate its dependants. Keep the whole-dish/swap and current-recipe semantics. Revalidate affected recipes/flags and routing after a side/protein change; a wording cleanup alone is not permission to clear allergen facts. The three non-breakfast placeholders are covered by M03/M04.

## D Resident decisions needed from Jason

These are confirmation requests, not instructions to restore every older manual entry. Record each answer as retain current, restore/clarify a specific instruction, or unresolved, including whether it is a routing restriction, a preparation note or a preference and the source/approver. Medical or allergy details that Jason cannot confirm stay unresolved for the responsible clinical/kitchen authority; the agent does not infer them.

| Decision | Room | Question |
| --- | --- | --- |
| R01 | 305 | Is No Olives still required? If yes, where should it be represented and how should it affect the printed plate? |
| R02 | 301a | Confirm tomato/broccoli exclusions and oat-milk-only wording; current GF, vegetarian, lactose and No Beans remain. |
| R03 | 405 | Confirm Vegetarian versus the old chicken/fish wording, No Sauce and any separate plain requirements. Confirm whether the remembered Halal answer should be removed/corrected. Do not remove it merely because the form default was fixed. |
| R04 | 502 | Is the omitted No Sodium instruction current, and what exact note/restriction should be recorded? |
| R05 | 710 | Confirm the intended sodium wording alongside the retained Halal/Low Fat requirements. |
| R06 | 912 | Does No Sausage exclude all sausages, or only pork? Retain GF/No Pork while resolving the distinct instruction. |
| R07 | 1211 | Confirm diabetic status and intended grain/starch instructions; resolve Daiabetic in the source and the current missing Diabetic tag together. |
| R08 | 701a | Confirm whether High Protein/Low Sugar are current preparation instructions or preferences, alongside Halal/No Soy. |
| R09 | 1207 | Clarify almond/soy milk permission versus nut avoidance. Preserve the existing avoidance and Soy Milk only note until an explicit correction is approved. |
| R10 | 1007 / 1112 | Resolve 1007's duplicated W3 Wed breakfast plate and 1112's duplicated W4 Tue dinner plate. Confirm 1007's actual rice/pasta instruction before approving a rice-based alternative. |
| R11 | 602 | Which resident, 602a or 602b or another confirmed ID, does the manual W3 Wed lunch row mean? Never guess the suffix. |
| R12 | 1215b / 709 / 1007 | Their notes are retained. Resolve the exact plate choices in the service register below; reuse M/R answers rather than asking twice or creating new global exclusion rules. |

### R12 service choices without reclassifying retained notes

For 1215b, choose the named manual plate, the DOOR standard with an explicitly confirmed modification, or another fully specified dish for each row. The current food-exclusion note stays in place. A confirmation of one service does not authorize all twelve.

| Decision | Service for 1215b | Manual plate | DOOR standard before its retained note |
| --- | --- | --- | --- |
| R12.01 | W1 Sun lunch | Deli chicken/cheese, lettuce, side salad | Chicken deli/cheese, broccoli salad |
| R12.02 | W1 Tue dinner | Roast chicken, plain rice, veg excluding broccoli/cauliflower | Pork carnitas, Spanish rice/vegetables, broccoli |
| R12.03 | W1 Wed dinner | Baked basa, plain rice, modified veg | Butter chicken, naan, green beans |
| R12.04 | W2 Wed lunch | Crispy drumsticks, yams, veg stirfry | Oven-fried chicken, biscuit, broccoli |
| R12.05 | W2 Fri lunch | Roast chicken, potato, cabbage | Beef chili, cornbread, cabbage |
| R12.06 | W2 Tue dinner | Plain roast chicken, rice, modified veg | Pork vindaloo, broccoli, rice |
| R12.07 | W3 Wed dinner | Cajun fish, rice, modified veg | Cajun fish, couscous, broccoli |
| R12.08 | W3 Sat dinner | Plain roast chicken, modified veg, rice | Roast chicken, pineapple rice |
| R12.09 | W4 Thu lunch | Roast chicken, rice, zucchini/carrot | Beef lasagna, zucchini/carrot |
| R12.10 | W4 Sat lunch | Vegetable medley, garlic bread, modified veg | Lime chicken, garlic bread, broccoli |
| R12.11 | W4 Sun dinner | White chili chicken pasta with modified veg | White chili chicken pasta, broccoli |
| R12.12 | W4 Sat dinner | Roast chicken, plain rice, veg | Beef Massaman curry, rice |

For 709, reuse M04 for W3 Tue lunch (named roast-chicken plain plate versus a placeholder) and M01 for W4 Tue lunch (plain plate versus standard Donburi). W4 Mon dinner already has the same named marinated-fish plain plate in both sources and does not require that question again.

For 1007, resolve the rice/pasta meaning through R10 first, then reuse M04 for W2 Thu/W3 Tue lunch, M05 for W4 Mon lunch and M01 for W4 Tue lunch. **R12.13:** on W4 Mon dinner, confirm the manual marinated-fish/plain-rice plate versus DOOR's curry with the retained note. Review that rice choice against R10 rather than assuming the manual dish overrides the recorded instruction. The full Room comparison remains the evidence for disposition of any further differences; these named decisions do not auto-approve every differing plate.

After R03, repair the malformed source text deliberately and migrate only the approved learned answer. Preserve history and unrelated learned rules. Prove the corrected import does not reintroduce the rejected tag through exact-text matching, token fallback, another device's stale learned store, or the normal merge/publish path. A replay is required; correcting the spreadsheet string alone is insufficient.

## E Manual fallback and reconciliation closeout

If M09 retains temporary manual use, work on reviewed copies and preserve the original archive. Replace fixed counts and incomplete ranges with roster-derived calculations; do not type 171 into every cell. In the audited sources, B179 undercounts regular rooms by one and B180 excludes row 177. Remove old 175/180 totals and the conflicting W1 Mon footer calculation. Calculate actual separate-plate portions after duplicates and recipient decisions are resolved; do not subtract diabetic annotations or overlapping groups twice.

Correct the W3 Sat dinner header and the copied vegetarian-frittata CONTAINS PORK label against the actual selected meal and CODEX evidence. Resolve the W4 Sunday protein decision and room-code/duplicate choices. Keep archived/hidden tabs out of the current rotation mapping unless Jason changes that scope explicitly.

Regenerate the 84-slot comparison from the same approved inputs. Check every resident identity, section, dish/components and printed note, not exact text equality alone. Give each audit finding F01–F16 a disposition: corrected with evidence, accepted intentional difference with Jason's reason, or explicitly unresolved. An intentional difference may be accepted; an unapproved safety ambiguity cannot be made green by relabelling it as wording.

## Verification and implementation reviews

Each implementation slice needs concrete failing examples on its pre-change baseline and checks against the corrected behavior. This is safety/output work, so meaningful regression tests are required; tests must specify the required output independently, not mirror helper implementation.

- Use synthetic, controlled combined-restriction cases alongside the frozen source comparison. The roster count is derived from the selected approved registry, not permanently hardcoded to 171. Each active resident must appear exactly once per service across standard and special plates; detect duplicates with counts, not just a set that can overwrite them.
- Exercise review, actual preview/print, `buildDaySheet`, both breakfast workbook builders, four-week lunch/dinner builders, individual download, zip and Generate. Verify the changed definitions reach published menu/routing through the existing coherent transaction and survive restore, replay and another-device merge.
- Protect existing anaphylactic flags, acknowledgement, roommate containment, source allergen ownership and scoped triggers. Missing recipe facts or an unresolved dish must remain visible; an approval record is not an allergen fact.
- Review the current browser/file fallback path, light/dark output and print; inspect actual saved XLSX output in Excel or the staff target viewer for the affected sheets. An extracted cell table or browser screenshot alone is not native workbook verification. Preserve the original manual files.
- Run the applicable DOOR safety suite and coherent-publisher/browser checks, then independent food/data and release/feed reviews on the final candidate. A schema/consumer change adds paired producer/consumer gates in that change set.
- Record source SHA, input hashes/as-of dates, CODEX provenance and decision IDs on verification receipts and generated output metadata/footers through their existing provenance surfaces. Never publish private resident details in a public feed or add the audit workbook to Pages.

Release one reviewable slice at a time. Merge code and its approved data as required for coherent behavior; publish from the reviewed current app, verify served source and outputs, and update the status owner. Roll back only the faulty meal fields against the latest menu revision, rebuild routing with the current registry, and use the coherent transaction while keeping the red unresolved state. Do not use Undo Generate or a historical whole-registry restore for a menu correction. Rollback must not restore a misleading main-meal fallback or a cleared flag. Prove a resident change made after release survives the rollback, publication and another-device replay.

## Decision record and tracking

Use the A/B/M/R identifiers above so Jason can answer briefly. Append the exact answer, approver/date, supporting recipe/product/resident evidence, affected slots, implementation change and verification reference here. Until answered, an item is open. Reusing a dish or family across weeks requires an explicit scope; approval for one service is not approval for every week.

| Slice | State | Blocking decisions | Evidence |
| --- | --- | --- | --- |
| A0 | Ready for design preparation | Runtime approval semantics require its reviewed ownership/storage/binding/invalidation design; contract changes are paired | Pending design receipt |
| A1 | Merged in PR #203 | Historical output acceptance is not expanded into ingredient/preparation approval | [A1 receipt](reviews/DOOR_ANAPHYLACTIC_OUTPUT_SAFEGUARDS_2026-11-16.md) |
| A2 | Six canonical naming assignments merged in PR #204; independent reviews PASS | Individualized compatibility, preparation/product checks and four legacy definitions remain separate | [Binding receipt](receipts/anaphylactic_recipe_binding_2026-11-16.json) |
| B0 | Matrix/proof merged in PR #204; inactive resolver foundation reviewed | Existing fields fail combined requirements; activation, persisted representation and paired consumer design remain required before migration | [B0 matrix/design](DOOR_BREAKFAST_MATRIX_AND_REPRESENTATION_2026-11-16.md) |
| B1–B2 | Gated on representation and ingredient facts | Selected manual dishes accepted; resolve product facts/ambiguous assignments and implement all secondary requirements | [Breakfast matrix](DOOR_BREAKFAST_MATRIX_AND_REPRESENTATION_2026-11-16.md) |
| C | Needs meal choices | M01–M08 and applicable R decisions | Pending |
| D | Needs resident confirmations | R01–R12 | Pending |
| E | Proposed | M09; R10/R11 before final portion counts | Pending |

Each implementation slice records its exact approved decision IDs, affected services, applicable unresolved resident dependencies, source revision and required design receipt before it starts. Dependencies are local: an unresolved milk change for one branch must not block an independently approved plate that preserves the existing authoritative requirements. It also must not be silently resolved to make an entire family look complete.

## Independent plan review

Reviewers receive this plan, the frozen comparison, source receipt and the actual renderer/routing code where relevant. They report findings as text; only the primary session writes this owner document. Review questions: are immediate safety gaps addressed before broad cleanup; are required meal/resident decisions explicit; can the slices be implemented without invented clinical facts, fixed room-list routing or broken publication; are combined breakfast requirements expressible; are verification and rollout sufficient; is every F01–F16 covered?

Both reviewers passed the revised plan with no remaining plan blockers. The [dated review receipt](reviews/DOOR_PLATING_RECONCILIATION_PLAN_REVIEW_2026-11-16.md) records their verdicts, incorporated corrections, reviewed content hash and F01–F16 coverage. Plan acceptance is acceptance of sequencing and safeguards, not approval of unanswered meal/resident decisions or proof that execution has completed.

## Implementation decision log — November 16

Jason authorized Chicken Leg for missing non-vegetarian allergy plates, basa when the main meal is fish, with plain rice and stir-fry vegetables. Any existing plain/other alternative meeting every relevant restriction may be used instead. The six initial defaults are A01/A02/A03/A05 chicken leg and A04/A06 basa. Existing named manual alternatives remain authoritative; this is not a blanket overwrite. Jason also authorized creating and adding the plain recipes to CODEX. Recipe/product facts, preparation, texture and compatibility evidence remain the A2 completion gate. See the A1 receipt for the exact decisions and candidate verification.

The CODEX recipes are now accepted and anonymously served; their frozen publication proof is [the recipe receipt](receipts/codex_plain_alternatives_publication_2026-11-16.json). A1 merged in [DOOR PR #203](https://github.com/kennedyjasondavid-eng/conc-kitchen-door/pull/203). Recipe publication and merging do not establish individualized ingredient/preparation approval; historical output acceptance is recorded separately.

## Recipe assignments and breakfast matrix follow-up

PR #204 merged. That change sets only the six missing dinner alternative names to the exact canonical Chicken Leg/Basa plate recipes, with source IDs/fingerprints in the binding receipt. No public binding field or runtime approval meaning is invented. The actual coherent publisher preserved all residents/flags, import provenance, unrelated meals and routing portions. Another-device replay and a concurrent newer resident edit passed.

The [breakfast matrix and B0 proof](DOOR_BREAKFAST_MATRIX_AND_REPRESENTATION_2026-11-16.md) owns the detailed matrix evidence. Jason confirmed oat milk only for 301a and smaller breakfast starch plus extra protein for 1007, retaining No Rice/Pasta and all current accommodations. Quantities remain unspecified; no GF diagnosis is added. These instructions are recorded in the review matrix, not silently applied to the operational registry. The 1007 W3 Wednesday duplicate and exact DF/LF yoghurt product facts remain visible. Breakfast fields have not been migrated because existing first-match routing demonstrably loses secondary requirements.

Jason confirmed the No Dairy yoghurt substitute still needs confirming. The Activia LF-style example is not an approved milk-free product or an exact selected SKU; the B0 matrix records the investigated example and keeps affected variants unresolved.

## Interim breakfast safeguard — merged in PR #204

Final breakfast files and print are refused when an occupied GF alternative section has no named breakfast plate; previews show DRAFT / NOT FOR SERVICE and an unresolved section. This covers 14 current services in Weeks 1 and 3. Existing routing calculations retain their fallback until B1; the review matrix distinguishes those calculations from the guarded preview. Defined plates still require the full B1/B2 requirements and product checks. Food/data and release reviewers passed this narrow guard. The No Dairy yoghurt substitute remains unconfirmed, as Jason explicitly advised.

## B1 resolver foundation — November 17

Jason directed continuation after PR #204 merged. The next slice implements the inactive shared resolver and complete-roster aggregation in the single-file app. The [producer-owned internal interface and activation gates](../schemas/breakfast_plate_model.md) own its exact fields, evidence/invalidation, ambiguity, quantity and legacy rules. This interface is not a current public feed or persisted menu schema. No staff output, readiness, operational meal, resident record, app stamp or consumer behavior changes in this slice.

Both implementation reviewers passed the foundation; the [review receipt](reviews/DOOR_BREAKFAST_RESOLVER_FOUNDATION_REVIEW_2026-11-17.md) records validation. Product provenance authentication, complete requirement adaptation, typed private request storage, output integration and paired consumer semantics remain activation gates. The current manual sheets remain meal authority; missing product facts are not resolved by the model.

Jason's November 17 product direction: “Chex is a brand name, assume Kirkland brand for oat/soy milks”. Record Chex as the cereal brand and Kirkland as the working assumption for both plant milk brands. Exact varieties/SKUs and formulas are unverified. This is not ingredient/allergen evidence or a new CODEX fact record. No Dairy yoghurt remains unconfirmed. Do not ask the brand question again; request an exact variety/package only when needed for an affected plate's ingredient check.
