# Structured wiki articles · 11 October 2026

Prepared implementation and private reader candidate for the same three articles,
following the owner's rejection of flattened v1 prose. Runtime provides atomic
source-pinned article/concept objects and opt-in projections. The shared reader
renders ordered sections/paragraphs, contextual concept links, compact evidence
navigation and direct reviewed related articles. Existing summary/material IDs,
access, graph behavior and accepted Claude iteration3 design are retained.

The provider models/schema/shared synthetic packet are documented in
[the contract](../contracts/wiki-articles-v1.md). Knowledge owns editorial validation,
coordinator reservations/independent review and the importer. Daychi owns storage,
API, reader and UI QA. [Daychi PR9](https://github.com/sleontenko/daychi/pull/9),
[Workshop migration9](https://github.com/dveyarangi/xuanxue-workshop/issues/9).

## Executed checks

- Backend full suite149pass; includes strict ranges/references, Unicode astral spans,
  atomic source/catalog/revision rejection, aliases/retained whole pages, immutable
  history/no-op dates, source-change hiding/replay, owner Origin/CSRF and private/public
  access. Owner-only source inventory preserves source pins for current reservations.
- Shared web15tests and bundle build pass; independent build reproduces exact assets.
  Knowledge 114tests and provider/consumer models/schema/common fixture checks pass.
  Independent implementation review reports no unresolved findings.
- Chrome uses the candidate API projections for all three actual reviewed articles
  and five complete concept pages. Exact DOM comparison verifies29paragraphs,
  13ordered headings,10exact spans/destinations,2direct related paths and absence of
  unsupported paths; concept11claims/13backlinks match the DTOs. Nothing is inferred
  from source title similarity or series order.
- Article→concept→Back, article→related→Back and reader→local graph→reader→Back
  exercised through actual controls. Desktop contents remains above the rail;
  mobile contents expands and links to real headings. Recent includes the new
  concept/article update entries. No horizontal overflow at360/390/768/1024/1440.
- Synthetic390pxstates: loading,404 legacy summary fallback, concept unavailable,
  HTTP503 last-good article preservation and successful retry. These are controlled
  HTTP failures/delays, not a physical offline/native proof.
- Public recording protection from live deployment0d7b41bb is preserved. Public
  source IDs are omitted even inside editorial identities; references/graph IDs
  match the opaque mapping. Authorized source/time links are retained.

Private evidence: `data/wiki-article-extension/2026-10-11/ui-qa` contains exact DOM
records, screenshots and five paired accepted-reference/runtime captures. Editorial
payloads, proofs, full sources and source inventory stay outside Git. Synthetic
fixtures are the only committed content. The original failed-format publication
facts remain historical.

## Release state and limits

Production baseline is0d7b41bb-499b-4143-bd06-d9b54d76aa79, not the older9October
release. Deployment must compose only reviewed wiki/API changes onto its exact
55-file stage, preserving site, APK, restore, retention and admission behavior.
No native/TestFlight build is part of this release. Actual post-import authenticated
production UI, owner final batch acceptance, receipt/replay and registry merge are
pending. The existing production Chrome tab currently shows invitation login; the
previous saved QA code was revoked. Do not mark those checks completed from local QA.

## Production runtime follow-up · 11 October 2026 UTC

Runtime deployed successfully as Railway `4605687f-4299-4eda-ac05-307ca29599b2`
at 21:00:46 UTC (12 October in Jerusalem), using source
`151cbdf73560cc94d1019873326d5efab721e1ae`. The isolated 58-file stage preserves 47
baseline files byte for byte; its manifest remains private. JS/CSS fetched over
production HTTPS match the stage exactly. Health is 200; anonymous owner inventory
and private article reads are 401. Article/concept storage is enabled and empty
before the separate editorial import. Opt-in graph nodes/edges/sections equal v1;
its `version` digest differs because it includes the capability flag.

Final independent review found and resolved a P2 in owner source inventory:
allowlist catalog/link fields and canonicalize hosts before excluding Zoom and
credential-bearing URLs regardless of their declared type. The full backend suite
now passes 150 tests, including the privacy regression; independent 23 article tests
and synthetic unsafe-URL checks pass. GitHub backend/app/wiki CI is green.

Existing owner credentials were found and used through the ordinary owner login,
then logged out. A fresh owner inventory matches 1350 registry rows, 476 source
summaries and 1428 excerpts, with zero registry/server disagreements; all six
article source pins match exactly. The saved QA invitation is confirmed revoked.
No replacement access or editorial import is inferred from this runtime release.
Exact-batch acceptance, import/receipt/replay, registry merge and authenticated
production reader QA remain pending.

## Publication completion · 12 October 2026 Jerusalem

The owner explicitly accepted and authorized modeled batch
`f57c0c3820d1c0bc1b28e16f1bf6234a932bdfdfed7d833ab5fe102bc5144384`
and temporary QA access. The ordinary owner importer published three articles,
five complete concept pages and 13 source links. Its saved first-write receipt and
replay confirm one batch, eight revision-1 objects and `already_imported=true` on
the repeat. Existing material IDs and source-summary revisions remain unchanged.

Production authorized and public DTOs for all eight objects match the accepted
packet exactly apart from server-assigned update times. Public recording IDs and
private audit fields remain absent. The coordinator read the complete owner
inventory after import and confirmed equality with the saved pre-import inventory:
1145 cards, 476 summaries and 1428 excerpts. This equality is coordinator-observed;
the separate final reviewer has no owner credentials or saved after-inventory copy.

Actual authenticated Chrome production QA at 1920×817 verifies all 29 paragraphs,
13 headings, 10 inline mentions, two direct article paths, five concept pages,
11 concept claims and 13 backlinks. Recent displays all eight updates. Real controls
exercise article→concept→Back, article→related→Back and concept→local graph→reader→Back;
there is no horizontal overflow. Production mobile viewport override did not apply:
responsive/error-state evidence remains the earlier local candidate check, whose
compiled assets match production. No physical-phone or native proof is claimed.

All four temporary QA invitations used for browser/API checks are revoked; the
browser returns to invitation entry and the local temporary secret file is deleted.
The registry merge changes only six dated notes and three row heights, preserving
all previous cell values, formulas, manual assignments, periods and other XLSX parts
byte for byte. Render was inspected; native Excel recalculation was not performed.
Preparation and publication assignments are now `verified` in the authority ledger.
Receipts, API/DOM checks, screenshots, registry backup and merge proof remain private.
Final independent read-only evidence audit passes: all eight live anonymous DTOs,
saved private DTO/DOM/receipt hashes and exact six-cell/three-height XLSX preservation
were checked separately. Owner inventory equality and invitation revocations remain
identified as coordinator-observed facts.
