# Verified clinical-source composition v1

`doorCanonicalClinicalSourceV1FromPublic(bytes, selection)` is an inactive, asynchronous supplied-byte adapter. It verifies a CODEX public snapshot and binds requested assessments to the same verified Library bytes. It has no runtime callers, network, storage, resident data, delivery switch or output authority.

`bytes` has exactly `provenanceBytes`, `primaryFeedBytes` and `libraryBytes`, each a genuine Uint8Array. Caps are 16 KiB, 8 MiB and 8 MiB respectively. All three arrays and the selection are detached before the first await. The existing catalogue provider owns integrity, JSON/privacy validation and canonical association. Parsed caches and injected verified flags are refused.

`selection` has exactly:

```js
{
  schema: 1,
  recipeId: '<exact opaque ID, at most 200 characters>',
  contentFingerprint: '<lowercase raw 64 hex>',
  catalogueRevision: {
    kind: 'codex-public-snapshot',
    value: 'sha256:<lowercase 64 hex>'
  },
  requirements: [{id: '<requirement ID>', revision: '<exact revision>'}]
}
```

Requirements form a dense array of at most 256 unique IDs; each ID and revision is a trimmed nonempty string of at most 2,000 characters. Unknown or extra fields fail. Accessors are rejected; reflection failures yield fixed reasons. Transparent proxies around ordinary objects are not universally detectable and gain no authority.

Success is exactly `{ok:true,candidate}`. The candidate has `schema:1`, `scope:'private-candidate'`, actual `catalogueRevision`, `recipeRef`, `holdReason`, `warnings`, `portionBasis` and `assessments`. Its reference contains only the exact canonical ID, current name, content fingerprint and explicit source-owned basis fingerprint (or null). Each assessment contains the requested ID/revision, `covered|conflict|unknown` and detached source references.

The selected composite revision, unique canonical ID and full content fingerprint must match. Facts are read only from the corresponding active record in the same captured, verified Library bytes. The explicit top-level basis is never invented or copied from the facts subject. The existing `doorCanonicalFoodFactAssessment` remains the assessment owner. Base-only, ambiguous, tombstoned, conflicting and fingerprint-mismatched records cannot borrow coverage.

Association failure yields a held candidate: null reference and portion basis, unknown assessments and empty assessment sources. `holdReason` is `catalogue-mismatch`, `canonical-unavailable` or `fingerprint-mismatch`. A null hold reason means association succeeded; it does not establish suitability or complete requirements. Missing or invalid facts remain unknown under the existing assessment core.

Positive warnings come from the existing catalogue rows for the requested ID, including when association is held. Existing none sentinels are omitted. Empty warnings do not certify exclusions. A written portion basis is copied only from the bound canonical row; null remains null. No quantities, completeness, readiness, anaphylactic acknowledgement, adoption, serving receipt or export eligibility are produced.

Failure is exactly `{ok:false,reason}` using `invalid-input`, `bounds-exceeded` or an existing catalogue-provider reason. Raw source records and exception messages never escape. Successful supplied-byte verification does not establish live source freshness; a future controller must own that prerequisite.

The synthetic positive fixture uses an explicitly isolated CODEX capability. Actual default whole-block withholding remains represented by a separate fixture and yields no canonical coverage. This change does not enable public facts delivery.
