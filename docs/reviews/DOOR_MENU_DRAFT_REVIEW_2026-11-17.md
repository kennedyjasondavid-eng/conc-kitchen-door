# Menu draft protection reviews

# Dirty-draft independent safety/UX review — 2026-11-17

Disposition: PASS for the frozen draft-protection slice. Final reviewed source: `outputs/staff-baseline-20261117/dirty-built.html`, SHA-256 `123add1252a885741aef3dc83461ae22c9cc7aa82b6bcc63f428d11057b24c6e`.

No product edits made by this reviewer. Review covers behavior against existing saved facts and normal save validation; separate release/feed review and required CI remain necessary.

## Independent validation

- Re-ran the original gate against the frozen snapshot: **45/45 pass** (`dirty-safety-gate.log`). Includes clean and dirty native exit, Close, service switch, screen navigation, duplicate pending prompts, Save→normal soft/plain warning, cancel, successful save/navigation and blocked empty-meal save at desktop and phone widths.
- Authored and ran independent supplemental probes against the same snapshot: **16/16 pass** (`dirty-independent-review.mjs`, `dirty-independent-review.log`, `dirty-independent-results.json`). Pending search text is protected before blur; slot-level flag changes and alternative type/facts/preparation changes are dirty; Stay retains those drafts. Returning to the same Menu Config screen retains alternatives without a loss prompt. goHome, edit-mode toggle and Test Meal each ask once and cancellation preserves mode/context/text. All cancelled probes leave saved meal data unchanged.
- Additional normal halal decision probe: Save-on-leave reaches the existing halal question; dismissing it retains the draft/source screen, releases the pending guard and permits a fresh leave decision. No ingredient or halal answer is inferred by draft protection.

## Source findings

The signature includes pending form values, slot flags, held query state and structured alternative rows. It is captured after normal open-time derivations. Saving or deliberate discard clears its baseline; unsuccessful validation does not. Navigation awaits an explicit successful normal save result, not an optimistic click. A pending-leave lock prevents multiple overlapping loss dialogs. Existing save questions and final checks remain authoritative, including later stale editor-context rejection, clinical/recipe checks and anaphylactic protections.

Mode actions guard before clearing their shared editor state. The same Menu Config view can redraw without throwing away the draft. The beforeunload listener protects only dirty menu edits; clean navigation stays quiet. Rendering/guarding itself does not publish a meal or reset captured warnings.

No remaining safety/UX blocker found. Persistent recovery after an actual browser crash is outside this slice; native unload protection is not durable draft storage. Staff acceptance and receiving-device adoption remain separate release observations, not certified by these automated tests.

## Superseding release finding

Final release clearance pending: independent release reviewer subsequently reproduced a stale awaited halal answer saving into a reopened session for the same service key. The above PASS covers only source `123add1252...` and its listed paths, and is not final clearance of the new race. Preserve the evidence; review a new session-token guard and focused regression against the replacement snapshot before final fold.

## Final replacement-source clearance

2026-11-17: **PASS**, superseding the pending note above. Frozen replacement `dirty-built.html` and current source both hash `d4daeec884e5eec4b78f7ecc56a65f5862ee0a0a2dfe8e9a4731866270105975`.

Source recheck: normal save captures the actual editor baseline object. After every held-name, multi-dish, no-alternative and carried-warning await, and before applying an awaited halal answer, both service key and session identity are checked before further state mutation. A reopened same service has a different baseline object and cannot accept the stale answer. Existing extracted VM tests without the full editor baseline retain the guarded legacy path; full-app browser tests exercise the real session identity.

Independent focused revalidation on this exact frozen replacement:
- Supplemental preservation and mode/halal-cancellation probes **16/16 pass** (`dirty-independent-final.log`).
- `tests/browser/halal_context_race.mjs` **3/3 pass**, run by this safety reviewer (`dirty-safety-race.log`): stale answer cannot save another service, stale answer cannot save or close a reopened same-service draft, dismissal resolves false without changing saved data.

Earlier **45/45** frozen main draft gate evidence is retained; builder independently reran it after the guard. No remaining safety/UX blocker found in the replacement. Final required CI and release/feed clearance still apply.

## Final compatibility ordering and gate interaction clearance

2026-11-17: **PASS** final product source/snapshot SHA-256 `330ca0b890eb54b48907ca68ec6583599b64fa4d9c0c88ca70981662a4dbf691`. Compared the final key/session checks: clauses are now separate to preserve existing source-locked harness expectations, but each awaited save return still rejects a changed service or editor session before mutation. Independently reran the stale-answer browser probe on this exact snapshot: **3/3 pass** (`dirty-safety-race-final.log`). Prior draft behavior clearance is unchanged; builder's final full Node result is 984 pass, 0 fail, 1 skip.

The hosted plain-plate gate's legacy cancellation interaction was independently reproduced red at its original saved-original reopen assertion (`plain-options-cancel-red.log`). Its earlier conflict-save probe stubs `doorAsk` to true; with draft protection that means Save rather than Discard, so Close correctly kept the incompatible draft. The gate now temporarily restores the captured real dialog, invokes normal Close, explicitly chooses Discard, waits for the panel to close, and restores the prior stub in finally. All four Close transitions use this user path. No force-close bypass was added.

