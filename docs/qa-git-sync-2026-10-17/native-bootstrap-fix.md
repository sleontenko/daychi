# Native wiki bootstrap correction — 17 October 2026

Post-merge release/source review found that the regenerated native reader inherited
`/api/wiki/graph?articles=1`, while the retained native bridge admits only the exact
`/api/wiki/graph` path. On the consolidated source this caused native initialization
to fail before showing the library. Installed historical TestFlight18 is unchanged.

Restore the native bootstrap to its existing plain graph request. Browser requests
retain semantics/articles opt-ins. The mobile bridge/public policy is not widened;
structured/native protected-content activation remains separate. Both UI bundles
are rebuilt. No design, account wire, release flags or build number changes.

Executed reproduction uses the actual generated native HTML plus actual TypeScript
publicWikiPath in a loopback HTTP fixture, with synthetic articles-v1 DTOs only.
Chrome showed the unavailable view before; its graph RPC mapped to null. Afterward
graph maps to /graph, the library loads, material/stable maps to /materials/stable,
and article→Back returns to the library. Reference/before/after/article/return JPEGs
and RPC journals remain in ignored local data/git-sync-2026-10-17/native-bootstrap.
This is native-JS/bridge evidence in Chrome, not an installed WebView/phone result.
The fixture does not substitute for app authorization or recording-redaction proof.

Existing app125/wiki30 tests, TypeScript and lint are run for this correction;
GitHub CI is recorded on its PR. No new native release or private corpus disclosure.
Full phone/iPad/Android UI/navigation QA remains required before the next binary.
