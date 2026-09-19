# Design QA — вариант 1, 2026-09-18

Source visual truth: `design/approved/schedule-option1.png` (853×1844).
Implementation: iPhone 17 Pro / iOS 26.5 Release, 402×874 pt;
optimized screenshots 368×800. Native status bar/safe areas are not app content.
Comparison is of content regions, not a pixel-identical phone frame.
The source is an illustrative 17 September view; the app correctly shows the
current 18 September schedule. Real names, locations, past states and row counts
are retained; the concept name is not copied into product navigation.

## Pass 1

Source and native screenshots opened in the same comparison input. Full view and
readable row/detail regions reviewed: system typography, grouped day surfaces,
time column, separators, soft selection with checkmark, filters and tab bar.
No raster art in the UI: the source's essential assets are native SF Symbols.
Flat cream is intentional; generated image texture is not a shipping asset.

- P2: Larger Dynamic Type clipped control labels in modes and filters.
  Fix: vertical control layout above fontScale 1.2; padded segments; large-size
  agenda uses vertical rows above 1.5; tab captions cap scaling at 1.2.
- P2: Format repeated the location's obvious in-person information and increased
  row height. Fix: show location plus Online only for hybrid, location alone
  for in-person; unknown format remains explicit.

## Confirmation

The first control correction still left intrinsic-width text clipped at XXXL;
the final fix stretches captions within their available control width. Verified
after rebuilding: full labels in `docs/qa-build5/large-type-ios.png`.

Final native captures: `docs/qa-build5/schedule-ios.png`,
`docs/qa-build5/class-detail-ios.png`, `docs/qa-build5/large-type-ios.png`,
all 1206×2622 pixels at 3× density (402×874 pt).
Source and final normal-size capture were opened together for direct comparison.
Readable full-resolution row regions show aligned time, metadata, selection mark,
separators, and no clipping. A separate crop was unnecessary at this resolution.

Typography: native system family replaces decorative numerals, 16pt row title,
14pt metadata. Spacing: shared rounded day surface and separators, no left date rail.
Colors: established flat cream, light rows, subtle sage choice, terracotta filter.
Assets: actual SF Symbols, no imitation raster chrome. Copy: school titles and
current Israeli dates preserved instead of synthetic image entries. More vertical
space than the image is needed for real locations, status and native safe areas.

Verified: both format filters (hybrid in both), detail open, selection, persistence
across rebuild/relaunch, one scheduled reminder, cancellation, normal and XXXL type.
Test selection removed; simulator font returned to its original Large setting.
TypeScript/lint and 14 JS tests pass. Runtime log checked, no matching Error/Exception.
Physical-device delivery, all extreme accessibility sizes and other iPhone sizes
remain unverified. App intentionally ships light appearance; no new dark mode claimed.
No automatic Impeccable verdict claimed: its local launcher cannot execute here.

No open P0/P1/P2 findings in the checked screen/state scope. Follow-up: verify on
the owner's phone before expanding the design to further product surfaces.

final result: passed

---

# Wiki design QA — 2026-09-19 (local web implementation)

Source: `apps/practice-app/design-reference-wiki.jpg`, 402×874.
Implementation: http://localhost:8082, Chrome viewport 402×874, authenticated
wiki catalog. Reference and implementation screenshots were opened together
in a single comparison input in this task. Compare app content, excluding the
source's drawn device status bar. Private catalog captures remain inline in the
task and are not committed as public repository assets.

P2 corrected: oversized title and two prominent filter rows displaced cards.
Restored the original title, 20pt margins, 16pt section gaps, pill search and one
horizontal chip row. Extra controls moved behind a labelled settings button.
P2 corrected: cards lacked the reference metadata hierarchy. Restored top badge
and date, 18pt heading, 13pt subordinate text, 16pt corners and 10pt card gaps.

