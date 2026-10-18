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
- `index.html`, single-file HTML/CSS/JS, ~20K lines. **`DOOR_APP_VERSION = 'v31-standard.37'`** + `DOOR_BUILD_DATE = '2026-10-18'` drive a staff-visible build stamp; `menu_current.json` `_meta.version` **32**, `menu_reno.json` 2. `DOOR_SCHEMA_VERSIONS.menu_current` = 32 (mirror, gate-checked).
- **Menu source truth:** Jason's July 2 workbook import, stored as `concUploadedMenu`, is the standard-menu base. `concMenuBase` is only a post-import delta layer. A standing `standardCutover` marker prunes pre-2026-07-13 overlay days at boot, daily sync, and publish pre-merge so old reno edits cannot resurrect from another device or the cloud.
- Live: https://kennedyjasondavid-eng.github.io/conc-kitchen-door/

## Architecture
- Single-file HTML; all CSS/JS inline; no build step.
- **localStorage = live state** (residents, queue, registry). The repo's JSON files are *snapshots* the push writes for the rest of HOUSE to consume.
- Screens are **tabs toggled by `showScreen()`** (`data-screen`), not routes. All UI rendered up-front.
- Recipe + allergen data fetched **live from CODEX** (`DOOR_RECIPE_DATA.json` off the recipe-hub Pages site), with CODEX's **shared Library** (`library_shared.json`, `shared-library` branch) laid over it so a recipe saved in CODEX is canon here too (2026-10-14); a baked-in snapshot is the offline fallback. **Allergen data is owned by CODEX — fix it there, never fork it into DOOR.**
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

## Recent (2026-10-18) — room 813: a discharge asks before the room leaves the anaphylactic list; list and resident changes reach the other computer (`v31-standard.37`)
Jason, 2026-10-18: "what is up with 813", then "Ask once at Generate", "Yes, in the same PR" and "After the fix, in DOOR".
- **What happened to 813:**
  - Apr 23 – Sep 11: the resident in 813 was lactose-free, no wheat, no shellfish. They were marked anaphylactic on Apr 30, with shellfish contained.
  - Sep 11: the roster catch-up import discharged them. An import's discharge (`applyQueueToRegistry`) took the resident off but left the room on the anaphylactic list. Only the one-room Discharge took the room off.
  - Sep 17: a Regular resident moved in (Joan Wandera's intake). The room was still listed, so since `.31` they read red "ANAPHYLACTIC" with nothing recorded to contain. The Oct 19 meal list still says Regular.
  - The other three listed rooms (213, 607a, 1213) still hold their own residents.
- **A discharge asks** (`doorAskDischargedAnaphRooms`, before the queue is applied in `generateFiles`):
  - "Room 813 is anaphylactic … Take it off the anaphylactic list too?" The answers are **Take it off the list** or **Keep it on the list**; Escape keeps it.
  - The answer travels on the queued change (`anaphCleared`), and `applyQueueToRegistry` takes the room off only when answered so.
  - The Review row says "on the anaphylactic list — Generate asks" (then "comes off" or "stays on"), and the queue tags it ⚠ Anaphylactic.
  - The one-room Discharge's question now says the room comes off the list too.
- **List and resident changes reach the other computer.** Adding or removing a room on the anaphylactic list, Enter Changes, the direct save, the Intake Portal and Revert never marked the list as this computer's change (`setRegistryProvenance`). Only Generate, seeding and the one-room Discharge did. So:
  - a computer whose list was just as new kept its own copy, and its next Generate sent that copy, so an anaphylactic room added on the other computer was gone everywhere, and one taken off came back;
  - a computer whose list was older than the kitchen's had its change replaced by the kitchen's list before it was sent.

  Now each of them (and Generate) first takes the kitchen's newer list if it has one (`doorTakeNewerKitchenList`: the publish preflight's read side, 6 s, never throws), then applies the change and marks it newest. A kitchen that can't be read leaves the change on this computer's list, as before.
- **Not changed (found):** notes and the compliance actions (confirm, resolve, deadlines) don't mark the list either, so another computer's Generate can undo them; Undo Generate likewise. Not anaphylactic data, so left for their own slice.
- **813 itself:** taken off by hand after this ships (Jason: "After the fix, in DOOR"): Anaphylactic List → ✕ on one computer, which now reaches the other.
- **Gate:** `tests/anaph_list_reaches_gate.mjs` (7), red 7/7 on `main` `57c92b3`. It runs the real list, queue, sync and publish-preflight code for two computers sharing one kitchen file. On `main`, a room added on one computer is gone after the other's Generate, and 813 taken off comes back. Re-pinned with a dated note: `anaph_matrix_gate` (its harness answers the kitchen check). Checked in a real browser at 1280 and 390 px: the Review row, the queue tag, the question, both answers, no page errors. The staff walkthrough is 51/51. Suite 464 → 471.

