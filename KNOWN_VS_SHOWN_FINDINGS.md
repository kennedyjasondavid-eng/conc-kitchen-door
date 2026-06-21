# DOOR — KNOWN ≠ SHOWN findings (2026-06-21)

*From the HOUSE "known≠shown" propagation sweep. The lens (cross-HOUSE owner): `conc-kitchen-house/INSIGHTS.md` → "The interface shows known-state in the user's language — most UI bugs are a known≠shown divergence." Engineering grammar: `conc-kitchen-expo/EXPO_DESIGN_PRINCIPLES.md` #46–#48.*

**This is a read-only diagnostic. Nothing here is fixed.** Each fix lands only with Jason's sign-off, on this repo's own branch, behind DOOR's own gates (`tests/door-smoke.mjs`). Every finding below was verified against `index.html` at the branch point (`origin/main` = `38dded4`); line numbers are against that source. DOOR is the highest-stakes app in the sweep — an allergen/anaphylaxis/routing surface that diverges from the resident record is the food-safety failure class.

The shape that recurs here: **DOOR's routing/compliance *engine* is faithful; the defects are in *display/publish surfaces that reach past the engine to a raw or frozen stored field instead of re-deriving the truth the engine already computes.***

---

## C1 — CRITICAL — The anaphylactic ALERT banner shows the wrong allergen set, and can omit the lethal one
- **Surface:** the red "⚠ ANAPHYLACTIC ALERT — Rooms … (allergens)" banner + the "Anaphylactic Alternative (allergens)" section header, in **all four** sinks: xlsx banner `index.html:18580`, xlsx section header `:18599`, HTML banner `:19370`, HTML section header `:19386`.
- **Divergence — UNFAITHFUL (#47, display re-implements/bypasses the enforcer's predicate).** The banner's allergen text is computed by an independent raw scrape:
  ```js
  [...new Set(REGISTRY_LIST.filter(r=>r.isAnaph).flatMap(r=>r.tags.filter(t=>t.startsWith('No '))))]
  ```
  The authoritative enforcer `getAnaphConflictRooms` (`:7985`) / `getAnaphAlertInfo` (`:8011`) instead (a) honour each resident's `anaphTags` scoping, and (b) gate every tag through `ANAPH_TAG_TO_MEAL_FLAG` (`:7704`, exactly 5 triggers). The scrape does neither, so it diverges three ways:
  - **Over-claims (scope):** ignores `anaphTags` — a resident anaphylactic only to peanuts but also carrying a non-anaph "No Dairy" accommodation tag will show "No Dairy" in the red banner.
  - **Over-claims (set):** admits *any* `No X` tag (No Mushroom, No Beef, No Sesame…), not just the 5 enforced anaph triggers.
  - **Under-claims / OMITS the trigger:** `'GF'` is an enforced anaph trigger (gluten → `hasGluten`) but the label **does not start with `"No "`**, so the scrape drops it. A gluten-anaphylactic resident (`anaphTags=['glutenFree']`) correctly fires the banner (`conflictRooms.size>0`), but if GF is the *sole* trigger the allergen string is empty → the banner renders **"ANAPHYLACTIC ALERT — Rooms X ()"**, omitting the actual lethal allergen the kitchen needs to avoid.
  *(Correction to the first-pass finding: an earlier "the trigger could live in `r.avoidances`, which the scrape doesn't read" hypothesis is **not** a real vector — `avoidances ⊆ tags` in construction (`:8527/:8571`). The real omission vector is the `'GF'` filter mismatch above.)*
- **Known-state it should reflect:** the actual conflict set. `getAnaphAlertInfo` (`:8011`) already returns the precise per-room triggering `allergen` (it's used faithfully on the Review screen, `:8263`). The banner should derive its allergen list from the enforcer's triggering tags, scoped to `anaphTags`.
- **Severity:** **CRITICAL** — this is the single red banner the kitchen acts on; it can both name a wrong allergen and omit the real one.
- **Recommended fix:** derive the banner/header allergen text from the conflict computation (reuse `getAnaphAlertInfo`'s per-room `allergen`, or have `getAnaphConflictRooms` return the triggering tags), scoped to `anaphTags`. **Share the predicate — don't re-scrape `r.tags`.** (#47: factor the trigger-selection into one function the enforcer *and* the banner call.)
- **Confidence:** **High** (mechanism + all four lines + the GF omission verified twice, independently).
- **⚖ FORK for Jason (intent, separate from the bug):** what should the banner *list* — (a) only today's *triggering* allergen(s) [recommended — the banner says "today's meal contains allergen, don't deliver", so the trigger is the faithful answer, and `getAnaphAlertInfo` already has it]; (b) the resident's full *anaphylactic* profile (`anaphTags`); or (c) the current full-tag scrape (which is the defect)? The `anaphTags`-scoping bug and the GF omission must be fixed regardless of which display intent you choose.

---

## NEW-1 — HIGH — `registry_summary.json` special-diet headcounts read the frozen routing label, so diabetic/noDairy/glutenFree publish as 0 even when those residents exist
- **Surface:** `buildRegistrySummaryJSON` `index.html:10519-10533` (the tally line `:10530`). **This is a published HOUSE artifact**, not just a screen.
- **Divergence — FABRICATED.** `headcounts.diabetic = sc['Diabetic']`, `noDairy = sc['No Dairy']`, `glutenFree = sc['Gluten Free']`, `vegan = sc['Vegan / Vegetarian']` are tallied from each resident's stored `r.section` string. But `r.section` is a **meal-dependent routing label** assigned once (`routeResident`, against the single `MEAL.lunch` reference) — and those labels *merge* per meal (No Dairy/No Fish/No Beef → Vegan when the meal `hasDairy`/`hasFish`; Diabetic only when the meal `isCarb`, `computeSections :12578-12604`). So on a non-carb reference lunch every diabetic's section is Regular/Halal/Vegan → `sc['Diabetic'] = 0`; on a dairy lunch No-Dairy residents fold into Vegan → `sc['No Dairy'] = 0`. The published summary then advertises `diabetic:0 / noDairy:0` to downstream consumers.
- **Known-state it should reflect:** the **restriction tags**, which the app already uses faithfully elsewhere (`diabCount = REGISTRY_LIST.filter(r => (r.tags||[]).includes('Diabetic')).length`, `:18513/:18595`; the Diabetic-List xlsx filters on the tag, `:18829`). `validateDoorRegistrySummaryArtifact` (`:10819`) only checks that `headcounts{}` *exists*, never the values — so the 0s publish silently.
- **Severity:** **HIGH** — a published artifact carrying a fabricated-looking 0 that contradicts the app's own faithful tag count; distinct from H2/H3 (those are on-screen) because this crosses the HOUSE seam.
- **Recommended fix:** derive each special-diet headcount from the restriction tags, not `r.section` (`diabetic = tags includes 'Diabetic'`; `noDairy = ['No Dairy','Lactose Intolerant']`; `glutenFree = ['GF','Gluten Free']`; `vegan = ['Vegan','Vegetarian']`). Keep regular/halal section-derived only if a per-meal routing snapshot is intended — and then document which meal it is keyed to.
- **Confidence:** **High.**
- **⚖ FORK for Jason:** is `registry_summary.json`'s `headcounts` meant to be **standing population counts** (→ tag-derived, recommended) or a **specific-meal routing snapshot** (→ keep section-derived but document + name the meal)? Also worth confirming *who consumes this artifact today* before changing its semantics.

---

## H2 — HIGH — Plating Dashboard section counts come from stored `r.section`, not per-meal `computeSections` (and sit beside a live anaph count, so the cell is self-inconsistent)
- **Surface:** `renderPlatingDashboard` → `mealCell`, `index.html:19236-19246` (the "Reg N · Hal N · Veg N…" line).
- **Divergence — UNFAITHFUL.** The **same cell** computes the anaph count *live* per displayed meal (`getAnaphConflictRooms(lf, df)`, `:19230`) but tallies the section summary from each resident's frozen `r.section` (`short[r.section]`, `:19241-19242`). `r.section` is written only at intake/save/queue-update/import (never re-derived per displayed meal), while the authoritative per-meal assignment is `computeSections(mealFlags, registry)` (`:12530`, with per-meal pork-day merges). `renderPlatingDashboard` calls neither `computeSections` nor any re-derive before `mealCell` — there is **no re-derive-all-sections function** (verified). So a stored-Halal resident on a meatless meal is counted "Hal" on the dashboard but plates Regular on the authoritative sheet.
- **Known-state it should reflect:** `computePlatingData(period, week, day)` for the cell's meal (already returns `regCount/halalCount/veganCount/diabCount`; the lethal plating sheet itself is correctly `computeSections`-driven).
- **Severity:** **HIGH** — a preview/navigational summary, not the printed sheet, but it can quietly contradict the authoritative sheet; staff use it to anticipate counts.
- **Recommended fix:** call `computePlatingData(...)` and read its counts instead of tallying stored `r.section`.
- **Confidence:** **High.**

---

## H3 — HIGH/MEDIUM — Registry section pill renders the frozen per-meal `r.section` as if it were a standing assignment
- **Surface:** `renderRegistry`, `index.html:9245` (the Section pill).
- **Divergence — UNFAITHFUL / wrong-altitude.** Same root as H2 — the pill shows the persisted single-meal routing label as the resident's standing section. For a rotating menu where a resident's section legitimately changes meal-to-meal (Halal only on certain meals, No-Dairy merging, etc.), a single stored section is a stale proxy. (The adjacent restriction-**tags** column *is* the durable truth, faithfully rendered.)
- **Known-state it should reflect:** routing is meal-dependent; either re-derive against today's meal, or relabel the column so a per-meal section isn't read as standing.
- **Severity:** **HIGH→MEDIUM** — the tags column carries the durable data; impact depends on how staff read the pill.
- **Recommended fix:** re-derive the displayed section against today's meal, or relabel ("section — last routed").
- **Confidence:** **Medium-High** (staleness verified; whether it misleads is intent-dependent — pairs with the H2/NEW-1 question of what `r.section` should mean).

---

## M4 — MEDIUM — The anaphylactic emergency xlsx fabricates "Halal" as the default section
- **Surface:** `buildAnaphListXlsx`, `index.html:18874` — `xCell(r.section || 'Halal', …)`.
- **Divergence — FABRICATED (#48-adjacent).** When an anaph resident has no stored `r.section`, the emergency sheet prints **"Halal"** — an invented dietary attribute the record doesn't assert. Every sibling builder defaults `'Regular'` (roommates `:18894`, plating/diabetic `:18802/:18838`), so this is an outlier (almost certainly a copy-paste slip), and it's on a safety document.
- **Known-state it should reflect:** absence — default `'Regular'` (consistent) or honest blank.
- **Severity:** **MEDIUM** — only fires when `r.section` is empty (rare for an active resident), but it's the anaph emergency sheet.
- **Recommended fix:** change the fallback to `'Regular'` (or honest blank).
- **Confidence:** **High** that it's inconsistent; **Medium** on real-world frequency.

---

## M5 + NEW-2 — MEDIUM — Published artifacts hardcode `version:30` instead of reading `DOOR_SCHEMA_VERSIONS`
- **Surface:** `buildRoutingByMealJSON` `:10619` (M5, original), plus `buildMenuJSON` `:10501`, `buildStateJSON` `:10508`, `buildRegistrySummaryJSON` `:10529` (NEW-2 — same root, three more artifacts).
- **Divergence — provenance footgun.** `DOOR_SCHEMA_VERSIONS` (`:697`, `Object.freeze`'d, "Published JSON files remain their own contract authority") is the declared per-artifact version source of truth — yet every `build*JSON` writer stamps a hand-typed literal `30`. If a schema change bumps `DOOR_SCHEMA_VERSIONS.menu_current` to 31 without also editing the literal, the published feed advertises a version that doesn't match its declared schema, and **EXPO gates on `menu_current.json`'s `_meta.version`** (HOUSE schema matrix) — so it would trust a stale schema. The smoke test cross-checks today's value so they currently agree, but the producer reads a duplicate literal, not the source.
- **Known-state it should reflect:** `DOOR_SCHEMA_VERSIONS.<artifact>`.
- **Severity:** **MEDIUM** — a contract-provenance drift risk (`menu_current` highest-stakes, EXPO gates on it), not a live mis-plate.
- **Recommended fix:** stamp `version: DOOR_SCHEMA_VERSIONS.menu_current` (etc.) in each writer so producer and schema mirror can't diverge.
- **Confidence:** **High.**

---

## Checked and found SOUND (the high-stakes engine paths — verified faithful, not padding)
- **`getAnaphConflictRooms` / `getAnaphAlertInfo` (`:7985/:8011`)** — honour `anaphTags` + the 5-flag map; the Review-screen alert names the specific triggering allergen (`:8263`). The live anaphylactic net is faithful. (C1 is the *banner* failing to reuse it.)
- **The live anaphylactic exclude-array net** runs on **human-confirmed per-meal flags** (`period+'_flags'`), matched by `getAnaphConflictRooms` via `ANAPH_TAG_TO_MEAL_FLAG` — **not** on the CODEX allergen feed. (Relevant to MISE-F1: DOOR's automatic net is not endangered by an empty/null CODEX allergen array; the recipe feed only auto-fills the human-gated, editable slot flag grid.)
- **`buildRoutingByMealJSON._components` (`:10588`)** — built from the real plating engine (`computePlatingData` + `getAltMeal`); honest absence (empty components omitted, `:10611`); the "can disagree with section counts, plating engine is authority" design is deliberate. No re-implemented predicate.
- **`recipeMatchesSlotDef` (`:16017`)** — one shared predicate, called by both `slotSearch` and `slotAutoSave` (no #47 duplication); covered by the smoke test.
- **Publish-validation fixtures (#46)** — `door-smoke.mjs` reads the **real checked-in artifacts** and feeds the real `build*JSON` outputs; no hand-built artifact in a shape the writer never produces. No #46 violation.
- **`CONTAINS` allergen line (`:18588/:19378`)** — derived from the meal's own flags (`flagsToAllergenStr(mealFlags)`), faithful. Compliance list/digest (`:9509/:9558`) derive from records, no fabricated defaults. Output is escaped at display sinks.

---

## Minor (not a lens finding — FYI for a cleanup pass)
- `showChangeLog` is **defined twice** (`:19736`, `:19765`); the second (XSS-hardened) wins, the first is dead code. Harmless, confusing.

---

### Verification provenance
Three independent passes produced this list: a by-region sweep, my own line-level re-read of every CRITICAL/HIGH, and an adversarial find-then-refute + by-dimension completeness workflow. Corrections the verification forced: C1's omission vector (avoidances → the real `GF` filter mismatch); NEW-1 and NEW-2 surfaced by the completeness critic (the `r.section`/`version:30` classes extended into *published artifacts*, a strictly higher-stakes tier than the original screen-only M5).
