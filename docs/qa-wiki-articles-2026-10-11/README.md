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
  Knowledge114tests and provider/consumer models/schema/common fixture checks pass.
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
