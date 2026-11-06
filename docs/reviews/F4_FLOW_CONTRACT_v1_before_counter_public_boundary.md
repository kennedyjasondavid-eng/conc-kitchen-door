# F0/F4 additive flow contract — draft for paired review

Status: proposed contract, not frozen gates and not emitted product data. The gate author owns this draft; the parent and independent release/contract reviewer must agree the interoperable fields before a builder emits them. No production, operational JSON, workflow or dependency changes accompany this document.

## Existing seams and boundaries

DOOR already stamps `menu_current`, routing, registry summary and state with `builtFromMenu`; that stamp covers menu content and export time, not resident/dated/recipe/calendar identity. `buildRoutingByMealJSON` runs the plating engine against the next-service dated meal, so its legacy rotation-shaped output cannot safely represent every occurrence. EXPO loads menu, dated maps, routing and registry independently and presently falls back to 172 for absent routing. HUB checks routing cache age at load, but its recipe-link lookup uses production week/day and can outlive that check. F4 must repair these behaviors without changing plating semantics or deleting staff records.

Keep the existing `.routing` payload and schema versions during the additive reader rollout. Add the new representation inside the already allowlisted `routing_by_meal.json`. Do not create another public file or include resident records, source evidence, credentials, import history or private source payloads. Opaque whole-input digests are permitted; do not publish per-resident hashes.

Keep dated artifacts as bare date-key maps: `meal_swaps.json`, `meal_swaps_reverted.json`, `special_meals.json`, `special_meals_removed.json`. In particular, DOOR's current `doorMergeSwapStores` does not reject arbitrary metadata keys. Do not insert `_meta` into these maps. Every dated refresh also obtains the aggregate receipt and validates all four maps against its canonical dated digest before promoting them.

Port HOUSE proven seam 2 (HUB `_fetchJSON`: query cache-buster plus `cache:'no-store'`) and seam 6 (civil dates/noon anchoring). Keep bounded requests on existing boot/focus/retry/prepublish paths; no scheduled Actions job.

## Receipt shape

Add the same object as `_meta.flow` on `menu_current.json`, `menu_overlay.json`, `registry_summary.json`, `routing_by_meal.json` and private `door_state.json` in the coherent publish. `menu_overlay` already has `_meta`. Its presence on menu and registry lets either independently fetched authoritative receipt immediately invalidate old quantities, including roster-only updates.

```json
{
  "schema": 1,
  "publication": { "epoch": "opaque persisted rollout identifier", "sequence": 1 },
  "inputRevision": "sha256:<64 lowercase hex>",
  "components": {
    "menu": "sha256:<64 lowercase hex>",
    "dated": "sha256:<64 lowercase hex>",
    "registry": "sha256:<64 lowercase hex>",
    "recipe": "sha256:<64 lowercase hex>",
    "calendar": "sha256:<64 lowercase hex>"
  },
  "calendar": {
    "mode": "standard",
    "cycleStart": "2026-06-07",
    "cycleWeeks": 4,
    "weekStartsOn": "SUNDAY",
    "zone": "America/Toronto"
  }
}
```

Site remains the enclosing `_meta.site`; it is required, and contributes to `inputRevision`. The anchor above is Sunday of Week 1 and is equivalent to DOOR's current March 29 Week 3 convention. A different anchor separated by exactly 28 days is normalized to the agreed fixed basis; arbitrary changes do not silently remap the menu. The contract supports only the active standard calendar in its first implementation. Unsupported mode, invalid date/time zone, mismatched site or incompatible calendar is unverified, never inferred to be standard.

The revision is SHA-256 of canonical JSON `{schema:1,site,components}`. Each component digest is SHA-256 of its specified normalized input projection, encoded as UTF-8. Sort object keys lexicographically, preserve ordered arrays, normalize set-like collections explicitly, reject non-JSON/non-finite values. Do not sort an arbitrary array or drop a safety field to obtain equality. Hashes and schema numbers have no chronological order. The old small `doorContentHash` remains for compatibility; it cannot authorize the new quantity certification.

