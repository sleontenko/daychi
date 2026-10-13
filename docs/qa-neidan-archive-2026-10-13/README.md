# Drive archive article delivery

The archive uses structured articles with sections, contextual concept mentions and direct links to related articles. Drive evidence links open the original file; displayed fragment times refer to decoded PCM and do not imply a seek-capable Drive player. Machine-text drafts explicitly disclose that audio has not been listened to.

The new owner archive endpoint coexists with the existing YouTube article contract. Private source aliases, revisions, original hashes and diagnostics are retained in the source store; the public catalog exposes opaque material identities. No corpus is bundled in Git or the web bundle.

## Verification

- 181 backend tests and 17 shared JavaScript tests passed during implementation, including atomic source/article import, replay and immutable source lineage.
- The actual prepared server package was exercised through its HTTP routes with a synthetic temporary catalog and databases. Chrome checks covered archive categorization, headings and paragraphs, contents navigation, concept links and Back, direct related article navigation and Back, and the archive filter in Recent.
- Article views at 390, 768 and 1440 px had no horizontal overflow. Reference/runtime captures remain in the private archive QA directory and use the accepted Claude iteration 3 reference. Shared CSS and the accepted surrounding layout are preserved.
- The package overlays the verified production source package of deployment c964041f-096b-4c5c-bf05-8a068ea6cca9. All 51 unrelated production files remain byte-identical, including Android APK delivery, the website and retention/restore modules. Existing v1 article modules and both new archive modules are included in Docker packaging.

## Limits and publication

These checks establish synthetic web/runtime behavior, not recognition accuracy, teacher approval, actual Drive-file permissions, or native-app acceptance. Editorial and exact-batch review belong to Daychi Knowledge. No production deployment or archive import has been performed at this checkpoint; those results will be appended after execution.


## Production runtime checkpoint

The provider implementation was merged in Daychi PR #10 (adb4b76123d6d64337b9a2af7cb1735e6f2919fc) and deployed as afbaf3e1-cdf8-4d0e-b6a8-fbc5093c7eaf. Railway reported SUCCESS on 13 October. The live graph bundle matches the prepared SHA256 42bd08fc98a86c53554632637794e4b5ad73630a3d2b3e487de98b6a4d55e4d6. Existing owner inventory/status returned 200; an invalid empty archive payload returned 422 without an import. All 13 prior articles and 13 prior concepts were still present. Archive content had not been imported at this checkpoint.

## Coherent replacement and reader compatibility

Object fingerprints include the bundle's complete source/evidence/link envelope. Superseding one concept can deactivate its old bundle, so the publication candidate carries all objects of both affected prior bundles with explicit next editorial revisions. The corresponding source/content revisions remain unchanged.

A disposable local database was seeded with the exact two previously published bundles and their current owner source annotations. Importing the prepared 70-article/34-concept closure retained all 13 previous articles and 13 previous concepts; old article introduction, sections, related paths, link order, source identity and status matched exactly. Replay was idempotent. The new draft used an explicitly labelled local schema stub only: this experiment establishes runtime retention, not editorial review or publication permission.

The follow-up keeps YouTube article reader DTOs in daychi-wiki-articles/1 when stored in an archive bundle. Concepts supported only by legacy YouTube evidence also retain that format; Drive-supported pages report the archive format. Two synthetic replacement tests cover both cases. The full backend suite passed: 183 tests.

The owner source inventory now distinguishes an active Drive article from source registration through optional archive_article metadata. Tests cover active publication, a stale source deactivating its bundle, and an unused registered source in a coherent replacement; legacy inventory rows receive no new field. This supplies the Knowledge registry adapter with publication evidence without counting archive articles as legacy summaries.
