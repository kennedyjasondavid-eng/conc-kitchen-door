# DOOR back on track: take out the private-data work, then finish the supervisor screens

Status: accepted by Jason, 2026-11-18 ("proceed with work"). Progress is the checklist in §8; rulings in §9.
Owner: once Jason accepts it, this plan owns the DOOR staff-ready line. It replaces the working sections of
`DOOR_STAFF_READY_BASELINE_ACTION_PLAN_2026-11-17.md` (whose Outcome below is kept word for word) and the breakfast
B1/B2 sections of `DOOR_PLATING_RECONCILIATION_ACTION_PLAN_2026-11-16.md`. Those two become frozen records.

## 1. Where we are going

The goal, from the staff-ready plan, unchanged:

> A supervisor can use their familiar four-week menu, spreadsheet imports, daily changes and printed plating sheets
> through DOOR. They enter a change once, see exactly which residents/plates it affects, and know whether the kitchen
> received it. Every served component has a clear identity and ingredient evidence appropriate to that food. EXPO can
> plan the work and HUB can show the correct menu and recipe without staff repairing names or links.

Jason's goal for the menu flow (menu-flow plan, 2026-11-07): DOOR isn't flaky, user edits never break the flow to EXPO,
and the checks support rather than obstruct. HOUSE rule: silent when it works, loud when it breaks.

What "simple but functional" means here:
- One way to do each job. Every new screen element earns its place by helping a supervisor do a real task.
- Use what DOOR already has: its menu writer, the plating engine, the F1/F4/F6 publish and delivery receipts, the
  existing alternative fields, CODEX recipes and the shared Library. No new store, protocol or receipt system.
- Unknown stays unknown and is shown as unknown. A safety check never quietly drops a warning.
- No code ships "inactive". A slice either changes what staff see, fixes a safety or data problem, or is not built.

## 2. What went wrong, briefly

