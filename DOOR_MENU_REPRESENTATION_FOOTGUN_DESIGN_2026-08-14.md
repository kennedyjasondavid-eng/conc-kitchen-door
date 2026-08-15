# DOOR menu-representation footguns — investigation + design options (2026-08-14)

> **Status: DESIGN DOC — no code.** Answers the committed brief
> `DOOR_MENU_REPRESENTATION_FOOTGUN_INVESTIGATION_PROMPT_2026-08-14.md`. Every claim below was
> verified against source (line anchors are to `conc-kitchen-door/index.html` at `f2e5877`
> unless noted); measurements were run against the committed artifacts in the working tree.
> Several of the brief's claims are **corrected** here — marked ⚠. **Adversarially reviewed
> 2026-08-14** (Lens 1 correctness/food-safety: 33 index.html anchors checked, 32 exact + 1
> drift; all 12 measurements independently reproduced. Lens 2 completeness/fork-adequacy:
> §0 byte-match verified against committed slots/pins, consumer sweep found no missed runtime
> reader; verdict SHIP-WITH-FIXES). All findings from both lenses are folded, marked ⟲
> inline. Jason rules §5's forks before any build. Three interim rulings from Jason
> (2026-08-14) are recorded in §5/§7.

---

## §0 ⚠️ URGENT operational note — do this before the next publish (no code, no ruling needed)

