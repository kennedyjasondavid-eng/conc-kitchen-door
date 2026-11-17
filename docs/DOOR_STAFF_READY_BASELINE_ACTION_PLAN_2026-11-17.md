# DOOR staff-ready baseline — action plan

Status: Independently reviewed; amendments incorporated 2026-11-17. Implementation authorized and started. Created 2026-11-17.
Owner of this workstream: this document. Implementation authorized 2026-11-17 with standard review cadence and merge authority.

## Outcome

A supervisor can use their familiar four-week menu, spreadsheet imports, daily changes and printed plating sheets through DOOR. They enter a change once, see exactly which residents/plates it affects, and know whether the kitchen received it. Every served component has a clear identity and ingredient evidence appropriate to that food. EXPO can plan the work and HUB can show the correct menu and recipe without staff repairing names or links.

This is a baseline release, not an open-ended redesign. Preserve the single-file application, normal Excel authoring, offline operation, resident instructions and separate anaphylactic controls. CODEX owns recipe/ingredient facts; DOOR owns service menus and residents; EXPO owns production planning; HUB owns its working board. Do not introduce a new source of truth.

## Evidence and relationship to existing work

Primary evidence: `outputs/menu-config-audit-2026-11-17/Menu-Config-Audit.html`, `link-inventory.json`, `browser-audit.json`, `cross-app-flags.json`, `codex-destinations.json` and associated logs. Audit captured 84 meals, 171 local residents, 197 populated top-level component slots: 65 ID links, 12 name-only links, 120 manual entries. Twenty-nine meals lack saved slots; 80 alternative text fields need classification. The 77 existing names resolve; 24 saved slots differ from current source facts.

These are dated observations, not fixed test expectations. Re-capture data before implementation. All-residents-assigned-once is a completeness check, not proof that each plate is suitable. The audit's historical edit-journey browser test stalled and was not counted as passing. Its cross-app flags comparison is illustrative; verify actual served renderers and effective dated meals in the release tests.

Continue the existing `docs/DOOR_MENU_FLOW_ACTION_PLAN_2026-11-06.md` mechanisms and rulings. F1, F3a, F4, F5 and F6 are delivered; reuse them rather than rebuilding delivery tracking. Its F3b boundary remains: do not activate portion scaling until CODEX receives/verifies identity, revision and serving basis in a coordinated producer/receiver change. Unscaled exact recipe links remain acceptable for this baseline when scaling cannot be proven. The HOUSE ledger owns cross-app release status; this document owns only this workstream's tasks and receipts.

## Decisions and calls

Bring calls to Jason one at a time, with the affected meal/workflow, evidence, practical alternatives, a lean and its consequence. Do not treat an unanswered call as approval. Continue independent work while a call is pending. Routine implementation choices do not need a call.

- D1 — APPROVED 2026-11-17: W3 Wednesday lunch vegan nachos omit Sour Cream. Keep regular Sour Cream and its Dairy fact. Record vegan side exclusion through DOOR's line controls and confirm menu, plating and exports agree.
- D2 — Conditional call after capability inspection: handling simple purchased/basic components for which a full recipe is inappropriate. First inspect existing servedWith, purchased-part and ingredient/label evidence support. Lean if a gap remains: a concise CODEX-owned component/product reference with known ingredient/label facts; DOOR retains an explicit unresolved manual state until that evidence exists. Do not invent a recipe, treat an empty allergen list as safe, or require a full cooking method for a fruit cup. Inspect current CODEX reference support before presenting concrete choices.
- Later calls only as needed: ambiguous dish/variant identity; undocumented allergen overrides; clinical/preparation ambiguity; a substantive change to normal save/publish behavior. Existing approved dish mappings and food-safety decisions take precedence after current evidence is checked.

## Release invariants

