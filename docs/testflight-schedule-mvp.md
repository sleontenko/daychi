# TestFlight: schedule and reminders

Current client behavior and build-3 verification are documented in
[schedule-build3.md](schedule-build3.md). The client now uses local iOS reminders
without pairing and an independent public-school HTTPS fallback. The server/APNs
history below remains useful for the legacy opt-out and future Telegram integration.

## Requested first release

The first iPhone test should show today's current classes, allow attendance
selection, and deliver real reminders. Existing prototype screens remain mock
data and are not evidence of readiness for TestFlight.

## Confirmed decisions (2026-09-17)

- Website: https://www.telaviv-taiji.com/kogda, weekly template in Asia/Jerusalem.
- One-off changes/additional classes are announced in the three Telegram chats
  already configured by `TELEGRAM_CHANNELS`. Do not publish their messages or
  private links through the public-read schedule endpoint.
- Apple team: Stanislav Leo, Team ID `92HWGZCSS4` (not ACTOGRAM LTD/Biomatica).
  Apple Developer membership and App Store Connect access verified in browser.
- Approved app name: Тихая практика; bundle ID: `ai.mypraxis.quietpractice`.
- Approved hosting target: user's Mac mini, SSH alias `mac-mini`.

## Implemented foundation

`practice_api/schedule.py` defines timezone-aware occurrences, cancellations,
source snapshot freshness, attendance choices, and due reminder candidates.
Occurrence IDs must survive moves/cancellations. Stale snapshots suppress
reminder candidates. Production reminder delivery is not connected yet.

`schedule_source.py` imports Wix rich-text timetable blocks, validates all seven
days, expands two weeks using Israel DST, and caches for five minutes. Unknown
rows/layout changes fail closed. A time-only edit keeps the occurrence ID;
title/day changes cannot be reliably matched without source IDs and currently
appear as removed/new classes. Live import returned 30 weekly / 60 dated classes.

`schedule_app.py` serves only public website data via `/api/v1/schedule`, never
mounting the private corpus API. `exceptions_verified=false` is explicit.

The client root now displays this endpoint: Today / 7 days / My classes, source
check time, offline cache, foreground refresh, and persistent device-local
attendance selection. The old mock prototype is preserved at `/prototype`.
Notifications are explicitly labeled not connected. No background refresh or
Telegram corrections are claimed.

Verification on 2026-09-17:

- 23 Python schedule/source/API tests passed.
- 5 Node client-model tests passed; TypeScript and Expo lint passed.
- Live browser: source loads, select/reload/persist/filter/deselect passed.
- iOS JS export passed (not a signed native build).
- CocoaPods installed; native project generated (gitignored).
- Native Debug iOS Simulator compilation succeeded with signing disabled using
  Xcode 26.6 / iPhone 17 Pro iOS 26.5 destination. No simulator launch or device
  notification test performed. Build emitted third-party compiler warnings.
- Runtime npm audit reports 7 high and 4 moderate transitive findings; triage
  before release. Do not use audit's suggested Expo Router downgrade blindly.
- Signed Release archive succeeded on 2026-09-17 with automatic signing, team
  `92HWGZCSS4`; no device push test or TestFlight upload performed.

Local preview uses port 8083 and schedule API port 8001.

```bash
.venv/bin/uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8001
cd apps/practice-app
npx expo start --web --port 8083
node --test scripts/schedule-model.test.mjs
```

## Decisions needed

1. Finish Release archive/signing verification and TestFlight delivery.
2. Stable HTTPS route to the Mac mini and secure private-device enrollment.
3. Authority/matching policy for Telegram announcements; ambiguous edits must not
   silently cancel or create the wrong lesson.

## Remaining release work

- Telegram incremental sync with edit handling, trusted announcements, conflict
  review and explicit last-sync freshness. Existing corpus dump is stale (May),
  but the authorized local Telegram session can read current messages. A bounded
  read of the last 14 days in all three configured chats succeeded; it did not
  mutate the corpus or install a recurring worker.
- Persistent attendance preferences with authentication and device ownership.
- Connect attendance choices to server; current persistence is device-local only.
- Proposed server push worker: re-read source state and preferences before send,
  persistent deduplication, retries/receipts and invalid-token cleanup. No blind
  weekly repeats. Define reminder handling after a moved class.
- Device permission request, push registration, opt-out, and notification routing.
  Explain denied permission; never imply that an enabled UI toggle ensures delivery.
- Isolated authenticated schedule service: do not expose the existing private,
  unauthenticated corpus API to the internet as a shortcut.
