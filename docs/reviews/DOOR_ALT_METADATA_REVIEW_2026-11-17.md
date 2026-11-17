# Unchanged alternative preservation

# Unchanged alternative restoration — independent safety review

2026-11-17 — PASS.

Reviewed the `index.html` `openMenuEdit` diff and CI invocation against frozen gates. Product change is limited to selecting structured alternative records before legacy free text, and deep-cloning those records into editor state.

## Findings

No blocking safety/data findings.

- Existing legacy-edit structured arrays retain precedence over dayData arrays; an explicit empty array remains authoritative.
- dayData structured alternatives now retain type, flags and additive preparation/evidence metadata, rather than reconstructing a plain plate from the legacy soft string.
- JSON deep clone severs references to nested flags/evidence, so draft editing cannot mutate saved source objects before Save.
- Legacy soft text still populates when no structured array exists. This preserves the established legacy fallback rather than deriving a new food-safety classification.
- No allergen source precedence, anaphylactic acknowledgement, recipe identity or routing policy is changed. No data migration or schema change is introduced.
- CI runs the new browser gate through the established browser scope. The gate assertions were not weakened after builder implementation.

## Evidence

- Frozen metadata gate `tests/browser/unchanged_alt_metadata.mjs`: SHA-256 c69be6d00bc2ee34f2a64f83737e864289587b3ac442407d2862ea4036489a62. Before 4/9; builder green log 9/9.
- Frozen D1 gate `tests/browser/d1_vegan_side.mjs`: SHA-256 494cb005b21a4c3b8702fcf28f12d85741f6c91098b0fdac79a47ced5b70f925. Builder rerun 14/14.
- Five additional independent checks executed the actual restoration source block: nested source non-mutation; existing empty-array precedence; existing nonempty-array precedence; legacy absent-array fallback; dayData empty-array authority. All passed.

This approval concerns restoration of untouched alternatives. It does not certify clinical texture suitability or resolve the broader source/saved allergen policy. Routine valid persisted objects remain the input contract; no new malformed-record interpretation is implied.


# Alternative metadata round-trip — independent release/feed review

2026-11-17. **PASS** for the focused `openMenuEdit` source change and frozen regression. No operational mutation or publication performed by this review.

## Reviewed behavior and compatibility

The source diff is confined to the alternative initialization block in `openMenuEdit`. It now restores structured `existing.altMeals` when it is an array, including an authoritative empty array; otherwise it reads the effective rotation day's structured alternative array. Only when neither structured array exists does it retain the prior legacy soft-text fallback. This restores the editor's inputs rather than changing the shape or authority of published meal data.

JSON deep cloning followed by object spread preserves valid saved alternative text, preparation type, ingredient flags and additive evidence/notes while preventing draft edits from aliasing the saved source. Existing defaults for absent text/type/flags remain. The structured empty array is not replaced by stale legacy soft text. Legacy text-only meals remain supported and still receive the existing plain/empty-flags representation; this slice does not silently reinterpret those older records as verified soft-texture or ingredient evidence.

The existing `buildAltMeals` and normal menu/export writers serialize the retained alternative objects. No consumer schema changes: the same `_altMeals` array, type, flags and additive fields already travel through the contract. No new source-fact precedence, anaphylactic handling, publication receipt or routing policy is introduced. Saved clinical/preparation semantics remain separate from a plain/soft label.

## Independent execution

Ran `node tests/browser/unchanged_alt_metadata.mjs` in isolated Chromium with HTTP requests blocked. **9/9 passed**:

- ordinary side edit completes;
- unchanged soft type remains;
- captured Fish/Mustard flags remain;
- additive preparation note/evidence remain;
- normal exporter retains the complete alternative;
- legacy soft text remains unchanged;
- explicit empty structured array does not resurrect stale text;
- text-only legacy fallback remains supported;
- no browser errors.

Code inspection also confirms the `existing.altMeals` array takes precedence over day data, including empty arrays, as required for the retained legacy edit branch. The browser gate primarily exercises day-data restoration; no claim of exhaustive malformed historical-input coverage is made. Valid saved alternatives are the contract for this slice; malformed/null rows remain a separate import/validation concern.

## Release boundary

Source/test changes require the relevant full source CI path; do not classify this as data-only to skip browser verification. The operational D1 candidate is separate and must remain bounded to the reviewed receipt.changed inputs with its compare-before-write protections. This approval does not authorize or bypass the pending operational public push approval boundary reported by root. Live deployed bytes and final hosted checks still need observation after an authorized merge.

No blocking release/feed finding remains for this source slice.
