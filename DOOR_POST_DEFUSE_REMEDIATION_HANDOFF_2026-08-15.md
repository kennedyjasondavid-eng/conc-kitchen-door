# Post-defuse remediation — pickup for a fresh session (2026-08-15)

> **Posture: small, surgical, test-and-docs only in DOOR; a mirrored data+baseline slice in
> EXPO. No DOOR `index.html` changes. Nothing here is design work — the design doc
> (`DOOR_MENU_REPRESENTATION_FOOTGUN_DESIGN_2026-08-14.md`, PR #74) stays untouched by this
> pickup except where already amended. Every claim below was verified against live `main`
> artifacts on 2026-08-15; re-verify the volatile ones (marked ⏱) before acting — Jason
> publishes from the live app and the artifacts move.**

## 1. What happened (the state you are inheriting)

Jason executed the issue-#75 Parsnip defuse in the live DOOR menu editor. Outcome, verified
against `main` (menu `_meta.exported: 2026-08-15T12:40:39.567Z`):

- **W1 TUE lunch** = `Blackened fish, Sweet potatoes, Parsnip and Carrot` — slots: main
  `Blackened fish`, veganalt `Blackened Tofu`, starch `Sweet potatoes`, vegside
  `Parsnip and Carrot`. Overlay line identical. Routing `_components`:
  `Parsnip and Carrot: 167` + `(suitable as-is): 4`.
- **W2 SAT lunch** = `Chicken Tenders, Sweet Potato, Parsnip and Carrot` — slots: main
  `Chicken Tenders`, mainalt `Halal Breaded Chicken Burgers`, veganalt `Vegan Nuggets`
  (the stray `, Roasted Yams, Parsnip/ Carrot` tail is GONE), starch `Sweet Potato`,
  vegside `Parsnip and Carrot`. Overlay identical. Routing:
  `Parsnip and Carrot: 165` + `(suitable as-is): 4`. The old vegan-only
  `Parsnip/ Carrot: 16` key is gone.
- **The ~153-portion W2 SAT under-production risk is CLOSED.** PR #72 is no longer "armed" —
  the parsnip is a slot fact and survives editor saves + publishes.
- `lunch_halal` W2 SAT = `Halal breaded chicken burgers` (unchanged — EXPO's D0.1 alignment
  gate stays satisfied). W1 TUE `lunch_flags.isSpicy: true` + `allergens_lunch: "fish, soy"`
  survived (the Blackened reconciliation facts are intact).

**Two intended menu decisions landed beyond the original defuse instructions — Jason RULED
both intended (2026-08-15):**

1. **Parsnip and Carrot REPLACES Seasonal Vegetables** on W1 TUE and W2 SAT lunch (he put it
   in the Veg Side slot rather than Extras). Seasonal Vegetables is off those two lunches.
2. **W2 SAT lunch main renamed `Chicken Tenders`** (was `Chicken tenders & Roasted Yams`).

**The publish threw 409s but landed.** Console showed `menu_overlay.json` and
`menu_current.json` 409-retry-fail; the commit log shows overlapping publish waves (12:35 and
12:37) and a final complete wave (~12:40). Mechanism: each editor save auto-publishes
(`publishAndSync` `:16923`) and `saveMenuBaseOverlay` side-publishes the overlay immediately
(`:14042`); overlapping waves race on file SHAs, and the browser caches GitHub's contents-API
responses for ≤60s so `_ghPushFileNow`'s single SHA-refetch retry (`index.html:12170-12185`)
can re-grab a stale SHA and fail loudly. A page reload (Jason's "token resync" — the token
was fine; 409 ≠ auth) cleared it. Also observed: the >70%-shrink rail refused
`recent_log.json` (`local 519b < 30% of remote 2300b`) — benign, the rail working as designed
on a device whose local recent-log is shorter than the cloud copy. **This incident is live
evidence for the HOUSE silent-drift plan's D1 slice (port EXPO's `pushFilesToGitHubAtomic`)
— record, don't fix here.**

## 2. Why work remains

- **DOOR CI on `main` is red** ⏱ (verify with an actions listing before claiming it in a PR):
  the "11 repaired slots" pin (`tests/door-smoke.mjs:1941-1984`) pins W1 TUE lunch to
  `"Blackened fish, Sweet potatoes, Seasonal Vegetables, Parsnip and Carrot"` (`:1951`) —
  the live, Jason-intended line has no Seasonal Vegetables. This is the `eee354c` class: **a
  check failing on healthy data. Re-pin the test; never revert the menu.**
- **EXPO's menu mirror is stale:** EXPO's baked fallback `MENU` + the committed fixture
  `conc-kitchen-expo/tests/fixtures/door_menu_current.json` carry the pre-defuse lines (from
  EXPO PR #231). EXPO's `menu_fixture_parity_gate` compares baked↔fixture only (no live-DOOR
  edge), so nothing is red in EXPO yet — but the mirror is wrong, EXPO schedules Seasonal
  Vegetables cooks that are off the menu, and **HUB's freshness banner will show
  `menu-content-drift` after EXPO's next publish comparison** until EXPO re-syncs, re-bakes,
  Generates, and publishes.
- Issue #75 is open with a "remediation pending" checklist; PR #74 (the design doc) is a
  draft awaiting Jason's fork rulings — this pickup does not touch its design content.

## 3. DOOR slice — re-pin door-smoke (test-only)

