# Plan of Action — Menu Config shows old/reno meal names instead of the standard menu

**Date:** 2026-07-13 · **Branch:** `claude/meal-names-edit-accuracy-rh36nx` · **Status:** PLAN ONLY (no code/data changed).
**Revision:** **v2** — revised after a 6-lens adversarial Fable-model review (verdict **REVISE**, all six lenses; §11). Every load-bearing finding below was independently re-confirmed against the code firsthand.

> ### ⚠ v2 headline changes (why v1 was NOT safe to execute as written)
> 1. **v1's core premise "the baked standard menu is correct" is FALSE.** Baked `MENU_DATA` W1 MON vegan dinner is the **retired `Jerk Cauliflower` with `hasSoy:false`**; the Jason-ruled `Jerk Tofu` + soy correction lives **only in the overlay** v1 blanket-clears. Executing v1 would revert a ruled dish **and drop a soy allergen flag on a live vegan dinner — a sacred never-under-flag violation.**
> 2. **The overlay carries allergen `*_flags`, not just names.** A blanket clear silently weakens allergen flags on multiple slots that feed the anaphylactic net (incl. a live anaphylactic-coconut resident). v1 never mentions allergens. **Allergen reconciliation is now mandatory (§4).**
> 3. **EXPO/HUB are LIVE consumers right now, not "limited blast radius."** So the cloud files must be fixed **FIRST** as an emergency direct commit; v1's "Phase 2 → Phase 1" order is backwards (§5, §7 Phase 0).
> 4. **`routing_by_meal.json` is a FOURTH contaminated store** (missing from v1) and is stamped v31 so no gate catches it (§3, §7).
> 5. **In-app overlay cleanup is impossible** (publish anti-clobber guard) → Phase 1 **must** be a direct repo commit; the cleaned overlay must stay non-empty `{"_meta":{…}}`, never `{}` (§7).
> 6. **The recurrence VECTOR is still open:** `makePermanent()` has no `isAltMenuActive()` guard and the reno "📋 Alt Menu" toggle is still live — a Make-Permanent while Alt Menu is on writes reno name+flags into the standard overlay. This is the likely original cause; Phase 2 must close it (§7).
> 7. **v1's §5 claim is factually wrong:** `makePermanent` **deletes** competing one-time swaps. Re-applying Make Permanent on W2 Tue/Wed lunch before Jul 15 would destroy the two swaps we're told to preserve (§6, §9).

---

## 1. Symptom

On **Menu Config**, opening a meal for editing shows an old/reno name. Reported case: **W2 · Tue · Lunch** panel reads `Fully Loaded Sausage on a Bun, Side Salad` (reno); the correct standard dish is `Halal Beef Burger, Chickpea Salad`. The panel (`openMealEdit`, `index.html:13901`) is faithful — it reads `getMenuData()[wk][day][period]`, the same source as the grid. **DOOR's *active* menu is contaminated**, not the edit panel.

## 2. Root cause (corrected — it is TWO layers, not one)

`getMenuData()` (`index.html:14271`) = `mergeDoorMenuDataWithOverlay(base, overlay)`; the merge spreads the **overlay last** so it wins per-day (`index.html:14034`). Two layers are dirty:

- **Layer A — the `concMenuBase` / `menu_overlay.json` overlay** (primary): **31 stale "Make Permanent" period-overrides** (a mix of reno + standard names), each carrying the full meal state — `*_flags` (allergens), `*_slots`, `*_altMeals`, `*_softAlt`, `*_mainItem`, etc. (~339 leaf fields). These override the base per-day.
- **Layer B — the `concUploadedMenu` base cache**: today's published `menu_current.json` (v30, exported 2026-07-13 09:31) diverges from baked `MENU_DATA` in ~60 name slots — only ~28 explained by the overlay, ~29 from a divergent uploaded base, ~3 old-v30 holdovers. Because that file has a real `exported` timestamp, the boot seed (`index.html:19231`, `:10094`) has been **writing the contaminated menu into `concUploadedMenu` on every booting device.**

