# TestFlight 18: sanitized historical source review candidate

Prepared for [Workshop native issue 8](https://github.com/dveyarangi/xuanxue-workshop/issues/8#issuecomment-6182947110). Publication requires the Daychi operators explicit approval. This branch is an archival review candidate based on the documented release base, not a merge or deployment candidate for current main.

## Provenance and scope

The original 1.0.0 (18) archive used base `5f9ba442e04cd5dfa70527b9e670b491c491888c` plus a frozen uncommitted snapshot. All 390 frozen file hashes were independently checked against the original manifest on 15 October. Its SHA256 is `d22dbcf357e12622c2f47a15131906311be970ad9cae1adf256b75dd68a0fa8b`.

`export-manifest.json` maps 176 byte-exact exported paths to their original hashes and lists 214 exclusions with reasons. Paths remain at their original repository locations. Exclusions include generated iOS/Android projects/build caches, signing/export configuration, local environment, private historical catalog/Zoom data and visual QA fixtures/captures. No dependency tree, private corpus or signed binary is distributed. Unchanged binary assets already in the base are byte-verified. The generated native HTML contains UI code, not the private catalog.

This subset establishes inspectable implementation and a source-to-historical-release mapping. It cannot reproduce the complete private build or a byte-identical IPA. Do not add the omitted historical bundled data to Git. `public-release-config.json` records only validated public origins/flags from the omitted local environment. The build18 version/configuration is historical, not a new release version. Existing root files outside the mapped subset belong to the old base and are not represented as current production code.

## Inspect and reproduce

In `apps/practice-app`, run `npm ci --ignore-scripts --no-audit --fund=false`, then the exact targeted command in `review-checks.json`. It exercises actual session wrapper code with synthetic iOS/Android IO and a local HTTP provider; it does not contact Cabinet. In `apps/wiki-graph`, use the same install command and `npm test`.

Verify every exported hash with Python: load `export-manifest.json`, iterate `exported_files`, and compare each repository-relative file SHA256. All 176 match; run `python3 docs/qa-native18-source-review-2026-10-15/verify-export.py` from the repository root. The full frozen app unit suite also passed 125/125 without the private generated data. `callback-configuration.json` contains only safe fields extracted from the original generated iOS/Android configs and their source hashes. The shared callback remains `su.xuanxue.daychi:/oauth/cabinet`, with the legacy scheme retained. These are static configuration checks, not device callback execution.

`historical-source-receipt.json`, `historical-verification.json` and `historical-apple-release-receipt.json` preserve the earlier sanitized executed evidence. The verification record is pre-upload (`apple_upload:false`); the later Apple API receipt records successful upload, VALID processing and IN_BETA_TESTING for all four existing internal testers. Those historical API observations were not freshly queried on 15 October. No tester identities or credentials are included. Device and Simulator Hermes hashes differ; no binary equivalence is claimed.

## Evidence limits

The prior runtime checks cover signed-out browser entry/provider return, cancellation/Back and the recorded iPad states. They do not establish successful real Cabinet authentication. Current source-only checks are recorded separately in `review-checks.json`; do not present them as device execution.

Workshop native N01/N11/N15/N16/N17 actual joint proof remains open, along with both-platform runtime coverage required by the assignment. Cabinet must arrange an operator-approved staging account/sign-in and controlled block/recovery, renewal and grant/browser-isolation procedures. No new physical-device or App Store gate is added. Cabinet credentials remain unused by existing Daychi content endpoints; the preparation adapter is unmounted. No account mutation, runtime activation, release, push or PR publication is performed by this preparation.
