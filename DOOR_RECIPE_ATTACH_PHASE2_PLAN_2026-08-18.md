# Recipe-attach Phase 2 — recipeId-based binding (plan) — 2026-08-18

Phase 1 (PR #84, merged) un-welds a slot's display text from its bound recipe, binding by **`recipeName`**. Phase 2 makes the binding survive a **CODEX recipe rename** by also keying on the stable **`recipeId`**.

## 0. Why / the mechanism established by recon
- **The feed carries `recipeId` on all 240 live recipes**, unique, format = a name-slug (`adobo-pork-chicken-tofu-…`).
- **The id is STABLE across renames for frozen recipes.** CODEX's identity lifecycle locks it: `conc-recipe-hub/index.html:24623` "a frozen (approved/pending_review) recipeId never re-slugs"; `:28870` `keepLocked ? existing.recipeId : proposedId`. So a rename of a locked recipe keeps its id — binding by id is genuinely more robust than by name. (An un-frozen recipe's id may still re-slug; binding by id is then no worse than by name, and the name-fallback covers it.)
- **Today a rename orphans the binding on re-edit:** the slot's saved `{recipeName}` is restored as-is (`_restoreSlotSnapshot`), and `slotSelect`/`slotAutoSave` look the recipe up **by name only** (`DOOR_RECIPE_DATA.find(r => r.recipeName === …)`, `:17803/:17903`). After a CODEX rename, the name no longer matches → the slot reads as unlinked / the operator loses the link. The saved `_flags` are unchanged, so it is **not a live allergen bug** — but the binding recognition breaks.
- **⚠ The DOOR baked fallback (`DOOR_RECIPE_DATA_FALLBACK`) carries 0 recipeIds** (0/131). Offline / feed-unreachable, id resolution can't work → **resolution MUST be dual-key: recipeId first, `recipeName` fallback.** (Re-baking the fallback with ids is a separate optional data slice — see P2.4.)

## 1. Design — dual-key resolution + name self-heal
Slot value gains an optional `recipeId`:
| Shape | Meaning |
|---|---|
| `{recipeName, flags}` / `{recipeName, displayText, flags}` | phase-1 bound (no id) — **back-compat, unchanged** |
| `{recipeName, recipeId, flags}` / `+displayText` | phase-2 bound — id + name both stored |

- **Bind stores the id.** `slotSelect`/`slotAutoSave` set `next.recipeId = recipe.recipeId` when the matched feed recipe carries one (additive; a fallback recipe without an id just doesn't set it).
- **One pure resolver** `_resolveSlotRecipe(slot, feed)` → `{recipe, healedName}`:
  1. If `slot.recipeId` and a feed recipe has that id → return it (this **survives a rename**). If its `recipeName` differs from `slot.recipeName`, report `healedName = feed.recipeName`.
  2. Else resolve by `slot.recipeName` (phase-1 path; works with the id-less baked fallback).
  3. Else `{recipe: null}` (genuinely unresolvable — e.g. recipe deleted from the feed).
  recipeId wins over name (the stable identity); a recipeId maps to exactly one recipe (unique + locked).
- **Self-heal on open/restore:** when restoring a bound slot, run the resolver; if `healedName`, update the slot's `recipeName` to the current feed name so the binding stays recognized. **Surface it** (not silent) — a Menu-Config banner: "Recipe renamed in CODEX: 'Old' → 'New' (binding kept)."
- **Publish the id** additively in `_slots` (for HUB phase-2 exact deep-links). EXPO ignores `_slots`; no consumer change required.

## 2. ⚠ The one real food-safety fork — does a rename-heal touch `_flags`?
When a recipe is renamed, its **allergens might also have changed** (a rename can accompany a content edit). The slot's saved `_flags` predate the change. Two options:
- **(a) name-only heal, flags untouched (leans SAFER-by-least-surprise + consistent with today).** Keep the operator's saved `_flags` (F-C: the operator's statement is authority; the anaphylactic net reads the saved `_flags`). Rationale: **DOOR already never auto-refreshes flags when a bound recipe's allergens change in CODEX** — flags are set at bind time and saved; a name-heal doesn't make this worse, it just preserves recognition. Surfacing the rename lets the operator re-bind to refresh if they wish. No silent flag change at load.
- **(b) name heal + re-derive flags as a FLOOR (leans anaphylaxis-conservative).** On heal, `mergeVegAltAllergenFloor`-style union: the renamed recipe's flags may only **ADD** to the slot's flags, never remove one (operator overrides survive). Catches "rename added coconut." But it changes `_flags` at silent load — so it MUST be surfaced, and it can still not catch a rename that *removed* an allergen (floor never removes — correct: never under-flag). This is the stronger food-safety posture but the more surprising behavior.

