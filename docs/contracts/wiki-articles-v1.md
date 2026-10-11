# Daychi structured articles · coexisting contract 1

Provider authority: Daychi. Consumers: Knowledge owner importer and the shared web
reader. This contract adds a separately requested article layer; it does not change
content v1, semantic v1, authentication, admission or Cabinet protocols. A mobile
binary without this capability continues to read its existing summary/points.

## Operations and access

- Owner `GET/POST /api/admin/wiki/articles`: status / atomic `ArticleBatch` import.
  Reuse existing owner session, same-origin/CSRF mutation dependencies and receipts.
- Reader `GET /api/wiki/articles/materials/{material_id}` and
  `GET /api/wiki/articles/concepts/{concept_id}`: existing authorized wiki session.
- Public equivalents under `/api/public/wiki/articles/`: same allowlisted reader
  objects only when the existing public-wiki setting permits public content.
- Existing graph and recent routes gain optional boolean `articles=false`.
  Only `articles=true` adds article update dates, reviewed concept nodes/edges and
  concept update entries where supported by the existing graph consumer.

`DAYCHEE_WIKI_ARTICLES_ENABLED=1` enables imports/reader capability; it is off by
default. Disabled or absent objects return 404. A client treats 404 as unsupported
or absent and uses the existing summary. Other failures show retry and retain
coherent last-good content; they do not silently certify legacy prose as an article.
Existing public flags and private authorization checks remain mandatory.

## Owner payload (strict objects, no extra fields)

`ArticleBatch`: `format: "daychi-wiki-articles/1"`, `batch_id` (ASCII identifier,
1–80), `sources`, `articles`, `concepts`, `links`, `evidence`, `review`.
Limits: 1–100 sources/articles/concepts each (concepts may be empty), 0–300 links,
1–1000 evidence windows. Strings are Unicode text, not HTML or executable markup.
Reader text must survive the existing privacy cleaning unchanged; credential-
bearing text/URLs are rejected rather than shifting inline offsets after cleaning.

| Object | Fields and bounds |
|---|---|
| Source | `resource_id` (YouTube 11-character ID), `material_id` (existing stable ID), `expected_title` (1–1000), `content_revision` (1–100000), `transcript_sha256`, `subtitles_sha256` (64 lowercase hex) |
| Evidence | `id` (1–160 ASCII identifier), `resource_id`, `text` (1–6000), finite `start_seconds` / `end_seconds` (0–100000, end > start) |
| Claim paragraph | `id` (1–160), `text` (1–6000), nonempty unique `evidence_ids`, `mentions` (0–30) |
| Inline mention | `start`, `end` (Unicode code-point offsets, 0 <= start < end <= paragraph length), `link_id`; ordered, nonoverlapping ranges; display the exact substring |
| Section | `id` (1–160), `heading` (1–200), ordered nonempty `claim_ids` |
| Article | `material_id`, `resource_id`, `revision` (1–100000), `status: "source_checked_draft"`, `introduction_claim_ids` (1–5), ordered `sections` (1–20), `claims` (1–200), `related` (0–20) |
| Concept | `id` (canonical lowercase slug, 2–80), `kind: "term" | "topic"`, `title` (2–200), `aliases` (0–12), `revision`, same draft status, `claims` (1–30) |
| Material→concept link | `id` (1–160), `resource_id`, `concept_id`, `relation: "explains" | "practices" | "discusses"`, `rationale` (1–1000), nonempty unique `evidence_ids` |
| Related article | `material_id`, `via_concept_id`, `supporting_link_ids` (exactly two), `reason` (1–1000); links must connect source and target through that concept |
| Review | distinct `editor` / `reviewer` (1–80), `editorial_sha256`, `review_sha256` (64 hex), `decision: "pass"`, `full_source_read: true` |

