# DOOR — Kitchen DOOR

> **Cross-app status may be stale here — single source of truth for cross-app facts (versions, phases, schema seams) is the HOUSE status ledger in `~/.claude/CLAUDE.md` (as of 2026-06-13).**

## HOUSE context
DOOR is one app in **HOUSE** (CONC shelter-catering ops; Hospitality Operations Unified System Engine). It sits **upstream of everything**: the resident registry + the active menu source. Pipeline: **DOOR → EXPO → HUB**; MISE/CODEX feeds recipe + allergen data *into* DOOR.
- Siblings: **EXPO** (`conc-kitchen-expo`, consumes DOOR's menu) · **HUB** (`conc-kitchen-hub`, daily board) · **MISE/CODEX** (`conc-recipe-hub`, recipe + allergen + cost source).
- Machine-global HOUSE map: `~/.claude/CLAUDE.md`. Ecosystem vision (the "why"): `…\OneDrive - CHRISTIE OSSINGTON NEIGHBOURHOOD CENTRE\~CONC Project Management Tool~\CURRENT\CONC_Kitchen_Operations_Vision_V42.html`.
- Design lessons (KNOWLEDGE owner): cross-HOUSE design wisdom + lessons live in `conc-kitchen-house/INSIGHTS.md` (the single owner) — read it before a design pass; point here, don't restate.

## What this is
Daily operational interface for Rexdale shelter meal service. Staff enter resident changes once (intakes / discharges / restriction updates) and DOOR generates all plating sheets, dietary labels, and support files in one run. Allergen + anaphylactic routing checked **before** service.
- `index.html`, single-file HTML/CSS/JS, ~20K lines. **`DOOR_APP_VERSION = 'v31-standard.1'`** + `DOOR_BUILD_DATE = '2026-06-26'` drive a staff-visible build stamp; `menu_current.json` `_meta.version` **32**, `menu_reno.json` 2. `DOOR_SCHEMA_VERSIONS.menu_current` = 32 (mirror, gate-checked).
- **Menu source truth:** Jason's July 2 workbook import, stored as `concUploadedMenu`, is the standard-menu base. `concMenuBase` is only a post-import delta layer. A standing `standardCutover` marker prunes pre-2026-07-13 overlay days at boot, daily sync, and publish pre-merge so old reno edits cannot resurrect from another device or the cloud.
- Live: https://kennedyjasondavid-eng.github.io/conc-kitchen-door/

## Architecture
- Single-file HTML; all CSS/JS inline; no build step.
- **localStorage = live state** (residents, queue, registry). The repo's JSON files are *snapshots* the push writes for the rest of HOUSE to consume.
- Screens are **tabs toggled by `showScreen()`** (`data-screen`), not routes. All UI rendered up-front.
- Recipe + allergen data fetched **live from CODEX** (`DOOR_RECIPE_DATA.json` off the recipe-hub Pages site); a baked-in snapshot is the offline fallback. **Allergen data is owned by CODEX — fix it there, never fork it into DOOR.**
- Compliance engine: **exclude-array** pattern. **Anaphylactic flags are sacred — never silently overridden; always surfaced in red with explicit acknowledgement.**

## Published data contracts (DOOR = menu + resident source)
| File | Consumer |
|---|---|
| `menu_current.json` `{_meta, weeks[]}` (`version` increments) | EXPO `loadMenuFromDOOR` |
| `menu_reno.json` (reno 4-week, LAN routing) | EXPO when `scheduleMode = reno` |
| `menu_overlay.json` (post-import user deltas; cutover-stamped) | applied on top of `menu_current.json` |
| `routing_by_meal.json` `{ wk: { DAY: { meal: { SectionLabel: n, _components: {dish: portions} } } } }` | EXPO portion math (section labels) · HUB portion-aware CODEX deep-links (`_components`) |
| `registry_summary` · `meal_swaps` · `recent_log` · `learned_nr` · `custom_tag_rules` · `special_meals` · `door_state` | snapshots / informational |

**Change a published schema → update the EXPO consumer in the same change set** (or stage via menu overlays).

### `_components` (added 2026-06-10, the Stage 2 portions pipe)
Each meal slot's `_components` maps every dish/side to its **total portions across all routing sections that receive it**, computed by the same engine as the plating sheets (`computePlatingData` + `getAltMeal` inside `buildRoutingByMealJSON`). HUB resolves its schedule items against this and appends `&portions=N` to CODEX recipe links, so a cook lands on the recipe pre-scaled. Notes baked into the design: `modified_main`/`bland_alt` sections eat the main meal's components; component keys merge case-insensitively; **anaphylactic residents are excluded** (they get a separate alternative) and the counts use the plating engine's smart flag defaults — so `_components` can legitimately disagree with the sibling section counts. **Never "reconcile" the two**; the plating engine is the authority. The block is try-guarded and additive — section counts stay byte-identical.

## Publish safety (hardened 2026-06-18 — PRs #48–#51)
The publish path is hardened end-to-end. `PublishAuth` centralizes credentials; the **embedded default token + shared-key fallbacks are removed** (no token resurrects on empty storage; persisting requires Test & Save; background/auto/side publishes use the saved token, and the unsaved-typed-token warning is manual-only so a value left in the field can't stall the cloud feed). All GitHub writes funnel through one serialized queue (`_ghWriteQueue`) so publishes can't race on file SHAs. Output is escaped at every display sink; localStorage + published JSON stay raw.
- **Gate-9 structural block (PR #50):** a Stop-level *structural* defect in the artifacts (missing menu day, non-integer/negative routing count, missing routing slot, malformed `_components`, missing artifact/`_meta.version`) now **blocks the publish** — auto-publish skips ("Blocked — N structural defects"), a manual publish prompts to override. Clinical/diagnostic flags stay advisory. Downstream EXPO/HUB fall back to last-good-valid via their cache rather than ingest corruption.
- **Stale-tab guard:** publishing from a tab opened before a deploy is detected (`checkForFreshDoorVersion`); auto-syncs skip, a manual publish confirms; the "publish anyway" override is scoped to manual publishes only.
- **`computeDoorComplianceDiagnostics`** is built + tested but **intentionally unwired** — the engine for a future consolidated compliance gate (the live anaphylactic net runs via `getAnaphConflictRooms`/routing lockout/plating ALERT).
- **No-build smoke harness:** `tests/door-smoke.mjs` (`node --test tests/*.mjs`) + a GitHub Actions check, 64 tests. `.gitattributes` forces `*.html`/`*.mjs` to LF (Windows edits CRLF-flipped `index.html` and broke the harness's marker extraction).

## Recent (2026-07-19) — pork-is-never-halal-certified guard on menu export
Surfaced by a PROOF data-check sweep (`conc-kitchen-proof#12`): three **pork** slots were flagged `halalCertifiedMeat:true` in the stored menu — **Pork Carnitas** (W1 Tue dinner), **Pork Griot** (W3 Thu dinner), **Tandoori Pork** (W4 Fri dinner). Pork is never halal-certified, and EXPO only emits a separate halal cook when `!halalCertifiedMeat` (`conc-kitchen-expo/index.html:13238`), so the `true` flag made EXPO **skip the halal cook the menu names** (`_halal` = Halal Chicken Carnitas / Chicken Griot / Tandoori Chicken) — halal residents got no dish on those nights. DOOR's live detectors already guard this (`~:13713` default, `~:15595` auto-detect); the bad flags came in with **Jason's July-2 workbook import** (restored by the 2026-07-13 overlay repair), which bypassed those detectors. Jason confirmed those dishes have halal chicken alts and the DOOR menu should reflect that.
- **Durable fix:** `buildMenuJSON` now enforces the invariant on export — for any meal, `hasPork && halalCertifiedMeat ⇒ halalCertifiedMeat:false` (clones `_flags`, never mutates app state). So a stored/imported flag can't reach EXPO wrong, and a future overlay repair can't silently regress it.
- **Data:** the committed `menu_current.json` is corrected to match (3 `<meal>_flags.halalCertifiedMeat` true→false; `_slots.main.flags` is DOOR-editor-internal and left as-is). **EXPO must re-sync the menu + Generate for the halal cooks to appear** in `hub_schedule.json`.
- **Gates:** `door-smoke` +2 (now 66) — a runtime test that *runs* `buildMenuJSON` (pork forced false, legit non-pork cert stays true, app state not mutated) + a data-invariant gate that `menu_current.json` carries no `hasPork && halalCertifiedMeat` slot.
- **Egg Salad Wrap (W1 Wed lunch) stray `hasPork` — corrected in the artifact:** the vegetarian wrap was flagged `hasPork:true`, leaking a wrong `pork` allergen token onto the plating sheet and routing a **phantom Halal section** (a "Halal Egg Salad Wrap" identical to the regular). The committed `menu_current.json` now has `hasPork:false` + the regenerated allergen line (`gluten, dairy, egg`); a new `door-smoke` allergen/flag-consistency gate guards the class (now 67). **Two caveats:** (1) the phantom `Halal:56` lives in `routing_by_meal.json` (plating-engine output) and clears when DOOR **regenerates routing on the next publish** — do NOT hand-edit routing (never reconcile counts vs `_components`); (2) the invariant guard can't defend this (it's not a pork dish), so to make it durable **clear `hasPork` on the slot in DOOR's menu editor** — otherwise a republish from app-state reverts it.

## Recent (2026-07-18) — veg-alt allergen-lookup follow-up (issue #63) — NO DOOR code changed yet
Upstream CODEX plant-forward work (`conc-recipe-hub` PRs #71/#72 — plant sides re-tagged `regular → vegan`, Jason-adjudicated) **exposed a pre-existing narrowness in `getVegAltAllergenStr`** (~`index.html:16382`): it fuzzy-matches the veg-alt text against *vegan-stream* feed recipes and can latch onto a **side** while **missing the veg main**, so a newly-vegan side's narrow allergens replace the broad main-meal fallback in `computePlatingData` (~`:19735`). Result: **3 latent veg-alt advisory-warning deltas** — Wk2 MON dinner drops PEANUTS, Wk4 SAT dinner drops PEANUTS+TREE NUTS (the veg mains — Vegetarian Peanut Stew / Massaman — genuinely contain them), Wk4 SAT lunch drops a false-positive DAIRY (that plate is all-vegan).
- **Latent** — manifests only when DOOR **next republishes** `routing_by_meal.json`; nothing on a plating sheet changed today. **The No-Egg `_vegAltSafe` net had 0 transitions on both flips, and the anaphylactic routing lockout (`getAnaphConflictRooms`, keyed off the untouched menu `_flags`) is a separate, unaffected net.** The CODEX data is correct; the fix is DOOR-side.
- **Tracked in `conc-kitchen-door#63`** with the 3 slots + fix options (union the fallback as an allergen floor when the lookup is partial / also match the veg main / add stored overrides). Verification harness lives upstream: `conc-recipe-hub/tests/door_vegalt_safety_gate.mjs` boots DOOR's real plating headless and asserts 0 `_vegAltSafe` transitions (anchor reproduces the committed routing 84/84) — re-run it against a fixed DOOR before the next routing republish.

## Recent (2026-06-26) — STANDARD menu cutover
- **`menu_current.json` → v31 (the new STANDARD menu), LIVE on `main` `5fdce16`.** The reno → standard cutover (DOOR → EXPO → HUB): DOOR is the menu source. Slot `_flags` carry union-of-streams allergens (anaphylaxis-safe — never under-flag) with two exceptions kept regular-only: `halalCertifiedMeat` and meat flags masked on non-main components. Allergens are CODEX-verified + Jason-confirmed for the new dishes (`menu_v31_allergen_*` artifacts).
- **Halal fix:** `halalCertifiedMeat=false` on every `hasPork` slot. EXPO's decomposer emits a separate halal cook only when `halalCertifiedMeat===false`; 5 pork slots (Tandoori, Souvlaki, Adobo, Al Pastor, Sausages & Mash) were wrongly `true`, so halal residents got **no** cook. (One genuine remaining gap: **W1 MON "Fully Loaded Sausage"** has no halal option defined.)
- **Build stamp** → `v31-standard.1` / `2026-06-26`; `DOOR_SCHEMA_VERSIONS.menu_current` → 31 (door-smoke gate-checked, 55/55).
- `routing_by_meal.json` was regenerated for the standard cutover. The later July 2 workbook import is now the app-state authority; see the 2026-07-13 repair below.

## Recent (2026-07-13) — overlay contamination repair
- `menu_current.json` → v32. Eleven stale overlay slots were restored from Jason's July 2 workbook import, including their complete meal fields and allergen flags; matching `_components` routing slots were regenerated.
- `menu_overlay.json` was reduced to metadata plus `standardCutover`. Every overlay merge normalizes both sides and rejects week/day entries without the current marker; `_meta` is never treated as a week.
- The Menu Config **Alt Menu** toggle and its `menu_reno.json` cache/fetch paths are retired. Permanent/Edit Menu writes have a legacy-source guard, and boot clears retired alt-source state.

## Recent (2026-06-18)
- Security + stability hardening (auth, output-encoding, stability gates) — PR #48 (`b716a24`); originally a Codex cloud session, reviewed against the HOUSE VISION/INSIGHTS before landing.
- Review fixes (publish red-on-Stop, no reno-overlay contamination) + L11104 overlay write-ordering + accessibility safe wins + AA contrast — PRs #48/#49.
- Gate-9 publish-blocking + scoped stale override — PR #50 (`cf6ec84`).
- **Recipe slot autosave now applies stream filters** (`recipeMatchesSlotDef`) so exact typed *off-stream* names no longer recipe-link and autofill the wrong allergen flags. Authored in a parallel CODEX/MISE session as the Gate-U3 prerequisite — PR #51 (`3ba4322`).

## ⚠️ Reno-menu footgun (shared with EXPO)
`menu_reno.json` is **NOT** in DOOR's normal publish set — it remains a static artifact generated from the Excel sources (`_gen_menu_reno.py`, in the EXPO repo), but DOOR no longer offers an Alt Menu view or edit path for it. Reno-menu fixes belong in the Excel + generator flow; a hand edit must leave a `_meta.manualEdits` breadcrumb so the next regen does not silently undo it.

## Decisions — out of scope (2026-06-18)
The "Elegance" advisory stream's structural proposals are **retired**, not deferred: in-file modularization, the namespace/IIFE convention, section banners, and standalone design tokens. They serve maker-comfort, not the telos (a tool that recedes / fewer staff errors), and modularizing the single-file app fights the string-matching test harness for no staff benefit. The accessibility *safe wins* (focus ring, keyboard nav, SR-announced banners, AA contrast) already landed; touch-targets + print fidelity remain a live-preview task with the architect.

## Rules
- Single-file HTML; no build tools/npm/frameworks. Graceful degradation from `file://`.
- localStorage is the user's data; architect changes via seeds, user edits in-app.
- Push: `KitchenDOOR_Push.hta` (Save → Sync → push; auto-detects home/work OneDrive path). **OneDrive-only working folder — no second clone.**
- Future **HOUSE Phase 5:** SharePoint integration via Microsoft Graph API (post-renovation) — persistence layers are structured to swap to SharePoint calls one function at a time.
- Full reference: `README.md`.
