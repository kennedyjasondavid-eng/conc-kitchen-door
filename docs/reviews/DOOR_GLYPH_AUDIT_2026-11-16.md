# DOOR glyph compatibility audit

Frozen review dated November 16, 2026. Request: audit incorrect or incompatible glyphs throughout DOOR, using the Review and Generate screenshot as the starting example. Application code and operational data remain unchanged.

Two display defects are confirmed: the review empty state deliberately draws a white square, and the menu change log displays an escaped arrow entity. Other symbols render in the tested Windows browser, but many depend on fonts outside DOOR's chosen typefaces. Those dependencies are portability risks rather than confirmed missing glyphs.

## Confirmed defects

| Priority | Location in index.html | Finding | Recommended correction |
| --- | --- | --- | --- |
| P2 | 1347 and 7479 | Both the initial review placeholder and the rendered empty queue use `&#x25A1;` (U+25A1 WHITE SQUARE). The screenshot is consistent with this intentional square. It resembles the box browsers show for an unavailable character, and conveys no useful empty-state meaning. | Remove the decorative square from both templates, or replace it with an inline SVG document/check icon. Keep the explanatory text. |
| P2 | 21804 and 21817 | `renderChangeLog()` sets the permanent-edit label to `&#x2193; Permanent edit`, then passes it through `escapeHtml()`. The browser displays the literal entity rather than an arrow. A synthetic permanent-edit record reproduced this in an isolated browser session. | Store the label as plain text, using `\u2193` or no icon, and retain `escapeHtml()` when rendering it. Do not bypass escaping to repair the arrow. |

The reproduced change-log text includes `&#x2193; Permanent edit`. The evidence file contains the synthetic record's rendered text and HTML. The first defect has two code occurrences; the second has one label definition and its escaping/rendering site.

## Font compatibility and icon consistency

| Priority | Locations in index.html | Observed dependency or inconsistency | Recommended treatment |
| --- | --- | --- | --- |
| P3 | 1087, 20136, 20252, 21970, 24755 | Five uses of U+FF0B FULLWIDTH PLUS SIGN, including the escaped form. The Arial/sans-serif probe uses Microsoft YaHei to draw it. Its width and alignment differ from ordinary `+`. | Use ASCII `+` consistently for Add controls. |
| P3 | 14927 and 16193 | U+24D8 CIRCLED LATIN SMALL LETTER I uses MS PGothic in the Arial/sans-serif probe. Font substitution controls its appearance and baseline. | Use an inline SVG information icon with an accessible label, or visible Help text. Preserve the explanatory tooltip content. |
| P3 | 1094, 1104, 1106, 1109, 1112, 1117, 1360–1363, 20483 and related print/report buttons | Mathematics and geometric characters act as application icons: squared minus for plating/printing, colon equals for Menu Config, fisheye for Meal Log, crosshatched squares for spreadsheets, diamonds, quadrant circle and circular arrows. Many use Cambria Math. They currently render but do not form a consistent icon vocabulary, and some have little connection to their function. | Replace decorative icon glyphs with a small embedded SVG set. Reuse the same icon for the same action. Keep visible text labels. |
| P3 | 1992, 2185, 2225, 21804, 24598, 24699, 24742, 25679 and other status controls | Test tube, printer, chart, celebration, coloured circles, rotating arrows and emoji checks depend on symbol/emoji fonts. The newer supplementary-plane symbols are particularly dependent on the target device's installed fonts. Other families of check, close, pencil and swap characters also vary across controls. | Use SVGs for interface decoration and one consistent check/close/edit/swap vocabulary. Keep action and status words visible; avoid relying on colour or the symbol alone. |
| P3 | 24885–24894, 25119–25145, 25370–25384, 25467 and print templates around 25810–25836 and 26263–26347 | Spreadsheet font presets request Calibri while safety/status strings contain warning signs, lightning bolts and circles. The browser Calibri probes require fallback fonts for these characters. Browser fallback does not establish how Excel or a particular printer will render a workbook. | Retain explicit ANAPHYLACTIC / Moderate allergy wording and the existing red treatment. Prefer text for exported safety labels; verify generated workbooks in Excel and actual print output before declaring cross-device compatibility. |

An explicit symbol/emoji fallback in the CSS font stack can make intent clearer, but cannot guarantee that another device has a particular glyph. Inline SVGs with `currentColor` avoid font dependency for interface icons, remain self-contained, and work offline. Do not replace accented names, punctuation, dietary text, or mathematical operators indiscriminately. U+2691 BLACK FLAG also acts as a sentinel in stored/log logic; a visual replacement must preserve those comparisons and stored values.

