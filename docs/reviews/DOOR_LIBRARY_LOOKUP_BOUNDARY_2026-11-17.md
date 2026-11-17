# Library recipe lookup boundary

Baseline `08f1dd59b7e2f7112afa79fbe9fabbf4afccfdc0`. This paired safeguard precedes the nine requested manual-alt CODEX recipe additions. It changes no menu/registry data or public schema and does not activate breakfast.

## Defect and boundary

The existing name hint searched all vegan recipes by containment and word overlap. Adding **Plain Cauliflower and Green Beans** therefore made the current unlinked **Green Beans** side inherit cauliflower's Brassicas. Adding the pea/carrot/onion assembly could similarly reinterpret a different side. The first impact test caught seven current sheet differences before publication; no recipes were published during that failing test.

New Library-only recipes now contribute to the unlinked-name lookup only through a unique exact complete/component name. Explicitly linked slot IDs continue to read their current facts. Legacy containment/word-overlap hints remain for sealed-base identities, plus 44 explicit pre-addition vegan Library IDs from shared-library commit `a1757a3fcd99df56c6e3f4100f03964b47f437db` (public SHA-256 `be0620184d07e86fad7c57a2b77afca34eeeed88167737a5daf6f28615de2677`).

The compatibility IDs preserve current behavior across older shipped, cached and live base feeds. Their **contents are not frozen**: current CODEX facts still overlay each identity. A base-only trial was rejected because it dropped existing Library hint contributions, including current Carnitas and kimchi warnings. The explicit list preserves those established outputs under Jason's baseline constraint. This is compatibility debt, not proof that the old hints identify ingredients correctly; it must not expand automatically when recipes are added. No recipe was renamed, given a false stream or stripped of its DOOR block to conceal the collision.

Allergen floors, linked-slot warnings and stored operator statements remain unchanged. Ambiguous exact names do not choose an arbitrary recipe. The base-name fallback applies only where the base has no stable ID. Current menus and source allergen declarations are untouched.

## Review and verification

- **Food/data PASS:** the reviewer inspected source/tests and reran all eight focused cases. New partial-name compounds cannot leak facts, exact and linked new recipes retain declarations, and existing facts/floors remain live.
- **Release/feed PASS:** the reviewer inspected the explicit identity boundary and browser proof and reran eight focused cases. Deploy before canonical recipe publication; the compatibility list is a deliberate bounded exception.
- **984 Node tests passed, one existing skip.** The fixtures supplying a sealed feed now explicitly provide that feed as the base, as the real loader does; historical expected outcomes remain unchanged.
- **15 new browser checks passed with the real pinned XLSX library.** For each live/cached/shipped-fallback mode, the guard alone and guard plus all nine additions preserve all 84 HTML previews, worksheet cells/styles, memberships, notes, anaphylactic roles, menu, registry and legacy counts/components. Actual coherent publication preserves F4 rotations/dated counts; replay preserves routing. Exact/linked cauliflower-and-bean selections still declare both Brassicas and Beans. New identity facts enter the recipe vector as expected; they do not create jobs or change current plate counts.

The frozen test fixture is a canonical food-fact/identity projection, not a runtime recipe database. [The receipt](../receipts/door_library_lookup_boundary_2026-11-17.json) records exact source/provenance and checks. The [action plan](../DOOR_PLATING_RECONCILIATION_ACTION_PLAN_2026-11-16.md) owns execution state. Recipe creation and the egg-source clarification belong to the CODEX publication receipt.