1. No automatic fuzzy attachment. Stable identity is authoritative; display wording may change without changing the recipe. A recipe rename with the same ID is not a broken link. Duplicate IDs, conflicting identity claims and removed/unavailable records require visible review.
2. A sauce, seasoning, purchased product and complete plate remain distinguishable. Linking a sauce does not supply facts for added meat, pasta, garnish or toppings. All separately served ingredients must be covered.
3. Unknown remains unknown. Intentional omissions and substitutions are explicit per service line. A food marked vegan cannot inherit a known animal ingredient unnoticed.
4. Do not silently remove warnings or override anaphylactic scope/acknowledgement. Retain known facts on fetch failure; display unavailable/stale evidence honestly. Overrides must have a reason and source; legacy differences are unresolved until reviewed, not assumed intentional or assumed wrong.
5. Save, routing, plating, labels and exported menu describe the same effective dated meal. Residents and preparation notes survive revisions. Restore/undo restores a coherent meal, not only its text.
6. Changes to published contracts ship with required consumers. Shared/public recipe delivery alone is not downstream adoption. A single app's successful save is not proof of the receiving device's state.
7. Ordinary changes do not require editing tests, developer GitHub credentials, full browser CI on data-only publishes, or extra repeated confirmation dialogs.

## Stage 0 — establish a safe, current baseline

Work:
- Inspect the current remote heads, PRs/checks, served source and HOUSE ledger; identify concurrent work before editing. This OneDrive checkout has substantial existing changes and an old HEAD. Preserve them. Use the repo's approved OneDrive-only workflow; do not create a second clone or sweep unrelated files into a commit.
- Capture source hashes, effective menu/dated changes, public CODEX base plus Library projection, routing/publication receipts and relevant consumer versions. Keep private resident data local; public review evidence uses redacted or synthetic examples.
- Run the relevant existing gates and explain the activation-base ancestry failure against a current appropriate checkout/history. Do not amend a gate to bless stale history.
- Reproduce each priority finding against current source. Establish a passing ordinary edit/save/publish/receive/print journey in an isolated test environment, or record the precise defect blocking it. Resolve the stalled historical edit test rather than claiming it passed.

Exit: a reviewable baseline receipt, protected existing work, current issue list and an identified place to commit only this workstream. A scope/ownership conflict must be resolved before implementation starts; it does not block planning or read-only examination.

## Stage 1 — apply D1 and classify other contradictions

Work:
- Apply D1 via the normal DOOR menu writer: vegan line excludes Sour Cream; regular line retains it. Verify effective meal text, side slots and any dated override of that service.
- Read-only classification: review W3 Wednesday Beef/Vegan Nacho Mix facts against current CODEX, including Spicy, gluten, sulphites, beans, mushroom and corn. Inspect kitchen-specific editions and saved override history before deciding how to reconcile them.
- Read-only classification of all 24 source/saved differences, including existing explicit Spicy/ingredient rulings: new source fact, deliberate documented variation, erroneous source, or unresolved. Propose source corrections in CODEX and explicit variants for actual local variations, with evidence. Execute none of these fact changes until the reviewed Stage 3 policy is frozen. An explicitly unticked Spicy may be a deliberate kitchen decision; source disagreement alone does not authorize turning it on. Never bulk-relink solely to make the inventory green.
- Inspect affected residents and alternatives with the real routing engine; confirm warnings, separate preparation and lockout behavior where applicable. A valid ingredient list is not a clinical texture approval.

Exit: D1 is applied and other findings classified; no known unresolved contradiction is presented as ready for service; approved corrections reach preview and output; remaining unresolved meals are visibly identified with a practical supervisor action. Reviewers examine food safety separately from delivery correctness.

## Stage 2 — complete the menu/component map

