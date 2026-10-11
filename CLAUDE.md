# DOOR — Kitchen DOOR

> **Cross-app status may be stale here — single source of truth for cross-app facts (versions, phases, schema seams) is the HOUSE status ledger in `~/.claude/CLAUDE.md` (as of 2026-06-13).**

## HOUSE context
DOOR is one app in **HOUSE** (CONC shelter-catering ops; Hospitality Operations Unified System Engine). It sits **upstream of everything**: the resident registry + the active menu source. Pipeline: **DOOR → EXPO → HUB**; MISE/CODEX feeds recipe + allergen data *into* DOOR.
- Siblings: **EXPO** (`conc-kitchen-expo`, consumes DOOR's menu) · **HUB** (`conc-kitchen-hub`, daily board) · **MISE/CODEX** (`conc-recipe-hub`, recipe + allergen + cost source).
- Machine-global HOUSE map: `~/.claude/CLAUDE.md`. Ecosystem vision (the "why"): `…\OneDrive - CHRISTIE OSSINGTON NEIGHBOURHOOD CENTRE\~CONC Project Management Tool~\CURRENT\CONC_Kitchen_Operations_Vision_V42.html`.
- Design lessons (KNOWLEDGE owner): cross-HOUSE design wisdom + lessons live in `conc-kitchen-house/INSIGHTS.md` (the single owner) — read it before a design pass; point here, don't restate.
- Implementation seams: `conc-kitchen-house/HOUSE_PROVEN_SEAMS.md` — problem classes solved once somewhere in HOUSE (quota-safe writes, token handling, atomic multi-file publish, escaper families, …); **port the seam, don't reinvent — cite the row**. DOOR owns row 4 (`PublishAuth`). **Rows 1, 3 and 5 were DOOR's named gaps and are all closed:** row 5 `ghPushFilesAtomic` (2026-08-17, D1); row 3 `doorSanitizeConnectionKey` in `PublishAuth` (2026-09-11, publish-resilience P2, #91); row 1 `doorSetItemSafe` for the publish outbox (2026-09-11, P3, #92 — partial port: expendable-keys drop, no upkeep map). The registry cells are updated in the paired `conc-kitchen-house` changes.

## What this is
Daily operational interface for Rexdale shelter meal service. Staff enter resident changes once (intakes / discharges / restriction updates) and DOOR generates all plating sheets, dietary labels, and support files in one run. Allergen + anaphylactic routing checked **before** service.
- `index.html`, single-file HTML/CSS/JS, ~20K lines. **`DOOR_APP_VERSION = 'v31-standard.26'`** + `DOOR_BUILD_DATE = '2026-10-08'` drive a staff-visible build stamp; `menu_current.json` `_meta.version` **32**, `menu_reno.json` 2. `DOOR_SCHEMA_VERSIONS.menu_current` = 32 (mirror, gate-checked).
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
| `menu_current.json` `{_meta, weeks[]}` (`_meta.version` is a **schema constant, not a data revision** — see the version-contract note below). Each day's `_slots` are editor-internal but publish **verbatim**; a bound slot optionally carries `displayText` (S1) + `recipeId` (phase-2, 2026-08-18) — **additive/opt-in**, allergen-neutral (feed allergens regenerate from `_flags` only). | EXPO `loadMenuFromDOOR` (ignores `_slots`) · HUB reads `_slots.recipeId` for an exact `?recipe=` deep-link (consumer not yet wired) |
| `menu_reno.json` (reno 4-week, LAN routing) | EXPO when `scheduleMode = reno` |
| `menu_overlay.json` (post-import user deltas; cutover-stamped) | applied on top of `menu_current.json` |
| `routing_by_meal.json` `{ _meta:{…, builtFromMenu:{exported,hash}}, wk: { DAY: { meal: { SectionLabel: n, _components: {dish: portions} } } } }` (`_meta.builtFromMenu` = the menu revision this routing was built from — D2, 2026-08-17; also stamped on `registry_summary`/`door_state`) | EXPO portion math (section labels) · HUB portion-aware CODEX deep-links (`_components`) |
| `registry_summary` · `meal_swaps` · `recent_log` · `learned_nr` · `custom_tag_rules` · `special_meals` · `door_state` | snapshots / informational |

**Change a published schema → update the EXPO consumer in the same change set** (or stage via menu overlays).

**⚠ Cross-repo data-contract rule (HOUSE-wide, silent-drift plan §X2).** A **fail-closed assertion about another app's data may not ship in a change set that does not also update that app.** If it must ship alone, it fails **loud and visible** (an alarm the operator sees), never into a silent fallback. The reference implementation is the DOOR→EXPO→HUB required-key contract: EXPO's `hub_meals_contract_gate.mjs` (producer guarantee) and HUB's `stage_nocard_contract.mjs` (consumer backstop) assert the identical top-level key list, so a dropped key reddens the producer's CI first and the consumer's second — neither freezes a staff board. This is the durable form of the "update the consumer in the same change set" line above.

### ⚠ The version contract — `_meta.version` is NOT what it looks like (D7, 2026-07-27)
Every consumer that reads `_meta.version` must know three facts, each proven on live data:
1. **It is a hand-maintained SCHEMA constant** (`DOOR_SCHEMA_VERSIONS.<artifact>`), **not a data revision** — content changes do not bump it. Measured 2026-07-27: **23 menu fields changed 07-15→07-27, including an allergen flag flipping `hasPork` true→false, while it stayed `32`.**
2. **It is NOT monotonic** (31 → 30 → 32 across 06-30/07-12/07-13). Only ever test **inequality**; never order-compare, never treat a lower number as older.
3. **Each artifact keeps a SEPARATE counter** (2026-07-27: registry 30 / routing 31 / menu 32). Only `menu_current.json`'s counter is comparable to a consumer's `_doorMenu.version`; comparing any other pair is meaningless.

This is why HUB's freshness check compares menu **content**, never these numbers (versions are at most a fallback inequality test). Cross-app record: `conc-kitchen-hub/HOUSE_SILENT_DRIFT_ACTION_PLAN_2026-07-27.md` §5 D7.

### `_components` (added 2026-06-10, the Stage 2 portions pipe)
Each meal slot's `_components` maps every dish/side to its **total portions across all routing sections that receive it**, computed by the same engine as the plating sheets (`computePlatingData` + `getAltMeal` inside `buildRoutingByMealJSON`). HUB resolves its schedule items against this and appends `&portions=N` to CODEX recipe links, so a cook lands on the recipe pre-scaled. Notes baked into the design: `modified_main`/`bland_alt` sections eat the main meal's components; component keys merge case-insensitively; **anaphylactic residents are excluded** (they get a separate alternative) and the counts use the plating engine's smart flag defaults — so `_components` can legitimately disagree with the sibling section counts. **Never "reconcile" the two**; the plating engine is the authority. The block is try-guarded and additive — section counts stay byte-identical.

## Publish safety (hardened 2026-06-18 — PRs #48–#51)
The publish path is hardened end-to-end. `PublishAuth` centralizes credentials; the **embedded default token + shared-key fallbacks are removed** (no token resurrects on empty storage; persisting requires Test & Save; background/auto/side publishes use the saved token, and the unsaved-typed-token warning is manual-only so a value left in the field can't stall the cloud feed). All GitHub writes funnel through one serialized queue (`_ghWriteQueue`) so publishes can't race on file SHAs. Output is escaped at every display sink; localStorage + published JSON stay raw.
- **Gate-9 structural block (PR #50):** a Stop-level *structural* defect in the artifacts (missing menu day, non-integer/negative routing count, missing routing slot, malformed `_components`, missing artifact/`_meta.version`) now **blocks the publish** — auto-publish skips ("Blocked — N structural defects"), a manual publish prompts to override. Clinical/diagnostic flags stay advisory. Downstream EXPO/HUB fall back to last-good-valid via their cache rather than ingest corruption.
- **Stale-tab guard:** publishing from a tab opened before a deploy is detected (`checkForFreshDoorVersion`); auto-syncs skip, a manual publish confirms; the "publish anyway" override is scoped to manual publishes only.
- **`computeDoorComplianceDiagnostics`** is built + tested but **intentionally unwired** — the engine for a future consolidated compliance gate (the live anaphylactic net runs via `getAnaphConflictRooms`/routing lockout/plating ALERT).
- **No-build smoke harness:** `tests/door-smoke.mjs` (`node --test tests/*.mjs`) + a GitHub Actions check, 88 tests. `.gitattributes` forces `*.html`/`*.mjs` to LF (Windows edits CRLF-flipped `index.html` and broke the harness's marker extraction).

## Recent (2026-10-08) — no browser `confirm()` left in DOOR (`v31-standard.26`)
Jason, 2026-10-08: "follow your leans, go ahead with 1, 2 and 3" (item 2). The last 10 browser `confirm()` calls now ask through `doorAsk`:
- **Publish path:** the resident-list preflight, sending from an out-of-date page, sending despite a data problem, and Disconnect (`PublishAuth.forgetToken` is now `async`).
- **Menu screens:** make permanent (the edit panel and the Active Swaps banner), revert a swap or permanent change, clear all swaps, remove a special meal, and reset an edited menu meal.

**The resident-list question has three answers now.** With `confirm()`, Cancel (or Escape) meant "send this computer's OLDER list". `doorAsk` gained an optional `altLabel`, which adds a third button that resolves `'alt'`. The question is now:
- **Use the kitchen's newer list:** adopts it.
- **Send this computer's older list:** forced; the F3 override is kept.
- **Go back:** also Escape or a click outside. The preflight returns `cancelled`, and `_doPublishToGitHub` sends nothing (skip reason `registry-cancelled`, which has its own banner copy).

After an answer, the menu screens check the same meal is still open. They also read the overlay and swaps again before writing, because a menu sync may have written while the question was open. Nothing published changes.

**Gate and re-pins:**
- New gate `tests/publish_menu_ask_gate.mjs` (8), authored red 7/8 on `main`. It scans the whole file for any `confirm(` left in code, and drives Remove special meal, Clear all swaps and the three preflight answers.
- Re-pinned with dated comments: the `door-smoke` publish harness answers `doorAsk` from `options.confirm`; `registry_publish_gating_gate` stubs `doorAsk`, with the older list as `'alt'`.
- Checked in a real browser: three buttons; Escape returns false; the Disconnect dialog shows.
- Suite 320/320.

## Recent (2026-10-08) — the "differs from the published menu" line says what differs (`v31-standard.25`)
Jason: the P4 line named "1 day (Wk1 MON)" and asked him to pick a copy with no basis. The live case was four **per-dish editor tags** on Wk1 MON lunch (Chicken / Carb-swap / Halal-Certified Meat on the chicken burger, Gluten on the quinoa burger) inside `lunch_slots` — the menu, alternatives and meal-level flags were identical, so plates and routing were the same either way.
- **`doorOverlayDayDifferences(localDay, cloudDay, flagLabels)`** (testable core) → one plain-words row per difference `{meal, what, here, published, staffSees}`. `staffSees` is false only for `<period>_slots` (plating/routing/published allergens never read it); an unknown field counts as staff-visible; a tag absent on one side reads as off.
- **`renderOverlayDiffBanner`**: when every difference is editor-only it reads as a note ("…different editor details… Plates, routing and allergens are the same on both computers"); otherwise it keeps the P4 warning and marks editor-only rows. A native `<details>` "Show what’s different" table lists each meal with an **Open in Edit Menu** link (`#menu-config/edit/…`), and the line names both choices: open the meal and save it to keep this computer’s, or **Use the published one**. Display only — nothing written or sent.
- **Gate:** `tests/menu_overlay_diff_details_gate.mjs` (7), authored red 7/7 against `origin/main` `f595a0e`; `menu_overlay_differs_gate` unchanged and green. Suite **305 → 312**.

## Recent (2026-10-08) — Daily Entry, registry and compliance questions ask in DOOR's own dialog (`v31-standard.24`)
Jason, 2026-10-08: "follow your leans, go ahead with 1, 2 and 3". This is item 3: the next screens after Save move off browser `confirm()` to `doorAsk`. There are 13 questions across 12 functions:
- **Daily Entry and registry:** revert a resident, clear the queue, remove a queued change, reset the registry, undo the last Generate, save the intake queue, and the two questions on a direct save (discharge; room already here).
- **Compliance:** confirm, resolve, re-open.
- **Edit Menu and home:** leave Edit Menu / go home (two questions), undo the last menu change.

Each question has a title and named buttons ("Clear queue" / "Keep them", "Undo Generate" / "Go back"). Escape, a click outside or Go back mean go back and change nothing. The functions are now `async`; their callers are onclick handlers that ignore the return value. Nothing saved or published changes.

The publish-path and menu-screen `confirm()` calls left after this pass moved in `v31-standard.26` (above).

Gate `tests/daily_entry_ask_gate.mjs` (5), authored red 4/5 on `main`; the fifth checks the dialog wording and has nothing to check there. Two runtime checks drive the real Clear queue and Undo Generate bodies: Go back leaves the queue, the resident list and the saved snapshot alone. Suite 305/305 after merging #115.

## Recent (2026-10-08) — "Stale Allergen Flags" banner retired (`v31-standard.23`)
The Menu Config banner listed every overlay meal without a `<period>_slots` snapshot (42 on Jason's device) and said "open Edit Menu, click each meal and save to refresh". **The instruction refreshed nothing:** the edit grid opens with the meal's saved flags checked and `saveMenuEdit` ORs them in, so a re-save only ever adds flags; and the cleanup `sweepAltFlagPollution` runs non-dry **once per device** (`concAltFlagSweepV1`), then only dry-ran to count meals for the banner. The residual risk was alt-slot **over**-flagging — the safe direction, and intended under the cutover's union-of-streams policy. A missing snapshot's real cost (no recipe link for EXPO) is already shown per meal by D1's "⟳ from menu text — save to link".
- **Removed:** `#mc-stale-flags-banner`, `renderStaleFlagsBanner`, `_STALE_FLAG_MEALS`, the dry-run in `saveMenuBaseOverlay`, and the per-save banner filter in `_finishMenuSave`. **Kept:** `sweepAltFlagPollution` and the one-shot `runAltFlagSweepOnce` at load (now returns early once done). Display-only — no data, schema or publish-path change.
- **Gate:** `tests/stale_flags_banner_retired_gate.mjs` (5 tests), authored-to-fail **3 red / 2 pass** against `origin/main` `d8223ee` (the 2 pre-green ones lock the kept cleanup and that it never touches a slot-less meal's flags). Suite **295 → 300**, all green.

## Recent (2026-10-08) — Edit Menu's Save asks in DOOR's own dialog (`v31-standard.22`)
Jason, 2026-10-08: "follow your leans, go ahead with 1 and 2". Save's two questions — a slot that reads like several dishes (V7) and "no soft/plain alternative" — used browser `confirm()` boxes. They now use `doorAsk`, a small dialog in the same style as the Halal Certification Check: named buttons ("Go back and split them" / "Save as it is"; "Go back and add one" / "Save with “none required”"), Escape, a click outside or Go back all mean go back, and the text is set as text (never HTML). `saveMenuEdit` is now `async`; after an answer it stops if a different meal is open (`editKey` re-check) before building anything. Nothing saved or published changes. Gate `tests/save_dialog_styled_gate.mjs` (5), authored red 0/5 on `main`; checked in a real browser (dialog shows, Go back saves nothing, Save as it is saves). Suite 295/295. Other DOOR screens still use browser `confirm()`; this pass covers Save only.

## Recent (2026-10-07) — V7: a dish is linked to its recipe by default; run-on lines are asked about at save (`v31-standard.21`)
Jason, 2026-10-07: "follow your leans, go ahead with 2, 3, 4 and 5" (EXPO `EXPO_SUPERVISOR_READY_PLAN_2026-10-07.md` §V7). Editor only; no published artifact changes.
- **Best match first.** Both slot searches (Edit Menu and Special Meal) list recipes by `doorRecipeMatchRank`: same name, then starts with the text, then a word starts with it, then contains it (`doorRankedRecipeMatches`). They used to list in file order, so "Couscous" could sit under "Herbed Couscous".
- **Link to ….** A dish typed by hand whose name is a recipe's in all but case, punctuation, "&"/"and" or a plural (`doorNormDishName`, `doorRecipeSuggestionFor`) shows "Link to “X”? Its allergens come with it." with a Link button on its card (`_slotLinkSuggestionHTML`). Nothing links on its own; exact typed names still link on blur as before. Never on the Event Name slot.
- **Run-on lines.** Save asks when a slot reads like several dishes ("A & B", "A, B", "A; B", "A + B" — `doorRunOnSlots`), before the alternatives question and before anything is written. A slot linked to a recipe named that way (Mac & Cheese) and the Event Name slot are not asked about. This is the Wk3 WED nachos class, now caught at the source.
- **Gate:** `tests/recipe_binding_v7_gate.mjs` (5), authored red 0/5 on `main`. `door-smoke` slot-search XSS test extracts the new helpers (assertions unchanged). Suite 290/290.

## Recent (2026-10-06) — a soy-free vegan line is not labelled SOY (`v31-standard.20`)
Jason: "soy-free fried rice should not flag soy." Wk3 FRI dinner serves Chicken and Mushroom Fried Rice (soy sauce) on the regular line and Soy-Free Mushroom Fried Rice on the vegan line; `computePlatingData` copies the main meal's allergens (minus proteins) onto the vegan plate as a floor (issue #63), so the soy-free plate read SOY. `stripDeclaredFreeAllergens` drops SOY from that copied floor when the vegan line names itself soy-free (`DOOR_DECLARED_FREE`). The CODEX lookup and a stored operator statement are untouched; egg and mustard (the `_vegAltSafe` tokens) are never cleared by a name. Display only: no published artifact changes, routing counts unchanged. Gate `tests/declared_free_vegan_gate.mjs` (4); suite 285/285.

## Recent (2026-10-05) — July-22 menu workbook applied (menu data, no code)
Jason sent `4_week_rotation-CURRENT-Menus_as_of_July_22_2026.xlsx` ("only the KITCHEN sheets") and ruled: keep later DOOR calls (Jerk Tofu, Blackened Tofu, Roasted Vegetable Sandwich, the Oct 4 veg alignments); the beef burger and all-beef hotdog are halal-certified. Edited headless through the overlay save (days stamped) and published through `_doPublishToGitHub` as an already-swept device (`concAltFlagSweepV1` done — a fresh device runs the one-time alt-flag sweep, which would clear W4 FRI dinner `hasChicken`). W2 lunch order now TUE Tuna/Falafel · THU Halal Beef Burger/Veggie Burger · FRI CONC Salad (whole lunches moved with flags and slots); W3 THU All Beef Hotdog / Vegan Hotdog, Toppings, Side Salad (mustard + soy flagged); W4 THU Beef Burger / Veggie Burger, Side Salad; named veg for "Seasonal Vegetables" (W1 WED + W3 MON Green Beans, W2 SAT lunch Roasted Parsnip and Carrot, W2 SAT + W4 MON Roasted Zucchini, W3 FRI lunch Cauliflower & Green Bean); W3 SAT dinner Side Salad (was Seasonal Soup); W3 FRI dinner + Spring Roll, Bok Choy (gluten, brassicas; spring rolls carry no soy — Jason 2026-10-06; the meal's soy is the regular fried rice's soy sauce). New meals carry manual `_slots`; allergen lines regenerated with `flagsToMenuAllergens`. Suite 281/281. EXPO record: `conc-kitchen-expo/EXPO_MENU_WORKBOOK_2026-10-05.md`.

## Recent (2026-10-04) — brassicas are read from the dish text (`v31-standard.19`)
Every brassica meal (broccoli, cauliflower, cabbage, slaw, collards — 13 on the menu) carried `hasBrassicas:false`: the import's name detector never set it and no editor path did, so a No Brassicas resident was never flagged. `DOOR_BRASSICA_RE` (declared above `getMenuData`, which runs at load) is now read two ways: `nameDetectFlags` sets the flag at import, and `doorApplyTextDetectedFlags` (applied in `getMenuData`, `typeof`-guarded) adds it to any meal whose dish text names a brassica, so Menu Config, plating, routing and publish all see it. Additive only — it never clears a flag, never mutates the source (days are copied). The committed artifacts were republished headless through `_doPublishToGitHub` as an already-swept device (`concAltFlagSweepV1` done, so the one-time alt-flag sweep did not re-run): the diff is the 13 `hasBrassicas` flags (+ allergen lines); routing counts unchanged, the overlay untouched. Gate `tests/brassica_detect_gate.mjs` (6 tests); suite 281/281.

## Recent (2026-10-04) — menu sweep 2: the vegan line names the same veg as the regular line (menu data, no code)
Jason's rulings on the EXPO menu/board sweep (`conc-kitchen-expo/EXPO_SWEEP2_2026-10-04.md`): "If a veg is named for vegan but reg is seasonal, then the vegan is just being more specific, and we should align them." Edited headless through the menu editor's own save (`saveMenuBaseOverlay`, so each day is stamped for newest-edit-wins) and published through `_doPublishToGitHub` against a mocked GitHub; routing, registry summary and state regenerated by that publish. Wk1 SAT lunch_veg Peas and Corn · Wk1 FRI dinner_veg Garlic Green Bean · Wk2 MON lunch_veg "Vegan Gyro, with Naan" (Gyro Veg dropped) · Wk2 MON dinner Green Beans + "Vegetarian Peanut Stew" spacing · Wk2 TUE dinner Steamed Broccoli, vegan Rice dropped · Wk2 WED dinner_veg duplicates dropped · Wk4 FRI lunch Cauliflower & Carrot both lines, "Lagsana" dropped · Wk4 SUN lunch Steamed Carrots · Wk4 SAT lunch Steamed Broccoli both lines · Wk4 TUE dinner Peas & Carrots both lines, vegan Sweet Potato dropped · Wk4 WED lunch_veg Chickpea Rex Salad. EXPO resyncs its built-in menu to this publish in the same change set. Suite 275/275. **Found, not changed:** `hasBrassicas` is false on every brassica meal (cabbage, broccoli, cauliflower) while a No Brassicas resident is on the roster — a flag-detection gap for its own slice.

## Recent (2026-10-02) — EXPO "Fix in DOOR" opens the exact meal (`v31-standard.18`)
EXPO's "What the board needs" rows for a new dish or a batch with no consumer link to DOOR. The link now names the meal: `#menu-config/edit/<week>/<DAY>/<period>` (pure parser `doorParseHashRoute`, in the publish-validation testable core) opens Menu Config on that week, turns Edit Menu on, and opens that meal's editor. It waits for the boot menu sync (`_doorBootMenuSync`, the overlay + `menu_current.json` fetches, at most 8 s) so the editor never shows a copy of the day the cloud merge is about to replace (the Parsnip class), then clears the hash so a reload does not reopen it. A malformed link opens Menu Config alone; plain `#<screen>` links are unchanged. Gate `menu_edit_deeplink_gate` 5/5 (authored red 0/5 on `main`); suite 275/275. Plan: `conc-kitchen-expo/EXPO_BOARD_NEEDS_SMOOTHING_PLAN_2026-10-02.md` S5.

> **Older history archived (2026-10-11):** the Recent entries from 2026-06-18 to 2026-09-24/25 — security hardening and Gate-9, the standard menu cutover, the overlay contamination repair, the pork-is-never-halal guard, the veg-alt allergen floor (#63), the CODEX Nigerian/Blackened Tofu reconciliation, silent-drift slices D1–D5, recipe-attach phase 2 (`recipeId`), the device publish-resilience tier P0–P6, the D1 legacy-slot marker, the live slot commit before Save, and newest-edit-wins menu days — plus the "Open remediation line — silent drift" note, are in `docs/archive/DOOR_CLAUDE_MD_HISTORY_2026-10-11.md`. From that line, D6 (the v32 menu-text fixes) is still listed as open in the HOUSE silent-drift plan §10, but none of its five typos appear in the published `menu_current.json` as of 2026-10-11; confirm and close it there.

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
