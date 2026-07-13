# Plan of Action — Menu Config shows old/reno meal names instead of the imported menu

**Date:** 2026-07-13 · **Branch:** `claude/meal-names-edit-accuracy-rh36nx` · **Status:** PLAN ONLY (no code/data changed).
**Revision:** **v3** — rewritten after reconciling against Jason's canonical import (`4_week_rotationCURRENTMenus_as_of_July_2_2026.xlsx`). This supersedes v2's baked/git-reconstruction approach, which was wrong.

## TL;DR

Jason's **July 2 import is canon.** DOOR's pipeline (import → `menu_current.json` → EXPO → HUB) works — but a **stale `menu_overlay.json` layer sits between the import and the export and overrides 11 slots** with old reno dishes on the way out, and it **resurrects itself from the cloud** on every boot (the sync re-merges it, never prunes). Fix = delete the overlay (it is 100% stale, older than the import), stop it resurrecting, and re-publish from the import. **No baked constant, no old git files, no per-slot rulings needed — the import resolves every slot.**

```
July 2 import → [ stale overlay overrides 11 slots ] → menu_current.json → EXPO → HUB
```

## The exact corruption (verified: every wrong slot IS an overlay entry)

Reconciled the Excel (canon) against the published `menu_current.json`. All 11 wrong slots are overlay overrides — clearing the overlay reverts each to the import:

| Slot | Import (canon) | Published now (= overlay value) |
|---|---|---|
| W2 Tue lunch | Halal Beef Burger, Chickpea Salad | Fully Loaded Sausage on a Bun |
| W2 Wed lunch | Fried Chicken and Sweet Potato Biscuit | Coronation Chicken Salad Sandwich |
| W4 Tue lunch | Pork Tacos Al Pastor, Pea & Carrots | Fully Loaded Sausage on a Bun |
| W4 Wed lunch | Tuna Rex Salad | Coronation Chicken Salad Sandwich |
| W1 Tue lunch | Blackened Fish, Sweet Potatoes | Beef Nachos Supreme |
| W1 Wed lunch | Egg Salad Wrap, Bean Salad | Crispy Chicken Tender Wrap |
| W3 Thu lunch | Beef Nachos Supreme | Chicken Burger, Tomato Cucumber Salad |
| W3 Sat lunch | Roasted Chicken Leg, Pineapple Rice | CONC Salad — Beef… |
| W1 Sun dinner | Beef Strogonoff, Noodles | Beef Stroganoff, Noodles *(overlay fixed the typo)* |
| W3 Sat dinner | Pepperoni Pizza and Seasonal Soup | Pepperoni Pizza, Potato Wedges |
| W4 Tue dinner | BBQ Chicken Leg, Roasted Yam | BBQ Chicken Legs, Herb and Garlic Potatoes |

The overlay carries per-slot `*_flags` too, so clearing it also reverts the **allergen flags** on these slots back to the import's flags (which is the correct direction — the import's flags are the ones Jason's Intake sheets define). This resolves the v2 "Jerk Tofu / soy under-flag" worry: it was based on the false assumption that clearing reverts to the stale *baked constant*; it actually reverts to the *import*.