Work:
- Build one review inventory for every regular, vegan, halal and restriction plate across breakfast/lunch/dinner, including extras, side-line versions, nested substitutions, dated swaps/specials and original/undo behavior. Do not stop at the audit's top-level counts.
- For each component record: menu occurrence/role, clean display name, source identity, source type (full recipe/component/product), evidence/revision, ingredient facts and uncertainty, per-line inclusion/substitution, and disposition. Use existing fields where sufficient; design additions with consumers only when necessary.
- Resolve the 12 unique name-only bindings to stable IDs without changing recipe meaning. Review the 18 exact-normalized manual candidates first, then remaining manual and imported meals. Exact spelling is a candidate, not approval to attach or replace flags.
- Split run-on components into correct roles. Preserve compounds that are genuinely one prepared recipe. Keep preparation instructions out of dish identity. Separate gravy/sauces/toppings when made or served separately.
- Confirm sauce-based dishes cover all additions; mixed-protein recipes identify the actual served variant. Never link a meatless label to a meat-containing full recipe because the names resemble each other.
- Standardize visible names: Donburi, Biryani, Turmeric; repair duplicate yoghurt/punctuation after checking the intended meal. Preserve ID and supported aliases. Review breakfast vegetarian/vegan distinctions and product-specific dairy/egg facts.
- Complete D2 using current CODEX capabilities. If references require a new CODEX feature, stage that producer/consumer work explicitly. Manual entry stays possible but cannot masquerade as verified evidence.
- Bulk reconciliation and any relinking that changes facts depend on the frozen Stage 3 policy. Dry-run the accepted mapping with a before/after diff; apply through sanctioned menu import/save writers. Preserve resident data, unrelated menu edits, overlay stamps and original snapshots. Record evidence and rollback path.

Exit: 100% of active service components are accounted for in the inventory. Every relevant CODEX recipe/component is uniquely linked; genuine products/basic foods have approved evidence references. Zero unexplained broken/ambiguous bindings, zero unexplained run-on slots, and no undisclosed source gap in a meal marked ready. If current capability cannot achieve this, mark the stage incomplete rather than defining missing facts away.

## Stage 3 — define fact policy, then make readers consistent

Dependency: policy design and independent review run before any Stage 1 fact correction beyond D1 or Stage 2 bulk reconciliation. Stage numbers describe work areas, not permission to execute fact changes in numeric order.

Work:
- Define one effective component-facts policy used by DOOR preview, routing, print, labels and published readers: source identity/revision plus recorded, justified service variant/override. Inventory the current precedence rules before changing them.
- Prefer the current conservative additive/removal-confirmation seams. New source warnings become visible across consumers; removals require their existing confirmation semantics. Decide whether any broader source precedence change is necessary only after reviewing real override cases with Jason.
- Present a compact Recipe updated comparison naming changed facts and affected plates. Avoid a prompt for every unchanged save. Keep unresolved cases visible and actionable; use red for actual anaphylactic conflicts, not ordinary link maintenance.
- Validate links on read, selection and save. Distinguish linked/current, source changed, unavailable/stale and manual/unreviewed. Validate by ID first, permit canonical renames, reject collisions; preserve captured facts when offline.
- Store only contract data needed by downstream consumers. Do not expose source evidence/private attribution or resident details in public feeds.

Exit: fixture cases for new/removed facts, intentional override, rename, duplicate/removed ID, cache/fetch failure and incomplete evidence produce consistent outcomes in every reader. A reviewer can explain any intentional difference. No green match badge is based solely on a nonempty recipeName.

## Stage 4 — build an intuitive supervisor editor

Primary path: choose service → edit main and sides → set line differences → review actual plates → Save → observe the delivery state for each known target.