## Recent (2026-10-18) — the swap work's independent review, folded (`v31-standard.36`)
PR #128 merged (`510d25f`, `v31-standard.34`) before the review's fixes reached it, so they ship here as their own build. It took `.36`: PR #129 (the entry below) took `.35` first. The swap work itself is two entries down.
**Fixed:**
- **P1:** a computer that published before it synced sent its own, shorter revert list (and the swap) back. The full publish now merges the kitchen's swaps, special meals and both lists first (`preMergeSwapsWithCloud`, Contents API; a missing file is empty, an unreadable one is skipped), and the quiet send after a revert reads the kitchen's list first.
- **P2:** a removed special meal came back the same way. Removals keep the same kind of list (`doorMakeRevertList` makes both: `REMOVED_SPECIAL_KEYS`, published as `special_meals_removed.json`); saving the meal again takes the removal off; a past special meal stays until Clear expired.
- **P2:** a slot swap's half on the slot's second date was missed by the slot's Revert, Make permanent and the Edit Menu save, which read the next date only. They clear every upcoming swap of the slot (`doorSwapKeysForSlot`, by `_rotationSlot`).
- **Gate:** `tests/swap_revert_reaches_gate.mjs` 7 → 10 (4b publish before sync, 4c special-meal removals, 4d a slot's swaps by slot). Re-pinned: `door-smoke` (the publish merges first; + `special_meals_removed.json`), `publish_menu_ask_gate` 6 (Remove records the removal), `vegan_friendly_gate` (the stamp is `.35` or later). Suite 452 → 455; 464 with PR #129 merged in. `special_meals_removed.json` starts empty.

## Recent (2026-10-18) — a vegan-friendly main is a vegan option (`v31-standard.35`, merged via PR #129, `538a4a4`)
CODEX C8 (creation audit K4; Jason, 2026-10-17: "split the two meanings"). CODEX now works out from each recipe's ingredients whether it is **vegan-friendly** and publishes the answer beside the line, as `veganFriendly`, in `DOOR_RECIPE_DATA.json` and in each shared-Library record's `door` block. The values are `true`, `false`, or `null` while a bought item waits on its label. The line (`stream`) keeps meaning the line a recipe is made for, so EXPO's board can't move (EXPO copies CODEX fields by name and never reads this one).
- **What DOOR reads:** Edit Menu's **Vegan Alt** slot (`recipeMatchesSlotDef`) offers the vegan line's recipes, as before, plus any main CODEX marks `veganFriendly: true`. No other slot changes. The vegan plate's allergen guess (`getVegAltAllergenStr`) still reads only the vegan line.
- **Measured against CODEX's feed:** 127 recipes are true, 98 false and 15 null. The Vegan Alt slot gains exactly one recipe, Red Red Bean Stew; the other vegan-friendly mains are already on the vegan line, where CODEX's projection puts its vegan proteins. Since the review fold, Jamcaican Patty Dough leaves it (below).
- **The shared Library:** `doorSharedDoorRecord` carries the flag from the `door` block when it is true, false or null. A record saved before the flag carries none. It replaces the CODEX record whole, so the CODEX list's value never survives under ingredients it wasn't worked out from; the recipe falls back to its line. A different flag counts as a change in the overlay receipt. The 13 records shared on Oct 7/10 predate the flag, so they read by their line until their next save.
- **Offline:** the baked fallback list carries no flag, so DOOR behaves as before.
- **Vegan-plate harness** (`door_vegalt_safety_gate`, CODEX side, against this feed): 0 `_vegAltSafe` transitions, 0 vegan "contains" changes, anchor 84/84.
- **Independent review (2026-10-18), folded.** One rule, `doorNamesAnimalFamily` (in the shared-recipes core): a list that names Milk, Dairy, Eggs, Fish, Shellfish, Crustaceans or Molluscs is never vegan-friendly ("Egg and Mustard" counts as two).
  - **P1:** Option C kept a Milk label that a shorter, unconfirmed shared copy left out, but the record still took that copy's `veganFriendly: true`, and the Vegan Alt slot offered it. The overlay now clears the flag when a kept label names an animal family (receipt `notVeganFriendly`, logged).
  - **P2:** the Vegan Alt slot offered vegan-line records whose own list names Milk. It now never offers a recipe whose list names an animal family, whatever its line or flag. Today that is only Jamcaican Patty Dough (lists Milk), and no menu slot links it. The regular slots are untouched.
- **Gate:** `tests/vegan_friendly_gate.mjs` (9), authored red 1/6 on `8c4c734`; the version stamp moved to `.35` when PR #128 took `.34` first; the review fold's checks are red 4/9 on `65dd2ab`. It covers:
  - the slot rule, and the slots that don't change;
  - the overlay: the field is carried, a pre-flag record carries none, and a different flag is a change;
  - where DOOR reads the field;
  - the census against CODEX's checked-in feed: Vegan Alt gains Red Red Bean Stew and loses Jamcaican Patty Dough (skips without the sibling repo);
  - the animal-family rule, compounds included, and Option C with the flag, both ways.

  Suite 445 → 454; 461 with PR #128 merged in.
- **Cross-repo pair:** the producer is conc-recipe-hub C8 (gate `tests/vegan_friendly_c8_gate.mjs`, X2/X3 read this code). Merge this one first. Before it lands, DOOR ignores the new field, so neither order breaks anything.
- **Follow-up (2026-10-18, test-only):** the census test reads which vegan-line records name an animal family from CODEX's feed instead of pinning Jamcaican Patty Dough by name. CODEX v23 (Jason: "Follow your leans on all five") takes its stale Milk off, stamped, so it returns to the Vegan Alt slot; the test passes against the C8 feed and the v23 feed alike. Suite 461/461.

## Recent (2026-10-18) — a swap revert reaches every DOOR computer; a slot swap's halves land together; the Nov 3 swap is removed (`v31-standard.34`, merged via PR #128, `510d25f`)
Jason, 2026-10-18, on DOOR's only swap (Nov 3 lunch: Halal Beef Burger in Wk2 TUE's slot): "Remove it"; on how it happened: "Fix in DOOR". Found while scoping the EXPO swap work ("Do the EXPO swap work here").
- **The Nov 3 swap was left over.** On Oct 7 at 11:18 someone swapped Wk2 TUE ⇄ THU lunch on a Wednesday, then set the rotation back to the workbook order (TUE tuna, THU burger). That tablet ran the Make Permanent from before PR #113 (11:27 that day), which didn't clear swaps. Kept, Wk2 that week would have served burgers Tuesday and Thursday and no tuna lunch.
- **A revert never reached the other DOOR computers.** Each keeps its own copy of the swaps (`concMealSwaps`) and merged the kitchen's file into it, so the next computer to publish put a reverted swap back. Now:
  - `REVERTED_SWAP_KEYS` keeps when each key was reverted (`{key: ISO time}`; an older list of keys reads as reverted now) and keeps its Set API;
  - it is published as `meal_swaps_reverted.json`, in the full publish (`loadSwapReverts`) and quietly after each revert; it may shrink (`ALLOW_SHRINK_PATHS`);
  - `pullSecondaryState` and the boot sync read the kitchen's list before the swaps (`doorApplyRemoteSwaps`);
  - a swap made before its key's revert is dropped on every computer; one made again after it is kept (`doorSwapRevertedOver`, `doorMergeSwapStores`, `doorMergeSwapReverts`, testable core `swap-store`).
