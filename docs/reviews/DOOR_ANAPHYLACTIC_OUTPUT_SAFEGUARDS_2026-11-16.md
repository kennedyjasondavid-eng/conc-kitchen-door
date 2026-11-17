# Anaphylactic output safeguards — A1 candidate

Scope: the [reviewed reconciliation plan](../DOOR_PLATING_RECONCILIATION_ACTION_PLAN_2026-11-16.md), A1. Code baseline `eb13cd078e5fa8b949ab887f39125348308f213d`; implementation branch `codex/anaphylactic-output-safeguards`. This is a candidate, not a deployed release or meal-compatibility approval.

## Behavior

One assessment distinguishes no alternative required, a missing name and a named dish. A named dish is not described as verified. The standard meal cannot fill a missing separate meal. A missing alternative makes the preview visibly DRAFT / NOT FOR SERVICE, blocks the complete requested final workbook/ZIP and refuses ordinary service print. A browser print reassesses current inputs; if assessment/rendering fails, it replaces stale content with a printable failure warning.

Generate projects the same registry transition used at commit, on cloned records, after the existing kitchen-list and anaphylactic questions. Cancelling preserves the queue, registry, log and snapshot. Proceeding saves resident changes and uses the normal coherent publisher/outbox, while reporting plating NOT READY separately. No global HOUSE publication block or new public schema was added. Workbook/ZIP builders no longer catch and omit failed days/files.

## A0 boundary

This slice implements naming integrity only. It adds no runtime approval database or inferred clinical/ingredient approval. Existing named alternatives retain their named behavior. Before a future verified-readiness state, A0 still requires a reviewed authoritative storage owner, exact meal/components/requirements and recipe/product binding, preparation evidence, actor/date/decision ID, invalidation and paired consumer review for any contract change. The plan's answers are not silently used as runtime approval records.

## Independent review and verification

- Node suite: 943 passed, one skipped. New A1 gate: nine tests, including projection/commit parity, queue-preserving cancellation and resident saving/publication while documents are unresolved. The pre-change source fails the new gate because safeguards are absent.
- Actual-browser A1: 20 assertions passed with the pinned app XLSX library, light and dark, including real serialized XLSX read-back of all seven days and the exact separate plate. CI also runs the browser gate without external library downloads; serialization was separately exercised locally.
- Existing coherent publisher/recovery browser gates passed. Theme/accessibility gate: 263/263 passed.
- Release reviewer `/root/plating_plan_release_review`: PASS after fixing Ctrl+P when reassessment throws. The actual browser regression renders a named plate, forces failure, dispatches `beforeprint`, checks that stale dish content disappears, and checks print CSS visibility.
- Food/data reviewer `/root/plating_plan_food_review`: PASS after qualifying the manual fallback instruction. The current manual sheets govern served meals, but their six omitted separate-plate definitions still need a supervisor-confirmed meal.
- Native Excel/staff-viewer acceptance remains pending. Excel was not available in the application inventory or usual installation paths. LibreOffice Calc launched but did not retain a usable target through the attempted open action; no native-workbook acceptance is claimed. Saved XLSX serialization/read-back and browser print checks are separate evidence.

Release requires the plan's remaining applicable acceptance gates. No resident/menu snapshots or learned answers were changed by A1.

## Meal decisions received during implementation

Jason confirmed on November 16:

1. Current manual plating sheets are authority for what is served.
2. For a missing non-vegetarian allergy alternative, default to Chicken Leg; when the main meal is fish, use basa. Include plain rice and stir-fry vegetables.
3. Any existing plain or other alternative may be used if it meets the resident's restrictions; the default is not a compulsory single dish.
4. Create the plain-alternative recipes using culinary judgment; permission granted to add them to CODEX.

Thus the six initial defaults are A01/A02/A03/A05 chicken leg and A04/A06 basa, each with plain rice and stir-fry vegetables. They are recipe-authoring decisions, not an instruction to erase existing named manual plates, treat unknown ingredients as absent, or clear flags. All recorded requirements remain; room 213's soft/corn/popcorn instructions are not promoted to new anaphylactic triggers. CODEX owns new recipe facts; its shared-Library writer/public projection is the appropriate additive path. Compatibility, supplier/product checks, separate preparation and the four legacy named alternatives still require evidence before A2 closes.

## Paired recipe-reader correction

The plain-recipe review found that DOOR supported No Brassicas routing but did not map the producer label `Brassicas (Broccoli)` at recipe binding. The candidate now maps it to the existing `hasBrassicas` flag. Its regression failed before the correction and passes afterward (all eight normalization checks pass). No schema shape changed; unknown labels remain loud on older readers. The [CODEX publication receipt](../receipts/codex_plain_alternatives_publication_2026-11-16.json) records the separately authorized additive recipe save and anonymous delivery. Recipe compatibility remains separate from A1 naming integrity.
