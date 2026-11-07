# DOOR menu flow plan review

Status: review complete. Three independent reviewers requested eight material changes to v1; all eight were folded into v2 and closed in the second round. No remaining material plan findings were reported. This is a plan review, not authorization to deploy product changes.

The user requested an action plan and agentic review on November 6, 2026. Three independent agents received the same [draft v1](DOOR_MENU_FLOW_ACTION_PLAN_2026-11-06_v1.md), SHA256 `967f8a14b4ee9aac8af576c56ff83e7ea2249289c0fa8bc5c5a68f8ab02f1d53`, with the audit, machine-readable examination receipt and current remote-source archives available for verification. Reviewers were instructed to make no code changes and to report material findings, evidence limits and a verdict.

| Reviewer | Scope | Status |
|---|---|---|
| `/root/review_food_data` | Food safety, dietary and recipe identity, portions, dated validity, staff records | v2: ready for implementation planning; both findings closed |
| `/root/review_contract_release` | Atomicity, concurrency, contracts, failed-read recovery, migration and rollback | v2: ready for implementation planning; all three findings closed |
| `/root/review_flow_ci` | Staff friction, proportional checks, CI coverage, runner use and scope | v2: ready for implementation planning; all three findings closed |

## First-round findings and revisions

| Reviewer / priority | Finding | Required correction folded into v2 |
|---|---|---|
| Food/data P1 | Retaining a supervisor decision unchanged can carry an unsafe cook-ahead placement onto a newly bound recipe. | F3a re-derives all recipe-owned facts, preserves decision history, and revalidates safety applicability. A five-day to two-day hold-limit fixture must suspend incompatible work while preserving notes. |
| Food/data P2 | An internally coherent old board can still certify stale quantities after newer authoritative inputs are known. | F0/F4 immediately invalidate affected quantities and routing on known supersession; automatically restore a matching candidate; reject late older request generations. |
| Contract/release P1 | Fixing the main publisher alone leaves independent menu/removal writers able to publish incoherent sets. | F1 inventories and migrates every consistency-group writer, including real edit entry points, timers and HTA/automation routes. F6 only optimizes this corrected path. |
| Contract/release P1 | New HTML or a minimum-version field cannot prevent an already-open authenticated legacy tab from writing. | The rollout specifies an enforceable credential cutover, a new storage namespace inaccessible to old code, pending-edit preservation, coordinated shared credentials, legacy-device tests and a rollback that preserves the writer boundary. |
| Contract/release P2 | Recipe scaling could ship before coherent and valid routing was available. | Split F3a identity propagation from F3b quantity activation; F3b explicitly depends on F4. |
| Flow/CI P2 | Historical test maintenance was unnecessarily delayed until all flow repairs were complete. | C2a replaces historical pins early with reviewed fixtures while retaining the full suite; C2b selects checks only after adequate contract coverage exists. |
| Flow/CI P2 | Requiring verified delivery before suppressing unchanged commits creates repeated writes during Pages failure or a closed EXPO session. | F6 deduplicates content independently of delivery status; bounded delivery retries target the existing revision; EXPO consumption is observed when it runs. |
| Flow/CI P2 | Merely withholding expired dated counts until DOOR next publishes does not provide automatic normal operation. | F4 selects validated rotation routing plus exact-date overrides from the same inputs. Expiry returns valid rotation counts with DOOR closed and without a new Actions schedule. |

The [v2 review snapshot](DOOR_MENU_FLOW_ACTION_PLAN_2026-11-06_v2.md) has SHA256 `b32115d50be31131b68aba6aa02cfb6b65c42e1e7342fe66f1eb622b73d067de`. All three reviewers independently verified this identical revision and checked closure and interactions with the rest of the plan. The editable plan differs from the reviewed snapshot only in its final status and link to this completed review record; the substantive implementation proposal is unchanged.

## Evidence limits

Reviewers inspected the plan, audit receipts and relevant archived source. The CI reviewer also checked sampled workflow usage. No reviewer changed application code, reran production operations or exercised live credentials. The earlier audit used isolated copies and mocked feeds; its failure simulations do not prove recovery after an actual remote overwrite. Implementation must add an applying remote simulator, paired contract fixtures, release-version checks and the operational cutover tests specified in the plan.

## Closure verdicts

The food/data reviewer verified the complete v2 snapshot and disposition record. F3a's full production-fact derivation and safety revalidation close the P1 finding; F0/F4's immediate invalidation, automatic recovery and rejection of late responses close the P2 finding. Scaling dependency, dated fallback, unknown-state handling and preservation of staff records were also checked. Verdict: **ready for implementation planning**, with no remaining material finding in this review scope.

The contract/release reviewer verified the complete v2 snapshot and disposition record. F1's migration of every dependent writer, the enforceable credential cutover and rollback boundary, and F3b's dependency on F4 close all three findings. The reviewer also checked rotation validity, supersession and delivery-retry interactions. Verdict: **ready for implementation planning**, with no remaining material finding in this review scope.

The flow/CI reviewer verified the v2 snapshot and closed all three original P2 findings: early C2a assertion repair is separate from later C2b selection, unchanged content is deduplicated independently of delivery debt, and valid rotation counts return with DOOR closed. Each has explicit acceptance cases. The one-time credential cutover remains operator-led and adds no daily staff ceremony. Verdict: **ready for implementation planning**, with no remaining material finding in this review scope.

The editable [action plan](../DOOR_MENU_FLOW_ACTION_PLAN_2026-11-06.md) is the resulting implementation proposal. None of these verdicts certifies implementation or authorizes a production release. No product code, workflow configuration, credentials or production data were changed by this planning/review task.
