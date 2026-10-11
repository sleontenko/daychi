# Structured reader continuation · 11 October

This candidate applies the existing owner-selected Claude iteration 3 reader to
provider-authored sections and inline concepts. It does not replace the accepted
palette, layout, toolbar, source links or Sigma graph behavior. Examples and UI
fixtures are synthetic; production editorial data stays outside Git.

Entry: existing Recent/catalog card → article. The article has a short lead,
numbered concrete section headings, separate claim paragraphs, contextual concept
links and compact source-time links. Contents targets real section anchors.
Related entries open material readers directly and show the reviewed reason.
The graph remains the separate existing button. Concept pages show the definition,
source-time evidence and direct material backlinks.

| State / action | Result and recovery |
|---|---|
| Loading | Retain title/toolbar; show loading text in the body |
| Article capability absent / 404 | Existing summary and fragments reader |
| Article fetch fails / offline | Explicit retry; retain last-good article when available |
| Concept missing / source changed | Explain unavailability; Back and library stay usable |
| Session expired | Existing invitation login; no new admission protocol |
| Concept link | Open concept page; Back restores source article and scroll |
| Related link | Open target article; Back restores original article and scroll |
| Contents | Scroll to the selected actual heading |
| Source-time link | Existing external YouTube navigation |
| Graph / return | Existing local graph and preserved camera/reader scroll |
| Tab switch / return | Existing tab route, filter, query and scroll preservation |

Verify desktop and narrow widths, loading/404/error/retry, article/concept/related
returns and graph return against paired accepted-reference/runtime captures.
Actual editorial acceptance requires the same three complete articles and merged
concept pages; fixture checks alone do not establish production content QA.
