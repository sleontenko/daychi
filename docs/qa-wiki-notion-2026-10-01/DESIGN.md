---
name: Дейчи — Web Library Candidate
description: Local Notion-style reading surfaces with Quartz wayfinding; not owner-accepted or published.
colors:
  paper: "#fbfaf8"
  ink: "#201e1d"
  control-ink: "#312d28"
  secondary-text: "#635e56"
  metadata: "#6b6359"
  placeholder: "#736b61"
  link: "#8c491a"
  divider: "#e9e6e1"
  input-border: "#d6d0c7"
  white: "#fff"
  navigation-active: "#efebe5"
  navigation-hover: "#f1eeea"
  row-hover: "#f3f0eb"
  filter-rest: "#f0ede8"
  filter-active: "#e6dfd5"
  selection: "#f0d9c3"
  action: "#985220"
  action-hover: "#7b421d"
typography:
  display:
    fontFamily: 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "clamp(34px,4vw,52px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-.03em"
  headline:
    fontFamily: 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "clamp(30px,3.5vw,46px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-.03em"
  title:
    fontSize: "23px"
    fontWeight: 600
    letterSpacing: "-.02em"
  row-title:
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  source-body:
    fontSize: "17px"
    lineHeight: 1.8
  navigation:
    fontSize: "14px"
    lineHeight: 1.35
  metadata:
    fontSize: "13px"
rounded:
  control: "8px"
  search: "12px"
  row: "0"
  pill: "999px"
spacing:
  tight: "4px"
  small: "12px"
  medium: "20px"
  column: "32px"
  section: "36px"
  generous: "48px"
  rail-gap: "64px"
components:
  navigation-active:
    backgroundColor: "{colors.navigation-active}"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  search:
    backgroundColor: "{colors.white}"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.search}"
    padding: "0 18px"
  filter:
    backgroundColor: "{colors.filter-rest}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  filter-active:
    backgroundColor: "{colors.filter-active}"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  material-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "18px 4px"
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.white}"
---

# Design System: Дейчи — Web Library Candidate

## Overview

**Creative North Star: "The School Library"**

This is a source-derived record of the local 1 October 2026 candidate, not a new approved reference. The owner chose Notion for visual language and Quartz for structure. Reading surfaces use warm white, quiet neutral controls, compact material rows and direct labels that do not require technical wiki knowledge.

Scope is the home, recent-publication, catalog, search, empty-result and reader routes. `body.library-open` enables their shell; the existing graph remains its separate inherited Organic composition. This document does not supersede `../DESIGN.md`, authorize publishing or describe login/error screens as redesigned. Evidence: `../../practice_api/wiki_graph_web/graph.css`, `../../apps/wiki-graph/src/library.js`, `../../practice_api/wiki_graph_web/index.html`, `brief.md`, and the local `screenshots/` set. Desktop home was visually inspected during this extraction; other screenshots are QA evidence to be assessed by the finish review.

**Key Characteristics:**
- Warm paper and dark text, with brown links and focus indication.
- Flat ruled rows instead of elevated material cards.
- Quiet selected navigation and filter surfaces.
- Reading routes remain visually distinct from the existing graph.

## Colors

The palette is predominantly warm neutral; the existing deep terracotta is reserved for links and focus.

### Primary
- **Deep Terracotta** (`colors.link`): links, table-of-contents actions, caret and keyboard focus; inherited from the graph's accent-dark primitive.
- **Action Terracotta** (`colors.action`, `colors.action-hover`): corrected candidate-only filled actions with white text; the stronger brown is the hover state.

### Neutral
- **Warm Paper** (`colors.paper`): library route background.
- **Reading Ink** (`colors.ink`): inherited titles and material names; **Control Ink** (`colors.control-ink`) is the explicit search, selected-navigation and section-link color.
- **Quiet Text** (`colors.secondary-text`) and **Metadata** (`colors.metadata`): introductions, sidebar labels, dates, categories and counts. Placeholder text has its own slightly lighter neutral.
- **Soft Divider** (`colors.divider`): horizontal row rules and the reader contents separator. Search uses the stronger input-border primitive.
- **Navigation / Filter Surfaces**: separate resting, active and hover neutrals describe state without adopting the graph's cream or sage surfaces.
- **Warm Selection** (`colors.selection`): selected reading text.

**The Reading Scope Rule.** Apply this candidate palette only to library routes; do not recolor the graph with it.

## Typography

**Display Font:** Figtree with system sans-serif fallbacks.
**Body Font:** the same family; the source loads local regular, semibold and bold font files.

**Character:** clear sans-serif reading typography. Emphasis comes from weight and spacing, without a second display face.

