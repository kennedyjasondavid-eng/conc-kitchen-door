# DOOR menu flow action plan

Normal menu edits should be saved once and reach EXPO's production schedule, HUB's working views and the intended CODEX recipe without developer maintenance. Repair the data handoffs first, retain genuine safety checks, and reduce the number of commits and runner jobs needed for ordinary operations.

Status: draft v1 submitted for independent agent review. Implementation has not started. This plan covers DOOR, EXPO and HUB; CODEX remains the recipe/allergen authority. It does not reopen paused CODEX work or change the applications' single-file architecture.

## Evidence and scope

The [audit](DOOR_CI_FLOW_AUDIT_2026-11-06.md) and [examination receipt](receipts/door_menu_flow_examinations_2026-11-06.json) establish the failures and the limits of the probes. Baselines are DOOR `0996f8b78313882aca59981b11ac8d9399507a83`, EXPO `7cd1fee4c50c767fbbe492a0def74451df8a68fb`, and HUB `f7a2b614e8e5d1f80f15392471c5596ca7145967`. Refresh these refs before implementation and retain existing working changes. Use the OneDrive workspace; do not create another clone or repurpose the dirty checkout's unrelated files.

The audit reproduced incoherent publishes, a stale swap staged after a failed revert-list read, loss of whole-meal fields, loss of bound recipe identity, stale counts, and disagreement between dated menu and board views. Tests used isolated copies and mocked HTTP/browser feeds. The failed-read writer was a recorder, so it proved the destructive candidate, not a real overwrite or recovery of an erased remote tombstone.

Reuse HOUSE proven seams: row 1 for durable local writes, row 2 for cache-busted reads, row 5 for atomic multi-file publishing, and row 6 for local calendar dates. Read their current implementations when building. Improve the existing mechanisms rather than adding a shared runtime library, backend or second queue.

## Operating rules

- Persist staff edits locally immediately. Healthy saves need no additional confirmation or workflow screen. Show a problem only when an affected change cannot safely reach its consumer.
- Preserve CODEX-owned allergen meaning, dietary variants, unknown states and explicit anaphylactic warnings/acknowledgements. No gate removal may weaken these boundaries.
- Preserve original-meal copies, revert/removal records, supervisor decisions, notes, completed work and frozen stock on hand. Derived schedules do not own those records.
- A routing section total and a component portion total can legitimately differ. The plating engine remains the authority; consumers must not reconcile them by assumption.
- A structurally invalid or unsafe write candidate stays pending locally. A missing convenience quantity becomes unavailable/unscaled. Unrelated usable work remains available. An ordinary dish change is not itself a publish blocker.
- Keep schema version, content revision, service date and last-contact time distinct. A successful Git write, a served Pages revision and a revision consumed by EXPO are different facts.
- Keep receipts aggregate and allowlisted. Do not add resident identities, restrictions, source documents, tokens or private recipe provenance to public payloads.

## Delivery slices and dependencies

| Slice | Owner and scope | Depends on | Exit condition |
|---|---|---|---|
| F0 | Gate author: preserve reproducible cases and specify additive contracts | None | Current failures are reproducible without depending on today's menu or roster; schema examples and mixed-version behavior are reviewed |
| F1 | DOOR: merge, build, validate and commit one coherent operation | F0 | One recovered publish carries the correct menu, dated records and derived routing; failed reads cannot erase removals |
| F2 | EXPO, paired HUB tests: preserve a moved meal whole | F0 | Halal, alternatives, recipe slots and flags survive dated swaps into tasks and prints |
| F3 | EXPO and HUB: retain recipe and service identity | F0, F2 | Bound recipe facts, link and service-based quantities agree without relying on the display label |
| F4 | DOOR, EXPO and HUB: coherent counts, refresh and date validity | F1, agreed F0 contract | Roster-only updates and dated expiry cannot leave stale counts presented as current |
| F5 | HUB, paired EXPO payload: one effective dated menu for working outputs | F2, F3, F4 | Board, dated menu, task print and menu export agree for the same service date |
| C1 | DOOR workflows: consolidate short jobs | F0's baseline record | Two jobs per ordinary publish, retaining safety/advisory semantics and independent Pages delivery |
| C2 | DOOR tests/workflow: remove historical maintenance traps and select relevant checks | F0 plus adequate paired coverage from F1–F4 | Ordinary edits need no test-source maintenance; genuine failures remain visible |
| F6 | DOOR with downstream receipts: truthful delivery, operation batching and unchanged-save suppression | F1, F3, F4, C1 | One logical save produces at most one necessary commit; pending delivery is recoverable and visible |

