# DOOR — Kitchen DOOR

**Daily operational interface for Rexdale shelter meal service.** Part of the [HOUSE](https://github.com/kennedyjasondavid-eng/conc-kitchen-house) system (Hospitality Operations Unified System Engine).

Staff enter resident changes once (intakes, discharges, restriction updates) and the system generates all plating sheets, dietary labels, and support files in one run. Allergen conflicts and anaphylactic routing are checked automatically before service.

**Live app:** https://kennedyjasondavid-eng.github.io/conc-kitchen-door/

---

## For end users

### Daily workflow

DOOR's sidebar groups screens into **Daily Workflow** (the things you do every shift) and **Reference** (everything else).

| Screen | What it's for | When to use it |
|---|---|---|
| **Enter Changes** | Add today's intakes, discharges, restriction updates | At the start of each shift, or any time a resident changes |
| **Review & Generate** | Confirm your queued changes, then commit | After entering changes — generates labels and plating data |
| **Plating Sheets** | Printable per-meal sheets with names, allergens, dietary tags | Before each meal service |
| **Resident Registry** | Searchable list of all residents and their restrictions | When you need to look someone up |
| **Compliance Review** | Anaphylactic / restriction conflicts flagged for review | Whenever the orange badge appears |
| **Menu Config** | Today's active menu — edit/swap meals, see what's served | When the kitchen changes a meal late |
| **Meal Log** | Record leftovers / served counts after a meal | After every meal service |
| **Meal Service Overview** | Quick dashboard of recent service data | Anytime you want a snapshot |
| **Custom Reports** | Build and export filtered reports to xlsx | For audits, BoH reports, monthly summaries |
| **Settings** | Site, theme, push token, sync options | Rarely — see Maintenance below |

### Typical shift

1. **Open DOOR.** It loads with the most recent state from localStorage. Recipe data is fetched live from CODEX in the background — if you're offline, the baked-in snapshot takes over automatically.
2. **Enter Changes.** Intakes, discharges, restriction edits. Each one gets queued and shows a number badge on the sidebar.
3. **Review & Generate.** Review the queue, hit *Commit Changes and Generate Files*. This produces plating data and updates the registry.
4. **Plating Sheets.** Print the sheet for the upcoming meal. Allergen conflicts get a red highlight — handle those first.
5. **Service happens.** After the meal, jump to **Meal Log** and record served counts / leftovers.
6. **Push.** Double-click `KitchenDOOR_Push.hta` to publish your changes to GitHub so the rest of the HOUSE system sees them.

### Common questions

**"It says 0 residents / blank menu."** → You're offline and the snapshot didn't load. Hard-refresh (Ctrl+Shift+R). If still blank, check the console (F12) for fetch errors.

**"I queued a change but the registry didn't update."** → You must hit *Review & Generate* and commit. Changes are queued, not live, until you commit.

**"A resident shows as anaphylactic in red."** → Compliance Review will tell you exactly which menu item conflicts. Either swap the meal in Menu Config or note the restriction on the plating sheet.

**"Push HTA says 'not found'."** → Git probably isn't installed on this machine. Get it from [git-scm.com/downloads](https://git-scm.com/downloads), keep all defaults.

**"Authentication failed on push."** → GitHub token expired. Generate a new one at [github.com/settings/tokens](https://github.com/settings/tokens) and paste it when prompted.

### Anaphylactic and dietary safety

DOOR's central job is to make sure no one eats something that hurts them. The compliance engine works on an **exclude-array** pattern — each resident has a list of excluded ingredients/allergens, and any menu item containing one of those flags the resident.

Critical safety rules baked in:
- **Anaphylactic flags can never be silently overridden.** They appear in red, require explicit acknowledgement.
- **Halal / vegan / vegetarian streams are matched against the recipe's stream tags** (from CODEX). If a recipe's stream doesn't match a resident's diet, that resident gets the appropriate alt meal automatically.
- **Allergen data comes from CODEX** (`DOOR_RECIPE_DATA.json`). If you see allergens missing for a recipe, fix it in CODEX, not in DOOR.

---

## For maintainers

### Files

| File | Role |
|---|---|
| `index.html` | The entire app — ~17.5K lines, single-file HTML/CSS/JS |
| `door_state.json` | Snapshot of the live state (residents, restrictions, queue) |
| `menu_current.json` | The active menu — consumed by EXPO |
| `menu_reno.json` | Reno-mode menu (4-week, LAN routing) — consumed by EXPO |
| `menu_overlay.json` | User-edited menu deltas applied on top of `menu_current.json` |
| `routing_by_meal.json` | Per-meal resident counts by section (halal/regular/vegan) |
| `registry_summary.json` | Snapshot of the resident registry |
| `meal_swaps.json` | Late meal swaps logged by date |
| `recent_log.json` | Tail of recent intake/discharge events |
| `learned_nr.json` | "Not Recognized" name patterns the system has learned |
| `custom_tag_rules.json` | User-defined custom tag rules |
| `special_meals.json` | Special meal events (birthdays, holidays, etc.) |
| `KitchenDOOR_Push.hta` | Windows applet for git push — auto-detects home/work path |
| `push-log.txt` | Tail of recent push activity (debugging) |
| `favicon.ico` | Site icon |
| `docs/` | LAN reno booklet (.docx), reference scripts |

### Architecture

- **Single-file HTML.** All CSS and JS inline in `index.html`. No build step.
- **localStorage is the live state.** Everything in the sidebar's *Residents* count, the queue, the registry — backed by localStorage. JSON files in this repo are *snapshots* the push writes for the rest of HOUSE to consume.
- **Screens are tabs, not routes.** All UI is rendered up-front and toggled by `showScreen()`. `data-screen` attribute drives visibility.
- **Recipe data is fetched live from CODEX** on load (`DOOR_RECIPE_DATA.json` from the recipe-hub Pages site). A baked-in snapshot is the fallback for offline / fetch failure.

### Where to find common things in `index.html`

| What | How to find it |
|---|---|
| Sidebar nav | Search `class="sidebar-nav"` (~line 765) |
| Screen markup | Search `<div class="screen"` for each screen block |
| Show/hide screens | `function showScreen(` |
| Compliance engine | Search `anaphylactic` or `excludeArray` |
| JSON snapshot writers | Search `_meta: { source:'KitchenDOOR'` |
| Recipe fetch + fallback | Search `DOOR_RECIPE_DATA` |
| Push integration | Search `KitchenDOOR_Push` in HTA file |
| Theme / dark mode | Search `data-theme="dark"` (early in style block) |

### Data contracts

DOOR is the **menu source** for EXPO and the **resident source** for everything else.

| Published file | Schema | Consumer |
|---|---|---|
| `menu_current.json` | `{ _meta:{...}, weeks:[...] }` with `version` incrementing | EXPO `loadMenuFromDOOR` |
| `menu_reno.json` | Same shape; reno-mode 4-week | EXPO when `scheduleMode = reno` |
| `routing_by_meal.json` | `{ [meal-key]: { halal, regular, vegan, total } }` | EXPO portion math |
| `registry_summary.json` | Resident counts + tier summary | (informational — not currently consumed) |

If you change one of these schemas, update the consumer in the same change set, or stage carefully via menu overlays.

### Push workflow

```
1. Edit residents / menu / restrictions in the app
2. Click Save (writes localStorage)
3. Click Sync (writes door_state.json, menu_current.json, etc.)
4. Double-click KitchenDOOR_Push.hta
5. HTA detects path (home vs work OneDrive), runs git add/commit/push
6. GitHub Pages redeploys in ~60s
7. EXPO and other consumers see new data on next fetch / hard refresh
```

The HTA is a Windows-only HTML Application that wraps `git`. It auto-detects which machine you're on by checking the OneDrive path. Edit the HTA if paths change.

### Related apps

| App | Repo | Role w.r.t. DOOR |
|---|---|---|
| HOUSE | [conc-kitchen-house](https://github.com/kennedyjasondavid-eng/conc-kitchen-house) | Umbrella portal — links here |
| EXPO | [conc-kitchen-expo](https://github.com/kennedyjasondavid-eng/conc-kitchen-expo) | Consumes DOOR menu + routing |
| CODEX | [conc-recipe-hub](https://github.com/kennedyjasondavid-eng/conc-recipe-hub) | Provides recipe + allergen data |
| HUB | [conc-kitchen-hub](https://github.com/kennedyjasondavid-eng/conc-kitchen-hub) | Linked from sidebar — daily board |

### Versioning

DOOR is at v25+ (~17.5K lines as of 2026-05-12). Version markers appear in source as `[DOOR vN]` console logs and in JSON `_meta.version` fields (currently 30 in `menu_current.json`). There is no single `APP_VERSION` constant — versions are tracked per-feature.

### House rules

- **Single-file HTML.** No build tools, no npm, no frameworks.
- **localStorage is the user's data.** Architect changes via seeds; user edits via in-app.
- **Recipe data is owned by CODEX.** Don't fork it into DOOR.
- **Anaphylactic flags are sacred.** Never silently overridden, always surfaced.
- **Graceful degradation.** Works from `file://`. Fetch failures fall through to baked snapshots.

---

## Future — Phase 5

SharePoint integration via Microsoft Graph API is planned post-renovation. The app is structured so all localStorage-backed persistence layers swap to SharePoint calls in a single-function replacement per layer.

---

*CONC Bloor Catering Kitchen — Christie Ossington Neighbourhood Centre*