All identities are unique within their kind. Every evidence window belongs to a
listed source. Article claims cite only their article source; a concept may cite
multiple listed sources. Introduction and sections place every claim exactly once.
Every mention resolves to a link for that material and a retained concept. Every
link has evidence from its own source and supports a concept claim. Related paths
must be reviewed, non-self, and target a current catalog material. They are derived
navigation, not chronology or a stored new direct factual relation.

## Transactions, revisions and invalidation

All source pins are checked against unique catalog bindings and published content
payloads in the same SQLite transaction as the write. A missing/changed title,
source identity, content revision or transcript/subtitle hash rejects the entire
batch (409). No body/graph/concept partial publication.

Canonical concept IDs/types cannot be reassigned. Folded titles and aliases must
not collide across retained article-layer concepts or stored semantic-v1 concepts.
A concept update is a reviewed whole page preserving retained claims/links; the
importer never guesses alias merges. Historical unpublished Knowledge proposals
remain preparation inputs until their complete merged pages are reviewed.

The batch ID binds exact modeled bytes, including review. Reusing it with different
bytes is 409. Exact replay returns the same counts with `already_imported: true`,
without refreshing dates or reactivating stale content. The content fingerprint
excludes batch/review processing metadata but includes all text, order, mentions,
evidence, links and source pins. Identical content with identical dependencies is
a no-op across batches; changed content requires a strictly greater object revision.
Version history remains immutable. Existing summary revisions are not incremented
by article publication.

The stored bundle is read from one content/extension snapshot. Any catalog/source
pin change hides the dependent coherent bundle, including articles, concepts,
graph edges, backlinks and related paths. Whole-bundle hiding is deliberately
conservative for this first version. Revalidation/review and a new coherent batch
are required; an old receipt does not reactivate it. Private audit fields, source
hashes, reviewer identities and paths never appear in reader objects.

## Reader objects and rendering

Article response: `format`, `material_id`, `resource_id`, `revision`, draft `status`,
`updated_at`, ordered `introduction` paragraphs and `sections` (id, heading,
paragraphs), referenced `evidence`, concept-link metadata for inline mentions,
and `related` entries with target title/reason/shared concept identity.
Paragraphs expose id/text/mentions/evidence IDs; the client slices Unicode code
points and escapes every run. Concept links open the concept page, not graph.

Concept response: `format`, `id`, `kind`, `title`, `aliases`, `revision`, draft
`status`, `updated_at`, claims/evidence and material backlinks with relation,
rationale and source-time navigation. Graph nodes reuse `g:<concept_id>`; graph
edges aggregate retained link IDs per material/concept pair. The same link IDs
drive inline mentions, graph, backlinks and derived related paths.

Reader acceptance: short introduction, concrete section headings, meaningful
separate paragraphs, restrained emphasis and contextual clickable concepts;
compact source/time links; direct related-article transitions with reasons;
graph as a separate action. Contents anchors and Back preserve normal reader
navigation. Keep the accepted Claude iteration3 styling and graph behavior.

## Common conformance outcomes

1. Structured two-source fixture displays ordered paragraphs/headings, exact
   Unicode/astral-character mention ranges and a supported direct article pair.
2. Missing/overlapping mentions, unknown references, unsupported related paths,
   unsafe text and invalid time intervals fail validation (422), with no write.
3. Changed source/catalog/revision, conflicting alias/type or same revision with
   changed body fails atomically (409); v1 content remains unchanged.
4. Exact replay and an identical-content new batch preserve object dates/history.
5. Changed source hides all bundle projections coherently; replay does not restore
   them. Reviewed replacement succeeds only against current source pins.
6. Private anonymous reads are 401; public-disabled reads are 404. Public responses
   contain no owner audit/hashes/credentials. Capability cannot broaden access.
7. Default graph/recent/material v1 responses remain unchanged; opted-in graph,
   reader mentions, concept backlinks and related paths use matching identities.
8. Authorized UI exercises article → concept → Back, article → related article →
   Back, source/time links, contents, graph/return and failure/retry without losing
   query, scroll or state. Expected/runtime images are retained separately.