From #213 to #224 (Nov 17–18) the work moved from the supervisor screens to a private data repository and a new
six-app "serving protocol": about 1,600 lines of switched-off code in DOOR, the same protocol in HUB (#78) and CODEX
(#374), 49 new DOOR test files, 8 schemas and 10 review notes. None of it is used. The staff-ready checklist has no
item ticked. The trigger was an automatic review that flagged resident data in the public repository. DOOR holds no
identifying information (Jason, 2026-11-18), and the HOUSE ledger already had a smaller privacy plan: make the DOOR
repository private.

The HUB and CODEX copies are not harmless. Both run a consumer on every menu and count read. It adds a `sites.json`
request each time. If one of those reads fails for a reason other than the network (a captive-portal page, a bad
response), the app writes a state that locks that device into "unsupported" for good: DOOR's menu, routing and counts
are refused and HUB shows no recipe links. Taking the code out fixes this.

## 3. Rulings this plan asks Jason to confirm

- **R-a.** Drop the private data repository and the serving protocol. Remove all of it, with no dead code left.
  (Jason, 2026-11-18: "I'd like to roll it back. I don't want to leave dead code though.")
- **R-b.** Privacy follows the HOUSE ledger's plan: make `conc-kitchen-door` private, then remove the temporary
  raw-read fallback. The viewing-key rehearsal can be short or skipped: nobody relies on DOOR right now
  (Jason, 2026-11-18).
- **R-c.** Breakfast's unused resolver (#205) goes too. Breakfast gets the simpler design in §5 U3.
- **R-d.** Archive `conc-kitchen-door-data` (it holds only a README).

## 4. Phase R: take it out (three PRs, then docs)

Before each removal, tag the current head in that repository: `archive/private-serving-2026-11-18`. The work stays
readable in history; none of it stays in the apps.

### R1 HUB first (it is the live risk)
Map from a read-only pass against `origin/main` `aa78890`:
- Remove the three `serving-*` blocks (:217–721) and the consumer owner (:722–797: `houseServingConsumer*`,
  `houseServingManualSourceRow`, `_hubServingRefresh`).
- Remove the one guard line added in each of `_hubRoutingCatchUp`, `_hubReassessRouting`, `_componentPortions`,
  `loadDOORData`, `ensureMenuLoaded`, `_refreshDoorMenuForFreshness`, `_reassessScheduleFreshness`, and the one
  protocol line in each of `recipeReferenceVerdict` and `rcpUrlWithFallback`. The code under them is the pre-#78 path,
  which already gives exact, unscaled CODEX links (F3a, H1+H2).
- Put the `flow-validity` block back where it was before #78. Its bytes are unchanged; the pin gate passes either way.
- Delete the 8 `tests/serving_*` gates, their helper and fixtures, the two `.gitattributes` lines, the 4 node gates
  and the browser step in `contract-gates.yml`. Restore `recipe_link_contract`, `recipe_links_h1h2_contract` and
  `door_counts_validity_contract` to their pre-#78 bytes.
- One-time start-up tidy: remove keys starting `houseServingV1:hub:`.
- Proof: `git diff 10f859f^ <branch>` on the HTML equals #77's changes only; every card's recipe URL on the frozen
  Nov 10 board is the same before and after, with no `&portions`; no `houseServing` text left outside the tidy;
  every inline script parses; full suite count in the PR.

### R2 CODEX
Map from a read-only pass against `origin/main` `9e1a056`:
- Remove `flow-validity` too: CODEX had no copy before #374 and only the serving code calls it (HOUSE seams row 11
  lists DOOR, EXPO and HUB only).
- Remove the three serving blocks, the consumer owner and `_cxServingBoot`, `_cxRefreshKitchenSource`,
  `_cxManualReleasedDemand*`. Restore `_cxMenuNamesBoot`, `_cxBatchNumbersBoot` and the guards in
  `_cxDoorMenuCompact`, `_cxDoorMenuAdopt`, `_cxDoorNumbersAdopt`, `_cxMenuWorklistHtml`, `_cxBatchTarget*` to their
  pre-#374 bytes.
- **Keep** the exact-identity opener: `_cxManualIdentityKey`, the deep-link branch (one recipeId, no name fallback,
  no scaling) and `_cxSharedLibraryBoot` returning its promise. Keep the unrelated one-Library-read-per-render change.
- Delete the 9 serving gates, fixtures and helper, and `rotation_anchor_census_scope_gate`. Re-pin
  `menu_names_source` and `library_opening_view_gate` with dated notes. Replace the only exact-ID test with a plain
  browser gate, authored red on a copy without `_cxManualIdentityKey`. Browser gates stay well above the floor of 17.
- Start-up tidy: remove keys starting `houseServingV1:codex:`.
- Proof: method snapshot unchanged, `reseal.mjs --check` writes nothing, full suite count in the PR.

### R3 DOOR
- Remove the switched-off blocks in `index.html`: `canonical-food-facts-v1`, `canonical-clinical-source-v1`,
  `private-generation-v1`, `private-bootstrap-v1`, `private-git-transport-v1`, `private-git-fetch-bridge-v1`,
  `private-episode-v1` (now lines 11657–12757) and `serving-protocol-v1`, `serving-public-io-v1`,
  `serving-catalogue-v1` (now 12975–13489). Nothing outside them calls into them.
- Remove #205's breakfast resolver (`doorBreakfastVariantBasis`, `doorResolveBreakfastPlate`,
  `doorAggregateBreakfastPlates`; no callers) and `schemas/breakfast_plate_model.md`.
- **Keep:** `flow-validity` (live F4, pinned), #219's grouped plating-definition warnings and their gates, #215,
  #203/#204's guards, `doorPrivateRehearsal` (it is the older viewing-key switch; phase 5 of the privacy plan removes
  it separately).
- Delete the gates, fixtures and schemas these blocks added (the `private_*`, `serving_*`,
  `canonical_food_facts_adapter`, `private_clinical_source_composition`, `breakfast_resolver` gates;
  `tests/fixtures/private_clinical_source/`, `serving_catalogue/`, `serving_*_cases.mjs`; the 8 private and serving
  schemas), the `.gitattributes` lines #223 added, and any workflow lines naming them. Move the 10 review notes to
  `docs/archive/` with one index line rather than deleting the record.
- Check the small edits #219 and #223 made to `tests/browser/anaph_recipe_binding.mjs` and `tests/vegan_friendly_gate.mjs`:
  keep what serves live behaviour, revert the rest.
