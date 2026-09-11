# DOOR registry drift review — 2026-09-11

**Inputs:** `Meal List - Sept 10 2026 -revised.xlsx`, `Meal List - Sept 12, 2026 -revised.xlsx` (content-identical: 165 rows, footer says 164), DOOR `origin/main` `1d2aa17` (build `v31-standard.2`, confirmed live on Pages), published `door_state.json`. Read-only review; no code changed. Diff numbers below come from running DOOR's own `parseImportWorkbook` → `diffImportAgainstRegistry` in a Node sandbox against the published registry.

## 1. Verdict

DOOR's mechanics are fit for purpose. The drift is **operational, not a bug**: no daily-list import has been *applied and published* since **2026-05-20**. The Aug 31 hardening (registry-data timestamp guard + stale banner) is deployed, but the only published snapshot predates it, so every consumer is still reading a May-20 roster with an Aug-31 file date.

| Fact | Value |
|---|---|
| Published `door_state.json` exported | 2026-08-31 09:41 (a menu-edit publish) |
| Residents in it | 172 (sheet: 165) |
| `lastImported` on every resident | **2026-05-20** (170/172; 2 blank) |
| `_meta.registryModifiedAt` | absent (pre-hardening publish → guard falls back to `exported`) |
| `lastImportDate` / `lastModifiedBy` | blank / `unknown` (operator name not set on publishing machine) |
| Publishes since Aug 31 | none (Pages = repo) |

**Bring the roster up to speed now: one import + Review & Generate on the token-holding machine.** No code change is required first. Three code follow-ups are worth queuing (§3) but none blocks the catch-up.

## 2. What staff will see on import (Sept 12 sheet vs published registry)

`7 intakes · 14 discharges · 19 updates · 5 room reassignments · 5 Needs-Review`

- **Intakes:** 301b, 408, 702, 605 (No Pork), 701b, 903a, 903b — all Regular except 605.
- **Discharges:** 303, 306, 810, 907, 1007, 1207b, 505b, 714a, 716a, 914b, 1210a (Regular); **813** (GF/No Dairy/No Shellfish/Lactose), **914a** (Soft Meals), **301a** (Halal).
- **Reassignments (confirm each):** 416→416a+416b · 415a→415 · 506a→506 · 512→512b · **808a+808b (No Pork ×2) → 808 (Regular)** — the last one drops a restriction on a room change; verify with Comfort Hotel.
- **Updates — restrictions ADDED:** 510 Halal · 616 No Fish · **912 No Pork + GF** · 1010 Halal · 1207 GF+Lactose+No Shellfish · 502 Vegetarian→Halal+Low Sodium · 709 +Soft Meals · 1112 +Diabetic · 1204 No Pork→Vegetarian · 302a No Fish · 715a Halal+Diabetic · 715b No Pork · 602a Halal/Low Sodium→Vegetarian.
- **Updates — restrictions REMOVED (verify before accepting):** 309 (Vegetarian, No Dairy→Regular) · 1004 (Vegan→Regular) · 1210b (Vegetarian→Regular) · 313 (Soft→Regular) · 601 (No Fried→Regular) · **213 loses No Coconut** because the sheet says "Coconut" without "No" (parser cannot negate it; also shows as Needs-Review).
- **Needs-Review tokens:** 912 "No Sausage" · 1207 "No Almond", "Soy Milk only" · 213 "Coconut" · 709 "No Sauce -Vegetables with Chicken or Fish…" · 1112 "Diet" (noise).

**#912 specifically:** parses to `No Pork + Gluten Free` (No Wheat→GF, same precedent as room 813), section → Gluten Free; "No Sausage" lands in Needs-Review — map it to **No Pork** (or No Processed Food). DOOR currently holds 912 as *Regular*, so the "previous Lactose Intolerant" the intake note mentions was never captured either; the sheet no longer lists it, so nothing to carry forward.