**And the vector that created it is still open:** `makePermanent()` (`index.html:14858`) has **no `isAltMenuActive()` guard** (confirmed: zero references in its body), and the reno **📋 Alt Menu toggle is still live** (`index.html:1714`). `getMenuData()` returns the reno menu when Alt Menu is active (`:14279`). A Make-Permanent performed while Alt Menu was on wrote reno dish names **and reno flags** into the standard overlay — which exactly matches the observed data.

## 3. The FOUR contaminated stores + why it self-heals in the wrong direction

| # | Store | State |
|---|---|---|
| 1 | `concMenuBase` (localStorage) / published `menu_overlay.json` | 31 stale overrides |
| 2 | `concUploadedMenu` (localStorage) | seeded from the contaminated `menu_current.json` |
| 3 | published `menu_current.json` | v30, exported today, reno names + flag regressions baked in |
| 4 | published **`routing_by_meal.json`** | **v31-stamped**, `_components` carry reno dishes (`Fully Loaded Sausage on a Bun`, `Quinoa Cake Wrap`) — HUB reads it for portion links; **no gate catches it because it's stamped v31** |

Four resurrection paths keep it alive (all confirmed): boot pull-merge cloud→local, add-only, never prunes (`index.html:19216`/`:19221-19223`, `:10088`/`:10090-10092`); publish **pre-merge** re-adds cloud-only days before every push (`preMergeOverlayWithCloud` defined `:12003`, called `:12250`, persisted `:12323`); publish **export** bakes `getMenuData()` into `menu_current.json` (`buildMenuJSON` `:11628`); base-cache seed writes the contaminated file into `concUploadedMenu` (`:19231`/`:10094`). A local clear alone cannot win — the cloud files must be corrected directly.

## 4. ⚠ Allergen safety — the sacred constraint (NEW, load-bearing)

The overlay entries carry per-period `*_flags` consumed by `getAnaphConflictRooms` (the red anaphylactic net), `checkResidentMealConflicts`, `computeSections`, `buildRoutingByMealJSON`, and the regenerated `allergens_*` text HUB reads. **A blanket clear to baked `MENU_DATA` silently flips allergen flags `true→false` on multiple slots**, including several whose dish name is *identical* to baked (i.e. plausibly standard-era corrections), e.g.:

- **W1 MON dinner (vegan): `hasSoy` lost** — baked is retired `Jerk Cauliflower` (no soy); live is `Jerk Tofu` (soy). **Confirmed firsthand.**
- Egg dishes losing `hasEgg` (Vegetarian Frittata breakfasts); `hasCoconut` on a Fish/Tofu Curry (a **live anaphylactic-coconut resident**, room 213); `hasGluten` on a stew with GF residents downstream.

**Rule for this whole plan: never publish a strictly weaker flag set for an unchanged dish.** Reconciliation (below) is mandatory, and the anaphylaxis-safe direction is to *union* flags where ambiguous, pending CODEX/Jason verification.

## 5. Downstream is LIVE (corrected)

`conc-kitchen-hub/hub_schedule.json` shows `_menuSource:"live"`. EXPO's `loadMenuFromDOOR` **fetch-and-applies** `menu_current.json` as tier-1 (baked MENU is only its fallback), `refreshMenuIfStale()` re-pulls hourly and re-runs the scheduler, which **auto-publishes `hub_schedule.json` to the live staff board** when a token is present. The clean board today is timing luck (~72 min between the last clean EXPO→HUB publish and the first contaminated DOOR publish). **Any EXPO boot/Generate before the cloud files are cleaned will ingest the reno menu and can push it to the live HUB board.** Hence Phase 0 (emergency cloud fix) comes first, and Jason must not reload/Generate EXPO until it lands.

## 6. Menu truth — RULED, with a required correction