F1 and F2 are the first product repairs and may be built independently. C1 can proceed alongside them in a separate change. F3 and F4 require coordinated producer/consumer changes, not one large cross-app rewrite. Use one reviewable behavior change per PR; split a slice further when its tests or rollback differ. Delivery of F1/F2 must not wait for the later optimization work.

## F0 Reproducible behavior checks and contract examples

Promote the temporary audit probes into the relevant repositories as small deterministic fixtures and producer/consumer checks. Remove local absolute paths and external-checkout dependencies from CI execution. Preserve the original failing evidence and source revisions in documentation. A gate author defines the expected behavior before a builder changes the corresponding implementation; independent reviews judge correctness and coverage rather than blessing a changed snapshot.

Use synthetic residents covering regular, vegetarian, halal, soft and anaphylactic cases, including a legitimate zero-sized cohort. Keep named historical incidents as fixed fixtures. Do not require a live resident, date, dish or whole-file digest to remain unchanged. Freeze fixtures, not the kitchen's operational menu.

Specify these additive contracts before the first producer begins emitting them. Final field names belong to the paired change; the information and behavior below are required:

| Contract | Required meaning |
|---|---|
| Effective input receipt | Deterministic content identity for rotation/overlay, swaps, special meals and their reverts/removals, routing-relevant resident state, relevant recipe input and calendar basis. Schema IDs and exported/checked-at times are separate. |
| Routing validity | The effective-input revision, site and exact service occurrences for which section/component counts were computed; explicit unknown/unavailable state. A next-service swap must not silently become next-cycle counts. |
| Recipe reference | Canonical CODEX recipe ID and canonical name resolved against the consumed recipe revision. Display label is separate. Keep the current supported CODEX link protocol; do not invent an ID URL the CODEX reader does not accept. |
| Service references | One or more site/date/week/day/meal/component references for the work card. A batch serving several meals must retain all contributions without duplicate counting. Unknown or incompatible portion bases stay unscaled. |
| Effective dated meal | The meal for a specified service occurrence, including the moved meal's alternatives, flags, components and recipe references; rotation remains separately identifiable. |

Pin a consistent upstream revision when possible. For independently cached Pages files, require matching receipts before promoting a candidate set; retain the last coherent set while mismatches retry. Content identity must be deterministic across serialization order and exclude volatile export times, but must change for a real revert, resident change, recipe attachment or relevant calendar change.

Test new/new, old/new, new/old and rollback combinations. Consumers accept additive fields before producers emit them. Missing legacy metadata means unverified, not a fabricated match or an automatic blank board. A new consumer must not silently fall back to a different dietary recipe when an explicit reference cannot be resolved. Any stronger rejection of another app's output ships with that producer's matching change and an actionable fallback.

## F1 Coherent DOOR publishing and removal protection

Refactor the existing publish path into a bounded transaction:

1. Retain the local operation and its generation in durable storage. Read the latest cloud head and all required menu/delta/swap/removal/registry inputs from that same head. Classify success, confirmed absence, malformed content and unreadable/auth/network responses separately. A generic 404 must not erase state; establish absence within a known readable repository revision.
2. Merge using the existing ownership and conflict rules, including removal records. A failed authoritative read preserves the local operation and remote file; do not substitute an empty list or write a shorter removal history. Retry transient reads briefly, then leave the dependent operation pending with one recoverable status. Existing connect/auth handling owns credential problems.
3. Freeze the merged effective input and build every dependent artifact from it. Validate the complete candidate, including dated-state/routing agreement, before staging. No later merge may change one staged file's meaning.
4. Use `ghPushFilesAtomic` and its anti-clobber evaluator. Commit against the head used for the merge. If the ref moves, re-read, re-merge and rebuild against the new head within a bounded retry; merely reparenting stale blobs does not resolve a same-file conflict. If a guard blocks a dependency, do not release an incoherent subset.
5. Acknowledge only the committed local generation. Edits made during the async publish remain queued. A crash before the ref update commits nothing; a crash afterward is reconciled by revision on restart, without replaying stale snapshots or deleting newer local intent.

Keep unrelated genuinely independent writes possible, but define their dependency boundary in code/tests. Menu, dated changes/removals and their routing/state are one consistency group; do not label one of these independent just to make a partial publish green. Keep anaphylactic/structural safeguards intact.

Acceptance cases: another device reverts a swap before publish; that revert races the read/build; a 503, unauthorized read, malformed body and ambiguous 404; a true absent initial file; concurrent newer local edit; local quota failure; ref conflict; crash before/after commit; and restart after each. The remote simulator must actually apply accepted writes so it can detect erased tombstones, unlike the audit's writer recorder. All-success recovery publishes correct routing in the first successful operation, without a second staff click.

## F2 Whole-meal swaps reach production

