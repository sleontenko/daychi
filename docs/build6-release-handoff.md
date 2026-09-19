# Build 6 release handoff — 2026-09-19

Source: `8fd46ff89ef5c368d53bad1d67c3a19ccba5699f`;
tag `testflight/ios-1.0.0-6`. No secrets/private data committed.

## Completed

- Owner authorized TestFlight upload and explicitly authorized the authenticated
  production wiki route. HTTPS API is live at
  `https://mac-mini-server.tail07600a.ts.net/api/wiki`.
- Isolated service: `~/projects/quiet-practice-wiki-release`, launch agent
  `ai.mypraxis.quietpractice.wiki`, loopback 8767. Private configuration/catalog/
  SQLite: `~/.config/quiet-practice/wiki/`. Schedule route unchanged.
- HTTPS checks passed: anonymous 401; login, 1145 records, search/detail,
  no-store, logout revocation; schedule health 200.
- 40 backend tests, 14 JS tests, TypeScript and lint passed.
- Native current-source Debug and build-6 Release / iPhone 18 Pro iOS 27:
  login, catalog, session persistence, saved filter, detail. Final Release
  screenshot compared with original; private evidence in `data/qa-build6/`.
- Signed device archive, App Store distribution export, and upload succeeded.
  Archive `~/Archives/quiet-practice/quiet-practice-release-6.xcarchive`;
  export `~/Archives/quiet-practice/build6-export`.
  Logs `/tmp/quiet-practice-build6-{gui-archive,export,upload}.log`, exit files 0.
- Bundle ID/version/build/team and actual wiki HTTPS constant verified.
  Third-party dSYM warnings did not block upload.
- Apple processing completed. Build ID `4cc8dcaf-2b80-4919-a6b5-39a048abd07f`.
  What to Test saved. Owner signed in to App Store Connect.

## Remaining

Auto-review rejected the final Add action granting the build to the existing
internal group «Личное тестирование», because general TestFlight upload consent
was not accepted as exact recipient authorization. Explicit consent requested;
wait for it before retrying. The Chrome Apple tab has the Add Group dialog open,
only «Личное тестирование» checked. After consent, click Add, verify group and
Testing, then update current-version docs and changelog. External group/review
is not part of this internal rollout.

Apple URL: https://appstoreconnect.apple.com/teams/1807807a-3e63-4c00-bfb7-041c50b96e9f/apps/6813117483/testflight/ios/4cc8dcaf-2b80-4919-a6b5-39a048abd07f

Physical iPhone installation/notifications, extreme Dynamic Type and VoiceOver
remain unverified. Index refresh remains manual. Mandatory design-reference
comparison for every subsequent version is in AGENTS.md and docs/DESIGN.md.
