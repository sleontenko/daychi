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
