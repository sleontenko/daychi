# Drive archive articles · coexisting contract 1

Daychi owns this additive provider contract. Executable authority is
`practice_api/wiki_archive_models.py`; the generated owner schema is
`wiki-archive-articles-v1.schema.json` and the synthetic conformance packet is
`tests/fixtures/archive-article-batch-v1.json`. Knowledge mirrors the models and
performs full paired-text reading, exact quotation/provenance checks and independent
editorial review. This profile does not alter content v1, semantic v1, YouTube
article v1, access credentials or Cabinet admission. No source corpus belongs in Git.

## Payload and review scope

`ArchiveDocument` is preparation only. `ArchiveBatch` adds the existing mandatory
independent review envelope and uses `format: "daychi-wiki-archive-articles/1"`.
The paragraph/layout/mention/link/related-path constraints and limits of
[article v1](wiki-articles-v1.md) apply. Resource identities accept either the
unchanged 11-character YouTube identity or `drive:<10–200 ASCII safe characters>`.
Drive materials receive opaque 32-character lowercase hexadecimal catalog IDs.
Legacy source/article fields keep their existing authority and draft status; a
mixed whole-page supplement may retain them without fabricating archive origins.

Every Drive source has `archive` containing `collection_id`, metadata `cohort`
(`neidan`, `retreat2016`, `retreat2017`), all `aliases` (Drive identity, safe private
title, original SHA256 and byte count), `pcm_sha256`, finite `pcm_seconds`, original
`paired_asr_sha256: {turbo, parakeet}`, `provenance_sha256`, `quarantine_sha256`
and unique `source_warnings`. Aliases are pinned binary duplicates; the source
identity is their lexicographically smallest full `drive:` identity. Cohort names
are grouping metadata, not verified recording dates. The catalog says explicitly
that the recording date is unverified.

Optional `archive.corrected_asr` pins `full_text_sha256` and `model_ids` maps with
exactly two matching named keys, plus corrected `provenance_sha256` and
`quarantine_sha256`. For example, `turbo_auto` / `large_v3_auto` truthfully name
the actual models; a Whisper-large-v3 response is never labeled Parakeet. The
original pair and original lineage remain immutable. Canonical transcript/subtitle
pins may bind a reviewed corrected source without erasing that original history.

Drive evidence requires `admission` with `basis: "paired_asr_text_supported"`,
`source_basis: "original_pair" | "corrected_pair"`, a specific 30–2000 character
independent reason, nonempty unique `clip_ids`, original `source_warning_codes`,
`clip_warning_codes`, empty `unresolved_issue_codes` and `audio_verified: false`.
Source warning codes must match the source diagnostics exactly; evidence may not
exceed PCM duration. A corrected admission requires the pinned corrected pair.
No server hash check can establish meaning or clear quarantine. Knowledge must
verify the bounded passage against both complete texts and preserve all raw flags;
unresolved negation, garbled meaning, terminology or invalid timing cannot support
an admitted claim. Diagnostic disagreement alone does not establish an ASR error.

Drive articles and any Drive-supported concepts use
`status: "text_reviewed_asr_draft"`. Articles also require a meaningful
`coverage_note` describing omitted/limited coverage and text-only scope. The
review envelope's `full_source_read: true` means complete named ASR text reading
for this profile; it never asserts listening, audio accuracy or teacher approval.
Public prose and canonical concept slugs must not contain any private Drive alias
identity. Editorial IDs may embed one because anonymous projection hashes them.

## Registration, storage and access

Owner `POST /api/admin/wiki/archive-articles` reuses the existing authenticated
owner session, same-origin and CSRF dependencies. It atomically registers private
source pins and imports the coherent article/concept bundle in the article-owned
SQLite tables. Existing YouTube/catalog materials cannot be replaced by an archive
binding. The original catalog file and existing summary/point payloads are unchanged.
Owner `GET /api/admin/wiki/articles/sources` includes the exact registered source as
`materials[].archive_source`, only for the additive archive rows. It does not expose
Zoom credentials and is never a public or ordinary-reader inventory.

The overlay derives one catalog material per unique original and canonical Drive
links for all aliases. It participates in categories, catalog, graph and recent
navigation. Default graph receives the new catalog materials; article concept
edges/update dates still require the existing `articles=true` opt-in. The existing
`DAYCHEE_WIKI_ARTICLES_ENABLED` flag gates the archive capability too.

Source updates require a greater source revision and stable material ID. Original
alias byte pins, original paired ASR/provenance/quarantine, collection/cohort and
PCM lineage cannot change. Original aliases and inherited diagnostic warnings
cannot disappear. Corrected model pins may change in a reviewed higher revision.
Version tables retain all previous bytes. Article/concept revisions, retained
whole-page claims/links and canonical alias/type checks use the v1 rules. A failed
batch rolls back source registration as well as article writes. Exact replay is a
no-op and never reactivates a stale source. Source changes invalidate the entire
dependent bundle in every article/concept/backlink/related/graph projection.

Reader routes coexist with article v1. Authorized Drive evidence adds canonical
`source_url` and `time_basis: "pcm_clip"`. The link opens the Drive original;
the displayed PCM fragment time is a reference, not a fabricated YouTube seek or
a guarantee of Google Drive permission. Reader DTOs omit admission reasons, pins
and review metadata. Anonymous material and article DTOs omit all archive audio
URLs, Drive resource IDs and alias identities; even a mislabeled document link
cannot weaken archive recording protection. Ordinary existing public Drive
documents retain their policy. Opaque editorial IDs and graph references receive
the same existing anonymous hash mapping. Text, concepts and material navigation
remain available under the configured public-wiki policy.

The shared reader labels archive prose and concepts as machine-text drafts, with
audio not listened to, escapes all runs/caveats and preserves TOC, inline concepts,
related destinations and Back behavior. This implementation's synthetic checks
do not approve a real archive batch, authorize an import or establish audio/content
acceptance. Exact final content review, source binding and owner publication gates
remain Knowledge workflow responsibilities.