## Coverage and results

- Static scan: 40 tracked HTML, HTA, JSON, JS and CSS files, including all runtime HTML/HTA and published JSON snapshots. The remaining matching files include historical fixtures/receipts. The runtime JavaScript and CSS are inline in index.html.
- Encoding checks: all 40 files decode as UTF-8; no U+FFFD replacement characters, private-use characters, C1 controls or the searched common mojibake patterns were found. Decoded strings in all 37 tracked JSON files also contain no replacement characters, private-use characters, C1 controls or unpaired surrogate code units. KitchenDOOR_Push.hta declares Windows-1252 but currently contains ASCII only, so there is no present encoding mismatch there.
- Symbol inventory: 75 distinct non-ASCII code points from literal source, numeric HTML entities and JavaScript Unicode escapes. This is a conservative source inventory, including punctuation and comment-only characters, not a count of 75 interface icons. Surrogate-pair celebration emoji was tested as a complete code point; escaped line/paragraph separators used for safe string handling were excluded from visual probes.
- Browser census: 10 screens × 2 themes × 2 widths = 40 screen states. Enter, Review, Plating, Registry, Compliance, Meal Log, Reports, Custom Reports, Settings and Menu Config each opened at 1280 and 390 pixels. No page errors occurred. No raw entity strings were found in those standard screen states; the change-log defect requires the additional populated-log reproduction.
- Font probes: all 75 code points under sans-serif, Arial, Calibri and monospace = 300 probes. Chromium reported a platform font for every probe. The complete specimen was visually inspected; no additional missing-glyph boxes were observed. The U+25A1 box is the actual encoded character.
- Fallback breadth: 45 of 75 sans-serif probes used a font beyond Arial; 46 Calibri probes used a font beyond Calibri. This is evidence of dependency, not evidence that all those characters are defective. Actual fonts included Arial, Calibri, Courier New, Times New Roman, Cambria Math, Segoe UI Symbol, Segoe UI Emoji, MS PGothic and Microsoft YaHei.
- Custom report labels containing numeric entities go directly into HTML and render correctly. The permanent-edit log instead escapes its entity; HTML entities are not interchangeable with plain-text Unicode strings.

The browser run used isolated localStorage, blocked all HTTP(S), and opened DOOR through file://. It exercised the required offline fallback behaviour without touching the user's active resident state or publishing anything. Google DM Sans/DM Mono webfonts were unavailable by design. Other operating systems, installed-font combinations, native Excel and physical printers were not exercised. All generated-output templates were inspected as source; the Calibri probes test browser fallback, not Office rendering. Modal-only symbols are covered by the source inventory and specimen rather than an exhaustive walkthrough of every modal state.

## Recommended implementation order

1. Remove/replace the two empty-state squares and fix the permanent-edit plain-text label.
2. Standardize Add controls on ASCII plus; replace information and navigation/action symbols with a compact inline SVG vocabulary.
3. Replace remaining decorative emoji and mixed check/edit/close/swap variants. Preserve visible action labels, accessible names and stored sentinel values.
4. Check anaphylactic and moderate-allergy exports in native Excel and print. Preserve all safety wording and routing behaviour throughout.

## Evidence and provenance

- [Complete symbol specimen](DOOR_GLYPH_AUDIT_2026-11-16/symbol-inventory.png)
- [Font probes and browser receipt](DOOR_GLYPH_AUDIT_2026-11-16/evidence.json)

Audited local HEAD: `54b6c756fa33bf3869aabf45ed721fe11748877f`. Fetched origin/main: `5bcba1bb6fd81a73ee977b6f8e951dfb173115bd`. The local checkout was five commits behind after fetch. The index.html diff to fetched origin/main was inspected: it changes the app stamp and adds the anaphylactic summary publication logic; it does not alter the glyph findings above. Line numbers refer to local HEAD. Latest-main line numbers after the summary addition move later references down by 32 lines.

Local index.html SHA-256: `91871adf5d8e751cb5fed238a41239c211649ca7ce0a0a3c83c4fcd1f60e48a6`. Browser: installed Playwright Chromium on this Windows machine. Test date: November 16, 2026, America/Toronto. Input data: local door_state.json, menu_current.json and menu_overlay.json; fonts: the operating system's installed fonts. These artifacts record a review, not a release or a cross-app status change.