Branch: continue on `claude/door-menu-footguns-design-bnz1ws` (PR #74's branch), or a fresh
branch off `main` if Jason prefers the design PR to stay docs-only — **ask via the PR if
unsure; default: same branch, and update the PR body to say it now carries the re-pin.**

1. `git fetch origin main` and **merge `origin/main` into the branch FIRST.** The pin test
   reads the committed `menu_current.json`/`routing_by_meal.json` from the working tree; the
   branch forked at `f2e5877` (pre-defuse data), so without the merge the re-pinned test
   fails locally on old data. After the merge, working-tree data == live data.
2. In `tests/door-smoke.mjs`, pin #2 (W1 TUE lunch, `:1951` — line number may shift after
   merge; find the tuple by the string): change the expected string to
   `"Blackened fish, Sweet potatoes, Parsnip and Carrot"`. Rewrite the inline warning comment
   above it (`:1946-1951`): the re-apply landed 2026-08-15 as a slot fact; Seasonal
   Vegetables was **intentionally replaced** by Parsnip and Carrot (Jason-ruled); the pin
   asserts the composer's real output (the gate-#58 lesson).
3. Sweep for other stale expectations: grep the tests for `Seasonal Vegetables`,
   `Chicken tenders`, `Roasted Yams`, `Parsnip` — re-pin any assertion about these two slots
   to the live strings the same way. (Known clean as of 2026-08-15: the W1 TUE Blackened
   gate `:2084-2107` asserts `/Blackened fish/` + `^Blackened Tofu` + flags + allergens —
   all still true. The contradiction gate and allergen-consistency gate pass on live data —
   verified. W2 SAT has no pin.)
4. Run `node --test tests/*.mjs` → **70/70**. If the pin still fails, diff the expected
   string against the artifact byte-by-byte — fix the pin, not the data.
5. Commit (test-only + merged data), push with retry/backoff. Confirm DOOR CI goes green on
   the branch; note in the PR body that merging fixes the red `main` runs' cause going
   forward (the red runs on the publish commits themselves stay red in history — that's
   fine/expected).

**Do-not-touch (this slice):** `index.html` (any of it), `menu_current.json` /
`menu_overlay.json` / `routing_by_meal.json` (the merge brings them; never hand-edit —
routing regenerates from the plating engine), the design doc's options/forks sections,
`_meta.version` semantics.

## 4. EXPO slice — mirror the menu edits (schedule-affecting; full EXPO gate discipline)

Repo: `conc-kitchen-expo`, fresh branch off its `main`. This slice CHANGES THE BOARD — treat
it like the A1a resync precedent (see EXPO `CLAUDE.md` "Baseline promotion … A1a").

1. Refresh the fixture: copy DOOR's live `menu_current.json` →
   `tests/fixtures/door_menu_current.json` (the documented refresh procedure in
   `tests/menu_fixture_parity_gate.mjs` L18-22).
2. Re-bake EXPO's baked fallback `MENU` literal from the fixture (the parity gate will be red
   until baked === fixture — that red is the designed "you must re-bake" signal).
3. Expected board deltas to enumerate in the `ux_baseline` re-bless (menu-driven only):
   Seasonal Vegetables rows leave W1 TUE + W2 SAT lunch (cook + any chain/sends); W2 SAT
   lunch main renamed `Chicken Tenders` (row identity/name changes); Parsnip and Carrot
   appears on both lunches' regular lines (it was already being mirrored from PR #231 for
   W1 TUE/W2 SAT — check whether rows change or only provenance). **Every delta must be
   enumerated and menu-attributable; anything else is a stop-and-look.**
4. Gates: `menu_fixture_parity_gate` green post-bake · `ux_diff` re-blessed with the
   enumerated deltas · `menu_coverage_gate` (re-derive if menu-driven expectations shifted) ·
   full `verb-gates` · `tracer --baseline` · `ledger_gate`. Note EXPO `CLAUDE.md`'s
   cumulative-load flake list before chasing reds.
5. After merge: Jason (or a token-bearing session) does **menu sync → Generate → publish** in
   EXPO so `hub_schedule.json` reflects the new menu and HUB's freshness banner clears.
   Until then the HUB drift banner is HONEST — do not suppress it.
6. While in EXPO, note (do NOT fix in the same PR): `jerk_tofu_menu_parity_gate` is already
   red and absent from CI (pre-existing; recorded in the design doc §4/§7) — a separate
   re-pin/retire decision.

## 5. Closeout

- Tick the remediation checkboxes on issue #75 and close it as completed once BOTH slices
  are merged (DOOR re-pin + EXPO mirror) and EXPO has republished.
- The design-doc §0 outcome note and PR #74 banner are already updated (the 2026-08-15
  session); no further doc edits needed unless the slices reveal surprises — if they do,
  record them in the design doc's §7 open questions rather than silently absorbing.

## 6. Verification loop (whole pickup)

1. DOOR: `node --test tests/*.mjs` 70/70 on the branch; branch CI green; the re-pin diff is
   test-only (+ the main merge).
2. EXPO: parity gate green post-bake; `ux_diff` re-blessed with ONLY the enumerated deltas;
   full suite green.
3. Live: after EXPO republish, HUB's board banner shows no `menu-content-drift`; spot-check
   HUB `_components`-driven portion links for Parsnip (~165-171).
4. Issue #75 closed with receipts; PR #74 still cleanly reviewable for the design rulings.
