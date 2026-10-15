# Daychi · Дейчи — Expo client

Expo SDK 57 / TypeScript for iOS, Android and web. npm package: daychi-app.
Start with the [project README](../../README.md) and
[CONTRIBUTING](../../CONTRIBUTING.md); local [AGENTS](AGENTS.md) applies.

```sh
npm ci
cp .env.example .env.local
npm run web
# Native development builds, with Xcode / Android SDK:
npm run ios
npm run android
```

Only public URLs belong in EXPO_PUBLIC_* variables.
EXPO_PUBLIC_SCHEDULE_API_URL serves the public schedule;
EXPO_PUBLIC_DAYCHEE_API_URL is the HTTPS personal-access service.
EXPO_PUBLIC_API_URL is the separate historical corpus API.
Protected wiki/Zoom content and AI credentials are not bundled.

```sh
npm run typecheck
npm run lint
npm test
```

Attendance, preferences and bookmarks persist on-device. Schedule timezone is
Asia/Jerusalem. Native notifications/exact alarms require a development build;
browser checks do not verify delivery. Keep bundle ID, URL scheme and legacy
storage keys compatible; see [rename boundaries](../../docs/daychi-rename.md).

The /prototype route contains historical mock data and is not shipped scope.
Approved design and per-screen QA rules: [DESIGN](../../docs/DESIGN.md).
Current release facts: [TestFlight changelog](../../docs/TESTFLIGHT_CHANGELOG.md).

Local native UI regression flows use [Maestro](.maestro/README.md), with a
separate synthetic QA app and private local reports:

```sh
bash scripts/maestro.sh check-syntax
DAYCHI_MAESTRO_DEVICE='<simulator-id>' bash scripts/maestro.sh test
```

## Cabinet · combined TestFlight staging pilot

The existing Schedule tab supports opt-in public Cabinet reads with
EXPO_PUBLIC_CABINET_SCHEDULE_PILOT=1 and
EXPO_PUBLIC_CABINET_API_ORIGIN=https://staging.xuanxue.su. This gate also applies
to the operator-authorized Release candidate. Cabinet/School remain separate
sources; Cabinet is read-only and does not modify ordinary selections, access,
cache or reminders. No background polling or account integration is enabled.
The wire authority is Workshop public-lessons 4aec5f8; prior native evidence
is on codex/cabinet-public-lessons at 58a9039. Controlled provider fixtures
remain outstanding in Workshop #6.

Release result 2026-10-09: combined1.0.0(17) is Apple VALID / internal Testing for all4 existing testers. Staging Cabinet read-only gate is enabled in this frozen build; [QA](../../docs/qa-testflight17-2026-10-09/README.md). External beta remains15.
