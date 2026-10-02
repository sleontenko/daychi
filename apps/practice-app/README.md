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