Jason ruled: **standard menu = base-rotation truth**, and the **Jul 14/15 one-time swaps are intentional — preserve them** (they're date-keyed in `meal_swaps.json`, separate from the overlay; a `localStorage.removeItem` + repo-file replacement genuinely never touches `concMealSwaps`). **Both hold — but with one correction:** baked `MENU_DATA` is *not yet* fully the ruled truth — it is behind the ruled **Jerk Tofu** correction. So "baked = truth" only becomes true after baked is patched (or we regenerate from the known-good v31, `git 36b2538`). The reconciled truth for regeneration is **`git 36b2538:menu_current.json` (the last hand-authored v31) merged with baked**, diff-audited.

**Correction to v1 §5 (factual error):** `makePermanent` does **not** leave swaps untouched — it **deletes** the competing next-occurrence swap and adds it to `REVERTED_SWAP_KEYS` (`index.html:14900-14906`; its own dialog says "Any scheduled one-time swap for this slot will be cleared"). Only "Apply New Menu" (`:16021`) leaves swaps alone. **Do-not-touch rule:** do **not** run Make Permanent on W2 Tue lunch or W2 Wed lunch before 2026-07-16, or the Jul 14/15 swaps are destroyed.

## 7. The revised fix

### Phase 0 — EMERGENCY cloud correction (direct repo commit, FIRST)
Because EXPO/HUB are live (§5) and in-app cleanup is blocked by the anti-clobber guard (`ALLOW_SHRINK_PATHS` = only `meal_swaps.json`; a cleaned overlay trips `empty_clobber`/`size_regression` against the 81 KB remote; no `_ghForceOverwrite` setter — `index.html:12086`,`:12106-12120`), the cloud files are fixed by a **direct commit to the repo**, not a Publish:
1. **`menu_current.json`** → restore/regenerate the clean standard menu **reconciled** (Jerk Tofu + soy present; full 60-slot name delta and the allergen `true→false` delta enumerated for Jason sign-off — see §4/§8). Carry a **fresh `_meta.exported` strictly newer than `2026-07-13T09:31:32.311Z`** (else contaminated devices never re-seed — the boot seed only overwrites when `fileTs > localTs`, and the known-good v31 file has `exported:null`). Set `_meta.version` per §8. Preserve/refresh the `_meta.manualEdits` breadcrumbs.
2. **`menu_overlay.json`** → replace with a **non-empty** minimal overlay `{"_meta":{…}}` (keep the consumer-free `plainVegStirfryComponents`), plus a cutover marker (Phase 2). Never `{}` (would trip `empty_clobber` on every future publish → permanent "Partial publish" red).
3. **`routing_by_meal.json`** → regenerate clean (from the reconciled menu + live registry via a clean-tab Publish, or restore `git 36b2538` and document the stale-registry-count caveat). Must not contain reno `_components` names.
4. **Archive the outgoing dirty overlay** first (it's in git at `97338c0`, but note it explicitly) so discarded flags/`softAlt`/`altMeals` accommodations are recoverable/reviewable.

### Phase 1 — Reconcile the baked source of truth
1. Patch baked `MENU_DATA` W1 MON `dinner_veg` → `Jerk Tofu, …`, `dinner_flags.hasSoy = true` (allergens regenerate from flags on export). Then "baked = truth" is actually true.
2. Produce the **audit table**: for each of the 31 overlay entries, diff name + every `*_flag` against **both** baked and `git 36b2538`; classify each slot as (a) stale contamination, (b) legit standard-era correction to keep, or (c) needs-CODEX. This is a plan deliverable Jason signs — not a post-hoc "re-add what's wanted."
3. In the live DOOR tab: `localStorage.removeItem('concMenuBase')`, `removeItem('concUploadedMenu')` (+ `concUploadedMenuTimestamp`), **and** inspect/clear stale `concMenuEdits` (a third, device-local edit layer, `index.html:16058`, that survives the other clears and contaminates the daily plating view).

### Phase 2 — Harden the code (land in the SAME deploy as Phase 0/1)
1. **Close the vector:** block (or hard-warn) `makePermanent()` and Edit-Menu overlay saves while `isAltMenuActive()` — or retire the Alt Menu toggle now that reno is dead.
2. **Cutover marker, not a one-shot flag:** stamp the cleaned overlay with `_meta.standardCutover` (an epoch). Make **every merge path** (`bootRemoteState`, daily sync, `doorMergeMenuOverlayWithCloud`) and a **standing** boot sweep drop/ignore any overlay day-entry lacking the current marker — so re-introduced contamination self-heals regardless of ordering or stale tabs. (A one-shot `concMenuOverlayCutoverV1` flag burns while the cloud is still dirty and never re-runs — do not use it. Note: "teach the merge to honor an *empty* published overlay" is a **no-op** as written — empty cloud already merges nothing; the marker is what does the work.) Skip the `_meta` key in the week-iterating merges.
3. **Version:** point `buildMenuJSON` at `DOOR_SCHEMA_VERSIONS.menu_current` instead of the `version:30` literal (`index.html:11643`), matching `buildRoutingByMealJSON` (`:11761`) so the literal/mirror/file triple can't drift again. Decide 31 vs 32 (§8). **Do NOT touch `buildStateJSON`/`buildRegistrySummaryJSON`** — their `30` correctly matches their mirrors; bumping them re-breaks smoke test #18.
4. *(Optional)* stamp new overlay entries with a written-at timestamp; add the stale-tab guard to `sidePublish` (`:13996`); edit-panel provenance ("override of standard: X" + "revert to standard").

### Phase 3 — Verify (the suite is currently RED → must go GREEN)
- `node --test tests/*.mjs` (**59 tests, currently 58/59** — #18 fails `31 !== 30`). The regenerated v31 file + version fix **turns #18 green** — an acceptance criterion, not "stays green."
- **Allergen-flag delta gate:** enumerate every slot where a flag goes `true→false` in the regenerated file vs the pre-clear published file; require zero unreviewed weakenings for unchanged dishes.
- **Content parity gate:** diff the regenerated menu against `git 36b2538` and require byte-equality except enumerated ruled deltas (Jerk Tofu, etc.).
- **Routing check:** no reno names in any `_components` (grep `Fully Loaded Sausage on a Bun`, `Coronation Chicken Salad Sandwich`, `Quinoa Cake Wrap`).
- **Seeded-contaminated-profile test** (not just fresh browser — that passes vacuously): seed `concUploadedMenu` + old timestamp, confirm the fresh `exported` re-seeds it clean.
- **Downstream:** force an EXPO menu refresh on Jason's tab, Generate, confirm HUB `hub_schedule.json` has standard dishes (grep for reno names) and no contaminated schedule was auto-published in the interim.
- **Full-green publish:** a real Publish reports no skipped paths (guards against the `{}`-overlay `empty_clobber` trap).

## 8. Decisions for Jason
1. **Reconcile source:** regenerate from **`git 36b2538` + baked patch** (recommended), vs patch baked only. Either way, sign the **31-entry audit table** and the **allergen `true→false` delta list** before Phase 0 publishes.
2. **Version number:** reuse **31** (gate-safe, matches the existing mirror) vs **32** (cleaner — avoids two different "v31" contents in git history; requires bumping `DOOR_SCHEMA_VERSIONS.menu_current` in lockstep).
3. **Alt Menu toggle:** guard Make-Permanent/Edit-Menu while active (minimal) vs **retire the toggle outright** (recommended — reno is dead).

## 9. Risk / rollback / do-not-touch
- **Do-not-touch:** `meal_swaps.json` / `concMealSwaps` (the Jul 14/15 swaps — intentional, keep). And **no Make Permanent on W2 Tue/Wed lunch before 2026-07-16** (§6).
- **Backout:** the dirty overlay is at `git 97338c0`; the last-good v31 menu at `git 36b2538`; revert the Phase-0 JSON commits to restore. EXPO/HUB fall back to their last-good caches (`pp_door_menu_cache`) on a bad pull.
- **Multi-site:** `concMenuBase`/`concUploadedMenu` are site-blind singletons; the clear is global — perform any Publish with **site = rexdale** selected (operationally the only site today).
- **Data-loss:** the clear discards curated `*_softAlt`/`*_altMeals` resident accommodations (e.g. "No Mushroom" soft alts) — inventory them from the archived overlay before deciding what to re-apply.
- **Stale tabs:** after the deploy, reload every open DOOR tab/device (an old-code tab keeps auto-publishing the 81 KB dirty overlay — a size *increase*, not blocked by the shrink guard).
- **Docs:** update DOOR `CLAUDE.md` — its footgun paragraph is now stale in the *opposite* direction (baked `MENU_DATA` *is* now authoritative; the checked-in file is the contaminated v30). Record the 2026-07-13 clobber incident.

## 10. File/line index (corrected)
| Concern | Location |
|---|---|
| Baked standard menu | `index.html:4946` (`MENU_DATA`) — **behind ruled Jerk Tofu** |
| Menu resolution (base + overlay, overlay wins) | `:14271` (`getMenuData`), `:14023`/`:14034` (`mergeDoorMenuDataWithOverlay`) |
| Meal-edit panel title | `:13901` (`openMealEdit`) |
| Make Permanent (writes overlay; **deletes swaps**; **no Alt-Menu guard**) | `:14858`; swap delete `:14900-14906` |
| Alt Menu toggle (still live — the vector) | `:1714`, `:14180` (`isAltMenuActive`), `:14279` (getMenuData alt branch) |
| Overlay merges (cloud→local, add-only) | boot `:19216`/`:19221-19223`; daily sync `:10088`/`:10090-10092`; `doorMergeMenuOverlayWithCloud` **def `:12003`** |
| Publish pre-merge (resurrects cloud overlay) | `preMergeOverlayWithCloud` `:12157`, called `:12250`, persisted `:12323` |
| Publish export (bakes overlay in) + version literal | `:11628` (`buildMenuJSON`), `version:30` `:11643` |
| Base cache seed from file (needs fresh `exported`) | `:19231`/`:10094`; `exported:null` footgun realized |
| Anti-clobber guard (blocks in-app cleanup) | `ALLOW_SHRINK_PATHS` `:12086`; `empty_clobber`/`size_regression` `:12106-12120`; no `_ghForceOverwrite` setter `:12085` |
| routing_by_meal (4th contaminated store) | `buildRoutingByMealJSON` `:11678`, uses `DOOR_SCHEMA_VERSIONS.routing_by_meal` `:11761` |
| Schema mirror / smoke gate #18 | `DOOR_SCHEMA_VERSIONS` `:697`; test `tests/door-smoke.mjs:1089` |
| Third edit layer (device-local) | `concMenuEdits` `:16058`, applied in `getMealForDate` |

## 11. Fable review appendix
**Verdict: REVISE** (6 independent Fable-model lenses, all REVISE; the adversarial verify + synthesis passes were cut off by session limits, but every P1 was cross-corroborated by 3–5 lenses and re-confirmed firsthand here).

**Confirmed strengths (do not churn):** the overlay-wins mechanism; all four resurrection paths + their citations; `openMealEdit` reads `getMenuData`; exactly 31 overlay name-overrides; the Jul 14/15 swaps are date-keyed and genuinely flip Tue/Wed; the blanket-clear-preserves-swaps *conclusion* (only its `makePermanent` citation was wrong); the empty-overlay `{"_meta":{}}` shape is structurally safe; clearing `concUploadedMenu` has no resident/registry coupling; the §10 index is accurate (2 line-refs corrected above).

**Surviving findings folded into v2:** P1 — Jerk Tofu/soy regression (5 lenses) · allergen `true→false` under-flag (3) · EXPO/HUB live blast radius + inverted sequencing (4) · `routing_by_meal.json` 4th store (5) · in-app cleanup impossible / `{}` trap (2). P2 — `makePermanent` swap-delete factual error (6) · recurrence machinery unworkable / marker-not-flag (4) · open Alt-Menu vector (1, but decisive) · two-layer base contamination + `exported:null` (2) · version scope/freshness semantics (4) · softAlt/altMeals data-loss + no rollback (2). P3 — whole-period-group deletion · `concMenuEdits` third layer · `manualEdits` provenance · CLAUDE.md footgun inversion · multi-site note · version 31-vs-32.
