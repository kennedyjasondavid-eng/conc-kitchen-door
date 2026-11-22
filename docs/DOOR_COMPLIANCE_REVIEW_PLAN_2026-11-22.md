# DOOR Compliance Review — plan of action (2026-11-22)

Jason, 2026-11-22: "please do a comprehensive UX review on compliance review. The user that will be engaged with it wants
a clean and simple interface and clear workflow full of soft feedback/nudges that rises to meet them", then "provide
before/after mockups", then on the two calls: "It's a preference can clear; no spicy won't usually have a note" and
"Fiona the manager is currently the one that uses this, or will use it. Might expand to other supervisors at some point."
Then: "Put a plan of action together and submit for review, then begin implementation."

Review and mockups: https://claude.ai/artifact/QQce1KzNL7KBk4QQ4SfAGz (private to Jason). **This file owns the line's
status (§6).**

## 1. What the screen is for

Fiona (the manager; later other supervisors) gets a note from Health & Wellness (H&W) for each restriction that needs
one, or decides it is a preference. Meals already follow every restriction from the moment it is entered; this screen
records **paperwork**, never routing. Nothing on it may take a warning off a plate without the same question the
resident editor asks.

## 2. What is there today (measured on `door_state.json`, Nov 21; `v31-standard.134`)

- 169 residents; 52 on the screen, all `Provisional`, 0 deadlines, 0 moderate, 3 on the anaphylactic list, 1 resolved.
- By what they need: anaphylactic 3 · allergies 10 · medical diets 21 · only No Pork / No Spicy 18.
- The state is one resident-wide field, `confirm` (`Provisional` / `Confirmed` / `N/A`), written from the tags by five
  writers (`index.html` ~6586 import apply, ~8025 and ~8063 queue apply, ~26566 Intake Portal, ~26723 direct save), plus
  `complianceResolved*` (5 fields), `complianceDeadline`, `isModerate`, `moderateNote`.

## 3. Findings this plan fixes

Safety
- **S1** A new intake into a room keeps the last person's `complianceResolved` and deadline: the new resident is
  Provisional but hidden from the screen for good.
- **S2** Any update to a resident (even adding Halal) rewrites `confirm` to `Provisional`, so a confirmed note is lost;
  and a resolved resident who gains a new restriction needing a note never comes back (resolved hides them).
- **S3** Resolve with the status left at Provisional takes the item off the list while it still reads Provisional.
- **S4** "Revert to Regular" clears every restriction, anaphylactic ones included, with no question, styled green.
- **S5** Anaphylactic rooms are not marked.

Flow
- **F1** No next step; **F2** the row doesn't say which restriction needs the note; **F3** Confirm Selected and Resolve
  Selected are the same; **F4** Set Deadline is a `prompt()` that drops a typo silently.

Calm
- **K1** amber "Saving…" banner on every keystroke; **K2** five columns that never vary; **K3** a permanent amber badge;
  **K4** the digest's Copy writes a literal `\n\n`; batch actions record "by " with no name; "Phase 5" copy.

## 4. The model (one owner)

Documentation is per restriction, not per resident.

- `r.docs = { "<tag>": { how: "note" | "preference", by, at, line? } }` — a record per tag that needs documentation
  and has been answered. `at` is an ISO date.
- `r.docAsk = { at, by, remindOn }` — "asked H&W, remind me on" (replaces `complianceDeadline` for new work; an old
  `complianceDeadline` is read as `remindOn` once).
- **One reader:** `doorDocState(r)` (pure, in a testable core) →
  `{ needs: [tags needing a note with no record], done: [tags with a record], anaph: bool, group, remindOn, due }`.
  `group` is `anaph` | `allergy` | `medical` | `preference` (only No Pork / No Spicy left), from `COMPLIANCE_TIERS`
  plus one small table of allergy tags.
- **One writer from tags:** `doorApplyDocTags(r, tagLabels, { newPerson })` replaces the five copies of the `confirm`
  line. A new person (intake over a room, new record) starts with no `docs` and no ask; an update keeps records for tags
  still present and drops the rest. `r.confirm` is then **derived**: no restriction → `N/A`; every documented tag has a
  record → `Confirmed`; else `Provisional`. So `confirm` keeps meaning what every other reader (registry, lookup card,
  restriction sheet, xlsx) already expects, and "resolved but Provisional" cannot exist.