> **✅ OUTCOME (2026-08-15): DEFUSED — with two intended menu variations.** Jason executed
> the defuse in the live editor; verified durable against `main`
> (`_meta.exported: 2026-08-15T12:40:39.567Z`): both lunches slot-backed
> (`vegside: Parsnip and Carrot`), overlay = menu, routing `Parsnip and Carrot` **167+4
> (W1 TUE) / 165+4 (W2 SAT)** — the under-count is closed, and the W2 SAT veganalt tail was
> trimmed. **Variations (Jason-ruled intended):** Parsnip **replaces** Seasonal Vegetables
> on both lunches (Veg Side slot, not Extras), and the W2 SAT main is renamed
> `Chicken Tenders`. Consequences: the door-smoke W1 TUE pin is red on `main` (re-pin the
> test, never the menu) and EXPO's baked-MENU/fixture mirror is stale — both handed off in
> **`DOOR_POST_DEFUSE_REMEDIATION_HANDOFF_2026-08-15.md`** (tracked on issue #75). The
> publish threw 409s mid-flight but landed (see §1.6 note). The original instructions below
> are retained as the §0 record.

**DOOR PR #72 (the Parsnip mirror, commit `7b7772a`) is armed to silently revert, and W2 SAT
is under-counting production right now.**

The Parsnip edit changed only the composed `lunch` strings (in both `menu_current.json` and
`menu_overlay.json`) on **W1 TUE** and **W2 SAT**. It did not touch `lunch_sides`,
`lunch_slots`, or routing. Consequences, both verified:

1. **Armed revert.** The editor restores a slot from `lunch_slots` on open (`:17035-17039`)
   and recomposes the line from slots on save (`buildMealName` `:16246-16254`). Neither slot
   has a Parsnip entry, so the next editor save + publish on either slot regenerates the line
   **without** Parsnip. ⟲ On W1 TUE that reddens the door-smoke 11-slot pin
   (`tests/door-smoke.mjs:1951`); **W2 SAT lunch has no door-smoke pin at all — its revert
   would be fully silent** (the only nets are EXPO's baked-MENU mirror and HUB's freshness
   compare). Same mechanism that reverted #68/#69/#70 on 2026-08-10 (`392c9e6`).
2. **Live under-production risk.** `routing_by_meal.json` W2 SAT lunch `_components` carries
   `Parsnip/ Carrot: 16` — derived from the **vegan** line only. The dish is now on the
   regular line (served to everyone; the sibling regular sides count ~169). Until routing
   regenerates from a slot-backed menu, any consumer of `_components` under-counts by
   **~153 portions**.

**The defuse (≈5 minutes, DOOR menu editor — do it on the device that carries current
app-state; the overlay cloud-merge is day-atomic local-wins and both days have overlay
entries):**

1. Open **W1 TUE lunch** in the menu editor → put **"Parsnip and Carrot"** in the **Extras**
   slot (the dessert/condiment slot, internal id `xtra` — ⟲ **NOT "Event Name"**, id
   `extras`, which prefixes the line with " — " and breaks the pinned wording). Extras is the
   only free slot that reproduces the pin — Veg Side is already occupied by Seasonal
   Vegetables. → save.
2. **W2 SAT lunch**: same Extras entry, and ⟲ **also trim the trailing ", Parsnip/ Carrot"
   out of the Vegan-alt slot text** (`veganalt` currently reads "Vegan Nuggets, Roasted Yams,
   Parsnip/ Carrot" — left alone, the recomposed vegan line names parsnip twice in two
   spellings; the dedupe is exact-string only). → save.
3. Publish (the save path auto-publishes via `publishAndSync`).

**Verify after republish** ⟲ *(both corrected by review — the naive checks would read as
failures on healthy data):*

- (a) **W1 TUE:** the recomposed line byte-matches the pin at `tests/door-smoke.mjs:1951`
  ("Blackened fish, Sweet potatoes, Seasonal Vegetables, Parsnip and Carrot" — join order is
  `main, starch, vegside, xtra`, so Extras lands last). **W2 SAT has no pin** — verify
  against the committed `menu_current.json` string ("Chicken tenders & Roasted Yams, Sweet
  Potato, Seasonal Veg, Parsnip and Carrot"); review confirmed the recomposition byte-matches
  it. If a recomposed string doesn't match, fix the slot text, not the test.
- (b) **W2 SAT lunch `_components` gains a NEW key `Parsnip and Carrot` at the regular-section
  count (~150+). The old vegan-line `Parsnip/ Carrot: 16` remains as a separate key** (unless
  the veganalt trim in step 2 removes it) — component keys merge case-insensitively only. Do
  not expect one merged ~169 count, and never hand-reconcile the two.
- (c) ⟲ *Disclosed side effect (intended):* the save recomposes `lunch_veg`/`lunch_sides`
  from slots, so both days' **vegan lines gain "Parsnip and Carrot"** — correct (the dish
  serves everyone, and it's plant-based), but EXPO's next menu sync will surface these
  veg-line deltas in its review panel; accept them there.

Tracked as a dedicated GitHub issue (see the PR body) so this survives independently of the
design review. **Ruled (Jason 2026-08-14): defuse immediately, ahead of any design ruling.**

---

## §1 The verified map — how a menu fact actually flows

### 1.1 App-state layers and the runtime merge

`getMenuData()` (`:14224-14230`) is the single read seam:

```js
const publishOverlay = getDoorPublishMenuOverlayOverride();   // publish-time cloud-pre-merged overlay
const uploaded = loadUploadedMenu();                          // concUploadedMenu (July-2 workbook import base)
const base = uploaded || MENU_DATA;                           // hardcoded constant fallback (:4940+)
const overlay = publishOverlay || loadMenuBaseOverlay();      // concMenuBase, cutover-pruned
return mergeDoorMenuDataWithOverlay(base, overlay);
```

- **`mergeDoorMenuDataWithOverlay` (`:14079-14094`)** merges at **day level with a shallow
  spread**: `out[wk][day] = { ...(bwk[day]||{}), ...(ov[day]||{}) }` (`:14090`). Field-level
  union within a day — an overlay day carrying only `lunch*` fields leaves `breakfast*`,
  `dinner*`, and base-only fields (`lunch_halal`, `allergens_lunch`) intact, **including
  stale ones**.
- **A fourth layer, `concMenuEdits`**, feeds only Today's Meal Context (`getMealForDate`
  `:14284-14288`) and never reaches `getMenuData()` → never publishes.
- **`MENU_DATA` is mutated in place at boot** by `_enrichMenuSlots` (`:8773-8828`), which
  derives `*_mainItem`/`*_sides` by comma-splitting the composed string — the hardcoded
  fallback is not byte-identical to source.

### 1.2 Export — `buildMenuJSON` (`:11615-11652`) is a pass-through, not a composer

Per week/day, a **shallow clone of the day object** (`:11627`): every field — composed line,
`_veg`, `_halal`, `_flags`, `_sides`, `_slots`, alt fields — is copied verbatim. Exactly two
mutations happen at export:

1. **Pork/halal invariant** (`:11638-11641`): `hasPork && halalCertifiedMeat ⇒ false`, on a
   clone (app state never mutated). Fixes `<meal>_flags` only; `_slots.main.flags` is
   deliberately editor-internal.
2. **`allergens_<meal>` regeneration** (`:11642`) via `flagsToMenuAllergens` (`:16378-16393`)
   — **only when `_flags` exists** (`:11630`). A flagless slot publishes whatever stale
   allergen string came in with the base. (Recorded as a gap; see §7.)

`_meta.exported` is restamped `new Date().toISOString()` on **every** publish (`:11649`), and
`buildMenuJSON` runs unconditionally at `:12306` — every publish commits a new
`menu_current.json` even when the menu didn't change.

### 1.3 ⚠ The re-ingest — `concUploadedMenu` is NOT browser-local (brief's P1 corrected)

DOOR fetches `menu_current.json` (raw.githubusercontent, `main`) **back into app-state** in
two places:

- **Boot** (`:19190-19202`) and **daily sync** (`pullSecondaryState` `:10087-10103`):

```js
const localTs = parseInt(localStorage.getItem('concUploadedMenuTimestamp') || '0', 10);
const fileTs  = remote._meta && remote._meta.exported ? new Date(remote._meta.exported).getTime() : 0;
const hasLocal = !!localStorage.getItem('concUploadedMenu');
if (!hasLocal || (fileTs && fileTs > localTs)) {
  localStorage.setItem('concUploadedMenu', JSON.stringify(remote.menu));
```

**This is the precise revert mechanism.** The gate is `_meta.exported`, not content. Proven on
history: hand-edit commits `1e86833`/`d7b299f`/`715fe7a` (2026-08-10) all left
`_meta.exported` at `2026-08-09T13:32:21.533Z`; the next publish (`392c9e6`) restamped it and
regenerated from app-state — all three edits reverted in one 6-line diff. Today's `7b7772a`
(Parsnip) has the same shape: `_meta.exported` unchanged from the prior publish. **A committed
edit that bumped `_meta.exported` past the last publish WOULD be ingested** on any device that
boots/syncs before the next publish — the seam half-exists, undocumented and racy. Behaviour
is device-dependent: a fresh device (`!hasLocal`) ingests regardless of the stamp.

Two structural defects compound it:

- **Publish never checks the cloud menu artifact.** `_doPublishToGitHub` (`:12242+`)
  cloud-pre-merges only the *overlay* (`preMergeOverlayWithCloud` `:12201-12227`, via the
  GitHub contents API); `menu_current.json` is regenerated blind. An online-but-unsynced tab
  clobbers even a correctly-stamped committed edit.
- **Self-reingest flattening.** Publish does not update `concUploadedMenuTimestamp` (only
  `saveUploadedMenu` `:14212-14217` does), so the publishing device re-ingests its **own**
  artifact next boot — folding the overlay layer plus the export-time fixes into
  `concUploadedMenu` as the new base. This is why the overlay is 100% redundant today (§2.2).

### 1.4 The overlay lifecycle

- **Written** by every `saveMenuBaseOverlay()` (`:14037-14057`), which also side-publishes
  `menu_overlay.json` immediately (`:14042`). The editor's `_finishMenuSave` (`:16871-16924`)
  writes **11 fields unconditionally** per save (line, `_veg`, `_flags`, `_softAlt`,
  `_altMeals`, `_altMealsNone`, `_noPorkAlt`, `_mainItem`, `_mainAlt`, `_sides`, `_slots`) —
  regardless of what actually changed.
- **Cloud merge is DAY-atomic, local-wins** (`doorMergeMenuOverlayWithCloud` `:12039-12069`):
  a cloud overlay day that already exists locally is **never merged** (deliberate — comment
  `:12197-12200`). So a committed overlay edit cannot reach any device that has ever touched
  that (week, day). Corollary: **two devices editing different meals of the same day already
  lose one side today** — an overlay day node carries only the edited period's fields.
- **standardCutover prune** (`doorNormalizeMenuOverlay` `:12021-12037`, marker
  `DOOR_STANDARD_MENU_CUTOVER` `:12013`) runs at boot (`:19151-19161`), every load/save
  (`:14034`, `:14038`), sync/boot cloud merge (`:12040-12041`), and publish pre-merge
  (`:12293-12294`). Any overlay lacking the exact marker loses all week/day entries.
- **Publish** pushes the cloud-pre-merged overlay (`:12343`) and, on success, advances local
  `concMenuBase` to it (`:12366-12368`).

### 1.5 Slot / composed-line anatomy — where the same fact lives

The editor's volatile `MEAL_SLOT_STATE` (8 slot ids: `main·mainalt·noporkalt·veganalt·starch·
vegside·xtra·extras`, `MEAL_SLOT_DEFS` `:16050-16059`) is serialized **four independent ways
at save time**:

| Stored field | Builder | Formula |
|---|---|---|
| `<meal>` (composed line) | `buildMealName` `:16246-16254` | join `main, starch, vegside, xtra` (+ ` — ` event prefix) |
| `<meal>_veg` | `buildVegAlt` `:16271-16275` | join `veganalt, starch, vegside, xtra` |
| `<meal>_sides` | `buildSides` `:16265-16269` | join `starch, vegside, xtra` |
| `<meal>_slots` | `_buildSlotSnapshot` `:16328-16338` | `{slotId: {recipeName\|manual, flags}}` |

Nothing at read or export time reconciles them. `computePlatingData` (`:19754-19769`) copes by
picking whichever of the raw string vs `mainItem + ', ' + sides` has **more comma segments** —
an explicit acknowledgement that the copies drift.

Two writers actively **degrade** structure:

- **Make Permanent** (`makePermanent` `:14799-14864`) writes only line/`_veg`/`_flags`/
  `_softAlt` and **deletes** `_mainItem`, `_mainAlt`, `_sides`, `_slots`, `_noPorkAlt`,
  `_altMeals`, `_altMealsNone` (`:14833-14839`) — a structured→string-only downgrade. Same
  pattern in make-swap-permanent (`:15243-15250`) and the revert paths.
- **The import path** (`assignMenuSlot` `:15729-15737`) writes line/`_mainItem`/`_sides`/
  `_flags`/`_veg`/`_halal` but **never `_slots`** — the July-2 workbook import is why most
  meal-periods are slotless (§2.3).

Also: `<meal>_halal` is **import-only** (`:15733`) — the editor never writes or clears it, so
a stale halal alternative can survive a main-dish change via the day-level spread, into the
published artifact and plating (`:19773`).

### 1.6 Publish flow

`_doPublishToGitHub` (`:12242+`): auto-publish-off check → **stale-tab guard**
(`:12260-12274`; auto skips, manual confirms) → credentials → **overlay cloud pre-merge**
(`:12293-12296`) → **artifacts built** (`:12305-12310`; `buildMenuJSON` at `:12306`) →
validation → **Gate-9** (`:12316-12338`; Stop-level structural defects block auto, prompt
manual) → **10 per-file commits** (`:12339-12351`, each `_ghPushFileNow` = one contents-API
PUT, serialized through `_ghWriteQueue` with hydration / empty-clobber / >70%-shrink rails
`:12145-12160`).

> **Live incident (2026-08-15, during the §0 defuse — evidence for the silent-drift plan's
> D1 atomic-publish slice):** overlapping publish waves (each save auto-publishes, plus the
> overlay side-publish `:14042`) raced on file SHAs; the browser caches GitHub contents-API
> responses ≤60s, so `_ghPushFileNow`'s single SHA-refetch retry (`:12170-12185`) re-grabbed
> a stale SHA and failed loudly on `menu_overlay.json` + `menu_current.json` — while a later
> wave landed everything. A page reload resolves it (fresh SHA fetches); the failure is a
> 409 race, never auth. The 30%-shrink rail also correctly refused a shorter-than-cloud
> `recent_log.json` in the same window (benign).

---

## §2 The three problems, adjudicated against source

### 2.1 P1 — "durable authority is one operator's browser" → **corrected: a racy half-seam already exists**

The brief's claim that there is *no* non-UI durable path is wrong in a useful way: the
boot/sync re-ingest (§1.3) IS a repo→app-state path, gated on `_meta.exported`. Every
historical revert is explained by hand edits failing that gate, not by the absence of a path.
The design question sharpens from "invent a seam" to **"turn an undocumented, racy,
device-dependent accident into a contract"** — or deliberately close it. The genuine gaps:
publish doesn't consult the cloud artifact before regenerating; the publisher's self-reingest
flattens the overlay; overlay propagation is day-atomic local-wins; and nothing states what a
*legitimate* committed edit must contain.

### 2.2 P2 — "the overlay duplicates whole slots and can contradict the menu" → **confirmed, and measured worse: it currently carries zero information**

All 6 overlay entries (5 lunch, 1 dinner) hold the identical 11-field set, and **66 of 66
fields are byte-identical to the same slots in `menu_current.json`**. The overlay is 100%
redundant right now — the "intended edit" is recoverable only from git history. Cause: every
`_finishMenuSave` ends in `publishAndSync` (`:16923`) and the publisher self-reingests (§1.3),
so an overlay entry is load-bearing only for the minutes between an edit and the next
publish+boot.

The overlay has **two different granularities at once**: field-level union at runtime
(`:14090`) but whole-day atom, local-wins, in the cloud merge (`:12056-12058`). And the
door-smoke contradiction gate (`tests/door-smoke.mjs:1986-2037`) polices only **non-empty
string fields present on both sides** — ⟲ of the 66 overlay fields, only 27 are even
eligible (measured); an overlay `_flags.hasPork` contradicting canonical would pass silently.
On current data the gate is **guaranteed-green by the self-reingest flattening** (its 27 real
comparisons all match because publish made them match) — it cannot fire until something
breaks the flattening.

### 2.3 P3 — "the composed line is a denormalized copy stored in several places" → **confirmed and quantified**

Worked example — W1 TUE lunch, the side "Sweet potatoes": composed `lunch` + `lunch_veg` +
`lunch_sides` + `lunch_slots.starch` = 4 copies in `menu_current.json`, mirrored ×4 in the
overlay, plus `routing_by_meal.json` `_components` — **~9 physical copies of one side-dish
fact** across the published set. Allergen truth is triplicated per slot (`_flags` ≡
`_slots.main.flags` ≈ derived `allergens_<meal>`).

The load-bearing measurements (run against the committed artifacts):

- **Where `_slots` exist, derivation is already byte-exact: 24/26 meal-periods.** Running
  `buildMealName`'s formula over each committed `_slots` snapshot reproduces the stored
  composed line byte-for-byte — the only 2 mismatches are **the two Parsnip line-only edits**
  (W1 TUE + W2 SAT lunch), i.e. the armed footgun itself. `_sides`/`_mainItem`/`_veg` derive
  **26/26** where slots exist.
- **But 58 of 84 meal-periods have no `_slots` at all** (nearly all breakfasts + the
  July-2-import shape; 7 days have none on any meal). The composed line is underivable there
  today. **Positional line→slots backfill round-trips 57/58** (`_mainItem` == segment 0,
  `_sides` == the rest, on all 58); the one exception is W2 THU lunch (8 comma segments >
  3 side slots) — one manual editor pass.
- **`<meal>_flags` is NOT derivable from `_slots.*.flags`: 12/26 mismatch.** Stored `_flags`
  carries manual `isSpicy`/`isCarb` checkboxes, the halal-cert dialog outcome, `MEAT_DETECT`,
  and union-of-streams extras. **`_flags` must remain an irreducible stored fact** — it is the
  anaphylactic domain, and under-flagging is the unsafe direction.
- **`<meal>_veg` on import-shaped (slotless) periods is not positionally derivable** — 32
  import veg strings carry their own irregular side tails. `_veg` stays a stored fact where no
  `veganalt` slot exists (tiered rule, §3.2).

So the brief's goal ("the composed line should derive from the slots") is **feasible and
already provably byte-faithful wherever slots exist** — the work is the backfill, the
degrading writers, and the enforcement seam, not the derivation itself.

---

## §3 Design options

### 3.1 P1 — the durable non-UI edit seam

#### Option 0 — forbid the seam; formalize the two-step dance (the honest baseline)

No app change. CI rejects commits touching `menu_current.json`/`menu_overlay.json` that don't
come from the publish path; agents/PRs produce an **editor checklist** (week/day/meal/slot/flag
deltas) Jason applies by hand. Zero blast radius, zero new races — but it enshrines the tax
the brief exists to remove, and converts silent reverts into blocked PRs rather than removing
the class. Named because every other option must beat it. **Ruled interim policy (Jason
2026-08-14): this IS the standing rule until a seam ships — checklists only, no committed
menu-JSON edits from any session.**

#### Option A — formalize + harden the existing re-ingest

Editor stays sole durable authority; a committed edit is a legitimate **import** iff it meets
a published contract: **content-complete** (composed line AND `_sides` AND `_slots` AND
`_flags` updated in lockstep, matching overlay entry updated if that day has one) **and bumps
`_meta.exported`**. PR #72 fails this contract by design.

Hardening slices (all small):

- **A-1 publish pre-merge exported-check:** alongside the overlay pre-merge (`:12293-12296`),
  fetch cloud `menu_current.json` via the **API contents endpoint** (not raw — CDN cache lags
  minutes); if `remote._meta.exported > concUploadedMenuTimestamp`, run the same ingest as
  `:10087-10103` before building artifacts. Closes the unsynced-tab clobber (a publisher is
  online by definition).
- **A-2 self-reingest fix:** on successful publish, set `concUploadedMenuTimestamp` to the
  just-published `_meta.exported`. Stops the flattening; the overlay becomes the delta layer
  it claims to be.
- **A-3 overlay propagation fix:** per-(week,day) `_editedAt` epoch stamp (a **number** —
  invisible to the string-only contradiction gate) + `doorMergeMenuOverlayWithCloud` becomes
  **newest-wins per day**. ⟲ Two review corrections: (i) the tie-break must be
  **stamped-beats-unstamped** — every existing local overlay entry is unstamped, so a plain
  "local-wins fallback when unstamped" would make a stamped committed cloud day lose to
  exactly the stale local days it exists to displace; (ii) **A-3's merge grain is fork F4's
  decision** — newest-wins-per-day implements F4's "otherwise" arm; a surface-and-ask ruling
  requires slot-level diffing at merge time (closer to B's model) and reshapes A-3. Without
  A-3, the contract's overlay half is dead on arrival.
- **A-4 CI completeness linter:** any commit changing a menu day node must keep line ↔
  `_slots`/`_sides` consistent and bump `_meta.exported`. (The consistency check is P3's
  composer run in reverse — A-4 wants P3.0 first.)

Race matrix (edit vs publish):

| Scenario | Today | A hardened |
|---|---|---|
| Commit lands; devices sync before next publish | survives only if stamped AND day has no overlay entry | survives ⟲ (overlay-carrying days need A-3 too — the local overlay day still overrides the ingested base via the day spread `:14090`) |
| Commit lands; stale open tab publishes | **clobbered** | ⟲ survives via **A-1 + A-3 together**; A-1/A-2 alone protect only overlay-free days — and **both Parsnip days carry overlay entries**, so the motivating case needs A-3 |
| Operator's unsynced overlay edit vs commit, same day | commit silently overridden | newest day wins (A-3) — still day-atomic, older side's other-field edits lose |
| Two devices edit different meals of same day | one side lost | newest-wins: still lossy, now deterministic |
| Publisher reboots | overlay flattened | fixed (A-2) |
| Commit lands inside the pre-merge→push window | n/a | lost; recovered from git + linter. Accepted. |

Safety net untouched — ingested data flows through the same `getMenuData()` → `buildMenuJSON`
path, so Gate-9, the pork/halal invariant, allergen regen, and the cutover prune all still
apply. Residual honesty: **the P3 hand-sync tax stays** (the contract demands hand-syncing 4+
copies; the linter catches omissions, a human still does the copying), and a direct push to
`main` that skips CI reverts exactly like today.

#### Option B — a committed inbox artifact, applied through the editor's own writer path

Editor stays sole authority; a new `menu_edit_inbox.json` is a queue of **instructions to the
editor**, not an alternate copy of the menu. Slot-level facts only — a composed-line-only edit
(the PR #72 class) is **unexpressible by design**:

```json
{ "_meta": { "version": 1 },
  "edits": [ { "id": "…", "created": "…", "author": "agent:… / PR#…",
    "week": "2", "day": "SATURDAY", "meal": "lunch",
    "slots": { "xtra": { "manual": "Parsnip and Carrot", "flags": {} } },
    "flagPatch": { "isSpicy": true }, "note": "…", "appliedAt": null } ] }
```

Mechanism — the real work is a **headless writer core**: extract pure top-level composers
(`composeMealNameFromSlots`, `composeSidesFromSlots`, …) plus `applyMenuSlotEdit(week, day,
meal, patch)`, which loads the node's `_slots`, applies the patch, recomposes
line/sides/mainItem, and writes the full overlay node via `saveMenuBaseOverlay` — byte-for-byte
what `_finishMenuSave` would write. The editor is rewired to call the same cores. **This is
the same extraction as P3's composers** — B and P3 are one refactor seen from two sides.
Ingest runs at boot, daily sync, and publish pre-merge; **every device applies locally**,
which sidesteps the day-atomic overlay merge entirely; application is idempotent by content.
An edit targeting a slotless day fails **loudly** (banner), never guessed.

Why B beats A structurally: **the instruction survives an ignorant publish** — it lives in an
artifact publish doesn't regenerate, so even a publish that raced past it leaves the edit
standing for the next device to apply and republish. And because an applied edit *is* an
editor edit downstream, it inherits the **export/publish** safety nets (Gate-9, pork/halal
invariant, allergen regen, anaphylactic lockout, cutover prune) automatically.

⟲ **Review correction (P1, food-safety) — the edit-TIME flag machinery is NOT inherited.**
The editor's save flow, *above* `_finishMenuSave`, is where flags get made honest: manual
checkboxes + `buildUnionFlags`, the **`MEAT_DETECT`** protein auto-detect, the **halal-cert
dialog** (`:16758-16815`), and the recipe-link allergen autofill (`:17040-17046`). A raw
inbox edit that names an allergenic dish with empty/wrong `flagPatch` would publish under-set
`_flags`, and the export regen then produces a **consistent-but-wrong** `allergens_<meal>`
line — under-flagging, in the anaphylactic domain, past Gate-9 (structural-only). **B is
therefore only viable with a flag-derivation rule in `applyMenuSlotEdit`:** resolve
`recipeName` slots against the CODEX feed to autofill flags (as the editor does); run
`MEAT_DETECT` + union over the patched slots; **reject loudly** any `manual` slot text that
is allergen-suggestive but arrives with empty flags (fail-closed — a rejected inbox edit
becomes an editor checklist item). The §3.1 comparison row and the F1 lean stand only with
this rule included in B's scope.

Zero consumer blast radius (new artifact nobody reads; `menu_current.json` shape unchanged).
Agent edits become reviewable, provenanced slot-level PR diffs. Costs: highest build effort of
the viable options (the writer-core extraction must be a move, not a copy — and now includes
the flag-derivation rule above); B fixes committed→device, not device↔device (A-3 remains
complementary); the old raw-edit door should be CI-closed (Option 0's linter) as the new one
opens.

#### Option C — the repo artifact becomes authoritative (presented fairly; expected to lose)

Publish stops regenerating; every editor save is a read-modify-write commit via `PublishAuth`;
app-state becomes a cache. Loses today on the standing constraints: **offline/file:// breaks**
(a queued offline save re-creates the merge problem on the safety-critical write path);
inverts the localStorage-is-the-user's-data rule; every save needs network + token + 409-retry
UX; the safety net (Gate-9, export invariants) must relocate from publish-time to save-time;
routing still regenerates from app-state, so the two can be built from different menu states
unless publish re-fetches anyway. What it buys: P1 dissolves definitionally, git history =
menu history — and it is the natural **HOUSE Phase-5 (SharePoint/Graph)** shape. Record as
**"not now, not never."** (A publish-time 3-way JSON merge variant was considered and flagged
clever-and-therefore-suspect: a hand-rolled silent merge inside a food-safety pipeline, with
no operator in the loop — superseded by B's explicit-instruction model.)

#### P1 comparison

| | 0 forbid | A harden ingest | B inbox | C repo-authoritative |
|---|---|---|---|---|
| Committed edit survives ignorant publish | n/a | guarded, not guaranteed | **yes** | yes (definitional) |
| Hand-sync tax per edit | full | full (CI-linted) | **none** (slot facts, recomposed) | none |
| Overlay day-atomic trap | untouched | A-3 required | bypassed for committed edits | overlay retires |
| Safety-net relocation risk | none | none | ⟲ none **iff** the flag-derivation rule ships with it (see the P1 correction above); raw flags would open under-flagging | high |
| Offline / token posture | intact | intact | intact | violated |
| Build cost | ~0 | small | medium (≈ P3.0) | large |

### 3.2 P3 — derive the composed line from the slots

**Irreducible-fact table (end state):**

| Field | End state | Why |
|---|---|---|
| `<meal>_slots` | **FACT** | the structured authoring truth |
| `<meal>_flags` | **FACT** | not derivable (12/26): manual isSpicy/isCarb, halal dialog, MEAT_DETECT, stream-union — anaphylactic domain |
| `<meal>_halal` | **FACT** | import-only; EXPO's D0.1 gate pins byte-stability on one of them |
| `<meal>_altMeals` (+`_altMealsNone`) | **FACT** | authored |
| composed `<meal>` line | derived | 24/26 today → 26/26 after the §0 defuse |
| `_sides` / `_mainItem` / `_mainAlt` / `_noPorkAlt` / `_softAlt` | derived | 26/26 proofs; PROOF's `split(',')[0]` contract preserved by construction |
| `<meal>_veg` | **tiered**: derived iff a `veganalt` slot exists, else stored | import veg strings are not positionally derivable |
| `allergens_<meal>` | already derived at export (`:11642`) | unchanged; 14-flag order pinned (`door-smoke:524-545`) |

**The published artifact keeps the composed string forever** — `assertMenuContractShape`
(`door-smoke:24-37`) requires `typeof day.lunch === 'string'`, and EXPO/HUB/PROOF all consume
it. What changes is *who composes it and when*.

**Owner options:**

- **(b) Editor composes (as today) but becomes the ONLY writer, + a publish-time consistency
  check** — `line ≡ derive(slots)` wherever slots exist, else Gate-9 **Stop**. Smallest delta;
  zero byte change at publish; converts the silent-revert class into a loud publish block.
  Not yet "stored once" — the copies remain, now policed.
- **(a) Export owns the derivation** — `buildMenuJSON` emits derived strings wherever `_slots`
  exist (tiered: pass stored through elsewhere), via **pure top-level composer functions**
  taking slots as a parameter (vm-harness-friendly: `extractFunctionBlock` can pull them into
  the `:487-510` test context; editor builders delegate to the same functions). The drift
  class becomes *impossible in the artifact* rather than policed.
- **(c) Read-time derivation in `getMenuData()`** — one truth for app and export, retires the
  comma-count heuristic — but the hottest path in the app, entangled with the overlay merge,
  and hardest to stage byte-identically. **Named, not proposed.**

**Lean: (b) → (a), staged** — the shadow-then-cutover pattern EXPO used for routing.

**Byte-identity is the hard bar** (see §4): the derivation must reproduce today's strings
exactly. Proof design — a **shadow parity gate** in door-smoke, diagnostic first:

1. vm-extract the app's **own** composers (never a test reimplementation).
2. For every meal-period with non-empty `_slots` in the committed artifact: assert
   `composeMealLine(slots) === day[meal]`, ditto `_sides`/`_mainItem`, and `_veg` iff
   `slots.veganalt` exists.
3. **Slotless periods are counted, not failed** — a ratchet pinned `≤ 58`, decremented by
   backfill, ending at assert-zero.
4. An **explicit known-divergence allowlist**. ⟲ Lifecycle corrected for consistency with §6:
   the expected order is defuse-first, so the allowlist is **authored EMPTY**; the two Parsnip
   periods enter it only if the gate somehow ships before the §0 defuse. Either way a stale
   entry goes red (the `eee354c` honesty rule: a check that fails on healthy data is not a
   check).
5. The same composers run over each overlay node's `_slots` — overlay self-consistency proven
   by the same gate.

**Slice ladder:**

| Slice | Content | Published bytes |
|---|---|---|
| P3.0 | extract pure composers; editor delegates (behavior-identical refactor) | unchanged |
| P3.1 | shadow parity gate (24/26 + allowlist + ratchet ≤58) | unchanged |
| P3.2 | stop the degraders: Make Permanent synthesizes slots instead of deleting them (`:14833-14839`); `assignMenuSlot` synthesizes slots on import | unchanged |
| P3.3 | **in-app** positional backfill over `concUploadedMenu` (seg0→main, seg1→starch, seg2→vegside, seg3→xtra, `flags:{}`) + republish; W2 THU lunch by hand; ratchet → 0 | byte-identical by construction (join order is positional) |
| P3.4 | enforce: parity check joins Gate-9 as a Stop | unchanged |
| P3.5 | export owns: `buildMenuJSON` derives (tiered); vm fixture gains `_slots` | byte-identical, now guaranteed |

*Note: the backfill (P3.3) must land in **app-state** (an in-app normalizer + republish),
never as a committed-JSON edit — a committed backfill is precisely the footgun this program
exists to kill, and under the interim ruling it's also policy-forbidden.*

### 3.3 P2 — the overlay's future

- **(a) True field-level delta.** `_finishMenuSave` writes dirty fields only; the
  contradiction gate retires as moot. But honest (a) requires a **field-level cloud merge** —
  new conflict semantics in a safety-critical path (note the two-device loss already exists
  today at day grain; deltas widen it to same-meal fields without the merge work) — plus
  rework of `revertMenuEdit`'s fixed 9-key delete (`:16940-16948`) and `sweepAltFlagPollution`
  (assumes `_flags`+`_slots` co-exist). High-touch for a layer measured at zero information.
- **(b) Retire the overlay.** What still depends on it: the minutes-wide pre-publish
  cross-device transport window; the publish cloud pre-merge as a net for edits stranded on a
  never-publishing device; a "what changed" record (already only in git). Retiring deletes the
  contradiction class *and* the standardCutover prune's reason to exist — but it is
  **entangled with P1**: the overlay file is the natural candidate vehicle for a committed
  seam, so retiring before the P1 ruling forecloses an option.
- **(c) Publish-self-consistent full-node** (the cheap waypoint): at publish, regenerate each
  overlay entry's derived fields from that entry's own `_slots` (same composers). Contradiction
  becomes impossible at the seam rather than policed after; redundancy remains but is derived
  and harmless. Rides along P3.5 nearly free.

**Lean: (c) now; rule (a) vs (b) together with P1** — the overlay's future IS the P1 seam
question.

---

## §4 Cross-app blast radius

Every consumer of `menu_current.json`, what it reads, and what each change class does to it.
(Full survey: DOOR, EXPO, HUB, MISE/recipe-hub, PROOF — runtime, gates, and docs.)

**The three headline rules:**

1. **Additive fields are safe.** No consumer or gate asserts an exact day-node key set —
   Gate-9's validator checks presence of the 3 meal strings only; door-smoke's contract check
   is presence-only; EXPO wholesale-assigns `MENU = data.menu` (no whitelist); HUB whitelists
   10 named fields; DOOR already ships **13 distinct day-node key shapes** with every gate
   green. One caution: a new provenance/authoring field must be an **object, not a string** —
   the contradiction gate polices string fields shared between overlay and menu.
2. **Byte-identity of the composed line is the hard bar.** Three independent surfaces re-parse
   it: EXPO's `parseMealComponents` comma-split (expo `index.html:11933` → `decomposeMenu`
   :12921) drives **all side routing** — one changed separator silently re-routes production;
   HUB's `compareBoardMenuToDoor` (hub :1500, `_normMealText` :1486) collapses whitespace but
   **not comma spacing** — drift fires the freshness banner board-wide; PROOF uses
   `split(',')[0]` with `*_mainItem` (proof :519, :623) for section attribution — keep
   `_mainItem ≡ segment 0`. Also keep `*_halal` stable: EXPO's D0.1 alignment gate reads
   exactly `menu['2'].SATURDAY.lunch_halal` and blocks adoption of the whole menu on mismatch
   ⟲ (the gate normalizes case/punctuation and accepts 4 name variants — byte-stability is
   the safe superset, not the literal bar; a normalized-equivalent emission stays green).
3. **A field-level overlay is invisible to every runtime consumer** — only DOOR applies the
   overlay; `menu_current.json` is the merged output. Test-side casualties only.

| Consumer | Reads | (a) additive field | (b) derived line, byte-identical | (c) field-level overlay |
|---|---|---|---|---|
| EXPO loaders (`loadMenuFromDOOR` :36081, `acceptMenuSync` :35844) | whole `menu` + `_meta` | ○ | ○ | ○ |
| EXPO `decomposeMenu` :12901 | `lunch/dinner/*_veg/*_halal/*_flags.{halalCertifiedMeat,hasPork}` | ○ | ○ iff byte-identical; **●** on any separator drift | ○ |
| EXPO D0.1 gate :35640 | `['2'].SATURDAY.lunch_halal` | ○ | ○ (`_halal` stays stored) | ○ |
| EXPO `MEALS` payload :22040 → HUB freshness | `lunch`,`dinner` | ○ | ○ / **●** if bytes drift | ○ |
| EXPO parity fixture gate | fixture ↔ baked literal (NOT ↔ DOOR) | ◐ red on next fixture refresh until re-bake (by design) | ○ invisible | ○ |
| EXPO `jerk_tofu_menu_parity_gate` | DOOR live menu + **overlay `_slots` path** + routing | ○ | ◐ exact-string pin | **●** — but see below |
| HUB `applyDOORMenu` :4218 | 10-field whitelist (no `lunch_halal` — pre-existing gap) | ○ | ○ | ○ |
| HUB `compareBoardMenuToDoor` :1500 | composed `lunch`/`dinner` | ○ | ○ / **●** on drift | ○ |
| PROOF :519/:602-627 | `*_mainItem` (fallback `split(',')[0]`), `*_veg`, `*_halal` | ○ | ◐ keep `_mainItem ≡ seg0` | ○ |
| recipe-hub `door_vegalt_safety_gate` | seeds `.menu` wholesale into `concUploadedMenu`, boots DOOR | ○ | ○ | ● indirect (boots merged state) |
| DOOR Gate-9 / door-smoke contract | presence of 3 meal strings | ○ (no key-set assert → no Stop) | ○ (line still emitted) | gates re-pointed (§3.3) |

**⚠ Verified while surveying:** `conc-kitchen-expo/tests/jerk_tofu_menu_parity_gate.mjs` — the
only overlay-shape coupling in the system — is **not in EXPO's CI** (`schedule-gate.yml` has no
entry) **and is already red against today's DOOR data** (asserts an overlay `['1'].MONDAY`
node that doesn't exist, and pins `dinner_veg` = "Jerk Tofu, Cabbage stirfry, Rice and Beans"
vs live "Jerk Tofu, Rice and Beans, Cabbage Stirfry"). It constrains nothing; an EXPO-side
re-pin is owed **under every option including "do nothing"** (§7).

---

## §5 Forks for Jason (leans marked; rulings yours)

| # | Fork | Options | Lean |
|---|---|---|---|
| F1 | **Operating model** | editor-sole-authority + a legitimate import seam (A/B) vs repo-authoritative (C) vs forbid (0) | A-hardening now, **B as destination** ⟲ (contingent on B's flag-derivation rule, §3.1), C recorded not-now-not-never. *Evidence: C breaks offline/token + relocates the safety net; 0 keeps the tax; A leaves the hand-sync tax; B is the only shape where an edit survives an ignorant publish AND recomposition is automatic.* |
| F2 | **Do non-UI actors write menu facts at all?** | seam writes vs editor checklists forever | end-state: yes, via B's reviewable slot-level diffs. **Interim RULED (2026-08-14): checklists only until a seam ships** — no committed menu-JSON edits from any session. ⟲ *Note: the interim rule is doc-enforced only — the Option-0 CI tripwire (reject menu-artifact-touching commits) is not scheduled until A-4; accept honor-system, or pull the tripwire forward as an early slice (your call).* |
| F3 | **Seam payload** | slot-level facts only (composed-line edits unexpressible — P3-aligned) vs whole-node edits | slot-facts only. *Evidence: every historical revert was a line-only or node-partial edit; whole-node acceptance re-opens the P3 hand-sync tax inside the seam itself. If ruled whole-node, Option A's contract+linter is the shape, not B.* |
| F4 | **Collision policy** (committed edit vs local edit, same slot/day) | newest-wins / operator-wins / surface-and-ask | surface-and-ask for same-slot; newest-wins otherwise. ⟲ *Mechanics per option: surface-and-ask = a non-blocking banner + publish proceeds with local (stale-tab-guard pattern); operator-wins = inbox entry parks as a checklist item; newest-wins = stamped-beats-unstamped compare (A-3). This ruling sets A-3's merge grain — see §3.1.* |
| F5 | **Sequencing** | P3 composers first vs seam first | **P3.0/P3.1 first** — the composer is B's prerequisite and A-4's engine; plus A-1/A-2 alongside (no-regrets, correct under any ruling) |
| F6 | **Publish-fetch failure posture** (A-1) | fail-open + advisory vs auto-publish-skips | mirror the stale-tab guard: auto skips, manual asks. *Evidence: `preMergeOverlayWithCloud` today is fail-open; the guard's manual/auto asymmetry (`:12260-12274`) is the house pattern for exactly this trade.* |
| F7 | **P3 owner** | (b) enforce-only vs (a) export-owns vs (c) read-time | (b) → (a) staged; (c) named only |
| F8 | **Backfill vehicle** | in-app positional normalizer + republish vs manual editor pass ×58 | normalizer; manual only for W2 THU lunch |
| F9 | **P2 endgame** | field-level delta (a) vs retire (b) vs publish-self-consistent (c) | (c) now; rule (a)/(b) together with F1 |
| F10 | **`_veg` end-state on import-shaped periods** | force derivation vs tiered ratchet | ratchet — forcing changes published bytes |

**Recommended path (per the ruled doc posture — accept or override):**
§0 defuse → P3.0 composers + P3.1 shadow gate + A-1/A-2 hardening → P3.2–P3.5 ladder →
B inbox (after F1–F4 rulings) → P2(c) with P3.5 → P2(a)/(b) per F9.

---

## §6 Proposed first slice

1. **Slice 0 — the §0 defuse.** Operational, editor-only, before anything else. Converts
   PR #72 from "armed to revert" to "landed as fact", closes the W2 SAT under-count, and
   means the P3.1 allowlist is authored empty.
2. **First code slice (after rulings): P3.0 + P3.1 + A-1/A-2.** Pure composer extraction
   (behavior-identical; editor delegates), the shadow parity gate (authored-to-fail against a
   deliberately broken composer, then green 26/26 post-defuse + ratchet ≤58), and the two
   no-regrets ingest fixes (publish pre-merge exported-check; self-reingest timestamp). Zero
   published-byte change — provable by re-running a publish build and diffing, plus door-smoke
   staying green. Normal DOOR gate discipline applies (authored-to-fail → build → 2-lens
   review → fold). ⟲ *Scope honesty (review): A-1/A-2 alone do NOT close the unsynced-tab
   clobber for overlay-carrying days (the day spread lets a stale local overlay day override
   the ingested base — both Parsnip days are exactly this case); full closure needs A-3,
   which waits on the F4 ruling. A-1/A-2 still fix the self-reingest flattening and protect
   overlay-free days — worth landing regardless.*

---

## §7 Open questions for Jason

1. **Is the overlay's minutes-wide transport window ever operationally load-bearing?** Do two
   operators ever edit menus on different devices between publishes? If genuinely
   single-operator, P2(b) retire gets much cheaper — but it should still be ruled with F1.
2. **EXPO-side follow-ups (owed regardless of any ruling here):** re-pin or retire
   `jerk_tofu_menu_parity_gate` (already red, not in CI); decide whether the parity **fixture
   ↔ live DOOR** leg gets a CI edge (the fixture is currently 2 weeks / 12 key-classes behind
   DOOR with a green gate — the same drift class A1a was built to catch, one hop upstream).
3. **HUB gap:** `applyDOORMenu` maps `dinner_halal` but not `lunch_halal`, so HUB's menu panel
   can never show a lunch halal row. Fix in HUB, or accept?
4. **Flagless-slot allergen staleness:** `buildMenuJSON` regenerates `allergens_<meal>` only
   when `_flags` exists (`:11630`) — a flagless slot publishes stale allergen text. Backfill
   flags, or make export fail loud on flagless slots? (Food-safety adjacent — worth a ruling.)
5. **Doc hygiene follow-up (separate docs PR):** DOOR `CLAUDE.md` says `{_meta, weeks[]}` for
   the menu shape (it's `{_meta, menu:{...}}`), counts door-smoke at 64/67 (it's 70), and
   locates the comma-join in the publish (it's in the editor's `buildMealName`). Also EXPO's
   `schemas/MENU_SCHEMA.md` is pinned at "v30".
6. **Should `concMenuEdits` (the never-published fourth layer) be folded or documented?**
   Currently it can make Today's Meal Context disagree with everything published.

---

## §8 Do-not-touch registry (carried from the brief; any build must preserve all of these)

- **Food-safety net:** publish authority (`PublishAuth`, no token resurrection); **Gate-9**
  structural block (`:12316-12338`); anaphylactic routing lockout (`getAnaphConflictRooms` /
  plating ALERT — keyed off `<meal>_flags`, which stays a stored fact under every option
  here); the `hasPork && halalCertifiedMeat ⇒ false` export invariant (`:11638-11641`); the
  allergen-line 14-flag serialization order (`door-smoke:524-545`); the `standardCutover`
  overlay prune (until/unless P2(b) retires the layer it guards).
- **Platform:** single-file HTML, no build step, graceful `file://` degradation.
- **Harness:** door-smoke extracts code by string-matching — functions must remain top-level
  `function NAME(...)` declarations; testable-core blocks must stay self-contained /
  vm-injectable; constants single-quoted; LF line endings; the literal
  `'version:DOOR_SCHEMA_VERSIONS.menu_current'` must survive inside `buildMenuJSON`.
- **Version contract:** `_meta.version` is a hand-maintained schema constant — non-monotonic,
  per-artifact; never an ordering/freshness signal. (The seam designs use `_meta.exported`
  and content, never `.version`.)
- **Never hand-edit `routing_by_meal.json`** — it regenerates from the plating engine on
  publish.
- **Cross-app:** EXPO D0.1 gate needs `menu['2'].SATURDAY.lunch_halal` byte-stable; the
  composed `lunch`/`dinner` strings must stay byte-identical through any P3 cutover (EXPO
  comma-split routing, HUB freshness compare, PROOF section attribution).

---

*Investigation provenance: 3 line-anchored recon sweeps (publish path · overlay/gates/history ·
cross-app consumers) + 2 design passes (P1 seam · P3/P2 representation), load-bearing claims
re-verified first-hand (re-ingest gate `:19190-19202`, day-spread merge `:14079-14094`, overlay
66/66 redundancy, 24/26 derivation parity, jerk_tofu gate red + absent from EXPO CI).*

*Review record (2026-08-14, 2 lenses, both ran against source + committed data): **Lens 1
correctness/food-safety** — 33 index.html anchors checked (32 exact, 1 drift fixed), 5
door-smoke anchors (2 pin citations corrected), 12 cross-app anchors, 12 measurements
independently reproduced (66/66 · 24/26 · 26/26 · 58/84 · 57/58 · 12/26 · 13 shapes · the
`_meta.exported` history). Material findings folded ⟲: Option B's flag-derivation rule
(under-flagging channel closed), the W2 SAT no-pin correction, the §0 side-effect disclosures
(veg-line recomposition, double-parsnip veganalt trim, two-key `_components`), the A-1+A-3
race-matrix correction with stamped-beats-unstamped. **Lens 2 completeness/fork-adequacy** —
verdict SHIP-WITH-FIXES; consumer sweep found no missed runtime reader of `menu_current.json`
in the six repos; folds ⟲: the Extras-vs-Event-Name slot trap, the allowlist lifecycle,
F4/A-3 reconciliation + fork-table evidence lines, the interim-rule enforcement honesty note,
the D0.1 normalization parenthetical, eligible-fields 27 (not ~24), "guaranteed-green" (not
"vacuous").*
