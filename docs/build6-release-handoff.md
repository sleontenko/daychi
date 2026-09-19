# Build 6 release handoff — 2026-09-19

Owner authorized verification and TestFlight upload. Release is not delivered yet.
Source commit: `8fd46ff`. Signed device archive and App Store distribution export
both succeeded through GUI launch agents (normal exec hit Keychain access error).

- Archive: `/Users/mac-mini-server/Archives/quiet-practice/quiet-practice-release-6.xcarchive`.
- Export: `/Users/mac-mini-server/Archives/quiet-practice/build6-export`.
- Build logs: `/tmp/quiet-practice-build6-gui-archive.log`,
  `/tmp/quiet-practice-build6-export.log`; corresponding `.exit` files are 0.
- Verified bundle ai.mypraxis.quietpractice, version 1.0.0, build 6,
  team 92HWGZCSS4, HTTPS host mac-mini-server.tail07600a.ts.net.
- Build scripts/one-shot launch agents are in `/tmp/quiet-practice-build6*`
  and `/tmp/ai.mypraxis.quietpractice.{build6,export6}.plist`.

## Remaining gates

1. Explicit owner consent was requested for exposing the authenticated wiki API
   at `https://mac-mini-server.tail07600a.ts.net/api/wiki`. Auto-review rejected
   the Funnel change because TestFlight approval alone did not cover public
   access to private data. Do not retry without consent. Schedule Funnel unchanged.
2. Wiki service is prepared in `/Users/mac-mini-server/projects/quiet-practice-wiki-release`,
   launch agent `ai.mypraxis.quietpractice.wiki`, loopback 8767. Private config,
   catalog and SQLite live in `~/.config/quiet-practice/wiki/`, with restrictive
   permissions. Anonymous loopback request correctly returns 401. No public route.
   After consent, add ONLY `/api/wiki` proxy to `http://127.0.0.1:8767/api/wiki`;
   verify prefix handling, anonymous rejection, authenticated search/detail/logout
   through HTTPS, and unchanged schedule health. Never expose legacy corpus API.
3. App Store Connect in Chrome is signed out. Owner was asked to sign in in
   the open Apple tab. Never request passwords/2FA in chat.
4. Native current-source Debug login/catalog/session restore/detail verified.
   Test Release against public endpoint once it exists. Extreme Dynamic Type,
   VoiceOver and physical device are not yet checked. Private native catalog
   screenshot is ignored in `data/qa-build6/wiki-ios.jpg`.
5. Upload only after functional endpoint check; the repository export-options.plist
   has destination upload. Existing App Store export used a /tmp copy with
   destination export. Wait for Apple processing; add What to Test and assign
   existing internal group, verify Testing. External review still has its own
   outstanding contact details from build 5; do not claim external availability.
6. Record Apple build ID/status, source commit and release tag in changelog,
   update current-version docs only after actual Testing confirmation.

Checks passed: TypeScript, Expo lint, 14 JS tests, 40 backend tests, code signature
verification and bundle URL/build checks. Design reference rule is now in AGENTS.md.
