# DOOR menu flow action plan

Normal menu edits should be saved once and reach EXPO's production schedule, HUB's working views and the intended CODEX recipe without developer maintenance. Repair the data handoffs first, retain genuine safety checks, and reduce the number of commits and runner jobs needed for ordinary operations.

## Status (owner of this line's status) — 2026-11-07

**This section is where the line's status lives.** Add each slice's receipt here in a few lines. Don't write new dated handoff docs; the Nov 6 ones under `docs/` are frozen snapshots.

**Merged:**

| Part | What it does | Where |
|---|---|---|
| C1 | Two jobs per ordinary publish | DOOR #153 |
| C2a | Ordinary menu edits need no test changes | DOOR #154 |
| F1 | Menu changes publish as one set; a failed read can't wipe removals | DOOR #155, **not switched on** (waits for the credential cutover) |
| F4, DOOR side | Counts carry a publication stamp | DOOR #156, **off** (`DOOR_FLOW_ACTIVATION_EPOCH` / `_BASE` are empty) |
| C2b | Data-only saves skip the browser checks | DOOR #157 |
| F6 | No duplicate publishes; DOOR tracks delivery | DOOR #158 |
| F2 | A swapped meal reaches production whole | EXPO #564, HUB #56 |
| F3a, HUB side | Tasks keep exact recipe identity | HUB #57 |