All **26 original check assertion lines are identical** to HEAD (automated comparison). No food/data/output expectations were changed. The completed amended gate passes **26/26** (`plain-options-cancel-green.log`). Final test SHA-256 `5ca6f940964d7592dcd9c7a8c6979e95a52bc0cf869923cf6f23759b654ec7f4`. No operational data or product edit was made by this gate amendment. No remaining safety/UX blocker found in final source plus amended test interaction.


# Dirty menu draft — independent release/feed review

2026-11-17. Preliminary review; awaiting final frozen builder snapshot/hash. No operational source/data writes by reviewer.

## Required async correction before clearance

The halal callback must recheck the save's captured editKey before `_finishMenuSave` reads global mcMenuEditKey/slot state. Earlier save questions already check context after await. A delayed halal answer after navigation or an overlapping workflow must resolve false rather than writing the old name/flags into the new current service or dereferencing a closed editor. This was sent to root before final freeze.

## Initial compatibility inspection

Draft signature/baseline is editor-only transient state; it does not add published fields or change source fact precedence. Signature includes both slot state and live DOM fields, covering typed-but-not-yet-blurred input and alternative/line changes. Clean baseline is captured after initialization/summary; saved or discarded paths explicitly clear it.

The leave helper awaits the normal save and continues only on exact true. Validation/cancel returns do not complete navigation. Repeat leave requests are suppressed while one decision/save is pending. The new beforeunload handler supplies the native loss guard only while dirty, without claiming draft persistence or cross-device recovery.

showScreen, openMenuEdit, closeMenuEdit, goHome, toggleEditMenuMode and openTestMeal use the existing navigation destinations after the decision; output building/routing/recipe data policy is not changed. Successful save still uses existing writer and publication; local success is not downstream receipt. Reset-to-original is an explicit existing saved-state operation and closes without a redundant draft prompt.

Final review must verify async context/cancellation guards, frozen gate execution, source-only boundary and final hash. No operational data push is authorized by this review.

## Final independent review — cleared

**PASS** at frozen dirty-built.html SHA-256 `d4daeec884e5eec4b78f7ecc56a65f5862ee0a0a2dfe8e9a4731866270105975`.

Independently ran final frozen source:
- `editor_dirty_draft.mjs`: **45/45 passed**, log dirty-release-final.log.
- `halal_context_race.mjs`: **3/3 passed**, log halal-release-final.log.

The independent stale-callback gate was authored before the context fixes. The original delayed answer reproduced a wrong-service save. The first editKey guard prevented that case; a second probe then reproduced corruption after close/reopen of the same service (old meal name with new draft component). The final source captures the editor baseline object as session identity and checks it after every awaited save question, before subsequent state mutations, plus inside the deferred halal callback. Both original and same-service invalidation now return without saving/closing the newer draft. Backdrop dismissal of the halal dialog explicitly resolves false, retaining the editor and saved state.

Reviewed source checks after held-name, run-on, no-alternative, warning-retention and halal decisions. In particular, no-alternative confirmation validates the session before setting ALT_MEALS_NONE. The leave continuation runs only after a true save result; validation refusal, Stay and dialog cancellation do not navigate or publish. The pending leave flag is released in finally. Clean navigation remains quiet; unsaved live values, slot flags, alternatives and line choices participate in the transient signature. No ingredient precedence, clinical preparation authority, resident scope or output schema is changed.

The signature/session state is intentionally transient. Native beforeunload protection warns; it is not durable draft recovery. This slice does not claim compare-before-write reconciliation of newer remote meal edits; the broader multi-device baseline work remains separately gated. Deployment identity advances to .82; existing freshness/reload controls apply.

This clearance is for source/gates only. Operational JSON changes in the working tree are separate and must not be swept into this PR. Full source CI and final committed-head inspection remain necessary. Hosted deployment and intended device observations remain distinct from successful local save. No public operational push approval is implied by this review.

Final locked-source recheck: PASS, unchanged SHA-256 d4daeec884e5eec4b78f7ecc56a65f5862ee0a0a2dfe8e9a4731866270105975. Existing held-key and cancellation assertions remain in order, followed by session guards before mutation. Prior independently executed final-snapshot 45/45 + 3/3 remain applicable. Cleared for a source/gates-only PR based on current main; operational JSON must remain excluded.

## Final compatibility pin and plain-plate interaction amendment

**PASS** at final frozen source SHA-256 `330ca0b890eb54b48907ca68ec6583599b64fa4d9c0c88ca70981662a4dbf691`. Rechecked source hash and clause ordering: existing service-key and cancellation assertions remain, independent session guards follow before every state mutation; no behavioral weakening of stale-session protection. The ordering-only adjustment keeps the prior frozen structural contracts without changing expected source behavior. Builder reports exact-source Node 984 passing and affected structural files 16/16; prior independently executed dirty/race behavior remains applicable to these equivalent guard clauses.

Reviewed the gate-author amendment to `plain_plate_options.mjs`: it captures/restores the real doorAsk before the existing conflict probe's stub, invokes ordinary Close, selects explicit Discard changes when the new loss dialog appears, and waits for the panel to close. It does not force-close the editor, stub away the loss question, or change the original 26 checks. The unchanged-sheet/reopen assertions run after the actual discard path.

Independently ran the amended plain-plate gate against current final source: **26 checks passed**, exit 0 (`dirty-plain-release.log`). This amendment is justified interaction adaptation, not an expectation change to green a regression. Cleared final source/gate scope; continue to exclude operational JSON from the PR and observe hosted checks/deployment independently.
