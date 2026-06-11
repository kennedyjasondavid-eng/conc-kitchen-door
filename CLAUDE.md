# DOOR — Kitchen DOOR

## HOUSE context
DOOR is one app in **HOUSE** (CONC shelter-catering ops; Hospitality Operations Unified System Engine). It sits **upstream of everything**: the resident registry + the active menu source. Pipeline: **DOOR → EXPO → HUB**; MISE/CODEX feeds recipe + allergen data *into* DOOR.
- Siblings: **EXPO** (`conc-kitchen-expo`, consumes DOOR's menu) · **HUB** (`conc-kitchen-hub`, daily board) · **MISE/CODEX** (`conc-recipe-hub`, recipe + allergen + cost source).
- Machine-global HOUSE map: `~/.claude/CLAUDE.md`. Ecosystem vision (the "why"): `…\OneDrive - CHRISTIE OSSINGTON NEIGHBOURHOOD CENTRE\~CONC Project Management Tool~\CURRENT\CONC_Kitchen_Operations_Vision_V42.html`.

## What this is
Daily operational interface for Rexdale shelter meal service. Staff enter resident changes once (intakes / discharges / restriction updates) and DOOR generates all plating sheets, dietary labels, and support files in one run. Allergen + anaphylactic routing checked **before** service.
- `index.html`, single-file HTML/CSS/JS, ~17.5K lines. **v25+** — no single `APP_VERSION` constant (per-feature `[DOOR vN]` console markers; `menu_current.json` `_meta.version` ~30).
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

## Publish / token notes (2026-06-11)
- **Token precedence (fixed `4dd0600`):** Publish and Test both read the settings **field first**, stored setting second. (Previously Publish read stored-first → a freshly pasted token "tested fine" but Publish 401'd until Save was clicked.)
- **⚠ Embedded default token:** `DEFAULT_SETTINGS['gh-token']` (~line 9678, XOR-obfuscated) silently resurrects whenever the stored token is empty. If it has expired this masks the "no token configured" state and produces confusing 401s. Cleanup candidate — architect's call.
- Stale-tab hazard: publishing from a DOOR tab opened before a deploy runs the **old** code (the boot cache-bust banner mitigates — reload when it prompts).

## ⚠️ Reno-menu footgun (shared with EXPO)
`menu_reno.json` is **NOT** in DOOR's normal publish set — it's a static artifact generated from the Excel sources (`_gen_menu_reno.py`, in the EXPO repo). Editing the menu in DOOR's UI while in reno mode writes to overlay/state but **never reaches `menu_reno.json` on Pages**. One-off reno-menu fixes: (a) edit the Excel + regen, or (b) hand-edit `menu_reno.json` here — leave a `_meta.manualEdits` breadcrumb so the next regen doesn't silently undo it.

## Rules
- Single-file HTML; no build tools/npm/frameworks. Graceful degradation from `file://`.
- localStorage is the user's data; architect changes via seeds, user edits in-app.
- Push: `KitchenDOOR_Push.hta` (Save → Sync → push; auto-detects home/work OneDrive path). **OneDrive-only working folder — no second clone.**
- Future **HOUSE Phase 5:** SharePoint integration via Microsoft Graph API (post-renovation) — persistence layers are structured to swap to SharePoint calls one function at a time.
- Full reference: `README.md`.

## Cross-HOUSE research note — canonical vocabulary contract (2026-06-11, nothing ruled)

From the Epicure ingredient-embeddings paper pass (anchor analysis: `conc-kitchen-expo/RESEARCH_Epicure_Implications_2026-06-11.md`; cross-HOUSE lesson: `conc-kitchen-hub/INSIGHTS.md`). The direction of travel it validates: a CODEX-published `canonical_vocab.json` mapping every canonical dish/ingredient to its CODEX key, EXPO planner key, and allergen anchor, under an *entity-unique* matching policy — so downstream name resolution is exact lookup, with fuzzy matching demoted to a flag-don't-resolve fallback. **DOOR's stake:** menu text is the *origin* of most dish names that EXPO/HUB later resolve — when the contract lands, DOOR's menu editor validating dish names against the canonical vocabulary at entry time (flag unknowns, suggest canonicals) kills the alias-drift bug class at the source instead of three apps catching it downstream. Pairs naturally with the special-meal pipe preference (DOOR entry → EXPO finalize → HUB), where new one-off dish names are exactly the unknowns that need flagging. No DOOR work scheduled; recorded so the consumer-side seam isn't forgotten when the contract is designed.