Work:
- Keep week/day/meal and rotation-versus-one-off scope visible. Make changing this occurrence versus the rotation explicit using existing swap/import behavior; no surprise permanent edit.
- Give each component a Menu name and Linked CODEX recipe/reference with View/Change actions. Explain linking changes ingredient facts; renaming only changes display. Show a recipe's role so a sauce is not mistaken for a complete dish.
- Implement an accessible searchable picker: associated labels, keyboard list navigation, Enter chooses the highlighted recipe, Escape closes, and explicit Use as manual action. Never silently pick the nearest fuzzy match. Preserve intended text after a genuine explicit choice.
- Show Regular, Vegan and Halal plate previews with shared-side inclusion/substitution. Use clear wording (Gets this / Gets replacement / Does not get it). Put restriction-specific plates nearby, with useful counts based on current routing and preserved resident notes. If counts cannot be established, show unavailable rather than zero.
- Lead with ordinary meal fields. Collapse unchanged ingredient detail; surface missing facts and deliberate overrides. Keep advanced flags and uncommon alternatives available. Retain visible safety alerts when sections collapse.
- Add dirty-draft protection for Close, changing service/tab, import/swap and page exit. Offer Save, Discard and Stay only where data would be lost. Distinguish local draft from saved menu and published receipt. Preserve draft recovery where existing storage seams support it.
- Keep a visible Save/Cancel area, a readable actual plating preview, and plain feedback naming the strongest observed state and its target: Saved here / Waiting to send / Published and served / EXPO accepted this revision / HUB refreshed / Needs attention. A particular staff device is confirmed only by its observation. Use Kitchen received only if the UI makes the observed scope equally clear; do not add a device acknowledgement system. Reuse delivery receipts; do not create another receipt system. Replace the inaccurate save-to-link and allergens-are-safe claims.
- Make undo/restore scope explicit and preview what it restores. An import review shows retained versus replaced dishes/links/facts and preserves newer week take-back semantics.
- Validate normal desktop use first, tablet/phone practicality, keyboard operation, both themes and printed output. Do not pursue extreme zoom as a priority over kitchen use.

Exit: a novice supervisor can rename, replace a main, add a side, change a vegan side, create a complete plate, correct a link, recover a draft and undo a mistake without developer help. No unintended recipe unlink, lost draft, false save claim or hidden resident instruction. Existing print/readability behavior stays passing.

## Stage 5 — prove HOUSE delivery end to end

Work:
- Reuse F1/F4/F6 atomic publication/recovery and freshness semantics. Validate all exported files bind the same effective input revision and dates; legacy schema counters are not data revisions.
- Confirm CODEX base + public Library projection, DOOR accepted links/facts, EXPO identity/production decomposition, HUB board/menu/print and recipe destination all refer to the intended edition. Handle renamed, Library-only, removed and unavailable recipes explicitly.
- Check ordinary edits, relinks without name change, name-only changes, side substitutions, flag-only corrections, changed dates, swaps, specials, revert/removal, restored originals, and imported replacement weeks. Confirm source change reaches downstream review when required and cannot disappear as metadata-only noise.
- Verify production details come from CODEX/EXPO authority: correct component work, prep/cook/equipment facts when supplied, service date and required portions. Unknown values remain marked. Do not derive raw ingredient quantities or scale recipe links from an unverified serving basis.
- Compare current publication with EXPO's accepted state and HUB generated schedule, including the previously observed 21-versus-20 gap. A regenerated file and a receiving-device receipt are separate observations. Use existing freshness feedback to make delayed adoption actionable.
- Exercise offline edits/reconnect, stale tab, two-device newer edit, failed publish, recovery and duplicate-send prevention with synthetic remote fixtures. Observe final live coherent publication and intended serving devices after release; never publish a test dish to operations.

Exit: representative edits reach the actual kitchen outputs, intended recipe, correct service dates and facts. Reconciliation accounts for every component and resident once, and checks suitability/notes independently. Remaining unavailable recipe production facts or scaling are clearly identified without claiming full readiness for those features.

## Stage 6 — staff acceptance and release

