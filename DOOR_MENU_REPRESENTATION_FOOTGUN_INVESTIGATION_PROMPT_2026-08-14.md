# DOOR menu-representation footguns — investigation prompt (2026-08-14)

> **Posture: investigate and design, do NOT build yet.** The crux (how a publish
> would merge an external/committed menu edit into app-state) is unsolved design
> work. The deliverable is a reviewed problem statement + options doc that Jason
> rules on — not an implementation. Read the whole prompt, verify every claim
> against source before trusting it, and surface what you can't resolve as
> questions for Jason.

## Why this exists

Every menu change to DOOR is a two-step dance that keeps biting us: a committed
JSON edit that *reverts on the next publish*, plus a manual re-do in the DOOR
menu editor. It bit #68/#69/#70 (the Nigerian/Blackened reconciliation), the
2026-07-19 Egg-Salad `hasPork` fix, and again the 2026-08-14 "Parsnip and Carrot
on the regular lunch line" mirror (EXPO #2 / PR #231; DOOR PR #72). The pattern
is not operator error — it's the shape of the menu representation. This prompt is
the sit-down to look at that shape and decide whether/how to fix it.

DOOR is the **menu authority** for all of HOUSE (DOOR → EXPO → HUB). The menu is
the single most-changed thing in the system, and changing it safely is the whole
point of DOOR. So the tax lands on exactly the operation the system exists to serve.

## The three problems (verify each against source before acting)

### P1 — the durable authority isn't the repo; it's one operator's browser
The durable menu authority is DOOR's **app-state** (`concUploadedMenu` — the July-2
workbook import — plus the `menu_overlay.json` delta layer). A publish
**regenerates `menu_current.json` from app-state** (`buildMenuJSON`), so a
committed edit to `menu_current.json` looks authoritative but is a mirage: the
next publish reverts it. There is **no non-UI, durable path to change the menu** —
an agent or a script can only edit the committed artifact, which is the copy that
loses. Confirm the regeneration path and that `concUploadedMenu` is browser-local
with no server/repo mirror.

### P2 — the overlay duplicates whole slots, so it can silently contradict the menu
`menu_overlay.json` is the "post-import user deltas" layer applied **on top of**
`menu_current.json`, and it **wins**. But each edited slot in the overlay is a
**full node** (composed `lunch` line + `lunch_veg` + `lunch_flags` + `lunch_sides`
+ `lunch_slots` + …), not a field-level delta. So editing the menu without editing
the overlay in lockstep produces a contradiction where the *stale overlay overrides
the change*. The `door-smoke` "overlay must not contradict the published menu" gate
(`tests/door-smoke.mjs`, ~L2020–L2040) exists precisely because the shape allows the
contradiction — it's a guard around a footgun, not a natural invariant. A true
delta (only the changed field) would make the trap impossible.

### P3 — the composed line is a denormalized copy stored in several places
The same fact — "parsnip is a side of this lunch" — lives in the composed `lunch`
string (`"main, side, side, …"`), in `lunch_sides`, structurally in
`lunch_slots.sides`, **and** duplicated across `menu_current.json` + the overlay.
Four-plus hand-synced representations of one fact. This is EXPO's own `#41`
principle inverted (*derive what's declared, store only the irreducible*): the
composed line should **derive** from the structured slots, not be an independently
writable fourth copy that can drift.

## The goal

A menu change should be **one authoritative edit that survives publish**, with the
fact stored once and everything else derived. Concretely, explore:

1. **A durable non-UI menu-edit seam** — some way (a committed overlay the publish
   *merges* rather than blindly regenerates over, an app-state ingest, an import
   hook) for a change to land in the durable authority without hand-driving the
   editor. This is the crux and the hard part: publish currently *regenerates*
   from app-state, so the design question is "how does an external edit get into
   app-state, safely, without clobbering the operator's working copy?"
2. **Overlay as a true field-level delta** — carry only the overridden field, so
   lockstep editing stops being a trap and the contradiction gate becomes moot.
3. **Derive the composed line from the slots** — collapse the 4-copy duplication so
   there's one place to change a side.

## Hard constraints (do not break these)

- **The food-safety net stays intact.** Publish authority, the Gate-9 structural
  block, the anaphylactic routing lockout (`getAnaphConflictRooms` / plating ALERT),
  the `hasPork && halalCertifiedMeat ⇒ false` export invariant, and the
  overlay-cutover marker (`standardCutover`, which prunes pre-cutover overlay days)
  are load-bearing. Any redesign must preserve every one of them.
- **Single-file HTML, no build step, graceful `file://` degradation.** DOOR is one
  `index.html`; the string-matching `door-smoke` harness depends on that shape.
- **`_meta.version` is a schema constant, not a data revision** — don't lean on it
  as an ordering/freshness signal (it's non-monotonic and per-artifact; see
  `CLAUDE.md`).
- **Never hand-edit `routing_by_meal.json`** — it regenerates from the plating
  engine on publish. Any menu-representation change must keep that regeneration
  correct.
- **Cross-app blast radius:** `menu_current.json` is EXPO's `loadMenuFromDOOR`
  input, and EXPO keeps a *baked fallback MENU* + a parity fixture
  (`conc-kitchen-expo/tests/fixtures/door_menu_current.json`, held equal by
  `menu_fixture_parity_gate`). A representation change that alters the published
  shape ripples into EXPO — scope it.

## Suggested first moves

1. **Map the real publish path.** Read `buildMenuJSON` and everything it reads
   (`concUploadedMenu`, `concMenuBase`, the overlay merge, the cutover prune). Write
   down exactly how a slot's fields flow app-state → published artifact, and where
   the composed `lunch` line is *composed* vs *stored*. This is the ground truth the
   whole design rests on.
2. **Characterize the overlay.** Is a full-node overlay load-bearing anywhere, or is
   it always redundant-except-the-one-changed-field? Prove it on the current data.
3. **Prototype the smallest real win first.** Deriving the composed line from slots
   (P3) is likely the lowest-risk, highest-clarity start and de-risks P2. The
   durable-seam question (P1) is the big one and may need a Jason ruling on the
   operating model (is the editor always the source of truth, or do we want a
   committed/importable menu that publish merges?).
4. **Name the forks for Jason.** e.g. "editor stays the sole durable authority, and
   we add a *safe committed-import* path publish merges" vs "the repo artifact
   becomes authoritative and the editor writes through it." Don't pick — present.

## Deliverable

A reviewed design doc: the verified publish/overlay/composition map, the three
problems confirmed (or corrected) against source, 2–3 concrete design options with
trade-offs and blast radius, the forks for Jason, and a proposed first slice. No
app-code change until Jason rules on the direction.

## Pointers

- `conc-kitchen-door/CLAUDE.md` — the publish-reverts-hand-edits footgun (Recent
  2026-08-10), the overlay-contradiction gate history (`eee354c`), the version
  contract (D7), the halal export invariant (2026-07-19).
- `conc-kitchen-door/tests/door-smoke.mjs` — the overlay-contradiction gate + the
  "11 repaired slots" pin (both react to menu-shape changes).
- `conc-kitchen-expo/EXPO_ROUTING_FIX_PUNCHLIST_2026-08-13.md` + PR #231 — the pass
  that surfaced this; EXPO PR #232 (version bump), DOOR PR #72 (the mirror that hit
  the footgun), CODEX cheat-sheet §7b (the kitchen-side learnings).