Make EXPO consume DOOR's current `_meal` representation for a moved rotation meal, using the same name/identity validation as DOOR. Retain the intentional behavior for a typed one-off meal and for a renamed entry whose saved whole-meal identity no longer matches. Preserve special-meal precedence and removal semantics.

A dated sausage dinner must schedule and print Halal beef sausages rather than infer Halal Chicken Sausages. Its soft plate, main/sides, recipe slots and dietary flags must travel with it. Revert and expiry restore baseline work without losing staff decisions: decisions on the replaced meal remain recoverable, and dated-only decisions do not leak into the next cycle. Unknown dishes retain the existing “Needs a plan” behavior.

Run the current producer through EXPO's decomposition, make-ahead/shared-batch tasks, packing, sends/reheats and HUB payload/print. Cover specials, revert, expiry, both halves of a slot swap, week 4→1, local midnight and DST. This is a paired behavior repair; do not widen old name-only fixtures to conceal lost fields.

## F3 Recipe identity and service-based scaling

Carry the accepted recipe reference through every scheduling transform and into HUB. Populate cooking/equipment facts from that same record, including side dishes; do not combine a bound recipe's cook time with the display label's oven time. Preserve deliberate supervisor overrides under their existing precedence, with provenance visible to diagnostics.

HUB resolves the explicit canonical reference first and opens that exact CODEX recipe using the supported link protocol. For legacy cards, preserve existing exact/unique mappings and ambiguity handling; a broad name match must not choose a dietary variant or authorize a portion count. Missing recipe identity leaves a visible unresolved link/plan state, not a guessed replacement.

Use service references to read component portions for make-ahead work, not the production day or the `production` section. Preserve component-vs-section semantics and frozen-unit conversions. Aggregate a shared batch only when its contributions identify the same recipe, portion basis and coherent routing revision; otherwise keep it unscaled and state why. Never double a batch by counting its prep, cook and send cards separately.

Acceptance: unchanged “Rice” wording switches between Plain Rice and Lime and Coconut Rice; recipe URL, cooking and equipment facts agree; a same-name recipe update is noticed; unresolved/retired IDs do not become another recipe; a W1 cook for W2 service receives the service count; shared-batch contributions do not duplicate; and an unavailable count never becomes an assumed 172 or a misleading zero.

## F4 Coherent refresh and dated routing validity

Stamp routing with its real effective input and service-date scope. Include resident-only changes and dated inputs in its content revision. A route built for a one-off meal expires for that occurrence even when the rotation's menu hash remains unchanged. A CDN fetch timestamp does not renew the data's service validity.

EXPO's prepublish mirror and HUB's existing boot/focus/retry cadence fetch the required coherent set, including routing. A roster-only revision must update counts even if menu words and the schedule sidecar are unchanged. Promote a new candidate atomically in memory and reject late responses from an older request generation. Reassess cache age and service validity when counts are used, not only at initial loading. Port the cache-busted read seam and bound refreshes; do not add a scheduled Actions job.

When an effective meal's counts cannot be established, preserve usable meal information and staff records; mark routing-dependent tasks/quantities unresolved instead of choosing zero, 172 or an old count. Anaphylactic uncertainty must remain explicit. Refreshing a static expired feed is not sufficient: consumers must either obtain a valid producer projection or keep those affected quantities unavailable. A fully idle/closed DOOR browser is not a reliable daily regeneration service.

Acceptance: six synthetic discharges change 148→142 on already-open EXPO/HUB; reverted Arroz routing is Regular 159 / Vegetarian 11 in the incident fixture, not sausage routing; date rollover with DOOR closed never certifies the old route; mixed CDN revisions, out-of-order responses, cache expiry and offline/reconnect preserve a usable honest state. Existing frozen-stock parity must continue to hold where coherent counts are available.

## F5 Dated views and working outputs agree

Use the effective dated meal projection for HUB's date-specific menu, board, popup, task print, menu print and workbook export. The dated menu table must show the same November 6 sausage dinner as the board, with the intended dietary lines and flags. Remove the stale renovation heading for the active standard source. A separate rotation reference may remain, clearly labelled as a rotation rather than dated service.

Do not relabel an old dated task into a new cycle as if newly authorized. Keep the existing expired-swap notice until a valid replacement is available. Test partial fetches so one view cannot silently promote new data while another remains on an incompatible revision.

Verify rendered DOM, generated print HTML and an opened exported workbook. Include a focused staff-device/print trial before rollout completion. Preserve notes, supervisor overrides, completed tasks and stock counts when rebuilding projections. Failure of a projection must not delete its source records.

## C1 and C2 Useful checks with less runner work

**C1 can ship independently once its baseline is recorded.** Move the tiny advisory job into the safety job as a non-blocking step with a clear summary. Ensure advisory results are still reported if the safety step fails, and retain a failing overall result for real safety failures. Combine Pages build/upload/deploy in one independent job, retaining the served-file allowlist, permissions, environments and deployment concurrency. Never add a test-success dependency to Pages.