- Signing, bundle ID, production HTTPS backend, release icons, EAS/native archive,
  App Store Connect record, TestFlight upload and tester access.
- Real iPhone acceptance: select/unselect class, terminate app, receive reminder,
  cancel/move class, deny permission, reconnect after offline period. OS/network
  conditions can delay notification delivery; do not promise exact-time delivery.

Mac mini check: SSH works, existing repo `/Users/mac-mini-server/projects/practice_bot`
is clean at `e8916c5`, no git remotes reported. No service deployed or existing
remote project modified yet. No paid resources or public endpoints created.
Apple app record was created on
2026-09-17: `6813117483`, SKU `quietpractice-ios`, primary locale Russian, iOS.
Verified at https://appstoreconnect.apple.com/apps/6813117483/distribution.
Bundle ID is registered in team `92HWGZCSS4`.

The Mac mini Python environment imports FastAPI/requests successfully, but the
project has neither `.env` nor `practice_bot.session`. Its Telegram login needs
secure setup; never commit or bundle session files. No existing cloudflared
configuration was found in `~/.cloudflared`; a stable HTTPS route is not yet set.

Local Xcode project:
`apps/practice-app/ios/Tihayapraktika.xcworkspace`, scheme `Tihayapraktika`.
Native notification dependencies and `expo-notifications` plugin are installed;
this is only capability preparation, not push registration/delivery.

Release archive attempt (2026-09-17): native `xcodebuild archive`, automatic
signing, team `92HWGZCSS4`, output `/private/tmp/quiet-practice-release-1.xcarchive`.
Do not upload this as a working schedule/reminder build: production
`EXPO_PUBLIC_SCHEDULE_API_URL` is still unset and push delivery is not implemented.
User explicitly chose to finish schedule/reminders first, NOT upload a technical
installation-only build. Existing archive is a signing check, not release-ready.

## Push preparation in progress

- Device-private SQLite store and authenticated API routes added in
  `reminder_store.py` / `reminder_routes.py`. Enable routes only with
  `SCHEDULE_PRIVATE_DB`; pairing codes expire in 15 minutes and are one-use;
  bearer credentials are stored as hashes, opt-out/revocation supported.
- Delivery claim deduplication and a dispatch pass are implemented. `saved`
  responses do not mean reminders are operational. No recurring worker deployed.
- User approved `practice.mypraxis.ai` and creation of a Production, topic-specific
  APNs key for this bundle, with private key storage on Mac mini only (not Git/app).
- After immediate user confirmation, Apple APNs key `Quiet Practice Production`
  was registered and downloaded on 2026-09-17: key ID `429DFGG3ZP`, Production,
  Topic Specific, sole topic `ai.mypraxis.quietpractice`.
- Private key transferred to Mac mini outside the repository:
  `/Users/mac-mini-server/.config/quiet-practice/AuthKey_429DFGG3ZP.p8`.
  Directory mode 700 and key mode 600 verified. The original download remains
  on the local Mac in Downloads, also mode 600. No key contents in Git or app.
- Creating/storing the key does not verify APNs delivery. Transport, worker,
  production HTTPS, client registration, and real-device acceptance remain open.

## Server push implementation (2026-09-17)

- `apns.py`: Production-only HTTP/2 transport, ES256 provider JWT refreshed after
  50 minutes, fixed app topic, generic lock-screen text, zero APNs storage TTL.
  No real device token or real APNs request used in tests.
- `reminder_worker.py`: single dispatch pass, source/preferences reread per
  device, atomic active-consent claim, persistent accepted/rejected/unknown
  outcomes. APNs acceptance is not evidence of device delivery. Unknown outcomes
  are not retried; rejected sends currently are not retried either.
- One reminder per occurrence, including after title/revision/time changes.
  This is a conservative duplicate-prevention rule, not change notifications;
  moved/cancelled-class alerts still require implementation/product verification.
- Invalid APNs device tokens are disabled without disabling a newer replacement.
- Start-time reminders now allow the short worker grace window rather than
  requiring the worker to run at the exact start instant.
- Install server transport dependencies using the `push` optional extra.
  Full local Python test suite: **98 passed**. `git diff --check` passed.
- No service deployed, no iPhone registration UI connected, and no TestFlight
  upload. Do not attach the dispatch pass to the website-only source and claim
  that Telegram cancellations are accounted for.
- DNS read-only check: `mypraxis.ai` uses `dns1.registrar-servers.com` and
  `dns2.registrar-servers.com`; `practice.mypraxis.ai` has no resolved record yet.
  DNS control and the HTTPS routing setup remain needed; no DNS changes made.