**Sheet data-quality flag:** room **1014** appears three times (1014 Regular, 1014a No Pork, 1014b No Pork) — that is why rows = 165 vs the footer's 164. Registry already has all three, so DOOR is silent on it; raise with Comfort Hotel.

## 3. Mechanics review (backend)

**Sound:**
- Boot auto-sync (`ensureRegistrySynced`, 500 ms after load) pulls `door_state.json` via raw.githubusercontent; `doorRegistrySyncShouldSkip` compares the snapshot's `registryModifiedAt` against local `concRegistryProvenance`, so a menu-only publish can no longer clobber a fresher local roster. Manual Sync always overrides. Correct.
- Publish is atomic (one commit) and fires on Generate, registry edit, revert, seed, or the Publish Now button — not on import alone. `buildStateJSON` now stamps `registryModifiedAt`; the first post-catch-up publish fixes the legacy fallback.
- Import diff groups by base room (a/b splits are reassignments, not discharge+intake), discharges remove every duplicate record, dismissed-diffs and learned-NR are keyed on source text so they self-clear on real change.

**Gaps found (queue; do not fix now):**
1. **Freshness stamp fires at import-commit, not at apply.** `commitImportToQueue` (index.html ~19698–19710) writes both `concLastImportDate` and every resident's `lastImported` *before* Generate runs `applyQueueToRegistry`. If a user imports, commits, and never hits Review & Generate, the stale banner clears and the roster reads "current" while nothing was applied or published. This is the same blind spot the Aug 31 hardening described for `concLastImportDate`, only half-closed. Fix: stamp `lastImported` in `applyQueueToRegistry` (or after Generate).
2. **Unmatched tokens are swallowed when the tag signature is unchanged.** Needs-Review only fires for new/changed rooms (`flagNeedsReviewIfApplicable(e, isNewOrChanged)`). So **1215b** ("No Cauliflower / Tomatoes / Cucumber / Broccoli", registry says Regular) surfaces *nothing*; likewise 613a/613b "No Sea Food(s)", 412 "No Mayonaise", 1106 "White Rice / Bread" — the slash-splitter negates these into "No White Rice / No Bread", but **RULED AMBIGUOUS (Jason, 2026-09-11): a bare ingredient may mean "no X" or "prefers X"; this is a human judgment.** Known restriction words (pork, red meat, gluten, the allergens) may still be inferred as restrictions; only bare edge-case tokens are to be put to the person as "which did intake mean?" — and upstream, intake should be constrained so this ambiguity is not handed over at all. Fix (DOOR side): route bare unresolved tokens to a confirm-which prompt, and raise Needs Review whenever a room has unresolved tokens regardless of signature change. **BUILT 2026-09-11 (P6, `v31-standard.9`)** — see the plan §11. Note: 1106 itself does NOT get asked — its exact text was already resolved by a person in April and lives in `learned_nr.json`; the ruling stands for the next room like it.
3. **Rule gaps for this sheet:** `No Sausage`, `No Sea Food(s)` (→ No Fish + No Shellfish), `No Almond` (→ No Tree Nuts), bare `Coconut`. Add to `IMPORT_TAG_RULES`, or resolve once via learned-NR during the catch-up (the learned map persists per room and is published in `learned_nr.json`).
4. **Only boot + manual pulls.** No periodic re-sync; a tab left open all day never sees another machine's publish. Cheap fix: re-pull on `visibilitychange`/focus.
5. **Split-brain risk on a token-less machine.** The guard protects local edits from being overwritten, but a machine without the GitHub token (or without an operator name) never publishes them — edits live and die there. `lastModifiedBy: unknown` on the Aug 31 publish says the publishing machine has no operator name set. Confirm which machine holds the token and make that the daily-import machine.
6. Housekeeping: `applyRegistryPatch` (Apr-27 one-shot for 813/1006) is still in boot — harmless (keyed), can be deleted. `registry_summary.json` (172, halal 35) and `routing_by_meal.json` are built from the stale roster, so EXPO portion math and HUB portion links are off until the republish.