- Use a short realistic walkthrough with the supervisor's normal workbook and menu: import a week, revise a dish, rename without unlinking, change a line's side, handle a missing recipe, revise a dated service, save/publish, read the receipt, and print.
- Record expected versus observed results for menu text, ingredient warnings, per-resident plate/notes, production tasks and receiving devices. Test ordinary and anaphylactic examples with synthetic/redacted residents in automation; perform actual staff acceptance only with authorized operational data.
- Complete an actual Excel opening/print-layout check and a staff/device walkthrough. Automated workbook round trips do not substitute for those observations. Physical printing is recorded separately if available.
- Package the smallest coherent PR slices; do not bundle all stages into one unsafe rewrite. Require baseline evidence and rollback/recovery notes. Merge under existing authorization only after required checks and independent reviews pass. Inspect deployed bytes and final receipts after merge.
- Store release receipts here and cross-app release facts in the HOUSE ledger; reference existing line docs rather than duplicating their status histories.

Exit: staff acceptance is observed, all release criteria below pass, and unresolved work is explicitly outside this baseline. Do not label the release staff-ready based only on automated tests.

## Implementation and review sequence

For each behavior-changing slice: gate author → builder → independent food-safety/data review → independent release/feed review → fold. Preserve intentionally red gates until implementation satisfies them; never edit their expectation solely to green CI. Agents may review this plan now; implementation roles are assigned only when implementation is authorized and the relevant calls are resolved.

Proposed slice order:
1. Baseline/reproduction and D1 correction with focused output checks.
2. Read-only inventory and frozen reviewed source/override policy, including existing deliberate unticked flags; then approved data mappings and bulk reconciliation.
3. Validated identity/status and source-fact consistency with coordinated consumers.
4. Editor picker, draft protection and feedback; then plate-preview/disclosure improvements.
5. Full import/dates/delivery regression and live release observation.
6. Staff acceptance; fix observed friction before declaring the baseline.

Tests must assert behavior and unknown-state handling, not freeze menu wording, resident counts or recipe totals. Use current-data census checks plus stable synthetic scenarios. Data-only routine saves retain the established short CI path. Re-run broad tests when source changes justify them, not simply to accumulate green counts.

## Baseline release checklist

- [ ] Current-source and existing-work boundary verified; stalled test and ancestry failure explained/resolved appropriately.
- [ ] D1 and every confirmed safety/data contradiction resolved or meal visibly held for review.
- [ ] All active component occurrences inventoried, correctly slotted and tied to appropriate evidence; relevant CODEX links resolve uniquely.
- [ ] Documented policy keeps current source facts and deliberate variations coherent across regular and alternative plates and all HOUSE readers.
- [ ] Normal creation, rename, revision, linking, manual fallback, import, swap, special, undo and draft recovery pass.
- [ ] Every resident receives one accounted-for plate; suitability, preparation notes and anaphylactic handling pass independent checks.
- [ ] Menu/print/labels/workbooks/production/recipe destinations agree; unknowns remain honest.
- [ ] Offline/reconnect/multiple-device/publication recovery and downstream freshness behave as intended.
- [ ] Required checks and independent reviews clear the final heads; deployment and adoption evidence captured.
- [ ] Supervisor walkthrough and actual Office/device acceptance completed.

## Review record

Independent agent review completed 2026-11-17 by review_baseline_plan (read-only). Disposition: proceed after amendments. All four requested amendments incorporated: facts policy precedes reconciliation and preserves deliberate unticked flags; inspect existing component support before D2; target-specific delivery evidence; scoped repeatable migration and safe rollback. Two clarifications incorporated below: service-specific readiness without a new global blocker, and observable supervisor acceptance. Implementation remains pending; D1 alone is approved as a concrete data decision.

## Implementation controls and evidence format

Before each data change, capture the effective input revision and a local protected backup of the affected menu/overlay/dated inputs. Record expected old values and compare them again immediately before applying; if another device/session has changed them, rebase the proposed correction rather than overwrite it. Keep resident backups private. Apply a rollback as a new coherent publication using the existing writers, never by decrementing receipt sequence or restoring an old published bundle over newer resident changes. Revert only this slice's fields; review changes made since the backup. A source-code rollback does not automatically roll back menu data.

