# Corn recipe alignment — 2026-10-22

**Release receipt:** PR #140 merged as `912f45d` and deployed 2026-10-22. The cross-app status owner is `~/.claude/CLAUDE.md`. Historical implementation measurements below remain the pre-release audit trail.

Jason authorized CODEX to include Corn and audit both apps, and to remove Teriyaki Chicken Legs' unsupported Sulphites after verifying the source. CODEX owns the recipe labels. Paired receipt: conc-recipe-hub `docs/CODEX_CORN_TERIYAKI_2026-10-22.md`.

## Meal flags

Nine regular/shared/halal plates gain `hasCorn` at the meal level and in their main-slot flags. Each follows the existing regular-plate rule: regular main, shared sides and halal dish are included.

| Meal | Source of Corn |
|---|---|
| W1 Friday dinner | Pork Adobo / halal sauce — Adobo Marinade & Sauce |
| W1 Saturday lunch | Chicken Fajitas' shared Peas and Corn side |
| W2 Wednesday lunch | Oven Fried Chicken coating |
| W2 Friday lunch | Beef CONC Salad Mix |
| W3 Tuesday lunch | Glazed Ham's glaze and shared Garlic Corn and Bean |
| W3 Friday dinner | Chicken and Mushroom Fried Rice |
| W4 Sunday dinner | White Chilli Chicken Pasta Casserole's White Chicken & Chickpea Chili base |
| W4 Monday dinner | Fish Curry's house Vegan Thai Green Curry Sauce, per the earlier sauce ruling |
| W4 Saturday dinner | Beef Massaman Curry with Baby Corn and Vegetables |

The eight **vegan-only** meals keep their regular Corn tick off: W1/W2 Sunday dinner (Vegan Baked Pasta), W2 Tuesday lunch and W4 Monday lunch (Rexdale Falafel), W2 Saturday dinner (Vegan Meatloaf), W3 Sunday dinner (Vegan Meatballs), W4 Wednesday dinner (Vegan Pie Filling), and W4 Friday lunch (Vegan Lasagna Sauce). Their own recipe lookup reads Corn both online and with the refreshed offline fallback.

Existing Corn stays on W2 Friday dinner, W3 Wednesday lunch and W4 Friday dinner. **W4 Thursday dinner keeps its existing Sulphites** on the meal and tofu slot: the Teriyaki recipe's cleared vinegar source does not clear the whole meal's unknown sides. The rowless Soy-Free Mushroom Fried Rice source is unchanged.

## Offline recipe scope

The frozen fixture `tests/fixtures/corn_recipe_alignment_2026-10-22.json` enumerates **43 exact fallback changes**: 42 Corn sources plus Teriyaki, comprising 29 existing records and 14 additions. The fallback grows from **131 to 145**, retaining prior order and every unrelated field/warning. Existing Vegan Baked Pasta's stream changes from `regular` to canonical `vegan`, so name-based lookup reaches it.

Two extra offline family lines are measured and pinned: W2 Sunday vegan dinner gains Nightshades, and W4 Wednesday vegan dinner gains Oats/Sulphites. No other non-Corn plate family changes. The two shared records are Peas and Corn and Thai Green Curry Sauce – Bagged (Fish & Tofu); the latter adds Corn and lime's safe-side Sulphites. The shared-library candidate described here was subsequently delivered; see the verification below.

The original Corn change preserved every byte of DOOR `index.html` outside the fallback literal and release version. The authorized delivery continuation below additionally changes one reader URL and two comments; its gate preserves the original digest by undoing only those exact three lines. `flagsToMenuAllergens` currently omits Corn intentionally, so the generated free-text allergen lines are unchanged. DOOR's existing boolean flag and plate recipe lookup carry the warnings.

## Save, publish and operational preservation

The builder refreshed the owning clones and used the actual app with network writes disabled. Loading the existing menu, overlay, resident state, special meals, swaps and custom rules into the normal builders reproduced the current artifacts before editing. The nine flags were then saved together through `saveMenuBaseOverlay`, with one captured local side-publish, and the four normal publish builders rebuilt the artifacts. No external publish occurred.