`publication` is a separate causal occurrence, not part of content hashing. F1 reads the previous authoritative flow receipt at its expected Git head and increments its positive safe-integer `sequence` for a newly committed coherent operation. A ref conflict forces reread/rebuild, including this sequence. All devices share the same persisted opaque `epoch`; code rollback preserves it. The initial epoch is created during explicit activation; changing an existing epoch requires an explicit cutover and cannot silently reset a reader. F1 prepared-write recovery must first determine whether the prepared occurrence N landed: an equivalent rebuilt desired content set reuses N and acknowledges its existing commit. Mechanically choosing N+1 before recovery comparison would defeat F1's crash/no-replay guarantee. If newer intent needs a new commit, only then choose the next sequence from the pinned authoritative head. F6 must likewise reuse the existing occurrence for an unchanged save/delivery retry. A legitimate A → B → A restoration therefore has content hash A again but a higher sequence; a late CDN response for the older occurrence of A is rejected. Do not permanently blacklist a content hash. Reject missing/invalid publication occurrence for certification. Receipt construction may calculate the content-only fields first, then the publisher attaches the occurrence before coherent stamping.

Build the exact normalized public `buildMenuJSON().menu` projection synchronously from frozen F1 inputs first, then compute cryptographic hashes asynchronously over that frozen projection and the other frozen inputs before staging. In particular, the exporter's pork/halal flag normalization and regenerated allergen text are part of the canonical public projection; hashing raw pre-export `getMenuData()` would disagree with consumers. Consumers recompute over that same published menu body, with the documented exclusions. Use Web Crypto where available; if unavailable, remain unverified or use a reviewed deterministic SHA-256 fallback. No npm/runtime library or network hashing. Remaining synchronous builders reuse this frozen source, not a second mutable recipe/registry/menu state after hashing. A hashing failure preserves pending work and usable historical information, and cannot emit a certified receipt.

### Canonical input projections

| Component | Included meaning | Exclusions |
|---|---|---|
| `menu` | Effective rotation menu after uploaded base + accepted overlay, including all supported meal lines, main/sides, slots, explicit bindings, alternatives and safety flags. The applied overlay's effective result is represented here, not the stale pre-overlay base. | Export/check/cache times, receipt metadata, UI state and stored `_original` undo history. Original history still persists in staff data. A changed binding/alternative/flag must change this digest even when displayed words stay equal. |
| `dated` | Exact public projection `{swaps, reverted, specials, removed}` of the four bare maps. Preserve every date key and all supported whole-meal fields, explicit identities, flags, `createdAt`, revert and removal times that determine precedence. A tombstone remains identity-bearing even if its meal is absent. | Only genuinely volatile file/cache metadata, not operation/removal timestamps. Do not filter by today's date while hashing a fetched set; otherwise midnight changes the digest without a publish. |
| `registry` | Frozen routing-relevant resident projection, authoritative anaphylactic membership, learned routing and custom-tag rules used by the plating engine. Sort residents by stable resident/room key and set-like tags/memberships deterministically; include all fields the actual routing logic reads, including unknown/uncertain states. | Export times, logs, unrelated notes/labels and non-routing UI state. Output only the aggregate digest. Six synthetic discharges and a changed anaphylactic flag must change it. |
| `recipe` | The frozen **effective DOOR routing recipe input** after base feed/baked fallback and public shared-library overrides, including canonical IDs/names, relevant allergen facts and explicit unresolved/missing facts. The provenance state and digest of every applied shared-library override participate. | Import attribution/evidence, cost-only data and check/export times. Do not hash only the baked fallback while applying a newer shared Library in the engine. |
| `calendar` | The exact normalized calendar object above. | Export/observation times. |

The public menu lets a consumer recompute `components.menu`; the four maps let it recompute `components.dated`; the receipt exposes the authoritative aggregate registry identity without the underlying private records. Consumer validation requires all required authoritative receipts to agree and both public projections to match. Fetching only a matching routing/menu pair cannot authorize counts if the registry receipt is missing or already known to differ.