Reuse CODEX's existing `production.servedWith` part model (`name`, `recipeId`, `role`, `bought`, `madeAt`) and product/component capability where suitable. D2 is a conditional call after this examination, not a pre-approved new product registry. Decide how unknown product labels are handled without imposing a complete recipe authoring burden on staff.

Each slice receipt records: owner and affected repositories; baseline and reviewed head hashes; explicit scope; calls resolved/pending; test commands and results; menu/fact before/after; producer and consumer observations; unresolved limitations; rollback instructions; staff acceptance observations where applicable. Snapshot counts from this audit are descriptive only.

Baseline release requires every active service component to have an accepted disposition and every known contradiction to be resolved. A visible hold may permit incremental deployment but does not satisfy final staff-ready acceptance. Final acceptance must include a demonstrated safe supervisor path for unavailable/offline evidence without bypassing anaphylactic protections.

Migration gates: each transformation must be idempotent and preserve unknown additive fields and original snapshots. Test repeat application, old/new producer-consumer combinations and rollback combinations. Compare the reviewed revision immediately before write; refuse/rebase a reversal when affected occurrences have newer edits. Never clear resident data or browser storage to make a migration pass. A bought:true part supplies decomposition metadata, not proof of product-label allergen knownness.

A service-specific review state must identify the affected plate, unresolved fact and supervisor action. This plan does not authorize a new global publish/print blocker. Any new blocking policy needs an explicit contextual call and independent review; existing safety controls remain authoritative. A visible unresolved contradiction is not a final baseline pass.

Staff acceptance record: identify the participating supervisor and device, starting workbook/menu and task; record expected versus observed outcome, whether developer rescue was needed, mistakes and recovery, and supervisor feedback on clarity. Require successful completion without developer rescue after training appropriate to the normal process. Observe the present process before considering any timing target; no arbitrary speed threshold is imposed.

Final independent recheck, 2026-11-17: CLEARED for implementation planning; all four findings and both clarifications addressed, no remaining plan blockers. Stage 0 still precedes D1 implementation; broader fact changes remain gated by the reviewed policy.

## Implementation receipt — D1, 2026-11-17

Stage 0: all 319 remote files matched the workspace after newline normalization at main 1cd3278. Git history was aligned without overwriting working files; baseline 984 pass, 0 fail, 1 skip. Current DOOR occurrence21 and HUB generated schedule20 refreshed from public delivery.

D1 shipped in PR #212, merged as 8e480932. The user explicitly authorized this reviewed operational bundle after automatic approval review identified resident data in the public repository. The original occurrence22 candidate was superseded by a newer staff publication and rebuilt against occurrence23/current168 residents. The released six-file bundle advances to occurrence24; only vegan text and xtra.lines.vegan change meal content. Regular Sour Cream/Dairy remain; conservative vegan Dairy remains pending attribution review. Sour Cream portions160→146; other service routing and resident instructions are preserved. Independent food/data and release/feed reviews PASS; opt-in current-data gate14/14 and published-flow validation pass. Hosted run44119634060 passed. Anonymous Pages observation confirms coherent occurrence24 and the explicit vegan side exclusion. This authorization does not cover new confidential instructions or evidence in public Git.

Alternative round-trip, validated identity/keyboard picker and draft protection have now shipped as recorded below. Facts-policy proposal preserves explicit unticked Spicy; no broad auto-refresh is authorized.

## Source release receipts — 2026-11-17

