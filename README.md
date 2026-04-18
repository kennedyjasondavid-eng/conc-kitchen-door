# Kitchen DOOR

Daily operational interface for Rexdale shelter meal service — part of the DOOR system (Data Operations, Outcomes & Reporting).

Staff enter resident changes once (intakes, discharges, restriction updates) and the system generates all plating sheets, dietary labels, and support files in one run. Allergen conflicts and anaphylactic routing are checked automatically before service.

**Live app:** https://kennedyjasondavid-eng.github.io/conc-kitchen-door/

---

## Related Apps

| App | Repo | Description |
|---|---|---|
| Production Hub | [conc-kitchen-hub](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub) | 4-week scheduling, cold-chain logistics, driver dispatch |
| Recipe Hub | [conc-recipe-hub](https://github.com/kennedyjasondavid-eng/conc-recipe-hub) | Recipe management, production cards, allergen data |

---

## Files

| File | Notes |
|---|---|
| `KitchenDOOR_v19.html` | Single-file app — open directly in browser |

Recipe data (`DOOR_RECIPE_DATA.json`) is loaded live from the Recipe Hub at startup. If the fetch fails (offline, local use), the app falls back to an embedded snapshot automatically — no user action required.

---

## Local Use

Download `KitchenDOOR_v19.html` and open it in any modern browser. No server required. All data is stored in browser localStorage.

---

## Phase 5

SharePoint integration via Microsoft Graph API is planned post-renovation. The app is structured so that all localStorage-backed persistence layers swap to SharePoint calls in a single-function replacement per layer.

---

*CONC Bloor Catering Kitchen — Christie Ossington Neighbourhood Centre*
