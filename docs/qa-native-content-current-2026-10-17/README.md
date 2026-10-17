# Native Cabinet content — current-source preparation, 17 October 2026

**Later same-day continuation:** the operator subsequently requested mounting.
The distinct protected native host is now connected in PR18; its installed
synthetic iPhone/iPad checks and remaining live-provider/release limits are in
[the mounting report](../qa-native-content-ui-2026-10-17/README.md).
The unmounted statements below retain their original preparation scope.

Base: consolidated main c146326c7ea552772d8c804b3a08ad5637ca5eb0.
Authority: [Workshop16](https://github.com/dveyarangi/xuanxue-workshop/issues/16),
[native-content-session@a07f087](https://github.com/dveyarangi/xuanxue-workshop/blob/a07f08747aa7d97e4d3496e87e1d8319db413698/docs/contracts/native-content-session.md).
The supplied native-content boundary summary is installed in AGENTS.md.

The old16October candidate was based on dfed320 and its earlier React Native
list/detail screen. That occupied checkout is preserved byte-for-byte. This
reconciliation ports its server authority, bounded HTTP adapter, credential-bound
session wrapper and synthetic cases onto current main. It deliberately keeps the
current shared-reader/public bridge unchanged: selecting private content in that
public bridge would silently widen its authority and is not an acceptable port.

## Prepared source

- Explicit GET /api/native/wiki aliases reuse the9 mounted retained wiki handlers.
  Each read makes one fresh fixed-profile HTTPS Cabinet GET /api/auth/native/me.
  No redirect, retry, positive cache, cookie, profile persistence or service secret.
- Complete native response validation and total5-second DNS-to-body deadline;
  malformed/refusal/temporary/rate-limited handling follows the accepted contract.
  A valid active account of any role gets the same content, including recordings.
- Native aliases refuse both canonical browser-wiki hosts, including trailing-dot
  aliases, even when browser opt-in is off. Browser session middleware remains outer.
  Native scope excludes Zoom, invitations, owner/import/write and account mutation.
- Default-off server activation requires DAYCHI_NATIVE_CABINET_ENABLED=1 and
  explicit DAYCHI_NATIVE_CABINET_PROFILE=staging or production. No environment was changed.
- Separate cabinetWikiRequest uses the existing issuer-bound session via readContent.
  It requires both account/content opt-ins and a matching HTTPS Daychi backend.
  Native session failures clear only the matching current Cabinet credential;
  old responses cannot clear a replacement or legacy credentials. Retry-After is honored.
- This adapter is **not mounted in the current WebView UI**. Its private DTOs/tokens
  never enter the public bridge. Existing wikiRequest, UI source/bundles, source
  links, bookmarks, selected classes and reminder paths are unchanged.

## Executed checks

Final backend:292 passed (51 native-content cases), including mounted request paths,
full malformed-profile matrix, deadline across streamed bodies, every refusal,
current-state recovery, legacy/Zoom/admin coexistence and browser-host denial.
App:134 passed (9 native content/session cases), TypeScript and Expo lint passed.
The first sandboxed app run failed existing loopback tests on listen EPERM;
rerun with loopback access passed. Existing module-type and Starlette deprecation
warnings remain. No dependency, build number, URL scheme or storage-key change.

All provider responses/materials in these tests are synthetic; there is no private
corpus or live account fixture. Tests establish consumer behavior, not provider
capacity or joint live conformance. No new installed runtime, native UI comparison,
physical notification delivery, native binary, deployment or production activation.
The separately authorized external release exposes the original build18 only:
[Apple evidence](../qa-external-testflight18-2026-10-17/README.md).

## Remaining work and external dependencies

Cabinet15 must publish provider source/deployment and deployment-wide grant-isolated
capacity proof (C09–C12); current scope requests are in
[the original assignment](https://github.com/dveyarangi/xuanxue-workshop/issues/15#issuecomment-6236663445).
Matching authorized staging fixture access and that evidence are prerequisites for
actual integrated activation. No new aged/deletion fixture or role removal is required.

Daychi still owns explicit protected shared-reader mounting, private-payload lifecycle
teardown, retention of navigation/bookmarks, independent legacy Zoom access and
paired native loading/offline/refusal/recovery/UI proof. The earlier list-screen
candidate is not promoted or copied over the current WebView. A separately reviewed
UX candidate precedes mounting. Then perform the contract's real protected read,
next-read revoke refusal with other-grant/browser survival and recovery observations.

Browser13's alternate-origin request and selections/reminders17 remain independent:
[temporary browser-origin coordination](https://github.com/dveyarangi/xuanxue-workshop/issues/13#issuecomment-6236664382),
[complete sync contract request](https://github.com/dveyarangi/xuanxue-workshop/issues/17#issuecomment-6236662637).
The existing cookie contract cannot be replaced with a Railway/native-token browser
workaround locally, and selections/reminders wire/clock/migration is not invented.

## Published source

[Draft Daychi PR18](https://github.com/sleontenko/daychi/pull/18), tested source
cdd11a55d0b0bd69d5cb756be1782fc9f60f0d3c. GitHub
[Checks39050106884](https://github.com/sleontenko/daychi/actions/runs/39050106884)
passed backend/app/wiki from clean Linux installs (292/134/30 tests plus typecheck,
lint and generated-web-bundle consistency). A subsequent documentation-only update
installs the complete exact Workshop16 BOUNDARY_SUMMARY and current handoff.
Root520 historical WIP files are preserved (only the intentional AGENTS handoff
changed); the occupied old native-content36-file inventory is hash-identical.
