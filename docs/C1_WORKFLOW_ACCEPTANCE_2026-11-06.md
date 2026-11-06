# C1 workflow consolidation acceptance

Gate-author baseline: DOOR `8066a1f`, reviewed menu-flow plan C1. This is a workflow-only slice; the full safety suite and advisory expectations remain unchanged. No C2b path selection is included.

## Required behavior

1. `door-tests.yml` allocates one `ubuntu-latest` job using Node 22, retaining its five-minute timeout, read-only contents permission, PR/push triggers, existing docs/log path exclusions and per-ref cancellation. It runs the full `node --test tests/*.mjs` suite.
2. The existing menu-decisions advisory runs in that same job even after a safety-test failure. Its failure does not fail a successful safety job. Its summary reports an actual failed/passed/skipped result truthfully, rather than calling a skipped check unchanged. Safety failures retain the overall failing job result; do not apply `continue-on-error` to the safety step/job or swallow its exit status.
3. `pages.yml` allocates one `ubuntu-latest` job, in order: checkout, prepare the allowlisted directory, upload that directory, deploy its artifact. Pages stays independent of safety/advisory results. It must not gain `needs`, `workflow_run`, a test command or another test-success condition.
4. Preserve Pages push-path selection and manual dispatch; permissions `contents: read`, `pages: write`, `id-token: write`; `github-pages` environment with the deployment step's `page_url`; concurrency group `pages` with `cancel-in-progress: false`.
5. Preserve the exact public artifact: `index.html`, `favicon.ico`, `menu_current.json`, `routing_by_meal.json`, `registry_summary.json`, `meal_swaps.json`, `meal_swaps_reverted.json`, `special_meals.json`, `special_meals_removed.json`. App files remain required; absent optional data files produce warnings. Never copy the repository root, residents, editor state, docs, tests or `.git` into the artifact.

## Review and evidence

- Compare both workflow diffs with this baseline; check the existing `pages_served_privacy_gate.mjs` and `kitchen_reader_gate.mjs` allowlist coverage.
- Verify the status matrix: safety pass/advisory pass => pass; safety pass/advisory fail => pass plus warning; safety fail/advisory pass => fail plus advisory summary; both fail => fail plus advisory warning. The advisory execution condition must account for the earlier failure. A skipped advisory must not claim a pass.
- Check artifact preparation and deploy order, deployment output ID, environment binding and unchanged triggers/permissions/concurrency. No additional classifier, monitor, timer or runner job is introduced.
- Once hosted, retain the run's job/step outcomes and use existing Actions metadata to measure actual seconds and job count. An ordinary publish touching deployed data should start two jobs total across the two workflows, down from four. The historical approximately 50% individually rounded private-minute proxy is not a promised elapsed-time reduction or a bill saving for the sampled public repository.

This checklist is an acceptance contract for the builder and independent reviewer. Local source inspection cannot prove GitHub's hosted execution or billing; report those limits rather than manufacturing a production failure solely for measurement.