- Awaiting user choice on Telegram authority: admin announcements only, with
  ambiguous messages held for review, versus a specific trusted-author list.

## Funnel suitability check (2026-09-17)

- User rejected starting the personal TestFlight with whole-domain DNS migration;
  evaluate Tailscale Funnel first. Leave Namecheap DNS unchanged.
- Read-only SSH check: Mac mini online, Tailscale 1.102.3, standalone system
  extension (`io.tailscale.ipn.macsys`), MagicDNS enabled, no Serve/Funnel config.
- Node hostname: `mac-mini-server.tail07600a.ts.net`. No certificate domains or
  Funnel capability advertised in current status; activation remains unverified.
- CLI supports local HTTP reverse proxy. AC power settings: sleep=0,
  autorestart=1. No power settings changed.
- Candidate for the small personal-test API, not yet proven externally reachable.
  Funnel uses a ts.net hostname, not practice.mypraxis.ai. Requires public HTTPS
  activation and a harmless external health check before deploying private routes.
- Do not expose corpus API or filesystem. Keep enrollment/device authentication.
  No Funnel activation, policy change, certificate request, or publication performed.

### Authorized Funnel smoke test

- User approved HTTPS/Funnel activation and publishing only `ok`; user completed
  the Tailscale web authorization. UI confirmed Funnel ready to use.
- Foreground `funnel --https=443 text:ok` served HTTP/2 200 with a valid TLS
  certificate at `https://mac-mini-server.tail07600a.ts.net/`.
- Public DNS returned three relay IPs. A curl request pinned to one public relay
  with `--resolve` returned 200 `ok`, proving a public route, not just tailnet access.
  The other two relay IPs returned TLS handshake errors on single attempts;
  reliability and iPhone cellular-network acceptance remain unverified.
- Exact temporary Funnel process stopped with SIGINT; SSH test command exited 0.
  Only static text was published, never files or private API. DNS at Namecheap
  unchanged. Tailnet Funnel authorization/certificate provisioning are not revoked
  by stopping the temporary route.

## First functional build work (2026-09-17)

- User explicitly requested persistence through the first TestFlight upload and
  a minimalist app icon. Generated independent sage/ivory circular practice mark;
  configured app/iOS icon and splash, version 1.0.0 build 2.
- iOS enrollment panel uses one-time code, SecureStore device-only keychain
  storage, native APNs device token, explicit permission and server opt-out.
  Selected classes sync to server before UI confirms a change on paired devices;
  failure is visible, never silently treated as successful offline opt-out.
- Production endpoint embedded: `https://mac-mini-server.tail07600a.ts.net`.
- Isolated deploy directory `/Users/mac-mini-server/projects/quiet-practice-release`
  with minimal dependencies and no corpus. Existing remote practice_bot untouched.
  This iteration used an explicit selected-file release snapshot, not a Git push;
  local worktree has unrelated changes and was not committed wholesale.
- LaunchAgent `ai.mypraxis.quietpractice.schedule` binds only 127.0.0.1:8765.
  APNs worker runs every 15 seconds. Funnel background HTTPS proxy targets only
  that service. Private database/key/logs outside repo, process umask 077.
- Fixed package initializer to lazy-load private corpus app, preventing isolated
  service startup from importing it. Live health 200; schedule 60 dated classes;
  unauthenticated preferences 401. Live enrollment/reuse/choices/revocation test
  passed and temporary test device deleted. No APNs push sent in that test.
- Local full Python suite 98 passed; TS/lint and 5 client model tests passed.
  Signed archive `/private/tmp/quiet-practice-release-2.xcarchive` succeeded;
  TestFlight export/upload completed: `Uploaded Tihayapraktika`, `EXPORT SUCCEEDED`
  with exit 0. Apple processing completed; status **Testing** confirmed in browser.
  Assigned to internal group `Личное тестирование`, one tester (account holder),
  automatic distribution of future builds disabled. Test instructions saved,
  explicitly describing Telegram and real-device notification limitations. Export used
  internal-testing-only distribution in team 92HWGZCSS4.
- Non-blocking export warnings: missing dSYMs for prebuilt third-party frameworks
  including SDWebImage variants and Hermes; crash symbolication needs follow-up.
- Browser live screen verified after changes; no simulator launched (all were
  shutdown), no real-device APNs receipt claimed.
- IMPORTANT release limitation: regular timetable is live, but Telegram edits
  are not integrated; UI says one-off cancellations are not verified. This is
  not completion of the original always-current Telegram-aware schedule goal.
  Real iPhone push receipt, token rotation, persistent service after reboot,
  cellular-network acceptance, and dependency audit triage remain unverified.
