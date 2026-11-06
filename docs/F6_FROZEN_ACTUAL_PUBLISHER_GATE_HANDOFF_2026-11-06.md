# F6 actual publisher gate handoff

Gate-author scope: tests and this receipt only. The builder must leave these files unchanged. The reviewed contract is `docs/F6_DELIVERY_CONTRACT_DRAFT_2026-11-06.md`, SHA256 `bb38559e00e7c02a99ec1ae0005836edb332df0291dbaf4af138a65c0bfe11b6`. Existing F1 recovery, F4 occurrence/coherence and food-authored F4 actual completed-build authority gates remain separate retained requirements.

## Frozen interface

Use the actual `publishToGitHub(false)` and normal `doorRequestCoherentPublish(...)` wrapper. The only new UI interface is the approved real `doorRecheckDelivery()` action, visibly bound to a pending-delivery button/link. There is no new test getter or mandated storage key. The harness discovers records by the documented schema in actual localStorage, and reads the existing `gh-status` and `sync-status` surfaces. It does not replace the publisher or outbox.

The synthetic Git scope is `fixture/door`, branch `main`, site `rexdale`. Anonymous verification must read that repository's Pages scope (`https://fixture.github.io/door/`), independently of Git. Default startup reads from the real app's configured origin are intercepted but cannot count as delivery evidence or trigger the delivery race hooks. Credentials are synthetic and scoped. No request reaches a real service.

The clock is fixed to 2026-11-04 in America/Toronto and paused; only the test advances it. Seven public artifact digests use the independently authored F4 canonical digest helper. Private flow counter content is never treated as public. The minimal EXPO response cases exercise the documented F4 capability wire; actual capability production/import refusal is independently covered by the unchanged paired F4 8/30 gate.

## Files

| File under `tests/browser/` | SHA256 |
| --- | --- |
| `menu_flow_f6_harness.mjs` | `6ed786723b1aa28819b758f77e550459576dc6fa58e44a92082eeedd06fac8ae` |
| `menu_flow_f6_dedupe.mjs` | `02ed6a0e4fbc81947d792a63c36a61f4c327ecd85595abc70da544fc8fcfd9bb` |
| `menu_flow_f6_delivery.mjs` | `e6f706396149bd36087f3ea9a003d94bd455196fc6567e34acdc587ecaeeec5db` |
| `menu_flow_f6_recovery.mjs` | `c135f15cab95ab8197385f25e1d596f9b8aa6f2bb2bef3eab3a39dfceac296a8` |

The harness imports the existing frozen applying/recovery transport and synthetic F4 fixtures. Their existing assertions and source are unchanged. `HOUSE_FLOW_HTML` can point at an immutable product snapshot; without it the gates use this worktree's `index.html`.

## Acceptance coverage

- Dedupe (25): first changed operation, exact pinned public digests, stale and failed Pages, closed EXPO, repeated saves without Git objects/commits, actual wrapper wording, real pending action and Actions link, no token/resident details, cold second device, legacy path, and unchanged original debt time. Roster-only, recipe binding, dated scope, real revert, anaphylactic input, staff records and similarly named meaningful metadata still make one atomic changed operation. A private counter ahead of public content still repairs; missing/malformed staged artifacts repair or hold rather than acknowledge false equality.
- Delivery (27): durable attempts at 0/5/30 seconds, restart/focus/save budget retention, exhaustion, one explicit extra recheck, seven anonymous cache-busted no-store reads, independent served/consumed evidence, seven-day historical/future/malformed timestamps, old/imported/manual/stale/wrong-occurrence consumption refusal, rebuilt and actual roster-change positives, partial/different-epoch serving refusal, later coherent same-epoch supersession, and exact seven-file legacy digests.
- Recovery (14): lost acknowledgement, latest complete operation replacing pending debt with its own identity/time/budget, one current record per scope, scope-switch retention, newer local menu/outbox intent during held verification, another device advancing the pinned comparison head, simultaneous recheck coalescing, actual request abort within eight seconds, and pending status without another content commit after timeout.

The no-op race permits a safe hold or a correctly re-read/rebuilt acknowledgement at the actual current head. It never permits acknowledgement against an obsolete comparison head. Each changed-operation control checks the actual applying transport's visible atomic commit, not only a helper's return value.

## Reproduction and release boundaries

Frozen pre-build baseline on DOOR SHA256 `9e4687bd9697566bd1f4a4c294abb11ab423b6ef5fbba2517ce796e73071e81d`: **66 checks, 19 pass and 47 deliberately fail**. Dedupe 13/25 pass; delivery 2/27 pass; recovery 4/14 pass. All cases completed without runtime errors or unsupported writes. Existing meaningful changed-operation controls, private-counter repair, missing/malformed artifact handling and lost-ack recovery remain green. New dedupe/debt/verification behavior is red. Race instrumentation confirms the authoritative ref actually moved; the absent delivery receipt prevents a false green acknowledgement claim. Exact logs are `%TEMP%/door-ci-audit-20261106/f6-{dedupe,delivery,recovery}-red.log`.

Run the three gate entry points with pinned Playwright 1.56.1 and Chromium, using the existing local audit loader only to resolve installed test dependencies. The CI enrollment should reuse the existing C2b-selected browser steps and supported Ubuntu 24.04 runner; no additional job, polling service, deployment rerun or credential permission is required. Ordinary known operational data changes continue to use the full fast Node suite without browser setup.

Browser evidence is synthetic. It does not prove real Pages/EXPO adoption or authorize activation. The final builder source must receive independent food/data and release review and pass retained F1/F4 gates before folding. UI wording and storage must never infer consumption from a Git write or turn historical acceptance into current service authorization.