Intentional data differences: actual archive categories instead of unverified
term/practice/lecture types; source subtopics instead of mock definitions; actual
publication dates instead of fabricated relative update dates. System typography
follows the approved build-5 rules. 44pt chip hit areas are taller than the mock.
Existing bottom navigation is preserved, including My Classes instead of mock Map.
No raster assets needed; search/settings use the existing Expo Symbols library.

Verified in browser: login, query (131 results for the tested topic), category
(129), subtopic selection, material detail, return and saved-only list. Clearing
search works with keyboard select-all/backspace. No browser console errors.
TypeScript and Expo lint pass. Native iPhone rendering and large Dynamic Type
of this revision remain unverified; prior native evidence is not reused here.
No open P0/P1/P2 findings within the checked web catalog scope.

final result: passed

## Native follow-up — build 6 preparation, 2026-09-19

Actual iPhone 18 Pro Simulator / iOS 27 Debug rendering of the current source
was compared with `design-reference-wiki.jpg` in the same tool input. Screenshot:
`data/qa-build6/wiki-ios.jpg` (private, ignored; 368×800 scaled capture of
402×874 pt). Native safe areas account for vertical offset. Title, search,
filter strip, badge/date/title hierarchy, palette and card spacing are consistent
with the reference and documented real-data differences. No clipped catalog
labels at the checked default text size. Native login, persisted session after
stop/launch and Simulator restart, saved material and detail/return verified.
The password-save system prompt temporarily blocked automation; restarting
Simulator cleared it without saving credentials. CUA native pipe unavailable;
XcodeBuildMCP touch events with duration enabled the check.

Native visual check at default text size: passed. Extreme Dynamic Type and
physical-device delivery remain unverified. The separately signed device archive
is build 6; the simulator UI check above used the existing Debug runner, not an
installed TestFlight binary. Public HTTPS connectivity is a separate pending gate.

## Release + production endpoint confirmation — 2026-09-19

Release Simulator build 6 was compiled with explicit HTTPS build settings and
launched successfully. Verified the actual wiki endpoint in the intermediate JS
bundle (not merely presence of the shared schedule hostname). Login to production,
real catalog, session after stop/launch, saved-only filter and detail verified.
Source image and final Release screenshot were opened in the same comparison;
`data/qa-build6/wiki-release-ios.jpg` is private/ignored. Appearance is unchanged
from the checked Debug view. Production HTTPS integration gate: passed.
An initial simulator-only build omitted the wiki build setting; rebuilt with
explicit settings. The device archive had the correct setting from its first
successful build, confirmed independently in its intermediate JS bundle.

final result: passed

## Build 7 — closed beta without login, 2026-09-19

Reference: original `apps/practice-app/design-reference-wiki.jpg`. Actual Release
build 7 on iPhone 18 Pro / iOS 27 opens the existing catalog immediately; native
capture `data/qa-build7/wiki-release-ios.jpg` is private/ignored. Both images were
opened in one comparison input. Catalog composition is unchanged from build 6;
manual login and the settings logout action are removed as explicitly requested.
No new visual departure from the original wiki. Settings show 1145 materials;
previous saved bookmark remains. The signed archive includes a local catalog
provider with no wiki fetch/auth route, verified in the actual bundled code.
Source links retain their original online behavior. No claim of physical-device
verification or a repaired network/Funnel connection.

final result: passed

Additional build-7 behavior verification: local web catalog without a login form;
search/category «Веер» yields 129, junior subtopic 56, saved detail opens with its
original source link. Two offline-model tests cover normalization, pagination,
filters, sorting and unavailable bookmark IDs. No school login/password or session token is embedded; original material access
codes are part of the private snapshot distributed to the authorized beta group.

## Build 8 · Zoom details

Release iPhone 18 Pro Simulator / iOS 27: details match the existing approved
composition and theme, with a new connection section using the existing outline
button. Jerusalem 18:00–20:00 and selectable passcode are visible.
Private evidence: `data/qa-build8/zoom-ios.jpg`; compared with prior detail
`docs/qa-build4/class-detail-ios.jpg`. No changes to map or learning sequence.
Physical device / installed Zoom handoff not verified.