**Note (Jason's eye):** W4 Tue dinner — import says `Roasted Yam`, overlay says `Herb and Garlic Potatoes`. After clearing it becomes `Roasted Yam` (the import). If Herb & Garlic Potatoes is the real current side, make that edit in DOOR *after* the cleanup; don't preserve it from the stale overlay.

## Why it doesn't self-fix (the resurrection)
The overlay is kept alive by add-only merges that never prune: boot pull (`index.html:19216`/`:19221-19223`, `:10088`/`:10090-10092`), publish pre-merge (`preMergeOverlayWithCloud` `:12157`, called `:12250`, persisted `:12323`), and the export bakes `getMenuData()` (base **+ overlay**) into `menu_current.json` (`buildMenuJSON` `:11628`). And in-app cleanup can't win: the publish anti-clobber guard (`ALLOW_SHRINK_PATHS` = only `meal_swaps.json`, `:12086`; `empty_clobber`/`size_regression` `:12106-12120`) refuses to push a shrunk overlay — so the cloud file must be corrected by a **direct repo commit.**

**The write vector (how the reno data got in):** `makePermanent()` (`:14858`) has **no `isAltMenuActive()` guard**, and the reno "📋 Alt Menu" toggle is still live (`:1714`). A Make-Permanent while Alt Menu was on wrote reno name+flags into the standard overlay. Retiring the toggle closes this.

## The fix

### Rulings (Jason, 2026-07-13)
1. **Canon = the July 2 import** (the `.xlsx`, as parsed into `concUploadedMenu`). Not baked, not git. Every slot's truth is the import.
2. **Version → increment (32).** `buildMenuJSON` reads `DOOR_SCHEMA_VERSIONS.menu_current` instead of its `version:30` literal (`:11643`), bumped to 32 in lockstep, so the literal/mirror/file can't drift again. (`buildStateJSON`/`buildRegistrySummaryJSON` stay at 30 — their mirrors are 30.)
3. **Retire the Alt Menu toggle** (+ the reno-menu paths it drives) — closes the write vector.

### Phase 0 — Emergency cloud correction (direct repo commit, FIRST)
EXPO/HUB are **live** consumers (`hub_schedule.json` `_menuSource:"live"`; EXPO `loadMenuFromDOOR` fetch-applies `menu_current.json` tier-1 and auto-publishes to HUB), so the cloud files are fixed first, by direct commit (the app can't push the shrink):
1. `menu_overlay.json` → replace with a minimal **non-empty** `{"_meta":{…, "standardCutover":<epoch>}}` (never `{}` — that trips `empty_clobber` on every future publish). Keep the consumer-free `plainVegStirfryComponents`.
2. `menu_current.json` → the import with the 11 slots corrected to canon (no overlay), fresh `_meta.exported` strictly newer than `2026-07-13T09:31:32.311Z` (else contaminated devices never re-seed), `version:32`. The safest source is a clean DOOR re-publish (below) rather than a hand-edit.
3. `routing_by_meal.json` → regenerated clean in the same publish (it was contaminated identically — its `_components` carry the reno dishes).

### Phase 1 — Code (same deploy)
- Retire the Alt Menu toggle + guard `makePermanent`/Edit-Menu against writing while any alt source is active (belt).
- Make the overlay merges **prune on the cutover marker**: every merge path (`bootRemoteState`, daily sync, `doorMergeMenuOverlayWithCloud`) and a **standing** boot sweep drop any overlay day-entry that lacks the current `standardCutover` epoch — so a stale device/tab can't re-contaminate (a one-shot flag would burn while the cloud is still dirty — do not use one). Skip the `_meta` key in the week-iterating merges.
- Version fix (ruling 2).

### Phase 2 — Republish from the import + verify
- In a clean DOOR tab (Alt Menu retired, overlay gone): confirm `getMenuData()` == the import for all 11 slots, then Publish → clean `menu_current.json` + `routing_by_meal.json`.
- **Acceptance test = the reconciliation table above:** those 11 slots show the import dishes, zero reno names, and each slot's allergen flags are non-empty and match the import.
- Downstream: force an EXPO menu refresh, Generate, confirm HUB shows the import dishes (grep for `Fully Loaded Sausage`, `Coronation Chicken Salad Sandwich`, `Beef Nachos`).
- `node --test tests/*.mjs` returns to green (test #18 goes green with the v32 file — the suite is currently RED at 58/59 on the contaminated v30 file).

## Do-not-touch / preserve
- **`concUploadedMenu`** — this is Jason's import. **Do NOT clear it** (v2 said to — wrong). Clear only the overlay (`concMenuBase`).
- **`meal_swaps.json` / `concMealSwaps`** — the intentional Jul 14/15 one-time swaps. Keep. And do **not** run Make Permanent on W2 Tue/Wed lunch before 2026-07-16 (`makePermanent` deletes the competing swap, `:14900-14906`).
- Also clear device-local `concMenuEdits` (a third edit layer, `:16058`) if stale — it survives the other clears and skews the daily plating view.

## Rollback / notes
- Dirty overlay preserved at `git 97338c0`; revert the Phase-0 JSON commits to restore. EXPO/HUB fall back to their last-good caches on a bad pull.
- Update DOOR `CLAUDE.md` — its footgun paragraph is stale in the opposite direction now (baked was updated to standard; the checked-in *file* is the contaminated v30). Record the 2026-07-13 clobber + repair.
- `concMenuBase`/`concUploadedMenu` are site-blind singletons; do any Publish with **site = rexdale** selected.

## Appendix — Fable review (6-lens, REVISE) that shaped v2→v3
The review's load-bearing catches, all confirmed firsthand, are folded in: allergen flags ride under the "names" framing (§ table note); EXPO/HUB are live → cloud-first sequencing; `routing_by_meal.json` is a co-contaminated artifact; in-app cleanup is blocked by the anti-clobber guard; the recurrence needs a standing marker not a one-shot flag; `makePermanent` deletes swaps; the open Alt-Menu write vector. v3's simplification (import-is-canon, overlay-is-sole-contaminant) came from reconciling against the actual imported `.xlsx`, which the review could not see.
