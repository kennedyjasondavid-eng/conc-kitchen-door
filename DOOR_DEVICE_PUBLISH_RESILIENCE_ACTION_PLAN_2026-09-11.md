# DOOR — Device publish resilience: action plan (near-term tier)

*Authored 2026-09-11 from the registry-drift review (`docs/DOOR_REGISTRY_DRIFT_REVIEW_2026-09-11.md`). Planning only; no app code in this commit. **Forks F1–F5 RULED by Jason 2026-09-11 (§7) — build is unblocked, order P0→P5.***

## 1. Telos

DOOR's job is: staff enter resident changes once and everything downstream is right. The read side already lives in the site (any browser gets the roster on boot). The write side depends on a per-device credential and a per-device operator name that nobody is told are missing. A staff member on a new computer did three months of daily work that never left the machine, while another machine kept republishing a frozen roster. **This tier makes the write path recover itself**: a device that cannot publish says so persistently, asks for what it needs at the moment of need, holds its work durably until it can send it, and never overwrites a fresher roster with a staler one. It does not change how the roster is imported or routed.

Out of scope (mid-term tier, HOUSE build-path phase 6): Microsoft 365 sign-in + Graph/SharePoint as the write store. Nothing here should pre-empt that; every slice is a bounded improvement to the GitHub lane that phase 6 later retires or reuses.

## 2. Measured problem (from the review)

| Symptom | Mechanism | Anchor |
|---|---|---|
| Daily entries never reached GitHub after 2026-05-20 | Entry device had no token/operator → `publishAndSync` printed a one-shot red line under Generate; nothing durable, nothing on the next boot | `publishAndSync` `:10005`, `_doPublishToGitHub` skip reasons `:12614–12631`, `PublishAuth.getCredentialsForBackgroundPush` `:11534` |
| Entry device's registry reverted each morning (pre-Aug-31) | Boot-sync adopted the cloud copy on whole-file `exported`; fixed Aug 31 by `registryModifiedAt` | `pullStateFromGitHub` `:10266`, `doorRegistrySyncShouldSkip` `:9835` |
| Cloud roster still frozen after the fix | A menu-only publish from any machine writes that machine's roster into `door_state.json`; the guard protects other devices but EXPO/HUB read the file | `buildStateJSON` `:11771`, atomic publish set in `_doPublishToGitHub` |
| Nobody noticed for 3.5 months | No standing signal that a device is publish-incapable; `lastModifiedBy: unknown` on 40 publishes went unread | `getOperatorName` `:10041`, `ensureOperatorName` `:10047` (gates Generate only) |
| Stale banner can clear without an apply | `commitImportToQueue` stamps `lastImported` before Generate applies | `:19698–19710` |

## 3. Principles this plan is held to

- **Enter once, derive the rest.** No new stores of truth; an outbox holds a *pointer* to state already persisted, never a second copy that can disagree.
- **Loud, never silent** (HOUSE silent-drift rule §X2). Every skipped publish becomes a standing, dated, counted banner — not a toast.
- **Honest absence.** The banner says exactly what is missing (token / name / stale tab / auto-publish off) and offers the one action that fixes it.
- **Port the seam, cite the row** (`conc-kitchen-house/HOUSE_PROVEN_SEAMS.md`): row 1 `setItemSafe` (quota-safe writes — DOOR's named gap), row 3 token sanitizer (DOOR's named gap), row 4 `PublishAuth` (DOOR owns), row 5 atomic publish (DOOR closed 08-17). EXPO save-trust PR-B/PR-C are the reference implementations for connect-at-need and the durable queue.
- **Authored-to-fail gates**, `node --test tests/*.mjs` style (vm extraction + source scans, no browser); every slice red on pre-slice `index.html`, green after.
- **Schedule/roster-neutral.** No slice changes what an import diffs to or what a Generate produces; `door-smoke` stays green with zero re-bless.

## 4. Seam map