### Hierarchy
- **Display:** homepage heading, centered on desktop; mobile uses a left-aligned size (34px).
- **Headline:** catalog, recent and article page headings.
- **Title:** section headings, reducing on mobile (22px).
- **Row Title:** material names, followed by smaller date/category metadata.
- **Body:** introductions with a measure (65ch); source descriptions use the more open source-body role. Articles have a maximum measure (72ch).
- **Navigation / Metadata:** compact route labels, counts, dates and reader contents.

**The Single Voice Rule.** Use the loaded Figtree family across reading headings, controls and body; fallbacks are resilience, not an additional display identity.

## Layout

The desktop shell has a maximum width (1480px), horizontal padding (32px), a sticky rail (232px), and a generous gap (64px). The reading main is capped (1040px). Rail position is (28px) from the top, with independently scrollable height `calc(100dvh - 56px)`.

At widths at or below (1100px), the rail reduces (190px), the gap reduces (36px), and reader contents moves above the article. At or below (760px), the shell becomes one column with side padding (20px), top safe-area-aware header padding and bottom safe-area-aware content padding. Navigation wraps horizontally; sections become a native expandable list. At or below (540px), catalog filters retain the inherited horizontal overflow behavior.

Material lists remain one column. The section overview has two columns with a gap (32px), becoming one column on mobile. Search has a maximum width (720px). Reader layout places the article first and a contents rail (180px) to its right with a gap (36px). Mobile contents wraps above the article. These are source observations, not claims of completed responsive acceptance.

## Elevation & Depth

Library lists, search, sidebar navigation and reader contents have no shadows. Neutral state backgrounds, thin dividers and whitespace establish depth. Existing login/error cards and graph surfaces retain their own shadows outside this candidate's scope.

**The Flat Reading Rule.** Use separators and tonal state surfaces for reading navigation and material rows; do not inherit the graph stage's elevation onto them.

## Shapes

Navigation and filters have gently curved control corners; search is a slightly rounder rectangle. Material rows and reader contents are square and flat. Thin rules separate content; material dots from the preceding candidate are hidden in the reading list. Existing action pills are carried by inherited source styles and are not a new library shape standard.

## Components

### Navigation
Quiet text links with generous vertical padding. The current route uses a neutral filled background and semibold ink; hover uses a separate neutral surface. Keyboard focus uses the shared brown outline (2px) with offset (3px). On mobile the main routes wrap while sections use native disclosure.

### Inputs / Fields
Search is a white bordered container, with an inline SVG magnifier and a transparent field. The field preserves its own accessible label. Desktop input padding is (18px 0), reducing to (16px 0) on mobile. Focus is drawn around the enclosing search container, not the field; placeholder opacity remains full.

### Chips
Catalog filters are neutral rectangular controls with soft corners. The pressed state uses a deeper neutral and semibold text. They inherit the global visible focus outline; no explicit filter hover transition is defined.

### Cards / Containers
Material containers are actually linked rows: transparent at rest, thin lower divider, muted hover fill, no radius or shadow. Names wrap; date/category metadata sits below. Section links repeat the ruled-row pattern, with counts at the opposite edge.

### Buttons
Reader, retry, reset and pagination actions retain the preceding implementation's button vocabulary. Candidate-only filled buttons now use the corrected action and action-hover colors with white text, semibold type (14px) and padding (10px 18px). Their inherited pill shape is recorded for reproduction, not recommended as the shape for new reading components. Back is a text button with a minimum height (44px). Table-of-contents buttons use the brown link color and minimum height (44px).

### Reader Contents
Desktop contents is sticky, transparent and separated by a left rule; at the intermediate breakpoint it moves above the article and switches to a bottom rule. The contents actions remain text buttons rather than cards.

## Do's and Don'ts

### Do:
- **Do** keep the reading palette scoped to library routes.
- **Do** use ruled material rows with compact date/category metadata.
- **Do** preserve visible keyboard focus and the search container focus treatment.
- **Do** retain the one-family type hierarchy and mobile reading measures.

### Don't:
- **Don't** treat this local candidate as owner acceptance or publishing permission.
- **Don't** extend the library's flat-row styling into the existing graph.
- **Don't** introduce a second visual world from Quartz; its role here is wayfinding structure.
- **Don't** promote the inherited pill silhouette or literal arrow glyphs as the shape or icon standard for new library primitives; these remain recorded exceptions for finish review.

## Acceptance and publication — 1 October 2026

The owner accepted this as the first web-wiki version and explicitly authorized
publishing. Railway deployment `9f7eeca7-ea24-4015-9475-73b2b5176f6c` succeeded.
The source-derived candidate record above describes the pre-publication extraction;
the current approved scope is the reading surface described here. Detailed
deployment checks and remaining QA limits are in `README.md` beside this file.