**Recommendation: (a) for the first slice** — it's the least-surprising, is consistent with DOOR's existing "flags are set at bind, not live-refreshed" model, and never silently mutates `_flags` at load; the rename is surfaced so the operator can consciously re-bind. **(b) is a follow-up** if soak shows renames commonly carry allergen changes. Either way the heal is **surfaced, never silent**, and **never removes an operator flag**. Fork for Jason.

## 3. Slices (each authored-to-fail gated + adversarially reviewed)
- **P2.1 — data model + resolver + bind stores id.** `_resolveSlotRecipe` (pure, dual-key, heal-reporting); `slotSelect`/`slotAutoSave` store `recipeId`; `_buildSlotSnapshot`/`_restoreSlotSnapshot` carry it (additive — byte-neutral for phase-1 slots with no id). Gate: bind stores id; resolver finds by id after a rename; name-fallback when no id (baked fallback); recipeId wins over a name collision. **No behavior change yet** beyond storing the id.
- **P2.2 — self-heal on open + surface.** Apply the resolver on restore; heal `recipeName` on a rename; a Menu-Config banner names the rename. **Flags untouched (fork (a)).** Gate: a renamed feed recipe heals the slot name + surfaces the banner; `_flags` unchanged; a deleted recipe (no id, no name) surfaces an "unresolved binding" note, not a silent drop.
- **P2.3 — publish recipeId in `_slots`.** Additive; gate: exported `_slots` carry `recipeId` when bound; `allergens_<meal>`/`_flags` byte-neutral; EXPO/HUB unaffected.
- **P2.4 (optional, separate — data) — re-bake `DOOR_RECIPE_DATA_FALLBACK` with recipeIds** so offline binding survives renames too. Deferred; the dual-key name-fallback keeps offline working meanwhile.

## 4. Food-safety guards (gated)
1. **Heal never removes an allergen flag** — name-only (fork a) touches no flag; if (b) is chosen it's a floor (add-only).
2. **Heal is never silent** — every rename-heal surfaces a banner naming old→new.
3. **recipeId resolution never mis-binds** — id is unique + locked; a matched id is THE recipe; a name collision loses to the id.
4. **Byte-neutral / opt-in** — phase-1 slots (no id) resolve exactly as today; `menu_current.json` unchanged until a slot is (re)bound under phase 2.

## 5. Do-not-touch
- The anaphylactic net (`getAnaphConflictRooms`, reads `_flags`), the veg-alt floor, the meat two-site union — unchanged.
- CODEX owns allergen data + the recipeId lifecycle — DOOR reads ids, never mints or re-slugs them.
- The publish path / Gate-9 / `_meta.builtFromMenu` — unchanged (recipeId in `_slots` is additive).

## 6. Cross-app
- **CODEX contract:** DOOR relies on recipeId being stable-once-locked (verified in the lifecycle). If CODEX ever re-slugs a locked id, DOOR's name-fallback still resolves — no hard failure.
- **HUB (phase-2 consumer, separate):** the published `_slots.recipeId` lets HUB build an exact `?recipe=` deep-link instead of its fuzzy display-text guess.
- **EXPO:** ignores `_slots` — unaffected.