- Day edit stamp: `1792681340848` (`2026-10-22T15:02:20.848Z`).
- Menu export: `2026-10-22T15:02:20.851Z`; dependent artifacts use `builtFromMenu.hash: qba9py`.
- The five-file candidate validates **0 Stop / 0 Review / 0 Info**.
- Putting back only the nine meal/main Corn changes recovers all menu and overlay content.
- All non-metadata content in `door_state.json`, `registry_summary.json` and `routing_by_meal.json` is identical to the refreshed starting version. Residents, operational data, counts and component totals are preserved.
- Synthetic No Corn residents keep their existing seats and gain serving warnings; unrelated residents, notes and other plate families stay unchanged. A fresh-tablet sweep retains all nine regular/shared/halal ticks.

## Gates and review handoff

The independent gate/helper/fixture were frozen at `470f691` before implementation: `tests/corn_recipe_alignment_gate.mjs`, `tests/helpers/corn_gate_runtime.mjs`, and the dated fixture. They were red **10/16** before the build and now pass **16/16**, including the paired CODEX source check. None was edited by the builder.

The initial full suite was **539/541**. Two narrow historical tests were corrected with dated comments: `shellfish_families_gate.mjs` now maps the newly approved CODEX Corn family to existing `hasCorn`; `vegan_friendly_gate.mjs` excludes only the literal `DOOR_RECIPE_DATA_FALLBACK` declaration from its executable-reader count. The same five reader sites and their assertions remain required. Focused checks pass **18/18**; final `node --test tests/*.mjs` passes **541/541**, with no skipped tests.

The paired CODEX frozen browser gate passes **72/72** and its source put-back checks prove the exact feed delta. Reproducible shared/operational preservation evidence lives in the task artifact `corn-closeout-proof.mjs` / `.json`. No clinical classification or routing policy is changed in this batch.

## Independent review fold

The food-safety reviewer found the bagged curry sauce's source card and retained intake receipt explicitly name `Nightshades + Spicy (Jalapeño in paste)`. Its shared and offline lists now also carry `Nightshades (Green Curry Paste — Jalapeño)`, preserving all eight labels in the Corn candidate, all other fields and the existing recipe ID. The shared record's save/publication metadata and content fingerprint were recomputed through CODEX's existing helpers.

The original Corn manifest remains byte-identical. `tests/helpers/bagged_curry_nightshades_review.mjs` is a separately enumerated extension to exactly three expected lists; `tests/bagged_curry_nightshades_gate.mjs` pins the original manifest, source evidence, exact fallback/overlay and all 84 current meal outputs. The combined checks failed 19/22 before the fold and pass **22/22** afterward. No current meal ticks, seating, serving notes or online/offline meal-family lines change in this fold.

Both independent reviewers rechecked the correction, each passing 22/22 with no remaining findings. The final full suite passes **547/547, zero skips**, recorded in `corn-pair/door-corn-full-suite-review-fold.log`. Release order remains CODEX source deployment, shared-library correction, then DOOR deployment; refresh owning branches before each write and retain newer staff saves.

## Public-reader delivery continuation

Jason authorized the existing CODEX Pages site to deliver recipe-only shared data. The reader now uses `library_public.json`; its cache fallback and conservative allergen overlay are unchanged. Contract ownership remains in CODEX `docs/CODEX_PUBLIC_LIBRARY_CONTRACT.md`; the shared source stays private. Anonymous delivery was verified before release.

The gate author, independently of the builder, narrowed the original Corn byte gate to the exact reader URL and two explanatory comments, retaining its original digest and every other assertion. Corn 16/16, anonymous reader 3/3, existing overlay 10/10; full suite **550/550, zero skips**. Independent safety/data and release/feed reviews both passed. Operational JSON is unchanged by this continuation.

Live verification at `2026-10-22T17:22:34Z`: the deployed app and five operational JSON files match `912f45d` byte-for-byte. A fresh anonymous Chromium session reads all 15 shared records from the public projection, applies the corrected Corn/Nightshades/Sulphites warnings, and makes no private raw request. Both the release CI and Pages deployment succeeded.
