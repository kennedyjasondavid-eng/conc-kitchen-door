# F1 independent food/data review

Verdict: **clear for this implementation slice**, with no remaining material food/data finding identified. Production activation still requires the separately documented legacy-writer credential/device cutover and release verification. This review does not claim those operational steps have happened.

Reviewed product `index.html` SHA-256 `c66709f9a4e83a60724f5ed899925663b7b89d811d333e3af7f495301e397cdc` and `KitchenDOOR_Push.hta` SHA-256 `46dc9efabedc4b5bb3e7ba8c7c75663fc0687f3a51ac5e625956cb17ab9702be`, against committed source plus the F1 implementation record. Inspected the complete product diff and the existing smoke/outbox/revert harness migrations. No product or gate expectation was edited during this review.

## Correctness and safety reviewed

- The complete immutable Git tree establishes file absence; reads of registry, menu base, overlays, swaps, special meals, histories and guards use the same head. Failed/malformed listed reads hold work instead of substituting empty removals or a roster. Ref conflict causes bounded fresh selection, merging and building.
- Newer authoritative resident data and anaphylactic membership are substituted together during synchronous construction of menu/routing/state/summary. The original in-memory registry/map/membership are restored afterward. Acknowledgement preserves newer local resident/anaphylactic edits and only adopts the committed selected input when captured memory and durable values remain unchanged.
- The accepted uploaded menu participates in base selection and acknowledgement; its remote timestamp is compared with the local upload timestamp under the existing ownership rule. An upload made during transport remains pending. The new independent base gates cover stale base, new unsent upload and conflict rebuild.
- Structural Stop defects now block automatic and manual sends. The migrated smoke tests strengthen that behavior rather than removing coverage. Their transport tests correctly delegate conflict recovery to the transaction and assert no partial dependent commit. The applying-remote gates retain actual read/merge/retry/write verification beyond the smoke shim.
- Removal histories remain monotonic, including legacy local key arrays. Special meals now permit legitimate last-entry removal, while the pinned read and merged tombstone protect against stale empty writes. Actual swap/removal entry-point gates run through the complete transaction. Component-versus-section semantics and the plating/allergen engine are unchanged by F1.
- Durable pending/prepared receipts precede the remote ref update. Recovery verifies reachability and compares rebuilt current intent; a landed equivalent write is acknowledged without replay. Outbox acknowledgement uses operation identity rather than a shifting array prefix; receipt recovery also works when the pointer outbox is empty. Local quota failure retains a recoverable operation.
- The v2 connection record isolates replacement credentials from legacy namespaces, and the HTA no longer writes local Git snapshots. Source changes cannot revoke old tabs' in-memory credentials; the operator cutover remains an explicit activation condition.

## Independent verification

Ran the seven-file focused current-product matrix in one Node process (`--experimental-test-isolation=none`) with **192 tests passed, zero failures, zero skips**:

`publish_transaction_f1a_gate`, `publish_transaction_f1b_gate`, `publish_uploaded_base_gate`, `publish_credential_boundary_gate`, `door-smoke`, `publish_outbox_gate`, `swap_revert_reaches_gate`.

The four original F1b defects are covered and now green: commit-landed/lost-ack restart; final acknowledgement quota restart; outbox cap movement with newer edits; actual last-special-meal removal through the real write guard. Source reviewed the remaining frozen F1a/B evidence and preserved their gate/helper hashes. The new intentionally red F4 contract gate is a separate unimplemented slice and is excluded from this F1 matrix.

Log: `%TEMP%/door-f1-food-review.log`. Tests use synthetic records and an applying remote simulator; this review read no secret values and contacted no live service.

## Limits and follow-on obligations

The focused publisher harnesses use controlled artifact builders in several cases; the implementation author's intercepted full-browser producer probe was receipt-reviewed, not independently repeated here. Parent/release review owns the combined suite, hosted checks, real staff/device trial and exact release/delivery evidence. The sixteen-first-parent recovery limit is documented and can conservatively cause another content commit after a long interruption; general no-op suppression remains F6. F4's new publication sequence must preserve F1's prepared-write recovery, and its new routing validity/recipe scaling claims are not covered by this F1 acceptance.

## Existing-harness delta closure

Reviewed the subsequent changes to `publish_menu_ask_gate.mjs` and `registry_publish_gating_gate.mjs` independently: the question inventory now recognizes the new selected-roster question and the removal of the unsafe structural override. The registry wiring assertion requires credentials → immutable head read → capture → selected frozen roster → all builders, with cancellation before publication and no second unpinned pull. It retains explicit manual adoption/older-roster choice visibility. No safety assertion was weakened. Independent focused rerun: **14/14 passed, zero skips** (`%TEMP%/door-f1-food-delta-review.log`). Product bytes are unchanged by this test delta.