- **A slot swap's halves land together.** Each half took its own slot's next date, so a half whose slot was already served this cycle landed four weeks after the other. `doorSlotSwapDates`: the two dates are as far apart as the two meals are on the menu (the shorter way round the four weeks), on the first such pair still ahead. On Oct 7 that is Nov 3 and Nov 5; a Wk4 SAT ⇄ Wk1 SUN swap takes the coming weekend. The toast and log name the dates.
- **Data:** `meal_swaps.json` is empty and `meal_swaps_reverted.json` holds the Nov 3 key, so every DOOR computer drops its copy at its next sync. `routing_by_meal.json`'s Wk2 TUE lunch is the rotation's again (the only slot that moves); `menu_current.json` changes only its `_meta.exported`, and `door_state` / `registry_summary` take only the stamp. Validation 0/0/0.
- **Gate:** `tests/swap_revert_reaches_gate.mjs` (7), red 0/7 on `main` `8c4c734`. Re-pinned with dated notes: `door-smoke` (the publish set gains `meal_swaps_reverted.json`; the harness stubs `loadSwapReverts`), `menu_recipe_ticks_gate` (the Nov 3 swap is removed; its Beans tick stands in the recorded copy). The staff walkthrough walks the swap path with that recorded copy (`tests/fixtures/meal_swap_2026-11-03_recorded.json`): 51/51, receipts unchanged. Suite 445 → 452. Checked in a real browser: a computer holding the Nov 3 swap drops it at boot and Wk2 TUE's sheet reads tuna; an Oct 7 slot swap lands on Nov 3 and Nov 5.

## Recent (2026-10-18) — the audit's independent review, folded (`v31-standard.33`)
PR #126 merged (`a1849d2`, `v31-standard.32`) before the review's fixes and the A7–A8 write-up reached it, so they ship here as their own build. The audit itself is the entry below; the rules doc §10 is the status owner.

**The review's findings, fixed** (rules doc §10, "Independent review"):
- **P1:** editing a queued Intake Portal item lost its anaphylactic toggle and tags (the room lookup, 250 ms later, put the resident's toggle back over the item's), so a queued anaphylactic update was re-added as not anaphylactic. `editQueueItem` now looks the room up first, then puts back the item's own tags and toggle.
- **P1:** a new intake over an occupied room kept the last resident's picked anaphylactic tags, so a new peanut-anaphylactic resident was contained on coconut. The direct save and the Intake Portal now start the new resident's anaphylactic state, moderate allergy and notes fresh.
- **P2:** the Daily Entry queue editor ignored an unchecked anaphylactic toggle; it now asks once and the answer travels with the change.
- **P2:** Wk4 FRI's halal plate said PORK (a copied pork tick on the Tandoori Chicken slot); a halal plate never lists pork.
- **P2:** after 8 pm, today's swap was pruned by the UTC date and the prune published; every swap and special-meal key is the local day (`doorDateKey`), the boot sync included.
- **P2:** today's sections were worked out from the built-in resident list before the saved one loaded; they follow every load and save (`doorRefreshBaseSections`).
- **P3s:** a pre-filled toggle no longer rides to the next room; "Keep it anaphylactic" keeps the label; the file previews list 813; the diagnostics core reads the flag or the list; the import waits for review before adding No Eggs, No Mustard or No Molluscs.

**Gates:** `anaph_matrix_gate` (12) and `routing_replay_gate` (6) pin each fix (behaviour where a vm can run it, the source where it is DOM-bound); `publish_menu_ask_gate` re-pinned for `doorDateKey`. The staff walkthrough (`tests/browser/staff_walkthrough.mjs`, not in CI) is 51/51 at 1280 and 390 px, in Toronto time. Suite 445/445.

## Recent (2026-10-18) — the tags / anaphylaxis / routing audit; the import reads GF and DF; Lactose Intolerant is No Dairy (`v31-standard.32`, merged via PR #126, `a1849d2`)
Jason, 2026-10-18: "start the rules table for the audit; complete audit as autonomously as possible, ask me if you need clarification or rulings". Three owners:
- **The rules table and the audit's result:** `docs/DOOR_ROUTING_RULES_2026-10-18.md` (§10 is the status owner).
- **The plan:** `DOOR_TAGS_ANAPH_ROUTING_AUDIT_PLAN_2026-10-18.md`, all phases A0–A8 done.
- **The receipts:** `docs/DOOR_ROUTING_REPLAY_RECEIPT_2026-10-18.md`, `docs/DOOR_FLAG_RESIDENT_CENSUS_2026-10-18.md` and `docs/receipts/walkthrough_2026-10-18/`.

Every fork was ruled on its lean, in three rounds of questions. The import fixes (plan L1, L2) were built on PR #125, which merged before they reached it, so they ship here.

**The line rule.** A resident eats one plate. Every restriction the meal sets off is either served by that plate or named on its line.
- `CONFLICT_MAP` names No Spicy and Bland Diet ("not spicy"), No Beef, No Turkey and No Processed Food ("no processed meat").
- `doorSectionLineNotes` is the one note both plating renderers print. It also reads the allergens of the plate eaten (the vegan line, and now the halal line), and says "soft" for a Soft Meals resident on another plate ("Keep order, note soft"). `doorSectionAllergenStr` is the one CONTAINS chain.
- Live examples: 709 and 910 (No Spicy) get Chicken Vindaloo on the halal plate with "not spicy"; 801's spicy vegan plates say so on 19 meals; 301a (GF, Vegetarian) gets "gluten-free" on vegan sausages; 304 (Halal + No Eggs) gets "no egg" on Wk2 SAT's halal burger.

**Routing.**
- Bland Diet routes as No Spicy.
- No Mustard joins No Egg / Mustard on a mustard meal. `tagTriggers` keep No Eggs on egg only.
- No Molluscs routes like No Shellfish.

**Swap and special-meal days** (Jason: "Yes, and the routing file too"). A slot's next service routes its swap or special meal on the plating sheet and in `routing_by_meal.json` (`doorDatedMealFor` / `doorApplyDatedMeal`), and the sheet says "Swap for Nov 3 — replaces the rotation meal". On Nov 3 the sheet would otherwise have seated No Beef residents 704 and 901 on Regular for a beef burger. Swaps are keyed by the local date (`doorDateKey`); after 8 pm, today's meals read tomorrow's.

**One meal at a time** ("Per meal everywhere", "Follow plating").
- `routeResident` reads only the meal it routes.
- The Daily Entry preview, stored routes and the home count read today's meal as the sheet does (`doorTodayMealFlags`).
- The lookup card says "Today: Lunch → Soft Meals · Dinner → Anaphylactic Alternative".
- The routing file's section counts come from the plating engine. The 3 pork days with alternative meals now read Halal 54 / Soft 2, as the sheets do.

**The anaphylactic list.**
- The Enter Changes toggle read a class it never has, and on an update it started off, so every Intake Portal update took the room off the list and cleared its flag, even with the toggle on.
- Now:
  - the toggle starts from the resident;
  - switching it off asks once (`doorAskTakeOffAnaphList`), and queued changes carry the answer;
  - a Daily Entry update keeps the flag;
  - a room switch takes the list entry along;
  - the list's Remove asks and clears the flag ("List removal clears the flag").
