# Breakfast resolver foundation review

Baseline: merged DOOR `593896321df6ab5c2bf95fe71426b6bbbea1a75c` (PR #204). Date: November 17, 2026, America/New_York. Source authority and unresolved decisions remain with the [action plan](../DOOR_PLATING_RECONCILIATION_ACTION_PLAN_2026-11-16.md). The [producer-owned draft interface](../../schemas/breakfast_plate_model.md) defines this inactive foundation and its activation gates.

Application SHA-256: `7845103559425c7ffaaa1f08d4804d711b220125eb58be2cecd52051881e971e`.

Resolver/aggregation source block SHA-256 (from `function doorBreakfastVariantBasis(` through the byte before `function computePlatingData(`): `063af6bfdebe907ac3cc33d2236fb4731463bc0f23a335b55d7e2d04f8b7391b`.

## Change and independent review

Three pure functions implement complete-plate resolution and explicit roster aggregation. They do not run in current operational flows. All current menu/registry/feed data, staff output, readiness, app stamps, reporting priorities and anaphylactic routing remain unchanged. The draft is not a persisted or public schema extension.

**Food/data — PASS** (`plating_plan_food_review`). The reviewer inspected the implementation and ran the focused tests. Relevant component predicates remain independent and include accompaniments. Unknown/conflicting/stale evidence and ambiguous variants do not resolve. Preparation/portion evidence binds to the exact assembly and preparation text. Qualitative portion requests do not invent quantities. Complete roster accounting, separate anaphylactic disposition and the draft's limits passed. The verdict does not approve actual products, texture or migration.

**Release/feed — PASS** (`plating_plan_release_review`). The reviewer inspected the code, ran the focused tests, confirmed no operational call sites or schema/feed/persistence changes, and checked detached results, ordering, invalidation and roster/quantity accounting. A suggested improvement to quantity grouping was implemented and re-reviewed: equivalent amount/unit objects now group identically regardless of property insertion order. The final reviewer run passed all 17 focused tests with no remaining findings.

## Validation

The foundation tests fail on the unchanged baseline because the shared resolver does not exist. The implemented candidate passes 17 tests, including all four B0 combined-requirement examples using deliberately controlled synthetic evidence, not asserted real product safety. Additional cases cover unknown yoghurt/accompaniments, stale component/request/preparation evidence, ingredient conflicts that plate labels cannot override, incomplete adapter input, explicit anaphylactic separation, malformed/duplicate identities, ambiguous or incompatible preferences, detached results, qualitative versus unknown required quantities, full-roster accounting and quantity/preparation/revision grouping. A call-site regression enforces inactivity.

The full Node safety suite passed **965 tests with one existing skip**. All **20 workflow browser gates passed locally**, covering coherent publication, recovery/delivery, existing output safeguards and themes. No source workbooks were altered or new service workbooks produced, since this change does not activate an output path.

## Remaining activation gates

The future adapter must authenticate CODEX provenance, derive evidence from supported canonical facts and supply every applicable resident requirement. Revision 0 validates evidence bindings and structure; evidence-reference strings do not authenticate themselves. Chex is the confirmed cereal brand and Kirkland is the working assumption for oat/soy brands; exact formulas and No Dairy yoghurt remain unverified.

Typed private instructions and variant persistence need reviewed ownership, normalization, invalidation, merge/restore/rollback and F4 fingerprint coverage. Preview, print, all XLSX/ZIP/readiness paths, legacy routing and F4 must consume one shared result when activation is implemented. Partial/unavailable production semantics and any schema changes need paired EXPO/HUB consumer gates. The current manual sheets remain intended-meal authority throughout; neither a synthetic test nor this PASS clears a real ingredient/preparation question.
