# Plan of Action — Menu Config shows baked reno meal names instead of the standard menu

**Date:** 2026-07-13
**Branch:** `claude/meal-names-edit-accuracy-rh36nx`
**Status:** PLAN ONLY — no code or data changed yet. Overlay-cleanup strategy ruled by Jason: **blanket clear to standard**. One menu-truth confirmation still pending (see §5).

---

## 1. Symptom (from the screenshot)

On the **Menu Config** screen, opening a meal for editing shows an old/reno meal name, not the current standard menu name. Example in the screenshot:

- Panel header for **Week 2 · Tuesday · Lunch** reads **`Fully Loaded Sausage on a Bun, Side Salad`** (a reno-era dish).
- The correct standard dish for that slot is **`Halal Beef Burger, Chickpea Salad`**.

The same wrong base names appear in the grid (masked on Tue/Wed only because active day-swaps are covering them).

This is **not a bug in the meal-edit panel**. `openMealEdit()` (`index.html:13901`) reads the title from `getMenuData()[week][day][period]` — exactly the same source the grid uses. The panel is faithfully showing DOOR's *active* menu. **The active menu itself is contaminated.**

## 2. Root cause

DOOR's built-in standard menu is **correct**. The baked `MENU_DATA` constant (`index.html:4946`) has, for the affected slots:

| Slot | Baked `MENU_DATA` (correct standard) |
|---|---|
| W2 Tue lunch | `Halal Beef Burger, Chickpea Salad` |
| W2 Wed lunch | `Fried Chicken and Sweet Potato Biscuit, Seasonal Vegetables` |
| W1 Mon lunch | `Fully Loaded Sausage, Side Salad` |

But `getMenuData()` (`index.html:14271`) returns `mergeDoorMenuDataWithOverlay(base, overlay)`, and the merge **spreads the overlay last** (`index.html:14034`):

```js
out[wk][day] = { ...(bwk[day] || {}), ...(ov[day] || {}) };  // overlay wins
```

The overlay is `concMenuBase` in localStorage (published as `menu_overlay.json`). It currently holds **31 stale "Make Permanent" overrides** accumulated over time — a mix of reno-era and standard names — and they override the correct baked menu:

```
W1 SUN dinner : Beef Stroganoff, Noodles
W1 MON dinner : Jerk Chicken, Rice and Beans, Cabbage Stirfry
W1 TUE lunch  : Beef Nachos Supreme & Tortilla Chips & Sour Cream
W1 TUE dinner : Pork Carnitas, Spanish Rice and Vegetables, Broccoli
W2 SUN lunch  : Philly Cheese Melt, Chips,  Fruit
W2 TUE lunch  : Fully Loaded Sausage on a Bun, Side Salad   ← the reported slot
W2 WED lunch  : Coronation Chicken Salad Sandwich, Fruit
...31 total across all 4 weeks
```

**Evidence chain:** the panel base for W2 Tue lunch (`Fully Loaded Sausage on a Bun, Side Salad`) is byte-identical to `menu_overlay.json`'s W2 Tue lunch value, and the *un-overlaid* slots (e.g. W2 Thu/Sat lunch) match the baked standard. So the overlay is the sole contaminant of the affected slots.

The user's phrase "baked reno meals" is close but slightly off: the reno names are **not** in the baked `MENU_DATA` (that's standard now) — they live in the **overlay**, which persists and overrides the baked menu.

## 3. Why it's sticky — the four self-reinforcing paths

Clearing localStorage alone will NOT fix this. The reno names round-trip through the cloud files and resurrect themselves via four mechanisms:

1. **Boot pull merges cloud → local, never prunes.** `bootRemoteState()` fetches `menu_overlay.json` and `Object.assign`-merges it into `concMenuBase` (`index.html:19216`); the daily-sync path does the same (`index.html:10088`). A local clear is re-polluted on the next boot.
2. **Publish pre-merge resurrects the cloud overlay.** Before every publish, `preMergeOverlayWithCloud()` (`index.html:12157`, called at `:12250`) fetches the cloud `menu_overlay.json` and merges its day-entries back into the local overlay. So "clear local + Publish" re-adds the stale entries.
3. **Publish bakes the overlay into the canonical file.** `buildMenuJSON()` (`index.html:11622`, `:11628`) exports `getMenuData()` (base **+ overlay**) into `menu_current.json`. The file is currently **version 30, exported 2026-07-13 09:31** — a republish that baked the reno names into the file EXPO/HUB consume.
4. **Boot seeds the base cache from the canonical file.** `bootRemoteState()` writes `concUploadedMenu` from `menu_current.json` when the file is newer (`index.html:19231`, `:10094`). So the contaminated base gets cached too.

Net: three contaminated stores (`concMenuBase` overlay, published `menu_overlay.json`, published `menu_current.json`) reinforce each other. A durable fix must clean the **cloud files directly** and teach the merge paths to prune.

## 4. Downstream impact

`menu_current.json` is DOOR's published contract, consumed by **EXPO** (`loadMenuFromDOOR`) and, transitively, **HUB**. A contaminated republish feeds reno names down the whole HOUSE pipeline. (EXPO's live board currently runs off its own baked standard menu, so the operational blast radius is limited today — but DOOR's published menu is wrong and will mislead any consumer that trusts it.)

## 5. Decision needed from Jason (menu truth)