Three ordinary publishes in the audit started four short jobs each. The target is two per publish. The sampled public repository's standard runner compute was free; a four-to-two change is an estimated 50% reduction in individually rounded private-runner minutes at those durations, not an invoice saving or a measured new benchmark. Measure actual seconds and job counts after the change using existing run metadata.

**C2 changes what assertions protect, not the safety standard.** Replace whole-HTML/menu scope digests and live-population/day/date pins with fixed regression examples plus general behavior checks. Retain Corn/allergen/anaphylactic semantics and publish protections. Map every removed assertion to retained/replacement coverage and have it independently reviewed. Normalize source extraction where still necessary; prefer runtime assertions when practical. Missing optional cross-repo coverage must be recorded as a skip, not a pass.

After F1–F4 establish a compact contract, classify changes within the existing test job. Operational data changes run structure, effective-input/routing coherence, resident/allergen/anaphylactic invariants and the paired contract. Code/tests/workflow changes, unknown paths, missing diff bases and manual runs default to the full relevant suite. Never exclude all JSON, use `[skip ci]` for kitchen publishes, or create a classifier job that costs another allocation. Keep existing docs/log filters and cancellation. Broad browser regressions run for relevant code/contract changes; they are not required on every routine save.

Acceptance: valid swaps, replacements, inert HTML comments and legitimate zero-resident cohorts require no test-file editing. Deliberately malformed routing, wrong recipe variants, stale/unknown quantities and lost anaphylactic flags still fail or surface at their intended boundary. Test the path classifier against rename/delete/mixed code+data changes as well as ordinary data-only updates.

## F6 Quiet delivery and fewer commits

Collect the files belonging to one logical edit/swap/revert through the corrected atomic publisher. Preserve immediate local persistence; use transaction boundaries first, with a short bounded coalescing interval only if needed. Urgent changes flush promptly. Do not sleep inside Actions to debounce commits. Remove competing side-publish paths only after their operation is proven to join the complete transaction, including removal records.

Persist the expected revision and distinguish local-save, committed, served and consumed states internally. Healthy progression is quiet. A committed revision that does not reach Pages/EXPO gets bounded verification and an actionable pending status, not a green delivery claim. Use existing app refresh and deployment mechanisms; no new frequent monitor workflow or self-hosted runner.

Suppress a commit only when canonical content, effective date scope and routing inputs are unchanged **and** the expected delivery is already verified. Keep check-in time separate. An undelivered revision remains retryable; an intentional revert, roster change or changed recipe attachment cannot be mistaken for a timestamp-only no-op. A delivered write must never clear a newer local operation. Test deployment failure, stale CDN, app close/reopen and a successful Git commit followed by no public delivery.

## Review and rollout

The plan receives independent reviews for (1) food-safety/data correctness, (2) cross-app contracts, concurrency and rollout, and (3) operational friction, CI coverage and Actions usage. Record findings with priority, required change and closure evidence. Resolve material plan findings before describing it as ready for implementation; agent review is not production release approval.

For each implementation slice: gate author → builder → independent food-safety/data review → independent release/feed review → fold. Deliberately red safety gates are not rewritten merely to get green. Cross-app schema changes use paired PRs and shared contract fixtures; deploy tolerant consumers first, then additive producers, then enable stronger verification once the compatible versions are confirmed served. Old cached producers/consumers and rollbacks remain explicit test cases.

Validate the published allowlisted artifacts and consumer behavior on the exact release revisions, including anonymous reads where applicable and a clean profile with no prior local state. Retain the last coherent board when possible and expose the affected unavailable data, rather than blanking useful work. Measure first successful delivery, logical saves per commit, jobs per save and actual runner seconds. Diagnose exceptions; do not add routine staff status chores.

Rollback code and feature activation separately from staff data. Never restore an old menu snapshot, revert history or resident roster to undo a code release. If a faulty version produced inconsistent artifacts, regenerate from the latest accepted authoritative inputs through the corrected path. Keep additive readers available during rollback and preserve pending local operations. Prefer disabling the new projection/optimization over discarding saved work.

## Completion criteria

The work is complete when a normal authorized edit, swap, replacement, revert or discharge needs no developer test maintenance or extra staff approval; one coherent operation reaches EXPO and HUB; correct recipe and service quantities survive into working outputs; a date rollover cannot silently renew stale counts; interruptions recover without destructive overwrites; and routine publishes use two runner jobs with unnecessary commits suppressed only after delivery is known. Claims of these outcomes require implementation evidence, not this planning review.

The review record will be saved alongside this plan and linked here after findings are folded.
