# Session Handoff — 2026-05-18

**Scope:** Full HOUSE ecosystem review + DOOR anaph marker fix + HOUSE env badges across all 4 apps + strategic forward planning.
**Branch:** All work on `claude/review-apps-architecture-QTaQA` in all 4 repos. Production `main` untouched.

---

## What's ready to merge

| Repo | Commits | Net effect |
|---|---|---|
| conc-kitchen-door | `c1e1e45`, `5504e6f` | HOUSE env badge + anaph marker fires across all sections |
| conc-recipe-hub | `848a05c` | HOUSE env badge |
| conc-kitchen-hub | `5c3bdde` | HOUSE env badge + builder template + deploy populator |
| conc-kitchen-expo | `abf7071` | HOUSE env badge |

**Merge each repo when convenient:**
```
cd <repo>
git checkout main && git pull
git merge --ff-only origin/claude/review-apps-architecture-QTaQA
git push origin main
```

GitHub Pages auto-deploys ~60s later (HUB via Actions; others via default branch publishing).

---

## What changed: HOUSE env badge (all 4 apps)

Small self-contained `<script>` block before `</body>` in each app's main HTML. Behavior:
- Bottom-right badge: `App · Version · Environment` + branch/SHA/build-time (when `build_info.json` populated) + today's date
- Non-PROD: `[DEV]` / `[LOCAL]` prefix on `<title>`, 3px red top border
- Environment detected from URL (PROD = github.io; DEV = `-dev`/`-staging`/`-preview`/`-next`; LOCAL = file://)
- Click badge to dim (sticky for session)
- Gracefully degrades if `build_info.json` is absent

**Why:** addresses the "active vs dev" mental load — every tab visibly indicates which environment is being viewed.

**HUB-specific:** the badge template is canonical in `builder_core.js` (`HOUSE_ENV_BADGE` constant) so regeneration via the Hub Builder preserves it. `deploy.yml` regenerates `build_info.json` with live branch/SHA/timestamp per deploy.

---

## What changed: DOOR anaph marker fix (`5504e6f`)

### The bug

The `⚠ ANAPHYLACTIC` marker on plating sheets was tied to *section assignment*, not to whether the resident's anaph allergens are actually present in the meal. Residents whose anaph allergens weren't in the narrow `ANAPH_TAG_TO_MEAL_FLAG` table (peanuts/fish/dairy/gluten) were never promoted to the Anaphylactic Alternative section, so they never got the marker — even when the meal contained their allergen.

**Real-world impact:** room 213 is anaphylactic to coconut + tree nuts. Neither is in `ANAPH_TAG_TO_MEAL_FLAG`. On meals containing tree nuts (e.g. W2 WED Yetisse Fish), 213 stayed in Soft Meals section with a normal "no tree nuts" dietary note — no `⚠ ANAPHYLACTIC` marker, no "prepared separately" instruction. 213 was safe only incidentally because Soft Meals happened to avoid the allergen, not because the anaph routing fired.

### The fix

New helper `getAnaphMarkerForResident(r, mealFlags)` at `index.html:7631`. Uses the broader `RESIDENT_TO_MEAL_FLAG` table (line 7465) which already covers the full Health-Canada priority allergen list. Called from two row emitters that previously had no marker:
- Special-meal sections forEach at `index.html:16953` (Vegan, Soft Meals, GF, Diabetic, etc.)
- Regular-meal-with-notes forEach at `index.html:16984`

The dedicated Anaphylactic Alternative emitter at line 16857 is **untouched** — existing markers there continue to work as before.

### Risk profile

**Strictly additive.** Markers can appear where today there are none; no marker can disappear. No resident moves between sections. No routing logic changes. Worst case is a false positive (marker fires when it shouldn't) — which is the safe-error direction for life-safety code.

### Validation

Driven headlessly in Chromium with live data from `origin/main` injected (since the network is closed in the cloud sandbox). Generated W1 and W2 dinner XLSXes from the fixed DOOR. Compared row-by-row to the production XLSXes the user uploaded.

**Verified:** room 213's W2 WED Yetisse Fish row gains `⚠ ANAPHYLACTIC (TREE NUTS) — prepared separately`. Other 213 rows, all other residents, all section assignments, all section totals: unchanged.

---

## Open finding: DOOR menu hydration drift

**Surfaced during anaph fix validation.** DOOR's runtime `MENU_DATA` does not fully match the live `menu_current.json` on disk.

| Source | W1 MON dinner | `hasCoconut`? |
|---|---|---|
| `menu_current.json` (live) | "Jerk Chicken, **Rice and Beans, Cabbage Stirfry**" | **true** |
| DOOR runtime `MENU_DATA` | "Jerk Chicken, **Cabbage Stirfry, Rice and Beans**" | **absent** |

Different word order; different flag set. The embedded `MENU_DATA` is older than the live file and isn't being fully merged at boot.

**Impact:** the anaph marker fix was expected to fire on 7 dinners (W1 MON, W1 WED, W2 MON, W2 WED, W3 TUE, W4 MON, W4 SAT — all containing coconut and/or tree nuts per `menu_current.json`). Only W2 WED actually fires because runtime data lacks the flags on the other six. Once menu hydration is fixed, the remaining 6 markers light up automatically with no further code changes to today's fix.

This is a **pre-existing bug**, not introduced by today's work. Production XLSXes have the same gap.

**Suggested next-session entry point:** trace the boot path for `MENU_DATA` initialization in `index.html`. Find where `menu_current.json` is fetched and whether it overwrites `MENU_DATA` or merges only specific fields. Likely missing: a full deep-merge of `dinner_flags`, `lunch_flags`, `breakfast_flags` from the live file.

---

## Punch list (next sessions, prioritized)

### High (life-safety, security, sustainability)
1. **DOOR menu hydration** — direct continuation of today's anaph fix. Unlocks 6 more anaph marker firings without further code changes to the fix itself. ~60–120 min.
2. **HUB shared GitHub PAT** in `localStorage.conc_gh_token` — single PAT across all staff tablets with write access to public repo. Replace with scoped per-staff tokens or server-side write proxy. Likely needs IT consultation + one-off security consult. ~weekend.
3. **CI on DOOR / EXPO / CODEX** — only HUB has CI today. Minimal `check.yml` per repo: JSON syntax validation, `node --check` on inline JS, file size guards. ~30 min per repo using HUB's `deploy.yml` pattern.

### Medium
4. **DOOR `*_flags` missing → fail-safe** — `buildRoutingByMealJSON()` at line 9787 falls back to empty flags on missing. Should refuse to publish that meal + render crimson "UNFLAGGED — DO NOT SERVE" banner.
5. **Staging deploys** — the HOUSE env badge already detects DEV by URL; once staging URLs exist the badge auto-shows DEV. Two paths: Cloudflare Pages (per-branch preview URLs, ~30 min setup) or path-based GitHub Pages (~90 min, more brittle).
6. **CODEX three-name confusion** — `<title>` says CODEX, CLAUDE.md says MISE, README says Recipe Hub. Pick one canonical name. ~15 min cleanup.

### Lower (architectural)
7. **EXPO Phases 1–3** of `EXPO_Generic_Scheduler_Roadmap.md` — wizard-on-resolution-failure, site-profile externalization, routing-as-matching. ~25–30 days of focused work over 2–3 months.
8. **CODEX `rexdale_enrich.py` line-2316 surgery** — replace structural string-editing of EXPO's `index.html` (literal hardcoded line number) with a structured `recipe_overrides.json` import that EXPO loads at boot.
9. **Cross-app schema validators at fetch time** — fill in EXPO `schemas/` skeletons with actual JSON-schema validators; run at fetch time in each consumer to refuse malformed payloads at the boundary.
10. **Pretty-print EXPO mega-tables** — RECIPE_DB, RENO_MENU, etc. live on single lines (~12% of file). Pretty-print adds ~5K lines but makes diffs reviewable.

---

## Strategic context

**Bus factor: 1.** Jason is the sole developer + the Food Services Supervisor running the operation this software supports. Maintenance has to survive being part-time on top of the day job.

**Recommended additions before scaling beyond CONC:**
1. **Weekly technical reviewer** — 60-min check-in, doesn't need to be senior, doesn't need to know kitchens. Read what shipped, flag what could break. Catches ~80% of latent bugs a solo developer would otherwise discover the hard way. Candidates: U of T CS student (intern rate), retired developer, friend-of-friend in tech, 2hr/week contractor.
2. **One-off senior-dev day** for review of three critical paths: DOOR allergen routing, EXPO resolver+scheduler, CODEX seed-merge logic. ~$1.5K–$3K, one-shot, catches things invisible from inside.
3. **One-off security consult** before PAT replacement / SharePoint migration. M365/Graph has its own pitfalls (throttle limits, ETag conflicts, auth complexity) that LLM-driven code won't anticipate.

**Sustainability path forward:**
- Months 1–2: stabilize current (P0/P1 punch list above)
- Month 3: move DOOR data layer to SharePoint with IT involvement (one app first, validate pattern)
- Months 4–5: replicate for HUB/EXPO data; EXPO Phases 1–3 in parallel
- Month 6+: decide multi-site or stay scoped

**Branching strategy:** branches (with optional staging deploys), not new repos. Long-lived `next` branch per repo for refactor work; merge phase-by-phase when validated. The current `claude/review-apps-architecture-QTaQA` is the in-flight container.

---

## Workflow patterns established this session

- **Test before push** — modified files validated locally in headless Chromium with live data injected before any git operation. Today's anaph fix was generated, diff'd against production XLSXes, then committed only after agreement.
- **Local vs cloud Claude Code sessions** — browser-driving work needs a *local* session (Chrome extension can reach Brave). This session was *cloud* (remote sandbox, headless Playwright only). Pick the mode that matches the task at session start.
- **Environment indicators in every app** — the HOUSE env badge gives instant visual PROD/DEV/LOCAL confirmation on every tab. Test locally without fear of touching production.

---

## Decision log

Choices made during this session that future-you should know about:

- **Anaph marker fix is additive, not routing-changing.** Extending `ANAPH_TAG_TO_MEAL_FLAG` directly would have promoted room 213 to the Anaphylactic Alternative section, where the alt meal isn't soft-prepped. Instead, kept 213 in Soft Meals and added the marker as a display-layer concern. Lower-risk; doesn't risk a new unsafe routing.
- **Marker style: `⚠ ANAPHYLACTIC (ALLERGEN) — prepared separately`** — names the specific allergen so cook sees at a glance. Two other options rejected (terse marker only; marker + bold allergen line).
- **Ship the marker fix now, menu hydration next session** — chose to land the W2 WED improvement immediately rather than wait for a more complete fix. The two are independent; menu hydration unlocks the remaining 6 firings without touching today's code.
- **No new repos for refactoring.** Long-lived branches with feature flags, not parallel codebases. The maintenance multiplier of two codebases for one solo developer is too high.
