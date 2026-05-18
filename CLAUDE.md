# DOOR — KitchenDOOR

## What This Is

DOOR is a single-file HTML resident-routing and plating-sheet generator for CONC Bloor (Christie Ossington Neighbourhood Centre) shelter catering. Currently v25.1 at ~18.5K lines.

Staff enter resident changes once (intakes, discharges, restriction updates) and the app generates plating sheets, dietary labels, anaphylactic alerts, and support files for kitchen service in one run. Allergen conflicts and anaphylactic routing are checked automatically before service.

**Live app:** https://kennedyjasondavid-eng.github.io/conc-kitchen-door/

## System Context

DOOR is one component of HOUSE (Hospitality Operations Unified System Engine):
- **DOOR** (this) — Resident routing, plating sheets, anaph compliance
- **EXPO** — Scheduling engine / production planner
- **HUB** — Staff-facing daily dashboard
- **MISE / CODEX** (Recipe Hub) — Recipe library, allergen ontology

## Architecture

Single-file HTML app (`index.html`, ~18.5K lines). No server. GitHub Pages hosted. localStorage state + JSON files committed to repo. Works offline from `file://`.

### Data files (cadence-based partitioning)
| File | Role |
|---|---|
| `door_state.json` | Primary resident registry (canonical) |
| `registry_summary.json` | Derived counts (regenerated from door_state) |
| `routing_by_meal.json` | Derived per-meal section counts (consumed by HUB) |
| `menu_current.json` | Exported merged menu (base + overlay) |
| `menu_overlay.json` | Partial permanent overrides |
| `menu_reno.json` | Alternative read-only menu (renovation cycle) |
| `change_log.json` | Append-only menu edit log w/ full per-meal flag snapshot |
| `recent_log.json` | Short rolling activity feed for UI |
| `learned_nr.json` | Staff-resolved free-text restriction mappings |
| `meal_swaps.json` | Date-keyed one-day overrides |
| `special_meals.json` | Per-resident bespoke meals |
| `custom_tag_rules.json` | Operator-added tag patterns |

Recipe data (`DOOR_RECIPE_DATA.json`) loaded live from the Recipe Hub at startup, with embedded fallback at `index.html:686` for offline.

### Key subsystems
- **Resident registry** — `REGISTRY_LIST` (172 residents currently; 4 anaphylactic: rooms 213, 607a, 813, 1213)
- **Section routing** — `routeResident(tags, meal, room, isAnaph)` at line 6644
- **Anaphylactic containment** — `getAnaphConflictRooms()` at line 7556, `getAnaphAlertInfo()` at line 7582
- **Per-row anaph marker** (v25.1, May 18) — `getAnaphMarkerForResident()` at line 7631 — fires across all sections when resident's anaph allergens intersect meal flags
- **Plating sheet generator** — `buildPlatingXlsx()` at line 16988, `buildDaySheet()` at line 16791
- **Special-file builders** — Restriction List, Diabetic List, Anaph List, Labels starting at line 17020
- **CONFLICT_MAP** — resident-tag → meal-flag rules with cook notes
- **`RESIDENT_TO_MEAL_FLAG`** at line 7465 — full Health-Canada priority allergen table (used by per-row marker)
- **`ANAPH_TAG_TO_MEAL_FLAG`** at line 7451 — narrower table (peanuts/fish/dairy/gluten) used by `routeResident` for section promotion to Anaphylactic Alternative

## Push flow

`KitchenDOOR_Push.hta` — Windows-only HTA. Auto-detects OneDrive path (work vs home), prompts for commit message, handles `pull → stage → commit → push`. If running another OS: standard `git add`, `git commit`, `git push`.

## Rules
- **Single-file HTML is non-negotiable.** No build tools, no npm, no frameworks.
- **Resident registry is operator-controlled.** Mutations happen via the DOOR UI, not by hand-editing JSON.
- **localStorage is the operator's working draft.** Edits persist locally; `git push` is the explicit deploy step.
- **Deterministic plating.** Same registry + same menu = same plating sheets.
- **Graceful degradation.** Embedded fallback works without network.
- **Anaph routing must fail-safe**, not fail-dangerous. A meal with missing `*_flags` should refuse to publish, not default to safe-for-all. (Pending — see open items below.)

## Recent (v25.1, May 18)
- **Per-row anaph marker** (`getAnaphMarkerForResident`) — marker now fires across all sections, not just Anaphylactic Alternative. Closes the gap where room 213 (anaph to coconut + tree nuts) had no anaph marker on meals containing their allergens, only incidental safety via Soft Meals track. See commit `5504e6f` and `SESSION_HANDOFF_2026-05-18.md`.
- **HOUSE env badge** — bottom-right `App · Version · Environment` indicator; `[DEV]` / `[LOCAL]` title prefix and red top border on non-PROD. See commit `c1e1e45`.

## Open / pending

- **Menu hydration drift** — runtime `MENU_DATA` doesn't fully merge `menu_current.json` flags at boot. Affects 6 of 7 expected anaph marker firings. Highest-leverage next-session task. See `SESSION_HANDOFF_2026-05-18.md`.
- **`*_flags` fail-safe default** — `buildRoutingByMealJSON()` at line 9787 currently falls back to empty flags on missing. Needs to refuse meal publication + render "UNFLAGGED — DO NOT SERVE" banner.
- **PAT replacement** — see HUB. The shared GitHub PAT pattern affects DOOR's write path too.
- **Multi-site fitness** — current data model is single-site. Resident records keyed by room within one `door_state.json`. Scaling to 20+ shelter kitchens needs: resident UUIDs, per-site partitioning, real backend (SharePoint Graph is the planned move post-renovation).

## Related apps

| App | Repo | Description |
|---|---|---|
| Production Hub | [conc-kitchen-hub](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub) | 4-week scheduling, cold-chain logistics, driver dispatch |
| Recipe Hub | [conc-recipe-hub](https://github.com/kennedyjasondavid-eng/conc-recipe-hub) | Recipe management, production cards, allergen data |
| Production Planner | [conc-kitchen-expo](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo) | Scheduling engine, backward scheduler, chain lifecycles |
