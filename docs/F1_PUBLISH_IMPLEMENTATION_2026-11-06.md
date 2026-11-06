# F1 coherent publisher implementation

Implementation awaiting independent food/data and release review. No live credentials were changed and no production menu or resident data was written during this work.

## Write boundary

`menu_current`, `menu_overlay`, swaps, special meals, both removal lists, routing, registry summary, resident state, learned rules and custom tag rules now use the complete publisher. The existing save methods persist locally first; dependent side writes request the complete transaction. Removal timers take this route too. The low-level single-file writer refuses a dependency, and both atomic entry points refuse a dependent candidate without its verified input revision.

The HTA no longer stages, commits or pushes local snapshots. It remains a file opener and explains that publishing happens in the updated DOOR. Independent change-log and Rex review-answer writes keep their existing boundary: neither is an input to menu selection, removal applicability, resident routing or menu validation. Recent log and available Rex answers can still accompany the complete publish.

## Read, build and commit

The publisher reads the authenticated main ref, commit and complete recursive tree. All authoritative input reads and anti-clobber guard reads pin that immutable commit. Only absence from that complete tree establishes an initially missing file. Listed-but-unreadable files, malformed JSON and authentication failures hold the operation. Each authoritative read has an eight-second browser timeout and one retry for transient transport/server failures.

Overlay ownership and swap/special merge rules remain the existing rules. Both removal histories preserve expired entries and merge monotonically. Merged swaps, specials and removals are installed as synchronous builder inputs before any dependent artifact is derived. A newer remote resident list is frozen for the build; the existing explicit manual older-roster choice remains separate from structural validation.

The candidate is deep-copied before transport. Structural Stop results retain local work for both automatic and manual sends; the old manual structural override has been removed. Any blocked dependent artifact holds the complete set. A fast-forward ref conflict starts a fresh authoritative read, merge and complete rebuild, bounded to three attempts. It never merely reparents a stale candidate.

## Crash and local-edit recovery

`concPublishTransaction` is a private local receipt, not a published data contract. The publisher saves a pending marker before work, then a prepared receipt containing the candidate commit SHA before updating the remote ref. Failure to persist that prepared receipt prevents the ref update.

After an uncertain result, recovery proves the prepared commit is reachable from the current head (up to sixteen first-parent ancestors), rebuilds current intent, and compares it with the pinned current files. Equivalent landed content is acknowledged without replay; newer local intent still gets its own commit. Volatile export timestamps are excluded from this recovery comparison. General unchanged-save suppression remains F6.

Acknowledge writes only local values that still match the captured inputs. Newer local edits remain pending. Removal acknowledgement also merges the latest durable history, and outbox acknowledgement matches operation IDs rather than assuming a stable array prefix when its cap trims older entries. Pending or prepared receipts trigger boot/online/connect drain even if the pointer outbox is empty. No second payload queue was introduced.

## Credential cutover and rollback

Validated connections are stored atomically as one `conc-door-connection-v2` record containing token, repository and metadata. Neither the replacement token nor its metadata is mirrored into legacy settings or shared-token storage. The new writer does not adopt legacy credentials. Saving fails visibly if the new record cannot persist; disconnect removes only the connection and preserves local work.

This code does **not** establish the production legacy-writer cutoff by itself. The release owner must inventory app, device, HTA/Git and automation credentials; coordinate any shared HOUSE connections; preserve pending edits; deploy the corrected code; revoke legacy write credentials; reload and reconnect known writing devices through Connect; and test already-open tabs and returning offline devices. No secrets belong in the evidence. Old tabs can retain a legacy token in memory until its server-side revocation.

Full F1 activation must not be declared before that controlled cutover is proven. A UI rollback must retain the corrected writer and v2 credential boundary, or be read-only while a forward writer fix is prepared. Never restore a prior menu snapshot, roster, tombstone history or legacy credential to roll back this change.

## Verification and limits

Independent frozen F1a gates: 21/21. Independent F1b recovery and actual-entry-point gates: 14/14. Independent uploaded-base ownership gates: 4/4. Independent credential boundary gates: 6/6. Migrated smoke including truthful preflight status: 129/129. Outbox including empty-pointer receipt recovery: 8/8. Revert propagation and legacy removal arrays: 10/10. Kitchen reader: 15/15. Connect behavior: 11/11. These were run directly with Node; the sandbox prohibits child-process spawning by the multi-file Node test runner.

A headless browser also loaded the complete application with synthetic residents, menu and keys, intercepted every network request, and exercised the real build/routing/publish path against an applying GitHub simulator. A remote swap revert was included before the first routing build: one visible complete commit, zero page errors, no reverted swap, expected baseline component counts. The browser probe is local evidence rather than a new portable CI gate; no live service was contacted.

The applying transport gates cover failed reads, true absence, conflicts, crashes before/after ref update, persistent quota failures, outbox cap movement and newer local edits. They do not replace the release cutover rehearsal, real staff trial, hosted deployment verification or downstream served/consumed delivery receipts. The bounded sixteen-ancestor recovery proof may conservatively publish again after a long delay with many intervening commits; F6 owns broader unchanged-content deduplication.

The uploaded menu and its timestamp now participate in frozen selection and acknowledgement. Following the existing ownership rule, a published menu newer than the local import is selected; a newer unsent local upload is preserved. Ref conflict rebuild reselects the base, and an upload during the ref request remains local and pending. The independent four-case extension passed. A legacy key-array removal regression found by the existing propagation gate was corrected by normalizing those arrays before merging durable history; no expectations were loosened.