Recipe source comparison is separate from unrelated feed hashes. DOOR consumes routing/allergen feed plus shared-library overrides; EXPO consumes `recipe_production`. A digest of those different JSON projections is never treated as a match. The paired F3a reader supplies a source vector describing the actual source records/revisions it resolved, including shared overrides. F4 may certify the DOOR routing projection against its receipt; F3b may use it for a recipe only when that recipe identity and portion basis are independently compatible with the consumed recipe revision. A known relevant source update supersedes the prior certification immediately. If the reader cannot establish source comparability, quantities for that recipe remain unverified/unscaled. No claim of cryptographic sameness between different feeds is allowed.

Root/F3a coordination agreed this additive public vector: `routing.flow.recipes[recipeId] = {canonicalName, allergenState:'known'|'unknown', allergenFlags:<existing canonical normalized map>, portionBasis:<typed basis|null>}`. Use the existing CODEX/DOOR normalization vocabulary, including its warning and unknown-state distinctions; do not invent allergen classifications. Exact ID and matching known canonical warning facts establish routing-source compatibility. Conflicting duplicate IDs, name conflicts, missing source or unknown facts cannot be certified by choosing the first record. Only a known compatible typed portion basis can authorize future F3b conversion. Full EXPO production/safety facts identify `recipeRef.revision` separately and revalidate decisions when they change. Never compare that digest directly with DOOR's whole recipe-input digest. The vector contains no private provenance/source payload. Non-adapter validity cases may freeze now; the normalization/portion adapter receives separate paired review before activation.

## Additive routing representation

```json
{
  "_meta": { "site": "rexdale", "flow": "the receipt above" },
  "routing": { "1": { "SUNDAY": { "lunch": "unchanged legacy slot" } } },
  "flow": {
    "schema": 1,
    "inputRevision": "same as _meta.flow.inputRevision",
    "recipes": {},
    "rotation": {
      "1": { "SUNDAY": { "lunch": {
        "status": "valid",
        "counts": { "Regular": 148, "_components": { "Fixture Rice": 148 } }
      } } }
    },
    "dated": {
      "2026-11-06": { "dinner": {
        "status": "valid",
        "kind": "swap",
        "week": "2",
        "day": "FRIDAY",
        "counts": { "Regular": 142, "_components": { "Fixture Sausages": 142 } }
      } }
    }
  }
}
```

Examples abbreviate weeks/slots; a real valid rotation contains all supported 4 × 7 × 3 slots. Site and calendar are inherited from `_meta`; there is only one site's routing in this artifact. `dated` is indexed by exact civil service date, then meal, not by next occurrence of a rotation slot. `kind` is `swap` or `special`; special precedence and tombstones use the real DOOR resolver. Do not silently certify a missing slot. A failed/unavailable slot is `{status:'unavailable', reason:<stable reason>}` with no numeric counts. A legitimate zero cohort is `valid` with numeric zero; missing/failed data is not zero. Include anaphylactic uncertainty in a stable reason rather than dropping the signal.

Generate both projections from the same frozen inputs with the existing plating engine. Rotation is computed with dated overrides disabled. Every effective dated entry is computed for its **explicit date**, even if another occurrence of the same week/day is nearer. Never mutate the live menu/registry while building either projection. Exceptions affecting a slot make that slot unavailable; they do not silently certify fallback section math or invent component quantities. Preserve the intentional difference between section totals and `_components`, including separate anaphylactic meals. Do not reconcile them.

No `validUntil` timestamp is needed to misrepresent a rotating service. The projection is valid for its stamped input/calendar identity and bounded verified cache, subject to observed supersession. A dated key authorizes exactly that date. On the next cycle the consumer uses valid rotation for the new date; it never carries the expired override to another occurrence. A fresh HTTP/CDN timestamp cannot extend a dated key's applicability.

