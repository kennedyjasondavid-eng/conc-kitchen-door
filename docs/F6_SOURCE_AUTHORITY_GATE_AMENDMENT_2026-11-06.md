# F6 source authority amendment

Independent gate-author amendment, frozen before the source parser correction. No product edits.

The actual F4 completed-build wire uses `_menuSource: 'live'` or `'cached'`. Imported/manual work can carry old copied flow metadata, which is the authority gap F4's completed-build capability closed. DOOR must require the same valid source in addition to the exact capability/full receipt pair. A test scenario name such as `rebuilt` is not a protocol source value.

The original `tests/browser/menu_flow_f6_delivery.mjs` is archived unchanged at `docs/reviews/gates/menu_flow_f6_delivery_before_source_amendment_2026-11-06.mjs`, SHA256 `e6f706396149bd36087f3ea9a003d94bd455196fc6567e34acdc587ecaeeec5db`. The amendment changes only fixture `_menuSource`: `rebuilt`, `rebuilt-roster`, `stale-build` and `wrong-publication` scenarios now emit `live`. This also keeps stale/wrong-publication proof cases independent of source refusal. **All original 27 assertions remain unchanged.** New gate SHA256 `e82e7bf733cf555678607e4fc490266fa2072e5dde46e27c38ca182597c5f476`.

New supplement `tests/browser/menu_flow_f6_source_authority.mjs`, SHA256 `7d802a708f2f1c6622d64e13c8598f4d2f0951c842d4424ca7f861d20dacf188`, supplies a valid copied attestation/full flow to seven actual publisher/anonymous-reader cases. `live` and `cached` may prove consumption. `imported`, `manual`, missing, `rebuilt` and `unknown` must remain unconsumed. Serving proof is independently retained; each case verifies one content commit, no unauthorized writes and no browser errors.

Frozen pre-repair candidate SHA256 `1205b4b0825cd040ce179a2daeb847168bd1e75fcea2629a1285d58f9243d210`, copied to `%TEMP%/door-ci-audit-20261106/f6-source-authority-red-1205.html`. Independent baseline **14 checks: 9 pass, 5 expected red**, one false consumption result for each disallowed source. Log `%TEMP%/door-ci-audit-20261106/f6-source-authority-red.log`. `HOUSE_FLOW_HTML` pins that source; the gate uses the existing applying remote simulator and intercepts every network request. It does not publish to GitHub or contact live EXPO.

Both revised files are copied byte-identically into the `delivery` implementation worktree. The frozen F6 dedupe/recovery gates and all retained F1/F4 gates are untouched. The release gate author reviews this fixture delta separately; product clearance requires the repaired source and combined verification.