- One version bump. Proof: no `doorPrivateV1`, `doorPrivateBootstrap`, `doorPrivateGit`, `doorCanonical`,
  `houseServing` or `houseCatalogue` text left; every inline script parses; the pin gate passes; the full Node suite and
  the browser gates pass; a generated plating set and the six published files are byte-identical before and after on
  the same inputs.

### R4 Docs, in the same change sets
- HOUSE ledger: DOOR row brought up to date (it stops at #207); the privacy line says the private-repo direction was
  tried and removed; the CODEX and HUB rows note the removal.
- DOOR `CLAUDE.md`: Recent gets one short entry for the removal; nothing about the protocol is restated.
- The staff-ready and plating-reconciliation plans get a one-line status pointing here.

### R5 Privacy, the simple way (Jason, then one small session)
1. Jason makes `conc-kitchen-door` private (Pages keeps serving only the app and its feeds, as CODEX, HUB and EXPO do).
   A viewing key on one computer confirms viewing-key detection, which is still unverified.
2. A session removes `DOOR_PUBLIC_RAW_FALLBACK` and the rehearsal switch (privacy phase 5).

## 5. Phase U: finish the supervisor journey

Each slice is small, changes what staff see or fixes data, and names the checklist line it moves. Order matters: U1
and U2 make the data trustworthy, so U3 and U4 build on solid ground.

### U1 Clean identities (data, through the existing writers)
- Apply the prepared recipe-ID backfill for the 10 neutral name-only links. Tuna and the mushroom sandwich are one
  call each (their link changes EXPO's production plan).
- Split run-on slots into their parts; standardize the few misspelled visible names (Donburi, Biryani, Turmeric).
- Since nobody relies on DOOR right now, this can be one reviewed data publish rather than many.
- Done when: the inventory shows every active component as linked by ID, a bought/basic item (U3), or manual with a
  reason. No unexplained run-on or name-only slot.

### U2 One written rule for allergen facts (small)
- Write down the rule DOOR already follows (warnings are only ever added; a removal needs its confirmation; an
  unticked Spicy stays off; a linked dish keeps what it captured until relinked). No new precedence machinery.
- Go through the 24 dishes whose saved facts differ from CODEX with Jason in one sitting: each is a CODEX fix, a kept
  local difference with its reason, or a relink.
- Done when: every difference has a decision, and the editor's link badge (#210) says current / recipe changed /
  unavailable / manual.

### U3 Breakfast, the simple way (needs call C1)
The real problem (B0): first-match routing gives a resident one breakfast plate by their first matching section, so
a second need (oat milk for 301a, smaller starch for 1007) is lost. The resolver built for this needs a whole evidence
model. The simpler fix copies what the manual sheets do:
- **Named breakfast plates.** Each breakfast's alternative fields choose from CODEX-backed plates, the same way #206's
  plain plates work for lunch and dinner. Products (Rice Chex, Silk coconut yogurt, Kirkland oat and soy drinks)
  become short CODEX bought-item records with their label allergens and a "label checked" date. A record with no
  label read says "label not checked" (this is call D2's lean, made concrete).
- **A breakfast note on the resident.** One field on the resident for a confirmed standing instruction ("oat milk
  only", "smaller starch, extra protein"). It prints on the plating sheet beside the resident and is checked against
  the plate's facts (a conflict is shown, never silently fixed).
- **A plate choice for a resident only when the rules can't place them.** The preview lists residents whose needs the
  routed plate doesn't cover; the supervisor picks one of that breakfast's named plates for them, with the same
  conflict check. Stored on DOOR's existing resident record, travels with the list.
- Keep the existing guard: a breakfast with an occupied GF section and no named plate can't print a final sheet.
- Done when: every one of the 28 breakfasts has named plates or a visible "not set yet"; every resident has one plate
  per breakfast and their note prints; Joan's comparison shows no lost requirement.

### U4 Finish the editor (Stage 4, what is left)
Already done: the keyboard picker and link badges (#210), unsaved-draft protection (#211), plain plates (#206), line
versions (W3b), the halal and run-on questions.
- **Plates at a glance.** Under the meal, Regular, Vegan and Halal plates with their sides ("gets this / gets instead /
  doesn't get it"), then the restriction plates with today's resident counts. "Unavailable", never zero, when counts
  can't be worked out.
- **One clear save line.** After Save, the editor itself says the strongest true state from the existing F6 receipt:
  Saved on this computer / Waiting to send / Sent to the kitchen / EXPO picked it up / Needs attention. Replace "from
  menu text — save to link" with plain words.
- **Undo and restore say what they will put back** before doing it (the meal, its sides and its links).
- **Import review** shows which dishes, links and allergens are kept and which are replaced.
- **Quieter by default.** Ordinary fields first; allergen detail, kitchen alternatives and advanced options folded, with
  any warning still visible when folded.
- Done when: a supervisor can rename a dish, replace a main, add a side, change a vegan side, fix a link, recover from
  a mistake and read where their change went, without help.

### U5 One end-to-end check
- One scripted journey with made-up residents: edit in DOOR → publish → EXPO reads it → HUB's board and recipe link
  show it. Covers a swap, a removal, a relink without a name change and an imported week.
- Explain the HUB 21-versus-20 gap seen on Nov 17.
- Uses F1, F4 and F6 as they are. No new receipts.

### U6 Staff walkthrough
A supervisor with the real workbook: import a week, change a dish, rename without unlinking, change a vegan side,
handle a missing recipe, change one day only, save and read where it went, print. Record what they expected and what
happened. Fix what trips them up. Then, and only then, call it staff-ready.

## 6. Not doing (and why)

- Private data repository, serving protocol, per-device acknowledgement, approval database: not needed for the goal.
- Portion scaling of recipe links (F3b): stays off until CODEX can prove a recipe's serving basis.
- A generic breakfast resolver or evidence model: U3 covers the real cases with existing pieces.
- New global publish or print blocks: existing safety checks stay as they are.

## 7. How we work from here

- Every PR names the checklist line (§8) it moves. A PR that moves none is not opened.
- One independent review for safety and data slices, as `CLAUDE.md` asks; plain-words receipts of a few lines.
- Tests check behaviour and unknown states, not wording or counts. Test files for removed code go with the code.
- The HOUSE ledger and DOOR `CLAUDE.md` are updated in the same change set as each merge.
- Calls go to Jason one at a time with a lean.

## 8. Checklist

- [x] R1 HUB serving code removed; device lock fixed; links unchanged (HUB #80).
- [x] R2 CODEX serving code removed; exact-ID opener kept and tested (CODEX #376).
- [x] R3 DOOR switched-off code and its tests removed (DOOR #225, .94).
- [x] R4 Ledger, CLAUDE.md and old plans point here (HOUSE #117, DOOR #225).
- [ ] R5 DOOR repository private; raw fallback removed.
- [ ] U1 Every active component has a clear identity. *Done: all 12 name-only links carry their CODEX recipe IDs (publications 25 and 26, 2026-11-18; C3 ruled "link both" after EXPO's cards proved identical). Left: run-on slots, misspelled names.*
- [ ] U2 Every saved-versus-CODEX difference decided; facts rule written.
- [ ] U3 All 28 breakfasts and every resident's breakfast plate accounted for. *Done: C2 DOOR half (a recipe whose label is not checked reads as unknown: "label not checked" in the editor, "check label" on the plate, `.97`). CODEX bought-item records (CODEX #383, edition 2026-11-18-bought-items): Chex cereal, Soy milk, Oat milk and Vegan yoghurt, label not checked; the GF cereal line names soy or oat milk (publication 34). DOOR reads unchecked dishes only in the regular, vegan and halal texts, so no plate says "check label" for them yet (a plating change, Jason's call). Left: name Vegan yoghurt on the no-dairy breakfast (a plating-note change, Jason's call first), and the rest of this item.*
- [ ] U4 Editor: plates at a glance, one save line, undo preview, import review, quieter default. *Done: one save line and plain notice (#226, .95); counts unavailable without a list and the halal plate named (#227, .96); undo and reset already name what they put back; a refused Download All says why beside its button and keeps focus there (.99, #235). Left: import review kept/replaced, quieter default.*
- [ ] U5 End-to-end journey passes; HUB 21/20 explained.
- [ ] U6 Supervisor walkthrough done without developer help.

## 9. Calls for Jason

**Ruled 2026-11-18 (Jason, on the leans):** R-a to R-d accepted ("roll it back … no dead code"). C1: the simple breakfast design. C2: CODEX bought-item records with label allergens and a "label checked" date. C3: EXPO's 30 tuna, mushroom and Portobello cards were identical before and after linking; Jason: link both (follow lean). C4: still open; it comes as one list with a lean per dish once U1 is done. Tags could not be pushed from the cloud session; the removed code stays in git history before each removal commit.

- **C1 Breakfast design (U3):** named plates plus a resident breakfast note plus a per-resident plate choice only where
  the rules can't place them. Lean: yes. Consequence: no resolver; breakfast stays in DOOR's existing fields and
  resident record.
- **C2 Bought items (D2):** short CODEX bought-item records with label allergens and a "label checked" date. Lean: yes.
- **C3 Tuna and the mushroom sandwich links (U1):** each changes EXPO's plan; decide with EXPO's view open.
- **C4 The 24 differences (U2):** one sitting.
- **C7 Stew / Side (ruled 2026-11-18):** a CODEX category (`stew_side`) for a vegetable-based side made on a stew cycle EXPO can plan; DOOR offers it in Veg Side (DOOR .98 first, then CODEX). **C8:** Okra and Cassava Stew, Atakilt Wat and Shakshuka Sauce (Vegan) become Stew / Side; Wk2 WED dinner's fish and stew split into a main and a side.
  Vegetable Cacciatore (a shared-Library recipe, Jason's inspiration for the kind) is re-saved as Stew / Side in CODEX
  once the picker is live; the seed recipes move in a CODEX data edition.
  - **Done 2026-11-18 (publication 33):** Wk2 WED dinner's slots read main Yetisse Fish (it keeps the meal's ticks),
    starch Coconut Rice and peas, veg side Okra and Cassava Stew (`okra-and-cassava-stew`, its allergens from CODEX),
    vegan Spiced Tofu. Menu text, meal ticks and routing counts unchanged.
- **C2 as built (2026-11-18):** CODEX #383 adds the four bought items with the plain menu words as names (Jason: "follow
  lean"; "oat milk is a soy milk stand-in, it's for cereal"). DOOR's vegetarian breakfast line serves dairy yoghurt and milk,
  so it is unchanged; the GF cereal line now says "soy or oat milk where noted". The Silk vegan yoghurt is for residents who
  take no dairy (Jason: "I assume it's for no dairy people"); naming it on their plate note ("dairy-free: vegan yoghurt") is
  open, a plating-note change for Jason to rule on.
- **C2 labels (2026-11-19, publication 35):** CODEX #384 (Jason: "follow lean") gives the four bought items the allergen
  lists from their published Canadian listings: Chex cereal Sulphites, Soy milk Soy, Oat milk Oats only (not certified
  gluten-free), Vegan yoghurt Tree Nuts (coconut), Corn, Sulphites. Oat milk is not gluten-free, so the GF cereal line
  says "soy milk where noted" again. DOOR has no Oats flag, so oat milk shows no allergen in DOOR (known gap). Next in
  CODEX: a "What the package says" panel on a bought item, so a supervisor edits its list with no code (Jason: "follow
  lean, add the package panel after this edition").
- **Call 3 (2026-11-19, Jason: "Yes follow lean"), `v31-standard.100`:** the label check reads the alternative plates
  too. Gluten free, diabetic, no dairy, no egg / mustard, bland and soft are each read from the dish the kitchen names
  for them (exact recipe name), or are the regular plate when it names none; the anaphylactic plate counts toward an
  anaphylactic resident, who is checked against every plate. Nothing moves on today's data (no recipe is unchecked).
  The package panel shipped in CODEX #385 (`d59db42`).
- **C9 EXPO's okra stew link (2026-11-18, handed to the EXPO session):** EXPO plans the okra stew's stew cycle (cook Wk1
  FRI at Bloor, bag, cold van, reheat Wk2 WED) but links it to the Caribbean Stew recipe. EXPO's job panel work owns the
  fix; DOOR now names `okra-and-cassava-stew` on the slot.