- **Migration, once per record, at load and on every list taken from the kitchen** (`doorMigrateDocs`): a resident read
  `Confirmed` with tags needing a note and no `docs` gets a `note` record for each of those tags, `by` its
  `complianceResolvedBy` or "earlier", `at` its resolved date or the migration date. A resident with `complianceResolved`
  but still `Provisional` (S3's leftover) gets nothing: it shows again. `complianceResolved*` is kept on the record
  (history) but no longer read to hide anyone.
- The record travels with the resident list (`door_state.json`, a kitchen file, not served by Pages); no published
  schema changes. `registry_summary.json` is untouched.
- Anaphylactic: `doorIsAnaphResident(r)` decides the group; an anaphylactic resident whose restriction names no allergen
  is not listed here (Generate already asks about those, `.39`).

## 5. Slices (each its own PR, gate authored red on `main`, suite + CI browser contracts green, independent review on
the safety slice)

**C1 — safety and the model** (`v31-standard.135`). §4 in full; S1–S4 and K4. Resolve dialog: the status select goes;
pressing Resolve records a `note` for each tag still needing one. "Revert to Regular" leaves the dialog: it opens the
resident editor, whose Save already asks about taking allergens / the anaphylactic list off. Batch Confirm and Batch
Resolve become one "Mark documented" (F3). Batch name: asks for a name once (`ensureOperatorName`) before recording.
Digest copy fix. Gate `tests/compliance_docs_c1_gate.mjs`: S1 (intake clears), S2 (update keeps per tag; a new tag
re-opens), S3 (no resolved-and-Provisional), S4 (no revert path writes tags from this screen), migration, the five
writers all go through `doorApplyDocTags`, the digest.

**C2 — the worklist** (`.136`). Replaces the table with groups (anaphylactic · allergies · medical diets · usually a
preference), each row: room, chips (amber = needs a note, red = anaphylactic, grey = fine), one action ("Got the note";
"It's a preference" in the preference group), ⋯ for history / edit / remind. Documented fold (newest first, "by" and
date, Undo on each). Progress line ("11 of 52 documented"). Header buttons move to a quiet footer. Quiet per-row "Saved"
replaces the banner (K1). Mobile: one column, no sideways scroll at 390 px. Browser gate.

**C3 — the answer sheet** (`.137`). "Got the note" opens one question for that room (per tag when more than one):
Confirmed · It's a preference · Not needed any more (opens the editor) · Still waiting (remind 1 / 2 weeks). A batch
version for selected rows. Undo toast for 10 s before the send. `prompt()` gone (F4). Browser gate.

**C4 — nudges** (`.137`; C2 and C3 shipped as one, `.136`). Top suggestion (anaphylactic first, then the group with the oldest wait), reminder states
(grey → amber on `remindOn` → red for anaphylactic past due), sidebar badge shows only what is due (hidden otherwise;
K3), the in-page H&W email per group with Copy and "Mark as asked" (sets `docAsk`), the "all documented" state, a
nudge when a new person moves into a room. Browser gate.

Ruled (Jason, 2026-11-22): "It's a preference" clears with no note, for any tag needing one; No Spicy usually has
none, so it sits with No Pork. `COMPLIANCE_TIERS` is unchanged. The screen is Fiona's for now; every record says who.

Not in this line: H&W logging in themselves; documents stored in DOOR; moderate allergies (0 today; their flag and
note are kept and shown, unchanged).

## 6. Status