Once the overlay is cleared, the base shows the **built-in standard**:

- **W2 Tue lunch → `Halal Beef Burger, Chickpea Salad`**
- **W2 Wed lunch → `Fried Chicken and Sweet Potato Biscuit, Seasonal Vegetables`**

The two **active day-swaps** in the screenshot set the **opposite**:

- Jul 14 (W2 Tue) → `Fried Chicken and Sweet Potato Biscuit`
- Jul 15 (W2 Wed) → `Halal Beef Burger, Chickpea Salad`

**Confirm which is correct** (is the built-in standard menu the source of truth, or should Tue/Wed be flipped?) before the cleanup runs, so we don't "fix" the base to the wrong dish. The two swaps also become redundant once the base is right — review/revert them.

## 6. The fix (decision: blanket clear to standard)

### Phase 1 — Clean the cloud + local data (stops the bleeding, durable)
Because of the four resurrection paths (§3), the cloud files must be corrected directly:

1. **`menu_overlay.json`** → replace with an empty overlay (`{"_meta": {...}}`, no week keys). The built-in standard `MENU_DATA` becomes authoritative for every slot.
2. **`menu_current.json`** → regenerate from the clean standard base (empty overlay), bump `_meta.version` to 31.
3. In the live DOOR tab: `localStorage.removeItem('concMenuBase')` and `localStorage.removeItem('concUploadedMenu')` (+ `concUploadedMenuTimestamp`), then reload so `getMenuData()` falls back to the baked standard, and re-Publish to confirm the round-trip is clean.

> Sequencing matters: don't Publish from a tab whose local overlay is still dirty (Phase 2 must land first, or Phase 1's cloud edits will be re-merged by `preMergeOverlayWithCloud`). Safest order is **Phase 2 → Phase 1**, or do Phase 1's cloud edits as a direct repo commit and only Publish after Phase 2 ships.

### Phase 2 — Harden the code (prevents recurrence)
1. **One-shot cutover reconcile sweep on boot.** Mirror the existing `runAltFlagSweepOnce()` pattern (`index.html:14097`), gated by a new `concMenuOverlayCutoverV1` flag. On first boot after the fix ships, drop overlay meal-name entries the standard base supersedes (blanket clear, per the ruling). Idempotent; runs once per device.
2. **Prune on sync, don't only accumulate.** `bootRemoteState()` (`:19222`) and the daily sync (`:10091`) `Object.assign`-merge cloud entries and never remove. Teach them (and `doorMergeMenuOverlayWithCloud` used by `preMergeOverlayWithCloud`, `:12170`) to honor a cleaned/empty published overlay instead of resurrecting old day-entries.
3. **Bump `buildMenuJSON` version.** `version:30` (`index.html:11643`) is stale vs. the documented v31 (and `buildStateJSON`/`buildRegistrySummaryJSON` also hardcode 30). Bump so the canonical file version increments and freshness/cache-busting works.
4. *(Optional UX)* Show provenance in the meal-edit panel — e.g. "override of standard: *Halal Beef Burger*" with a one-click **Revert to standard** — so a stale/unexpected override is visible and removable at the point of editing.

### Phase 3 — Verify
- `node --test tests/*.mjs` (door-smoke, ~55 tests) stays green.
- `getMenuData()` returns the baked standard for the affected slots (W2 Tue = Halal Beef Burger, etc.).
- A fresh Publish produces a clean `menu_current.json` (v31) and `menu_overlay.json` (empty), and a fresh-browser boot resolves to the standard menu.
- EXPO `loadMenuFromDOOR` pulls the clean menu; HUB unaffected.

## 7. Risk / scope notes
- Phase 1 and the republish touch JSON consumed by EXPO/HUB — deliberate, verified edits only; door-smoke Gate-9 structural validation must pass.
- Blanket-clearing the overlay discards **all 31** current overrides. Any that were genuine, still-wanted standard-era permanent edits must be **re-applied via Make Permanent** afterward. (Per the ruling, standard `MENU_DATA` is authoritative; re-add only what's actually still wanted.)
- Active Jul 14/15 swaps become redundant once the base is correct — review/revert.

## 8. File/line index (for the implementer)
| Concern | Location |
|---|---|
| Baked standard menu | `index.html:4946` (`MENU_DATA`) |
| Menu resolution (base + overlay) | `index.html:14271` (`getMenuData`), `:14023` (`mergeDoorMenuDataWithOverlay`) |
| Overlay read/write | `:13989` (`loadMenuBaseOverlay`), `:13992` (`saveMenuBaseOverlay`) |
| Meal-edit panel title | `:13901` (`openMealEdit`) |
| Make Permanent (writes overlay) | `:14858` (`makePermanent`), `:15271` (`makeSwapPermanentFromBanner`) |
| Boot pull merge (cloud→local) | `:19216`, `:10088` |
| Publish pre-merge (resurrects cloud overlay) | `:12157` (`preMergeOverlayWithCloud`), called `:12250` |
| Publish export (bakes overlay into file) | `:11622` (`buildMenuJSON`), version literal `:11643` |
| Base cache seed from file | `:19231`, `:10094` |
| Reset lever (upload flow clears overlay) | `:16040` (`saveMenuBaseOverlay({})`) |
| Existing one-shot sweep pattern to mirror | `:14097` (`runAltFlagSweepOnce`) |