## 4. Catch-up runbook (UX walkthrough)

1. On the **token-holding machine**, hard-reload DOOR; confirm `v31-standard.2` in the footer. Enter Changes should show the red banner "registry is ~114 days out of date" (ground truth = freshest `lastImported` May 20).
2. Import **the Sept 12 sheet** (newest). Expect the counts in §2. Everything shown is real accumulated change, not an error.
3. Reassignments: accept 416/415/506/512; **query 808** (two No Pork → one Regular).
4. Updates: accept the additions; for the six *removals* (309, 1004, 1210b, 313, 601, 213-coconut) confirm with Comfort Hotel or dismiss individually — a dismissal is keyed to the source text and reappears if the text changes.
5. Needs-Review: 912 → No Pork · 213 → keep No Coconut · 1207 → No Tree Nuts (almond), note soy milk as an accommodation · 709 → note only · 1112 → ignore "Diet".
6. Manually add what the parser cannot see (§3 item 2): **1215b** four vegetable avoidances, **613a/613b** No Fish + No Shellfish. 412 already carries No Eggs (mayonnaise covered).
7. **Review & Generate.** Sync bar should read "Synced ✓ — ~165 residents"; `door_state.json` on GitHub should show `count ≈ 165` and a `registryModifiedAt` field.
8. On every other DOOR machine: open DOOR (boot sync adopts the newer snapshot) → import the **same Sept 12 sheet** → expect **0 changes**. That zero is the cross-machine proof.

Set the operator name in Settings on the publishing machine so `lastModifiedBy` stops reading `unknown`.

## 5. Addendum — where the daily entries went (publish-history trace)

`git log -- door_state.json` since May 1 (141 publishes), read for operator, `lastImportDate`, and freshest `lastImported`:

| Window | Publisher | Registry |
|---|---|---|
| May 1 – May 20 | `Joan Wan` daily (some `JK`) | `lastImportDate` advances every day; count 172–174 — **working as designed** |
| May 21 14:37 – Aug 31 09:41 | `unknown`, 40 publishes | `lastImportDate` blank, every resident `lastImported` 2026-05-20, count 172 byte-frozen — a **second machine** that never imported a roster (its recent_log is all menu edits) |
| after May 20 | Joan's machine | **zero publishes** |

So the daily work after May 20 never reached GitHub, and was almost certainly wiped on the entry machine itself: until Jun 16 boot-sync adopted the cloud copy unconditionally; from Jun 16 (`d8680fd`) to Aug 31 the guard compared whole-file `_meta.exported`, so every menu publish from the other machine (newer file date, May-20 roster) out-ranked the local registry at the next reload. Each morning's import then diffed against May 20 and showed a growing backlog — the exact symptom the Aug 31 hardening commit describes.

Why the entry machine stopped publishing cannot be determined from the repo. Every candidate prints a red "Saved locally — not published · <reason>" line under Generate: `missing_auth` (token gone or rotated), `auto_publish_off` (checkbox), `not_hydrated`, and since Aug 17 `stale-tab` (a tab opened before any deploy never auto-publishes; deploys are frequent). EXPO's old "Clear all safe keys" (fixed 2026-07-04) deleted the shared `conc_gh_token` and DOOR state on any machine where it was clicked.

**Check on the entry machine (2 minutes):** Settings → token present, operator name set · Enter Changes → banner day-count and resident count (if it shows ~165 and no banner, the local copy survived the Aug 31 fix and a single Publish Now catches up the cloud) · after Generate, read the sync-bar line · console for `[DOOR] registry sync skipped` / `publish skipped`.

**Design gap to queue:** a menu-only publish from any machine republishes that machine's roster into `door_state.json`. The `registryModifiedAt` guard now stops it clobbering other devices, but EXPO/HUB still read the stale roster from the file. Fix: skip the registry artifacts when local provenance is older than the remote `registryModifiedAt`, or publish them only from the machine that last applied an import.
