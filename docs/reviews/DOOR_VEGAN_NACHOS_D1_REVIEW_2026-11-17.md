# Approved vegan-side correction

Jason authorized publishing this reviewed operational bundle to the public DOOR repository on 2026-11-17. It preserves all resident records from the current publication; only their publication metadata changes.

# Refreshed D1 publication — independent safety/data review

2026-11-17. Disposition: **PASS** for the reviewed candidate, conditional on root's immediate remote-head/input-hash comparison before application/commit. No apply or push performed by this reviewer.

Inputs: `d1-current-baseline` captured from current remote main `db4b34d8` (168 residents; occurrence 23). Candidate: `d1-current-candidate` (occurrence 24). This supersedes the earlier 171-resident candidate review for operational publication; do not apply the old candidate.

Independent recursive comparison of all six changed artifacts (`d1-current-safety-diff.json`) found only:
- W3 Wednesday lunch vegan display loses Sour Cream, and xtra.lines.vegan explicitly becomes mode none in menu plus overlay.
- Associated overlay day edit stamp and coherent publication/export/menu-hash metadata.
- Sour Cream total portions decrease 160→146 in both legacy and flow component exports, exactly removing the 14 vegan portions. All other routing counts/components and service slots are unchanged.

Regular meal retains Sour Cream and its hasDairy true fact. The original meal, preparation alternatives, saved ingredient/routing flags, names/links and unrelated occurrences are unchanged. Conservative Dairy remains in vegan ingredient output pending the separate attribution review; this correction does not certify a dairy-free plate.

All non-metadata door_state fields match the new baseline exactly, including all 168 residents, anaphylactic authority and daily import provenance. Registry modification timestamp remains unchanged. Source recipe records, recipe component hash, calendar and dated inputs are unchanged. All five carrier flow receipts and private counter agree on occurrence 24/input revision. No fresh catalogue facts were folded into this publication.

Ran explicit D1 data acceptance against the refreshed candidate with `DOOR_GATE_D1_DATA=1` and `DOOR_GATE_MENU=d1-current-candidate/menu_current.json`: **14/14 pass**, log `d1-current-safety-gate.log`. Includes synthetic control/save/reopen/plating/portion behavior, regular Dairy retained, conservative unknown fallback and no browser errors. Reviewed candidate file SHA-256 values are pinned in `d1-current-reviewed-hashes.json`.

No remaining safety/data blocker in this candidate. Root must re-read the actual remote/input hashes immediately before mutation; any later resident/menu publication requires regeneration/review rather than replaying this candidate. Downstream receipt/adoption remains a separate live observation.


# D1 refreshed current-publication release/feed review

2026-11-17. **PASS** for `d1-current-candidate` against `d1-current-baseline`, independently matched to origin/main `db4b34d85669caf9bbc620c8e00d05d42d4d99c3`.

This review supersedes the old 171-resident/sequence-22 candidate. It does not apply or push any file. Root reports explicit operational publication authorization received; reviewer independently checks technical scope only.

## Current baseline verified

Compared every `receipt.sourceHashes` input against exact `git show origin/main:<file>` bytes: **zero mismatches**. Independently compared each of the six baseline carriers against origin/main: **zero mismatches**. The local working directory contains earlier staged operational data and is not the authoritative input for this review. Candidate generation correctly reads current origin/main and uses the existing scoped overlay/stamp writer plus actual isolated publisher, with captured current CODEX sources.

Current baseline is **168 residents, occurrence 23**. Candidate remains **168 residents, occurrence 24**, same epoch. Every resident object and anaphylactic room is deep-equal; registry modification stamp and import provenance remain equal. No resident is restored from the old 171-record candidate.

## Exact meaningful diff

- `menu_current.json`: only W3 Wednesday lunch vegan text and xtra.lines.vegan inclusion change meal content. The vegan plate omits Sour Cream. Regular Sour Cream and its Dairy flag remain. No other dish/meal/alternative metadata changes.
- `menu_overlay.json`: the same two meal fields plus the affected day's edit timestamp and receipt metadata. All unrelated overlay fields remain.
- `routing_by_meal.json`: Sour Cream portions change **160 → 146**, in both legacy effective routing and the matching rotation projection. Fourteen vegan recipients no longer receive this topping. No section counts, other components, other services, dated input or recipe records change.
- `registry_summary.json`: metadata only; all nonmetadata counts/facts remain identical.
- `door_state.json`: metadata only; resident/anaphylactic/import state is unchanged. `lastModifiedBy` changes from the prior publisher to `Codex (Jason-directed)` as an ordinary publisher stamp; do not describe that actor metadata as preserved.
- `door_flow_publication.json`: menu component hash, input revision and occurrence advance coherently.

The CODEX recipe component hash and full flow.recipes table are unchanged from current baseline. The earlier candidate's nine-record catalogue addition is **not** present in this refreshed delta; do not reuse that older release description. Conservative Dairy remains on the vegan declaration pending source-attribution review; this scoped side omission does not claim the broader fact-policy issue is resolved.

## Coherence and contract checks

Executed shipped `validatePublishedFlow` using all exact origin/main JSON inputs, overlaid only with the six candidate carriers and the deployed picker source snapshot: **`{ok:true, mode:'active'}`**. All carrier receipts and private counter agree on occurrence 24 and the new input revision. Menu/routing provenance is tied to the coherent new export. Schema versions remain unchanged, and existing per-line exclusion shape is reused. No consumer code change or portion-scaling activation is introduced.

`recent_log.json` is not in candidate.changed and must remain untouched. No source/test/docs or unrelated operational file belongs in this data application. Existing Pages allowlist is unchanged: public projections remain menu/routing/aggregate summary; private resident/state/editor/counter files are not added to Pages. Existing repository access is a separate boundary; this patch preserves the current records and does not add new resident information.

## Apply/release conditions

Use only this refreshed candidate's six receipt.changed carriers. Immediately recheck remote HEAD and all current source hash preconditions before applying; if any relevant input has advanced, regenerate/review instead of overwriting the newer publication. Keep protected current backups. Do not copy old staged 171-resident files, glob a candidate directory, decrement occurrence numbers or roll back current resident changes.

The scoped transform's already-excluded check and current-input assertions prevent blindly applying a second semantic correction. A rerun after landing must detect the corrected state and avoid creating another occurrence for the same correction. Rollback, if necessary, is a new scoped coherent publication over the then-current inputs.

After an authorized merge/push, verify hosted checks, served menu/routing/summary receipt coherence and downstream acceptance separately. This review does not certify live serving-device adoption before those observations.