| Seam | Today | Slice |
|---|---|---|
| `PublishAuth` (`:11454`) — token/repo/expiry, `notePublishSkipped`, `rememberFailure` | Records failures; surfaces only per-action | P1, P2 |
| `publishAndSync(context)` (`:10005`) → `publishToGitHub(false)` → `{skipped, reason}` | Red sync-bar line, then forgotten | P1 (banner source), P3 (enqueue) |
| `_doPublishToGitHub` skip reasons: `auto_publish_off`, `stale-tab`, `missing_auth`, `not_hydrated`, `empty_clobber`, `size_regression` | Each returns a reason string | P1 maps reason → banner copy + action |
| `getOperatorName` / `ensureOperatorName` (`:10041`) | Prompted at Generate only | P4 first-run card |
| `buildStateJSON` (`:11771`) + publish file set | Always includes registry artifacts | P5 gating |
| `updateDailyImportPrompt` (`:10092`) + `#daily-import-prompt` (`:896`) | Hosts the stale-registry banner | P1 adds the device banner beside it |
| `getRegistryProvenanceTs` (`:9804`), `registryModifiedAt` | Read-side guard only | P5 reuses for the write-side decision |
| `commitImportToQueue` `lastImported` stamp (`:19698`) | Stamps at commit | P0 moves to apply |

## 5. Slices (build order; one PR each; each gated + 2-lens reviewed)

### P0 — Freshness stamp at apply (tiny, unblocks honest banners)
Move the per-resident `lastImported` stamp (and `concLastImportDate`) from `commitImportToQueue` to `applyQueueToRegistry` (or the Generate success path), so "registry current as of" means *applied*, not *viewed*. Keep `concLastImportFile`/`Count` where they are (display-only).
**Gate** `tests/registry_stamp_at_apply_gate.mjs`: vm-extract both functions; seed a registry + import entries; run commit → assert no `lastImported` change; run apply → assert stamped today. Source scan: no `lastImported =` inside `commitImportToQueue`. Red on current HEAD (stamp present in commit, absent in apply).

**BUILT 2026-09-11 — branch `claude/door-p0-stamp-at-apply`, `DOOR_APP_VERSION v31-standard.3`.** Two design refinements found in build, both recorded here:
- **Zero-change imports stamp immediately.** If commit queues nothing, there is nothing to apply and the roster is *verified* current; deferring the stamp to a Generate that staff have no reason to run would make the banner cry stale after 7 days of honest daily checks. So `doorRecordImportStamp(rooms, date, pushed)` stamps now when `pushed === 0`, else writes `concPendingImportStamp = {date, rooms}` (a pointer, F1-style) which `applyQueueToRegistry` consumes after the map rebuild (so new intakes are stamped too — closes the "intake has `lastImported: undefined`" wart from the review).
- **`concLastImportDate` is left where it is.** `renderImportReview` already sets it when staff reach the review step ("roster checked today" drives the daily prompt); the stale banner deliberately ignores it. Moving it would change the daily-prompt semantics for no banner gain.
- Receipts: gate authored red **0/7** on pre-P0 `index.html`, **7/7** after; full suite **164/164**; `git diff --check` clean; headless boot of the edited page against the live roster + zero-change re-import of the Sept 12 sheet → no pageerror, `pushed 0`, **165/165 listed rooms stamped today**, pending key absent, no unlisted room touched. **Known edge (accepted):** a pending stamp survives if staff clear the queue by hand and then Generate an unrelated change; it then stamps rooms from a list whose changes were discarded. Rare; the next real import overwrites it.
- **Operational note surfaced by the e2e:** after the Sept 11 catch-up, the first re-import on every device shows 6 "removal" updates (213 No Coconut, 1207 No Tree Nuts, 613a/613b No Fish + No Shellfish, 1215b No Brassicas/No Nightshades, 808 No Pork) — the tags the sheet text cannot express. Dismiss each once per device (dismissals are keyed to the source text and are device-local). This is the §3 item-2 class and the P-line does not change it.

