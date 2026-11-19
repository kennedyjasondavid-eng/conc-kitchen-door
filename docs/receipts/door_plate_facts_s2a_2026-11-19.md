# S2a receipt: one function for a plate's facts (2026-11-19)

Plan: `docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md` §4 S2a. A move, not a change: the plate part of
`computePlatingData` (each plate's dishes and CONTAINS line, the dishes whose label is not checked, the kitchen plate
flags, whether the vegan plate is egg and mustard free, the halal plate's allergens, breakfast yoghurt plates) now lives
in `doorPlateFacts(dayData, period, { dated, menuEdit })`, which reads no resident. `computePlatingData` resolves the
day (swap or special meal) as before, calls it, then seats residents. `doorPlateFactsFor(week, day, period, { noDated })`
plates the every-week meal on a date with a swap, for S2b and S5b.

## Proof: byte-identical on today's data
Real app in Chromium, network blocked except the XLSX library CDN, clock 2026-11-19 10:00. Inputs: the published
`menu_current.json`, `menu_overlay.json`, `meal_swaps.json` and `door_state.json`. For each of the 84 meals:
`computePlatingData` (every field, with the non-enumerable label and yoghurt facts), `buildPlatingHtml`, and
`buildDaySheet`'s worksheet; then `buildRoutingByMealJSON` (export stamp removed). `main` `f246523` against this branch:

| Output | main | S2a |
|---|---|---|
| plating data, 84 meals | `857209988ac2b0aa` | `857209988ac2b0aa` |
| plating sheet HTML | `b0bf7250526f848f` | `b0bf7250526f848f` |
| workbook sheets | `90db1c9775ae767b` | `90db1c9775ae767b` |
| `routing_by_meal.json` | `72cb9e603c40a410` | `72cb9e603c40a410` |

(sha-256, first 16 hex.) Page errors: 0 on both. The routing replay (`tests/browser/routing_replay.mjs`) table is
byte-identical on both builds too.

## Order of steps
Two steps moved earlier than the sections, both checked: the kitchen plate flags, `noPorkAlt` and the label facts add
only `_` keys and `noPorkAlt`, which the anaphylactic check (`anaphTagMealFlags`, `has…` keys only) never reads; the
halal allergen line and the yoghurt plates are worked out before `computeSections`, whose one write
(`halalCertifiedMeat`) `flagsToAllergenStr` does not read.

## Not in this slice
The editor's own `_vegAltSafe` and `vegAllergens` stay until S2b replaces the editor preview with `doorPlateFacts`.

## Found, not changed
On `main` the routing replay against today's data reports 130 rows where its rules-table oracle disagrees (breakfast
"line misses dairy-free"); the receipt of 2026-10-18 recorded 0 on that day's data. Not caused by S2a (identical table);
to look at separately.