## Consumer resolution and refresh

A consumer retains a candidate set separate from its displayed/history set. A new request generation is monotonically incremented locally. An authoritative receipt observed by the active generation immediately records its component identities and invalidates any affected prior quantity certification, **before** the remaining files arrive. This includes a routing-first receipt: later routing B with stale A menu/registry companions invalidates certified A before the mixed candidate is rejected. Treat `_meta.flow` on routing as an authoritative occurrence witness from DOOR even though its counts remain derived and require coherence. A conservative site-wide invalidation is allowed where an aggregate digest cannot locate a narrower impact. The old board stays readable as historical information; notes, overrides, completion and stock remain untouched.

Promote only a complete coherent candidate: valid receipt structure and algorithm, matching site/calendar, equal receipts across required files, matching recomputed menu/dated digests, valid new routing representation and compatible source state. Promote all relevant globals together, never new menu with old certified routing. A roster-only receipt change must update certified counts when matching routing arrives even if menu words and schedule sidecar version remain equal.

Discard callbacks from an older request generation. Retain the highest observed authoritative publication sequence in the accepted epoch so a later stale CDN/cache response cannot recertify a publication already observed as replaced. Never compare digest strings/schema versions/export wall-clock times to decide which content is newer; the validated publication sequence is the ordering witness. All required receipts agree in both occurrence and content. A new request may recover when matching receipts for that occurrence or a later one arrive, including legitimate restoration of older content. Cache restore carries the original observation age and the highest observed occurrence; re-reading a cache cannot renew either. Unknown initial legacy metadata yields unverified counts with usable menu information.

At every use of a count, recheck requested service date, calendar basis, cache age, known supersession and candidate receipt. Preserve existing HUB's seven-day maximum offline routing cache as an upper bound; EXPO must adopt an explicit bound no weaker than that. This bound is not a guarantee of service applicability, and known supersession overrides it immediately. A verified live fetch can refresh the observation age of its coherent content, but cannot refresh its dated scope. Unknown cache age is unavailable for quantities. Query use must not mutate/acknowledge staff records.

For a service lookup, use `dated[date][meal]` when present and valid; otherwise use the matching valid rotation week/day/meal. An explicitly unavailable applicable override cannot fall through to baseline: it is evidence that this service differs and its counts are unknown. A removed override returns rotation only from the new coherent revision, not an old projection that predates the removal. An invalid calendar, absent rotation slot, failed source comparability, expired cache or known newer receipt returns `{status:'unavailable', reason, counts:null}`. It never returns 172, an old certified count or a fabricated zero. A valid zero remains zero.

## Service references shared with F3a/F3b

Each consuming card carries `serviceRefs` as an array. A reference is `{site,date,week,day,meal,component,recipeId,portionBasis}`. `date` is civil ISO date, `week` is `"1"`–`"4"`, `day` is the uppercase calendar day, `meal` is breakfast/lunch/dinner and `component` is the exact canonical component key produced by the engine. References resolve against the receipt's calendar and the service date, never the prep/cook date. The card separately records `inputRevision`/calendar identity in its flow provenance.

`recipeId` and `portionBasis` are explicit compatible facts from F3a, or null/unknown. A count can be a valid routing fact without authorizing recipe scaling when these are unknown. F3b owns the additional portion-basis conversion check. Deduplicate the same consumer contribution across prep/cook/send phase cards; distinct service dates remain distinct contributions. A same-label recipe rebind must not inherit a former recipe's identity or quantity. Do not replace an explicit unresolvable identity with a fuzzy dietary variant.

## Proposed gates and boundary of this draft

The non-adapter gate executes the actual inline block between `/* HOUSE_TESTABLE_CORE_START flow-validity */` and its matching END marker in each app. It is a ported small algorithm, not a runtime shared-module dependency. Its agreed seams are:

