# Anaphylactic binding gate — concurrent timestamp fixture diagnosis

2026-11-17. Gate-author amendment only; no product or operational file modified.

CI211's current 168-resident baseline (`origin/main` db4b34d85669caf9bbc620c8e00d05d42d4d99c3) has resident authority `registryModifiedAt=2026-11-17T15:44:30.095Z`. The test's historical CLOCK is `2026-11-17T00:30:00.000Z`; its injected supposed newer resident edit was CLOCK+60 seconds, `00:31Z`, more than fifteen hours **older** than the baseline. Actual publisher `doorPublishSelectRegistry` compares registryModifiedAt (exported fallback), correctly refusing remoteTs <= local provenance. This is invalid test setup, not evidence that the publisher loses a genuinely newer instruction.

Reproduced the exact failing assertion at former line157 using `ANAPH_BINDING_BASE_REF=db4b34d85669caf9bbc620c8e00d05d42d4d99c3` with isolated actual publisher and blocked transport. `anaph-clock-red.log` records the failure. The older 171-resident local root has a Nov16 registry stamp and would not expose this failure, so the remote-ref reproduction was essential.

Narrow amendment in `tests/browser/anaph_recipe_binding.mjs`: set only the injected external registry edit to `max(CLOCK, baseline registry authority)+60000`; retain the original global CLOCK and all original behavioral assertions. Added preconditions that baseline authority parses and injected authority is strictly newer. No expectation, publisher branch, recipient, count or output assertion is weakened. Existing timestamp fallback semantics are retained.

Re-ran the same exact remote baseline with the amendment: **22 recipe-binding browser checks passed**, including concurrent newer instruction preservation, all six recipe names, unchanged routing and resident authority, and no uncaught/unsupported writes. Evidence: `anaph-clock-green.log`. The injected authority is now `2026-11-17T15:45:30.095Z`, a genuine concurrent later edit. This remains synthetic isolated data and is never published.

Disposition: valid portable fixture-relative clock correction. Review/commit only the test and dated evidence as appropriate; no product fix is indicated by this failure. Hosted CI still needs to run the amended head. Broader publication authorization and D1 operational data remain separate.

## Independent gate-review disposition

2026-11-17: **PASS**. Independent reviewer confirmed the original published resident authority at db4b34d85669caf9bbc620c8e00d05d42d4d99c3 is newer than the historical injected 00:31 edit, so the old fixture contradicted its stated newer-edit precondition. The publisher must not be changed to accept that older edit.

Reviewed amendment changes only the injected external test edit to a valid strictly newer authority using existing registryModifiedAt/exported fallback semantics. All 18 original check call sites (22 executed checks, including looped bindings) compare identically against HEAD, and the global historical CLOCK declaration is byte-identical. New validity/newness assertions strengthen setup rather than relaxing outcomes. No product, resident or source-fact expectation changed.

Independently ran the amended full browser gate with explicit baseline ref db4b34d85669caf9bbc620c8e00d05d42d4d99c3: **22 checks passed**, including the newer concurrent resident instruction and all six canonical bindings. Log `anaph-clock-independent-green.log`. Cleared for the scoped test amendment and hosted revalidation; no operational apply/push performed by this reviewer.