### P1 — Persistent device-capability banner
A standing banner on Enter Changes, rendered by `updateDailyImportPrompt` next to the stale-registry banner, driven by a pure `doorDeviceCapability()` → `{canPublish, reasons:[...], unpublished:{count, since}}`:
- reasons derived live: no token (`PublishAuth.getSavedToken()` empty), token expired (`isExpired`), no operator name, auto-publish off, stale tab (`doorTabStaleVerdict`), last publish failed (`rememberFailure` record).
- `unpublished` = the P3 outbox (in P1, fall back to `concLastGenerated` newer than the last successful publish timestamp).
- Copy in kitchen words, one line per reason, each with its fix as the button: "This computer can't publish to the shared board — no GitHub connection · [Connect]" / "— no operator name · [Set name]" / "— this tab is out of date · [Reload]". Red when work exists only here, amber when nothing is pending.
- Never blocks import or Generate (#38 honest-absence, not a gate).
**Gate** `tests/device_capability_banner_gate.mjs`: pure-function truth table (each reason alone, combined, none); source scan that `updateDailyImportPrompt` calls the renderer and that every `_doPublishToGitHub` skip reason has a banner mapping (enumerate the reason strings; fail on an unmapped one). Red: function absent.

**BUILT 2026-09-11 — branch `claude/door-p1-device-banner`, `DOOR_APP_VERSION v31-standard.4`.**
- Pure `doorDeviceCapability(inp)` → `{canPublish, reasons[{code,label,action}], unpublished{pending,since}, level none|amber|red}`; live reader `doorDeviceCapabilityInput()` (nothing cached); renderer `_doorDeviceBannerHTML(capOpt)`; one action sink `doorDeviceBannerFix(action)` (`connect`/`settings` → Settings screen until P2's inline card; `name` → `ensureOperatorName`; `reload`). Inserted beside the stale-registry banner in **both** daily-prompt branches.
- `DOOR_PUBLISH_SKIP_REASONS` maps every skip reason the publish path can emit (11, discovered by the gate from source: `auto_publish_off`, `stale-tab`, `stale-tab-cancelled`, `missing_auth`, `not_hydrated`, `empty_clobber`, `size_regression`, `blocked`, `validation-stop`, `validation-stop-cancelled`, `error`) to kitchen copy + a fix. **F4 gate-locked:** no staff-facing label may contain "token" or "GitHub".
- Recording: `publishAndSync` writes `concLastPublishSkip {reason,message,at}` on skip/throw and re-renders the prompt; `_doPublishToGitHub` writes `concLastPublishOk` and clears the skip on a landed commit (both auto and manual). `unpublished.pending` = `concLastGenerated` newer than `concLastPublishOk` (or never published). A live cause already listed is not double-reported from the last skip.
- Receipts: gate authored red **0/9** on pre-P1 `index.html`, **9/9** after; full suite **173/173** (three narrow smoke harnesses needed the codebase's `typeof` guard convention on the new calls, not stub changes); `git diff --check` clean. Headless new-device boot (empty localStorage): **amber** with `no-connection` + `no-operator`; after a simulated Generate-without-publish → **red** with "Changes on this computer have NOT reached the shared board (generated …)"; after connect + publish stamps → **none**. No pageerror. Screenshots delivered in-session.
- **Carry-forwards:** P2 replaces the `connect` action's Settings hop with the inline connection-key card; P3 replaces the `lastGeneratedAt > lastPublishOkAt` proxy with the outbox count. The auto-publish checkbox is per-tab (never persisted, default checked) — the banner reads its live DOM state, so "auto-publish off" can only appear in the tab where it was unticked.

### P2 — Connect at the moment of need
When `publishAndSync` receives `skipped:true`, and on the P1 [Connect] button: an inline card (not the Settings screen) with a masked **connection key** field (F4: never the word "token" or "GitHub" on the staff surface — the key is admin-provisioned, see README admin section), **Test & connect** (authenticated `GET /user`, honest 401-vs-network copy), and Cancel. On success: `PublishAuth` stores the token, then publishes the pending state immediately (P3 drain; in P2, re-run the just-skipped publish). Port EXPO PR-B `testGHConnection` / `_backupStatusLineHTML` verbatim where they fit; sanitize the token (seam row 3 — closes DOOR's named gap).
**Gate** `tests/connect_at_need_gate.mjs`: vm-extract the card + handlers with a stubbed `fetch`; 200 → stored + publish invoked once; 401 → not stored, refusal copy; network → not stored, distinct copy; token with smart quotes → sanitized before header build. Source scan: `publishAndSync` skip branch calls the card opener. Red: symbols absent.

**BUILT 2026-09-11 — branch `claude/door-p2-connect-card`, `DOOR_APP_VERSION v31-standard.5`.**
- Inline card `_doorConnectCardHTML()` rides inside the P1 banner while `_doorConnectCardOpen` (masked `#door-connect-key`, "ask Jason (kitchen lead)" wording, **Test & connect**, Cancel, `#door-connect-status`). Opened by the banner's Connect action and **auto-opened when `publishAndSync` records a `missing_auth` skip** (the one skip staff can fix on the spot).
- `doorConnectCardSubmit()`: sanitize → `PublishAuth.validateToken` (existing repo-read probe) → `saveValidatedToken` → close → `publishAndSync('connected — …')` re-runs the owed publish once (P3 replaces this with the outbox drain). Failures go through `doorConnectFailureCopy` → `rejected` / `network` / `other`, all in kitchen words; a rejection also feeds `PublishAuth.rememberFailure` so Settings agrees.
- **Seam row 3 closed for DOOR:** `doorSanitizeConnectionKey` (port of EXPO `getGHToken`'s non-printable-ASCII strip) applied in `PublishAuth.getSavedToken`, `getTypedToken`, and `saveValidatedToken` — on read as well as on save, so a key stored by an older build with paste artifacts cannot break the header.
- **F4 realized:** the card and every failure string are gate-locked free of "token"/"GitHub"; the fine-grained, repo-scoped, contents-only key procedure moved to `README.md` → "Admin — issuing a connection key for a DOOR device".
- Receipts: gate authored red **0/10** on pre-P2 `index.html`, **10/10** after; full suite **183/183**; `git diff --check` clean. Headless new-device e2e: Connect → masked card renders; empty submit → "Paste the connection key first."; a smart-quoted bogus key sent to the **real** endpoint → "That key was not accepted. Check with Jason…", card stays open, nothing stored, **zero non-GET calls to GitHub**, no pageerror.
- **Carry-forward:** Settings still shows GitHub vocabulary (it is the admin surface, so acceptable under F4); P3 makes the post-connect publish an outbox drain instead of a single re-run.

### P3 — Durable publish outbox
`concPublishOutbox` = `[{ts, context, registryModifiedAt, menuHash}]` — pointers, not payloads (state is already in localStorage). Every skipped publish appends via `setItemSafe` (seam row 1 — closes DOOR's named gap). Drain points: after P2 connect, at boot when a token exists, and after a manual Publish Now. Drain publishes **current** state once (the outbox is a "something is owed" flag with provenance, not a replay log), then clears. Feeds P1's `unpublished` count/since. Survives reloads and the stale-tab skip; cleared only by a verified successful publish.
**Gate** `tests/publish_outbox_gate.mjs`: skipped publish → one entry; three skips → three entries; boot with token → drain publishes once and empties; publish failure → entry retained; quota-exceeded `setItem` → `setItemSafe` path, no throw, loud console. Red: store absent.

**BUILT 2026-09-11 — branch `claude/door-p3-publish-outbox`, `DOOR_APP_VERSION v31-standard.6`.**
- `concPublishOutbox` = `[{ts, context, reason, registryModifiedAt}]` (F1 pointer, never a payload; cap `DOOR_OUTBOX_MAX` 50, newest kept). `doorOutboxAppend` on every `publishAndSync` skip **and** throw; `doorOutboxClear` only where `_doPublishToGitHub` stamps `concLastPublishOk` (auto or manual); `doorOutboxDrain(trigger)` = one `publishAndSync` of CURRENT state when owed and a key exists — it never clears itself. Drain points: P2 `doorConnectCardSubmit` (replaces the direct re-run) and boot, chained after `ensureRegistrySynced()` settles (+1.5 s). A skip re-records itself, so the boot drain cannot loop.
- **Seam row 1 closed for DOOR (partial port):** `doorSetItemSafe` — synchronous happy path; on quota, drop `DOOR_EXPENDABLE_KEYS` (only the pre-Generate undo snapshot `concRegistrySnapshot`) and retry once; loud console warn, never throws. DOOR has no storage map/upkeep like EXPO's, so this is the honest minimum; the gate pins that no load-bearing key can ever be listed expendable.
- P1 banner now reads the outbox first: `unpublished.count`, "N sets of changes … (oldest …)"; the Generate-vs-publish timestamp proxy remains the fallback.
- **e2e finding folded (was a live P2 gap):** with NO key at all, `_doPublishToGitHub` **throws** from `_getSavedCredentials` rather than returning a `missing_auth` skip, so a brand-new device recorded `error` and the Connect card never auto-opened. `publishAndSync`'s catch branch now classifies a missing/expired key as `missing_auth` (outbox reason + card open); the P2 gate gained three assertions pinning the catch path.
- Receipts: gate authored red **0/6** on pre-P3 `index.html`, **7/7** after (+expendable-list lock); P2 gate updated to the drain contract (+1 nothing-owed case); full suite **191/191**; `git diff --check` clean. Headless new-device e2e: two Generates with no key → outbox 2 × `missing_auth`, banner red "2 sets of changes … (oldest …)", card auto-open; reload → outbox survives, boot drain returns 0 without a key; **zero non-GET GitHub calls**, no pageerror.
- **Known edges (accepted):** the drain publishes current state, so if the roster changed between the owed Generate and the drain, the newer state goes out (intended — pointer, not replay). A manual Publish Now that lands also clears the outbox (correct: the debt is the same current state).

### P4 — First-run device setup card
On boot, if operator name is empty **and** `concPublishOutbox`/`concLastGenerated` are absent (a genuinely new device), show a one-time card before Enter Changes: operator name (required), connection key (Test & connect, or "skip — this computer will only read"; F4 wording: no GitHub concepts), site confirmation. Skipping is allowed and recorded; the P1 banner then carries the consequence. Re-openable from Settings.
**Gate** `tests/first_run_setup_gate.mjs`: predicate truth table (new device / returning device / name set but no token); skip path records `concDeviceReadOnly` and P1 shows the amber banner; completing sets name + token via `PublishAuth`. Red: predicate absent.

**BUILT 2026-09-11 — branch `claude/door-p4-first-run`, `DOOR_APP_VERSION v31-standard.7`.**
- Pure `doorIsNewDevice({operatorName, lastGeneratedAt, outboxCount, firstRunDone})` — new only when ALL are empty/false; live `doorFirstRunShouldShow()` (or the Settings re-run flag `_doorFirstRunForce`). Card `_doorFirstRunCardHTML()` renders on Enter Changes **after the stale-roster banner and instead of the P1 device banner** while showing (the card asks for the same two things): name (required), masked optional connection key ("ask Jason, kitchen lead"), site shown from `currentSite`. Buttons: **Set up this computer** / **Skip — this computer will only read**.
- `doorFirstRunSubmit`: name → `setOperatorName`; key present → P2 sanitize/validate/save, clears `concDeviceReadOnly`, marks `concFirstRunDone`, drains the outbox; key rejected → name kept, setup stays open with kitchen-word status ("… You can also skip and connect later."); key empty → treated as read-only. `doorFirstRunSkip` (F2): name required, records `concDeviceReadOnly=1` + done. A later successful P2 Connect clears read-only. `doorFirstRunReopen()` from Settings ("Set up this computer again") forces the card, prefilled with the current name.
- P1 capability gained `readOnly`: a read-only device without a key shows its own reason ("set up as read-only — connect it to send changes") in place of the generic no-connection line; still amber, still `connect` action.
- Receipts: gate authored red **0/9** on pre-P4 `index.html`, **9/9** after; full suite **200/200** (one smoke source-lock pins `el.innerHTML = _staleBanner +` as the prefix, so the card sits after the stale banner — the right order anyway); `git diff --check` clean. Headless new-device e2e: card shows with the device banner suppressed and "Site: Rexdale"; skip without a name refused; skip with a name → `concDeviceReadOnly=1`, done, amber `read-only` reason; Settings re-run → card returns prefilled; zero non-GET GitHub calls; no pageerror.
- **Note for the existing devices:** they all have an operator name or a Generate history, so `doorIsNewDevice` is false and nobody sees the card unless they choose "Set up this computer again". Joan's replacement machine is exactly the case it exists for.

### P5 — Registry-artifact publish gating
In `_doPublishToGitHub`, before building the file set: if the remote `door_state.json` `_meta.registryModifiedAt` is **newer** than local `getRegistryProvenanceTs()`, publish menu artifacts only and omit `door_state.json`, `registry_summary.json`, `routing_by_meal.json` (routing is registry-derived). Sync bar + P1 banner say "menu published · roster on this computer is older than the shared one — not sent". Manual Publish Now may override with an explicit confirm naming both dates. Legacy remote (no `registryModifiedAt`) → publish as today.
**Gate** `tests/registry_publish_gating_gate.mjs`: stub remote meta newer → file set excludes the three; older/equal/absent → includes; manual override → includes with confirm called. Source scan pins the three filenames in the gated set. Red: gating absent.

**BUILT 2026-09-11 — branch `claude/door-p5-registry-gating`, `DOOR_APP_VERSION v31-standard.8`. Design refined in build: ADOPT-then-publish, not omit.**
- Omitting the three registry artifacts would have left `routing_by_meal.json` (registry-derived) and the `builtFromMenu` stamps desynced from a freshly published menu, and left the stale machine stale. Instead, `_doPublishToGitHub` runs `doorRegistryPublishPreflight(manual)` **after credentials and before any artifact is built**: it reads the shared `door_state.json` `_meta` (raw, unauthenticated, no-store), and `doorRegistryPublishGate(remoteMeta, localProvTs)` decides `remote-newer | local-current | legacy | unknown`. On `remote-newer` the **auto path adopts the shared roster via the existing read-side `pullStateFromGitHub(false)`** (safe: "local older" means local holds no unpublished registry edits — provenance moves on every local registry change) and then publishes a coherent four-artifact set from it. **Manual (F3):** a confirm naming both dates — OK = use the shared roster (recommended), Cancel = **force** this computer's older roster (rollback; the sync bar goes amber and says so). Legacy/unreachable remote → publish as today; the preflight never throws.
- The success line names the outcome: "· used the shared roster (newer than this computer’s copy)" / "· FORCED this computer’s older roster (rollback)". No new skip reason (nothing is skipped), so the P1 reason map is unchanged.
- Receipts: gate authored red **0/6** on pre-P5 `index.html`, **6/6** after; full suite **206/206**; `git diff --check` clean. Headless e2e against the **live** shared roster, simulating the stale machine (roster trimmed to 160, provenance May 20): auto preflight → adopted, 165 back, provenance = shared `registryModifiedAt`; manual + Cancel → forced, roster untouched, prompt names **May 20, 2026** and **Sep 11, 2026**; manual + OK → adopted; local current → `local-current`, no-op; zero non-GET GitHub calls; no pageerror.
- **Note on the "omit" gate text above:** superseded by this refinement; the shipped gate asserts the adopt/force/no-op contract instead.

## 10. Line status — near-term tier COMPLETE (2026-09-11)
| Slice | PR | Version |
|---|---|---|
| P0 stamp at apply | #89 merged | v31-standard.3 |
| P1 device-capability banner | #90 merged | v31-standard.4 |
| P2 connect at need + seam row 3 | #91 merged | v31-standard.5 |
| P3 durable outbox + seam row 1 | #92 merged | v31-standard.6 |
| P4 first-run setup card | #93 merged | v31-standard.7 |
| P5 registry publish gating (adopt-then-publish) | draft | v31-standard.8 |

Definition of done (§9) check: a new computer sees it is not connected (P1/P4), connects in one card (P2/P4), every Generate reaches the board once connected (P3), and a menu-only machine can no longer publish a roster older than the shared one (P5). Review report §3 items 1, 4, 5 and §5's design gap are closed. **Remaining DoD item after P5 merges:** update the HOUSE ledger row for DOOR (version + seam rows 1 and 3 closed) in `~/.claude/CLAUDE.md` and `conc-kitchen-house/HOUSE_PROVEN_SEAMS.md` — cross-app facts, written once the version is on `main`. Review §3 item 4 (re-pull on focus) was not built in this tier; the boot drain plus the banner cover the practical case, and it can ride the mid-term M365 work.

## 11. Follow-on P6 — ambiguous bare tokens: ask the person, don't guess (RULED + BUILT 2026-09-11)
**Ruling (Jason):** a bare ingredient in a slash-list ("Diabetic / No Red Meat / White Rice / Bread") may mean "no X" or "prefers X" — a human judgment. Known restriction words (pork, red meat, gluten, coconut, the allergens…) are still **inferred** as restrictions; only edge cases are put to the person. Upstream, intake should be constrained so this ambiguity is not handed over at all.
- **Parser** (`normalizeRestriction`): both expanders report the bare nouns they prefixed with an implied "No"; a bare leftover token whose "No <noun>" matches a rule is **inferred** (this also fixes the recurring 213 "Coconut" removal-update wart — it is now `noCoconut`); one that matches nothing is **`ambiguous`**. `IMPORT_BARE_NOISE_RE` keeps fragments ("foods", "Diet", "lunch") from ever being asked. Explicit "No X" that matches no rule stays ordinary Needs Review (a restriction the parser can't tag), not a question.
- **Needs Review fires regardless of tag-signature change** (review §3 item 2 closed); the learned map + `_resolved_text` still silence a room once a person has answered. `ambiguous` rides the `concUnresolvedNR` hand-off.
- **Review & Generate card:** per bare noun, "Which did intake mean? (listed without “No”)" → **No X** / **Prefers X** / **Not applicable** (`nrAddAmbiguous`; a second answer for the same noun replaces the first). `nrDoneReview` writes the **specific** answer as the service note (never the whole raw line) and learns the room. `nrAddAmbiguous` added to `DOOR_INLINE_HANDLER_ALLOWLIST` (the real page throws otherwise — caught only by the e2e, not the vm gate).
- **Receipts:** gate `tests/ambiguous_token_confirm_gate.mjs` authored red **0/6** on pre-P6, **7/7** after; suite **213/213**; `git diff --check` clean. Headless re-import of the Sept 12 sheet against the live roster: **213 no longer a removal update**; Needs Review carries `ambiguous` only for 1215b (Tomatoes/Cucumber/Broccoli); 1106 is silent because its exact text was resolved in April (`learned_nr.json`); the card renders the three answers per noun; answering → `serviceNote` gains "No Tomatoes; Prefers Cucumber", room learned; noise fragments ask nothing; zero non-GET GitHub calls; no pageerror. `DOOR_APP_VERSION v31-standard.9`.
- **Still device-local / per-device:** dismissals and the answers' learned map (published) — the learned map IS shared via `learned_nr.json`, so one answer covers every device.

## 6. Verification cadence (per slice)
`node --test tests/*.mjs` green (new gate authored red first, receipt in the PR) · `door-smoke` untouched and green · manual: fresh browser profile (empty localStorage) → P4 card → skip → P1 red banner after Generate → P2 connect → P3 drain → cloud `door_state.json` count/`registryModifiedAt` move · `git diff --check` · APP_VERSION stamp bump per PR.

## 7. Forks — RULED 2026-09-11 (Jason)
| Fork | Ruling | Consequence for the build |
|---|---|---|
| **F1 Outbox shape** | **Pointer flag** | `concPublishOutbox` records that a publish is owed + provenance; drain publishes CURRENT state once. No payload replay. |
| **F2 First-run skip** | **Allow read-only** | Operator name required; connection optional; skipping sets `concDeviceReadOnly` and the P1 banner carries the consequence. |
| **F3 P5 override** | **Allow, dated confirm** | Manual Publish Now may push an older roster after a confirm naming both `registryModifiedAt` dates; auto-publish never. |
| **F4 Token guidance** | **Staff must not have to engage with GitHub.** | The Connect card shows **no GitHub concepts** — the field is labelled a *connection key* that the kitchen lead supplies, one line "ask Jason for this device's key", Test & connect. Scoped-PAT creation guidance moves to an **admin section of `README.md`** (Jason provisions one fine-grained, repo-scoped token per device). This also confirms the mid-term tier: M365 sign-in is the real answer for staff; the GitHub lane stays an admin-provisioned bridge. P2 + P4 copy updated accordingly. |
| **F5 Order** | **P0 → P5 in sequence** | The roster is caught up (`86f2f0c`); the re-freeze window before P5 is accepted and covered by the P1 banner on the stale machine. |

## 8. Do not touch
Import parsing/diff (`IMPORT_TAG_RULES`, `normalizeRestriction`, `diffImportAgainstRegistry`), routing/section logic, `pullStateFromGitHub`'s read-side guard, the atomic publish mechanics, artifact schemas/versions, the stale-registry banner's ground truth (P0 only moves *when* it is stamped). No Graph/M365 code.

## 9. Definition of done
A staff member on a brand-new computer, with no help, can: see they are not connected, connect in one card, and have every day's Generate reach the shared board — and a machine that only edits menus can never publish a roster older than the one already shared. All five gates green in CI; review report §3 items 1, 4, 5 and §5's design gap closed; HOUSE ledger row for DOOR updated with the version and the closed seam-row gaps (1 and 3).
