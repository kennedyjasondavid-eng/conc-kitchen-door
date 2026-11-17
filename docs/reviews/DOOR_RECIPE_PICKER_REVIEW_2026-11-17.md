# Recipe identity and picker review

# Editor identity/picker independent UX and safety review — 2026-11-17

Disposition: PASS for the reviewed identity/picker behavior. This is not a release/feed approval or a substitute for required full-suite/CI results.

Reviewed source SHA-256: `1d581672335d90eec30e0978e7218ec673bb8063a9d2f5935bee2fd870a1c66f`.

Gate-author fixture amendment: the original synthetic recipe records were `stream: vegan` while exercising the Main slot, whose existing filter accepts regular/empty streams. Corrected only those records to regular, retaining veganFriendly. No product diet/category filters were broadened. Original 22 assertions stayed unchanged. The promoted gate runs at `tests/browser/editor_identity_picker.mjs`.

Added six separately identified safety checks: query change clears obsolete keyboard selection, changed-query Enter cannot select stale option, canonical rename same-ID confirmation preserves saved false/true flags and display name, duplicate stable ID refusal, duplicate name refusal and exact typed duplicate refusal. Gate now 28 checks. SHA-256 `e54a45856bc42f73dd8753f3e976dc2be280c0e069f5ac12cf6fff266063396e`.

Independent runs:
- Preserved pre-picker `alt-reviewed.html`: 12/28 pass; red findings retained at `gates/editor-identity-picker-safety-red.log`.
- Current source: 28/28 pass; `gates/editor-identity-picker-safety-green.log`.

Source review confirms:
- Badge validates a stable ID uniquely and flags conflicting name claims; absent/duplicate identities cannot present as green. Canonical rename alone remains valid by stable ID.
- Name-only bindings are honestly marked for confirmation; rendering does not reset ingredient flags or display text.
- Selection and exact autosave reject duplicate identities/names rather than adopting the first candidate. Same recipe means same stable ID where available, preserving explicit false values and shown-as text.
- Search has an accessible name/combobox relation; results use options, selected state and active descendant. Arrow navigation selects only on explicit Enter; text change resets active state and Escape clears/collapses it. Opening the list alone does not adopt a fuzzy match.
- Existing no-active-option manual Enter semantics remain. Mouse handlers still dispatch slotSelect, sharing duplicate guards; no dietary filter or ingredient/routing calculation changed.
- Shown-as helper no longer claims an unresolved source is currently safe; captured facts are described honestly.

No remaining UX/safety blocker found in this slice. Required existing Node/browser checks and normal release review remain the builder/root's responsibility. The old picker source-string assertion is not an independent behavioral concern if the unchanged manual commit remains exercised and the structural test is updated under a documented author review; do not bypass its runtime purpose.

## Explicit-enable integration delta recheck

2026-11-17: PASS the three-line `setAltMealsNone(false)` addition. Reviewed alt release SHA-256 `9c412073ebeb30de7b960402e766337d98928d3215323a5d7e288c0f83e1765f` and current combined source `70e52410c0a4da39909f940f18bc5f9916eec6751157f3451fd61e7215ab9c2b`. Independently ran `alt-enable-review.mjs`: enabling an empty alternatives array creates a blank plain draft, does not resurrect old text, preserves an existing soft row with flags/additive evidence, and leaves localStorage unchanged (3/3). The explicit user action supplies the draft; reopening a saved empty list still does not create an alternative. No additional clinical or ingredient authority is inferred. Prior picker safety review remains applicable to its unchanged code.


# Identity picker — independent release/feed review

2026-11-17. Frozen source: picker-built.html versus alt-release.html. No product/source data modified by reviewer.

## Initial disposition: one feedback correction required

Regular editor identity validation and keyboard selection pass independent execution of the frozen gate: **28/28** (`picker-release-gate.log`). Source review found the shared Special Meal card inherits “Linked by name — confirm recipe”, but SM selection/auto-save does not store recipeId, so repeating the action cannot clear that instruction. Root accepted a scope fix: truthful “Linked by name” for Special Meal, without changing SM persisted schema or migration. Final recheck pending updated snapshot.

## Cleared behavior

- Restored state is not rewritten by badge rendering. Saved flags, explicit false values and display wording remain. Missing stored ID cannot borrow a same-name record; duplicate IDs and conflicting current name/ID evidence show review status.
- A unique stable ID survives canonical rename. Same-ID explicit selection/auto-save preserves flags and display name. A genuine different recipe continues existing fact/selection semantics.
- New regular attachments reject duplicate exact names or duplicate stable IDs rather than taking the first match. Existing name-only records remain honestly named-based pending confirmation; no background backfill is performed.
- Keyboard options are exposed as a listbox with stable per-query option IDs. Arrow navigation explicitly selects; Enter commits only an explicitly active option. Query changes and Escape clear obsolete active state. Enter without an active option retains existing manual behavior. Merely opening the list does not attach a fuzzy result.
- Search, display-name and clear controls gain accessible names. HTML/attribute escaping is reused. No new recipe URLs, cross-origin write path or public evidence field is introduced.
- Changes are editor display/selection only until an explicit existing save path is invoked. No current menu/resident snapshot, production fact, publishing contract, source override precedence or artifact schema is changed by this source slice. The app stamp advances to identify the release to stale tabs.
- Shared SM badge truth must be corrected as above; keyboard/attachment changes themselves are scoped to regular slot functions and do not silently migrate SM records.

Relevant full CI remains required for source/test changes. Main save/publish and receiving-device adoption still need their existing verification; this picker slice does not resolve the broader source-fact drift or claim all links are reviewed.

## Final scope correction recheck

**PASS** at frozen picker-built.html SHA-256 `05216c7f57c4fdd03670a09690babc23608c209f924c3cf88ad6e11ab0774046`.

The only follow-up correction scopes the unique name-only label: SM cards say “Linked by name”; regular cards retain confirmation guidance. Independently exercised both shared render paths in an isolated offline browser (`sm-badge-probe.mjs`): SM has no impossible confirmation instruction; normal editor retains it. No SM persisted identity, schema or fact behavior was added.

The copied bounded historical W3e journey against the frozen picker source completes **44/44 passed**, exit 0 (`w3e-picker-bounded.log`). The repair changes only test synchronization to wait for the old dialog node, retaining all product expectations. Builder confirms final frozen picker gate **28/28** after the label-only adjustment; reviewer independently executed 28/28 before that one-line scope correction and directly verified both label paths afterward.

No blocking release/feed finding remains for this picker slice. This approval covers the frozen source only, not an operational data push. Required hosted checks, final head inspection and deployed-byte observation remain.