- PR #209 merged as 273ee781: preserve structured alternative preparation/type/flags/additive evidence and explicit empty arrays. Explicitly re-enabling an empty list starts a blank draft rather than resurrecting old text. Independent reviews passed; Node984 pass/1skip, metadata9/9, plain-plate integration26/26, readability263/263. Full hosted run44113621129 passed. Pages source80 matches reviewed normalized SHA-256 9c412073ebeb30de7b960402e766337d98928d3215323a5d7e288c0f83e1765f.
- PR #210 merged as 5fa90766: validated identity badges and accessible regular-menu keyboard picker. Same-ID canonical rename preserves flags/menu words, duplicate attachment refused. Independent gate28/28, bounded historical edit journey44/44, Node984pass/1skip, readability263/263; full hosted run44114812345 passed. Pages source81 matches reviewed normalized SHA-256 05216c7f57c4fdd03670a09690babc23608c209f924c3cf88ad6e11ab0774046. No operational JSON in either source PR.
- PR #211 merged as d6592060: Save/Discard/Stay protects navigation and editor changes; asynchronous save answers are bound to the original service and editor session. Independent reviews PASS. Dirty-draft gate45/45, race3/3, supplemental16/16, picker28/28, plain-plate26/26, Node984pass/1skip and readability263/263 passed. Full hosted run44120197237 passed. Pages source82 matches reviewed normalized SHA-256 330ca0b890eb54b48907ca68ec6583599b64fa4d9c0c88ca70981662a4dbf691. The unload warning is not durable draft recovery.

D1 is released. The broader component/fact inventory, breakfast activation and staff/Office acceptance remain unfinished. These receipts do not establish complete HOUSE adoption.

## Prepared next data step — identity/consumer review

A read-only proposal adds the unique existing CODEX recipeId to each of the 12 exact name-only links. It retains every captured flag, display name and line field; it is not a source-fact adoption or manual-dish attachment. The proposal and current source digests are local at outputs/staff-baseline-20261117/name-only-id-proposal.json for independent review. No ID backfill is applied or published by that preparation. Resolve any downstream identity/planner difference before applying through a scoped compare-before-write writer.

## Breakfast and private storage amendment — 2026-11-17

The user expanded acceptance to resolve Joan's registry-versus-breakfast errors. The current168-resident capture accounts for4,704 resident/services across28 breakfasts; every occupied GF breakfast service lacks a complete definition. Exactly-once routing is not suitability evidence. Earlier14-service and171-resident captures are historical only; re-read live input before migration.

Approved food decisions: Rice Chex; Silk Vanilla Coconut Plant-Based Yogurt4×100g; omit yoghurt only on plates whose Coconut/Tree Nuts/Corn restrictions conflict with it, retaining the listed fruit once; Kirkland Organic Oat Beverage and Organic Soy Beverage, both6×946mL. Preserve oat-only, soy-only, preparation and qualitative portion instructions. Exact selection does not establish missing ingredient or precautionary evidence; unknown label evidence remains unknown.

The user approved a private DOOR data repository. kennedyjasondavid-eng/conc-kitchen-door-data is created and verified PRIVATE, README only; no resident migration has occurred. New confidential instructions/evidence must not enter public Git or legacy public serializers. The reviewed protocol must distinguish a durable accepted private editing head from an exact-commit-pinned released serving frame, so unresolved breakfast cannot freeze resident intake or known lunch/dinner work. Private save, public commit, Pages delivery and receiving-device observation are separate receipts. Inactive foundation gates precede implementation; paired DOOR/EXPO/HUB cutover, old writer retirement and current-data migration remain independently gated.

## Further implementation receipts — 2026-11-17

