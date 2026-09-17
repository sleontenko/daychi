# Design QA — «Тихая практика»

- Source visual truth: `design-reference-today.jpg` (plus `design-reference-schedule.jpg`, `design-reference-map.jpg`, and `design-reference-wiki.jpg`)
- Implementation screenshot: `implementation-today-web.jpg`
- Combined comparison: `design-qa-comparison.png`
- Viewport: 402 × 874 CSS px
- Source pixels: 402 × 874 after normalizing the archive preview capture from 0.5× to 1×
- Implementation pixels: 402 × 874 at `deviceScaleFactor: 1`
- State: light theme, root «Сегодня» screen, no keyboard, no modal
- Platform normalization: the archive reference includes template-owned Dynamic Island/status bar/home indicator. The browser implementation capture contains only app-owned content. Native iOS safe areas remain enabled in the implementation and own that chrome on device.

## Findings

No actionable P0/P1/P2 fidelity differences remain in the app-owned content.

- Fonts and typography: Caprasimo and Figtree are bundled locally and match the source families, weights, hierarchy, wrapping, and letter spacing. The implementation capture is sharper because the source preview was normalized from a half-scale archive capture.
- Spacing and layout rhythm: 20 px page margins, 22 px section rhythm, 16/28 px radii, card padding, progress bars, and bottom navigation proportions match the source. The apparent vertical offset at the top is entirely the omitted template-owned status bar in the browser capture.
- Colors and visual tokens: cream ground, neutral cards, terracotta primary accent, sage secondary accent, divider opacity, and soft shadows match the source token file.
- Image quality and asset fidelity: the source has no app-owned raster imagery. Interface icons use Expo Symbols (SF Symbols on iOS) instead of drawn SVG/CSS approximations.
- Copy and content: headings, labels, dates, class names, progress, teacher/place metadata, and wiki summaries match the selected source state.

## Full-view comparison evidence

`design-qa-comparison.png` places the normalized source on the left and the 402 × 874 implementation on the right. Card widths, line breaks, controls, section order, color balance, and bottom-tab hierarchy align. The implementation deliberately excludes simulated device chrome.

## Focused region comparison

No additional crop was needed: both panels are 1:1 mobile captures and the practice card, next-class card, wiki update, and bottom tabs are legible in the combined comparison.

## Interaction verification

- Schedule tab opens and renders week rows.
- Day/week/calendar segmented control changes state; July 2026 calendar renders.
- Practice map opens and expanded stage content renders.
- Wiki filter/search returns «Форма 24» for the query `форма 24`.
- Primary journey «Продолжить → player → play/pause → Открыть конспект» completes.
- Browser console errors checked: none.

## Comparison history

- Pass 1: no actionable P0/P1/P2 differences in app-owned content; no visual fixes were required after the combined comparison.
- Pre-handoff P3 polish: semantic tag text now uses the source accent/sage foreground tokens, including cream text on the solid current-stage badge.

## Follow-up polish

- P3: capture a native Simulator screenshot once a simulator is already booted, to document final iOS safe-area and system-chrome rendering.

final result: passed