| Slice | State | PR | Gate |
|---|---|---|---|
| Plan | done: C1–C4 merged 2026-11-22 (plan review §7, slice reviews §8–§10) | — | — |
| C1 | merged, `v31-standard.135` | #282 | `tests/compliance_docs_c1_gate.mjs` 11 (red 11/11 on `13e0aa2`), browser `compliance_docs_c1` 22 |
| C2 + C3 | merged, `v31-standard.137` (one PR: the worklist's main button is the new question) | #284 | `tests/compliance_worklist_c2_gate.mjs` 8 (red on `ed97d83`), browser `compliance_worklist` 60; reviewed (§9) |
| C4 | merged, `v31-standard.138` | #285 | `tests/compliance_nudges_c4_gate.mjs` 6 (red on `1896ea0` and `main`), browser `compliance_worklist` 70 |

## 7. Plan review (independent, 2026-11-22): GO WITH CHANGES, folded into C1

- **P1-1** confirm worked out on every read, not only on write: the normaliser runs on every list loaded or taken from
  the kitchen and replaced `autoPromoteAutoTier`; Needs Review and revert go through the writer. Done.
- **P1-2** an older (.134) computer's Intake Portal or direct save changes the record in place and would keep the last
  person's answers: an answer older than the newest "Intake overwrite" history entry is dropped on read. Done. Limit: the
  history keeps 2 entries, so two more changes on an older build before any C1 computer reads the list would hide the
  overwrite; stale tabs reload themselves (W3d), so the window is small.
- **P2-3** an older build's Resolve writes Confirmed with no answers: the normaliser turns it into answers (migrated), every
  read, idempotent. Done.
- **P2-4** an anaphylactic room with no allergen recorded: lean followed (stays Provisional, listed with the anaphylactic
  rooms, fixed in the resident record). Jason can overrule.
- **P2-5** "It's a preference" on an anaphylactic allergen: lean followed for C3 (not offered for a tag in the room's
  anaphylactic tags or in the anaphylactic group). Jason can overrule.
- **P2-6** missed readers and writers: line labels corrected below; history keys, diff, export and seed handled; the
  Registry's deadline filters and the digest keep `complianceDeadline` until C3 moves reminders to `docAsk`.
- **P2-7** the old revert left the record contradicting itself: the path is gone, gated.
- **P3-8** today's data: the normaliser changes one status (801, resolved May 3 for No Spicy, now Confirmed); No Molluscs
  (not in `COMPLIANCE_TIERS`) is filed as an allergy. Gated.
- **P3-10** the review leaned to split C1; kept as one PR because the dialog and batch changes are what S3 and S4 need, and
  each is small. C3's Undo saves on this computer at once and only the send waits, after `doorTakeNewerKitchenList`; C4's
  badge always counts anaphylactic rooms with nothing documented.

Writers of tags and status, corrected (§2 named some wrongly): resident editor save `saveRegistryEdit`; Daily Entry queue
`doorRegistryQueueTransition` (intake, update, reassign); Intake Portal `commitIntakeQueue`; direct save
`saveDirectFromForm`; Needs Review `nrDoneReview`; `revertResident`; seeding `seedRegistryFromRoster` (has a separate,
older ReferenceError, raised as its own task); the compliance actions.

## 8. C1 independent review (2026-11-22): FIX FIRST, folded

- **P2-1** an older build left an Auto "Confirmed" in place when Needs Review added a restriction needing a note; the
  normaliser read it as documented. Now only a Confirmed with a named confirmer becomes answers; an Auto one reads
  Provisional. Gated (test 7).
- **P3-2** an anaphylactic room with no allergen recorded is Provisional and listed from the anaphylactic flag itself, so a
  new intake is listed too. Gated (test 8). Still open for C2: an anaphylactic resident whose only restrictions are
  auto-tier (No Fish, No Beef) reads Confirmed, as on `main`.
- **P3-3** a moderate allergy with nothing else to document: the dialog says to untick Moderate in the resident record.
- **P3-4** the normaliser names a room it cannot read on the console instead of failing silently.
- Found while folding: the first build added `docs: {}` to every record and moved five Provisional residents' "confirmed
  by" from Auto to "—", so every computer would re-send its whole list. Now a record with no answers keeps no field and a
  Provisional resident keeps its label; on today's list only 801 changes. Three browser contracts that compare today's
  list byte for byte (`anaph_recipe_binding`, `plain_plate_options`, `library_recipe_lookup_boundary`) put 801 back first,
  dated.
- **P3-1** (accepted risk, rollout window) and **P3-5** (Re-open takes back every answer; it says so) recorded, not changed.

## 9. C2 + C3 independent review (2026-11-22): FIX FIRST, folded

- **P2-1** with the restriction picker showing and nothing ticked, Save recorded every restriction: now Save is grey and
  nothing is recorded. Gated (node 8, browser).
- **P3** folded: focus into the question and back, Escape closes (P3-1); the ⋯ menu closes on Escape, outside click or a
  choice (P3-2); one row's reminder keeps the selection (P3-3); the H&W note on the row (P3-4); the name field's red border
  resets (P3-5); one wording (P3-6); `aria-expanded` on Documented (P3-7); Undo keeps an earlier ask (P3-8); Print without
  the dead filter, anaphylactic first (P3-9); the reminder re-pin is exact (P3-10).
- Found by the full browser run: "Show N more" threw (`DOOR_INLINE_HANDLER_ALLOWLIST`); fixed and gated.
- Still open for C4: an anaphylactic resident whose only restrictions are auto-tier reads Confirmed (as on `main`).

## 10. C4 independent review (2026-11-22): FIX FIRST, folded

- **P2** a room listed only for a moderate allergy went into the email ("allergen not recorded") and was marked asked: the
  email takes only rooms with a restriction needing a note, or an anaphylactic room with no allergen recorded. Gated.
- **P2** the anaphylactic nudge said "already kept off their allergens" for a room with no allergen recorded: it now names
  that room and says to ask which allergen and add it in the resident record. Gated.
- **P3** folded: due on the reminder day (as the row says); a reminder never asked reads "Ask H&W"; the heading counts
  rooms ("Next: 3 rooms with allergies"); the email dialog takes focus and gives it back; the subject leads the message
  and the copy fallback speaks to a phone. Noted, not changed: "New resident since" compares a UTC date to today (a
  14-day window; harmless).
