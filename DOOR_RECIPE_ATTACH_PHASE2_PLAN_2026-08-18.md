# Recipe-attach Phase 2 — recipeId store/publish + rename survival (plan) — 2026-08-18

Phase 1 (PR #84, merged) un-welds a slot's display text from its bound recipe, binding by **`recipeName`**. Phase 2 records the recipe's **`recipeId`** on the slot and publishes it, so a downstream consumer (HUB) can build an exact deep-link — and, when a rename eventually causes pain, makes the binding survive it.

## STATUS (2026-08-18)
- **P2.1 (store) + P2.3 (publish) — SHIPPED** (commit `4aa028b`, PR #85). Bind stores `recipeId`; the snapshot carries it; `buildMenuJSON` publishes it in `_slots`. Allergen-neutral + byte-neutral (0/111 committed slots carry an id). Gate `tests/recipe_attach_p2_recipeid_gate.mjs` 6/6; door-smoke 150/150.
- **P2.2 (self-heal on rename) — DEFERRED** to the forwarding-address approach (§0a), pending a real rename causing pain.

## 0. ⚠ Recon correction — recipeId is a live name-slug, NOT a stable identity today
The original premise of this plan ("the id is stable across renames") is **false as the feed stands**:
- **The feed carries `recipeId` on all 240 live recipes**, unique, format = a name-slug (`adobo-pork-chicken-tofu-…`), computed **fresh every publish** as `recipeId = _cxSlug(_cxCanonicalName(recipeName))`.
- **CODEX *can* lock an id** (`keepLocked ? existing.recipeId : proposedId`; "a frozen recipeId never re-slugs"), **but NO feed recipe is frozen** — 0 recipes carry `recipeIdentity`/`lockedAt` in the data. So a real rename **re-slugs the id**, and binding by id gives **zero rename-survival today**. Binding by id is no *worse* than by name (both break on rename), and it is strictly *better* for the deep-link use it already serves.
- **Today a rename orphans the binding on re-edit** regardless of id: the slot's saved `{recipeName}` is restored as-is, and `slotSelect`/`slotAutoSave` look the recipe up **by name** — and the freshly-published id no longer matches the saved id either. The saved `_flags` are unchanged, so it is **not a live allergen bug** — the recognition breaks.
- **⚠ The DOOR baked fallback (`DOOR_RECIPE_DATA_FALLBACK`) carries 0 recipeIds.** Offline / feed-unreachable, id resolution can't work → any id resolution MUST be dual-key: recipeId first, `recipeName` fallback.

### 0a. The durable rename-survival path (deferred) — publish `previousNames`, not a curated id lock
CODEX **already tracks `previousNames`** (its rename engine stamps it; saves carry it; search indexes it; deep-links resolve through it). The self-maintaining fix is to **publish `previousNames` in the DOOR feed** (~1 line in `projectRecipeForDoor` + a re-bless cycle). Then a slot bound to an old id/slug still resolves after a rename — **keeping the human-readable name-slug and requiring zero curated identity map** (which is the balance Jason ruled for: facilitate work, don't require machine intervention to maintain). This is preferred over locking CODEX ids (a curation burden that fights the self-maintaining slug). **Deferred until a real rename causes pain** — the store/publish sliver already lays the groundwork (the id travels), and no rename-survival is worth building speculatively.

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

## 2. ⚠ The one real food-safety fork — does a rename-heal touch `_flags`? (applies to DEFERRED P2.2 only)
When a recipe is renamed, its **allergens might also have changed** (a rename can accompany a content edit). The slot's saved `_flags` predate the change. Two options:
- **(a) name-only heal, flags untouched (leans SAFER-by-least-surprise + consistent with today).** Keep the operator's saved `_flags` (F-C: the operator's statement is authority; the anaphylactic net reads the saved `_flags`). Rationale: **DOOR already never auto-refreshes flags when a bound recipe's allergens change in CODEX** — flags are set at bind time and saved; a name-heal doesn't make this worse, it just preserves recognition. Surfacing the rename lets the operator re-bind to refresh if they wish. No silent flag change at load.
- **(b) name heal + re-derive flags as a FLOOR (leans anaphylaxis-conservative).** On heal, `mergeVegAltAllergenFloor`-style union: the renamed recipe's flags may only **ADD** to the slot's flags, never remove one (operator overrides survive). Catches "rename added coconut." But it changes `_flags` at silent load — so it MUST be surfaced, and it can still not catch a rename that *removed* an allergen (floor never removes — correct: never under-flag). This is the stronger food-safety posture but the more surprising behavior.

**Recommendation: (a) for the first slice** — it's the least-surprising, is consistent with DOOR's existing "flags are set at bind, not live-refreshed" model, and never silently mutates `_flags` at load; the rename is surfaced so the operator can consciously re-bind. **(b) is a follow-up** if soak shows renames commonly carry allergen changes. Either way the heal is **surfaced, never silent**, and **never removes an operator flag**. Fork for Jason.

## 3. Slices (each authored-to-fail gated + adversarially reviewed)
- **P2.1 — bind stores the id — ✅ SHIPPED (`4aa028b`, PR #85).** `slotSelect`/`slotAutoSave` set `next.recipeId` when the matched feed recipe carries one (additive; a fallback recipe without an id sets nothing); `_buildSlotSnapshot`/`_restoreSlotSnapshot` carry it (byte-neutral for phase-1 slots with no id). Gate: bind stores id; a no-id recipe adds no key; snapshot persists + round-trips it; a phase-1 slot serializes byte-identically. **No behavior change** beyond storing the id.
- **P2.3 — publish recipeId in `_slots` — ✅ SHIPPED (`4aa028b`, PR #85).** Additive via `buildMenuJSON`'s verbatim `_slots` copy; gated: exported `_slots` carry `recipeId` when bound; `allergens_<meal>`/`_flags` byte-identical with/without the id; 0/111 committed slots carry one (opt-in). EXPO ignores `_slots`; HUB is the future consumer.
- **P2.2 — rename survival — ⛔ DEFERRED (→ §0a forwarding-address).** The self-heal-by-id design in this plan's earlier draft is **inert today** (ids re-slug on rename — §0). The durable path is CODEX publishing `previousNames` so an old id/slug still resolves; DOOR then resolves dual-key (id → previous-slug → name). Build it when a real rename causes pain — not speculatively.
- **P2.4 (optional, separate — data) — re-bake `DOOR_RECIPE_DATA_FALLBACK` with recipeIds** so offline binding carries ids too. Deferred; the id-less fallback is harmless (the store slice adds no key when no id is available).

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
