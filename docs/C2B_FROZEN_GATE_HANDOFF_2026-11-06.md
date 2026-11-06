# C2b browser selection and operational coverage gate handoff

Root approved the minimum selection scope: keep the entire fast Node roster on every admitted run; select only expensive browser installation and publisher browser gates. This preserves current coverage without a second brittle manifest of Node exclusions. No new job, runtime dependency, `[skip ci]`, delivery dependency or recurring job is authorized.

Frozen author-owned tests, under `door/tests` (not the F4 release isolate):

- `c2b_ci_selection_gate.mjs`: SHA256 `1e94787198efd7237ad799f847928bae4044309ccd7f950e5f16cca4f3148fd9`.
- `c2b_published_flow_gate.mjs`: SHA256 `aff389f606470d3b469b1b3e7bdaa3479f343975b4faf255ad965e623561fe72`.

Before implementation: 67 tests, 0 pass / 67 fail, no skips; log audit scratch `c2b-frozen-red.log`. Implementations are absent and the workflow still lacks conditional browser scope. These gates must remain unchanged during the build.

## Builder interfaces and boundaries

`scripts/ci_door_scope.mjs` exports `classifyNameStatus(raw)` and `coverageForEvent(eventName,event,sha,git)`, each returning `{browser:boolean,reason:string}`. Use checked exact commit SHAs, NUL-delimited name/status, disabled rename detection, push old..new and PR merge-base old...head. Exceptions, missing bases, empty/truncated/malformed diff, unknown status/path, rename/delete/copy/type change and manual/unknown event all run full browser coverage.

Only added/modified ordinary published artifacts may omit browser work: the 12 F1/F4 dependency files, `recent_log.json`, `change_log.json`, `push-log.txt`, root Markdown and Markdown under `docs/`. Code, tests (including test README), workflow files and unknown paths always run browsers, even in a mixed data change. `menu_reno.json` is intentionally outside the ordinary publisher set and stays full. The workflow retains its existing docs/log trigger filters and concurrency cancellation. Add manual dispatch for explicit full coverage. A failed/unset scope output must run browsers (`!= 'false'`), not skip them.

Retain the single named safety job, full unconditional `node --test tests/*.mjs`, matched Ubuntu 24.04 / Playwright 1.56.1 and existing advisory behavior. Apply the same conservative condition to all four browser setup/cache/install/run steps. Checkout needs the exact revisions available; unavailable history still selects full. Pages remains independently runnable with its existing allowlist/permissions/environment/concurrency.

`scripts/check_published_flow.mjs` exports async `validatePublishedFlow(files,{html,now})`, returning `{ok:boolean,mode:'legacy'|'active',issues?:...}`. It must use the actual inline shared F4 core from the supplied HTML for receipt/public-projection validation, not a parallel implementation of menu/date semantics. It must not mutate files, use network or require a browser. The Node gate reads the real checked-in publication and calls this interface automatically.

A wholly legacy publication is allowed before activation. Once any F4 receipt/counter/projection appears, require the complete authenticated publication set: matching menu/overlay/registry/routing/state receipts, matching private counter/site, and the seven required public files. Run the public candidate through the shared core to detect mismatched input revisions, altered menu/dated content, omitted dated projection, invalid counts and calendar/receipt inconsistencies. Honest unavailable routing remains valid data and must not be replaced with zero. This is publication-coherence coverage, not a claim to independently reconstruct unpublished recipe-source facts from public digests.

## Retained operational safety coverage

The full Node roster retains existing artifact structure and publish validation, F1 transaction/recovery/credential boundaries, current bound-recipe Corn floors, all published-resident routing replay, independent routing oracle and anaphylactic matrices, whole-meal/slot/dietary regressions, privacy allowlist, and portable paired F4 receipt/projection/knownness/loss contracts. The new published-flow gate adds current additive receipt validation; it does not replace these. Optional sibling-dependent checks must continue to report honest skips.

Ordinary data runs avoid Playwright package/Chromium installation and six synthetic publisher browser checks. Code/contract runs retain all of them. No fixed minute-saving number is asserted without hosted timing; the saved setup is the same cost identified in the audit. There is no need to reduce already-fast Node work to obtain that saving.

Required follow-up: independent review of the builder's scripts/workflow; green frozen tests plus full Node roster; verify data-only and code/full classifications with checked diffs; preserve all hosted required check names and independent Pages delivery. No activation follows automatically from this CI change.