**Open:** F3a's EXPO side is EXPO #565. Its checks were cancelled and merging is blocked. It sits in the EXPO session's PR queue (behind EX-12 to EX-15, #560–#563).

### Reshaped plan (2026-11-07)
DOOR's side is built and switched off. What's left is to switch it on and let EXPO and HUB read it, without building more on top. In order:

1. **R1. Put the plan on GitHub with this status section** (this PR, docs only).
2. **R2. Switch F1 on.** *Done 2026-11-07 by reconnecting; see Rulings below.* Original plan: Jason leads; one sitting.
   - First, a one-page plain-words checklist made from §"One time writer cutover" and `docs/F1_PUBLISH_IMPLEMENTATION_2026-11-06.md`.
   - The sitting: revoke the old write keys, then reconnect Jason's two computers and Joan's connection. Check that an old tab can no longer write and that read-only use still works.
   - Merged-but-off code gets riskier the longer it waits, so this comes before more building.
3. **R3. F3a, EXPO side: EXPO #565, on hold.** Jason, 2026-11-07: it goes into the separate review of Astra's EXPO PRs, with the EX queue (#560–#563).
   - It changes the live board: dishes whose recipe can't be found become held cards; the 500 kept rows gain their service; 12 rows added and 18 removed; the Griot chain is redistributed within its 10-day limit.
   - Its checks were re-running on 2026-11-07.
   - It shares `index.html`, `tests/ux_baseline.json`, `tests/fixtures/e1_timing_receipt.json` and `schedule-gate.yml` with #560/#561. Whichever merges second rebases and rebuilds its baseline.
   - Lean: the EX queue first, then #565 rebased once.
4. **R4. F4, smallest consumer, then switch it on.** It runs after the EXPO queue lands, so it doesn't collide with it.
   - Before any consumer code: write the stamp's contract as a schema doc and add a row to the HOUSE ledger's contract matrix. It is a cross-app seam.
   - EXPO and HUB accept counts only when their stamp is current. Otherwise they keep the last good board and show one plain line saying the counts are waiting.
   - No new mechanism beyond that. Then a separate PR fills in the activation constants.
5. **R5. F3b and F5 are paused** until F4 has run for about a week (ruled 2026-11-07). F5 may fold into R4's checks.

### Rulings (Jason, 2026-11-07)
- **F1 is on.** It went live on Pages with #155 (Nov 6). A reloaded DOOR computer asks for its connection again. Jason re-added the existing key through Test & Save and it works, so publishing is back without a new key.
- **The old key: reload now, rotate later.** Every DOOR computer is reloaded once and reconnected: Jason's two, Joan's, and any at Rex. Reloading closes the old tabs that could resend older removal lists. The key is replaced when it next expires, and the new one is saved only in the v2 connection. No key change before then.
- **F3b and F5 wait until F4 has run for about a week.** Then Jason decides on scaled recipe quantities with real counts in front of him. F5 is checked through F4's tests; it is built separately only if a mismatch shows.
- **To confirm:** no DOOR publish has reached GitHub since 2026-11-06 10:15. That may be F6 skipping unchanged saves. The first real change after reconnecting should land as a commit.

### Next slice: catch the break (spec, 2026-11-07; not built)
Jason's goal for this line: DOOR isn't flaky, user edits never break the flow to EXPO, and the checks support rather than obstruct. HOUSE working rules ("silent when it works, loud when it breaks"; "checks support, never obstruct") are in the HOUSE ledger.

**What happened on Nov 6.** Every DOOR computer stopped sending after #155 went live, and nothing said so clearly:
- With no v2 key, `doorDeviceCapability` gives `no-connection`, which is **amber**. It turns red only if unsent work is waiting.
- Its words are a new computer's: "not connected — no connection key".
- The code knows the computer was disconnected by the update (`PublishAuth.getMeta().migrationNeeded`), but only Settings uses that.
- Nothing tells Jason when another computer goes quiet.

**S1 and S2 built 2026-11-07 (`v31-standard.51`).**
- S1: new reason `reconnect-after-update`; the banner reads "This computer stopped sending to the kitchen after an update". Three checks were added to `device_capability_banner_gate` (12/12); 2 of the 3 fail on `main`.
- S2 is built the lean way: `tests/journey_edit_reaches_kitchen_gate.mjs` runs DOOR's real publisher with its real `PublishAuth`, without a browser. The file builders are the F1 box's fixed stand-ins, so EXPO's full required-shape check is deferred to a browser version. The check fails on `main` (journey 2), and fails on a publisher that silently stops writing (both journeys).
- Full suite: 810 of 813 pass, 1 skipped. The 2 failures are the known outdated-CODEX-copy pair.

**Next: the two CODEX-feed checks (found 2026-11-07, ruled by Jason; not built).** Pinned to CODEX `main` `096ee08` (2026-11-06), both still fail. GitHub's checks had hidden this by skipping them, since CI has no CODEX copy beside DOOR. Work in progress is on the local, unpushed branch `claude/door-codex-feed-fixture`, which holds the frozen feed.
- **Offline list (ruled: follow CODEX).** DOOR's baked offline recipe list predates CODEX v34 (2026-10-30, "the vegan meat holds no soy").
  - It still lists Soy for Vegan CONC Salad Mix, Vegan Kebabs, Vegan Meatballs, Vegan Meatloaf, Vegan Nacho Mix and Vegan Sloppy Joe Mix.
  - It still carries "Glazed Chicken with Pineapple", which CODEX no longer has (renamed).
  - Online DOOR already reads CODEX, so this only affects a computer without internet, and only in the safe direction (it over-warns).
  - Fix: refresh those records from the frozen feed through the existing fallback seam, with a dated put-back for `corn_recipe_alignment_gate`'s fixed fallback cases.
- **The checks (ruled: fix both properly).**
  - (a) `corn_recipe_alignment_gate` "the paired CODEX feed is the canonical source…" compares against CODEX, so it fails on every CODEX change. It becomes an advisory drift report in `tests/advisory/`, reading the frozen feed. The offline list's own fixed checks keep blocking.
  - (b) `vegan_plate_dishes_gate` pins Vegan Sausage to Wk2 FRI dinner, but the 2026-11-04 swap moved the sausage dinner to THU. It should find the meal wherever it is with `tests/helpers/meal_where.mjs`, as the other checks do since #152.

**S1. The banner says it plainly (DOOR, small).**
- Add `migrationNeeded` to `doorDeviceCapabilityInput()`.
- With no key and `migrationNeeded`, give a new reason `reconnect-after-update`, level **red**, worded: "This computer stopped sending to the kitchen after an update. Save its connection again (Settings → Kitchen connection)."
- Clear the reason when a key is saved.
- Check: start from a pre-#155 saved state (old key under `conc_gh_token`, no v2 record) → red banner with those words. Save a key → banner clears and a publish goes through, against a mocked GitHub. Authored red on `main`.

**S2. One journey check (DOOR CI; replaces internal checks rather than adding to them).**
- Run in a real browser against a mocked GitHub: make a menu edit in Edit Menu, Save, publish.
- Check the published `menu_current.json` and `routing_by_meal.json` carry the edit and pass EXPO's required-shape list. That list is copied byte-for-byte as in the EXPO↔HUB contract pair.
- Run it twice: from a fresh computer, and from a pre-update saved state (S1's case). That second run is the Nov 6 failure.
- Fixed menu examples only, never live data.

**S3. Jason hears when a computer goes quiet (operations level; needs a decision).**
- An export-time staleness alarm in EXPO/HUB would misfire, because F6 rightly skips unchanged saves.
- It needs a light "last check-in" that writes no content commit. F6 already keeps check-in time separate internally; decide where it is reported.
- Lean: decide this together with F4's readers, since EXPO/HUB will be reading DOOR's stamp then anyway.

**Flakiness, measured 2026-11-07.** `node --test tests/*.mjs` was run three times on unchanged `main` `21c0e06`, on Jason's computer, about 18 s each.
- Every run gave 808 tests: 805 pass, 1 skipped, 2 fail. The results were identical, so **nothing was flaky.**
- The same two failed each time:
  - `corn_recipe_alignment_gate` "the paired CODEX feed is the canonical source…";
  - `vegan_plate_dishes_gate` "with the CODEX feed: each linked recipe's allergens reach its plate".

  Both read the CODEX copy beside DOOR. That copy was 12 commits behind on an unfinished branch, so its feed was old. In CI no CODEX copy is present, and these checks skip.
- **Rule question:** a check whose result depends on whichever CODEX copy sits beside the repo is a form of live data. Lean: pin these to a fixed CODEX feed in `tests/fixtures/`, as C2a did for the menu and roster.
- The browser checks (`tests/browser/`, the F4/F6 publishers) weren't in this run. CI runs them in its safety job.

**Stopped:**
- No more growth of F6's delivery tracking.
- No further CI trimming (C1/C2 are done).
- New PR text is written in kitchen words, like the rest of HOUSE.

---

Original status (2026-11-06): v2 reviewed; all three independent reviewers closed their material findings and cleared the plan for implementation planning. This plan covers DOOR, EXPO and HUB; CODEX remains the recipe/allergen authority. It does not reopen paused CODEX work or change the applications' single-file architecture.

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
| F1 | DOOR: bring every dependent writer into one coherent transaction | F0 | Actual edit/swap/revert paths publish a coherent set; failed reads cannot erase removals; legacy-writer cutover is enforced before full activation |
| F2 | EXPO, paired HUB tests: preserve a moved meal whole | F0 | Halal, alternatives, recipe slots and flags survive dated swaps into tasks and prints |
| F3a | EXPO and HUB: retain recipe and service identity | F0, F2 | Bound production facts and recipe link agree; service references survive; unverified quantities stay unscaled |
| F4 | DOOR, EXPO and HUB: coherent counts, refresh and date validity | F1, agreed F0 contract | Roster-only updates and dated expiry cannot leave stale counts presented as current |
| F3b | EXPO and HUB: activate service-based recipe quantities | F3a, F4 | Valid coherent service counts reach single-meal and shared-batch recipe links |
| F5 | HUB, paired EXPO payload: one effective dated menu for working outputs | F2, F3a, F4 | Board, dated menu, task print and menu export agree for the same service date |
| C1 | DOOR workflows: consolidate short jobs | F0's baseline record | Two jobs per ordinary publish, retaining safety/advisory semantics and independent Pages delivery |
| C2a | DOOR tests: replace historical menu/roster pins with fixed regression examples | F0's relevant baseline and replacement-coverage review | Ordinary edits need no test-source maintenance; the full suite still runs |
| C2b | DOOR workflow: select the appropriate operational checks | F0 plus adequate paired coverage from F1, F2, F3a and F4 | Reduced data-only selection preserves required coverage; unknown changes run the full suite |
| F6 | DOOR with downstream receipts: truthful delivery, coalescing and unchanged-save suppression | F1, F3a, F4, C1 | One new logical content revision produces at most one necessary commit; delivery retries produce no duplicate content commits |

F1 and F2 are the first product repairs and may be built independently. C1 and C2a can proceed alongside them in separate changes; removing historical test maintenance must not wait for the full flow rollout. F3a and F4 require coordinated producer/consumer changes. F3b activates quantities only after F4 proves their validity. Use one reviewable behavior change per PR; split a slice further when its tests or rollback differ. Delivery of F1/F2 must not wait for the later optimization work.

## F0 Reproducible behavior checks and contract examples

Promote the temporary audit probes into the relevant repositories as small deterministic fixtures and producer/consumer checks. Remove local absolute paths and external-checkout dependencies from CI execution. Preserve the original failing evidence and source revisions in documentation. A gate author defines the expected behavior before a builder changes the corresponding implementation; independent reviews judge correctness and coverage rather than blessing a changed snapshot.

Use synthetic residents covering regular, vegetarian, halal, soft and anaphylactic cases, including a legitimate zero-sized cohort. Keep named historical incidents as fixed fixtures. Do not require a live resident, date, dish or whole-file digest to remain unchanged. Freeze fixtures, not the kitchen's operational menu.

Specify these additive contracts before the first producer begins emitting them. Final field names belong to the paired change; the information and behavior below are required:

| Contract | Required meaning |
|---|---|
| Effective input receipt | Deterministic content identity for rotation/overlay, swaps, special meals and their reverts/removals, routing-relevant resident state, relevant recipe input and calendar basis. Schema IDs and exported/checked-at times are separate. |
| Routing validity | A validated rotation projection and exact-date overrides, tied to the same relevant menu/recipe/registry inputs and calendar basis; explicit unknown/unavailable state. A dated override expires into its valid rotation projection, never into another cycle's dated counts. |
| Recipe reference | Canonical CODEX recipe ID and canonical name resolved against the consumed recipe revision. Display label is separate. Keep the current supported CODEX link protocol; do not invent an ID URL the CODEX reader does not accept. |
| Service references | One or more site/date/week/day/meal/component references for the work card. A batch serving several meals must retain all contributions without duplicate counting. Unknown or incompatible portion bases stay unscaled. |
| Effective dated meal | The meal for a specified service occurrence, including the moved meal's alternatives, flags, components and recipe references; rotation remains separately identifiable. |

Pin a consistent upstream revision when possible. For independently cached Pages files, require matching receipts before promoting a candidate set. A last coherent board may remain visible as labelled historical information, but a newly observed authoritative roster, meal or removal revision immediately invalidates certification of affected quantities and dietary routing, even if the older set remains internally coherent and within its age limit. Keep affected counts unavailable/unscaled until the matching set arrives, then restore them automatically. Compare revision equality and request generations; never order schema versions or content hashes. Content identity must be deterministic across serialization order and exclude volatile export times, but must change for a real revert, resident change, recipe attachment or relevant calendar-basis change.

Test new/new, old/new, new/old and rollback combinations. Consumers accept additive fields before producers emit them. Missing legacy metadata means unverified, not a fabricated match or an automatic blank board. A new consumer must not silently fall back to a different dietary recipe when an explicit reference cannot be resolved. Any stronger rejection of another app's output ships with that producer's matching change and an actionable fallback.

## F1 Coherent DOOR publishing and removal protection

First inventory every writer of menu overlays, swaps, special meals, removals, routing and dependent state: foreground saves, `executeSlotSwap`, `saveMealSwaps`, `saveSpecialMeals`, removal timers, background sync, retries and the HTA/Git publishing path. Route all these consistency-group writes through the transaction in F1. Removing their independent side-publish bypasses is part of the correctness repair, not deferred batching work. Preserve genuinely independent log/advisory writes under an explicit tested boundary.

Refactor the existing publish path into a bounded transaction:

1. Retain the local operation and its generation in durable storage. Read the latest cloud head and all required menu/delta/swap/removal/registry inputs from that same head. Classify success, confirmed absence, malformed content and unreadable/auth/network responses separately. A generic 404 must not erase state; establish absence within a known readable repository revision.
2. Merge using the existing ownership and conflict rules, including removal records. A failed authoritative read preserves the local operation and remote file; do not substitute an empty list or write a shorter removal history. Retry transient reads briefly, then leave the dependent operation pending with one recoverable status. Existing connect/auth handling owns credential problems.
3. Freeze the merged effective input and build every dependent artifact from it. Validate the complete candidate, including dated-state/routing agreement, before staging. No later merge may change one staged file's meaning.
4. Use `ghPushFilesAtomic` and its anti-clobber evaluator. Commit against the head used for the merge. If the ref moves, re-read, re-merge and rebuild against the new head within a bounded retry; merely reparenting stale blobs does not resolve a same-file conflict. If a guard blocks a dependency, do not release an incoherent subset.
5. Acknowledge only the committed local generation. Edits made during the async publish remain queued. A crash before the ref update commits nothing; a crash afterward is reconciled by revision on restart, without replaying stale snapshots or deleting newer local intent.

Keep unrelated genuinely independent writes possible, but define their dependency boundary in code/tests. Menu, dated changes/removals and their routing/state are one consistency group; do not label one of these independent just to make a partial publish green. Keep anaphylactic/structural safeguards intact.

Acceptance cases: actual Edit Menu, Swap Slots, Make Permanent, Revert and special-meal entry points through accepted remote writes; removal timers firing during a save; another device reverts before publish; that revert races the read/build; a 503, unauthorized read, malformed body and ambiguous 404; a true absent initial file; concurrent newer local edit; local quota failure; ref conflict; crash before/after commit; and restart after each. The remote simulator must actually apply accepted writes so it can detect erased tombstones, unlike the audit's writer recorder. All-success recovery publishes correct routing in the first successful operation, without a second staff click. F1 activation also requires the legacy-writer cutover below; serving new code alone is insufficient.

## F2 Whole-meal swaps reach production

Make EXPO consume DOOR's current `_meal` representation for a moved rotation meal, using the same name/identity validation as DOOR. Retain the intentional behavior for a typed one-off meal and for a renamed entry whose saved whole-meal identity no longer matches. Preserve special-meal precedence and removal semantics.

A dated sausage dinner must schedule and print Halal beef sausages rather than infer Halal Chicken Sausages. Its soft plate, main/sides, recipe slots and dietary flags must travel with it. Revert and expiry restore baseline work without losing staff decisions: decisions on the replaced meal remain recoverable, and dated-only decisions do not leak into the next cycle. Unknown dishes retain the existing “Needs a plan” behavior.

Run the current producer through EXPO's decomposition, make-ahead/shared-batch tasks, packing, sends/reheats and HUB payload/print. Cover specials, revert, expiry, both halves of a slot swap, week 4→1, local midnight and DST. This is a paired behavior repair; do not widen old name-only fixtures to conceal lost fields.

## F3 Recipe identity and service-based scaling

**F3a carries identity without enabling unverified scaling.** Carry the accepted recipe reference through every scheduling transform and into HUB. Re-derive the complete recipe-owned production facts from that record, including side dishes, cooking/equipment facts, hold limits, method/cooling lifecycle, quantity basis and storage/transport requirements. Do not combine a bound recipe's cook time with the display label's oven time.

Preserve supervisor override history and provenance, but revalidate its applicability when the canonical recipe or relevant safety revision changes. Keep compatible choices and notes automatically. Visibly suspend an incompatible cook-ahead placement or lifecycle decision without deleting it or silently overriding the new recipe's safety ceiling. A benign rebind adds no confirmation; an unsafe retained decision earns attention because its meaning has changed.

HUB resolves the explicit canonical reference first and opens that exact CODEX recipe using the supported link protocol. For legacy cards, preserve existing exact/unique mappings and ambiguity handling; a broad name match must not choose a dietary variant or authorize a portion count. Missing recipe identity leaves a visible unresolved link/plan state, not a guessed replacement.

**F3b activates quantities only after F4 is available.** Until the consumer can verify a coherent, valid routing input, legacy/unverified counts cannot authorize scaling. Use service references to read component portions for make-ahead work, not the production day or the `production` section. Preserve component-vs-section semantics and frozen-unit conversions. Aggregate a shared batch only when its contributions identify the same recipe, portion basis and coherent routing revision; otherwise keep it unscaled and state why. Never double a batch by counting its prep, cook and send cards separately.

F3a acceptance: unchanged “Rice” wording switches between Plain Rice and Lime and Coconut Rice; recipe URL and all production facts agree; a same-name recipe update is noticed; unresolved/retired IDs do not become another recipe. Rebind a label from a five-day-hold recipe to a two-day-hold recipe while an old cook-ahead choice exists: notes survive, unsafe work does not execute silently, and dietary warnings follow the bound recipe. F3b acceptance: a W1 cook for W2 service receives the valid service count; shared-batch contributions do not duplicate; unavailable/legacy counts remain unscaled, never an assumed 172 or a misleading zero. Include F3a-before-F4 and rollback-to-unverified cases.

## F4 Coherent refresh and dated routing validity

The selected rollover design is **validated rotation routing plus exact-date overrides**, generated together in DOOR from one frozen set of relevant menu/recipe/registry inputs and calendar basis. Add this representation to the existing allowlisted routing artifact; retain the legacy effective projection during migration. Compute the rotation projection independently of next-service swaps, and compute each dated override for its explicit site/date/meal. Include removals in the revision. Consumers use an applicable override, otherwise the matching valid rotation projection. After the swap expires with DOOR closed and inputs unchanged, valid rotation counts therefore return without a new publish or scheduled regeneration.

Stamp both projections with their real inputs and validity. A new roster/recipe/menu/removal revision invalidates affected old projections immediately, including a previously coherent fallback. A CDN fetch timestamp does not renew service validity. Offline cache bounds still apply; fall back automatically only when the rotation projection is actually valid for the known inputs and calendar basis.

EXPO's prepublish mirror and HUB's existing boot/focus/retry cadence fetch the required coherent set, including routing. A roster-only revision must update counts even if menu words and the schedule sidecar are unchanged. Promote a new candidate atomically in memory and reject late responses from an older request generation. Reassess cache age and service validity when counts are used, not only at initial loading. Port the cache-busted read seam and bound refreshes; do not add a scheduled Actions job.

When an effective meal's counts cannot be established, preserve usable meal information and staff records; mark routing-dependent tasks/quantities unresolved instead of choosing zero, 172 or an old count. Anaphylactic uncertainty must remain explicit. A historical board can remain readable without certifying its old routing. Once the valid replacement arrives, recover automatically; do not require a staff acknowledgement merely to restore quantities.

Acceptance: six synthetic discharges change 148→142 on already-open EXPO/HUB; reverted Arroz routing is Regular 159 / Vegetarian 11 in the incident fixture, not sausage routing; swap expiry with DOOR closed returns correct rotation counts without staff action or a new workflow. Deliver a new authoritative roster/revert receipt before routing: old affected quantities immediately become unavailable, then restore when matching routing arrives. Reverse response order and add late older responses; none can recertify superseded counts. Test an incompatible rotation basis, absent base projection, offline expiry and a removal arriving mid-refresh. Existing frozen-stock parity must continue to hold where coherent counts are available.

## F5 Dated views and working outputs agree

Use the effective dated meal projection for HUB's date-specific menu, board, popup, task print, menu print and workbook export. The dated menu table must show the same November 6 sausage dinner as the board, with the intended dietary lines and flags. Remove the stale renovation heading for the active standard source. A separate rotation reference may remain, clearly labelled as a rotation rather than dated service.

Do not relabel an old dated task into a new cycle as if newly authorized. Keep the existing expired-swap notice until a valid replacement is available. Test partial fetches so one view cannot silently promote new data while another remains on an incompatible revision.

Verify rendered DOM, generated print HTML and an opened exported workbook. Include a focused staff-device/print trial before rollout completion. Preserve notes, supervisor overrides, completed tasks and stock counts when rebuilding projections. Failure of a projection must not delete its source records.

## C1 and C2 Useful checks with less runner work

**C1 can ship independently once its baseline is recorded.** Move the tiny advisory job into the safety job as a non-blocking step with a clear summary. Ensure advisory results are still reported if the safety step fails, and retain a failing overall result for real safety failures. Combine Pages build/upload/deploy in one independent job, retaining the served-file allowlist, permissions, environments and deployment concurrency. Never add a test-success dependency to Pages.

Three ordinary publishes in the audit started four short jobs each. The target is two per publish. The sampled public repository's standard runner compute was free; a four-to-two change is an estimated 50% reduction in individually rounded private-runner minutes at those durations, not an invoice saving or a measured new benchmark. Measure actual seconds and job counts after the change using existing run metadata.

**C2a repairs assertion maintenance early while the full suite continues to run.** Replace whole-HTML/menu scope digests and live-population/day/date pins with fixed regression examples plus general behavior checks. Retain Corn/allergen/anaphylactic semantics and publish protections. Map every removed assertion to retained/replacement coverage and have it independently reviewed. Normalize source extraction where still necessary; prefer runtime assertions when practical. Missing optional cross-repo coverage must be recorded as a skip, not a pass. This slice needs F0's relevant baseline/review, not completion of F1–F4.

**C2b enables selection only after the compact operational contract is adequate.** Classify changes within the existing test job. Operational data changes run structure, effective-input/routing coherence, resident/allergen/anaphylactic invariants and the paired contract. Code/tests/workflow changes, unknown paths, missing diff bases and manual runs default to the full relevant suite. Never exclude all JSON, use `[skip ci]` for kitchen publishes, or create a classifier job that costs another allocation. Keep existing docs/log filters and cancellation. Broad browser regressions run for relevant code/contract changes; they are not required on every routine save.

Acceptance: valid swaps, replacements, inert HTML comments and legitimate zero-resident cohorts require no test-file editing. Deliberately malformed routing, wrong recipe variants, stale/unknown quantities and lost anaphylactic flags still fail or surface at their intended boundary. Test the path classifier against rename/delete/mixed code+data changes as well as ordinary data-only updates.

## F6 Quiet delivery and fewer commits

F1 already routes every dependent writer through the corrected atomic publisher. F6 optimizes that path: preserve immediate local persistence, use logical operation boundaries first, and add a short bounded coalescing interval only if needed. Urgent changes flush promptly. Do not sleep inside Actions to debounce commits or reintroduce independent menu/removal writers.

Persist the expected revision and distinguish local-save, committed, served and consumed states internally. Healthy progression is quiet. A committed revision that does not reach Pages gets bounded verification and an actionable delivery-pending status. Observe EXPO consumption when it next runs; a closed EXPO tab is not itself a failed save and never requires another content commit. Use existing app refresh and deployment mechanisms; no new frequent monitor workflow or self-hosted runner.

Make two separate decisions. If canonical content, effective date scope and routing inputs equal the already committed desired revision, create **no additional content commit**, regardless of delivery status. If delivery is unverified, retain its debt and inspect/retry that existing deployment through a bounded authorized mechanism; do not manufacture a commit to retrigger it. If deployment retry is unavailable, report the existing pending revision rather than repeatedly writing it. Keep check-in time separate. A real revert, roster change or recipe attachment change creates a genuinely new revision. A delivered write never clears newer local intent.

Acceptance: repeated unchanged saves during a Pages failure produce zero additional content commits, retain pending status and eventually verify the original or a genuinely superseding revision. EXPO being closed adds no publish loop. Cover stale CDN, app close/reopen, unavailable deployment-retry permission and a Git commit whose public delivery never completed.

## Review and rollout

The plan receives independent reviews for (1) food-safety/data correctness, (2) cross-app contracts, concurrency and rollout, and (3) operational friction, CI coverage and Actions usage. Record findings with priority, required change and closure evidence. Resolve material plan findings before describing it as ready for implementation; agent review is not production release approval.

For each implementation slice: gate author → builder → independent food-safety/data review → independent release/feed review → fold. Deliberately red safety gates are not rewritten merely to get green. Cross-app schema changes use paired PRs and shared contract fixtures; deploy tolerant consumers first, then additive producers, then enable stronger verification once compatible versions are served and active kitchen screens are refreshed. Old cached readers and old authenticated writers are different migration problems.

### One time writer cutover

F1's release owner inventories the write paths and app-held credentials used by DOOR devices, the HTA/Git path and automations, including shared HOUSE dependencies, without copying secrets into evidence. Preserve/export pending local edits before the migration; reload must not clear localStorage. The selected enforceable cutover is to revoke/rotate the legacy app-write credential set and admit replacement credentials only through the corrected publisher's credential lifecycle. Replacement DOOR credentials use a new versioned storage namespace that old code never reads; never mirror them into the legacy key. This is necessary because old and new tabs can share localStorage, so token rotation alone could give an old tab the replacement credential.

Deploy the corrected publisher/credential reader, perform the controlled revocation, reload known writing devices, and reconnect them through the existing Connect interface. If credentials are shared by another HOUSE app, coordinate its connection migration before revocation rather than causing an unexplained outage. Update or disable the old HTA/automation publishing path. Offline returning devices retain their local edits but their old credential must fail; after reload, rebase that pending intent onto current authoritative state rather than upload its old snapshots. This is one operator-led release transition, not a new daily staff approval step.

A new minimum-version field cannot restrain old JavaScript. Full consistency is not declared until the old credential paths are revoked and the known writing routes are tested. If the credential/write-path inventory cannot establish that boundary, activation remains incomplete; do not claim that serving new HTML solved it. No credentials are changed as part of this planning task.

Acceptance includes an already-open pre-F1 tab attempting a swap/removal write after cutover, a second tab in the same browser after the new credential is saved, an offline legacy device returning, the HTA/automation path, and rollback to pre-F1 UI. All bypass writes must fail without losing local edits or regaining the new credential. Read-only use remains available.

Validate the published allowlisted artifacts and consumer behavior on the exact release revisions, including anonymous reads where applicable and a clean profile with no prior local state. Retain the last coherent board when possible and expose the affected unavailable data, rather than blanking useful work. Measure first successful delivery, logical saves per commit, jobs per save and actual runner seconds. Diagnose exceptions; do not add routine staff status chores.

Rollback code and feature activation separately from staff data. Never restore an old menu snapshot, revert history or resident roster to undo a code release. If a faulty version produced inconsistent artifacts, regenerate from the latest accepted authoritative inputs through the corrected path. Keep additive readers available during rollback and preserve pending local operations. Retain the corrected writer and credential boundary when reverting a view/optimization; if that is impossible, use a read-only rollback plus a forward writer fix, never restore legacy write credentials. Prefer disabling the new projection/optimization over discarding saved work.

## Completion criteria

The work is complete when a normal authorized edit, swap, replacement, revert or discharge needs no developer test maintenance or extra staff approval; one coherent operation reaches EXPO and HUB; correct recipe and service quantities survive into working outputs; dated expiry returns valid rotation counts automatically while known supersession invalidates stale quantities; interruptions recover without destructive overwrites; and routine publishes use two runner jobs with unchanged content deduplicated independently of delivery retries. Claims of these outcomes require implementation evidence, not this planning review.

The [review record](reviews/DOOR_MENU_FLOW_PLAN_REVIEW_2026-11-06.md) records the eight findings, their corrections, the reviewed snapshot and all three closure verdicts. These verdicts apply to this plan; implementation and release still require the evidence specified above.
