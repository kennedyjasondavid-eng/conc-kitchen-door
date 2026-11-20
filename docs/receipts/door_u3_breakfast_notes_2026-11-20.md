# Receipt: the two confirmed breakfast notes (U3 S1 data, publication 41, 2026-11-20)

Jason, 2026-11-19: "Follow leans on all four" (back-on-track plan §5 U3, call C1). The repository is public, so a note
saved in DOOR is readable in `door_state.json` on GitHub (Pages never serves it); Jason, 2026-11-20: "We'll move forward
with the notes in and I'll consider taking it private later" (keeping it public saves the Actions minutes a private
repository would cost).

Made through DOOR's own resident editor (`openRegistryEditor`, the `#ce-breakfast-note` box, `saveChangeEdit`, which took
the notes-only path), then one publish through DOOR's publisher against EXPO's in-memory fake GitHub (W6 harness), with
today's CODEX feed (`main`) and `library_public.json` from Pages. Every question Save could ask: none asked.

## What changed
| Room | Breakfast note |
|---|---|
| 301a | oat milk only |
| 1007 | smaller breakfast starch portion plus extra protein (no quantities, as confirmed) |

- **Residents:** only these two records change: the note, and one history entry each (the history keeps the newest two).
  Sections, tags and restriction words are unchanged on all 168 (301a Vegan / Vegetarian, 1007 Diabetic).
- **`registry_summary.json`, `routing_by_meal.json`, `menu_current.json`, `menu_overlay.json`:** stamps only
  (`exported`, `builtFromMenu`, flow sequence 40 → 41). No count, menu or routing content moves.
- **Other files:** `door_state.json` (the notes), `door_flow_publication.json` (sequence 41), and `recent_log.json`:
  two "Notes edited" lines added, and four Nov 19 18:46Z menu-edit lines (publication 39: Wk1 FRI dinner, Wk4 SUN,
  MON and SAT lunch) dropped. The existing log merge removes duplicates by room, date and description, so the 20:22Z
  edits of the same four meals that day replaced them. That happens on any sync on `main` today; the log is
  informational (noted as a follow-up: key the merge on the time too).

## What the breakfast sheets print
Read with DOOR's plating engine on this data, all 28 breakfasts:
- 1007's note prints on every breakfast in the Regular notes row, with no check (it is not a milk note). No breakfast
  has a diabetic alternative, so diabetics eat the regular breakfast; 1007's stored section stays Diabetic (lunch and
  dinner).
- 301a's note prints on every breakfast. On the four Tuesdays it reads **"CHECK: the plate names milk, not oat milk"** in
  amber: 301a eats from the vegan section, and the vegan line reads "Cereal and milk, fruit" (no plant milk named).
  The check is right; whether the vegan line should name a plant milk is raised with Jason, not changed here.
- No lunch or dinner sheet prints a breakfast note.

## Checks
- New gate `tests/u3_breakfast_notes_data_gate.mjs` (4), red on `main` `433e91a` (BN-1; BN-2 to BN-4 lock that a note
  moved nobody, that no other resident has one, and that no file Pages serves carries one).
- Node suite 1119 pass, 0 fail, 1 skipped; `scripts/check_published_flow.mjs` passes.
- Independent review: FIX FIRST on this receipt's wording only (data right). Folded: 1007's note is in the Regular
  notes row (P2-1); the recent-log lines dropped by the merge (P2-2); BN-2 also checks the restriction words (P3-1).