- 813 (anaphylactic, no restriction recorded) gets a red label and a restriction-sheet row.

**Data and smaller fixes.**
- Menu ticks, as Edit Menu's save writes them:
  - Spicy on Wk1 TUE dinner;
  - Processed Meat on Wk3 SAT dinner;
  - Gluten on Wk3 WED lunch ("Flour");
  - Beans on the Nov 3 swap.
- Artifacts rebuilt: `menu_current`, `menu_overlay`, `routing_by_meal` (which now also carries 213's 9 meals, the soft days and the swap), and `meal_swaps`. `door_state` and `registry_summary` take only the stamp. Validation 0/0/0.
- Regular residents left Provisional read N/A at load (813 stays Provisional).
- `COMPLIANCE_TIERS` names GF (doc, as ruled).
- The April 27 registry patch is retired.
- A bare "and" on import isn't a question.
- The diagnostics core reads the list.

**Gates** (each red on `main` `66e0bec`):
- `tests/helpers/routing_oracle.mjs`: the reference model, written from the table.
- `tag_table_consistency_gate` (7, red 5).
- `routing_oracle_gate` (8, red 5): about 240 residents × 792 meals, with a mutation check.
- `anaph_matrix_gate` (12, red 11).
- `routing_replay_gate` (6, red 3): the published data through the real plating engine.
- Re-pinned with dated notes: `shellfish_routing_lockout_gate` (No Molluscs routes), `special_meal_flags_gate` (`doorDatedMealFlags`), `door-smoke` (the preview stub), `menu_recipe_ticks_gate` (the ruled ticks), `publish_menu_ask_gate` (`doorDateKey`).
- Browser receipts (`tests/browser/`, not in CI): the replay found 0 disagreements over 14,028 resident × meal rows; the walkthrough is 51/51 at 1280 and 390 px, in Toronto time.

**Downstream (A7).** EXPO and HUB read only the Regular, Halal and Vegan counts and `_components`, so the new labels are ignored safely, and neither reads the anaphylactic flag. **Neither reads swaps:** EXPO's board still plans the rotation meal on a swap day.

**Open for Jason:** 813 has no allergen recorded; EXPO and swaps; No Oats, Lupin and Buckwheat have no flag.

### The import fixes (plan L1, L2)
- **GF and DF are read on the resident-list import** (plan L1; Jason, 2026-10-18: "yes DF is dairy free"). `normalizeRestriction` had no rule for "GF", DOOR's own gluten-free label, and its leftover-word pass returned early for any word under 3 letters, before recording it as unmatched.
  - So "GF" was read as nothing and nobody was asked: a new resident written "GF" arrived as Regular, and "GF, No Pork" as No Pork only.
  - Re-importing today's list (real page, on `main`) proposed taking GF off all four residents whose rows say GF: 912, 1207, 613a and 301a.
  - Now:
    - GF, "G/F" and "No Gluten" read as gluten-free.
    - DF, "D/F" and "dairy-free" read as No Dairy ("Dairy Free" was read only by the fuzzy pass).
    - An unknown short word is asked about. Joining words and the stray "No" the comma expander leaves (`IMPORT_SHORT_NOISE_RE`) are not.
  - The same re-import proposes no GF removal. Its only proposals are No Dairy for 1207 and 301a from "Lactose Intolerant" (plan L2, ruled below). Of the 45 published restrictions, the only ones that parse differently are the four with GF, which gain it, and none asks a question. Stored resident data is unchanged.
- **Lactose Intolerant is No Dairy too** (Jason, 2026-10-18: "Lactose intolerant should be no dairy too"; plan L2). It already opened the No Dairy section, and the import's parser already gives both tags. Two rules still read it apart, and both are aligned now:
  - the conflict check: `RESIDENT_TO_MEAL_FLAG` gains Lactose Intolerant → `hasDairy`;
  - the plating-sheet note: "dairy-free" for both, so a resident with both tags reads it once (it was "no dairy" vs "dairy-free").
  - **Documentation follows Lactose Intolerant** (Jason, 2026-10-18: "yes, follow your lean"). The import no longer adds No Dairy for "lactose intolerant": every rule already reads it as No Dairy, and the added tag was doc-tier, so a lactose-intolerant row needed documentation that Lactose Intolerant alone (auto) does not. A row that writes "No Dairy" (412, 1115a) still gets it and keeps its documentation.
  - The one Lactose Intolerant rule now reads the whole phrase, with or without the expander's "No", and "intolerance" too. Matching "No Lactose" alone had left "Intolerant" as a question.
  - The import's section guess reads Lactose Intolerant as No Dairy. Adding it on import waits for review like No Dairy (`MODIFIER_AUTO_ROUTING`), since it changes routing.
  - No stored record is rewritten. Re-importing today's list (real page) now proposes nothing at all. On `main` it proposed taking GF off four residents and adding No Dairy to two.
  - Lactose intolerance stays out of the anaphylactic picker.
- **Import gates** (authored red on `9cf22d9`, still red 12/14 on `main` `66e0bec`):
  - `restriction_short_codes_gate` (6, red 5/6; the sixth is the whole-word lock): GF / DF however written, no over-reading, short words asked, every published restriction, and the import's diff.
  - `lactose_no_dairy_gate` (8, red 7/8; the routing lock passes on `main`): every No Dairy rule reads Lactose Intolerant alike, the conflict, the one note, the import's tags and section guess, the documentation tier, review on import, and no proposals on today's list.

  Suite 397 → 411; with the audit, 397 → 445.

## Recent (2026-10-18) — a shellfish meal routes and contains like a fish meal; every anaphylactic tag DOOR can flag is contained (`v31-standard.31`)
Jason, 2026-10-18: "follow your lean on routing and lockout", on the `v31-standard.30` finding (the entry below), then "clean up anything else you see here before merging this pr" and, on anaphylactic tags, "every tag with a flag". Since .30 a CODEX shrimp or mussel recipe sets `hasShellfish` on its meal, but routing, lockout, special meals and the workbook import still keyed seafood on `hasFish` or dropped it.
- **Routing:** `ROUTING_RULES` `no_fish` ("No Fish / Shellfish") triggers on `hasFish` or `hasShellfish`. As on a fish meal, No Fish and No Shellfish residents move to the vegan plate. No Molluscs is still not a routing tag (warned and contained, not routed).
- **Anaphylactic containment:** `ANAPH_TAG_TO_MEAL_FLAG` lists every flag per tag, read through `anaphTagMealFlags(tag)` by all five readers: `routeResident` (the Anaphylactic Alternative), `getAnaphConflictRooms` (lockout and roommates), `getAnaphAlertInfo`, and both filters in `getAnaphDisplayAllergens` (the plating sheet's and anaphylactic list's allergens).
  - No Shellfish and **No Molluscs (new)** are contained on `hasFish` or `hasShellfish`; older menus ticked seafood as Fish.
  - **Every other tag the anaphylactic picker offers** (`populateAnaphTags`) now contains on its own flag: Tree Nuts, Soy, Sesame, Mustard, Sulphites, Eggs, Coconut, Nightshades, Beef. Before, ticking one did nothing, though the tier note says allergen flags "also trigger room-level containment". No Oats can't: DOOR has no oats flag.
  - Peanuts, Fish, Dairy and GF are unchanged.
- **Week-ahead conflict list:** its red "Peanuts — ANAPHYLACTIC" line (every anaphylactic resident, peanut meals) stays as it was. `doorAnaphMealLines` adds a red line per other anaphylactic tag a meal sets off ("Tree Nuts — ANAPHYLACTIC · 213"). The unused `flaggedResidents` there is gone.
- **Special meals** (`special_meals.json` is empty today):
  - the Crustaceans / Molluscs / Wheat boxes set keys nothing read; one **Shellfish** box replaces the first two, Fish is fish, and Gluten covers wheat (`SM_ALLERGENS`);
  - `getMealForDate`'s `resolveFlags` read nine keys back; it now reads every box, and older records' retired boxes count as Shellfish / Gluten;
  - a saved special meal carries every flag its main-meal slots carry as `_flagsRaw` (`smMealFlagsRaw`; the boxes still decide their own keys), so a linked recipe's coconut, nightshades or chicken arrive; a displaced rotation meal keeps all its flags (`doorMealFlagsOf`).
- **Workbook import:** the Intake allergen row (`ALLERGEN_FLAG_MAP`) reads crustaceans, molluscs and their foods as Shellfish; the dish name (`nameDetectFlags`) reads shrimp, prawns, mussels, crab, lobster, calamari, oyster sauce… (not an oyster mushroom), and "seafood" as fish and shellfish. No published dish names shellfish.
- **Plating-sheet notes (`CONFLICT_MAP`):** "no molluscs" for No Molluscs on a shellfish meal; the duplicate No Coconut row is gone; and **the gluten row read the tag "Gluten Free", which no resident has (the tag is GF), so it never fired**. It now does: GF residents outside the GF section get "gluten-free", and the Today and week-ahead lists gain a Gluten line, as No Dairy's and No Fish's already do.
- **Tidy:** the Shellfish tick's tip names crustaceans and molluscs; a stale "19-key" comment.
- **One anaphylactic rule everywhere** (Jason, 2026-10-18: "213 should have the flag act accordingly"). DOOR holds "anaphylactic" twice: `r.isAnaph` and the anaphylactic room list (`anaphRooms`). Lockout, the alert, plating and the Anaphylactic List read both. But the restriction sheet, both label outputs (xlsx and print), the file previews, the week-ahead peanut line and `registry_summary`'s count read only `isAnaph`. Room 213 is on the list, but an import reset its flag, so it was contained yet never red, though the toggle promises "Flags red on all sheets".
  - `doorIsAnaphResident(r)` (the flag or the list) is now the only rule, read by every one of those readers.
  - A **revert never takes a room off the list** (`revertResident`); only the editor's checkbox or the list's Remove does.
  - Live: 213 is red with "⚠ ANAPHYLACTIC" on the restriction sheet and its label. The published anaphylactic count goes 2 → 4, matching the Anaphylactic List: 213, 813, 607a, 1213. 813 has no restriction, so it shows only in the count. Stored resident data is unchanged.
- **Live effect** (published menu, overlay and resident list):
  - **Room 213** is on DOOR's anaphylactic list (H&W, April 22) with **Tree Nuts and Coconut** as its anaphylactic tags, which were never contained. It now gets the Anaphylactic Alternative, the anaphylactic alert and red week-ahead lines on the 9 published meals with tree nuts or coconut: Wk1 MON / WED / FRI dinner, Wk2 MON / WED dinner, Wk3 TUE dinner, Wk3 FRI lunch, Wk4 MON / SAT dinner. Plating sheets, labels and `routing_by_meal.json` count it per meal, so at the next publish 213 moves from its section to "Anaphylactic Alternative" on those meals. The room lookup and the home screen's headcount read the whole day, as they do for peanuts. Nothing else moves for anyone else.
  - The gluten note, as above. Shellfish routing changes nothing today (0 meals carry `hasShellfish`).
- **Gates** (all authored red on `main` `9cf22d9`):
  - `shellfish_routing_lockout_gate` (9, red 5/9): routing, shellfish/mollusc containment, the molluscs note; re-pinned the same day for the nine tags; also no duplicate row, and every row names a real tag;
  - `anaph_every_tag_gate` (7, red 0/7): each of the nine contained and alerted on its own flag only; the picker's every flaggable tag is in the map (No Oats the one exception); the week-ahead lines; and the exact live receipt above (only room 213 moves, on its 9 meals);
  - `special_meal_flags_gate` (6, red 0/6);
  - `workbook_shellfish_words_gate` (5, red 3/5).
  - `anaph_flag_everywhere_gate` (5, red 4/5; the fifth pins the published data).

  Suite 365 → 397. Checked in a real browser (offline boot) with the published residents: room 213 contained and alerted on a coconut meal and no one on a plain one; its printed label red with "⚠ ANAPHYLACTIC"; a shrimp-curry special meal keeps Shellfish, Tree Nuts and Coconut and routes No Shellfish to the vegan plate; no page errors.
- **Open for Jason:**
  - **Room 813** is on the anaphylactic list with no allergen recorded (tags: Regular), so DOOR can't contain anything for it.
  - The GF tag isn't in `COMPLIANCE_TIERS` (it lists "Gluten Free"), so GF counts as doc-tier, not the auto-tier its note says. Left as is: doc-tier is the safer default.
  - No Oats has no meal flag, and CODEX's Oats label is ignored; DOOR has no flag for Lupin or Buckwheat.
  - The Special Meal grid still shows the priority allergens only (the other flags travel unseen).
  - **Full audit planned:** `DOOR_TAGS_ANAPH_ROUTING_AUDIT_PLAN_2026-10-18.md` (Jason, 2026-10-18: "Plan a full audit to test all tags and anaphs"). Its first finding, "GF" parsed to no tag, is fixed in `v31-standard.32` (the entry above).

## Recent (2026-10-18) — CODEX's Crustaceans and Molluscs labels tick Shellfish (`v31-standard.30`)
Food-safety gap found in review (2026-10-18). CODEX's reader files shrimp, prawn, crab, lobster and krill under **Crustaceans**, and clams, mussels, oysters, scallops and squid under **Molluscs**. So Check & save writes "Crustaceans (Shellfish)" or "Molluscs (Molluscs)", and two CODEX templates (Thai Basil Chicken, Bò Lúc Lắc) already carry "Molluscs (Oyster Sauce)". A Save on a connected tablet is canon, and its `door` block brings those labels here. `HUB_ALLERGEN_MAP` had only 'Shellfish'. Linking such a recipe set no `hasShellfish`, only an unmapped-label warning, so a No Shellfish or No Molluscs resident was not warned. No published recipe carries either label today, so no live meal changes.
- **What changed:** 'Crustaceans' and 'Molluscs' map to `hasShellfish`, the flag No Shellfish and No Molluscs residents already share (`RESIDENT_TO_MEAL_FLAG`). The editor preview shows a "crustaceans" or "molluscs" chip, because it reads the same resolver. It only ever adds a warning.
- **CODEX keeps its two families** rather than writing "Shellfish". They are separate allergies (DOOR's own intake has No Shellfish and No Molluscs), CODEX's reader, anaphylaxis triggers and vegan free-from rule use them, and DOOR reading both as its one flag is the same pattern as Milk → Dairy and Tomato → Nightshades.
- **Gate:** `tests/shellfish_families_gate.mjs` (9), authored red on `main` `910fb7c` and `0aedaf0`: 7/9 fail with the sibling recipe-hub checked out (6/9 without it, since the CODEX data-layer check skips). It covers:
  - both labels as CODEX writes them, plus case and compounds;
  - the unmapped surface (Lupin and Buckwheat are still surfaced) and the preview chips;
  - the No Shellfish and No Molluscs conflicts (No Fish is untouched);
  - that only Shellfish moves across the baked list, the CODEX feed, and every seed and template list in CODEX;
  - a table of every family CODEX's reader writes.

  Suite 356 → 365. Checked in a real browser (offline boot): no page errors, and both labels set only Shellfish.
- **Cross-repo pair:** conc-recipe-hub `tests/one_allergen_source_gate.mjs` re-pins its copy of this map (P3a) and adds P3c/P3d (every family CODEX's reader writes, and every template's label, is one DOOR reads). Merge this one first; until both are in, P3a reads red on a machine with both repos.
- **Open for Jason** (not changed; none is live, since 0 meals on the published menu or the overlay carry `hasShellfish`):
  - A meal with `hasShellfish` but no `hasFish` (a shrimp dish) doesn't open the "No Fish / Shellfish" section (`ROUTING_RULES` `no_fish` triggers on `hasFish` only).
  - Anaphylactic room containment reads No Shellfish as `hasFish` (`ANAPH_TAG_TO_MEAL_FLAG`), and No Molluscs has no containment entry and no plating-sheet note (`CONFLICT_MAP`).

  So on a shrimp-only meal a No Shellfish resident is warned (the Generate conflict and the Regular plating-sheet note), but gets no alternative plate, and an anaphylactic one gets no room lockout or anaphylactic alert (`getAnaphConflictRooms` and `getAnaphAlertInfo` read the same map). Lean: `hasShellfish` also triggers `no_fish`, and containment checks `hasFish` or `hasShellfish` for both No Shellfish and No Molluscs. **Done in `v31-standard.31`** (the entry above).
  - Minor: the menu-workbook reader (`allergenStrToFlags`) knows only shellfish, shrimp and crab, and DOOR has no flag for Lupin or Buckwheat (both stay on the unmapped banner). (Workbook: done in `v31-standard.31`.)

## Recent (2026-10-18) — bouillon carries no Gluten: three linked vegan dishes drop the Gluten they captured (menu data, no code)
Jason, 2026-10-17: "no gluten in boullion we use currently". CODEX v22 (conc-recipe-hub PR #155) takes "Gluten (Bouillon)" off its recipes, stamped. A linked dish keeps the flags it captured at link time, so three vegan dishes linked in `v31-standard.29` would have gone on saying GLUTEN:
- Vegetarian Peanut Stew (Wk2 MON dinner, linked to African Peanut Chicken Stew);
- Vegetarian Vindaloo (Wk2 TUE dinner, Vegan Vindaloo);
- Caribbean Chickpea Curry (Wk3 TUE dinner, Caribbean Stew).

Their only Gluten came from that label: none had slots before the link. Each loses its `hasGluten` flag and keeps every other flag.
- **How:** written through `saveMenuBaseOverlay`, so the three days are stamped, then rebuilt with the publish builders. Only those three slots and the menu's `builtFromMenu` stamp change; `door_state` and `registry_summary` take only the stamp. Meal text, meal ticks, routing counts and validation (0/0/0) are unchanged.
- **Kept on purpose:** the falafel sandwiches (bread), White Chilli Pasta Casserole (pasta) and Vegan Arroz con Pollo (an Edit Menu tag set before it was linked) keep Gluten.
- **Plates against the v22 CODEX feed** (real DOOR, published menu and overlay): Wk2 MON dinner and Wk2 TUE dinner lose GLUTEN/WHEAT. Wk3 TUE dinner keeps WHEAT from the regular meal's tick (naan). 0 `_vegAltSafe` changes.
- **Order doesn't matter:** against today's v21 feed the plates keep Gluten through the recipe lookup, so this never drops a warning before CODEX v22 is on Pages.
- **Caribbean Stew's shared copy:** ~~the shared Library still lists "Gluten (Bouillon)" for Caribbean Stew (Bloor, Oct 7), and DOOR lays it over the feed.~~ Fixed 2026-10-18 (Jason: "Write to shared library on Caribbean stew"): one shared save without it, the Gluten removal stamped (`shared-library` `129e8f7`), so DOOR's overlay drops it.
- **Gate:** `tests/bouillon_gluten_slots_gate.mjs` (3), authored red 1/3 on `910fb7c`. The feed check skips against a CODEX feed older than v22. Suite 353 → 356.

## Recent (2026-10-17) — the vegan plate reads the dishes set on the vegan line; 47 vegan dishes linked or tagged (`v31-standard.29`)
The vegan plate's allergen line (its CONTAINS on the plating sheet, and the No Egg / No Mustard check) came from a guess. `getVegAltAllergenStr` fuzzy-matches the vegan line's TEXT against vegan-stream CODEX recipes, and the main meal's ticks make the floor.
- **The gaps.** Only 6 of the 56 lunches and dinners linked a vegan dish to a recipe, and a link was never read. About half the other names matched nothing ("Citrus Tofu", "Vegan Tenders") or the wrong recipe ("Roast Potato and Tofu Hash" → Roast Tofu). The tags supervisors set in Edit Menu were never read either, so six tofu or vegan chik'n plates didn't say Soy.
- **Found by** the CODEX creation audit (conc-recipe-hub PR #154). Jason, 2026-10-17: "Rexdale falafel", then the vegan-dish list on the leans. His answers: the tenders are Gardein (soy and gluten), the black bean patty is Vegan Bean Patties, the chickpea drumstick is Rex's chickpea drums, the pizza is bought, and the jackfruit sandwich is just jackfruit and aromatics.
- **Code: `getVegAltSlotAllergenStr(slots)`.** It reads each vegan-plate slot (vegan alt, starch, veg side, extras: the slots `buildVegAlt` reads).
  - Every slot brings its own tags, which is what the editor's preview already showed: the flags captured at link time plus Edit Menu tags.
  - A linked slot also brings its recipe's allergens from today's CODEX list, found by `recipeId`, else by name.
  - It joins the name guess inside `mergeVegAltAllergenFloor`, so it only ever adds. A stored operator statement still wins, and `_vegAltSafe` reads the merged line. As with meal ticks, a linked dish keeps what it captured.
- **Menu data (the confirmed list).**
  - 37 vegan dishes link to their CODEX recipe and still show the menu's words (`displayText`); two of those are the falafel sandwiches.
  - 10 dishes with no recipe carry tags: Soy on the tofu dishes and the vegan hotdog, Soy and Gluten on the three Gardein tenders, Mushroom on the portobello.
  - Left alone: the two Roasted Vegetable Sandwiches, the jackfruit sandwich, the pizza and the Chickpea Rex Salad.
  - 21 meals that were only menu text get slots the way `openMenuEdit` reads them.
  - On all 41 meals touched, the main dish carries the meal's ticks, as the editor does on every open. Without that, a fresh tablet's one-time `sweepAltFlagPollution` would read a tick the vegan dish also carries as vegan-only and take it off the regular plate (11 meals, e.g. Gluten on Wk2 THU's burger lunch). This also closes the one meal that was already exposed: Wk4 FRI dinner's Chicken.
  - A link keeps the dish's earlier tags (Mushroom on Vegan Mushroom Carnitas).
  - Written through `saveMenuBaseOverlay` (days stamped) and rebuilt with the publish builders. Only `_slots` change: meal text, meal ticks, routing counts and validation (0/0/0) are unchanged. `door_state` / `registry_summary` take only the new `builtFromMenu` stamp.
- **Plates against today's live DOOR** (published menu, CODEX feed, real browser): 20 vegan plates gain warnings, none lose one, and no meal changes `_vegAltSafe`.
  - Soy: Wk2 WED dinner, Wk2 SAT lunch, Wk3 THU dinner, Wk4 FRI dinner, Wk4 SAT lunch.
  - Soy and Gluten: Wk4 TUE dinner (BBQ Chik'n Tenders).
  - Falafel: Nightshades and Spicy on Wk2 TUE lunch, Spicy on Wk4 MON lunch.
  - Wk3 WED lunch's vegan nachos gain Soy, Gluten, Sulphites and Spicy.
  - Vegetarian Fajitas gains Soy and Spicy; Veggie lasagna gains Soy and Sulphites; Vegan Arroz con Pollo gains Soy and Gluten.
  - Mushroom: Wk1 TUE dinner, Wk3 MON dinner, Wk4 SAT dinner; Mushroom and Beans: Wk3 SUN dinner.
  - Gluten from bouillon on the peanut stew and the vindaloo (CODEX still listed it then). Ruled 2026-10-17; it comes off with CODEX v22 and the 2026-10-18 entry above. Also Nightshades on the black bean patty and Oats on the pot pie.
  - Rexdale Falafel's Nightshades comes from CODEX v21 (#154); until that is on Pages, Wk2 TUE gets Spicy and Gluten from the feed.
- **Gate:** `tests/vegan_plate_dishes_gate.mjs` (8), authored red 0/8 on `a295eca`. It covers the reader, the wiring, every link and tag, the fresh-tablet sweep over the whole overlay, the offline baked list and the CODEX-feed census.
  - Re-pinned with dated notes: `declared_free_vegan_gate` and `door-smoke` "routes the veg-alt lookup through the floor".
  - Suite 345 → 353.
- **Open for Jason:**
  - ~~Gluten on both falafels, though the recipes use GF flour.~~ Jason, 2026-10-17: "no gluten on wheat-free falafel". CODEX v22 takes it off, stamped (conc-recipe-hub PR #155). The falafel sandwich plates keep Gluten from the bread.
  - ~~Wk4 MON's regular lunch has a Nightshades tick the chicken ranch sandwich probably doesn't have.~~ Jason, 2026-10-17: "nightshades should be ticked on wk4 mon lunch (peppers in chicken salad)". The tick stays.
  - The jackfruit plate still says Soy from the name guess (over-warns only).
  - CODEX has no Mushroom or Beans family, so a linked recipe can't carry them (lean: add both families in CODEX).

## Recent (2026-10-16) — a Tree Nuts label that names coconut ticks Coconut; menu ticks follow the recipes; a No Spicy resident always has a plate (`v31-standard.28`)
CODEX writes coconut on 12 recipes only as a Tree Nuts label — `"Tree Nuts (Coconut, Coconut Milk)"`, `"Tree Nuts (Coconut)"` (Butter Chicken, Butter Chickpeas, Massaman and its paste, Adobo, African Peanut Chicken Stew, Caribbean Stew, the Thai green curry sauce and paste, Atakilt Wat, Coconut Drop Cookies, Vegan Pumkin Pie). `_hubAllergenResolve` reads the text before "(" as the family, so linking one of those recipes to a menu meal set `hasTreeNuts` but never `hasCoconut`, and a No Coconut resident (`RESIDENT_TO_MEAL_FLAG` → `hasCoconut`) was not warned. Only a bare "Coconut" label set it.
- **Ruling** (Jason, 2026-10-16: "Go ahead with both", on the coconut flag lean): a Tree Nuts label whose "(…)" detail names coconut also sets Coconut. It only ever adds a warning.
- **What changed:** `_hubAllergenResolve` adds `hasCoconut` (and `coconut` to the shown labels, so `_allergenPreview` shows the chip) when a part resolves to `hasTreeNuts` and the label's detail matches `\bcoconuts?\b`, case-insensitive. "Tree Nuts (Almonds)" stays Tree Nuts only; bare "Coconut", "(source)" stripping, compound splitting, the ignore set and the unmapped-label surface are unchanged.
- **Menu meals already linked keep the flags captured when they were linked** (as before): this applies at the next link or re-save of the meal. The vegan-plate label from `getVegAltAllergenStr` still reads the family only ("TREE NUTS"); it is a label and decides only the egg/mustard `_vegAltSafe` check, so it is unchanged.
- **Gate:** `tests/tree_nuts_coconut_gate.mjs` (8), authored red on `main` `b380cc5` — 6 fail, 2 pass (the two that lock what must not change): the ruled labels, Tree Nuts without coconut, bare Coconut / None / empty, compounds and the unmapped surface, the preview chip, and every recipe naming coconut in the baked list and the sibling CODEX feed sets Coconut with no other flag moving. Re-pinned with a dated note: `recipe_attach_allergen_norm_gate` "back-compat" (it asserted the Coconut flag must NOT come from the detail; the over-split guard now stands on "Tree Nuts (Almonds, Cashews)"). Suite 330 → 338.
- **Menu ticks follow the recipes (data).** DOOR checks residents against each meal's ticks, which came from the July workbook, so some meals were behind the CODEX recipe they serve (W1 FRI Pork Adobo had no Soy or Coconut tick). Jason, 2026-10-16, on the meal-by-meal list: "assume no gluten in boullion or soy, otherwise follow leans"; Spicy "leans look good"; Vindaloo is made with the Vindaloo Sauce, Caribbean Chicken Curry is the Caribbean Stew, Fish Curry is fish with the green curry sauce; the Sweet Potato Biscuit is left (provenance unknown). 57 ticks on 22 days (4 more were already on), regular line and shared sides only (the vegan plate reads CODEX by name), added through `saveMenuBaseOverlay` (days stamped, newest edit wins) and rebuilt with the publish builders; `door_state` / `registry_summary` keep their content and take only the new `builtFromMenu` stamp. Plates move on 6 meals: Gluten Free on W2 SAT (meatloaf panko), No Egg/Mustard on W2 SAT and W4 MON (mayo), the vegan plate for No Dairy on W1 SAT (ghee), Bland on W1 SAT, W2 MON, W2 TUE, W2 WED (spicy). Validation 0/0/0. Gate `tests/menu_recipe_ticks_gate.mjs` (2): each confirmed tick stays while its dish is on the meal.
- **A No Spicy resident always has a plate (code).** On a pork day `computeSections` seats Bland / No Spicy residents with Gluten Free; when nothing on the meal is gluten that section isn't active, so they went into a pool nothing printed. Resident 310b had no plate at W3 THU dinner, W4 TUE lunch and W4 FRI dinner on the published menu, and the Vindaloo Spicy tick would have added W2 TUE. They now join Gluten Free only when it is active, else keep Bland. Gate `tests/pork_day_bland_gate.mjs` (5), red 3/5 on `b380cc5`: every resident seated across 256 flag combinations and at every meal of the published menu. Suite 338 → 345.

## Recent (2026-10-14) — DOOR reads CODEX's shared Library: a saved recipe is canon (`v31-standard.27`)
Jason, 2026-10-14: "I want a new recipe I make or an edit to an existing one to change what anyone that visits DOOR sees as the canon recipe … I want the day-to-day to be pretty friction free." Writes stay gated by the CODEX connection key (PAT); readers need nothing.
- **What changed.** After loading `DOOR_RECIPE_DATA.json` (live → cached → baked), DOOR also loads `library_shared.json` from the conc-recipe-hub **`shared-library`** branch (`DOOR_SHARED_LIBRARY_URL`, raw, cache-busted + `no-store`, 8 s, offline copy in `door_shared_library_cache`). `doorOverlaySharedRecipes(base, shared)` (pure, testable core `shared-recipes`) lays it over the list: a new recipe is added, an edit replaces. **A removal (tombstone) never takes a recipe off the CODEX list** — CODEX tablets keep their built-in recipes on a removal too; a recipe only the shared Library added is gone because its record has become the removal. Names match without case; an existing recipe keeps its `recipeId` (menu slots link by it); a rename adds the new name and leaves the old one for slots that still name it. `_doorApplySharedRecipes()` rebuilds `DOOR_RECIPE_DATA` from both inputs whichever lands second; the receipt is on `window.__DOOR_SHARED_RECIPES__` and the CODEX badge tooltip.
- **DOOR reads only each record's `door` block** `{recipeName, allergens, category, stream, recipeId?, removedAllergens?}`, which CODEX writes with the same projection as `DOOR_RECIPE_DATA.json` — DOOR never interprets CODEX fields. A record without one (written before this change) is left out and the CODEX list's version stands. Only an explicit `stream: 'vegan'` is vegan.
- **Option C — an allergen removal travels only with its confirmation** (Jason, 2026-10-14: "go with C"). A replaced recipe gets the shared list **plus** every allergen DOOR's list had that the shared version leaves out, unless its family is in `door.removedAllergens` — which CODEX writes only when someone pressed "Remove and save" at the review Save. Families compare by the text before " (" without case (`doorAllergenFamily`); "None" is never kept over a real allergen. So a correction reaches DOOR, and an old copy shared from a forgotten tablet (the card "share"/"retry" path, which asks nothing) can never strip a warning. Kept allergens are listed in the receipt's `keptAllergens`.
- **Cross-repo pair:** the producer is conc-recipe-hub (`_cxSharedLibraryRecordFromEntry` adds `door`; contract `docs/CODEX_SHARED_LIBRARY_CONTRACT.md`; gate `tests/save_is_publish_gate.mjs`). Menu slots keep the allergen flags captured when they were linked; a recipe edit does not rewrite a published meal's `_flags`.
- **Gate:** `tests/shared_library_overlay_gate.mjs` (10 — two for Option C), authored red on `main`. Suite 320 → 330. Checked in a real browser: against the live shared file (its 13 pre-change records carry no `door` block) DOOR shows 240 recipes, unchanged; against the 13 rulings (Jason, "follow your leans") it shows 241 — Southeast Asian Spice Mix added, Moroccan Rice with Nightshades, the other ten identical (counted `unchanged`, not updated).

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
