# DOOR — Kitchen DOOR

> **Cross-app status may be stale here — single source of truth for cross-app facts (versions, phases, schema seams) is the HOUSE status ledger in `~/.claude/CLAUDE.md` (as of 2026-06-13).**

## HOUSE context
DOOR is one app in **HOUSE** (CONC shelter-catering ops; Hospitality Operations Unified System Engine). It sits **upstream of everything**: the resident registry + the active menu source. Pipeline: **DOOR → EXPO → HUB**; MISE/CODEX feeds recipe + allergen data *into* DOOR.
- Siblings: **EXPO** (`conc-kitchen-expo`, consumes DOOR's menu) · **HUB** (`conc-kitchen-hub`, daily board) · **MISE/CODEX** (`conc-recipe-hub`, recipe + allergen + cost source).
- Machine-global HOUSE map: `~/.claude/CLAUDE.md`. Ecosystem vision (the "why"): `…\OneDrive - CHRISTIE OSSINGTON NEIGHBOURHOOD CENTRE\~CONC Project Management Tool~\CURRENT\CONC_Kitchen_Operations_Vision_V42.html`.
- Design lessons (KNOWLEDGE owner): cross-HOUSE design wisdom + lessons live in `conc-kitchen-hub/INSIGHTS.md` (the single owner) — read it before a design pass; point here, don't restate.

## What this is
Daily operational interface for Rexdale shelter meal service. Staff enter resident changes once (intakes / discharges / restriction updates) and DOOR generates all plating sheets, dietary labels, and support files in one run. Allergen + anaphylactic routing checked **before** service.
- `index.html`, single-file HTML/CSS/JS, ~20K lines. **`DOOR_APP_VERSION = 'v31-stability.3'`** + `DOOR_BUILD_DATE` drive a staff-visible build stamp (added in the 2026-06-18 hardening); `menu_current.json` `_meta.version` 30, `menu_reno.json` 2.
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
| `menu_overlay.json` (user menu deltas) | applied on top of `menu_current.json` |
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
- **No-build smoke harness:** `tests/door-smoke.mjs` (`node --test tests/*.mjs`) + a GitHub Actions check, ~55 tests. `.gitattributes` forces `*.html`/`*.mjs` to LF (Windows edits CRLF-flipped `index.html` and broke the harness's marker extraction).

## Recent (2026-06-18)
- Security + stability hardening (auth, output-encoding, stability gates) — PR #48 (`b716a24`); originally a Codex cloud session, reviewed against the HOUSE VISION/INSIGHTS before landing.
- Review fixes (publish red-on-Stop, no reno-overlay contamination) + L11104 overlay write-ordering + accessibility safe wins + AA contrast — PRs #48/#49.
- Gate-9 publish-blocking + scoped stale override — PR #50 (`cf6ec84`).
- **Recipe slot autosave now applies stream filters** (`recipeMatchesSlotDef`) so exact typed *off-stream* names no longer recipe-link and autofill the wrong allergen flags. Authored in a parallel CODEX/MISE session as the Gate-U3 prerequisite — PR #51 (`3ba4322`).

## ⚠️ Reno-menu footgun (shared with EXPO)
`menu_reno.json` is **NOT** in DOOR's normal publish set — it's a static artifact generated from the Excel sources (`_gen_menu_reno.py`, in the EXPO repo). Editing the menu in DOOR's UI while in reno mode writes to overlay/state but **never reaches `menu_reno.json` on Pages**. One-off reno-menu fixes: (a) edit the Excel + regen, or (b) hand-edit `menu_reno.json` here — leave a `_meta.manualEdits` breadcrumb so the next regen doesn't silently undo it.

## Decisions — out of scope (2026-06-18)
The "Elegance" advisory stream's structural proposals are **retired**, not deferred: in-file modularization, the namespace/IIFE convention, section banners, and standalone design tokens. They serve maker-comfort, not the telos (a tool that recedes / fewer staff errors), and modularizing the single-file app fights the string-matching test harness for no staff benefit. The accessibility *safe wins* (focus ring, keyboard nav, SR-announced banners, AA contrast) already landed; touch-targets + print fidelity remain a live-preview task with the architect.

## Rules
- Single-file HTML; no build tools/npm/frameworks. Graceful degradation from `file://`.
- localStorage is the user's data; architect changes via seeds, user edits in-app.
- Push: `KitchenDOOR_Push.hta` (Save → Sync → push; auto-detects home/work OneDrive path). **OneDrive-only working folder — no second clone.**
- Future **HOUSE Phase 5:** SharePoint integration via Microsoft Graph API (post-renovation) — persistence layers are structured to swap to SharePoint calls one function at a time.
- Full reference: `README.md`.
