# C1 workflow consolidation receipt

Ordinary DOOR publishes previously allocated four short jobs across tests and Pages. This change uses one safety/advisory job and one independent Pages job. It keeps the full safety suite, advisory expectations, public-file allowlist, triggers, permissions, environment and concurrency behavior.

Gate author: `/root/review_flow_ci`; [acceptance checklist](C1_WORKFLOW_ACCEPTANCE_2026-11-06.md). Builder: `/root`. Base: `8066a1fc8c32c65e1cbe56c4fec4b3ad4af364c9`.

Validation:

- Pages privacy: 5/5 pass, `node tests/pages_served_privacy_gate.mjs`.
- Kitchen reader: 15/15 pass, `node tests/kitchen_reader_gate.mjs`.
- Existing menu advisory: 3/4; the current W1 Tuesday Nightshades expectation disagreement is retained. No allergen data or advisory expectation changed.
- Workflow diff has no whitespace errors. The default test runner encountered sandbox child-process EPERM; direct Node test-module execution completed.

Independent safety/data reviewer `/root/review_food_data`: clear, no material findings. Independent release/feed reviewer `/root/review_contract_release`: clear, no material findings. Both reviewed the complete workflow diff against the fixed acceptance checklist. Safety failure remains a job failure; only advisory failure is tolerated; the advisory still executes after a safety failure and reports pass/failure/incomplete accurately. Pages remains independent and serves exactly the previous allowlist. Reviews were source-based and did not exercise hosted Actions.

Reviewed workflow SHA256 values:

- `door-tests.yml`: `6b044ba82fe4dcb70eb89c230f92d8e3920702172f6c9ee416854ff705804596`
- `pages.yml`: `0b2cbbbd293e066d925b2bbabae9e7f05c64041a126109f1c502a35e829367e3`

The target is two jobs instead of four for a publish that triggers both workflows. Hosted execution and realized runner seconds remain to be measured. No billed saving is claimed for the sampled public repository.