- PR #213 merged as ef8cca3f: inactive private-generation foundation, with46 focused checks, Node1030pass/1skip, readability263/263 and full hosted run44129697221 successful. Pages deployment's first attempt failed artifact lookup; unchanged retry succeeded. Anonymous Pages source83 exactly matches reviewed SHA-256 6b59fb82af028e2c9c9b4b4e3419513358833065b61a42d284a1ec98a39e57e9. No resident migration or active transport was enabled.
- User requested a newly authored GF pancake mix. House Gluten-Free Pancakes includes the1kg dry-mix stage and all wet ingredients. Independent food/data and release checks pass; actual normal CODEX Save appended exactly one record while preserving all98 predecessors, commit b1c7fc94ca628bb363f9f6ab1f068fa766b4e1d0. Canonical readback and the delivered public record match the reviewed candidate. Corn, Potato/Nightshades, Milk and Egg warnings remain; portions/cooked yield are unknown and the first method step requires a kitchen trial before operational use. No menu was relinked. The ordinary Library production label is not trial acceptance.
- Knownness investigation reproduced unknown ingredient/allergen inputs becoming empty arrays in existing CODEX serialization. Bought-product references remain staged, not shared. The reviewed correction requires source-owned exclusion checks and complete-record withholding from older delivery paths; omitting a DOOR sub-block alone is insufficient. CODEX producer work and the inactive DOOR adapter remain distinct from activation.
- Full actual EXPO comparison narrowed the neutral stable-ID subset to ten. Tuna and the mushroom sandwich remain held separately; mushroom linkage changes production/lifecycle/fridge/holding behavior. No backfill is applied by this receipt.

- Inactive bootstrap implementation: independently reviewed first-initialization/recovery contracts,79 focused checks and existing46 foundation checks pass; complete Node1120pass/1skip and readability263/263. No transport, identity migration or serving activation is enabled. See schemas/private_bootstrap_model.md and docs/reviews/DOOR_PRIVATE_BOOTSTRAP_REVIEW_2026-11-17.md. Release/deployment is recorded separately after verification.

- PR #217 merged as bad12c59: inactive bootstrap observation/acceptance/recovery, including frozen79 focused checks. Complete hosted safety run44154494296 passed; Pages run44155321175 succeeded. Anonymous source85 exactly matches reviewed SHA-256 d6ad37f95a80bd856a79fb41addae055257d2c322b5b358192f48728a07d0f0c. This release adds no active transport, credential use, resident IDs or migration.

- Inactive episode/transport slice: independent food/data and release reviews passed. The complete Node suite passes1222 with1skip; readability/printing263/263. Source a9f5c7893083fec92844a05a70a23e8453d4838214b30c23c51734584ace1747 adds102 synthetic checks while retaining125 existing private-kernel checks. Exact source leases, episode lifecycle/replay, immutable private I/O contracts and persistent serving holds are implemented without live callers, default credentials, actual migration or activation. See schemas/private_episode_model.md, schemas/private_git_transport_model.md and the dated review receipt.

- PR #218 merged as5068c296: the episode/transport slice above passed full hosted run44166082339 and Pages44169181573. Anonymous source86 exactly matches a9f5c7893083fec92844a05a70a23e8453d4838214b30c23c51734584ace1747. No operational data was migrated.

- Prepared bridge/feedback source88: independent reviews clear source161020a1272e5dd453f8b9f5e29cb0f33d17c02384f2f5c05ff4efa9c33c4d7b. Node1276pass/1skip, actual feedback browser30, critical browser18 and readability263 pass. Ordinary definition gaps receive grouped inline feedback; critical refusals remain. The private native-fetch bridge stays inactive. Release/deployment is recorded separately after observation.

- PR #219 merged asaf90cf98 after complete hosted run44183027248 passed. Its historical ordinary-GF print assertion now requires the actual reviewed inline feedback while preserving zero prints and every critical expectation. Pages44184000114 succeeded; anonymous source88 exactly matches161020a1272e5dd453f8b9f5e29cb0f33d17c02384f2f5c05ff4efa9c33c4d7b. Missing food definitions remain unresolved.

- Prepared inactive serving core89: independent food/data and release reviews pass79/79 on the exact shared artifact, with272 private regressions and4 parsers. The core binds public aggregate material, canonical two-file carrier, composite CODEX identity, per-service demand purposes and persistent receiving holds. Actual producer/reader owner integration and current-source cutover remain required. See schemas/serving_protocol_v1.md and its dated review receipt; no operational mode is enabled.