| Function | Contract |
|---|---|
| `await houseFlowReceipt(inputs)` | Content-only receipt (`schema,inputRevision,components,calendar`) from `{site,menu,dated,registry,recipe,calendar}`; publisher later attaches `publication`. Inputs are frozen values, never globals. Canonicalization excludes root export/check/cache metadata and normalizes the explicitly set-like registry collections. |
| `houseFlowCreateState({maxAgeMs,snapshot?})` | New local candidate/observation state; optionally restores highest observed publication and original observation ages from its own snapshot. No staff-record state. |
| `houseFlowBegin(state)` | Advance local request generation and return its identifier. |
| `houseFlowObserve(state,generation,receipt,{family,site,source})` | Observe a receipt from `menu`, `overlay`, `registry` or `routing` (`source:'live'`), immediately invalidating certification on known later authoritative publication. A cache/old-generation callback cannot invent authority. Family is separate from the receipt. |
| `await houseFlowPromote(state,generation,candidate,{now,source,observedAt?})` | Validate/promote the complete `{menu,overlay,registry,routing,swaps,reverted,specials,removed}` candidate atomically, returning boolean. `source:'cache'` requires the original numeric `observedAt`; it never substitutes `now`. JSON inputs are not mutated. |
| `houseFlowResolve(state,{site,date,week,day,meal},now)` | Return `{status:'valid',counts,...}` or `{status:'unavailable',reason,counts:null}` after use-time validity checks. It returns routing facts; it does not enable recipe scaling. |
| `houseFlowSnapshot(state)` | Serializable observation/cache metadata sufficient to preserve known supersession and original age across restart; consumed only by `houseFlowCreateState`. It does not include or alter staff records. |

Missing implementation is an expected red test, not a skip. A green core alone cannot complete F4: real DOOR projection construction, expected-head publication sequencing, EXPO/HUB refresh wiring and quantity consumers still require independent actual-path gates before build/release acceptance.

Gate fixtures contain invented residents, recipes and staff records only. Actual producers/readers must execute; an independent oracle checks results rather than reimplementing the production resolver as the expected answer.

1. Canonical receipt: serialization key order and export/check time change nothing; resident discharges, anaphylactic membership, whole-meal binding, recipe override, real removal and calendar changes alter identity. Missing/ambiguous recipe information stays explicit. Public output contains no resident fields or per-resident digest.
2. Real DOOR projection: baseline 148 → six discharges → 142; separate rotation and dated sausages; special beats swap; revert restores Arroz fixture Regular 159 / Vegetarian 11; later occurrence of same slot remains date-specific; all-zero cohort is valid, engine exception unavailable.
3. Pure consumer contract in both EXPO/HUB: use exact date, week 4→1, midnight/DST, expiry with DOOR closed, incompatible basis, missing base, unavailable override and unknown legacy metadata. Preserve `_components` versus section differences.
4. Applying fetch simulator/browser: coherent A; registry/removal B arrives first and immediately invalidates A; matching B restores without staff action; reverse response order and late A cannot recertify. Roster-only change succeeds with unchanged menu/schedule version. Offline age is evaluated when used; new fetch time cannot renew an expired dated override.
5. Product paths: EXPO prepublish/focus refresh obtains routing/receipt/maps; HUB boot/focus/retry does likewise. Intercept actual fetch calls, verify cache bust + no-store, bounded/coalesced generations and atomic promotion. No dependency on sibling checkout during CI; carry paired synthetic payload and run optional emitted producer payload in the integration receipt.
6. Regression boundaries: existing F2 whole-meal/decision-history gates and frozen-stock parity stay green for coherent counts. Unavailable quantities preserve notes, overrides, completions and stock; old/new and rollback keep readable boards unscaled. No silently widened optional skip.

After paired agreement, freeze a small contract fixture and test interfaces before adding product implementation. Root approved the receipt/projection/generation/date shapes subject to independent contract review; F3a agreed the recipe-vector fields above. Separate non-adapter gates from the still-unactivated portion adapter so a correct routing count cannot accidentally enable scaling.
